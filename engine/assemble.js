// Builds the complete property: shell (world.js) + finishes + exterior + furniture.
// Shared by the app (engine/main.js) and the walkability check (scripts/check.mjs)
// so the check sees exactly the colliders the visitor walks into.
//
//   assemble()        everything, synchronously (desktop app, every Node script)
//   assembleStaged()  the shell now, the rest as resumable stages (phones / tablets, see below)
import * as THREE from 'three';
import { Z, INTERIOR, FEATURES } from './data.js';
import { LEVELS, LEVEL_ORDER, GROUND } from './config.js';
import { buildWorld, HOLES } from './world.js';
import { buildFinishes, buildFinishesSteps } from './interior/finishes.js';
import * as EXT from './exterior.js';
import { placeInterior, placeInteriorSteps, bucketMesh } from './interior/place.js';
import { mergeSteps, mergeNow } from './geom.js';
import { DRIVABLE } from './interior/furniture/vehicles.js';

// Furniture entries: the rooms, plus the 'areas' outside the rooms (keyed by a site item id, at the
// garden level unless the area names a level / elevation) and the upper-floor outdoor decks
function interiorRooms() {
  const out = { ...INTERIOR.rooms };
  const deckLevel = new Map();
  for (const [lv, list] of Object.entries(Z.outdoor || {})) for (const o of list) if (o.id) deckLevel.set(o.id, lv);
  for (const [id, a] of Object.entries(INTERIOR.areas || {})) {
    const lv = a.level || deckLevel.get(id) || GROUND;
    out[id] = { ...a, level: lv, elev: a.elev ?? (deckLevel.has(id) || a.level ? LEVELS[lv].elev : 0) };
  }
  return out;
}

// The drivable cars (garage + carport): not part of the merged furniture, engine/drive builds them.
// [{ id, type, x, y, rot, lv, elev, params }]
export function vehicleList(rooms = interiorRooms()) {
  const out = [], seen = new Map();
  if (FEATURES.cars === false) return out;
  for (const [roomId, entry] of Object.entries(rooms)) {
    const lv = entry.level || Object.keys(Z.floors).find(l => Z.floors[l].some(r => r.id === roomId));
    if (!lv) continue;
    (entry.items || []).forEach((it, i) => {
      if (!DRIVABLE.has(it.type)) return;
      // id = the car type (stable across edits of the room list; '#2' for a second one)
      const n = (seen.get(it.type) || 0) + 1; seen.set(it.type, n);
      out.push({ id: it.type + (n > 1 ? '#' + n : ''), room: roomId, type: it.type, x: it.x, y: it.y, rot: it.rot || 0, lv, elev: entry.elev ?? LEVELS[lv].elev, params: it });
    });
  }
  return out;
}

// Both builds hand the app the same structure: the shell merged per (group, material); finishes
// merged per (level, group, material) and tagged userData.stage = level; furniture merged per
// (level, room, material), decor apart, tagged { stage, room, decor, box } (see place.js). The app
// hides other floors' finishes and furniture, and rooms (decor sooner) away from the visitor.
const DETAIL_LEVELS = LEVEL_ORDER;

export function assemble({ M, getMaterial, physics }) {
  // finishes per level into buckets of their own, as the staged build does; the stair balustrades
  // (all levels) come with L1
  const finishBuckets = new Map(); // level → Map(group|material → geometries)
  const finishes = ({ add, ...args }) => { // eslint-disable-line no-unused-vars
    for (const lv of DETAIL_LEVELS) {
      const b = new Map();
      finishBuckets.set(lv, b);
      buildFinishes({ ...args, add: bucketAdd(b), levels: [lv], stairs: lv === GROUND });
    }
  };
  const world = buildWorld(M, physics, {
    getMaterial, INTERIOR, buildFinishes: finishes,
    buildExterior: FEATURES.site !== false ? EXT.buildExterior : null, makeTrees: FEATURES.garden !== false ? EXT.makeTrees : null,
  });
  const matOf = (k) => M[k] || (getMaterial && getMaterial(k)) || M.plaster;
  for (const [lv, buckets] of finishBuckets) for (const [key, geos] of buckets) {
    const [group, mat] = key.split('|');
    const merged = mergeNow(geos);
    if (merged) world.groups[group].add(shellMesh(merged, matOf(mat), group, lv));
  }
  const interior = FEATURES.furniture === false ? { lights: [], seats: [], problems: [], count: 0 }
    : placeInterior({ Z, INTERIOR: { rooms: interiorRooms() }, LEVELS, getMaterial, physics, groups: world.groups, byRoom: true });
  physics.build(); // rebuild the spatial grid with furniture colliders
  return { ...world, lights: [...world.lights, ...interior.lights], interior, vehicles: vehicleList() };
}

// world.js-style buckets: group|materialName → non-indexed geometries
const bucketAdd = (buckets) => (group, mat, geo) => {
  if (!geo) return;
  const k = group + '|' + mat;
  if (!buckets.has(k)) buckets.set(k, []);
  buckets.get(k).push(geo.index ? geo.toNonIndexed() : geo);
};
// A merged finish / exterior mesh, with world.js's shadow rule; stage = the level it belongs to
function shellMesh(merged, material, group, stage) {
  const mesh = new THREE.Mesh(merged, material);
  mesh.userData.stage = stage;
  const noShadow = material.userData.noShadow || material.transparent;
  mesh.castShadow = !noShadow && group !== 'ground' && !group.startsWith('ceil_');
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------- staged build
// The shell (floors, walls, ceilings, stairs, roofs, site ground, fixtures) is built right away;
// then five stages follow: 'site' (exterior detailing, outbuildings, trees) and one per level
// (finishes + furniture). Each stage is a generator that does a small piece of work per step
// (one room, one furniture item, one exterior section, one merged mesh), so the caller can
// spread it over frames. Nothing a stage builds is visible or solid until the stage lands:
// its meshes, colliders, lights and seats are handed over together in `landed`.
//
//   const built = assembleStaged({ M, getMaterial, physics });
//   built.stage.step()        one step of the first unfinished stage; returns the landed stage
//                             ({ id, meshes: [[group, mesh]], lights, seats, apply() }) when one
//                             finishes, true while work remains, false when all are done
//   built.stage.bump(id)      move a stage ('site' | a level id) to the front
//   built.stage.progress()    0..1
//   landed.apply()            adds its colliders to the physics and rebuilds the grid
// After all stages land the result matches assemble(): same geometry, colliders, lights and
// seats (merged per stage, so a few more meshes).
export function assembleStaged({ M, getMaterial, physics }) {
  const world = buildWorld(M, physics, {
    getMaterial, INTERIOR, staged: true,
  });
  const matOf = (k) => M[k] || (getMaterial && getMaterial(k)) || M.plaster;
  const rooms = interiorRooms();
  const interior = { lights: [], seats: [], problems: [], count: 0 };

  // Colliders / surfaces wait until their stage lands
  const deferred = () => {
    const ops = [];
    const p = {};
    for (const k of ['addCollider', 'addFlat', 'addSlope', 'addGlobalFlat']) p[k] = (...a) => { ops.push([k, a]); };
    p.apply = () => { for (const [k, a] of ops) physics[k](...a); ops.length = 0; physics.build(); };
    return p;
  };
  function* flush(buckets, landed) {
    for (const [key, geos] of buckets) {
      const [group, mat] = key.split('|');
      const merged = yield* mergeSteps(geos);
      if (merged) landed.meshes.push([group, shellMesh(merged, matOf(mat), group, landed.id)]);
      yield;
    }
    buckets.clear();
  }
  const newLanded = (id) => {
    const phys = deferred();
    return { id, phys, meshes: [], lights: [], seats: [], apply: phys.apply };
  };

  function* site() {
    const landed = newLanded('site');
    const buckets = new Map();
    if (FEATURES.site !== false) {
      const ext = yield* EXT.buildExteriorSteps({ Z, LEVELS, HOLES, add: bucketAdd(buckets), physics: landed.phys, getMaterial: matOf });
      yield* flush(buckets, landed);
      for (const o of ext.objects || []) landed.meshes.push(['site', o]);
      landed.lights.push(...(ext.lights || []));
    }
    yield;
    if (FEATURES.garden !== false) for (const o of EXT.makeTrees(world.trees, matOf)) landed.meshes.push(['site', o]);
    for (const t of world.trees) landed.phys.addCollider(t.x - 0.2 * t.s, t.y - 0.2 * t.s, t.x + 0.2 * t.s, t.y + 0.2 * t.s, 0, 2.4);
    return landed;
  }

  function* level(lv) {
    const landed = newLanded(lv);
    const buckets = new Map(), ib = new Map();
    // finishes: this level's rooms; the stair balustrades (all levels) come with the ground floor
    yield* buildFinishesSteps({ Z, INTERIOR, LEVELS, add: bucketAdd(buckets), lights: landed.lights, levels: [lv], stairs: lv === GROUND });
    const out = { lights: landed.lights, seats: landed.seats, problems: interior.problems, count: 0 };
    if (FEATURES.furniture !== false) yield* placeInteriorSteps({ Z, INTERIOR: { rooms }, LEVELS, getMaterial, physics: landed.phys, buckets: ib, out, levels: [lv], byRoom: true });
    interior.count += out.count;
    yield* flush(buckets, landed);
    for (const b of ib.values()) {
      const merged = yield* mergeSteps(b.geos);
      if (merged) landed.meshes.push([b.lv, bucketMesh(merged, b)]);
      yield;
    }
    return landed;
  }

  // Rough step counts, for the progress figure only
  const levelOf = (id, e) => e.level || Object.keys(Z.floors).find(lv => Z.floors[lv].some(r => r.id === id));
  const items = {};
  for (const [id, e] of Object.entries(rooms)) { const lv = levelOf(id, e); items[lv] = (items[lv] || 0) + (e.items || []).length; }
  const weight = (id) => id === 'site' ? 90 : (Z.floors[id] || []).length + (items[id] || 0) + 90;

  const tasks = ['site', ...DETAIL_LEVELS].map(id => ({ id, gen: id === 'site' ? site() : level(id), steps: 0, est: weight(id), done: false }));
  const total = tasks.reduce((s, t) => s + t.est, 0);
  const stage = {
    order: tasks,
    get done() { return tasks.every(t => t.done); },
    bump(id) {
      const i = tasks.findIndex(t => t.id === id && !t.done);
      if (i > 0) tasks.unshift(...tasks.splice(i, 1));
    },
    step() {
      const t = tasks.find(t => !t.done);
      if (!t) return false;
      const r = t.gen.next();
      t.steps++;
      if (!r.done) return true;
      t.done = true;
      for (const l of r.value.lights) interior.lights.push(l);
      for (const s of r.value.seats) interior.seats.push(s);
      if (this.done && interior.problems.length) console.warn('[interior]', interior.problems.length, 'problem(s):\n' + interior.problems.join('\n'));
      return r.value;
    },
    progress() {
      const doneSteps = tasks.reduce((s, t) => s + (t.done ? t.est : Math.min(t.steps, t.est - 1)), 0);
      return Math.min(1, doneSteps / total);
    },
  };
  return { ...world, lights: [...world.lights], interior, stage, vehicles: vehicleList(rooms) };
}
