// Turn (part of) the owner's own photo of a tile, floor, wood, stone or fabric into a texture of
// the house: projects/<house>/textures/<name>/diff.jpg (deployed with the house, unlike private/).
// Only for photos the owner took or may use (CLAUDE.md rule 12) — never faces, art, logos.
//
//   node scripts/texture-from-photo.mjs <photo> --name <name> [--crop x,y,w,h] [--seamless]
//        [--px 1024] [--size 0.6] [--material <materialName>] [--project <house>]
//
//   <photo>      the photo (any folder; quote paths with spaces)
//   --name       texture folder name: lowercase letters, digits, dashes (e.g. "teraso")
//   --crop       the flat, evenly lit, front-on area to use: pixels "x,y,w,h", or fractions of
//                the photo "0.1,0.6,0.5,0.35" (all values ≤ 1). Default: the whole photo
//   --seamless   blend the edges so the texture repeats without visible seams (recommended)
//   --px         output size (square, default 1024; 512 for small patterns)
//   --size       metres one texture image covers (printed in the project.json snippet)
//   --material   material name for the snippet (default: the name in camelCase)
// Then add the printed snippet to project.json "materials" and use the material name in a finish,
// e.g. interior.js  finish: { floor: 'teraso' }. Run npm run validate afterwards.
import { mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { activeProject, projectDir } from './lib/project.mjs';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const flags = new Set(['--seamless']);
const valued = new Set(['--name', '--crop', '--px', '--size', '--material', '--project']);
const photo = args.find((a, i) => !a.startsWith('--') && !(i > 0 && valued.has(args[i - 1])));
const unknown = args.filter((a) => a.startsWith('--') && !flags.has(a) && !valued.has(a));
const name = opt('name');
const fail = (id, en) => { console.log(`✗ ${en}\n  ${id}`); process.exit(1); };
if (unknown.length) fail(`Opsi tidak dikenal: ${unknown.join(' ')}`, `Unknown option(s): ${unknown.join(' ')}`);
if (!photo || !name) fail('Cara pakai: node scripts/texture-from-photo.mjs <foto> --name <nama> [--crop x,y,w,h] [--seamless]', 'Usage: node scripts/texture-from-photo.mjs <photo> --name <name> [--crop x,y,w,h] [--seamless]');
if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(name)) fail(`"${name}": pakai huruf kecil, angka dan minus.`, `"${name}": use lowercase letters, digits and dashes.`);
const src = resolve(photo);
if (!existsSync(src)) fail(`Foto tidak ditemukan: ${src}`, `Photo not found: ${src}`);
const px = Math.max(128, Math.min(2048, +(opt('px') || 1024)));

let sharp;
try { sharp = (await import('sharp')).default; } catch (e) { fail('Paket "sharp" belum ada: jalankan npm install', 'The "sharp" package is missing: run npm install'); }

const house = activeProject();
const dir = projectDir(house);
if (!existsSync(join(dir, 'project.json'))) fail(`Proyek "${house}" tidak ditemukan.`, `Project "${house}" not found.`);

let img = sharp(src).rotate(); // respect the phone's orientation flag
const meta = await sharp(src).rotate().toBuffer({ resolveWithObject: true }).then((r) => r.info);
if (opt('crop')) {
  let c = opt('crop').split(',').map(Number);
  if (c.length !== 4 || c.some((v) => !Number.isFinite(v) || v < 0)) fail('--crop butuh 4 angka: x,y,w,h', '--crop needs 4 numbers: x,y,w,h');
  if (c.every((v) => v <= 1)) c = [c[0] * meta.width, c[1] * meta.height, c[2] * meta.width, c[3] * meta.height];
  let [x, y, w, h] = c.map(Math.round);
  w = Math.min(w, meta.width - x); h = Math.min(h, meta.height - y);
  if (w < 64 || h < 64) fail('Area potong terlalu kecil (min 64 px) atau di luar foto.', 'Crop area too small (min 64 px) or outside the photo.');
  img = img.extract({ left: x, top: y, width: w, height: h });
}
let { data, info } = await img.resize(px, px, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });

if (args.includes('--seamless')) {
  // offset-and-blend: the half-shifted copy is continuous across the tile edges; a mask that is 1 in
  // the middle (where the copy has its seams) and 0 at the edges mixes the two
  const W = info.width, H = info.height, ch = info.channels, out = Buffer.alloc(data.length);
  const f = (u, n) => Math.min(1, Math.min(u, n - 1 - u) / (n * 0.25));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = f(x, W) * f(y, H), sx = (x + W / 2) % W, sy = (y + H / 2) % H;
    for (let k = 0; k < ch; k++) out[(y * W + x) * ch + k] = Math.round(data[(y * W + x) * ch + k] * m + data[(sy * W + sx) * ch + k] * (1 - m));
  }
  data = out;
}
const outDir = join(dir, 'textures', name);
mkdirSync(outDir, { recursive: true });
const file = join(outDir, 'diff.jpg');
await sharp(data, { raw: info }).jpeg({ quality: 88, mozjpeg: true }).toFile(file);

const mat = opt('material') || name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const size = +(opt('size') || 1);
console.log(`✓ projects/${house}/textures/${name}/diff.jpg (${px} × ${px} px)\n` +
  `  Add to project.json / tambahkan ke project.json:\n` +
  `  "materials": { "${mat}": { "texture": "${name}", "size": ${size}, "rough": 0.6 } }\n` +
  `  Use it / pakai: interior.js finish: { floor: '${mat}' }  →  npm run validate`);
