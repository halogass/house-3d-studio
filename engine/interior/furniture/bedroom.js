// Furniture: bedroom (bed, nightstand, dresser, wardrobe, closetSystem, benchTufted, vanityTable).
// Also hosts the small procedural "Kit" shared by the furniture modules (study, entertainment, gym, work,
// kids, utility import it from here).
//
// Local frame (docs/SCHEMA.md "Furniture"): origin on the floor at the footprint centre,
// +X width, +Y up, +Z FRONT. Wall items: back face at z = 0, extending to +Z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, hash } from '../../geom.js';

// ───────────────────────────── Kit ─────────────────────────────

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const KEEP = new Set(['position', 'normal', 'uv']);
const EMISSIVE = new Set(['screenOn', 'bulbWarm', 'coveLight', 'candleFlame', 'lampShade', 'paperShade']);

export function mat4(o = {}) {
  _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ');
  _q.setFromEuler(_e);
  const s = o.s || 1;
  return new THREE.Matrix4().compose(_p.set(o.x || 0, o.y || 0, o.z || 0), _q,
    _s.set((o.sx ?? 1) * s, (o.sy ?? 1) * s, (o.sz ?? 1) * s));
}

function clean(g) {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (!KEEP.has(k)) out.deleteAttribute(k);
  out.clearGroups();
  out.morphAttributes = {};
  return out;
}

// Metre box-projection UVs per triangle (wood grain / fabric repeat in metres).
function boxUV(g) {
  const p = g.attributes.position.array, uv = g.attributes.uv.array;
  for (let t = 0; t < p.length / 9; t++) {
    const i = t * 9;
    const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2];
    const bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
    const nx = Math.abs(ay * bz - az * by), ny = Math.abs(az * bx - ax * bz), nz = Math.abs(ax * by - ay * bx);
    for (let c = 0; c < 3; c++) {
      const j = i + c * 3, u = (t * 3 + c) * 2;
      if (nx >= ny && nx >= nz) { uv[u] = p[j + 2]; uv[u + 1] = p[j + 1]; }
      else if (ny >= nz) { uv[u] = p[j]; uv[u + 1] = p[j + 2]; }
      else { uv[u] = p[j]; uv[u + 1] = p[j + 1]; }
    }
  }
  g.attributes.uv.needsUpdate = true;
}

export class Kit {
  constructor(mat) { this.mat = mat; this.parts = new Map(); this.lights = []; this.M = null; this._st = []; }

  // Parent transform for everything added until pop().
  push(o) { const m = o.isMatrix4 ? o : mat4(o); this._st.push(this.M); this.M = this.M ? this.M.clone().multiply(m) : m; return this; }
  pop() { this.M = this._st.pop(); return this; }

  add(m, g, o = {}, uv = null) {
    if (o.isMatrix4) g.applyMatrix4(o); else if (Object.keys(o).length) g.applyMatrix4(mat4(o));
    if (this.M) g.applyMatrix4(this.M);
    g = clean(g);
    if (uv === 'box') boxUV(g);
    let list = this.parts.get(m);
    if (!list) this.parts.set(m, list = []);
    list.push(g);
    return g;
  }
  box(m, w, h, d, o = {}) {
    const r = Math.min(o.r || 0, Math.min(w, h, d) / 2 - 1e-4);
    const g = r > 1e-4 ? new RoundedBoxGeometry(w, h, d, o.seg || 1, r) : new THREE.BoxGeometry(w, h, d);
    return this.add(m, g, pick(o), o.uv === false ? null : 'box');
  }
  // Box by bounds.
  bb(m, x0, y0, z0, x1, y1, z1, o = {}) {
    return this.box(m, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0),
      { ...o, x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 });
  }
  // Cylinder centred at o.{x,y,z} (axis Y before rotation).
  cyl(m, rt, rb, h, o = {}) {
    return this.add(m, new THREE.CylinderGeometry(rt, rb, h, o.seg || 12, 1, !!o.open), pick(o));
  }
  sph(m, r, o = {}) {
    return this.add(m, new THREE.SphereGeometry(r, o.ws || 10, o.hs || 7, 0, Math.PI * 2, 0, o.theta || Math.PI), pick(o));
  }
  // Lathe from [[radius, y], ...] (y from the base at o.y).
  lathe(m, pts, o = {}) {
    return this.add(m, new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(p[0], 0), p[1])), o.seg || 12), pick(o));
  }
  // Extrude a shape (XY) along Z, centred on z = 0 before the transform.
  ext(m, shape, depth, o = {}) {
    const b = o.bevel || 0;
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: o.bevelSize ?? b, bevelOffset: o.bevelOffset ?? 0,
      bevelSegments: o.bs || 2, curveSegments: o.cs || 8, steps: 1,
    });
    g.translate(0, 0, -depth / 2);
    return this.add(m, g, pick(o), o.uv || null);
  }
  tube(m, pts, r, o = {}) {
    const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), !!o.closed, 'catmullrom', o.tension ?? 0.5);
    return this.add(m, new THREE.TubeGeometry(c, o.ts || 12, r, o.rs || 6, !!o.closed), pick(o));
  }
  torus(m, R, r, o = {}) {
    return this.add(m, new THREE.TorusGeometry(R, r, o.rs || 6, o.ts || 16, o.arc || Math.PI * 2), pick(o));
  }
  // Straight round bar between two points.
  bar(m, a, b, r, o = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const g = new THREE.CylinderGeometry(o.r2 ?? r, r, len, o.seg || 8, 1, !!o.open);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1)));
    return this.add(m, g);
  }
  // Square-section bar between two points (steel tube, stile).
  sbar(m, a, b, t, o = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const r = Math.min(o.r || 0, t / 2 - 1e-4, (o.t2 ?? t) / 2 - 1e-4);
    const g = r > 1e-4 ? new RoundedBoxGeometry(t, len, o.t2 ?? t, 1, r) : new THREE.BoxGeometry(t, len, o.t2 ?? t);
    g.translate(0, len / 2, 0);
    if (o.roll) g.rotateY(o.roll);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1)));
    return this.add(m, g, {}, 'box');
  }
  light(pos, o = {}) {
    const v = new THREE.Vector3(...pos);
    if (this.M) v.applyMatrix4(this.M);
    this.lights.push({ pos: [v.x, v.y, v.z], color: o.color || '#ffd8a8', intensity: o.intensity ?? 4, distance: o.distance ?? 4, kind: o.kind || 'lamp' });
  }
  build(type, w, d, h, solid = true, extra = {}) {
    const grp = new THREE.Group();
    grp.name = type;
    for (const [name, list] of this.parts) {
      const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, this.mat(name));
      mesh.name = name;
      mesh.castShadow = !EMISSIVE.has(name) && !name.startsWith('glass');
      mesh.receiveShadow = true;
      grp.add(mesh);
    }
    grp.userData = { type, w, d, h, solid, lights: this.lights, ...extra };
    return grp;
  }
}

function pick(o) {
  const r = {};
  for (const k of ['x', 'y', 'z', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz', 's', 'order']) if (o[k] !== undefined) r[k] = o[k];
  return r;
}

export function seeded(type, p) { return rng((hash(type) + (p.seed | 0) * 7919) % 2147483646 + 1); }

// ───────────────────────────── shared parts ─────────────────────────────

// Turned profiles: [radius fraction, height fraction].
export const PROFILE = {
  post: [[0, 0], [0.82, 0], [0.9, 0.02], [0.75, 0.045], [0.72, 0.24], [0.95, 0.27], [1, 0.3], [0.72, 0.33], [0.5, 0.4],
    [0.58, 0.62], [0.8, 0.66], [0.62, 0.7], [0.48, 0.8], [0.8, 0.86], [0.88, 0.9], [0.62, 0.95], [0.3, 0.985], [0, 1]],
  footPost: [[0, 0], [0.82, 0], [0.9, 0.03], [0.75, 0.07], [0.72, 0.4], [0.95, 0.45], [1, 0.5], [0.7, 0.56], [0.55, 0.66],
    [0.85, 0.76], [0.95, 0.84], [0.6, 0.92], [0.35, 0.97], [0, 1]],
  leg: [[0, 0], [0.55, 0], [0.62, 0.04], [0.5, 0.08], [0.42, 0.35], [0.62, 0.5], [0.7, 0.55], [0.55, 0.62], [0.8, 0.7], [1, 0.76], [1, 1], [0, 1]],
  taper: [[0, 0], [0.6, 0], [0.7, 0.03], [0.62, 0.06], [0.75, 0.6], [0.95, 0.66], [1, 0.72], [1, 1], [0, 1]],
  bun: [[0, 0], [0.62, 0], [0.92, 0.22], [1, 0.48], [0.88, 0.75], [0.62, 0.92], [0.66, 1], [0, 1]],
  knob: [[0, 0], [0.45, 0], [0.4, 0.25], [0.8, 0.45], [1, 0.7], [0.75, 0.95], [0, 1]],
};

export function turned(k, m, x, y, z, h, R, profile = PROFILE.leg, seg = 10) {
  return k.lathe(m, profile.map(([r, t]) => [r * R, t * h]), { x, y, z, seg });
}

// Brass knob facing +Z, base at z.
export function knob(k, x, y, z, r = 0.014, m = 'brass') {
  return k.lathe(m, PROFILE.knob.map(([a, t]) => [a * r, t * r * 1.8]), { x, y, z, rx: Math.PI / 2, seg: 6 });
}

// Bail pull (back plate + half-ring handle), facing +Z.
export function bail(k, x, y, z, w = 0.09, m = 'brass') {
  k.box(m, w * 1.15, w * 0.32, 0.004, { x, y, z: z + 0.002 });
  k.torus(m, w * 0.42, 0.0045, { x, y: y + 0.004, z: z + 0.01, rx: -0.35, rz: Math.PI, arc: Math.PI, rs: 3, ts: 6 });
}

// Raised-panel door / drawer front: front face of the frame at z (frame occupies z-t..z).
export function panelFront(k, m, x, y, z, w, h, o = {}) {
  const t = o.t || 0.02, inset = o.inset ?? Math.min(0.045, w * 0.14, h * 0.2);
  k.box(m, w, h, t, { x, y, z: z - t / 2, r: o.r ?? 0 });
  if (w > 0.1 && h > 0.08 && inset > 0.012) k.box(m, w - 2 * inset, h - 2 * inset, 0.016, { x, y, z: z - 0.004, r: 0.006 });
}

// Shape with straight bottom and a sampled top curve topFn(x).
export function topShape(x0, x1, y0, topFn, n = 16) {
  const s = new THREE.Shape();
  s.moveTo(x0, y0); s.lineTo(x1, y0);
  for (let i = 0; i <= n; i++) { const x = x1 - (x1 - x0) * i / n; s.lineTo(x, topFn(x)); }
  s.closePath();
  return s;
}
export function topPath(x0, x1, y0, topFn, n = 16) {
  const s = new THREE.Path();
  s.moveTo(x0, y0);
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; s.lineTo(x, topFn(x)); }
  s.lineTo(x1, y0);
  s.closePath();
  return s;
}
// Camel-back / arched top: shoulder height yS at the ends, crest yC in the middle.
export function archFn(x0, x1, yS, yC, pow = 1.4) {
  const c = (x0 + x1) / 2, hw = (x1 - x0) / 2;
  return x => yS + (yC - yS) * Math.pow(Math.max(0, Math.cos(Math.PI / 2 * (x - c) / hw)), pow);
}
export function rectShape(x0, y0, x1, y1) {
  const s = new THREE.Shape();
  s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath();
  return s;
}
export function ellipseShape(rx, ry, n = 32, hole = false) {
  const s = hole ? new THREE.Path() : new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const a = (hole ? -1 : 1) * i / n * Math.PI * 2;
    if (i === 0) s.moveTo(rx * Math.cos(a), ry * Math.sin(a)); else s.lineTo(rx * Math.cos(a), ry * Math.sin(a));
  }
  return s;
}

// Carved shell / fan crest, bottom-centre at origin, in XY.
export function shellShape(r, lobes = 9) {
  const s = new THREE.Shape();
  s.moveTo(-r * 0.35, 0);
  const n = lobes * 2;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * i / n, rr = r * (i % 2 ? 1 : 0.84);
    s.lineTo(-Math.cos(a) * rr, Math.sin(a) * rr * 0.75 + r * 0.12);
  }
  s.lineTo(r * 0.35, 0);
  s.closePath();
  return s;
}

// Diamond-tufted upholstery surface (in XY, puffing towards +Z) with buttons.
// o: cols, rows, depth, edge, top(x) clamp, btn material, transform (x,y,z,rx,ry,rz).
export function tuftPanel(k, m, w, h, o = {}) {
  const cols = o.cols || 4, rows = o.rows || 2, pd = o.depth ?? 0.035, edge = o.edge ?? 0.05;
  const g = new THREE.PlaneGeometry(w, h, Math.round(cols * (o.res || 4)), Math.round(rows * (o.res || 4)));
  const P = g.attributes.position;
  const top = o.top || null;
  const remap = (x, y) => top ? -h / 2 + (y + h / 2) * (top(x) + h / 2) / h : y;
  const puff = (x, y) => {
    const u = (x + w / 2) / (w / cols), v = (y + h / 2) / (h / rows);
    const f = Math.abs(Math.sin(Math.PI * (u + v) / 2) * Math.sin(Math.PI * (u - v) / 2));
    const yy = remap(x, y), ty = top ? top(x) : h / 2;
    const dEdge = Math.min(x + w / 2, w / 2 - x, yy + h / 2, ty - yy);
    const ef = smooth(Math.min(1, Math.max(0, dEdge / edge)));
    return pd * (0.3 + 0.7 * Math.pow(f, 0.6)) * ef;
  };
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i);
    P.setXYZ(i, x, remap(x, y), puff(x, y));
  }
  g.computeVertexNormals();
  const M = mat4(o);
  k.add(m, g, M);
  const btn = o.btn || m, br = o.btnR || 0.011;
  for (let u = 1; u < cols; u++) for (let v = 1; v < rows * 1; v++) {
    if ((u + v) % 2) continue;
    const x = -w / 2 + u * w / cols, y = -h / 2 + v * h / rows;
    const sg = new THREE.SphereGeometry(br, 5, 3);
    sg.scale(1, 1, 0.6);
    sg.translate(x, remap(x, y), puff(x, y) * 0.55 + br * 0.2);
    k.add(btn, sg, M);
  }
  // Half-row of buttons on the inner borders when rows === 1 (bench style) are handled by caller.
}
const smooth = t => t * t * (3 - 2 * t);

// Soft pillow / cushion: face in XY (w × h), thickness t along Z.
export function pillowGeo(w, h, t, o = {}) {
  const g = new THREE.SphereGeometry(1, o.ws || 11, o.hs || 8);
  const P = g.attributes.position, e = o.e ?? 0.38, pinch = o.pinch ?? 0.55;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const X = Math.sign(x) * Math.pow(Math.abs(x), e), Y = Math.sign(y) * Math.pow(Math.abs(y), e);
    const edge = Math.max(Math.abs(X), Math.abs(Y));
    P.setXYZ(i, X * w / 2, Y * h / 2, z * t / 2 * (1 - pinch * Math.pow(edge, 4)));
  }
  g.computeVertexNormals();
  return g;
}
export function pillow(k, m, w, h, t, o = {}) { return k.add(m, pillowGeo(w, h, t, o), pick(o)); }

// Draped bedding: flat top (|x| <= half, z0..z1) that rolls over the sides and (optionally) the foot.
export function drapeGeo(o) {
  const { half, z0, z1, top, r = 0.06, dropSide = 0.25, dropFoot = 0.2, footWrap = true,
    nFlat = 12, nFlatZ = 12, puff = 0.012, quilt = 0, wave = 0.01, seed = 1 } = o;
  const arc = Math.PI * r / 2;
  const side = [];
  const flatHalf = half - r;
  for (let i = 0; i <= nFlat; i++) side.push(-flatHalf + 2 * flatHalf * i / nFlat);
  const tail = [];
  for (let i = 1; i <= 4; i++) tail.push(flatHalf + arc * i / 4);
  for (let i = 1; i <= 2; i++) tail.push(flatHalf + arc + dropSide * i / 2);
  const S = [...tail.slice().reverse().map(v => -v), ...side, ...tail];
  const Tz = [];
  const zFlatEnd = footWrap ? z1 - r : z1;
  for (let i = 0; i <= nFlatZ; i++) Tz.push(z0 + (zFlatEnd - z0) * i / nFlatZ);
  if (footWrap) {
    for (let i = 1; i <= 4; i++) Tz.push(zFlatEnd + arc * i / 4);
    for (let i = 1; i <= 2; i++) Tz.push(zFlatEnd + arc + dropFoot * i / 2);
  }
  const fold = (a, start) => {
    if (a <= start) return [a, 0];
    const e = a - start;
    if (e <= arc) { const th = e / r; return [start + r * Math.sin(th), r * (1 - Math.cos(th))]; }
    return [start + r + (e - arc) * 0.06, r + (e - arc)];
  };
  const pos = [], uv = [], idx = [];
  const cell = (2 * flatHalf) / nFlat * 2, cellZ = (zFlatEnd - z0) / nFlatZ * 2;
  for (let j = 0; j < Tz.length; j++) {
    for (let i = 0; i < S.length; i++) {
      const s = S[i], t = Tz[j];
      const [ax, dx] = fold(Math.abs(s), flatHalf);
      const [z, dz] = footWrap ? fold(t, zFlatEnd) : [t, 0];
      let x = Math.sign(s) * ax;
      let y = top - Math.max(dx, dz);
      let zz = z;
      if (dx === 0 && dz === 0) {
        const u = (s + flatHalf) / cell, v = (t - z0) / cellZ;
        const f = Math.abs(Math.sin(Math.PI * (u + v)) * Math.sin(Math.PI * (u - v)));
        y += puff * (quilt ? Math.pow(f, 0.5) : 0.5 + 0.5 * Math.sin(u * 2.1 + seed) * Math.sin(v * 1.7 + seed * 0.7));
      }
      const hx = Math.min(1, dx / 0.12), hz = Math.min(1, dz / 0.12);
      x += Math.sign(s) * wave * hx * (0.6 + Math.sin(t * 10 + seed * 3.1));
      zz += wave * hz * (0.6 + Math.sin(s * 9 + seed * 1.3));
      pos.push(x, y, zz);
      uv.push(s, -t);
    }
  }
  const n = S.length;
  for (let j = 0; j < Tz.length - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Row of books standing on y between x0..x1 with spines at zFront. Returns nothing.
const LEATHER_BOUND = ['leatherOxblood', 'leatherDarkBrown'];
export function bookRow(k, R, x0, x1, y, zFront, maxH, maxD, o = {}) {
  let x = x0;
  const leather = o.leather ?? 0.12;
  while (x < x1 - 0.03) {
    const r = R();
    const room = x1 - x;
    if (r < 0.05 && room > 0.3) { x += 0.05 + R() * 0.12; continue; }
    if (r < 0.12 && room > 0.26 && maxH > 0.12) {
      // horizontal stack
      const bw = Math.min(room - 0.02, 0.18 + R() * 0.07), n = 2 + Math.floor(R() * 3);
      let yy = y;
      for (let i = 0; i < n && yy < y + maxH - 0.06; i++) {
        const t = 0.025 + R() * 0.025, dd = Math.min(maxD, 0.15 + R() * 0.07), ww = bw * (0.85 + R() * 0.15);
        k.add(book(R, leather), new THREE.BoxGeometry(ww, t, dd), { x: x + bw / 2, y: yy + t / 2, z: zFront - dd / 2, ry: (R() - 0.5) * 0.2 });
        yy += t;
      }
      x += bw + 0.015;
      continue;
    }
    const t = 0.018 + R() * 0.034, hh = Math.min(maxH, 0.17 + R() * 0.14), dd = Math.min(maxD, 0.13 + R() * 0.09);
    const g = new THREE.BoxGeometry(t, hh, dd);
    const u0 = R() * 0.9, du = 0.04 + R() * 0.06, uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setX(i, u0 + uvA.getX(i) * du);
    // occasional lean against the previous book
    const lean = room < 0.06 && R() < 0.6 ? -0.18 : 0;
    k.add(book(R, leather), g, { x: x + t / 2 + (lean ? 0.02 : 0), y: y + hh / 2, z: zFront - dd / 2 - (R() * 0.01), rz: lean });
    x += t + 0.0015;
  }
}
function book(R, leather) { return R() < leather ? LEATHER_BOUND[Math.floor(R() * 2)] : 'books'; }

// ───────────────────────────── bedroom builders ─────────────────────────────

// Footprints include the frame. superking = 200 × 200 cm mattress (Indonesian 'Super King').
const BED_SIZES = { superking: [2.3, 2.3], king: [2.0, 2.2], queen: [1.7, 2.15], single: [1.05, 2.05] };

function bed(p = {}, mat) {
  const size = BED_SIZES[p.size] ? p.size : 'king';
  const W = p.w || BED_SIZES[size][0], L = p.d || BED_SIZES[size][1];
  const style = ['tufted', 'carved', 'sleigh', 'panel'].includes(p.headboard) ? p.headboard : 'tufted';
  const F = p.frame || (style === 'sleigh' || style === 'carved' ? 'cherry' : 'mahogany');
  const FAB = p.fabric || (style === 'carved' || style === 'panel' ? null : 'leatherDarkBrown');
  const BED = p.bedding || 'quiltFloral';
  const RUN = p.runner === undefined ? 'velvetBurgundy' : p.runner;
  const H = p.h || (size === 'single' ? 1.15 : 1.4);
  const k = new Kit(mat);
  const R = seeded('bed' + size + style, p);
  const hz = -L / 2, fz = L / 2, sleigh = style === 'sleigh';
  const headT = sleigh ? 0.26 : 0.1, footT = sleigh ? 0.24 : 0.1;
  const mt = 0.56;
  const px = W / 2 - 0.06;            // post centre x
  const railTop = sleigh ? 0.44 : 0.38;

  // Side rails with a small cap moulding, slats platform.
  for (const s of [-1, 1]) {
    k.bb(F, s * (W / 2 - 0.065), 0.19, hz + headT - 0.01, s * (W / 2 - 0.02), railTop - 0.02, fz - footT + 0.01);
    k.bb(F, s * (W / 2 - 0.07), railTop - 0.025, hz + headT - 0.01, s * (W / 2 - 0.012), railTop, fz - footT + 0.01);
  }
  k.bb(F, -W / 2 + 0.07, 0.25, hz + headT, W / 2 - 0.07, 0.3, fz - footT, { uv: true });

  // Mattress, duvet, turn-down sheet, runner.
  const mz0 = hz + headT + 0.01, mz1 = fz - footT - 0.012;
  k.bb('linenWhite', -W / 2 + 0.075, 0.3, mz0, W / 2 - 0.075, mt, mz1, { r: 0.05 });
  const dTop = mt + 0.035;
  const dz0 = mz0 + (size === 'single' ? 0.32 : 0.36);
  k.add(BED, drapeGeo({ half: W / 2 - 0.004, z0: dz0, z1: mz1 - 0.01, top: dTop, r: 0.07,
    dropSide: dTop - 0.07 - 0.27, dropFoot: dTop - 0.07 - 0.33, puff: 0.012, quilt: 1, seed: 2,
    nFlat: size === 'single' ? 8 : 11, nFlatZ: 11, wave: 0.008 }));
  k.add('linenWhite', drapeGeo({ half: W / 2 + 0.006, z0: dz0 - 0.03, z1: dz0 + 0.3, top: dTop + 0.016, r: 0.075,
    dropSide: 0.1, footWrap: false, puff: 0.006, nFlat: size === 'single' ? 6 : 8, nFlatZ: 2, wave: 0.004, seed: 5 }));
  if (RUN) {
    k.add(RUN, drapeGeo({ half: W / 2 + 0.01, z0: mz1 - 0.72, z1: mz1 - 0.01, top: dTop + 0.022, r: 0.08,
      dropSide: dTop - 0.08 - 0.31, dropFoot: dTop - 0.08 - 0.36, puff: 0.004, nFlat: 8, nFlatZ: 4, wave: 0.012, seed: 9 }));
  }

  // Pillows.
  const pzBase = hz + headT;
  const nSleep = size === 'single' ? 1 : 2;
  const pw = size === 'superking' ? 0.84 : size === 'king' ? 0.74 : size === 'queen' ? 0.66 : 0.62;
  for (let i = 0; i < nSleep; i++) {
    const x = nSleep === 1 ? 0 : (i ? 1 : -1) * (W / 4 - 0.01);
    pillow(k, 'linenWhite', pw, 0.48, 0.17, { x, y: mt + 0.17, z: pzBase + 0.34, rx: -1.15, rz: (R() - 0.5) * 0.06 });
    pillow(k, BED, Math.min(pw, 0.66), 0.6, 0.2, { x: x * 0.98, y: mt + 0.33, z: pzBase + 0.16, rx: -0.3, rz: (R() - 0.5) * 0.05 });
  }
  if (size !== 'single') {
    pillow(k, RUN || 'velvetBurgundy', 0.5, 0.32, 0.14, { x: 0, y: mt + 0.2, z: pzBase + 0.52, rx: -0.55 });
  }

  // Posts.
  const posts = !sleigh;
  if (posts) {
    for (const s of [-1, 1]) {
      // square block + turned post at head; shorter at foot
      k.bb(F, s * px - 0.055, 0, hz + 0.005, s * px + 0.055, 0.5, hz + 0.115, { r: 0.008 });
      turned(k, F, s * px, 0.5, hz + 0.06, H - 0.5, 0.05, PROFILE.post, 8);
      k.bb(F, s * px - 0.055, 0, fz - 0.115, s * px + 0.055, 0.5, fz - 0.005, { r: 0.008 });
      turned(k, F, s * px, 0.5, fz - 0.06, (size === 'single' ? 0.82 : 0.95) - 0.5, 0.055, PROFILE.footPost, 8);
    }
  }

  const ix0 = -px + 0.055, ix1 = px - 0.055;   // between posts
  if (style === 'tufted') {
    const y0 = 0.42, yS = H - 0.22, yC = H - 0.06, zf = hz + 0.04;
    const outer = archFn(ix0, ix1, yS, yC);
    const inset = 0.065;
    const inner = archFn(ix0 + inset, ix1 - inset, yS - inset, yC - inset);
    const band = topShape(ix0, ix1, y0, outer, 12);
    band.holes.push(topPath(ix0 + inset, ix1 - inset, y0 + inset, inner, 12));
    k.ext(F, band, 0.06, { z: zf + 0.03, bevel: 0.01, bs: 1, cs: 4 });
    // upholstered back + tufted face
    k.ext(FAB, topShape(ix0 + inset, ix1 - inset, y0 + inset, inner, 12), 0.05, { z: zf + 0.025 });
    const tw = ix1 - ix0 - 2 * inset, th = yC - inset - (y0 + inset);
    const cy = (y0 + inset + yC - inset) / 2;
    tuftPanel(k, FAB, tw - 0.01, th - 0.01, {
      cols: Math.round(tw / 0.16), rows: Math.max(3, Math.round(th / 0.17)), depth: 0.04, edge: 0.05,
      top: x => inner(x) - cy - 0.005, x: 0, y: cy, z: zf + 0.05, res: 2.5,
    });
    // carved crest
    k.ext(F, shellShape(0.11, 9), 0.03, { x: 0, y: yC - 0.03, z: zf + 0.07, bevel: 0.006, bs: 1, cs: 2 });
    k.sph(F, 0.025, { x: 0, y: yC + 0.035, z: zf + 0.09, ws: 8, hs: 6 });
    footboard(k, F, ix0, ix1, fz, size);
  } else if (style === 'carved' || style === 'panel') {
    const y0 = 0.3, zf = hz + 0.03;
    const yS = H - (style === 'carved' ? 0.2 : 0.12), yC = style === 'carved' ? H - 0.04 : yS;
    const topF = style === 'carved' ? archFn(ix0, ix1, yS, yC, 2.2) : () => yS;
    k.ext(F, topShape(ix0, ix1, y0, topF, style === 'carved' ? 14 : 1), 0.045, { z: zf + 0.0225, bevel: 0.008, bs: 1, cs: 4 });
    if (style === 'panel') {
      // cornice
      k.bb(F, ix0 - 0.07, yS, zf - 0.01, ix1 + 0.07, yS + 0.035, zf + 0.08, { r: 0.01 });
      k.bb(F, ix0 - 0.04, yS + 0.035, zf, ix1 + 0.04, yS + 0.06, zf + 0.06, { r: 0.008 });
    } else {
      k.ext(F, shellShape(0.15, 11), 0.035, { x: 0, y: yC - 0.08, z: zf + 0.06, bevel: 0.008, bs: 1, cs: 2 });
      k.sph(F, 0.03, { x: 0, y: yC - 0.0, z: zf + 0.07, ws: 8, hs: 6 });
    }
    if (FAB) {
      const fw = ix1 - ix0 - 0.2, fh = yS - 0.75 - 0.08;
      k.bb(F, -fw / 2 - 0.03, 0.72, zf + 0.045, fw / 2 + 0.03, 0.72 + fh + 0.06, zf + 0.07, { r: 0.012 });
      k.bb(FAB, -fw / 2, 0.75, zf + 0.06, fw / 2, 0.75 + fh, zf + 0.085, { r: 0.012 });
      tuftPanel(k, FAB, fw - 0.02, fh - 0.02, { cols: Math.round(fw / 0.16), rows: 3, depth: 0.03, x: 0, y: 0.75 + fh / 2, z: zf + 0.085, res: 2.5 });
    } else {
      const n = W > 1.3 ? 3 : 2, gap = 0.07, pwid = (ix1 - ix0 - gap * (n + 1)) / n;
      for (let i = 0; i < n; i++) {
        const x0 = ix0 + gap + i * (pwid + gap), x1 = x0 + pwid;
        const ptop = style === 'carved' ? archFn(x0, x1, yS - 0.18, yS - 0.1 + (i === (n - 1) / 2 ? 0.08 : 0), 1.6) : () => yS - 0.1;
        k.ext(F, topShape(x0, x1, 0.68, ptop, style === 'carved' ? 8 : 1), 0.018, { z: zf + 0.054, bevel: 0.007, bs: 1, cs: 3 });
      }
      k.bb(F, ix0, 0.6, zf + 0.04, ix1, 0.64, zf + 0.065, { r: 0.008 });
    }
    footboard(k, F, ix0, ix1, fz, size);
  } else {
    // sleigh
    const sc = H / 1.34;
    const head = new THREE.Shape();
    head.moveTo(0, 0.2); head.lineTo(0, 0.95 * sc);
    head.quadraticCurveTo(0, 1.22 * sc, 0.14, 1.3 * sc);
    head.quadraticCurveTo(0.24, 1.34 * sc, 0.25, 1.24 * sc);
    head.quadraticCurveTo(0.25, 1.15 * sc, 0.17, 1.16 * sc);
    head.quadraticCurveTo(0.12, 1.18 * sc, 0.1, 1.12 * sc);
    head.quadraticCurveTo(0.08, 1.0 * sc, 0.08, 0.9 * sc);
    head.lineTo(0.08, 0.2); head.closePath();
    const zf = hz + 0.255;
    k.ext(F, head, W - 0.04, { z: zf, ry: Math.PI / 2, bevel: 0.01, bs: 1, cs: 5 });
    if (FAB) {
      const fw = W - 0.34, y0 = 0.62, y1 = 0.9 * sc + 0.02;
      k.bb(FAB, -fw / 2, y0, zf, fw / 2, y1, zf + 0.03, { r: 0.012 });
      tuftPanel(k, FAB, fw - 0.02, y1 - y0 - 0.02, { cols: Math.round(fw / 0.15), rows: 3, depth: 0.035, x: 0, y: (y0 + y1) / 2, z: zf + 0.03, res: 2.5 });
      k.bb(F, -fw / 2 - 0.035, y0 - 0.035, zf, fw / 2 + 0.035, y0, zf + 0.04, { r: 0.008 });
      k.bb(F, -fw / 2 - 0.035, y1, zf, fw / 2 + 0.035, y1 + 0.035, zf + 0.04, { r: 0.008 });
    }
    k.ext(F, shellShape(0.1, 9), 0.03, { x: 0, y: 1.14 * sc, z: zf + 0.06, rx: -0.25, bevel: 0.005, cs: 2 });
    const foot = new THREE.Shape();
    foot.moveTo(0, 0.15); foot.lineTo(0, 0.55);
    foot.quadraticCurveTo(0.02, 0.72, 0.12, 0.78);
    foot.quadraticCurveTo(0.2, 0.8, 0.21, 0.71);
    foot.quadraticCurveTo(0.21, 0.64, 0.14, 0.66);
    foot.quadraticCurveTo(0.09, 0.68, 0.08, 0.6);
    foot.lineTo(0.08, 0.15); foot.closePath();
    const zi = fz - 0.235;
    k.ext(F, foot, W - 0.04, { z: zi, ry: -Math.PI / 2, bevel: 0.01, bs: 1, cs: 5 });
    // raised panels on the footboard face
    const n = W > 1.3 ? 2 : 1, pw2 = (W - 0.3) / n;
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + 0.15 + pw2 * (i + 0.5);
      k.bb(F, x - pw2 / 2 + 0.03, 0.24, zi + 0.085, x + pw2 / 2 - 0.03, 0.5, zi + 0.1, { r: 0.008 });
    }
    // bun feet
    for (const s of [-1, 1]) for (const z of [hz + 0.1, fz - 0.12]) turned(k, F, s * (W / 2 - 0.08), 0, z, 0.19, 0.055, PROFILE.bun, 8);
  }
  return k.build('bed', W, L, H, true, { size, headboard: style });
}

function footboard(k, F, ix0, ix1, fz, size) {
  const top = size === 'single' ? 0.66 : 0.76, z = fz - 0.06;
  k.bb(F, ix0, 0.22, z - 0.03, ix1, 0.3, z + 0.03);                 // bottom rail
  k.bb(F, ix0 - 0.01, top - 0.06, z - 0.035, ix1 + 0.01, top, z + 0.04, { r: 0.012 }); // top rail
  k.bb(F, ix0, 0.3, z - 0.012, ix1, top - 0.06, z + 0.012);                          // panel
  const n = ix1 - ix0 > 1.2 ? 2 : 1, gap = 0.06, pw = (ix1 - ix0 - gap * (n + 1)) / n;
  for (let i = 0; i < n; i++) {
    const x0 = ix0 + gap + i * (pw + gap);
    for (const s of [1, -1]) k.bb(F, x0, 0.35, z + s * 0.012 - (s < 0 ? 0.014 : 0), x0 + pw, top - 0.11, z + s * 0.012 + (s > 0 ? 0.014 : 0), { r: 0.006 });
  }
  if (n === 2) for (const s of [1, -1]) k.bb(F, -0.025, 0.3, z + s * 0.012, 0.025, top - 0.06, z + s * 0.022);
}

function nightstand(p = {}, mat) {
  const W = p.w || 0.55, D = p.d || 0.45, H = p.h || 0.65, F = p.frame || p.mat || 'mahogany', HW = p.hardware || 'brass';
  const k = new Kit(mat);
  const fy = 0.06, zf = D / 2 - 0.025;
  k.bb(F, -W / 2 + 0.015, fy + 0.04, -D / 2 + 0.015, W / 2 - 0.015, H - 0.03, zf);
  k.box(F, W, 0.032, D, { y: H - 0.016, r: 0.01 });
  k.box(F, W - 0.01, 0.025, D - 0.01, { y: H - 0.045, r: 0.006 });
  k.box(F, W, 0.045, D - 0.005, { y: fy + 0.022, r: 0.008 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turned(k, F, sx * (W / 2 - 0.045), 0, sz * (D / 2 - 0.045), fy, 0.032, PROFILE.bun, 8);
  // side stiles with fluting suggestion
  for (const s of [-1, 1]) k.bb(F, s * (W / 2 - 0.012) - 0.018, fy + 0.045, zf - 0.002, s * (W / 2 - 0.012) + 0.018, H - 0.06, zf + 0.012, { r: 0.006 });
  const n = p.drawers || 3, y0 = fy + 0.06, y1 = H - 0.07, dh = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const y = y0 + dh * (i + 0.5);
    panelFront(k, F, 0, y, zf + 0.02, W - 0.09, dh - 0.012, { inset: 0.025 });
    for (const s of [-1, 1]) knob(k, s * (W * 0.24), y, zf + 0.02, 0.012, HW);
  }
  return k.build('nightstand', W, D, H, true);
}

function dresser(p = {}, mat) {
  const W = p.w || 1.6, D = p.d || 0.55, H = p.h || 0.9, F = p.frame || p.mat || 'cherry', HW = p.hardware || 'brass';
  const k = new Kit(mat);
  const R = seeded('dresser', p);
  const fy = 0.1, zf = D / 2 - 0.035;
  const serp = x => 0.018 * Math.cos(3 * Math.PI * x / W);
  // body
  k.bb(F, -W / 2 + 0.03, fy, -D / 2 + 0.01, W / 2 - 0.03, H - 0.04, zf);
  // serpentine top (extruded plan shape, rotated so the extrusion is vertical)
  const n = 24;
  const topS = new THREE.Shape();
  topS.moveTo(-W / 2, D / 2); // y here = -z
  topS.lineTo(W / 2, D / 2);
  for (let i = n; i >= 0; i--) { const x = -W / 2 + W * i / n; topS.lineTo(x, -(D / 2 + 0.005 + serp(x))); }
  topS.closePath();
  k.ext(F, topS, 0.03, { y: H - 0.02, rx: -Math.PI / 2, bevel: 0.008, bs: 1, cs: 2, uv: 'box' });
  k.ext(F, topS, 0.02, { y: H - 0.05, rx: -Math.PI / 2, sx: 0.98, sy: 0.96, bevel: 0.005, bs: 1, cs: 2, uv: 'box' });
  // carved apron and bracket feet
  const apron = new THREE.Shape();
  apron.moveTo(-W / 2 + 0.02, fy + 0.03);
  apron.lineTo(-W / 2 + 0.02, 0);
  apron.quadraticCurveTo(-W / 2 + 0.1, 0.0, -W / 2 + 0.12, fy * 0.55);
  const m = 10;
  for (let i = 0; i <= m; i++) {
    const x = -W / 2 + 0.16 + (W - 0.32) * i / m;
    apron.lineTo(x, fy * 0.7 - 0.02 * Math.abs(Math.sin(Math.PI * i / 2)) - (i === m / 2 ? 0.03 : 0));
  }
  apron.quadraticCurveTo(W / 2 - 0.1, 0.0, W / 2 - 0.02, 0);
  apron.lineTo(W / 2 - 0.02, fy + 0.03);
  apron.closePath();
  k.ext(F, apron, 0.03, { z: zf + 0.0, bevel: 0.006, bs: 1, cs: 4 });
  for (const s of [-1, 1]) k.ext(F, apron, 0.03, { x: s * (W / 2 - 0.02), z: 0, ry: Math.PI / 2, sx: D / W, bevel: 0.005, bs: 1, cs: 4 });
  // fluted corner pilasters
  for (const s of [-1, 1]) {
    k.bb(F, s * (W / 2 - 0.03) - 0.03, fy, zf - 0.01, s * (W / 2 - 0.03) + 0.03, H - 0.05, zf + 0.02, { r: 0.01 });
    k.ext(F, shellShape(0.028, 5), 0.01, { x: s * (W / 2 - 0.03), y: H - 0.12, z: zf + 0.025, bevel: 0.003, cs: 1 });
  }
  // layout: top drawer row (3), two side stacks of 3, centre cabinet doors
  const xi0 = -W / 2 + 0.07, xi1 = W / 2 - 0.07, iw = xi1 - xi0;
  const yTop0 = H - 0.21, yTop1 = H - 0.065;
  const cw = iw * 0.36, sw = (iw - cw) / 2;
  const cols = [[xi0, xi0 + sw], [xi0 + sw, xi0 + sw + cw], [xi0 + sw + cw, xi1]];
  const g = 0.008;
  const zc = x => zf + 0.02 + serp(x);
  for (const [a, b] of cols) {
    const x = (a + b) / 2;
    panelFront(k, F, x, (yTop0 + yTop1) / 2, zc(x), b - a - g, yTop1 - yTop0 - g, { inset: 0.025 });
    bail(k, x, (yTop0 + yTop1) / 2, zc(x), 0.08, HW);
  }
  const yb0 = fy + 0.02, yb1 = yTop0 - g;
  for (const [a, b] of [cols[0], cols[2]]) {
    const x = (a + b) / 2, dh = (yb1 - yb0) / 3;
    for (let i = 0; i < 3; i++) {
      const y = yb0 + dh * (i + 0.5);
      panelFront(k, F, x, y, zc(x), b - a - g, dh - g, { inset: 0.025 });
      bail(k, x, y, zc(x), 0.08, HW);
    }
  }
  // centre doors with arched raised panels + carved rosette
  const [c0, c1] = cols[1];
  for (const s of [-1, 1]) {
    const a = s < 0 ? c0 : (c0 + c1) / 2, b = s < 0 ? (c0 + c1) / 2 : c1;
    const x = (a + b) / 2, z = zc(x);
    k.bb(F, a + g / 2, yb0, z - 0.02, b - g / 2, yb1, z, { r: 0.003 });
    const pa = a + 0.035, pb = b - 0.035;
    k.ext(F, topShape(pa, pb, yb0 + 0.05, archFn(pa, pb, yb1 - 0.1, yb1 - 0.05, 1), 8), 0.012, { z: z + 0.002, bevel: 0.005, bs: 1, cs: 2 });
    knob(k, s < 0 ? b - 0.03 : a + 0.03, (yb0 + yb1) / 2, z + 0.008, 0.012, HW);
  }
  k.ext(F, shellShape(0.07, 7), 0.012, { x: 0, y: yb1 - 0.07, z: zc(0) + 0.014, bevel: 0.004, cs: 1 });
  let h = H;
  if (p.mirror) {
    const mw = Math.min(W * 0.75, 1.2), my0 = H + 0.02, myS = H + 0.95, myC = H + 1.15;
    const mzB = -D / 2 + 0.06;
    const outer = archFn(-mw / 2, mw / 2, myS, myC, 1.3), inner = archFn(-mw / 2 + 0.07, mw / 2 - 0.07, myS - 0.07, myC - 0.08, 1.3);
    const frame = topShape(-mw / 2, mw / 2, my0, outer, 24);
    frame.holes.push(topPath(-mw / 2 + 0.07, mw / 2 - 0.07, my0 + 0.07, inner, 24));
    k.ext(F, frame, 0.04, { z: mzB, bevel: 0.01, bs: 1, cs: 4 });
    k.ext('mirror', topShape(-mw / 2 + 0.07, mw / 2 - 0.07, my0 + 0.07, inner, 24), 0.006, { z: mzB - 0.005 });
    k.ext(F, shellShape(0.12, 11), 0.03, { x: 0, y: myC - 0.06, z: mzB + 0.03, bevel: 0.006, cs: 2 });
    for (const s of [-1, 1]) {
      k.bb(F, s * (mw / 2 + 0.01) - 0.03, H - 0.02, mzB - 0.03, s * (mw / 2 + 0.01) + 0.03, my0 + 0.5, mzB + 0.02, { r: 0.01 });
      k.ext(F, shellShape(0.05, 5), 0.02, { x: s * (mw / 2 + 0.01), y: my0 + 0.5, z: mzB, rz: -s * 0.4, bevel: 0.003, cs: 1 });
    }
    h = myC + 0.05;
  }
  // a small decanter tray on the top
  if (p.decor !== false) {
    const dx = W * 0.3;
    k.box('brass', 0.3, 0.012, 0.18, { x: dx, y: H + 0.016, z: 0.02, r: 0.004 });
    k.lathe('crystal', [[0, 0], [0.04, 0], [0.045, 0.06], [0.03, 0.1], [0.012, 0.12], [0.014, 0.15], [0.0, 0.15]], { x: dx - 0.07, y: H + 0.022, z: 0.02, seg: 10 });
    k.sph('crystal', 0.018, { x: dx - 0.07, y: H + 0.185, z: 0.02, ws: 8, hs: 6 });
    k.lathe('crystal', [[0, 0], [0.032, 0], [0.036, 0.08], [0.02, 0.11], [0.01, 0.15], [0.0, 0.15]], { x: dx + 0.07, y: H + 0.022, z: 0.03, seg: 10 });
    k.box('walnut', 0.2, 0.08, 0.13, { x: -dx, y: H + 0.04 + 0.004, z: 0.02, r: 0.008 });
    k.box('brass', 0.03, 0.02, 0.005, { x: -dx, y: H + 0.06, z: 0.088 });
    void R;
  }
  return k.build('dresser', W, D, h, true);
}

function wardrobe(p = {}, mat) {
  const W = p.w || 1.2, D = p.d || 0.6, H = p.h || 2.3, F = p.frame || p.mat || 'mahogany', HW = p.hardware || 'brass';
  const k = new Kit(mat);
  const fy = 0.1, zf = D / 2 - 0.03;
  k.bb(F, -W / 2 + 0.02, fy, -D / 2 + 0.01, W / 2 - 0.02, H - 0.1, zf);
  // plinth
  k.bb(F, -W / 2, 0, -D / 2, W / 2, fy, D / 2 - 0.01, { r: 0.008 });
  k.bb(F, -W / 2 - 0.01, fy - 0.025, -D / 2, W / 2 + 0.01, fy, D / 2, { r: 0.01 });
  // stepped cornice
  k.bb(F, -W / 2 - 0.0, H - 0.1, -D / 2, W / 2 + 0.0, H - 0.06, D / 2 - 0.005, { r: 0.008 });
  k.bb(F, -W / 2 - 0.035, H - 0.06, -D / 2, W / 2 + 0.035, H - 0.03, D / 2 + 0.02, { r: 0.012 });
  k.bb(F, -W / 2 - 0.05, H - 0.03, -D / 2, W / 2 + 0.05, H, D / 2 + 0.035, { r: 0.01 });
  for (const s of [-1, 1]) k.bb(F, s * (W / 2 - 0.02) - 0.025, fy, zf - 0.01, s * (W / 2 - 0.02) + 0.025, H - 0.1, zf + 0.015, { r: 0.006 });
  // bottom drawer
  const yd0 = fy + 0.015, yd1 = fy + 0.24;
  panelFront(k, F, 0, (yd0 + yd1) / 2, zf + 0.02, W - 0.1, yd1 - yd0, { inset: 0.03 });
  for (const s of [-1, 1]) bail(k, s * W * 0.22, (yd0 + yd1) / 2, zf + 0.02, 0.085, HW);
  // two doors, each with tall upper + short lower panel
  const y0 = yd1 + 0.012, y1 = H - 0.115, dw = (W - 0.1) / 2;
  for (const s of [-1, 1]) {
    const x = s * dw / 2, z = zf + 0.02;
    k.bb(F, x - dw / 2 + 0.003, y0, z - 0.022, x + dw / 2 - 0.003, y1, z, { r: 0.004 });
    const yl1 = y0 + 0.42;
    k.bb(F, x - dw / 2 + 0.06, y0 + 0.07, z - 0.004, x + dw / 2 - 0.06, yl1, z + 0.012, { r: 0.007 });
    const a = x - dw / 2 + 0.06, b = x + dw / 2 - 0.06;
    k.ext(F, topShape(a, b, yl1 + 0.08, archFn(a, b, y1 - 0.14, y1 - 0.07, 1.2), 8), 0.016, { z: z + 0.002, bevel: 0.006, bs: 1, cs: 2 });
    k.box(HW, 0.014, 0.16, 0.014, { x: -s * 0.025, y: (y0 + y1) / 2 - 0.1, z: z + 0.025, r: 0.006 });
    for (const yy of [-0.075, 0.075]) k.box(HW, 0.012, 0.012, 0.018, { x: -s * 0.025, y: (y0 + y1) / 2 - 0.1 + yy, z: z + 0.01 });
  }
  k.ext(HW, ellipseShape(0.012, 0.022, 10), 0.002, { x: 0.015, y: (y0 + y1) / 2 - 0.22, z: zf + 0.022 });
  return k.build('wardrobe', W, D, H, true);
}

const GARMENT_MATS = ['fabricCharcoal', 'linenCream', 'fabricTaupe', 'velvetBurgundy', 'fabricSage', 'linenWhite', 'velvetOlive', 'drapeCream'];
function garmentShape(len, wid) {
  const s = new THREE.Shape(), hw = wid / 2;
  s.moveTo(-hw * 0.95, -len);
  s.lineTo(hw * 0.95, -len);
  s.lineTo(hw, -0.12);
  s.quadraticCurveTo(hw * 0.95, -0.03, hw * 0.4, -0.01);
  s.lineTo(-hw * 0.4, -0.01);
  s.quadraticCurveTo(-hw * 0.95, -0.03, -hw, -0.12);
  s.closePath();
  return s;
}
function shoe(k, R, m, x, y, z, o = {}) {
  const heel = o.heel, len = 0.26, w = 0.085;
  k.push({ x, y, z, rx: o.rx || 0, ry: o.ry || 0 });
  const sole = heel ? 'leatherBlack' : (m === 'linenWhite' ? 'rubberBlack' : 'leatherDarkBrown');
  k.box(sole, w, 0.015, len, { y: heel ? 0.01 : 0.008 });
  if (heel) {
    k.box(m, w * 0.95, 0.012, len * 0.5, { y: 0.055, z: -len * 0.2, rx: -0.35, r: 0.004 });
    k.box(sole, 0.025, 0.07, 0.025, { y: 0.035, z: -len / 2 + 0.02 });
    k.sph(m, 1, { y: 0.02, z: len * 0.28, sx: w / 2, sy: 0.03, sz: len * 0.22, ws: 8, hs: 4, theta: Math.PI / 2 });
  } else {
    k.sph(m, 1, { y: 0.015, z: 0.0, sx: w / 2, sy: o.boot ? 0.16 : 0.07, sz: len / 2, ws: 7, hs: 4, theta: Math.PI / 2 });
  }
  k.pop();
}
function closetSystem(p = {}, mat) {
  const W = p.w || 2.4, D = p.d || 0.6, H = p.h || 2.5, F = p.frame || p.mat || 'walnut', ROD = p.hardware || 'brass';
  const k = new Kit(mat);
  const R = seeded('closet', p);
  const n = Math.max(1, Math.round(W / 0.8)), sw = W / n, t = 0.022, zb = -D / 2, zf = D / 2;
  // back panel, gables, plinth, top
  k.bb(F, -W / 2, 0, zb, W / 2, H, zb + 0.012);
  for (let i = 0; i <= n; i++) {
    const x = -W / 2 + i * sw;
    k.bb(F, x - (i === 0 ? 0 : t / 2), 0, zb, x + (i === n ? 0 : t / 2), H, zf);
  }
  k.bb(F, -W / 2, 0, zb, W / 2, 0.08, zf - 0.02);
  k.bb(F, -W / 2 - 0.01, H - 0.05, zb, W / 2 + 0.01, H, zf + 0.015, { r: 0.008 });
  const kinds = ['hang', 'shoes', 'shelves', 'hang2'];
  const order = n === 1 ? ['shoes'] : n === 2 ? ['hang', 'shoes'] : n === 3 ? ['hang', 'shoes', 'shelves'] : Array.from({ length: n }, (_, i) => kinds[i % 4]);
  const shelf = (x0, x1, y, d = D - 0.03) => k.bb(F, x0, y - 0.022, zb + 0.012, x1, y, zb + 0.012 + d);
  const hangRow = (x0, x1, yRod, maxLen) => {
    k.bar(ROD, [x0, yRod, -0.02], [x1, yRod, -0.02], 0.013, { seg: 10 });
    let x = x0 + 0.04;
    while (x < x1 - 0.04) {
      const m = GARMENT_MATS[Math.floor(R() * GARMENT_MATS.length)];
      const len = maxLen * (0.55 + R() * 0.45), thick = 0.025 + R() * 0.02;
      k.ext(m, garmentShape(len, 0.42 + R() * 0.06), thick, { x: x + thick / 2, y: yRod - 0.03, z: -0.02, ry: Math.PI / 2 + (R() - 0.5) * 0.12, bevel: 0.008, bs: 1, cs: 2, uv: 'box' });
      k.torus(ROD, 0.018, 0.003, { x: x + thick / 2, y: yRod + 0.005, z: -0.02, ry: Math.PI / 2, arc: Math.PI * 1.3, rs: 3, ts: 6 });
      x += thick + 0.012 + R() * 0.03;
    }
  };
  for (let i = 0; i < n; i++) {
    const x0 = -W / 2 + i * sw + t / 2, x1 = x0 + sw - t, xc = (x0 + x1) / 2, kind = order[i];
    shelf(x0, x1, H - 0.38);   // top shelf with boxes / hats
    for (let j = 0, x = x0 + 0.03; j < 2 && x < x1 - 0.25; j++) {
      const bw = 0.24 + R() * 0.08;
      k.box(j ? 'linenCream' : 'fabricTaupe', bw, 0.18, 0.36, { x: x + bw / 2, y: H - 0.38 + 0.09, z: 0, r: 0.012 });
      x += bw + 0.04;
    }
    if (kind === 'hang') hangRow(x0, x1, H - 0.45, 1.3);
    else if (kind === 'hang2') { hangRow(x0, x1, H - 0.45, 0.85); shelf(x0, x1, 1.12); hangRow(x0, x1, 1.05, 0.8); }
    else if (kind === 'shelves') {
      for (const y of [0.5, 0.85, 1.2, 1.55]) {
        shelf(x0, x1, y);
        for (let s = 0, x = x0 + 0.04; s < 2 && x < x1 - 0.25; s++) {
          const fw = 0.28, c = 2 + Math.floor(R() * 3), m = GARMENT_MATS[Math.floor(R() * GARMENT_MATS.length)];
          for (let q = 0; q < c; q++) k.box(m, fw, 0.055, 0.3, { x: x + fw / 2 + (R() - 0.5) * 0.015, y: y + 0.028 + q * 0.056, z: 0.0, r: q === c - 1 ? 0.022 : 0, ry: (R() - 0.5) * 0.06 });
          x += fw + 0.04;
        }
      }
      // base drawers
      for (const [a, b] of [[0.09, 0.29], [0.3, 0.48]]) {
        panelFront(k, F, xc, (a + b) / 2, zf - 0.005, x1 - x0 - 0.01, b - a - 0.008, { inset: 0.02 });
        knob(k, xc, (a + b) / 2, zf - 0.005, 0.012, ROD);
      }
      k.bb(F, x0, 0.08, zf - 0.03, x1, 0.49, zf - 0.025);
    } else if (kind === 'shoes') {
      // slanted shoe shelves with a lip rail, pairs of shoes
      const ys = [0.18, 0.5, 0.82, 1.14, 1.46, 1.78];
      const styles = [{ m: 'leatherBlack' }, { m: 'leatherCognac' }, { m: 'leatherOxblood', heel: true }, { m: 'linenWhite' },
        { m: 'leatherDarkBrown', boot: true }, { m: 'velvetBurgundy', heel: true }, { m: 'leatherBlack', heel: true }, { m: 'fabricCharcoal' }];
      const tilt = 0.26;
      for (let r = 0; r < ys.length; r++) {
        const y = ys[r];
        k.bb(F, x0, y - 0.018, -D / 2 + 0.06, x1, y, D / 2 - 0.04, { rx: tilt });
        k.bar(ROD, [x0, y + 0.03 - 0.12, D / 2 - 0.06], [x1, y + 0.03 - 0.12, D / 2 - 0.06], 0.007, { seg: 6 });
        const pairs = Math.floor((x1 - x0) / 0.26);
        for (let q = 0; q < pairs; q++) {
          const st = styles[(r * 3 + q) % styles.length];
          const px = x0 + (x1 - x0) * (q + 0.5) / pairs;
          if (r === ys.length - 1 && st.boot) continue;
          for (const sgn of [-1, 1]) shoe(k, R, st.m, px + sgn * 0.05, y + 0.002, 0.0, { rx: tilt, heel: st.heel, boot: st.boot && r === 0 });
        }
      }
    }
  }
  return k.build('closetSystem', W, D, H, true);
}

function benchTufted(p = {}, mat) {
  const W = p.w || 1.4, D = p.d || 0.45, H = p.h || 0.48, F = p.frame || 'mahogany', FAB = p.fabric || 'linenCream';
  const k = new Kit(mat);
  const legH = H - 0.17;
  k.bb(F, -W / 2 + 0.02, legH - 0.06, -D / 2 + 0.02, W / 2 - 0.02, legH + 0.01, D / 2 - 0.02, { r: 0.01 });
  k.bb(F, -W / 2 + 0.01, legH, -D / 2 + 0.01, W / 2 - 0.01, legH + 0.02, D / 2 - 0.01, { r: 0.008 });
  k.bb(FAB, -W / 2 + 0.012, legH + 0.02, -D / 2 + 0.012, W / 2 - 0.012, H - 0.06, D / 2 - 0.012, { r: 0.03, seg: 2 });
  tuftPanel(k, FAB, W - 0.03, D - 0.03, { cols: Math.round(W / 0.17), rows: 3, depth: 0.05, edge: 0.06, x: 0, y: H - 0.062, z: 0, rx: -Math.PI / 2, res: 3, btnR: 0.01 });
  const legs = W > 1.2 ? [-1, 0, 1] : [-1, 1];
  for (const lx of legs) for (const s of [-1, 1]) {
    const x = lx * (W / 2 - 0.06);
    if (lx === 0 && s === 1) continue;
    if (lx === 0) continue;
    turned(k, F, x, 0, s * (D / 2 - 0.06), legH - 0.06, 0.03, PROFILE.leg, 10);
  }
  k.bb(F, -W / 2 + 0.08, 0.11, -0.012, W / 2 - 0.08, 0.135, 0.012, { r: 0.008 });
  for (const s of [-1, 1]) k.bb(F, s * (W / 2 - 0.06) - 0.012, 0.11, -D / 2 + 0.07, s * (W / 2 - 0.06) + 0.012, 0.135, D / 2 - 0.07, { r: 0.008 });
  return k.build('benchTufted', W, D, H, true);
}

function vanityTable(p = {}, mat) {
  const W = p.w || 1.1, D = p.d || 0.5, H = p.h || 0.76, F = p.frame || p.mat || 'cherry', HW = p.hardware || 'brass';
  const FAB = p.fabric || 'velvetBurgundy';
  const k = new Kit(mat);
  const R = seeded('vanity', p);
  const zf = D / 2 - 0.02, ap = 0.13;
  k.box(F, W, 0.03, D, { y: H - 0.015, r: 0.01 });
  // apron: side drawers + kneehole centre drawer
  k.bb(F, -W / 2 + 0.03, H - 0.03 - ap, -D / 2 + 0.03, W / 2 - 0.03, H - 0.03, zf);
  const sw = (W - 0.06) * 0.28;
  for (const [x0, x1] of [[-W / 2 + 0.06, -W / 2 + 0.06 + sw], [-W / 2 + 0.06 + sw + 0.01, W / 2 - 0.06 - sw - 0.01], [W / 2 - 0.06 - sw, W / 2 - 0.06]]) {
    const x = (x0 + x1) / 2, y = H - 0.03 - ap / 2;
    panelFront(k, F, x, y, zf + 0.018, x1 - x0, ap - 0.02, { inset: 0.018 });
    knob(k, x, y, zf + 0.018, 0.011, HW);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turned(k, F, sx * (W / 2 - 0.05), 0, sz * (D / 2 - 0.05), H - 0.03 - ap + 0.01, 0.028, PROFILE.taper, 10);
  // oval mirror on lyre supports
  const mw = Math.min(0.62, W * 0.6), mh = 0.72, my = H + 0.1 + mh / 2, mz = -D / 2 + 0.06;
  const ring = ellipseShape(mw / 2, mh / 2, 36);
  ring.holes.push(ellipseShape(mw / 2 - 0.045, mh / 2 - 0.045, 36, true));
  k.ext(F, ring, 0.03, { y: my, z: mz, bevel: 0.008, cs: 2 });
  k.ext('mirror', ellipseShape(mw / 2 - 0.045, mh / 2 - 0.045, 36), 0.004, { y: my, z: mz - 0.006 });
  k.ext(F, shellShape(0.06, 7), 0.02, { y: my + mh / 2 - 0.02, z: mz + 0.01, bevel: 0.004, cs: 1 });
  for (const s of [-1, 1]) {
    k.bb(F, s * (mw / 2 + 0.03) - 0.02, H, mz - 0.03, s * (mw / 2 + 0.03) + 0.02, my + 0.05, mz + 0.01, { r: 0.008 });
    k.sph(F, 0.022, { x: s * (mw / 2 + 0.03), y: my + 0.07, z: mz - 0.01, ws: 8, hs: 6 });
    k.box('brass', 0.06, 0.012, 0.012, { x: s * (mw / 2 + 0.005), y: my, z: mz - 0.01 });
  }
  k.bb(F, -mw / 2 - 0.05, H, mz - 0.04, mw / 2 + 0.05, H + 0.04, mz + 0.03, { r: 0.008 });
  // perfume bottles, brush tray, jewellery box
  const ty = H;
  k.box('brass', 0.28, 0.008, 0.16, { x: W * 0.28, y: ty + 0.004, z: 0.02, r: 0.003 });
  for (let i = 0; i < 3; i++) {
    const x = W * 0.28 - 0.08 + i * 0.08, s = 0.8 + R() * 0.5;
    k.lathe('crystal', [[0, 0], [0.025 * s, 0], [0.03 * s, 0.05 * s], [0.012, 0.08 * s], [0.012, 0.1 * s], [0, 0.1 * s]], { x, y: ty + 0.008, z: 0.02, seg: 8 });
    k.sph('brass', 0.012, { x, y: ty + 0.008 + 0.1 * s + 0.008, z: 0.02, ws: 6, hs: 4 });
  }
  k.box('leatherOxblood', 0.18, 0.08, 0.12, { x: -W * 0.3, y: ty + 0.04, z: 0.02, r: 0.01 });
  k.box('brass', 0.03, 0.015, 0.005, { x: -W * 0.3, y: ty + 0.06, z: 0.082 });
  // stool tucked into the kneehole
  k.push({ z: 0.06 });
  const sr = 0.19, sh = 0.47;
  k.lathe(FAB, [[0, sh - 0.07], [sr - 0.01, sh - 0.07], [sr, sh - 0.05], [sr + 0.005, sh - 0.03], [sr - 0.01, sh - 0.005], [sr * 0.7, sh + 0.012], [0, sh + 0.018]], { seg: 20 });
  k.lathe(F, [[0, sh - 0.1], [sr - 0.02, sh - 0.1], [sr - 0.005, sh - 0.085], [sr - 0.01, sh - 0.068], [0, sh - 0.068]], { seg: 20 });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const lx = Math.cos(a) * (sr - 0.05), lz = Math.sin(a) * (sr - 0.05);
    k.lathe(F, PROFILE.taper.map(([r, t]) => [r * 0.02, t * (sh - 0.1)]), { x: lx, z: lz, rz: 0, seg: 8 });
  }
  k.pop();
  return k.build('vanityTable', W, D, my + mh / 2 + 0.06, true);
}

export const BEDROOM = { bed, nightstand, dresser, wardrobe, closetSystem, benchTufted, vanityTable };

export const INFO = {
  bed: { w: 2.0, d: 2.2, h: 1.4, mount: 'floor', solid: true },
  nightstand: { w: 0.55, d: 0.45, h: 0.65, mount: 'floor', solid: true },
  dresser: { w: 1.6, d: 0.55, h: 0.9, mount: 'floor', solid: true },
  wardrobe: { w: 1.2, d: 0.6, h: 2.3, mount: 'floor', solid: true },
  closetSystem: { w: 2.4, d: 0.6, h: 2.5, mount: 'floor', solid: true },
  benchTufted: { w: 1.4, d: 0.45, h: 0.48, mount: 'floor', solid: true },
  vanityTable: { w: 1.1, d: 0.5, h: 1.65, mount: 'floor', solid: true },
};
// Size-dependent bed footprint for furnitureInfo callers that pass params.size.
export const BED_DIMS = { superking: { w: 2.3, d: 2.3, h: 1.45 }, king: { w: 2.0, d: 2.2, h: 1.4 }, queen: { w: 1.7, d: 2.15, h: 1.4 }, single: { w: 1.05, d: 2.05, h: 1.15 } };
