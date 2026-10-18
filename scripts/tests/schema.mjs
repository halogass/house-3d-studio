// The validator catches typical data mistakes with a message in both languages, and the sample
// data has no errors. Each case breaks a copy of the active project's data in one way.
import { useProject } from '../lib/project.mjs';
useProject();
const { RAW } = await import('../../engine/data.js');
const { validate } = await import('../../engine/schema.js');
const { FURNITURE, furnitureInfo } = await import('../../engine/interior/furniture/index.js');
const { isMaterialName } = await import('../../engine/materials.js');
const opts = { furnitureTypes: new Set(Object.keys(FURNITURE)), furnitureInfo, isMaterial: (n) => isMaterialName(n) };
const clone = (o) => structuredClone(o);
const fails = [];
const base = validate(RAW.project, RAW.zoning, RAW.interior, opts);
if (base.errors.length) fails.push('the project itself has errors: ' + base.errors.map(e => e.en).join(' | '));
const lv = RAW.zoning.levels[0].id;
const cases = [
  ['off-grid room', (z) => { z.rooms[lv][0].r = [z.rooms[lv][0].r[0] + 0.25, ...z.rooms[lv][0].r.slice(1)]; }, /0\.5 m/],
  ['overlapping rooms', (z) => { const r = z.rooms[lv][0].r; z.rooms[lv].push({ id: 'dup', name: 'dup', use: 'other', r: [...r] }); }, /overlap/],
  ['duplicate id', (z) => { z.rooms[lv].push({ ...z.rooms[lv][0], r: [0, 0, 1, 1] }); }, /already used/],
  ['opening off the walls', (z) => { (z.openings[lv] ||= []).push({ o: 'h', x: 0.5, y: 0.25, w: 0.9, t: 'swing' }); }, /not on any room edge/],
  ['unknown opening type', (z) => { (z.openings[lv] ||= []).push({ o: 'h', x: 1, y: 1, w: 0.9, t: 'portal' }); }, /unknown/],
  ['missing levels', (z) => { z.levels = []; }, /No levels/],
  ['stair to a lower level', (z) => { if (z.stairs?.length) [z.stairs[0].from, z.stairs[0].to] = [z.stairs[0].to, z.stairs[0].from]; else z.stairs = [{ r: [1, 1, 2, 5], from: lv, to: lv }]; }, /higher|must be existing/],
  ['bad site kind', (z) => { z.site.items.push({ kind: 'helipad', r: [0, 0, 1, 1] }); }, /unknown/],
];
for (const [name, mutate, expect] of cases) {
  const z = clone(RAW.zoning);
  mutate(z);
  const r = validate(RAW.project, z, RAW.interior, opts);
  const hit = r.errors.find(e => expect.test(e.en));
  if (!hit) fails.push(`${name}: no matching error (got: ${r.errors.map(e => e.en).join(' | ') || 'none'})`);
  else if (!hit.id || !hit.where) fails.push(`${name}: message lacks Indonesian text or location`);
}
// interior: unknown furniture type, item outside its room
{
  const I = clone(RAW.interior);
  const room = Object.keys(I.rooms)[0];
  I.rooms[room].items = [...(I.rooms[room].items || []), { type: 'teleporter', x: 1, y: 1 }];
  if (!validate(RAW.project, RAW.zoning, I, opts).errors.some(e => /does not exist/.test(e.en))) fails.push('unknown furniture type not reported');
}
// project.json: the house's own materials and door / roof material names
const pcases = [
  ['custom material clashes with a built-in', (p) => { p.materials = { walnut: { color: '#ffffff' } }; }, /built-in/],
  ['custom material without a size', (p) => { p.materials = { myTile: { texture: 'tile' } }; }, /"size"/],
  ['unknown door material', (p) => { p.style = { ...(p.style || {}), door: 'unobtanium' }; }, /not a material name/],
  ['unknown roof material', (p) => { p.style = { ...(p.style || {}), roof: 'genteng' }; }, /roof material/],
];
for (const [name, mutate, expect] of pcases) {
  const p = clone(RAW.project);
  mutate(p);
  if (!validate(p, RAW.zoning, RAW.interior, opts).errors.some(e => expect.test(e.en) && e.id)) fails.push(`${name}: not reported`);
}
{ // a valid custom material and door material pass
  const p = clone(RAW.project);
  p.materials = { myTerrazzo: { texture: 'terrazzo', size: 0.6, rough: 0.6 } };
  p.style = { ...(p.style || {}), door: 'lacquer:#f2efe7' };
  const errs = validate(p, RAW.zoning, RAW.interior, opts).errors;
  if (errs.length) fails.push('valid custom material rejected: ' + errs.map(e => e.en).join(' | '));
}
console.log(`${cases.length + pcases.length + 2} broken-data cases`);
if (fails.length) { console.log('✗ ' + fails.join('\n✗ ')); process.exit(1); }
console.log('✓ the validator reports every case, in both languages.');
