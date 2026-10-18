// Builds the house shell from the project data (engine/data.js → Z).
// Everything is generated: floors, ceilings, walls with door/window openings, stairs, the lift
// shaft, fixtures, roofs, balconies and the site (engine/site.js). Static geometry is merged per
// (group, material) to keep draw calls low. The same pass feeds the physics.
//
// Groups: 'site', 'ground', 'roof', one per level id, and 'ceil_<level>' (ceilings: hidden in the
// dollhouse view).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Z, PROJECT } from './data.js';
import { LEVELS, LEVEL_ORDER, GROUND, isBasement, WALL_EXT, WALL_INT, STAIRS, LIFT, LIFT_STOPS, LATITUDE } from './config.js';
import { subtract, box, plane, hipRoof, gableRoof, shedRoof, rng, hash, wallRuns, DOOR_TOP, DOOR_MODE } from './geom.js';
import { voidEdges, sideOnWall } from './stairs.js';
import { liftFrame } from './lift.js';
import { buildSiteShell, siteHoles } from './site.js';
import { USES } from './schema.js';

// Plan rects with no garden ground: pools, stairs coming up from a basement, a basement lift shaft
export const HOLES = siteHoles(Z, STAIRS, LIFT, LIFT_STOPS);
const GROUND_HOLES = Object.values(HOLES);

export const roofMaterial = () => PROJECT.style.roof || 'terracotta';
export const extWallMaterial = () => (PROJECT.style.exteriorColor ? 'stucco:' + PROJECT.style.exteriorColor : 'plasterExt');
export const overhang = (over) => (typeof over === 'number' ? { w: over, s: over, e: over, n: over } : { w: 0, s: 0, e: 0, n: 0, ...over });

function floorMat(room) {
  return USES[room.use]?.floor || 'travertine';
}

// ---------------------------------------------------------------- builder
// opts (all optional, wired by engine/assemble.js):
//   getMaterial(name)  material registry (names beyond the legacy M keys)
//   INTERIOR           interior data (rooms with replaceFixtures skip their simple fixture boxes)
//   buildFinishes, buildExterior, makeTrees   builders from the interior / exterior modules
//   staged             shell only (assembleStaged): finishes, exterior details and trees follow
//                      later, so build as if they were present but leave them out
export function buildWorld(M, physics, opts = {}) {
  const matOf = (k) => M[k] || (opts.getMaterial && opts.getMaterial(k)) || M.plaster;
  const lightDefs = [];
  const REPLACEABLE = new Set(['counter', 'island', 'wc', 'sink', 'tub', 'bench']);
  const replacedRooms = (lv) => (Z.floors[lv] || []).filter(r => opts.INTERIOR?.rooms?.[r.id]?.replaceFixtures).map(r => r.r);
  const inAny = (rects, f) => {
    if (f.ground || !f.r) return false;
    const cx = (f.r[0] + f.r[2]) / 2, cy = (f.r[1] + f.r[3]) / 2;
    return rects.some(r => cx > r[0] && cx < r[2] && cy > r[1] && cy < r[3]);
  };
  const buckets = new Map();
  const add = (group, mat, geo) => {
    if (!geo) return;
    const k = group + '|' + mat;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(geo.index ? geo.toNonIndexed() : geo);
  };
  const solid = (group, mat, x0, y0, x1, y1, z0, z1, collide = true) => {
    add(group, mat, box(x0, y0, x1, y1, z0, z1));
    if (collide) physics.addCollider(x0, y0, x1, y1, z0, z1);
  };
  const labels = [];     // { level, text, x, y, z }
  const extWall = extWallMaterial();
  const fancy = !!(opts.buildFinishes || opts.staged);  // the finishes module draws balustrades / handrails

  // ------------------------------------------------ voids through the slabs
  const lift = LIFT ? liftFrame(LIFT) : null;
  const lowStop = LIFT_STOPS[0], topStop = LIFT_STOPS[LIFT_STOPS.length - 1];
  const floorVoids = (lv, room) => {
    const v = [];
    for (const s of STAIRS) if (s.to === lv && overlaps(room.r, s.r)) v.push(s.r);
    if (lift && LIFT_STOPS.includes(lv) && lv !== lowStop && overlaps(room.r, LIFT.r)) v.push(LIFT.r);
    return v;
  };
  const ceilVoids = (lv, room) => {
    const v = [];
    for (const s of STAIRS) if (s.from === lv && overlaps(room.r, s.r)) v.push(s.r);
    if (lift && LIFT_STOPS.includes(lv) && lv !== topStop && overlaps(room.r, LIFT.r)) v.push(LIFT.r);
    return v;
  };

  // ------------------------------------------------ floors, ceilings, walls per level
  for (const lv of LEVEL_ORDER) {
    const L = LEVELS[lv], top = L.elev + L.h;
    const rooms = Z.floors[lv] || [];
    const basement = isBasement(lv);
    // the ground floor's walls start at the garden (a plinth under the raised floor)
    const base = lv === GROUND ? Math.min(0, L.elev) : L.elev;
    const above = LEVEL_ORDER[LEVEL_ORDER.indexOf(lv) + 1];
    const aboveRooms = above ? Z.floors[above] || [] : [];

    for (const room of rooms) {
      for (const r of subtract(room.r, floorVoids(lv, room))) {
        add(lv, opts.INTERIOR?.rooms?.[room.id]?.finish?.floor || floorMat(room), plane(r, L.elev, true));
        physics.addFlat(r, L.elev);
      }
      for (const r of subtract(room.r, ceilVoids(lv, room)))
        add('ceil_' + lv, basement ? 'ceilingBase' : 'ceiling', plane(r, top - 0.3, false));
      if (!room.noLabel) labels.push({
        level: lv, text: room.short || room.name,
        x: (room.r[0] + room.r[2]) / 2, y: (room.r[1] + room.r[3]) / 2, z: L.elev + 1.4,
      });
    }

    // ------------------------------------------------ walls with openings
    const openings = Z.openings[lv] || [];
    for (const run of wallRuns(rooms, Z.open[lv])) {
      const t = run.cls === 'ext' ? WALL_EXT : WALL_INT;
      const mat = basement ? (run.cls === 'ext' ? 'concreteWall' : 'plaster') : (run.cls === 'ext' ? extWall : 'plaster');
      const rect = (a, b) => run.o === 'h'
        ? [a, run.fixed - t / 2, b, run.fixed + t / 2]
        : [run.fixed - t / 2, a, run.fixed + t / 2, b];
      // is a room of the level above sitting on this wall? (then its top cap would z-fight with that floor)
      const covered = (a, b) => aboveRooms.some(q => {
        const m = (a + b) / 2;
        return run.o === 'h' ? (m > q.r[0] && m < q.r[2] && run.fixed >= q.r[1] - 1e-6 && run.fixed <= q.r[3] + 1e-6)
          : (m > q.r[1] && m < q.r[3] && run.fixed >= q.r[0] - 1e-6 && run.fixed <= q.r[2] + 1e-6);
      });
      const piece = (a, b, z0, z1, m = mat, collide = true) => {
        if (b - a < 1e-3 || z1 - z0 < 1e-3) return;
        const r = rect(a, b);
        if (!(z1 >= top - 1e-6 && covered(a, b))) { solid(lv, m, r[0], r[1], r[2], r[3], z0, z1, collide); return; }
        // The wall's top cap would be coplanar with the floor above and flicker through it (z-fighting):
        // sink just the cap 1 cm; the side faces still reach the floor so the façade stays seamless.
        const g = box(r[0], r[1], r[2], r[3], z0, z1);
        if (!g) return;
        const pos = g.attributes.position;
        for (let i = 8; i < 12; i++) pos.setY(i, pos.getY(i) - 0.01); // BoxGeometry face 2 = +Y
        add(lv, m, g);
        if (collide) physics.addCollider(r[0], r[1], r[2], r[3], z0, z1);
      };
      const ops = openings
        .filter(d => d.o === run.o && Math.abs((run.o === 'h' ? d.y : d.x) - run.fixed) < 1e-6)
        .map(d => {
          const a = run.o === 'h' ? d.x : d.y;
          return { d, a: Math.max(a, run.start), b: Math.min(a + d.w, run.end) };
        })
        .filter(o => o.b - o.a > 0.05)
        .sort((p, q) => p.a - q.a);

      let cur = run.start;
      for (const { d, a, b } of ops) {
        piece(cur, a, base, top);
        const fl = L.elev;
        if (d.t === 'window') {
          piece(a, b, base, fl + 0.9);
          piece(a, b, fl + 0.9, fl + 2.3, 'glass');
          piece(a, b, fl + 2.3, top);
        } else if (d.t === 'glass') {
          piece(a, b, base, fl + 0.05);
          piece(a, b, fl + 0.05, fl + 2.7, 'glass');
          piece(a, b, fl + 2.7, top);
        } else if (d.t === 'high') {
          piece(a, b, base, fl + 2.4);
          piece(a, b, fl + 2.4, Math.min(top - 0.35, fl + 3.2), 'glass');
          piece(a, b, Math.min(top - 0.35, fl + 3.2), top);
        } else {
          const dt = fl + (DOOR_TOP[d.t] || 2.2);
          piece(a, b, dt, top);
          if (base < fl) piece(a, b, base, fl - 0.02, mat, false); // plinth under ground-floor doors
          doorLeaves(lv, d, run, fl, dt);
        }
        cur = b;
      }
      piece(cur, run.end, base, top);
    }

    // ------------------------------------------------ fixtures
    const replaced = replacedRooms(lv);
    for (const f of Z.fixtures[lv] || []) {
      if (REPLACEABLE.has(f.t) && inAny(replaced, f)) continue;
      fixture(lv, L, f);
    }
  }

  // Door leaves in the open position (headless builds); the app animates them (engine/doors.js).
  function doorLeaves(lv, d, run, fl, dt) {
    const h = d.o === 'h';
    const along = h ? d.x : d.y, fixed = run.fixed;
    const leaf = (hingeA, width, side, thick, mat) => {
      const inset = 0.04 * Math.sign(width);
      const a = hingeA + inset;
      if (h) solid(lv, mat, a - thick / 2, fixed, a + thick / 2, fixed + side * Math.abs(width), fl, dt - 0.02, false);
      else solid(lv, mat, fixed, a - thick / 2, fixed + side * Math.abs(width), a + thick / 2, fl, dt - 0.02, false);
    };
    const side = d.side || 1;
    const dyn = DOOR_MODE.dynamic; // engine/doors.js draws the moving leaves (closed, animated)
    if (dyn && d.t !== 'sliding' && d.t !== 'folding') { /* leaves come from engine/doors.js */ }
    else if (d.t === 'swing') {
      if (d.hinge === 'e') leaf(along + d.w, -d.w, side, 0.05, 'door');
      else leaf(along, d.w, side, 0.05, 'door');
    } else if (d.t === 'double') {
      leaf(along, d.w / 2, side, 0.05, 'door');
      leaf(along + d.w, -d.w / 2, side, 0.05, 'door');
    } else if (d.t === 'sliding' || d.t === 'folding') {
      // Glass panel parked over the first half of the opening (still a barrier there)
      const a = along, b = along + d.w * 0.5;
      const r = h ? [a, fixed - 0.03, b, fixed + 0.03] : [fixed - 0.03, a, fixed + 0.03, b];
      solid(lv, 'glass', r[0], r[1], r[2], r[3], fl, dt, true);
      const fr = h ? [a, fixed - 0.05, b, fixed + 0.05] : [fixed - 0.05, a, fixed + 0.05, b];
      solid(lv, 'frame', fr[0], fr[1], fr[2], fr[3], dt - 0.06, dt, false);
    }
  }

  // ------------------------------------------------ stairs (engine/stairs.js plans)
  for (const S of STAIRS) {
    const lv = S.from, mat = S.material || (isBasement(lv) ? 'concrete' : 'woodDark');
    for (const F of S.flights) {
      physics.addSlope(F.rect, ...F.slope);
      for (const st of F.steps) add(lv, mat, box(st.rect[0], st.rect[1], st.rect[2], st.rect[3], st.top - 0.32, st.top));
      // a free-standing side (no wall beside it): keep walkers on the flight (the finishes draw the balustrade)
      for (const t of [F.t0, F.t1]) {
        if (sideOnWall(S, Z, t)) continue;
        const segs = 6;
        for (let i = 0; i < segs; i++) {
          const sa = F.sStart + (F.sEnd - F.sStart) * i / segs, sb = F.sStart + (F.sEnd - F.sStart) * (i + 1) / segs;
          const ha = F.hStart + (F.hEnd - F.hStart) * i / segs, hb = F.hStart + (F.hEnd - F.hStart) * (i + 1) / segs;
          const off = t === F.t0 ? 0.03 : -0.03;
          const r = S.frame.R(Math.min(sa, sb), Math.max(sa, sb), t + off - 0.025, t + off + 0.025);
          physics.addCollider(r[0], r[1], r[2], r[3], Math.min(ha, hb) + 0.3, Math.max(ha, hb) + 1.0);
          if (!fancy) add(lv, 'railing', box(r[0], r[1], r[2], r[3], Math.max(ha, hb) + 0.85, Math.max(ha, hb) + 0.9));
        }
      }
    }
    if (S.landing) {
      const l = S.landing.rect;
      physics.addFlat(l, S.landing.z);
      add(lv, mat, box(l[0], l[1], l[2], l[3], S.landing.z - 0.3, S.landing.z));
    }
    if (S.split) {
      const r = S.split.rect;
      solid(lv, 'plaster', r[0], r[1], r[2], r[3], S.split.z0, S.split.z1);
    }
    // Void edges on the upper floor: a railing (the finishes module draws the balustrade)
    for (const [x0, y0, x1, y1] of voidEdges(S, Z)) {
      const h = y0 === y1;
      const r = h ? [x0, y0 - 0.05, x1, y0 + 0.05] : [x0 - 0.05, y0, x0 + 0.05, y1];
      if (fancy) physics.addCollider(r[0], r[1], r[2], r[3], S.B, S.B + 1.0);
      else solid(S.to, 'railing', r[0], r[1], r[2], r[3], S.B, S.B + 1.0);
    }
  }

  // ------------------------------------------------ lift shaft (the car and doors: engine/lift.js)
  if (lift) {
    for (const lv of LIFT_STOPS) {
      const e = LEVELS[lv].elev, top = e + LEVELS[lv].h;
      for (const piece of lift.shaft) {
        const r = piece.r;
        if (piece.head) add(lv, piece.mat, box(r[0], r[1], r[2], r[3], e + 2.15, top));
        else solid(lv, piece.mat, r[0], r[1], r[2], r[3], e, top);
      }
    }
  }

  // ------------------------------------------------ fixtures (simple built-ins; the interior adds furniture)
  function fixture(lv, L, f) {
    const e = f.ground ? 0 : L.elev;
    const r = f.r;
    switch (f.t) {
      case 'counter':
        solid(lv, 'counter', r[0], r[1], r[2], r[3], e, e + 0.86);
        add(lv, 'counterTop', box(r[0] - 0.02, r[1] - 0.02, r[2] + 0.02, r[3] + 0.02, e + 0.86, e + 0.9));
        break;
      case 'island':
        solid(lv, 'woodDark', r[0], r[1], r[2], r[3], e, e + 0.86);
        add(lv, 'counterTop', box(r[0] - 0.05, r[1] - 0.05, r[2] + 0.05, r[3] + 0.05, e + 0.86, e + 0.92));
        break;
      case 'partition': {
        const [ax, ay] = f.from, [bx, by] = f.to, hh = f.h ?? 1.2;
        if (ax === bx) solid(lv, 'woodDark', ax - 0.06, Math.min(ay, by), ax + 0.06, Math.max(ay, by), e, e + hh);
        else solid(lv, 'woodDark', Math.min(ax, bx), ay - 0.06, Math.max(ax, bx), ay + 0.06, e, e + hh);
        break;
      }
      case 'wc': solid(lv, 'ceramic', r[0], r[1], r[2], r[3], e, e + 0.42, false); break;
      case 'sink': solid(lv, 'ceramic', r[0], r[1], r[2], r[3], e + 0.75, e + 0.88, false); break;
      case 'shower': add(lv, f.style === 'pebble' ? 'gravel' : 'ceramic', box(r[0], r[1], r[2], r[3], e, e + 0.03)); break;
      case 'bench': solid(lv, f.style === 'teak' ? 'wood' : 'tileBath', r[0], r[1], r[2], r[3], e, e + 0.45); break;
      case 'tub': solid(lv, 'ceramic', r[0], r[1], r[2], r[3], e, e + 0.58); break;
      case 'solid': solid(lv, f.material || 'plaster', r[0], r[1], r[2], r[3], e, e + (f.h ?? L.h)); break; // duct / column / chimney
      case 'stall': {
        const w = 0.08, z = e + 0.004;
        add(lv, 'paint', box(r[0], r[1], r[2], r[1] + w, e, z));
        add(lv, 'paint', box(r[0], r[3] - w, r[2], r[3], e, z));
        break;
      }
      case 'vine': {
        // Climbing plant on a wall: a leafy mat plus irregular leaf clusters
        const [ax, ay] = f.from, [bx, by] = f.to;
        const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
        if (ax === bx) add(lv, 'leaves', box(ax - 0.05, Math.min(ay, by), ax + 0.05, Math.max(ay, by), e + 0.1, e + 2.75));
        else add(lv, 'leaves', box(Math.min(ax, bx), ay - 0.05, Math.max(ax, bx), ay + 0.05, e + 0.1, e + 2.75));
        const rand = rng(hash(f.from.join() + f.to.join()));
        for (let d = 0.2; d < len; d += 0.35) for (let k = 0; k < 4; k++) {
          const g = new THREE.IcosahedronGeometry(0.16 + rand() * 0.16, 0);
          const off = (rand() - 0.5) * 0.12;
          g.translate(ax + ux * d + (uy !== 0 ? off : 0), e + 0.2 + rand() * 2.55, -(ay + uy * d + (ux !== 0 ? off : 0)));
          add(lv, rand() > 0.5 ? 'leaves' : 'leavesLight', g);
        }
        break;
      }
      case 'plant': {
        const [cx, cy, rad] = f.c;
        const pot = new THREE.CylinderGeometry(rad * 0.5, rad * 0.4, rad * 0.7, 12);
        pot.translate(cx, e + rad * 0.35, -cy);
        add(lv, 'paversWarm', pot);
        const g = new THREE.IcosahedronGeometry(rad, 1);
        g.scale(1, 1.2, 1);
        g.translate(cx, e + rad * 1.6, -cy);
        add(lv, 'leavesLight', g);
        physics.addCollider(cx - rad * 0.5, cy - rad * 0.5, cx + rad * 0.5, cy + rad * 0.5, e, e + rad * 2);
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------ roofs
  const houseRoofs = []; // eave rectangles of the hip roofs that carry PV
  const roofMat = roofMaterial();
  for (const R of Z.roofs) {
    if (!Array.isArray(R.r)) continue;
    const o = overhang(R.over), mat = R.material || roofMat;
    const eave = [R.r[0] - o.w, R.r[1] - o.s, R.r[2] + o.e, R.r[3] + o.n];
    if (R.type === 'flat') {
      const t = R.thickness;
      add('roof', 'plaster', box(eave[0], eave[1], eave[2], eave[3], R.base, R.base + t));
      add('roof', R.material || 'roofDeck', plane(eave, R.base + t + 0.005));
      if (R.parapet > 0) {
        const pz0 = R.base + t, pz1 = pz0 + R.parapet, pw = 0.15;
        add('roof', extWall, box(eave[0], eave[1], eave[2], eave[1] + pw, pz0, pz1));
        add('roof', extWall, box(eave[0], eave[3] - pw, eave[2], eave[3], pz0, pz1));
        add('roof', extWall, box(eave[0], eave[1] + pw, eave[0] + pw, eave[3] - pw, pz0, pz1));
        add('roof', extWall, box(eave[2] - pw, eave[1] + pw, eave[2], eave[3] - pw, pz0, pz1));
      }
      continue;
    }
    if (R.type === 'gable') {
      const g = gableRoof(R.r, R.base, R.pitch, R.over, R.ridge);
      add('roof', mat, g.roof);
      add('roof', extWall, g.gables);
    } else if (R.type === 'shed') {
      const g = shedRoof(R.r, R.base, R.pitch, R.over, R.down);
      add('roof', mat, g.roof);
      if (g.gables) add('roof', extWall, g.gables);
    } else {
      add('roof', mat, hipRoof(R.r, R.base, R.pitch, R.over, R.top));
      if (R.pv && PROJECT.features.pv !== false) houseRoofs.push({ x0: eave[0], y0: eave[1], x1: eave[2], y1: eave[3], base: R.base, pitch: R.pitch, top: R.top });
    }
    add('roof', 'soffit', plane(eave, R.base - 0.02, false));
  }

  // ------------------------------------------------ PV on the pitched house roofs
  // Standard black mono on-roof modules (PV.w × PV.l) on rails, PV.standoff above the tiles,
  // following each hip-roof plane. Only the planes that face the equator, east or west (a plane
  // facing the pole is skipped). A point is usable on plane `side` of roof R when it keeps the
  // setbacks from the eave / hips / ridge and is not under another roof (valleys) with ~0.4 m
  // clearance. Each row is scanned along the eave and full modules are centred in every free
  // stretch (portrait or landscape, whichever fits more on that plane).
  const PV = { w: 1.134, l: 2.279, t: 0.035, wp: PROJECT.spec.panelWp || 550, standoff: 0.08, gap: 0.025 };
  const instances = { pv: [], rails: [] };
  {
    const SET = { eave: 0.4, hip: 0.55, ridge: 0.8, valley: 0.4 };
    const allRoofs = Z.roofs.filter(r => Array.isArray(r.r) && r.type !== 'flat').map(R => { const o = overhang(R.over); return { x0: R.r[0] - o.w, y0: R.r[1] - o.s, x1: R.r[2] + o.e, y1: R.r[3] + o.n, base: R.base, pitch: R.pitch, top: R.top }; });
    const dist = (R, x, y) => ({ w: x - R.x0, e: R.x1 - x, s: y - R.y0, n: R.y1 - y });
    const inside = (R, x, y) => x >= R.x0 && x <= R.x1 && y >= R.y0 && y <= R.y1;
    const hAt = (R, x, y) => { const d = dist(R, x, y); return Math.min(R.top ?? Infinity, R.base + R.pitch * Math.min(d.w, d.e, d.s, d.n)); };
    const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
    const same = (A, B) => Math.abs(A.x0 - B.x0) < 1e-6 && Math.abs(A.y0 - B.y0) < 1e-6 && Math.abs(A.x1 - B.x1) < 1e-6 && Math.abs(A.y1 - B.y1) < 1e-6;
    const valid = (R, side, x, y) => {
      const d = dist(R, x, y), de = d[side];
      if (de < SET.eave) return false;
      for (const k of 'nsew') if (k !== side && d[k] - de < (k === OPP[side] ? SET.ridge : SET.hip)) return false;
      for (const [ox, oy] of [[0, 0], [SET.valley, 0], [-SET.valley, 0], [0, SET.valley], [0, -SET.valley]]) {
        const qx = x + ox, qy = y + oy, own = R.base + R.pitch * dist(R, qx, qy)[side];
        for (const R2 of allRoofs) if (!same(R2, R) && inside(R2, qx, qy) && hAt(R2, qx, qy) > own - 0.02) return false;
      }
      return true;
    };
    const DIR = { n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0] };
    const pvPlane = (R, side, landscape) => {
      const [dx, dy] = DIR[side], cosT = 1 / Math.hypot(1, R.pitch), sinT = R.pitch * cosT;
      const along = landscape ? PV.w : PV.l, across = landscape ? PV.l : PV.w;
      const horiz = side === 'n' || side === 's';
      const [uMin, uMax] = horiz ? [R.x0, R.x1] : [R.y0, R.y1];
      const eave = { n: R.y1, s: R.y0, e: R.x1, w: R.x0 }[side];
      const at = (u, h) => horiz ? [u, eave - dy * h] : [eave - dx * h, u];
      const depth = Math.min(R.x1 - R.x0, R.y1 - R.y0) / 2;
      const U = horiz ? [1, 0, 0] : [0, 1, 0];
      const N = [dx * sinT, dy * sinT, cosT], S = [-dx * cosT, -dy * cosT, sinT];   // normal, up-slope
      const out = { pv: [], rails: [] };
      for (let a = SET.eave / cosT; a * cosT < depth; a += along + PV.gap) {
        const hA = a * cosT, hB = (a + along) * cosT;
        if (hB > depth) break;
        const hs = [0, 0.25, 0.5, 0.75, 1].map(k => hA + (hB - hA) * k);
        const segs = [];
        let s0 = null, last = null;
        for (let u = uMin; u <= uMax + 1e-9; u += 0.05) {
          const ok = hs.every(h => { const [x, y] = at(u, h); return valid(R, side, x, y); });
          if (ok) { if (s0 === null) s0 = u; last = u; }
          else if (s0 !== null) { segs.push([s0, last]); s0 = null; }
        }
        if (s0 !== null) segs.push([s0, last]);
        const hc = (hA + hB) / 2, off = PV.standoff + PV.t / 2;
        for (const [g0, g1] of segs) {
          const n = Math.floor((g1 - g0 + PV.gap) / (across + PV.gap));
          if (n < 1) continue;
          const span = n * across + (n - 1) * PV.gap, u0 = (g0 + g1) / 2 - span / 2;
          const [sx, sy] = at(0, hc), z = R.base + R.pitch * hc;
          const C = (u, o) => { const [x, y] = horiz ? [u, sy] : [sx, u]; return [x + N[0] * o, y + N[1] * o, z + N[2] * o]; };
          for (let i = 0; i < n; i++)
            out.pv.push({ c: C(u0 + across / 2 + i * (across + PV.gap), off), X: landscape ? S : U, N });
          for (const k of [-0.27, 0.27]) {    // two rails under each run, at ~quarter points of the module
            const c = C(u0 + span / 2, 0.05);
            out.rails.push({ c: [c[0] + S[0] * k * along, c[1] + S[1] * k * along, c[2] + S[2] * k * along], X: U, N, sx: span + 0.1 });
          }
        }
      }
      return out;
    };
    // planes facing the equator, east and west (south of the equator the sun is to the north)
    const sides = LATITUDE < 0 ? ['n', 'e', 'w'] : ['s', 'e', 'w'];
    for (const R of houseRoofs) {
      for (const side of sides) {
        const mid = { n: [(R.x0 + R.x1) / 2, R.y1], s: [(R.x0 + R.x1) / 2, R.y0], e: [R.x1, (R.y0 + R.y1) / 2], w: [R.x0, (R.y0 + R.y1) / 2] }[side];
        if (allRoofs.some(R2 => !same(R2, R) && inside(R2, ...mid) && hAt(R2, ...mid) > R.base + 0.05)) continue;
        const p = pvPlane(R, side, false), l = pvPlane(R, side, true);
        const best = l.pv.length > p.pv.length ? l : p;
        for (const it of best.pv) instances.pv.push({ ...it, group: 'roof', kind: 'roof' });
        for (const it of best.rails) instances.rails.push({ ...it, group: 'roof' });
      }
    }
  }

  // ------------------------------------------------ outdoor decks on upper levels (balconies, roof terraces)
  for (const lv of LEVEL_ORDER) {
    const e = LEVELS[lv].elev;
    for (const it of Z.outdoor[lv] || []) {
      const r = it.r;
      if (!Array.isArray(r)) continue;
      add(lv, it.material || (it.kind === 'roofTerrace' ? 'roofDeck' : 'teak'), plane(r, e));
      add(lv, 'plaster', box(r[0], r[1], r[2], r[3], e - 0.25, e - 0.005));
      physics.addFlat(r, e);
      // railing on the edges that are not against a room of this level
      const rooms = Z.floors[lv] || [];
      const against = (x0, y0, x1, y1) => rooms.some(q => {
        const h = y0 === y1;
        return h ? (Math.abs(q.r[1] - y0) < 1e-6 || Math.abs(q.r[3] - y0) < 1e-6) && Math.min(q.r[2], x1) - Math.max(q.r[0], x0) > 0.3
          : (Math.abs(q.r[0] - x0) < 1e-6 || Math.abs(q.r[2] - x0) < 1e-6) && Math.min(q.r[3], y1) - Math.max(q.r[1], y0) > 0.3;
      });
      const rail = it.rail || 'auto';
      const edges = { s: [r[0], r[1], r[2], r[1]], n: [r[0], r[3], r[2], r[3]], w: [r[0], r[1], r[0], r[3]], e: [r[2], r[1], r[2], r[3]] };
      for (const [k, [x0, y0, x1, y1]] of Object.entries(edges)) {
        if (rail !== 'auto' ? !rail.includes(k) : against(x0, y0, x1, y1)) continue;
        const h = y0 === y1;
        const rr = h ? [x0, y0 - (k === 's' ? 0 : 0.05), x1, y0 + (k === 's' ? 0.05 : 0)] : [x0 - (k === 'w' ? 0 : 0.05), y0, x0 + (k === 'w' ? 0.05 : 0), y1];
        add(lv, 'railing', box(rr[0], rr[1], rr[2], rr[3], e + 0.98, e + 1.05));
        add(lv, 'glass', box(rr[0], rr[1], rr[2], rr[3], e + 0.05, e + 0.98));
        physics.addCollider(rr[0], rr[1], rr[2], rr[3], e, e + 1.05);
        const len = h ? x1 - x0 : y1 - y0, n = Math.max(1, Math.round(len / 1.2));   // posts every ~1.2 m
        for (let i = 0; i <= n; i++) {
          const a = (h ? x0 : y0) + len * i / n;
          const pr = h ? [Math.max(x0, a - 0.03), rr[1], Math.min(x1, a + 0.03), rr[3]] : [rr[0], Math.max(y0, a - 0.03), rr[2], Math.min(y1, a + 0.03)];
          add(lv, 'railing', box(pr[0], pr[1], pr[2], pr[3], e, e + 1.0));
        }
      }
    }
  }

  // ------------------------------------------------ site: ground, surfaces, pool, walls, carport …
  const site = buildSiteShell({ Z, add, solid, physics, holes: GROUND_HOLES, roofMat, extWall, fancy });
  const trees = site.trees;

  // ------------------------------------------------ interior finishes & exterior detailing
  if (opts.buildFinishes) opts.buildFinishes({ Z, INTERIOR: opts.INTERIOR || { rooms: {} }, LEVELS, add, lights: lightDefs });
  let exteriorObjects = [];
  if (opts.buildExterior) {
    const ext = opts.buildExterior({ Z, LEVELS, HOLES, add, physics, getMaterial: matOf });
    exteriorObjects = ext.objects || [];
    lightDefs.push(...(ext.lights || []));
  }

  // ------------------------------------------------ assemble merged meshes
  const groups = {};
  for (const k of ['site', 'ground', 'roof', ...LEVEL_ORDER, ...LEVEL_ORDER.map(l => 'ceil_' + l)])
    groups[k] = new THREE.Group();
  for (const [key, geos] of buckets) {
    const [group, mat] = key.split('|');
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const material = matOf(mat);
    const mesh = new THREE.Mesh(merged, material);
    const noShadow = material.userData.noShadow || material.transparent;
    mesh.castShadow = !noShadow && group !== 'ground' && !group.startsWith('ceil_');
    mesh.receiveShadow = true;
    groups[group].add(mesh);
  }
  exteriorObjects.forEach(o => groups.site.add(o));

  // Trees: the exterior module's photo vegetation (makeTrees), or simple blob trees (headless)
  if (opts.staged) {
    // trees (and their colliders) come with the exterior stage
  } else if (opts.makeTrees) {
    opts.makeTrees(trees, matOf).forEach(o => groups.site.add(o));
    for (const t of trees) physics.addCollider(t.x - 0.2 * t.s, t.y - 0.2 * t.s, t.x + 0.2 * t.s, t.y + 0.2 * t.s, 0, 2.4);
  } else if (trees.length) {
    const trunkG = new THREE.CylinderGeometry(0.12, 0.2, 2.4, 6); trunkG.translate(0, 1.2, 0);
    const leafG = new THREE.IcosahedronGeometry(1.5, 1); leafG.translate(0, 3.1, 0);
    const trunk = new THREE.InstancedMesh(trunkG, M.trunk, trees.length);
    const leaf = new THREE.InstancedMesh(leafG, M.leaves, trees.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const rand = rng(99);
    trees.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
      s.set(t.s, t.s * (0.9 + rand() * 0.25), t.s);
      p.set(t.x, 0, -t.y);
      m.compose(p, q, s);
      trunk.setMatrixAt(i, m); leaf.setMatrixAt(i, m);
      physics.addCollider(t.x - 0.2 * t.s, t.y - 0.2 * t.s, t.x + 0.2 * t.s, t.y + 0.2 * t.s, 0, 2.4);
    });
    for (const im of [trunk, leaf]) { im.castShadow = true; im.receiveShadow = true; groups.site.add(im); }
  }

  // PV modules on the house roofs (instanced), plus their rails
  {
    const pvMat = new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.22, metalness: 0.45 });
    const W3 = (v) => new THREE.Vector3(v[0], v[2], -v[1]);
    const m = new THREE.Matrix4();
    const put = (list, geo, mat, group, shadow) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((s, i) => {
        const X = W3(s.X).normalize(), Y = W3(s.N).normalize(), Zv = X.clone().cross(Y);
        m.makeBasis(X, Y, Zv).scale(new THREE.Vector3(s.sx || 1, 1, 1));
        m.setPosition(W3(s.c));
        im.setMatrixAt(i, m);
      });
      im.castShadow = shadow; im.receiveShadow = false;
      groups[group].add(im);
    };
    put(instances.pv, new THREE.BoxGeometry(PV.w, PV.t, PV.l), pvMat, 'roof', true);
    put(instances.rails, new THREE.BoxGeometry(1, 0.04, 0.04), matOf('steelBrushed'), 'roof', false);
  }

  // ------------------------------------------------ energy stats (spec tab, cost estimate)
  const kwp = (n) => Math.round(n * PV.wp / 10) / 100;
  const pvCount = instances.pv.length;
  const energy = {
    panelWp: PV.wp, panelArea: PV.w * PV.l,
    groups: pvCount ? [{ id: 'roof', panels: pvCount, kwp: kwp(pvCount) }] : [],
    totalPanels: pvCount, totalKwp: kwp(pvCount),
  };

  physics.build();
  return { groups, labels, lights: lightDefs, energy, trees };
}

function overlaps(a, b) {
  return Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 1e-6 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 1e-6;
}
