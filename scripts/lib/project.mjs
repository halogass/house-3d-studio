// Which house is active, and how Node scripts load its data.
//
// The active project is a folder under projects/ (projects/<name>/project.json, zoning.js,
// interior.js). It is chosen, first match wins, by:
//   1. the PROJECT environment variable                 (PROJECT=my-house, set by --project)
//   2. the file .active-project in the repository root  (written by `npm run use-project <name>`)
//   3. 'sample-house'
// Engine modules import the project as '@project/zoning.js' etc. Vite resolves that alias
// (vite.config.js); Node scripts call useProject() first, which registers a tiny module hook that
// does the same (and lets `import x from '@project/project.json'` work without import attributes).
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROJECTS = join(ROOT, 'projects');

// --project <name> on the command line wins over everything (handy for npm scripts:
// `npm run check -- --project my-house`)
export function argProject(argv = process.argv) {
  const i = argv.indexOf('--project');
  return i > 0 ? argv[i + 1] : null;
}

export function activeProject() {
  const fromArg = argProject();
  if (fromArg) return fromArg;
  if (process.env.PROJECT) return process.env.PROJECT;
  const f = join(ROOT, '.active-project');
  if (existsSync(f)) {
    const name = readFileSync(f, 'utf8').trim();
    if (name) return name;
  }
  return 'sample-house';
}

// Absolute folder of a project; also accepts a path (tests use fixture folders)
export function projectDir(name = activeProject()) {
  if (existsSync(name) && existsSync(join(name, 'zoning.js'))) return resolve(name);
  return join(PROJECTS, name);
}

let registered = null;
// Make '@project/...' resolve to the given project folder for this Node process.
// Call before importing anything from engine/. Returns the folder.
export function useProject(name = activeProject()) {
  const dir = projectDir(name);
  if (!existsSync(join(dir, 'zoning.js'))) {
    console.error(`\n✗ Project "${name}" not found (looked for ${join(dir, 'zoning.js')}).\n` +
      `  Proyek "${name}" tidak ditemukan. Lihat folder projects/ atau jalankan: npm run new-project <nama>\n`);
    process.exit(1);
  }
  if (registered && registered !== dir) throw new Error('useProject: a different project is already loaded in this process');
  if (!registered) {
    register('./hooks.mjs', import.meta.url, { data: { dir: pathToFileURL(dir + '/').href } });
    registered = dir;
  }
  globalThis.window ??= globalThis; // engine modules are written for the browser; they only touch window lightly
  return dir;
}
