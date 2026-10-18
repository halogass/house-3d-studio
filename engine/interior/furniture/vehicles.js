// Vehicles (garage): stylised but recognisable car models + an EV wall charger.
// Local frame: origin on the floor at the footprint centre, +X width, +Y up, +Z FRONT (the car's nose).
// Cars: w = width (without mirrors), d = length, h = height. Mirrors live in a child group 'mirrors'.
// Bodies are lofted: a side profile (top / bottom outlines), a plan width curve and a rounded section,
// with wheel arches cut by raising the section floor over each axle. Deterministic, no textures needed.
import * as THREE from 'three';
import { Kit, TAU, mtx, rbox as rboxRound, cyl, lathe, torus, tube, roundRectShape } from './decor.js';

/** Rounded box only where the radius reads at viewing distance; small parts are plain boxes (12 tris). */
const rbox = (w, h, d, r = 0, seg = 1) => (r <= 0.012 ? rboxRound(w, h, d, 0) : rboxRound(w, h, d, r, Math.min(seg, 2)));

// ---------------------------------------------------------------- materials

const TRIM = 'lacquer:#1b1c1e';     // satin black plastic (cladding, grilles, B-pillars)
const GLASS = 'lacquer:#10151a';    // deep tinted glass (opaque glossy; there is no cabin)
const SHADOW = 'paint:#0c0c0c';     // contact shadow under the car
const RED = 'lacquer:#a5121a';      // tail-light lens
const RED_DARK = 'lacquer:#5a0c10'; // smoked tail-light housing
const DRL = 'coveLight';            // daytime running light strips (glow softly)
const LENS = 'chrome';              // headlight reflector / projector
const TYRE = 'rubberBlack';

function paintName(c, fallback) {
  if (typeof c !== 'string' || !c) return fallback;
  let m = /^#?([0-9a-fA-F]{6})$/.exec(c);
  if (m) return 'lacquer:#' + m[1].toLowerCase();
  m = /^#?([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(c);
  if (m) return 'lacquer:#' + (m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toLowerCase();
  return c;   // already a material name (lacquer:#…, paint:#…, chrome, …)
}

// ---------------------------------------------------------------- curves

/** Monotone cubic (Fritsch–Carlson) interpolation through [[x, y], …]; clamps outside the range. */
function curve(pts) {
  const P = [...pts].sort((a, b) => a[0] - b[0]);
  const n = P.length; const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  if (n === 1) return () => ys[0];
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / Math.max(xs[i + 1] - xs[i], 1e-6);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const fnOf = (v) => (typeof v === 'number' ? () => v : curve(v));

// ---------------------------------------------------------------- lofted sections

// Ring resolution per half (bottom-centre → top-centre): bottom, bottom corner, side, top corner, top.
const BODY_RES = { B: 1, Cb: 2, S: 2, Ct: 3, T: 3 };
const GREEN_RES = { B: 1, Cb: 1, S: 1, Ct: 3, T: 2 };

function clampRadii(st) {
  const H = Math.max(st.yt - st.yb, 1e-4);
  let rb = Math.min(st.rb, st.hwb * 0.95, H * 0.45), rt = Math.min(st.rt, st.hwt * 0.95, H * 0.6);
  if (rb + rt > H * 0.98) { const f = (H * 0.98) / (rb + rt); rb *= f; rt *= f; }
  return [rb, rt];
}

/** Right half of a section, from bottom centre to top centre. */
function ringHalf(st, R) {
  const { yb, yt, crown = 0 } = st;
  const hwb = Math.max(st.hwb, 1e-3), hwt = Math.max(st.hwt, 1e-3);
  const [rb, rt] = clampRadii(st);
  const pts = [];
  for (let i = 0; i <= R.B; i++) pts.push([(hwb - rb) * i / R.B, yb]);
  for (let i = 1; i <= R.Cb; i++) { const a = -Math.PI / 2 + (Math.PI / 2) * i / R.Cb; pts.push([hwb - rb + rb * Math.cos(a), yb + rb + rb * Math.sin(a)]); }
  for (let i = 1; i < R.S; i++) { const t = i / R.S; pts.push([hwb + (hwt - hwb) * t, yb + rb + (yt - rt - yb - rb) * t]); }
  const top0 = pts.length;
  for (let i = 0; i <= R.Ct; i++) { const a = (Math.PI / 2) * i / R.Ct; pts.push([hwt - rt + rt * Math.cos(a), yt - rt + rt * Math.sin(a)]); }
  for (let i = 1; i <= R.T; i++) pts.push([(hwt - rt) * (1 - i / R.T), yt]);
  for (let i = top0; i < pts.length; i++) { const f = 1 - (pts[i][0] / hwt) ** 2; pts[i][1] += crown * Math.max(0, f); }
  return pts;
}
function ring(st, R) {
  const h = ringHalf(st, R); const K = h.length;
  const out = h.slice();
  for (let j = K - 2; j >= 1; j--) out.push([-h[j][0], h[j][1]]);
  return out;
}
const ringTopStart = (R) => (R.B + 1) + R.Cb + (R.S - 1);

/** Half-width of a station's section at height y (null outside its vertical extent). */
function hwAtSt(st, y) {
  if (y < st.yb - 1e-6 || y > st.yt + 1e-6) return null;
  const [rb, rt] = clampRadii(st);
  if (y < st.yb + rb) { const dy = st.yb + rb - y; return st.hwb - rb + Math.sqrt(Math.max(rb * rb - dy * dy, 0)); }
  if (y > st.yt - rt) { const dy = y - (st.yt - rt); return st.hwt - rt + Math.sqrt(Math.max(rt * rt - dy * dy, 0)); }
  const span = st.yt - rt - st.yb - rb;
  return span > 1e-6 ? st.hwb + (st.hwt - st.hwb) * (y - st.yb - rb) / span : st.hwb;
}
function margin(st, x, y) {
  const top = st.yt + (st.crown || 0) * Math.max(0, 1 - (x / Math.max(st.hwt, 1e-3)) ** 2);
  const hwy = hwAtSt(st, Math.min(Math.max(y, st.yb), st.yt));
  return Math.min(y - st.yb, top - y, (hwy ?? 0) - Math.abs(x));
}

/**
 * Loft rings through stations (ascending z). range = [i0, i1] for an open strip over ring indices,
 * else a closed tube. off = [dx, dy] pushes points outward (for overlays). Returns indexed geometry.
 */
function loft(stations, R, { range = null, off = [0, 0] } = {}) {
  const rings = stations.map(st => ring(st, R));
  const N = rings[0].length;
  const idxs = range ? Array.from({ length: range[1] - range[0] + 1 }, (_, i) => range[0] + i) : [...Array(N).keys(), 0];
  const cols = idxs.length;
  const pos = [], uv = [], index = [];
  stations.forEach((st, j) => {
    let u = 0, prev = null;
    for (const i of idxs) {
      const [x, y] = rings[j][i];
      const px = x + Math.sign(x) * off[0], py = y + off[1];
      if (prev) u += Math.hypot(px - prev[0], py - prev[1]);
      prev = [px, py];
      pos.push(px, py, st.z); uv.push(u, st.z);
    }
  });
  for (let j = 0; j < stations.length - 1; j++) for (let i = 0; i < cols - 1; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
    index.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  // Orient outward: test a vertex on the right side (closed) or top (strip) at the middle station.
  const n = g.attributes.normal; const mid = Math.floor(stations.length / 2) * cols;
  const probe = range ? mid + Math.floor(cols / 2) : mid + ringTopStart(R) - 1;
  const bad = range ? n.getY(probe) < 0 : n.getX(probe) < 0;
  if (bad) {
    for (let t = 0; t < index.length; t += 3) { const tmp = index[t + 1]; index[t + 1] = index[t + 2]; index[t + 2] = tmp; }
    g.setIndex(index); g.computeVertexNormals();
  }
  // Closed rings: weld normals across the uv seam column.
  if (!range) for (let j = 0; j < stations.length; j++) {
    const a = j * cols, b = a + cols - 1;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b); const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}

/** Flat fan cap closing a ring at a station; dir = +1 faces +Z, −1 faces −Z. */
function cap(st, R, dir) {
  const r = ring(st, R);
  let cx = 0, cy = 0; for (const p of r) { cx += p[0]; cy += p[1]; } cx /= r.length; cy /= r.length;
  const pos = [cx, cy, st.z], uv = [cx, cy], nrm = [0, 0, dir], index = [];
  for (const [x, y] of r) { pos.push(x, y, st.z); uv.push(x, y); nrm.push(0, 0, dir); }
  for (let i = 0; i < r.length; i++) {
    const a = 1 + i, b = 1 + ((i + 1) % r.length);
    // Ring runs counter-clockwise seen from +Z for the right half going up → check with a cross product.
    index.push(0, a, b);
  }
  // Fix orientation by the signed area of the ring (seen from +Z).
  let area = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; area += p[0] * q[1] - q[0] * p[1]; }
  if ((area > 0) !== (dir > 0)) for (let t = 0; t < index.length; t += 3) { const tmp = index[t + 1]; index[t + 1] = index[t + 2]; index[t + 2] = tmp; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

// ---------------------------------------------------------------- shapes

function polyShape(pts) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]); s.closePath(); return s; }
function ellipseShape(rx, ry) { const s = new THREE.Shape(); s.absellipse(0, 0, rx, ry, 0, TAU, false, 0); return s; }
/** Thin plate from a shape, protruding `t` towards +Z from z = −t/2 (buried half keeps it seated). */
function plate(shape, t, seg = 3) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -t / 2);
  return g;
}

// ---------------------------------------------------------------- wheels

/**
 * One wheel at the current frame: axle along Z, outward face towards +Z, centre at origin.
 * o: { R, rim, tw, style: 'spoke'|'multi'|'aero'|'disc'|'steel', spokes, rimMat, caliper }
 */
function wheel(k, o) {
  const { R, tw } = o; const rim = o.rim ?? R * 0.68;
  const h = tw / 2;
  // Tyre: lathe around Y, turned so its axis is Z (rx = π/2 maps +Y → +Z).
  const prof = [[rim + 0.004, -h + 0.016], [R - 0.05, -h], [R - 0.014, -h + 0.012], [R, -h + 0.045],
    [R, h - 0.045], [R - 0.014, h - 0.012], [R - 0.05, h], [rim + 0.004, h - 0.016]];
  k.add(lathe(prof, 20), TYRE, 0, 0, 0, Math.PI / 2, 0, 0);
  const zf = h - 0.02;                 // rim face plane
  const rimMat = o.rimMat || 'steelBrushed';
  // Dark well behind the spokes, brake disc and caliper.
  k.add(cyl(rim, rim, 0.01, 22), 'ironBlack', 0, 0, -0.02, Math.PI / 2, 0, 0);
  k.add(cyl(rim * 0.78, rim * 0.78, 0.02, 20), 'steelBrushed', 0, 0, zf - 0.075, Math.PI / 2, 0, 0);
  k.add(rbox(0.07, rim * 0.5, 0.06, 0.01, 1), o.caliper || TRIM, rim * 0.55, rim * 0.42, zf - 0.07, 0, 0, -0.6);
  // Rim lip.
  k.add(torus(rim - 0.006, 0.012, 3, 18), rimMat, 0, 0, zf - 0.006);
  const style = o.style || 'spoke';
  if (style === 'aero' || style === 'disc') {
    // Near-flat aero face with a few dark slots (EV) or a smooth chrome disc (formal).
    k.add(lathe([[0.001, 0.012], [rim * 0.35, 0.009], [rim * 0.98, -0.006]], 22), rimMat, 0, 0, zf - 0.01, Math.PI / 2, 0, 0);
    const n = o.spokes || 5;
    if (style === 'aero') for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.3;
      k.add(rbox(0.035, rim * 0.42, 0.012, 0.012, 2), 'ironBlack', Math.cos(a) * rim * 0.62, Math.sin(a) * rim * 0.62, zf + 0.002, 0, 0, a - Math.PI / 2 + 0.35);
    } else for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      k.add(rbox(0.008, rim * 0.55, 0.006, 0.002, 1), 'chrome', Math.cos(a) * rim * 0.6, Math.sin(a) * rim * 0.6, zf + 0.002, 0, 0, a - Math.PI / 2);
    }
  } else if (style === 'steel') {
    k.add(lathe([[0.001, 0.01], [rim * 0.5, 0.004], [rim * 0.98, -0.01]], 18), rimMat, 0, 0, zf - 0.012, Math.PI / 2, 0, 0);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; k.add(cyl(0.022, 0.022, 0.012, 8), 'ironBlack', Math.cos(a) * rim * 0.55, Math.sin(a) * rim * 0.55, zf - 0.004, Math.PI / 2, 0, 0); }
  } else {
    const n = o.spokes || (style === 'multi' ? 10 : 5);
    const sw = style === 'multi' ? 0.022 : 0.05;
    const len = rim - 0.075;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.PI / 2;
      const mid = 0.07 + len / 2;
      // Slightly dished: spokes lean in towards the lip.
      k.at(Math.cos(a) * mid, Math.sin(a) * mid, zf - 0.012, 0, () => k.add(rbox(sw, len, 0.022, 0.008, 1), rimMat, 0, 0, 0, 0.12, 0, 0), 0, a - Math.PI / 2);
    }
  }
  // Hub cap.
  k.add(cyl(0.06, 0.07, 0.03, 10), style === 'disc' ? 'chrome' : rimMat, 0, 0, zf, Math.PI / 2, 0, 0);
  k.add(cyl(0.035, 0.035, 0.008, 10), style === 'disc' ? 'chrome' : TRIM, 0, 0, zf + 0.018, Math.PI / 2, 0, 0);
}

// ---------------------------------------------------------------- car builder

function sampleStations(L, axles, extra, step = 0.14, endStep = 0.05, endLen = 0.3) {
  const h = L / 2; const zs = new Set();
  const push = (z) => { if (z >= -h - 1e-9 && z <= h + 1e-9) zs.add(+z.toFixed(4)); };
  const inArch = (z) => axles.some(a => Math.abs(z - a.z) < a.Ra + 0.03);
  for (let z = -h; z <= h + 1e-9; z += step) if (!inArch(z)) push(z);
  for (let z = 0; z <= endLen; z += endStep) { push(-h + z); push(h - z); }
  push(-h); push(h);
  for (const a of axles) {
    for (let i = -4; i <= 4; i++) push(a.z + a.Ra * 0.9999 * Math.sin((i / 4) * Math.PI / 2));
    push(a.z - a.Ra - 0.004); push(a.z + a.Ra + 0.004);
  }
  for (const z of extra || []) push(z);
  const arr = [...zs].sort((a, b) => a - b);
  const out = [arr[0]];
  for (const z of arr.slice(1)) if (z - out[out.length - 1] > 0.0025) out.push(z);
  return out;
}

/**
 * Build a car from a spec (all in default dimensions; caller scales).
 * spec: { L, W, axles: [{ z, R, rim?, tw? }], top, bot, hw (curves [[z, v]…]), rt, rb, tumble, crown,
 *         green: { roof, hw?, inset, tumble, rt, crown, roofZ: [z0, z1], pillar }, wheel: {...}, details(c) }
 */
function buildCar(k, spec, p) {
  const L = spec.L, hl = L / 2;
  const body = paintName(p.color ?? spec.color);
  const body2 = spec.twoTone ? paintName(p.color2 ?? spec.color2) : body;
  const top = curve(spec.top), bot = curve(spec.bot), hw = curve(spec.hw), rtF = fnOf(spec.rt ?? 0.1);
  const tumble = spec.tumble ?? 0.04;
  const twDef = spec.tw ?? 0.2;
  const axles = spec.axles.map(a => ({ ...a, tw: a.tw ?? twDef, Ra: a.R + (spec.archGap ?? 0.045) }));
  const archY = (z) => { let y = -Infinity; for (const a of axles) { const dz = z - a.z; if (Math.abs(dz) <= a.Ra) y = Math.max(y, a.R + Math.sqrt(Math.max(a.Ra * a.Ra - dz * dz, 0))); } return y; };
  const stAt = (z) => ({ z, yb: Math.max(bot(z), archY(z)), yt: top(z), hwb: hw(z), hwt: hw(z) - tumble, rb: spec.rb ?? 0.07, rt: rtF(z), crown: spec.crown ?? 0.015 });
  const zs = sampleStations(L, axles, spec.knots, spec.step ?? Math.max(0.14, L / 34));
  const S = zs.map(stAt);

  // Lower body (+ two-tone upper band).
  k.add(loft(S, BODY_RES), body2);
  k.add(cap(S[0], BODY_RES, -1), body2);
  k.add(cap(S[S.length - 1], BODY_RES, 1), body2);
  if (spec.twoTone) {
    const band = spec.band ?? 0.26;
    const B = S.map(st => {
      const yb = Math.max(st.yb + 0.002, st.yt - band);
      return { z: st.z, yb, yt: st.yt + 0.003, hwb: (hwAtSt(st, yb) ?? st.hwb) + 0.003, hwt: st.hwt + 0.003, rb: 0, rt: st.rt, crown: st.crown };
    });
    k.add(loft(B, BODY_RES, { range: [ringTopStart(BODY_RES) - 1 - (BODY_RES.S - 1), ring(B[0], BODY_RES).length - (ringTopStart(BODY_RES) - 1 - (BODY_RES.S - 1))] }), body);
    // Coachline at the colour split.
    const pts = B.filter((_, i) => i % 3 === 0 || i === B.length - 1).filter(st => st.z > -hl + 0.15 && st.z < hl - 0.2);
    for (const s of [-1, 1]) k.add(tube(pts.map(st => [s * (st.hwb + 0.002), st.yb, st.z]), 0.004, 16, 3), spec.coachline || 'chrome');
  }

  // Station lookup helpers.
  const stIndex = (z) => { let i = 0; while (i < S.length - 2 && S[i + 1].z < z) i++; return i; };
  const sideX = (y, z) => {
    const i = stIndex(z); const a = S[i], b = S[i + 1]; const t = Math.min(Math.max((z - a.z) / (b.z - a.z), 0), 1);
    const xa = hwAtSt(a, Math.min(Math.max(y, a.yb), a.yt)), xb = hwAtSt(b, Math.min(Math.max(y, b.yb), b.yt));
    return (xa ?? a.hwb) * (1 - t) + (xb ?? b.hwb) * t;
  };
  const nose = (x, y) => {
    for (let i = S.length - 1; i >= 0; i--) {
      const m = margin(S[i], x, y);
      if (m >= 0) { if (i === S.length - 1) return S[i].z; const m2 = margin(S[i + 1], x, y); return S[i].z + (S[i + 1].z - S[i].z) * (m / (m - m2)); }
    }
    return null;
  };
  const tail = (x, y) => {
    for (let i = 0; i < S.length; i++) {
      const m = margin(S[i], x, y);
      if (m >= 0) { if (i === 0) return S[0].z; const m2 = margin(S[i - 1], x, y); return S[i].z + (S[i - 1].z - S[i].z) * (m / (m - m2)); }
    }
    return null;
  };
  const surf = (end, x, y) => { const v = end > 0 ? nose(x, y) : tail(x, y); return v === null ? null : end * v; };

  const c = {
    k, spec, body, body2, L, hl, top, bot, hw, S, axles, sideX, nose, tail,
    /** Place fn in a frame on the front (end 1) or rear (end −1) surface at (x, y), +Z out of the surface. */
    place(end, x, y, w, h, fn, out = 0) {
      const S0 = (lx, ly) => surf(end, end > 0 ? lx : -lx, ly);
      const zc = S0(x, y) ?? (end > 0 ? hl : hl);
      const g = (lx, ly) => S0(lx, ly) ?? zc;
      const cl = (a) => Math.max(-0.7, Math.min(0.7, a));
      const ry = cl(Math.atan2(g(x - w / 2, y) - g(x + w / 2, y), w));
      const rx = cl(Math.atan2(g(x, y + h / 2) - g(x, y - h / 2), h));
      k.at(0, 0, 0, end > 0 ? 0 : Math.PI, () => k.at(x, y, zc + out, ry, fn, rx));
    },
    /** Mirrored pair: fn(s) runs in a frame mirrored so local +X points outboard on both sides. */
    pair(end, x, y, w, h, fn, out = 0) {
      for (const s of [-1, 1]) c.place(end, s * x, y, w, h, () => k.at(0, 0, 0, 0, () => fn(s), 0, 0, s, 1, 1), out);
    },
    /** Tube following the front/rear surface through [[x, y], …]. */
    faceTube(end, pts, r, name, off = 0.006, mirror = true) {
      for (const s of mirror ? [-1, 1] : [1]) {
        const P = pts.map(([x, y]) => { const lx = s * x; const z = surf(end, end > 0 ? lx : -lx, y); return [end > 0 ? lx : -lx, y, end * ((z ?? hl) + off)]; });
        k.add(tube(P, r, Math.max(8, pts.length * 3), 5), name);
      }
    },
    /** Tube along both body sides through [[y, z], …]. */
    sideTube(pts, r, name, off = 0.003, segs) {
      for (const s of [-1, 1]) k.add(tube(pts.map(([y, z]) => [s * (sideX(y, z) + off), y, z]), r, segs || Math.max(8, pts.length * 4), 4), name);
    },
    /** Door shut line on both sides from (y0, z0) to (y1, z1). */
    seam(z0, y0, z1 = z0, y1 = null) {
      const yTop = y1 ?? top(z1) - 0.03;
      for (const s of [-1, 1]) k.rod([s * (sideX(y0, z0) + 0.0012), y0, z0], [s * (sideX(yTop, z1) + 0.0012), yTop, z1], 0.0035, TRIM, 3);
    },
    handle(z, y, name = 'chrome', w = 0.15) {
      for (const s of [-1, 1]) k.add(rbox(0.022, 0.028, w, 0.01, 1), name, s * (sideX(y, z) + 0.008), y, z);
    },
  };

  // Wheels, wheel wells, arch lips.
  for (const a of axles) {
    const hwA = hw(a.z) - (spec.wheelInset ?? 0.02);
    const xw = hwA - a.tw / 2;
    const wo = { ...spec.wheel, R: a.R, rim: a.rim ?? spec.wheel?.rim, tw: a.tw };
    for (const s of [-1, 1]) {
      if (p.wheels !== 'separate') { k.at(s * xw, a.R, a.z, s * Math.PI / 2, () => wheel(k, wo)); continue; }
      // Drivable rig (engine/drive): each wheel is its own child group 'wheel' centred on its hub, so it
      // can spin about local X and steer about Y (front: position.z > 0, radius: position.y).
      const place = k.M.clone().multiply(mtx(s * xw, a.R, a.z, 0, s * Math.PI / 2, 0));
      const hub = new THREE.Vector3().setFromMatrixPosition(place);
      const wk = new Kit(k.mat);
      wk.stack = [new THREE.Matrix4().makeTranslation(-hub.x, -hub.y, -hub.z).multiply(place)];
      wheel(wk, wo);
      wk.origin = [hub.x, hub.y, hub.z];
      k.sub('wheel', wk);
    }
    const bw = Math.max(xw - a.tw / 2 - 0.03, 0.2);
    const yb = bot(a.z) + 0.02, yt = a.R + a.Ra - 0.01;
    k.add(rbox(bw * 2, yt - yb, a.Ra * 2, 0.01, 1), 'ironBlack', 0, (yb + yt) / 2, a.z);
    // Arch lip (cladding or a body-coloured flare).
    const lip = spec.archLip ?? { r: 0.012, mat: 'body' };
    if (lip) {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const ph = Math.PI * i / 14; const z = a.z + Math.cos(ph) * (a.Ra + lip.r * 0.6), y = a.R + Math.sin(ph) * (a.Ra + lip.r * 0.6);
        pts.push([y, z]);
      }
      for (const s of [-1, 1]) k.add(tube(pts.map(([y, z]) => [s * (hw(z) - tumble * Math.max(0, (y - bot(z)) / Math.max(top(z) - bot(z), 0.1)) - 0.004 + lip.r * 0.6), y, z]), lip.r, 14, 4), lip.mat === 'body' ? body2 : lip.mat);
    }
  }

  // Greenhouse.
  const G = spec.green;
  if (G) {
    const roof = curve(G.roof); const ghw = G.hw ? curve(G.hw) : null;
    const z0 = Math.min(...G.roof.map(q => q[0])), z1 = Math.max(...G.roof.map(q => q[0]));
    const gz = [];
    const gstep = G.step ?? 0.12;
    for (let z = z0; z < z1; z += gstep) gz.push(z);
    for (const q of G.roof) gz.push(q[0]);
    for (const z of G.roofZ || []) gz.push(z);
    for (let i = 1; i <= 2; i++) { gz.push(z0 + i * 0.04); gz.push(z1 - i * 0.04); }
    const gzs = [...new Set(gz.map(z => +z.toFixed(4)))].sort((a, b) => a - b).filter((z, i, arr) => i === 0 || z - arr[i - 1] > 0.004);
    const GS = gzs.map(z => {
      const yb = top(z) - 0.04;
      const bodyHw = sideX(top(z) - 0.012, z);
      const hwb = ghw ? ghw(z) : bodyHw - (G.inset ?? 0.035);
      return { z, yb, yt: Math.max(roof(z), yb + 0.006), hwb, hwt: Math.max(hwb - (G.tumble ?? 0.14), 0.12), rb: 0, rt: G.rt ?? 0.1, crown: G.crown ?? 0.02 };
    });
    k.add(loft(GS, GREEN_RES), p.glass || G.glass || GLASS);
    // Body-coloured roof panel over [roofZ0, roofZ1].
    if (G.roofZ) {
      const RS = GS.filter(st => st.z >= G.roofZ[0] - 1e-6 && st.z <= G.roofZ[1] + 1e-6);
      const i0 = ringTopStart(GREEN_RES) + 1; const N = ring(RS[0], GREEN_RES).length;
      if (RS.length > 1) k.add(loft(RS, GREEN_RES, { range: [i0, N - i0], off: [0.005, 0.007] }), p.roof ? paintName(p.roof) : (G.roofMat || body));
      // Pillars: A (front) and C/D (rear) follow the glass edge; B pillars are straight.
      const pm = G.pillar === 'body' ? body : G.pillar || TRIM;
      const iP = ringTopStart(GREEN_RES) + 1;
      const edge = (list) => list.map(st => { const q = ring(st, GREEN_RES)[iP]; return [q[0] + 0.004, q[1] + 0.003, st.z]; });
      const A = GS.filter(st => st.z >= G.roofZ[1] - 0.02), Cp = GS.filter(st => st.z <= G.roofZ[0] + 0.02);
      for (const s of [-1, 1]) for (const list of [A, Cp]) if (list.length > 1) {
        k.add(tube(edge(list).map(([x, y, z]) => [s * x, y, z]), G.pillarR ?? 0.026, Math.min(list.length * 2, 14), 4), G.aMat === 'body' || G.pillar === 'body' ? body : pm);
      }
      for (const zb of G.b || []) {
        const st = GS[GS.reduce((bi, st, i) => (Math.abs(st.z - zb) < Math.abs(GS[bi].z - zb) ? i : bi), 0)];
        const q = ring(st, GREEN_RES)[iP];
        for (const s of [-1, 1]) k.rod([s * (st.hwb + 0.004), st.yb + 0.03, zb], [s * (q[0] + 0.004), q[1], zb], 0.03, G.bMat || TRIM, 6);
      }
    }
    // Chrome window surround along the belt.
    if (G.beltTrim) {
      const pts = GS.filter((_, i) => i % 2 === 0).map(st => [st.hwb + 0.006, st.yb + 0.045, st.z]);
      for (const s of [-1, 1]) k.add(tube(pts.map(([x, y, z]) => [s * x, y, z]), 0.007, 14, 3), G.beltTrim);
    }
    c.GS = GS;
  }

  // Mirrors (separate child group 'mirrors' so the footprint w excludes them).
  if (spec.mirror) {
    const mk = new Kit(k.mat);
    mk.stack = [k.M.clone()];
    const { z, y, len = 0.2, hgt = 0.12 } = spec.mirror;
    const sx = sideX(Math.min(y - 0.04, top(z) - 0.03), z);
    const yBase = Math.min(y, top(z)) - 0.02;
    for (const s of [-1, 1]) if (y - 0.03 > yBase + 0.01) mk.rod([s * (sx - 0.03), yBase, z], [s * (sx + 0.02), y - 0.03, z], 0.012, TRIM, 6);
    for (const s of [-1, 1]) mk.at(s * (sx + 0.005), y, z, 0, () => {
      mk.add(rbox(0.06, 0.03, 0.08, 0.01, 1), TRIM, s * 0.02, -0.03, 0);
      mk.at(s * (0.025 + len / 2), 0, 0, -s * 0.12, () => {
        mk.add(rbox(len, hgt, 0.085, 0.035, 1), spec.mirror.mat === 'trim' ? TRIM : body, 0, 0, 0.01);
        mk.add(rbox(len - 0.025, hgt - 0.025, 0.01, 0.02, 1), 'mirror', 0, 0, -0.035);
        mk.add(rbox(len * 0.5, 0.01, 0.012, 0.004, 1), 'coveLight', s * len * 0.15, -hgt / 2 + 0.012, 0.045);
      });
    });
    k.sub('mirrors', mk);
  }

  // Contact shadow.
  k.add(new THREE.ShapeGeometry(roundRectShape(spec.W * 0.96, L * 0.97, 0.35), 4), SHADOW, 0, 0.004, 0, -Math.PI / 2, 0, 0);

  spec.details(c);
}

function makeCar(type) {
  const spec = SPECS[type];
  return (params = {}, mat) => {
    const k = new Kit(mat);
    const w = params.w ?? spec.W, d = params.d ?? spec.L, h = params.h ?? spec.H;
    const sx = w / spec.W, sz = d / spec.L, sy = h / spec.H;
    k.at(0, 0, 0, 0, () => buildCar(k, spec, params), 0, 0, sx, sy, sz);
    return k.build(type, { w, d, h, solid: true }, { color: paintName(params.color ?? spec.color) });
  };
}

// ---------------------------------------------------------------- detail kits

/** Rounded lens: chrome reflector + glass cover, w×h, centred at the current frame. */
function lampUnit(k, w, h, r, opts = {}) {
  k.add(plate(roundRectShape(w + 0.02, h + 0.02, r + 0.01), 0.03, 4), opts.housing || TRIM);
  k.add(plate(roundRectShape(w, h, r), 0.036, 4), opts.lens || LENS);
  if (opts.drl) k.add(plate(roundRectShape(w * 0.85, Math.min(0.016, h * 0.25), 0.006, 0, opts.drlY ?? h * 0.3), 0.042, 2), DRL);
}
function roundLamp(k, r, ring = true) {
  k.add(cyl(r + 0.012, r + 0.012, 0.03, 18), TRIM, 0, 0, 0, Math.PI / 2, 0, 0);
  k.add(lathe([[0.001, 0.03], [r * 0.6, 0.026], [r, 0.012]], 18), LENS, 0, 0, 0, Math.PI / 2, 0, 0);
  if (ring) k.add(torus(r * 0.82, 0.007, 4, 20), DRL, 0, 0, 0.026);
}
/** Grille panel with horizontal or vertical slats. */
function grille(k, w, h, r, { slats = 4, vertical = false, slatMat = 'chrome', back = TRIM, frame = null, t = 0.03 } = {}) {
  k.add(plate(roundRectShape(w, h, r), t, 4), back);
  if (frame) k.add(plate(roundRectShape(w + 0.04, h + 0.04, r + 0.02), t - 0.006, 4), frame, 0, 0, -0.004);
  for (let i = 0; i < slats; i++) {
    const f = (i + 0.5) / slats - 0.5;
    if (vertical) k.add(rbox(0.012, h - 0.04, 0.02, 0.004, 1), slatMat, f * (w - 0.04), 0, t / 2);
    else k.add(rbox(w - 0.06, 0.012, 0.02, 0.004, 1), slatMat, 0, f * (h - 0.04), t / 2);
  }
}

// ---------------------------------------------------------------- model specs

const SPECS = {
  // MPV: tall 7-seater, split headlights, angular face, black cladding.
  mpv: {
    W: 1.75, L: 4.6, H: 1.75, color: '#f2f2ef', tw: 0.205,
    axles: [{ z: 1.4, R: 0.33 }, { z: -1.375, R: 0.33 }],
    top: [[-2.3, 0.98], [-2.22, 1.08], [-1.6, 1.11], [0.5, 1.07], [1.2, 1.05], [1.8, 1.0], [2.15, 0.94], [2.3, 0.8]],
    bot: [[-2.3, 0.45], [-2.05, 0.27], [-1.8, 0.23], [1.85, 0.23], [2.1, 0.3], [2.3, 0.42]],
    hw: [[-2.3, 0.79], [-2.12, 0.855], [-1.6, 0.87], [1.5, 0.87], [2.05, 0.84], [2.3, 0.73]],
    rt: 0.11, rb: 0.07, tumble: 0.035, crown: 0.025,
    archLip: { r: 0.03, mat: TRIM },
    green: {
      roof: [[1.25, 1.05], [0.9, 1.33], [0.45, 1.6], [0.15, 1.68], [-0.6, 1.7], [-1.85, 1.69], [-2.08, 1.6], [-2.2, 1.3], [-2.24, 1.1]],
      roofZ: [-1.95, 0.25], b: [0.05, -1.0], tumble: 0.14, rt: 0.1, inset: 0.035, crown: 0.02,
    },
    wheel: { style: 'spoke', spokes: 5, rimMat: 'steelBrushed', rim: 0.22 },
    mirror: { z: 1.0, y: 1.14 },
    details(c) {
      const { k } = c;
      // Split headlights: slim DRL high on the bonnet edge, main lamp low in the bumper.
      c.pair(1, 0.6, 0.92, 0.34, 0.05, () => { k.add(plate(polyShape([[-0.17, -0.02], [0.17, -0.005], [0.16, 0.025], [-0.16, 0.012]]), 0.03), DRL); });
      c.pair(1, 0.63, 0.63, 0.22, 0.14, () => lampUnit(k, 0.2, 0.12, 0.03));
      // Central black grille with chrome slats.
      c.place(1, 0, 0.8, 0.7, 0.2, () => grille(k, 0.62, 0.17, 0.04, { slats: 3 }));
      // Dynamic Shield: chrome brackets sweeping from the grille top down and back in towards the lower intake.
      c.faceTube(1, [[0.18, 0.92], [0.42, 0.9], [0.5, 0.78], [0.47, 0.6], [0.36, 0.45], [0.22, 0.4]], 0.016, 'chrome', 0.012);
      c.faceTube(1, [[0.5, 0.78], [0.66, 0.74], [0.78, 0.72]], 0.01, 'chrome', 0.01);
      c.place(1, 0, 0.44, 0.5, 0.1, () => grille(k, 0.44, 0.09, 0.03, { slats: 0 }));
      c.place(1, 0, 0.33, 1.2, 0.08, () => k.add(plate(roundRectShape(1.2, 0.07, 0.03), 0.03), TRIM));
      // Rear: L-shaped tail lights, tailgate garnish, bumper.
      c.pair(-1, 0.62, 0.86, 0.24, 0.2, () => {
        k.add(plate(polyShape([[-0.1, 0.11], [0.12, 0.11], [0.12, -0.12], [0.06, -0.12], [0.06, 0.06], [-0.1, 0.06]]), 0.032), RED);
        k.add(plate(polyShape([[0.07, 0.05], [0.11, 0.05], [0.11, -0.1], [0.07, -0.1]]), 0.04), RED_DARK);
      });
      c.place(-1, 0, 1.0, 0.7, 0.06, () => k.add(plate(roundRectShape(0.62, 0.035, 0.015), 0.03), 'chrome'));
      c.place(-1, 0, 0.42, 1.4, 0.12, () => k.add(plate(roundRectShape(1.4, 0.12, 0.05), 0.04), TRIM));
      // Roof rails.
      for (const s of [-1, 1]) {
        k.add(rbox(0.035, 0.03, 2.0, 0.012, 1), TRIM, s * 0.52, 1.735, -0.85);
        for (const z of [0.1, -1.8]) k.add(rbox(0.04, 0.05, 0.1, 0.012, 1), TRIM, s * 0.52, 1.71, z);
      }
      // Lower cladding, doors and handles.
      c.sideTube([[0.3, 1.0], [0.3, -0.98]], 0.03, TRIM, 0.0);
      c.seam(1.14, 0.3, 1.2, 1.04); c.seam(0.05, 0.3); c.seam(-0.98, 0.3, -1.05);
      c.handle(0.25, 1.0); c.handle(-0.8, 1.0);
    },
  },

  // Microcar: tiny, tall, round; two doors, contrast roof.
  microcar: {
    W: 1.5, L: 2.98, H: 1.64, color: '#a8dcc8', tw: 0.15,
    axles: [{ z: 0.98, R: 0.28 }, { z: -0.98, R: 0.28 }],
    top: [[-1.49, 0.8], [-1.42, 0.92], [-1.1, 0.97], [0.5, 0.93], [1.0, 0.88], [1.35, 0.8], [1.49, 0.62]],
    bot: [[-1.49, 0.36], [-1.3, 0.2], [-1.15, 0.16], [1.15, 0.16], [1.32, 0.2], [1.49, 0.34]],
    hw: [[-1.49, 0.62], [-1.36, 0.72], [-1.0, 0.745], [1.0, 0.745], [1.36, 0.71], [1.49, 0.6]],
    rt: 0.16, rb: 0.08, tumble: 0.04, crown: 0.03,
    green: {
      roof: [[1.08, 0.86], [0.75, 1.2], [0.4, 1.5], [0.12, 1.59], [-1.0, 1.6], [-1.28, 1.52], [-1.4, 1.22], [-1.44, 0.95]],
      roofZ: [-1.25, 0.15], b: [-0.2], tumble: 0.13, rt: 0.17, inset: 0.035, crown: 0.025, roofMat: 'lacquer:#f4f2ec', pillar: 'lacquer:#f4f2ec',
    },
    wheel: { style: 'aero', spokes: 4, rimMat: 'lacquer:#f4f2ec', rim: 0.17 },
    mirror: { z: 0.8, y: 0.98, len: 0.16, hgt: 0.1 },
    details(c) {
      const { k } = c;
      c.pair(1, 0.5, 0.76, 0.24, 0.24, () => roundLamp(k, 0.1));
      c.place(1, 0, 0.66, 0.4, 0.06, () => k.add(plate(roundRectShape(0.38, 0.04, 0.02), 0.03), TRIM));
      c.place(1, 0, 0.38, 0.9, 0.1, () => k.add(plate(roundRectShape(0.8, 0.08, 0.04), 0.03), TRIM));
      c.pair(-1, 0.56, 0.84, 0.14, 0.22, () => { k.add(plate(roundRectShape(0.12, 0.2, 0.05), 0.032), RED); k.add(plate(ellipseShape(0.03, 0.03), 0.04), 'coveLight', 0, 0.04); });
      c.place(-1, 0, 0.4, 1.0, 0.1, () => k.add(plate(roundRectShape(1.0, 0.09, 0.04), 0.03), TRIM));
      c.seam(0.86, 0.22, 0.92, 0.9); c.seam(-0.38, 0.22, -0.32, 0.93);
      c.handle(-0.26, 0.85, TRIM, 0.12);
    },
  },

  // Minivan: big boxy EV people carrier, vertical light-bar grille, sliding doors.
  minivan: {
    W: 2.02, L: 5.21, H: 1.86, color: '#0e0f11', tw: 0.255,
    axles: [{ z: 1.625, R: 0.365 }, { z: -1.58, R: 0.365 }],
    top: [[-2.605, 1.08], [-2.55, 1.16], [-1.8, 1.18], [0.6, 1.16], [1.6, 1.15], [2.2, 1.12], [2.5, 1.08], [2.605, 0.98]],
    bot: [[-2.605, 0.44], [-2.35, 0.24], [-2.1, 0.2], [2.15, 0.2], [2.4, 0.26], [2.605, 0.36]],
    hw: [[-2.605, 0.93], [-2.48, 0.99], [-1.8, 1.005], [2.0, 1.005], [2.45, 0.99], [2.605, 0.94]],
    rt: 0.09, rb: 0.07, tumble: 0.03, crown: 0.025,
    green: {
      roof: [[1.7, 1.14], [1.25, 1.45], [0.8, 1.76], [0.55, 1.82], [-2.2, 1.825], [-2.45, 1.72], [-2.56, 1.16]],
      roofZ: [-2.3, 0.6], b: [0.45, -0.95], tumble: 0.12, rt: 0.08, inset: 0.03, crown: 0.03, beltTrim: 'chrome',
    },
    wheel: { style: 'multi', spokes: 10, rimMat: 'steelBrushed', rim: 0.25 },
    mirror: { z: 1.3, y: 1.22, len: 0.2, hgt: 0.13 },
    details(c) {
      const { k } = c;
      // Tall grille of vertical light bars.
      c.place(1, 0, 0.78, 1.0, 0.5, () => {
        k.add(plate(roundRectShape(0.98, 0.5, 0.06), 0.03), TRIM);
        k.add(plate(roundRectShape(1.02, 0.54, 0.08), 0.022), 'chrome', 0, 0, -0.004);
        for (let i = 0; i < 17; i++) { const x = (i / 16 - 0.5) * 0.88; k.add(rbox(0.014, 0.44, 0.016, 0.004, 1), i % 2 ? 'chrome' : DRL, x, 0, 0.02); }
      });
      c.pair(1, 0.74, 1.02, 0.3, 0.06, () => { k.add(plate(roundRectShape(0.3, 0.035, 0.015), 0.03), DRL); });
      c.pair(1, 0.75, 0.66, 0.2, 0.16, () => lampUnit(k, 0.18, 0.14, 0.03));
      c.place(1, 0, 0.36, 1.5, 0.1, () => k.add(plate(roundRectShape(1.5, 0.09, 0.04), 0.03), TRIM));
      // Rear: full-width light bar + vertical corners.
      c.place(-1, 0, 1.08, 1.8, 0.05, () => k.add(plate(roundRectShape(1.78, 0.03, 0.012), 0.032), RED));
      c.pair(-1, 0.86, 0.9, 0.1, 0.4, () => k.add(plate(roundRectShape(0.06, 0.4, 0.02), 0.034), RED));
      c.place(-1, 0, 0.45, 1.6, 0.12, () => k.add(plate(roundRectShape(1.6, 0.12, 0.05), 0.03), TRIM));
      // Sliding-door track under the rear quarter glass, doors, sill.
      c.sideTube([[1.06, -0.95], [1.06, -2.25]], 0.009, 'chrome', 0.002, 6);
      c.seam(1.55, 0.25, 1.62, 1.12); c.seam(0.45, 0.25); c.seam(-0.95, 0.25, -0.95);
      c.sideTube([[0.27, 1.1], [0.27, -1.1]], 0.012, 'chrome', 0.0, 6);
      c.handle(0.6, 1.02); c.handle(0.3, 1.02);
    },
  },

  // Sports car: very low mid-engine coupé, teardrop canopy, round light pods, quad central exhaust.
  sports: {
    W: 2.04, L: 4.6, H: 1.17, color: '#14213d', tw: 0.27, archGap: 0.035, wheelInset: 0.03,
    axles: [{ z: 1.38, R: 0.33, tw: 0.255 }, { z: -1.415, R: 0.35, tw: 0.33 }],
    top: [[-2.3, 0.72], [-2.18, 0.84], [-1.9, 0.9], [-1.4, 0.92], [-0.7, 0.86], [0.5, 0.8], [1.38, 0.8], [1.9, 0.68], [2.18, 0.55], [2.3, 0.4]],
    bot: [[-2.3, 0.32], [-2.05, 0.12], [-1.8, 0.1], [1.8, 0.1], [2.1, 0.13], [2.3, 0.2]],
    hw: [[-2.3, 0.86], [-2.05, 0.98], [-1.415, 1.02], [-0.6, 0.94], [0.4, 0.93], [1.38, 1.0], [1.95, 0.95], [2.3, 0.68]],
    rt: 0.12, rb: 0.06, tumble: 0.06, crown: -0.06,
    green: {
      roof: [[0.95, 0.77], [0.55, 0.97], [0.15, 1.09], [-0.25, 1.135], [-0.75, 1.09], [-1.25, 1.0], [-1.75, 0.9]],
      hw: [[0.95, 0.66], [0.3, 0.76], [-0.4, 0.7], [-1.1, 0.5], [-1.75, 0.22]],
      roofZ: [-1.6, -0.05], b: [], tumble: 0.24, rt: 0.16, crown: 0.03, pillar: 'body',
    },
    wheel: { style: 'multi', spokes: 12, rimMat: 'steelBrushed', rim: 0.25, caliper: 'lacquer:#b01818' },
    mirror: { z: 0.55, y: 0.92, len: 0.16, hgt: 0.07, mat: 'body' },
    details(c) {
      const { k } = c;
      // Round headlight pods: two stacked lamps under one clear bubble.
      c.pair(1, 0.72, 0.56, 0.2, 0.18, () => {
        k.add(plate(roundRectShape(0.2, 0.17, 0.08), 0.03), TRIM);
        k.at(-0.04, 0.03, 0.01, 0, () => roundLamp(k, 0.045));
        k.at(0.05, -0.02, 0.01, 0, () => roundLamp(k, 0.04));
      });
      // Low central intake, side intakes, splitter.
      c.place(1, 0, 0.3, 0.9, 0.14, () => grille(k, 0.86, 0.13, 0.05, { slats: 2, slatMat: TRIM, back: 'ironBlack' }));
      c.pair(1, 0.62, 0.3, 0.26, 0.12, () => k.add(plate(roundRectShape(0.24, 0.1, 0.04), 0.03), 'ironBlack'));
      k.add(rbox(1.7, 0.02, 0.12, 0.008, 1), 'ironBlack', 0, 0.13, 2.22);
      // Rear: quad central exhaust in a square cluster, round tail lights, diffuser fins, active flap.
      c.place(-1, 0, 0.52, 0.2, 0.2, () => {
        k.add(plate(ellipseShape(0.12, 0.12), 0.03), TRIM);
        for (const [x, y] of [[-0.05, 0.05], [0.05, 0.05], [-0.05, -0.05], [0.05, -0.05]]) {
          k.add(cyl(0.036, 0.04, 0.09, 14, true), 'chrome', x, y, 0.035, Math.PI / 2, 0, 0);
          k.add(cyl(0.03, 0.03, 0.01, 12), 'ironBlack', x, y, 0.03, Math.PI / 2, 0, 0);
        }
      });
      c.pair(-1, 0.68, 0.64, 0.24, 0.1, () => { for (const x of [-0.06, 0.06]) k.at(x, 0, 0, 0, () => roundLamp(k, 0.04, false)); });
      for (let i = 0; i < 6; i++) k.add(rbox(0.01, 0.12, 0.3, 0.003, 1), 'ironBlack', (i - 2.5) * 0.18, 0.18, -2.16);
      c.place(-1, 0, 0.82, 1.4, 0.05, () => k.add(rbox(1.4, 0.03, 0.12, 0.012, 1), c.body, 0, 0, 0.03, 0.25, 0, 0));
      // Lens over lamps (red lens discs).
      c.pair(-1, 0.68, 0.64, 0.24, 0.1, () => { for (const x of [-0.06, 0.06]) k.add(cyl(0.035, 0.035, 0.008, 14), RED, x, 0, 0.034, Math.PI / 2, 0, 0); });
      // Side intakes behind the doors, gullwing door seams.
      c.sideTube([[0.62, -0.35], [0.75, -0.55], [0.8, -0.85]], 0.03, 'ironBlack', -0.01);
      c.seam(0.95, 0.2, 0.8, 0.76); c.seam(-0.4, 0.2, -0.45, 0.82);
      c.sideTube([[0.2, 1.0], [0.2, -1.0]], 0.012, 'ironBlack', 0.0, 6);
    },
  },

  // Sedan: long formal saloon, upright grille, long bonnet, two-tone.
  sedan: {
    W: 2.02, L: 5.77, H: 1.65, color: '#0b0b0d', color2: '#b8bbbf', twoTone: true, band: 0.24, tw: 0.255,
    axles: [{ z: 1.965, R: 0.385 }, { z: -1.587, R: 0.385 }],
    top: [[-2.885, 0.96], [-2.82, 1.08], [-2.1, 1.12], [-1.0, 1.11], [0.95, 1.1], [2.2, 1.08], [2.8, 1.06], [2.885, 1.0]],
    bot: [[-2.885, 0.45], [-2.6, 0.22], [-2.2, 0.17], [2.4, 0.17], [2.7, 0.22], [2.885, 0.38]],
    hw: [[-2.885, 0.88], [-2.7, 0.97], [-2.0, 1.0], [2.4, 1.0], [2.75, 0.98], [2.885, 0.93]],
    rt: [[-2.885, 0.08], [0.9, 0.06], [2.885, 0.05]], rb: 0.06, tumble: 0.025, crown: 0.02, step: 0.2,
    green: {
      roof: [[0.9, 1.09], [0.55, 1.4], [0.2, 1.6], [-0.05, 1.635], [-1.3, 1.635], [-1.7, 1.52], [-2.05, 1.28], [-2.25, 1.1]],
      roofZ: [-1.55, 0.15], b: [-0.3], tumble: 0.12, rt: 0.07, inset: 0.03, crown: 0.015, beltTrim: 'chrome', step: 0.15,
    },
    wheel: { style: 'disc', rimMat: 'chrome', rim: 0.27 },
    mirror: { z: 0.55, y: 1.16, len: 0.2, hgt: 0.12 },
    details(c) {
      const { k } = c;
      // Pantheon grille: tall chrome frame, vertical vanes, stands proud of the nose.
      c.place(1, 0, 0.8, 0.66, 0.48, () => {
        k.add(rbox(0.66, 0.48, 0.1, 0.02, 1), 'chrome', 0, 0, 0.02);
        k.add(rbox(0.56, 0.38, 0.02, 0.006, 1), TRIM, 0, 0, 0.065);
        for (let i = 0; i < 13; i++) k.add(rbox(0.012, 0.37, 0.03, 0.003, 1), 'chrome', (i / 12 - 0.5) * 0.52, 0, 0.07);
        k.add(rbox(0.7, 0.035, 0.12, 0.012, 1), 'chrome', 0, 0.255, 0.02);
      }, -0.03);
      // Rectangular headlamps with a DRL line beneath, wide lower air intake.
      c.pair(1, 0.66, 0.88, 0.3, 0.1, () => lampUnit(k, 0.28, 0.085, 0.015, { drl: true, drlY: -0.02 }));
      c.place(1, 0, 0.42, 1.2, 0.1, () => grille(k, 1.2, 0.09, 0.03, { slats: 2 }));
      c.place(1, 0, 0.62, 1.6, 0.04, () => k.add(plate(roundRectShape(1.6, 0.02, 0.01), 0.03), 'chrome'));
      // Rear: tall vertical tail lamps, chrome boot strip, exhaust slots.
      c.pair(-1, 0.8, 0.94, 0.16, 0.3, () => { k.add(plate(roundRectShape(0.15, 0.28, 0.02), 0.03), RED_DARK); k.add(plate(roundRectShape(0.11, 0.22, 0.015), 0.036), RED); });
      c.place(-1, 0, 0.98, 1.2, 0.05, () => k.add(plate(roundRectShape(1.0, 0.025, 0.01), 0.03), 'chrome'));
      c.pair(-1, 0.55, 0.36, 0.2, 0.06, () => k.add(plate(roundRectShape(0.18, 0.05, 0.02), 0.04), 'chrome'));
      // Coach doors: front-hinged front door, rear-hinged rear door; chrome sill.
      c.seam(0.88, 0.25, 0.95, 1.06); c.seam(-0.3, 0.25); c.seam(-1.5, 0.3, -1.5);
      c.handle(-0.15, 1.0); c.handle(-0.45, 1.0);
      c.sideTube([[0.24, 1.6], [0.24, -1.2]], 0.01, 'chrome', 0.0, 6);
    },
  },

  // Hatchback: compact one-box hatch, raked windscreen flowing from a short bonnet.
  hatchback: {
    W: 1.69, L: 4.0, H: 1.52, color: '#b3121b', tw: 0.185,
    axles: [{ z: 1.17, R: 0.305 }, { z: -1.36, R: 0.305 }],
    top: [[-2.0, 0.93], [-1.92, 1.0], [-1.2, 0.99], [0.4, 0.94], [1.15, 0.88], [1.65, 0.79], [1.9, 0.72], [2.0, 0.6]],
    bot: [[-2.0, 0.38], [-1.82, 0.22], [-1.6, 0.15], [1.55, 0.15], [1.8, 0.2], [2.0, 0.32]],
    hw: [[-2.0, 0.76], [-1.85, 0.83], [-1.2, 0.845], [1.2, 0.845], [1.75, 0.8], [2.0, 0.64]],
    rt: 0.12, rb: 0.07, tumble: 0.04, crown: 0.025,
    green: {
      roof: [[1.45, 0.83], [1.0, 1.08], [0.5, 1.37], [0.15, 1.47], [-1.2, 1.49], [-1.65, 1.43], [-1.88, 1.2], [-1.94, 0.98]],
      roofZ: [-1.55, 0.05], b: [-0.2], tumble: 0.14, rt: 0.11, inset: 0.035, crown: 0.025,
    },
    wheel: { style: 'spoke', spokes: 5, rimMat: 'steelBrushed', rim: 0.2 },
    mirror: { z: 0.85, y: 0.98 },
    details(c) {
      const { k } = c;
      c.pair(1, 0.56, 0.76, 0.34, 0.1, () => {
        k.add(plate(polyShape([[-0.17, -0.03], [0.14, -0.045], [0.17, 0.0], [0.16, 0.04], [-0.17, 0.035]]), 0.03), TRIM);
        k.add(plate(polyShape([[-0.12, -0.02], [0.12, -0.03], [0.14, 0.02], [-0.12, 0.025]]), 0.036), LENS);
        k.add(plate(roundRectShape(0.26, 0.012, 0.005, 0, 0.022), 0.04), DRL);
      });
      c.place(1, 0, 0.76, 0.5, 0.06, () => k.add(plate(roundRectShape(0.46, 0.03, 0.015), 0.03), TRIM));
      c.place(1, 0, 0.42, 0.9, 0.16, () => grille(k, 0.86, 0.14, 0.05, { slats: 3, slatMat: TRIM, back: 'ironBlack' }));
      c.pair(-1, 0.66, 1.05, 0.14, 0.3, () => { k.add(plate(polyShape([[-0.06, 0.15], [0.07, 0.15], [0.07, -0.15], [0.0, -0.15], [-0.06, 0.0]]), 0.032), RED); });
      c.place(-1, 0, 0.42, 1.2, 0.1, () => k.add(plate(roundRectShape(1.2, 0.08, 0.04), 0.03), TRIM));
      c.seam(1.42, 0.2, 1.4, 0.86); c.seam(-0.2, 0.2); c.seam(-1.3, 0.24, -1.4);
      c.handle(-0.05, 0.9, c.body); c.handle(-1.15, 0.92, c.body);
    },
  },

  // EV hatch: rounded electric hatch, wave crease along the sides, connected tail bar.
  ev: {
    W: 1.77, L: 4.29, H: 1.57, color: '#2f8f8a', tw: 0.205,
    axles: [{ z: 1.285, R: 0.315 }, { z: -1.415, R: 0.315 }],
    top: [[-2.145, 0.95], [-2.05, 1.03], [-1.3, 1.02], [0.4, 0.97], [1.2, 0.92], [1.75, 0.84], [2.02, 0.74], [2.145, 0.58]],
    bot: [[-2.145, 0.4], [-1.95, 0.22], [-1.7, 0.16], [1.75, 0.16], [1.98, 0.21], [2.145, 0.32]],
    hw: [[-2.145, 0.78], [-1.98, 0.87], [-1.3, 0.885], [1.3, 0.885], [1.85, 0.84], [2.145, 0.66]],
    rt: 0.14, rb: 0.07, tumble: 0.04, crown: 0.03,
    green: {
      roof: [[1.3, 0.9], [0.85, 1.18], [0.4, 1.46], [0.05, 1.53], [-1.25, 1.535], [-1.7, 1.44], [-1.98, 1.15], [-2.03, 1.01]],
      roofZ: [-1.55, -0.05], b: [-0.3], tumble: 0.15, rt: 0.13, inset: 0.035, crown: 0.025,
    },
    wheel: { style: 'aero', spokes: 5, rimMat: 'steelBrushed', rim: 0.21 },
    mirror: { z: 0.95, y: 1.03 },
    details(c) {
      const { k } = c;
      // Slim curved headlamps, smooth closed face with a lower intake.
      c.pair(1, 0.6, 0.78, 0.34, 0.1, () => {
        k.add(plate(polyShape([[-0.17, 0.0], [-0.05, 0.035], [0.13, 0.04], [0.17, 0.0], [0.1, -0.035], [-0.12, -0.02]]), 0.03), TRIM);
        k.add(plate(polyShape([[-0.13, 0.0], [-0.04, 0.025], [0.11, 0.028], [0.14, 0.0], [0.08, -0.022], [-0.1, -0.012]]), 0.036), LENS);
        k.add(plate(roundRectShape(0.24, 0.01, 0.004, 0.02, 0.018), 0.04), DRL);
      });
      c.place(1, 0, 0.4, 1.1, 0.14, () => grille(k, 1.0, 0.12, 0.05, { slats: 0, back: 'ironBlack' }));
      c.place(1, 0, 0.62, 0.9, 0.04, () => k.add(plate(roundRectShape(0.6, 0.012, 0.005), 0.03), 'chrome'));
      // Connected tail bar with wave-shaped ends.
      c.place(-1, 0, 1.02, 1.6, 0.06, () => k.add(plate(roundRectShape(1.56, 0.025, 0.012), 0.032), RED));
      c.pair(-1, 0.68, 0.98, 0.26, 0.14, () => k.add(plate(polyShape([[-0.12, 0.05], [0.12, 0.06], [0.13, -0.03], [0.02, -0.07], [-0.12, 0.0]]), 0.034), RED));
      c.place(-1, 0, 0.42, 1.3, 0.1, () => k.add(plate(roundRectShape(1.3, 0.09, 0.04), 0.03), TRIM));
      // Wave crease rising from the front door to the tail.
      c.sideTube([[0.48, 1.0], [0.52, 0.4], [0.62, -0.3], [0.78, -0.9], [0.9, -1.5], [0.94, -1.9]], 0.009, c.body, 0.0, 30);
      c.seam(1.3, 0.24, 1.25, 0.9); c.seam(-0.3, 0.22); c.seam(-1.35, 0.26, -1.42);
      c.handle(-0.15, 0.94, c.body); c.handle(-1.2, 0.96, c.body);
    },
  },

  // City car: rounded retro electric hatch, big oval lamps with ring DRLs.
  cityCar: {
    W: 1.71, L: 3.95, H: 1.58, color: '#efe6cf', tw: 0.185,
    axles: [{ z: 1.245, R: 0.3 }, { z: -1.315, R: 0.3 }],
    top: [[-1.975, 0.92], [-1.88, 1.0], [-1.2, 1.0], [0.4, 0.95], [1.15, 0.9], [1.65, 0.82], [1.9, 0.72], [1.975, 0.6]],
    bot: [[-1.975, 0.36], [-1.8, 0.21], [-1.6, 0.16], [1.6, 0.16], [1.82, 0.2], [1.975, 0.32]],
    hw: [[-1.975, 0.72], [-1.82, 0.83], [-1.2, 0.855], [1.2, 0.855], [1.78, 0.8], [1.975, 0.64]],
    rt: 0.17, rb: 0.08, tumble: 0.045, crown: 0.03,
    green: {
      roof: [[1.25, 0.88], [0.85, 1.2], [0.45, 1.47], [0.1, 1.54], [-1.15, 1.545], [-1.55, 1.46], [-1.82, 1.18], [-1.87, 0.98]],
      roofZ: [-1.45, 0.0], b: [-0.25], tumble: 0.14, rt: 0.17, inset: 0.035, crown: 0.03,
    },
    wheel: { style: 'aero', spokes: 6, rimMat: 'lacquer:#e8e4da', rim: 0.2 },
    mirror: { z: 0.9, y: 1.0 },
    details(c) {
      const { k } = c;
      c.pair(1, 0.56, 0.8, 0.32, 0.2, () => {
        k.add(plate(ellipseShape(0.16, 0.1), 0.03, 12), TRIM);
        k.add(plate(ellipseShape(0.145, 0.088), 0.036, 12), LENS);
        k.add(torus(0.045, 0.006, 4, 18), DRL, -0.05, 0, 0.022);
        k.add(torus(0.035, 0.006, 4, 18), DRL, 0.065, 0, 0.022);
      });
      c.place(1, 0, 0.8, 0.5, 0.04, () => k.add(plate(roundRectShape(0.44, 0.02, 0.01), 0.03), 'chrome'));
      c.place(1, 0, 0.4, 0.9, 0.12, () => grille(k, 0.8, 0.1, 0.05, { slats: 2, slatMat: 'chrome', back: TRIM }));
      c.pair(-1, 0.6, 1.0, 0.26, 0.1, () => { k.add(plate(roundRectShape(0.25, 0.07, 0.035), 0.032), RED); k.add(torus(0.022, 0.005, 4, 14), DRL, 0.06, 0, 0.022); });
      c.place(-1, 0, 1.0, 0.8, 0.04, () => k.add(plate(roundRectShape(0.7, 0.018, 0.009), 0.03), 'chrome'));
      c.place(-1, 0, 0.42, 1.2, 0.1, () => k.add(plate(roundRectShape(1.2, 0.08, 0.04), 0.03), TRIM));
      c.seam(1.28, 0.22, 1.2, 0.86); c.seam(-0.25, 0.22); c.seam(-1.3, 0.25, -1.36);
      c.handle(-0.1, 0.92, 'chrome', 0.12); c.handle(-1.15, 0.94, 'chrome', 0.12);
    },
  },

  // Pickup: single-cab pickup with an open cargo bed.
  pickup: {
    W: 1.78, L: 4.97, H: 1.8, color: '#b8bcc0', tw: 0.205, archGap: 0.06,
    axles: [{ z: 1.605, R: 0.35 }, { z: -1.48, R: 0.35 }],
    top: [[-2.485, 0.86], [-0.27, 0.86], [-0.23, 1.2], [0.9, 1.2], [1.9, 1.17], [2.35, 1.12], [2.485, 0.98]],
    bot: [[-2.485, 0.6], [-2.3, 0.5], [-0.3, 0.42], [1.9, 0.4], [2.25, 0.42], [2.485, 0.5]],
    hw: [[-2.485, 0.88], [-2.35, 0.89], [2.0, 0.89], [2.35, 0.87], [2.485, 0.8]],
    rt: 0.08, rb: 0.05, tumble: 0.03, crown: 0.02, knots: [-0.27, -0.25, -0.23],
    archLip: { r: 0.04, mat: TRIM },
    green: {
      roof: [[0.95, 1.18], [0.6, 1.47], [0.3, 1.72], [0.1, 1.765], [-0.1, 1.765], [-0.18, 1.7], [-0.21, 1.2]],
      roofZ: [-0.16, 0.25], b: [], tumble: 0.14, rt: 0.09, inset: 0.035, crown: 0.025, step: 0.08,
    },
    wheel: { style: 'spoke', spokes: 6, rimMat: 'steelBrushed', rim: 0.2 },
    mirror: { z: 0.75, y: 1.28, len: 0.2, hgt: 0.14, mat: 'trim' },
    details(c) {
      const { k, body } = c;
      // Big trapezoid grille with chrome surround and bars.
      c.place(1, 0, 0.84, 1.0, 0.36, () => {
        const sh = polyShape([[-0.36, 0.17], [0.36, 0.17], [0.46, -0.17], [-0.46, -0.17]]);
        k.add(plate(sh, 0.03), TRIM);
        for (let i = 0; i < 4; i++) { const y = 0.12 - i * 0.08; const half = 0.36 + (0.17 - y) / 0.34 * 0.1; k.add(rbox(half * 2 - 0.08, 0.016, 0.02, 0.004, 1), 'ironBlack', 0, y, 0.022); }
      });
      c.faceTube(1, [[0, 1.015], [0.36, 1.012], [0.46, 0.67], [0, 0.67]], 0.012, 'chrome', 0.012);
      c.pair(1, 0.67, 1.0, 0.3, 0.12, () => {
        k.add(plate(polyShape([[-0.15, 0.04], [0.14, 0.06], [0.15, -0.02], [0.0, -0.06], [-0.15, -0.03]]), 0.03), TRIM);
        k.add(plate(polyShape([[-0.12, 0.025], [0.12, 0.045], [0.12, -0.01], [0.0, -0.045], [-0.12, -0.02]]), 0.036), LENS);
        k.add(plate(roundRectShape(0.2, 0.01, 0.004, 0.0, -0.035), 0.04), DRL);
      });
      c.place(1, 0, 0.56, 1.5, 0.16, () => k.add(plate(roundRectShape(1.5, 0.14, 0.05), 0.04), TRIM));
      c.place(1, 0, 0.5, 0.7, 0.06, () => k.add(plate(roundRectShape(0.7, 0.05, 0.02), 0.05), 'steelBrushed'));
      // Ladder frame visible beneath.
      k.add(rbox(1.0, 0.16, 4.2, 0.01, 1), 'ironBlack', 0, 0.42, -0.1);
      // Cargo bed: liner floor, side walls with rail caps, headboard, tailgate, rear step bumper.
      const zb0 = -2.45, zb1 = -0.3, yf = 0.86, yr = 1.22, len = zb1 - zb0, zm = (zb0 + zb1) / 2;
      k.add(rbox(1.66, 0.02, len, 0.004, 1), 'rubberBlack', 0, yf + 0.01, zm);
      for (let i = 0; i < 6; i++) k.add(rbox(0.04, 0.012, len - 0.1, 0.004, 1), 'rubberBlack', (i - 2.5) * 0.26, yf + 0.025, zm);
      for (const s of [-1, 1]) {
        k.add(rbox(0.055, yr - yf + 0.02, len, 0.012, 1), body, s * 0.862, (yf + yr) / 2 - 0.01, zm);
        k.add(rbox(0.02, yr - yf - 0.02, len - 0.04, 0.004, 1), 'rubberBlack', s * 0.825, (yf + yr) / 2, zm);
        k.add(rbox(0.075, 0.025, len + 0.02, 0.01, 1), TRIM, s * 0.86, yr + 0.012, zm);
        // Tail lamps on the bed corners.
        k.add(rbox(0.04, 0.3, 0.1, 0.012, 1), RED, s * 0.875, 1.03, -2.42);
        k.add(rbox(0.04, 0.06, 0.1, 0.01, 1), 'chrome', s * 0.875, 0.85, -2.42);
      }
      k.add(rbox(1.72, yr - yf + 0.06, 0.05, 0.012, 1), body, 0, (yf + yr) / 2 + 0.02, zb1 + 0.01);
      k.add(rbox(1.66, yr - 0.62, 0.05, 0.012, 1), body, 0, (0.62 + yr) / 2, zb0 - 0.01);
      k.add(rbox(0.3, 0.05, 0.03, 0.01, 1), TRIM, 0, 1.1, zb0 - 0.04);
      k.add(rbox(1.7, 0.1, 0.14, 0.02, 2), 'chrome', 0, 0.52, -2.42);
      // Doors, handle, sill and fender flares.
      c.seam(1.0, 0.45, 1.05, 1.17); c.seam(-0.2, 0.45, -0.2, 1.17);
      c.handle(-0.05, 1.08, TRIM);
      c.sideTube([[0.44, 1.2], [0.44, -0.25]], 0.025, TRIM, 0.0, 6);
    },
  },
};

// ---------------------------------------------------------------- wall charger

function wallCharger(params = {}, mat) {
  const k = new Kit(mat);
  const y = params.y ?? 1.2;
  const shell = paintName(params.color ?? '#e9e9e6');
  const bx = 0.02, bw = 0.19, bh = 0.36, bd = 0.11;
  // Main box with a dark glass front, status light bar and a small LED dot.
  k.add(rbox(bw, bh, bd, 0.03, 2), shell, bx, y, bd / 2);
  k.add(rbox(bw - 0.03, bh - 0.06, 0.012), 'lacquer:#15191d', bx, y + 0.01, bd + 0.002);
  k.add(rbox(0.07, 0.01, 0.006), 'screenOn', bx, y + 0.1, bd + 0.009);
  k.add(cyl(0.006, 0.006, 0.006, 10), 'screenOn', bx + 0.055, y + 0.1, bd + 0.009, Math.PI / 2, 0, 0);
  k.add(rbox(bw - 0.012, 0.012, bd - 0.01), 'steelBrushed', bx, y - bh / 2 + 0.005, bd / 2);
  // Holster on the right face with the plug parked in it, nose down.
  const hx = bx + bw / 2;
  k.add(rbox(0.026, 0.1, 0.1), TRIM, hx + 0.012, y + 0.03, 0.09);
  k.add(rbox(0.03, 0.03, 0.05), TRIM, hx + 0.012, y + 0.06, 0.135);
  k.at(hx + 0.012, y - 0.02, 0.13, 0, () => {
    k.add(cyl(0.02, 0.022, 0.06, 14), TRIM, 0, 0, 0);
    k.add(rbox(0.026, 0.07, 0.044, 0.013, 2), TRIM, 0, -0.06, 0.0, 0.25, 0, 0);
  });
  // Cable: out of the box bottom, a hanging loop, then coiled on a hook to the left.
  const hookX = -0.105, hookY = y + 0.06;
  k.add(rbox(0.024, 0.024, 0.1), TRIM, hookX, hookY + 0.01, 0.05);
  k.add(rbox(0.04, 0.03, 0.012), TRIM, hookX, hookY + 0.02, 0.006);
  for (let i = 0; i < 4; i++) {
    const r = 0.05 + i * 0.004, z = 0.03 + i * 0.016;
    k.add(torus(r, 0.008, 6, 22), 'rubberBlack', hookX, hookY + 0.02 - r, z);
  }
  const yb = y - bh / 2;
  k.add(tube([[bx - 0.04, yb - 0.005, 0.05], [bx - 0.045, yb - 0.07, 0.055], [bx - 0.06, y - 0.29, 0.06], [hookX + 0.03, y - 0.27, 0.06], [hookX - 0.005, hookY - 0.08, 0.05], [hookX, hookY - 0.05, 0.04]], 0.008, 22, 6), 'rubberBlack');
  // Plug lead from the parked plug down into the loop.
  k.add(tube([[hx + 0.012, y - 0.1, 0.13], [hx + 0.005, y - 0.18, 0.12], [bx + 0.02, y - 0.3, 0.09], [hookX + 0.05, y - 0.25, 0.07], [hookX + 0.03, hookY - 0.08, 0.065]], 0.008, 22, 6), 'rubberBlack');
  return k.build('wallCharger', { w: 0.32, d: 0.16, h: 0.5, solid: false, mount: 'wall' });
}

// ---------------------------------------------------------------- exports

export const VEHICLES = { wallCharger };
for (const t of Object.keys(SPECS)) VEHICLES[t] = makeCar(t);

/** Car types the visitor can drive (engine/drive), and the numbers the driving model needs. */
export const DRIVABLE = new Set(Object.keys(SPECS));
export function carSpec(type) {
  const s = SPECS[type];
  return s && { W: s.W, L: s.L, H: s.H, axles: s.axles.map(a => ({ z: a.z, R: a.R })) };
}

export const INFO = { wallCharger: { w: 0.32, d: 0.16, h: 0.5, mount: 'wall', solid: false } };
for (const [t, s] of Object.entries(SPECS)) INFO[t] = { w: s.W, d: s.L, h: s.H, mount: 'floor', solid: true };
