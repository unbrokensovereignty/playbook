// Turns the game content downloaded from valorant-api.com into what the app ships with: small
// images in assets/ (which the build inlines), the agents' abilities and the maps' callouts in
// src/core/kb/content.gen.ts, and where you can walk on each minimap in src/core/kb/floor.gen.ts.
//
//   npm run art -- <folder>
//
// <folder> holds agents.json and maps.json (the API's /v1/agents and /v1/maps), agents/<agent>.png
// (portraits), agents/<agent>-<slot>.png (ability icons: grenade, ability1, ability2, ultimate),
// maps/<map>-minimap.png, maps/<map>-list.png and roles/<role>.png: `npm run fetch-art -- <folder>`
// downloads all of it (see CONTRIBUTING.md).
// An agent or map without art just shows its name; nothing else needs to change.
import sharp from 'sharp';
import { floorFile } from './floor.mjs';
import { withoutFrame } from './frame.mjs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2];
if (!src) { console.error('Usage: npm run art -- <folder with the downloaded art>'); process.exit(1); }
const out = join(root, 'assets');

/** [folder in the download, file name pattern, folder in assets/, size in px, quality] */
const JOBS = [
  ['agents', /^([a-z]+)\.png$/, 'agents', 112, 82],
  ['agents', /^([a-z]+-(?:grenade|ability1|ability2|ultimate))\.png$/, 'abilities', 48, 90],
  ['maps', /^([a-z]+)-minimap\.png$/, 'minimaps', 720, 82],
  ['maps', /^([a-z]+)-list\.png$/, 'banners', 0, 80],
  ['roles', /^([a-z]+)\.png$/, 'roles', 48, 90],
];

let n = 0;
for (const [from, pattern, to, size, quality] of JOBS) {
  await mkdir(join(out, to), { recursive: true });
  for (const f of (await readdir(join(src, from))).sort()) {
    const m = f.match(pattern);
    if (!m) continue;
    // the banners lose the thin white frame some of them come with, so they fill their cards
    let img = to === 'banners' ? await withoutFrame(join(src, from, f)) : sharp(join(src, from, f));
    if (size) img = img.resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
    await img.webp({ quality, alphaQuality: 90, effort: 6 }).toFile(join(out, to, `${m[1]}.webp`));
    n++;
  }
}
console.log(`Prepared ${n} images in assets/.`);

// ---------------------------------------------------------------- abilities and callouts

const slug = (name) => name.toLowerCase().replace(/[^a-z]/g, '');
const tidy = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
const KEYS = { Grenade: 'C', Ability1: 'Q', Ability2: 'E', Ultimate: 'X', Passive: 'Passive' };
// the API's slots don't match the keys players press for a few agents
const KEY_FIXES = { phoenix: { Ability1: 'E', Ability2: 'Q' }, deadlock: { Grenade: 'E', Ability2: 'C' } };
const ORDER = ['C', 'Q', 'E', 'X', 'Passive'];
// abilities with two names in the API, by the name players use
const NAME_FIXES = { astra: { ability2: 'Nebula', ultimate: 'Cosmic Divide' } };
/** "DIMENSIONAL DRIFT" → "Dimensional Drift"; names with any small letters ("FRAG/ment") stay as they are. */
const nameCase = (t) => (/[a-z]/.test(t) ? t : t.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()));
const agents = JSON.parse(await readFile(join(src, 'agents.json'), 'utf8')).data.filter((a) => a.isPlayableCharacter);
const kits = {};
for (const a of agents.sort((x, y) => slug(x.displayName).localeCompare(slug(y.displayName)))) {
  const id = slug(a.displayName);
  const keyOf = (slot) => KEY_FIXES[id]?.[slot] ?? KEYS[slot];
  kits[id] = {
    about: tidy(a.description),
    colors: (a.backgroundGradientColors ?? []).slice(0, 3).map((c) => `#${c.slice(0, 6)}`),
    abilities: a.abilities.filter((x) => KEYS[x.slot]).sort((x, y) => ORDER.indexOf(keyOf(x.slot)) - ORDER.indexOf(keyOf(y.slot)))
      .map((x) => ({ key: keyOf(x.slot), slot: x.slot.toLowerCase(), name: NAME_FIXES[id]?.[x.slot.toLowerCase()] ?? nameCase(tidy(x.displayName)), text: tidy(x.description) })),
  };
}
const maps = JSON.parse(await readFile(join(src, 'maps.json'), 'utf8')).data.filter((m) => /Sites$/.test(m.tacticalDescription ?? '') && m.callouts);
const callouts = {};
for (const m of maps.sort((x, y) => slug(x.displayName).localeCompare(slug(y.displayName)))) {
  // the API's world position → a fraction of the minimap image (x across, y down)
  callouts[slug(m.displayName)] = m.callouts.map((c) => {
    const x = c.location.y * m.xMultiplier + m.xScalarToAdd, y = c.location.x * m.yMultiplier + m.yScalarToAdd;
    return [`${c.superRegionName} ${c.regionName}`, Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
  }).sort((p, q) => p[0].localeCompare(q[0]));
}
const gen = `// Made by tools/prepare-art.mjs from the game's own content: don't edit by hand.
// Each agent's description, colors and abilities, and each map's callouts with their places on the
// minimap (fractions of its width and height).

export interface KitAbility { key: 'C' | 'Q' | 'E' | 'X' | 'Passive'; slot: string; name: string; text: string }
export interface Kit { about: string; colors: string[]; abilities: KitAbility[] }

export const KITS: Record<string, Kit> = ${JSON.stringify(kits, null, 1)};

export const CALLOUTS: Record<string, [name: string, x: number, y: number][]> = ${JSON.stringify(callouts)};
`;
await writeFile(join(root, 'src/core/kb/content.gen.ts'), gen);
console.log(`Wrote the abilities of ${agents.length} agents and the callouts of ${maps.length} maps.`);

// the floor each minimap's routes walk on, read from the new minimaps
await writeFile(join(root, 'src/core/kb/floor.gen.ts'), await floorFile());
console.log('Wrote the floors of the minimaps.');
