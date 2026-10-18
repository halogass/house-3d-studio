// Start a new house: copies projects/_template to projects/<name> and makes it the active project.
//   npm run new-project my-house          (the name is a plain argument: works in cmd, PowerShell, bash)
//   node scripts/new-project.mjs my-house --title "Rumah Kami" --lang id --force
// Names: lowercase letters, digits and dashes (it becomes a folder name and part of the URL).
import { cpSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, PROJECTS } from './lib/project.mjs';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const name = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--force'].includes(args[i - 1])));
if (!name) {
  console.log('Usage / cara pakai: npm run new-project <name>   e.g. npm run new-project rumah-kami');
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(name) || name.startsWith('_')) {
  console.log(`✗ "${name}": use lowercase letters, digits and dashes, 2–41 characters (e.g. "rumah-kami").\n  Pakai huruf kecil, angka dan tanda minus (mis. "rumah-kami").`);
  process.exit(1);
}
const dst = join(PROJECTS, name);
if (existsSync(dst) && !args.includes('--force')) {
  console.log(`✗ projects/${name} already exists / sudah ada. Use another name, or: npm run use-project ${name}`);
  process.exit(1);
}
cpSync(join(PROJECTS, '_template'), dst, { recursive: true, force: true });
mkdirSync(join(dst, 'private', 'plans'), { recursive: true });
mkdirSync(join(dst, 'private', 'inspo'), { recursive: true });
// fill in the name (and optional title / language)
const pj = join(dst, 'project.json');
const p = JSON.parse(readFileSync(pj, 'utf8'));
p.name = name;
const title = opt('title');
if (title) p.title = { id: title, en: title };
if (opt('lang')) p.language = opt('lang');
writeFileSync(pj, JSON.stringify(p, null, 2) + '\n');
const pr = join(dst, 'progress.md');
if (existsSync(pr)) writeFileSync(pr, readFileSync(pr, 'utf8').replace(/^house: .*$/m, `house: ${name}`).replace(/^updated: .*$/m, `updated: ${new Date().toISOString().slice(0, 10)}`).replace(/^language: \S+/m, `language: ${p.language || 'id'}`));
writeFileSync(join(ROOT, '.active-project'), name + '\n');
console.log(`✓ Created projects/${name} and made it the active project.\n✓ Proyek projects/${name} dibuat dan diaktifkan.\n` +
  `  Private files (plans, photos) go in projects/${name}/private/ (never committed).\n  Next / berikutnya: npm run validate · npm run dev`);
