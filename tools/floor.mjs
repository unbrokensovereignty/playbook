// Reads where you can walk on each minimap (assets/minimaps/<map>.webp) and writes it to
// src/core/kb/floor.gen.ts, so the minimap can draw a route along the corridors instead of
// straight through the walls. Run it whenever the minimaps change (`npm run art` does):
//
//   node tools/floor.mjs           writes the file
//   node tools/floor.mjs --check   fails if the file is out of date with the minimaps
//
// A minimap is see-through outside the map, so the floor is every solid pixel, apart from the
// teal lines Bind draws between its teleporters. Each map becomes a grid of FLOOR_SIZE × FLOOR_SIZE
// cells, a cell being floor when at least half its pixels are, one bit per cell.
import sharp from 'sharp';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FLOOR_SIZE = 144;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src/core/kb/floor.gen.ts');

/** The floor of one minimap, as base64 bits, row by row from the top left. */
export async function floorOf(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const bits = new Uint8Array(Math.ceil((FLOOR_SIZE * FLOOR_SIZE) / 8));
  for (let cy = 0; cy < FLOOR_SIZE; cy++) {
    for (let cx = 0; cx < FLOOR_SIZE; cx++) {
      const x0 = Math.floor((cx * w) / FLOOR_SIZE), x1 = Math.floor(((cx + 1) * w) / FLOOR_SIZE);
      const y0 = Math.floor((cy * h) / FLOOR_SIZE), y1 = Math.floor(((cy + 1) * h) / FLOOR_SIZE);
      let on = 0, all = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * ch;
          const teal = data[i + 1] - data[i] > 60;
          if (data[i + 3] > 128 && !teal) on++;
          all++;
        }
      }
      if (on * 2 >= all) { const k = cy * FLOOR_SIZE + cx; bits[k >> 3] |= 1 << (k & 7); }
    }
  }
  return Buffer.from(bits).toString('base64');
}

export async function floorFile() {
  const dir = join(root, 'assets/minimaps');
  const floors = {};
  for (const f of (await readdir(dir)).filter((f) => f.endsWith('.webp')).sort()) floors[f.replace(/\.webp$/, '')] = await floorOf(join(dir, f));
  return `// Made by tools/floor.mjs from the minimaps in assets/minimaps: don't edit by hand.
// Where you can walk on each minimap, as a grid of FLOOR_SIZE × FLOOR_SIZE cells from the top left,
// row by row, one bit per cell (1 = floor), in base64.

export const FLOOR_SIZE = ${FLOOR_SIZE};

export const FLOORS: Record<string, string> = ${JSON.stringify(floors, null, 1)};
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = await floorFile();
  if (process.argv.includes('--check')) {
    const now = await readFile(out, 'utf8').catch(() => '');
    if (now !== text) { console.error('src/core/kb/floor.gen.ts is out of date with the minimaps: run node tools/floor.mjs'); process.exit(1); }
    console.log('The floors match the minimaps.');
  } else {
    await writeFile(out, text);
    console.log(`Wrote the floors of ${Object.keys(JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))).length} maps.`);
  }
}
