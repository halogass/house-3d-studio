// Every furniture type builds with its default parameters: finite geometry with position / normal /
// uv, userData with its footprint, a size close to its catalogue entry (furnitureInfo), and a sane
// triangle count. Cars are checked by tests/drive.mjs.
import { useProject } from '../lib/project.mjs';
useProject();
const THREE = await import('three');
const { FURNITURE, furnitureInfo } = await import('../../engine/interior/furniture/index.js');
const { DRIVABLE } = await import('../../engine/interior/furniture/vehicles.js');
const mat = () => new THREE.MeshStandardMaterial();
const fails = [];
let n = 0, tris = 0;
for (const type of Object.keys(FURNITURE).sort()) {
  const info = furnitureInfo(type, {});
  let g;
  try { g = FURNITURE[type]({ ceiling: 2.9 }, mat); } catch (e) { fails.push(`${type}: throws ${e.message}`); continue; }
  n++;
  let t = 0, bad = false;
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if (!o.isMesh) return;
    const a = o.geometry.attributes;
    if (!a.position || !a.normal || !a.uv) bad = true;
    for (const v of a.position.array) if (!Number.isFinite(v)) { bad = true; break; }
    t += (o.geometry.index ? o.geometry.index.count : a.position.count) / 3;
  });
  tris += t;
  if (bad) fails.push(`${type}: missing attributes or NaN`);
  if (!g.userData || g.userData.type !== type && !DRIVABLE.has(type)) fails.push(`${type}: userData.type missing`);
  if (t > (DRIVABLE.has(type) ? 60000 : 40000)) fails.push(`${type}: ${t} triangles (too heavy)`);
  if (info && info.mount === 'floor' && !DRIVABLE.has(type) && !g.userData.canopy) {
    const b = new THREE.Box3().setFromObject(g), s = b.getSize(new THREE.Vector3());
    if (s.x > info.w * 1.6 + 0.3 || s.z > info.d * 1.6 + 0.3) fails.push(`${type}: built ${s.x.toFixed(2)} × ${s.z.toFixed(2)} m, catalogue says ${info.w} × ${info.d}`);
  }
}
console.log(`${n} furniture types built, ${Math.round(tris / 1000)}k triangles in total`);
if (fails.length) { console.log('✗ ' + fails.join('\n✗ ')); process.exit(1); }
console.log('✓ every furniture type builds.');
