import { build } from 'esbuild';
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import { buildBrowser } from './build-browser.js';

await mkdir('dist', { recursive: true });
// Only generated files directly inside this project's dist directory are removed.
for (const name of await readdir('dist')) {
  if (/^(?:chunk-[\w-]+|core|auto|gallery|providers|thumbs|instances|nano-lightbox)\.(?:js|css)$|^sizes\.json$/.test(name)) await unlink(`dist/${name}`);
}
const result = await build({
  entryPoints: ['core', 'auto', 'gallery', 'providers', 'thumbs', 'instances'].map(name => `src/${name}.js`),
  outdir: 'dist', bundle: true, splitting: true, format: 'esm', minify: true,
  target: ['chrome100', 'firefox100', 'safari15.5'], metafile: true
});
await build({ entryPoints: ['src/instances.js'], outfile: 'dist/nano-lightbox.js', bundle: true, format: 'iife', globalName: 'NanoLightbox', minify: true, target: ['chrome100', 'firefox100', 'safari15.5'] });
for (const name of ['core', 'gallery', 'thumbs']) {
  await build({ entryPoints: [`src/${name}.css`], outfile: `dist/${name}.css`, minify: true });
}
const names = await readdir('dist');
const sizes = {};
const dependencies = Object.fromEntries(Object.entries(result.metafile.outputs).map(([path, output]) => [basename(path), output.imports.map(item => ({ name: basename(item.path), dynamic: item.kind === 'dynamic-import' }))]));
for (const name of names.filter(name => /\.(js|css)$/.test(name))) {
  const content = await readFile(`dist/${name}`, 'utf8');
  sizes[name] = gzipSync(content, { level: 9 }).length;
}
function total(entries, dynamic = true) {
  const seen = new Set();
  function visit(name) {
    if (seen.has(name)) return;
    seen.add(name);
    dependencies[name].filter(item => dynamic || !item.dynamic).forEach(item => visit(item.name));
  }
  entries.forEach(visit);
  return [...seen].reduce((sum, name) => sum + sizes[name], 0);
}
// Modal-only excludes dynamic gallery imports, which are never requested there.
const core = total(['core.js']);
const modal = total(['auto.js'], false);
const gallery = total(['auto.js', 'gallery.js'], false);
const full = total(['auto.js']);
const instances = total(['instances.js']);
const script = sizes['nano-lightbox.js'];
const css = ['core.css', 'gallery.css', 'thumbs.css'].reduce((sum, name) => sum + sizes[name], 0);
const browser = await buildBrowser();
const report = { gzipBytes: { core, modal, gallery, thumbnailsIncrement: full - gallery, full, instances, script, css, browserScript: browser.script, browserCss: browser.css }, files: sizes };
console.log(JSON.stringify(report, null, 2));
await writeFile('dist/sizes.json', JSON.stringify(report, null, 2));
if (core > 1024 || full > 5120 || css > 2048 || instances > 10240 || script > 10240) throw new Error('Gzip budget exceeded');
