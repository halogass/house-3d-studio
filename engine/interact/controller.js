// Contextual interaction in walk mode: sit / lie on furniture, press lift buttons, open / close doors.
// Each frame it picks the best target near the player and shows a prompt (E / R on a keyboard,
// round buttons on touch screens). While seated the player is pinned to the seat slot.
import * as THREE from 'three';
import { t as tt } from '../i18n.js';

const REACH = 1.5;        // m from the player to a seat slot
const BUTTON_REACH = 2.2; // m from the eye to a lift button
const SIT_EYE = 0.72, LIE_EYE = 0.2;

export class Interact {
  // app: { seats, player, physics, camera, lift, currentLevel, occupied: () => Set, onCallLift, nearLiftDoor }
  constructor(app) {
    this.app = app;
    this.seated = null;     // { slot, from: { x, y, e } }
    this.target = null;     // { kind: 'seat', sit, lie } | { kind: 'button', obj }
    this.el = document.getElementById('interact');
    this.cross = document.getElementById('crosshair');
    this.ray = new THREE.Raycaster();
    this.key = '';
    this.byLevel = new Map();
    this.indexSeats(app.seats);
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) this.act(b.dataset.act);
    });
  }

  // Seats that arrived later (staged build): they must already be in app.seats
  indexSeats(list) {
    for (const s of list) {
      if (!this.byLevel.has(s.level)) this.byLevel.set(s.level, []);
      this.byLevel.get(s.level).push(s);
    }
  }

  // The slot the player is using (for multiplayer), or null
  seat() { return this.seated ? this.seated.slot : null; }

  // ---------------------------------------------------------------- actions
  act(a) {
    const veh = this.app.vehicle; // engine/drive: E gets in (driver / passenger) and out of the cars
    if (veh?.inside()) { if (a === 'E' || a === 'exit') veh.exit(); return true; }
    if (a === 'E' && this.target?.kind === 'vehicle') { this.target.run(); return true; }
    if (this.seated) { if (a === 'stand' || a === 'E') this.stand(); return true; }
    const t = this.target;
    // doors (engine/doors.js): E, a click on the door (press) or the touch button (door) opens / closes it
    if (t?.kind === 'door' && (a === 'E' || a === 'press' || a === 'door')) { this.app.doors.toggle(t.door); return true; }
    if (a === 'E') {
      if (t?.kind === 'button') { this.app.lift.press?.(t.obj.userData.liftAction); return true; }
      if (t?.kind === 'seat' && t.sit) return this.sitOn(t.sit);
      if (this.app.nearLiftDoor()) { this.app.onCallLift(); return true; }
      return false;
    }
    if (a === 'R' && t?.kind === 'seat' && t.lie) return this.sitOn(t.lie);
    if (a === 'press' && t?.kind === 'button') { this.app.lift.press?.(t.obj.userData.liftAction); return true; }
    return false;
  }

  sitOn(slot) {
    const p = this.app.player;
    this.seated = { slot, from: { x: p.x, y: p.y, e: p.e } };
    Object.assign(p, { x: slot.x, y: slot.y, e: slot.e, vy: 0, grounded: true, yaw: slot.yaw, pitch: slot.kind === 'lie' ? 1.05 : -0.05 });
    this.render();
    return true;
  }

  stand() {
    const { slot, from } = this.seated;
    const p = this.app.player, ph = this.app.physics;
    this.seated = null;
    // Prefer the space in front of the seat; fall back to where we came from
    const e = ph.landingAt(slot.stand[0], slot.stand[1], slot.e);
    const free = e !== null && Math.abs(e - slot.e) < 0.3 && !ph.collides(slot.stand[0], slot.stand[1], e);
    if (free) Object.assign(p, { x: slot.stand[0], y: slot.stand[1], e });
    else Object.assign(p, { x: from.x, y: from.y, e: from.e });
    Object.assign(p, { vy: 0, grounded: true, pitch: 0 });
    this.render();
  }

  // Camera eye height above player.e
  eye(standing) {
    if (!this.seated) return standing;
    const s = this.seated.slot;
    return s.h + (s.kind === 'lie' ? LIE_EYE : SIT_EYE);
  }

  // ---------------------------------------------------------------- per frame
  update(walk) {
    if (!walk) { this.setTarget(null); return; }
    if (this.seated) { this.setTarget(null); return; }
    if (this.app.vehicle?.inside()) { this.setTarget({ kind: 'inCar' }); return; }
    const { player: p, camera, lift } = this.app;

    // 1. lift button under the crosshair
    let target = null;
    const clickables = lift.clickables || [];
    if (clickables.length) {
      this.ray.setFromCamera({ x: 0, y: 0 }, camera);
      this.ray.far = BUTTON_REACH;
      const hit = this.ray.intersectObjects(clickables.filter(o => o.userData.active !== false), true)[0];
      if (hit) target = { kind: 'button', obj: hit.object };
    }
    // 1b. a car door (driver / passenger)
    if (!target) { const v = this.app.vehicle?.target(); if (v) target = { kind: 'vehicle', ...v }; }
    // 1c. a door the player is looking at
    const doors = this.app.doors;
    if (!target && doors) { const d = doors.pick(p, this.app.currentLevel(), true); if (d) target = { kind: 'door', door: d }; }

    // 2. nearest free sit and lie slots in front of the player (they may be different pieces,
    //    e.g. the bench at the foot of a bed and the bed itself)
    if (!target) {
      const lv = this.app.currentLevel();
      const busy = this.app.occupied();
      const fx = Math.sin(p.yaw), fy = Math.cos(p.yaw);
      const best = { sit: null, lie: null }, score = { sit: Infinity, lie: Infinity };
      for (const s of this.byLevel.get(lv) || []) {
        if (Math.abs(s.e - p.e) > 0.6 || busy.has(s.id)) continue;
        // beds count from their edge, everything else from the seat point
        const ax = s.r ? s.cx : s.x, ay = s.r ? s.cy : s.y;
        const dx = ax - p.x, dy = ay - p.y, dc = Math.hypot(dx, dy), d = Math.max(0, dc - (s.r || 0));
        if (d > REACH) continue;
        const ahead = dc > 0.01 ? (dx * fx + dy * fy) / dc : 1;
        if (ahead < -0.2) continue;
        // among a bed's slots prefer the closer one
        const sc = d - 0.5 * ahead + 0.05 * Math.hypot(s.x - p.x, s.y - p.y);
        if (sc < score[s.kind]) { score[s.kind] = sc; best[s.kind] = s; }
      }
      if (best.sit || best.lie) target = { kind: 'seat', sit: best.sit, lie: best.lie, piece: '' };
    }
    // 3. any door within reach, roughly ahead
    if (!target && doors) { const d = doors.pick(p, this.app.currentLevel(), false); if (d) target = { kind: 'door', door: d }; }
    this.setTarget(target);
  }

  setTarget(t) {
    const key = !t ? (this.seated ? 'seated' : '') : t.kind === 'inCar' ? 'inCar' : t.kind === 'vehicle' ? 'v:' + t.key : t.kind === 'button' ? 'b:' + t.obj.uuid : t.kind === 'door' ? 'd:' + t.door.id + ':' + t.door.target : 's:' + t.piece + (t.sit?.id || '') + (t.lie?.id || '');
    this.target = t;
    if (key === this.key) return;
    this.key = key;
    this.render();
  }

  render() {
    const t = this.target, btn = (act, k, label) => `<button data-act="${act}"><kbd>${k}</kbd>${label}</button>`;
    let html = '';
    if (this.seated) html = btn('stand', 'E', tt('stand'));
    else if (t?.kind === 'inCar') html = btn('exit', 'E', tt('exit'));
    else if (t?.kind === 'vehicle') html = btn('E', 'E', t.label);
    else if (t?.kind === 'button') html = btn('press', 'E', t.obj.userData.label || tt('press'));
    else if (t?.kind === 'door') html = btn('door', 'E', this.app.doors.label(t.door));
    else if (t?.kind === 'seat') html = (t.sit ? btn('E', 'E', tt('sit')) : '') + (t.lie ? btn('R', 'R', tt('lie')) : '');
    this.el.innerHTML = html;
    this.el.classList.toggle('hidden', !html);
    this.cross.classList.toggle('target', t?.kind === 'button' || t?.kind === 'door');
  }
}
