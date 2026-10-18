// The staged build (phones / tablets) must end up with the same world as the synchronous one:
// same triangles per group and material, colliders, walk surfaces, lights and seats.
import { useProject } from '../lib/project.mjs';
useProject();
const THREE = await import('three');
const { Physics } = await import('../../engine/physics.js');
const { assemble, assembleStaged } = await import('../../engine/assemble.js');

// Distinct named materials so per-material totals can be compared
const mats = new Map();
const getMaterial = (n) => { if (!mats.has(n)) mats.set(n, Object.assign(new THREE.MeshBasicMaterial(), { name: String(n) })); return mats.get(n); };
const M = new Proxy({}, { get: (_, k) => typeof k === 'string' ? getMaterial(k) : undefined });

function summary(groups) {
  const tris = new Map();
  let meshes = 0;
  for (const [name, g] of Object.entries(groups)) g.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    const k = name + '|' + (o.material.name || o.material.type);
    tris.set(k, (tris.get(k) || 0) + n);
  });
  return { tris, meshes };
}
const key = (c) => [c.x0, c.y0, c.x1, c.y1, c.z0, c.z1].map(v => v.toFixed(4)).join();
const skey = (s) => JSON.stringify(s);

const P1 = new Physics();
const a = assemble({ M, getMaterial, physics: P1 });
const P2 = new Physics();
const b = assembleStaged({ M, getMaterial, physics: P2 });
let steps = 0, longest = 0;
for (;;) {
  const s0 = performance.now();
  const r = b.stage.step();
  longest = Math.max(longest, performance.now() - s0);
  steps++;
  if (r === false) break;
  if (r !== true) { r.apply(); for (const [g, m] of r.meshes) b.groups[g].add(m); }
}
const fails = [];
const A = summary(a.groups), B = summary(b.groups);
for (const k of new Set([...A.tris.keys(), ...B.tris.keys()]))
  if ((A.tris.get(k) || 0) !== (B.tris.get(k) || 0)) fails.push(`triangles ${k}: sync ${A.tris.get(k) || 0}, staged ${B.tris.get(k) || 0}`);
const sameMultiset = (name, x, y) => {
  if (x.length !== y.length) { fails.push(`${name}: sync ${x.length}, staged ${y.length}`); return; }
  const xs = x.slice().sort(), ys = y.slice().sort();
  const i = xs.findIndex((v, k) => v !== ys[k]);
  if (i >= 0) fails.push(`${name}: differ (${xs[i]} vs ${ys[i]})`);
};
sameMultiset('colliders', P1.colliders.map(key), P2.colliders.map(key));
sameMultiset('surfaces', P1.surfaces.map(skey), P2.surfaces.map(skey));
sameMultiset('global surfaces', P1.globalSurfaces.map(skey), P2.globalSurfaces.map(skey));
sameMultiset('lights', a.lights.map(skey), [...b.lights, ...b.interior.lights].map(skey));
sameMultiset('seats', a.interior.seats.map(skey), b.interior.seats.map(skey));
if (a.interior.count !== b.interior.count) fails.push(`furniture count: sync ${a.interior.count}, staged ${b.interior.count}`);
if (b.stage.progress() !== 1) fails.push('progress did not reach 1');
console.log(`${steps} steps (longest ${longest.toFixed(1)} ms) · meshes sync ${A.meshes}, staged ${B.meshes} · seats ${b.interior.seats.length}`);
if (fails.length) { console.log('✗ ' + fails.length + ' difference(s):\n  - ' + fails.slice(0, 30).join('\n  - ')); process.exit(1); }
console.log('✓ staged build matches the synchronous one.');
