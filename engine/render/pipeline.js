// Render pipeline (quality tiers, GTAO, bloom, SMAA, adaptive resolution).
//
//   const pipe = createPipeline({ renderer, scene, camera, sky, getMaterial });
//   pipe.setQuality('ultra' | 'high' | 'low');
//   per frame: pipe.update(dt); pipe.render();
//   on sun change: pipe.setDaylight(day 0..1)   (also drives emissive glow via setNightFactor)
//   on room change: pipe.setIndoor(bool)        (auto-exposure eases between the two)
//   on resize: pipe.resize(innerWidth, innerHeight)
//   adaptive resolution: pipe.setScale(0.5..1) scales the tier's pixel ratio
//
// ultra: GTAO (16 samples, denoised) + bloom + SMAA, pixel ratio ≤ 2.
// high:  GTAO (8 samples)            + bloom + FXAA, pixel ratio ≤ 1.5.
// low:   no composer at all (direct render, renderer tone mapping), pixel ratio 1.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { setNightFactor } from '../materials.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function createPipeline({ renderer, scene, camera, sky, getMaterial, lite = false } = {}) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const size = renderer.getSize(new THREE.Vector2());
  let width = size.x || innerWidth, height = size.y || innerHeight;
  let quality = null;
  let day = 1, indoor = false;

  // ------------------------------------------------ exposure (eased)
  const EXPOSURE = {
    outdoorDay: 1.05, outdoorNight: 1.0,
    indoorDay: 1.9, indoorNight: 1.0,
  };
  let exposure = EXPOSURE.outdoorDay, envIntensity = 0.025;
  const targetExposure = () => indoor
    ? lerp(EXPOSURE.indoorNight, EXPOSURE.indoorDay, day)
    : lerp(EXPOSURE.outdoorNight, EXPOSURE.outdoorDay, day);
  // The Sky shader's radiance is far brighter than our light units (the sun disk dominates), so
  // the baked environment is scaled down hard; envScale is tunable at runtime.
  const opts = { envScale: 0.025, bloomDay: 40, bloomNight: 1.6, hdriGain: 0.93 };
  const targetEnv = () => opts.envScale * (indoor ? 0.6 : 1) * lerp(0.4, 1, day);
  renderer.toneMappingExposure = exposure;

  // ------------------------------------------------ environment from the sky (PMREM)
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envScene = null, envRT = null;
  const lastSun = new THREE.Vector3(1e9, 0, 0);
  let lastTurb = -1, envTimer = 0, envDirty = true;
  if (sky) {
    envScene = new THREE.Scene();
    const envSky = new Sky();
    envSky.material = sky.material; // shares the live uniforms
    envSky.scale.setScalar(50);
    envScene.add(envSky);
  }
  // HDRI reflections: a CC0 photo sky (public/env, sun removed by scripts/env-hdri.mjs) over the
  // Sky in the environment, for the whole property (setHdriBlend(0..1) eases it out/in again).
  // Tinted and dimmed with the time of day and turned so its brightest side faces the real sun.
  // The visible sky stays the Sky shader.
  const hdri = { mesh: null, weight: 1, target: 1, meta: null };
  if (envScene && typeof document !== 'undefined') {
    fetch('/env/env.json').then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((meta) => {
      new THREE.TextureLoader().load('/env/' + (lite ? meta.file.mobile : meta.file.desktop), (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.ShaderMaterial({
          uniforms: { map: { value: t }, gain: { value: new THREE.Vector3(1, 1, 1) }, rot: { value: 0 }, weight: { value: 0 } },
          vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
          fragmentShader: `uniform sampler2D map; uniform vec3 gain; uniform float rot; uniform float weight; varying vec3 vDir;
            void main() { vec3 d = normalize( vDir );
              vec2 uv = vec2( fract( atan( d.z, d.x ) / 6.28318530718 + 0.5 - rot ), asin( clamp( d.y, -1.0, 1.0 ) ) / 3.14159265359 + 0.5 );
              gl_FragColor = vec4( texture2D( map, uv ).rgb * gain * weight, weight ); }`,
          side: THREE.BackSide, depthTest: false, depthWrite: false, transparent: true,
          blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        });
        hdri.mesh = new THREE.Mesh(new THREE.SphereGeometry(40, 48, 24), mat);
        hdri.mesh.renderOrder = 1;
        hdri.meta = meta;
        envScene.add(hdri.mesh);
        envDirty = true;
      });
    }).catch(() => { /* no HDRI: the Sky alone, as before */ });
  }
  function updateHdri() {
    if (!hdri.mesh) return;
    const u = hdri.mesh.material.uniforms, sp = sky.material.uniforms.sunPosition.value, m = hdri.meta;
    const sunY = sp.y / (sp.length() || 1);
    // decoded HDRI × scale = calibrated radiance (open-sky irradiance ≈ the noon hemisphere fill);
    // divided by envScale because scene.environmentIntensity multiplies it back
    const k = m.scale * opts.hdriGain / m.eUp / opts.envScale * Math.max(0.03, day);
    const warm = Math.min(1, Math.max(0, sunY / 0.35));
    u.gain.value.set(k * lerp(1.0, 1, warm), k * lerp(0.7, 1, warm), k * lerp(0.5, 1, warm));
    if (day < 0.05) u.gain.value.set(k * 0.35, k * 0.45, k * 0.8); // night: dim blue
    u.rot.value = (Math.atan2(sp.z, sp.x) - Math.atan2(m.sun[2], m.sun[0])) / (2 * Math.PI);
    u.weight.value = hdri.weight;
    hdri.mesh.visible = hdri.weight > 0.001;
  }
  function refreshEnvironment() {
    if (!envScene) return;
    updateHdri();
    const rt = pmrem.fromScene(envScene, 0, 0.1, 100, { size: lite ? 128 : 256 });
    scene.environment = rt.texture;
    envRT?.dispose();
    envRT = rt;
    lastSun.copy(sky.material.uniforms.sunPosition.value);
    lastTurb = sky.material.uniforms.turbidity.value;
    envDirty = false;
    envTimer = 0;
  }
  function envNeedsRefresh() {
    if (!envScene) return false;
    if (envDirty) return true;
    const u = sky.material.uniforms;
    const s = u.sunPosition.value;
    const moved = lastSun.lengthSq() > 1e8 ? true : s.clone().normalize().angleTo(lastSun.clone().normalize()) > 0.01;
    return moved || u.turbidity.value !== lastTurb || (hdri.mesh && Math.abs(hdri.mesh.material.uniforms.weight.value - hdri.weight) > 0.01);
  }

  // ------------------------------------------------ composer (built lazily, not for 'low')
  let composer = null, renderPass, gtao, bloom, smaa, fxaa, output;
  function buildComposer() {
    composer = new EffectComposer(renderer); // HalfFloat render targets (HDR until OutputPass)
    renderPass = new RenderPass(scene, camera);
    gtao = new GTAOPass(scene, camera, width, height);
    gtao.blendIntensity = 0.85;
    bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.55, 0.45, 1.2);
    output = new OutputPass();
    smaa = new SMAAPass();
    fxaa = new FXAAPass();
    composer.addPass(renderPass);
    composer.addPass(gtao);
    composer.addPass(bloom);
    composer.addPass(output);
    composer.addPass(smaa);
    composer.addPass(fxaa);
  }

  function applyBloom() {
    if (!bloom) return;
    // HDR threshold (pre-exposure). The Sky shader's radiance near the sun is huge, so by day the
    // threshold sits far above it (only the sun disk blooms); at night lamps/flames (> 1) bloom.
    bloom.threshold = lerp(opts.bloomNight, opts.bloomDay, day * day);
    bloom.strength = (quality === 'ultra' ? 0.45 : 0.38) * lerp(1, 0.6, day);
    bloom.radius = 0.45;
  }

  function setQuality(q) {
    if (!['ultra', 'high', 'low'].includes(q)) q = 'high';
    if (q === quality) return;
    quality = q;
    const pr = pixelRatio();
    renderer.setPixelRatio(pr);
    renderer.shadowMap.enabled = q !== 'low';
    renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft was removed in r18x
    renderer.shadowMap.needsUpdate = true;
    if (q !== 'low') {
      if (!composer) buildComposer();
      gtao.updateGtaoMaterial(q === 'ultra'
        ? { radius: 0.5, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 16, distanceFallOff: 1 }
        : { radius: 0.45, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 8, distanceFallOff: 1 });
      gtao.updatePdMaterial(q === 'ultra'
        ? { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 }
        : { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 8 });
      gtao.enabled = aoWanted;
      smaa.enabled = q === 'ultra';
      fxaa.enabled = q === 'high';
      composer.setPixelRatio(pr);
      applyBloom();
    } else if (composer) {
      // free the HDR targets (GTAO, bloom mips) — phones need that GPU memory back
      for (const p of composer.passes) p.dispose?.();
      composer.dispose();
      composer = null;
    }
    // materials compile against the new shadow settings
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true)); });
    resize(width, height);
  }

  // Pixel ratio: the tier's cap times the adaptive render scale (setScale, 0.5..1)
  let scale = 1;
  function pixelRatio() {
    const cap = quality === 'ultra' ? Math.min(devicePixelRatio, 2) : quality === 'high' ? Math.min(devicePixelRatio, 1.5) : 1;
    return cap * scale;
  }
  function setScale(k) {
    k = Math.max(0.5, Math.min(1, k));
    if (k === scale) return;
    scale = k;
    const pr = pixelRatio();
    renderer.setPixelRatio(pr); // no shader changes: only the drawing buffer and the HDR targets resize
    composer?.setPixelRatio(pr);
    resize(width, height);
  }

  function resize(w, h) {
    width = w; height = h;
    renderer.setSize(w, h, false);
    if (camera.isPerspectiveCamera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
    if (composer) composer.setSize(w, h);
  }

  function setDaylight(d) {
    day = Math.max(0, Math.min(1, d));
    setNightFactor(1 - day);
    applyBloom();
  }

  function setIndoor(v) { indoor = !!v; }
  function setHdriBlend(w) { hdri.target = w; }
  // GTAO off where baked lighting already has the occlusion (engine/render/bake.js): one pass less
  let aoWanted = true;
  function setAO(on) { aoWanted = !!on; if (gtao) gtao.enabled = aoWanted; }

  function update(dt = 1 / 60) {
    // auto-exposure: ease ~1.5 s
    const k = 1 - Math.exp(-dt * 2.2);
    exposure += (targetExposure() - exposure) * k;
    envIntensity += (targetEnv() - envIntensity) * k;
    renderer.toneMappingExposure = exposure;
    scene.environmentIntensity = envIntensity;
    // environment map, throttled (≤ 2 / s, 1 / 2 s on low)
    envTimer += dt;
    // HDRI blend eases over ~1 s (refreshed 10× a second while it moves)
    const easing = Math.abs(hdri.target - hdri.weight) > 0.001;
    if (easing) hdri.weight += Math.sign(hdri.target - hdri.weight) * Math.min(Math.abs(hdri.target - hdri.weight), dt * 1.2);
    if (envTimer > (easing && hdri.mesh ? 0.1 : quality === 'low' ? 2 : 0.5) && envNeedsRefresh()) refreshEnvironment();
  }

  function render() {
    if (envDirty && envScene) refreshEnvironment();
    if (quality === 'low' || !composer) renderer.render(scene, camera);
    else composer.render();
  }

  // No quality yet: the app picks one right away, so phones never build the HDR composer
  setDaylight(1);
  refreshEnvironment();

  return {
    render, resize, setQuality, setDaylight, setIndoor, setAO, setHdriBlend, update, refreshEnvironment, setScale,
    get quality() { return quality; },
    get scale() { return scale; },
    get exposure() { return exposure; },
    get composer() { return composer; },
    getMaterial,
    options: opts,
    dispose() { composer?.dispose(); envRT?.dispose(); pmrem.dispose(); },
  };
}
