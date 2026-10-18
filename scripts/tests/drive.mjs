// Drivable cars (engine/drive): every car of the interior data is parked on the ground and blocks
// walking; the first car reverses / drives out of its spot, through the (automatic) gate onto the
// street, and stops dead when driven into the house. Exits land on free ground.
import { buildHeadless } from '../lib/headless.mjs';

const { THREE, P: physics, built, Z, mat, config } = await buildHeadless({ dynamicDoors: true });
const { Drive } = await import('../../engine/drive/drive.js');
const { Doors } = await import('../../engine/doors.js');
const doors = new Doors({ groups: built.groups, physics, getMaterial: () => mat });
globalThis.__dh = { doors }; // engine/drive pokes doors and gates ahead of a moving car
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
const player = { x: 0, y: 0, e: 0, vy: 0, grounded: true, yaw: 0, pitch: 0 };
const keys = new Set(), touch = { mx: 0, my: 0 };
const drive = new Drive({ scene, camera, player, physics, getMaterial: () => mat, multi: null, keys, touch, Z, vehicles: built.vehicles, isTouch: false });

const fails = [];
const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) fails.push(msg); };
const DT = 1 / 60;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
if (!drive.cars.length) { console.log('no cars in this project: nothing to test'); process.exit(0); }

for (const c of drive.cars) {
  const ok = drive.evaluate(c, c.x, c.y, c.yaw, c.e);
  check(ok || drive.eval.why !== 'ground', `${c.id} parked on the ground at (${c.x}, ${c.y})${ok ? '' : ' — ' + drive.eval.why}`);
  check(physics.collides(c.x, c.y, c.e), `${c.id} blocks walking`);
}

// drive to waypoints with pure pursuit (forward, or ['R', x, y] in reverse)
function run(c, plan) {
  player.x = c.x; player.y = c.y; player.e = c.e;
  drive.enter(c, 'driver');
  const step = () => { drive.drive(DT); drive.tick(DT); doors.update(DT, null, null); };
  for (const s of plan) {
    const rev = s[0] === 'R';
    const [wx, wy, reach = 1.2] = rev ? s.slice(1) : s;
    let stall = 0, ok = false;
    for (let i = 0; i < 60 / DT; i++) {
      const dx = wx - c.x, dy = wy - c.y, dist = Math.hypot(dx, dy);
      let des = Math.atan2(dx, dy); if (rev) des = wrap(des + Math.PI);
      const err = wrap(des - c.yaw);
      if (dist < reach) { ok = true; break; }
      const steer = Math.atan(2 * Math.sin(err) * c.wb / Math.max(dist, 2.5));
      touch.mx = Math.max(-1, Math.min(1, steer / (34 * Math.PI / 180) * 1.3 * (rev ? -1 : 1)));
      keys.clear();
      const vt = Math.abs(err) > 0.35 ? 2 : 5;
      if (Math.abs(c.v) < vt) keys.add(rev ? 'KeyS' : 'KeyW'); else if (Math.abs(c.v) > vt + 0.8) keys.add(rev ? 'KeyW' : 'KeyS');
      step();
      stall = Math.abs(c.v) < 0.02 ? stall + 1 : 0;
      if (stall > 480) break; // waiting for a gate or door to open
    }
    if (!ok) { keys.clear(); touch.mx = 0; return { ok: false, at: [c.x, c.y], why: drive.eval.why }; }
  }
  keys.clear(); touch.mx = 0;
  for (let i = 0; i < 120; i++) step();
  return { ok: true };
}

// out through the first gate onto the road: reverse or drive towards a point just inside the gate,
// then out to 4 m beyond it
const gate = (Z.gates || []).find(g => g.type !== 'swing') || (Z.gates || [])[0];
const c = drive.cars[0];
if (gate) {
  const h = gate.from[1] === gate.to[1], mid = [(gate.from[0] + gate.to[0]) / 2, (gate.from[1] + gate.to[1]) / 2];
  const site = Z.site, inward = h ? (mid[1] < site.d / 2 ? 1 : -1) : (mid[0] < site.w / 2 ? 1 : -1);
  // line up with the car where the gate is wide enough (no swing into the next parked car)
  const span = h ? [Math.min(gate.from[0], gate.to[0]), Math.max(gate.from[0], gate.to[0])] : [Math.min(gate.from[1], gate.to[1]), Math.max(gate.from[1], gate.to[1])];
  const lane = Math.max(span[0] + c.hw + 0.3, Math.min(span[1] - c.hw - 0.3, h ? c.x : c.y));
  const inside = h ? [lane, mid[1] + inward * 3] : [mid[0] + inward * 3, lane];
  const outside = h ? [lane, mid[1] - inward * 5] : [mid[0] - inward * 5, lane];
  // facing the gate already? drive; else reverse out first
  const toGate = Math.atan2(inside[0] - c.x, inside[1] - c.y), facing = Math.abs(wrap(toGate - c.yaw)) < Math.PI / 2;
  const plan = facing ? [inside, outside] : [['R', ...inside], ['R', ...outside]];
  const r = run(c, plan);
  const out = h ? (inward > 0 ? c.y < mid[1] - 1 : c.y > mid[1] + 1) : (inward > 0 ? c.x < mid[0] - 1 : c.x > mid[0] + 1);
  check(r.ok && out, `${c.id}: out through the gate onto the street (at ${c.x.toFixed(1)}, ${c.y.toFixed(1)}${r.ok ? '' : ', stuck: ' + r.why})`);
  // and back in, then straight at the house: must stop dead, not inside it
  const house = Z.floors[config.GROUND];
  const cx = house.reduce((s, q) => s + q.r[0] + q.r[2], 0) / 2 / house.length, cy = house.reduce((s, q) => s + q.r[1] + q.r[3], 0) / 2 / house.length;
  drive.exit();
  const r2 = run(c, [[...(facing ? inside : inside)], [cx, cy, 0.5]]);
  const here = drive.evaluate(c, c.x, c.y, c.yaw, c.e);
  const inHouse = house.some(q => c.x > q.r[0] && c.x < q.r[2] && c.y > q.r[1] && c.y < q.r[3]);
  check(!r2.ok && here && !inHouse && c.v === 0, `${c.id}: stops at the house (at ${c.x.toFixed(2)}, ${c.y.toFixed(2)})`);
  drive.exit();
  check(!drive.inCar && physics.canStand(player.x, player.y, player.e), `get out beside the car on free ground (${player.x.toFixed(2)}, ${player.y.toFixed(2)})`);
}
if (fails.length) { console.log(`✗ ${fails.length} problem(s)`); process.exit(1); }
console.log('✓ cars park, drive out through the gate and stop at the house.');
