// Home lift (optional, zoning.js `lift`): a moving car with sliding car doors, landing doors on
// every stop, a call button outside on every stop and a floor panel inside. The player can ride it.
//
// Buttons are real objects: `lift.clickables` lists every button mesh with
// userData.liftAction ({kind:'floor'|'call', level} | {kind:'open'} | {kind:'close'})
// and userData.label (prompt text). `lift.press(action)` runs one.
// A pressed button lights up until the car arrives at its floor; the car dings on arrival.
//
// Geometry is built in a canonical frame with the door on the WEST face of the shaft and turned to
// the data's door side ('n' | 's' | 'e' | 'w') about the shaft centre (liftFrame).
import * as THREE from 'three';
import { box } from './geom.js';
import { LIFT, LIFT_STOPS, STOP_ELEV, LEVELS, GROUND } from './config.js';
import { t } from './i18n.js';

const STOPS = LIFT_STOPS;
const isStop = (lv) => Object.prototype.hasOwnProperty.call(STOP_ELEV, lv);
const glyphOf = (lv) => String(LEVELS[lv]?.short || lv || '').slice(0, 3);

// Canonical frame of a lift shaft (door on the west face) ↔ plan
const ANGLE = { w: 0, s: Math.PI / 2, e: Math.PI, n: -Math.PI / 2 };
export function liftFrame(L) {
  const [x0, y0, x1, y1] = L.r, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const a = ANGLE[L.door] ?? 0, c = Math.cos(a), s = Math.sin(a);
  const ew = L.door === 'w' || L.door === 'e' || !L.door;
  const cw = ew ? x1 - x0 : y1 - y0, cd = ew ? y1 - y0 : x1 - x0;
  const C = [cx - cw / 2, cy - cd / 2, cx + cw / 2, cy + cd / 2];
  const toPlan = (x, y) => { const dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; };
  const toLocal = (x, y) => { const dx = x - cx, dy = y - cy; return [cx + dx * c + dy * s, cy - dx * s + dy * c]; };
  const rectToPlan = (r) => {
    const p = [toPlan(r[0], r[1]), toPlan(r[2], r[3])];
    return [Math.min(p[0][0], p[1][0]), Math.min(p[0][1], p[1][1]), Math.max(p[0][0], p[1][0]), Math.max(p[0][1], p[1][1])];
  };
  const [X0, Y0, X1, Y1] = C, door = [Y0 + 0.4, Y1 - 0.4], T = 0.06;
  // shaft walls (canonical → plan): back, sides, door jambs, the wall over the door (head)
  const shaft = [
    { r: [X0, Y1 - T, X1, Y1], mat: 'plaster' },
    { r: [X0, Y0, X1, Y0 + T], mat: 'plaster' },
    { r: [X1 - T, Y0 + T, X1, Y1 - T], mat: 'plaster' },
    { r: [X0, Y0 + T, X0 + 0.1, door[0]], mat: 'steelBrushed' },
    { r: [X0, door[1], X0 + 0.1, Y1 - T], mat: 'steelBrushed' },
    { r: [X0, door[0], X0 + 0.1, door[1]], mat: 'steelBrushed', head: true },
  ].map(p => ({ ...p, r: rectToPlan(p.r) }));
  return { C, angle: a, cx, cy, toPlan, toLocal, rectToPlan, shaft };
}
const F = LIFT ? liftFrame(LIFT) : null;
const [X0, Y0, X1, Y1] = F ? F.C : [0, 0, 1.5, 1.6];
const DOOR = [Y0 + 0.4, Y1 - 0.4]; // door opening along y on the (canonical) west face
const INNER = [X0 + 0.12, Y0 + 0.08, X1 - 0.08, Y1 - 0.08];

const SPEED = 0.9;        // m/s
const DOOR_TIME = 1.2;    // s to open / close
const DWELL = 8;          // s the doors stay open before closing by themselves
const HOLD = 5;           // s extra the "open doors" button holds them
const MIN_LIT = 0.35;     // s a button stays lit at least (so a press is always seen)
const PRESS_DEPTH = 0.004, PRESS_TIME = 0.18;
const BTN_R = 0.021;      // button radius (m)
const AMBER = new THREE.Color('#ffc46b');

// Turn a group built in the canonical frame to the shaft's real orientation
function pivot(group) {
  if (!F || !F.angle) return group;
  const outer = new THREE.Group(), inner = new THREE.Group();
  outer.position.set(F.cx, 0, -F.cy); outer.rotation.y = F.angle;
  inner.position.set(-F.cx, 0, F.cy);
  inner.add(group); outer.add(inner);
  return outer;
}

function meshOf(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; }

// Two door leaves that slide apart along y. Returns { group, set(open 0..1) }.
function doorPair(x, z0, z1, mat, thick) {
  const g = new THREE.Group();
  const half = (DOOR[1] - DOOR[0]) / 2;
  const left = meshOf(box(x, DOOR[0], x + thick, DOOR[0] + half, z0, z1), mat);
  const right = meshOf(box(x, DOOR[0] + half, x + thick, DOOR[1], z0, z1), mat);
  g.add(left, right);
  return {
    group: g,
    set(open) { left.position.z = open * half * 0.95; right.position.z = -open * half * 0.95; }, // world Z = -plan y
  };
}

// ------------------------------------------------------------ button labels
const hasDOM = typeof document !== 'undefined';

// Draws a glyph: text, or 'open' / 'close' / 'call' arrow pictograms.
function drawGlyph(g, glyph, S) {
  const c = S / 2;
  if (glyph === 'open' || glyph === 'close' || glyph === 'call') {
    const a = S * 0.15, gap = S * 0.04;
    const tri = (x, y, dir, axis) => {  // dir +1/-1, axis 'x' (left/right) or 'y' (up/down)
      g.beginPath();
      if (axis === 'x') { g.moveTo(x + dir * a, y); g.lineTo(x, y - a * 0.85); g.lineTo(x, y + a * 0.85); }
      else { g.moveTo(x, y + dir * a); g.lineTo(x - a * 0.85, y); g.lineTo(x + a * 0.85, y); }
      g.closePath(); g.fill();
    };
    if (glyph === 'open') { tri(c - gap, c, -1, 'x'); tri(c + gap, c, 1, 'x'); }
    else if (glyph === 'close') { tri(c - gap - a, c, 1, 'x'); tri(c + gap + a, c, -1, 'x'); }
    else { tri(c, c - gap, -1, 'y'); tri(c, c + gap, 1, 'y'); }
    return;
  }
  g.font = `700 ${Math.round(S * 0.36)}px Inter, Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(glyph, c, c + S * 0.02);
}

// A button face: brushed disc with an engraved glyph (map) + a glowing ring/glyph (emissiveMap).
function faceTextures(glyph) {
  const S = 128;
  const mk = () => { const cv = document.createElement('canvas'); cv.width = cv.height = S; return cv; };
  const base = mk(), g = base.getContext('2d');
  const grad = g.createRadialGradient(S * 0.4, S * 0.35, S * 0.05, S / 2, S / 2, S * 0.55);
  grad.addColorStop(0, '#e9ecef'); grad.addColorStop(1, '#9ea3a8');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  g.globalAlpha = 0.08; g.strokeStyle = '#000';
  for (let i = 0; i < S; i += 3) { g.beginPath(); g.moveTo(0, i); g.lineTo(S, i + 0.5); g.stroke(); } // brushing
  g.globalAlpha = 1;
  g.lineWidth = S * 0.05; g.strokeStyle = '#6f757b';
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.43, 0, Math.PI * 2); g.stroke();
  // Engraved: a light offset under a dark glyph
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.save(); g.translate(1.5, 1.5); drawGlyph(g, glyph, S); g.restore();
  g.fillStyle = '#2c2f33'; drawGlyph(g, glyph, S);
  const glow = mk(), h = glow.getContext('2d');
  h.fillStyle = '#000'; h.fillRect(0, 0, S, S);
  h.lineWidth = S * 0.06; h.strokeStyle = '#fff';
  h.beginPath(); h.arc(S / 2, S / 2, S * 0.43, 0, Math.PI * 2); h.stroke();
  h.fillStyle = '#fff'; drawGlyph(h, glyph, S);
  const map = new THREE.CanvasTexture(base); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const emissiveMap = new THREE.CanvasTexture(glow); emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

// One round push button facing local +z. Returns { group, mesh } — mesh is the clickable cap.
function makeButton(glyph, bezelMat) {
  const group = new THREE.Group();
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(BTN_R * 1.28, BTN_R * 1.35, 0.004, 32).rotateX(Math.PI / 2).translate(0, 0, 0.002), bezelMat);
  group.add(bezel);
  const capMat = new THREE.MeshStandardMaterial({ color: 0xc9cdd1, metalness: 0.9, roughness: 0.3, emissive: AMBER, emissiveIntensity: 0 });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(BTN_R, BTN_R, 0.008, 32).rotateX(Math.PI / 2).translate(0, 0, 0.004), capMat);
  const tx = hasDOM ? faceTextures(glyph) : {};
  const faceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.75, roughness: 0.35, map: tx.map || null,
    emissive: AMBER, emissiveMap: tx.emissiveMap || null, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -1 });
  const face = new THREE.Mesh(new THREE.CircleGeometry(BTN_R * 0.97, 32), faceMat);
  face.position.z = 0.0081;
  mesh.add(face);
  group.add(mesh);
  return { group, mesh, face, capMat, faceMat };
}

// A small dot-matrix style floor display (canvas), returns { mesh, show(text) }.
function makeDisplay(w, h) {
  if (!hasDOM) return { mesh: new THREE.Group(), show() {} };
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.2, roughness: 0.2 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  let last = '';
  const show = (text) => {
    if (text === last) return; last = text;
    g.fillStyle = '#05070a'; g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#ffb347'; g.font = '700 40px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 34); tex.needsUpdate = true;
  };
  show(glyphOf(STOPS.includes(GROUND) ? GROUND : STOPS[0]));
  return { mesh, show };
}

const LABELS = {
  floor: (lv) => t('liftTo', { lv: LEVELS[lv]?.name || lv }),
  call: () => t('liftCallBtn'),
  open: () => t('liftOpen'),
  close: () => t('liftClose'),
};

export function buildLift(getMaterial) {
  const M = (n) => getMaterial(n);
  const buttons = [];   // { mesh, action, capMat, faceMat, home, axis, t, lit }
  const addButton = (parent, glyph, action, pos, rotY = 0) => {
    const b = makeButton(glyph, M('steelBrushed'));
    b.group.position.copy(pos); b.group.rotation.y = rotY;
    parent.add(b.group);
    const label = LABELS[action.kind](action.level);
    for (const o of [b.mesh, b.face]) Object.assign(o.userData, { liftAction: action, label, liftButton: true });
    buttons.push({ mesh: b.mesh, action, capMat: b.capMat, faceMat: b.faceMat, t: -1, glow: 0 });
  };

  // Car, built at elevation 0 and moved by position.y
  const car = new THREE.Group();
  const [ix0, iy0, ix1, iy1] = INNER;
  const H = 2.3;
  car.add(meshOf(box(ix0, iy0, ix1, iy1, 0, 0.04), M('travertine')));                        // floor
  car.add(meshOf(box(ix0, iy1 - 0.05, ix1, iy1, 0, H), M('walnut')));                          // north wall
  car.add(meshOf(box(ix0, iy0, ix1, iy0 + 0.05, 0, H), M('walnut')));                          // south wall
  car.add(meshOf(box(ix1 - 0.05, iy0, ix1, iy1, 0, H), M('walnut')));                          // back (east) wall
  car.add(meshOf(box(ix1 - 0.07, iy0 + 0.25, ix1 - 0.05, iy1 - 0.25, 0.9, 2.1), M('mirror')));  // mirror
  car.add(meshOf(box(ix1 - 0.12, iy0 + 0.15, ix1 - 0.08, iy1 - 0.15, 0.88, 0.92), M('brassAged'))); // handrail
  car.add(meshOf(box(ix0, iy0, ix1, iy1, H, H + 0.05), M('steelBrushed')));                     // ceiling
  car.add(meshOf(box(ix0 + 0.3, iy0 + 0.5, ix1 - 0.3, iy1 - 0.5, H - 0.02, H), M('bulbWarm')));  // light

  // Floor panel beside the door, inside on the (canonical) north wall: brushed plate, display,
  // one button per stop in a column (top = highest) and open / close below.
  const px0 = ix0 + 0.07, px1 = ix0 + 0.29, pz0 = 0.9, pz1 = 1.64, pf = iy1 - 0.062;  // plate face at plan y = pf
  car.add(meshOf(box(px0, pf, px1, iy1 - 0.05, pz0, pz1), M('steelBrushed')));
  const cx = (px0 + px1) / 2, faceZ = -pf;                       // world z of the plate face (buttons face +z)
  const disp = makeDisplay(0.12, 0.06);
  disp.mesh.position.set(cx, 1.575, faceZ + 0.0015);
  car.add(disp.mesh);
  const top = [...STOPS].reverse();                               // highest stop first
  top.forEach((lv, i) => addButton(car, glyphOf(lv), { kind: 'floor', level: lv }, new THREE.Vector3(cx, 1.48 - i * 0.085, faceZ)));
  addButton(car, 'open', { kind: 'open' }, new THREE.Vector3(cx - 0.05, 1.0, faceZ));
  addButton(car, 'close', { kind: 'close' }, new THREE.Vector3(cx + 0.05, 1.0, faceZ));

  const carDoors = doorPair(X0 + 0.1, 0.04, 2.15, M('steelBrushed'), 0.03);
  car.add(carDoors.group);
  car.add(meshOf(box(X0 + 0.1, iy0, X0 + 0.14, DOOR[0], 0, H), M('steelBrushed')));              // front returns
  car.add(meshOf(box(X0 + 0.1, DOOR[1], X0 + 0.14, iy1, 0, H), M('steelBrushed')));

  // Landing doors + a call button on every floor (west face of the shaft, north of the door).
  // The call housing encloses the simple marker world.js builds there.
  const landing = {}, calls = new THREE.Group();
  for (const lv of STOPS) {
    const e = STOP_ELEV[lv];
    landing[lv] = doorPair(X0 - 0.03, e, e + 2.15, M('steelBrushed'), 0.03);
    const hy0 = DOOR[1] + 0.065, hy1 = DOOR[1] + 0.215, hx = X0 - 0.05;
    calls.add(meshOf(box(hx, hy0, X0, hy1, e + 0.98, e + 1.32), M('steelBrushed')));
    addButton(calls, 'call', { kind: 'call', level: lv }, new THREE.Vector3(hx, e + 1.11, -(hy0 + hy1) / 2), -Math.PI / 2);
  }
  const light = new THREE.PointLight('#fff1d6', 2.5, 4, 2);
  light.position.set((ix0 + ix1) / 2, H - 0.3, -(iy0 + iy1) / 2);
  car.add(light);
  return { car, carDoors, landing, calls, buttons, display: disp };
}

// Player tests in the canonical frame (false when the house has no lift)
const local = (x, y) => (F ? F.toLocal(x, y) : [Infinity, Infinity]);
export const insideCar = (x, y) => { [x, y] = local(x, y); return x > X0 + 0.1 && x < X1 && y > Y0 && y < Y1; };
export const nearDoor = (x, y) => { [x, y] = local(x, y); return x > X0 - 2.2 && x <= X0 + 0.1 && y > Y0 - 0.6 && y < Y1 + 0.6; };
const inDoorway = (x, y) => { [x, y] = local(x, y); return x > X0 - 0.35 && x < X0 + 0.4 && y > DOOR[0] - 0.1 && y < DOOR[1] + 0.1; };

// ------------------------------------------------------------ sound
let actx = null;
function installAudioUnlock() {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function' || installAudioUnlock.done) return;
  installAudioUnlock.done = true;
  const unlock = () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!actx) actx = new AC();
      if (actx.state === 'suspended') actx.resume();
    } catch { /* no audio */ }
  };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { capture: true, passive: true });
}
// A soft two-partial bell, ~1.4 s
function ding(volume = 1) {
  if (!actx || actx.state !== 'running' || volume <= 0.01) return;
  const t = actx.currentTime;
  const out = actx.createGain(); out.gain.value = 0.16 * volume; out.connect(actx.destination);
  for (const [f, g, d] of [[1046.5, 1, 1.4], [2093, 0.25, 0.7], [1568, 0.18, 1.0]]) {
    const o = actx.createOscillator(), v = actx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + 0.01); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(v); v.connect(out); o.start(t); o.stop(t + d + 0.05);
  }
}

// Drives the lift; main.js calls update() each frame.
// Phases: 'opening' (opening or open, idle at `level`), 'closing' (before a trip, or an idle close),
// 'moving' (travelling to `target`), 'closed' (idle at `level` with the doors shut).
export class LiftController {
  constructor(parts, scene) {
    this.p = parts;
    this.enabled = !!F && STOPS.length >= 2;
    if (this.enabled) {
      scene.add(pivot(parts.car), pivot(parts.calls));
      for (const d of Object.values(parts.landing)) scene.add(pivot(d.group));
    }
    this.level = STOPS.includes(GROUND) ? GROUND : STOPS[0];
    this.y = STOP_ELEV[this.level] ?? 0;
    this.target = null;
    this.queue = [];
    this.open = 0;          // 0 closed .. 1 open
    this.phase = 'opening';
    this.rider = false;
    this.dwell = DWELL;     // s left before the doors close by themselves
    this.lit = new Map();   // 'floor:B1' / 'call:L2' → seconds lit
    this.send = null;       // optional (lv) => void to broadcast a request; defaults to window.__dh.multi.sendLift
    this.clickables = this.enabled ? parts.buttons.map(b => b.mesh) : [];
    this._btn = new Map(parts.buttons.map(b => [key(b.action), b]));
    installAudioUnlock();
  }

  get moving() { return this.phase === 'moving' || (this.phase === 'closing' && !!this.target); }
  doorsOpenAt(lv) { return this.level === lv && this.phase !== 'moving' && this.open > 0.85; }

  // Buttons usable from a level: the car panel always, plus that floor's call button
  clickablesFor(level) { return this.clickables.filter(m => m.userData.liftAction.kind !== 'call' || m.userData.liftAction.level === level); }

  // Core request (keys, on-screen UI, network). lv is a level id, or 'open' / 'close'.
  request(lv, kind) {
    if (lv === 'open') return this._openDoors();
    if (lv === 'close') return this._closeDoors();
    if (!isStop(lv)) { this._openDoors(); return; }
    const idleHere = lv === this.level && !this.moving;
    if (!idleHere) {
      if (kind !== 'call') this._light('floor', lv);
      if (kind !== 'floor') this._light('call', lv);
    }
    if (idleHere) { this._openDoors(); return; }
    if (this.phase === 'moving') { if (lv !== this.target && !this.queue.includes(lv)) this.queue.push(lv); return; }
    if (this.phase === 'closing' && this.target && lv !== this.target) { if (!this.queue.includes(lv)) this.queue.push(lv); return; }
    this.target = lv;
    this.phase = 'closing';
  }

  // Press a 3D button: light + press-in, then the same path as keys/UI (and broadcast to peers).
  press(action) {
    if (!action || !action.kind) return false;
    const b = this._btn.get(key(action));
    let ok = true, msg;
    if (action.kind === 'floor' || action.kind === 'call') {
      if (!isStop(action.level)) return false;
      msg = action.level;
      this._light(action.kind, action.level);
      this.request(action.level, action.kind);
    } else if (action.kind === 'open') {
      ok = !this.moving; msg = 'open';
      if (ok) this.request('open');
    } else if (action.kind === 'close') {
      ok = !this.moving && this.open > 0; msg = 'close';
      if (ok) this.request('close');
    } else return false;
    if (b) b.t = 0;                                  // press-in animation
    if (ok) this._broadcast(msg);
    return ok;
  }

  _broadcast(lv) {
    try {
      if (this.send) return this.send(lv);
      const m = typeof window !== 'undefined' && window.__dh && window.__dh.multi;
      if (m && m.sendLift) m.sendLift(lv);
    } catch { /* offline */ }
  }

  _openDoors() {
    if (this.moving) return;
    this.phase = 'opening';
    this.dwell = Math.max(this.dwell, HOLD);
  }
  _closeDoors() {
    if (this.moving || this.phase === 'closed') return;
    this.phase = 'closing'; this.target = null;
  }
  _light(kind, lv) { const k = `${kind}:${lv}`; if (!this.lit.has(k)) this.lit.set(k, 0); }

  update(dt, player, playerLevel) {
    if (!this.enabled) return false;
    const ride = insideCar(player.x, player.y) && Math.abs(player.e - this.y) < 0.3;
    const atThreshold = inDoorway(player.x, player.y) && Math.abs(player.e - this.y) < 1;
    // Never shut the doors on the local player when nobody is waiting to go anywhere
    if (this.phase === 'closing' && !this.target && atThreshold) this.phase = 'opening';
    if (this.phase === 'opening') {
      this.open = Math.min(1, this.open + dt / DOOR_TIME);
      if (this.open === 1) {
        this.dwell -= dt;
        if (atThreshold) this.dwell = Math.max(this.dwell, 2);
        if (this.dwell <= 0 && !this.queue.length) this.phase = 'closing';
      }
    } else if (this.phase !== 'closing') this.dwell = DWELL;
    if (this.phase === 'closing') {
      this.open = Math.max(0, this.open - dt / DOOR_TIME);
      if (this.open === 0) {
        if (this.target && isStop(this.target)) { this.phase = 'moving'; this.rider = ride; }
        else { this.phase = 'closed'; this.target = null; }
      }
    }
    if (this.phase === 'moving') {
      if (!isStop(this.target)) { this.phase = 'opening'; this.target = null; }
      else {
        const ty = STOP_ELEV[this.target], d = ty - this.y, step = SPEED * dt;
        this.y = Math.abs(d) <= step ? ty : this.y + Math.sign(d) * step;
        if (this.y === ty) {
          this.level = this.target; this.target = null; this.phase = 'opening'; this.dwell = DWELL;
          // Ding, softer the further away the listener is
          const dist = Math.hypot(player.x - (X0 + X1) / 2, player.y - (Y0 + Y1) / 2, (player.e - ty) * 1.5);
          ding(this.rider ? 1 : Math.max(0, 1 - dist / 14));
        }
        if (this.rider) { player.e = this.y; player.vy = 0; player.grounded = true; }
      }
    } else {
      this.rider = false;
    }
    this.p.car.position.y = this.y;
    this.p.carDoors.set(this.open);
    for (const lv of STOPS) this.p.landing[lv].set(lv === this.level && this.phase !== 'moving' ? this.open : 0);
    if (this.phase === 'opening' && this.open === 1 && this.queue.length) {
      const q = this.queue.shift();
      this.request(q);
    }
    this._updateButtons(dt, playerLevel);
    return this.rider && this.phase === 'moving';
  }

  // Lights follow the lift state (works for peers whose state is synced from the authority too)
  _updateButtons(dt, playerLevel) {
    const here = this.phase === 'opening' || this.phase === 'closed' ? this.level : null;
    for (const [k, t] of this.lit) {
      const [kind, lv] = k.split(':');
      const arrived = lv === here && (kind === 'floor' || this.open > 0.6);
      if (arrived && t >= MIN_LIT) this.lit.delete(k); else this.lit.set(k, t + dt);
    }
    for (const b of this.p.buttons) {
      const lit = this.lit.has(key(b.action));
      b.glow += ((lit ? 1 : 0) - b.glow) * Math.min(1, dt * 14);
      b.faceMat.emissiveIntensity = b.glow * 2.4;
      b.capMat.emissiveIntensity = b.glow * 0.35;
      let off = 0;
      if (b.t >= 0) {
        b.t += dt;
        off = b.t >= PRESS_TIME ? 0 : PRESS_DEPTH * Math.sin(Math.PI * b.t / PRESS_TIME);
        if (b.t >= PRESS_TIME) b.t = -1;
      }
      b.mesh.position.z = -off;                     // local +z faces out of the plate
      b.mesh.userData.active = b.action.kind !== 'call' || b.action.level === playerLevel;
      b.mesh.userData.lit = lit;
    }
    this.p.display.show(this.phase === 'moving' && this.target
      ? `${STOPS.indexOf(this.target) > STOPS.indexOf(this.level) ? '▲' : '▼'}${glyphOf(nearest(this.y))}` : glyphOf(this.level));
  }
}

function key(a) { return a.kind === 'floor' || a.kind === 'call' ? `${a.kind}:${a.level}` : a.kind; }
function nearest(y) { let best = STOPS[0], d = Infinity; for (const lv of STOPS) { const dd = Math.abs(STOP_ELEV[lv] - y); if (dd < d) { d = dd; best = lv; } } return best; }
