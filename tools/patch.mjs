// What changed in the game's content since a release, as a checklist of what to review: after
// `npm run art` refreshes src/core/kb/content.gen.ts for a new patch,
//
//   node --experimental-strip-types tools/patch.mjs [<commit>]    compares with <commit> (origin/main, the last release, by default)
//
// lists the agents and maps that came or went, every ability whose name or text changed (word by
// word), and every callout that came, went or moved, each with what in the app leans on it: the
// strengths in agents.ts that cite the ability's key, its kit rules in kitfit.ts, and the lines in
// the knowledge base that name it. It writes Markdown to standard output; nothing is changed.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = 'src/core/kb/content.gen.ts';
/** A callout counts as moved when its place on the minimap moved this far (a share of the minimap's size). */
export const MOVED = 0.03;

/** Ability text as players read it: the game's marks (<whitebold>…</>) taken out. */
const plain = (text) => text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/** The words of `a` and `b`, with those taken out as [-…-] and those put in as {+…+}, as `git diff --word-diff` shows them. */
export function wordDiff(a, b) {
  const x = a.split(' ').filter(Boolean), y = b.split(' ').filter(Boolean);
  // the longest run of words both share, the usual way
  const n = x.length, m = y.length, L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0, gone = [], come = [];
  const flush = () => {
    if (gone.length) out.push(`[-${gone.join(' ')}-]`);
    if (come.length) out.push(`{+${come.join(' ')}+}`);
    gone = []; come = [];
  };
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) { flush(); out.push(x[i]); i++; j++; }
    else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) come.push(y[j++]);
    else gone.push(x[i++]);
  }
  flush();
  return out.join(' ');
}

/**
 * The changes between two copies of content.gen.ts (`was` and `now`, each { KITS, CALLOUTS }): agents
 * and maps that came or went, abilities whose name or text changed, and callouts that came, went or moved.
 */
export function contentChanges(was, now) {
  const ids = (o) => Object.keys(o).sort();
  const agents = { added: ids(now.KITS).filter((id) => !was.KITS[id]), removed: ids(was.KITS).filter((id) => !now.KITS[id]) };
  const abilities = [];
  for (const id of ids(now.KITS).filter((x) => was.KITS[x])) {
    for (const ab of now.KITS[id].abilities) {
      const old = was.KITS[id].abilities.find((o) => o.key === ab.key);
      if (!old) { abilities.push({ agent: id, key: ab.key, name: ab.name, was: '', now: plain(ab.text), renamed: undefined, marksOnly: false }); continue; }
      const renamed = old.name !== ab.name ? old.name : undefined;
      if (!renamed && old.text === ab.text) continue;
      const a = plain(old.text), b = plain(ab.text);
      abilities.push({ agent: id, key: ab.key, name: ab.name, was: a, now: b, renamed, marksOnly: a === b && !renamed });
    }
  }
  const maps = { added: ids(now.CALLOUTS).filter((id) => !was.CALLOUTS[id]), removed: ids(was.CALLOUTS).filter((id) => !now.CALLOUTS[id]) };
  const callouts = [];
  for (const map of ids(now.CALLOUTS).filter((x) => was.CALLOUTS[x])) {
    const before = new Map(was.CALLOUTS[map].map(([name, x, y]) => [name, [x, y]]));
    const after = new Map(now.CALLOUTS[map].map(([name, x, y]) => [name, [x, y]]));
    for (const [name] of after) if (!before.has(name)) callouts.push({ map, name, change: 'added' });
    for (const [name] of before) if (!after.has(name)) callouts.push({ map, name, change: 'removed' });
    for (const [name, [x, y]] of after) {
      const b = before.get(name);
      if (b && Math.hypot(x - b[0], y - b[1]) >= MOVED) callouts.push({ map, name, change: 'moved' });
    }
  }
  return { agents, abilities, maps, callouts };
}

/** Lines in the knowledge base (src/core/kb, but not the game's own content) that name `text`, as "file:line". */
function namedIn(text, files) {
  const out = [];
  for (const [file, lines] of files) lines.forEach((line, i) => { if (line.includes(text)) out.push(`${file}:${i + 1}`); });
  return out;
}

async function main() {
  const ref = process.argv[2] ?? 'origin/main';
  const old = execFileSync('git', ['show', `${ref}:${CONTENT}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
  const from = JSON.parse(execFileSync('git', ['show', `${ref}:package.json`], { cwd: root, encoding: 'utf8' })).version;
  const tmp = await mkdtemp(join(tmpdir(), 'patch-'));
  try {
    await writeFile(join(tmp, 'content.gen.ts'), old);
    const was = await import(pathToFileURL(join(tmp, 'content.gen.ts')).href);
    const now = await import(pathToFileURL(join(root, CONTENT)).href);
    const { AGENTS, agentById } = await import(pathToFileURL(join(root, 'src/core/kb/agents.ts')).href);
    const { agentRules, ruleWhyAt } = await import(pathToFileURL(join(root, 'src/core/kb/kitfit.ts')).href);
    const { MAPS } = await import(pathToFileURL(join(root, 'src/core/kb/maps.ts')).href);
    const c = contentChanges(was, now);

    // the knowledge base, to find what names a changed ability or callout
    const kb = ['agents.ts', 'kitfit.ts', 'kits.ts', 'maps.ts', 'plays.ts', 'tips.ts', 'counters.ts', 'synergy.ts', 'new-agents.ts'];
    const files = await Promise.all(kb.map(async (f) => [`src/core/kb/${f}`, (await readFile(join(root, 'src/core/kb', f), 'utf8')).split('\n')]));
    const nameOf = (id) => agentById(id)?.name ?? id;
    const mapName = (id) => MAPS.find((m) => m.id === id)?.name ?? id;

    const out = [`# What changed in the game's content since ${from} (${ref})`, ''];
    const none = !c.agents.added.length && !c.agents.removed.length && !c.abilities.length && !c.maps.added.length && !c.maps.removed.length && !c.callouts.length;
    if (none) out.push('Nothing: every agent, ability and callout is as it was.');

    if (c.agents.added.length || c.agents.removed.length) {
      out.push('## Agents', '');
      for (const id of c.agents.added) out.push(`- [ ] **${nameOf(id)}** is new in the game's content.${agentById(id) ? '' : ' Add them to agents.ts (or new-agents.ts while they\'re too new for numbers), as CONTRIBUTING.md says.'}`);
      for (const id of c.agents.removed) out.push(`- [ ] **${nameOf(id)}** is no longer in the game's content.`);
      out.push('');
    }
    if (c.abilities.length) {
      out.push('## Abilities', '', 'Check each one\'s strengths, kit rules and the lines that name it still say what the ability does now.', '');
      for (const ab of c.abilities) {
        const a = AGENTS.find((x) => x.id === ab.agent);
        const what = !ab.was ? 'is new' : ab.marksOnly ? 'has new marks only' : ab.renamed ? `was ${ab.renamed}${ab.was === ab.now ? '' : ', and its text changed'}` : 'has new text';
        out.push(`- [ ] **${nameOf(ab.agent)}'s ${ab.name}** (${ab.key}) ${what}.`);
        if (ab.was && ab.was !== ab.now) out.push(`  - Text: ${wordDiff(ab.was, ab.now)}`);
        else if (!ab.was) out.push(`  - Text: ${ab.now}`);
        const dims = a ? Object.entries(a.via).filter(([, keys]) => keys.includes(ab.key)).map(([d]) => `${d} ${a.caps[d]}`) : [];
        if (dims.length) out.push(`  - Strengths it's behind (agents.ts): ${dims.join(', ')}`);
        // a kit rule's keys: its own, or those behind the strengths it changes
        const keysOf = (rule) => rule.via ?? Object.keys(rule.bumps).map((d) => a?.via[d] ?? '').join('');
        const rules = agentRules(ab.agent).filter(({ rule }) => keysOf(rule).includes(ab.key));
        for (const { rule, maps } of rules) out.push(`  - Kit rule (kitfit.ts): ${ruleWhyAt(rule, maps)}`);
        const named = [...new Set([...namedIn(ab.name, files), ...(ab.renamed ? namedIn(ab.renamed, files) : [])])];
        if (named.length) out.push(`  - Named in: ${named.join(', ')}`);
      }
      out.push('');
    }
    if (c.maps.added.length || c.maps.removed.length) {
      out.push('## Maps', '');
      for (const id of c.maps.added) out.push(`- [ ] **${mapName(id)}** is new in the game's content.${MAPS.some((m) => m.id === id) ? '' : ' Add it to maps.ts, as CONTRIBUTING.md says.'}`);
      for (const id of c.maps.removed) out.push(`- [ ] **${mapName(id)}** is no longer in the game's content.`);
      out.push('');
    }
    if (c.callouts.length) {
      out.push('## Callouts', '', 'A callout that went or was renamed fails the specs until the plays and tips that name it are updated; one that moved needs a look on its map\'s page with Show callouts on.', '');
      for (const x of c.callouts) {
        const named = x.change === 'removed' ? namedIn(x.name, files) : [];
        out.push(`- [ ] ${mapName(x.map)}: **${x.name}** ${x.change === 'added' ? 'is new' : x.change === 'removed' ? 'is gone' : 'moved'}.${named.length ? ` Named in: ${named.join(', ')}` : ''}`);
      }
      out.push('');
    }
    process.stdout.write(out.join('\n').trimEnd() + '\n');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
