// Garden furniture: sun lounger and parasol (umbrella). Uses the Kit from bedroom.js.
// Local frame (docs/SCHEMA.md "Furniture"): origin on the floor at the footprint centre,
// +X width, +Y up, +Z FRONT (lounger: the foot end).
import * as THREE from 'three';
import { Kit } from './bedroom.js';

// Teak sun lounger with a raised back rest at the head end (−Z) and a cushion
function lounger(p = {}, mat) {
  const W = p.w || 0.7, D = p.d || 1.95, T = p.frame || p.mat || 'teak', C = p.fabric || 'linenWhite';
  const k = new Kit(mat);
  for (const sx of [-1, 1]) {
    k.box(T, 0.05, 0.07, D - 0.05, { x: sx * (W / 2 - 0.03), y: 0.3, z: 0.05 });
    for (const z of [-D / 2 + 0.17, D / 2 - 0.1]) k.box(T, 0.05, 0.28, 0.05, { x: sx * (W / 2 - 0.05), y: 0.14, z });
  }
  k.box(T, W - 0.08, 0.03, 1.3, { y: 0.33, z: 0.35 });
  k.box(C, W - 0.1, 0.07, 1.28, { y: 0.38, z: 0.35, r: 0.03 });
  k.push({ y: 0.59, z: -0.56, rx: 0.75 });
  k.box(T, W - 0.08, 0.03, 0.7, {});
  k.box(C, W - 0.1, 0.07, 0.68, { y: 0.05, z: 0.04, r: 0.03 });
  k.pop();
  for (const sx of [-1, 1]) k.box(T, 0.03, 0.03, 0.42, { x: sx * (W / 2 - 0.11), y: 0.49, z: -0.79, rx: -0.86 });
  k.box('linenCream', 0.3, 0.02, 0.5, { x: 0.05, y: 0.43, z: 0.5 });
  return k.build('lounger', W, D, 0.85, true);
}

// Market parasol on a stone base
function umbrella(p = {}, mat) {
  const R = p.r || 1.4, C = p.fabric || 'linenCream', T = p.frame || 'teak';
  const k = new Kit(mat);
  k.box('stone', 0.45, 0.1, 0.45, { y: 0.05 });
  k.cyl(T, 0.025, 0.025, 2.5, { y: 1.3, seg: 8 });
  const can = new THREE.ConeGeometry(R, 0.45, 12, 1, true);
  can.translate(0, 2.42, 0);
  k.add(C, can);
  const under = can.clone(); under.scale(0.995, 1, 0.995); under.index && under.setIndex([...under.index.array].reverse());
  k.add(C, under);
  k.cyl(C, R, R, 0.12, { y: 2.14, seg: 12, open: true });
  k.sph(T, 0.05, { y: 2.7 });
  // only the base is solid: the canopy is high above the heads
  return k.build('umbrella', 0.45, 0.45, 2.7, true, { canopy: R });
}

export const OUTDOOR = { lounger, umbrella };
export const INFO = {
  lounger: { w: 0.7, d: 1.95, h: 0.85, mount: 'floor', solid: true },
  umbrella: { w: 0.45, d: 0.45, h: 2.7, mount: 'floor', solid: true },
};
