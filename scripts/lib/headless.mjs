// Build the active house in Node exactly as the app does (same colliders, same furniture), without
// a browser: for the checks, the tests and the quantity take-off. Materials are stand-ins.
//
//   const h = await buildHeadless({ dynamicDoors: true });
//   h.THREE, h.P (physics), h.built (assemble() result), h.Z, h.PROJECT, h.INTERIOR, h.config, h.mat
import { useProject } from './project.mjs';

export async function buildHeadless({ dynamicDoors = true, project } = {}) {
  const dir = useProject(project);
  const THREE = await import('three');
  const { Physics } = await import('../../engine/physics.js');
  const { DOOR_MODE } = await import('../../engine/geom.js');
  DOOR_MODE.dynamic = dynamicDoors; // leaves + gates come from engine/doors.js, like in the app
  const { assemble } = await import('../../engine/assemble.js');
  const data = await import('../../engine/data.js');
  const config = await import('../../engine/config.js');
  const mat = new THREE.MeshBasicMaterial();
  const M = new Proxy({}, { get: () => mat });
  const P = new Physics();
  const built = assemble({ M, getMaterial: () => mat, physics: P });
  return { dir, THREE, P, built, mat, Z: data.Z, PROJECT: data.PROJECT, INTERIOR: data.INTERIOR, RAW: data.RAW, config };
}
