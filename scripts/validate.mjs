// Check the active project's data (project.json, zoning.js, interior.js) against the schema and
// explain every problem in plain words, in Bahasa Indonesia and English.
//   npm run validate                 (or: node scripts/validate.mjs --project <name>)
//   --json   machine-readable output { errors, warnings }
//   --strict warnings count as errors
// Exit code 1 when there are errors (or warnings with --strict).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { useProject, activeProject } from './lib/project.mjs';

const name = activeProject();
const dir = useProject(name);
const json = process.argv.includes('--json'), strict = process.argv.includes('--strict');
const errors = [], warnings = [];

// load each file on its own, so a syntax error is reported with the file name
async function load(file) {
  const p = join(dir, file);
  if (!existsSync(p)) { errors.push({ where: file, id: `File ${file} tidak ada.`, en: `File ${file} is missing.` }); return null; }
  try { return (await import(pathToFileURL(p).href)).default; }
  catch (e) {
    errors.push({ where: file, id: `File ${file} tidak bisa dibaca: ${e.message}. Biasanya koma, kurung atau tanda kutip yang hilang.`, en: `File ${file} cannot be read: ${e.message}. Usually a missing comma, bracket or quote.` });
    return null;
  }
}
const project = await load('project.json');
const zoning = await load('zoning.js');
const interior = await load('interior.js');
if (project && zoning && interior) {
  const { validate } = await import('../engine/schema.js');
  const { FURNITURE, furnitureInfo } = await import('../engine/interior/furniture/index.js');
  const res = validate(project, zoning, interior, { furnitureTypes: new Set(Object.keys(FURNITURE)), furnitureInfo });
  errors.push(...res.errors); warnings.push(...res.warnings);
  if (project.name && project.name !== name && !existsSync(name)) warnings.push({ where: 'project.json name', id: `"name" (${project.name}) berbeda dengan nama folder (${name}).`, en: `"name" (${project.name}) differs from the folder name (${name}).` });
}

if (json) { console.log(JSON.stringify({ project: name, errors, warnings }, null, 1)); process.exit(errors.length || (strict && warnings.length) ? 1 : 0); }
const show = (list, mark) => list.forEach((m, i) => console.log(`${mark} ${i + 1}. [${m.where}]\n     ID: ${m.id}\n     EN: ${m.en}`));
console.log(`Project / proyek: ${name}`);
if (errors.length) { console.log(`\n✗ ${errors.length} error(s) / kesalahan:`); show(errors, ' '); }
if (warnings.length) { console.log(`\n! ${warnings.length} warning(s) / peringatan:`); show(warnings, ' '); }
if (!errors.length) console.log(`\n✓ Data valid${warnings.length ? ' (with warnings / dengan peringatan)' : ''}.`);
process.exit(errors.length || (strict && warnings.length) ? 1 : 0);
