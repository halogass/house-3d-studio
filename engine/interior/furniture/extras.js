// Extras: massage chair, rocking chair, snack bar, game table, Lego table, display cabinet,
// full-length mirror, outdoor sofa, outdoor bench. Uses the Kit from bedroom.js.
// Local frame (docs/SCHEMA.md "Furniture"): origin on the floor at the footprint centre,
// +X width, +Y up, +Z FRONT. Wall items: back face at z = 0, extending to +Z.
import * as THREE from 'three';
import { Kit, seeded, PROFILE, turned, knob, panelFront, pillow, topShape, topPath, archFn, shellShape } from './bedroom.js';

const PI = Math.PI;
const BRICK = ['#c4281c', '#0d69ab', '#f5cd2f', '#287f46', '#f2f3f2', '#1b2a34', '#e98a2b', '#a0a5a9', '#7c4e2d'];
const lq = hex => 'lacquer:' + hex;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ───────────────────────────── shared bits ─────────────────────────────

// Small stacked-brick build (Lego-style set) standing on y, centred at (x, z), footprint w × d.
function brickBuild(k, R, x, y, z, w, d, layers, o = {}) {
  const bh = o.bh || 0.0115, pal = o.pal || BRICK;
  let cw = w, cd = d, cx = x, cz = z, yy = y;
  for (let i = 0; i < layers; i++) {
    const n = 1 + Math.floor(R() * 3);
    let x0 = cx - cw / 2;
    for (let j = 0; j < n; j++) {
      const bw = j === n - 1 ? cx + cw / 2 - x0 : cw / n * (0.7 + R() * 0.6);
      k.box(lq(pal[Math.floor(R() * pal.length)]), Math.max(0.008, bw - 0.0008), bh - 0.0004, cd, { x: x0 + bw / 2, y: yy + bh / 2, z: cz });
      x0 += bw;
    }
    yy += bh;
    if (R() < 0.35 && cw > 0.04) { cw *= 0.75; cx += (R() - 0.5) * cw * 0.2; }
    if (R() < 0.25 && cd > 0.04) cd *= 0.8;
  }
  return yy;
}

// Minifigure (legs, torso, yellow head) standing at (x, y, z).
function minifig(k, R, x, y, z, ry = 0) {
  k.push({ x, y, z, ry });
  k.box(lq(BRICK[Math.floor(R() * 4)]), 0.016, 0.014, 0.008, { y: 0.007 });
  k.box(lq(BRICK[Math.floor(R() * BRICK.length)]), 0.017, 0.014, 0.009, { y: 0.021 });
  k.cyl(lq('#f2c919'), 0.0052, 0.0052, 0.01, { y: 0.034, seg: 8 });
  k.pop();
}

// Classic side chair facing +Z (seat front +Z, back at −Z), origin on the floor at the seat centre.
function sideChair(k, WD, SEAT) {
  const sw = 0.46, sd = 0.46, sy = 0.46, hb = 0.9;
  for (const sx of [-1, 1]) {
    const x = sx * (sw / 2 - 0.035);
    k.sbar(WD, [x, 0, sd / 2 - 0.035], [x, sy - 0.05, sd / 2 - 0.035], 0.038);
    k.sbar(WD, [x, 0, -sd / 2 + 0.03], [x, sy - 0.05, -sd / 2 + 0.03], 0.038);
    k.sbar(WD, [x, sy - 0.05, -sd / 2 + 0.03], [x, hb - 0.02, -sd / 2 - 0.02], 0.036);
    k.sbar(WD, [x, 0.16, -sd / 2 + 0.03], [x, 0.16, sd / 2 - 0.035], 0.02, { t2: 0.02 });
  }
  k.sbar(WD, [-sw / 2 + 0.05, 0.16, 0], [sw / 2 - 0.05, 0.16, 0], 0.018);
  k.bb(WD, -sw / 2, sy - 0.08, -sd / 2 + 0.01, sw / 2, sy - 0.03, sd / 2);
  k.box(SEAT, sw - 0.02, 0.055, sd - 0.02, { y: sy - 0.005, z: 0.008, r: 0.022 });
  k.box(WD, sw - 0.02, 0.075, 0.03, { y: hb - 0.05, z: -sd / 2 - 0.015, rx: -0.12, r: 0.012 });
  k.box(SEAT, sw - 0.13, 0.24, 0.028, { y: sy + 0.21, z: -sd / 2 - 0.0, rx: -0.12, r: 0.01 });
  k.box(WD, sw - 0.06, 0.035, 0.022, { y: sy + 0.06, z: -sd / 2 + 0.03 });
}

// ───────────────────────────── massageChair ─────────────────────────────

function massageChair(p = {}, mat) {
  const W = p.w || 0.85, D = p.d || 1.45, H = p.h || 1.15;
  const LEA = p.leather || p.frame || 'leatherDarkBrown', FAB = p.fabric || 'fabricTaupe';
  const k = new Kit(mat);
  const podW = 0.13, inW = W - 2 * podW, seatY = 0.47;
  // plinth + seat body + cushion
  k.bb('ironBlack', -0.27, 0, -0.42, 0.27, 0.05, 0.3, { r: 0.02 });
  k.bb(LEA, -inW / 2, 0.05, -0.32, inW / 2, seatY - 0.1, 0.3, { r: 0.04 });
  k.box(FAB, inW - 0.02, 0.1, 0.56, { y: seatY - 0.05, z: 0.01, r: 0.045, seg: 2 });
  // reclined back shell + cushions + shoulder wings + headrest
  k.push({ y: seatY - 0.06, z: -0.2, rx: -0.5 });
  const Lb = 0.82;
  k.box(LEA, inW + 0.06, Lb, 0.17, { y: Lb / 2, z: -0.085, r: 0.06, seg: 2 });
  const parts = [0.2, 0.22, 0.2];
  let yy = 0.05;
  for (const ph of parts) {
    pillow(k, FAB, inW - 0.08, ph, 0.1, { y: yy + ph / 2, z: 0.03, e: 0.3, ws: 10, hs: 7 });
    yy += ph;
  }
  for (const s of [-1, 1]) k.box(LEA, 0.07, 0.3, 0.13, { x: s * (inW / 2 - 0.02), y: 0.58, z: 0.04, r: 0.03 });
  pillow(k, LEA, inW - 0.14, 0.15, 0.1, { y: Lb - 0.06, z: 0.06, e: 0.35, ws: 10, hs: 7 });
  k.pop();
  // side pods (armrests) with taupe arm pads
  const pod = topShape(-0.6, 0.4, 0.1, z => {
    if (z > 0.3) return 0.7 - (z - 0.3) * 0.6;
    if (z > -0.2) return 0.7;
    return 0.7 + (-0.2 - z) * 0.6;
  }, 20);
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - podW / 2);
    k.ext(LEA, pod, podW - 0.03, { x, ry: -PI / 2, bevel: 0.015, bs: 2, cs: 4 });
    k.box(FAB, podW - 0.03, 0.035, 0.46, { x, y: 0.73, z: 0.04, r: 0.015 });
    k.bb('ironBlack', x - podW / 2 + 0.005, 0.07, -0.55, x + podW / 2 - 0.005, 0.1, 0.38, { r: 0.01 });
  }
  // arm controls: touch console on the right, dial + buttons on the left
  const xr = W / 2 - podW / 2;
  k.box('ironBlack', 0.09, 0.03, 0.12, { x: xr, y: 0.735, z: 0.31, r: 0.01, rx: 0.15 });
  k.box('screenOn', 0.064, 0.003, 0.08, { x: xr, y: 0.752, z: 0.312, rx: 0.15 });
  for (let i = 0; i < 3; i++) k.cyl('chrome', 0.006, 0.006, 0.004, { x: xr - 0.025 + i * 0.025, y: 0.753, z: 0.365, seg: 8 });
  k.box('ironBlack', 0.08, 0.025, 0.1, { x: -xr, y: 0.735, z: 0.31, r: 0.008 });
  k.cyl('chrome', 0.018, 0.02, 0.014, { x: -xr, y: 0.755, z: 0.3, seg: 12 });
  for (let i = 0; i < 2; i++) k.cyl('chrome', 0.006, 0.006, 0.004, { x: -xr - 0.02 + i * 0.04, y: 0.75, z: 0.345, seg: 8 });
  // leg rest with calf wells and a foot pocket
  k.push({ y: seatY - 0.07, z: 0.3, rx: -0.95 });
  k.box(LEA, inW - 0.02, 0.48, 0.13, { y: -0.24, z: -0.065, r: 0.04, seg: 2 });
  for (const s of [-1, 1]) pillow(k, FAB, 0.2, 0.36, 0.07, { x: s * 0.12, y: -0.2, z: 0.02, e: 0.3, ws: 9, hs: 7 });
  k.box(LEA, inW - 0.04, 0.08, 0.1, { y: -0.44, z: 0.03, r: 0.03 });
  k.pop();
  return k.build('massageChair', W, D, H, true);
}

// ───────────────────────────── rockingChair ─────────────────────────────

function rockingChair(p = {}, mat) {
  const W = p.w || 0.7, D = p.d || 0.95, H = p.h || 1.05;
  const style = p.style === 'walnut' ? 'walnut' : 'teak';
  const WD = p.frame || p.mat || style;
  const CU = p.fabric || p.cushion || (style === 'teak' ? 'fabricSage' : 'linenCream');
  const k = new Kit(mat);
  const lx = 0.26, R = 1.3, half = D / 2 - 0.01;
  const rcy = z => 0.025 + (R - Math.sqrt(R * R - z * z));
  // curved runners (bent band, extruded across X)
  const n = 16, band = new THREE.Shape();
  band.moveTo(-half, rcy(-half) - 0.02);
  for (let i = 0; i <= n; i++) { const z = -half + 2 * half * i / n; band.lineTo(z, rcy(z) - 0.02); }
  for (let i = n; i >= 0; i--) { const z = -half + 2 * half * i / n; band.lineTo(z, rcy(z) + 0.02); }
  band.closePath();
  for (const s of [-1, 1]) k.ext(WD, band, 0.026, { x: s * lx, ry: -PI / 2, bevel: 0.005, bs: 1, cs: 2 });
  // turned legs + stretchers
  for (const s of [-1, 1]) for (const z of [-0.2, 0.2]) turned(k, WD, s * lx, rcy(z) + 0.015, z, 0.39 - rcy(z), 0.022, PROFILE.taper, 8);
  for (const s of [-1, 1]) k.bar(WD, [s * lx, 0.2, -0.2], [s * lx, 0.2, 0.2], 0.011, { seg: 6 });
  k.bar(WD, [-lx, 0.22, 0.2], [lx, 0.22, 0.2], 0.011, { seg: 6 });
  // saddle seat + cushion
  k.bb(WD, -0.27, 0.38, -0.23, 0.27, 0.425, 0.22, { r: 0.016 });
  pillow(k, CU, 0.46, 0.42, 0.06, { y: 0.45, z: 0.0, rx: -PI / 2, e: 0.3, ws: 10, hs: 8 });
  // raked back: posts, finials, back rail, spindles, arched crest rail
  const top = [-0.36, 1.0];
  for (const s of [-1, 1]) {
    k.bar(WD, [s * 0.24, 0.4, -0.21], [s * 0.255, top[1], top[0]], 0.019, { r2: 0.016, seg: 8 });
    k.sph(WD, 0.022, { x: s * 0.255, y: top[1] + 0.012, z: top[0] - 0.003, ws: 8, hs: 6 });
  }
  k.bar(WD, [-0.24, 0.47, -0.225], [0.24, 0.47, -0.225], 0.013, { seg: 6 });
  for (let i = 0; i < 7; i++) {
    const t = (i - 3) / 3;
    k.bar(WD, [t * 0.17, 0.47, -0.225], [t * 0.2, 0.9, -0.325], 0.008, { seg: 6 });
  }
  k.ext(WD, topShape(-0.25, 0.25, 0, archFn(-0.25, 0.25, 0.07, 0.11), 12), 0.028, { y: 0.885, z: -0.33, rx: -0.25, bevel: 0.005, bs: 1 });
  // arms: front turned posts + shaped armrests
  for (const s of [-1, 1]) {
    turned(k, WD, s * 0.29, 0.42, 0.17, 0.22, 0.02, PROFILE.taper, 8);
    k.bb(WD, s * 0.3 - 0.035, 0.64, -0.29, s * 0.3 + 0.035, 0.665, 0.22, { r: 0.012 });
    k.cyl(WD, 0.036, 0.036, 0.025, { x: s * 0.3, y: 0.6525, z: 0.21, seg: 10 });
  }
  if (style === 'walnut') pillow(k, CU, 0.34, 0.24, 0.1, { y: 0.64, z: -0.2, rx: -0.3, e: 0.35, ws: 10, hs: 7 });
  return k.build('rockingChair', W, D, H, true, { style });
}

// ───────────────────────────── snackBar ─────────────────────────────

function snackBar(p = {}, mat) {
  const W = p.w || 2.4, D = p.d || 0.6, H = p.h || 1.05;
  const CAB = p.cabinet || 'walnut', TOP = p.top || 'travertineHoned', HW = p.hardware || 'brass';
  const k = new Kit(mat);
  const R = seeded('snackBar', p);
  const cTop = 0.92, tT = 0.04, yB = cTop - tT, zb = -D / 2 + 0.02, zf = D / 2 - 0.05;
  const xF0 = -W / 2 + 0.03, xF1 = xF0 + 0.6;          // fridge bay
  const xS1 = W / 2 - 0.03, xS0 = xS1 - 0.82;          // open snack shelves
  // toe kick, stone top, end panels
  k.bb(CAB, -W / 2 + 0.03, 0, zb, W / 2 - 0.03, 0.09, zf - 0.04);
  k.box(TOP, W + 0.04, tT, D + 0.02, { y: cTop - tT / 2, z: 0.0, r: 0.008 });
  for (const s of [-1, 1]) k.bb(CAB, s * W / 2 - 0.03, 0, zb, s * W / 2, yB, zf + 0.01, { r: 0.006 });
  k.bb(CAB, -W / 2, 0.09, zb - 0.02, W / 2, yB, zb);
  // middle: closed cabinet with drawers + raised-panel doors
  k.bb(CAB, xF1, 0.09, zb, xS0, yB, zf);
  const mw = xS0 - xF1, mx = (xF1 + xS0) / 2;
  for (const s of [-1, 1]) {
    const x = mx + s * mw / 4;
    panelFront(k, CAB, x, yB - 0.08, zf + 0.02, mw / 2 - 0.01, 0.14, { inset: 0.025 });
    knob(k, x, yB - 0.08, zf + 0.02, 0.012, HW);
    panelFront(k, CAB, x, (0.1 + yB - 0.16) / 2, zf + 0.02, mw / 2 - 0.01, yB - 0.27, {});
    knob(k, mx + s * 0.04, 0.5, zf + 0.02, 0.013, HW);
  }
  // glass-door drinks fridge (lit interior)
  const fy0 = 0.15, fy1 = yB - 0.03;
  k.bb('steelBrushed', xF0, 0.09, zb, xF1, fy0, zf);
  k.bb('ironBlack', xF0 + 0.04, 0.1, zf, xF1 - 0.04, fy0 - 0.01, zf + 0.004);
  k.bb('steelBrushed', xF0, fy1, zb, xF1, yB, zf);
  for (const x of [xF0, xF1 - 0.015]) k.bb('steelBrushed', x, fy0, zb, x + 0.015, fy1, zf);
  k.bb('coveLight', xF0 + 0.015, fy0, zb, xF1 - 0.015, fy1, zb + 0.01);
  const fw = xF1 - xF0 - 0.03, fx = (xF0 + xF1) / 2;
  const rows = [fy0, fy0 + 0.25, fy0 + 0.5];
  rows.forEach((y, ri) => {
    if (ri) k.box('chrome', fw, 0.006, D - 0.12, { x: fx, y: y - 0.003, z: -0.03 });
    for (let i = 0; i < 6; i++) {
      const x = fx - fw / 2 + 0.05 + i * (fw - 0.1) / 5;
      if (ri === 2) {
        k.cyl(lq(['#2f6b3a', '#7a3b1c', '#2a4f7a'][i % 3]), 0.03, 0.03, 0.14, { x, y: y + 0.07, z: -0.02, seg: 8 });
        k.cyl(lq(['#2f6b3a', '#7a3b1c', '#2a4f7a'][i % 3]), 0.011, 0.028, 0.06, { x, y: y + 0.17, z: -0.02, seg: 8 });
      } else {
        const c = ['#c0392b', '#2e86c1', '#e2b13c', '#e8e4da', '#3c8d40'][Math.floor(R() * 5)];
        for (const z of [-0.09, 0.02]) k.cyl(lq(c), 0.032, 0.032, 0.12, { x, y: y + 0.06, z, seg: 8 });
      }
    }
  });
  // door: steel frame, glass, bar handle
  const dz = zf + 0.01;
  k.bb('steelBrushed', xF0 + 0.005, fy0, dz - 0.012, xF0 + 0.045, fy1, dz + 0.012, { r: 0.004 });
  k.bb('steelBrushed', xF1 - 0.045, fy0, dz - 0.012, xF1 - 0.005, fy1, dz + 0.012, { r: 0.004 });
  k.bb('steelBrushed', xF0 + 0.045, fy0, dz - 0.012, xF1 - 0.045, fy0 + 0.05, dz + 0.012, { r: 0.004 });
  k.bb('steelBrushed', xF0 + 0.045, fy1 - 0.04, dz - 0.012, xF1 - 0.045, fy1, dz + 0.012, { r: 0.004 });
  k.bb('glassClear', xF0 + 0.045, fy0 + 0.05, dz - 0.004, xF1 - 0.045, fy1 - 0.04, dz + 0.004);
  k.bar('chrome', [xF1 - 0.03, fy0 + 0.12, dz + 0.04], [xF1 - 0.03, fy1 - 0.12, dz + 0.04], 0.009, { seg: 8 });
  for (const y of [fy0 + 0.12, fy1 - 0.12]) k.bar('chrome', [xF1 - 0.03, y, dz + 0.012], [xF1 - 0.03, y, dz + 0.04], 0.006, { seg: 6 });
  // open snack shelves: divider, back, shelf; boxes, jars, baskets
  const sx = (xS0 + xS1) / 2;
  k.bb(CAB, sx - 0.012, 0.09, zb, sx + 0.012, yB, zf);
  k.bb(CAB, xS0, 0.09, zb, xS1, 0.12, zf);
  k.bb(CAB, xS0, 0.49, zb, xS1, 0.52, zf, { r: 0.004 });
  for (const [a, b] of [[xS0 + 0.02, sx - 0.03], [sx + 0.03, xS1 - 0.02]]) {
    // lower: jute baskets of chip bags
    const bw = b - a, bx = (a + b) / 2;
    k.bb('rugJute', a, 0.12, -0.18, b, 0.3, 0.2, { r: 0.015 });
    for (let i = 0; i < 3; i++) {
      const c = ['#d63a2f', '#f2b705', '#1f6fb2', '#2c8f4b'][Math.floor(R() * 4)];
      k.box(lq(c), bw / 3 - 0.02, 0.17, 0.05, { x: a + bw / 6 + i * bw / 3, y: 0.33, z: 0.05 - i * 0.04, rx: -0.2 });
    }
    // upper: candy jars + snack boxes
    for (let i = 0; i < 2; i++) {
      const x = bx - bw / 4 + i * bw / 2;
      if ((i + (a > sx ? 1 : 0)) % 2) {
        k.cyl('glassClear', 0.07, 0.07, 0.2, { x, y: 0.62, z: 0.02, seg: 12 });
        k.cyl(lq(['#e74c3c', '#f39c12', '#8e44ad'][Math.floor(R() * 3)]), 0.065, 0.065, 0.13, { x, y: 0.585, z: 0.02, seg: 12 });
        k.cyl('chrome', 0.072, 0.072, 0.02, { x, y: 0.73, z: 0.02, seg: 12 });
      } else {
        for (let j = 0; j < 3; j++) k.box(lq(['#b71c1c', '#1a5276', '#f1c40f', '#6d4c41'][Math.floor(R() * 4)]), 0.05, 0.22 - j * 0.03, 0.16, { x: x - 0.06 + j * 0.06, y: 0.52 + (0.22 - j * 0.03) / 2, z: 0.0 });
      }
    }
  }
  // countertop: popcorn machine (red, glazed), candy jars, menu board, cups, snack rack
  const px = W / 2 - 0.45, pz = -0.04;
  const red = lq('#b3261e');
  k.bb(red, px - 0.21, cTop, pz - 0.17, px + 0.21, cTop + 0.08, pz + 0.17, { r: 0.012 });
  for (const sxp of [-1, 1]) for (const szp of [-1, 1]) k.bb(red, px + sxp * 0.2 - 0.012, cTop + 0.08, pz + szp * 0.16 - 0.012, px + sxp * 0.2 + 0.012, cTop + 0.33, pz + szp * 0.16 + 0.012);
  k.bb('glassClear', px - 0.188, cTop + 0.08, pz + 0.155, px + 0.188, cTop + 0.33, pz + 0.163);
  k.bb('glassClear', px - 0.188, cTop + 0.08, pz - 0.163, px + 0.188, cTop + 0.33, pz - 0.155);
  for (const sxp of [-1, 1]) k.bb('glassClear', px + sxp * 0.2 - 0.004, cTop + 0.08, pz - 0.148, px + sxp * 0.2 + 0.004, cTop + 0.33, pz + 0.148);
  k.bb(red, px - 0.22, cTop + 0.33, pz - 0.18, px + 0.22, cTop + 0.37, pz + 0.18, { r: 0.012 });
  k.box('brass', 0.12, 0.015, 0.012, { x: px, y: cTop + 0.31, z: pz + 0.17 });
  k.sph(lq('#f4e3b5'), 0.17, { x: px, y: cTop + 0.08, z: pz, sy: 0.4, sz: 0.85, ws: 12, hs: 5, theta: PI / 2 });
  k.cyl('steelBrushed', 0.07, 0.055, 0.07, { x: px - 0.04, y: cTop + 0.24, z: pz, seg: 12 });
  k.bar('steelBrushed', [px - 0.04, cTop + 0.275, pz], [px - 0.04, cTop + 0.33, pz], 0.006, { seg: 6 });
  k.cyl('bulbWarm', 0.02, 0.02, 0.012, { x: px + 0.1, y: cTop + 0.322, z: pz, seg: 10 });
  k.light([px + 0.1, cTop + 0.3, pz], { color: '#ffd29a', intensity: 2.5, distance: 3, kind: 'lamp' });
  for (let i = 0; i < 3; i++) {
    const bx = px - 0.32 + i * 0.07;
    k.cyl(i % 2 ? lq('#f2efe7') : lq('#c0392b'), 0.03, 0.022, 0.1, { x: bx, y: cTop + 0.05, z: 0.12, seg: 8 });
    k.sph(lq('#f4e3b5'), 0.03, { x: bx, y: cTop + 0.1, z: 0.12, ws: 8, hs: 4, theta: PI / 2 });
  }
  // candy jars
  for (let i = 0; i < 3; i++) {
    const x = -0.05 + i * 0.15, c = ['#e74c3c', '#27ae60', '#f5b041'][i];
    k.cyl('glassClear', 0.055, 0.055, 0.2, { x, y: cTop + 0.1, z: -0.1, seg: 12 });
    k.cyl(lq(c), 0.05, 0.05, 0.12, { x, y: cTop + 0.062, z: -0.1, seg: 12 });
    k.cyl('chrome', 0.058, 0.058, 0.018, { x, y: cTop + 0.209, z: -0.1, seg: 12 });
    k.sph('chrome', 0.012, { x, y: cTop + 0.222, z: -0.1, ws: 8, hs: 5 });
  }
  // menu board (small chalkboard easel)
  k.push({ x: -0.35, y: cTop, z: 0.02, rx: -0.18 });
  k.bb(CAB, -0.17, 0.02, -0.012, 0.17, 0.38, 0.0, { r: 0.006 });
  k.bb(lq('#2a2e2b'), -0.15, 0.04, -0.002, 0.15, 0.36, 0.004);
  k.box('brass', 0.14, 0.02, 0.003, { y: 0.33, z: 0.006 });
  for (let i = 0; i < 6; i++) k.box('linenWhite', 0.08 + R() * 0.12, 0.007, 0.002, { x: -0.13 + 0.05 + R() * 0.01, y: 0.29 - i * 0.04, z: 0.006 });
  for (let i = 0; i < 6; i++) k.box('linenWhite', 0.03, 0.007, 0.002, { x: 0.11, y: 0.29 - i * 0.04, z: 0.006 });
  k.pop();
  k.bb(CAB, -0.53, cTop, -0.05, -0.17, cTop + 0.02, 0.03);
  // two-tier wire snack rack over the fridge end
  const rx0 = -W / 2 + 0.12, rx1 = rx0 + 0.5;
  for (const y of [cTop + 0.02, cTop + 0.2]) k.bb('ironBlack', rx0, y, -0.2, rx1, y + 0.01, 0.1, { r: 0.003 });
  for (const x of [rx0 + 0.01, rx1 - 0.01]) for (const z of [-0.19, 0.09]) k.bar('ironBlack', [x, cTop, z], [x, cTop + 0.34, z], 0.006, { seg: 6 });
  for (const y of [cTop + 0.03, cTop + 0.21]) for (let i = 0; i < 4; i++) {
    const c = ['#d63a2f', '#f2b705', '#1f6fb2', '#2c8f4b', '#8e44ad'][Math.floor(R() * 5)];
    k.box(lq(c), 0.1, 0.14, 0.035, { x: rx0 + 0.07 + i * 0.12, y: y + 0.075, z: -0.04 + (i % 2) * 0.03, rx: -0.25 });
  }
  // napkin holder + paper cup stack
  k.bb('chrome', 0.32, cTop, 0.08, 0.42, cTop + 0.1, 0.12, { r: 0.004 });
  k.bb('linenWhite', 0.33, cTop + 0.005, 0.085, 0.41, cTop + 0.11, 0.115);
  k.cyl(lq('#f2efe7'), 0.04, 0.03, 0.22, { x: 0.52, y: cTop + 0.11, z: 0.1, seg: 10 });
  return k.build('snackBar', W, D, H, true);
}

// ───────────────────────────── gameTable ─────────────────────────────

function gameInfo(p = {}) {
  const n = clamp(Math.round(p.chairs ?? 4), 4, 6);
  return { w: n > 4 ? 2.6 : 1.6, d: 2.0, h: 0.9, mount: 'floor', solid: true };
}

function gameTable(p = {}, mat) {
  const TW = 1.6, TD = 1.0, TH = 0.75;
  const WD = p.mat || p.frame || 'walnut', FELT = p.felt || 'feltGreen', SEAT = p.fabric || 'leatherCognac';
  const n = clamp(Math.round(p.chairs ?? 4), 4, 6);
  const k = new Kit(mat);
  const R = seeded('gameTable', p);
  // turned legs, apron, rails around a recessed felt field
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turned(k, WD, sx * (TW / 2 - 0.09), 0, sz * (TD / 2 - 0.09), TH - 0.05, 0.045, PROFILE.leg, 10);
  for (const s of [-1, 1]) {
    k.bb(WD, -TW / 2 + 0.06, TH - 0.14, s * (TD / 2 - 0.06) - 0.012, TW / 2 - 0.06, TH - 0.05, s * (TD / 2 - 0.06) + 0.012);
    k.bb(WD, s * (TW / 2 - 0.06) - 0.012, TH - 0.14, -TD / 2 + 0.06, s * (TW / 2 - 0.06) + 0.012, TH - 0.05, TD / 2 - 0.06);
  }
  const rail = 0.1, fy = TH - 0.014;
  k.bb(WD, -TW / 2 + rail, TH - 0.05, -TD / 2 + rail, TW / 2 - rail, fy - 0.004, TD / 2 - rail);
  k.bb(FELT, -TW / 2 + rail, fy - 0.004, -TD / 2 + rail, TW / 2 - rail, fy, TD / 2 - rail);
  for (const s of [-1, 1]) {
    k.bb(WD, -TW / 2, TH - 0.05, s * (TD / 2 - rail / 2) - rail / 2, TW / 2, TH, s * (TD / 2 - rail / 2) + rail / 2, { r: 0.014 });
    k.bb(WD, s * (TW / 2 - rail / 2) - rail / 2, TH - 0.05, -TD / 2 + rail, s * (TW / 2 - rail / 2) + rail / 2, TH, TD / 2 - rail, { r: 0.014 });
  }
  // board game in the middle: board, track squares, pawns, dice, box lid
  k.box(lq('#efe4c8'), 0.5, 0.01, 0.5, { y: fy + 0.005 });
  k.box('canvasArt3', 0.3, 0.002, 0.3, { y: fy + 0.011 });
  const track = ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60'];
  for (let i = 0; i < 24; i++) {
    const side = Math.floor(i / 6), t = (i % 6) / 6;
    const a = -0.21 + t * 0.42;
    const [x, z] = [[a, -0.21], [0.21, a], [-a, 0.21], [-0.21, -a]][side];
    k.box(lq(track[i % 4]), 0.055, 0.002, 0.055, { x, y: fy + 0.011, z });
  }
  for (let i = 0; i < 4; i++) {
    const [x, z] = [[-0.21, -0.21], [0.07, -0.21], [0.21, 0.14], [-0.14, 0.21]][i];
    k.lathe(lq(track[i]), [[0, 0], [0.012, 0], [0.012, 0.004], [0.006, 0.014], [0.004, 0.024], [0.008, 0.03], [0, 0.036]], { x, y: fy + 0.012, z, seg: 8 });
  }
  for (const [x, z, r] of [[0.06, 0.06, 0.3], [0.1, 0.04, 1.1]]) k.box('porcelain', 0.016, 0.016, 0.016, { x, y: fy + 0.019, z, ry: r, r: 0.003 });
  k.bb(lq('#1f4e79'), 0.32, fy, -0.32, 0.6, fy + 0.05, -0.12, { r: 0.004 });
  k.box('canvasArt1', 0.22, 0.002, 0.15, { x: 0.46, y: fy + 0.051, z: -0.22 });
  // TCG playmats + decks + laid-out cards at each long side
  const backs = ['#7b1e1e', '#1b3a5c', '#2d5a3d', '#4a2a5e', '#5c3b1e', '#222222'];
  for (const s of [-1, 1]) {
    k.push({ z: s * 0.3, ry: s > 0 ? 0 : PI });
    k.box('rubberBlack', 0.6, 0.002, 0.26, { x: 0, y: fy + 0.001 });
    k.box(lq(backs[s > 0 ? 0 : 1]), 0.064, 0.03, 0.089, { x: 0.24, y: fy + 0.017, z: 0.0, r: 0.002 });
    k.box(lq(backs[s > 0 ? 2 : 3]), 0.064, 0.012, 0.089, { x: 0.24, y: fy + 0.008, z: -0.1, ry: 0.1 });
    for (let i = 0; i < 4; i++) k.box('porcelain', 0.063, 0.002, 0.088, { x: -0.22 + i * 0.08, y: fy + 0.003, z: -0.05, ry: (R() - 0.5) * 0.08 });
    for (let i = 0; i < 2; i++) k.box(lq(backs[i + 4]), 0.063, 0.002, 0.088, { x: -0.18 + i * 0.1, y: fy + 0.003, z: 0.06, ry: PI / 2 + (R() - 0.5) * 0.1 });
    k.box('porcelain', 0.02, 0.02, 0.02, { x: 0.15, y: fy + 0.012, z: 0.07, r: 0.004, ry: R() });
    k.pop();
  }
  // chairs pushed in around the table, facing it
  const seats = [[-0.4, -0.7, 0], [0.4, -0.7, 0], [-0.4, 0.7, PI], [0.4, 0.7, PI]];
  if (n >= 5) seats.push([1.05, 0, -PI / 2]);
  if (n >= 6) seats.push([-1.05, 0, PI / 2]);
  for (const [x, z, ry] of seats) { k.push({ x, z, ry }); sideChair(k, WD, SEAT); k.pop(); }
  const f = gameInfo(p);
  return k.build('gameTable', f.w, f.d, f.h, true, { chairs: n, table: { w: TW, d: TD, h: TH } });
}

// ───────────────────────────── legoTable ─────────────────────────────

function legoTable(p = {}, mat) {
  const W = p.w || 2.0, D = p.d || 1.0, H = p.h || 0.8;
  const FR = p.frame || 'cabinetCream', TOP = p.top || 'oakLight';
  const k = new Kit(mat);
  const R = seeded('legoTable', p);
  const ty = 0.68;
  // chunky legs, apron, lower shelf, top with a raised lip
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.bb(FR, sx * (W / 2 - 0.04) - 0.035, 0, sz * (D / 2 - 0.04) - 0.035, sx * (W / 2 - 0.04) + 0.035, ty - 0.03, sz * (D / 2 - 0.04) + 0.035, { r: 0.012 });
  for (const s of [-1, 1]) {
    k.bb(FR, -W / 2 + 0.075, ty - 0.11, s * (D / 2 - 0.05) - 0.01, W / 2 - 0.075, ty - 0.03, s * (D / 2 - 0.05) + 0.01);
    k.bb(FR, s * (W / 2 - 0.05) - 0.01, ty - 0.11, -D / 2 + 0.075, s * (W / 2 - 0.05) + 0.01, ty - 0.03, D / 2 - 0.075);
  }
  k.bb(FR, -W / 2 + 0.075, 0.1, -D / 2 + 0.075, W / 2 - 0.075, 0.125, D / 2 - 0.075);
  k.box(TOP, W, 0.035, D, { y: ty - 0.0125, r: 0.01 });
  for (const s of [-1, 1]) {
    k.bb(TOP, -W / 2, ty + 0.005, s * D / 2 - (s > 0 ? 0.02 : 0), W / 2, ty + 0.025, s * D / 2 + (s < 0 ? 0.02 : 0), { r: 0.006 });
    k.bb(TOP, s * W / 2 - (s > 0 ? 0.02 : 0), ty + 0.005, -D / 2 + 0.02, s * W / 2 + (s < 0 ? 0.02 : 0), ty + 0.025, D / 2 - 0.02, { r: 0.006 });
  }
  const y0 = ty + 0.005;
  // sorting bins on the lower shelf (open-top, loose bricks inside)
  const binC = ['#c4281c', '#0d69ab', '#f5cd2f', '#287f46', '#f2f3f2'];
  const nb = 5, bw = (W - 0.2) / nb;
  for (let i = 0; i < nb; i++) {
    const bx = -W / 2 + 0.1 + bw * (i + 0.5), bm = lq(binC[i]), hb = 0.2, wb = bw - 0.03, db = 0.44;
    k.push({ x: bx, y: 0.125, z: 0.02 });
    k.bb(bm, -wb / 2, 0, -db / 2, wb / 2, 0.01, db / 2);
    k.bb(bm, -wb / 2, 0, db / 2 - 0.008, wb / 2, hb, db / 2, { r: 0.003 });
    k.bb(bm, -wb / 2, 0, -db / 2, wb / 2, hb, -db / 2 + 0.008);
    for (const s of [-1, 1]) k.bb(bm, s * wb / 2 - 0.004, 0, -db / 2, s * wb / 2 + 0.004, hb, db / 2);
    k.box(bm, 0.05, 0.03, 0.006, { y: hb - 0.05, z: db / 2 + 0.003 });
    k.bb(lq(binC[(i + 2) % 5]), -wb / 2 + 0.008, 0.01, -db / 2 + 0.008, wb / 2 - 0.008, hb * 0.6, db / 2 - 0.008);
    for (let j = 0; j < 5; j++) k.box(lq(BRICK[Math.floor(R() * BRICK.length)]), 0.032, 0.012, 0.016, { x: (R() - 0.5) * (wb - 0.06), y: hb * 0.6 + 0.006, z: (R() - 0.5) * (db - 0.08), ry: R() * PI });
    k.pop();
  }
  // baseplates
  const plates = [[-0.62, -0.12, 0.56, 0.56, '#3c8d40'], [0.0, -0.12, 0.56, 0.56, '#9aa0a6'], [0.56, -0.12, 0.48, 0.56, '#2e6fb7'], [-0.62, 0.33, 0.56, 0.26, '#d9c18f']];
  for (const [x, z, w, d, c] of plates) k.box(lq(c), w, 0.004, d, { x, y: y0 + 0.002, z });
  const py = y0 + 0.004;
  // diorama 1: brick house on the green plate (coursed walls, windows, door, pitched roof)
  {
    const hx = -0.66, hz = -0.2, hw = 0.2, hd = 0.14, bh = 0.012, courses = 7;
    const wallC = ['#f2f3f2', '#e8e1cf'];
    for (let c = 0; c < courses; c++) {
      const y = py + c * bh + bh / 2, m = lq(wallC[c % 2]);
      const win = c >= 2 && c <= 4;
      for (const s of [-1, 1]) {
        if (win && s > 0) {
          const segs = [[-hw / 2, -0.06], [-0.03, 0.03], [0.06, hw / 2]];
          for (const [a, b] of segs) k.box(m, b - a - 0.001, bh - 0.0005, 0.016, { x: hx + (a + b) / 2, y, z: hz + s * (hd / 2 - 0.008) });
        } else k.box(m, hw, bh - 0.0005, 0.016, { x: hx, y, z: hz + s * (hd / 2 - 0.008) });
        k.box(m, 0.016, bh - 0.0005, hd - 0.032, { x: hx + s * (hw / 2 - 0.008), y, z: hz });
      }
    }
    for (const x of [-0.045, 0.045]) k.box('glassClear', 0.03, bh * 3, 0.012, { x: hx + x, y: py + bh * 3.5, z: hz + hd / 2 - 0.008 });
    k.box(lq('#7c4e2d'), 0.03, bh * 2, 0.004, { x: hx - 0.015, y: py + bh, z: hz + hd / 2 + 0.001 });
    const roof = topShape(-hd / 2 - 0.015, hd / 2 + 0.015, 0, z => 0.075 * (1 - Math.abs(z) / (hd / 2 + 0.015)), 2);
    k.ext(lq('#b8322a'), roof, hw + 0.02, { x: hx, y: py + courses * bh, z: hz, ry: PI / 2 });
    // garden: tree + fence + figure
    k.box(lq('#7c4e2d'), 0.016, 0.06, 0.016, { x: -0.44, y: py + 0.03, z: -0.3 });
    for (let i = 0; i < 3; i++) k.box(lq(i % 2 ? '#287f46' : '#4b9b4f'), 0.07 - i * 0.018, 0.024, 0.07 - i * 0.018, { x: -0.44, y: py + 0.06 + i * 0.024 + 0.012, z: -0.3 });
    for (let i = 0; i < 6; i++) k.box(lq('#f2f3f2'), 0.03, 0.018, 0.006, { x: -0.82 + i * 0.032, y: py + 0.009, z: 0.05 });
    minifig(k, R, -0.5, py, -0.05, 0.4);
  }
  // diorama 2: castle tower + gatehouse on the grey plate
  {
    const tx = 0.12, tz = -0.25;
    const top = brickBuild(k, R, tx, py, tz, 0.11, 0.11, 14, { pal: ['#a0a5a9', '#8a8f94', '#6d7175'] });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(lq('#a0a5a9'), 0.024, 0.02, 0.024, { x: tx + x * 0.043, y: top + 0.01, z: tz + z * 0.043 });
    k.bar('ironBlack', [tx, top, tz], [tx, top + 0.08, tz], 0.002, { seg: 4 });
    k.box(lq('#c4281c'), 0.035, 0.022, 0.002, { x: tx + 0.018, y: top + 0.068, z: tz });
    brickBuild(k, R, -0.08, py, -0.25, 0.16, 0.05, 6, { pal: ['#a0a5a9', '#8a8f94'] });
    // car on the road
    const cx = -0.05, cz = 0.0;
    k.box(lq('#c4281c'), 0.1, 0.016, 0.045, { x: cx, y: py + 0.018, z: cz });
    k.box('glassClear', 0.045, 0.02, 0.04, { x: cx - 0.005, y: py + 0.036, z: cz });
    k.box(lq('#1b2a34'), 0.03, 0.004, 0.044, { x: cx - 0.005, y: py + 0.048, z: cz });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl('rubberBlack', 0.011, 0.011, 0.008, { x: cx + sx * 0.032, y: py + 0.011, z: cz + sz * 0.025, rx: PI / 2, seg: 8 });
    minifig(k, R, 0.06, py, 0.06, -0.6);
    minifig(k, R, 0.2, py, -0.1, 2.5);
  }
  // diorama 3: boat on the water plate
  {
    const bx = 0.55, bz = -0.1;
    k.box(lq('#7c4e2d'), 0.18, 0.024, 0.06, { x: bx, y: py + 0.012, z: bz });
    k.box(lq('#f2f3f2'), 0.06, 0.03, 0.045, { x: bx - 0.03, y: py + 0.039, z: bz });
    k.bar(lq('#7c4e2d'), [bx + 0.03, py + 0.024, bz], [bx + 0.03, py + 0.16, bz], 0.004, { seg: 6 });
    k.ext('linenWhite', topShape(0, 0.07, 0, x => 0.11 * (1 - x / 0.075), 2), 0.002, { x: bx + 0.032, y: py + 0.04, z: bz });
    k.box(lq('#f5cd2f'), 0.03, 0.01, 0.03, { x: 0.68, y: py + 0.005, z: 0.08 });
  }
  // build area: loose bricks + an open instruction booklet + a half-built model
  for (let i = 0; i < 10; i++) {
    const x = -0.86 + R() * 0.5, z = 0.25 + R() * 0.14;
    k.box(lq(BRICK[Math.floor(R() * BRICK.length)]), 0.032, 0.0115, 0.016, { x, y: py + 0.006, z, ry: R() * PI });
  }
  for (let i = 0; i < 5; i++) {
    const x = -0.3 + i * 0.05, z = 0.34;
    const m = lq(BRICK[Math.floor(R() * 6)]);
    k.box(m, 0.016, 0.0115, 0.016, { x, y: py + 0.006, z });
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.cyl(m, 0.0024, 0.0024, 0.003, { x: x + a * 0.004, y: py + 0.013, z: z + b * 0.004, seg: 6 });
  }
  k.push({ x: 0.3, y: y0, z: 0.3, ry: -0.15 });
  for (const s of [-1, 1]) k.box('porcelain', 0.105, 0.003, 0.15, { x: s * 0.053, y: 0.0015, rz: s * 0.04 });
  k.box('canvasArt2', 0.07, 0.001, 0.07, { x: -0.053, y: 0.004 });
  k.box('canvasArt1', 0.07, 0.001, 0.05, { x: 0.053, y: 0.004, z: 0.02 });
  k.pop();
  brickBuild(k, R, 0.62, py, 0.32, 0.12, 0.08, 5);
  return k.build('legoTable', W, D, H, true);
}

// ───────────────────────────── displayCabinet ─────────────────────────────

function displayCabinet(p = {}, mat) {
  const W = p.w || 1.0, D = p.d || 0.45, H = p.h || 2.0;
  const WD = p.mat || p.frame || 'walnut', HW = p.hardware || 'brass', BACK = p.back || 'lacquer:#e9dfc9';
  const k = new Kit(mat);
  const R = seeded('displayCabinet', p);
  const zb = -D / 2, zf = D / 2 - 0.03, yL = 0.76, yT = H - 0.12;
  // plinth + lower closed cabinet with raised-panel doors
  k.bb(WD, -W / 2 + 0.01, 0, zb + 0.01, W / 2 - 0.01, 0.1, zf + 0.02, { r: 0.01 });
  k.bb(WD, -W / 2 + 0.02, 0.1, zb, W / 2 - 0.02, yL - 0.03, zf);
  for (const s of [-1, 1]) {
    panelFront(k, WD, s * (W / 4 - 0.005), (0.1 + yL - 0.03) / 2, zf + 0.02, W / 2 - 0.04, yL - 0.16, {});
    knob(k, s * 0.04, (0.1 + yL) / 2 + 0.05, zf + 0.02, 0.013, HW);
  }
  k.bb(WD, -W / 2, yL - 0.03, zb, W / 2, yL, zf + 0.03, { r: 0.008 });
  // glazed upper: back, side glass between stiles, glass shelves with lit strips
  const ix = W / 2 - 0.04;
  k.bb(BACK, -ix, yL, zb, ix, yT, zb + 0.012);
  for (const s of [-1, 1]) {
    k.bb(WD, s * (W / 2 - 0.02) - 0.02, yL, zb, s * (W / 2 - 0.02) + 0.02, yT, zb + 0.04);
    k.bb(WD, s * (W / 2 - 0.02) - 0.02, yL, zf - 0.04, s * (W / 2 - 0.02) + 0.02, yT, zf);
    k.bb('glassClear', s * (W / 2 - 0.02) - 0.004, yL, zb + 0.04, s * (W / 2 - 0.02) + 0.004, yT, zf - 0.04);
  }
  const levels = [yL, yL + 0.29, yL + 0.57, yL + 0.84];
  for (let i = 1; i < levels.length; i++) k.bb('glassClear', -ix, levels[i] - 0.008, zb + 0.012, ix, levels[i], zf - 0.04);
  for (const y of levels.slice(1).concat([yT])) k.bb('coveLight', -ix + 0.02, y - 0.02, zf - 0.07, ix - 0.02, y - 0.012, zf - 0.055);
  // contents per level
  const sh = zb + 0.18;
  // L0: boxed board games standing on edge + one lying flat
  {
    let x = -ix + 0.03;
    const cols = ['#1f4e79', '#8e2c25', '#2d5a3d', '#c9a227', '#4a2a5e', '#d35400', '#34495e'];
    for (let i = 0; i < 7; i++) {
      const t = 0.045 + R() * 0.03, h = 0.2 + R() * 0.05;
      k.box(lq(cols[i]), t, h, 0.27, { x: x + t / 2, y: yL + h / 2, z: sh - 0.02 });
      x += t + 0.004;
    }
    k.box(lq('#7b1e1e'), 0.3, 0.06, 0.24, { x: ix - 0.17, y: yL + 0.03, z: sh - 0.02 });
    k.box('canvasArt3', 0.2, 0.002, 0.15, { x: ix - 0.17, y: yL + 0.061, z: sh - 0.02 });
  }
  // L1: a Lego castle set + minifigs
  {
    const y = levels[1];
    k.box(lq('#9aa0a6'), 0.5, 0.004, 0.24, { y: y + 0.002, z: sh - 0.02 });
    const t1 = brickBuild(k, R, -0.15, y + 0.004, sh - 0.06, 0.09, 0.09, 13, { pal: ['#a0a5a9', '#8a8f94', '#6d7175'] });
    k.box(lq('#c4281c'), 0.1, 0.03, 0.1, { x: -0.15, y: t1 + 0.015, z: sh - 0.06, r: 0.004 });
    brickBuild(k, R, 0.05, y + 0.004, sh - 0.09, 0.22, 0.04, 8, { pal: ['#a0a5a9', '#8a8f94'] });
    brickBuild(k, R, 0.3, y + 0.004, sh - 0.02, 0.1, 0.12, 6);
    for (let i = 0; i < 3; i++) minifig(k, R, -0.02 + i * 0.07, y + 0.004, sh + 0.05, (R() - 0.5));
  }
  // L2: diorama (green base, tree, house, figures)
  {
    const y = levels[2];
    k.box(WD, 0.6, 0.03, 0.26, { y: y + 0.015, z: sh - 0.02, r: 0.004 });
    k.box(lq('#3c8d40'), 0.56, 0.004, 0.22, { y: y + 0.032, z: sh - 0.02 });
    brickBuild(k, R, 0.12, y + 0.034, sh - 0.06, 0.14, 0.1, 9, { pal: ['#f2f3f2', '#e8e1cf', '#7c4e2d'] });
    k.box(lq('#7c4e2d'), 0.016, 0.06, 0.016, { x: -0.18, y: y + 0.064, z: sh - 0.05 });
    for (let i = 0; i < 3; i++) k.box(lq(i % 2 ? '#287f46' : '#4b9b4f'), 0.08 - i * 0.02, 0.026, 0.08 - i * 0.02, { x: -0.18, y: y + 0.107 + i * 0.026, z: sh - 0.05 });
    minifig(k, R, -0.06, y + 0.034, sh + 0.04, 0.3);
    minifig(k, R, 0.0, y + 0.034, sh + 0.03, -0.4);
    k.box('brass', 0.08, 0.02, 0.004, { y: y + 0.015, z: sh + 0.111 });
  }
  // L3: Lego vehicle + small sets
  {
    const y = levels[3];
    const cx = -0.2;
    k.box(lq('#0d69ab'), 0.22, 0.03, 0.09, { x: cx, y: y + 0.03, z: sh - 0.02 });
    k.box('glassClear', 0.08, 0.035, 0.08, { x: cx - 0.03, y: y + 0.062, z: sh - 0.02 });
    k.box(lq('#f2f3f2'), 0.06, 0.006, 0.085, { x: cx - 0.03, y: y + 0.082, z: sh - 0.02 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl('rubberBlack', 0.022, 0.022, 0.016, { x: cx + sx * 0.07, y: y + 0.022, z: sh - 0.02 + sz * 0.045, rx: PI / 2, seg: 10 });
    brickBuild(k, R, 0.12, y, sh - 0.04, 0.1, 0.08, 10);
    brickBuild(k, R, 0.32, y, sh - 0.02, 0.07, 0.07, 7);
  }
  // glazed doors
  const dw = W / 2 - 0.04;
  for (const s of [-1, 1]) {
    const dx = s * (dw / 2 + 0.002);
    k.push({ x: dx, z: zf + 0.012 });
    for (const sx of [-1, 1]) k.bb(WD, sx * dw / 2 - (sx > 0 ? 0.04 : 0), yL + 0.01, -0.012, sx * dw / 2 + (sx < 0 ? 0.04 : 0), yT - 0.01, 0.012, { r: 0.004 });
    for (const y of [yL + 0.01, yT - 0.06]) k.bb(WD, -dw / 2 + 0.04, y, -0.012, dw / 2 - 0.04, y + 0.05, 0.012, { r: 0.004 });
    k.bb(WD, -dw / 2 + 0.04, yL + 0.55, -0.008, dw / 2 - 0.04, yL + 0.57, 0.008);
    k.bb('glassClear', -dw / 2 + 0.04, yL + 0.06, -0.004, dw / 2 - 0.04, yT - 0.06, 0.004);
    knob(k, -s * (dw / 2 - 0.025), yL + 0.45, 0.012, 0.012, HW);
    k.pop();
  }
  // frieze + crown cornice
  k.bb(WD, -W / 2, yT, zb, W / 2, yT + 0.06, zf + 0.025);
  k.bb(WD, -W / 2 - 0.02, yT + 0.06, zb, W / 2 + 0.02, yT + 0.09, zf + 0.045, { r: 0.01 });
  k.bb(WD, -W / 2 - 0.03, yT + 0.09, zb, W / 2 + 0.03, H, zf + 0.055, { r: 0.008 });
  k.light([0, yT - 0.05, 0.02], { color: '#fff1d6', intensity: 1.5, distance: 2.5, kind: 'lamp' });
  return k.build('displayCabinet', W, D, H, true);
}

// ───────────────────────────── mirrorFull (wall) ─────────────────────────────

function mirrorFull(p = {}, mat) {
  const W = p.w || 0.7, D = p.d || 0.06, H = p.h || 1.8, y0 = p.y ?? 0.1;
  const FR = p.frame || 'walnut', GILT = p.gilt || 'brassAged';
  const k = new Kit(mat);
  const sh = H * 0.075, b = 0.075;
  const outer = topShape(-W / 2, W / 2, 0, archFn(-W / 2, W / 2, H - sh, H, 1.2), 24);
  outer.holes.push(topPath(-W / 2 + b, W / 2 - b, b, archFn(-W / 2 + b, W / 2 - b, H - sh - b * 0.9, H - b, 1.2), 24));
  k.ext(FR, outer, D - 0.024, { y: y0, z: D / 2, bevel: 0.012, bs: 2, cs: 4 });
  const bi = b - 0.012;
  const bead = topShape(-W / 2 + bi, W / 2 - bi, bi, archFn(-W / 2 + bi, W / 2 - bi, H - sh - bi * 0.9, H - bi, 1.2), 24);
  bead.holes.push(topPath(-W / 2 + b + 0.004, W / 2 - b - 0.004, b + 0.004, archFn(-W / 2 + b + 0.004, W / 2 - b - 0.004, H - sh - b * 0.9 - 0.004, H - b - 0.004, 1.2), 24));
  k.ext(GILT, bead, 0.006, { y: y0, z: D - 0.008, bevel: 0.002, bs: 1, cs: 2 });
  const glass = topShape(-W / 2 + b - 0.004, W / 2 - b + 0.004, b - 0.004, archFn(-W / 2 + b, W / 2 - b, H - sh - b * 0.9, H - b, 1.2), 24);
  k.ext('mirror', glass, 0.004, { y: y0, z: 0.022 });
  k.ext(GILT, shellShape(0.075, 9), 0.01, { y: y0 + H - 0.035, z: D - 0.006, bevel: 0.003, bs: 1, cs: 2 });
  return k.build('mirrorFull', W, D, H, false, { mount: 'wall', bottom: y0 });
}

// ───────────────────────────── outdoor sofa + bench ─────────────────────────────

// One straight teak run along X (centred), back at −D/2. ends: 'arm' | 'back' | null.
function teakRun(k, L, D, o) {
  const { T, CU, PIL, eL, eR, seats } = o;
  const armW = 0.08, seatTop = 0.43;
  const xL = -L / 2 + (eL === 'arm' ? armW : eL === 'back' ? 0.05 : 0);
  const xR = L / 2 - (eR === 'arm' ? armW : eR === 'back' ? 0.05 : 0);
  for (const x of [-L / 2 + 0.035, L / 2 - 0.035]) for (const z of [-D / 2 + 0.035, D / 2 - 0.035]) k.bb(T, x - 0.03, 0, z - 0.03, x + 0.03, 0.3, z + 0.03);
  k.bb(T, -L / 2, 0.2, D / 2 - 0.06, L / 2, 0.3, D / 2, { r: 0.008 });
  k.bb(T, -L / 2, 0.2, -D / 2, L / 2, 0.3, -D / 2 + 0.06, { r: 0.008 });
  k.bb(T, xL, 0.27, -D / 2 + 0.06, xR, 0.29, D / 2 - 0.06);
  // slatted back + capping rail
  for (let i = 0; i < 5; i++) k.bb(T, -L / 2, 0.33 + i * 0.08, -D / 2 + 0.012, L / 2, 0.38 + i * 0.08, -D / 2 + 0.042, { r: 0.006 });
  k.bb(T, -L / 2, 0.71, -D / 2, L / 2, 0.75, -D / 2 + 0.07, { r: 0.012 });
  for (const x of [-L / 2 + 0.035, L / 2 - 0.035]) k.bb(T, x - 0.03, 0.3, -D / 2 + 0.005, x + 0.03, 0.71, -D / 2 + 0.065);
  const ends = [[eL, -1], [eR, 1]];
  for (const [e, s] of ends) {
    const x = s * (L / 2 - 0.04);
    if (e === 'arm') {
      k.bb(T, x - 0.03, 0.3, D / 2 - 0.065, x + 0.03, 0.6, D / 2 - 0.005);
      for (let i = 0; i < 3; i++) k.bb(T, x - 0.015, 0.34 + i * 0.085, -D / 2 + 0.06, x + 0.015, 0.39 + i * 0.085, D / 2 - 0.06, { r: 0.005 });
      k.bb(T, x - 0.045, 0.6, -D / 2, x + 0.045, 0.635, D / 2 + 0.01, { r: 0.012 });
    } else if (e === 'back') {
      for (let i = 0; i < 5; i++) k.bb(T, x - 0.015, 0.33 + i * 0.08, -D / 2 + 0.06, x + 0.015, 0.38 + i * 0.08, D / 2 - 0.005, { r: 0.006 });
      k.bb(T, x - 0.035, 0.71, -D / 2 + 0.06, x + 0.035, 0.75, D / 2, { r: 0.012 });
      pillow(k, CU, D - 0.28, 0.3, 0.13, { x: x - s * 0.09, y: seatTop + 0.16, z: 0.08, ry: PI / 2, rz: s * 0.1, e: 0.3, ws: 10, hs: 7 });
    }
  }
  const cw = (xR - xL) / seats;
  for (let i = 0; i < seats; i++) {
    const cx = xL + cw * (i + 0.5);
    k.box(CU, cw - 0.012, 0.13, D - 0.13, { x: cx, y: 0.29 + 0.065, z: 0.035, r: 0.04, seg: 2 });
    pillow(k, CU, cw - 0.04, 0.32, 0.14, { x: cx, y: seatTop + 0.17, z: -D / 2 + 0.13, rx: -0.14, e: 0.3, ws: 10, hs: 7 });
  }
  return { xL, xR, seatTop, PIL };
}

function outdoorInfo(p = {}) {
  const corner = p.corner === 'left' || p.corner === 'right' ? p.corner : null;
  return { w: 2.2, d: corner ? 2.0 : 0.85, h: 0.75, mount: 'floor', solid: true };
}

function outdoorSofa(p = {}, mat) {
  const corner = p.corner === 'left' || p.corner === 'right' ? p.corner : null;
  const W = p.w || 2.2, dd = 0.85, D = corner ? (p.d || 2.0) : (p.d || dd), H = 0.75;
  const T = p.frame || p.mat || 'teak', CU = p.fabric || 'linenCream', PIL = p.pillow || 'fabricSage';
  const k = new Kit(mat);
  const s = corner === 'right' ? 1 : -1;
  const mainSeats = Math.max(2, Math.round((W - 0.2) / 0.7));
  k.push({ z: -D / 2 + dd / 2 });
  const r1 = teakRun(k, W, dd, { T, CU, PIL, eL: corner && s < 0 ? 'back' : 'arm', eR: corner && s > 0 ? 'back' : 'arm', seats: mainSeats });
  // throw pillows (sage), one at each end of the main run
  for (const [x, ry] of [[r1.xL + 0.24, 0.35], [r1.xR - 0.24, -0.35]]) pillow(k, PIL, 0.38, 0.38, 0.13, { x, y: r1.seatTop + 0.19, z: -dd / 2 + 0.24, ry, rx: -0.2, e: 0.45, ws: 10, hs: 8 });
  k.pop();
  if (corner) {
    const rl = D - dd, retSeats = Math.max(1, Math.round((rl - 0.1) / 0.7));
    k.push({ x: s * (W / 2 - dd / 2), z: -D / 2 + dd + rl / 2, ry: -s * PI / 2 });
    teakRun(k, rl, dd, { T, CU, PIL, eL: s > 0 ? null : 'arm', eR: s > 0 ? 'arm' : null, seats: retSeats });
    pillow(k, PIL, 0.38, 0.38, 0.13, { x: s * (rl / 2 - 0.3), y: 0.43 + 0.19, z: -dd / 2 + 0.24, ry: -s * 0.3, rx: -0.2, e: 0.45, ws: 10, hs: 8 });
    k.pop();
  }
  return k.build('outdoorSofa', W, D, H, true, { corner });
}

function outdoorBench(p = {}, mat) {
  const W = p.w || 1.8, D = p.d || 0.5, H = p.h || 0.45;
  const T = p.frame || p.mat || 'teak', ST = p.stone || 'travertineHoned', legs = p.legs === 'teak' ? 'teak' : 'stone';
  const k = new Kit(mat);
  const top = 0.045;
  if (legs === 'stone') {
    for (const s of [-1, 1]) {
      const x = s * (W / 2 - 0.25);
      k.bb(ST, x - 0.09, 0, -D / 2 + 0.04, x + 0.09, 0.04, D / 2 - 0.04, { r: 0.008 });
      k.bb(ST, x - 0.075, 0.04, -D / 2 + 0.06, x + 0.075, H - top - 0.025, D / 2 - 0.06, { r: 0.012, seg: 2 });
    }
  } else {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.bb(T, sx * (W / 2 - 0.12) - 0.03, 0, sz * (D / 2 - 0.07) - 0.03, sx * (W / 2 - 0.12) + 0.03, H - top - 0.025, sz * (D / 2 - 0.07) + 0.03, { r: 0.006 });
    for (const sx of [-1, 1]) k.bb(T, sx * (W / 2 - 0.12) - 0.02, 0.12, -D / 2 + 0.07, sx * (W / 2 - 0.12) + 0.02, 0.16, D / 2 - 0.07);
    k.bb(T, -W / 2 + 0.12, 0.12, -0.02, W / 2 - 0.12, 0.16, 0.02);
  }
  // cross battens + slats with gaps
  for (const s of [-1, 1]) k.bb(T, s * (W / 2 - 0.25) - 0.03, H - top - 0.025, -D / 2 + 0.03, s * (W / 2 - 0.25) + 0.03, H - top, D / 2 - 0.03);
  k.bb(T, -0.03, H - top - 0.025, -D / 2 + 0.03, 0.03, H - top, D / 2 - 0.03);
  const n = 5, gap = 0.01, sw = (D - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) k.box(T, W, top, sw, { y: H - top / 2, z: -D / 2 + sw / 2 + i * (sw + gap), r: 0.01 });
  return k.build('outdoorBench', W, D, H, true, { legs });
}

export const EXTRAS = { massageChair, rockingChair, snackBar, gameTable, legoTable, displayCabinet, mirrorFull, outdoorSofa, outdoorBench };

export const INFO = {
  massageChair: { w: 0.85, d: 1.45, h: 1.15, mount: 'floor', solid: true },
  rockingChair: { w: 0.7, d: 0.95, h: 1.05, mount: 'floor', solid: true },
  snackBar: { w: 2.4, d: 0.6, h: 1.05, mount: 'floor', solid: true },
  gameTable: gameInfo,
  legoTable: { w: 2.0, d: 1.0, h: 0.8, mount: 'floor', solid: true },
  displayCabinet: { w: 1.0, d: 0.45, h: 2.0, mount: 'floor', solid: true },
  mirrorFull: { w: 0.7, d: 0.06, h: 1.8, mount: 'wall', solid: false },
  outdoorSofa: outdoorInfo,
  outdoorBench: { w: 1.8, d: 0.5, h: 0.45, mount: 'floor', solid: true },
};
