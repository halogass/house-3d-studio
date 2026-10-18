// Deploy the active project to Vercel (wraps the Vercel CLI through npx; log in once with `npx vercel login`).
//   npm run deploy              preview deployment (a private test URL)
//   npm run deploy -- --prod    production (node scripts/deploy.mjs --prod on PowerShell)
// The build runs on Vercel (vercel.json: npm run build). The active project travels in
// .active-project; the optional PIN gate is the SITE_PIN environment variable set in the Vercel
// project settings (middleware.js). Private files (projects/*/private/) are never uploaded (.vercelignore).
import { spawnSync } from 'node:child_process';
import { activeProject, ROOT } from './lib/project.mjs';

const prod = process.argv.includes('--prod');
const name = activeProject();
const v = spawnSync(process.execPath, [ROOT + '/scripts/validate.mjs', '--project', name], { stdio: 'inherit' });
if (v.status !== 0) process.exit(1);
console.log(`\nDeploying "${name}" (${prod ? 'production' : 'preview'})…`);
const args = ['--yes', 'vercel', 'deploy', ...(prod ? ['--prod'] : [])];
const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, PROJECT: name } });
process.exit(r.status ?? 1);
