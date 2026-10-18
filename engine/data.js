// The active house: project.json + zoning.js + interior.js of projects/<active>/ (see vite.config.js
// and scripts/lib/project.mjs for how the active project is chosen), normalised by schema.js.
//
//   PROJECT   settings: title, location (latitude for the sun), features on/off, style, spec assumptions
//   Z         plan data: levels, rooms per level (floors), open-plan pairs, openings, fixtures, stairs,
//             lift, roofs, site (plot + items), outdoor decks per level
//   INTERIOR  finishes + furniture per room ('rooms') and outside the rooms ('areas', e.g. a carport)
//
// Also published as globalThis.PROJECT / ZONING / INTERIOR for the bake page and debugging.
import projectRaw from '@project/project.json';
import zoningRaw from '@project/zoning.js';
import interiorRaw from '@project/interior.js';
import { normalize } from './schema.js';
import { tr } from './i18n.js';

export const RAW = { project: projectRaw, zoning: zoningRaw, interior: interiorRaw };
export const { PROJECT, Z, INTERIOR } = normalize(projectRaw, zoningRaw, interiorRaw, tr);
export const FEATURES = PROJECT.features;

globalThis.PROJECT = PROJECT;
globalThis.ZONING = Z;
globalThis.INTERIOR = INTERIOR;
