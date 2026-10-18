// Node module hooks registered by scripts/lib/project.mjs (useProject):
//   '@project/<file>'  → projects/<active>/<file>
//   <project>/*.json   → loaded as an ES module (export default …), so the engine can import the
//                        project's JSON the same way in Node and in Vite, without import attributes.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

let dir = null;
export async function initialize(data) { dir = data.dir; }

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@project/')) return { url: new URL(specifier.slice('@project/'.length), dir).href, shortCircuit: true };
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.startsWith(dir) && url.endsWith('.json')) {
    const src = await readFile(fileURLToPath(url), 'utf8');
    return { format: 'module', source: 'export default ' + src + ';\n', shortCircuit: true };
  }
  return next(url, context);
}
