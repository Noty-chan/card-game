import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = resolve(rootDir, 'src/index.ts');
const thresholdBytes = 42 * 1024;

const result = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2019',
  minify: true,
  treeShaking: true,
  write: false,
});

const output = result.outputFiles?.[0];
if (!output) {
  throw new Error('Сборка не вернула выходной файл.');
}

const rawSize = output.contents.length;
const gzipped = gzipSync(output.contents);
const gzipSize = gzipped.length;
const status = gzipSize <= thresholdBytes ? 'OK' : 'ПРЕВЫШЕН';

const toKb = (bytes) => (bytes / 1024).toFixed(2);

console.log('Размер headless-ядра (minified):');
console.log(`- raw: ${rawSize} B (${toKb(rawSize)} KB)`);
console.log(`- gzip: ${gzipSize} B (${toKb(gzipSize)} KB)`);
console.log(`Порог: 42 KB gzip -> ${status}`);

if (gzipSize > thresholdBytes) {
  process.exitCode = 1;
}
