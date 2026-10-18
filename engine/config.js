// Derived constants of the active house (levels, stairs, lift) + walking parameters.
// Everything house-specific comes from the project data (engine/data.js); nothing is hard-coded.
import { Z, PROJECT } from './data.js';
import { planStairs } from './stairs.js';

// Levels: id → { id, name, short, elev (finished floor, m above the garden), h (floor-to-floor) }
export const LEVELS = Object.fromEntries(Z.levels.map(l => [l.id, { id: l.id, name: l.name, short: l.short, elev: l.elev, h: l.h }]));
export const LEVEL_ORDER = Z.levels.map(l => l.id);                 // bottom → top
export const isBasement = (lv) => !!LEVELS[lv] && LEVELS[lv].elev < -0.6;
// The ground floor: the lowest level that is not a basement (its walls start at the garden, 0)
export const GROUND = LEVEL_ORDER.find(l => !isBasement(l)) || LEVEL_ORDER[0];
export const ABOVE = LEVEL_ORDER.filter(l => !isBasement(l));        // above-ground levels
export const levelIndex = (lv) => LEVEL_ORDER.indexOf(lv);
export const levelAbove = (lv) => LEVEL_ORDER[levelIndex(lv) + 1] || null;
export const levelBelow = (lv) => LEVEL_ORDER[levelIndex(lv) - 1] || null;
// The level a walker at elevation e stands on
export function levelAt(e) {
  let lv = LEVEL_ORDER[0];
  for (const id of LEVEL_ORDER) if (e >= LEVELS[id].elev - 0.6) lv = id;
  return lv;
}

// Walking
export const EYE = 1.6;        // eye height above feet
export const STEP = 0.45;      // max step-up height
export const BODY = 1.75;      // body height (for head clearance)
export const RADIUS = 0.25;    // body radius
export const WALK_SPEED = 1.7; // m/s
export const RUN_SPEED = 3.8;

// Wall thickness
export const WALL_EXT = 0.3;
export const WALL_INT = 0.15;

// Plan (x east, y north) → three.js world (X east, Y up, Z south)
export const toWorld = (x, y, e = 0) => [x, e, -y];

// Site latitude (degrees, south negative) for the sun path
export const LATITUDE = PROJECT.location.lat;

// Stairs: geometry plans shared by the world, the finishes (handrails) and the checks (stairs.js)
export const STAIRS = planStairs(Z.stairs, LEVELS);

// Home lift (optional): shaft rect, door side, stops bottom → top and their elevations
export const LIFT = Z.lift && PROJECT.features.lift !== false ? { r: Z.lift.r, door: Z.lift.door } : null;
export const LIFT_STOPS = LIFT ? Z.lift.stops.slice().sort((a, b) => LEVELS[a].elev - LEVELS[b].elev) : [];
export const STOP_ELEV = Object.fromEntries(LIFT_STOPS.map(l => [l, LEVELS[l].elev]));
