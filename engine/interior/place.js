// Places the furniture listed in the project's interior.js into the world.
// Every item is built by the furniture library in its local frame (+Z = front),
// moved to its plan position, then all static meshes are merged per
// (level, room, material) so the app can hide rooms that are far away and the GPU can cull the
// rest by bounds. Small decor (DECOR_LOD) gets its own buckets: drawn only close up.
// Solid items become physics colliders and lamp/chandelier lights become plan-coord light defs
// for the LightManager. Geometry is welded (indexed) per item: same pixels, ~⅓ of the vertices.
import * as THREE from 'three';
import { FURNITURE, furnitureInfo } from './furniture/index.js';
import { footprintParts } from './footprints.js';
import { seatSlots } from '../interact/seats.js';
import { DRIVABLE } from './furniture/vehicles.js';
import { weld, mergeNow } from '../geom.js';

const DEG = Math.PI / 180;

// Small items that only matter close up: the app stops drawing them a room or two away
export const DECOR_LOD = new Set(['plantPot', 'sconce', 'tableLamp', 'floorLamp', 'towelRail', 'wallCharger', 'wallArt', 'mirror', 'mirrorFull']);

// byRoom: one merged mesh per (level, room, material) instead of per (level, material).
// Returns out = { lights, count, problems, seats, meshes } (meshes also added to groups).
export function placeInterior({ Z, INTERIOR, LEVELS, getMaterial, physics, groups, byRoom = false }) {
  const out = { lights: [], count: 0, problems: [], seats: [], meshes: [] };
  const buckets = new Map();   // level|[room|decor|]materialUuid -> { lv, room, decor, material, geos }
  for (const _ of placeInteriorSteps({ Z, INTERIOR, LEVELS, getMaterial, physics, buckets, out, byRoom })); // eslint-disable-line no-unused-vars
  for (const b of buckets.values()) { const m = mergeInteriorBucket(b, groups); if (m) out.meshes.push(m); }
  if (out.problems.length) console.warn('[interior]', out.problems.length, 'problem(s):\n' + out.problems.join('\n'));
  return out;
}

// One merged mesh per bucket, added to groups[level] (when given)
export function mergeInteriorBucket(b, groups) {
  const merged = mergeNow(b.geos);
  if (!merged) return null;
  const mesh = bucketMesh(merged, b);
  groups?.[b.lv].add(mesh);
  return mesh;
}
// The mesh of a merged bucket; per-room buckets carry what the app's culling needs:
// userData { stage: level, room, decor, box (world AABB) }
export function bucketMesh(merged, b) {
  const mesh = interiorMesh(merged, b.material);
  if (b.room) {
    merged.computeBoundingBox();
    Object.assign(mesh.userData, { stage: b.lv, room: b.room, decor: !!b.decor, box: merged.boundingBox.clone() });
  }
  return mesh;
}
export function interiorMesh(geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  const glassy = material.transparent || material.userData?.noShadow;
  mesh.castShadow = !glassy;
  mesh.receiveShadow = true;
  return mesh;
}

// Open-plan clusters: room id → the id of the cluster's root room (one furniture bucket per cluster)
export function roomCluster(Z) {
  const cluster = new Map();
  const root = (id) => { while (cluster.has(id) && cluster.get(id) !== id) id = cluster.get(id); return id; };
  for (const pairs of Object.values(Z.open || {})) for (const [a, b] of pairs) { cluster.set(a, root(a)); cluster.set(b, root(b)); if (root(a) !== root(b)) cluster.set(root(b), root(a)); }
  return root;
}

// The placement as a generator that yields after every item (engine/assemble.js assembleStaged).
// Geometry goes into `buckets` (merge with mergeInteriorBucket), lights / seats / problems /
// count into `out`; levels limits it to those levels.
// byRoom: one bucket per room (open-plan rooms together) and material (the app draws only the rooms
// around the visitor),
// decor (DECOR_LOD) in buckets of its own
export function* placeInteriorSteps({ Z, INTERIOR, LEVELS, getMaterial, physics, buckets, out, levels = null, byRoom = false }) {
  const roomLevel = new Map();
  for (const [lv, rooms] of Object.entries(Z.floors)) for (const r of rooms) roomLevel.set(r.id, lv);
  // Open-plan rooms (zoning `open`: no wall between them) are always seen together: one bucket
  const root = roomCluster(Z);
  const { lights, seats, problems } = out;

  for (const [roomId, entry] of Object.entries(INTERIOR.rooms || {})) {
    // Outdoor groups may name their level and ground elevation explicitly
    const lv = entry.level || roomLevel.get(roomId);
    if (!lv) { if (!levels) problems.push(`room ${roomId} not in the plan`); continue; }
    if (levels && !levels.includes(lv)) continue;
    const L = LEVELS[lv], elev = entry.elev ?? L.elev;
    const ceiling = L.h - 0.3;
    for (const [index, item] of (entry.items || []).entries()) {
      const build = FURNITURE[item.type];
      if (!build) { problems.push(`${roomId}: unknown type ${item.type}`); continue; }
      // Drivable cars are not merged into the static furniture: engine/drive builds each as its own
      // group with a moving collider (see vehicleList in engine/assemble.js)
      if (DRIVABLE.has(item.type)) { out.count++; yield; continue; }
      let group;
      try {
        // In the data, y is the plan coordinate and z the mounting height; builders read
        // their mounting height from params.y, so hand them z there (undefined = default).
        group = build({ ...item, y: item.z, ceiling }, getMaterial);
      } catch (err) {
        problems.push(`${roomId}: ${item.type} failed: ${err.message}`);
        continue;
      }
      const rot = (item.rot || 0) * DEG;
      group.position.set(item.x, elev, -item.y);
      group.rotation.y = Math.PI - rot;
      group.updateMatrixWorld(true);
      const decor = byRoom && DECOR_LOD.has(item.type);

      group.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        if (g.index) g = g.toNonIndexed();
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (!g.attributes.normal) g.computeVertexNormals();
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        g.clearGroups();
        const mat = Array.isArray(o.material) ? o.material[0] : o.material;
        const room = byRoom ? root(roomId) : null;
        const key = lv + '|' + (byRoom ? room + '|' + (decor ? 'd|' : '') : '') + mat.uuid;
        if (!buckets.has(key)) buckets.set(key, { lv, room, decor, material: mat, geos: [] });
        buckets.get(key).geos.push(weld(g));
      });

      const ud = group.userData || {};
      const info = furnitureInfo(item.type, { ...item, y: item.z });
      const solid = ud.solid ?? info.solid;
      for (const slot of seatSlots(item, { w: ud.w ?? info.w, d: ud.d ?? info.d }, elev, roomId, index)) seats.push({ ...slot, level: lv });
      if (solid && info.mount !== 'ceiling') {
        // Footprint rotated to plan, then its bounding box as the collider.
        // Wall items have their origin on the wall face and extend d towards the front.
        const w = (ud.w ?? info.w), d = (ud.d ?? info.d), h = (ud.h ?? info.h);
        const parts = info.mount !== 'wall' && footprintParts(item.type, item, w, d);
        if (parts) {
          // L shapes: one collider per part, each part's corners taken through the item transform
          const v = new THREE.Vector3();
          for (const [x0, z0, x1, z1] of parts) {
            let a = Infinity, b = Infinity, c = -Infinity, e = -Infinity;
            for (const [px, pz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
              v.set(px, 0, pz).applyMatrix4(group.matrixWorld);
              a = Math.min(a, v.x); c = Math.max(c, v.x); b = Math.min(b, -v.z); e = Math.max(e, -v.z);
            }
            physics.addCollider(a + 0.02, b + 0.02, c - 0.02, e - 0.02, elev, elev + h);
          }
        } else {
          const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
          const hx = (w * c + d * s) / 2 - 0.02, hy = (w * s + d * c) / 2 - 0.02;
          let cx = item.x, cy = item.y;
          if (info.mount === 'wall') { cx += Math.sin(rot) * d / 2; cy += Math.cos(rot) * d / 2; }
          physics.addCollider(cx - hx, cy - hy, cx + hx, cy + hy, elev, elev + h);
        }
      }
      for (const l of ud.lights || []) {
        const p = new THREE.Vector3(...l.pos).applyMatrix4(group.matrixWorld);
        const def = { x: p.x, y: -p.z, z: p.y, color: l.color, intensity: l.intensity, distance: l.distance, kind: l.kind, level: lv, room: roomId };
        // extended / downward emitters (Kit.light): half-size turned to plan axes (x, y = north, z = up)
        if (l.ext) {
          const e = new THREE.Vector3(...l.ext).applyMatrix3(new THREE.Matrix3().setFromMatrix4(group.matrixWorld));
          def.ext = [Math.abs(e.x), Math.abs(e.z), Math.abs(e.y)];
        }
        if (l.down) def.down = true;
        if (l.clear) def.clear = l.clear;
        if (l.rtDrop) def.rtDrop = l.rtDrop;
        // windowless rooms (interior room `enclosed`): their lamps stay on by day (LightManager, bake)
        if (entry.enclosed) def.enclosed = true;
        lights.push(def);
      }
      out.count++;
      yield;
    }
  }
}
