// Switch the active project (stored in .active-project; dev, build, checks and deploy use it).
//   npm run use-project <name>        no name: list the projects
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, PROJECTS, activeProject } from './lib/project.mjs';

const name = process.argv.slice(2).find(a => !a.startsWith('--'));
const list = readdirSync(PROJECTS, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('_') && existsSync(join(PROJECTS, d.name, 'zoning.js'))).map(d => d.name);
if (!name) {
  const cur = activeProject();
  console.log('Projects / proyek:\n' + list.map(n => (n === cur ? ' * ' : '   ') + n).join('\n') + '\n\nUsage: npm run use-project <name>');
  process.exit(0);
}
if (!list.includes(name)) {
  console.log(`✗ No project "${name}" / proyek tidak ditemukan. Available: ${list.join(', ')}`);
  process.exit(1);
}
writeFileSync(join(ROOT, '.active-project'), name + '\n');
console.log(`✓ Active project / proyek aktif: ${name}`);
