// Furniture: entertainment (recliner, billiardTable, barCounter, wineRack, curtainWall).
// Local frame per docs/SCHEMA.md "Furniture" (+Z = front / user side).
import * as THREE from 'three';
import { Kit, seeded, PROFILE, turned, panelFront, knob } from './bedroom.js';

function recliner(p = {}, mat) {
  const W = p.w || 0.85, D = p.d || 1.0, H = p.h || 1.05, LEA = p.fabric || 'leatherBlack';
  const k = new Kit(mat);
  const armW = 0.16, seatY = 0.46, armH = 0.64;
  k.bb('rubberBlack', -W / 2 + 0.03, 0, -D / 2 + 0.08, W / 2 - 0.03, 0.06, D / 2 - 0.06);
  k.bb(LEA, -W / 2 + armW, 0.06, -D / 2 + 0.15, W / 2 - armW, seatY - 0.09, D / 2 - 0.08, { r: 0.03 });
  // closed footrest panel at the front
  k.bb(LEA, -W / 2 + armW + 0.01, 0.1, D / 2 - 0.11, W / 2 - armW - 0.01, seatY - 0.04, D / 2 - 0.04, { r: 0.03 });
  // wide arms with cup holders
  for (const s of [-1, 1]) {
    const ax = s * (W / 2 - armW / 2);
    k.bb(LEA, ax - armW / 2, 0.04, -D / 2 + 0.1, ax + armW / 2, armH - 0.05, D / 2 - 0.03, { r: 0.04 });
    k.bb(LEA, ax - armW / 2 + 0.005, armH - 0.08, -D / 2 + 0.12, ax + armW / 2 - 0.005, armH, D / 2 - 0.04, { r: 0.035 });
    k.torus('chrome', 0.04, 0.006, { x: ax, y: armH + 0.002, z: D / 2 - 0.14, rx: Math.PI / 2, rs: 4, ts: 14 });
    k.cyl('rubberBlack', 0.036, 0.036, 0.002, { x: ax, y: armH - 0.001, z: D / 2 - 0.14, seg: 14 });
  }
  // seat cushion
  k.box(LEA, W - 2 * armW - 0.01, 0.12, D - 0.38, { y: seatY - 0.03, z: 0.08, r: 0.04 });
  // pillow-top back in three bolsters, reclined
  k.push({ z: -D / 2 + 0.2, y: seatY - 0.06, rx: -0.2 });
  k.box(LEA, W - 2 * armW + 0.06, H - seatY + 0.02, 0.16, { y: (H - seatY) / 2, z: -0.06, r: 0.04 });
  const parts = [0.2, 0.22, 0.17];
  let yy = 0.04;
  for (let i = 0; i < 3; i++) {
    k.box(LEA, W - 2 * armW - 0.02, parts[i] - 0.01, 0.1, { y: yy + parts[i] / 2, z: 0.05, r: 0.045 });
    yy += parts[i];
  }
  k.pop();
  return k.build('recliner', W, D, H, true);
}

function billiardTable(p = {}, mat) {
  const W = p.w || 2.7, D = p.d || 1.5, H = p.h || 0.8, F = p.frame || p.mat || 'mahogany', FELT = p.felt || 'feltGreen';
  const k = new Kit(mat);
  const R = seeded('billiard', p);
  const rail = 0.13, bedY = H - 0.045;
  // cabinet apron with raised panels
  k.bb(F, -W / 2 + 0.06, H - 0.24, -D / 2 + 0.06, W / 2 - 0.06, H - 0.07, D / 2 - 0.06, { r: 0.02 });
  for (const s of [-1, 1]) {
    for (const xs of [-1, 0, 1]) k.bb(F, xs * (W / 3.3) - W / 8, H - 0.21, s * (D / 2 - 0.06) - 0.004, xs * (W / 3.3) + W / 8, H - 0.1, s * (D / 2 - 0.06) + 0.008, { r: 0.006 });
    k.bb(F, s * (W / 2 - 0.06) - 0.004, H - 0.21, -D / 3, s * (W / 2 - 0.06) + 0.008, H - 0.1, D / 3, { r: 0.006 });
  }
  // slate bed + felt
  k.bb(FELT, -W / 2 + rail, bedY - 0.03, -D / 2 + rail, W / 2 - rail, bedY, D / 2 - rail);
  // rails: wood top with brass diamonds + felt cushion strips
  for (const s of [-1, 1]) {
    k.bb(F, -W / 2, H - 0.07, s * (D / 2 - rail / 2) - rail / 2, W / 2, H, s * (D / 2 - rail / 2) + rail / 2, { r: 0.015 });
    k.bb(F, s * (W / 2 - rail / 2) - rail / 2, H - 0.07, -D / 2 + rail, s * (W / 2 - rail / 2) + rail / 2, H, D / 2 - rail, { r: 0.015 });
    k.bb(FELT, -W / 2 + rail + 0.06, bedY, s * (D / 2 - rail) - 0.03 * (s > 0 ? 1 : -1) * 0 - (s > 0 ? 0.035 : 0), W / 2 - rail - 0.06, H - 0.005, s * (D / 2 - rail) + (s < 0 ? 0.035 : 0), { r: 0.012 });
    k.bb(FELT, s * (W / 2 - rail) - (s > 0 ? 0.035 : 0), bedY, -D / 2 + rail + 0.06, s * (W / 2 - rail) + (s < 0 ? 0.035 : 0), H - 0.005, D / 2 - rail - 0.06, { r: 0.012 });
    for (let i = 1; i < 8; i++) if (i !== 4) k.ext('porcelain', diamond(), 0.002, { x: -W / 2 + W * i / 8, y: H + 0.001, z: s * (D / 2 - rail / 2), rx: -Math.PI / 2 });
    for (let i = 1; i < 4; i++) k.ext('porcelain', diamond(), 0.002, { x: s * (W / 2 - rail / 2), y: H + 0.001, z: -D / 2 + D * i / 4, rx: -Math.PI / 2, rz: Math.PI / 2 });
  }
  // pockets: leather cups with brass caps
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) {
    const x = sx * (W / 2 - rail * 0.7), z = sz * (D / 2 - rail * 0.7);
    k.cyl('leatherBlack', 0.065, 0.05, 0.12, { x, y: H - 0.07, z, seg: 12 });
    k.cyl('rubberBlack', 0.058, 0.058, 0.004, { x, y: H + 0.002, z, seg: 12 });
    k.torus('brass', 0.062, 0.008, { x, y: H, z, rx: Math.PI / 2, rs: 4, ts: 14 });
  }
  // six carved legs
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) {
    const x = sx * (W / 2 - 0.2), z = sz * (D / 2 - 0.18);
    k.lathe(F, [[0, 0], [0.11, 0], [0.12, 0.04], [0.09, 0.08], [0.08, 0.14], [0.13, 0.24], [0.14, 0.3], [0.1, 0.36], [0.07, 0.42], [0.09, 0.48], [0.1, H - 0.24], [0, H - 0.24]], { x, z, seg: 10 });
  }
  // balls: racked triangle + cue ball
  if (p.balls !== false) {
    const br = 0.0286, by = bedY + br;
    let n = 0;
    for (let row = 0; row < 5; row++) for (let j = 0; j <= row; j++) {
      k.sph('porcelain', br, { x: W / 4 + row * br * 1.75, y: by, z: (j - row / 2) * br * 2.02, ws: 8, hs: 6 });
      n++;
    }
    k.sph('porcelain', br, { x: -W / 4 + (R() - 0.5) * 0.1, y: by, z: (R() - 0.5) * 0.2, ws: 8, hs: 6 });
    // a cue lying along the long rail
    k.bar('oak', [-W / 2 + 0.25, H + 0.012, D / 2 - rail / 2], [W / 2 - 0.35, H + 0.016, D / 2 - rail / 2 + 0.02], 0.011, { r2: 0.006, seg: 8 });
  }
  return k.build('billiardTable', W, D, H, true);
}
function diamond() {
  const s = new THREE.Shape();
  s.moveTo(-0.012, 0); s.lineTo(0, 0.007); s.lineTo(0.012, 0); s.lineTo(0, -0.007); s.closePath();
  return s;
}

const BOTTLE = [[0, 0], [0.036, 0], [0.037, 0.2], [0.03, 0.23], [0.013, 0.26], [0.013, 0.31], [0, 0.31]];
function bottle(k, m, x, y, z, s = 1, o = {}) {
  k.lathe(m, BOTTLE.map(([r, h]) => [r * s, h * s]), { x, y, z, rx: o.rx || 0, seg: o.seg || 8 });
}

function barCounter(p = {}, mat) {
  const W = p.w || 2.4, D0 = p.d || 0.6, H = p.h || 1.1, F = p.frame || p.mat || 'walnut', TOP = p.top || F, MET = p.hardware || 'brass';
  const k = new Kit(mat);
  const R = seeded('bar' + W, p);
  const back = !!p.backbar, aisle = 0.9, bbD = 0.45;
  const Dt = back ? D0 + aisle + bbD : D0;
  const oz = back ? Dt / 2 - D0 / 2 : 0;   // counter centre z so the whole footprint is centred
  k.push({ z: oz });
  const zf = D0 / 2 - 0.12;                  // body front face (top overhangs)
  // body with raised-panel front
  k.bb(F, -W / 2 + 0.03, 0.1, -D0 / 2 + 0.04, W / 2 - 0.03, H - 0.06, zf);
  k.bb(F, -W / 2 + 0.01, 0, -D0 / 2 + 0.04, W / 2 - 0.01, 0.1, zf + 0.02, { r: 0.008 });
  const n = Math.max(2, Math.round(W / 0.6)), pw = (W - 0.06) / n;
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.03 + pw * (i + 0.5);
    panelFront(k, F, x, (0.12 + H - 0.08) / 2, zf + 0.02, pw - 0.04, H - 0.24, { inset: 0.06 });
    k.bb(F, x + pw / 2 - 0.02, 0.1, zf, x + pw / 2 + 0.02, H - 0.06, zf + 0.03, { r: 0.006 });
  }
  // bullnose top with overhang to the customer side
  k.bb(TOP, -W / 2, H - 0.05, -D0 / 2 + 0.02, W / 2, H, D0 / 2 - 0.02, { r: 0.022, seg: 2 });
  k.bb(F, -W / 2 + 0.02, H - 0.075, -D0 / 2 + 0.04, W / 2 - 0.02, H - 0.05, D0 / 2 - 0.05, { r: 0.008 });
  // brass foot rail on brackets
  k.cyl(MET, 0.022, 0.022, W - 0.2, { y: 0.2, z: zf + 0.15, rz: Math.PI / 2, seg: 12 });
  for (const s of [-1, 1]) k.sph(MET, 0.028, { x: s * (W / 2 - 0.1), y: 0.2, z: zf + 0.15, ws: 8, hs: 6 });
  for (let i = 0; i < Math.max(2, Math.round(W / 0.9)) + 1; i++) {
    const x = -W / 2 + 0.15 + (W - 0.3) * i / Math.max(2, Math.round(W / 0.9));
    k.bar(MET, [x, 0.2, zf + 0.02], [x, 0.2, zf + 0.13], 0.01, { seg: 6 });
  }
  // bartender side: under-counter shelf with glasses
  k.bb(F, -W / 2 + 0.05, 0.85, -D0 / 2 - 0.0, W / 2 - 0.05, 0.88, -D0 / 2 + 0.2);
  for (let i = 0; i < Math.round(W / 0.12) - 2; i++) {
    const x = -W / 2 + 0.15 + i * 0.12;
    k.lathe('glassClear', [[0, 0], [0.035, 0], [0.033, 0.002], [0.007, 0.012], [0.005, 0.08], [0.035, 0.12], [0.04, 0.17], [0.039, 0.17]], { x, y: 0.88, z: -D0 / 2 + 0.1, seg: 8 });
  }
  k.pop();
  if (back) {
    // back bar: low cabinet + mirrored shelves of bottles against the wall (−Z)
    const bz = -Dt / 2 + bbD / 2;
    k.bb(F, -W / 2, 0, -Dt / 2, W / 2, 0.86, -Dt / 2 + bbD - 0.02);
    const nd = Math.max(2, Math.round(W / 0.55)), dw = W / nd;
    for (let i = 0; i < nd; i++) {
      const x = -W / 2 + dw * (i + 0.5);
      panelFront(k, F, x, 0.46, -Dt / 2 + bbD, dw - 0.01, 0.74, { inset: 0.05 });
      knob(k, x + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), 0.55, -Dt / 2 + bbD, 0.012, MET);
    }
    k.bb('marbleGreen', -W / 2 - 0.01, 0.86, -Dt / 2, W / 2 + 0.01, 0.9, -Dt / 2 + bbD + 0.01, { r: 0.008 });
    k.bb('mirror', -W / 2 + 0.05, 0.9, -Dt / 2, W / 2 - 0.05, 2.2, -Dt / 2 + 0.01);
    for (const s of [-1, 1]) k.bb(F, s * W / 2 - 0.05, 0.9, -Dt / 2, s * W / 2 + 0.0 * s + (s < 0 ? 0.05 : 0) - (s > 0 ? 0 : 0), 2.3, -Dt / 2 + 0.3);
    k.bb(F, -W / 2, 2.2, -Dt / 2, W / 2, 2.3, -Dt / 2 + 0.32, { r: 0.01 });
    const shelvesY = [1.25, 1.65, 2.02];
    for (const sy of shelvesY) {
      k.bb('glassClear', -W / 2 + 0.05, sy - 0.012, -Dt / 2 + 0.01, W / 2 - 0.05, sy, -Dt / 2 + 0.25);
      const nb = Math.floor((W - 0.2) / 0.1);
      for (let i = 0; i < nb; i++) {
        if (R() < 0.15) continue;
        const m = R() < 0.4 ? 'graniteBlack' : R() < 0.5 ? 'glassClear' : 'copper';
        bottle(k, m, -W / 2 + 0.12 + i * 0.1, sy, -Dt / 2 + 0.12 + (R() - 0.5) * 0.06, 0.85 + R() * 0.3);
      }
    }
    // LED strip under the top cornice + its light
    k.bb('coveLight', -W / 2 + 0.06, 2.195, -Dt / 2 + 0.2, W / 2 - 0.06, 2.2, -Dt / 2 + 0.22);
    k.light([0, 2.1, bz], { kind: 'spot', intensity: 3, distance: 3.5, color: '#ffcf96' });
    void bz;
  }
  return k.build('barCounter', W, Dt, back ? 2.3 : H, true, { backbar: back });
}

function wineRack(p = {}, mat) {
  const W = p.w || 1.2, D = p.d || 0.4, H = p.h || 2.2, F = p.frame || p.mat || 'walnut';
  const k = new Kit(mat);
  const R = seeded('wine' + W, p);
  const t = 0.022;
  // carcass (wall mounted: back at z = 0)
  k.bb(F, -W / 2, 0, 0, W / 2, H, 0.012);
  for (const s of [-1, 1]) k.bb(F, s * W / 2 - (s > 0 ? t : 0), 0, 0, s * W / 2 + (s < 0 ? t : 0), H, D);
  k.bb(F, -W / 2, 0, 0, W / 2, 0.08, D - 0.02);
  k.bb(F, -W / 2 - 0.02, H - 0.04, 0, W / 2 + 0.02, H, D + 0.02, { r: 0.008 });
  // middle display shelf with stemware
  const midY = H * 0.55, midH = 0.3;
  k.bb(F, -W / 2 + t, midY, 0, W / 2 - t, midY + 0.025, D);
  k.bb(F, -W / 2 + t, midY + midH, 0, W / 2 - t, midY + midH + 0.025, D);
  for (let i = 0; i < Math.floor((W - 0.1) / 0.12); i++) {
    const x = -W / 2 + 0.1 + i * 0.12;
    k.lathe('glassClear', [[0, 0], [0.035, 0], [0.033, 0.002], [0.006, 0.012], [0.005, 0.1], [0.035, 0.14], [0.04, 0.2], [0.039, 0.2]], { x, y: midY + 0.025, z: D * 0.55, seg: 6 });
  }
  if (W > 0.8) bottle(k, 'graniteBlack', W / 2 - 0.12, midY + 0.025, D * 0.5, 0.9, { seg: 10 });
  // cubby grid with bottles lying neck-out
  const cell = 0.12, cols = Math.floor((W - 2 * t) / cell);
  const cw = (W - 2 * t) / cols;
  const zones = [[0.08, midY], [midY + midH + 0.025, H - 0.04]];
  for (const [y0, y1] of zones) {
    const rows = Math.floor((y1 - y0) / cell), rh = (y1 - y0) / rows;
    for (let c = 1; c < cols; c++) k.bb(F, -W / 2 + t + c * cw - 0.006, y0, 0.012, -W / 2 + t + c * cw + 0.006, y1, D - 0.005);
    for (let r = 1; r < rows; r++) k.bb(F, -W / 2 + t, y0 + r * rh - 0.006, 0.012, W / 2 - t, y0 + r * rh + 0.006, D - 0.005);
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      if (R() < 0.3) continue;
      const x = -W / 2 + t + cw * (c + 0.5), y = y0 + rh * (r + 0.5) - 0.006;
      // only the front of a lying bottle is visible: body ring, shoulder, neck, foil
      const zb = D - 0.1;
      k.cyl('graniteBlack', 0.036, 0.036, 0.06, { x, y, z: zb - 0.03, rx: Math.PI / 2, seg: 7, open: true });
      k.cyl('graniteBlack', 0.014, 0.036, 0.035, { x, y, z: zb + 0.0175, rx: Math.PI / 2, seg: 7, open: true });
      k.cyl(R() < 0.5 ? 'copper' : 'brassAged', 0.0135, 0.0135, 0.05, { x, y, z: zb + 0.06, rx: Math.PI / 2, seg: 5 });
    }
  }
  return k.build('wineRack', W, D, H, true);
}

function curtainWall(p = {}, mat) {
  const W = p.w || 4.0, H = p.h || 3.3, M = p.fabric || p.mat || 'acousticPanel';
  const k = new Kit(mat);
  const fold = 0.16, amp = 0.035, nx = Math.max(8, Math.round(W / fold * 3)), ny = 6;
  const g = new THREE.PlaneGeometry(W, H - 0.1, nx, ny);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i);
    const v = (y + (H - 0.1) / 2) / (H - 0.1);
    const ph = Math.PI * 2 * x / fold;
    const z = 0.05 + amp * Math.sin(ph) * (0.85 + 0.15 * v) + 0.006 * Math.sin(ph * 0.37 + v * 3);
    P.setXYZ(i, x, y + (H - 0.1) / 2 + 0.01 + (v < 0.01 ? 0.004 * Math.sin(ph * 0.5) : 0), z);
  }
  g.computeVertexNormals();
  k.add(M, g);
  // rod on brackets (ceiling-high track)
  k.cyl('ironBlack', 0.014, 0.014, W, { y: H - 0.05, z: 0.08, rz: Math.PI / 2, seg: 8 });
  for (let i = 0; i <= Math.ceil(W / 1.5); i++) k.bar('ironBlack', [-W / 2 + W * i / Math.ceil(W / 1.5), H - 0.05, 0], [-W / 2 + W * i / Math.ceil(W / 1.5), H - 0.05, 0.08], 0.008, { seg: 6 });
  return k.build('curtainWall', W, 0.1, H, false);
}

export const ENTERTAINMENT = { recliner, billiardTable, barCounter, wineRack, curtainWall };

export const INFO = {
  recliner: { w: 0.85, d: 1.0, h: 1.05, mount: 'floor', solid: true },
  billiardTable: { w: 2.7, d: 1.5, h: 0.8, mount: 'floor', solid: true },
  barCounter: { w: 2.4, d: 0.6, h: 1.1, mount: 'floor', solid: true },
  wineRack: { w: 1.2, d: 0.4, h: 2.2, mount: 'wall', solid: true },
  curtainWall: { w: 4.0, d: 0.1, h: 3.3, mount: 'wall', solid: false },
};
