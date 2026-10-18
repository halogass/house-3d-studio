// Copy the owner's plan scans or inspiration photos into the house's private folder
// (projects/<house>/private/plans/ or private/inspo/ — git-ignored, never deployed).
// Works with paths that contain spaces (quote them) on Windows, macOS and Linux.
//
//   node scripts/import-files.mjs <file-or-folder> [more …] --to plans|inspo [--project <house>]
//
// Folders are copied one level deep (images and PDFs only). File names are made safe
// (lowercase, a-z0-9-, the extension kept); an existing file with the same name is not overwritten
// (a number is added). Prints where each file went.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, basename, extname } from 'node:path';
import { activeProject, projectDir } from './lib/project.mjs';

const args = process.argv.slice(2);
const valued = new Set(['--to', '--project']);
const to = (() => { const i = args.indexOf('--to'); return i >= 0 ? args[i + 1] : null; })();
const inputs = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && valued.has(args[i - 1])));
const unknown = args.filter((a) => a.startsWith('--') && !valued.has(a));
const fail = (id, en) => { console.log(`✗ ${en}\n  ${id}`); process.exit(1); };
if (unknown.length) fail(`Opsi tidak dikenal: ${unknown.join(' ')}`, `Unknown option(s): ${unknown.join(' ')}`);
if (!inputs.length || !['plans', 'inspo'].includes(to)) fail('Cara pakai: node scripts/import-files.mjs "<file atau folder>" --to plans|inspo', 'Usage: node scripts/import-files.mjs "<file or folder>" --to plans|inspo');

const house = activeProject();
const dir = projectDir(house);
if (!existsSync(join(dir, 'project.json'))) fail(`Proyek "${house}" tidak ditemukan. Buat dulu: npm run new-project <nama>`, `Project "${house}" not found. Create it first: npm run new-project <name>`);
const dest = join(dir, 'private', to);
mkdirSync(dest, { recursive: true });

const OK = new Set(['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.gif', '.bmp', '.tif', '.tiff', '.pdf', '.svg']);
const files = [];
for (const raw of inputs) {
  const p = resolve(raw);
  if (!existsSync(p)) { console.log(`! not found / tidak ditemukan: ${p}`); continue; }
  if (statSync(p).isDirectory()) {
    for (const f of readdirSync(p).sort()) if (statSync(join(p, f)).isFile() && OK.has(extname(f).toLowerCase())) files.push(join(p, f));
  } else files.push(p);
}
const safe = (f) => {
  const ext = extname(f).toLowerCase().replace('.jpeg', '.jpg');
  const stem = basename(f, extname(f)).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
  return [stem, ext];
};
let n = 0;
for (const f of files) {
  const ext0 = extname(f).toLowerCase();
  if (!OK.has(ext0)) { console.log(`! skipped (not an image or PDF) / dilewati: ${basename(f)}`); continue; }
  const [stem, ext] = safe(f);
  let target = join(dest, stem + ext);
  for (let k = 2; existsSync(target); k++) target = join(dest, `${stem}-${k}${ext}`);
  copyFileSync(f, target);
  n++;
  console.log(`✓ ${basename(f)}  →  projects/${house}/private/${to}/${basename(target)}`);
}
if (!n) fail('Tidak ada file yang disalin.', 'No files copied.');
console.log(`${n} file(s) copied / disalin. Private: not committed, not deployed. / Pribadi: tidak di-commit, tidak di-online-kan.`);
