// Deploy the active project to Vercel (wraps the Vercel CLI through npx; log in once with `npx vercel login`).
//   npm run deploy              preview deployment (a private test URL)
//   npm run deploy -- --prod    production (node scripts/deploy.mjs --prod on PowerShell)
// The build runs on Vercel (vercel.json: npm run build). The active project travels in
// .active-project; the optional PIN gate is the SITE_PIN environment variable set in the Vercel
// project settings (middleware.js). Private files (projects/*/private/) are never uploaded (.vercelignore).
//   --dry-run                   validate and print the Vercel command without running it
// Unknown flags are refused (a mistyped --prod must not silently make a preview, or the reverse).
// Claude Code asks before running this script (.claude/settings.json): deploying publishes the house.
import { spawnSync } from 'node:child_process';
import { activeProject, ROOT } from './lib/project.mjs';

const argv = process.argv.slice(2);
const KNOWN = new Set(['--prod', '--dry-run', '--project']);
const bad = argv.filter((a, i) => a.startsWith('-') && !KNOWN.has(a) || (!a.startsWith('-') && argv[i - 1] !== '--project'));
if (bad.length) {
  console.log(`✗ Unknown option(s): ${bad.join(' ')}. Use: node scripts/deploy.mjs [--prod] [--dry-run] [--project <name>]\n` +
    `  Opsi tidak dikenal: ${bad.join(' ')}. Pakai: node scripts/deploy.mjs [--prod] [--dry-run] [--project <nama>]`);
  process.exit(2);
}
const prod = argv.includes('--prod'), dry = argv.includes('--dry-run');
const name = activeProject();
const v = spawnSync(process.execPath, [ROOT + '/scripts/validate.mjs', '--project', name], { stdio: 'inherit' });
if (v.status !== 0) process.exit(1);
console.log(`\nDeploying "${name}" (${prod ? 'production' : 'preview'})…`);
const args = ['--yes', 'vercel', 'deploy', ...(prod ? ['--prod'] : [])];
if (dry) { console.log(`(dry run) would run: npx ${args.join(' ')}   [PROJECT=${name}]`); process.exit(0); }
const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, PROJECT: name } });
process.exit(r.status ?? 1);
