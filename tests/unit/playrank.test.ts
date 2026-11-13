// Checks that the plays the Planner puts first suit the rank: simple plans the whole team plays
// together at the low ranks, where teams rarely time utility between groups, and the plays that ask
// for timing and calls from the middle ranks up. Each play's demand is in kb/plays.ts, and what it
// costs below its rank in engine/weights.ts (PLAY_RANK).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve } from '../../src/core/engine/plan.ts';
import { newQuery, sanitizeQuery, situationsOf } from '../../src/core/engine/query.ts';
import { playsFor } from '../../src/core/engine/plays.ts';
import { MAPS } from '../../src/core/kb/maps.ts';
import type { RankId } from '../../src/core/kb/ranks.ts';

const SIDES = ['attack', 'defense'] as const;
/** The first play for the Planner's best comp on each map and side at a rank, with its demand. */
function firstPlays(rank: RankId) {
  return MAPS.flatMap((m) => SIDES.map((side) => {
    const team = solve({ ...newQuery(rank, true), map: m.id, side }, { map: m.id, side, rank, sites: [] }, 1).comps[0]!.team;
    const fs = playsFor(team, m.id, side, [], false, [], rank);
    return { where: `${m.name} ${side}`, first: fs[0]!, top: fs.slice(0, 3) };
  }));
}

test('at Iron and Bronze, the first play is a simple one on most maps, and hardly ever one that needs groups timed together', () => {
  for (const rank of ['iron', 'bronze'] as const) {
    const all = firstPlays(rank);
    const simple = all.filter((x) => x.first.demand === 1).length;
    assert.ok(simple >= 0.7 * all.length, `${rank}: simple first on ${simple} of ${all.length}`);
    const hard = all.filter((x) => x.first.demand >= 3).map((x) => `${x.where}: ${x.first.play.name}`);
    assert.ok(hard.length <= (rank === 'iron' ? 0 : 1), `${rank}: ${hard.join('; ')}`);
  }
});

// (on defense, a site's usual setup is simple at every rank: it's how pro teams hold too)
test('from Platinum up, an attack that asks for more than a simple plan is among the first three on every map, and from Ascendant a coordinated one comes first', () => {
  for (const rank of ['platinum', 'diamond', 'ascendant', 'immortal'] as const) {
    const attack = firstPlays(rank).filter((x) => x.where.endsWith('attack'));
    const plain = attack.filter((x) => x.top.every((f) => f.demand === 1)).map((x) => x.where);
    assert.deepEqual(plain, [], `${rank}: only simple plays first on ${plain.join(', ')}`);
    if (rank === 'platinum' || rank === 'diamond') continue;
    const simpleFirst = attack.filter((x) => x.first.demand === 1).map((x) => x.where);
    assert.deepEqual(simpleFirst, [], `${rank}: a simple attack first on ${simpleFirst.join(', ')}`);
    const coordinated = attack.filter((x) => !x.top.some((f) => f.demand >= 3)).map((x) => x.where);
    assert.deepEqual(coordinated, [], `${rank}: no coordinated attack in the first three on ${coordinated.join(', ')}`);
  }
});

test('the first plays ask for more teamwork at each rank on the way up to Platinum', () => {
  const share = (rank: RankId) => { const all = firstPlays(rank); return all.reduce((t, x) => t + x.first.demand, 0) / all.length; };
  const ranks: RankId[] = ['iron', 'bronze', 'silver', 'gold', 'platinum'];
  const demand = ranks.map(share);
  for (let i = 1; i < demand.length; i++) assert.ok(demand[i]! >= demand[i - 1]!, `${ranks[i]} ${demand[i]!.toFixed(2)} after ${ranks[i - 1]} ${demand[i - 1]!.toFixed(2)}`);
});

test('from Iron to Silver, a play that needs groups timed together is rarely among the first three, solo or in a party', () => {
  for (const rank of ['iron', 'bronze', 'silver'] as const) {
    let hard = 0, n = 0;
    for (const m of MAPS) for (const side of SIDES) for (const party of [5, 1, 2, 3] as const) {
      const q = sanitizeQuery({ ...newQuery(rank, true), map: m.id, side, party });
      const team = solve(q, situationsOf(q)[0]!, 1).comps[0]!.team;
      n++;
      if (playsFor(team, m.id, side, [], false, [], rank).slice(0, 3).some((f) => f.demand >= 3)) hard++;
    }
    assert.ok(hard <= n / 5, `${rank}: ${hard} of ${n}`);
  }
});

test('with no site asked, a defense opens with a hold that covers every site rather than a stack, when they fit the same', () => {
  // (grading round 4: Stack B came first on Breeze at Silver and Pearl at Gold, ahead of Hold in pairs at the same fit)
  const problems: string[] = [];
  for (const rank of ['silver', 'gold', 'platinum'] as const) {
    for (const m of MAPS) {
      for (const c of solve({ ...newQuery(rank, true), map: m.id, side: 'defense' }, { map: m.id, side: 'defense', rank, sites: [] }, 10).comps) {
        const fs = playsFor(c.team, m.id, 'defense', [], false, [], rank);
        const first = fs[0]!, hold = fs.find((f) => f.play.kind === 'setup' && !f.play.site);
        if (first.play.kind === 'stack' && hold && hold.fit.toFixed(6) === first.fit.toFixed(6)) problems.push(`${m.name} at ${rank}, ${c.team.join(' ')}: ${first.play.name} before ${hold.play.name}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('at Gold, a play that needs groups timed together comes first for few of the best comps', () => {
  // (grading round 4: Gold five-stacks on Split and Bind were sent on coordinated defaults, a plan for Platinum up)
  let hard = 0, n = 0;
  const where: string[] = [];
  for (const m of MAPS) for (const side of SIDES) {
    for (const c of solve({ ...newQuery('gold', true), map: m.id, side }, { map: m.id, side, rank: 'gold', sites: [] }, 5).comps) {
      const f = playsFor(c.team, m.id, side, [], false, [], 'gold')[0]!;
      n++;
      if (f.demand >= 3) { hard++; where.push(`${m.name} ${side}: ${f.play.name}`); }
    }
  }
  assert.ok(hard <= n / 20, `${hard} of ${n}: ${where.join('; ')}`);
});

test('from Platinum up, a defense asked about one site doesn’t open with a stack on it', () => {
  // from there attackers take mid and fake before they commit (PLAY_RANK.read.defense), so three
  // on the site asked is a guess at where they’ll hit, while Platinum coaching works on defensive
  // protocols and retake spacing (Upforge)
  const stacks: string[] = [];
  for (const rank of ['platinum', 'diamond', 'ascendant'] as const) for (const m of MAPS) for (const { id } of m.sites) {
    const q = sanitizeQuery({ ...newQuery(rank, true), map: m.id, side: 'defense', sites: [id] });
    const team = solve(q, situationsOf(q)[0]!, 1).comps[0]!.team;
    const first = playsFor(team, m.id, 'defense', [id], false, [], rank)[0]!;
    if (first.play.kind === 'stack') stacks.push(`${m.name} ${id} at ${rank}: ${first.play.name}`);
  }
  assert.deepEqual(stacks, [], `\n${stacks.join('\n')}`);
});
