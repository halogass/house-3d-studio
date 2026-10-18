// Interior finishes: skins (paint / wallpaper / panelling / tile / concrete / acoustic),
// baseboards, crown, wainscot + picture-frame mouldings, tray / coffered / beamed ceilings
// with LED coves, window frames + surrounds, curtains, door casings and stair balustrades.
//
// Everything is generated from the plan data (rooms, openings, open-plan pairs, stairs) plus the
// optional per-room `finish` block of the interior data (docs/SCHEMA.md, "finish").
// Plan coords in (x east, y north, z elevation), world geometry out (X = x, Y = z, Z = -y).
// Every geometry is non-indexed with position / normal / uv and no groups.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, subtract, DOOR_TOP } from '../geom.js';

const EPS = 1e-6;
const CELL = 0.5;
const INSET = { ext: 0.15, int: 0.075 };
const WOODS = new Set(['walnut', 'mahogany', 'oak', 'oakLight', 'teak', 'cherry', 'woodHerringbone', 'woodPlankDark', 'woodDark', 'wood']);
const NO_CASING = new Set(['garage']);
const CASE_W = 0.09;
const CROWN_H = 0.135;
import { STAIRS, LIFT, LIFT_STOPS, isBasement } from '../config.js';
import { USES, ZONES } from '../schema.js';
import { voidEdges, sideOnWall, RAIL_H } from '../stairs.js';
const overlapR = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 1e-6 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 1e-6;

// ------------------------------------------------------------------ profiles
// Closed cross-sections. First coordinate p = depth off the wall face (into the room).
const BASE = [[0, 0], [0.018, 0], [0.018, 0.09], [0.013, 0.097], [0.013, 0.104], [0.008, 0.114], [0.004, 0.12], [0, 0.12]];
const CROWN = [[0, -0.135], [0.008, -0.135], [0.012, -0.122], [0.022, -0.115], [0.03, -0.1], [0.05, -0.075],
  [0.072, -0.052], [0.09, -0.038], [0.098, -0.03], [0.104, -0.018], [0.112, -0.014], [0.112, 0], [0, 0]];
const CHAIR = [[0, -0.03], [0.01, -0.03], [0.016, -0.02], [0.024, -0.004], [0.024, 0.01], [0.018, 0.02], [0.01, 0.026], [0, 0.026]];
const FRAME = [[0, 0], [0.006, 0], [0.016, 0.01], [0.016, 0.018], [0.01, 0.03], [0.004, 0.04], [0, 0.04]];
const casingProfile = (W) => [[0, 0], [0.022, 0], [0.022, 0.01], [0.017, 0.022], [0.015, W * 0.55], [0.012, W - 0.012], [0.008, W], [0, W]];

// ------------------------------------------------------------------ geometry helpers
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Triangle soup in plan coords; winding fixed from a normal hint; flat normals.
class GB {
  constructor() { this.pos = []; this.uv = []; }
  tri(a, b, c, ta, tb, tc) {
    for (const [p, t] of [[a, ta], [b, tb], [c, tc]]) { this.pos.push(p[0], p[2], -p[1]); this.uv.push(t[0], t[1]); }
  }
  quad(a, b, c, d, ta, tb, tc, td, hint) {
    const n = cross(sub3(c, a), sub3(d, b));
    if (dot(n, n) < 1e-16) return;
    if (dot(n, hint) >= 0) { this.tri(a, b, c, ta, tb, tc); this.tri(a, c, d, ta, tc, td); }
    else { this.tri(a, c, b, ta, tc, tb); this.tri(a, d, c, ta, td, tc); }
  }
  triH(a, b, c, ta, tb, tc, hint) {
    const n = cross(sub3(b, a), sub3(c, a));
    if (dot(n, n) < 1e-16) return;
    if (dot(n, hint) >= 0) this.tri(a, b, c, ta, tb, tc); else this.tri(a, c, b, ta, tc, tb);
  }
  geo() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals();
    return g;
  }
}

// Sweep a closed profile [p, q] along a straight path s ∈ [a, b].
// map(s, p, q) → plan point. e0 / e1(pt) extend (+) or shorten (−) each profile vertex
// at the start / end (mitres). caps: [start, end].
function sweep(prof, map, a, b, e0, e1, caps = [true, true]) {
  const g = new GB();
  const n = prof.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const p = prof[i], q = prof[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
  const sg = area > 0 ? 1 : -1;
  const mid = (a + b) / 2;
  const s0 = [], s1 = [];
  for (const pt of prof) {
    let x0 = a - e0(pt), x1 = b + e1(pt);
    if (x1 - x0 < 1e-4) x0 = x1 = mid;
    s0.push(x0); s1.push(x1);
  }
  let v = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, P0 = prof[i], P1 = prof[j];
    const dp = P1[0] - P0[0], dq = P1[1] - P0[1], len = Math.hypot(dp, dq);
    if (len < 1e-9) continue;
    if (P0[0] < 1e-6 && P1[0] < 1e-6) { v += len; continue; } // hidden against the wall
    const nn = [sg * dq / len, -sg * dp / len];
    const mp = [(P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2];
    const hint = sub3(map(mid, mp[0] + nn[0] * 0.01, mp[1] + nn[1] * 0.01), map(mid, mp[0], mp[1]));
    g.quad(map(s0[i], P0[0], P0[1]), map(s1[i], P0[0], P0[1]), map(s1[j], P1[0], P1[1]), map(s0[j], P1[0], P1[1]),
      [s0[i], v], [s1[i], v], [s1[j], v + len], [s0[j], v + len], hint);
    v += len;
  }
  if (caps[0] || caps[1]) {
    const contour = prof.map(p => new THREE.Vector2(p[0], p[1]));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    const c = prof.reduce((m, p) => [m[0] + p[0] / n, m[1] + p[1] / n], [0, 0]);
    const ends = [];
    if (caps[0]) ends.push([s0, sub3(map(a - 1, c[0], c[1]), map(a, c[0], c[1]))]);
    if (caps[1]) ends.push([s1, sub3(map(b + 1, c[0], c[1]), map(b, c[0], c[1]))]);
    for (const [S, hint] of ends) for (const [i, j, k] of faces) {
      g.triH(map(S[i], prof[i][0], prof[i][1]), map(S[j], prof[j][0], prof[j][1]), map(S[k], prof[k][0], prof[k][1]),
        prof[i], prof[j], prof[k], hint);
    }
  }
  return g.geo();
}

export { sweep as _sweep }; // exposed for tests
const MITRE_IN = (pt) => -pt[0];
const MITRE_W = (pt) => -pt[1];
const MITRE_OUT_W = (pt) => pt[1];
const BUTT = () => 0;

// Cylinder between two plan points.
function rod(p0, p1, r, seg = 8) {
  const a = new THREE.Vector3(p0[0], p0[2], -p0[1]), b = new THREE.Vector3(p1[0], p1[2], -p1[1]);
  const d = b.clone().sub(a), len = d.length();
  if (len < 1e-4) return null;
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
function ball(p, r) {
  const g = new THREE.SphereGeometry(r, 8, 6);
  g.translate(p[0], p[2], -p[1]);
  return g;
}

// Indexed grid → smooth normals → non-indexed. fn(i, j) → plan point; hint plan vector.
function grid(nu, nv, fn, uvfn, hint) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const p = fn(i, j); pos.push(p[0], p[2], -p[1]);
    const t = uvfn(i, j); uv.push(t[0], t[1]);
  }
  const W = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * W + i, b = a + 1, c = a + W + 1, d = a + W;
    idx.push(a, b, c, a, c, d);
  }
  // orientation check on the first quad (world normal vs hint)
  const P = (k) => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
  const n = cross(sub3(P(idx[1]), P(idx[0])), sub3(P(idx[2]), P(idx[0])));
  const hw = [hint[0], hint[2], -hint[1]];
  if (dot(n, hw) < 0) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

function clean(g) {
  if (!g) return null;
  if (g.index) g = g.toNonIndexed();
  g.clearGroups();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

// Interval arithmetic on [a, b] lists.
function cut(list, a, b) {
  const out = [];
  for (const [x0, x1] of list) {
    if (b <= x0 || a >= x1) { out.push([x0, x1]); continue; }
    if (a > x0) out.push([x0, a]);
    if (b < x1) out.push([b, x1]);
  }
  return out.filter(([x0, x1]) => x1 - x0 > 0.02);
}

const normHex = (h, fb) => {
  if (typeof h !== 'string' || h[0] !== '#') return fb;
  let s = h.slice(1).toLowerCase();
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  return /^[0-9a-f]{6}$/.test(s) ? '#' + s : fb;
};
const jointMat = (c, fb) => (typeof c === 'string' && c[0] !== '#' && c.length) ? c : `lacquer:${normHex(c, fb)}`;

// ------------------------------------------------------------------ door leaf
// Classic raised-panel door, origin bottom-centre, X width, Y up, Z thickness (centred).
// 2 panels (narrow leaves) or 4 panels (≥ 0.65 m), lock rail at ~0.95 m.
export function panelDoorGeometry(w = 0.9, h = 2.1, t = 0.045) {
  const parts = [];
  const bx = (x0, x1, y0, y1, z0, z1) => {
    const W = x1 - x0, H = y1 - y0, D = z1 - z0;
    if (W < 1e-4 || H < 1e-4 || D < 1e-4) return;
    const g = new THREE.BoxGeometry(W, H, D);
    const uv = g.attributes.uv;
    const dims = [[D, H], [D, H], [W, D], [W, D], [W, H], [W, H]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    parts.push(clean(g));
  };
  const st = Math.min(0.12, w * 0.15), top = Math.min(0.12, h * 0.07), bot = Math.min(0.22, h * 0.11);
  const cols = w >= 0.65 ? 2 : 1, rows = h > 1.6 ? 2 : 1;
  const mull = 0.1, lock = Math.min(0.18, h * 0.09);
  const lockY = rows === 2 ? Math.min(0.95, h * 0.45) : 0;
  const x0 = -w / 2, x1 = w / 2;
  bx(x0, x0 + st, 0, h, -t / 2, t / 2);
  bx(x1 - st, x1, 0, h, -t / 2, t / 2);
  bx(x0 + st, x1 - st, 0, bot, -t / 2, t / 2);
  bx(x0 + st, x1 - st, h - top, h, -t / 2, t / 2);
  const rowsY = rows === 2
    ? [[bot, lockY - lock / 2], [lockY + lock / 2, h - top]]
    : [[bot, h - top]];
  if (rows === 2) bx(x0 + st, x1 - st, lockY - lock / 2, lockY + lock / 2, -t / 2, t / 2);
  const inner = (x1 - st) - (x0 + st);
  const colsX = cols === 2
    ? [[x0 + st, x0 + st + (inner - mull) / 2], [x1 - st - (inner - mull) / 2, x1 - st]]
    : [[x0 + st, x1 - st]];
  for (const [ya, yb] of rowsY) {
    if (cols === 2) bx(colsX[0][1], colsX[1][0], ya, yb, -t / 2, t / 2);
    for (const [xa, xb] of colsX) {
      bx(xa, xb, ya, yb, -t * 0.22, t * 0.22);                          // recessed board
      bx(xa + 0.035, xb - 0.035, ya + 0.035, yb - 0.035, -t * 0.36, t * 0.36); // raised field
    }
  }
  const g = mergeGeometries(parts, false);
  return g;
}

// ------------------------------------------------------------------ main builder
export function buildFinishes(args) {
  for (const _ of buildFinishesSteps(args)); // eslint-disable-line no-unused-vars
}

// Same build as a generator that yields after every room, so the browser can spread it over
// frames (engine/assemble.js assembleStaged). levels: only these levels' rooms (default all);
// stairs: also build the stair balustrades (default true).
export function* buildFinishesSteps({ Z, INTERIOR, LEVELS, add, lights, levels = null, stairs = true }) {
  const LV = Object.keys(LEVELS).filter(k => Z.floors[k]);
  const put = (group, mat, geo) => { const g = clean(geo); if (g && g.attributes.position.count) add(group, mat, g); };
  const L = lights || [];
  const framedOpenings = new Set();
  const roomsData = (INTERIOR && INTERIOR.rooms) || {};

  for (const lv of LV) {
    if (levels && !levels.includes(lv)) continue;
    const lvl = LEVELS[lv];
    const rooms = Z.floors[lv];
    const openPairs = (Z.open && Z.open[lv]) || [];
    const openings = ((Z.openings && Z.openings[lv]) || []).filter(d => d.t !== 'hatch');
    const isOpen = (a, b) => openPairs.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
    for (const room of rooms) {
      const fin = finishFor(room, lv, roomsData[room.id]);
      buildRoom(lv, lvl, room, rooms, isOpen, openings, fin);
      yield;
    }
  }
  if (stairs) buildStairs();

  // ---------------------------------------------------------------- defaults
  function finishFor(room, lv, entry) {
    const bath = !!USES[room.use]?.wet && room.use !== 'laundry';
    const basementUtil = isBasement(lv) && ['utility', 'garage', 'energy', 'water', 'service'].includes(room.zone);
    const colors = {
      public: '#e3ddd1', private: '#e0d9cb', master: '#e2d8c9', work: '#d9d2c3', hobby: '#d8d3c9', service: '#ebe8e1',
      circulation: '#e6e0d5', utility: '#e2e2de', garage: '#deddd8', energy: '#e2e2de', water: '#e2e2de',
    };
    void ZONES;
    const def = {
      walls: bath ? 'tile' : 'paint',
      wallColor: colors[room.zone] || '#ddd5c6',
      panelColor: '#efe9dc',
      trim: '#f1ece2',
      ceiling: 'flat',
      cove: false,
      crown: !bath && !basementUtil,
      baseboard: !bath,
      curtains: null,
      windowFrame: 'trimWhite',
    };
    const f = { ...def, ...((entry && entry.finish) || {}) };
    f.wallColor = normHex(f.wallColor, def.wallColor);
    f.trim = normHex(f.trim, def.trim);
    return f;
  }

  // ---------------------------------------------------------------- per room
  function buildRoom(lv, lvl, room, rooms, isOpen, openings, fin) {
    const fl = lvl.elev, top = lvl.elev + lvl.h, C = top - 0.3;
    const [rx0, ry0, rx1, ry1] = room.r;
    const ceilGroup = 'ceil_' + lv;

    const neighbour = (edge, c) => {
      for (const o of rooms) {
        if (o === room) continue;
        const [ox0, oy0, ox1, oy1] = o.r;
        let hit = false;
        if (edge === 'S') hit = Math.abs(oy1 - ry0) < EPS && ox0 <= c + EPS && ox1 >= c + CELL - EPS;
        if (edge === 'N') hit = Math.abs(oy0 - ry1) < EPS && ox0 <= c + EPS && ox1 >= c + CELL - EPS;
        if (edge === 'W') hit = Math.abs(ox1 - rx0) < EPS && oy0 <= c + EPS && oy1 >= c + CELL - EPS;
        if (edge === 'E') hit = Math.abs(ox0 - rx1) < EPS && oy0 <= c + EPS && oy1 >= c + CELL - EPS;
        if (hit) return o;
      }
      return null;
    };
    const cls = (edge, c) => {
      const o = neighbour(edge, c);
      if (!o) return 'ext';
      return isOpen(room.id, o.id) ? 'open' : 'int';
    };
    const EDGES = {
      S: { o: 'h', e: ry0, n: 1, u0: rx0, u1: rx1, p0: ['W', ry0], p1: ['E', ry0] },
      N: { o: 'h', e: ry1, n: -1, u0: rx0, u1: rx1, p0: ['W', ry1 - CELL], p1: ['E', ry1 - CELL] },
      W: { o: 'v', e: rx0, n: 1, u0: ry0, u1: ry1, p0: ['S', rx0], p1: ['N', rx0] },
      E: { o: 'v', e: rx1, n: -1, u0: ry0, u1: ry1, p0: ['S', rx1 - CELL], p1: ['N', rx1 - CELL] },
    };

    // Face segments with uniform wall class
    const faces = [];
    const walled = {};
    for (const [name, E] of Object.entries(EDGES)) {
      const segs = [];
      for (let c = E.u0; c < E.u1 - EPS; c += CELL) {
        const k = cls(name, c);
        const last = segs[segs.length - 1];
        if (last && last.cls === k) last.b = c + CELL; else segs.push({ cls: k, a: c, b: c + CELL });
      }
      walled[name] = segs.some(s => s.cls !== 'open');
      for (const s of segs) {
        if (s.cls === 'open') continue;
        const inset = INSET[s.cls];
        let u0 = s.a, u1 = s.b, end0 = 'butt', end1 = 'butt';
        if (Math.abs(s.a - E.u0) < EPS) {
          const pc = cls(...E.p0);
          if (pc !== 'open') { u0 += INSET[pc]; end0 = 'in'; }
        }
        if (Math.abs(s.b - E.u1) < EPS) {
          const pc = cls(...E.p1);
          if (pc !== 'open') { u1 -= INSET[pc]; end1 = 'in'; }
        }
        faces.push({ edge: name, o: E.o, e: E.e, n: E.n, f: E.e + E.n * inset, t: inset * 2, cls: s.cls, u0, u1, end0, end1 });
      }
    }

    // Voids (stairs) near the faces
    const floorVoids = [], ceilVoids = [];
    for (const S of STAIRS) {
      if (S.to === lv && overlapR(room.r, S.r)) floorVoids.push(S.r);
      if (S.from === lv && overlapR(room.r, S.r)) ceilVoids.push(S.r);
    }
    if (LIFT && LIFT_STOPS.includes(lv) && overlapR(room.r, LIFT.r)) {
      if (lv !== LIFT_STOPS[0]) floorVoids.push(LIFT.r);
      if (lv !== LIFT_STOPS[LIFT_STOPS.length - 1]) ceilVoids.push(LIFT.r);
    }
    const voidSpans = (F, voids) => {
      const out = [];
      for (const v of voids) {
        const probe = F.f + F.n * 0.1;
        if (F.o === 'h' ? (probe > v[1] && probe < v[3]) : (probe > v[0] && probe < v[2]))
          out.push(F.o === 'h' ? [v[0], v[2]] : [v[1], v[3]]);
      }
      return out;
    };

    // Openings per face
    for (const F of faces) {
      F.ops = openings
        .filter(d => d.o === F.o && Math.abs((F.o === 'h' ? d.y : d.x) - F.e) < EPS)
        .map(d => {
          const a0 = F.o === 'h' ? d.x : d.y;
          const a = Math.max(a0, F.u0), b = Math.min(a0 + d.w, F.u1);
          let z0, z1;
          if (d.t === 'window') { z0 = fl + 0.9; z1 = fl + 2.3; }
          else if (d.t === 'glass') { z0 = fl + 0.05; z1 = fl + 2.7; }
          else if (d.t === 'high') { z0 = fl + 2.4; z1 = Math.min(top - 0.35, fl + 3.2); }
          else { z0 = fl; z1 = fl + (DOOR_TOP[d.t] || 2.2); }
          const door = !['window', 'glass', 'high'].includes(d.t);
          return { d, a, b, a0, b0: a0 + d.w, z0, z1, door, t: d.t, cw: 0 };
        })
        .filter(o => o.b - o.a > 0.05)
        .sort((p, q) => p.a - q.a);
      // casing widths limited by neighbours / face ends
      F.ops.forEach((o, i) => {
        if (NO_CASING.has(o.t)) return;
        const prevEnd = i > 0 ? F.ops[i - 1].b : F.u0;
        const nextStart = i < F.ops.length - 1 ? F.ops[i + 1].a : F.u1;
        const lspace = i > 0 ? (o.a - prevEnd) / 2 : o.a - prevEnd - 0.005;
        const rspace = i < F.ops.length - 1 ? (nextStart - o.b) / 2 : nextStart - o.b - 0.005;
        const clipped = o.a > o.a0 + EPS || o.b < o.b0 - EPS;
        let cw = Math.min(CASE_W, lspace, rspace);
        if (clipped || cw < 0.045) cw = 0;
        o.cw = cw;
      });
    }

    const maxHead = Math.max(fl, ...faces.flatMap(F => F.ops.map(o => o.z1)));
    const voided = ceilVoids.length > 0 || floorVoids.length > 0;

    // Ceiling style & dimensions
    let ceiling = fin.ceiling || 'flat';
    const R = [rx0 + (walled.W ? INSET.int : 0), ry0 + (walled.S ? INSET.int : 0), rx1 - (walled.E ? INSET.int : 0), ry1 - (walled.N ? INSET.int : 0)];
    const rw = R[2] - R[0], rd = R[3] - R[1];
    let trayD = 0;
    if (ceiling === 'tray') {
      trayD = Math.min(0.25, C - maxHead - 0.03);
      if (trayD < 0.08 || Math.min(rw, rd) < 2.4 || voided) { ceiling = 'flat'; trayD = 0; }
    }
    if ((ceiling === 'coffered' || ceiling === 'beams') && (voided || Math.min(rw, rd) < 1.5)) ceiling = 'flat';
    let friezeD = 0;
    if (ceiling === 'coffered') {
      friezeD = Math.min(0.2, C - maxHead - 0.02);
      if (friezeD < 0.1) friezeD = 0;
    }
    const crownTop = C - Math.max(trayD, friezeD);
    const crownBot = crownTop - CROWN_H;

    // Materials
    const paint = `paint:${fin.wallColor}`;
    const trim = `lacquer:${fin.trim}`;
    const panelMat = jointMat(fin.panelColor, '#efe9dc');
    const isWoodPanel = typeof fin.panelColor === 'string' && fin.panelColor[0] !== '#';
    const wallMode = fin.walls || 'paint';
    const baseMat = (wallMode === 'wainscot' || (wallMode === 'panel' && isWoodPanel)) ? panelMat : trim;
    const caseMat = (wallMode === 'panel' && isWoodPanel) ? panelMat : (fin.windowFrame === 'walnut' ? 'walnut' : trim);
    const skinMat = {
      paint, wainscot: paint, panel: panelMat, wallpaper: 'wallpaperDamask', tile: 'tileBath',
      concrete: 'concreteWall', acoustic: 'paint:#2b2522',
    }[wallMode] || paint;

    const P = (F, u, d, z) => F.o === 'h' ? [u, F.f + F.n * d, z] : [F.f + F.n * d, u, z];
    const inward = (F) => F.o === 'h' ? [0, F.n, 0] : [F.n, 0, 0];
    const vplane = (F, u0, u1, z0, z1, d, mat) => {
      if (u1 - u0 < 1e-3 || z1 - z0 < 1e-3) return;
      const g = new GB();
      g.quad(P(F, u0, d, z0), P(F, u1, d, z0), P(F, u1, d, z1), P(F, u0, d, z1),
        [u0, z0], [u1, z0], [u1, z1], [u0, z1], inward(F));
      put(lv, mat, g.geo());
    };
    const endExt = (F, s, isStart) => {
      const atEnd = isStart ? Math.abs(s - F.u0) < 1e-4 : Math.abs(s - F.u1) < 1e-4;
      const type = isStart ? F.end0 : F.end1;
      return atEnd && type === 'in' ? MITRE_IN : BUTT;
    };
    const run = (F, prof, s0, s1, zBase, mat, group = lv) => {
      const e0 = endExt(F, s0, true), e1 = endExt(F, s1, false);
      put(group, mat, sweep(prof, (s, p, q) => P(F, s, p, zBase + q), s0, s1, e0, e1, [e0 === BUTT, e1 === BUTT]));
    };
    const pictureFrame = (F, u0, u1, z0, z1, mat) => {
      if (u1 - u0 < 0.15 || z1 - z0 < 0.15) return;
      put(lv, mat, sweep(FRAME, (s, p, w) => P(F, s, p, z0 + w), u0, u1, MITRE_W, MITRE_W, [false, false]));
      put(lv, mat, sweep(FRAME, (s, p, w) => P(F, s, p, z1 - w), u0, u1, MITRE_W, MITRE_W, [false, false]));
      put(lv, mat, sweep(FRAME, (s, p, w) => P(F, u0 + w, p, s), z0, z1, MITRE_W, MITRE_W, [false, false]));
      put(lv, mat, sweep(FRAME, (s, p, w) => P(F, u1 - w, p, s), z0, z1, MITRE_W, MITRE_W, [false, false]));
    };
    const framesIn = (F, list, z0, z1, mat, target = 0.85) => {
      const m = 0.1;
      for (const [a, b] of list) {
        const len = b - a;
        if (len < 0.45) continue;
        const n = Math.max(1, Math.round((len - m) / (target + m)));
        const pw = (len - (n + 1) * m) / n;
        for (let i = 0; i < n; i++) {
          const u0 = a + m + i * (pw + m);
          pictureFrame(F, u0, u0 + pw, z0, z1, mat);
        }
      }
    };
    const freeSpans = (F, pred, extra = 0) => {
      let list = [[F.u0, F.u1]];
      for (const o of F.ops) if (pred(o)) list = cut(list, o.a - o.cw - extra, o.b + o.cw + extra);
      return list;
    };

    for (const F of faces) {
      const fv = voidSpans(F, floorVoids), cv = voidSpans(F, ceilVoids);
      const holes = F.ops.map(o => [o.a, o.z0, o.b, o.z1]);

      // ---- skins
      const skin = (z0, z1, mat) => {
        for (const r of subtract([F.u0, z0, F.u1, z1], holes)) vplane(F, r[0], r[2], r[1], r[3], 0.005, mat);
      };
      if (wallMode === 'wainscot') { skin(fl, fl + 1.0, panelMat); skin(fl + 1.0, C, paint); }
      else skin(fl, C, skinMat);
      for (const [a, b] of cv) // stairwell: carry the skin up to the next floor
        for (const r of subtract([Math.max(a, F.u0), C, Math.min(b, F.u1), top], holes)) vplane(F, r[0], r[2], r[1], r[3], 0.005, skinMat === 'paint:#2b2522' ? paint : skinMat);

      // ---- baseboard
      if (fin.baseboard) {
        let list = freeSpans(F, o => o.z0 < fl + 0.15);
        for (const [a, b] of fv) list = cut(list, a - 0.05, b + 0.05);
        for (const [a, b] of list) run(F, BASE, a, b, fl, baseMat);
      }

      // ---- crown
      if (fin.crown) {
        let list = freeSpans(F, o => o.z1 > crownBot - 0.005, 0);
        for (const [a, b] of cv) list = cut(list, a - 0.05, b + 0.05);
        for (const [a, b] of list) run(F, CROWN, a, b, crownTop, trim);
      }

      // ---- wainscot / panelling / acoustic
      if (wallMode === 'wainscot' || wallMode === 'panel') {
        const railZ = fl + (wallMode === 'wainscot' ? 0.972 : 0.95);
        let low = freeSpans(F, o => o.z0 < railZ + 0.03, 0.02);
        for (const [a, b] of fv) low = cut(low, a - 0.05, b + 0.05);
        for (const [a, b] of low) run(F, CHAIR, a, b, railZ, panelMat);
        framesIn(F, low, fl + 0.22, railZ - 0.1, panelMat);
        if (wallMode === 'panel') {
          const uTop = (fin.crown ? crownBot : C) - 0.16;
          if (uTop - (railZ + 0.18) > 0.5) {
            let up = freeSpans(F, () => true, 0.02);
            for (const [a, b] of fv) up = cut(up, a - 0.05, b + 0.05);
            framesIn(F, up, railZ + 0.18, uTop, panelMat);
          }
        }
      } else if (wallMode === 'acoustic') {
        let list = freeSpans(F, () => true, 0.03);
        for (const [a, b] of fv) list = cut(list, a - 0.05, b + 0.05);
        const z0 = fl + (fin.baseboard ? 0.2 : 0.1), z1 = (fin.crown ? crownBot : C) - 0.08;
        const rowsN = z1 - z0 > 2.2 ? 2 : 1;
        for (const [a, b] of list) {
          const len = b - a;
          if (len < 0.3) continue;
          const n = Math.max(1, Math.round(len / 0.6)), pw = len / n;
          for (let i = 0; i < n; i++) for (let k = 0; k < rowsN; k++) {
            const u0 = a + i * pw + 0.008, u1 = a + (i + 1) * pw - 0.008;
            const za = z0 + (z1 - z0) * k / rowsN + 0.008, zb = z0 + (z1 - z0) * (k + 1) / rowsN - 0.008;
            const p0 = P(F, u0, 0.005, za), p1 = P(F, u1, 0.045, zb);
            put(lv, 'acousticPanel', box(Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1]), za, zb));
          }
        }
      }

      // ---- casings, stools, frames, curtains
      for (const o of F.ops) {
        const style = fin.windowFrame || 'trimWhite';
        if (o.cw > 0) {
          const plainWindow = !o.door && style === 'ironBlack';
          const headFits = o.z1 + o.cw < (fin.crown ? crownBot : C) - 0.01;
          if (!plainWindow && headFits) casing(F, o, o.z0 > fl + 0.1 && o.t !== 'glass' ? o.z0 : fl, caseMat);
        }
        if (o.t === 'window') stool(F, o, style === 'ironBlack' ? trim : caseMat);
        if (!o.door || o.t === 'sliding' || o.t === 'folding') windowFrame(F, o, style);
        if (fin.curtains && ['window', 'glass', 'sliding', 'folding'].includes(o.t)) curtains(F, o, fin);
      }
    }

    // ---- ceilings
    const ceilMat = lv[0] === 'B' ? 'ceilingBase' : 'ceiling';
    const ring = (outer, inner, z0, z1, mat) => {
      for (const r of subtract(outer, [inner])) put(ceilGroup, mat, box(r[0], r[1], r[2], r[3], z0, z1));
    };
    const grow = (r, d) => [r[0] - d, r[1] - d, r[2] + d, r[3] + d];
    if (ceiling === 'tray') {
      const W = Math.max(0.5, Math.min(0.85, Math.min(rw, rd) * 0.15));
      const I = grow(R, -W), Ib = grow(I, 0.16);
      const zb = C - trayD;
      ring(R, I, zb, zb + 0.05, ceilMat);                 // soffit slab
      ring(R, Ib, zb + 0.05, C, ceilMat);                 // set-back body
      ring(grow(I, 0.03), I, zb + 0.05, zb + 0.11, ceilMat); // cove lip
      if (fin.cove) {
        ring(Ib, grow(Ib, -0.025), zb + 0.05, zb + 0.065, 'coveLight');
        const z = zb + 0.09, add1 = (x, y) => L.push({ x, y, z, color: '#ffcf8a', intensity: 1.5, distance: 3.5, level: lv, room: room.id, kind: 'cove' });
        const sides = [
          [[Ib[0], Ib[1]], [Ib[2], Ib[1]]], [[Ib[2], Ib[1]], [Ib[2], Ib[3]]],
          [[Ib[2], Ib[3]], [Ib[0], Ib[3]]], [[Ib[0], Ib[3]], [Ib[0], Ib[1]]],
        ];
        for (const [p, q] of sides) {
          const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
          const k = len > 5 ? 2 : 1;
          for (let i = 0; i < k; i++) {
            const t = (i + 0.5) / k;
            // pull slightly into the tray so the light reaches the raised ceiling
            const cx = (Ib[0] + Ib[2]) / 2, cy = (Ib[1] + Ib[3]) / 2;
            const x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
            add1(x + Math.sign(cx - x) * 0.15 * (Math.abs(cx - x) > 0.2 ? 1 : 0), y + Math.sign(cy - y) * 0.15 * (Math.abs(cy - y) > 0.2 ? 1 : 0));
          }
        }
      }
    } else if (ceiling === 'coffered') {
      const mat = isWoodPanel ? panelMat : trim;
      const bw = 0.14, bd = 0.2;
      let I = R;
      if (friezeD > 0) {
        const fw = 0.12;
        I = grow(R, -fw);
        ring(R, I, C - friezeD, C, mat);
      }
      const iw = I[2] - I[0], id = I[3] - I[1];
      const nx = Math.max(1, Math.round(iw / 1.4)), ny = Math.max(1, Math.round(id / 1.4));
      const xs = [], ys = [];
      for (let i = 1; i < nx; i++) xs.push(I[0] + iw * i / nx);
      for (let j = 1; j < ny; j++) ys.push(I[1] + id * j / ny);
      for (const x of xs) {
        put(ceilGroup, mat, box(x - bw / 2, I[1], x + bw / 2, I[3], C - bd, C));
        put(ceilGroup, mat, box(x - bw / 2 - 0.02, I[1], x + bw / 2 + 0.02, I[3], C - bd - 0.025, C - bd));
      }
      const cutsX = [I[0], ...xs.flatMap(x => [x - bw / 2 - 0.02, x + bw / 2 + 0.02]), I[2]];
      for (const y of ys) for (let k = 0; k < cutsX.length; k += 2) {
        put(ceilGroup, mat, box(cutsX[k], y - bw / 2, cutsX[k + 1], y + bw / 2, C - bd, C));
        put(ceilGroup, mat, box(cutsX[k], y - bw / 2 - 0.02, cutsX[k + 1], y + bw / 2 + 0.02, C - bd - 0.025, C - bd));
      }
    } else if (ceiling === 'beams') {
      const mat = isWoodPanel ? panelMat : 'walnut';
      const bd = Math.max(0.12, Math.min(0.22, C - maxHead - 0.02)), bw = 0.18;
      const alongX = rw <= rd; // beams span the short direction
      const span = alongX ? rd : rw;
      const n = Math.max(1, Math.round(span / 1.6));
      for (let i = 0; i <= n; i++) {
        if (i === 0 || i === n) continue;
        const c = (alongX ? R[1] : R[0]) + span * i / n;
        if (alongX) put(ceilGroup, mat, box(R[0], c - bw / 2, R[2], c + bw / 2, C - bd, C));
        else put(ceilGroup, mat, box(c - bw / 2, R[1], c + bw / 2, R[3], C - bd, C));
      }
      // ledger boards along the bearing walls
      if (alongX) {
        put(ceilGroup, mat, box(R[0], R[1], R[0] + 0.08, R[3], C - 0.1, C));
        put(ceilGroup, mat, box(R[2] - 0.08, R[1], R[2], R[3], C - 0.1, C));
      } else {
        put(ceilGroup, mat, box(R[0], R[1], R[2], R[1] + 0.08, C - 0.1, C));
        put(ceilGroup, mat, box(R[0], R[3] - 0.08, R[2], R[3], C - 0.1, C));
      }
    }

    // ---------------------------------------------------- opening helpers
    function casing(F, o, zFloor, mat) {
      const W = o.cw, prof = casingProfile(W);
      const H = o.z1;
      put(lv, mat, sweep(prof, (s, p, w) => P(F, o.a - w, p, s), zFloor, H, BUTT, MITRE_OUT_W, [true, false]));
      put(lv, mat, sweep(prof, (s, p, w) => P(F, o.b + w, p, s), zFloor, H, BUTT, MITRE_OUT_W, [true, false]));
      put(lv, mat, sweep(prof, (s, p, w) => P(F, s, p, H + w), o.a, o.b, MITRE_OUT_W, MITRE_OUT_W, [false, false]));
      if (o.t === 'window' && zFloor > fl + 0.1) { // apron under the stool
        const a = o.a - W, b = o.b + W;
        put(lv, mat, sweep(prof, (s, p, w) => P(F, s, p, zFloor - 0.035 - w), a + 0.02, b - 0.02, BUTT, BUTT));
      }
    }
    function stool(F, o, mat) {
      const ext = o.cw > 0 ? o.cw + 0.03 : 0.04;
      const a = Math.max(F.u0, o.a - ext), b = Math.min(F.u1, o.b + ext);
      const p0 = P(F, a, -(F.t / 2 - 0.03), o.z0 - 0.035), p1 = P(F, b, 0.05, o.z0);
      put(lv, mat, box(Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1]), p0[2], p1[2]));
    }
    // Frame + mullion grid in the glass plane, built once per opening (through the wall).
    function windowFrame(F, o, style) {
      if (framedOpenings.has(o.d)) return;
      framedOpenings.add(o.d);
      const mat = style === 'ironBlack' ? 'ironBlack' : style === 'walnut' ? 'walnut' : 'trimWhite';
      const S = style === 'ironBlack'
        ? { per: 0.045, bar: 0.026, col: 0.5, row: 0.45 }
        : { per: 0.06, bar: 0.03, col: 0.42, row: 0.42 };
      const half = F.t / 2;
      const mem = (u0, u1, z0, z1, d0, d1) => { // d measured along the room normal from the wall centre
        const a = P(F, u0, d0 - (F.f - F.e) * F.n, z0), b = P(F, u1, d1 - (F.f - F.e) * F.n, z1);
        put(lv, mat, box(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), z0, z1));
      };
      if (o.t === 'sliding' || o.t === 'folding') {
        const m = o.a0 + (o.b0 - o.a0) / 2, dt = o.z1;
        const dj = half + 0.012;
        mem(o.a, o.a + 0.05, fl, dt, -dj, dj);          // jamb inside the parked half
        mem(o.b, o.b + 0.05, fl, dt, -dj, dj);          // jamb in the wall beyond the walkable half
        mem(o.a, o.b + 0.05, dt - 0.05, dt, -dj, dj);
        // parked panel (first half): stiles, rails and grid at ±0.04 around the centre
        const pa = Math.max(o.a, o.a0), pb = Math.min(m, o.b);
        if (pb - pa < 0.2) return;
        const dp = 0.042;
        mem(pb - 0.06, pb, fl, dt - 0.05, -dp, dp);
        mem(pa, pb, fl, fl + 0.12, -dp, dp);
        if (style === 'ironBlack') {
          const cols = Math.max(1, Math.round((pb - pa) / S.col));
          for (let i = 1; i < cols; i++) { const u = pa + (pb - 0.06 - pa) * i / cols; mem(u - S.bar / 2, u + S.bar / 2, fl + 0.12, dt - 0.05, -dp, dp); }
          const rows = Math.max(2, Math.round((dt - fl - 0.17) / S.row));
          for (let j = 1; j < rows; j++) { const z = fl + 0.12 + (dt - 0.05 - fl - 0.12) * j / rows; mem(pa, pb - 0.06, z - S.bar / 2, z + S.bar / 2, -dp, dp); }
        } else {
          const z = fl + 0.12 + (dt - fl - 0.17) * 0.62;
          mem(pa, pb - 0.06, z - 0.03, z + 0.03, -dp, dp);
        }
        return;
      }
      const d0 = -(half + 0.012), d1 = half + 0.012;
      const { a, b, z0, z1 } = o;
      mem(a, a + S.per, z0, z1, d0, d1);
      mem(b - S.per, b, z0, z1, d0, d1);
      mem(a + S.per, b - S.per, z0, z0 + S.per, d0, d1);
      mem(a + S.per, b - S.per, z1 - S.per, z1, d0, d1);
      const ia = a + S.per, ib = b - S.per, iz0 = z0 + S.per, iz1 = z1 - S.per;
      const cols = Math.max(1, Math.round((ib - ia) / S.col));
      const rows = Math.max(1, Math.round((iz1 - iz0) / S.row));
      const bd0 = -(half + 0.006), bd1 = half + 0.006;
      for (let i = 1; i < cols; i++) { const u = ia + (ib - ia) * i / cols; mem(u - S.bar / 2, u + S.bar / 2, iz0, iz1, bd0, bd1); }
      const cutsU = [ia];
      for (let i = 1; i < cols; i++) { const u = ia + (ib - ia) * i / cols; cutsU.push(u - S.bar / 2, u + S.bar / 2); }
      cutsU.push(ib);
      for (let j = 1; j < rows; j++) {
        const z = iz0 + (iz1 - iz0) * j / rows;
        for (let k = 0; k < cutsU.length; k += 2) mem(cutsU[k], cutsU[k + 1], z - S.bar / 2, z + S.bar / 2, bd0, bd1);
      }
    }
    function curtains(F, o, fin) {
      const door = o.t === 'sliding' || o.t === 'folding';
      const drapeMat = fin.curtains;
      const rodMat = fin.windowFrame === 'ironBlack' ? 'ironBlack' : 'brassAged';
      const limitTop = (fin.crown ? crownBot : crownTop) - 0.04;
      const zr = Math.max(fl + 2.25, Math.min(limitTop, o.z1 + 0.25));
      const stack = Math.min(0.45, Math.max(0.3, (o.b - o.a) * 0.15));
      // never reach past the neighbouring openings on this face
      const lo = Math.max(F.u0 + 0.04, ...F.ops.filter(q => q !== o && q.b <= o.a + EPS).map(q => q.b + 0.01));
      const hi = Math.min(F.u1 - 0.04, ...F.ops.filter(q => q !== o && q.a >= o.b - EPS).map(q => q.a - 0.01));
      const ra = Math.max(lo, o.a - stack), rb = Math.min(hi, o.b + stack);
      const dRod = 0.13;
      // rod, finials, brackets
      put(lv, rodMat, rod(P(F, ra, dRod, zr), P(F, rb, dRod, zr), 0.014, 10));
      put(lv, rodMat, ball(P(F, ra, dRod, zr), 0.03));
      put(lv, rodMat, ball(P(F, rb, dRod, zr), 0.03));
      for (const u of [ra + 0.08, rb - 0.08]) put(lv, rodMat, rod(P(F, u, 0, zr), P(F, u, dRod, zr), 0.008, 6));
      // drape panels
      const zb = fl + 0.012, zt = zr - 0.025;
      let left, right;
      if (door) {
        // pulled clear of the walkable half: stacked on the wall beside the opening
        const walkA = o.d.t === 'sliding' || o.d.t === 'folding' ? o.a0 + (o.b0 - o.a0) / 2 : o.a;
        left = [ra, Math.min(o.a + 0.12, walkA - 0.02)];
        right = [o.b, rb];
        if (right[1] - right[0] < 0.18) { left = [ra, Math.min(o.a + 0.3, walkA - 0.02)]; right = null; }
      } else {
        left = [ra, Math.min(o.a + 0.22, (o.a + o.b) / 2)];
        right = [Math.max(o.b - 0.22, (o.a + o.b) / 2), rb];
      }
      for (const span of [left, right]) {
        if (!span || span[1] - span[0] < 0.12) continue;
        put(lv, drapeMat, drape(F, span[0], span[1], zb, zt, 0.075, 0.045, 0.12));
        if (door) put(lv, 'sheer', drape(F, span[0] + 0.02, span[1] - 0.02, zb, zt, 0.04, 0.025, 0.1, 4));
      }
      if (!door) put(lv, 'sheer', drape(F, ra + 0.03, rb - 0.03, zb, zt, 0.035, 0.02, 0.1, 4));
    }
    // Gathered fabric: wavy sheet, two-sided (front + back offset 4 mm).
    function drape(F, u0, u1, z0, z1, d0, amp, pitch, perFold = 6) {
      const folds = Math.max(2, Math.round((u1 - u0) / pitch));
      const nu = folds * perFold, nv = 4;
      const pos = (back) => (i, j) => {
        const t = j / nv; // 0 bottom … 1 top
        const a = amp * (1.15 - 0.55 * t);
        const u = u0 + (u1 - u0) * i / nu;
        const d = d0 + a * (0.5 - 0.5 * Math.cos(2 * Math.PI * folds * i / nu)) - (back ? 0.004 : 0);
        return P(F, u, d, z0 + (z1 - z0) * t);
      };
      const uvf = (i, j) => [(u1 - u0) * i / nu, (z1 - z0) * j / nv];
      const inv = inward(F);
      const front = grid(nu, nv, pos(false), uvf, inv);
      const back = grid(nu, nv, pos(true), uvf, [-inv[0], -inv[1], -inv[2]]);
      return mergeGeometries([front, back], false);
    }
  }

  // ---------------------------------------------------------------- stairs
  function buildStairs() {
    const railR = 0.024;
    const wallRail = (group, mat, bracketMat, pts, wallAt) => {
      // pts: plan points along the rail; wallAt(p) → plan point on the wall behind (or null)
      for (let i = 0; i < pts.length - 1; i++) put(group, mat, rod(pts[i], pts[i + 1], railR, 10));
      for (const p of pts) put(group, mat, ball(p, railR * 1.05));
      const total = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2]), 0);
      const nb = Math.max(2, Math.round(total / 1.1) + 1);
      for (let k = 0; k < nb; k++) {
        const t = (k + 0.5) / nb;
        // locate the point at parameter t along the polyline
        let acc = 0, target = t * total;
        for (let i = 0; i < pts.length - 1; i++) {
          const seg = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2]);
          if (acc + seg >= target) {
            const f = (target - acc) / seg;
            const p = [0, 1, 2].map(c => pts[i][c] + (pts[i + 1][c] - pts[i][c]) * f);
            const w = wallAt(p);
            if (w) {
              const pb = [p[0], p[1], p[2] - 0.05];
              put(group, bracketMat, rod(pb, [w[0], w[1], pb[2]], 0.007, 6));
              put(group, bracketMat, rod(pb, [p[0], p[1], p[2] - railR], 0.007, 6));
            }
            break;
          }
          acc += seg;
        }
      }
    };
    const balustrade = (group, p0, p1, z0, H = 1.0) => {
      const ux = Math.sign(p1[0] - p0[0]), uy = Math.sign(p1[1] - p0[1]);
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const along = (s) => [p0[0] + ux * s, p0[1] + uy * s];
      const rect = (s0, s1, half) => {
        const a = along(s0), b = along(s1);
        return ux !== 0 ? [Math.min(a[0], b[0]), a[1] - half, Math.max(a[0], b[0]), a[1] + half]
          : [a[0] - half, Math.min(a[1], b[1]), a[0] + half, Math.max(a[1], b[1])];
      };
      const np = 0.045;
      for (const s of [np, len - np]) { const r = rect(s - np, s + np, np); put(group, 'walnut', box(r[0], r[1], r[2], r[3], z0, z0 + H + 0.06)); }
      { const r = rect(np * 2, len - np * 2, 0.035); put(group, 'walnut', box(r[0], r[1], r[2], r[3], z0 + H - 0.05, z0 + H)); }
      { const r = rect(np * 2, len - np * 2, 0.012); put(group, 'ironBlack', box(r[0], r[1], r[2], r[3], z0 + 0.08, z0 + 0.1)); }
      const n = Math.max(1, Math.floor((len - 4 * np) / 0.11));
      for (let i = 0; i <= n; i++) {
        const s = 2 * np + (len - 4 * np) * i / n;
        const q = along(s);
        put(group, 'ironBlack', rod([q[0], q[1], z0 + 0.1], [q[0], q[1], z0 + H - 0.05], 0.0095, 6));
        if (i % 2 === 0) put(group, 'ironBlack', ball([q[0], q[1], z0 + 0.5], 0.022)); // collar
      }
    };

    // Stairs from the data (engine/stairs.js): a handrail on each side of every flight (bracketed to
    // the wall when there is one, else a balustrade), a rail along the landing's far wall, and a
    // balustrade on the void edges of the upper floor.
    const slopedBalustrade = (group, F, S, t, inwards) => {
      // posts at both ends, a top rail following the pitch, balusters every ~0.11 m from the step nose line
      const z = (s) => F.hStart + F.riser + (F.hEnd - F.hStart) * (s - F.sStart) / (F.sEnd - F.sStart);
      const tt = t + inwards * 0.05;
      const a = [...S.frame.P(F.sStart, tt), z(F.sStart) + RAIL_H], b = [...S.frame.P(F.sEnd, tt), z(F.sEnd) + RAIL_H];
      put(group, 'walnut', rod(a, b, 0.03, 10));
      const len = Math.abs(F.sEnd - F.sStart), n = Math.max(2, Math.floor(len / 0.11));
      for (let i = 0; i <= n; i++) {
        const sv = F.sStart + (F.sEnd - F.sStart) * i / n, p = S.frame.P(sv, tt);
        const zb = z(sv) - F.riser + 0.02;
        put(group, 'ironBlack', rod([p[0], p[1], zb], [p[0], p[1], z(sv) + RAIL_H - 0.03], 0.0095, 6));
      }
      for (const sv of [F.sStart, F.sEnd]) {
        const p = S.frame.P(sv, tt);
        put(group, 'walnut', box(p[0] - 0.045, p[1] - 0.045, p[0] + 0.045, p[1] + 0.045, z(sv) - F.riser, z(sv) + RAIL_H + 0.06));
      }
    };
    for (const S of STAIRS) {
      if (S.rail === false) continue;
      const lv = S.from, basement = isBasement(lv);
      const mat = basement ? 'steelBrushed' : 'walnut', bm = basement ? 'steelBrushed' : 'brassAged';
      for (const F of S.flights) {
        for (const [t, inwards] of [[F.t0, 1], [F.t1, -1]]) {
          if (!sideOnWall(S, Z, t)) { slopedBalustrade(lv, F, S, t, inwards); continue; }
          const tr = t + inwards * 0.065, tw = t;
          const z = (sv) => F.hStart + F.riser + (F.hEnd - F.hStart) * (sv - F.sStart) / (F.sEnd - F.sStart) + RAIL_H;
          const pa = S.frame.P(F.sStart, tr), pb = S.frame.P(F.sEnd, tr);
          const wa = S.frame.P(F.sStart, tw), wb = S.frame.P(F.sEnd, tw);
          const toWall = (p) => {
            const k = Math.abs(pb[0] - pa[0]) > Math.abs(pb[1] - pa[1]) ? (p[0] - pa[0]) / (pb[0] - pa[0]) : (p[1] - pa[1]) / (pb[1] - pa[1]);
            return [wa[0] + (wb[0] - wa[0]) * k, wa[1] + (wb[1] - wa[1]) * k];
          };
          wallRail(lv, mat, bm, [[...pa, z(F.sStart)], [...pb, z(F.sEnd)]], toWall);
        }
      }
      if (S.landing) {
        // rail along the landing's far wall (s = L)
        const L = S.frame.L, zl = S.landing.z + RAIL_H;
        const pa = S.frame.P(L - 0.065 - 0.15, 0.2), pb = S.frame.P(L - 0.065 - 0.15, S.frame.W - 0.2);
        const wa = S.frame.P(L - 0.15, 0.2), wb = S.frame.P(L - 0.15, S.frame.W - 0.2);
        wallRail(lv, mat, bm, [[...pa, zl], [...pb, zl]], (p) => {
          const k = Math.abs(pb[0] - pa[0]) > Math.abs(pb[1] - pa[1]) ? (p[0] - pa[0]) / (pb[0] - pa[0]) : (p[1] - pa[1]) / (pb[1] - pa[1]);
          return [wa[0] + (wb[0] - wa[0]) * k, wa[1] + (wb[1] - wa[1]) * k];
        });
      }
      // Void edges on the upper floor
      for (const [x0, y0, x1, y1] of voidEdges(S, Z)) balustrade(S.to, [x0, y0], [x1, y1], S.B);
    }
  }
}
