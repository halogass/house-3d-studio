// One drivable car: its own scene group (not merged into the static furniture), a moving
// collider in physics.dynamic, and the pose the driving model / the network moves.
// Plan coords (x east, y north), yaw = heading clockwise from north (same as the player's yaw
// and the furniture `rot`), e = ground elevation under the car centre.
//
// Car-local frame (vehicles.js): +Z = nose, +X = LEFT side, +Y up. Indonesian cars are
// right-hand drive: the driver sits on the right (−X), the front passenger on the left (+X).
import * as THREE from 'three';
import { VEHICLES, carSpec } from '../interior/furniture/vehicles.js';

const DEG = Math.PI / 180;
const GLASS = 'lacquer:#10151a'; // vehicles.js: the (opaque) tinted glass

export class Car {
  constructor(def, { scene, physics, getMaterial }) {
    this.def = def;
    this.id = def.id;
    this.type = def.type;
    this.getMaterial = getMaterial;
    const sp = carSpec(def.type), P = def.params || {};
    const W = P.w ?? sp.W, L = P.d ?? sp.L, H = P.h ?? sp.H, sz = L / sp.L;
    this.hw = W / 2; this.hl = L / 2; this.H = H;
    this.axF = sp.axles[0].z * sz; this.axR = sp.axles[sp.axles.length - 1].z * sz;
    this.wb = Math.max(1.5, this.axF - this.axR);
    this.track = W * 0.82;
    this.seatZ = Math.max(-this.hl + 1.2, Math.min(this.hl - 1.4, this.axF - 1.45 * sz)); // front-seat hips
    this.seatX = this.hw * 0.42;  // |x| of the front seats
    this.sh = Math.min(0.3 * H + 0.02, H - 0.9); // hip height above the ground (head under the roof)
    // pose (the display pose for cars somebody else drives)
    this.x = def.x; this.y = def.y; this.e = def.elev; this.yaw = (def.rot || 0) * DEG;
    this.pitch = 0; this.roll = 0; this.steer = 0; this.v = 0; this.spin = 0;
    this.ts = 0;          // time stamp of the last network state applied (0 = never moved)
    this.net = null;      // last network state while a partner drives
    this.netAt = 0;
    this.driver = null;   // partner id driving it (null = parked / me)
    this.mine = null;     // 'driver' | 'passenger' while the local visitor is inside
    this.root = new THREE.Group();
    this.root.rotation.order = 'YXZ';
    this.root.name = 'car:' + def.id;
    scene.add(this.root);
    this.model = null; this.wheels = []; this.glass = null; this.glassMat = null;
    this.built = false; this.rigged = false;
    this.collider = { x: this.x, y: this.y, yaw: this.yaw, hl: this.hl - 0.03, hw: this.hw - 0.03, z0: this.e, z1: this.e + H, off: true, car: this };
    physics.dynamic.push(this.collider);
  }

  // The plain model (wheels merged into the body: fewer draw calls while parked)
  build() {
    if (this.built) return;
    this.setModel(false);
    this.built = true;
    this.collider.off = false;
    this.sync();
  }

  // Rebuild with separate wheel groups (spin + steer) the first time the car moves
  rig() {
    if (this.rigged) return;
    this.setModel(true);
    this.built = this.rigged = true;
    this.collider.off = false;
    this.sync();
  }

  setModel(rigged) {
    const P = this.def.params || {};
    const m = VEHICLES[this.type]({ ...P, y: undefined, wheels: rigged ? 'separate' : undefined }, this.getMaterial);
    if (this.model) {
      this.root.remove(this.model);
      this.model.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    }
    this.model = m;
    this.root.add(m);
    this.wheels = m.children.filter(c => c.name === 'wheel');
    for (const w of this.wheels) { w.rotation.order = 'YXZ'; w.userData.front = w.position.z > 0; w.userData.R = Math.max(0.2, w.position.y); }
    this.glass = m.children.find(c => c.isMesh && c.name === GLASS) || null;
    this.glassMat = this.glass ? this.glass.material : null;
    this.onModel?.(m);
  }

  // Tinted see-through glass while someone sits inside (so their avatar shows)
  setOccupied(on, tinted) {
    if (!this.glass) return;
    const m = on ? tinted : this.glassMat;
    if (this.glass.material !== m) this.glass.material = m;
  }

  // Plan point of a car-local offset (lx > 0 = left, lz > 0 = forward)
  local(lx, lz, out) {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    out.x = this.x + s * lz - c * lx;
    out.y = this.y + c * lz + s * lx;
    return out;
  }

  // Seat point: role 'driver' (right) or 'passenger' (left)
  seat(role, out) { return this.local(role === 'driver' ? -this.seatX : this.seatX, this.seatZ, out); }
  door(role, out) { return this.local(role === 'driver' ? -(this.hw + 0.55) : this.hw + 0.55, this.seatZ, out); }

  // Push the pose into the scene graph and the collider
  sync() {
    this.root.position.set(this.x, this.e, -this.y);
    this.root.rotation.set(-this.pitch, Math.PI - this.yaw, this.roll);
    const c = this.collider;
    c.x = this.x; c.y = this.y; c.yaw = this.yaw; c.z0 = this.e; c.z1 = this.e + this.H;
    for (const w of this.wheels) {
      w.rotation.x = this.spin;
      w.rotation.y = w.userData.front ? -this.steer : 0;
    }
  }
}
