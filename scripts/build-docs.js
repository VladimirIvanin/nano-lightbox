import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';

const output = resolve('site-dist');
if (dirname(output) !== process.cwd()) throw new Error('Documentation output must be inside the workspace');
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const path of ['index.html', 'README.md', 'LICENSE', 'docs', 'examples', 'dist', 'browser-build']) {
  await cp(resolve(path), join(output, path), { recursive: true });
}
await writeFile(join(output, '.nojekyll'), '');
console.log(`Documentation ready: ${output}`);
