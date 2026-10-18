// Home lift (engine/lift.js), for a project that has one: the car rides between every stop, the
// doors open on arrival, a walker can step in at one floor and out at the next, the shaft blocks
// walking elsewhere. Skips when the project has no lift.
import { buildHeadless } from '../lib/headless.mjs';

const { THREE, P, Z, config, mat } = await buildHeadless({ dynamicDoors: true });
const { LIFT, LIFT_STOPS, STOP_ELEV } = config;
if (!LIFT) { console.log('no lift in this project: nothing to test'); process.exit(0); }
const { buildLift, LiftController, insideCar, nearDoor, liftFrame } = await import('../../engine/lift.js');
const lift = new LiftController(buildLift(() => mat), new THREE.Scene());
const F = liftFrame(LIFT);
const fails = [];
const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) fails.push(msg); };
const DT = 1 / 60;
// points in front of the door (outside) and in the car, in plan coords
const [X0, Y0, X1, Y1] = F.C;
const front = F.toPlan(X0 - 0.8, (Y0 + Y1) / 2), car = F.toPlan((X0 + X1) / 2, (Y0 + Y1) / 2);
check(nearDoor(...front) && !insideCar(...front), 'the landing in front of the door is "near the door"');
check(insideCar(...car), 'the car centre is inside the car');
const run = (p, secs) => { for (let i = 0; i < secs / DT; i++) lift.update(DT, p, null); };
const walkTo = (p, x, y, secs = 6) => {
  for (let i = 0; i < secs / DT; i++) {
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d < 0.05) return true;
    const ox = p.x, oy = p.y;
    P.step(p, dx / d * Math.min(1.4 / 60, d), dy / d * Math.min(1.4 / 60, d), DT);
    // the car is only enterable when it waits at this floor with its doors open (engine/main.js)
    if (!insideCar(ox, oy) && insideCar(p.x, p.y) && !lift.doorsOpenAt(config.levelAt(p.e))) { p.x = ox; p.y = oy; }
    lift.update(DT, p, config.levelAt(p.e));
  }
  return Math.hypot(x - p.x, y - p.y) < 0.15;
};
for (let i = 0; i + 1 < LIFT_STOPS.length; i++) {
  const a = LIFT_STOPS[i], b = LIFT_STOPS[i + 1];
  const e0 = P.landingAt(front[0], front[1], STOP_ELEV[a]);
  check(e0 !== null && Math.abs(e0 - STOP_ELEV[a]) < 0.05, `floor in front of the lift on ${a}`);
  const p = { x: front[0], y: front[1], e: e0, vy: 0, grounded: true };
  lift.request(a, 'call'); for (let k = 0; k < 40 / DT && !lift.doorsOpenAt(a); k++) lift.update(DT, p, a);
  check(lift.doorsOpenAt(a), `called to ${a}: doors open`);
  check(walkTo(p, car[0], car[1]), `step into the car on ${a}`);
  lift.request(b, 'floor');
  let riding = false;
  for (let k = 0; k < 40 / DT && !(lift.level === b && lift.open > 0.9); k++) riding = lift.update(DT, p, a) || riding;
  check(riding && Math.abs(p.e - STOP_ELEV[b]) < 0.02, `rides ${a} → ${b} (e ${p.e.toFixed(2)})`);
  check(walkTo(p, front[0], front[1]), `steps out on ${b}`);
}
// the shaft blocks walking through it from the side away from the door
{
  const back = F.toPlan(X1 + 0.5, (Y0 + Y1) / 2), e = P.landingAt(back[0], back[1], STOP_ELEV[LIFT_STOPS[0]]);
  if (e !== null) { const p = { x: back[0], y: back[1], e, vy: 0, grounded: true }; walkTo(p, car[0], car[1], 3); check(!insideCar(p.x, p.y), 'the shaft wall blocks walking in from the back'); }
}
if (fails.length) { console.log(`✗ ${fails.length} problem(s)`); process.exit(1); }
console.log(`✓ the lift serves ${LIFT_STOPS.join(' – ')}.`);
