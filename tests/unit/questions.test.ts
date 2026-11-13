// Asks the engine hundreds of random questions, the kind people put together on the Planner, and
// checks every answer keeps the question's rules: must-play agents in, left-out agents out, role
// counts exact, teammates' picks respected, each player on one of their own agents. Node only
// (too slow for the in-app self-test); the questions are the same on every run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve } from '../../src/core/engine/plan.ts';
import { sanitizeQuery, situationsOf, type PartySize, type Query } from '../../src/core/engine/query.ts';
import { AGENTS, agentById } from '../../src/core/kb/agents.ts';
import { MAPS } from '../../src/core/kb/maps.ts';
import { RANK_IDS } from '../../src/core/kb/ranks.ts';
import { ROLE_IDS } from '../../src/core/kb/roles.ts';
import { TIERS, tierOf } from '../../src/core/engine/weights.ts';

/** A small, seeded random number source, so a failure can be run again. */
function random(seed: number) {
  let s = seed;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)]!;
  const some = <T>(xs: readonly T[], n: number): T[] => [...xs].sort(() => next() - 0.5).slice(0, n);
  return { next, int, pick, some };
}

function randomQuestion(r: ReturnType<typeof random>): Query {
  const ids = AGENTS.map((a) => a.id);
  const party = r.pick([5, 5, 5, 3, 2] as const) as PartySize;
  const map = r.pick(['any', 'best', ...MAPS.map((m) => m.id), ...MAPS.map((m) => m.id)]);
  const m = MAPS.find((x) => x.id === map);
  const roles: Query['roles'] = {};
  for (const role of ROLE_IDS) if (r.next() < 0.25) roles[role] = r.int(Math.min(3, party) + 1);
  const pools = party < 5 && r.next() < 0.3 ? Array.from({ length: party }, () => (r.next() < 0.3 ? [] : r.some(ids, 1 + r.int(4)))) : [];
  return sanitizeQuery({
    map,
    side: r.pick(['attack', 'defense', 'both', 'attack', 'defense']),
    // "best" sides and ranks multiply the work, so they're asked of five-stacks only
    rank: r.pick([...RANK_IDS, 'any']),
    sites: m && r.next() < 0.3 ? [r.pick(m.sites).id] : [],
    party,
    include: r.next() < 0.5 ? r.some(ids, 1 + r.int(party === 5 ? 3 : party)) : [],
    exclude: r.next() < 0.4 ? r.some(ids, 1 + r.int(12)) : [],
    locked: party < 5 && r.next() < 0.5 ? r.some(ids, 1 + r.int(5 - party)) : [],
    roles,
    pools,
    newAgents: r.next() < 0.8,
    allMaps: r.next() < 0.2,
    enemy: r.next() < 0.3 ? r.some(ids, 1 + r.int(5)) : [],
  });
}

test('random questions: every answer keeps the question’s rules', () => {
  const r = random(20261027);
  const problems: string[] = [];
  let asked = 0, empty = 0;
  for (let n = 0; n < 160; n++) {
    const q = randomQuestion(r);
    // a duo or trio asking for the best map stays quick enough by fixing the side and rank
    if (q.party < 5 && q.map === 'best') { q.side = q.side === 'both' ? 'attack' : q.side; }
    const where = JSON.stringify(q);
    for (const s of situationsOf(q)) {
      asked++;
      const a = solve(q, s, 6);
      if (!a.comps.length) { empty++; continue; }
      const bad = (why: string) => problems.push(`${why}: ${where}`);
      for (const c of a.comps) {
        if (new Set(c.team).size !== 5) bad(`team of ${c.team.length} with repeats: ${c.team}`);
        const party = q.party === 5 ? c.team : c.party;
        if (q.party < 5 && c.party.length !== q.party) bad(`party of ${c.party.length}`);
        if (q.party < 5 && !c.party.every((id) => c.team.includes(id))) bad('party not in its team');
        for (const id of q.include) if (!party.includes(id)) bad(`must-play ${id} missing`);
        for (const id of q.exclude) if (party.includes(id)) bad(`left-out ${id} in the party`);
        for (const id of q.locked) {
          if (c.party.includes(id)) bad(`locked ${id} in the party`);
          if (!c.team.includes(id)) bad(`locked ${id} not in the team`);
        }
        for (const role of ROLE_IDS) {
          const want = q.roles[role];
          if (want !== undefined && party.filter((id) => agentById(id)!.role === role).length !== want) bad(`not ${want} ${role}`);
        }
        if (q.pools.length) {
          // some way to give each player one of their own agents
          const fits = (left: string[], i: number): boolean => i === q.pools.length || left.some((id, k) => (!q.pools[i]!.length || q.pools[i]!.includes(id)) && fits(left.filter((_, j) => j !== k), i + 1));
          if (!fits([...c.party], 0)) bad(`party ${c.party} doesn’t fit the players`);
        }
        if (!q.newAgents && party.some((id) => agentById(id)!.estimate && !q.include.includes(id))) bad('a new agent picked though new agents are off');
        if (!(c.fit >= 0 && c.fit <= 100) || c.tier !== tierOf(c.fit)) bad(`fit ${c.fit} tier ${c.tier}`);
      }
      for (let i = 1; i < a.comps.length; i++) if (a.comps[i]!.fit > a.comps[i - 1]!.fit + 1e-9) bad(`comps out of order at ${i}`);
      for (const ag of a.agents) if (!(ag.fit >= 0 && ag.fit <= 100) || !TIERS.some((t) => t.id === ag.tier)) bad(`agent ${ag.id} fit ${ag.fit}`);
    }
  }
  assert.deepEqual(problems.slice(0, 10), [], `\n${problems.slice(0, 10).join('\n')}`);
  // most random questions have an answer; a few can't (that's the empty state's job)
  assert.ok(empty < asked / 3, `${empty} of ${asked} situations had no comp`);
});
