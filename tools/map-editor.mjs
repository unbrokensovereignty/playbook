// Builds the map editor: one HTML file, apart from the app, for moving callouts and the minimap's
// marks (orbs, doors, teleporters and the rest) by hand and saving the result as a file of edits.
// It starts from the app's own data, so build it again after the callouts or features change.
// tools/map-edits.mjs puts a file of edits back into the app's data.
//
//   node --experimental-strip-types tools/map-editor.mjs            → dist/Playbook-map-editor-v<version>.html
//   node --experimental-strip-types tools/map-editor.mjs --out FILE → write somewhere else
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, FEATURE_KINDS } from '../src/core/kb/features.ts';
import { FLOOR_SIZE, FLOORS } from '../src/core/kb/floor.gen.ts';
import { MAPS } from '../src/core/kb/maps.ts';
import { PLAYS } from '../src/core/kb/plays.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
const outFile = outArg >= 0 ? resolve(args[outArg + 1]) : resolve(root, 'dist', `Playbook-map-editor-v${version}.html`);

const art = {};
for (const f of (await readdir(resolve(root, 'assets/minimaps'))).filter((f) => f.endsWith('.webp'))) {
  art[f.replace(/\.webp$/, '')] = `data:image/webp;base64,${(await readFile(resolve(root, 'assets/minimaps', f))).toString('base64')}`;
}
const font = (await readFile(resolve(root, 'node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2'))).toString('base64');

const data = {
  version,
  builtAt: new Date().toISOString().slice(0, 10),
  floorSize: FLOOR_SIZE,
  kinds: FEATURE_KINDS.map(({ kind, name }) => ({ kind, name, ends: kind === 'teleporter' || kind === 'zipline' ? 2 : kind === 'rope' ? 'maybe' : 1 })),
  maps: MAPS.map((m) => ({
    id: m.id,
    name: m.name,
    art: art[m.id] ?? null,
    floor: FLOORS[m.id] ?? null,
    aka: m.aka ?? {},
    sites: m.sites.map((x) => x.id),
    callouts: m.callouts.map((c) => ({ name: c.name, x: c.x, y: c.y })),
    features: (FEATURES[m.id] ?? []).map((f) => ({ kind: f.kind, at: [...f.at], ...(f.to ? { to: [...f.to] } : {}), about: f.about, angle: f.angle ?? 0 })),
    inPlays: [...new Set(PLAYS.filter((p) => p.map === m.id).flatMap((p) => p.steps.flatMap((s) => s.route)))].sort(),
  })),
};

const page = (await readFile(resolve(root, 'tools/map-editor/editor.html'), 'utf8'))
  .replace('/*FONT*/', font)
  .replace('/*DATA*/null', () => JSON.stringify(data).replace(/</g, '\\u003c'))
  .replaceAll('{{VERSION}}', version);
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, page);
process.stdout.write(`Wrote ${outFile} (${(page.length / 1024).toFixed(0)} KB)\n`);
