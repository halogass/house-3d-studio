// npm run build [-- --project <name>] [--no-validate]
// Validates the project data, then builds the site for it into dist/ (what Vercel serves).
import { build } from 'vite';
import { spawnSync } from 'node:child_process';
import { activeProject, ROOT } from './lib/project.mjs';

process.env.PROJECT = activeProject();
if (!process.argv.includes('--no-validate')) {
  const r = spawnSync(process.execPath, [ROOT + '/scripts/validate.mjs', '--project', process.env.PROJECT], { stdio: 'inherit' });
  if (r.status !== 0) { console.log('\n✗ Fix the data first / perbaiki data dulu (npm run validate).'); process.exit(1); }
}
await build({ root: ROOT, configFile: ROOT + '/vite.config.js', logLevel: 'warn' });
console.log(`✓ Built "${process.env.PROJECT}" into dist/ · Preview: npm run preview`);
