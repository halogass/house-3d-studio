// The walkable 3D house: renderer, sky & sun, the build (all at once on desktops, in stages on
// phones), walking / dollhouse modes, minimap, doors, sitting, the lift, cars, multiplayer, the
// spec tab, the quality tiers (auto by measured FPS) and the per-room culling.
import './guard.js'; // the house data is checked first (friendly errors instead of a broken view)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Z, PROJECT, FEATURES } from './data.js';
import { LEVELS, LEVEL_ORDER, EYE, WALK_SPEED, RUN_SPEED, STAIRS, LIFT, LIFT_STOPS, GROUND, ABOVE, isBasement, levelAt } from './config.js';
import { t, getLang } from './i18n.js';
import { siteItemAt } from './site.js';
import { makeMaterials } from './materials.js';
import { Physics } from './physics.js';
import { sunDirection } from './sun.js';
import { Minimap } from './minimap.js';
import { createPipeline } from './render/pipeline.js';
import { LightManager } from './render/lights.js';
import { assemble, assembleStaged } from './assemble.js';
import { mergeNow } from './geom.js';
import { buildLift, LiftController, insideCar, nearDoor } from './lift.js';
import { MultiSession, newRoomCode } from './multi/session.js';
import { transportKind } from './multi/transport.js';
import { Interact } from './interact/controller.js';
import { Doors, DOOR_MODE } from './doors.js';
import { Drive } from './drive/drive.js';
import { renderSpec } from './spec.js';
import { BAKE_GAIN, createBakeRuntime, mayBake } from './render/bake.js';
import { buildUI } from './ui.js';

window.__dhStarted = true; // the boot guard in index.html stops waiting for the download
buildUI(); // level buttons, lift buttons, texts in the visitor's language
const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', isTouch);
const params = new URLSearchParams(location.search);
// Phones and tablets build the house in stages (shell first, then the rest in the background);
// desktops and laptops (touch-screen laptops have a fine pointer) build everything up front.
// ?staged=1 / ?staged=0 forces either path.
const isMobileDevice = isTouch || navigator.userAgentData?.mobile === true
  || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1); // iPadOS reports as a Mac
const staged = params.has('staged') ? params.get('staged') !== '0' : isMobileDevice;

// ---------------------------------------------------------------- renderer
const canvas = $('scene');
// Ask the browser for the strongest GPU (discrete GPU on laptops/PCs, the phone's GPU on mobile)
// Ask for the strongest GPU first; a busy or recovering GPU may refuse that, so fall back to gentler settings
const renderer = (() => {
  const tries = [
    { antialias: !isTouch, powerPreference: 'high-performance' },
    { antialias: false, powerPreference: 'default' },
    { antialias: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false },
  ];
  for (const t of tries) {
    try { return new THREE.WebGLRenderer({ canvas, stencil: false, ...t }); } catch (e) { console.warn('[renderer]', e.message); }
  }
  window.__dhBoot?.show(t('noWebgl'));
  throw new Error('WebGL unavailable');
})();

// Which GPU is actually rendering? Software fallbacks (SwiftShader / llvmpipe) mean the browser's
// hardware acceleration is off, which makes everything crawl.
const gpu = (() => {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const software = /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(name);
  return { name: String(name).replace(/^ANGLE \((.*)\)$/, '$1'), software };
})();
// Phones drop the WebGL context under memory pressure: say so instead of freezing on a black screen
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  // First time in a while: just reload (the app is cached on the device, so it's quick)
  let last = 0;
  try { last = +(sessionStorage.getItem('h3s-ctxlost') || 0); sessionStorage.setItem('h3s-ctxlost', Date.now()); } catch (err) { last = Date.now(); }
  if (Date.now() - last > 120000) { location.reload(); return; }
  const l = document.createElement('div');
  l.id = 'loading';
  document.body.appendChild(l);
  window.__dhBoot?.show(t('ctxLost'));
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false; // redrawn on change only, see frame()
let shadowSig = '', doorsWereBusy = false;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfd8dc, 120, 600);
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 2000);
camera.rotation.order = 'YXZ';

// ---------------------------------------------------------------- sky & light
const sky = new Sky();
sky.scale.setScalar(5000);
scene.add(sky);
const skyU = sky.material.uniforms;
skyU.turbidity.value = 6;
skyU.rayleigh.value = 1.6;
skyU.mieCoefficient.value = 0.005;
skyU.mieDirectionalG.value = 0.8;

const hemi = new THREE.HemisphereLight(0xdfe8f0, 0xcbbd9f, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 3);
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
const S = 45;
Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 300 });
scene.add(sun, sun.target);

// ---------------------------------------------------------------- world
// Phones/tablets and software rendering get light textures (colour only, ≤ 512 px)
// Staged: photo textures are fetched only for what is built, nearest first, a few at a time
const { M, getMaterial, want: wantTextures } = makeMaterials(renderer, { lite: isTouch || gpu.software, deferTextures: staged, custom: PROJECT.materials, door: PROJECT.style.door });
DOOR_MODE.dynamic = FEATURES.doors !== false; // door leaves and gates are drawn and animated by engine/doors.js
const physics = new Physics();
const { groups, labels, lights: lightDefs, interior, energy, stage, vehicles } = (staged ? assembleStaged : assemble)({ M, getMaterial, physics });
const pipe = createPipeline({ renderer, scene, camera, sky, getMaterial, lite: isTouch || gpu.software });
const lightMgr = new LightManager(scene, lightDefs);
let dayFactor = 1;
const lift = new LiftController(buildLift(getMaterial), scene); // inert when the house has no lift
// Lift requests go through here so a partner's lift moves too
function requestLift(lv) { lift.request(lv); multi.sendLift(lv); }
lift.send = (lv) => multi.sendLift(lv);
let riding = false;
// Doors: all closed at start; E / click / tap opens and closes them, automatic gates run themselves.
// Without the 'doors' feature the leaves stand open (world.js) and nothing moves.
const doors = DOOR_MODE.dynamic ? new Doors({ groups, physics, getMaterial, player: null }) : {
  list: [], active: [], send: null, update() {}, pick() { return null; }, raycast() { return null; }, toggle() { return false; },
  openNear() { return []; }, closeNear() { return []; }, snapshot() { return []; }, applyRemote() {}, applySnapshot() {}, label() { return ''; },
  openAll() {}, closeAll() {}, stats() { return { doors: 0 }; },
};
doors.send = (m) => multi.sendDoor(m);
Object.values(groups).forEach(g => scene.add(g));
// The static house meshes never change after the build: once a big buffer is on the GPU, drop the
// JS copy (halves memory on phones). Bounds are computed first because culling needs them.
// Staged stages that land later go through here too.
function freeCpuCopies(root) {
  if (params.has('keepgeo')) return;
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes.position || o.geometry.attributes.position.count < 2000) return;
    if (bake && o.parent && !bakeDone.has(bakeLevelOf(o.parent.userData.groupName)) && mayBake(o, o.parent.userData.groupName)) return; // bake UVs not written yet
    o.geometry.computeBoundingSphere(); o.geometry.computeBoundingBox();
    const free = function () { this.array = null; };
    for (const a of Object.values(o.geometry.attributes)) a.onUpload(free);
    o.geometry.index?.onUpload(free);
    o.raycast = () => {};
  });
}
// They never move either: world matrices are computed once, and the per-render matrix update
// (three walks the whole scene for every pass: main, AO, shadow) skips them
function freeze(o) {
  o.updateMatrixWorld(true);
  o.traverse((c) => { c.matrixAutoUpdate = false; c.matrixWorldAutoUpdate = false; });
}
// Baked lighting (engine/render/bake.js), level by level once the level's meshes exist (desktop: right
// after the start; phones: when the level's stage lands): the areas' bake UVs are unwrapped in a
// worker, their lightmaps fetched into the shared texture arrays, then the UVs written into the
// meshes a few per frame. A stale or missing bake leaves an area's real-time look. ?bake=0: off.
for (const [k, g] of Object.entries(groups)) g.userData.groupName = k;
const bakePairs = () => Object.entries(groups).flatMap(([k, g]) => g.children.filter(o => o.isMesh).map(o => [k, o]));
const bakeLevelOf = (g) => (g === 'roof' ? LEVEL_ORDER[LEVEL_ORDER.length - 1] : String(g).replace('ceil_', ''));
const bakeDone = new Set();
const bake = params.get('bake') === '0' || (FEATURES.bake === false && params.get('bake') !== '1') ? null : createBakeRuntime({
  renderer, lite: isTouch || gpu.software,
  // the meshes whose geometry was rewritten: their new buffers' CPU copies go after upload
  onApplied: (lv, written) => { for (const m of written) freeCpuCopies(m); detailKey = ''; },
});
function bakeLevel(lv) {
  if (!bake || bakeDone.has(lv)) return Promise.resolve();
  return bake.processLevel(lv, bakePairs()).catch((e) => console.warn('[bake]', lv, e)).finally(() => { bakeDone.add(lv); });
}
for (const g of Object.values(groups)) { freeCpuCopies(g); for (const c of g.children) freeze(c); }
// Materials of a subtree, for the texture queue
const materialsOf = (roots) => {
  const out = new Set();
  for (const r of roots) r.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) out.add(m); });
  return out;
};
// Shell textures: the site and the ground floor first (the visitor starts at the gate), then up, then down
const shellOrder = [GROUND, ...LEVEL_ORDER.filter(l => !isBasement(l) && l !== GROUND), ...LEVEL_ORDER.filter(isBasement).reverse()];
if (staged) wantTextures(materialsOf(['site', 'ground', 'roof', ...shellOrder.flatMap(l => [l, 'ceil_' + l])].map(k => groups[k])));

if (staged) wantTextures(materialsOf([scene])); // the lift and anything else already in the scene

// Room labels for the dollhouse view
const labelGroups = {};
for (const lv of LEVEL_ORDER) { labelGroups[lv] = new THREE.Group(); labelGroups[lv].visible = false; scene.add(labelGroups[lv]); }
for (const l of labels) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fs = 44;
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(l.text).width) + 28;
  c.width = w; c.height = fs + 24;
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(251,248,242,0.88)';
  ctx.beginPath(); ctx.roundRect(0, 0, c.width, c.height, 14); ctx.fill();
  ctx.fillStyle = '#3a3028';
  ctx.textBaseline = 'middle';
  ctx.fillText(l.text, 14, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const k = 0.022;
  sp.scale.set(c.width * k, c.height * k, 1);
  sp.position.set(l.x, l.z, -l.y);
  sp.renderOrder = 10;
  labelGroups[l.level].add(sp);
}

// ---------------------------------------------------------------- player
// Teleport list: the street in front of the gate, the garden items with a name, every room
const site = Z.site;
const roadPoint = (() => {
  const gate = (Z.gates || [])[0];
  const mid = gate ? [(gate.from[0] + gate.to[0]) / 2, (gate.from[1] + gate.to[1]) / 2] : [site.w / 2, 0];
  return { s: [mid[0], -3, 0], n: [mid[0], site.d + 3, Math.PI], w: [-3, mid[1], Math.PI / 2], e: [site.w + 3, mid[1], -Math.PI / 2] }[site.road] || [mid[0], -3, 0];
})();
const START = PROJECT.start ? { x: PROJECT.start.x, y: PROJECT.start.y, yaw: PROJECT.start.yaw ?? 0, lv: PROJECT.start.level || null } : { x: roadPoint[0], y: roadPoint[1], yaw: roadPoint[2], lv: null };
const PRESETS = [
  { name: t('street'), ...START },
  ...site.items.filter(it => it.r && it.names && ['terrace', 'paving', 'lawn', 'pool', 'carport', 'pergola', 'court'].includes(it.kind))
    .map(it => ({ name: it.name, x: (it.r[0] + it.r[2]) / 2, y: (it.r[1] + it.r[3]) / 2, lv: null, yaw: 0 })),
  ...LEVEL_ORDER.flatMap(lv => (Z.floors[lv] || []).filter(r => !r.noLabel).map(r => ({
    name: `${LEVELS[lv].short} · ${r.name}`, x: (r.r[0] + r.r[2]) / 2, y: (r.r[1] + r.r[3]) / 2, lv, yaw: 0,
  }))),
];

const player = { x: START.x, y: START.y, e: 0, vy: 0, grounded: true, yaw: START.yaw, pitch: 0 };
let interact = null; // set up below, once the lift and multiplayer session exist
let drive = null;    // drivable cars (engine/drive), set up with interact

function teleport(x, y, lv, yaw) {
  stage?.bump(lv || 'site'); // staged: build where the visitor is going next
  const e0 = lv ? LEVELS[lv].elev : 0;
  let e = physics.landingAt(x, y, e0);
  if (e === null) return false;
  // a room centre may be taken by furniture: step to the nearest free spot
  if (!physics.canStand(x, y, e)) {
    let found = false;
    for (let r = 0.3; r <= 3 && !found; r += 0.3) for (let k = 0; k < 16 && !found; k++) {
      const qx = x + Math.cos(k * Math.PI / 8) * r, qy = y + Math.sin(k * Math.PI / 8) * r, qe = physics.landingAt(qx, qy, e0);
      if (qe !== null && Math.abs(qe - e) < 0.3 && physics.canStand(qx, qy, qe)) { x = qx; y = qy; e = qe; found = true; }
    }
  }
  if (interact) interact.seated = null; // teleporting gets you off the seat
  drive?.eject(); // ... and out of the car
  Object.assign(player, { x, y, e, vy: 0, grounded: true });
  if (yaw !== undefined) { player.yaw = yaw; player.pitch = 0; }
  return true;
}

function currentLevel() { return levelAt(player.e); }
const liftStop = () => currentLevel();

function roomAt(lv, x, y) {
  const inR = (r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  const room = (Z.floors[lv] || []).find(r => inR(r.r));
  if (room) return room.name;
  const deck = (Z.outdoor[lv] || []).find(o => o.r && inR(o.r));
  if (deck) return deck.name;
  const it = siteItemAt(Z, x, y);
  if (it) return it.name;
  if (x < 0 || y < 0 || x > site.w || y > site.d) return t('street');
  return t('garden');
}

// ---------------------------------------------------------------- input
const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyM') toggleMode();
  // Lift: 1…n inside the car picks a stop (bottom = 1), E outside calls it
  const n = /^Digit(\d)$/.exec(e.code);
  if (n && LIFT_STOPS[+n[1] - 1] && insideCar(player.x, player.y)) requestLift(LIFT_STOPS[+n[1] - 1]);
  // E / R: contextual (sit, lie down, lift buttons, call the lift); moving or Space stands up
  if (mode === 'walk' && !e.repeat) {
    if (e.code === 'KeyE') interact.act('E');
    if (e.code === 'KeyR') interact.act('R');
    if (interact.seated && ['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) interact.stand();
  }
  if (e.code === 'KeyQ' && multi.active) multi.pingAhead();
  if (e.code === 'KeyF' && multi.active) multi.follow();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

let mode = 'walk';
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.target.set(site.w / 2, 0, -site.d / 2);
orbit.enabled = false;

canvas.addEventListener('click', () => {
  if (mode === 'walk' && !isTouch && document.pointerLockElement !== canvas) canvas.requestPointerLock();
  // with the mouse captured, a click presses the lift button under the crosshair
  else if (mode === 'walk' && document.pointerLockElement === canvas) interact.act('press');
});
document.addEventListener('pointerlockchange', () => {
  $('start').classList.toggle('hidden', document.pointerLockElement === canvas || mode !== 'walk' || isTouch);
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  player.yaw += e.movementX * 0.0022;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0022));
});

// Touch: left half = joystick, right half = look
const touch = { move: null, look: null, mx: 0, my: 0 };
const stick = $('stick'), knob = $('knob');
canvas.addEventListener('touchstart', (e) => {
  if (mode !== 'walk') return;
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth / 2 && !touch.move) {
      touch.move = { id: t.identifier, x0: t.clientX, y0: t.clientY };
      stick.style.display = 'block';
      stick.style.left = t.clientX - 60 + 'px'; stick.style.top = t.clientY - 60 + 'px';
      knob.style.transform = 'translate(0px, 0px)';
    } else if (!touch.look) touch.look = { id: t.identifier, x: t.clientX, y: t.clientY };
  }
  $('start').classList.add('hidden');
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (touch.move && t.identifier === touch.move.id) {
      let dx = t.clientX - touch.move.x0, dy = t.clientY - touch.move.y0;
      const d = Math.hypot(dx, dy), max = 50;
      if (d > max) { dx *= max / d; dy *= max / d; }
      touch.mx = dx / max; touch.my = -dy / max;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    } else if (touch.look && t.identifier === touch.look.id) {
      player.yaw += (t.clientX - touch.look.x) * 0.005;
      player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch - (t.clientY - touch.look.y) * 0.005));
      touch.look.x = t.clientX; touch.look.y = t.clientY;
    }
  }
}, { passive: true });
const endTouch = (e) => {
  for (const t of e.changedTouches) {
    if (touch.move && t.identifier === touch.move.id) { touch.move = null; touch.mx = touch.my = 0; stick.style.display = 'none'; }
    if (touch.look && t.identifier === touch.look.id) touch.look = null;
  }
};
canvas.addEventListener('touchend', endTouch);
// Tap (short, no drag) on a lift button presses it
{
  let tap = null;
  const ray = new THREE.Raycaster();
  canvas.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; tap = { x: t.clientX, y: t.clientY, t: performance.now() }; }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    if (!tap || mode !== 'walk' || performance.now() - tap.t > 350 || Math.hypot(t.clientX - tap.x, t.clientY - tap.y) > 12) return;
    ray.setFromCamera({ x: t.clientX / innerWidth * 2 - 1, y: -(t.clientY / innerHeight) * 2 + 1 }, camera);
    ray.far = 2.5;
    const hit = ray.intersectObjects((lift.clickables || []).filter(o => o.userData.active !== false), true)[0];
    if (hit) { lift.press?.(hit.object.userData.liftAction); return; }
    ray.far = 3;
    const door = doors.raycast(ray); // tap on a door opens / closes it
    if (door) doors.toggle(door);
  });
}
canvas.addEventListener('touchcancel', endTouch);

// ---------------------------------------------------------------- modes & visibility
let cut = 'all';
function applyVisibility() {
  const walk = mode === 'walk';
  const upto = walk || cut === 'all' ? LEVEL_ORDER.length - 1 : LEVEL_ORDER.indexOf(cut);
  LEVEL_ORDER.forEach((lv, i) => {
    groups[lv].visible = i <= upto;
    groups['ceil_' + lv].visible = walk;
    labelGroups[lv].visible = !walk && cut !== 'all' && lv === cut;
  });
  groups.roof.visible = walk || cut === 'all';
  const above = walk || cut === 'all' || !isBasement(cut);
  groups.site.visible = above;
  groups.ground.visible = above;
  document.querySelectorAll('#cut button').forEach(b => b.classList.toggle('on', b.dataset.cut === cut));
}

function toggleMode(next) {
  mode = next || (mode === 'walk' ? 'house' : 'walk');
  orbit.enabled = mode === 'house';
  if (mode === 'house') {
    if (document.pointerLockElement) document.exitPointerLock();
    camera.position.set(player.x + 30, Math.max(35, player.e + 35), -player.y + 35);
    orbit.target.set(player.x, Math.min(player.e, 0), -player.y);
    if (player.y > site.d || player.y < 0 || player.x < 0 || player.x > site.w) {
      camera.position.set(site.w / 2 + 25, 30, 25); orbit.target.set(site.w / 2, 0, -site.d / 2);
    }
    orbit.update();
  } else {
    camera.rotation.set(player.pitch, -player.yaw, 0);
  }
  $('cut').classList.toggle('hidden', mode !== 'house');
  document.querySelectorAll('#mode button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  $('start').classList.toggle('hidden', mode !== 'walk' || isTouch || document.pointerLockElement === canvas);
  applyVisibility();
}
document.querySelectorAll('#mode button').forEach(b => b.onclick = () => toggleMode(b.dataset.mode));
document.querySelectorAll('#cut button').forEach(b => b.onclick = () => { cut = b.dataset.cut; applyVisibility(); });

// ---------------------------------------------------------------- options panel
const presetSel = $('preset');
PRESETS.forEach((p, i) => presetSel.add(new Option(p.name, i)));
presetSel.onchange = () => {
  const p = PRESETS[+presetSel.value];
  teleport(p.x, p.y, p.lv, p.yaw);
  toggleMode('walk');
};
$('menuBtn').onclick = () => $('menu').classList.toggle('open');
// Menu tabs: Kontrol | Spec rumah (spec is built on first open)
document.querySelectorAll('#menuTabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#menuTabs button').forEach(o => o.classList.toggle('on', o === b));
  for (const id of ['tabCtl', 'tabSpec']) $(id).classList.toggle('hidden', id !== b.dataset.tab);
  $('menu').classList.toggle('spec', b.dataset.tab === 'tabSpec');
  if (b.dataset.tab === 'tabSpec' && !$('tabSpec').innerHTML) renderSpec($('tabSpec'), { Z, PROJECT, energy, seats: interior.seats, doors });
});

let hour = 9.5, month = 7;
// URL parameters for links and screenshots (docs/ENGINE.md): ?time=14.5 ?month=3
if (params.has('time')) hour = Math.max(5.5, Math.min(19, +params.get('time') || hour));
if (params.has('month')) month = Math.max(1, Math.min(12, Math.round(+params.get('month')) || month));
const monthSel = $('month');
(getLang() === 'id' ? ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']).forEach((m, i) => monthSel.add(new Option(m, i + 1)));
monthSel.value = month;
monthSel.onchange = () => { month = +monthSel.value; updateSun(); multi.sendTime(hour, month); };
const timeIn = $('time');
timeIn.value = hour;
timeIn.oninput = () => { hour = +timeIn.value; updateSun(); multi.sendTime(hour, month); };

const qualitySel = $('quality');
// Starting tier from the device; the FPS probe below adjusts it automatically.
let autoQuality = true;
try { const saved = localStorage.getItem('h3s-quality'); if (saved) { qualitySel.value = saved; autoQuality = false; } } catch (e) {}
if (autoQuality) qualitySel.value = gpu.software ? 'low' : (isTouch ? 'low' : 'high');
if (['low', 'high', 'ultra'].includes(params.get('quality'))) { qualitySel.value = params.get('quality'); autoQuality = false; } // ?quality=… (not remembered)
qualitySel.onchange = () => {
  autoQuality = false; // the user chose
  try { localStorage.setItem('h3s-quality', qualitySel.value); } catch (e) {}
  setQuality(qualitySel.value);
};
function setQuality(q) {
  pipe.setQuality(q);
  renderer.shadowMap.enabled = q !== 'low';
  sun.castShadow = q !== 'low';
  // Ultra: 4096 shadow map (≈2 cm texels over the ±45 m frustum) for crisp window-frame shadows
  const size = q === 'ultra' ? 4096 : 2048;
  if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  resize();
  if (started) precompile().then(warmShadows); // the culled rooms too, so walking into one later does not stall
}
let started = false;

const MOON_DIR = new THREE.Vector3(0.45, 0.78, -0.43).normalize(), MOON_COLOR = new THREE.Color(0x9fb3d9);
function updateSun() {
  const d = sunDirection(hour, month);
  const hh = Math.floor(hour), mm = Math.round((hour - hh) * 60);
  $('timeLabel').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  skyU.sunPosition.value.set(d.x, d.y, d.z);
  const day = Math.max(0, Math.min(1, (d.y + 0.05) / 0.25));
  // after dusk the directional light becomes a cool moon high in the east-north-east (soft, shadowed):
  // night stays night but the gardens and paths are walkable
  const moon = Math.max(0, Math.min(1, (0.02 - d.y) / 0.1));
  const dir = new THREE.Vector3(d.x, d.y, d.z).normalize().lerp(MOON_DIR, moon).normalize();
  sun.intensity = 3.2 * day + 0.42 * moon;
  sun.color.setHSL(0.09, 0.6, 0.55 + 0.35 * Math.min(1, d.y * 3)).lerp(MOON_COLOR, moon);
  hemi.intensity = 0.24 + 0.69 * day; // sky fill so rooms away from windows aren't murky (a little night sky too)
  dayFactor = day;
  pipe.setDaylight(day);
  scene.fog.color.setHSL(0.58, 0.15, 0.12 + 0.68 * day);
  sun.userData.dir = dir;
}

// ---------------------------------------------------------------- lift UI
const liftUI = $('liftUI'), liftFloors = $('liftFloors'), liftCall = $('liftCall');
liftFloors.querySelectorAll('button').forEach(b => b.onclick = () => requestLift(b.dataset.lv));
liftCall.onclick = () => requestLift(liftStop());

// ---------------------------------------------------------------- explore together (multiplayer)
const multi = new MultiSession({
  scene, camera, player, physics, lift, teleport, doors,
  currentLevel: () => currentLevel(),
  seat: () => drive?.seat() || interact.seat(),
  onTransport: (t) => drive?.attach(t),
  onPeersChanged: () => drive?.sendSnapshot(),
  // (h, m, false) applies a partner's time; (null, null, true) re-broadcasts ours
  setTime: (h, m, broadcast) => {
    if (broadcast) { multi.sendTime(hour, month); return; }
    hour = h; month = m; timeIn.value = h; monthSel.value = m; updateSun();
  },
  onStatus: (t) => { $('mpStatus').textContent = t; },
  onPeers: (list) => { $('mpPeers').textContent = list.length ? t('together', { names: list.map(p => p.name).join(', ') }) : ''; },
});
{
  const nameIn = $('mpName'), colorIn = $('mpColor'), codeIn = $('mpCode');
  try { nameIn.value = localStorage.getItem('h3s-name') || ''; colorIn.value = localStorage.getItem('h3s-color') || '#b5532f'; } catch (e) {}
  const params = new URLSearchParams(location.search);
  if (params.get('room')) { codeIn.value = params.get('room').toUpperCase(); $('menu').classList.add('open'); }
  $('mpMode').textContent = transportKind === 'local' ? t('localMode') : '';
  const join = async (code) => {
    const name = nameIn.value.trim() || (getLang() === 'id' ? 'Tamu' : 'Guest');
    try { localStorage.setItem('h3s-name', name); localStorage.setItem('h3s-color', colorIn.value); } catch (e) {}
    codeIn.value = code;
    history.replaceState(null, '', '?room=' + code);
    try {
      await multi.start({ room: code, name, color: colorIn.value });
      $('mpJoined').classList.remove('hidden'); $('mpJoin').classList.add('hidden');
      $('mpLink').value = location.origin + location.pathname + '?room=' + code;
    } catch (err) { $('mpStatus').textContent = err.message; }
  };
  $('mpCreate').onclick = () => join(newRoomCode());
  $('mpJoinBtn').onclick = () => { const c = codeIn.value.trim().toUpperCase(); if (c) join(c); };
  $('mpLeave').onclick = () => {
    multi.stop(); history.replaceState(null, '', location.pathname);
    $('mpJoined').classList.add('hidden'); $('mpJoin').classList.remove('hidden');
    $('mpStatus').textContent = ''; $('mpPeers').textContent = ''; $('mpHud').classList.add('hidden');
  };
  $('mpCopy').onclick = () => { navigator.clipboard?.writeText($('mpLink').value); $('mpCopy').textContent = t('copied'); setTimeout(() => ($('mpCopy').textContent = t('copyLink')), 1500); };
  $('mpFollow').onclick = () => { if (multi.follow()) toggleMode('walk'); };
  $('mpPing').onclick = () => multi.pingAhead();
  $('mpVoice').onclick = async () => {
    try {
      if (!multi.local) { await multi.enableVoice(); $('mpVoice').textContent = t('mute'); return; }
      multi.setMuted(!multi.muted); $('mpVoice').textContent = multi.muted ? t('unmute') : t('mute');
    } catch (err) { $('mpStatus').textContent = t('micFail', { msg: err.message }); }
  };
  // Browsers only start audio after a gesture: resume on the first tap/click
  addEventListener('pointerdown', () => multi.active && multi.ensureAudio(), { once: false });
}

// ---------------------------------------------------------------- interaction (sit / lie down / lift buttons / doors)
drive = new Drive({
  scene, camera, player, physics, getMaterial, multi, keys, touch, Z, vehicles, isTouch, defer: staged,
  onModel: (m) => { if (staged) wantTextures(materialsOf([m])); },
});
interact = new Interact({
  vehicle: { inside: () => drive.inCar, target: () => drive.target(), exit: () => drive.exit() },
  seats: FEATURES.sit === false ? [] : interior.seats || [], player, physics, camera, lift, doors,
  currentLevel: () => currentLevel(),
  occupied: () => (multi.active ? multi.occupiedSeats() : new Set()),
  nearLiftDoor: () => nearDoor(player.x, player.y),
  onCallLift: () => requestLift(liftStop()),
});

// ---------------------------------------------------------------- minimap
const minimap = new Minimap($('minimap'), Z, (x, y, lv) => {
  if (teleport(x, y, lv)) toggleMode('walk');
});
document.querySelectorAll('#mmLevels button').forEach(b => b.onclick = () => minimap.setLevel(b.dataset.lv, true));

// ---------------------------------------------------------------- loop
function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  pipe.resize(w, h);
}
addEventListener('resize', resize);

let last = performance.now();
let lastPlace = '';
let lastFrameAt = performance.now(), stageLevel = null;
function frame(now = performance.now()) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  lastFrameAt = performance.now();
  if (mode === 'walk') {
    if (drive.inCar) drive.drive(dt); // car: input → car → player + chase camera
    else {
    let f = 0, s = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
    f += touch.my; s += touch.mx;
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(touch.mx, touch.my) > 0.95) ? RUN_SPEED : WALK_SPEED;
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    const dx = (sy * f + cy * s) * speed * dt, dy = (cy * f - sy * s) * speed * dt;
    // pushing the joystick while seated stands up
    if (interact.seated && Math.hypot(touch.mx, touch.my) > 0.3) interact.stand();
    const px = player.x, py = player.y, wasInside = insideCar(px, py);
    if (!riding && !interact.seated) physics.step(player, dx, dy, dt);
    // The lift car is only enterable when it waits at this floor with its doors open
    if (!wasInside && insideCar(player.x, player.y) && !lift.doorsOpenAt(liftStop())) { player.x = px; player.y = py; }
    }
    riding = lift.update(dt, player, liftStop());
    if (player.e < -30) teleport(START.x, START.y, START.lv, START.yaw);
    if (!drive.inCar) {
      camera.position.set(player.x, player.e + interact.eye(EYE), -player.y);
      camera.rotation.set(player.pitch, -player.yaw, 0);
    }
  } else {
    orbit.update();
  }

  // Shadow camera follows the action
  const focus = mode === 'walk' ? new THREE.Vector3(player.x, player.e, -player.y) : orbit.target.clone();
  const dir = sun.userData.dir || new THREE.Vector3(0, 1, 0);
  // Snap the shadow frustum to whole shadow-map texels: otherwise every step re-samples the edges
  // and thin shadows (window frames on the piers) crawl and flicker as jagged teeth
  {
    const texel = (2 * S) / sun.shadow.mapSize.x;
    const right = new THREE.Vector3(0, 1, 0).cross(dir);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    const upv = new THREE.Vector3().crossVectors(dir, right).normalize();
    const snap = (axis) => { const d = focus.dot(axis); focus.addScaledVector(axis, Math.round(d / texel) * texel - d); };
    snap(right); snap(upv);
  }
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(dir, 120);

  // HUD
  const lv = currentLevel();
  // the lowest basement is never visible from above ground: skip drawing it there (helps phones)
  if (mode === 'walk' && LEVEL_ORDER.filter(isBasement).length > 1) {
    const below = isBasement(lv);
    groups[LEVEL_ORDER[0]].visible = below;
    groups['ceil_' + LEVEL_ORDER[0]].visible = below;
  }
  updateLevelDetail(lv);
  updateCarShadows(now);
  if (stage && lv !== stageLevel) { if (stageLevel) stage.bump(lv); stageLevel = lv; } // walked to another level
  const place = `${LEVELS[lv].name} · ${roomAt(lv, player.x, player.y)}`;
  if (place !== lastPlace) { $('place').textContent = place; lastPlace = place; }
  doors.update(dt, player, multi.active ? multi.peers : null);
  multi.update(dt);
  drive.tick(dt);
  minimap.draw(player, lv, multi.active ? multi.peerMarkers() : []);
  if (multi.active) {
    const lines = multi.peerSummary(roomAt);
    $('mpHud').classList.toggle('hidden', !lines.length);
    if (lines.length) $('mpHud').textContent = lines.join('  ·  ');
  }
  if (mode !== 'walk') lift.update(dt, player, liftStop());
  interact.update(mode === 'walk');
  const inCar = mode === 'walk' && insideCar(player.x, player.y);
  const atDoor = mode === 'walk' && !inCar && nearDoor(player.x, player.y);
  liftUI.classList.toggle('hidden', !inCar && !atDoor);
  liftFloors.classList.toggle('hidden', !inCar);
  liftCall.classList.toggle('hidden', !atDoor);

  const indoor = mode === 'walk' && (Z.floors[lv] || []).some(r => player.x > r.r[0] && player.x < r.r[2] && player.y > r.r[1] && player.y < r.r[3]);
  pipe.setIndoor(indoor);
  bake?.update(dayFactor);
  pipe.setAO(!(mode === 'walk' && bake?.inBaked(player.x, player.y, player.e))); // the bake has the occlusion there
  lightMgr.update(camera.position, lv, dayFactor, qualitySel.value, mode === 'walk' ? !indoor : undefined);
  pipe.update(dt);
  // The sun's shadow map is redrawn only when something in it can have changed: the visitor moved
  // a shadow texel or more (the frustum is texel-snapped), the sun, the culling, a door, the lift
  // or a car moved, or a partner is around. Standing still, sitting or orbiting the dollhouse costs
  // no shadow pass; and the AO pass never redraws it a second time in the same frame.
  {
    let cars = 0;
    for (const c of drive.cars) cars += c.root.position.x * 3.1 + c.root.position.y * 1.7 + c.root.position.z + c.root.rotation.y * 5.3;
    const sig = `${focus.x},${focus.y},${focus.z},${dir.x},${dir.y},${dir.z},${detailKey},${pipe.quality},${sun.shadow.mapSize.x},${lift.phase},${lift.open},${lift.y ?? ''},${cars}`;
    // doors: while they swing and once more for the pose they stop in
    const doorsBusy = doors.active.length > 0, doorsMoved = doorsBusy || doorsWereBusy;
    doorsWereBusy = doorsBusy;
    if (sig !== shadowSig || doorsMoved || multi.active || !build.doneAt) { renderer.shadowMap.needsUpdate = true; shadowSig = sig; }
  }
  pipe.render();
  probeFps(now);
  adaptResolution(now);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- GPU / auto quality
// Measures real frame rate for a few seconds after start (and after each auto change) and moves
// one tier up or down: phones with strong GPUs get shadows, weak ones stay smooth.
const TIERS = ['low', 'high', 'ultra'];
let probe = { start: 0, frames: 0, done: false, rounds: 0, lowStreak: 0 };
function probeFps(now) {
  if (!autoQuality || probe.done || document.hidden) return;
  if (!probe.start) { probe.start = now + 4000; return; }   // skip warm-up (texture loads, shader compiles)
  if (now < probe.start) return;
  probe.frames++;
  const secs = (now - probe.start) / 1000;
  if (secs < 3) return;
  const fps = probe.frames / secs;
  $('gpuFps').textContent = t('fps', { n: Math.round(fps) });
  const restart = (extra = {}) => { probe = { ...probe, start: now, frames: 0, ...extra }; };
  // < 5 FPS is a stall or an occluded window, not the GPU's real speed: measure again
  if (fps < 5) { if (probe.rounds++ < 6) restart(); else probe.done = true; return; }
  const i = TIERS.indexOf(qualitySel.value);
  if (fps < 28 && i > 0) {
    // drop only after two slow measurements in a row
    if (probe.lowStreak + 1 >= 2) { qualitySel.value = TIERS[i - 1]; setQuality(TIERS[i - 1]); restart({ start: 0, lowStreak: 0, rounds: probe.rounds + 1 }); }
    else restart({ lowStreak: probe.lowStreak + 1 });
  } else if (fps > 57 && i < TIERS.length - 1 && !isTouch && !gpu.software && probe.rounds < 4) {
    qualitySel.value = TIERS[i + 1]; setQuality(TIERS[i + 1]); restart({ start: 0, lowStreak: 0, rounds: probe.rounds + 1 });
  } else probe.done = true;
  if (probe.rounds > 6) probe.done = true;
}
// Adaptive resolution: when the frame rate stays under ~28 FPS the render scale drops (to 60 % of
// the tier's pixel ratio at most), above ~50 it climbs back; no shader recompiles, only the drawing
// buffer resizes. Phones / tablets, and any device on the light tier; ?dynres=1 / 0 forces it.
const dynres = { t0: 0, n: 0, min: 0.6 };
function adaptResolution(now) {
  const on = params.has('dynres') ? params.get('dynres') !== '0' : (isMobileDevice || qualitySel.value === 'low');
  if (!on) { if (pipe.scale !== 1) pipe.setScale(1); return; }
  // the tier probe measures first; staged building costs CPU time a lower resolution does not save
  if ((autoQuality && !probe.done) || !build.doneAt || document.hidden || mode !== 'walk') { dynres.t0 = 0; return; }
  if (!dynres.t0) { dynres.t0 = now; dynres.n = 0; return; }
  dynres.n++;
  const secs = (now - dynres.t0) / 1000;
  if (secs < 2) return;
  const fps = dynres.n / secs;
  dynres.t0 = 0;
  if (fps < 5) return; // a stall (tab switch, GC), not the GPU's speed
  let k = pipe.scale;
  if (fps < 28) k = Math.max(dynres.min, k * 0.85);
  else if (fps > 50) k = Math.min(1, k * 1.1);
  if (Math.abs(k - pipe.scale) > 0.005) pipe.setScale(k > 0.99 ? 1 : k);
  $('gpuFps').textContent = t('fps', { n: Math.round(fps) }) + (pipe.scale < 1 ? ' · ' + t('resolution', { p: Math.round(pipe.scale * 100) }) : '');
}
$('gpuName').textContent = gpu.name;
if (gpu.software) $('gpuWarn').classList.remove('hidden');

// ---------------------------------------------------------------- staged build (phones / tablets)
// The shell is up; finishes, exterior detailing and furniture are built in ~10 ms slices between
// frames (the visitor's current level first, see assembleStaged). When a stage lands its shaders
// are compiled off the main thread, its meshes appear over a few frames, then it turns solid.
const build = { staged, shellAt: performance.now(), doneAt: staged ? null : performance.now(), progress: staged ? 0 : 1, stages: [] };
const SLICE = +(params.get('slice') || 10);
const REVEAL_VERTS = 150000; // vertices made visible per frame while a stage lands
const nextTask = globalThis.scheduler?.postTask
  ? () => globalThis.scheduler.postTask(() => {}, { priority: 'user-visible' })
  : () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// A stage landed on top of the visitor (furniture, a tree): step to the nearest free spot
function unstick() {
  if (riding || interact.seated || drive.inCar || !physics.collides(player.x, player.y, player.e)) return;
  for (let r = 0.25; r <= 3; r += 0.25) for (let k = 0; k < 16; k++) {
    const x = player.x + Math.cos(k * Math.PI / 8) * r, y = player.y + Math.sin(k * Math.PI / 8) * r;
    const e = physics.landingAt(x, y, player.e);
    if (e !== null && Math.abs(e - player.e) < 0.5 && physics.canStand(x, y, e)) { Object.assign(player, { x, y, e, vy: 0 }); return; }
  }
}

// Furniture & finishes of floors you can't see are hidden (the shell stays, so views through
// windows and stairwells are unchanged); so is the furniture of rooms beyond ROOM_REACH, small
// decor (lamps, plants, art, mirrors) beyond DECOR_REACH, and furniture / parked cars only cast sun
// shadows within SHADOW_REACH. Cuts the per-frame triangle count (main, shadow and AO passes) a
// lot: desktops and laptops hold 60 fps, mobile GPUs don't time out and drop the WebGL context.
// The dollhouse view draws everything. ?reach= / ?decor= / ?shadowReach= (metres) override.
const levelDetail = {}; // level → [{ ud: userData { box, decor, cast }, mesh }] (see assemble.js)
const reachOf = (k, phone, desk) => +(params.get(k) || (isMobileDevice ? phone : desk));
const ROOM_REACH = reachOf('reach', 12, 24);
const DECOR_REACH = reachOf('decor', 8, 14);
const SHADOW_REACH = reachOf('shadowReach', 10, 16);
// near a stair or the lift the floors above and below are in view too
const CORE_ZONES = [...STAIRS.map(S => S.r), ...(LIFT ? [LIFT.r] : [])].map(r => [r[0] - 1.5, r[1] - 1.5, r[2] + 1.5, r[3] + 1.5]);

// Desktop dollhouse: the per-room furniture meshes are many (one per room and material); seen from
// outside, all of them at once cost more draw-call overhead than the old per-floor merge. So the
// desktop build also keeps that merge (one mesh per floor and material, the same vertices) for the
// dollhouse view only, and walk mode draws the per-room meshes. (BatchedMesh would avoid the copy,
// but materials shared by batched and plain meshes make three re-resolve their program on every
// switch, which cost more than it saved.) Phones keep the per-room meshes in the dollhouse too:
// GPU memory is what they lack. Takes [[group, mesh]], returns the overview meshes as pairs.
const overview = [];
function overviewOf(pairs) {
  const sets = new Map(), out = [];
  for (const [g, m] of pairs) {
    if (!m.userData.room) continue;
    const k = g + '|' + m.material.uuid + '|' + m.castShadow;
    if (!sets.has(k)) sets.set(k, { g, list: [] });
    sets.get(k).list.push(m);
  }
  for (const { g, list } of sets.values()) {
    // baked and unbaked pieces merge together: the unbaked ones get a zero (= not baked) bake UV
    if (list.some(m => m.geometry.attributes.bakeUv)) for (const m of list) if (!m.geometry.attributes.bakeUv) m.geometry.setAttribute('bakeUv', new THREE.BufferAttribute(new Float32Array(m.geometry.attributes.position.count * 2), 2));
    const merged = mergeNow(list.map(m => m.geometry));
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material);
    mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow;
    mesh.visible = false;
    mesh.userData.overview = true; // never baked (the per-room meshes are)
    overview.push(mesh);
    out.push([g, mesh]);
  }
  return out;
}
// A plain mesh that only casts a shadow: the shadow pass (first in each frame) draws it, the
// camera passes after it draw nothing (empty draw range)
function hideDraw() { this.geometry.drawRange.count = 0; }
function showDraw() { this.geometry.drawRange.count = Infinity; }
function shadowOnly(m, on) {
  if (!!m.userData.shadowOnly === on) return;
  m.userData.shadowOnly = on;
  if (on) { m.onBeforeShadow = showDraw; m.onBeforeRender = hideDraw; }
  else { delete m.onBeforeShadow; delete m.onBeforeRender; m.geometry.drawRange.count = Infinity; }
}
function addDetail(meshes) {
  for (const m of meshes) {
    const id = m.userData.stage;
    if (!LEVEL_ORDER.includes(id)) continue;
    m.userData.cast = m.castShadow; // what it casts when close
    (levelDetail[id] ||= []).push({ ud: m.userData, mesh: m });
  }
}
if (!staged) {
  for (const [name, g] of Object.entries(groups)) {
    const meshes = g.children.filter(o => o.isMesh && o.userData.stage);
    addDetail(meshes);
    for (const [, o] of overviewOf(meshes.map(m => [name, m]))) { g.add(o); freeCpuCopies(o); freeze(o); }
  }
}
let detailKey = '', shownLevels = LEVEL_ORDER;
const CULL = params.get('cull') !== '0'; // ?cull=0: draw every floor and room (for comparisons)
function updateLevelDetail(lv) {
  let show;
  if (mode !== 'walk' || !CULL) show = LEVEL_ORDER;
  else {
    const inside = (Z.floors[lv] || []).some(r => player.x > r.r[0] && player.x < r.r[2] && player.y > r.r[1] && player.y < r.r[3]);
    const nearCore = CORE_ZONES.some(Q => player.x > Q[0] && player.x < Q[2] && player.y > Q[1] && player.y < Q[3]);
    const i = LEVEL_ORDER.indexOf(lv);
    if (nearCore) show = LEVEL_ORDER.filter((_, j) => Math.abs(j - i) <= 1);          // stairs / lift: the floors above & below
    else if (!inside && !isBasement(lv)) show = ABOVE;                                  // outside: look in through the glass
    else show = [lv];
  }
  // furniture is merged per room: draw only rooms within reach of the visitor (in walk mode)
  const cell = mode === 'walk' ? Math.round(player.x / 1.5) + ',' + Math.round(player.y / 1.5) : 'all';
  shownLevels = show;
  const shadows = renderer.shadowMap.enabled;
  const key = show.join() + '|' + cell + '|' + shadows + '|' + Object.values(levelDetail).reduce((n, a) => n + a.length, 0);
  if (key === detailKey) return;
  detailKey = key;
  const px = player.x, pz = -player.y, walk = mode === 'walk' && CULL;
  const R2 = ROOM_REACH * ROOM_REACH, D2 = DECOR_REACH * DECOR_REACH, S2 = SHADOW_REACH * SHADOW_REACH;
  // What is not drawn still casts its sun shadow when it is close and on the floor just above an
  // above-ground one (the low sun comes in under it: an L2 terrace shading the living room): drawn
  // into the shadow map only. Basements get no sun worth an upper floor's shadow pass.
  const top = Math.max(...show.map(l => LEVEL_ORDER.indexOf(l)));
  const sunlit = show.some(l => !isBasement(l));
  for (const [id, list] of Object.entries(levelDetail)) {
    const shown = show.includes(id), above = sunlit && LEVEL_ORDER.indexOf(id) === top + 1;
    // window frames, sills and facade finishes of the other above-ground floor show across the
    // garden and through the glass: finishes (no box) of the above-ground floors stay drawn together
    const facade = shown || (sunlit && !isBasement(id));
    for (const e of list) {
      let draw = e.ud.box ? shown : facade, cast = shadows && e.ud.cast && (draw || above);
      const b = e.ud.box;
      if (b && walk) {
        const dx = Math.max(b.min.x - px, 0, px - b.max.x), dz = Math.max(b.min.z - pz, 0, pz - b.max.z);
        const d2 = dx * dx + dz * dz;
        draw = draw && d2 < (e.ud.decor ? D2 : R2);
        cast = cast && d2 < S2;
      }
      if (b && overview.length && !walk && CULL) draw = cast = false; // the dollhouse draws the overview instead
      e.mesh.visible = draw || cast;
      e.mesh.castShadow = cast;
      shadowOnly(e.mesh, !draw && cast);
    }
  }
  for (const m of overview) m.visible = !walk && CULL;
}
// Parked cars cast sun shadows only near the visitor and on a floor in view (checked twice a second)
let carShadowAt = 0;
function updateCarShadows(now) {
  if (now - carShadowAt < 500) return;
  carShadowAt = now;
  const walk = mode === 'walk', r2 = (SHADOW_REACH + 3) ** 2;
  for (const c of drive.cars) {
    if (!c.model) continue;
    const dx = c.root.position.x - player.x, dz = c.root.position.z + player.y;
    const lvc = levelAt(c.root.position.y);
    // not the garage's cars from upstairs; the one being driven always
    const near = !walk || c.mine || c.driver || (dx * dx + dz * dz < r2 && shownLevels.includes(lvc));
    if (c.model.userData.near === near) continue;
    c.model.userData.near = near;
    c.model.traverse((o) => { if (!o.isMesh) return; o.userData.cast ??= o.castShadow; o.castShadow = near && o.userData.cast; });
  }
}

// Compile every program the scene can need, including meshes culled right now (a room's
// materials must not compile only when the visitor walks in): everything is shown and casting for
// that moment, then the next frame's culling puts it back. compileAsync compiles in parallel, but
// only the camera passes' programs, and for the target they draw into (the composer's HDR buffer on
// high / ultra: no tone mapping, linear output); warmShadows() then draws one full frame so the
// shadow-depth and AO-normal variants exist too.
function showAll() {
  const hidden = Object.values(groups).filter(g => !g.visible);
  for (const g of hidden) g.visible = true;
  for (const list of Object.values(levelDetail)) for (const e of list) {
    e.mesh.visible = true; e.mesh.castShadow = e.ud.cast; shadowOnly(e.mesh, false);
  }
  for (const m of overview) m.visible = true; // uploaded now, then its CPU copy is freed
  detailKey = ''; // culling is redone on the next frame
  return () => { for (const g of hidden) g.visible = false; };
}
function precompile() {
  const restore = showAll(), target = renderer.getRenderTarget();
  renderer.setRenderTarget(pipe.composer ? pipe.composer.readBuffer : null);
  const p = renderer.compileAsync(scene, camera).catch(() => { /* compiles on first draw instead */ });
  renderer.setRenderTarget(target);
  restore();
  return p;
}
function warmShadows() {
  if (!renderer.shadowMap.enabled) return;
  const restore = showAll();
  renderer.shadowMap.needsUpdate = true;
  pipe.render();
  restore();
}

async function land(l) {
  const holder = new THREE.Group();
  for (const [, m] of l.meshes) holder.add(m);
  addDetail(l.meshes.map(([, m]) => m));
  const target = renderer.getRenderTarget();
  renderer.setRenderTarget(pipe.composer ? pipe.composer.readBuffer : null); // see precompile()
  const compiled = renderer.compileAsync(holder, camera, scene);
  renderer.setRenderTarget(target);
  try { await compiled; } catch (e) { /* compiles on first draw instead */ }
  // Shown a few meshes per frame: each one's vertex buffers are uploaded on its first draw
  let verts = 0;
  for (const [g, m] of l.meshes) {
    const n = m.isMesh && !m.isInstancedMesh ? m.geometry.attributes.position?.count || 0 : 0;
    if (verts && verts + n > REVEAL_VERTS) { verts = 0; await nextFrame(); }
    groups[g].add(m);
    verts += n;
  }
  l.apply(); // colliders + walk surfaces, grid rebuilt
  for (const [, m] of l.meshes) { freeCpuCopies(m); freeze(m); }
  lightMgr.addDefs(l.lights);
  interact.indexSeats(l.seats); // already in interior.seats (= interact.app.seats)
  drive.stageLanded(l.id); // that level's cars
  wantTextures(materialsOf(l.meshes.map(([, m]) => m)));
  unstick();
  bakeLevel(l.id); // the level is complete now: its baked lighting (in the background)
  build.stages.push({ id: l.id, at: Math.round(performance.now()) });
}

async function runStages() {
  const landing = [];
  const bar = $('bgLoad');
  bar.classList.remove('hidden');
  for (;;) {
    // keep frames coming: if the last one is overdue, let one through before more work
    if (performance.now() - lastFrameAt > 3 * SLICE) { await nextFrame(); await nextTask(); }
    const t0 = performance.now();
    let r = true;
    while (r !== false && performance.now() - t0 < SLICE) {
      r = stage.step();
      if (r !== true && r !== false) landing.push(land(r));
    }
    build.progress = stage.progress();
    bar.textContent = t('loadingPct', { p: Math.min(99, Math.floor(build.progress * 100)) });
    if (r === false) break;
    await nextTask();
  }
  await Promise.all(landing);
  wantTextures(); // anything still waiting
  build.progress = 1;
  build.doneAt = performance.now();
  bar.remove();
  $('tabSpec').innerHTML = ''; // the spec tab counts seats: draw it again with everything in
  if (!$('tabSpec').classList.contains('hidden')) renderSpec($('tabSpec'), { Z, PROJECT, energy, seats: interior.seats, doors });
}

// ---------------------------------------------------------------- start
setQuality(qualitySel.value);
updateSun();
teleport(START.x, START.y, START.lv, START.yaw);
toggleMode('walk');
// ?at=x,y[,level[,yawDeg[,pitchDeg]]]  start somewhere else (yaw: 0 = looking north, 90 = east)
// ?mode=house[&cut=<level>]  start in the dollhouse view; ?ui=0  hide the on-screen panels
if (params.get('at')) {
  const [x, y, lv, yaw, pitch] = params.get('at').split(',');
  if (teleport(+x, +y, LEVELS[lv] ? lv : null, yaw !== undefined && yaw !== '' ? +yaw * Math.PI / 180 : undefined) && pitch) player.pitch = +pitch * Math.PI / 180;
}
if (params.get('mode') === 'house') { toggleMode('house'); if (params.get('cut') && (LEVELS[params.get('cut')] || params.get('cut') === 'all')) { cut = params.get('cut'); applyVisibility(); } }
// ?cam=x,y,h,tx,ty,th  dollhouse camera at plan (x, y) height h looking at plan (tx, ty) height th
if (mode === 'house' && params.get('cam')) {
  const [x, y, h, tx, ty, th] = params.get('cam').split(',').map(Number);
  camera.position.set(x, h, -y); orbit.target.set(tx, th || 0, -ty); orbit.update();
}
if (params.get('ui') === '0') document.body.classList.add('noui');
$('help').textContent = isTouch ? t('helpTouch') : t('helpDesk');
// Compile the shaders in parallel (KHR_parallel_shader_compile) instead of freezing the first
// frame, with everything still visible (culling starts with the first frame: a room's materials
// must not compile only when the visitor walks in) and the point-light pool already sized for the
// tier (the light count is part of every program)
lightMgr.update(camera.position, currentLevel(), dayFactor, qualitySel.value);
await Promise.race([precompile(), new Promise(r => setTimeout(r, 8000))]);
warmShadows();
$('loading').remove();
started = true;
try { sessionStorage.removeItem('h3s-retry'); } catch (e) {}
// Cache the app + textures on the device so later visits don't depend on a flaky connection
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
// Small hook for automated checks / screenshots
window.__dh = { bakeGain: BAKE_GAIN, bake: () => ({ ...(bake?.stats() || {}) }), bakeRt: bake, Z, PROJECT, roomAt, currentLevel, levelDetail, overview, renderer, scene, groups, physics, pipe, lightMgr, lift, doors, minimap, multi, teleport, interact, drive, toggleMode, setCut: (c) => { cut = c; applyVisibility(); }, player, camera, orbit, build };
requestAnimationFrame(frame);
// desktop: every level is built, bake them one after the other in the background
if (!staged && bake) (async () => { for (const lv of shellOrder) await bakeLevel(lv); })();
if (stage) runStages();

