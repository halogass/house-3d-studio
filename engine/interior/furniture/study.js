// Furniture: study / library (deskExecutive, officeChair, chesterfield, clubChair, bookcase,
// libraryLadder, globe, monitorWall). Local frame per docs/SCHEMA.md "Furniture" (+Z = front).
import * as THREE from 'three';
import { Kit, seeded, PROFILE, turned, knob, bail, panelFront, tuftPanel, pillow, bookRow, shellShape, ellipseShape } from './bedroom.js';

function deskExecutive(p = {}, mat) {
  const W = p.w || 1.9, D = p.depth || p.d || 0.9, H = p.h || 0.76, F = p.frame || p.mat || 'walnut';
  const INL = p.inlay || p.top || 'leatherDarkBrown', HW = p.hardware || 'brass';
  // Optional L return: p.ret = overall depth of the L (visitor edge to the wing's end), wing of
  // width p.retDepth on p.retSide ('left' = local -X, 'right' = local +X), beside the user's chair.
  const RET = p.ret > D ? p.ret : 0, RD = p.retDepth || 0.6, rs = p.retSide === 'left' ? -1 : 1;
  const k = new Kit(mat);
  const R = seeded('deskExecutive', p);
  if (RET) k.push({ z: -(RET - D) / 2 }); // keep the L's footprint centred on the origin
  const pw = 0.46, ph = H - 0.05, base = 0.09;
  // top: moulded edge in two layers + leather inlay
  k.box(F, W, 0.035, D, { y: H - 0.0175, r: 0.012 });
  k.box(F, W - 0.03, 0.02, D - 0.03, { y: H - 0.045, r: 0.006 });
  k.bb(INL, -W / 2 + 0.09, H, -D / 2 + 0.09, W / 2 - 0.09, H + 0.002, D / 2 - 0.09, { uv: true });
  k.bb('brassAged', -W / 2 + 0.085, H - 0.0005, -D / 2 + 0.085, W / 2 - 0.085, H + 0.001, D / 2 - 0.085);
  for (const s of [-1, 1]) {
    const cx = s * (W / 2 - pw / 2 - 0.03);
    // pedestal carcass + plinth
    k.bb(F, cx - pw / 2, base, -D / 2 + 0.05, cx + pw / 2, ph, D / 2 - 0.05);
    k.bb(F, cx - pw / 2 - 0.015, 0, -D / 2 + 0.035, cx + pw / 2 + 0.015, base, D / 2 - 0.035, { r: 0.008 });
    k.bb(F, cx - pw / 2 - 0.025, base - 0.02, -D / 2 + 0.025, cx + pw / 2 + 0.025, base, D / 2 - 0.025, { r: 0.008 });
    // user side (+Z): three drawers with bail pulls
    const y0 = base + 0.015, y1 = ph - 0.01, n = 3, dh = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const y = y0 + dh * (i + 0.5);
      panelFront(k, F, cx, y, D / 2 - 0.03, pw - 0.03, dh - 0.01, { inset: 0.03 });
      bail(k, cx, y, D / 2 - 0.03, 0.09, HW);
    }
    // visitor side (−Z): raised panel
    k.bb(F, cx - pw / 2 + 0.04, y0 + 0.04, -D / 2 + 0.035, cx + pw / 2 - 0.04, y1 - 0.04, -D / 2 + 0.05, { r: 0.008 });
    // ends: raised panels
    k.bb(F, cx + s * pw / 2, y0 + 0.04, -D / 2 + 0.12, cx + s * (pw / 2 + 0.012), y1 - 0.04, D / 2 - 0.12, { r: 0.006 });
  }
  // centre pencil drawer + modesty panel at the back
  const ix = W / 2 - pw - 0.03;
  k.bb(F, -ix, H - 0.12, -D / 2 + 0.06, ix, H - 0.05, D / 2 - 0.06);
  panelFront(k, F, 0, H - 0.085, D / 2 - 0.04, 2 * ix - 0.04, 0.06, { inset: 0.015 });
  knob(k, -0.12, H - 0.085, D / 2 - 0.04, 0.011, HW); knob(k, 0.12, H - 0.085, D / 2 - 0.04, 0.011, HW);
  k.bb(F, -ix, base + 0.12, -D / 2 + 0.05, ix, H - 0.12, -D / 2 + 0.07);
  k.bb(F, -ix + 0.05, base + 0.17, -D / 2 + 0.035, ix - 0.05, H - 0.17, -D / 2 + 0.05, { r: 0.01 });
  // accessories: stacked books, pen tray, letter box
  if (p.decor !== false) {
    bookRow(k, R, -W / 2 + 0.14, -W / 2 + 0.36, H + 0.002, -D / 2 + 0.34, 0.08, 0.24, { leather: 0.5 });
    k.box('leatherOxblood', 0.24, 0.012, 0.09, { x: 0.25, y: H + 0.008, z: 0.18, r: 0.004 });
    for (let i = 0; i < 2; i++) k.cyl(i ? 'brass' : 'ironBlack', 0.005, 0.005, 0.15, { x: 0.22 + i * 0.03, y: H + 0.02, z: 0.18, rz: Math.PI / 2 - 0.05 * i, seg: 6 });
    k.box(F, 0.3, 0.07, 0.24, { x: W / 2 - 0.3, y: H + 0.037, z: -D / 2 + 0.25, r: 0.008 });
    k.box('linenWhite', 0.27, 0.01, 0.21, { x: W / 2 - 0.3, y: H + 0.075, z: -D / 2 + 0.25 });
  }
  if (RET) {
    // return wing: moulded top + leather inlay on an end panel and an outer modesty panel,
    // open underneath so the main pedestal's drawers still pull out
    const x0 = rs > 0 ? W / 2 - RD : -W / 2, x1 = x0 + RD, z0 = D / 2, z1 = -D / 2 + RET;
    k.bb(F, x0, H - 0.035, z0 - 0.02, x1, H, z1, { r: 0.01 });
    k.bb(F, x0 + 0.015, H - 0.055, z0, x1 - 0.015, H - 0.035, z1 - 0.015, { r: 0.005 });
    k.bb(INL, x0 + 0.08, H, z0 + 0.02, x1 - 0.08, H + 0.002, z1 - 0.08, { uv: true });
    k.bb(F, x0 + 0.03, 0, z1 - 0.06, x1 - 0.03, H - 0.055, z1 - 0.02, { r: 0.008 });
    k.bb(F, x0 + 0.08, base + 0.04, z1 - 0.07, x1 - 0.08, H - 0.12, z1 - 0.06, { r: 0.006 });
    const ox = rs > 0 ? x1 - 0.04 : x0 + 0.04;
    k.bb(F, ox - 0.02, base, z0, ox + 0.02, H - 0.055, z1 - 0.06);
    k.bb(F, x0 + 0.01, 0, z1 - 0.07, x1 - 0.01, base - 0.02, z1 - 0.01, { r: 0.006 });
  }
  // monitors on the main top, at the back of the return end, turned in towards the chair
  for (let i = 0; i < (p.monitors || 0); i++) {
    const mx = rs * (W / 2 - 0.36 - i * 0.62), mz = -D / 2 + 0.24, ry = -rs * (i ? 0.08 : 0.32);
    k.push({ x: mx, y: H, z: mz, ry });
    k.box('ironBlack', 0.24, 0.015, 0.18, { y: 0.0075, r: 0.004 });
    k.bb('ironBlack', -0.02, 0, -0.06, 0.02, 0.32, -0.03);
    k.box('ironBlack', 0.62, 0.37, 0.03, { y: 0.36, z: -0.02, r: 0.005 });
    k.bb('screenOn', -0.295, 0.19, -0.0045, 0.295, 0.53, -0.004, { uv: false });
    k.pop();
  }
  if (p.monitors) k.box('ironBlack', 0.44, 0.02, 0.14, { x: rs * (W / 2 - 1.0), y: H + 0.01, z: D / 2 - 0.2, r: 0.005 });
  if (RET) k.pop();
  return k.build('deskExecutive', W, Math.max(D, RET), H, true);
}

function officeChair(p = {}, mat) {
  const LEA = p.fabric || p.leather || 'leatherOxblood', MET = p.metal || 'brassAged', F = p.frame || 'walnut';
  const k = new Kit(mat);
  // five-star base with casters
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + i * Math.PI * 2 / 5, ex = Math.cos(a) * 0.3, ez = Math.sin(a) * 0.3;
    k.sbar(F, [0, 0.1, 0], [ex, 0.075, ez], 0.045, { t2: 0.035, roll: a });
    k.cyl(MET, 0.008, 0.008, 0.035, { x: ex, y: 0.06, z: ez, seg: 6 });
    k.sph('rubberBlack', 0.028, { x: ex, y: 0.028, z: ez, ws: 7, hs: 4 });
  }
  k.cyl(F, 0.05, 0.06, 0.06, { y: 0.1, seg: 12 });
  k.cyl('chrome', 0.025, 0.025, 0.22, { y: 0.24, seg: 10 });
  k.cyl('ironBlack', 0.06, 0.05, 0.04, { y: 0.36, seg: 10 });
  // seat: firm base + cushion
  const sy = 0.47;
  k.box(LEA, 0.54, 0.07, 0.52, { y: sy - 0.06, r: 0.03 });
  pillow(k, LEA, 0.5, 0.48, 0.09, { y: sy, z: 0.01, rx: -Math.PI / 2, e: 0.3, pinch: 0.6, ws: 10, hs: 7 });
  // back: shell + diamond-tufted face, rolled top
  k.push({ z: -0.23, y: sy + 0.02, rx: -0.14 });
  k.box(LEA, 0.56, 0.62, 0.1, { y: 0.31, z: -0.03, r: 0.04 });
  tuftPanel(k, LEA, 0.46, 0.5, { cols: 4, rows: 4, depth: 0.04, edge: 0.04, y: 0.3, z: 0.02, res: 2.5, btnR: 0.009 });
  k.cyl(LEA, 0.05, 0.05, 0.56, { y: 0.6, z: -0.01, rz: Math.PI / 2, seg: 10 });
  k.pop();
  // padded arms on wood supports
  for (const s of [-1, 1]) {
    k.sbar(F, [s * 0.28, sy - 0.08, -0.12], [s * 0.29, sy + 0.18, 0.02], 0.035, { r: 0.01 });
    k.sbar(F, [s * 0.28, sy - 0.08, 0.15], [s * 0.29, sy + 0.18, 0.15], 0.035, { r: 0.01 });
    k.box(LEA, 0.08, 0.06, 0.42, { x: s * 0.29, y: sy + 0.2, z: 0.03, r: 0.025 });
  }
  return k.build('officeChair', 0.65, 0.65, 1.15, true);
}

function chesterfield(p = {}, mat) {
  const W = p.w || 2.2, D = p.d || 0.95, H = p.h || 0.75, LEA = p.fabric || 'leatherDarkBrown', F = p.frame || 'walnut';
  const k = new Kit(mat);
  const fy = 0.1, seatY = 0.44, armW = 0.2, backT = 0.2;
  // plinth body
  k.bb(LEA, -W / 2 + 0.02, fy, -D / 2 + 0.02, W / 2 - 0.02, seatY - 0.08, D / 2 - 0.02, { r: 0.04 });
  // back
  k.bb(LEA, -W / 2 + 0.04, seatY - 0.1, -D / 2, W / 2 - 0.04, H - 0.04, -D / 2 + backT, { r: 0.05, seg: 2 });
  k.cyl(LEA, 0.045, 0.045, W - 0.1, { y: H - 0.045, z: -D / 2 + backT - 0.06, rz: Math.PI / 2, seg: 12 });
  const bw = W - 2 * armW - 0.02;
  tuftPanel(k, LEA, bw, H - seatY - 0.06, { cols: Math.round(bw / 0.2), rows: 2, depth: 0.04, edge: 0.03, y: (seatY + H - 0.06) / 2 + 0.02, z: -D / 2 + backT, rx: -0.1, res: 3 });
  // rolled arms (same height as back), tufted inner faces
  for (const s of [-1, 1]) {
    const ax = s * (W / 2 - armW / 2);
    k.bb(LEA, ax - armW / 2 + 0.01, seatY - 0.12, -D / 2 + 0.04, ax + armW / 2 - 0.01, H - 0.07, D / 2 - 0.02, { r: 0.04 });
    k.cyl(LEA, 0.085, 0.085, D - 0.06, { x: ax + s * 0.03, y: H - 0.085, z: 0.0, rx: Math.PI / 2, seg: 14 });
    k.cyl(LEA, 0.09, 0.09, 0.02, { x: ax + s * 0.03, y: H - 0.085, z: D / 2 - 0.02, rx: Math.PI / 2, seg: 14 });
    k.sph('brassAged', 0.014, { x: ax + s * 0.03, y: H - 0.085, z: D / 2 - 0.008, ws: 6, hs: 4 });
    tuftPanel(k, LEA, D - 0.3, H - seatY - 0.12, { cols: 4, rows: 1, depth: 0.03, edge: 0.03, x: ax - s * (armW / 2 - 0.01), y: (seatY + H - 0.12) / 2 + 0.01, z: 0.08, ry: -s * Math.PI / 2, res: 3 });
    // nailhead-trimmed scroll front panel
    k.bb(LEA, ax - armW / 2 + 0.005, seatY - 0.12, D / 2 - 0.035, ax + armW / 2 - 0.005, H - 0.17, D / 2 - 0.015, { r: 0.008 });
  }
  // seat cushions
  const n = p.seats || 3, cw = bw / n;
  for (let i = 0; i < n; i++) {
    const x = -bw / 2 + cw * (i + 0.5);
    k.box(LEA, cw - 0.008, 0.13, D - backT - 0.04, { x, y: seatY, z: (-D / 2 + backT + D / 2) / 2 - 0.0, r: 0.045, seg: 2 });
  }
  // bun feet
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turned(k, F, sx * (W / 2 - 0.09), 0, sz * (D / 2 - 0.09), fy, 0.045, PROFILE.bun, 10);
  return k.build('chesterfield', W, D, H, true);
}

function clubChair(p = {}, mat) {
  const W = p.w || 0.85, D = p.d || 0.9, H = p.h || 0.8, LEA = p.fabric || 'leatherCognac', F = p.frame || 'walnut';
  const k = new Kit(mat);
  const fy = 0.09, seatY = 0.43, armW = 0.17, armH = 0.62;
  k.bb(LEA, -W / 2 + 0.02, fy, -D / 2 + 0.06, W / 2 - 0.02, seatY - 0.08, D / 2 - 0.02, { r: 0.04 });
  // curved barrel back: extruded annular sector (thick shell wrapping the seat)
  k.push({ z: -D / 2 + 0.36 });
  const r0 = 0.36, sxs = W / 2 / r0 * 0.98, a0 = -Math.PI / 2 - 0.95, a1 = -Math.PI / 2 + 0.95;
  const sh = new THREE.Shape();
  for (let i = 0; i <= 12; i++) { const a = a0 + (a1 - a0) * i / 12; const px = Math.cos(a) * r0 * sxs, pz = Math.sin(a) * r0; i ? sh.lineTo(px, -pz) : sh.moveTo(px, -pz); }
  for (let i = 12; i >= 0; i--) { const a = a0 + (a1 - a0) * i / 12, ri = r0 - 0.13; sh.lineTo(Math.cos(a) * ri * sxs, -Math.sin(a) * ri); }
  sh.closePath();
  const bh = H - 0.06 - (seatY - 0.1);
  k.ext(LEA, sh, bh, { y: seatY - 0.1 + bh / 2, rx: -Math.PI / 2, bevel: 0.025, bs: 2, cs: 1, uv: 'box' });
  // top roll along the rim
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 - 0.95 + 1.9 * i / 10;
    const rr = r0 - 0.065;
    pts.push([Math.cos(a) * rr * sxs, H - 0.07, Math.sin(a) * rr]);
  }
  k.tube(LEA, pts, 0.075, { ts: 14, rs: 8 });
  k.pop();
  // arms
  for (const s of [-1, 1]) {
    const ax = s * (W / 2 - armW / 2);
    k.bb(LEA, ax - armW / 2, seatY - 0.12, -D / 2 + 0.2, ax + armW / 2, armH - 0.04, D / 2 - 0.02, { r: 0.05 });
    k.cyl(LEA, 0.06, 0.06, D - 0.24, { x: ax, y: armH - 0.06, z: 0.1, rx: Math.PI / 2, seg: 12 });
    for (let i = 0; i < 6; i++) k.sph('brassAged', 0.007, { x: ax + (i - 2.5) * 0.026, y: seatY - 0.06, z: D / 2 - 0.015, ws: 5, hs: 3 });
  }
  // seat cushion
  k.box(LEA, W - 2 * armW - 0.01, 0.13, D - 0.3, { y: seatY, z: 0.11, r: 0.045, seg: 2 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turned(k, F, sx * (W / 2 - 0.08), 0, sz * (D / 2 - 0.1), fy, 0.035, PROFILE.bun, 8);
  return k.build('clubChair', W, D, H, true);
}

const DECOR = ['porcelain', 'brassAged', 'terracottaPot'];
function bookcase(p = {}, mat) {
  const W = p.w || 1.0, D = p.d || 0.4, H = p.h || 2.4, F = p.frame || p.mat || 'walnut';
  const k = new Kit(mat);
  const R = seeded('bookcase' + W + H, p);
  const t = 0.025, base = 0.1, cab = p.cabinet === false ? 0 : 0.75;
  // carcass
  for (const s of [-1, 1]) k.bb(F, s * W / 2 - (s > 0 ? t : 0), 0, -D / 2, s * W / 2 + (s < 0 ? t : 0), H - 0.08, D / 2 - 0.01);
  k.bb(F, -W / 2, 0, -D / 2, W / 2, H - 0.08, -D / 2 + 0.012);
  k.bb(F, -W / 2 + t, 0, D / 2 - 0.04, W / 2 - t, base, D / 2 - 0.02);
  k.bb(F, -W / 2 - 0.01, base - 0.02, -D / 2, W / 2 + 0.01, base, D / 2, { r: 0.008 });
  // cornice
  k.bb(F, -W / 2 - 0.005, H - 0.08, -D / 2, W / 2 + 0.005, H - 0.05, D / 2 + 0.005, { r: 0.006 });
  k.bb(F, -W / 2 - 0.03, H - 0.05, -D / 2, W / 2 + 0.03, H - 0.025, D / 2 + 0.03, { r: 0.01 });
  k.bb(F, -W / 2 - 0.045, H - 0.025, -D / 2, W / 2 + 0.045, H, D / 2 + 0.045, { r: 0.008 });
  // fluted face stiles
  for (const s of [-1, 1]) k.bb(F, s * (W / 2 - 0.012) - 0.022, base, D / 2 - 0.012, s * (W / 2 - 0.012) + 0.022, H - 0.08, D / 2 + 0.005, { r: 0.006 });
  const iw = W - 2 * t;
  // lower cabinet
  let y = base;
  if (cab) {
    k.bb(F, -iw / 2, cab - 0.025, -D / 2 + 0.012, iw / 2, cab, D / 2 + 0.01, { r: 0.004 });
    const n = iw > 0.7 ? 2 : 1, dw = iw / n;
    for (let i = 0; i < n; i++) {
      const x = -iw / 2 + dw * (i + 0.5);
      panelFront(k, F, x, (base + cab - 0.025) / 2, D / 2 - 0.0, dw - 0.006, cab - 0.025 - base - 0.006, { inset: 0.05 });
      knob(k, n === 2 ? (i ? x - dw / 2 + 0.04 : x + dw / 2 - 0.04) : x + dw / 2 - 0.05, (base + cab) / 2 + 0.05, D / 2, 0.012, 'brass');
    }
    y = cab;
  }
  // shelves with books
  const top = H - 0.08, nS = Math.max(2, Math.round((top - y) / 0.34)), sp = (top - y) / nS;
  for (let i = 0; i < nS; i++) {
    const sy = y + i * sp;
    if (i > 0 || !cab) k.bb(F, -iw / 2, sy - 0.022, -D / 2 + 0.012, iw / 2, sy, D / 2 - 0.015, { r: 0.003 });
    // occasionally a decor object on the shelf
    if (R() < 0.45) {
      const left = R() < 0.5, ox = left ? -iw / 2 + 0.1 : iw / 2 - 0.1, m = DECOR[Math.floor(R() * DECOR.length)];
      const hgt = Math.min(sp - 0.05, 0.16 + R() * 0.1);
      k.lathe(m, [[0, 0], [0.04, 0], [0.06, hgt * 0.3], [0.055, hgt * 0.6], [0.025, hgt * 0.85], [0.03, hgt], [0, hgt]], { x: ox, y: sy, z: 0.02, seg: 10 });
      if (left) bookRow(k, R, -iw / 2 + 0.19, iw / 2 - 0.01, sy, D / 2 - 0.03, sp - 0.04, D - 0.06);
      else bookRow(k, R, -iw / 2 + 0.01, iw / 2 - 0.19, sy, D / 2 - 0.03, sp - 0.04, D - 0.06);
    } else bookRow(k, R, -iw / 2 + 0.01, iw / 2 - 0.01, sy, D / 2 - 0.03, sp - 0.04, D - 0.06);
  }
  return k.build('bookcase', W, D, H, true);
}

function libraryLadder(p = {}, mat) {
  const W = p.w || 0.5, D = p.d || 0.5, H = p.h || 2.6, F = p.frame || p.mat || 'walnut', MET = p.metal || 'brass';
  const k = new Kit(mat);
  const railY = H - 0.15, railZ = 0.06, rail = p.rail || W + 0.1;
  // wall rail with brackets
  k.cyl(MET, 0.016, 0.016, rail, { y: railY, z: railZ, rz: Math.PI / 2, seg: 10 });
  for (const s of [-1, 1]) {
    k.bar(MET, [s * (rail / 2 - 0.05), railY, 0], [s * (rail / 2 - 0.05), railY, railZ], 0.01, { seg: 6 });
    k.cyl(MET, 0.03, 0.03, 0.008, { x: s * (rail / 2 - 0.05), y: railY, z: 0.004, rx: Math.PI / 2, seg: 10 });
    k.sph(MET, 0.022, { x: s * rail / 2, y: railY, z: railZ, ws: 8, hs: 6 });
  }
  // ladder: stiles from the rail hooks down to wheeled feet
  const top = [0, railY + 0.03, railZ + 0.03], bot = [0, 0.06, D - 0.04];
  const hw = W / 2 - 0.03;
  for (const s of [-1, 1]) {
    k.sbar(F, [s * hw, bot[1], bot[2]], [s * hw, top[1] + 0.1, top[2] - 0.0], 0.045, { r: 0.008, t2: 0.07 });
    k.torus(MET, 0.03, 0.007, { x: s * hw, y: railY + 0.01, z: railZ, ry: Math.PI / 2, arc: Math.PI * 1.2, rz: -0.3, rs: 4, ts: 8 });
    // feet with wheels
    k.cyl('rubberBlack', 0.035, 0.035, 0.02, { x: s * hw, y: 0.035, z: D - 0.035, rz: Math.PI / 2, seg: 12 });
    k.box(MET, 0.012, 0.05, 0.05, { x: s * (hw + 0.016), y: 0.05, z: D - 0.035 });
  }
  const steps = Math.round((top[1] - 0.25) / 0.28);
  for (let i = 0; i <= steps; i++) {
    const t = (0.3 + i * 0.28) / (top[1] + 0.1);
    const yy = bot[1] + (top[1] + 0.1 - bot[1]) * t, zz = bot[2] + (top[2] - bot[2]) * t;
    k.box(F, 2 * hw, 0.025, 0.1, { y: yy, z: zz, r: 0.006 });
    k.box(MET, 2 * hw - 0.04, 0.003, 0.012, { y: yy + 0.013, z: zz + 0.04 });
  }
  return k.build('libraryLadder', W, D, H, false);
}

function globe(p = {}, mat) {
  const F = p.frame || p.mat || 'walnut', MAP = p.globe || 'canvasArt2', MET = p.metal || 'brass';
  const k = new Kit(mat);
  const r = 0.2, cy = 0.75;
  // tripod cabriole legs + stretcher + column
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3, c = Math.cos(a), s = Math.sin(a);
    k.tube(F, [[c * 0.05, 0.5, s * 0.05], [c * 0.13, 0.4, s * 0.13], [c * 0.2, 0.2, s * 0.2], [c * 0.22, 0.04, s * 0.22], [c * 0.235, 0.0, s * 0.235]].map(q => q), 0.022, { ts: 12, rs: 6 });
    k.sph(F, 0.025, { x: c * 0.235, y: 0.02, z: s * 0.235, ws: 7, hs: 5 });
    k.bar(F, [c * 0.17, 0.25, s * 0.17], [0, 0.22, 0], 0.012, { seg: 6 });
  }
  turned(k, F, 0, 0.18, 0, 0.36, 0.05, PROFILE.taper, 10);
  turned(k, F, 0, 0.18, 0, 0.08, 0.04, PROFILE.bun, 10);
  // horizon ring held by 3 posts
  k.lathe(F, [[r + 0.02, 0], [r + 0.075, 0], [r + 0.075, 0.025], [r + 0.02, 0.025]], { y: cy - 0.012, seg: 32 });
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 6 + i * Math.PI * 2 / 3;
    k.bar(F, [Math.cos(a) * 0.05, 0.54, Math.sin(a) * 0.05], [Math.cos(a) * (r + 0.05), cy - 0.012, Math.sin(a) * (r + 0.05)], 0.012, { seg: 6 });
  }
  // tilted meridian + sphere
  k.push({ y: cy, rz: 0.41 });
  k.torus(MET, r + 0.012, 0.006, { ry: Math.PI / 2, rs: 4, ts: 32 });
  k.sph(MAP, r, { ws: 24, hs: 16 });
  k.cyl(MET, 0.004, 0.004, 2 * r + 0.06, { seg: 6 });
  k.pop();
  return k.build('globe', 0.5, 0.5, 1.0, true);
}

function monitorWall(p = {}, mat) {
  const W = p.w || 2.6, H = p.h || 1.4, y0 = p.y ?? 0.9;
  const k = new Kit(mat);
  const cols = Math.max(1, Math.round(W / 1.25)), rows = Math.max(1, Math.round(H / 0.7));
  const cw = W / cols, ch = H / rows, gap = 0.012;
  // mounting rails
  for (const fy of [0.25, 0.75]) k.bb('steelBrushed', -W / 2 + 0.05, y0 + H * fy - 0.04, 0.0, W / 2 - 0.05, y0 + H * fy + 0.04, 0.025);
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const x = -W / 2 + cw * (c + 0.5), y = y0 + ch * (r + 0.5);
    k.box('ironBlack', cw - gap, ch - gap, 0.045, { x, y, z: 0.025 + 0.0225 + 0.02, r: 0.004 });
    k.bb('screenOn', x - cw / 2 + gap / 2 + 0.006, y - ch / 2 + gap / 2 + 0.006, 0.0905, x + cw / 2 - gap / 2 - 0.006, y + ch / 2 - gap / 2 - 0.006, 0.092, { uv: false });
    k.bb('ironBlack', x - 0.12, y - 0.08, 0.025, x + 0.12, y + 0.08, 0.045);
  }
  // fix screen UVs to 0..1 per screen: plain BoxGeometry without box projection already is.
  // slim console shelf below with a keyboard
  if (p.shelf !== false) {
    k.bb('walnut', -Math.min(W, 1.6) / 2, y0 - 0.12, 0, Math.min(W, 1.6) / 2, y0 - 0.09, 0.1, { r: 0.006 });
  }
  return k.build('monitorWall', W, 0.1, H, false, { y: y0 });
}

export const STUDY = { deskExecutive, officeChair, chesterfield, clubChair, bookcase, libraryLadder, globe, monitorWall };

export const INFO = {
  deskExecutive: { w: 1.9, d: 0.9, h: 0.76, mount: 'floor', solid: true },
  officeChair: { w: 0.65, d: 0.65, h: 1.15, mount: 'floor', solid: true },
  chesterfield: { w: 2.2, d: 0.95, h: 0.75, mount: 'floor', solid: true },
  clubChair: { w: 0.85, d: 0.9, h: 0.8, mount: 'floor', solid: true },
  bookcase: { w: 1.0, d: 0.4, h: 2.4, mount: 'floor', solid: true },
  libraryLadder: { w: 0.5, d: 0.5, h: 2.6, mount: 'wall', solid: false },
  globe: { w: 0.5, d: 0.5, h: 1.0, mount: 'floor', solid: true },
  monitorWall: { w: 2.6, d: 0.1, h: 1.4, mount: 'wall', solid: false },
};
