// Living + dining furniture. Local frame: origin floor/footprint centre, +X width, +Y up, +Z FRONT.
import * as THREE from 'three';
import {
  Kit, TAU, rbox, taperBox, cyl, lathe, sphere, capsule, extrude, softBox, pillowGeom, roundRectShape,
  turnedLeg, bunFoot, taperLeg, knob, cupPull, shakerDoor, slabFront, booksRow, bookStack, vase,
  smallPlant, candle, rng, seedOf, frameGeom,
} from './decor.js';

// ---------------------------------------------------------------- helpers

/** 2D ribbon (offset polyline) as a Shape; left-hand side of travel is the outer edge. */
function ribbonShape(pts, t) {
  const n = pts.length; const outer = [], inner = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    outer.push(new THREE.Vector2(pts[i][0] - ty * t, pts[i][1] + tx * t));
    inner.push(new THREE.Vector2(pts[i][0], pts[i][1]));
  }
  return new THREE.Shape([...outer, ...inner.reverse()]);
}

/** Knit throw draped over a rolled arm. Arm roll centre (cx, cy) radius r; outward = +X side when dir = 1. */
function drapedThrow(k, cx, cy, r, innerX, seatY, z, width, dir, name = 'throwKnit') {
  const pts = [];
  pts.push([innerX, seatY + 0.005], [innerX - 0.005, cy - 0.02]);
  for (let i = 0; i <= 8; i++) { const a = Math.PI * 0.95 - (i / 8) * Math.PI * 1.1; pts.push([cx + Math.cos(a) * (r + 0.004), cy + Math.sin(a) * (r + 0.004)]); }
  pts.push([cx + r + 0.012, cy - 0.12], [cx + r + 0.02, cy - 0.3]);
  const local = pts.map(([x, y]) => [dir > 0 ? x : -x, y]);
  if (dir < 0) local.reverse();
  const g = extrude(ribbonShape(local, 0.014), width, 0.004);
  k.add(g, name, 0, 0, z - width / 2);
  // Fringe-like hem: a slightly thicker rolled edge at the hanging end.
  const end = local[dir > 0 ? local.length - 1 : 0];
  k.add(cyl(0.01, 0.01, width, 8), name, end[0], end[1] - 0.005, z, Math.PI / 2, 0, 0);
}

const PILLOWS = ['linenCream', 'leatherCognac', 'fabricTaupe', 'throwKnit', 'velvetBurgundy'];

/**
 * One straight sofa run: centred at x = 0, back at z = -D/2, seat facing +Z.
 * ends: 'arm' | 'back' (side back for an L corner) | null (open, joins another run).
 */
function sofaRun(k, o) {
  const { len, D, fabric } = o;
  const seats = Math.max(1, o.seats);
  const legH = 0.09, deckY = 0.33, seatT = 0.14, armW = 0.2, armTop = 0.66, bt = 0.17, backTop = 0.62;
  const leftW = o.endL === 'arm' ? armW : o.endL === 'back' ? bt : 0;
  const rightW = o.endR === 'arm' ? armW : o.endR === 'back' ? bt : 0;
  const x0 = -len / 2 + leftW, x1 = len / 2 - rightW;
  // Base and back frame.
  k.add(rbox(len - 0.01, deckY - legH, D - 0.01, 0.025, 1), fabric, 0, (legH + deckY) / 2, 0);
  k.add(rbox(len - 0.01, backTop - deckY + 0.02, bt, 0.03, 1), fabric, 0, (deckY + backTop) / 2 - 0.01, -D / 2 + bt / 2);
  // Ends.
  for (const [end, s] of [[o.endL, -1], [o.endR, 1]]) {
    if (end === 'arm') {
      const ax = s * (len / 2 - armW / 2);
      k.add(rbox(armW - 0.03, armTop - 0.1 - legH, D - 0.02, 0.03, 2), fabric, ax - s * 0.005, legH + (armTop - 0.1 - legH) / 2, 0);
      k.add(capsule(0.08, D - 0.18, 3, 12), fabric, s * (len / 2 - 0.085), armTop - 0.08, 0.0, Math.PI / 2, 0, 0);
      // Front scroll panel.
      k.add(rbox(armW - 0.04, armTop - legH - 0.12, 0.03, 0.012, 1), fabric, ax, legH + (armTop - legH - 0.12) / 2 + 0.01, D / 2 - 0.012);
    } else if (end === 'back') {
      const bx = s * (len / 2 - bt / 2);
      k.add(rbox(bt, backTop - legH, D - 0.01, 0.03, 1), fabric, bx, (legH + backTop) / 2, 0);
    }
  }
  // Seat cushions (split across the seat length) and back cushions.
  const sw = (x1 - x0) / seats;
  const sd = D - bt - 0.005;
  for (let i = 0; i < seats; i++) {
    const cx = x0 + sw * (i + 0.5);
    k.add(softBox(sw - 0.008, seatT, sd, 0.045, 0.022), fabric, cx, deckY + seatT / 2, -D / 2 + bt + sd / 2 + 0.005);
    k.add(softBox(sw - 0.01, 0.2, 0.42, 0.05, 0.03), fabric, cx, deckY + seatT + 0.18, -D / 2 + bt + 0.08, Math.PI / 2 - 0.2, 0, 0);
  }
  // Side back cushion for an L corner.
  for (const [end, s] of [[o.endL, -1], [o.endR, 1]]) {
    if (end !== 'back') continue;
    const cl = Math.min(sw, D - bt - 0.02);
    k.at(s * (len / 2 - bt - 0.08), deckY + seatT + 0.18, -D / 2 + bt + cl / 2 + 0.01, -s * Math.PI / 2, () => {
      k.add(softBox(cl, 0.2, 0.42, 0.05, 0.03), fabric, 0, 0, 0, Math.PI / 2 - 0.2, 0, 0);
    });
  }
  // Legs.
  const lx = len / 2 - 0.07, lz = D / 2 - 0.07;
  for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) if (x < 0 ? o.endL : o.endR) bunFoot(k, x, z, legH, 0.03, o.legs || 'walnut', 8);
  if (len > 2.6 && o.endL === 'arm' && o.endR === 'arm') for (const z of [-lz, lz]) bunFoot(k, 0, z, legH, 0.03, o.legs || 'walnut', 8);
  return { x0, x1, deckY, seatTop: deckY + seatT, bt, armTop, armW };
}

function pillows(k, list, slots, D, bt, seatTop) {
  const pg = pillowGeom(0.46, 0.46, 0.17, 12, 8);
  slots.forEach(([x, ry, s = 1], i) => {
    k.at(x, seatTop + 0.21, -D / 2 + bt + 0.3, ry, () => k.add(pg, list[i % list.length], 0, 0, 0, -0.32, 0, (i % 2 ? 0.06 : -0.05), s, s, s));
  });
}

// ---------------------------------------------------------------- seating

function sofa(params = {}, mat) {
  const seats = Math.max(2, Math.min(4, params.seats ?? 3));
  const w = params.w ?? (seats === 2 ? 1.9 : seats === 4 ? 3.0 : 2.4), d = params.d ?? 0.95;
  const fabric = params.fabric || 'velvetOlive';
  const k = new Kit(mat);
  const r = sofaRun(k, { len: w, D: d, seats, fabric, endL: 'arm', endR: 'arm', legs: params.legs });
  const pl = params.pillow || params.pillows || PILLOWS;
  const list = Array.isArray(pl) ? pl : [pl];
  const slots = [[r.x0 + 0.27, 0.35], [r.x1 - 0.27, -0.35]];
  if (seats >= 3) slots.splice(1, 0, [r.x1 - 0.55, -0.2, 0.9]);
  pillows(k, list, slots, d, r.bt, r.seatTop);
  if (params.throw !== false) drapedThrow(k, w / 2 - 0.085, r.armTop - 0.08, 0.08, w / 2 - r.armW + 0.005, r.seatTop, 0.12, 0.5, 1);
  return k.build('sofa', { w, d, h: 0.85, solid: true }, { seats });
}

function sofaSectional(params = {}, mat) {
  const W = params.w ?? 3.2, D = params.d ?? 2.4, dd = params.depth ?? 0.95;
  const fabric = params.fabric || 'velvetOlive'; const corner = params.corner === 'left' ? 'left' : 'right';
  const s = corner === 'right' ? 1 : -1;
  const k = new Kit(mat);
  const mainSeats = Math.max(2, Math.round((W - 0.4) / 0.85));
  let r1;
  k.at(0, 0, -D / 2 + dd / 2, 0, () => {
    r1 = sofaRun(k, { len: W, D: dd, seats: mainSeats, fabric, endL: s > 0 ? 'arm' : 'back', endR: s > 0 ? 'back' : 'arm', legs: params.legs });
  });
  const rl = D - dd;
  const retSeats = params.chaise === false ? Math.max(1, Math.round((rl - 0.2) / 0.7)) : 1;   // chaise: one long cushion
  let r2;
  k.at(s * (W / 2 - dd / 2), 0, -D / 2 + dd + rl / 2, -s * Math.PI / 2, () => {
    r2 = sofaRun(k, { len: rl, D: dd, seats: retSeats, fabric, endL: s > 0 ? null : 'arm', endR: s > 0 ? 'arm' : null, legs: params.legs });
  });
  const pl = params.pillow || params.pillows || PILLOWS;
  const list = Array.isArray(pl) ? pl : [pl];
  k.at(0, 0, -D / 2 + dd / 2, 0, () => {
    const far = s > 0 ? r1.x0 + 0.28 : r1.x1 - 0.28;
    pillows(k, list, [[far, s * 0.35], [s * (W / 2 - 0.42), -s * 0.6], [s * (W / 2 - 0.8), -s * 0.15, 0.9]], dd, r1.bt, r1.seatTop);
  });
  k.at(s * (W / 2 - dd / 2), 0, -D / 2 + dd + rl / 2, -s * Math.PI / 2, () => {
    pillows(k, [list[3 % list.length]], [[s * (rl / 2 - 0.45), -s * 0.3]], dd, r2.bt, r2.seatTop);
    if (params.throw !== false) {
      const ax = s > 0 ? rl / 2 : -rl / 2;
      drapedThrow(k, ax - s * 0.085, r2.armTop - 0.08, 0.08, ax - s * (r2.armW - 0.005), r2.seatTop, 0.1, 0.5, s);
    }
  });
  return k.build('sofaSectional', { w: W, d: D, h: 0.85, solid: true }, { corner });
}

function armchairWingback(params = {}, mat) {
  const w = params.w ?? 0.85, d = params.d ?? 0.9, h = params.h ?? 1.1;
  const fab = params.fabric || 'leatherCognac'; const wood = params.frame || 'walnut';
  const k = new Kit(mat);
  const legH = 0.14, sx = w / 2, sz = d / 2;
  // Legs: turned front, raked square back.
  for (const x of [-sx + 0.07, sx - 0.07]) {
    k.add(lathe([[0, 0], [0.018, 0], [0.024, 0.02], [0.02, 0.05], [0.028, 0.09], [0.026, 0.12], [0.03, 0.14], [0, 0.14]], 10), wood, x, 0, sz - 0.08);
    k.add(rbox(0.04, legH + 0.01, 0.04, 0.004, 1), wood, x, legH / 2, -sz + 0.07, 0.12, 0, 0);
  }
  // Seat platform, cushion.
  const seatY = 0.36;
  k.add(rbox(w - 0.1, seatY - legH, d - 0.12, 0.03, 1), fab, 0, (legH + seatY) / 2, 0.02);
  k.add(softBox(w - 0.3, 0.11, d - 0.3, 0.035, 0.02), fab, 0, seatY + 0.055, 0.1);
  // Back with tufting.
  k.at(0, 0, -sz + 0.13, 0, () => {
    k.add(softBox(w - 0.24, 0.14, h - 0.38, 0.05, 0.025), fab, 0, (seatY + h - 0.04) / 2 + 0.02, 0, Math.PI / 2 - 0.12, 0, 0);
    if (params.tufted !== false) {
      const bg = sphere(0.01, 5, 3);
      for (let r = 0; r < 3; r++) for (let c = 0; c < (r % 2 ? 2 : 3); c++) {
        const yy = 0.62 + r * 0.14, xx = (c - (r % 2 ? 0.5 : 1)) * 0.16;
        k.add(bg, fab, xx, yy, 0.075 + (yy - 0.7) * -0.12);
      }
    }
  });
  // Wings (profile in z-y, extruded across x).
  const wing = new THREE.Shape();
  wing.moveTo(-sz + 0.04, seatY); wing.lineTo(-sz + 0.04, h - 0.1);
  wing.bezierCurveTo(-sz + 0.06, h + 0.005, -0.1, h, 0.02, h - 0.12);
  wing.bezierCurveTo(0.1, h - 0.2, 0.04, 0.72, 0.12, armTopY());
  wing.lineTo(0.12, seatY); wing.lineTo(-sz + 0.04, seatY);
  function armTopY() { return 0.62; }
  const wg = extrude(wing, 0.08, 0.02, 2, 7); wg.translate(0, 0, -0.02);
  for (const s of [-1, 1]) k.add(wg, fab, s * (sx - 0.05), 0, 0, 0, -Math.PI / 2 + s * 0.06, 0);
  // Rolled arms.
  for (const s of [-1, 1]) {
    k.add(rbox(0.1, 0.25, d - 0.2, 0.025, 1), fab, s * (sx - 0.07), seatY + 0.11, 0.06);
    k.add(capsule(0.058, d - 0.32, 3, 12), fab, s * (sx - 0.06), 0.6, 0.07, Math.PI / 2, 0, 0);
  }
  if (params.nailhead) {
    const ng = sphere(0.006, 4, 3);
    for (let i = 0; i < 22; i++) k.add(ng, 'brassAged', -w / 2 + 0.07 + i * (w - 0.14) / 21, seatY - 0.03, sz - 0.04 + 0.0);
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) k.add(ng, 'brassAged', s * (sx - 0.005), 0.56 + Math.sin(i / 5 * Math.PI) * 0.05, sz - 0.12 + Math.cos(i / 5 * Math.PI) * 0.05);
  }
  return k.build('armchairWingback', { w, d, h, solid: true });
}

function armchairLounge(params = {}, mat) {
  const w = params.w ?? 0.75, d = params.d ?? 0.85;
  const frame = params.frame || 'ironBlack', fab = params.fabric || 'boucleIvory';
  const k = new Kit(mat);
  const s2 = 0.022;
  const bar = (a, b) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const dir = B.clone().sub(A); const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    k.addM(new THREE.BoxGeometry(s2, len + s2, s2), frame, new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  };
  const hx = w / 2 - s2 / 2, zf = d / 2 - 0.02, zb = -d / 2 + 0.03, armY = 0.6, topY = 0.8;
  for (const x of [-hx, hx]) {
    bar([x, s2 / 2, zf], [x, s2 / 2, zb]);            // runner
    bar([x, s2 / 2, zf], [x, armY, zf]);              // front post
    bar([x, armY, zf], [x, armY, zb + 0.05]);         // arm
    bar([x, s2 / 2, zb], [x, topY, zb - 0.0]);        // back post
    bar([x, 0.26, zf], [x, 0.26, zb]);                // seat rail
  }
  bar([-hx, 0.26, zf], [hx, 0.26, zf]); bar([-hx, 0.26, zb], [hx, 0.26, zb]);
  bar([-hx, topY, zb], [hx, topY, zb]);
  // Leather sling seat base.
  k.add(rbox(w - 0.06, 0.02, d - 0.08, 0.006, 1), 'leatherDarkBrown', 0, 0.27, -0.005);
  // Cushions.
  k.add(softBox(w - 0.07, 0.15, d - 0.2, 0.045, 0.02), fab, 0, 0.28 + 0.075, 0.06);
  k.add(softBox(w - 0.08, 0.15, 0.48, 0.05, 0.03), fab, 0, 0.6, zb + 0.11, Math.PI / 2 - 0.22, 0, 0);
  k.add(pillowGeom(0.42, 0.3, 0.13, 14, 10), params.pillow || 'velvetOlive', 0.0, 0.58, zb + 0.24, -0.25, 0.08, 0);
  return k.build('armchairLounge', { w, d, h: 0.8, solid: true });
}

function ottoman(params = {}, mat) {
  const w = params.w ?? 0.7, d = params.d ?? 0.5, h = params.h ?? 0.42;
  const fab = params.fabric || 'leatherCognac'; const k = new Kit(mat);
  const legH = 0.08;
  k.add(rbox(w - 0.02, h - legH - 0.1, d - 0.02, 0.03, 1), fab, 0, legH + (h - legH - 0.1) / 2, 0);
  k.add(softBox(w, 0.1, d, 0.045, 0.02), fab, 0, h - 0.06, 0);
  const bg = sphere(0.009, 6, 4);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) k.add(bg, fab, (i - 1) * w / 3.2, h + 0.004, (j - 0.5) * d / 2.2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bunFoot(k, sx * (w / 2 - 0.06), sz * (d / 2 - 0.06), legH, 0.03, params.legs || 'walnut', 10);
  return k.build('ottoman', { w, d, h, solid: true });
}

// ---------------------------------------------------------------- tables

function coffeeTable(params = {}, mat) {
  const w = params.w ?? 1.3, d = params.d ?? 0.75, h = params.h ?? 0.45;
  const wood = params.mat || 'oak'; const k = new Kit(mat); const rand = rng(seedOf('coffeeTable', params));
  const tt = 0.08;
  k.add(rbox(w, tt, d, 0.012, 2), wood, 0, h - tt / 2, 0);
  k.add(rbox(w - 0.3, h - tt - 0.03, d - 0.28, 0.008, 1), wood, 0, 0.03 + (h - tt - 0.03) / 2, 0);
  k.add(rbox(w - 0.33, 0.03, d - 0.31, 0.004, 1), 'walnut', 0, 0.015, 0);
  k.add(rbox(w - 0.26, 0.015, d - 0.24, 0.004, 1), 'walnut', 0, h - tt - 0.0075, 0);
  if (params.decor !== false) {
    const y = h;
    // Tray with candle and a bowl.
    k.at(-w * 0.22, y, 0.02, 0.08, () => {
      k.add(rbox(0.42, 0.012, 0.28, 0.004, 1), 'walnut', 0, 0.006, 0);
      k.add(frameGeom(0.42, 0.28, 0.012, 0.03, 0.002), 'walnut', 0, 0, 0.0, -Math.PI / 2, 0, 0);
      candle(k, -0.1, 0.012, 0.0, 0.09, 0.04, true, 'porcelain');
      k.add(lathe([[0, 0], [0.04, 0], [0.09, 0.03], [0.11, 0.06], [0.1, 0.06], [0.08, 0.035], [0, 0.03]], 20), 'teak', 0.08, 0.012, 0);
    });
    const top = bookStack(k, w * 0.12, y, -0.05, 3, rand);
    smallPlant(k, w * 0.12, top, -0.05, 0.08, rand, 'porcelain');
    vase(k, w * 0.36, y, 0.12, 0.26, 0.08, 'graniteBlack', 0);
  }
  return k.build('coffeeTable', { w, d, h, solid: true });
}

function sideTable(params = {}, mat) {
  const w = params.w ?? 0.5, d = params.d ?? 0.5, h = params.h ?? 0.6;
  const wood = params.mat || 'walnut'; const k = new Kit(mat);
  k.add(rbox(w, 0.03, d, 0.008, 2), wood, 0, h - 0.015, 0);
  const lx = w / 2 - 0.045, lz = d / 2 - 0.045;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turnedLeg(k, sx * lx, sz * lz, h - 0.03, 0.022, wood, 10, 0.16);
  for (const s of [-1, 1]) {
    k.add(rbox(w - 0.1, 0.07, 0.02, 0.003, 1), wood, 0, h - 0.07, s * lz);
    k.add(rbox(0.02, 0.07, d - 0.1, 0.003, 1), wood, s * lx, h - 0.07, 0);
  }
  k.add(rbox(w - 0.07, 0.02, d - 0.07, 0.004, 1), wood, 0, 0.16, 0);
  if (params.basket !== false) {
    k.add(rbox(w * 0.6, 0.15, d * 0.55, 0.02, 1), 'rugJute', 0, 0.17 + 0.075, 0.0);
    k.add(rbox(w * 0.52, 0.03, d * 0.47, 0.012, 1), 'throwKnit', 0, 0.17 + 0.15, 0.0);
  }
  return k.build('sideTable', { w, d, h, solid: true });
}

function consoleTable(params = {}, mat) {
  const w = params.w ?? 1.4, d = params.d ?? 0.4, h = params.h ?? 0.8;
  const wood = params.mat || 'walnut'; const k = new Kit(mat);
  k.add(rbox(w, 0.035, d, 0.008, 2), wood, 0, h - 0.0175, 0);
  const lx = w / 2 - 0.05, lz = d / 2 - 0.04;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) turnedLeg(k, sx * lx, sz * lz, h - 0.035, 0.024, wood, 10, 0.2);
  const ay = h - 0.035 - 0.07;
  k.add(rbox(w - 0.1, 0.13, 0.02, 0.003, 1), wood, 0, ay, -lz);
  for (const s of [-1, 1]) k.add(rbox(0.02, 0.13, d - 0.08, 0.003, 1), wood, s * lx, ay, 0);
  const nd = w > 1.1 ? 2 : 1, dw = (w - 0.14) / nd;
  for (let i = 0; i < nd; i++) {
    const x = -w / 2 + 0.07 + dw * (i + 0.5);
    slabFront(k, x, ay, lz - 0.01, dw - 0.01, 0.12, wood, 0.02);
    knob(k, x, ay, lz + 0.01, 'brass');
  }
  k.add(rbox(w - 0.08, 0.025, d - 0.06, 0.004, 1), wood, 0, 0.14, 0);
  return k.build('consoleTable', { w, d, h, solid: true });
}

function cabinetBody(k, w, d, h, wood, legH, legStyle) {
  // Plinth/legs, carcass, top with overhang.
  if (legStyle === 'bun') for (const sx of [-1, 1]) for (const sz of [-1, 1]) bunFoot(k, sx * (w / 2 - 0.06), sz * (d / 2 - 0.06), legH, 0.032, wood, 10);
  else k.add(rbox(w - 0.06, legH, d - 0.06, 0.004, 1), wood, 0, legH / 2, -0.01);
  const ch = h - legH - 0.03;
  k.add(rbox(w - 0.02, ch, 0.015, 0.002, 1), wood, 0, legH + ch / 2, -d / 2 + 0.0275);
  for (const s of [-1, 1]) k.add(rbox(0.02, ch, d - 0.04, 0.003, 1), wood, s * (w / 2 - 0.02), legH + ch / 2, -0.01);
  k.add(rbox(w, 0.03, d, 0.008, 2), wood, 0, h - 0.015, 0);
  k.add(rbox(w - 0.01, 0.02, d - 0.02, 0.006, 1), wood, 0, legH + 0.01, 0);
  return { y0: legH + 0.02, y1: h - 0.035, zf: d / 2 - 0.02 - 0.0 };
}

function tvConsole(params = {}, mat) {
  const w = params.w ?? 2.0, d = params.d ?? 0.45, h = params.h ?? 0.6;
  const wood = params.mat || 'oak'; const k = new Kit(mat); const rand = rng(seedOf('tvConsole', params));
  const { y0, y1, zf } = cabinetBody(k, w, d, h, wood, 0.08, 'plinth');
  const nb = w >= 1.6 ? 4 : 3; const bw = (w - 0.04) / nb; const fh = y1 - y0;
  for (let i = 0; i < nb; i++) {
    const x = -w / 2 + 0.02 + bw * (i + 0.5);
    const open = params.open !== false && (nb === 4 ? i === 1 || i === 2 : i === 1);
    if (open) {
      // Open bay: dividers, a shelf, books and a woven box.
      for (const s of [-1, 1]) k.add(rbox(0.018, fh, d - 0.05, 0.002, 1), wood, x + s * (bw / 2 - 0.009), y0 + fh / 2, -0.015);
      k.add(rbox(bw - 0.02, 0.018, d - 0.06, 0.002, 1), wood, x, y0 + fh / 2, -0.01);
      booksRow(k, x - bw / 2 + 0.03, x + bw / 2 - 0.12, y0 + fh / 2 + 0.009, zf - 0.04, d - 0.12, rand, { hMax: Math.min(0.24, fh / 2 - 0.02), lean: false });
      k.add(rbox(0.16, 0.09, 0.2, 0.01, 1), 'rugJute', x - 0.03, y0 + 0.045, zf - 0.15);
      continue;
    }
    shakerDoor(k, x, y0 + fh / 2, zf, bw - 0.008, fh - 0.006, wood, 0.02, 0.06);
    knob(k, x + (i < nb / 2 ? bw / 2 - 0.05 : -bw / 2 + 0.05), y0 + fh / 2, zf + 0.02, 'brass');
  }
  return k.build('tvConsole', { w, d, h, solid: true });
}

function tv(params = {}, mat) {
  const w = params.w ?? 1.65, h = params.h ?? 0.95, cy = params.y ?? 1.35;
  const k = new Kit(mat);
  k.add(rbox(0.4, 0.25, 0.02, 0.004, 1), 'ironBlack', 0, cy, 0.01);
  k.add(rbox(w, h, 0.035, 0.008, 2), params.frame || 'ironBlack', 0, cy, 0.02 + 0.0175);
  k.add(new THREE.PlaneGeometry(w - 0.03, h - 0.03), 'screen', 0, cy, 0.0555);
  return k.build('tv', { w, d: 0.06, h, solid: false, mount: 'wall' });
}

function builtInShelves(params = {}, mat) {
  const w = params.w ?? 2.4, d = params.d ?? 0.4, h = params.h ?? 2.6;
  const wood = params.mat || 'walnut'; const k = new Kit(mat); const rand = rng(seedOf('builtInShelves', params));
  const nb = Math.max(1, Math.round(w / 0.8)); const st = 0.03; const bw = (w - st * (nb + 1)) / nb;
  const baseH = 0.88, ud = Math.min(d - 0.08, 0.32), crownH = 0.12;
  // Back panel and side/divider stiles.
  k.add(rbox(w, h - 0.01, 0.015, 0, 1), params.back || wood, 0, (h - 0.01) / 2, 0.0075);
  for (let i = 0; i <= nb; i++) {
    const x = -w / 2 + st / 2 + i * (bw + st);
    k.add(rbox(st, baseH, d - 0.02, 0.003, 1), wood, x, baseH / 2, (d - 0.02) / 2);
    k.add(rbox(st, h - baseH - crownH, ud, 0.003, 1), wood, x, baseH + (h - baseH - crownH) / 2, ud / 2);
  }
  // Base: plinth, doors, counter ledge.
  k.add(rbox(w - 0.02, 0.09, d - 0.06, 0.003, 1), wood, 0, 0.045, (d - 0.06) / 2);
  k.add(rbox(w + 0.01, 0.035, d + 0.005, 0.008, 2), wood, 0, baseH + 0.0175, (d + 0.005) / 2);
  for (let i = 0; i < nb; i++) {
    const x = -w / 2 + st + bw / 2 + i * (bw + st);
    const dh = baseH - 0.1 - 0.01; const dy = 0.1 + dh / 2;
    const nd = bw > 0.55 ? 2 : 1; const dw = bw / nd;
    for (let j = 0; j < nd; j++) {
      const dx = x - bw / 2 + dw * (j + 0.5);
      shakerDoor(k, dx, dy, d - 0.04, dw - 0.006, dh, wood, 0.02, 0.065);
      knob(k, dx + (nd === 2 ? (j === 0 ? dw / 2 - 0.045 : -dw / 2 + 0.045) : dw / 2 - 0.05), dy + dh * 0.3, d - 0.02, 'brass');
    }
  }
  // Upper shelves and fill.
  const y0 = baseH + 0.035, y1 = h - crownH;
  const nsh = Math.max(2, Math.round((y1 - y0) / 0.38));
  const pitch = (y1 - y0) / nsh;
  for (let i = 0; i < nb; i++) {
    const x = -w / 2 + st + bw / 2 + i * (bw + st);
    for (let s = 1; s < nsh; s++) k.add(rbox(bw + 0.004, 0.025, ud - 0.005, 0.003, 1), wood, x, y0 + s * pitch, (ud - 0.005) / 2);
    for (let s = 0; s < nsh; s++) {
      const sy = y0 + s * pitch + (s ? 0.0125 : 0);
      const clear = pitch - 0.035;
      const x0 = x - bw / 2 + 0.01, x1 = x + bw / 2 - 0.01;
      const kind = Math.floor(rand() * 4);
      const zf = ud - 0.02;
      if (kind === 0) {
        booksRow(k, x0, x1, sy, zf, ud - 0.03, rand, { hMax: Math.min(0.3, clear - 0.02) });
      } else if (kind === 1) {
        const used = booksRow(k, x0, x0 + bw * (0.45 + rand() * 0.2), sy, zf, ud - 0.03, rand, { hMax: Math.min(0.3, clear - 0.02) });
        vase(k, x0 + used + (x1 - x0 - used) / 2, sy, ud / 2, Math.min(clear - 0.04, 0.22 + rand() * 0.08), 0.07, rand() < 0.5 ? 'porcelain' : 'terracottaPot', Math.floor(rand() * 3));
      } else if (kind === 2) {
        const top = bookStack(k, x0 + 0.14, sy, ud / 2, 2 + Math.floor(rand() * 3), rand);
        if (clear - (top - sy) > 0.15) smallPlant(k, x0 + 0.14, top, ud / 2, 0.07, rand, 'porcelain');
        booksRow(k, x1 - bw * 0.4, x1, sy, zf, ud - 0.03, rand, { hMax: Math.min(0.28, clear - 0.02), lean: false });
      } else {
        vase(k, x - bw * 0.2, sy, ud / 2, Math.min(clear - 0.05, 0.28), 0.085, 'porcelain', Math.floor(rand() * 3));
        k.add(lathe([[0, 0], [0.05, 0], [0.1, 0.04], [0.11, 0.06], [0.1, 0.06], [0.06, 0.03], [0, 0.03]], 18), 'brassAged', x + bw * 0.2, sy, ud / 2);
      }
    }
  }
  // Crown cornice.
  k.add(rbox(w, crownH * 0.5, ud + 0.01, 0.003, 1), wood, 0, h - crownH * 0.75, (ud + 0.01) / 2);
  k.add(rbox(w + 0.02, 0.03, ud + 0.04, 0.008, 2), wood, 0, h - 0.04, (ud + 0.04) / 2);
  k.add(rbox(w + 0.04, 0.025, ud + 0.06, 0.006, 1), wood, 0, h - 0.0125, (ud + 0.06) / 2);
  return k.build('builtInShelves', { w, d, h, solid: true, mount: 'wall' });
}

// ---------------------------------------------------------------- dining

function diningTable(params = {}, mat) {
  const round = !!params.round;
  const w = params.w ?? (round ? 1.4 : 2.2), d = round ? w : (params.d ?? 1.0), h = params.h ?? 0.75;
  const wood = params.mat || 'walnut'; const k = new Kit(mat);
  const tt = 0.04;
  if (round) {
    k.add(lathe([[0, 0], [w / 2 - 0.02, 0], [w / 2, 0.012], [w / 2, tt - 0.01], [w / 2 - 0.01, tt], [0, tt]], 64), wood, 0, h - tt, 0);
    k.add(cyl(w / 2 - 0.12, w / 2 - 0.12, 0.08, 48), wood, 0, h - tt - 0.04, 0);
    k.add(lathe([[0, 0], [0.16, 0], [0.13, 0.06], [0.1, 0.1], [0.14, 0.2], [0.15, 0.3], [0.11, 0.42], [0.08, 0.5], [0.1, 0.55], [0.13, 0.6], [0.13, h - tt - 0.08], [0, h - tt - 0.08]], 28), wood, 0, 0, 0);
    const foot = new THREE.Shape();
    foot.moveTo(0, 0); foot.lineTo(0.46, 0); foot.lineTo(0.47, 0.04); foot.quadraticCurveTo(0.3, 0.05, 0.2, 0.16);
    foot.quadraticCurveTo(0.13, 0.24, 0.1, 0.3); foot.lineTo(0, 0.3); foot.lineTo(0, 0);
    const fg = extrude(foot, 0.07, 0.008, 2, 8); fg.translate(0, 0, -0.027);
    for (let i = 0; i < 4; i++) k.add(fg, wood, 0, 0.008, 0, 0, (i / 4) * TAU + Math.PI / 4, 0);
  } else {
    // Top: rounded-rect slab with a soft bevelled edge (extruded along +Z, turned to +Y).
    const g = extrude(roundRectShape(w - 0.02, d - 0.02, 0.03), tt, 0.01, 3, 4);
    k.add(g, wood, 0, h - tt + 0.01, 0, -Math.PI / 2, 0, 0);
    const lx = w / 2 - 0.1, lz = d / 2 - 0.1;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) turnedLeg(k, sx * lx, sz * lz, h - tt, 0.04, wood, 12, 0.18);
    const ay = h - tt - 0.06;
    for (const s of [-1, 1]) {
      k.add(rbox(w - 0.2, 0.1, 0.025, 0.004, 1), wood, 0, ay, s * (lz - 0.005));
      k.add(rbox(0.025, 0.1, d - 0.2, 0.004, 1), wood, s * (lx - 0.005), ay, 0);
    }
    if (w > 2.6) for (const s of [-1, 1]) turnedLeg(k, 0, s * lz, h - tt, 0.04, wood, 12, 0.18);
  }
  return k.build('diningTable', { w, d, h, solid: true }, { round });
}

function diningChair(params = {}, mat) {
  const w = params.w ?? 0.5, d = params.d ?? 0.55, h = params.h ?? 0.95;
  const wood = params.frame || 'walnut', fab = params.fabric || 'linenCream'; const k = new Kit(mat);
  const sy = 0.4, fz = d / 2 - 0.04, bz = -d / 2 + 0.05, lx = w / 2 - 0.035;
  for (const s of [-1, 1]) {
    k.add(lathe([[0, 0], [0.014, 0], [0.018, 0.03], [0.014, 0.08], [0.017, 0.2], [0.021, 0.3], [0.016, 0.33], [0.022, 0.35], [0.022, sy], [0, sy]], 8), wood, s * (lx - 0.005), 0, fz);
    // Back leg + post in one raked piece.
    k.add(taperBox(0.034, 0.034, sy, 0.03, 0.03), wood, s * lx, sy / 2, bz, -0.08, 0, 0);
    k.add(taperBox(0.034, 0.03, h - sy, 0.028, 0.026), wood, s * lx, sy + (h - sy) / 2 - 0.01, bz - 0.04, -0.12, 0, 0);
  }
  // Seat rails + upholstered seat.
  k.add(rbox(w - 0.03, 0.06, 0.02, 0.003, 1), wood, 0, sy - 0.03, fz);
  k.add(rbox(w - 0.05, 0.06, 0.02, 0.003, 1), wood, 0, sy - 0.03, bz + 0.01);
  for (const s of [-1, 1]) k.add(rbox(0.02, 0.06, d - 0.1, 0.003, 1), wood, s * lx, sy - 0.03, (fz + bz) / 2);
  k.add(softBox(w - 0.02, 0.065, d - 0.06, 0.025, 0.018), fab, 0, sy + 0.03, 0.01);
  // Top rail (slightly curved) and upholstered back panel.
  k.add(rbox(w - 0.04, 0.06, 0.03, 0.01, 1), wood, 0, h - 0.04, bz - 0.096, -0.12, 0, 0);
  k.add(softBox(w - 0.1, 0.04, 0.34, 0.02, 0.012), fab, 0, sy + 0.32, bz - 0.06, Math.PI / 2 - 0.12, 0, 0);
  // Stretchers.
  for (const s of [-1, 1]) k.rod([s * lx, 0.14, fz], [s * lx, 0.14, bz + 0.01], 0.009, wood, 6);
  k.rod([-lx, 0.18, fz - 0.005], [lx, 0.18, fz - 0.005], 0.008, wood, 6);
  return k.build('diningChair', { w, d, h, solid: true });
}

function sideboard(params = {}, mat) {
  const w = params.w ?? 1.8, d = params.d ?? 0.5, h = params.h ?? 0.85;
  const wood = params.mat || 'walnut'; const k = new Kit(mat);
  const { y0, y1, zf } = cabinetBody(k, w, d, h, wood, 0.12, 'bun');
  const n = Math.max(2, Math.round(w / 0.6)); const bw = (w - 0.04) / n;
  const drH = 0.15;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.02 + bw * (i + 0.5);
    slabFront(k, x, y1 - drH / 2, zf, bw - 0.008, drH - 0.008, wood, 0.02);
    cupPull(k, x, y1 - drH / 2, zf + 0.02, 'brass');
    const dh = y1 - y0 - drH;
    shakerDoor(k, x, y0 + dh / 2, zf, bw - 0.008, dh - 0.008, wood, 0.02, 0.065);
    knob(k, x + (i % 2 === 0 ? bw / 2 - 0.05 : -bw / 2 + 0.05), y0 + dh * 0.62, zf + 0.02, 'brass');
  }
  return k.build('sideboard', { w, d, h, solid: true });
}

export const LIVING = {
  sofa, sofaSectional, armchairWingback, armchairLounge, ottoman, coffeeTable, sideTable, consoleTable,
  tvConsole, tv, builtInShelves, diningTable, diningChair, sideboard,
};
export const INFO = {
  sofa: { w: 2.4, d: 0.95, h: 0.85, mount: 'floor', solid: true },
  sofaSectional: { w: 3.2, d: 2.4, h: 0.85, mount: 'floor', solid: true },
  armchairWingback: { w: 0.85, d: 0.9, h: 1.1, mount: 'floor', solid: true },
  armchairLounge: { w: 0.75, d: 0.85, h: 0.8, mount: 'floor', solid: true },
  ottoman: { w: 0.7, d: 0.5, h: 0.42, mount: 'floor', solid: true },
  coffeeTable: { w: 1.3, d: 0.75, h: 0.45, mount: 'floor', solid: true },
  sideTable: { w: 0.5, d: 0.5, h: 0.6, mount: 'floor', solid: true },
  consoleTable: { w: 1.4, d: 0.4, h: 0.8, mount: 'floor', solid: true },
  tvConsole: { w: 2.0, d: 0.45, h: 0.6, mount: 'floor', solid: true },
  tv: { w: 1.65, d: 0.06, h: 0.95, mount: 'wall', solid: false },
  builtInShelves: { w: 2.4, d: 0.4, h: 2.6, mount: 'wall', solid: true },
  diningTable: { w: 2.2, d: 1.0, h: 0.75, mount: 'floor', solid: true },
  diningChair: { w: 0.5, d: 0.55, h: 0.95, mount: 'floor', solid: true },
  sideboard: { w: 1.8, d: 0.5, h: 0.85, mount: 'floor', solid: true },
};
void sphere; void taperLeg;
