import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export async function buildBrowser() {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const banner = `/*! Nano Lightbox v${pkg.version} | MIT | https://github.com/VladimirIvanin/nano-lightbox */`;
  await mkdir('browser-build', { recursive: true });
  await build({
    entryPoints: ['src/instances.js'], outfile: 'browser-build/nano-lightbox.min.js',
    bundle: true, format: 'iife', globalName: 'NanoLightbox', minify: true,
    banner: { js: banner }, target: ['chrome100', 'firefox100', 'safari15.5']
  });
  await build({
    stdin: { contents: '@import "./core.css"; @import "./gallery.css"; @import "./thumbs.css";', resolveDir: resolve('src'), loader: 'css' },
    outfile: 'browser-build/nano-lightbox.css', bundle: true, minify: true, banner: { css: banner }
  });
  const js = await readFile('browser-build/nano-lightbox.min.js');
  const css = await readFile('browser-build/nano-lightbox.css');
  const compressed = gzipSync(js, { level: 9 });
  if (compressed.length > 10240 || gzipSync(css, { level: 9 }).length > 2048) throw new Error('Browser gzip budget exceeded');
  await writeFile('browser-build/nano-lightbox.min.js.gz', compressed);
  return { script: compressed.length, css: gzipSync(css, { level: 9 }).length };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) console.log(await buildBrowser());
