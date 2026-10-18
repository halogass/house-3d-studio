// Shared geometry helpers (plan coords: x east, y north, z = elevation).
// World mapping: X = x, Y = z, Z = -y. Used by world.js and the interior / exterior builders.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function subtract(r, holes) {
  let parts = [r];
  for (const h of holes) {
    const next = [];
    for (const p of parts) {
      if (h[0] >= p[2] || h[2] <= p[0] || h[1] >= p[3] || h[3] <= p[1]) { next.push(p); continue; }
      const ix0 = Math.max(p[0], h[0]), ix1 = Math.min(p[2], h[2]);
      const iy0 = Math.max(p[1], h[1]), iy1 = Math.min(p[3], h[3]);
      if (p[1] < iy0) next.push([p[0], p[1], p[2], iy0]);
      if (iy1 < p[3]) next.push([p[0], iy1, p[2], p[3]]);
      if (p[0] < ix0) next.push([p[0], iy0, ix0, iy1]);
      if (ix1 < p[2]) next.push([ix1, iy0, p[2], iy1]);
    }
    parts = next;
  }
  return parts.filter(p => p[2] - p[0] > 1e-3 && p[3] - p[1] > 1e-3);
}

// Axis-aligned box in plan coords; UVs in metres.
export function box(x0, y0, x1, y1, z0, z1) {
  const w = Math.abs(x1 - x0), d = Math.abs(y1 - y0), h = Math.abs(z1 - z0);
  if (w < 1e-3 || d < 1e-3 || h < 1e-3) return null;
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
  }
  g.translate((x0 + x1) / 2, (Math.min(z0, z1) + Math.max(z0, z1)) / 2, -(y0 + y1) / 2);
  return g;
}

// Horizontal rectangle at elevation z, facing up (or down).
export function plane(r, z, up = true) {
  const [x0, y0, x1, y1] = r;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, z, -y0, x1, z, -y0, x1, z, -y1, x0, z, -y1], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([x0, y0, x1, y0, x1, y1, x0, y1], 2));
  const n = up ? 1 : -1;
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, n, 0, 0, n, 0, 0, n, 0, 0, n, 0], 3));
  g.setIndex(up ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
  return g;
}

// Triangles from plan points [x, y, z]; UVs planar (x, y).
export function tris(list) {
  const pos = [], uv = [];
  for (const t of list) for (const p of t) { pos.push(p[0], p[2], -p[1]); uv.push(p[0], p[1] + p[2] * 0.6); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// Hip roof over rect r (plan) with eaves at `base`.
// over: overhang in metres, or per side { w, s, e, n } (0 where the roof meets a taller wall)
// top (optional): cut the roof off flat at that elevation (a mansard ring around a flat deck).
export function hipRoof(r, base, pitch = 0.45, over = 0.6, top) {
  const o = typeof over === 'number' ? { w: over, s: over, e: over, n: over } : over;
  let [x0, y0, x1, y1] = [r[0] - o.w, r[1] - o.s, r[2] + o.e, r[3] + o.n];
  const X = x1 - x0, Y = y1 - y0;
  const out = (list) => tris(top === undefined ? list : clipBelow(list, top));
  if (X >= Y) {
    const ym = (y0 + y1) / 2, hr = base + pitch * Y / 2;
    const r1 = [x0 + Y / 2, ym, hr], r2 = [x1 - Y / 2, ym, hr];
    const A = [x0, y0, base], B = [x1, y0, base], C = [x1, y1, base], D = [x0, y1, base];
    return out([[A, B, r2], [A, r2, r1], [C, D, r1], [C, r1, r2], [D, A, r1], [B, C, r2]]);
  }
  const xm = (x0 + x1) / 2, hr = base + pitch * X / 2;
  const r1 = [xm, y0 + X / 2, hr], r2 = [xm, y1 - X / 2, hr];
  const A = [x0, y0, base], B = [x1, y0, base], C = [x1, y1, base], D = [x0, y1, base];
  return out([[B, C, r2], [B, r2, r1], [D, A, r1], [D, r1, r2], [A, B, r1], [C, D, r2]]);
}

// Both windings of a triangle list (gable infill seen from inside the roof space and from outside)
const twoSided = (list) => [...list, ...list.map(t => [t[0], t[2], t[1]])];

// Gable roof over rect r: ridge along `ridge` ('x' | 'y', default the longer side), eaves at `base`
// on the two long sides. Returns { roof, gables }: the two roof planes and the two triangular end
// walls (gable infill, to be drawn with the exterior wall material; their plane is the wall line).
export function gableRoof(r, base, pitch = 0.45, over = 0.6, ridge = null) {
  const o = typeof over === 'number' ? { w: over, s: over, e: over, n: over } : over;
  const [x0, y0, x1, y1] = [r[0] - o.w, r[1] - o.s, r[2] + o.e, r[3] + o.n];
  const alongX = ridge ? ridge === 'x' : (x1 - x0) >= (y1 - y0);
  if (alongX) {
    const ym = (y0 + y1) / 2, hr = base + pitch * (y1 - y0) / 2;
    const A = [x0, y0, base], B = [x1, y0, base], C = [x1, y1, base], D = [x0, y1, base], R1 = [x0, ym, hr], R2 = [x1, ym, hr];
    const roof = tris([[A, B, R2], [A, R2, R1], [C, D, R1], [C, R1, R2]]);
    // end walls at the wall lines r[0] / r[2] (under the roof, from the eave height up)
    const yw0 = r[1], yw1 = r[3], hw = (y) => base + pitch * ((y1 - y0) / 2 - Math.abs(y - ym));
    const gables = tris(twoSided([
      [[r[0], yw0, base], [r[0], ym, hw(ym) - 0.02], [r[0], yw1, base]],
      [[r[2], yw0, base], [r[2], yw1, base], [r[2], ym, hw(ym) - 0.02]],
    ]));
    return { roof, gables, ridgeLine: [[x0, ym, hr], [x1, ym, hr]] };
  }
  const xm = (x0 + x1) / 2, hr = base + pitch * (x1 - x0) / 2;
  const A = [x0, y0, base], B = [x1, y0, base], C = [x1, y1, base], D = [x0, y1, base], R1 = [xm, y0, hr], R2 = [xm, y1, hr];
  const roof = tris([[B, C, R2], [B, R2, R1], [D, A, R1], [D, R1, R2]]);
  const hw = base + pitch * (x1 - x0) / 2 - 0.02;
  const gables = tris(twoSided([
    [[r[0], r[1], base], [r[2], r[1], base], [xm, r[1], hw]],
    [[r[2], r[3], base], [r[0], r[3], base], [xm, r[3], hw]],
  ]));
  return { roof, gables, ridgeLine: [[xm, y0, hr], [xm, y1, hr]] };
}

// Mono-pitch (shed / lean-to) roof over rect r, sloping DOWN towards side `down` ('n'|'s'|'e'|'w'):
// eaves at `base` on that side, rising at `pitch`. Returns { roof, gables } (gables: the infill
// walls above the wall tops on the three other sides: two triangles + the high-side strip).
export function shedRoof(r, base, pitch = 0.2, over = 0.6, down = 's') {
  const o = typeof over === 'number' ? { w: over, s: over, e: over, n: over } : over;
  const [x0, y0, x1, y1] = [r[0] - o.w, r[1] - o.s, r[2] + o.e, r[3] + o.n];
  // height at a plan point: base at the low eave (outer edge), rising away from it
  const h = (x, y) => base + pitch * ({ s: y - y0, n: y1 - y, w: x - x0, e: x1 - x }[down]);
  const P = (x, y) => [x, y, h(x, y)];
  const roof = tris([[P(x0, y0), P(x1, y0), P(x1, y1)], [P(x0, y0), P(x1, y1), P(x0, y1)]]);
  // infill walls on the wall lines of r, from the wall tops (h at the low wall line) up to the roof
  const top = { s: h(r[0], r[1]), n: h(r[0], r[3]), w: h(r[0], r[1]), e: h(r[2], r[1]) }[down];
  const g = [];
  const W = (ax, ay, bx, by) => { // a wall face from a to b: quad between `top` and the roof (minus 2 cm)
    const ha = h(ax, ay) - 0.02, hb = h(bx, by) - 0.02;
    if (ha <= top + 1e-3 && hb <= top + 1e-3) return;
    g.push([[ax, ay, top], [bx, by, top], [bx, by, Math.max(top, hb)]], [[ax, ay, top], [bx, by, Math.max(top, hb)], [ax, ay, Math.max(top, ha)]]);
  };
  W(r[0], r[1], r[2], r[1]); W(r[2], r[1], r[2], r[3]); W(r[2], r[3], r[0], r[3]); W(r[0], r[3], r[0], r[1]);
  return { roof, gables: g.length ? tris(twoSided(g)) : null, high: Math.max(h(x0, y0), h(x1, y1), h(x0, y1), h(x1, y0)) };
}

// Clip plan triangles [[x, y, z] × 3] to z ≤ top (winding kept); drops what lies above.
export function clipBelow(list, top) {
  const res = [];
  for (const t of list) {
    const poly = [];
    for (let i = 0; i < 3; i++) {
      const a = t[i], b = t[(i + 1) % 3], ain = a[2] <= top + 1e-9, bin = b[2] <= top + 1e-9;
      if (ain) poly.push(a);
      if (ain !== bin) { const f = (top - a[2]) / (b[2] - a[2]); poly.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, top]); }
    }
    for (let i = 1; i + 1 < poly.length; i++) res.push([poly[0], poly[i], poly[i + 1]]);
  }
  return res;
}
// Clip a plan segment [p, q] to z ≤ top; null when it lies wholly above.
export function clipSegBelow(p, q, top) {
  const pin = p[2] <= top + 1e-9, qin = q[2] <= top + 1e-9;
  if (pin && qin) return [p, q];
  if (!pin && !qin) return null;
  const f = (top - p[2]) / (q[2] - p[2]), m = [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, top];
  return pin ? [p, m] : [m, q];
}

export function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
export function hash(str) { let h = 7; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 2147483647; return h || 1; }

// Wall runs from room edges on a 0.5 m lattice (same rule as the 2D plan).
export function wallRuns(rooms, openPairs = []) {
  const S = 0.5, r2 = v => Math.round(v * 2) / 2;
  const segs = new Map();
  const add = (k, id) => { if (!segs.has(k)) segs.set(k, []); segs.get(k).push(id); };
  for (const rm of rooms) {
    const [x0, y0, x1, y1] = rm.r;
    for (let x = x0; x < x1 - 1e-6; x += S) { add(`h|${r2(y0)}|${r2(x)}`, rm.id); add(`h|${r2(y1)}|${r2(x)}`, rm.id); }
    for (let y = y0; y < y1 - 1e-6; y += S) { add(`v|${r2(x0)}|${r2(y)}`, rm.id); add(`v|${r2(x1)}|${r2(y)}`, rm.id); }
  }
  const isOpen = (a, b) => openPairs.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
  const list = [];
  for (const [k, ids] of segs) {
    const [o, fixed, start] = k.split('|');
    const cls = ids.length === 1 ? 'ext' : (isOpen(ids[0], ids[1]) ? 'open' : 'int');
    if (cls !== 'open') list.push({ o, fixed: +fixed, start: +start, cls });
  }
  list.sort((a, b) => a.o.localeCompare(b.o) || a.cls.localeCompare(b.cls) || a.fixed - b.fixed || a.start - b.start);
  const runs = [];
  for (const s of list) {
    const last = runs[runs.length - 1];
    if (last && last.o === s.o && last.cls === s.cls && last.fixed === s.fixed && Math.abs(last.end - s.start) < 1e-6) last.end = s.start + S;
    else runs.push({ ...s, end: s.start + S });
  }
  return runs;
}

// Doors: static leaves drawn open by world.js (headless scripts, default), or engine/doors.js draws
// and animates them (the app sets dynamic before building; world.js then leaves the moving parts out)
export const DOOR_MODE = { dynamic: false };

export const DOOR_TOP = { swing: 2.2, double: 2.4, opening: 2.6, sliding: 2.7, folding: 2.7, garage: 2.6 };


// Non-indexed geometry → indexed, sharing vertices whose position, normal and uv are bit-identical
// (the copies toNonIndexed() makes), so it renders exactly the same with about a third of the
// vertices. Attributes must be non-interleaved Float32 (otherwise it only gets a 0..n-1 index).
// Exact compare, no tolerance: fast, and nothing moves.
export function weld(geo) {
  if (geo.index) return geo;
  const names = Object.keys(geo.attributes);
  const attrs = names.map(n => geo.attributes[n]);
  const n = geo.attributes.position.count;
  if (attrs.some(a => a.isInterleavedBufferAttribute || !(a.array instanceof Float32Array))) {
    const seq = new Uint32Array(n);
    for (let i = 0; i < n; i++) seq[i] = i;
    geo.setIndex(new THREE.BufferAttribute(seq, 1));
    return geo;
  }
  const words = attrs.map(a => new Uint32Array(a.array.buffer, a.array.byteOffset, a.count * a.itemSize));
  const sizes = attrs.map(a => a.itemSize);
  let cap = 1; while (cap < n * 2) cap <<= 1;
  const table = new Int32Array(cap).fill(-1); // slot → unique vertex
  const first = new Uint32Array(n);           // unique vertex → source vertex
  const index = new Uint32Array(n);
  let unique = 0;
  const same = (a, b) => {
    for (let k = 0; k < words.length; k++) {
      const w = words[k], s = sizes[k];
      for (let c = 0; c < s; c++) if (w[a * s + c] !== w[b * s + c]) return false;
    }
    return true;
  };
  for (let i = 0; i < n; i++) {
    let h = 2166136261;
    for (let k = 0; k < words.length; k++) {
      const w = words[k], s = sizes[k];
      for (let c = 0; c < s; c++) h = Math.imul(h ^ w[i * s + c], 16777619);
    }
    let slot = (h ^ (h >>> 15)) & (cap - 1);
    for (;;) {
      const u = table[slot];
      if (u < 0) { table[slot] = unique; first[unique] = i; index[i] = unique++; break; }
      if (same(first[u], i)) { index[i] = u; break; }
      slot = (slot + 1) & (cap - 1);
    }
  }
  const out = new THREE.BufferGeometry();
  names.forEach((name, k) => {
    const a = attrs[k], s = a.itemSize, src = a.array, dst = new Float32Array(unique * s);
    for (let u = 0; u < unique; u++) { const o = first[u] * s; for (let c = 0; c < s; c++) dst[u * s + c] = src[o + c]; }
    out.setAttribute(name, new THREE.BufferAttribute(dst, s, a.normalized));
  });
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

// mergeGeometries(geos, false) for geometries with the same attributes (all indexed or all not),
// copied a slice at a time: yields every ~step vertices so one big bucket is not one long task.
// Drain it (for (const _ of …)) or yield* it; anything unusual falls back to mergeGeometries.
export function* mergeSteps(geos, step = 60000) {
  const first = geos[0];
  if (!first) return null;
  const names = Object.keys(first.attributes);
  const indexed = !!first.index;
  const same = geos.every(g => !!g.index === indexed && !Object.keys(g.morphAttributes).length
    && Object.keys(g.attributes).length === names.length
    && names.every(n => g.attributes[n] && !g.attributes[n].isInterleavedBufferAttribute
      && g.attributes[n].itemSize === first.attributes[n].itemSize
      && g.attributes[n].normalized === first.attributes[n].normalized
      && g.attributes[n].array.constructor === first.attributes[n].array.constructor));
  if (!same) return mergeGeometries(geos, false);
  const count = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  const arrays = {};
  for (const n of names) {
    const a = first.attributes[n];
    arrays[n] = new a.array.constructor(count * a.itemSize);
    out.setAttribute(n, new THREE.BufferAttribute(arrays[n], a.itemSize, a.normalized));
  }
  const icount = indexed ? geos.reduce((s, g) => s + g.index.count, 0) : 0;
  const idx = indexed ? (count > 65535 ? new Uint32Array(icount) : new Uint16Array(icount)) : null;
  let at = 0, iat = 0, since = 0;
  for (const g of geos) {
    const c = g.attributes.position.count;
    for (const n of names) { const a = g.attributes[n]; arrays[n].set(a.array.subarray(0, c * a.itemSize), at * a.itemSize); }
    if (indexed) {
      const src = g.index.array, m = g.index.count;
      for (let i = 0; i < m; i++) idx[iat + i] = src[i] + at;
      iat += m;
    }
    at += c; since += c;
    if (since > step) { since = 0; yield; }
  }
  if (indexed) out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
// The same, all at once
export function mergeNow(geos) {
  const it = mergeSteps(geos);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}
