// Seat slots for sitting / lying down, derived from the placed furniture.
// A slot is a plan point the player snaps to: { id, kind: 'sit'|'lie', x, y, e, h, yaw, stand: [x, y], label }
//   e   floor elevation, h = seat (or mattress) height above it
//   yaw facing direction (plan, 0 = north, same convention as the player)
//   for 'lie' the point is the head and yaw points towards the feet
// Slots are computed in the builder's local frame (+X width, +Z front) and turned to plan
// with the item's rot, like engine/interior/place.js does with the meshes.

// type → { h: seat height, n: seats across (or 'auto' by width), z / face: see the gym machines }
const SIT = {
  diningChair: { h: 0.47 }, officeChair: { h: 0.5 }, clubChair: { h: 0.46 }, armchairWingback: { h: 0.45 },
  armchairLounge: { h: 0.44 }, recliner: { h: 0.47 }, massageChair: { h: 0.5 }, barStool: { h: 0.76 },
  ottoman: { h: 0.43 }, benchTufted: { h: 0.47, n: 'auto' }, sofa: { h: 0.45, n: 'auto' },
  chesterfield: { h: 0.45, n: 'auto' }, weightBench: { h: 0.45 },
  // gym machines (engine/interior/furniture/gym.js)
  // z = seat centre along the builder's Z, face −1 = the sitter faces the machine's back (−Z)
  benchPress: { h: 0.48, z: 0.1 }, latPulldown: { h: 0.54, z: 0.4, face: -1 }, legPress: { h: 0.49, z: 0.55, face: -1 },
  legExtension: { h: 0.54, z: 0.17 }, chestPress: { h: 0.54, z: 0.07 },
};
const LABEL = { sit: 'sit', lie: 'lie' }; // i18n keys (engine/i18n.js)

export function seatSlots(item, info, elev, roomId, index) {
  const out = [];
  const rot = (item.rot || 0) * Math.PI / 180;
  const w = info.w, d = info.d;
  // builder +X is the plan's −u (three.js yaw = π − rot), +Z is the plan's front f
  const f = [Math.sin(rot), Math.cos(rot)], u = [Math.cos(rot), -Math.sin(rot)];
  const toPlan = (bx, bz) => [item.x - u[0] * bx + f[0] * bz, item.y - u[1] * bx + f[1] * bz];
  const yawOf = (bdx, bdz) => { const p = [-u[0] * bdx + f[0] * bdz, -u[1] * bdx + f[1] * bdz]; return Math.atan2(p[0], p[1]); };
  const add = (kind, bx, bz, h, dir, standZ) => {
    const [x, y] = toPlan(bx, bz);
    out.push({ id: `${roomId}:${index}:${out.length}`, kind, x, y, e: elev, h, yaw: yawOf(...dir), stand: toPlan(bx, standZ), label: LABEL[kind], type: item.type });
  };
  const front = d / 2 + 0.45; // stand up into the space in front of the seat

  if (item.type === 'bed' || item.type === 'bunkBed') {
    // Sit on the foot end, lie with the head on the pillows (headboard at −Z)
    const top = item.type === 'bunkBed' ? 0.45 : 0.6;
    const xs = w >= 1.3 ? [-w / 4, w / 4] : [0];
    for (const bx of xs) add('sit', bx, d / 2 - 0.3, top, [0, 1], front);
    for (const bx of xs) add('lie', bx, -d / 2 + 0.35, top, [0, 1], front);
    // a bed is big: reach it from anywhere around its edge (cx, cy, r = half its longer side)
    for (const o of out) Object.assign(o, { cx: item.x, cy: item.y, r: Math.max(w, d) / 2 - 0.3 });
    return out;
  }
  if (item.type === 'sofaSectional') {
    const dd = item.depth ?? 0.95, s = item.corner === 'left' ? -1 : 1;
    const n = Math.max(2, Math.round((w - 0.4) / 0.75));
    const z = -d / 2 + dd / 2 + 0.08;
    // main run, skipping the end that meets the chaise
    for (let i = 0; i < n; i++) {
      const bx = -w / 2 + 0.3 + (i + 0.5) * (w - 0.6) / n;
      if (s * bx > w / 2 - dd) continue;
      add('sit', bx, z, 0.45, [0, 1], -d / 2 + dd + 0.45);
    }
    // the corner seat + the chaise (sitter faces forward with the legs on the chaise)
    add('sit', s * (w / 2 - dd / 2), z, 0.45, [0, 1], -d / 2 + dd + 0.45);
    const [x, y] = toPlan(s * (w / 2 - dd / 2), -d / 2 + dd + 0.25);
    const st = toPlan(s * (w / 2 - dd - 0.45), -d / 2 + dd + 0.6);
    out.push({ id: `${roomId}:${index}:${out.length}`, kind: 'sit', x, y, e: elev, h: 0.45, yaw: yawOf(0, 1), stand: st, label: LABEL.sit, type: item.type });
    return out;
  }
  const t = SIT[item.type];
  if (!t) return out;
  const n = t.n === 'auto' ? Math.max(1, Math.floor((w - 0.2) / 0.62)) : (t.n || 1);
  for (let i = 0; i < n; i++) {
    const bx = n === 1 ? 0 : -w / 2 + 0.2 + (i + 0.5) * (w - 0.4) / n;
    const z = item.type === 'benchPress' && item.incline ? 0.4 : t.z; // incline: seat sits further forward
    add('sit', bx, z ?? Math.min(0.08, d * 0.1), t.h, [0, t.face || 1], front);
  }
  return out;
}
