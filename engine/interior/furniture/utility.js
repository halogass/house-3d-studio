// Furniture: utility / pets / bunks (washer, dryer, catTree, petBed, bunkBed, foldingTable).
// Local frame per docs/SCHEMA.md "Furniture" (+Z = front).
import * as THREE from 'three';
import { Kit, seeded, knob, pillow, drapeGeo, ellipseShape } from './bedroom.js';

const APPL = 'porcelain';

// One front-loading machine body at height y (0.85 tall, 0.6 x 0.6).
function machine(k, y, dryer) {
  const W = 0.6, D = 0.6, H = 0.85, zf = D / 2;
  k.push({ y });
  k.bb(APPL, -W / 2, 0.04, -D / 2, W / 2, H, zf - 0.005, { r: 0.02 });
  k.bb('ironBlack', -W / 2 + 0.02, 0, -D / 2 + 0.03, W / 2 - 0.02, 0.04, zf - 0.04);
  // control strip
  k.bb(APPL, -W / 2 + 0.01, H - 0.12, zf - 0.01, W / 2 - 0.01, H - 0.01, zf + 0.006, { r: 0.006 });
  k.bb('ironBlack', -W / 2 + 0.03, H - 0.1, zf + 0.005, -W / 2 + 0.2, H - 0.06, zf + 0.008);
  k.bb('screenOn', 0.02, H - 0.09, zf + 0.006, 0.16, H - 0.05, zf + 0.008, { uv: false });
  k.cyl('chrome', 0.03, 0.032, 0.025, { x: 0.22, y: H - 0.07, z: zf + 0.016, rx: Math.PI / 2, seg: 14 });
  for (let i = 0; i < 3; i++) k.bb('steelBrushed', -0.06 - i * 0.04, H - 0.035, zf + 0.006, -0.04 - i * 0.04, H - 0.025, zf + 0.008);
  // porthole door: chrome ring, glass, drum behind
  const cy = 0.42, R = 0.2;
  k.torus('chrome', R, 0.022, { y: cy, z: zf + 0.012, rs: 8, ts: 28 });
  k.cyl(dryer ? 'ironBlack' : 'glassClear', R - 0.015, R - 0.015, 0.01, { y: cy, z: zf + 0.008, rx: Math.PI / 2, seg: 28 });
  k.cyl('steelBrushed', R - 0.03, R - 0.03, 0.2, { y: cy, z: zf - 0.11, rx: Math.PI / 2, seg: 24 });
  k.bb('chrome', R - 0.02, cy - 0.06, zf + 0.01, R + 0.015, cy + 0.06, zf + 0.04, { r: 0.008 });
  // kick panel / filter door
  k.bb(APPL, 0.15, 0.06, zf - 0.008, 0.26, 0.13, zf + 0.002, { r: 0.006 });
  k.pop();
}

function washer(p = {}, mat) {
  const k = new Kit(mat);
  machine(k, 0, false);
  return k.build('washer', 0.6, 0.6, 0.85, true);
}
function dryer(p = {}, mat) {
  const k = new Kit(mat);
  if (p.stacked) {
    // washer below, stacking kit, dryer on top
    machine(k, 0, false);
    k.bb('steelBrushed', -0.3, 0.85, -0.3, 0.3, 0.87, 0.295, { r: 0.004 });
    machine(k, 0.87, true);
    return k.build('dryer', 0.6, 0.6, 1.72, true, { stacked: true });
  }
  machine(k, 0, true);
  return k.build('dryer', 0.6, 0.6, 0.85, true);
}

function catTree(p = {}, mat) {
  const W = p.w || 0.6, D = p.d || 0.6, H = p.h || 1.8, CARPET = p.fabric || 'fabricTaupe', SISAL = 'rugJute';
  const k = new Kit(mat);
  k.box(CARPET, W, 0.05, D, { y: 0.025, r: 0.015 });
  // condo cube with round entrance (front) on the base
  const cw = 0.38, chh = 0.34, cx = -W / 2 + cw / 2 + 0.02, cz = -D / 2 + cw / 2 + 0.02;
  const front = new THREE.Shape();
  front.moveTo(-cw / 2, 0); front.lineTo(cw / 2, 0); front.lineTo(cw / 2, chh); front.lineTo(-cw / 2, chh); front.closePath();
  const hole = new THREE.Path();
  for (let i = 0; i <= 20; i++) { const a = -i / 20 * Math.PI * 2, hx = 0.1 * Math.cos(a), hy = chh * 0.48 + 0.1 * Math.sin(a); i ? hole.lineTo(hx, hy) : hole.moveTo(hx, hy); }
  front.holes.push(hole);
  k.ext(CARPET, front, 0.02, { x: cx, y: 0.05, z: cz + cw / 2 - 0.01, bevel: 0.004, bs: 1 });
  k.box(CARPET, cw, chh, 0.02, { x: cx, y: 0.05 + chh / 2, z: cz - cw / 2 + 0.01 });
  for (const s of [-1, 1]) k.box(CARPET, 0.02, chh, cw, { x: cx + s * (cw / 2 - 0.01), y: 0.05 + chh / 2, z: cz });
  k.box(CARPET, cw + 0.02, 0.03, cw + 0.02, { x: cx, y: 0.05 + chh + 0.015, z: cz, r: 0.01 });
  // sisal posts and platforms
  const posts = [[W / 2 - 0.08, 0.05, D / 2 - 0.08, 1.0], [-W / 2 + 0.12, 0.42, -D / 2 + 0.12, 0.85], [W / 2 - 0.1, 1.05, -D / 2 + 0.15, 0.6]];
  for (const [x, y0, z, h] of posts) k.cyl(SISAL, 0.05, 0.05, h, { x, y: y0 + h / 2, z, seg: 12, open: true });
  const plats = [[W / 2 - 0.15, 1.05, D / 2 - 0.15, 0.38, 0.32], [-W / 2 + 0.18, 1.27, -D / 2 + 0.18, 0.34, 0.34]];
  for (const [x, y, z, w, d] of plats) k.box(CARPET, w, 0.03, d, { x, y: y + 0.015, z, r: 0.012 });
  // top cradle bed
  const tx = W / 2 - 0.15, tz = -D / 2 + 0.18, ty = 1.65;
  k.lathe(CARPET, [[0, 0], [0.18, 0], [0.21, 0.04], [0.22, 0.1], [0.2, 0.13], [0.17, 0.11], [0.15, 0.05], [0, 0.05]], { x: tx, y: ty, z: tz, seg: 20 });
  k.cyl('ironBlack', 0.06, 0.07, 0.02, { x: tx, y: ty - 0.01, z: tz, seg: 10 });
  // dangling toy
  k.bar('linenWhite', [W / 2 - 0.15 + 0.17, 1.05, D / 2 - 0.15], [W / 2 - 0.15 + 0.17, 0.82, D / 2 - 0.15], 0.002, { seg: 3 });
  k.sph('velvetBurgundy', 0.025, { x: W / 2 + 0.02, y: 0.8, z: D / 2 - 0.15, ws: 8, hs: 6 });
  return k.build('catTree', W, D, H, true);
}

function petBed(p = {}, mat) {
  const W = p.w || 0.8, D = p.d || 0.6, H = p.h || 0.25, FAB = p.fabric || 'fabricCharcoal', CUSH = p.cushion || 'boucleIvory';
  const k = new Kit(mat);
  // oval bolster: lathe of a rounded rim profile, scaled to an oval
  const r = D / 2;
  k.lathe(FAB, [[r - 0.12, 0.03], [r - 0.13, 0.08], [r - 0.11, H - 0.04], [r - 0.06, H], [r - 0.01, H - 0.04], [r, H * 0.5], [r - 0.01, 0.03], [r - 0.04, 0]], { sx: W / D, seg: 24 });
  k.cyl(FAB, r - 0.04, r - 0.04, 0.03, { sx: W / D, y: 0.015, seg: 24 });
  pillow(k, CUSH, W - 0.22, D - 0.2, 0.09, { y: 0.07, rx: -Math.PI / 2, e: 0.55, pinch: 0.4 });
  return k.build('petBed', W, D, H, false);
}

function bunkBed(p = {}, mat) {
  const W = p.w || 2.0, D = p.d || 0.95, H = p.h || 1.7, ST = p.frame || 'ironBlack', BED = p.bedding || 'fabricCharcoal';
  const k = new Kit(mat);
  const t = 0.05, decks = [0.22, H - 0.62];
  // posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.bb(ST, sx * (W / 2 - t / 2) - t / 2, 0, sz * (D / 2 - t / 2) - t / 2, sx * (W / 2 - t / 2) + t / 2, H, sz * (D / 2 - t / 2) + t / 2, { r: 0.006 });
  // end panels with bars
  for (const sx of [-1, 1]) {
    for (const y of [0.45, H - 0.08]) k.bb(ST, sx * (W / 2 - t / 2) - 0.015, y, -D / 2 + t, sx * (W / 2 - t / 2) + 0.015, y + 0.04, D / 2 - t);
    for (let i = 1; i < 4; i++) k.bar(ST, [sx * (W / 2 - t / 2), decks[1] + 0.1, -D / 2 + t + (D - 2 * t) * i / 4], [sx * (W / 2 - t / 2), H - 0.08, -D / 2 + t + (D - 2 * t) * i / 4], 0.01, { seg: 6 });
  }
  for (const [i, y] of decks.entries()) {
    // frame rails + slats deck
    for (const sz of [-1, 1]) k.bb(ST, -W / 2 + t, y - 0.06, sz * (D / 2 - t / 2) - 0.02, W / 2 - t, y + 0.03, sz * (D / 2 - t / 2) + 0.02);
    k.bb('oakLight', -W / 2 + t, y + 0.0, -D / 2 + t, W / 2 - t, y + 0.02, D / 2 - t);
    // mattress + blanket + pillow (head at −X)
    k.bb('linenWhite', -W / 2 + t + 0.01, y + 0.02, -D / 2 + t + 0.01, W / 2 - t - 0.01, y + 0.16, D / 2 - t - 0.01, { r: 0.04 });
    const g = drapeGeo({ half: D / 2 - t + 0.005, z0: -W / 2 + t + 0.38, z1: W / 2 - t - 0.03, top: y + 0.185, r: 0.05, dropSide: 0.07, footWrap: false, puff: 0.006, nFlat: 6, nFlatZ: 8, wave: 0.006, seed: i + 3 });
    k.add(BED, g, { ry: Math.PI / 2 });
    pillow(k, 'linenWhite', 0.55, 0.36, 0.12, { x: -W / 2 + t + 0.22, y: y + 0.22, z: 0, rx: -1.2, rz: 0, ry: Math.PI / 2 });
  }
  // upper guard rails (back + front with ladder gap) and ladder at the front-right end
  const gy = decks[1] + 0.32;
  k.bb(ST, -W / 2 + t, gy - 0.02, -D / 2 + 0.005, W / 2 - t, gy + 0.02, -D / 2 + t - 0.005);
  k.bb(ST, -W / 2 + t, gy - 0.02, D / 2 - t + 0.005, W / 2 - 0.5, gy + 0.02, D / 2 - 0.005);
  k.bb(ST, W / 2 - 0.52, decks[1], D / 2 - t + 0.005, W / 2 - 0.48, gy + 0.02, D / 2 - 0.005);
  const lx0 = W / 2 - 0.45, lx1 = W / 2 - t;
  for (const x of [lx0, lx1 - 0.02]) k.bb(ST, x - 0.015, 0, D / 2 - 0.005, x + 0.015, gy, D / 2 + 0.03);
  for (let i = 1; i <= 5; i++) k.bar('steelBrushed', [lx0, i * (decks[1] + 0.05) / 5, D / 2 + 0.015], [lx1 - 0.02, i * (decks[1] + 0.05) / 5, D / 2 + 0.015], 0.013, { seg: 8 });
  return k.build('bunkBed', W, D, H, true);
}

function foldingTable(p = {}, mat) {
  const W = p.w || 1.6, D = p.d || 0.8, H = p.h || 0.75, TOP = p.top || 'lacquer:#e7e4dc', ST = p.frame || 'steelBrushed';
  const k = new Kit(mat);
  k.box(TOP, W, 0.04, D, { y: H - 0.02, r: 0.015, seg: 2 });
  k.bb(ST, -W / 2 + 0.03, H - 0.07, -D / 2 + 0.04, W / 2 - 0.03, H - 0.04, -D / 2 + 0.06);
  k.bb(ST, -W / 2 + 0.03, H - 0.07, D / 2 - 0.06, W / 2 - 0.03, H - 0.04, D / 2 - 0.04);
  // U-shaped folding legs near each end, with braces to the centre
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.12);
    for (const sz of [-1, 1]) k.bar(ST, [x, H - 0.05, sz * (D / 2 - 0.1)], [x + s * 0.03, 0.02, sz * (D / 2 - 0.1)], 0.013, { seg: 8 });
    k.bar(ST, [x + s * 0.03, 0.02, -(D / 2 - 0.1)], [x + s * 0.03, 0.02, D / 2 - 0.1], 0.013, { seg: 8 });
    for (const sz of [-1, 1]) k.cyl('rubberBlack', 0.016, 0.016, 0.02, { x: x + s * 0.03, y: 0.01, z: sz * (D / 2 - 0.1), seg: 8 });
    k.bar(ST, [x + s * 0.01, 0.35, 0], [s * 0.15, H - 0.05, 0], 0.008, { seg: 6 });
    k.bar(ST, [x + s * 0.01, 0.35, -(D / 2 - 0.1)], [x + s * 0.01, 0.35, D / 2 - 0.1], 0.009, { seg: 6 });
  }
  return k.build('foldingTable', W, D, H, true);
}

export const UTILITY = { washer, dryer, catTree, petBed, bunkBed, foldingTable };

export const INFO = {
  washer: { w: 0.6, d: 0.6, h: 0.85, mount: 'floor', solid: true },
  dryer: { w: 0.6, d: 0.6, h: 0.85, mount: 'floor', solid: true },
  catTree: { w: 0.6, d: 0.6, h: 1.8, mount: 'floor', solid: true },
  petBed: { w: 0.8, d: 0.6, h: 0.25, mount: 'floor', solid: false },
  bunkBed: { w: 2.0, d: 0.95, h: 1.7, mount: 'floor', solid: true },
  foldingTable: { w: 1.6, d: 0.8, h: 0.75, mount: 'floor', solid: true },
};
void seeded; void knob; void ellipseShape;
