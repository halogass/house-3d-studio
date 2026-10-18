// Baked interior lighting (optional feature 'bake'): photoreal light for the interior, made offline
// on a GPU by `npm run bake` and stored in projects/<name>/bake/ (served at /bake/).
//
// Two lightmaps per area, made offline by `npm run bake` (scripts/bake.mjs drives
// studio/bake.html in Chromium on the real GPU) and stored in projects/<name>/bake/<area>/, listed in
// bake/index.json:
//   day   = sky (HDRI dome) light + the bounce of a representative sun, multi-bounce, AO included
//           (the direct sun stays real-time, with its shadows)
//   night = every lamp of the area and its neighbours (direct with soft shadows + bounce) and the
//           emissive surfaces (cove lights, shades)
// At runtime they cross-fade with the time slider and replace, on the baked surfaces only, what the
// real-time path fakes: the hemisphere fill, the diffuse part of the point lights (their highlights
// stay), the ceilings' emissive "bounce" and the sky's diffuse IBL; sky reflections are occluded by
// the baked sky visibility. Inside a baked area the GTAO pass is off (the bake has the occlusion).
//
// Areas: by default one per level (bakeAreas below, rooms from the plan data), each with
// its own pages (2048² desktop, 1024² phones) of one shared texture array per map; an area's last,
// partly filled page shares a layer with other areas' last pages. So every baked surface of the
// house uses the same two samplers: no material copies, no shader variants.
//
// The second UV set (`bakeUv`) is computed the same way by the app and by the bake page: a
// deterministic, order-independent chart unwrap (engine/render/bake-unwrap.js) of the area's static
// triangles (shell, finishes, furniture; not decor, glass or the moving doors, cars and lift car).
// Its hash over the quantised triangles keys the bake: when the geometry changes the stored bake is
// ignored (the real-time look stays) until it is baked again. In the app the unwrap runs in a Web
// Worker (engine/render/bake-worker.js), level by level, and the UVs are written into the meshes only
// once the area's maps are on the GPU, a few meshes per frame.
// bakeUv = (2 + 2 × layer + u, 2 + 2 × (class + 4 × gain slot) + v): x < 1.5 (0, what a mesh without the attribute reads) means
// "not baked". Every opaque PBR material carries the same small shader patch with a branch that
// unbaked fragments skip.
//
// Node-safe: no DOM at import; the runtime (createBakeRuntime) is browser-only.
import * as THREE from 'three';
import { unwrapTriangles } from './bake-unwrap.js';

export const BAKE_VERSION = 3;
export const BAKE_PAGE = 2048;          // desktop page (texture array layer); phones get half
export const BAKE_DENSITY = 24;         // texels per metre wanted (shrinks if an area needs > maxPages)
const MAX_LAYERS = 24;
// Fixed encoding scales (linear irradiance stored as sRGB(value / scale)): the same for every area,
// so the last pages of several areas can share a layer. Day: open sky = 0.93; night: lamp units.
export const BAKE_SCALE = { day: 1.0, night: 24 };
export const OPEN_SKY = 0.93;

// ---------------------------------------------------------------- areas
// An area = some rooms of one level baked together (their rects, inset 1 cm, select the triangles by
// centroid; elev: world y range of the centroids). project.json "bake": { "areas": [{ id, level,
// rooms: [...], enclosed?, gain?: { day, night }, density? }] } lists them; without that list every
// level is one area (fine for a normal house: ±100–150 m² per level).
// gain: { day, night } multipliers of this area's maps on top of BAKE_GAIN (runtime only: retune
//   without a re-bake). enclosed: (almost) windowless: its lamps stay on by day (class 2).
// Basement areas are class 1: lamps always on.
export const MAX_GAIN_SLOTS = 16;
let areasCache = null;
function areaList(Z, P) {
  const listed = P?.bake?.areas;
  if (Array.isArray(listed) && listed.length) return listed;
  return Z.levels.map(l => ({ id: l.id.toLowerCase(), level: l.id, rooms: (Z.floors[l.id] || []).map(r => r.id) }));
}
// id → { id, level, groups, elev, rects, density, maxPages, basement, enclosed, gain, slot }
export function bakeAreas() {
  if (areasCache) return areasCache;
  const Z = globalThis.ZONING, P = globalThis.PROJECT;
  if (!Z) return {};
  const out = {};
  const list = areaList(Z, P);
  for (const [i, a] of list.entries()) {
    const L = Z.levels.find(l => l.id === a.level);
    if (!L) continue;
    const rects = (a.rooms || []).map(id => (Z.floors[a.level] || []).find(r => r.id === id)?.r).filter(Boolean).map(r => [r[0] + 0.01, r[1] + 0.01, r[2] - 0.01, r[3] - 0.01]);
    if (!rects.length) continue;
    out[a.id] = {
      id: a.id, level: a.level, groups: [a.level, 'ceil_' + a.level], elev: [L.elev - 0.1, L.elev + L.h + 0.02], rects,
      density: a.density || BAKE_DENSITY, maxPages: a.maxPages || 6, hero: null, basement: L.elev < -0.6,
      enclosed: !!a.enclosed, gain: { day: a.gain?.day ?? 1, night: a.gain?.night ?? 1 },
      slot: Math.min(MAX_GAIN_SLOTS - 1, i + 1), // its row of bakeGain (0: neutral)
    };
  }
  return (areasCache = out);
}
// legacy name (bake page, tests)
export const BAKE_AREAS = new Proxy({}, {
  get: (_, k) => bakeAreas()[k], ownKeys: () => Object.keys(bakeAreas()),
  getOwnPropertyDescriptor: (_, k) => (k in bakeAreas() ? { enumerable: true, configurable: true, value: bakeAreas()[k] } : undefined),
  has: (_, k) => k in bakeAreas(),
});
export const areasOfLevel = (lv) => Object.values(bakeAreas()).filter(a => a.level === lv);

// ---------------------------------------------------------------- shared uniforms + shader patch
const blackArray = new THREE.DataArrayTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, 1);
blackArray.needsUpdate = true;
export const BAKE_U = {
  bakeDay: { value: blackArray },
  bakeNight: { value: blackArray },
  bakeK: { value: new THREE.Vector4() },           // day weight, lamp weight (daylit areas), lamp weight (basements), spec occlusion gain
  bakeK2: { value: new THREE.Vector4() },          // lamp weight in enclosed areas (little daylight: lamps stay on by day)
  bakeKeep: { value: 1 },                          // share of the real-time hemisphere fill + sky diffuse IBL kept (1 - day)
  bakeTint: { value: new THREE.Vector3(1, 1, 1) }, // white balance of the day map
  bakeOn: { value: 0 },
  bakePointOff: { value: 0 },
  bakeGain: { value: Array.from({ length: MAX_GAIN_SLOTS }, () => new THREE.Vector2(1, 1)) }, // per area (slot): day, night
};

const LUM = 'vec3( 0.2126, 0.7152, 0.0722 )';
function patchVertex(src) {
  return src
    .replace('#include <common>', '#include <common>\nattribute vec2 bakeUv;\nvarying vec4 vBake;')
    .replace('#include <uv_vertex>', '#include <uv_vertex>\n\t{ float dhL = max( 0.0, floor( ( bakeUv.x - 2.0 ) * 0.5 ) );\n\tvBake = vec4( bakeUv.x - 2.0 - 2.0 * dhL, bakeUv.y - 2.0, dhL, step( 1.5, bakeUv.x ) ); }');
}
function patchFragment(src) {
  const begin = THREE.ShaderChunk.lights_fragment_begin
    .replace('#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )', 'vec3 dhDiffuse0 = reflectedLight.directDiffuse;\n#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )')
    .replace('#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )', 'reflectedLight.directDiffuse = mix( reflectedLight.directDiffuse, dhDiffuse0, dhBake * bakePointOff );\n#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )');
  const maps = `#include <lights_fragment_maps>
#if defined( RE_IndirectDiffuse )
	if ( dhBake > 0.5 ) {
		float dhBand = floor( vBake.y * 0.5 );
		float dhSlot = floor( dhBand * 0.25 + 0.01 );
		float dhCls = dhBand - 4.0 * dhSlot;
		vec2 dhG = bakeGain[ int( dhSlot ) ];
		vec3 dhUv = vec3( vBake.x, vBake.y - 2.0 * dhBand, vBake.z );
		vec3 dhD = texture( bakeDay, dhUv ).rgb;
		vec3 dhN = texture( bakeNight, dhUv ).rgb;
		irradiance = irradiance * bakeKeep + dhD * bakeTint * ( bakeK.x * dhG.x ) + dhN * ( ( dhCls > 1.5 ? bakeK2.x : dhCls > 0.5 ? bakeK.z : bakeK.y ) * dhG.y );
		iblIrradiance *= bakeKeep;
		#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
			float dhOcc = clamp( dot( dhD, ${LUM} ) * bakeK.w, 0.0, 1.0 );
			radiance *= dhOcc;
			#ifdef USE_CLEARCOAT
				clearcoatRadiance *= dhOcc;
			#endif
		#endif
	}
#endif`;
  return src
    .replace('#include <common>', `#include <common>\nuniform highp sampler2DArray bakeDay;\nuniform highp sampler2DArray bakeNight;\nuniform vec4 bakeK;\nuniform vec4 bakeK2;\nuniform float bakeKeep;\nuniform vec3 bakeTint;\nuniform float bakeOn;\nuniform float bakePointOff;\nuniform vec2 bakeGain[ ${MAX_GAIN_SLOTS} ];\nvarying vec4 vBake;`)
    .replace('void main() {', 'void main() {\n\tfloat dhBake = vBake.w * bakeOn;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef DH_FAKE_GLOW\n\ttotalEmissiveRadiance *= 1.0 - dhBake;\n#endif')
    .replace('#include <lights_fragment_begin>', begin)
    .replace('#include <lights_fragment_maps>', maps);
}
function bakeCompile(shader) {
  Object.assign(shader.uniforms, BAKE_U);
  shader.vertexShader = patchVertex(shader.vertexShader);
  shader.fragmentShader = patchFragment(shader.fragmentShader);
}
// Every opaque PBR material gets the patch when it is made (engine/materials.js). fakeGlow: the
// emissive "bounce" of ceilings, replaced by the bake where there is one.
export function installBakePatch(mat, { fakeGlow = false } = {}) {
  if (!mat || !(mat.isMeshStandardMaterial) || mat.transparent) return mat;
  if (mat.onBeforeCompile === bakeCompile) return mat;
  mat.onBeforeCompile = bakeCompile;
  if (fakeGlow) mat.defines = { ...(mat.defines || {}), DH_FAKE_GLOW: 1 };
  mat.userData.bakePatch = true;
  return mat;
}
export const bakeable = (mat) => !!mat && mat.isMeshStandardMaterial && !mat.transparent && mat.userData.bakePatch === true && !mat.userData.noShadow;

// ---------------------------------------------------------------- triangle selection
const inRects = (rects, x, y) => rects.some(r => x > r[0] && x < r[2] && y > r[1] && y < r[3]);
const bakeGroups = () => new Set(Object.values(bakeAreas()).flatMap(a => a.groups));
// Which meshes may hold baked triangles (main.js keeps their CPU copies until the level is done)
export function mayBake(mesh, groupName) {
  if (!bakeGroups().has(groupName)) return false;
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.userData.decor || mesh.userData.heroOf || mesh.userData.hero || mesh.userData.overview) return false;
  return bakeable(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material);
}
const IDENT = new THREE.Matrix4();
// pairs: [[groupName, mesh]] → { sel: [{ mesh, tris: Uint32Array }], P: Float64Array(N × 9) world positions }
// (a generator: yields every ~30k triangles so the app can spread the work over frames)
export function* gatherAreaSteps(id, pairs) {
  const A = bakeAreas()[id];
  const sel = [];
  const v = new THREE.Vector3();
  let N = 0, budget = 0;
  const xs = A.rects.flatMap(r => [r[0], r[2]]), ys = A.rects.flatMap(r => [r[1], r[3]]);
  const bx0 = Math.min(...xs), bx1 = Math.max(...xs), by0 = Math.min(...ys), by1 = Math.max(...ys);
  for (const [g, mesh] of pairs) {
    if (!A.groups.includes(g) || !mayBake(mesh, g) || mesh.geometry.groups?.length > 1) continue;
    const geo = mesh.geometry, pos = geo.attributes.position, idx = geo.index;
    if (!pos || !pos.array || (idx && !idx.array)) continue;
    mesh.updateMatrixWorld?.();
    const ident = mesh.matrixWorld.equals(IDENT);
    // quick reject on the mesh's bounds
    if (ident) {
      if (!geo.boundingBox) geo.computeBoundingBox();
      const b = geo.boundingBox;
      if (b.max.x < bx0 || b.min.x > bx1 || -b.min.z < by0 || -b.max.z > by1 || b.max.y < A.elev[0] || b.min.y > A.elev[1]) continue;
    }
    const n = (idx ? idx.count : pos.count) / 3;
    const list = [];
    const pa = pos.array, ia = idx ? idx.array : null;
    for (let t = 0; t < n; t++) {
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < 3; k++) {
        const i = ia ? ia[t * 3 + k] : t * 3 + k;
        if (ident) { x += pa[i * 3]; y += pa[i * 3 + 1]; z += pa[i * 3 + 2]; }
        else { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); x += v.x; y += v.y; z += v.z; }
      }
      x /= 3; y /= 3; z /= 3;
      if (y >= A.elev[0] && y <= A.elev[1] && inRects(A.rects, x, -z)) list.push(t);
    }
    if (list.length) { sel.push({ mesh, tris: Uint32Array.from(list) }); N += list.length; }
    budget += n;
    if (budget > 30000) { budget = 0; yield; }
  }
  const P = new Float64Array(N * 9);
  let o = 0;
  for (const s of sel) {
    const geo = s.mesh.geometry, pos = geo.attributes.position, ia = geo.index ? geo.index.array : null;
    const ident = s.mesh.matrixWorld.equals(IDENT);
    for (const lt of s.tris) for (let k = 0; k < 3; k++) {
      const i = ia ? ia[lt * 3 + k] : lt * 3 + k;
      v.fromBufferAttribute(pos, i);
      if (!ident) v.applyMatrix4(s.mesh.matrixWorld);
      P[o++] = v.x; P[o++] = v.y; P[o++] = v.z;
    }
  }
  return { id, sel, P };
}
export function gatherArea(id, pairs) {
  const it = gatherAreaSteps(id, pairs);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}
export const unwrapOptions = (id) => {
  const A = bakeAreas()[id];
  return { page: BAKE_PAGE, density: A.density, pad: 1, maxPages: A.maxPages, reserve: A.hero, version: BAKE_VERSION };
};
// the area's last page is cropped to the rows in use (multiple of 16)
export function lastPageHeight(un) {
  let h = 0;
  for (let t = 0; t < un.tris; t++) {
    if (un.page[t] !== un.pages - 1) continue;
    for (let k = 1; k < 6; k += 2) { const v = un.uv[t * 6 + k]; if (v > h) h = v; }
  }
  const A = un.reserve;
  let px = Math.ceil(h * BAKE_PAGE) + 4;
  if (A && un.pages === 1) px = Math.max(px, A[1]);
  return Math.min(BAKE_PAGE, 16 * Math.ceil(px / 16));
}

// ---------------------------------------------------------------- page → texture-array layer
// areas: [{ id, pages, lastH }] (public/bake/index.json order) → { layers, map: id → [[layer, yOffset (0..1)], ...] }
// Full pages get a layer each; the last, partly filled pages are stacked into shared layers.
export function layoutLayers(areas) {
  let L = 0;
  const map = {}, partial = [];
  for (const a of areas) {
    map[a.id] = [];
    for (let p = 0; p < a.pages; p++) {
      const h = p === a.pages - 1 ? a.lastH : BAKE_PAGE;
      if (h >= BAKE_PAGE) map[a.id][p] = [L++, 0];
      else partial.push({ id: a.id, p, h });
    }
  }
  partial.sort((x, y) => y.h - x.h || (x.id < y.id ? -1 : 1));
  const bins = [];
  for (const q of partial) {
    let b = bins.find(b => b.used + q.h <= BAKE_PAGE);
    if (!b) { b = { layer: L++, used: 0 }; bins.push(b); }
    map[q.id][q.p] = [b.layer, b.used / BAKE_PAGE];
    b.used += q.h;
  }
  return { layers: L, map };
}

// ---------------------------------------------------------------- write bakeUv into the meshes
// entries: [{ sel, uv, page, map: [[layer, yOff], ...], cls }] (cls 0 daylit, 1 basement, 2 enclosed;
// several areas may share a mesh: written
// together). Indexed geometry: vertices on a chart border (or shared with unbaked triangles) are
// split; a mesh whose vertex count changes gets a new geometry (the old one is disposed).
// Returns the meshes written.
export function* applyBakeUvSteps(entries) {
  const per = new Map();
  for (const e of entries) {
    let off = 0;
    // v + 2 + 2 × (class + 4 × gain slot): class 0 daylit, 1 basement (lamps always on), 2 enclosed
    // (lamps on by day too); slot: the area's row of bakeGain
    const vb = 2 + 2 * ((e.cls ?? (e.basement ? 1 : 0)) + 4 * (e.slot || 0));
    for (const s of e.sel) {
      const geo = s.mesh.geometry, corners = geo.index ? geo.index.count : geo.attributes.position.count;
      let w = per.get(s.mesh);
      if (!w) {
        per.set(s.mesh, w = new Float32Array(corners * 2));
        const old = geo.attributes.bakeUv; // written before (another area): kept
        if (old) for (let c = 0; c < corners; c++) { const i = geo.index ? geo.index.array[c] : c; w[c * 2] = old.array[i * 2]; w[c * 2 + 1] = old.array[i * 2 + 1]; }
      }
      for (let j = 0; j < s.tris.length; j++) {
        const t = s.tris[j], tg = off + j, [L, yo] = e.map[e.page[tg]];
        for (let k = 0; k < 3; k++) {
          w[(t * 3 + k) * 2] = 2 + 2 * L + e.uv[tg * 6 + k * 2];
          w[(t * 3 + k) * 2 + 1] = vb + yo + e.uv[tg * 6 + k * 2 + 1];
        }
      }
      off += s.tris.length;
    }
  }
  const done = [];
  for (const [mesh, want] of per) {
    writeBakeUv(mesh, want);
    done.push(mesh);
    yield mesh;
  }
  return done;
}
export function applyBakeUv(entries) {
  const it = applyBakeUvSteps(entries);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}
function writeBakeUv(mesh, want) {
  const geo = mesh.geometry, idx = geo.index, nvert = geo.attributes.position.count;
  if (!idx) { geo.setAttribute('bakeUv', new THREE.BufferAttribute(want, 2)); return; }
  const ia = idx.array, corners = ia.length;
  const fu = new Float32Array(nvert), fv = new Float32Array(nvert), seen = new Uint8Array(nvert);
  const newIndex = new Uint32Array(corners);
  let head = null;
  const dU = [], dV = [], dI = [], dN = [], extra = [];
  for (let c = 0; c < corners; c++) {
    const v = ia[c], u = want[c * 2], w = want[c * 2 + 1];
    if (!seen[v]) { seen[v] = 1; fu[v] = u; fv[v] = w; newIndex[c] = v; continue; }
    if (fu[v] === u && fv[v] === w) { newIndex[c] = v; continue; }
    head ??= new Int32Array(nvert).fill(-1);
    let p = head[v];
    while (p >= 0 && !(dU[p] === u && dV[p] === w)) p = dN[p];
    if (p < 0) { p = dU.length; dU.push(u); dV.push(w); dI.push(nvert + extra.length); dN.push(head[v]); head[v] = p; extra.push(v); }
    newIndex[c] = dI[p];
  }
  const total = nvert + extra.length;
  const b = new Float32Array(total * 2);
  for (let v = 0; v < nvert; v++) { b[v * 2] = fu[v]; b[v * 2 + 1] = fv[v]; }
  for (let j = 0; j < extra.length; j++) { b[(nvert + j) * 2] = dU[j]; b[(nvert + j) * 2 + 1] = dV[j]; }
  if (!extra.length) { geo.setAttribute('bakeUv', new THREE.BufferAttribute(b, 2)); return; }
  const g = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) {
    const s2 = attr.itemSize, src = attr.array;
    const arr = new src.constructor(total * s2);
    arr.set(src.subarray(0, nvert * s2));
    for (let j = 0; j < extra.length; j++) { const v = extra[j]; for (let k = 0; k < s2; k++) arr[(nvert + j) * s2 + k] = src[v * s2 + k]; }
    g.setAttribute(name, new THREE.BufferAttribute(arr, s2, attr.normalized));
  }
  g.setAttribute('bakeUv', new THREE.BufferAttribute(b, 2));
  g.setIndex(new THREE.BufferAttribute(total > 65535 ? newIndex : Uint16Array.from(newIndex), 1));
  g.boundingBox = geo.boundingBox; g.boundingSphere = geo.boundingSphere;
  if (!g.boundingSphere) g.computeBoundingSphere();
  g.userData = geo.userData;
  g.drawRange.count = geo.drawRange.count;
  mesh.geometry = g;
  geo.dispose();
}

// Selection + unwrap + bakeUv for one area, synchronously (bake page, Node tests). The area's pages
// map to layers 0.. (no sharing).
export function prepareArea(id, pairs) {
  if (!bakeAreas()[id]) return null;
  const g = gatherArea(id, pairs);
  if (!g.sel.length) return null;
  const un = unwrapTriangles(g.P, unwrapOptions(id));
  un.reserve = bakeAreas()[id].hero;
  const map = Array.from({ length: un.pages }, (_, p) => [p, 0]);
  applyBakeUv([{ sel: g.sel, uv: un.uv, page: un.page, map, basement: bakeAreas()[id].basement }]);
  return { ...un, area: id, sel: g.sel, lastH: lastPageHeight(un), map };
}

// The scanned hero furniture (engine/render/hero.js) keeps its own UVs: its 2 × 2 texture atlas is laid
// out as four tiles side by side in the strip reserved at the top of the area's first page.
// map0: [layer, yOff] of that page. Keyed by a hash of its geometry.
export function heroBakeUv(id, map0, mesh) {
  const A = bakeAreas()[id];
  if (!A?.hero || !map0) return null;
  const [hw, hh] = A.hero, tw = hw / 4, [L, yo] = map0;
  const geo = mesh.geometry, uv = geo.attributes.uv, pos = geo.attributes.position;
  const out = new Float32Array(uv.count * 2);
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    const c = Math.min(1, Math.max(0, Math.floor(u * 2))), r = Math.min(1, Math.max(0, Math.floor(v * 2)));
    out[i * 2] = 2 + 2 * L + ((c + 2 * r) * tw + (u * 2 - c) * tw) / BAKE_PAGE;
    out[i * 2 + 1] = 2 + yo + ((v * 2 - r) * hh) / BAKE_PAGE;
  }
  let h1 = 0x811c9dc5 ^ BAKE_VERSION;
  for (let i = 0; i < pos.count * 3; i++) h1 = Math.imul(h1 ^ Math.round(pos.array[i] * 2000), 16777619);
  geo.setAttribute('bakeUv', new THREE.BufferAttribute(out, 2));
  mesh.userData.bakeArea = id;
  return (h1 >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------- tone
// The day map is physical (open sky ≈ the noon hemisphere fill): rooms lit only through their
// windows come out much darker than the old flat fill, so it is lifted to the brightness the
// interior exposure was tuned for (day) and white-balanced a little (tint: the sky dome is blue,
// the bounce off wood warm); night = the lamps as baked, a little lifted.
// 2026-10-17 rollout: day 20 → 23 (+15 %, "a little brighter") on top of the brighter, less tinted
// bounce of the new bakes; tint lifts blue ~10 % (the bake's mean came out b/g 0.88); night 0.75 → 0.85.
// enclosedDayLamps: areas with almost no daylight (the guest / foyer wing behind the closed front
// façade: only clerestories; bake day p99.5 < ENCLOSED_SKY) keep their lamps at 80 % by day.
export const BAKE_GAIN = { day: 23, night: 0.85, tint: [1.02, 1, 1.1], enclosedDayLamps: 0.8 };
const ENCLOSED_SKY = 0.08;
export const areaClass = (A, rec) => (A.basement ? 1 : A.enclosed || (rec?.dayP995 != null && rec.dayP995 < ENCLOSED_SKY) ? 2 : 0);

// ---------------------------------------------------------------- runtime (browser)
//   const bake = createBakeRuntime({ renderer, lite });
//   await bake.processLevel('L1', pairs)   after the level's meshes exist (desktop: all at start;
//                                          phones: when the level's stage lands)
//   per frame: bake.update(day); bake.inBaked(x, y, e)
export function createBakeRuntime({ renderer, lite = false, base = '/bake/', onApplied = null } = {}) {
  const st = { index: null, layout: null, active: new Map(), size: lite ? BAKE_PAGE / 2 : BAKE_PAGE, arrays: null, failed: false, hero: null, log: [] };
  const nextFrame = () => new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 16)));
  let worker = null, seq = 0;
  const waiting = new Map();
  function getWorker() {
    if (worker !== null) return worker;
    try {
      worker = new Worker(new URL('./bake-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => { const w = waiting.get(e.data.seq); waiting.delete(e.data.seq); w?.res(e.data); };
      worker.onerror = (e) => { console.warn('[bake] worker failed, unwrapping on the main thread', e.message); worker = false; for (const w of waiting.values()) w.rej(e); waiting.clear(); };
    } catch (e) { worker = false; }
    return worker;
  }
  const unwrap = (P, opts) => {
    const w = getWorker();
    if (!w) return Promise.resolve(unwrapTriangles(P, opts));
    return new Promise((res, rej) => { const s = ++seq; waiting.set(s, { res, rej }); w.postMessage({ seq: s, P, opts }, [P.buffer]); })
      .catch(() => unwrapTriangles(P, opts));
  };
  const ready = (async () => {
    if (typeof fetch !== 'function') return false;
    try {
      const r = await fetch(`${base}index.json`, { cache: 'no-cache' });
      if (!r.ok) return false;
      const idx = await r.json();
      if (idx.version !== BAKE_VERSION || idx.page !== BAKE_PAGE) { console.info('[bake] index is for another bake version — real-time lighting'); return false; }
      st.index = idx;
      st.layout = layoutLayers(idx.areas);
      if (!st.layout.layers || st.layout.layers > MAX_LAYERS) { console.warn('[bake] too many layers', st.layout.layers); return false; }
      const mk = () => {
        const t = new THREE.DataArrayTexture(null, st.size, st.size, st.layout.layers);
        t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.generateMipmaps = false;
        t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
        t.source.dataReady = false; // storage only: the pages are copied in as they arrive
        t.needsUpdate = true;
        renderer.initTexture(t);
        return t;
      };
      st.arrays = { day: mk(), night: mk() };
      BAKE_U.bakeDay.value = st.arrays.day; BAKE_U.bakeNight.value = st.arrays.night;
      return true;
    } catch (e) { console.warn('[bake] index failed', e); return false; }
  })();
  // decode one page image (off the main thread) and copy it into its layer
  async function uploadPage(file, arr, layer, yOff) {
    const res = await fetch(base + file);
    if (!res.ok) throw new Error(file + ' ' + res.status);
    const bmp = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none', imageOrientation: 'none' });
    await nextFrame();
    const src = new THREE.Texture(bmp);
    renderer.copyTextureToTexture(src, arr, null, new THREE.Vector3(0, Math.round(yOff * st.size), layer));
    bmp.close?.();
  }
  const levelDone = new Set();
  // pairs: [[groupName, mesh]] of the level (all of its meshes: shell, finishes, furniture)
  async function processLevel(lv, pairs) {
    if (levelDone.has(lv)) return;
    levelDone.add(lv);
    if (!(await ready)) return;
    const t0 = performance.now();
    const found = [];
    for (const A of areasOfLevel(lv)) {
      const rec = st.index.areas.find(a => a.id === A.id);
      if (!rec) continue;
      // gather on the main thread in slices, unwrap in the worker
      const it = gatherAreaSteps(A.id, pairs);
      let g;
      for (let t = performance.now(); ;) {
        const r = it.next();
        if (r.done) { g = r.value; break; }
        if (performance.now() - t > 6) { await nextFrame(); t = performance.now(); }
      }
      if (!g.sel.length) continue;
      const un = await unwrap(g.P, unwrapOptions(A.id));
      if (un.hash !== rec.hash) { console.info(`[bake] ${A.id}: stored bake is for other geometry (${rec.hash} ≠ ${un.hash}) — real-time lighting`); continue; }
      found.push({ A, rec, g, un });
    }
    // maps first (an area whose maps fail keeps the real-time look), then the uvs
    const ok = [];
    for (const f of found) {
      try {
        const files = f.rec.files[lite ? 'mobile' : 'desktop'];
        for (let p = 0; p < f.rec.pages; p++) {
          const [layer, yOff] = st.layout.map[f.A.id][p];
          await uploadPage(`${f.A.id}/${files.day[p]}`, st.arrays.day, layer, yOff);
          await uploadPage(`${f.A.id}/${files.night[p]}`, st.arrays.night, layer, yOff);
        }
        ok.push(f);
      } catch (e) { console.warn(`[bake] ${f.A.id}: maps failed to load`, e?.message || e); }
    }
    const steps = applyBakeUvSteps(ok.map(f => ({ sel: f.g.sel, uv: f.un.uv, page: f.un.page, map: st.layout.map[f.A.id], cls: areaClass(f.A, f.rec), slot: f.A.slot })));
    const written = [];
    for (let t = performance.now(); ;) {
      const r = steps.next();
      if (r.done) break;
      written.push(r.value);
      if (performance.now() - t > 8) { await nextFrame(); t = performance.now(); }
    }
    for (const f of ok) {
      // the area's gain row: bakeAreas() × an optional index.json override (rec.gain)
      BAKE_U.bakeGain.value[f.A.slot].set(f.A.gain.day * (f.rec.gain?.day ?? 1), f.A.gain.night * (f.rec.gain?.night ?? 1));
      st.active.set(f.A.id, f.rec);
      if (f.A.hero && st.hero) checkHero();
    }
    BAKE_U.bakeOn.value = st.active.size ? 1 : 0;
    BAKE_U.bakePointOff.value = st.active.size ? 1 : 0;
    st.log.push({ level: lv, areas: ok.map(f => f.A.id), ms: Math.round(performance.now() - t0) });
    onApplied?.(lv, written);
  }
  // the scanned hero furniture: lightmap strip valid while its geometry matches the bake's
  function checkHero() {
    const mesh = st.hero;
    if (!mesh) return;
    for (const [id, rec] of st.active) {
      const A = bakeAreas()[id];
      if (!A.hero) continue;
      const h = heroBakeUv(id, st.layout.map[id][0], mesh);
      if (rec.heroHash !== h) mesh.geometry.deleteAttribute('bakeUv');
    }
  }
  function setHero(mesh) { st.hero = mesh; checkHero(); }
  // day: 0 night .. 1 noon (main.js dayFactor)
  function update(day) {
    if (!st.active.size) return;
    const lampOn = 0.12 + 0.88 * (1 - day); // = LightManager's interior lamp factor (basements: always on)
    const s = BAKE_SCALE;
    BAKE_U.bakeK.value.set(s.day * day * BAKE_GAIN.day, s.night * lampOn * BAKE_GAIN.night, s.night * BAKE_GAIN.night, s.day / OPEN_SKY * 1.5);
    BAKE_U.bakeK2.value.set(s.night * Math.max(lampOn, BAKE_GAIN.enclosedDayLamps) * BAKE_GAIN.night, 0, 0, 0);
    BAKE_U.bakeKeep.value = 1 - day;
    BAKE_U.bakeTint.value.set(...BAKE_GAIN.tint);
  }
  // Is the camera inside a baked area (plan x, y; world elevation e)?
  function inBaked(x, y, e) {
    for (const id of st.active.keys()) {
      const A = bakeAreas()[id];
      if (e >= A.elev[0] - 0.5 && e <= A.elev[1] && inRects(A.rects, x, y)) return true;
    }
    return false;
  }
  return {
    ready, processLevel, update, inBaked, setHero,
    get active() { return [...st.active.keys()]; },
    get layers() { return st.layout?.layers || 0; },
    stats: () => ({ active: [...st.active.keys()], layers: st.layout?.layers || 0, size: st.size, log: st.log, worker: !!worker }),
  };
}
