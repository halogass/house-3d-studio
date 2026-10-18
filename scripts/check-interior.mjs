// Interior layout checker for the active project's interior.js (docs/SCHEMA.md "interior.js").
//   npm run check-interior [-- --project <name>]
// Verifies, per room: every room has an entry, every type is known, items lie inside the room's
// inner wall faces, solid items do not overlap each other, the remaining fixtures or the stairs /
// lift, door clear zones stay free, a >= 0.8 m path leads from every door to the room's main area,
// no tall items stand in front of windows, wall items hang on a real wall face and ceiling items
// fit the clear height. Prints violations (with the room and item) and exits 1 if there are any.
import { useProject } from './lib/project.mjs';
useProject();
const { Z, INTERIOR: I } = await import('../engine/data.js');
const { LEVELS, STAIRS, LIFT, LIFT_STOPS } = await import('../engine/config.js');
const { footprintParts } = await import('../engine/interior/footprints.js');
const { FURNITURE, furnitureInfo } = await import('../engine/interior/furniture/index.js');
const { MATERIAL_NAMES, materialInfo } = await import('../engine/materials.js');

const ON_TOP = new Set(['tableLamp', 'bankersLamp']);          // stand on another item (z = its top)
// Centre height on the wall (for checking wall items under clerestory windows)
const WALL_Y = { wallCharger: 1.2, mirrorFull: 1.0, wallArt: 1.6, mirror: 1.6, tv: 1.3, sconce: 1.8, towelRail: 1.0, rangeHood: 2.1, monitorWall: 1.5, toolWall: 1.4 };
const ROUND = new Set(['chandelierRing', 'chandelierCrystal', 'chandelierCandle', 'pendantDome', 'ceilingFan', 'industrialPendant']); // other ceiling items: their rectangle
const CLEAR = Object.fromEntries(Object.values(LEVELS).map(L => [L.id, L.h - 0.3]));
const HEADROOM = 2.1;
const WALLS = ['paint', 'wainscot', 'panel', 'wallpaper', 'tile', 'concrete', 'acoustic'];
const CEILS = ['flat', 'tray', 'coffered', 'beams'];
const DOORS = ['swing', 'double', 'opening', 'sliding', 'folding', 'garage'];
const WINDOWS = ['window', 'glass', 'high'];
const REPLACEABLE = ['counter', 'island', 'wc', 'sink', 'tub', 'bench'];
const OBSTACLE_FIX = ['wc', 'sink', 'shower', 'tub', 'counter', 'island', 'bench', 'partition', 'solid', 'stair', 'lift'];
const isMaterial = v => typeof v === 'string' && (materialInfo(v).known || MATERIAL_NAMES.includes(v));
const MAT_PARAMS = ['mat', 'frame', 'fabric', 'top', 'cabinet', 'art', 'bedding', 'pillow'];
const FIN_MAT = ['floor', 'curtains', 'windowFrame', 'panelColor'];
const INFO = Object.fromEntries(Object.keys(FURNITURE).map(t => [t, true]));
const EPS = 0.01; // touching (≤ 1 cm overlap) is fine
const WALL_T = { ext: 0.3, int: 0.15 };

const errors = [];
const err = (lv, room, msg) => errors.push(`${lv} ${room}: ${msg}`);

// ---------------------------------------------------------------------------
// Geometry
function dims(it) {
  const info = furnitureInfo(it.type, { ...it, y: it.z });
  let { w, d, h, mount, solid } = info;
  if (ON_TOP.has(it.type)) mount = 'top';
  if (it.type === 'dryer' && it.stacked) h = 1.72; // washer + dryer in one unit
  if (it.type === 'outdoorSofa' && it.corner) d = 2.0;
  if (it.type === 'benchPress' && it.incline) h = 1.55;
  if (it.type === 'deadliftPlatform' && it.barbell === false) h = 0.04;
  return { w, d, h, mount, solid };
}
const rad = deg => (deg || 0) * Math.PI / 180;
// Front direction f and width axis u for plan rotation (0 = north, 90 = east)
function axes(rot) {
  const a = rad(rot);
  const f = [Math.sin(a), Math.cos(a)];
  const u = [Math.cos(a), -Math.sin(a)];
  return { f, u };
}
function shapeOf(it) {
  const { w, d, mount } = dims(it);
  if ((mount === 'ceiling' && ROUND.has(it.type)) || (it.type === 'diningTable' && it.round)) {
    return { circle: [it.x, it.y, w / 2] };
  }
  const { f, u } = axes(it.rot);
  let c = [it.x, it.y];
  if (mount === 'wall') c = [it.x + f[0] * d / 2, it.y + f[1] * d / 2];
  const pts = [];
  for (const [su, sf] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    pts.push([c[0] + u[0] * w / 2 * su + f[0] * d / 2 * sf, c[1] + u[1] * w / 2 * su + f[1] * d / 2 * sf]);
  }
  return { poly: pts };
}
const rectPoly = r => ({ poly: [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]] });

function projPoly(pts, ax) {
  let lo = Infinity, hi = -Infinity;
  for (const p of pts) { const v = p[0] * ax[0] + p[1] * ax[1]; if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
}
function edgesAxes(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const e = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(e[0], e[1]);
    if (L > 1e-9) out.push([-e[1] / L, e[0] / L]);
  }
  return out;
}
// Penetration depth (> 0 means overlapping by that much; ≤ 0 separated)
function depth(A, B) {
  if (A.poly && B.poly) {
    let m = Infinity;
    for (const ax of [...edgesAxes(A.poly), ...edgesAxes(B.poly)]) {
      const [a0, a1] = projPoly(A.poly, ax), [b0, b1] = projPoly(B.poly, ax);
      m = Math.min(m, Math.min(a1, b1) - Math.max(a0, b0));
      if (m <= 0) return m;
    }
    return m;
  }
  if (A.circle && B.circle) {
    const [x1, y1, r1] = A.circle, [x2, y2, r2] = B.circle;
    return r1 + r2 - Math.hypot(x1 - x2, y1 - y2);
  }
  const C = A.circle ? A : B, P = A.circle ? B : A;
  const [cx, cy, r] = C.circle;
  // distance from centre to polygon (0 if inside)
  let inside = true, best = Infinity;
  const pts = P.poly;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((cx - a[0]) * ex + (cy - a[1]) * ey) / (ex * ex + ey * ey)));
    best = Math.min(best, Math.hypot(cx - a[0] - ex * t, cy - a[1] - ey * t));
    if ((ex * (cy - a[1]) - ey * (cx - a[0])) < 0) inside = false;
  }
  // polygons are built counter-clockwise or clockwise; fall back to winding test
  if (!inside) {
    let wn = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (((a[1] > cy) !== (b[1] > cy)) && cx < (b[0] - a[0]) * (cy - a[1]) / (b[1] - a[1]) + a[0]) wn ^= 1;
    }
    inside = !!wn;
  }
  return inside ? r + best : r - best;
}
function bbox(S) {
  if (S.circle) { const [x, y, r] = S.circle; return [x - r, y - r, x + r, y + r]; }
  const xs = S.poly.map(p => p[0]), ys = S.poly.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
const within = (b, r, tol = 1e-6) => b[0] >= r[0] - tol && b[1] >= r[1] - tol && b[2] <= r[2] + tol && b[3] <= r[3] + tol;
const pointIn = (p, S) => S.circle ? Math.hypot(p[0] - S.circle[0], p[1] - S.circle[1]) <= S.circle[2] : depth({ circle: [p[0], p[1], 0.001] }, S) > 0;

// ---------------------------------------------------------------------------
// Walls on the 0.5 m lattice (same rule as engine/geom.js wallRuns)
function wallRuns(rooms, openPairs) {
  const S = 0.5, r2 = v => Math.round(v * 2) / 2;
  const segs = new Map();
  const add = (k, id) => { if (!segs.has(k)) segs.set(k, []); segs.get(k).push(id); };
  for (const rm of rooms) {
    const [x0, y0, x1, y1] = rm.r;
    for (let x = x0; x < x1 - 1e-6; x += S) { add(`h|${r2(y0)}|${r2(x)}`, rm.id); add(`h|${r2(y1)}|${r2(x)}`, rm.id); }
    for (let y = y0; y < y1 - 1e-6; y += S) { add(`v|${r2(x0)}|${r2(y)}`, rm.id); add(`v|${r2(x1)}|${r2(y)}`, rm.id); }
  }
  const isOpen = (a, b) => openPairs.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
  const out = [];
  for (const [k, ids] of segs) {
    const [o, fixed, start] = k.split('|');
    const cls = ids.length === 1 ? 'ext' : (isOpen(ids[0], ids[1]) ? 'open' : 'int');
    out.push({ o, fixed: +fixed, start: +start, end: +start + S, cls, ids });
  }
  return out;
}
function segBand(s) {
  const t = WALL_T[s.cls] / 2;
  return s.o === 'h' ? [s.start, s.fixed - t, s.end, s.fixed + t] : [s.fixed - t, s.start, s.fixed + t, s.end];
}

// ---------------------------------------------------------------------------
// Door clear zones and window zones
function doorZones(d) {
  const zones = [];
  const h = d.o === 'h';
  zones.push(h ? [d.x, d.y - 1, d.x + d.w, d.y + 1] : [d.x - 1, d.y, d.x + 1, d.y + d.w]);
  const side = d.side || 1;
  const arc = (h0, rad) => { // square bounding the quarter circle on the swing side
    if (h) {
      const xs = [h0, h0 + (h0 === d.x ? rad : -rad)].sort((a, b) => a - b);
      zones.push([xs[0], side > 0 ? d.y : d.y - rad, xs[1], side > 0 ? d.y + rad : d.y]);
    } else {
      const ys = [h0, h0 + (h0 === d.y ? rad : -rad)].sort((a, b) => a - b);
      zones.push([side > 0 ? d.x : d.x - rad, ys[0], side > 0 ? d.x + rad : d.x, ys[1]]);
    }
  };
  const A = h ? d.x : d.y, B = A + d.w;
  if (d.t === 'swing') arc(d.hinge === 'e' ? B : A, d.w);
  if (d.t === 'double') { arc(A, d.w / 2); arc(B, d.w / 2); }
  return zones;
}
function windowZone(d) {
  const m = 0.6;
  return d.o === 'h' ? [d.x, d.y - m, d.x + d.w, d.y + m] : [d.x - m, d.y, d.x + m, d.y + d.w];
}

// ---------------------------------------------------------------------------
const known = new Set(Object.keys(INFO));
const allRoomIds = new Set();
for (const [lv, rooms] of Object.entries(Z.floors)) rooms.forEach(r => allRoomIds.add(r.id));
if (!I || !I.rooms) { console.log('interior.js: "rooms" missing'); process.exit(1); }
for (const id of Object.keys(I.rooms)) if (!allRoomIds.has(id)) errors.push(`interior.js rooms has unknown room id '${id}' (furniture outside the rooms goes under "areas")`);

let itemCount = 0;
const typeCount = {};

for (const [lv, rooms] of Object.entries(Z.floors)) {
  const open = Z.open[lv] || [];
  const runs = wallRuns(rooms, open);
  const solidBands = runs.filter(s => s.cls !== 'open').map(segBand);
  const openings = Z.openings[lv] || [];
  const doors = openings.filter(o => DOORS.includes(o.t));
  const windows = openings.filter(o => WINDOWS.includes(o.t));
  const roomOf = p => rooms.find(r => p[0] >= r.r[0] && p[0] <= r.r[2] && p[1] >= r.r[1] && p[1] <= r.r[3]);

  // Remaining fixtures (after replaceFixtures), plus the stairs (flights on the lower floor, the
  // void on the upper one) and the lift shaft: nothing may stand on them
  const fixtures = [];
  for (const f of Z.fixtures[lv] || []) {
    if (f.ground || !OBSTACLE_FIX.includes(f.t)) continue;
    let S, c;
    if (f.r) { S = rectPoly(f.r); c = [(f.r[0] + f.r[2]) / 2, (f.r[1] + f.r[3]) / 2]; }
    else if (f.t === 'partition') {
      const t = 0.08, [a, b] = [f.from, f.to];
      S = rectPoly([Math.min(a[0], b[0]) - t, Math.min(a[1], b[1]) - t, Math.max(a[0], b[0]) + t, Math.max(a[1], b[1]) + t]);
      c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    } else continue;
    const rm = roomOf(c);
    const entry = rm && I.rooms[rm.id];
    if (entry && entry.replaceFixtures && REPLACEABLE.includes(f.t)) continue;
    fixtures.push({ f, S, room: rm && rm.id });
  }
  for (const s of STAIRS) if (s.from === lv || s.to === lv) fixtures.push({ f: { t: 'stair', r: s.r }, S: rectPoly(s.r), room: null });
  if (LIFT && LIFT_STOPS.includes(lv)) fixtures.push({ f: { t: 'lift', r: LIFT.r }, S: rectPoly(LIFT.r), room: null });

  const solids = []; // { it, S, room }
  const allItems = [];

  for (const rm of rooms) {
    const entry = I.rooms[rm.id];
    if (!entry) { err(lv, rm.id, 'no entry in interior.js rooms (add at least a finish)'); continue; }
    const fin = entry.finish;
    if (!fin) err(lv, rm.id, 'missing finish');
    else {
      if (!WALLS.includes(fin.walls)) err(lv, rm.id, `finish.walls '${fin.walls}' invalid`);
      if (fin.ceiling && !CEILS.includes(fin.ceiling)) err(lv, rm.id, `finish.ceiling '${fin.ceiling}' invalid`);
      for (const k of FIN_MAT) {
        const v = fin[k];
        if (v == null || (k === 'panelColor' && /^#[0-9a-fA-F]{6}$/.test(v))) continue;
        if (!isMaterial(v)) err(lv, rm.id, `finish.${k} '${v}' is not a material name (docs/SCHEMA.md "Materials")`);
      }
      for (const k of ['wallColor', 'trim']) if (fin[k] != null && !/^#[0-9a-fA-F]{6}$/.test(fin[k])) err(lv, rm.id, `finish.${k} '${fin[k]}' is not #rrggbb`);
    }
    if (!Array.isArray(entry.items)) { err(lv, rm.id, 'items must be an array'); continue; }
    const ceilShapes = [];
    entry.items.forEach((it, idx) => {
      const tag = `#${idx} ${it.type}@(${it.x}, ${it.y})`;
      if (!known.has(it.type)) { err(lv, rm.id, `${tag}: unknown type`); return; }
      if (![it.x, it.y].every(Number.isFinite)) { err(lv, rm.id, `${tag}: x/y missing`); return; }
      itemCount++;
      for (const k of MAT_PARAMS) {
        if (it[k] == null) continue;
        for (const v of [].concat(it[k])) if (!isMaterial(v)) err(lv, rm.id, `${tag}: ${k} '${v}' is not a material name (docs/SCHEMA.md "Materials")`);
      }
      typeCount[it.type] = (typeCount[it.type] || 0) + 1;
      const { h, mount, solid } = dims(it);
      const S = shapeOf(it);
      const bb = bbox(S);
      allItems.push({ it, S, room: rm.id });
      // Inside the room and clear of every (non-open) wall band
      if (!within(bb, rm.r) && !(S.poly && S.poly.every(p => p[0] >= rm.r[0] - 1e-6 && p[0] <= rm.r[2] + 1e-6 && p[1] >= rm.r[1] - 1e-6 && p[1] <= rm.r[3] + 1e-6)))
        err(lv, rm.id, `${tag}: outside the room rect`);
      for (const b of solidBands) {
        if (depth(S, rectPoly(b)) > EPS) { err(lv, rm.id, `${tag}: crosses a wall face (band ${b.map(v => +v.toFixed(3))})`); break; }
      }
      if (mount === 'ceiling') {
        if (CLEAR[lv] - h < HEADROOM) err(lv, rm.id, `${tag}: hangs to ${(CLEAR[lv] - h).toFixed(2)} m (< ${HEADROOM} m headroom, clear ${CLEAR[lv]})`);
        for (const o of ceilShapes) if (depth(S, o.S) > EPS) err(lv, rm.id, `${tag}: overlaps ceiling item ${o.it.type}`);
        ceilShapes.push({ it, S });
        return;
      }
      if (mount === 'wall') {
        const r = ((it.rot || 0) % 360 + 360) % 360;
        if (r % 90) { err(lv, rm.id, `${tag}: wall item rot must be a multiple of 90`); return; }
        // Which edge: rot points into the room, so the wall is behind
        const edge = { 0: ['h', rm.r[1], +1], 180: ['h', rm.r[3], -1], 90: ['v', rm.r[0], +1], 270: ['v', rm.r[2], -1] }[r];
        const [o, fixed, inward] = edge;
        const { w } = dims(it);
        const along = o === 'h' ? it.x : it.y;
        const lo = along - w / 2, hi = along + w / 2;
        const segs = runs.filter(s => s.o === o && Math.abs(s.fixed - fixed) < 1e-6 && s.end > lo + 1e-6 && s.start < hi - 1e-6 && s.ids.includes(rm.id));
        const span = o === 'h' ? [rm.r[0], rm.r[2]] : [rm.r[1], rm.r[3]];
        if (lo < span[0] - 1e-6 || hi > span[1] + 1e-6) err(lv, rm.id, `${tag}: runs past the wall end`);
        if (segs.some(s => s.cls === 'open')) err(lv, rm.id, `${tag}: on an open-plan edge (no wall)`);
        const at = segs.find(s => s.start <= along + 1e-6 && s.end >= along - 1e-6) || segs[0];
        if (at && at.cls !== 'open') {
          const face = fixed + inward * WALL_T[at.cls] / 2;
          const pos = o === 'h' ? it.y : it.x;
          if (Math.abs(pos - face) > 0.02) err(lv, rm.id, `${tag}: not on the inner wall face (expected ${o === 'h' ? 'y' : 'x'} = ${+face.toFixed(3)})`);
        }
        const top = (it.z ?? WALL_Y[it.type] ?? h / 2) + h / 2; // z = centre height on the wall (params.y in §3)
        for (const d of openings) {
          if (d.o !== o || Math.abs((o === 'h' ? d.y : d.x) - fixed) > 1e-6) continue;
          const a = o === 'h' ? d.x : d.y, b = a + d.w;
          if (b <= lo + 0.03 || a >= hi - 0.03) continue;
          if (d.t === 'high' && top <= 2.35) continue; // below a clerestory window
          err(lv, rm.id, `${tag}: on an opening (${d.t} ${o} @${a}..${+b.toFixed(2)})`);
        }
      }
      if (mount === 'top') {
        const host = entry.items.some(o => o !== it && INFO[o.type] && dims(o).solid && pointIn([it.x, it.y], shapeOf(o)));
        if (!host) err(lv, rm.id, `${tag}: not standing on a surface`);
        return;
      }
      if (solid) {
        // L shapes collide per part (the inside corner stays free), everything else as one rect
        const { w, d } = dims(it), parts = footprintParts(it.type, it, w, d);
        if (!parts) solids.push({ it, S, room: rm.id });
        else {
          const { f, u } = axes(it.rot);
          for (const [x0, z0, x1, z1] of parts) {
            // builder +X is the plan's -u (three.js yaw = π − rot)
            const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => [it.x - u[0] * x + f[0] * z, it.y - u[1] * x + f[1] * z]);
            solids.push({ it, S: { poly: pts }, room: rm.id });
          }
        }
      }
      // Tall items in front of windows
      if (mount !== 'wall' || solid) {
        // a kitchen run is only tall where its fridge / pantry column is
        let tallS = S;
        if (it.type === 'kitchenRun' && (it.tall === 'fridge' || it.tall === 'pantry') && !it.uppers) {
          const { w, d } = dims(it), tw = Math.min(0.78, w * 0.4), { f, u } = axes(it.rot);
          const [x0, x1] = it.tallSide === 'left' ? [-w / 2, -w / 2 + tw] : [w / 2 - tw, w / 2];
          tallS = { poly: [[x0, -d / 2], [x1, -d / 2], [x1, d / 2], [x0, d / 2]].map(([x, z]) => [it.x - u[0] * x + f[0] * z, it.y - u[1] * x + f[1] * z]) };
        }
        for (const wnd of windows) {
          if (it.type === 'plantPot') break;
          const limit = wnd.t === 'high' ? 2.3 : 1.2;
          if (h > limit && depth(tallS, rectPoly(windowZone(wnd))) > EPS)
            err(lv, rm.id, `${tag}: tall item (h ${h}) in front of ${wnd.t} ${wnd.o}@${wnd.o === 'h' ? wnd.x : wnd.y}`);
        }
      }
    });
  }

  // Solid overlaps (items vs items, items vs fixtures, items vs door zones)
  const EXEMPT = (a, b) => {
    const t = [a.it.type, b.it.type].sort().join('|');
    return t === 'bookcase|libraryLadder' || t === 'builtInShelves|libraryLadder';
  };
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const A = solids[i], B = solids[j];
      if (EXEMPT(A, B)) continue;
      const dd = depth(A.S, B.S);
      if (dd > EPS) err(lv, A.room, `${A.it.type}@(${A.it.x}, ${A.it.y}) overlaps ${B.it.type}@(${B.it.x}, ${B.it.y}) in ${B.room} by ${dd.toFixed(2)} m`);
    }
    for (const fx of fixtures) {
      const dd = depth(solids[i].S, fx.S);
      if (dd > EPS) err(lv, solids[i].room, `${solids[i].it.type}@(${solids[i].it.x}, ${solids[i].it.y}) overlaps fixture ${fx.f.t} ${JSON.stringify(fx.f.r || fx.f.c || fx.f.from)}`);
    }
    for (const d of doors) {
      for (const z of doorZones(d)) {
        const dd = depth(solids[i].S, rectPoly(z));
        if (dd > EPS) { err(lv, solids[i].room, `${solids[i].it.type}@(${solids[i].it.x}, ${solids[i].it.y}) blocks door clear zone of ${d.t} ${d.o}@(${d.x}, ${d.y}) w ${d.w}`); break; }
      }
    }
  }
  // Non-solid floor items (showerGlass, rugs, mats, pet beds) may not cover fixtures like stairs/lifts
  // Wall items may not hang over a stair void or the lift
  for (const A of allItems) {
    if (dims(A.it).mount !== 'wall' || dims(A.it).solid) continue;
    for (const fx of fixtures) {
      if (!['stair', 'lift'].includes(fx.f.t)) continue;
      if (depth(A.S, fx.S) > EPS) err(lv, A.room, `${A.it.type}@(${A.it.x}, ${A.it.y}) hangs over fixture ${fx.f.t} ${JSON.stringify(fx.f.r)}`);
    }
  }
  for (const A of allItems) {
    if (!['rug', 'yogaMat', 'petBed'].includes(A.it.type)) continue;
    for (const fx of fixtures) {
      if (!['stair', 'lift', 'wc', 'shower', 'tub', 'counter', 'island'].includes(fx.f.t)) continue;
      if (depth(A.S, fx.S) > EPS) err(lv, A.room, `${A.it.type}@(${A.it.x}, ${A.it.y}) lies under fixture ${fx.f.t}`);
    }
  }

  // ---------------- Walking paths (0.8 m wide) from every door to the room's main area
  const G = 0.05, R = 0.39;
  const all = rooms.map(r => r.r);
  const X0 = Math.min(...all.map(r => r[0])) - 1, Y0 = Math.min(...all.map(r => r[1])) - 1;
  const X1 = Math.max(...all.map(r => r[2])) + 1, Y1 = Math.max(...all.map(r => r[3])) + 1;
  const NX = Math.ceil((X1 - X0) / G), NY = Math.ceil((Y1 - Y0) / G);
  const blocked = new Uint8Array(NX * NY);
  const fillRect = (r) => {
    const i0 = Math.max(0, Math.ceil((r[0] - X0) / G - 0.5)), i1 = Math.min(NX - 1, Math.floor((r[2] - X0) / G - 0.5));
    const j0 = Math.max(0, Math.ceil((r[1] - Y0) / G - 0.5)), j1 = Math.min(NY - 1, Math.floor((r[3] - Y0) / G - 0.5));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * NX + i] = 1;
  };
  const fillShape = (S) => {
    const b = bbox(S);
    const i0 = Math.max(0, Math.ceil((b[0] - X0) / G - 0.5)), i1 = Math.min(NX - 1, Math.floor((b[2] - X0) / G - 0.5));
    const j0 = Math.max(0, Math.ceil((b[1] - Y0) / G - 0.5)), j1 = Math.min(NY - 1, Math.floor((b[3] - Y0) / G - 0.5));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const p = [X0 + (i + 0.5) * G, Y0 + (j + 0.5) * G];
      if (pointIn(p, S)) blocked[j * NX + i] = 1;
    }
  };
  // Outside every room
  const inRoom = new Uint8Array(NX * NY);
  for (const r of all) {
    const i0 = Math.ceil((r[0] - X0) / G - 0.5), i1 = Math.floor((r[2] - X0) / G - 0.5);
    const j0 = Math.ceil((r[1] - Y0) / G - 0.5), j1 = Math.floor((r[3] - Y0) / G - 0.5);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) inRoom[j * NX + i] = 1;
  }
  for (let k = 0; k < NX * NY; k++) if (!inRoom[k]) blocked[k] = 1;
  // Walls with door openings cut
  for (const s of runs) {
    if (s.cls === 'open') continue;
    const b = segBand(s);
    const cuts = doors.filter(d => d.o === s.o && Math.abs((d.o === 'h' ? d.y : d.x) - s.fixed) < 1e-6)
      .map(d => d.o === 'h' ? [d.x, d.x + d.w] : [d.y, d.y + d.w]);
    let pieces = [[s.start, s.end]];
    for (const [a, c] of cuts) pieces = pieces.flatMap(([p, q]) => (c <= p || a >= q) ? [[p, q]] : [[p, a], [c, q]].filter(([u, v]) => v - u > 1e-6));
    for (const [p, q] of pieces) fillRect(s.o === 'h' ? [p, b[1], q, b[3]] : [b[0], p, b[2], q]);
  }
  // walk-in showers are walkable; so are the stairs (their bottom on this floor, their top arrives here)
  fixtures.forEach(fx => { if (fx.f.t !== 'shower' && fx.f.t !== 'stair') fillShape(fx.S); });
  solids.forEach(s => fillShape(s.S.circle ? s.S : rectPoly(bbox(s.S)))); // colliders = AABB of the footprint
  // Erode by R: passable = no blocked cell centre within R
  const K = Math.ceil(R / G);
  const offs = [];
  for (let dj = -K; dj <= K; dj++) for (let di = -K; di <= K; di++) if (Math.hypot(di, dj) * G < R) offs.push([di, dj]);
  const near = new Uint8Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    if (!blocked[j * NX + i]) continue;
    // only cells on the obstacle border matter
    if (i > 0 && i < NX - 1 && j > 0 && j < NY - 1 && blocked[j * NX + i - 1] && blocked[j * NX + i + 1] && blocked[(j - 1) * NX + i] && blocked[(j + 1) * NX + i]) { near[j * NX + i] = 1; continue; }
    for (const [di, dj] of offs) {
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && jj >= 0 && ii < NX && jj < NY) near[jj * NX + ii] = 1;
    }
  }
  // Open-plan groups
  const parent = Object.fromEntries(rooms.map(r => [r.id, r.id]));
  const find = a => parent[a] === a ? a : (parent[a] = find(parent[a]));
  open.forEach(([a, b]) => { parent[find(a)] = find(b); });
  const groups = {};
  rooms.forEach(r => (groups[find(r.id)] ||= []).push(r));
  for (const grp of Object.values(groups)) {
    const ids = grp.map(r => r.id);
    const inGrp = (i, j) => { const x = X0 + (i + 0.5) * G, y = Y0 + (j + 0.5) * G; return grp.some(r => x > r.r[0] && x < r.r[2] && y > r.r[1] && y < r.r[3]); };
    const comp = new Int32Array(NX * NY).fill(-1);
    const sizes = [];
    const gb = [Math.min(...grp.map(r => r.r[0])), Math.min(...grp.map(r => r.r[1])), Math.max(...grp.map(r => r.r[2])), Math.max(...grp.map(r => r.r[3]))];
    const gi0 = Math.floor((gb[0] - X0) / G), gi1 = Math.ceil((gb[2] - X0) / G), gj0 = Math.floor((gb[1] - Y0) / G), gj1 = Math.ceil((gb[3] - Y0) / G);
    for (let j = gj0; j <= gj1; j++) for (let i = gi0; i <= gi1; i++) {
      const k = j * NX + i;
      if (near[k] || comp[k] >= 0 || !inGrp(i, j)) continue;
      const id = sizes.length; let n = 0; const st = [k]; comp[k] = id;
      while (st.length) {
        const c = st.pop(); n++;
        const ci = c % NX, cj = (c - ci) / NX;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = ci + di, jj = cj + dj, kk = jj * NX + ii;
          if (ii < gi0 || ii > gi1 || jj < gj0 || jj > gj1 || near[kk] || comp[kk] >= 0 || !inGrp(ii, jj)) continue;
          comp[kk] = id; st.push(kk);
        }
      }
      sizes.push(n);
    }
    if (!sizes.length) continue; // e.g. a room that is all stair
    const main = sizes.indexOf(Math.max(...sizes));
    for (const d of doors) {
      if (d.t === 'hatch') continue;
      const h = d.o === 'h';
      const frac = d.t === 'sliding' || d.t === 'folding' ? 0.75 : 0.5; // glass parks over the first half
      const c = h ? [d.x + d.w * frac, d.y] : [d.x, d.y + d.w * frac];
      for (const s of [1, -1]) {
        const p = h ? [c[0], c[1] + 0.6 * s] : [c[0] + 0.6 * s, c[1]];
        const rm = grp.find(r => p[0] > r.r[0] && p[0] < r.r[2] && p[1] > r.r[1] && p[1] < r.r[3]);
        if (!rm) continue;
        // door must actually be on this room's boundary
        const rr = rm.r;
        const onEdge = h ? (Math.abs(d.y - rr[1]) < 1e-6 || Math.abs(d.y - rr[3]) < 1e-6) : (Math.abs(d.x - rr[0]) < 1e-6 || Math.abs(d.x - rr[2]) < 1e-6);
        if (!onEdge) continue;
        let ok = false;
        const ci = Math.floor((p[0] - X0) / G), cj = Math.floor((p[1] - Y0) / G), K2 = Math.ceil(0.35 / G);
        for (let dj = -K2; dj <= K2 && !ok; dj++) for (let di = -K2; di <= K2 && !ok; di++) {
          const kk = (cj + dj) * NX + ci + di;
          if (comp[kk] === main) ok = true;
        }
        if (!ok && process.env.DEBUG_PATH) {
          const rows = [];
          for (let dj = 120; dj >= -14; dj -= 4) { let row = ''; for (let di = -60; di <= 40; di += 2) { const kk = (cj + dj) * NX + ci + di; row += blocked[kk] ? '#' : near[kk] ? '+' : comp[kk] === main ? '.' : comp[kk] >= 0 ? 'o' : ' '; } rows.push(row); }
          console.log(rows.join('\n'));
        }
        if (!ok) err(lv, rm.id, `no 0.8 m path from ${d.t} ${d.o}@(${d.x}, ${d.y}) to the main area of [${ids.join(', ')}]`);
      }
    }
  }
}

if (errors.length) {
  console.log(errors.join('\n'));
  console.log(`\n✗ ${errors.length} violation(s) / pelanggaran. ${itemCount} items checked.`);
  process.exit(1);
}
console.log(`✓ OK — ${Object.keys(I.rooms).length} rooms, ${itemCount} items, 0 violations. / Interior OK.`);
console.log(Object.entries(typeCount).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', '));
