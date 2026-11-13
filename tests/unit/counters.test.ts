// Checks "Their team" on the Planner: knowing the other team's agents lifts the agents a coach would
// bring against them, a comp says how it stands against each threat, and the advice for a comp
// that has little to answer a threat never leans on the utility it lacks. The threats are in
// kb/counters.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve } from '../../src/core/engine/plan.ts';
import { newQuery, sanitizeQuery, situationsOf } from '../../src/core/engine/query.ts';
import { againstWords, explainTeam } from '../../src/core/engine/explain.ts';
import { PLAY_RANK } from '../../src/core/engine/weights.ts';
import { modelFor, situationKey } from '../../src/core/engine/model.ts';
import { RANKS, type RankId } from '../../src/core/kb/ranks.ts';
import { agentById } from '../../src/core/kb/agents.ts';
import { POOL, type Side } from '../../src/core/kb/maps.ts';
import { THREATS, threatLine } from '../../src/core/kb/counters.ts';
import type { Dim } from '../../src/core/kb/roles.ts';
import { listJoin } from '../../src/core/text.ts';

const none = (problems: string[]) => assert.deepEqual(problems, [], `\n${problems.join('\n')}`);
const name = (id: string) => agentById(id)!.name;

function answer(map: string, side: Side, rank: RankId, enemy: string[]) {
  return solve({ ...newQuery(rank, true), map, side, enemy }, { map, side, rank, sites: [], enemy }, 3);
}
/**
 * How much knowing the other team moves some agents' fits, on average over the map pool, and how
 * much it moves everyone else's. Fits are measured within a situation, so a lift is relative: the
 * claim is that the agents who answer them gain on the rest.
 */
function lift(agents: readonly string[], side: Side, rank: RankId, enemy: string[]): { them: number; rest: number } {
  let them = 0, rest = 0, nThem = 0, nRest = 0;
  for (const m of POOL) {
    const a = answer(m.id, side, rank, []), b = answer(m.id, side, rank, enemy);
    for (const x of b.agents) {
      const d = x.fit - a.agents.find((y) => y.id === x.id)!.fit;
      if (agents.includes(x.id)) { them += d; nThem++; } else { rest += d; nRest++; }
    }
  }
  return { them: them / nThem, rest: rest / nRest };
}

test('with no agents of theirs known, nothing changes', () => {
  const s = { map: 'ascent', side: 'attack', rank: 'gold', sites: [] } as const;
  const a = modelFor(s), b = modelFor({ ...s, enemy: [] });
  assert.deepEqual([...b.weight], [...a.weight]);
  assert.equal(b.threats.length, 0);
  assert.notEqual(situationKey({ ...s, enemy: ['jett'] }), situationKey(s));
});

test('the agents a coach brings against a known team rate higher', () => {
  const problems: string[] = [];
  const claims: { why: string; side: Side; enemy: string[]; agents: string[] }[] = [
    // a fast hit is slowed with mollies, walls and slows (Viper's Snake Bite and wall among them)
    { why: 'against a Raze and Neon rush, agents who slow a push', side: 'defense', enemy: ['raze', 'neon'], agents: ['sage', 'deadlock', 'killjoy', 'brimstone', 'viper'] },
    // site setups are found and broken with utility before the hit
    { why: 'against a Killjoy and Cypher setup, agents who break it', side: 'attack', enemy: ['killjoy', 'cypher'], agents: ['kayo', 'gekko', 'breach', 'raze'] },
    // the Operator's angles are smoked off or flashed before anyone peeks
    { why: 'against an Operator Chamber and Jett, smokes and flashes', side: 'attack', enemy: ['chamber', 'jett'], agents: ['omen', 'breach', 'kayo', 'gekko', 'skye'] },
    // lineups guarding the Spike are best stopped before the plant
    { why: 'against Viper and Brimstone lineups, agents who stop the plant', side: 'defense', enemy: ['viper', 'brimstone'], agents: ['sage', 'deadlock', 'brimstone', 'astra', 'harbor'] },
  ];
  for (const c of claims) {
    for (const rank of ['gold', 'immortal'] as const) {
      const { them, rest } = lift(c.agents, c.side, rank, c.enemy);
      if (them <= rest) problems.push(`${c.why} at ${rank}: ${them.toFixed(1)} for them, ${rest.toFixed(1)} for the rest`);
    }
  }
  none(problems);
});

test('both teams can play the same agent', () => {
  const a = answer('ascent', 'attack', 'immortal', ['omen', 'sova']);
  assert.ok(a.comps[0]!.team.includes('omen') || a.comps[0]!.team.includes('sova'), a.comps[0]!.team.join());
});

test('a comp says how it stands against each threat, and names who answers it', () => {
  const problems: string[] = [];
  // Breeze attack against an Operator: the best comp brings Viper's wall and smokes
  const enemy = ['chamber', 'jett', 'sova', 'viper', 'cypher'];
  const a = answer('breeze', 'attack', 'immortal', enemy);
  const why = explainTeam(modelFor({ map: 'breeze', side: 'attack', rank: 'immortal', sites: [], enemy }), a.comps[0]!.team);
  const op = why.against.find((r) => r.id === 'operator');
  if (!op) problems.push(`no word of their Operator for ${a.comps[0]!.team.map(name).join(', ')}`);
  else {
    if (op.threat !== 'Their Chamber and Jett hold long angles with the Operator') problems.push(`"${op.threat}"`);
    if (op.verdict !== 'answered') problems.push(`the Operator is ${op.verdict} (${op.answered.toFixed(2)})`);
    if (!op.by.includes('Viper’s Toxic Screen')) problems.push(`Viper's wall isn't named: ${op.by.join(', ')}`);
  }
  // biggest threat first
  for (let i = 1; i < why.against.length; i++) if (why.against[i]!.level > why.against[i - 1]!.level) problems.push('threats out of order');
  none(problems);
});

test('every threat reads as a sentence, and its advice doesn’t lean on the utility it asks for', () => {
  const problems: string[] = [];
  // words that mean a strength's utility, so advice for a comp without it can't ask for it
  const WORDS: Partial<Record<Dim, RegExp>> = {
    smoke: /\bsmoke (?:it|them|off)|\bsmokes? (?:to|from|for)\b/i, flash: /\bflash/i, wall: /\bwalls?\b/i, disrupt: /\bstun|suppress|concuss/i,
    clear: /\bclear|molly|mollies|burn/i, recon: /\bdart|drone|information|recon/i, stall: /\bmolly|mollies|slow it|slow the|\bwalls?\b/i,
    retake: /retake utility/i, postplant: /lineup/i, mobility: /\bdash|speed/i, entry: /\bentry/i, anchor: /\btrap|turret|setup of your/i,
  };
  for (const t of THREATS) {
    const one = threatLine(t, ['Chamber'], listJoin), two = threatLine(t, ['Chamber', 'Jett'], listJoin);
    for (const line of [one, two]) if (!/^Their [A-Z][^{}]*[a-z]$/.test(line)) problems.push(`${t.id}: "${line}"`);
    if (one === two.replace('Chamber and Jett', 'Chamber')) problems.push(`${t.id}: the verb doesn't change for two: "${two}"`);
    for (const words of [t.advice, t.timed, t.does?.one, t.does?.many]) if (words !== undefined && !/^[a-z][^{}]*[a-z]$/.test(words)) problems.push(`${t.id}: "${words}" should finish a sentence`);
    for (const d of Object.keys(t.needs) as Dim[]) if (WORDS[d]?.test(t.advice)) problems.push(`${t.id}: the advice asks for ${d}, which a comp it's for lacks: "${t.advice}"`);
  }
  none(problems);
});

test('their agents are kept with the question, at most five, and every situation knows them', () => {
  const q = sanitizeQuery({ ...newQuery(), map: 'best', enemy: ['jett', 'jett', 'nobody', 'sova', 'omen', 'killjoy', 'raze', 'breach'] });
  assert.deepEqual(q.enemy, ['jett', 'sova', 'omen', 'killjoy', 'raze']);
  assert.deepEqual(sanitizeQuery({ ...newQuery() }).enemy, []);
  assert.ok(situationsOf(q).every((s) => s.enemy === q.enemy));
});

test('nothing in a kit is said to answer their information, and fakes are offered only to ranks that run them', () => {
  // dashes, slides and teleports don't stop a Recon Bolt or a Haunt: a coach says to shoot the
  // utility down or step out of it, and from Platinum to show one site and hit the other
  // (grading round 5: "High Gear and Shrouded Step answer their Sova" on twelve answers)
  const problems: string[] = [];
  const enemy = ['sova', 'fade', 'omen', 'jett', 'killjoy'];
  for (const rank of ['iron', 'silver', 'gold', 'platinum', 'immortal'] as const) for (const m of POOL) {
    const s = { map: m.id, side: 'attack', rank, sites: [], enemy } as const;
    const a = solve({ ...newQuery(rank, true), map: m.id, side: 'attack', enemy }, s, 3);
    for (const c of a.comps) {
      const r = explainTeam(modelFor(s), c.team).against.find((x) => x.id === 'information');
      if (!r) { problems.push(`${m.name} at ${rank}: no word of their Sova and Fade`); continue; }
      const line = againstWords(r);
      if (r.by.length || /answer/.test(line)) problems.push(`${m.name} at ${rank}, ${c.team.join(' ')}: "${line}"`);
      const fakes = /fake|show one site/.test(line), timed = RANKS.findIndex((x) => x.id === rank) >= RANKS.findIndex((x) => x.id === PLAY_RANK.from[3]);
      if (fakes !== timed) problems.push(`${m.name} at ${rank}: ${fakes ? 'a fake below' : 'no fake from'} ${PLAY_RANK.from[3]}: "${line}"`);
    }
  }
  none(problems);
});

test('against lineups that guard a planted Spike, the comp is told what its utility does about the plant', () => {
  // a Slow Orb or a Nanoswarm on the plant spot holds the plant up; it doesn't answer a lineup once
  // the Spike is down (grading round 5, #73)
  const problems: string[] = [];
  const enemy = ['viper', 'brimstone', 'sova', 'killjoy', 'jett'];
  for (const rank of ['iron', 'gold', 'immortal'] as const) for (const m of POOL) {
    const s = { map: m.id, side: 'defense', rank, sites: [], enemy } as const;
    for (const c of solve({ ...newQuery(rank, true), map: m.id, side: 'defense', enemy }, s, 3).comps) {
      const r = explainTeam(modelFor(s), c.team).against.find((x) => x.id === 'lineups');
      if (!r) continue;
      const line = againstWords(r);
      if (/answer/.test(line) || (r.by.length && !/plant/.test(line))) problems.push(`${m.name} at ${rank}, ${c.team.join(' ')}: "${line}"`);
    }
  }
  none(problems);
});
