// How close the engine comes to what pro teams played (tests/validation/pro.ts), with pass marks set
// from the first held-out run (docs/VALIDATION.md says what each one means). Marks can only
// go up: a change that drops below one has made the engine worse at something it could do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHeldOut, checkPro, copyOthers, means, spearman, type MapCheck } from '../validation/pro.ts';
import { solve } from '../../src/core/engine/plan.ts';
import { newQuery } from '../../src/core/engine/query.ts';
import { AGENTS, agentById } from '../../src/core/kb/agents.ts';
import type { RankId } from '../../src/core/kb/ranks.ts';
import { CLAIMS, SOURCES } from '../validation/claims.ts';

const show = (xs: readonly MapCheck[]) => xs.map((x) => `${x.event} ${x.map}: shares ${x.shared}, order ${x.order.toFixed(2)}, controllers ${x.ctrlBest}/${x.ctrlPro}`).join('\n');

test('against every event, with the pro numbers built from all of them', () => {
  const rows = checkPro(), m = means(rows);
  assert.ok(m.shared >= 4.4, `shares ${m.shared.toFixed(2)}\n${show(rows)}`);
  assert.ok(m.order >= 0.75, `order ${m.order.toFixed(2)}`);
  assert.ok(m.ctrl >= m.maps - 1, `controllers right on ${m.ctrl} of ${m.maps}`);
});

test('each event held out: the engine comes at least as close to it as copying the other events would', () => {
  const rows = checkHeldOut(), m = means(rows);
  const known = rows.flatMap((r) => { const c = copyOthers(r.event, r.map); return c === undefined ? [] : [{ r, c }]; });
  const engine = known.reduce((t, x) => t + x.r.shared, 0) / known.length, copy = known.reduce((t, x) => t + x.c, 0) / known.length;
  assert.ok(known.length >= 15, `${known.length} maps with another event`);
  assert.ok(engine >= copy, `engine shares ${engine.toFixed(2)}, copying the other events ${copy.toFixed(2)}\n${show(rows)}`);
  assert.ok(m.shared >= 3.8, `shares ${m.shared.toFixed(2)} over all ${m.maps} maps`);
  assert.ok(m.order >= 0.6, `order ${m.order.toFixed(2)}`);
  assert.ok(rows.every((r) => r.order >= 0.3), `a map with almost no agreement:\n${show(rows.filter((r) => r.order < 0.3))}`);
  assert.ok(m.ctrl >= m.maps - 1, `controllers right on ${m.ctrl} of ${m.maps}`);
});

test('each event held out, with no pull toward pro play: the kits and maps alone still point near it', () => {
  const rows = checkHeldOut('radiant', 3, 10, false), m = means(rows);
  assert.ok(m.shared >= 3.2, `shares ${m.shared.toFixed(2)}\n${show(rows)}`);
  assert.ok(m.order >= 0.5, `order ${m.order.toFixed(2)}`);
  assert.ok(m.ctrl >= m.maps - 1, `controllers right on ${m.ctrl} of ${m.maps}`);
});

// ranked play: the numbers are for all ranks together, so these check the low and middle ranks,
// where most ranked games are played (WIN_RANKS); near the top, pro play counts for more by design
const known = AGENTS.filter((a) => !a.estimate);
const anyMap = (rank: RankId) => solve({ ...newQuery(rank, true), map: 'any', side: 'both' }, { map: 'any', side: 'both', rank, sites: [] }, 3);

test('from Iron to Diamond, agents who win more ranked games fit better', () => {
  for (const rank of ['iron', 'silver', 'gold', 'platinum', 'diamond'] as const) {
    const fits = new Map(anyMap(rank).agents.map((a) => [a.id, a.fit]));
    const r = spearman(known.map((a) => fits.get(a.id)!), known.map((a) => a.win));
    assert.ok(r >= 0.5, `${rank}: ${r.toFixed(2)}`);
  }
});

test('the top comps from Iron to Silver lean on easy kits, and few S-tier agents win few ranked games', () => {
  const wins = known.map((a) => a.win).sort((a, b) => a - b), low = wins[Math.floor(wins.length / 4)]!;
  for (const rank of ['iron', 'bronze', 'silver'] as const) {
    for (const c of anyMap(rank).comps) assert.ok(c.team.filter((id) => agentById(id)!.skill >= 0.75).length <= 1, `${rank}: ${c.team.join(' ')}`);
  }
  for (const rank of ['iron', 'silver', 'gold', 'platinum'] as const) {
    const s = anyMap(rank).agents.filter((a) => a.tier === 'S' && agentById(a.id)!.win <= low).map((a) => a.id);
    // Omen: pros pick him on most maps, and his ranked rate is across all ranks (docs/VALIDATION.md)
    assert.ok(s.length <= 1, `${rank}: ${s.join(', ')}`);
  }
});

// the expert claims register (tests/validation/claims.ts)

test('every claim in the register has two independent sources or more, each listed once', () => {
  for (const c of CLAIMS) {
    assert.ok(new Set(c.sources).size === c.sources.length && c.sources.length >= 2, `${c.id}: ${c.sources.join(', ')}`);
    for (const s of c.sources) assert.ok(SOURCES[s], `${c.id}: no source ${s}`);
    assert.ok(c.check || c.note, `${c.id} is neither checked nor says why`);
  }
  assert.equal(new Set(CLAIMS.map((c) => c.id)).size, CLAIMS.length);
});

test('every claim the engine can be checked against holds', () => {
  const misses: string[] = [];
  const checked = CLAIMS.filter((c) => c.check);
  for (const c of checked) { const r = c.check!(); if (r !== true) misses.push(`${c.id}: ${r || 'no'}`); }
  assert.deepEqual(misses, [], `${misses.length} of ${checked.length} miss:\n${misses.join('\n')}`);
});
