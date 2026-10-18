// Vite config. The 3D viewer (index.html) and the studio pages (studio/plan.html, studio/cost.html)
// are built for the ACTIVE PROJECT only: one house per deployment.
//   active project = --project / PROJECT env / .active-project / 'sample-house' (scripts/lib/project.mjs)
// Engine code imports the house data as '@project/zoning.js', '@project/interior.js',
// '@project/project.json'. Baked lightmaps of the project (projects/<name>/bake/, optional) are
// served at /bake/ in dev and copied to dist/bake/ on build; the house's own textures
// (projects/<name>/textures/, project.json "materials") likewise at /project-textures/.
// projects/<name>/private/ is never served or copied.
//
// Vendor code goes into chunks of its own: three.js (core, addons) and Supabase only change with a
// dependency upgrade, so their file names (content hashes) stay the same across deploys and a
// returning visitor's browser / service worker keeps them. All chunks are static imports loaded at
// start (no lazy chunks: a tab opened before a redeploy would ask for hashes that no longer exist).
import { defineConfig } from 'vite';
import { cpSync, existsSync, createReadStream, statSync, readFileSync } from 'node:fs';
import { join, resolve, extname, sep } from 'node:path';
import { activeProject, projectDir, ROOT } from './scripts/lib/project.mjs';

const name = activeProject();
const dir = projectDir(name);
const bakeDir = join(dir, 'bake');
const texDir = join(dir, 'textures');
const TYPES = { '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
// dev: serve a project folder under a URL prefix (404 → the app keeps its fallback)
const serveDir = (server, prefix, folder) => server.middlewares.use(prefix, (req, res, next) => {
  const f = resolve(folder, '.' + decodeURIComponent((req.url || '').split('?')[0]));
  if (!f.startsWith(folder + sep) || !existsSync(f) || !statSync(f).isFile()) return next();
  res.setHeader('content-type', TYPES[extname(f).toLowerCase()] || 'application/octet-stream');
  res.setHeader('cache-control', 'no-store');
  createReadStream(f).pipe(res);
});
// title + default language for the HTML pages (before any script runs)
let project = {};
try { project = JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8')); } catch (e) { /* the validate step reports it */ }
const lang = project.language === 'en' ? 'en' : 'id';
const title = typeof project.title === 'string' ? project.title : (project.title?.[lang] || project.title?.en || project.name || 'House');
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default defineConfig({
  root: ROOT,
  resolve: { alias: { '@project': dir } },
  define: { __PROJECT_NAME__: JSON.stringify(name) },
  server: { fs: { allow: [ROOT, dir] } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      input: {
        main: resolve(ROOT, 'index.html'),
        plan: resolve(ROOT, 'studio/plan.html'),
        cost: resolve(ROOT, 'studio/cost.html'),
      },
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]build/ },
            { name: 'three-addons', test: /node_modules[\\/]three[\\/]examples/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
  plugins: [{
    name: 'project-html',
    transformIndexHtml: (html) => html.replaceAll('%H3S_LANG%', lang).replaceAll('%H3S_TITLE%', esc(title)),
  }, {
    name: 'project-bake',
    // dev: /bake/* from the project's bake folder (404 → the app keeps real-time lighting),
    // /project-textures/* from its textures folder
    configureServer(server) {
      serveDir(server, '/bake', bakeDir);
      serveDir(server, '/project-textures', texDir);
    },
    closeBundle() {
      if (existsSync(bakeDir)) cpSync(bakeDir, join(ROOT, 'dist', 'bake'), { recursive: true });
      if (existsSync(texDir)) cpSync(texDir, join(ROOT, 'dist', 'project-textures'), { recursive: true });
    },
  }],
});
