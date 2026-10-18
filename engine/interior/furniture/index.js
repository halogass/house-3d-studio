// Furniture registry: merges every builder module into FURNITURE and their INFO tables.
// Builder signature: (params = {}, mat) => THREE.Group, mat(name) → material from the spec §2 registry.
// Local frame: origin on the floor at the footprint centre, +X width, +Y up, +Z FRONT.
import { LIVING, INFO as LIVING_INFO } from './living.js';
import { KITCHEN, INFO as KITCHEN_INFO } from './kitchen.js';
import { BATH, INFO as BATH_INFO } from './bath.js';
import { LIGHTING, INFO as LIGHTING_INFO } from './lighting.js';
import { DECOR, INFO as DECOR_INFO } from './decor.js';
import { BEDROOM, INFO as BEDROOM_INFO } from './bedroom.js';
import { STUDY, INFO as STUDY_INFO } from './study.js';
import { ENTERTAINMENT, INFO as ENTERTAINMENT_INFO } from './entertainment.js';
import { GYM, INFO as GYM_INFO } from './gym.js';
import { WORK, INFO as WORK_INFO } from './work.js';
import { KIDS, INFO as KIDS_INFO } from './kids.js';
import { UTILITY, INFO as UTILITY_INFO } from './utility.js';
import { EXTRAS, INFO as EXTRAS_INFO } from './extras.js';
import { VEHICLES, INFO as VEHICLES_INFO } from './vehicles.js';
import { OUTDOOR, INFO as OUTDOOR_INFO } from './outdoor.js';

export const FURNITURE = {
  ...LIVING, ...KITCHEN, ...BATH, ...LIGHTING, ...DECOR,
  ...BEDROOM, ...STUDY, ...ENTERTAINMENT, ...GYM, ...WORK, ...KIDS, ...UTILITY, ...EXTRAS, ...VEHICLES, ...OUTDOOR,
};

export const INFO = {
  ...LIVING_INFO, ...KITCHEN_INFO, ...BATH_INFO, ...LIGHTING_INFO, ...DECOR_INFO,
  ...BEDROOM_INFO, ...STUDY_INFO, ...ENTERTAINMENT_INFO, ...GYM_INFO, ...WORK_INFO, ...KIDS_INFO, ...UTILITY_INFO, ...EXTRAS_INFO, ...VEHICLES_INFO, ...OUTDOOR_INFO,
};

/**
 * Footprint info for a type: { w, d, h, mount: 'floor'|'wall'|'ceiling', solid }.
 * params.w / d / h override the defaults. INFO entries may also be functions (params) => info
 * (e.g. bed sizes). Returns null for unknown types.
 */
// Size presets (spec §3) for types whose footprint depends on params.size.
const SIZED = {
  bed: { superking: [2.3, 2.3, 1.45], king: [2.0, 2.2, 1.4], queen: [1.7, 2.15, 1.4], single: [1.05, 2.05, 1.15] },
  plantPot: { small: [0.3, 0.3, 0.45], medium: [0.4, 0.4, 0.9], large: [0.5, 0.5, 1.4] },
};

export function furnitureInfo(type, params = {}) {
  let base = INFO[type];
  if (typeof base === 'function') base = base(params);
  if (!base) return null;
  const out = { mount: 'floor', solid: true, ...base };
  const preset = SIZED[type] && SIZED[type][params.size];
  if (preset) [out.w, out.d, out.h] = preset;
  if (type === 'plantPot' && params.size === 'small') out.solid = false;
  if (type === 'diningTable' && params.round) out.d = params.w ?? out.w;
  if (type === 'kitchenRun' && (params.uppers || params.tall)) out.h = 2.3;
  if (type === 'deskExecutive') out.d = Math.max(params.depth ?? out.d, params.ret ?? 0); // L desk: overall depth
  for (const k of ['w', 'd', 'h']) if (typeof params[k] === 'number') out[k] = params[k];
  return out;
}

/** Build one furniture group; throws a clear error for unknown types. */
export function buildFurniture(type, params = {}, mat) {
  const builder = FURNITURE[type];
  if (typeof builder !== 'function') {
    throw new Error(`buildFurniture: unknown furniture type "${type}". Known types: ${Object.keys(FURNITURE).sort().join(', ')}`);
  }
  return builder(params, mat);
}
