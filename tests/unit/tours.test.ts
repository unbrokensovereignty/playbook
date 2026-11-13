// Guided tours: every step points at a hook that exists, on a page that exists, and the card never
// covers what it points at when there's room beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { placeCard } from '../../src/ui/tours/place.ts';
import { TOUR_AGENT, TOURS } from '../../src/ui/tours/list.ts';
import { agentById } from '../../src/core/kb/agents.ts';
import { mapById } from '../../src/core/kb/maps.ts';
import { PAIRS } from '../../src/core/kb/synergy.ts';
import { SECTIONS } from '../../src/core/settings.ts';
import { WHATS_NEW } from '../../src/core/whatsnew.ts';

const list = readFileSync('src/ui/tours/list.ts', 'utf8');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [];
  });
}
const screens = files('src/ui').filter((f) => !f.includes('/tours/')).map((f) => readFileSync(f, 'utf8')).join('\n');
const steps = TOURS.flatMap((t) => t.steps);

test('every hook a tour points at is in a screen', () => {
  const targets = [...new Set(steps.flatMap((s) => (s.target ? [s.target] : [])))];
  assert.ok(targets.length > 25);
  const exact = new Set([...screens.matchAll(/(?:data-tour|tour)="([^"]+)"/g)].map((m) => m[1]!));
  // hooks built in code: data-tour={`settings-section-${sec.id}`} and data-tour={i === 0 ? 'comp-first' : undefined}
  const prefixes = [...screens.matchAll(/data-tour=\{`([a-z-]+)\$\{/g)].map((m) => m[1]!);
  for (const m of screens.matchAll(/data-tour=\{([^}]*)\}/g)) for (const q of m[1]!.matchAll(/'([a-z-]+)'/g)) exact.add(q[1]!);
  const missing = targets.filter((t) => !exact.has(t) && !prefixes.some((p) => t.startsWith(p)));
  assert.deepEqual(missing, []);
});

test('settings sections a tour points at exist', () => {
  const ids = [...SECTIONS.map((s) => s.id), 'data'];
  for (const s of steps) {
    const m = s.target?.match(/^settings-section-(.+)$/);
    if (m) assert.ok(ids.includes(m[1] as never), `no settings section "${m[1]}"`);
  }
});

test('every page a tour or a What’s new note goes to exists, with the agent or map it names', () => {
  const pages = readFileSync('src/ui/pages/index.ts', 'utf8');
  const named = [...TOURS.map((t) => t.page), ...steps.flatMap((s) => (s.page ? [s.page] : [])), ...WHATS_NEW.flatMap((n) => n.items.flatMap((x) => (x.page ? [x.page] : [])))];
  for (const p of new Set(named)) {
    const [page, arg] = p.split('/');
    assert.match(pages, new RegExp(`\\b${page}: `), `no page "${page}"`);
    if (page === 'agents' && arg) assert.ok(agentById(arg), `no agent "${arg}"`);
    if (page === 'maps' && arg) assert.ok(mapById(arg)?.pool, `no map "${arg}" in the pool`);
    if (page === 'help' && arg) assert.match(readFileSync('src/ui/pages/help.tsx', 'utf8'), new RegExp(`'${arg}'`), `no Help tab "${arg}"`);
    if (page === 'saved' && arg) assert.match(readFileSync('src/ui/pages/saved.tsx', 'utf8'), new RegExp(`\\['${arg}', '`), `no Saved tab "${arg}"`);
  }
  // the agent's page has every panel the tour points at (Partners shows only for an agent with some)
  assert.ok(PAIRS.some((p) => p.a === TOUR_AGENT || p.b === TOUR_AGENT), `${TOUR_AGENT} has no partners`);
});

test('tours are well formed and say how to move on with the keyboard', () => {
  assert.match(list, /Press Space for the next step/);
  assert.equal(new Set(TOURS.map((t) => t.id)).size, TOURS.length, 'two tours share an id');
  for (const t of TOURS) {
    assert.ok(t.steps.length >= 3, `${t.name} is too short`);
    for (const s of t.steps) {
      assert.ok(s.title.length <= 40, `“${s.title}” is a long title`);
      assert.ok(s.text.length <= 320, `${t.name}, “${s.title}”: ${s.text.length} letters is too much for the card`);
      assert.match(s.text, /[.]$/, `${t.name}, “${s.title}” doesn’t end with a full stop`);
      assert.doesNotMatch(s.text, /!/, 'no exclamation marks');
    }
  }
});

test('tour texts quote no numbers of their own: they come from the engine’s constants', () => {
  const quoted = [...list.matchAll(/'([^'\n]*)'/g)].map((m) => m[1]!).filter((x) => x.includes(' '));
  assert.ok(quoted.length > 20);
  assert.deepEqual(quoted.filter((x) => /\d/.test(x)), []);
});

test('the card sits beside its target when there is room', () => {
  const card = { width: 360, height: 200 };
  const vw = 1280, vh = 800;
  const overlaps = (t: { left: number; top: number; width: number; height: number }, p: { x: number; y: number }) =>
    p.x < t.left + t.width && p.x + card.width > t.left && p.y < t.top + t.height && p.y + card.height > t.top;
  const targets = [
    { left: 20, top: 20, width: 200, height: 40 }, // sidebar corner
    { left: 1000, top: 700, width: 240, height: 60 }, // bottom right
    { left: 300, top: 300, width: 600, height: 120 }, // middle
    { left: 260, top: 80, width: 980, height: 300 }, // wide panel at the top
    { left: 260, top: 450, width: 980, height: 300 }, // wide panel at the bottom
    { left: 280, top: 100, width: 400, height: 690 }, // the Planner's question, down the left
  ];
  for (const t of targets) for (const want of ['right', 'left', 'below', 'above', undefined] as const) {
    const p = placeCard(t, card, want, vw, vh);
    assert.ok(!overlaps(t, p) && p.clear, `card over its target ${JSON.stringify(t)} (asked ${want}, got ${p.side})`);
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + card.width <= vw && p.y + card.height <= vh, 'card off screen');
  }
});

test('the side asked for wins when it has room', () => {
  const t = { left: 400, top: 300, width: 200, height: 100 };
  for (const want of ['right', 'left', 'below', 'above'] as const) assert.equal(placeCard(t, { width: 300, height: 150 }, want, 1280, 800).side, want);
});

test('with no room beside the target, the card goes to a clear corner, as far from it as it can', () => {
  // a wide, tall panel in the middle of the window: no side has room, but the top right corner is clear
  const t = { left: 300, top: 220, width: 640, height: 360 };
  const p = placeCard(t, { width: 360, height: 200 }, 'below', 1280, 800);
  assert.equal(p.side, 'corner');
  assert.ok(p.x + 360 <= t.left || p.x >= t.left + t.width || p.y + 200 <= t.top || p.y >= t.top + t.height, 'covers the target');
});

test('with nothing to point at, the card is in the middle; it always stays on screen', () => {
  const p = placeCard(null, { width: 360, height: 200 }, 'right', 1000, 700);
  assert.deepEqual(p, { x: 320, y: 250, side: 'center', clear: true });
  // a target filling the screen: the card still fits on screen
  const big = placeCard({ left: 0, top: 0, width: 1000, height: 700 }, { width: 360, height: 200 }, 'below', 1000, 700);
  assert.equal(big.clear, false);
  // where every side covers as much of it, the side asked for: below, so the top of the target shows
  assert.equal(big.side, 'below');
  assert.equal(placeCard({ left: 0, top: 0, width: 1000, height: 700 }, { width: 360, height: 200 }, 'above', 1000, 700).side, 'above');
  assert.ok(big.x >= 12 && big.y >= 12 && big.x + 360 <= 988 && big.y + 200 <= 688);
});
