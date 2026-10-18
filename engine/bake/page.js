// Offline lightmap baker (studio/bake.html, dev server only). Driven by scripts/bake.mjs:
//   const r = await window.runBake({ area: 'l1', spp: 256, bounces: 3, skipHash })
//   → { manifest, files: { 'day-0-<hash>.webp': base64, ... } }   ({ skipped: true } when the
//   area's geometry hash equals skipHash: the stored bake is still valid)
//
// The property is built exactly as the app builds it (assemble(), door leaves dynamic), the area's
// bake UVs come from engine/render/bake.js (same unwrap, same hash as the app), then a GPU path
// tracer (three-mesh-bvh BVH in textures) runs in lightmap space: every texel of every baked
// triangle shoots cosine-distributed paths into the scene around it.
//   day   = HDRI sky dome (sun removed, public/env) + sun bounce (direct sun excluded: real-time)
//   night = all interior lamps of the area (next-event estimation with soft shadows) + emissive
//           surfaces; their bounce. Lamp fixtures don't shadow their own bulb (as in real time).
// Results are accumulated (ping-pong float targets), invalid texels (inside walls / furniture)
// are refilled from their neighbours, gutters dilated, a light edge-aware filter applied, and
// the maps are written as sRGB WebP with the fixed scales of engine/render/bake.js (BAKE_SCALE), one
// file per page (2048², the last page cropped to the rows in use) plus half-size copies for phones.
// Bounce colour: surfaces reflect a desaturated (BOUNCE_SAT) and slightly lifted (BOUNCE_GAIN)
// albedo, so dark wood panelling doesn't tint whole rooms sepia (the camera sees the real albedo).
import * as THREE from 'three';
import { MeshBVH, MeshBVHUniformStruct, FloatVertexAttributeTexture, BVHShaderGLSL } from 'three-mesh-bvh';
import { makeMaterials } from '../materials.js';
import { Physics } from '../physics.js';
import { assemble } from '../assemble.js';
import { DOOR_MODE } from '../geom.js';
import { sunDirection } from '../sun.js';
import { BAKE_VERSION, BAKE_PAGE, BAKE_SCALE, OPEN_SKY, bakeAreas, prepareArea } from '../render/bake.js';

const logEl = document.getElementById('log');
const log = (...a) => { const s = a.join(' '); console.log('[bake] ' + s); logEl.textContent += s + '\n'; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// mean linear colour of a texture (cached)
const meanCache = new Map();
function meanOf(tex) {
  if (!tex) return [1, 1, 1];
  if (meanCache.has(tex.uuid)) return meanCache.get(tex.uuid);
  let out = [1, 1, 1];
  const img = tex.image;
  try {
    if (img && img.data && img.width) {
      const d = img.data, n = img.width * img.height, k = d.length / n;
      const acc = [0, 0, 0];
      for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) acc[c] += lin(d[i * k + c] / 255);
      out = acc.map(v => v / n);
    } else if (img && (img.width || img.videoWidth)) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 32;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0, 32, 32);
      const d = cx.getImageData(0, 0, 32, 32).data, acc = [0, 0, 0];
      for (let i = 0; i < 1024; i++) for (let c = 0; c < 3; c++) acc[c] += lin(d[i * 4 + c] / 255);
      out = acc.map(v => v / 1024);
    }
  } catch (e) { /* tainted / not decodable: white */ }
  meanCache.set(tex.uuid, out);
  return out;
}
const BOUNCE_SAT = 0.55, BOUNCE_GAIN = 1.12;
function surfaceOf(mat) {
  const m = meanOf(mat.map);
  const metal = mat.metalness || 0;
  const k = (1 - 0.5 * metal) * BOUNCE_GAIN;
  const a = [mat.color.r * m[0] * k, mat.color.g * m[1] * k, mat.color.b * m[2] * k];
  const l = 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  const alb = a.map(v => Math.min(0.88, Math.max(0, l + (v - l) * BOUNCE_SAT)));
  let emi = [0, 0, 0];
  const glow = mat.userData.glow;
  if (glow && mat.emissive && !mat.defines?.DH_FAKE_GLOW) emi = [mat.emissive.r, mat.emissive.g, mat.emissive.b].map(v => v * glow.night);
  return { alb, emi, two: mat.side === THREE.DoubleSide ? 1 : 0 };
}

// ---------------------------------------------------------------- shaders
// bakeUv = (2 + 2 × page + u, 2 / 4 / 6 + v): only the page being rendered (curLayer) is drawn
const VERT = /* glsl */`
attribute vec2 bakeUv;
attribute float psize;
uniform float curLayer;
varying vec3 vPos;
varying vec3 vNrm;
void main() {
  vec4 wp = modelMatrix * vec4( position, 1.0 );
  vPos = wp.xyz;
  vNrm = normalize( mat3( modelMatrix ) * normal );
  float L = max( 0.0, floor( ( bakeUv.x - 2.0 ) * 0.5 ) );
  float yv = bakeUv.y - 2.0;
  vec2 uv = vec2( bakeUv.x - 2.0 - 2.0 * L, yv - 2.0 * floor( yv * 0.5 ) );
  gl_Position = bakeUv.x > 1.5 && abs( L - curLayer ) < 0.5 ? vec4( uv * 2.0 - 1.0, 0.0, 1.0 ) : vec4( 2.0, 2.0, 2.0, 1.0 );
  gl_PointSize = max( 1.0, psize );
}`;
const GBUF = /* glsl */`
varying vec3 vPos;
varying vec3 vNrm;
uniform int which;
uniform float curLayer;
void main() { gl_FragColor = which == 0 ? vec4( vPos, 1.0 ) : vec4( normalize( vNrm ), 1.0 ); }`;
// three-mesh-bvh's traversal with two safety caps: a ray started inside a pile of coincident
// triangles (a leaf that cannot split) would otherwise test thousands per node and stall the GPU
const RAY_FUNCTIONS = BVHShaderGLSL.bvh_ray_functions
  .replace('while ( pointer > - 1 && pointer < BVH_STACK_DEPTH ) {', 'int dhIt = 0;\n\twhile ( pointer > - 1 && pointer < BVH_STACK_DEPTH && dhIt ++ < 2048 ) {')
  .replace('for ( uint i = offset, l = offset + count; i < l; i ++ ) {', 'for ( uint i = offset, l = offset + min( count, 48u ); i < l; i ++ ) {');
if (RAY_FUNCTIONS === BVHShaderGLSL.bvh_ray_functions) console.warn('[bake] BVH traversal caps not applied');
const TRACE = /* glsl */`
precision highp isampler2D;
precision highp usampler2D;
${BVHShaderGLSL.common_functions}
${BVHShaderGLSL.bvh_struct_definitions}
${RAY_FUNCTIONS}
uniform BVH bvh;
uniform sampler2D nrmTex;
uniform sampler2D albTex;
uniform sampler2D emiTex;
uniform sampler2D prevTex;
uniform sampler2D skyTex;
uniform float skyScale;
uniform float skyRot;
uniform vec3 sunDir;
uniform vec3 sunE;
uniform vec4 lampPos[ MAX_LAMPS ];   // xyz, w = range (cut-off)
uniform vec4 lampCol[ MAX_LAMPS ];   // rgb × intensity, w = clear radius (the fixture's own body: no self-shadow)
uniform vec4 lampExt[ MAX_LAMPS ];   // xyz half-size of the emitting surface (sampled over it), w = 1: emits downwards only
uniform int nLamps;
uniform float frame;
uniform float minHit;
uniform float curLayer;
varying vec3 vPos;
varying vec3 vNrm;
uint seed;
uint pcg( uint v ) { uint s = v * 747796405u + 2891336453u; uint w = ( ( s >> ( ( s >> 28u ) + 4u ) ) ^ s ) * 277803737u; return ( w >> 22u ) ^ w; }
float rnd() { seed = pcg( seed ); return float( seed ) / 4294967295.0; }
vec3 cosDir( vec3 n ) {
  float r1 = rnd(), r2 = rnd();
  float phi = 6.28318530718 * r1, r = sqrt( r2 );
  vec3 t = normalize( abs( n.y ) < 0.99 ? cross( n, vec3( 0.0, 1.0, 0.0 ) ) : cross( n, vec3( 1.0, 0.0, 0.0 ) ) );
  vec3 b = cross( n, t );
  return normalize( t * ( cos( phi ) * r ) + b * ( sin( phi ) * r ) + n * sqrt( max( 0.0, 1.0 - r2 ) ) );
}
vec3 sky( vec3 d ) {
  float u = atan( d.z, d.x ) / 6.28318530718 + 0.5 - skyRot;
  float v = asin( clamp( d.y, - 1.0, 1.0 ) ) / 3.14159265359 + 0.5;
  return texture2D( skyTex, vec2( fract( u ), v ) ).rgb * skyScale;
}
bool occluded( vec3 o, vec3 d, float tmax ) {
  uvec4 fi = uvec4( 0u ); vec3 fn = vec3( 0.0 ); vec3 bc = vec3( 0.0 ); float side = 1.0; float dist = 0.0;
  return bvhIntersectFirstHit( bvh, o, d, fi, fn, bc, side, dist ) && dist < tmax;
}
vec3 sunDirect( vec3 p, vec3 n ) {
  float c = dot( n, sunDir );
  if ( c <= 0.0 ) return vec3( 0.0 );
  return occluded( p + n * 0.003, sunDir, 1e9 ) ? vec3( 0.0 ) : sunE * c;
}
float fallOff( float d, float cut ) {
  float f = 1.0 / max( d * d, 0.04 ); // ≥ 20 cm: no blown-out disc on a ceiling right above a bulb
  if ( cut > 0.0 ) { float x = d / cut; float k = clamp( 1.0 - x * x * x * x, 0.0, 1.0 ); f *= k * k; }
  return f;
}
// downward emitters (ceiling LEDs): Lambertian, nothing upwards (L: surface → lamp)
float emitCos( int i, vec3 L ) { return lampExt[ i ].w > 0.5 ? max( 0.0, L.y ) : 1.0; }
float lampWeight( int i, vec3 p, vec3 n ) {
  vec3 L = lampPos[ i ].xyz - p;
  float d = length( L );
  float c = dot( n, L / d );
  // extended emitters: a surface may face part of the strip / panel while its centre is behind it
  if ( c <= 0.0 && dot( lampExt[ i ].xyz, vec3( 1.0 ) ) > 0.1 ) c = 0.05;
  c *= emitCos( i, L / d );
  return c <= 0.0 ? 0.0 : dot( lampCol[ i ].rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) * fallOff( d, lampPos[ i ].w ) * c;
}
// one lamp per call, picked by its unshadowed contribution (two passes, no local arrays)
vec3 lampDirect( vec3 p, vec3 n ) {
  float W = 0.0;
  for ( int i = 0; i < MAX_LAMPS; i ++ ) { if ( i >= nLamps ) break; W += lampWeight( i, p, n ); }
  if ( W <= 0.0 ) return vec3( 0.0 );
  float r = rnd() * W, acc = 0.0, wk = 0.0;
  int k = 0;
  for ( int i = 0; i < MAX_LAMPS; i ++ ) {
    if ( i >= nLamps ) break;
    float wi = lampWeight( i, p, n );
    acc += wi; k = i; wk = wi;
    if ( acc >= r && wi > 0.0 ) break;
  }
  vec3 lp = lampPos[ k ].xyz + ( vec3( rnd(), rnd(), rnd() ) - 0.5 ) * ( 0.06 + 2.0 * lampExt[ k ].xyz );
  vec3 L = lp - p;
  float d = length( L );
  vec3 ld = L / d;
  float c = dot( n, ld ) * emitCos( k, ld );
  if ( c <= 0.0 ) return vec3( 0.0 );
  float clr = max( 0.4, lampCol[ k ].w );
  if ( d > clr + 0.05 && occluded( p + n * 0.003, ld, d - clr ) ) return vec3( 0.0 );
  return lampCol[ k ].rgb * fallOff( d, lampPos[ k ].w ) * c * W / max( wk, 1e-8 );
}
void main() {
  vec4 prev = texelFetch( prevTex, ivec2( gl_FragCoord.xy ), 0 );
  seed = pcg( uint( gl_FragCoord.x ) * 1973u + uint( gl_FragCoord.y ) * 9277u + uint( frame ) * 26699u ) | 1u;
  // degenerate / NaN normals (zero-area slivers) would send NaN rays into the BVH walk: skip them
  if ( ! ( dot( vNrm, vNrm ) > 1e-8 ) || any( isnan( vPos ) ) ) { gl_FragColor = prev; return; }
  vec3 N = normalize( vNrm );
  vec3 P = vPos;
  vec3 sum = vec3( 0.0 );
  float valid = 0.0;
  for ( int s = 0; s < SPP; s ++ ) {
    vec3 E = vec3( 0.0 );
#if NIGHT
    E += lampDirect( P, N );
#endif
    vec3 o = P + N * 0.002, d = cosDir( N );
    vec3 T = vec3( 1.0 ), L = vec3( 0.0 );
    bool ok = true;
    for ( int b = 0; b < BOUNCES; b ++ ) {
      uvec4 fi = uvec4( 0u ); vec3 fn = vec3( 0.0 ); vec3 bc = vec3( 0.0 ); float side = 1.0; float dist = 0.0;
      bool hit = bvhIntersectFirstHit( bvh, o, d, fi, fn, bc, side, dist );
      if ( ! hit ) {
#if ! NIGHT
        L += T * sky( d );
#endif
        break;
      }
      vec4 alb = textureSampleBarycoord( albTex, bc, fi.xyz );
      bool two = alb.a > 0.5;
      if ( b == 0 && ( dist < minHit || ( side < 0.0 && ! two && dist < 0.6 ) ) ) { ok = false; break; }
      if ( side < 0.0 && ! two ) break;
      vec3 x = o + d * dist;
      vec3 n = textureSampleBarycoord( nrmTex, bc, fi.xyz ).xyz;
      if ( ! ( dot( n, n ) > 1e-8 ) ) break;
      n = normalize( n );
      if ( dot( n, d ) > 0.0 ) n = - n;
#if NIGHT
      L += T * textureSampleBarycoord( emiTex, bc, fi.xyz ).rgb;
      vec3 Ed = lampDirect( x, n );
#else
      vec3 Ed = sunDirect( x, n );
#endif
      L += T * alb.rgb * Ed * 0.31830988618;
      T *= alb.rgb;
      o = x + n * 0.002;
      d = cosDir( n );
    }
    if ( ok ) { sum += E + 3.14159265359 * L; valid += 1.0; }
  }
  gl_FragColor = prev + vec4( sum, valid );
}`;

// ---------------------------------------------------------------- the bake
window.bakeAreaIds = () => Object.keys(bakeAreas());
window.runBake = async function runBake(opts = {}) {
  const t0 = performance.now();
  const area = opts.area || Object.keys(bakeAreas())[0];
  const A = bakeAreas()[area];
  if (!A) throw new Error('unknown area ' + area);
  const spp = opts.spp || 256, sppPass = opts.sppPerPass || 4, bounces = opts.bounces || 3;
  const hour = opts.hour ?? 11, month = opts.month ?? 7;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  const gl = renderer.getContext();
  const gpuName = (() => { const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })();
  log('GPU', gpuName);
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float missing');

  // 1. the property, as the app builds it
  DOOR_MODE.dynamic = true;
  const { M, getMaterial, ready } = makeMaterials(renderer, {});
  const physics = new Physics();
  const built = assemble({ M, getMaterial, physics });
  await ready();
  for (const g of Object.values(built.groups)) g.updateMatrixWorld(true);
  const pairs = [];
  for (const [g, grp] of Object.entries(built.groups)) for (const o of grp.children) if (o.isMesh) pairs.push([g, o]);
  const prep = prepareArea(area, pairs);
  if (!prep) throw new Error(`area ${area}: no triangles`);
  log(`area ${area}: ${prep.tris} triangles, ${prep.charts} charts (${prep.tiny} tiny), ${prep.pages} page(s), last ${prep.lastH} rows @ ${prep.density} texels/m, hash ${prep.hash}`);
  const hero = null, heroHash = null; // (scanned hero furniture: not used in this engine)
  if (opts.skipHash && opts.skipHash === prep.hash + '|' + (heroHash || '')) {
    log('stored bake still matches: skipped');
    renderer.dispose();
    return { skipped: true, hash: prep.hash };
  }
  const W = BAKE_PAGE, H = BAKE_PAGE;

  // 2. scene for the rays: everything opaque within reach of the area (walls, floors and furniture
  // of the neighbouring rooms and storeys, the site around), the moving doors / lift / cars left out
  const xs = A.rects.map(r => [r[0], r[2]]).flat(), ys = A.rects.map(r => [r[1], r[3]]).flat();
  const R = 20;
  const yLo = A.elev[0] - 1.5, yHi = A.basement ? A.elev[1] + 4.5 : 16 + Math.max(0, A.elev[1]);
  const reach = new THREE.Box3(new THREE.Vector3(Math.min(...xs) - R, yLo, -Math.max(...ys) - R), new THREE.Vector3(Math.max(...xs) + R, yHi, -Math.min(...ys) + R));
  const near = reach.clone().expandByScalar(-R + 8);
  near.min.y = yLo; near.max.y = yHi;
  const pos = [], nrm = [], alb = [], emi = [];
  const v = new THREE.Vector3(), nn = new THREE.Vector3(), nm = new THREE.Matrix3(), bb = new THREE.Box3();
  let meshes = 0;
  const addGeo = (geo, matrix, mat) => {
    const s = surfaceOf(mat);
    const p = geo.attributes.position, n = geo.attributes.normal, idx = geo.index;
    nm.getNormalMatrix(matrix);
    const cnt = idx ? idx.count : p.count;
    for (let i = 0; i < cnt; i += 3) {
      // the face normal stands in for missing / zero-length / NaN vertex normals (a ray hitting a
      // zero normal would end its path there: dark spots)
      for (let j = 0; j < 3; j++) tv[j].fromBufferAttribute(p, idx ? idx.getX(i + j) : i + j).applyMatrix4(matrix);
      fnrm.subVectors(tv[2], tv[1]).cross(e1.subVectors(tv[0], tv[1]));
      if (fnrm.lengthSq() > 1e-20) fnrm.normalize(); else fnrm.set(0, 1, 0);
      for (let j = 0; j < 3; j++) {
        const k = idx ? idx.getX(i + j) : i + j;
        pos.push(tv[j].x, tv[j].y, tv[j].z);
        if (n) nn.fromBufferAttribute(n, k).applyMatrix3(nm);
        if (!n || !(nn.lengthSq() > 1e-12)) { nn.copy(fnrm); repaired++; } else nn.normalize();
        nrm.push(nn.x, nn.y, nn.z, 0);
        alb.push(s.alb[0], s.alb[1], s.alb[2], s.two);
        emi.push(s.emi[0], s.emi[1], s.emi[2], 0);
      }
    }
    meshes++;
  };
  const tv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], fnrm = new THREE.Vector3(), e1 = new THREE.Vector3();
  let repaired = 0;
  for (const [, grp] of Object.entries(built.groups)) {
    grp.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes.position) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!mat || mat.transparent || mat.alphaTest > 0 || mat.visible === false) return;
      if (hero && o.userData.heroOf) return;
      o.updateMatrixWorld(true);
      if (o.isInstancedMesh) {
        const im = new THREE.Matrix4(), mm = new THREE.Matrix4();
        o.geometry.computeBoundingBox();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, im); mm.multiplyMatrices(o.matrixWorld, im);
          bb.copy(o.geometry.boundingBox).applyMatrix4(mm);
          if (bb.intersectsBox(reach)) addGeo(o.geometry, mm, mat);
        }
        return;
      }
      o.geometry.computeBoundingBox();
      bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      const furniture = !!o.userData.room;
      if (!bb.intersectsBox(furniture ? near : reach)) return;
      addGeo(o.geometry, o.matrixWorld, mat);
    });
  }
  const tris = pos.length / 9;
  log(`ray scene: ${meshes} meshes, ${tris} triangles${repaired ? `, ${repaired} zero / missing normals replaced by face normals` : ''}`);
  await tick();
  const sceneGeo = new THREE.BufferGeometry();
  sceneGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sceneGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 4));
  sceneGeo.setAttribute('alb', new THREE.Float32BufferAttribute(alb, 4));
  sceneGeo.setAttribute('emi', new THREE.Float32BufferAttribute(emi, 4));
  pos.length = nrm.length = alb.length = emi.length = 0;
  const tb = performance.now();
  const bvh = new MeshBVH(sceneGeo, { targetLeafSize: 6 });
  log(`BVH ${Math.round(performance.now() - tb)} ms`);
  const bvhU = new MeshBVHUniformStruct(); bvhU.updateFrom(bvh);
  const tex = (name) => { const t = new FloatVertexAttributeTexture(); t.updateFrom(sceneGeo.attributes[name]); return t; };
  const nrmTex = tex('normal'), albTex = tex('alb'), emiTex = tex('emi');

  // 3. lights: the area's lamps and those of the rooms around it (light through the doorways),
  // nearest first (garden lanterns and other outdoor lamps are off by day: real-time only)
  const MAX_LAMPS = 64;
  const distTo = (d) => Math.min(...A.rects.map(r => Math.hypot(Math.max(r[0] - d.x, 0, d.x - r[2]), Math.max(r[1] - d.y, 0, d.y - r[3]))));
  const lamps = (built.lights || []).filter(d => d.level === A.level && !d.outdoor && d.room !== 'exterior' && d.z > A.elev[0] && d.z < A.elev[1] + 0.5 && distTo(d) < 3)
    .sort((a, b) => distTo(a) - distTo(b) || a.x - b.x || a.y - b.y).slice(0, MAX_LAMPS);
  const lampPos = [], lampCol = [], lampExt = [];
  for (let i = 0; i < MAX_LAMPS; i++) {
    const d = lamps[i];
    if (!d) { lampPos.push(new THREE.Vector4()); lampCol.push(new THREE.Vector4()); lampExt.push(new THREE.Vector4()); continue; }
    const c = new THREE.Color(d.color || '#ffd8a8').multiplyScalar(d.intensity ?? 4);
    lampPos.push(new THREE.Vector4(d.x, d.z, -d.y, d.distance ?? 6));
    lampCol.push(new THREE.Vector4(c.r, c.g, c.b, d.clear || 0));
    const e = d.ext || [0, 0, 0]; // plan x, plan y, up → world x, y (up), z
    lampExt.push(new THREE.Vector4(e[0], e[2], e[1], d.down ? 1 : 0));
  }
  const nAll = (built.lights || []).filter(d => d.level === A.level && !d.outdoor && d.room !== 'exterior' && d.z > A.elev[0] && d.z < A.elev[1] + 0.5 && distTo(d) < 3).length;
  log(`lamps: ${lamps.length}${nAll > lamps.length ? ` of ${nAll} (MAX_LAMPS)` : ''} (${[...new Set(lamps.map(l => l.kind || '?'))].join(', ')})`);

  // sky: the HDRI of engine/render/pipeline.js, calibrated so an open upward surface gets the
  // irradiance of the real-time hemisphere fill at noon (OPEN_SKY); rotated so its (removed) sun
  // sits at the bake sun's azimuth
  const env = await (await fetch('/env/env.json')).json();
  const skyTex = await new THREE.TextureLoader().loadAsync('/env/' + env.file.desktop);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyScale = env.scale * OPEN_SKY / env.eUp;
  const sd = sunDirection(hour, month);
  const sunDir = new THREE.Vector3(sd.x, sd.y, sd.z).normalize();
  const day = Math.max(0, Math.min(1, (sd.y + 0.05) / 0.25));
  const sunCol = new THREE.Color().setHSL(0.09, 0.6, 0.55 + 0.35 * Math.min(1, sd.y * 3)).multiplyScalar(3.2 * day);
  const skyRot = (Math.atan2(sunDir.z, sunDir.x) - Math.atan2(env.sun[2], env.sun[0])) / (2 * Math.PI);

  // 4. lightmap-space geometry: the baked meshes + one point per small triangle (2 × 2 texels for
  // the tiny charts, whose corners all sit on one texel corner)
  const bakeScene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera();
  const traceMat = (night) => new THREE.ShaderMaterial({
    defines: { SPP: sppPass, BOUNCES: bounces, MAX_LAMPS, NIGHT: night ? 1 : 0 },
    uniforms: {
      bvh: { value: bvhU }, nrmTex: { value: nrmTex }, albTex: { value: albTex }, emiTex: { value: emiTex },
      prevTex: { value: null }, skyTex: { value: skyTex }, skyScale: { value: skyScale }, skyRot: { value: skyRot },
      sunDir: { value: sunDir }, sunE: { value: new THREE.Vector3(sunCol.r, sunCol.g, sunCol.b) },
      lampPos: { value: lampPos }, lampCol: { value: lampCol }, lampExt: { value: lampExt }, nLamps: { value: lamps.length },
      frame: { value: 0 }, minHit: { value: 0.6 / prep.density }, curLayer: { value: 0 },
    },
    vertexShader: VERT, fragmentShader: TRACE, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  });
  const gMat = new THREE.ShaderMaterial({ uniforms: { which: { value: 0 }, curLayer: { value: 0 } }, vertexShader: VERT, fragmentShader: GBUF, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const mats = { day: traceMat(false), night: traceMat(true) };
  const addBake = (obj) => { obj.frustumCulled = false; obj.matrixAutoUpdate = false; return obj; };
  const holders = [];
  // one point per texel: a tiny chart's triangles all share one cell, and every extra point would
  // trace that texel again (a screw of 200 triangles = 200× the work: the GPU watchdog fires)
  const pointAt = new Set();
  const pointsOf = (geo, matrixWorld) => {
    const p = geo.attributes.position, n = geo.attributes.normal, bu = geo.attributes.bakeUv, idx = geo.index;
    const pp = [], pn = [], pu = [], ps = [];
    const cnt = (idx ? idx.count : p.count) / 3;
    for (let t = 0; t < cnt; t++) {
      const c = [0, 1, 2].map(k => (idx ? idx.getX(t * 3 + k) : t * 3 + k));
      if (bu.getX(c[0]) < 1.5) continue;
      const ux = c.map(i => bu.getX(i) * W), uy = c.map(i => bu.getY(i) * H);
      const a2 = Math.abs((ux[1] - ux[0]) * (uy[2] - uy[0]) - (ux[2] - ux[0]) * (uy[1] - uy[0]));
      if (a2 > 6) continue;
      const tiny = ux[0] === ux[1] && ux[1] === ux[2] && uy[0] === uy[1] && uy[1] === uy[2];
      const key = Math.round((ux[0] + ux[1] + ux[2]) / 3 * 2) + ',' + Math.round((uy[0] + uy[1] + uy[2]) / 3 * 2);
      if (pointAt.has(key)) continue;
      pointAt.add(key);
      const cen = (attr, k) => (attr.getComponent(c[0], k) + attr.getComponent(c[1], k) + attr.getComponent(c[2], k)) / 3;
      pp.push(cen(p, 0), cen(p, 1), cen(p, 2));
      pn.push(cen(n, 0), cen(n, 1), cen(n, 2));
      pu.push(cen(bu, 0), cen(bu, 1));
      ps.push(tiny ? 2 : 1);
    }
    if (!pp.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pn, 3));
    g.setAttribute('bakeUv', new THREE.Float32BufferAttribute(pu, 2));
    g.setAttribute('psize', new THREE.Float32BufferAttribute(ps, 1));
    const pts = addBake(new THREE.Points(g, mats.day));
    pts.matrix.copy(matrixWorld); pts.matrixWorld.copy(matrixWorld);
    holders.push(pts);
  };
  // zero-length / NaN normals of the baked triangles (the texels would trace nothing: black, then
  // refilled from neighbours or left dark) → the face normal (bake page only: the app's normals stay)
  let fixedN = 0;
  for (const s of prep.sel) fixedN += repairNormals(s.mesh.geometry, s.tris);
  if (fixedN) log(`baked meshes: ${fixedN} zero-length normals replaced by face normals`);
  for (const s of prep.sel) {
    const m = s.mesh;
    const h = addBake(new THREE.Mesh(m.geometry, mats.day));
    h.matrix.copy(m.matrixWorld); h.matrixWorld.copy(m.matrixWorld);
    holders.push(h);
    pointsOf(m.geometry, m.matrixWorld);
  }
  if (hero && heroHash) { const h = addBake(new THREE.Mesh(hero.geometry, mats.day)); h.matrix.copy(hero.matrixWorld); h.matrixWorld.copy(hero.matrixWorld); holders.push(h); }
  for (const h of holders) bakeScene.add(h);
  log(`bake geometry: ${holders.length} draws`);

  const rtOpts = { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false };
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  const setMat = (m) => { for (const h of holders) h.material = m; };
  const result = { files: {}, timings: { day: 0, night: 0 } };
  const gRT = new THREE.WebGLRenderTarget(W, H, rtOpts);
  const rts = [new THREE.WebGLRenderTarget(W, H, rtOpts), new THREE.WebGLRenderTarget(W, H, rtOpts)];
  const short = prep.hash.slice(0, 8);
  const files = { desktop: { day: [], night: [] }, mobile: { day: [], night: [] } };
  let invalid = 0, covered = 0, clipped = { day: 0, night: 0 }, p995 = { day: 0, night: 0 };
  for (let page = 0; page < prep.pages; page++) {
    const rows = page === prep.pages - 1 ? prep.lastH : H; // rows in use (from the top, v = 0)
    const readRT = (rt) => { const a = new Float32Array(W * rows * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, rows, a); return a; };
    for (const m of [gMat, mats.day, mats.night]) m.uniforms.curLayer.value = page;
    // G-buffer (world position, normal) for the filter
    setMat(gMat);
    const gbuf = [];
    for (const which of [0, 1]) {
      gMat.uniforms.which.value = which;
      renderer.setRenderTarget(gRT); renderer.clear(); renderer.render(bakeScene, camera);
      gbuf.push(readRT(gRT));
    }
    let cov = 0;
    for (let i = 0; i < W * rows; i++) if (gbuf[0][i * 4 + 3] > 0) cov++;
    if (opts.debugOverdraw) {
      // how many fragments land on each texel (each one traces): find the worst spots and their meshes
      const od = new THREE.ShaderMaterial({ uniforms: { curLayer: { value: page } }, vertexShader: VERT, fragmentShader: 'void main() { gl_FragColor = vec4( 1.0 ); }',
        depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, transparent: true });
      setMat(od);
      renderer.setRenderTarget(gRT); renderer.clear(); renderer.render(bakeScene, camera);
      const a = readRT(gRT);
      let best = [];
      for (let i = 0; i < W * rows; i++) if (a[i * 4] > 8) best.push([a[i * 4], i % W, Math.floor(i / W)]);
      best.sort((x, y) => y[0] - x[0]);
      log('overdraw > 8 at', best.length, 'texels; worst', JSON.stringify(best.slice(0, 8)));
      for (const [, px, py] of best.slice(0, 3)) {
        holders.forEach((h, hi) => {
          const g = h.geometry, bu = g.attributes.bakeUv, idx = g.index; if (!bu) return;
          const cnt = (idx ? idx.count : bu.count) / 3; let n = 0;
          for (let t = 0; t < cnt; t++) {
            const c = [0, 1, 2].map(k => idx ? idx.getX(t * 3 + k) : t * 3 + k);
            const us = c.map(i => (bu.getX(i) - 2 - 2 * page) * W), vs = c.map(i => { const y = bu.getY(i) - 2; return (y - 2 * Math.floor(y / 2)) * H; });
            if (Math.min(...us) <= px + 1 && Math.max(...us) >= px && Math.min(...vs) <= py + 1 && Math.max(...vs) >= py) n++;
          }
          if (n > 2) log(`  texel ${px},${py}: holder ${hi} (${h.isPoints ? 'points' : 'mesh'}) ${n} tris, src ${prep.sel[hi]?.mesh.material.name || ''} ${prep.sel[hi]?.mesh.userData.room || ''}`);
        });
      }
    }
    covered += cov;
    log(`page ${page + 1}/${prep.pages}: ${rows} rows, covered texels ${cov} (${(100 * cov / (W * rows)).toFixed(1)} %)`);
    for (const mode of ['day', 'night']) {
      const tm = performance.now();
      const mat = mats[mode];
      setMat(mat);
      for (const rt of rts) { renderer.setRenderTarget(rt); renderer.clear(); }
      const passes = Math.ceil(spp / sppPass);
      // bands adapt so that no single GPU job runs much over ~0.3 s (enclosed rooms trace far
      // slower than open ones: every path bounces to the end)
      let bands = Math.max(1, Math.ceil((opts.bands || (mode === 'night' ? 24 : 12)) * rows / H));
      const syncPx = new Float32Array(4);
      let cur = 0;
      for (let i = 0; i < passes; i++) {
        mat.uniforms.prevTex.value = rts[cur].texture;
        mat.uniforms.frame.value = i + (mode === 'night' ? 100003 : 0) + page * 7919;
        // in horizontal bands, each waited for: a long GPU job would trip the driver's watchdog
        // (context lost)
        const dst = rts[1 - cur], bh = Math.ceil(rows / bands);
        let worst = 0;
        for (let y = 0; y < rows; y += bh) {
          const tb0 = performance.now();
          dst.scissor.set(0, y, W, Math.min(bh, rows - y)); dst.scissorTest = true;
          renderer.setRenderTarget(dst);
          renderer.render(bakeScene, camera);
          renderer.readRenderTargetPixels(dst, 0, y, 1, 1, syncPx);
          worst = Math.max(worst, performance.now() - tb0);
        }
        if (worst > 300 && bands < rows / 2) { bands = Math.min(Math.ceil(rows / 2), bands * 2); log(`${mode}: band took ${Math.round(worst)} ms, now ${bands} bands`); }
        dst.scissorTest = false;
        cur = 1 - cur;
        if (gl.isContextLost()) throw new Error('WebGL context lost (GPU watchdog): use more --bands');
        if (i % 4 === 3) await tick();
        if ((i + 1) % Math.max(1, Math.floor(passes / 4)) === 0) log(`${mode} p${page}: pass ${i + 1}/${passes}, ${Math.round((performance.now() - tm) / 1000)} s`);
      }
      const acc = readRT(rts[cur]);
      result.timings[mode] += Math.round(performance.now() - tm);
      const img = postProcess(acc, gbuf, W, rows, passes * sppPass);
      invalid += img.invalid;
      const scale = BAKE_SCALE[mode];
      const full = `${mode}-${page}-${short}.webp`, half = `${mode}-${page}-${short}-1k.webp`;
      const enc = await encode(img.rgb, W, rows, scale);
      clipped[mode] += enc.clipped;
      p995[mode] = Math.max(p995[mode], img.p995);
      result.files[full] = enc.b64;
      result.files[half] = (await encode(downsample(img.rgb, W, rows), W / 2, rows / 2, scale)).b64;
      files.desktop[mode].push(full); files.mobile[mode].push(half);
      log(`${mode} p${page}: ${Math.round((performance.now() - tm) / 1000)} s, invalid ${img.invalid}, clipped ${enc.clipped}, p99.5 ${img.p995.toFixed(3)} (scale ${scale})`);
    }
  }
  for (const r of [gRT, ...rts]) r.dispose();
  const manifest = {
    version: BAKE_VERSION, area, level: A.level, hash: prep.hash, heroHash, page: BAKE_PAGE, pages: prep.pages, lastH: prep.lastH,
    density: prep.density, tris: prep.tris, charts: prep.charts, tiny: prep.tiny, surface: prep.surface, rayTris: tris, lamps: lamps.length,
    covered, invalid, clipped, p995,
    spp, bounces, sun: { hour, month, dir: [sunDir.x, sunDir.y, sunDir.z].map(x => +x.toFixed(4)) },
    hdri: env.name, openSky: OPEN_SKY, scale: BAKE_SCALE, bounce: { sat: BOUNCE_SAT, gain: BOUNCE_GAIN },
    files,
    bakeSeconds: Math.round((performance.now() - t0) / 1000), timings: result.timings, gpu: gpuName,
  };
  sceneGeo.dispose(); nrmTex.dispose(); albTex.dispose(); emiTex.dispose(); bvhU.dispose?.();
  renderer.dispose();
  log('done in', manifest.bakeSeconds, 's');
  return { manifest, files: result.files };
};

// vertices of the given triangles whose normal is zero / NaN get their triangle's face normal
function repairNormals(geo, tris) {
  const p = geo.attributes.position, n = geo.attributes.normal, idx = geo.index;
  if (!n) return 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), f = new THREE.Vector3(), w = new THREE.Vector3();
  let fixed = 0;
  for (const t of tris) {
    const vi = [0, 1, 2].map(k => (idx ? idx.getX(t * 3 + k) : t * 3 + k));
    let bad = false;
    for (const i of vi) { w.fromBufferAttribute(n, i); if (!(w.lengthSq() > 1e-12)) bad = true; }
    if (!bad) continue;
    a.fromBufferAttribute(p, vi[0]); b.fromBufferAttribute(p, vi[1]); c.fromBufferAttribute(p, vi[2]);
    f.subVectors(c, b).cross(w.subVectors(a, b));
    if (!(f.lengthSq() > 1e-20)) continue;
    f.normalize();
    for (const i of vi) { w.fromBufferAttribute(n, i); if (!(w.lengthSq() > 1e-12)) { n.setXYZ(i, f.x, f.y, f.z); fixed++; } }
  }
  if (fixed) n.needsUpdate = true;
  return fixed;
}

// ---------------------------------------------------------------- post: validity, dilation, filter
function postProcess(acc, gbuf, W, H, samples) {
  const N = W * H;
  const rgb = new Float32Array(N * 3);
  const ok = new Uint8Array(N);
  let invalid = 0;
  // a texel whose paths mostly started inside geometry (under furniture, against a wall) keeps
  // its own estimate, darkened by the share of valid paths (no light leaks); none at all: refilled
  for (let i = 0; i < N; i++) {
    const n = acc[i * 4 + 3];
    if (gbuf[0][i * 4 + 3] <= 0) continue;
    if (n < 1) { invalid++; continue; }
    const k = Math.min(1, n / (samples * 0.25)) / n;
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = acc[i * 4 + c] * k;
    ok[i] = 1;
  }
  // edge-aware filter (à-trous, 3 rounds) over valid texels: same plane (position / normal)
  const P = gbuf[0], Nn = gbuf[1];
  let src = rgb;
  for (const step of [1, 2, 4]) {
    const dst = new Float32Array(N * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!ok[i]) continue;
      let wsum = 0, r = 0, g = 0, b = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx * step, yy = y + dy * step;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (!ok[j]) continue;
        const k = [1, 4, 6, 4, 1][dx + 2] * [1, 4, 6, 4, 1][dy + 2];
        const px = P[i * 4] - P[j * 4], py = P[i * 4 + 1] - P[j * 4 + 1], pz = P[i * 4 + 2] - P[j * 4 + 2];
        const dp = px * px + py * py + pz * pz;
        const dn = Nn[i * 4] * Nn[j * 4] + Nn[i * 4 + 1] * Nn[j * 4 + 1] + Nn[i * 4 + 2] * Nn[j * 4 + 2];
        if (dn < 0.8) continue;
        const w = k * Math.exp(-dp / (0.0025 * step * step)) * Math.pow(dn, 16);
        wsum += w; r += w * src[j * 3]; g += w * src[j * 3 + 1]; b += w * src[j * 3 + 2];
      }
      dst[i * 3] = r / wsum; dst[i * 3 + 1] = g / wsum; dst[i * 3 + 2] = b / wsum;
    }
    src = dst;
  }
  // dilation: invalid / empty texels take the mean of valid neighbours (8 rounds)
  const out = src;
  let have = ok;
  for (let round = 0; round < 8; round++) {
    const next = have.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (have[i]) continue;
      let n = 0, r = 0, g = 0, b = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (!have[j]) continue;
        n++; r += out[j * 3]; g += out[j * 3 + 1]; b += out[j * 3 + 2];
      }
      if (n) { out[i * 3] = r / n; out[i * 3 + 1] = g / n; out[i * 3 + 2] = b / n; next[i] = 1; }
    }
    have = next;
  }
  // 99.5th percentile of the brightest channel over valid texels (reported: the encoding scale is fixed)
  const peaks = [];
  for (let i = 0; i < N; i += 3) if (ok[i]) peaks.push(Math.max(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]));
  peaks.sort((a, b) => a - b);
  const p995 = peaks[Math.floor(peaks.length * 0.995)] || 0;
  return { rgb: out, p995, invalid };
}
function downsample(rgb, W, H) {
  const w = W / 2, h = H / 2, out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    const i = (2 * y * W + 2 * x) * 3 + c;
    out[(y * w + x) * 3 + c] = (rgb[i] + rgb[i + 3] + rgb[i + W * 3] + rgb[i + W * 3 + 3]) / 4;
  }
  return out;
}
const toSRGB = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
async function encode(rgb, W, H, scale) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d');
  const im = cx.createImageData(W, H);
  let clipped = 0;
  for (let i = 0; i < W * H; i++) {
    for (let c = 0; c < 3; c++) {
      const x = Math.max(0, rgb[i * 3 + c] / scale);
      if (x > 1 && c === 1) clipped++;
      im.data[i * 4 + c] = Math.round(255 * Math.min(1, toSRGB(x)));
    }
    im.data[i * 4 + 3] = 255;
  }
  cx.putImageData(im, 0, 0); // row 0 = v 0 (textures load with flipY = false)
  const blob = await new Promise((r) => cv.toBlob(r, 'image/webp', 0.9));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { b64: btoa(s), clipped };
}

window.bakeReady = true;
log('bake page ready');
