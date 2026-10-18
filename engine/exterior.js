// Exterior detailing + landscape, all derived from the data (optional feature 'site' / 'garden').
//
//   buildExterior({ Z, LEVELS, HOLES, add, physics, getMaterial }) → { objects, lights }
//   buildExteriorSteps(…)  the same as a generator (staged build on phones)
//   makeTrees(list, getMaterial) → Mesh[]   photo vegetation: trees, beds, hedges, lawn tufts
//
// House: a plinth band on the ground floor, window sills, a slim band at each floor line (style
// 'mediterranean' adds a stone plinth, travertine sills + surrounds and a cornice), wall lanterns
// beside every exterior door (lights at night), ridge / hip caps on the pitched roofs.
// Garden: planting beds, hedges, lawn grass tufts, the pergola's climber and every tree become
// photo vegetation (engine/garden/photo.js), one mesh per 16 m garden cell. Bollard lights line
// the paths; the pool gets a ladder and an underwater light.
// Colliders only for solid obstacles; doors and paths stay clear. Deterministic: no Math.random.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Z as ZDATA, PROJECT } from './data.js';
import { LEVELS as LEVELS_DEFAULT, GROUND, isBasement } from './config.js';
import { box, rng, hash, wallRuns, DOOR_TOP } from './geom.js';
import { buildPhotoGarden } from './garden/photo.js';
import { roofMaterial, extWallMaterial, overhang } from './world.js';

const LAMP = '#ffcf8a';
const CELL = 16;   // photo-garden cells (one mesh each: its bounds drive the vegetation LOD)

// ------------------------------------------------------------------ geometry helpers
const W = (x, y, z) => [x, z, -y]; // plan → three
function merge(list) {
  const g = list.filter(Boolean).map(x => (x.index ? x.toNonIndexed() : x));
  for (const x of g) for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k);
  return g.length ? mergeGeometries(g, false) : null;
}
// box in local (three.js) coords centred at (cx, cy, cz)
function lb(cx, cy, cz, w, h, d) { const g = new THREE.BoxGeometry(w, h, d); g.translate(cx, cy, cz); return g; }
// local kit → plan position (x, y), elevation z, rotation (deg, plan: 0 = local +Z faces north)
function place(g, x, y, z, rot = 0) {
  const c = g.clone();
  c.rotateY(Math.PI - rot * Math.PI / 180);
  c.translate(x, z, -y);
  return c;
}
function beam(p0, p1, r0, r1 = r0, seg = 5) {
  const A = new THREE.Vector3(...p0), B = new THREE.Vector3(...p1), len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate(A.x, A.y, A.z);
  return g;
}

// ------------------------------------------------------------------ small builders (local frame, +Z out of the wall)
function lanternBody(k, x, y, z, s = 1) {
  k.put('lampShade', lb(x, y, z, 0.15 * s, 0.24 * s, 0.15 * s));
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.put('ironBlack', lb(x + dx * 0.08 * s, y, z + dz * 0.08 * s, 0.018 * s, 0.26 * s, 0.018 * s));
  k.put('ironBlack', lb(x, y - 0.135 * s, z, 0.19 * s, 0.03 * s, 0.19 * s));
  k.put('ironBlack', lb(x, y + 0.135 * s, z, 0.2 * s, 0.03 * s, 0.2 * s));
  const cap = new THREE.ConeGeometry(0.15 * s, 0.12 * s, 4); cap.rotateY(Math.PI / 4); cap.translate(x, y + 0.21 * s, z);
  k.put('ironBlack', cap);
}
const kit = () => { const parts = []; return { parts, put: (m, g) => { parts.push([m, g]); return g; } }; };
function wallLantern(modern) {
  const k = kit();
  if (modern) {   // slim up/down cylinder light
    k.put('ironBlack', lb(0, 0, 0.01, 0.1, 0.1, 0.02));
    const c = new THREE.CylinderGeometry(0.05, 0.05, 0.26, 12); c.translate(0, 0, 0.09); k.put('steelDark', c);
    const g = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 12); g.translate(0, -0.135, 0.09); k.put('bulbWarm', g);
    return k;
  }
  k.put('ironBlack', lb(0, 0.05, 0.01, 0.12, 0.22, 0.02));
  k.put('ironBlack', lb(0, 0.12, 0.13, 0.03, 0.03, 0.24));
  k.put('ironBlack', beam([0, -0.02, 0.02], [0, 0.11, 0.2], 0.012, 0.012, 4));
  lanternBody(k, 0, -0.02, 0.26, 0.95);
  return k;
}
function bollard() {
  const k = kit();
  k.put('steelDark', lb(0, 0.3, 0, 0.12, 0.6, 0.12));
  k.put('lampShade', lb(0, 0.66, 0, 0.1, 0.12, 0.1));
  k.put('steelDark', lb(0, 0.75, 0, 0.17, 0.05, 0.17));
  return k;
}

// collected by buildExteriorSteps (beds, hedges, lawns, pergola climbers), consumed by makeTrees
let pending = null;
const cellOf = (x, y) => `garden_${Math.floor(x / CELL)}_${Math.floor(y / CELL)}`;
const gardenAt = (x, y) => {
  const k = cellOf(x, y);
  if (!pending.has(k)) pending.set(k, { trees: [], pots: [], beds: [], shrubs: [], vines: [], lawns: [], avoid: [], circles: [], pergola: null });
  return pending.get(k);
};

export function makeTrees(list, getMaterial) { // eslint-disable-line no-unused-vars
  if (!pending) pending = new Map();
  for (const t of list) {
    const g = gardenAt(t.x, t.y);
    g.trees.push(t.species === 'shade' ? { x: t.x, y: t.y, s: (t.s || 1) * 1.45, species: 'shade', dens: t.dens ?? 0.6 } : { x: t.x, y: t.y, s: t.s || 1, species: t.species || 'shade' });
    g.circles.push([t.x, t.y, t.species === 'cypress' ? 0.45 : 0.6]);
  }
  const out = [];
  for (const [name, g] of [...pending].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    // every cell knows the full avoid list (paving etc.) for its grass
    const m = buildPhotoGarden(name, { ...g, avoid: [...g.avoid, ...(pending.avoidAll || [])], circles: [...g.circles, ...(pending.circlesAll || [])] });
    if (m) out.push(m);
  }
  pending = null;
  return out;
}

// ------------------------------------------------------------------ main builder
export function buildExterior(args) {
  const it = buildExteriorSteps(args);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}

export function* buildExteriorSteps({ Z = ZDATA, LEVELS = LEVELS_DEFAULT, HOLES = {}, add: addRaw, physics }) {
  const objects = [], lights = [];
  const add = (group, mat, geo) => { if (!geo) return; geo.clearGroups(); addRaw(group, mat, geo); };
  const col = (x0, y0, x1, y1, z0, z1) => physics && physics.addCollider(x0, y0, x1, y1, z0, z1);
  const emit = (group, k, x, y, z, rot) => { for (const [mat, g] of k.parts) add(group, mat, place(g, x, y, z, rot)); };
  const light = (x, y, z, intensity, distance, kind = 'lamp') =>
    lights.push({ x, y, z, color: LAMP, intensity, distance, level: GROUND, room: 'exterior', kind, outdoor: true });
  const holes = Object.values(HOLES);
  const inHole = (x, y) => holes.some(h => x > h[0] && x < h[2] && y > h[1] && y < h[3]);
  pending = new Map();
  const mediterranean = PROJECT.style.facade === 'mediterranean';
  const trimStone = mediterranean ? 'travertineHoned' : 'lacquer:' + (PROJECT.style.accentColor || '#5b4a3c');
  const extWall = extWallMaterial();

  // ================================================================ house detailing
  const inRooms = (lv, x, y) => (Z.floors[lv] || []).some(r => x > r.r[0] + 1e-6 && x < r.r[2] - 1e-6 && y > r.r[1] + 1e-6 && y < r.r[3] - 1e-6);
  const fpt = (f, a, n) => (f.o === 'h' ? [a, f.fixed + f.side * n] : [f.fixed + f.side * n, a]);
  const fbox = (f, a0, a1, n0, n1, z0, z1) => {
    if (a1 - a0 < 1e-3) return null;
    const [x0, y0] = fpt(f, a0, n0), [x1, y1] = fpt(f, a1, n1);
    return box(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), z0, z1);
  };
  const frot = f => (f.o === 'h' ? (f.side > 0 ? 0 : 180) : (f.side > 0 ? 90 : 270));
  // exterior faces of a level, split where the outside side changes; side = +1 / −1 towards the outside
  function extFaces(lv) {
    const faces = [];
    for (const run of wallRuns(Z.floors[lv], Z.open[lv] || [])) {
      if (run.cls !== 'ext') continue;
      let cur = null;
      for (let a = run.start; a < run.end - 1e-6; a += 0.5) {
        const m = a + 0.25;
        const pt = n => (run.o === 'h' ? [m, run.fixed + n] : [run.fixed + n, m]);
        const plus = inRooms(lv, ...pt(0.1)), minus = inRooms(lv, ...pt(-0.1));
        const side = plus && !minus ? -1 : (!plus && minus ? 1 : 0);
        if (cur && cur.side === side && Math.abs(cur.a1 - a) < 1e-6) cur.a1 = a + 0.5;
        else { cur = { lv, o: run.o, fixed: run.fixed, side, a0: a, a1: a + 0.5 }; faces.push(cur); }
      }
    }
    return faces.filter(f => f.side !== 0);
  }
  function endExt(f, atStart, proj) {
    const a = atStart ? f.a0 : f.a1, dir = atStart ? -1 : 1;
    if (inRooms(f.lv, ...fpt(f, a + dir * 0.4, 0.4))) return -0.15;
    if (inRooms(f.lv, ...fpt(f, a + dir * 0.4, -0.4))) return 0;
    return 0.15 + proj;
  }
  function faceOpenings(f) {
    return (Z.openings[f.lv] || [])
      .filter(d => d.o === f.o && Math.abs((f.o === 'h' ? d.y : d.x) - f.fixed) < 1e-6)
      .map(d => { const a = f.o === 'h' ? d.x : d.y; return { d, a: Math.max(a, f.a0), b: Math.min(a + d.w, f.a1) }; })
      .filter(o => o.b - o.a > 0.05)
      .sort((p, q) => p.a - q.a);
  }
  const isWin = t => t === 'window' || t === 'high' || t === 'glass';
  // anything attached to the house outside (carport posts / beams, pergola, walls) to keep lanterns off
  const siteObstacles = Z.site.items.filter(it => it.r && ['carport', 'pergola'].includes(it.kind)).map(it => it.r);
  const blockedAt = (x, y) => siteObstacles.some(r => x > r[0] - 0.3 && x < r[2] + 0.3 && y > r[1] - 0.3 && y < r[3] + 0.3);

  for (const lv of Object.keys(Z.floors)) {
    if (isBasement(lv)) continue;
    const L = LEVELS[lv], fl = L.elev, top = L.elev + L.h;
    for (const f of extFaces(lv)) {
      const ops = faceOpenings(f);
      const outPt = (a, n) => fpt(f, a, n);
      const s0 = f.a0 - endExt(f, true, 0.04), s1 = f.a1 + endExt(f, false, 0.04);

      // ---- plinth on the ground floor (gaps at doors and over holes)
      if (lv === GROUND) {
        let spans = [[s0, s1]];
        for (const o of ops) if (!isWin(o.d.t)) spans = spans.flatMap(([p, q]) => (o.b <= p || o.a >= q ? [[p, q]] : [[p, o.a], [o.b, q]].filter(([u, v]) => v - u > 0.05)));
        for (const [p, q] of spans) {
          if (inHole(...outPt((p + q) / 2, 0.4))) continue;
          add(lv, mediterranean ? 'stone' : 'graniteBlack', fbox(f, p, q, 0.15, mediterranean ? 0.21 : 0.18, 0, Math.max(0.35, fl + 0.2)));
        }
      }
      // ---- band at the top of the wall (floor line of the level above, or the eaves)
      {
        const upper = Object.keys(Z.floors).find(k => LEVELS[k].elev > L.elev + 0.5 && Math.abs(LEVELS[k].elev - top) < 0.05);
        const covered = upper && inRooms(upper, ...outPt((f.a0 + f.a1) / 2, -0.3));
        if (covered || mediterranean) add(lv, mediterranean ? 'travertineHoned' : extWall, fbox(f, s0, s1, 0.15, mediterranean ? 0.24 : 0.19, top - (covered ? 0.12 : 0.3), top - (covered ? -0.08 : 0.15)));
      }
      // ---- sills / surrounds
      ops.forEach((o) => {
        const t = o.d.t;
        if (t === 'window' || t === 'high') {
          const zb = t === 'window' ? fl + 0.9 : fl + 2.4;
          add(lv, trimStone, fbox(f, o.a - 0.05, o.b + 0.05, 0.15, 0.24, zb - 0.06, zb));
          if (mediterranean) {
            const zt = t === 'window' ? fl + 2.3 : Math.min(top - 0.35, fl + 3.2);
            add(lv, 'travertineHoned', fbox(f, o.a - 0.12, o.a, 0.15, 0.2, zb - 0.06, zt + 0.14));
            add(lv, 'travertineHoned', fbox(f, o.b, o.b + 0.12, 0.15, 0.2, zb - 0.06, zt + 0.14));
            add(lv, 'travertineHoned', fbox(f, o.a - 0.12, o.b + 0.12, 0.15, 0.22, zt, zt + 0.14));
          }
        }
      });
      // ---- lanterns beside exterior doors (ground floor)
      if (lv === GROUND) {
        ops.forEach((o, i) => {
          const t = o.d.t;
          if (isWin(t) || t === 'opening' || t === 'garage') return;
          const free = (u) => u > f.a0 + 0.3 && u < f.a1 - 0.3 && !ops.some(p => u + 0.12 > p.a - 0.1 && u - 0.12 < p.b + 0.1);
          const cand = [o.a - 0.35, o.b + 0.35].filter(free);
          for (const u of t === 'double' || o.b - o.a > 2 ? cand : cand.slice(0, 1)) {
            const [x, y] = outPt(u, 0.15);
            if (blockedAt(x, y)) continue;
            const z = fl + (DOOR_TOP[t] || 2.2) - 0.25;
            emit(lv, wallLantern(!mediterranean), x, y, z, frot(f));
            const [lx, ly] = outPt(u, 0.4);
            light(lx, ly, z - 0.1, 3, 6);
          }
          void i;
        });
      }
    }
    yield;
  }

  // ---- ridge / hip caps on the pitched roofs
  {
    const hipLines = (r, base, pitch, over) => {
      const o = overhang(over);
      const [x0, y0, x1, y1] = [r[0] - o.w, r[1] - o.s, r[2] + o.e, r[3] + o.n];
      const X = x1 - x0, Y = y1 - y0;
      const A = [x0, y0, base], B = [x1, y0, base], C = [x1, y1, base], D = [x0, y1, base];
      if (X >= Y) {
        const ym = (y0 + y1) / 2, hr = base + pitch * Y / 2;
        const r1 = [x0 + Y / 2, ym, hr], r2 = [x1 - Y / 2, ym, hr];
        return [[r1, r2], [A, r1], [D, r1], [B, r2], [C, r2]];
      }
      const xm = (x0 + x1) / 2, hr = base + pitch * X / 2;
      const r1 = [xm, y0 + X / 2, hr], r2 = [xm, y1 - X / 2, hr];
      return [[r1, r2], [A, r1], [B, r1], [C, r2], [D, r2]];
    };
    for (const R of Z.roofs) {
      if (!Array.isArray(R.r) || (R.type !== 'hip' && R.type !== 'gable')) continue;
      const mat = R.material || roofMaterial();
      let segs;
      if (R.type === 'hip') segs = hipLines(R.r, R.base, R.pitch, R.over);
      else {
        const o = overhang(R.over), [x0, y0, x1, y1] = [R.r[0] - o.w, R.r[1] - o.s, R.r[2] + o.e, R.r[3] + o.n];
        const alongX = R.ridge ? R.ridge === 'x' : (x1 - x0) >= (y1 - y0);
        segs = alongX ? [[[x0, (y0 + y1) / 2, R.base + R.pitch * (y1 - y0) / 2], [x1, (y0 + y1) / 2, R.base + R.pitch * (y1 - y0) / 2]]]
          : [[[(x0 + x1) / 2, y0, R.base + R.pitch * (x1 - x0) / 2], [(x0 + x1) / 2, y1, R.base + R.pitch * (x1 - x0) / 2]]];
      }
      for (const [p, q] of segs) {
        if (R.top !== undefined && (p[2] > R.top || q[2] > R.top)) continue;
        const a = W(p[0], p[1], p[2] + 0.04), b = W(q[0], q[1], q[2] + 0.04);
        if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) continue;
        add('roof', mat, beam(a, b, 0.1, 0.1, 6));
      }
    }
  }
  yield;

  // ================================================================ landscape
  const lawnAvoid = [];
  for (const r of Z.floors[GROUND] || []) lawnAvoid.push([r.r[0] - 0.4, r.r[1] - 0.4, r.r[2] + 0.4, r.r[3] + 0.4]);
  for (const it of Z.site.items) {
    if (it.r && !['lawn', 'trees'].includes(it.kind)) lawnAvoid.push([it.r[0] - 0.3, it.r[1] - 0.3, it.r[2] + 0.3, it.r[3] + 0.3]);
    if (it.from && it.to) lawnAvoid.push([Math.min(it.from[0], it.to[0]) - 0.6, Math.min(it.from[1], it.to[1]) - 0.6, Math.max(it.from[0], it.to[0]) + 0.6, Math.max(it.from[1], it.to[1]) + 0.6]);
  }
  for (const h of holes) lawnAvoid.push([h[0] - 0.5, h[1] - 0.5, h[2] + 0.5, h[3] + 0.5]);
  // the perimeter wall strip
  {
    const { w, d } = Z.site;
    lawnAvoid.push([0, 0, w, 0.5], [0, d - 0.5, w, d], [0, 0, 0.5, d], [w - 0.5, 0, w, d]);
  }
  pending.avoidAll = lawnAvoid;
  pending.circlesAll = [];

  for (const it of Z.site.items) {
    if (it.kind === 'garden' && it.r) {
      // planting bed: shrubs + flowering clumps; kind 'flowers' → more blooms
      const [x0, y0, x1, y1] = it.r;
      gardenAt((x0 + x1) / 2, (y0 + y1) / 2).beds.push([x0 + 0.05, y0 + 0.05, x1 - 0.05, y1 - 0.05, it.flowers === false ? undefined : 'lav']);
    } else if (it.kind === 'hedge' && it.from) {
      // photo shrubs along the hedge (the shell draws a solid leafy core)
      const [ax, ay] = it.from, [bx, by] = it.to, len = Math.hypot(bx - ax, by - ay), H = it.h ?? 1.4, T = it.t ?? 0.7;
      const R = rng(hash(it.id || 'hedge'));
      for (let s = 0.3; s < len - 0.1; s += 0.55) {
        const x = ax + (bx - ax) * s / len, y = ay + (by - ay) * s / len;
        gardenAt(x, y).shrubs.push({ x, y, w: T + 0.25, h: H + 0.1 + R() * 0.15, tint: [0.62, 0.8, 0.6] });
      }
    } else if (it.kind === 'lawn' && it.r) {
      const [x0, y0, x1, y1] = it.r;
      // split big lawns over the garden cells
      for (let cx = Math.floor(x0 / CELL) * CELL; cx < x1; cx += CELL) for (let cy = Math.floor(y0 / CELL) * CELL; cy < y1; cy += CELL) {
        const r = [Math.max(x0, cx), Math.max(y0, cy), Math.min(x1, cx + CELL), Math.min(y1, cy + CELL)];
        if (r[2] - r[0] > 0.8 && r[3] - r[1] > 0.8) gardenAt((r[0] + r[2]) / 2, (r[1] + r[3]) / 2).lawns.push(r);
      }
    } else if (it.kind === 'pergola' && it.r && it.climber !== false) {
      const g = gardenAt((it.r[0] + it.r[2]) / 2, (it.r[1] + it.r[3]) / 2);
      g.pergola = it.r;
    }
  }
  yield;

  // ---- bollard lights along paths and driveways; pool ladder + light; carport ceiling light
  for (const it of Z.site.items) {
    const r = it.r;
    if ((it.kind === 'path' || it.kind === 'driveway') && r && it.lights !== false) {
      const along = r[3] - r[1] >= r[2] - r[0];
      const len = along ? r[3] - r[1] : r[2] - r[0];
      const n = Math.max(1, Math.floor(len / 4));
      for (let i = 0; i < n; i++) {
        const a = (along ? r[1] : r[0]) + len * (i + 0.5) / n;
        const [x, y] = along ? [r[0] - 0.25, a] : [a, r[1] - 0.25];
        if (x < 0.4 || y < 0.4 || inHole(x, y) || (Z.floors[GROUND] || []).some(q => x > q.r[0] - 0.3 && x < q.r[2] + 0.3 && y > q.r[1] - 0.3 && y < q.r[3] + 0.3)) continue;
        emit('site', bollard(), x, y, 0, 0);
        col(x - 0.07, y - 0.07, x + 0.07, y + 0.07, 0, 0.78);
        light(x, y, 0.66, 1.2, 4);
      }
    }
    if (it.kind === 'pool' && r) {
      const k = kit();
      for (const sx of [-0.22, 0.22]) {
        k.put('chrome', beam([sx, -0.9, 0.05], [sx, 0.75, 0.05], 0.022, 0.022, 8));
        k.put('chrome', beam([sx, 0.75, 0.05], [sx, 0.75, -0.25], 0.022, 0.022, 8));
      }
      for (const y of [-0.5, -0.2]) k.put('steelBrushed', lb(0, y, 0.12, 0.44, 0.03, 0.08));
      emit('site', k, r[2] - 0.6, r[1] + 0.12, 0, 0);
      lights.push({ x: (r[0] + r[2]) / 2, y: (r[1] + r[3]) / 2, z: -0.6, color: '#bfe6ff', intensity: 3, distance: 6, level: GROUND, room: 'exterior', kind: 'spot', outdoor: true });
    }
    if (it.kind === 'carport' && r) {
      const H = it.h ?? 2.6, cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2;
      add('site', 'ledWarm', box(cx - 0.6, cy - 0.04, cx + 0.6, cy + 0.04, H - 0.04, H - 0.005));
      light(cx, cy, H - 0.1, 4, 7);
    }
    if (it.kind === 'gate' && it.from) {
      // a small lantern on top of each gate post
      for (const p of [it.from, it.to]) {
        const k = kit();
        lanternBody(k, 0, 0.14, 0, 0.8);
        emit('site', k, p[0], p[1], (it.h ?? 1.8) + 0.2, 0);
      }
      const m = [(it.from[0] + it.to[0]) / 2, (it.from[1] + it.to[1]) / 2];
      light(m[0], m[1] + 0.4, (it.h ?? 1.8) + 0.3, 2, 6);
    }
  }
  yield;
  return { objects, lights };
}
