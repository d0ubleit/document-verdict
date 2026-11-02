#!/usr/bin/env node
// Thin CLI over the masker extraction module (single htmlToText implementation).
// Usage: node scripts/extract.mjs <input-file-or-dir> <output-dir>
import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { extractText } from '../packages/masker/src/extract/index.ts';

async function processPath(input, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const info = await stat(input);
  const files = info.isDirectory() ? (await readdir(input)).map((f) => join(input, f)) : [input];
  let ok = 0;
  let failed = 0;
  for (const file of files) {
    try {
      const buffer = await readFile(file);
      const doc = await extractText({
        name: basename(file),
        arrayBuffer: async () => buffer.buffer,
      });
      const outName = basename(file).replace(/\.[^.]+$/, '') + '.txt';
      await writeFile(join(outputDir, outName), doc.text, 'utf8');
      console.log(`OK   ${doc.fileName} (${doc.text.length} chars, ${doc.format})`);
      ok += 1;
    } catch (error) {
      console.error(`FAIL ${basename(file)}: ${error.message}`);
      failed += 1;
    }
  }
  console.log(`Done: ${ok} extracted, ${failed} failed`);
}

const [, , inputArg, outputArg] = process.argv;
if (!inputArg || !outputArg) {
  console.error('Usage: node scripts/extract.mjs <input-file-or-dir> <output-dir>');
  process.exit(1);
}
processPath(resolve(inputArg), resolve(outputArg)).catch((error) => {
  console.error(error);
  process.exit(1);
});
