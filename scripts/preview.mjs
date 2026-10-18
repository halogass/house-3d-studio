// npm run preview [-- --port 4173]   serves dist/ (run `npm run build` first) on this computer and the LAN
import { preview } from 'vite';
import { existsSync } from 'node:fs';
import { ROOT } from './lib/project.mjs';

if (!existsSync(ROOT + '/dist/index.html')) { console.log('✗ No build yet / belum di-build: npm run build'); process.exit(1); }
const i = process.argv.indexOf('--port');
const server = await preview({ root: ROOT, configFile: ROOT + '/vite.config.js', preview: { host: true, port: i > 0 ? +process.argv[i + 1] : 4173 } });
server.printUrls();
