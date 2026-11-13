// Checks that the engine's answers make sense as a whole: against pro play, ranked play and
// common sense. Each check covers many situations, so these run in Node only (they are too slow
// for the in-app self-test). When tuning engine/weights.ts or the knowledge base, run these.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, type SituationAnswer } from '../../src/core/engine/plan.ts';
import { newQuery } from '../../src/core/engine/query.ts';
import { proMixOf, type SidePick } from '../../src/core/engine/model.ts';
import { RANKS, type RankId } from '../../src/core/kb/ranks.ts';
import { agentById } from '../../src/core/kb/agents.ts';
import { MAPS, POOL, type Side } from '../../src/core/kb/maps.ts';
import { PRO, proOverlap } from '../../src/core/kb/pro.ts';
import type { Role } from '../../src/core/kb/roles.ts';

const SIDES: readonly Side[] = ['attack', 'defense'];
const name = (id: string) => agentById(id)!.name;
const roleOf = (id: string) => agentById(id)!.role;
const solved = new Map<string, SituationAnswer>();
function answer(map: string, side: SidePick, rank: RankId, keep = 3): SituationAnswer {
  const key = [map, side, rank, keep].join('|');
  let a = solved.get(key);
  if (!a) solved.set(key, (a = solve({ ...newQuery(rank, true), map, side }, { map, side, rank, sites: [] }, keep)));
  return a;
}
const top = (map: string, side: SidePick, rank: RankId) => answer(map, side, rank).comps[0]!.team;
/** Fails once, listing every situation that went wrong. */
const none = (problems: string[]) => assert.deepEqual(problems, [], `\n${problems.join('\n')}`);

test('the best comp on every map, side and rank has a sound mix of roles', () => {
  const problems: string[] = [];
  for (const rank of ['iron', 'gold', 'diamond', 'radiant'] as const) for (const m of MAPS) for (const side of SIDES) {
    const t = top(m.id, side, rank);
    const n = (r: Role) => t.filter((id) => roleOf(id) === r).length;
    // a defense needs a sentinel, except at Radiant on a map where pro teams mostly play without one
    const noSentinel = side === 'attack' || (rank === 'radiant' && (proMixOf(m.id)?.sentinel ?? 1) < 0.5);
    const sound = n('controller') >= 1 && n('controller') <= 2 && n('duelist') <= 2 && n('initiator') >= 1 && (noSentinel || n('sentinel') >= 1);
    if (!sound) problems.push(`${m.name} ${side} at ${rank}: ${t.map(name).join(', ')}`);
  }
  none(problems);
});

test('at Immortal and Radiant, one of the top three comps shares four agents with a comp pros play (three on a defense pros play without a sentinel)', () => {
  const problems: string[] = [];
  for (const rank of ['immortal', 'radiant'] as const) for (const m of MAPS) for (const side of SIDES) {
    if (!PRO[m.id]) continue;
    const teams = answer(m.id, side, rank).comps.map((c) => c.team);
    const overlap = Math.max(...teams.map((t) => proOverlap(m.id, t)));
    // below Radiant a defense keeps its sentinel where pro teams play without one (see the first
    // test), so on those maps it can share one agent fewer
    const least = rank !== 'radiant' && side === 'defense' && (proMixOf(m.id)?.sentinel ?? 1) < 0.5 ? 3 : 4;
    if (overlap < least) problems.push(`${m.name} ${side} at ${rank}: at most ${overlap} in common, best is ${teams[0]!.map(name).join(', ')}`);
  }
  none(problems);
});

test('the agents pro teams pick on at least half of a map’s games show up in its top five comps at Immortal or Radiant', () => {
  const problems: string[] = [];
  for (const [map, pro] of Object.entries(PRO)) for (const [id, pct] of Object.entries(pro.picks)) {
    if (pct < 50) continue;
    const seen = ['immortal', 'radiant'].some((rank) => SIDES.some((side) => answer(map, side, rank as RankId, 5).comps.some((c) => c.team.includes(id))));
    if (!seen) problems.push(`${map}: no ${name(id)} (picked on ${pct}%)`);
  }
  none(problems);
});

/** Agent fits over every map and side at a rank, with their middle. */
/** Agents' fits at a rank, compared as shown (whole numbers), with the middle agent's. */
function fitsAt(rank: RankId) {
  const agents = answer('any', 'both', rank, 1).agents;
  const fit = (id: string) => Math.round(agents.find((a) => a.id === id)!.fit);
  const mid = Math.round([...agents].sort((a, b) => a.fit - b.fit)[Math.floor(agents.length / 2)]!.fit);
  return { fit, mid, place: (id: string) => agents.findIndex((a) => a.id === id) + 1 };
}

test('at Iron, easy agents who work alone fit better than most, and hard team-play agents worse', () => {
  const { fit, mid, place } = fitsAt('iron');
  const problems: string[] = [];
  for (const id of ['reyna', 'jett', 'sage', 'phoenix', 'brimstone']) if (fit(id) < mid) problems.push(`${name(id)} ${Math.round(fit(id))} is under the middle ${Math.round(mid)} (#${place(id)})`);
  for (const id of ['astra', 'harbor', 'iso']) if (fit(id) > mid) problems.push(`${name(id)} ${Math.round(fit(id))} is over the middle ${Math.round(mid)} (#${place(id)})`);
  none(problems);
});

test('below Platinum, a team that asks for nothing gets none of the hardest kits, and no Breach at Iron or Bronze', () => {
  // guides for the low ranks say Neon, Astra, Yoru and Hush take mechanics to learn later (Sequel, GAMES.GG, iTechGuides),
  // and Breach makes fights for teammates who follow up, which Iron and Bronze teams rarely do
  // (ProSettings, BoostingMarket).
  const problems: string[] = [];
  for (const rank of ['iron', 'bronze', 'silver', 'gold'] as const) for (const m of MAPS) for (const side of SIDES) {
    const hard = ['astra', 'yoru', 'hush', 'neon', ...(rank === 'iron' || rank === 'bronze' ? ['breach'] : [])];
    const t = top(m.id, side, rank);
    if (t.some((id) => hard.includes(id))) problems.push(`${m.name} ${side} at ${rank}: ${t.map(name).join(', ')}`);
  }
  none(problems);
});

test('below Platinum, KAY/O is in no best comp, since his flashes and knife want a team that swings on them', () => {
  // he wins the fewest ranked games of any agent, and guides for the low ranks name Fade and Sova
  // first among initiators, since their information needs little from the team (claims kayo-ranked
  // and low-initiators). His FLASH/drive pays off when someone swings as it pops, which teams at
  // these ranks rarely time.
  const problems: string[] = [];
  for (const rank of ['iron', 'bronze', 'silver', 'gold'] as const) for (const m of MAPS) for (const side of SIDES) {
    const t = top(m.id, side, rank);
    if (t.includes('kayo')) problems.push(`${m.name} ${side} at ${rank}: ${t.map(name).join(', ')}`);
  }
  none(problems);
});

test('below Platinum, Hush waits with the hardest kits, even for a team that won’t play Phoenix', () => {
  // her flash and blast are steered by aim, guides tell players still learning to aim to wait
  // (iTechGuides), and her team has won fewer than half its ranked games so far (metabot.gg, op.gg).
  // Leaving out Phoenix, the duelist a low-rank team reaches for first, mustn't bring her in.
  const problems: string[] = [];
  for (const rank of ['iron', 'bronze', 'silver', 'gold'] as const) for (const m of MAPS) for (const side of SIDES) {
    const t = solve({ ...newQuery(rank, true), map: m.id, side, exclude: ['phoenix'] }, { map: m.id, side, rank, sites: [] }, 1).comps[0]!.team;
    if (t.includes('hush')) problems.push(`${m.name} ${side} at ${rank}: ${t.map(name).join(', ')}`);
  }
  none(problems);
});

test('below Platinum, Phoenix steps aside on Breeze from Silver up', () => {
  // his flash and molly reach few of Breeze's fights, pros picked him on 11% of its maps, and ranked
  // players pick him there a third as often as elsewhere (metabot.gg, November 2026). On Abyss his
  // team still wins 52.8% of its ranked games, so a low-rank team may play him there.
  const problems: string[] = [];
  for (const rank of ['silver', 'gold'] as const) for (const side of SIDES) {
    const t = top('breeze', side, rank);
    if (t.includes('phoenix')) problems.push(`Breeze ${side} at ${rank}: ${t.map(name).join(', ')}`);
  }
  none(problems);
});

test('at Radiant, the pro staples fit better than most, and selfish agents worse', () => {
  const { fit, mid, place } = fitsAt('radiant');
  const problems: string[] = [];
  for (const id of ['sova', 'viper', 'omen', 'fade', 'neon', 'yoru', 'chamber']) if (fit(id) < mid) problems.push(`${name(id)} ${Math.round(fit(id))} is under the middle ${Math.round(mid)} (#${place(id)})`);
  // (not Phoenix: pro teams picked him on 45% of Haven's games and 38% of Ascent's at Champions 2026)
  for (const id of ['reyna', 'iso']) if (fit(id) > mid) problems.push(`${name(id)} ${Math.round(fit(id))} is over the middle ${Math.round(mid)} (#${place(id)})`);
  none(problems);
});

test('the best comps vary from map to map, and new agents don’t take over', () => {
  const problems: string[] = [];
  for (const rank of ['iron', 'gold', 'radiant'] as const) {
    const tops = POOL.flatMap((m) => SIDES.map((side) => top(m.id, side, rank)));
    const count = new Map<string, number>();
    for (const t of tops) for (const id of t) count.set(id, (count.get(id) ?? 0) + 1);
    // at Iron the easiest agents who work alone win most places, so fewer different agents lead
    const least = rank === 'iron' ? { agents: 10, controllers: 2 } : { agents: 12, controllers: 3 };
    if (count.size < least.agents) problems.push(`${rank}: only ${count.size} different agents`);
    // controllers come back on every map, since every team needs one; anyone else shouldn't. At Gold,
    // where the guides call Phoenix a top pick (claim phoenix-low), he may lead all but one.
    const others = [...count].filter(([id]) => roleOf(id) !== 'controller').sort((a, b) => b[1] - a[1]);
    const [most, times] = others[0]!;
    const allowed = rank === 'gold' ? tops.length - 1 : Math.floor(tops.length * 0.86);
    if (times > allowed) problems.push(`${rank}: ${name(most)} is in ${times} of ${tops.length}`);
    const controllers = [...count.keys()].filter((id) => roleOf(id) === 'controller');
    if (controllers.length < least.controllers) problems.push(`${rank}: only ${controllers.map(name).join(' and ')} as controllers`);
    const early = tops.filter((t) => t.some((id) => agentById(id)!.estimate)).length;
    if (early / tops.length > 0.25) problems.push(`${rank}: a new agent leads ${early} of ${tops.length}`);
  }
  none(problems);
});

test('the best comp moves steadily from one rank to the next', () => {
  // a rank's answers take in its neighbors' games (RANK_NEAR), so moving up one rank should change
  // the best comp a little at a time: on every map and side, most agents stay
  let shared = 0, steps = 0;
  const jumps: string[] = [];
  for (const m of MAPS) for (const side of SIDES) {
    for (let i = 1; i < RANKS.length; i++) {
      const was = top(m.id, side, RANKS[i - 1]!.id), now = top(m.id, side, RANKS[i]!.id);
      const n = now.filter((id) => was.includes(id)).length;
      shared += n;
      steps++;
      if (n <= 1) jumps.push(`${m.name} ${side}, ${RANKS[i - 1]!.name} to ${RANKS[i]!.name}: ${was.map(name).join(', ')} → ${now.map(name).join(', ')}`);
    }
  }
  assert.ok(shared / steps >= 4.3, `on average ${(shared / steps).toFixed(2)} of 5 agents stay`);
  // a whole new comp is rare: where a cheap, easy comp and the pro one swap places
  assert.ok(jumps.length <= 2, `\n${jumps.join('\n')}`);
});
