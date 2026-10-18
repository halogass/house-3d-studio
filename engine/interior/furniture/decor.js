// Decor furniture (rug, plants, wall art, mirror) + the shared procedural kit used by the living / kitchen / bath / lighting / decor modules.
// Local frame: origin on the floor at the footprint centre, +X width, +Y up, +Z FRONT.
// Wall items: back at z = 0. Ceiling items: hang from params.ceiling.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, hash } from '../../geom.js';

export const TAU = Math.PI * 2;
const V3 = THREE.Vector3;
const KEEP = ['position', 'normal', 'uv'];
const NO_SHADOW = /^(lampShade|paperShade|bulbWarm|candleFlame|glass|crystal|sheer|screenOn|coveLight|mirror)/;

// ---------------------------------------------------------------- kit

export function mtx(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(new V3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new V3(sx, sy, sz));
}

function prep(geom) {
  const g = geom.index ? geom.toNonIndexed() : geom.clone();
  g.clearGroups();
  for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
  g.morphAttributes = {};
  if (!g.attributes.uv) {
    const n = g.attributes.position.count;
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

function flipWinding(g) {
  for (const k of KEEP) {
    const a = g.attributes[k]; const n = a.itemSize; const arr = a.array;
    for (let t = 0; t < a.count; t += 3) for (let c = 0; c < n; c++) {
      const i1 = (t + 1) * n + c, i2 = (t + 2) * n + c;
      const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp;
    }
  }
}

/** Collects transformed parts per material name, then merges them into one mesh per material. */
export class Kit {
  constructor(mat) {
    this.mat = mat || (() => new THREE.MeshStandardMaterial());
    this.parts = new Map();
    this.stack = [new THREE.Matrix4()];
    this.lights = [];
    this.subs = [];
  }
  get M() { return this.stack[this.stack.length - 1]; }
  /** Run fn inside a local transform (translation, yaw, optional pitch/roll and uniform/axis scale). */
  at(x, y, z, ry, fn, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    this.stack.push(this.M.clone().multiply(mtx(x, y, z, rx, ry || 0, rz, sx, sy, sz)));
    try { fn(); } finally { this.stack.pop(); }
    return this;
  }
  addM(geom, name, m) {
    const g = prep(geom);
    const full = this.M.clone().multiply(m);
    g.applyMatrix4(full);
    if (full.determinant() < 0) flipWinding(g);
    if (!this.parts.has(name)) this.parts.set(name, []);
    this.parts.get(name).push(g);
    return this;
  }
  add(geom, name, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    return this.addM(geom, name, mtx(x, y, z, rx, ry, rz, sx, sy, sz));
  }
  /** Box with its min-y at y (convenient for stacking). */
  box(w, h, d, name, x, y, z, r = 0.006, seg = 1, ry = 0) {
    return this.add(rbox(w, h, d, r, seg), name, x, y + h / 2, z, 0, ry, 0);
  }
  /** Cylinder rod between points a and b (radius ra at a, rb at b). */
  rod(a, b, ra, name, seg = 8, rb = ra) {
    const A = new V3(...a), B = new V3(...b);
    const dir = B.clone().sub(A); const len = dir.length();
    if (len < 1e-5) return this;
    const g = cyl(rb, ra, len, seg);
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dir.normalize());
    return this.addM(g, name, new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), q, new V3(1, 1, 1)));
  }
  light(x, y, z, o = {}) {
    const p = new V3(x, y, z).applyMatrix4(this.M);
    const L = {
      pos: [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)],
      color: o.color || '#ffd8a8', intensity: o.intensity ?? 4, distance: o.distance ?? 4, kind: o.kind || 'lamp',
    };
    // Optional, for the lightmap bake (engine/bake/page.js) and the light manager:
    //   ext    [x, y, z] local half-size of the emitting surface (linear / panel LEDs: sampled over it)
    //   down   true: emits downwards only (Lambertian, recessed / surface-mounted fixtures)
    //   clear  radius of the fixture's own body around the bulb (casts no shadow of its own light)
    //   rtDrop the real-time point light sits this much lower (no hot spot on the ceiling above it)
    if (o.ext) {
      const e = new V3(...o.ext).applyMatrix3(new THREE.Matrix3().setFromMatrix4(this.M));
      L.ext = [Math.abs(e.x), Math.abs(e.y), Math.abs(e.z)].map(v => +v.toFixed(3));
    }
    if (o.down) L.down = true;
    if (o.clear) L.clear = o.clear;
    if (o.rtDrop) L.rtDrop = o.rtDrop;
    this.lights.push(L);
    return this;
  }
  /** Separate (unmerged) child group, e.g. a fan rotor that animates. */
  sub(name, kit) { this.subs.push({ name, kit }); return this; }
  meshes() {
    const out = [];
    for (const [name, list] of this.parts) {
      const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
      g.computeBoundingBox(); g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, this.mat(name));
      mesh.name = name; mesh.userData.material = name;
      mesh.castShadow = !NO_SHADOW.test(name); mesh.receiveShadow = true;
      out.push(mesh);
    }
    return out;
  }
  build(type, dims, extra = {}) {
    const group = new THREE.Group();
    group.name = type;
    for (const m of this.meshes()) group.add(m);
    for (const { name, kit } of this.subs) {
      const sg = new THREE.Group(); sg.name = name;
      for (const m of kit.meshes()) sg.add(m);
      if (kit.origin) sg.position.fromArray(kit.origin);
      group.add(sg);
      this.lights.push(...kit.lights);
    }
    group.userData = {
      type, w: +dims.w.toFixed(3), d: +dims.d.toFixed(3), h: +dims.h.toFixed(3),
      solid: !!dims.solid, mount: dims.mount || 'floor', lights: this.lights, ...extra,
    };
    return group;
  }
}

// ---------------------------------------------------------------- geometry factories

export function scaleUV(g, su, sv, ou = 0, ov = 0) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su + ou, uv.getY(i) * sv + ov);
  return g;
}

/** Rounded box centred at origin with metre UVs per face. seg 1 = chamfer-like, 2+ = round. */
export function rbox(w, h, d, r = 0.006, seg = 1) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const g = r < 0.0015 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, seg, r);
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const uv = g.attributes.uv; const per = uv.count / 6;
  for (let f = 0; f < 6; f++) for (let i = f * per; i < (f + 1) * per; i++) uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
  return g;
}

/** Box whose top is scaled (tapered leg / hood). */
export function taperBox(wb, db, h, wt, dt) {
  const g = new THREE.BoxGeometry(wb, h, db);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * wt / wb, p.getY(i), p.getZ(i) * dt / db);
  g.computeVertexNormals();
  scaleUV(g, Math.max(wb, db), h);
  return g;
}

export function cyl(rt, rb, h, seg = 16, open = false, thetaStart = 0, thetaLength = TAU) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, thetaStart, thetaLength);
  return scaleUV(g, Math.max(rt, rb) * thetaLength, h);
}

/** Lathe from [[r, y], ...] listed bottom→top (normals outward). */
export function lathe(pts, seg = 24, phiStart = 0, phiLength = TAU) {
  const v = pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y));
  const g = new THREE.LatheGeometry(v, seg, phiStart, phiLength);
  let len = 0, rmax = 0;
  for (let i = 1; i < v.length; i++) len += v[i].distanceTo(v[i - 1]);
  for (const p of v) rmax = Math.max(rmax, p.x);
  return scaleUV(g, rmax * phiLength, len);
}

export function sphere(r, ws = 12, hs = 8) { return scaleUV(new THREE.SphereGeometry(r, ws, hs), r * TAU, r * Math.PI); }
export function torus(R, r, rs = 8, ts = 32, arc = TAU) { return scaleUV(new THREE.TorusGeometry(R, r, rs, ts, arc), R * arc, r * TAU); }
export function capsule(r, len, cs = 4, rs = 12) { return scaleUV(new THREE.CapsuleGeometry(r, len, cs, rs), r * TAU, len + 2 * r); }
export function tube(points, r, segs = 24, rs = 6, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new V3(...p)), closed, 'catmullrom', 0.5);
  const g = new THREE.TubeGeometry(curve, segs, r, rs, closed);
  return scaleUV(g, curve.getLength(), r * TAU);
}
export function extrude(shape, depth, bevel = 0, bevelSeg = 1, curveSeg = 8) {
  return new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(depth - 2 * bevel, 1e-4), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: bevelSeg, curveSegments: curveSeg,
  });
}
export function roundRectShape(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape(); const x = cx - w / 2, y = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function rectPath(P, w, h, cx = 0, cy = 0, cw = true) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  P.moveTo(x0, y0);
  if (cw) { P.lineTo(x0, y1); P.lineTo(x1, y1); P.lineTo(x1, y0); } else { P.lineTo(x1, y0); P.lineTo(x1, y1); P.lineTo(x0, y1); }
  P.lineTo(x0, y0);
  return P;
}
/** Picture-frame geometry: outer w×h with a border, extruded `depth` towards +Z from z = 0. */
export function frameGeom(w, h, border, depth, bevel = 0.004, bevelSeg = 1, inner = null) {
  const s = new THREE.Shape(); rectPath(s, w, h, 0, 0, false);
  const hole = new THREE.Path(); rectPath(hole, inner ? inner[0] : w - 2 * border, inner ? inner[1] : h - 2 * border, 0, 0, true);
  s.holes.push(hole);
  const g = extrude(s, depth, bevel, bevelSeg);
  g.translate(0, 0, bevel);
  return g;
}

/** Soft cushion: rounded box whose top bulges (keeps smooth normals). */
export function softBox(w, h, d, r = 0.04, bulge = 0.015, seg = 2) {
  const g = rbox(w, h, d, r, seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const fx = 1 - (2 * x / w) ** 2, fz = 1 - (2 * z / d) ** 2;
    const b = bulge * Math.max(0, fx) * Math.max(0, fz);
    p.setY(i, y + (y > 0 ? b : -b * 0.3));
  }
  return g;
}

/** Throw pillow: plump centre, thin pinched edges. Lies in the XY plane, thickness along Z. */
export function pillowGeom(w, h, t, ws = 16, hs = 12) {
  let g = new THREE.SphereGeometry(1, ws, hs);
  const p = g.attributes.position;
  const f = (a, e) => Math.sign(a) * Math.abs(a) ** e;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ex = f(x, 0.3), ey = f(y, 0.3);
    p.setXYZ(i, ex * w / 2, ey * h / 2, z * t / 2 * (0.55 + 0.45 * (1 - Math.abs(ex) ** 4) * (1 - Math.abs(ey) ** 4)));
  }
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-5);
  g.computeVertexNormals();
  const uv = [];
  for (let i = 0; i < g.attributes.position.count; i++) uv.push(g.attributes.position.getX(i) + w / 2, g.attributes.position.getY(i) + h / 2);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** Combine a geometry with an inward-facing copy (for shades / thin shells seen from both sides). */
export function doubleSided(geom, inset = 0.996) {
  const a = prep(geom);
  const b = a.clone();
  b.applyMatrix4(new THREE.Matrix4().makeScale(inset, 1, inset));
  const n = b.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  flipWinding(b);
  return mergeGeometries([a, b], false);
}

/** Inward-facing copy (flipped normals + winding), scaled about the Y axis by s. */
export function flipped(geom, s = 0.97) {
  const b = prep(geom);
  b.applyMatrix4(new THREE.Matrix4().makeScale(s, 1, s));
  const n = b.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  flipWinding(b);
  return b;
}

/** Pleated lamp shade, open both ends, double sided. */
export function pleatShade(rb, rt, h, pleats = 24, depth = 0.035) {
  const g = new THREE.CylinderGeometry(rt, rb, h, pleats * 2, 1, true);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const a = Math.atan2(x, z); const k = Math.round(a / (Math.PI / pleats));
    const s = 1 + depth * (k % 2 === 0 ? 1 : -1);
    p.setX(i, x * s); p.setZ(i, z * s);
  }
  g.computeVertexNormals();
  scaleUV(g, rb * TAU, h);
  return doubleSided(g, 0.985);
}

/** Two-sided leaf blade along +Z (length len, width wid), slightly folded and drooping. */
export function leafGeom(len, wid, droop = 0.25, fold = 0.25) {
  const P = (x, y, z) => [x, y, z];
  const dz = (t) => -droop * len * t * t;
  const B = P(0, 0, 0), M1 = P(0, dz(0.35), 0.35 * len), M2 = P(0, dz(0.7), 0.7 * len), T = P(0, dz(1), len);
  const L1 = P(-wid / 2, dz(0.35) - fold * wid / 2, 0.38 * len), R1 = P(wid / 2, dz(0.35) - fold * wid / 2, 0.38 * len);
  const L2 = P(-wid * 0.36, dz(0.72) - fold * wid * 0.36, 0.72 * len), R2 = P(wid * 0.36, dz(0.72) - fold * wid * 0.36, 0.72 * len);
  const tri = [[B, M1, L1], [B, R1, M1], [M1, L2, L1], [M1, M2, L2], [M1, R2, M2], [M1, R1, R2], [M2, T, L2], [M2, R2, T]];
  const pos = [], uv = [];
  for (const t of tri) for (const v of t) { pos.push(...v); uv.push(v[0] / wid + 0.5, v[2] / len); }
  for (const t of tri) for (const v of [t[0], t[2], t[1]]) { pos.push(v[0], v[1] - 0.0008, v[2]); uv.push(v[0] / wid + 0.5, v[2] / len); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/**
 * Loft along a superellipse ring (tubs, oval basins). profile: [[offset, y], ...] where the ring's
 * half-axes are (a0 + offset, b0 + offset). Listed so that normals face outward for a bottom→top outer wall.
 */
export function superLoft(profile, a0, b0, n = 2.6, N = 48) {
  const pos = [], uv = [], idx = [];
  const cols = N + 1;
  let vAcc = 0;
  for (let j = 0; j < profile.length; j++) {
    const [o, y] = profile[j];
    if (j > 0) vAcc += Math.hypot(o - profile[j - 1][0], y - profile[j - 1][1]);
    const a = Math.max(a0 + o, 1e-4), b = Math.max(b0 + o, 1e-4);
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * TAU; const c = Math.cos(t), s = Math.sin(t);
      const x = a * Math.sign(c) * Math.abs(c) ** (2 / n), z = b * Math.sign(s) * Math.abs(s) ** (2 / n);
      pos.push(x, y, z); uv.push((i / N) * 2 * (a0 + b0) * 1.6, vAcc);
    }
  }
  for (let j = 0; j < profile.length - 1; j++) for (let i = 0; i < N; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  for (let j = 0; j < profile.length; j++) {
    const a = j * cols, b = a + N;
    const x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    nrm.setXYZ(a, x / l, y / l, z / l); nrm.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}

// ---------------------------------------------------------------- shared parts

/** Classic turned leg profile, height h, max radius r (bottom→top). */
export function turnedLegPts(h, r) {
  const P = [[0, 0], [0.62, 0.0], [0.78, 0.025], [0.66, 0.05], [0.56, 0.09], [0.74, 0.15], [0.84, 0.21],
    [0.74, 0.27], [0.52, 0.34], [0.44, 0.48], [0.47, 0.6], [0.6, 0.68], [0.8, 0.74], [0.62, 0.79], [0.72, 0.84],
    [0.9, 0.87], [0.95, 0.9], [0, 0.9]];
  return P.map(([rr, t]) => [rr * r, t * h]);
}
/** Turned leg with a square top block (for aprons). blockH fraction of the leg at the top. */
export function turnedLeg(k, x, z, h, r, name, seg = 12, block = 0.1) {
  const lh = h * (1 - block);
  k.add(lathe(turnedLegPts(lh / 0.9, r), seg), name, x, 0, z);
  if (block > 0) k.box(r * 1.9, h - lh + 0.005, r * 1.9, name, x, lh - 0.005, z, 0.001, 1);
}
/** Short bun foot. */
export function bunFoot(k, x, z, h, r, name, seg = 12) {
  k.add(lathe([[0, 0], [r * 0.6, 0], [r * 0.95, h * 0.3], [r, h * 0.5], [r * 0.85, h * 0.75], [r * 0.6, h * 0.85], [r * 0.7, h], [0, h]], seg), name, x, 0, z);
}
/** Tapered square leg. */
export function taperLeg(k, x, z, h, wb, wt, name, ry = 0) {
  k.add(taperBox(wb, wb, h, wt, wt), name, x, h / 2, z, Math.PI, ry, 0);
}
/** Knob facing +Z at (x,y,z) (z = door front face). */
export function knob(k, x, y, z, name = 'brass', s = 1) {
  k.add(lathe([[0, 0], [0.007, 0], [0.0045, 0.012], [0.011, 0.02], [0.0135, 0.027], [0.009, 0.033], [0, 0.034]].map(([r, h]) => [r * s, h * s]), 8),
    name, x, y, z, Math.PI / 2, 0, 0);
}
/** Bar pull facing +Z. */
export function barPull(k, x, y, z, len, name = 'brass', vertical = false) {
  const off = 0.028, r = 0.006;
  if (vertical) {
    k.rod([x, y - len / 2, z + off], [x, y + len / 2, z + off], r, name, 8);
    k.rod([x, y - len / 2 + 0.02, z], [x, y - len / 2 + 0.02, z + off], 0.0045, name, 6);
    k.rod([x, y + len / 2 - 0.02, z], [x, y + len / 2 - 0.02, z + off], 0.0045, name, 6);
  } else {
    k.rod([x - len / 2, y, z + off], [x + len / 2, y, z + off], r, name, 8);
    k.rod([x - len / 2 + 0.02, y, z], [x - len / 2 + 0.02, y, z + off], 0.0045, name, 6);
    k.rod([x + len / 2 - 0.02, y, z], [x + len / 2 - 0.02, y, z + off], 0.0045, name, 6);
  }
}
/** Cup (bin) pull for drawers, facing +Z. */
export function cupPull(k, x, y, z, name = 'brass') {
  k.add(cyl(0.022, 0.022, 0.012, 12, true, Math.PI, Math.PI), name, x, y, z + 0.012, Math.PI / 2, 0, 0, 1, 1, 1);
  k.add(rbox(0.06, 0.012, 0.004, 0.0015), name, x, y + 0.012, z + 0.002);
}
/** Shaker / raised-panel door or drawer front: back face at z, centred at (x, y). */
export function shakerDoor(k, x, y, z, w, h, name, t = 0.02, stile = 0.065) {
  stile = Math.min(stile, w * 0.3, h * 0.3);
  k.add(frameGeom(w, h, stile, t, 0.003), name, x, y, z);
  k.add(rbox(w - 2 * stile + 0.01, h - 2 * stile + 0.01, t * 0.55, 0.004, 1), name, x, y, z + t * 0.3);
}
/** Slab drawer front with a small bevel. */
export function slabFront(k, x, y, z, w, h, name, t = 0.02) {
  k.add(rbox(w, h, t, 0.004, 1), name, x, y, z + t / 2);
}

/** Row of books between x0..x1 standing on y, spines at z (facing +Z). Returns used width. */
export function booksRow(k, x0, x1, y, z, maxD, rand, opt = {}) {
  const hMin = opt.hMin ?? 0.17, hMax = opt.hMax ?? 0.29, name = opt.name || 'books';
  let x = x0; let leaned = false;
  while (x < x1 - 0.02) {
    const t = 0.018 + rand() * 0.032;
    if (x + t > x1) break;
    const h = hMin + rand() * (hMax - hMin);
    const d = Math.min(maxD, 0.14 + rand() * 0.09);
    const g = new THREE.BoxGeometry(t, h, d);
    const uv = g.attributes.uv; const ou = rand() * 20, ov = rand() * 3;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * t + ou, uv.getY(i) * h + ov);
    if (!leaned && opt.lean !== false && x > x0 + 0.15 && x1 - x > 0.25 && rand() < 0.08) {
      const ang = 0.35; leaned = true;
      k.add(g, name, x + Math.sin(ang) * h / 2 + t / 2, y + Math.cos(ang) * h / 2 + t * Math.sin(ang) / 2, z - d / 2, 0, 0, -ang);
      x += Math.sin(ang) * h + t + 0.01;
      continue;
    }
    k.add(g, name, x + t / 2, y + h / 2, z - d / 2);
    x += t + (rand() < 0.15 ? 0.004 : 0.0005);
  }
  return x - x0;
}
/** Horizontal stack of books lying flat, centred at (x, y, z). */
export function bookStack(k, x, y, z, n, rand, name = 'books') {
  let yy = y;
  for (let i = 0; i < n; i++) {
    const w = 0.2 + rand() * 0.08, d = 0.14 + rand() * 0.06, t = 0.025 + rand() * 0.025;
    const g = new THREE.BoxGeometry(w, t, d);
    scaleUV(g, w, t, rand() * 20, rand() * 3);
    k.add(g, name, x + (rand() - 0.5) * 0.02, yy + t / 2, z + (rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.3, 0);
    yy += t;
  }
  return yy;
}
const VASES = [
  [[0, 0], [0.55, 0], [0.75, 0.08], [0.95, 0.3], [0.9, 0.55], [0.55, 0.75], [0.35, 0.85], [0.4, 0.97], [0.44, 1], [0.36, 1], [0.3, 0.9], [0.2, 0.86]],
  [[0, 0], [0.45, 0], [0.62, 0.15], [0.66, 0.5], [0.6, 0.85], [0.66, 1], [0.58, 1], [0.5, 0.88], [0.3, 0.86]],
  [[0, 0], [0.6, 0], [0.9, 0.12], [1.0, 0.3], [0.95, 0.45], [0.6, 0.55], [0.45, 0.6], [0.48, 0.66], [0.4, 0.64], [0.25, 0.6]],
];
/** Turned vase, height h, max radius r. */
export function vase(k, x, y, z, h, r, name = 'porcelain', variant = 0) {
  const prof = VASES[variant % VASES.length];
  k.add(lathe(prof.map(([rr, t]) => [rr * r, t * h]), 18), name, x, y, z);
  return y + h * prof[prof.length - 1][1];
}
/** Cluster of leaves fanned around a point (a small potted plant's foliage). */
export function foliage(k, x, y, z, count, size, rand, name = 'plantLeaf', spread = 1, up = 0.8) {
  const leaf = leafGeom(size, size * 0.42, 0.35, 0.3);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + rand() * 0.6;
    const tilt = -(up * 0.9 + rand() * 0.5) + (1 - spread) * 0.4;
    const s = 0.7 + rand() * 0.5;
    k.add(leaf, i % 3 === 2 && name === 'plantLeaf' ? 'plantLeafDark' : name, x, y + rand() * size * 0.25, z, tilt, a, 0, s, s, s);
  }
}
/** Small potted plant (pot height ph). */
export function smallPlant(k, x, y, z, ph, rand, pot = 'terracottaPot') {
  const r = ph * 0.55;
  k.add(lathe([[0, 0], [r * 0.75, 0], [r * 0.95, ph * 0.85], [r * 1.05, ph * 0.88], [r * 1.05, ph], [r * 0.92, ph], [r * 0.88, ph * 0.9], [0, ph * 0.9]], 14), pot, x, y, z);
  foliage(k, x, y + ph * 0.88, z, 9, ph * 1.4, rand);
}
/** Pillar candle with an optional flame. */
export function candle(k, x, y, z, h = 0.1, r = 0.035, lit = true, name = 'porcelain') {
  k.add(lathe([[0, 0], [r, 0], [r, h - 0.006], [r * 0.85, h], [0.003, h - 0.003], [0, h - 0.002]], 14), name, x, y, z);
  k.rod([x, y + h - 0.004, z], [x, y + h + 0.008, z], 0.0012, 'ironBlack', 4);
  if (lit) flame(k, x, y + h + 0.008, z, 0.6);
}
/** Teardrop flame / candle-tip bulb at (x, y, z) base. */
export function flame(k, x, y, z, s = 1, name = 'candleFlame') {
  k.add(lathe([[0, 0], [0.006, 0.004], [0.008, 0.012], [0.005, 0.024], [0, 0.034]].map(([r, h]) => [r * s, h * s]), 8), name, x, y, z);
}
export function candleBulb(k, x, y, z, s = 1) {
  k.add(lathe([[0, 0], [0.009, 0.002], [0.014, 0.02], [0.012, 0.034], [0.006, 0.048], [0, 0.056]].map(([r, h]) => [r * s, h * s]), 10), 'bulbWarm', x, y, z);
}

export function seedOf(type, params) { return params.seed ?? hash(type + (params.w ?? '') + (params.d ?? '')); }
export { rng, hash };

// ---------------------------------------------------------------- decor builders

function rug(params = {}, mat) {
  const w = params.w ?? 2.4, d = params.d ?? 1.7, h = 0.01;
  const name = params.mat || 'rugPersianRed';
  const k = new Kit(mat); const rand = rng(seedOf('rug', params));
  if (params.round) {
    const g = new THREE.CylinderGeometry(w / 2, w / 2, h, 64, 1);
    const uv = g.attributes.uv; const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, 0.5 - p.getZ(i) / w);
    k.add(g, name, 0, h / 2, 0);
  } else {
    const g = new RoundedBoxGeometry(w, h, d, 1, 0.004);
    const uv = g.attributes.uv; const p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, 0.5 - p.getZ(i) / d);
    k.add(g, name, 0, h / 2, 0);
    const fringe = params.fringe ?? /Persian/.test(name);
    if (fringe) {
      // Fringe on the short ends (along the shorter dimension's edges).
      const alongX = w <= d; const len = alongX ? w : d;
      const n = Math.floor(len / 0.012);
      const pos = [], uvs = [];
      for (const side of [-1, 1]) for (let i = 0; i < n; i++) {
        const u = -len / 2 + (i + 0.5) * (len / n);
        const l = 0.045 + rand() * 0.025, sw = 0.0035, wob = (rand() - 0.5) * 0.012;
        const e = (alongX ? d : w) / 2;
        const quad = [[u - sw, 0, e], [u + sw, 0, e], [u + sw + wob, 0, e + l], [u - sw + wob, 0, e + l]];
        const P = quad.map(([a, , c]) => {
          const pz = side * c, y = 0.0025;
          return alongX ? [a, y, pz] : [pz, y, a];
        });
        const order = (alongX ? side > 0 : side < 0) ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        for (const o of order) { pos.push(...P[o]); uvs.push(o === 1 || o === 2 ? 0.01 : 0, o >= 2 ? 0.05 : 0); }
      }
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      fg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      fg.computeVertexNormals();
      k.add(fg, params.fringeMat || 'linenCream');
    }
  }
  return k.build('rug', { w, d: params.round ? w : d, h, solid: false });
}

function plantPot(params = {}, mat) {
  const size = params.size || 'large';
  const S = { small: [0.3, 0.45], medium: [0.4, 0.9], large: [0.5, 1.4] }[size] || [0.5, 1.4];
  const w = params.w ?? S[0], h = params.h ?? S[1];
  const k = new Kit(mat); const rand = rng(seedOf('plantPot' + size, params));
  const pot = params.pot || (size === 'large' ? 'terracottaPot' : 'porcelain');
  const pr = w * 0.42, ph = size === 'small' ? h * 0.38 : size === 'medium' ? h * 0.33 : 0.42;
  // Pot (lathe): foot, belly, rolled lip, inner wall, soil.
  k.add(lathe([[0, 0], [pr * 0.72, 0], [pr * 0.78, 0.02], [pr * 0.9, ph * 0.35], [pr * 1.0, ph * 0.8], [pr * 1.0, ph * 0.9],
    [pr * 1.06, ph * 0.92], [pr * 1.06, ph], [pr * 0.94, ph], [pr * 0.92, ph * 0.9], [pr * 0.85, ph * 0.5]], 28), pot, 0, 0, 0);
  k.add(cyl(pr * 0.92, pr * 0.92, 0.01, 20), 'plantLeafDark', 0, ph * 0.86, 0);
  const top = ph * 0.87;
  if (size === 'large') {
    // Small olive-like tree: trunk with branches, leaves at branch ends.
    const trunkH = h * 0.62;
    k.add(tube([[0, top, 0], [0.02, top + trunkH * 0.4, 0.01], [-0.015, top + trunkH * 0.75, 0], [0.01, top + trunkH, -0.01]], 0.022, 16, 7), 'walnut');
    const leaf = leafGeom(0.11, 0.035, 0.2, 0.3);
    const nb = 7;
    for (let b = 0; b < nb; b++) {
      const a = (b / nb) * TAU + rand() * 0.5;
      const y0 = top + trunkH * (0.45 + 0.55 * b / nb);
      const L = 0.12 + rand() * 0.1;
      const end = [Math.cos(a) * L, y0 + 0.12 + rand() * 0.2, Math.sin(a) * L];
      k.add(tube([[0, y0, 0], [end[0] * 0.5, y0 + 0.08, end[2] * 0.5], end], 0.008, 6, 5), 'walnut');
      for (let i = 0; i < 26; i++) {
        const t = 0.25 + rand() * 0.75;
        const px = end[0] * t + (rand() - 0.5) * 0.2, py = y0 + 0.05 + (end[1] - y0) * t + (rand() - 0.3) * 0.25, pz = end[2] * t + (rand() - 0.5) * 0.2;
        const s = 0.8 + rand() * 0.5;
        k.add(leaf, rand() < 0.35 ? 'plantLeafDark' : 'plantLeaf', px, Math.min(py, h - 0.05), pz, -0.4 - rand() * 0.9, rand() * TAU, (rand() - 0.5) * 0.8, s, s, s);
      }
    }
  } else {
    // Fern / leafy bush: many arching fronds.
    const n = size === 'small' ? 14 : 22;
    const fl = (h - top) * (size === 'small' ? 1.05 : 0.8);
    const leaf = leafGeom(fl, fl * 0.26, 0.3, 0.25);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand() * 0.4;
      const tilt = (size === 'small' ? -1.25 : -1.4) + rand() * 0.4 - (i % 3) * 0.1;
      const s = 0.75 + rand() * 0.4;
      k.add(leaf, i % 3 === 0 ? 'plantLeafDark' : 'plantLeaf', 0, top + 0.01, 0, tilt, a, 0, s, s, s);
    }
  }
  return k.build('plantPot', { w, d: w, h, solid: size !== 'small' }, { size });
}

function wallArt(params = {}, mat) {
  const w = params.w ?? 1.0, h = params.h ?? 0.75, d = 0.04;
  const cy = params.y ?? 1.6;
  const k = new Kit(mat);
  const frameMat = params.frame === 'dark' ? 'walnut' : params.frame && params.frame !== 'gilded' ? params.frame : 'brassAged';
  const fb = Math.min(w, h) * 0.07;
  // Moulded frame: wide flat + raised inner bead.
  k.add(frameGeom(w, h, fb, 0.03, 0.006, 2), frameMat, 0, cy, 0);
  k.add(frameGeom(w - fb * 1.2, h - fb * 1.2, fb * 0.25, 0.04, 0.005, 2), frameMat, 0, cy, 0);
  const iw = w - 2 * fb, ih = h - 2 * fb;
  let cw = iw, ch = ih;
  if (params.matBoard ?? params.frame !== 'dark') {
    k.add(rbox(iw + 0.004, ih + 0.004, 0.006, 0), 'linenWhite', 0, cy, 0.016);
    cw = iw * 0.78; ch = ih * 0.76;
    k.add(frameGeom(cw + 0.012, ch + 0.012, 0.006, 0.004, 0), frameMat, 0, cy, 0.019);
  }
  const g = new THREE.PlaneGeometry(cw, ch);
  k.add(g, params.art || 'canvasArt1', 0, cy, cw === iw ? 0.02 : 0.0195);
  k.add(rbox(w - 0.02, h - 0.02, 0.012, 0), 'walnut', 0, cy, 0.007);
  if (params.light) {
    const ly = cy + h / 2 + 0.06;
    k.rod([0, ly, 0], [0, ly + 0.02, 0.12], 0.006, 'brass', 8);
    k.add(cyl(0.022, 0.022, w * 0.6, 16), 'brass', 0, ly + 0.02, 0.14, 0, 0, Math.PI / 2);
    k.add(rbox(w * 0.58, 0.004, 0.02, 0), 'bulbWarm', 0, ly + 0.002, 0.14);
    k.light(0, ly - 0.05, 0.25, { intensity: 1.5, distance: 2.5, kind: 'spot' });
  }
  return k.build('wallArt', { w, d, h, solid: false, mount: 'wall' });
}

function mirror(params = {}, mat) {
  const w = params.w ?? 0.9, h = params.h ?? 1.2, d = 0.06;
  const cy = params.y ?? 1.5;
  const k = new Kit(mat); const fm = params.frame || 'brassAged';
  const fb = 0.075;
  // Arched-top ornate frame: extruded arch shape with an arched hole, plus beaded inner lip and crest.
  const arch = (W, H, r) => {
    const s = new THREE.Shape(); s.moveTo(-W / 2, -H / 2); s.lineTo(W / 2, -H / 2); s.lineTo(W / 2, H / 2 - r);
    s.absarc(0, H / 2 - r, W / 2, 0, Math.PI, false); s.lineTo(-W / 2, -H / 2); return s;
  };
  const archHole = (W, H, r) => {
    const p = new THREE.Path(); p.moveTo(-W / 2, -H / 2); p.lineTo(-W / 2, H / 2 - r);
    p.absarc(0, H / 2 - r, W / 2, Math.PI, 0, true); p.lineTo(W / 2, -H / 2); p.lineTo(-W / 2, -H / 2); return p;
  };
  const outer = arch(w, h - 0.12, w / 2); outer.holes.push(archHole(w - 2 * fb, h - 0.12 - 2 * fb, w / 2 - fb));
  const g = new THREE.ExtrudeGeometry(outer, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 3, curveSegments: 32 });
  k.add(g, fm, 0, cy - 0.06, 0.012);
  const lip = arch(w - 2 * fb + 0.02, h - 0.12 - 2 * fb + 0.02, w / 2 - fb + 0.01); lip.holes.push(archHole(w - 2 * fb - 0.01, h - 0.12 - 2 * fb - 0.01, w / 2 - fb - 0.005));
  k.add(new THREE.ExtrudeGeometry(lip, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 2, curveSegments: 32 }), fm, 0, cy - 0.06, 0.012);
  // Glass
  const glass = arch(w - 2 * fb + 0.01, h - 0.12 - 2 * fb + 0.01, w / 2 - fb + 0.005);
  const gg = new THREE.ShapeGeometry(glass, 32);
  k.add(gg, 'mirror', 0, cy - 0.06, 0.02);
  k.add(new THREE.ShapeGeometry(arch(w - 0.01, h - 0.13, w / 2 - 0.005), 24), 'walnut', 0, cy - 0.06, 0.004);
  // Crest: scrolled cartouche on top.
  const top = cy - 0.06 + (h - 0.12) / 2;
  const crest = new THREE.Shape();
  crest.moveTo(-0.16, 0); crest.bezierCurveTo(-0.12, 0.05, -0.06, 0.02, -0.05, 0.08);
  crest.bezierCurveTo(-0.04, 0.12, 0, 0.13, 0, 0.15); crest.bezierCurveTo(0, 0.13, 0.04, 0.12, 0.05, 0.08);
  crest.bezierCurveTo(0.06, 0.02, 0.12, 0.05, 0.16, 0); crest.lineTo(-0.16, 0);
  k.add(new THREE.ExtrudeGeometry(crest, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2, curveSegments: 8 }), fm, 0, top - 0.035, 0.012);
  k.add(sphere(0.022, 12, 8), fm, 0, top + 0.115, 0.03);
  // Beads along the bottom rail.
  for (let i = -3; i <= 3; i++) k.add(sphere(0.008, 8, 6), fm, i * (w - 2 * fb) / 7, cy - 0.06 - (h - 0.12) / 2 + fb * 0.5, 0.04);
  // Foot drop.
  k.add(lathe([[0, 0], [0.018, 0.01], [0.012, 0.03], [0.02, 0.05], [0, 0.06]], 12), fm, 0, cy - 0.06 - (h - 0.12) / 2 - 0.05, 0.03);
  return k.build('mirror', { w, d, h, solid: false, mount: 'wall' });
}

export const DECOR = { rug, plantPot, wallArt, mirror };
export const INFO = {
  rug: { w: 2.4, d: 1.7, h: 0.01, mount: 'floor', solid: false },
  plantPot: { w: 0.5, d: 0.5, h: 1.4, mount: 'floor', solid: true },
  wallArt: { w: 1.0, d: 0.04, h: 0.75, mount: 'wall', solid: false },
  mirror: { w: 0.9, d: 0.04, h: 1.2, mount: 'wall', solid: false },
};
