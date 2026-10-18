// npm run dev [-- --project <name>] [-- --port 5173]
// Starts the Vite dev server for the active project (see scripts/lib/project.mjs) and prints the
// addresses: open the "Local" one on this computer, the "Network" one from a phone on the same Wi-Fi.
import { createServer } from 'vite';
import { activeProject, ROOT } from './lib/project.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
process.env.PROJECT = activeProject();
const server = await createServer({ root: ROOT, configFile: ROOT + '/vite.config.js', server: { host: true, port: +arg('port', 5173), strictPort: process.argv.includes('--strict-port') } });
await server.listen();
console.log(`\n  House 3D Studio · project "${process.env.PROJECT}"\n`);
server.printUrls();
console.log('\n  3D: /   ·   2D plan: /studio/plan.html   ·   cost: /studio/cost.html\n  Ctrl+C to stop / untuk berhenti.\n');
