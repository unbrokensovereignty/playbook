// Downloads the game's content from valorant-api.com (a free community copy of it, no key needed)
// into a folder that `npm run art` then turns into what the app ships with:
//
//   npm run fetch-art -- <folder>
//   npm run art -- <folder>
//
// <folder> gets agents.json and maps.json, agents/<agent>.png (portraits), agents/<agent>-<slot>.png
// (ability icons), maps/<map>-minimap.png and maps/<map>-list.png, and roles/<role>.png. Anything
// the API doesn't have yet (a new agent's art, say) is skipped and listed at the end.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const API = process.env['ART_API'] ?? 'https://valorant-api.com';
const dir = process.argv[2];
if (!dir) { console.error('Usage: npm run fetch-art -- <folder to download into>'); process.exit(1); }
const out = resolve(dir);
for (const d of ['agents', 'maps', 'roles']) await mkdir(join(out, d), { recursive: true });

// the same names tools/prepare-art.mjs and the app use ("KAY/O" → "kayo")
const slug = (name) => name.toLowerCase().replace(/[^a-z]/g, '');
const missing = [];

async function json(path, file) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`${API + path}: ${res.status} ${res.statusText}`);
  const text = await res.text();
  await writeFile(join(out, file), text);
  return JSON.parse(text).data;
}

const jobs = [];
const image = (url, file) => {
  if (!url) { missing.push(file); return; }
  jobs.push([url, file]);
};

const agents = (await json('/v1/agents?isPlayableCharacter=true', 'agents.json')).filter((a) => a.isPlayableCharacter);
const roles = new Map();
for (const a of agents) {
  const id = slug(a.displayName);
  image(a.displayIconSmall ?? a.displayIcon, `agents/${id}.png`);
  for (const ab of a.abilities ?? []) if (ab.slot !== 'Passive') image(ab.displayIcon, `agents/${id}-${ab.slot.toLowerCase()}.png`);
  if (a.role) roles.set(slug(a.role.displayName), a.role.displayIcon);
}
for (const [role, url] of roles) image(url, `roles/${role}.png`);
const maps = (await json('/v1/maps', 'maps.json')).filter((m) => /Sites$/.test(m.tacticalDescription ?? ''));
for (const m of maps) {
  const id = slug(m.displayName);
  image(m.displayIcon, `maps/${id}-minimap.png`);
  image(m.listViewIcon, `maps/${id}-list.png`);
}

// a few at a time, so the site isn't flooded
let done = 0;
const queue = [...jobs];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const [url, file] = job;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      await writeFile(join(out, file), Buffer.from(await res.arrayBuffer()));
      done++;
    } catch (e) {
      missing.push(`${file} (${e.message})`);
    }
  }
}));

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
console.log(`Downloaded ${count(agents.length, 'agent')}, ${count(maps.length, 'map')} and ${count(done, 'image')} into ${out}.`);
if (missing.length) console.log(`Not available:\n  ${missing.sort().join('\n  ')}`);
console.log('Next: npm run art -- <same folder>');
