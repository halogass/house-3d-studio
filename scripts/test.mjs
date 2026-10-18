// Engine tests (headless, no browser): runs every scripts/tests/*.mjs for the active project, plus
// the checks (validate, walkability, interior) and the generic-engine fixture in scripts/tests/fixtures.
//   npm run test [-- --project <name>]       node scripts/test.mjs --only drive
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { activeProject, ROOT } from './lib/project.mjs';

const project = activeProject();
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1] : null; })();
const FIX = join('scripts', 'tests', 'fixtures', 'mini-lift');
const jobs = [
  ['validate', 'scripts/validate.mjs', project],
  ['check', 'scripts/check.mjs', project],
  ['check-interior', 'scripts/check-interior.mjs', project],
  ...readdirSync(join(ROOT, 'scripts', 'tests')).filter(f => f.endsWith('.mjs')).sort().map(f => [f.replace('.mjs', ''), join('scripts', 'tests', f), project]),
  // the same engine on a second, different house (lift, straight stair, gable / shed roofs, road east, northern hemisphere)
  ['fixture: validate', 'scripts/validate.mjs', FIX],
  ['fixture: check', 'scripts/check.mjs', FIX],
  ['fixture: check-interior', 'scripts/check-interior.mjs', FIX],
  ['fixture: lift', join('scripts', 'tests', 'lift.mjs'), FIX],
  ['fixture: staged', join('scripts', 'tests', 'staged.mjs'), FIX],
].filter(([name]) => !only || name.includes(only));

const results = [];
for (const [name, file, proj] of jobs) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(ROOT, file), '--project', proj], { cwd: ROOT, encoding: 'utf8' });
  const ok = r.status === 0;
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  results.push({ name, ok, secs });
  console.log(`${ok ? '✓' : '✗'} ${name} (${secs} s)`);
  if (!ok) console.log((r.stdout + r.stderr).split('\n').map(l => '    ' + l).join('\n'));
}
const failed = results.filter(r => !r.ok);
console.log(`\n${failed.length ? '✗' : '✓'} ${results.length - failed.length}/${results.length} passed / lulus`);
process.exit(failed.length ? 1 : 0);
