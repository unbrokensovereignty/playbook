// Puts a file of edits from the map editor (tools/map-editor.mjs) into the app's data: callouts that
// moved go into their map's `places` in src/core/kb/maps.ts, and each edited map's marks are written
// out again in src/core/kb/features.ts, with how far each is turned. A renamed, new or removed
// callout is listed for a hand to make, since plays and the game's content use the names. Run `npm run check` afterwards: the specs
// check that everything still stands on the floor.
//
//   node --experimental-strip-types tools/map-edits.mjs <edits.json>          → changes the two files
//   node --experimental-strip-types tools/map-edits.mjs <edits.json> --dry-run → only says what it would do
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KINDS = ['orb', 'door', 'breakable', 'wall', 'teleporter', 'rope', 'zipline', 'drop', 'plant', 'safeplant'];
const r3 = (v) => Math.round(Math.min(1, Math.max(0, Number(v))) * 1000) / 1000;
const isSpot = (v) => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
const close = (a, b) => Math.abs(a[0] - b[0]) <= 0.0005 && Math.abs(a[1] - b[1]) <= 0.0005;
const quote = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const spotText = ([x, y]) => `[${x}, ${y}]`;
/** A mark's turn as whole degrees from 0 to 359 (0 is not turned), or null when it can't be read. */
const turn = (v) => (v === undefined ? 0 : typeof v === 'number' && Number.isFinite(v) ? ((Math.round(v) % 360) + 360) % 360 : null);

/**
 * The two files' new text for a file of edits, and what was done and what's left to do by hand.
 * `maps` gives each map's callouts as the app has them now (with `places` applied) and as the game's
 * content has them; `inPlays` the callout names plays use.
 */
export function applyEdits(edits, { mapsTs, featuresTs, maps }) {
  if (!edits || edits.format !== 'playbook-map-edits' || typeof edits.maps !== 'object' || !edits.maps) throw new Error('not a map edits file from the map editor');
  const done = [], todo = [];
  for (const [id, e] of Object.entries(edits.maps)) {
    const m = maps.find((x) => x.id === id);
    if (!m) { todo.push(`${id}: there's no such map`); continue; }
    if (!Array.isArray(e.callouts) || !Array.isArray(e.features)) throw new Error(`${m.name}: the edits are missing their callouts or marks`);

    // callouts that kept their name and moved go into `places`
    const places = { ...(placesIn(mapsTs, id) ?? {}) };
    let moved = 0;
    for (const c of e.callouts) {
      if (!c || typeof c.name !== 'string' || !isSpot([c.x, c.y])) throw new Error(`${m.name}: a callout can't be read`);
      const at = [r3(c.x), r3(c.y)];
      if (c.new) { todo.push(`${m.name}: add the new callout "${c.name}" at ${spotText(at)}`); continue; }
      if (typeof c.from === 'string' && c.from !== c.name) {
        todo.push(`${m.name}: rename "${c.from}" to "${c.name}"${m.inPlays.includes(c.from) ? ' (plays use it)' : ''}, at ${spotText(at)}`);
        continue;
      }
      const now = m.callouts.find((x) => x.name === c.name);
      if (!now) { todo.push(`${m.name}: "${c.name}" isn't a callout the app knows`); continue; }
      if (close(now.at, at)) continue;
      const game = m.game[c.name];
      if (game && close(game, at)) delete places[c.name]; else places[c.name] = at;
      moved++;
    }
    for (const name of e.removedCallouts ?? []) todo.push(`${m.name}: remove the callout "${name}"${m.inPlays.includes(name) ? ' (plays use it)' : ''}`);
    if (moved) {
      mapsTs = setPlaces(mapsTs, id, places);
      done.push(`${m.name}: moved ${moved} callout${moved === 1 ? '' : 's'}`);
    }

    // the marks are written out again whole, when they changed
    const features = e.features.map((f) => {
      const angle = f && turn(f.angle);
      if (!f || !KINDS.includes(f.kind) || !isSpot(f.at) || typeof f.about !== 'string' || angle === null) throw new Error(`${m.name}: a mark can't be read`);
      return { kind: f.kind, at: [r3(f.at[0]), r3(f.at[1])], ...(isSpot(f.to) ? { to: [r3(f.to[0]), r3(f.to[1])] } : {}), about: f.about.trim().replace(/\.$/, ''), ...(angle ? { angle } : {}) };
    });
    const block = featuresBlock(id, features);
    const old = featuresTs.match(blockRe(id));
    if ((old?.[0] ?? '') !== block) {
      featuresTs = old ? featuresTs.replace(blockRe(id), () => block) : featuresTs.replace(/\n};\n/, () => `\n${block.slice(1)}};\n`);
      done.push(`${m.name}: wrote out its ${features.length} mark${features.length === 1 ? '' : 's'} again`);
    }
  }
  return { mapsTs, featuresTs, done, todo };
}

/** The `places` of a map in maps.ts, read back, or null when it has none. */
function placesIn(text, id) {
  const [start, end] = mapBlock(text, id);
  const line = text.slice(start, end).match(/\n {4}places: (\{.*\}),\n/);
  if (!line) return null;
  const out = {};
  for (const [, name, x, y] of line[1].matchAll(/'((?:[^'\\]|\\.)*)': \[([\d.]+), ([\d.]+)\]/g)) out[name.replace(/\\(.)/g, '$1')] = [Number(x), Number(y)];
  return out;
}
function setPlaces(text, id, places) {
  const [start, end] = mapBlock(text, id);
  const names = Object.keys(places).sort();
  const line = names.length ? `    places: { ${names.map((n) => `${quote(n)}: ${spotText(places[n])}`).join(', ')} },\n` : '';
  const block = text.slice(start, end);
  const next = /\n {4}places: \{.*\},\n/.test(block)
    ? block.replace(/\n {4}places: \{.*\},\n/, () => `\n${line}`)
    : block.replace(/\n {4}keys: .*\n/, (m) => m + line);
  return text.slice(0, start) + next + text.slice(end);
}
/** Where a map's entry in maps.ts starts and ends. */
function mapBlock(text, id) {
  const start = text.indexOf(`\n    id: '${id}',`);
  if (start < 0) throw new Error(`maps.ts has no map "${id}"`);
  const after = text.indexOf("\n    id: '", start + 1);
  return [start, after < 0 ? text.indexOf('\n];', start) : after];
}
const blockRe = (id) => new RegExp(`\\n  ${id}: \\[\\n[\\s\\S]*?\\n  \\],\\n`);
function featuresBlock(id, features) {
  if (!features.length) return '';
  const row = (f) => `    { kind: ${quote(f.kind)}, at: ${spotText(f.at)}, ${f.to ? `to: ${spotText(f.to)}, ` : ''}about: ${quote(f.about)}${f.angle ? `, angle: ${f.angle}` : ''} },`;
  return `\n  ${id}: [\n${features.map(row).join('\n')}\n  ],\n`;
}

// run from the command line
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dry = process.argv.includes('--dry-run');
  if (!file) { process.stderr.write('Give it the edits file: node --experimental-strip-types tools/map-edits.mjs <edits.json>\n'); process.exit(1); }
  const { MAPS } = await import('../src/core/kb/maps.ts');
  const { CALLOUTS } = await import('../src/core/kb/content.gen.ts');
  const { PLAYS } = await import('../src/core/kb/plays.ts');
  const maps = MAPS.map((m) => ({
    id: m.id,
    name: m.name,
    callouts: m.callouts.map((c) => ({ name: c.name, at: [c.x, c.y] })),
    game: Object.fromEntries((CALLOUTS[m.id] ?? []).map(([name, x, y]) => [name, [x, y]])),
    inPlays: [...new Set(PLAYS.filter((p) => p.map === m.id).flatMap((p) => p.steps.flatMap((s) => s.route)))],
  }));
  const mapsFile = resolve(root, 'src/core/kb/maps.ts'), featuresFile = resolve(root, 'src/core/kb/features.ts');
  const out = applyEdits(JSON.parse(await readFile(resolve(file), 'utf8')), { mapsTs: await readFile(mapsFile, 'utf8'), featuresTs: await readFile(featuresFile, 'utf8'), maps });
  if (!dry) {
    await writeFile(mapsFile, out.mapsTs);
    await writeFile(featuresFile, out.featuresTs);
  }
  process.stdout.write([
    out.done.length ? `${dry ? 'Would do' : 'Done'}:\n${out.done.map((d) => `  ${d}`).join('\n')}` : 'Nothing to change in the data.',
    ...(out.todo.length ? [`Left to do by hand:\n${out.todo.map((d) => `  ${d}`).join('\n')}`] : []),
    ...(dry || !out.done.length ? [] : ['Now run npm run check: the specs check that everything stands on the floor.']),
  ].join('\n') + '\n');
}
