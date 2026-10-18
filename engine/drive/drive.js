// Drivable cars: every car type item of the interior data (garage rooms, the carport area).
//
//   const drive = new Drive({ scene, camera, player, physics, getMaterial, multi, keys, touch, Z, vehicles, isTouch, defer })
//   drive.inCar             true while the visitor drives or rides
//   drive.target()          the car door in reach → { key, label, run } (for the Interact prompt)
//   drive.exit() / eject()  get out beside the door / leave the car where it is (teleports)
//   drive.drive(dt)         walk-mode frame while inside: input → car → player + 3rd-person camera
//   drive.tick(dt)          every frame: partners' cars, avatars in cars, colliders, culling
//   drive.seat()            seat slot for the multiplayer pose ({ id: 'car:<id>:d|p', kind: 'sit', h, yaw })
//   drive.attach(t)         multiplayer transport ('car' messages), drive.sendSnapshot() for newcomers
//   drive.stageLanded(lv)   staged build (phones): build that level's cars now
//
// Arcade model: bicycle steering, ±30 km/h on the site (12 km/h below grade: ramp & garage),
// hitting a collider stops the car (no bounce). The car follows the walk surfaces under its four
// wheels (ramps included) and pitches / rolls with them. Garage door & gates: calls
// window.__dh.doors.openNear(x, y, r) ahead of a moving car when that API exists.
import * as THREE from 'three';
import { LEVELS, LEVEL_ORDER } from '../config.js';
import { t } from '../i18n.js';
import { buildAvatar } from '../multi/avatar.js';
import { Car } from './car.js';
import { DriveUI } from './ui.js';

const KMH = 1 / 3.6;
const MAX_SITE = 30 * KMH, MAX_SLOW = 12 * KMH, MAX_REV = 10 * KMH;
const ACCEL = 3.2, BRAKE = 9, ROLL = 1.4, HANDBRAKE = 12;
const MAX_STEER = 34 * Math.PI / 180;
const STEP_UP = 0.3, DROP = 0.55; // m a wheel may climb / drop between frames
const CELL = 4;                    // physics.js grid cell
const NET_HZ = 15;
const tmp = { x: 0, y: 0 }, tmp2 = { x: 0, y: 0 };
const EMPTY = { s: [], c: [] };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Drive {
  constructor(app) {
    this.app = app;
    const { scene, physics, getMaterial, vehicles = [], Z } = app;
    this.P = physics;
    this.cars = vehicles.map(def => new Car(def, { scene, physics, getMaterial }));
    this.byId = new Map(this.cars.map(c => [c.id, c]));
    for (const c of this.cars) c.onModel = (m) => app.onModel?.(m);
    this.car = null; this.role = null;
    this.ui = new DriveUI({ isTouch: app.isTouch });
    this.tinted = new THREE.MeshStandardMaterial({ color: 0x1a232b, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.45, depthWrite: false });
    this.tinted.userData.noShadow = true;
    // Rooms a car may not enter (everything but the garage zone), per level
    this.noGo = {};
    for (const lv of LEVEL_ORDER) this.noGo[lv] = (Z.floors[lv] || []).filter(r => r.zone !== 'garage' && r.use !== 'garage').map(r => r.r);
    this.eval = { e: 0, pitch: 0, roll: 0, why: '' };
    this.cam = { yaw: 0, pitch: 0.32, dist: 7, off: 0, offP: 0, idle: 0, lastYaw: 0, lastPitch: 0 };
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3();
    this.sendClock = 0; this.doorClock = 0;
    this.t = null;
    this.avatar = null;
    this.buildQueue = [];
    this.buildClock = 0;
    // Desktop (sync build): every car now. Phones: when their level's stage lands.
    if (!app.defer) for (const c of this.cars) this.buildCar(c);
  }

  get inCar() { return !!this.role; }

  buildCar(c) { c.build(); this.settle(c); c.sync(); }

  stageLanded(id) {
    for (const c of this.cars) if (!c.built && c.def.lv === id && !this.buildQueue.includes(c)) this.buildQueue.push(c);
  }

  // Sit a car on the ground under its wheels (spawn / after a network jump)
  settle(c) {
    if (this.evaluate(c, c.x, c.y, c.yaw, c.e + 0.5, true)) { c.e = this.eval.e; c.pitch = this.eval.pitch; c.roll = this.eval.roll; }
  }

  // ------------------------------------------------------------ collision / ground
  // Can car c stand at (x, y, yaw) starting from elevation e? Fills this.eval (e, pitch, roll).
  // groundOnly: skip the colliders (spawn, or when it already overlaps something).
  evaluate(c, x, y, yaw, e, groundOnly = false) {
    const s = Math.sin(yaw), co = Math.cos(yaw);
    let hFL, hFR, hRL, hRR;
    for (let i = 0; i < 4; i++) {
      const lz = i < 2 ? c.axF : c.axR, lx = (i % 2 ? -1 : 1) * c.track / 2;
      const px = x + s * lz - co * lx, py = y + co * lz + s * lx;
      const h = this.ground(px, py, e);
      if (h === null) { this.eval.why = 'ground'; return false; }
      if (i === 0) hFL = h; else if (i === 1) hFR = h; else if (i === 2) hRL = h; else hRR = h;
    }
    const ne = (hFL + hFR + hRL + hRR) / 4;
    this.eval.e = ne;
    this.eval.pitch = Math.atan2((hFL + hFR - hRL - hRR) / 2, c.axF - c.axR);
    this.eval.roll = Math.atan2((hFL + hRL - hFR - hRR) / 2, c.track);
    if (groundOnly) return true;
    if (this.hits(c, x, y, s, co, ne)) { this.eval.why = 'hit'; return false; }
    if (this.inNoGo(c, x, y, s, co, ne)) { this.eval.why = 'room'; return false; }
    return true;
  }

  // Highest walk surface at (x, y) a wheel at elevation e can roll onto, or null (wall of a
  // step / kerb too high, a drop, or nothing there). No allocations.
  ground(x, y, e) {
    const P = this.P, cell = P.cell(x, y);
    this._sup = -Infinity; this._blk = false;
    if (cell) this.groundIn(cell.s, x, y, e);
    this.groundIn(P.globalSurfaces, x, y, e);
    if (this._blk || this._sup === -Infinity || this._sup < e - DROP) return null;
    return this._sup;
  }
  groundIn(list, x, y, e) {
    for (const sf of list) {
      const h = this.P.heightAt(sf, x, y);
      if (h === null) continue;
      if (h <= e + STEP_UP) { if (h > this._sup) this._sup = h; } else if (h < e + 1.4) this._blk = true;
    }
  }

  // Oriented car box vs the static colliders (SAT) and the other cars
  hits(c, x, y, s, co, e) {
    const P = this.P, hl = c.hl - 0.02, hw = c.hw - 0.02;
    const as = Math.abs(s), ac = Math.abs(co);
    const ex = as * hl + ac * hw, ey = ac * hl + as * hw;
    const z0 = e + 0.22, z1 = e + c.H;
    const i0 = Math.floor((x - ex) / CELL), i1 = Math.floor((x + ex) / CELL);
    const j0 = Math.floor((y - ey) / CELL), j1 = Math.floor((y + ey) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const cell = P.grid.get(i + ',' + j);
      if (!cell) continue;
      for (const b of cell.c) {
        if (b.off || b.z1 <= z0 || b.z0 >= z1) continue;
        const bex = (b.x1 - b.x0) / 2, bey = (b.y1 - b.y0) / 2;
        const dx = x - (b.x0 + bex), dy = y - (b.y0 + bey);
        if (Math.abs(dx) >= ex + bex || Math.abs(dy) >= ey + bey) continue;
        if (Math.abs(dx * s + dy * co) >= hl + bex * as + bey * ac) continue;
        if (Math.abs(dx * co - dy * s) >= hw + bex * ac + bey * as) continue;
        return true;
      }
    }
    for (const d of P.dynamic) {
      if (d === c.collider || d.off || d.z1 <= z0 || d.z0 >= z1) continue;
      const ds = Math.sin(d.yaw), dc = Math.cos(d.yaw);
      const dx = x - d.x, dy = y - d.y;
      if (Math.hypot(dx, dy) > c.hl + d.hl + c.hw + d.hw) continue;
      // axes: this car's forward / right, the other's forward / right
      let sep = false;
      for (let k = 0; k < 4 && !sep; k++) {
        const ax = k === 0 ? s : k === 1 ? co : k === 2 ? ds : dc;
        const ay = k === 0 ? co : k === 1 ? -s : k === 2 ? dc : -ds;
        const ra = hl * Math.abs(s * ax + co * ay) + hw * Math.abs(co * ax - s * ay);
        const rb = d.hl * Math.abs(ds * ax + dc * ay) + d.hw * Math.abs(dc * ax - ds * ay);
        if (Math.abs(dx * ax + dy * ay) >= ra + rb) sep = true;
      }
      if (!sep) return true;
    }
    return false;
  }

  // The car's corners inside a room of the house (other than the garage)
  inNoGo(c, x, y, s, co, e) {
    let lv = null;
    for (const id of LEVEL_ORDER) if (e >= LEVELS[id].elev - 0.6) lv = id;
    const rooms = this.noGo[lv || LEVEL_ORDER[0]] || [];
    if (!rooms.length) return false;
    for (let k = 0; k < 5; k++) {
      const lz = k === 4 ? 0 : (k < 2 ? 1 : -1) * (c.hl - 0.1), lx = k === 4 ? 0 : (k % 2 ? -1 : 1) * (c.hw - 0.1);
      const px = x + s * lz - co * lx, py = y + co * lz + s * lx;
      for (const r of rooms) if (px > r[0] + 0.05 && px < r[2] - 0.05 && py > r[1] + 0.05 && py < r[3] - 0.05) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ getting in / out
  target() {
    if (this.role) return null;
    const p = this.app.player;
    let best = null, bd = 1.5;
    for (const c of this.cars) {
      if (!c.built || Math.abs(c.e - p.e) > 1.2) continue;
      if (Math.abs(c.x - p.x) > c.hl + 3 || Math.abs(c.y - p.y) > c.hl + 3) continue;
      const busyDrv = this.partnerIn(c, 'd'), busyPas = this.partnerIn(c, 'p');
      if (!busyDrv) { c.door('driver', tmp); const d = Math.hypot(tmp.x - p.x, tmp.y - p.y); if (d < bd) { bd = d; best = c.tDriver ||= { key: c.id + ':d', label: t('driver'), run: () => this.enter(c, 'driver') }; } }
      if (!busyPas) { c.door('passenger', tmp); const d = Math.hypot(tmp.x - p.x, tmp.y - p.y); if (d < bd) { bd = d; best = c.tPass ||= { key: c.id + ':p', label: t('passenger'), run: () => this.enter(c, 'passenger') }; } }
    }
    return best;
  }

  // A partner sits in car c's seat ('d' driver / 'p' passenger)
  partnerIn(c, k) {
    if (k === 'd' && c.driver && performance.now() - c.netAt < 3000) return true;
    const m = this.app.multi;
    if (!m?.active) return false;
    const id = 'car:' + c.id + ':' + k, now = performance.now();
    for (const q of m.peers.values()) if (q.target?.seat === id && now - q.last < 3000) return true;
    return false;
  }

  enter(c, role) {
    const p = this.app.player;
    this.car = c; this.role = role; c.mine = role;
    if (role === 'driver') { c.rig(); c.v = 0; c.driver = null; }
    this.cam.yaw = c.yaw; this.cam.off = 0; this.cam.offP = 0; this.cam.pitch = 0.32; this.cam.dist = this.camDist(c);
    this.cam.lastYaw = p.yaw = c.yaw; this.cam.lastPitch = p.pitch = 0;
    this.camSnap = true;
    this.ui.show(role, true);
    this.syncPlayer();
    if (role === 'driver') this.send(true);
    return true;
  }

  exit() {
    const c = this.car;
    if (!c) return;
    const p = this.app.player, P = this.P;
    // beside my door first, then the other side, front, back, a bit further out
    const role = this.role;
    const tries = [[role === 'driver' ? -1 : 1, 0], [role === 'driver' ? 1 : -1, 0], [0, 1], [0, -1]];
    let spot = null;
    for (const extra of [0, 0.6, 1.4]) {
      for (const [sx, sz] of tries) {
        for (const dz of sz ? [0] : [0, 0.8, -0.8]) {
          const lx = sx ? sx * (c.hw + 0.5 + extra) : 0, lz = sz ? sz * (c.hl + 0.5 + extra) : c.seatZ + dz;
          c.local(lx, lz, tmp);
          const e = P.landingAt(tmp.x, tmp.y, c.e + 0.2);
          if (e !== null && Math.abs(e - c.e) < 0.6 && P.canStand(tmp.x, tmp.y, e)) { spot = { x: tmp.x, y: tmp.y, e }; break; }
        }
        if (spot) break;
      }
      if (spot) break;
    }
    this.leave();
    if (!spot) { c.seat(role, tmp); spot = { x: tmp.x, y: tmp.y, e: c.e }; } // nowhere free: stay put beside the seat
    Object.assign(p, { x: spot.x, y: spot.y, e: spot.e, vy: 0, grounded: true, yaw: c.yaw, pitch: 0 });
  }

  // Leave the car where it is (teleport, or after exit() picked a spot)
  eject() { if (this.car) this.leave(); }

  leave() {
    const c = this.car, role = this.role;
    c.mine = null;
    if (role === 'driver') { c.v = 0; c.steer *= 0.5; c.ts = Date.now(); this.send(true, true); }
    this.car = null; this.role = null;
    this.ui.show(null);
    if (this.avatar) this.avatar.visible = false;
  }

  camDist(c) { return 2.4 * c.hl + 1.6; }

  // ------------------------------------------------------------ per frame (inside)
  drive(dt) {
    const c = this.car, p = this.app.player;
    // Mouse / touch look moved player.yaw / pitch since last frame: that orbits the camera
    const dy = wrap(p.yaw - this.cam.lastYaw), dp = p.pitch - this.cam.lastPitch;
    if (dy || dp) { this.cam.off = Math.max(-2.6, Math.min(2.6, this.cam.off + dy)); this.cam.offP -= dp; this.cam.idle = 0; }
    else this.cam.idle += dt;
    if (this.role === 'driver') this.simulate(c, dt);
    this.syncPlayer();
    this.camera(c, dt);
  }

  simulate(c, dt) {
    const k = this.app.keys, ui = this.ui, t = this.app.touch;
    let thr = 0, st = 0;
    if (k.has('KeyW') || k.has('ArrowUp') || ui.gas) thr += 1;
    if (k.has('KeyS') || k.has('ArrowDown') || ui.brake) thr -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) st += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) st -= 1;
    st = Math.max(-1, Math.min(1, st + (t?.mx || 0)));
    const hand = k.has('Space') || ui.hand;
    const slow = c.e < -0.3; // ramp & garage
    const vmax = slow ? MAX_SLOW : MAX_SITE;
    let v = c.v;
    if (hand) v = approach(v, 0, HANDBRAKE * dt);
    else if (thr > 0) v = v < -0.05 ? approach(v, 0, BRAKE * dt) : Math.min(vmax, v + ACCEL * (1 - 0.6 * Math.max(0, v) / vmax) * dt);
    else if (thr < 0) v = v > 0.05 ? approach(v, 0, BRAKE * dt) : Math.max(-MAX_REV, v - 2.2 * dt);
    else v = approach(v, 0, ROLL * dt);
    if (v > vmax) v = approach(v, vmax, 4 * dt);
    // gravity on the ramp: a parked car doesn't roll, a moving one feels the slope a little
    if (thr === 0 && !hand && Math.abs(v) > 0.3) v -= Math.sin(c.pitch) * 2 * dt;
    // steering: slower at speed, eases back to centre
    const steerTarget = st * MAX_STEER * (1 - 0.45 * Math.min(1, Math.max(0, Math.abs(v) - 4) / (MAX_SITE - 4)));
    c.steer += (steerTarget - c.steer) * Math.min(1, dt * (st ? 5 : 7));
    c.v = v;
    // Garage doors / automatic gates: poke what's ahead (also while held up at a closed door: the
    // door's collider blocks until it is ~2/3 open, the car just waits)
    this.doorClock += dt;
    if (this.doorClock > 0.1 && (thr !== 0 || Math.abs(v) > 0.2)) {
      this.doorClock = 0;
      const doors = window.__dh?.doors;
      if (typeof doors?.openNear === 'function') {
        const dir = Math.abs(v) > 0.2 ? Math.sign(v) : Math.sign(thr);
        c.local(0, dir * (c.hl + 3.5), tmp2);
        try { doors.openNear(tmp2.x, tmp2.y, 4.5, { e: c.e }); } catch (e) { /* their API */ }
      }
    }
    if (Math.abs(v) < 1e-3) { c.v = 0; c.sync(); this.sendTick(dt); return; }

    const yawRate = v * Math.tan(c.steer) / c.wb;
    this._yr = yawRate;
    let moved = this.tryMove(c, dt, 1);
    if (!moved) {
      // Already overlapping something (spawned against a wall, a partner parked into us):
      // let it move out on the ground alone
      const why = this.eval.why;
      if (why !== 'ground' && !this.evaluate(c, c.x, c.y, c.yaw, c.e)) {
        const nyaw = c.yaw + yawRate * dt, nx = c.x + Math.sin(nyaw) * v * dt, ny = c.y + Math.cos(nyaw) * v * dt;
        if (this.evaluate(c, nx, ny, nyaw, c.e, true)) { c.x = nx; c.y = ny; c.yaw = wrap(nyaw); moved = true; }
      }
      if (!moved) {
        // creep up to the obstacle, then stop dead
        if (this.tryMove(c, dt, 0.5) || this.tryMove(c, dt, 0.25)) moved = true;
        c.v = 0;
      }
    }
    // ground follow (smoothed so steps & the ramp lip don't jolt)
    const kk = Math.min(1, dt * 12);
    if (moved || this.evaluate(c, c.x, c.y, c.yaw, c.e, true)) {
      c.e += (this.eval.e - c.e) * Math.min(1, dt * 20);
      if (Math.abs(this.eval.e - c.e) > 0.25) c.e = this.eval.e;
      c.pitch += (this.eval.pitch - c.pitch) * kk;
      c.roll += (this.eval.roll - c.roll) * kk;
    }
    c.spin = (c.spin + (moved ? v : 0) * dt / 0.33) % (Math.PI * 2);
    c.sync();
    this.sendTick(dt);
  }

  tryMove(c, dt, f) {
    const v = c.v, nyaw = c.yaw + this._yr * dt * f, my = c.yaw + this._yr * dt * f * 0.5;
    const nx = c.x + Math.sin(my) * v * dt * f, ny = c.y + Math.cos(my) * v * dt * f;
    if (!this.evaluate(c, nx, ny, nyaw, c.e)) return false;
    c.x = nx; c.y = ny; c.yaw = wrap(nyaw);
    return true;
  }

  // player.x/y/e/yaw follow the seat, so the minimap, level / room label, staged loading,
  // door & gate proximity and multiplayer keep working
  syncPlayer() {
    const c = this.car, p = this.app.player;
    c.seat(this.role, tmp);
    p.x = tmp.x; p.y = tmp.y; p.e = c.e; p.vy = 0; p.grounded = true;
    p.yaw = c.yaw; p.pitch = 0;
    this.cam.lastYaw = p.yaw; this.cam.lastPitch = 0;
  }

  // Chase camera: behind & above, smooth, orbit with the mouse / right-thumb drag; pulled in
  // when a wall or a slab is in the way
  camera(c, dt) {
    const cam = this.cam;
    if (cam.idle > 1.6 && Math.abs(c.v) > 1) cam.off *= Math.exp(-dt * 1.5);
    let pitch = Math.max(0.06, Math.min(1.1, 0.32 + cam.offP));
    cam.offP = pitch - 0.32;
    const snap = this.camSnap ? 1 : 0;
    cam.yaw += wrap(c.yaw + cam.off - cam.yaw) * (snap || Math.min(1, dt * 5));
    const lx = c.x, ly = c.y, lz = c.e + c.H * 0.8;
    const fx = Math.sin(cam.yaw), fy = Math.cos(cam.yaw);
    const full = this.camDist(c);
    // march out until something blocks the view; boxed in (a garage wall right behind), look
    // down over the roof from higher up instead
    let free = this.freeDist(lx, ly, lz, fx, fy, pitch, full);
    if (free < 0.6 * full) {
      const hp = Math.max(pitch, 0.85), f2 = this.freeDist(lx, ly, lz, fx, fy, hp, full);
      if (f2 > free + 0.5) { free = f2; pitch = hp; }
    }
    cam.pitch += (pitch - cam.pitch) * (snap || Math.min(1, dt * 6));
    // pulled in at once (never through a wall), eased back out
    const now = this.freeDist(lx, ly, lz, fx, fy, cam.pitch, full);
    if (now < cam.dist || snap) cam.dist = now;
    else cam.dist = Math.min(now, cam.dist + dt * 3);
    this.camSnap = false;
    const d = cam.dist, ch = Math.cos(cam.pitch), cv = Math.sin(cam.pitch);
    this.camPos.set(lx - fx * d * ch, lz + d * cv, -(ly - fy * d * ch));
    this.camLook.set(lx + fx * 1.2, lz - 0.1, -(ly + fy * 1.2));
    const camera = this.app.camera;
    camera.position.copy(this.camPos);
    camera.lookAt(this.camLook);
  }

  freeDist(lx, ly, lz, fx, fy, pitch, full) {
    const hc = Math.cos(pitch), vs = Math.sin(pitch);
    for (let d = 0.6; d <= full; d += 0.3) {
      if (this.viewBlocked(lx - fx * d * hc, ly - fy * d * hc, lz + d * vs, lz)) return Math.max(0.8, d - 0.45);
    }
    return full;
  }

  // A wall collider at the point, or a floor / slab between the car's roof and the point
  viewBlocked(x, y, z, z0) {
    const P = this.P, cell = P.cell(x, y) || EMPTY;
    for (const b of cell.c) {
      if (b.off || z < b.z0 - 0.15 || z > b.z1 + 0.15) continue;
      if (x > b.x0 - 0.2 && x < b.x1 + 0.2 && y > b.y0 - 0.2 && y < b.y1 + 0.2) return true;
    }
    for (const s of cell.s) {
      const h = P.heightAt(s, x, y);
      if (h !== null && h > z0 + 0.2 && h < z + 0.35) return true;
    }
    for (const s of P.globalSurfaces) { // the site ground over the basement
      const h = P.heightAt(s, x, y);
      if (h !== null && h > z0 + 0.2 && h < z + 0.35) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ every frame
  tick(dt) {
    const now = performance.now(), p = this.app.player;
    // phones: build one queued car at a time, spaced out
    this.buildClock -= dt;
    if (this.buildQueue.length && this.buildClock <= 0) { this.buildCar(this.buildQueue.shift()); this.buildClock = 0.35; }

    // cars a partner drives: ease towards the last state they sent
    const k = 1 - Math.exp(-dt * 10);
    let moved = false;
    for (const c of this.cars) {
      const n = c.net;
      if (!n || c.mine === 'driver' || !c.built) continue;
      if (c.driver && now - c.netAt > 3000) c.driver = null; // driver vanished: parked where it is
      const ox = c.x, oy = c.y;
      const far = Math.hypot(n.x - c.x, n.y - c.y) > 15;
      const f = far ? 1 : k;
      c.x += (n.x - c.x) * f; c.y += (n.y - c.y) * f; c.e += (n.e - c.e) * f;
      c.yaw = wrap(c.yaw + wrap(n.yaw - c.yaw) * f);
      c.pitch += ((n.p || 0) - c.pitch) * f; c.roll += ((n.r || 0) - c.roll) * f; c.steer += ((n.st || 0) - c.steer) * f;
      const fwd = (c.x - ox) * Math.sin(c.yaw) + (c.y - oy) * Math.cos(c.yaw);
      if (Math.abs(fwd) > 1e-4) { c.spin = (c.spin + fwd / 0.33) % (Math.PI * 2); moved = true; }
      c.sync();
      if (!c.driver && Math.hypot(n.x - c.x, n.y - c.y) < 0.002 && Math.abs(wrap(n.yaw - c.yaw)) < 0.001) c.net = null; // parked & arrived
    }
    if (this.car && this.role === 'driver') moved = moved || Math.abs(this.car.v) > 0;

    // a car rolled onto the walking visitor: step them out of the way
    if (moved && !this.role && this.P.hitsDynamic(p.x, p.y, p.e + 0.3, p.e + 1.75)) this.unstick();

    // avatars in cars: partners' (from their seat id) and mine
    const m = this.app.multi;
    for (const c of this.cars) c._occ = !!c.mine;
    if (m?.active) for (const q of m.peers.values()) {
      const sid = q.target?.seat;
      if (!sid || !sid.startsWith('car:') || now - q.last > 3000) continue;
      const role = sid.endsWith(':d') ? 'driver' : 'passenger';
      const c = this.byId.get(sid.slice(4, -2));
      if (!c) continue;
      c._occ = true;
      this.placeAvatar(q.avatar, c, role);
    }
    if (this.role && typeof document !== 'undefined') {
      if (!this.avatar) this.makeAvatar();
      this.avatar.visible = true;
      this.placeAvatar(this.avatar, this.car, this.role);
    }
    // see-through glass while occupied; cars under ground hidden from up top (phones)
    const above = p.e > -1.2;
    for (const c of this.cars) {
      if (!c.built) continue;
      c.setOccupied(c._occ, this.tinted);
      c.root.visible = !(above && c.e < -1.5 && Math.hypot(c.x - p.x, c.y - p.y) > 28) && Math.hypot(c.x - p.x, c.y - p.y) < 160;
    }
    this.ui.speed(this.car ? Math.abs(this.car.v) / KMH : 0);
  }

  placeAvatar(av, c, role) {
    c.seat(role, tmp);
    const fx = Math.sin(c.yaw), fy = Math.cos(c.yaw);
    av.userData.setPose?.('sit');
    av.position.set(tmp.x - fx * 0.05, c.e + c.sh - 0.86, -(tmp.y - fy * 0.05));
    av.rotation.set(c.pitch, -c.yaw, 0, 'YXZ');
  }

  makeAvatar() {
    let color = '#b5532f';
    try { color = this.app.multi?.me?.color || localStorage.getItem('h3s-color') || color; } catch (e) { /* storage blocked */ }
    this.avatar = buildAvatar('', color);
    this.avatar.traverse(o => { if (o.isSprite) o.visible = false; });
    this.avatar.userData.setPose('sit');
    this.app.scene.add(this.avatar);
  }

  unstick() {
    const p = this.app.player, P = this.P;
    for (let r = 0.3; r <= 4; r += 0.3) for (let k = 0; k < 16; k++) {
      const x = p.x + Math.cos(k * Math.PI / 8) * r, y = p.y + Math.sin(k * Math.PI / 8) * r;
      const e = P.landingAt(x, y, p.e);
      if (e !== null && Math.abs(e - p.e) < 0.5 && P.canStand(x, y, e)) { Object.assign(p, { x, y, e, vy: 0 }); return; }
    }
  }

  // Seat for the multiplayer pose
  seat() {
    if (!this.role) return null;
    const c = this.car;
    if (!this._seat || this._seat.car !== c || this._seat.role !== this.role) this._seat = { id: 'car:' + c.id + ':' + (this.role === 'driver' ? 'd' : 'p'), kind: 'sit', h: c.sh, yaw: 0, car: c, role: this.role };
    this._seat.yaw = c.yaw;
    return this._seat;
  }

  // ------------------------------------------------------------ multiplayer
  attach(t) {
    this.t = t;
    t.on('car', (d, from) => this.onNet(d, from));
    this.sendSnapshot();
  }

  sendTick(dt) {
    this.sendClock += dt;
    if (this.sendClock >= 1 / NET_HZ) { this.sendClock = 0; this.send(false); }
  }

  send(force, parked = false) {
    const m = this.app.multi;
    if (!m?.active || !this.t) return;
    const c = this.car;
    if (!c) return;
    c.ts = Date.now();
    this.t.send('car', this.state(c, parked ? null : m.me.id));
  }

  state(c, driver) {
    return { id: c.id, x: +c.x.toFixed(3), y: +c.y.toFixed(3), e: +c.e.toFixed(3), yaw: +c.yaw.toFixed(4), p: +c.pitch.toFixed(4), r: +c.roll.toFixed(4), st: +c.steer.toFixed(3), v: +c.v.toFixed(2), d: driver, ts: c.ts };
  }

  // Newcomers get every car that has moved from its spot
  sendSnapshot() {
    const m = this.app.multi;
    if (!m?.active || !this.t) return;
    for (const c of this.cars) {
      if (c.mine === 'driver') { this.send(true); continue; }
      if (c.ts && !c.driver) this.t.send('car', { ...this.state(c, null), snap: true });
    }
  }

  onNet(d, from) {
    const c = this.byId.get(d.id);
    if (!c) return;
    if (c.mine === 'driver') return;            // I'm driving it: mine wins
    if (d.snap && d.ts <= c.ts) return;          // old news
    if (d.ts) c.ts = Math.max(c.ts, d.ts);
    c.net = d; c.netAt = performance.now();
    c.driver = d.d || null;
    if (!c.built) c.build();
    if (c.driver && !c.rigged) c.rig();
    // A passenger's camera rides along: nothing else to do, drive() follows c each frame
  }
}

function approach(v, to, step) { return v < to ? Math.min(to, v + step) : Math.max(to, v - step); }
