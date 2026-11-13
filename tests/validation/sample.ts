// A hundred and eighty answers for the graded review in docs/VALIDATION.md, twenty at each rank:
// node --experimental-strip-types tools/validate.mjs --sample. Every map comes up at least twelve
// times, both sides and every party size, and most questions add something a player would: an
// agent they must play or won't, teammates who have locked in, the other team's agents, a role
// count or one site. The draw is seeded, so the same answers come back until the engine changes.
// Node only.
import { PRO, proOverlap } from '../../src/core/kb/pro.ts';
import { againstWords, explainFor, explainTeam } from '../../src/core/engine/explain.ts';
import { answerModel, solve } from '../../src/core/engine/plan.ts';
import { playsFor } from '../../src/core/engine/plays.ts';
import { DEMANDS } from '../../src/core/kb/plays.ts';
import { newQuery, sanitizeQuery, situationsOf, type PartySize, type Query } from '../../src/core/engine/query.ts';
import { tipsFor } from '../../src/core/engine/tips.ts';
import { MAPS } from '../../src/core/kb/maps.ts';
import { RANK_IDS } from '../../src/core/kb/ranks.ts';
import { AGENTS } from '../../src/core/kb/agents.ts';
import { LINEUPS } from '../../src/core/kb/lineups.ts';
import type { Role } from '../../src/core/kb/roles.ts';

/** A small seeded random number source (mulberry32). */
function seeded(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const SAMPLES = 180;

/** What a question adds beyond map, side, rank and party, in turn, so each kind comes up as often as the others. */
const EXTRAS = ['plain', 'include', 'exclude', 'locked', 'enemy', 'roles', 'site', 'plain', 'enemy'] as const;
type Extra = (typeof EXTRAS)[number];

/** The question for answer `i`, with what it adds in words. */
export function question(i: number, rnd: () => number): { q: Query; extra: string } {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
  // every map at least twelve times, the pool's more often, as people play it
  const map = i < MAPS.length * 12 ? MAPS[i % MAPS.length]!.id : pick(MAPS.filter((m) => m.pool)).id;
  // twenty at each rank, in turn, so every rank is reviewed as closely as the others
  const rank = RANK_IDS[i % RANK_IDS.length]!, side = pick(['attack', 'defense'] as const);
  const kind: Extra = EXTRAS[Math.floor(i / RANK_IDS.length) % EXTRAS.length]!;
  let party = pick([5, 5, 5, 1, 2, 3] as PartySize[]);
  if (kind === 'locked' && (party === 5 || party === 1)) party = pick([2, 3] as PartySize[]);
  const known = AGENTS.filter((a) => !a.estimate);
  const raw: Partial<Query> = { ...newQuery(rank, true), map, side, party };
  if (kind === 'include') { const a = pick(known); raw.include = [a.id]; }
  if (kind === 'exclude') { const a = pick(known), b = pick(known.filter((x) => x.id !== a.id)); raw.exclude = [a.id, b.id]; }
  if (kind === 'locked') { const n = 5 - party, xs = [...known].sort(() => rnd() - 0.5).slice(0, Math.min(2, n)).map((a) => a.id); raw.locked = xs; }
  if (kind === 'enemy') {
    const pros = LINEUPS.filter((l) => l.map === map);
    const them = pros.length ? [...pick(pros).teams[Math.floor(rnd() * 2)]!.agents] : [...known].sort(() => rnd() - 0.5).slice(0, 5).map((a) => a.id);
    raw.enemy = them;
  }
  // a role count is for the party's own picks, so it's at most the party's size
  if (kind === 'roles') { const role = pick(['controller', 'initiator', 'sentinel', 'duelist'] as Role[]), most = Math.min(2, party), n = role === 'controller' ? most : pick([0, most]); raw.roles = { [role]: n }; }
  if (kind === 'site') { const m = MAPS.find((x) => x.id === map)!; raw.sites = [pick(m.sites.map((x) => x.id))]; }
  // what the question adds, in words, as the sanitizer kept it
  const q = sanitizeQuery(raw);
  const roles = Object.entries(q.roles).map(([r, n]) => `${n} ${r}${n === 1 ? '' : 's'}${q.party === 5 ? '' : ' in the party'}`);
  const extra = [
    ...(q.include.length ? [`must play ${q.include.join(' ')}`] : []), ...(q.exclude.length ? [`won't play ${q.exclude.join(' or ')}`] : []),
    ...(q.locked.length ? [`teammates locked ${q.locked.join(' ')}`] : []), ...(q.enemy.length ? [`against ${q.enemy.join(' ')}`] : []),
    ...roles, ...(q.sites.length ? [`site ${q.sites.join(' ')}`] : []),
  ].join(', ');
  return { q, extra };
}

/**
 * How the best comp stands against pro play: the most it shares with a comp pro teams played on two
 * or more maps there (what the app's own reasons count), and with any one team's lineup this year.
 */
function proLine(map: string, team: readonly string[]): string {
  if (PRO[map]?.dated) return `closest pro comp shares ${proOverlap(map, team)} of 5, from last year's events, since this year's didn't play ${map}`;
  const any = Math.max(0, ...LINEUPS.filter((l) => l.map === map).flatMap((l) => l.teams.map((t) => t.agents.filter((id) => team.includes(id)).length)));
  return `closest pro comp shares ${proOverlap(map, team)} of 5, closest single pro lineup ${any} of 5`;
}

export function sample(n = SAMPLES, seed = 55) {
  const rnd = seeded(seed);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const { q, extra } = question(i, rnd);
    const s = situationsOf(q)[0]!;
    const a = solve(q, s, 3), c = a.comps[0];
    const head = `${i + 1}. ${q.map} ${q.side} ${q.rank} ${q.party === 5 ? 'five-stack' : `party of ${q.party}`}${extra ? `, ${extra}` : ''}`;
    if (!c) { out.push(`${head}: no comp fits`); continue; }
    const ex = explainTeam(answerModel(a), c.team, explainFor(q, c));
    const play = playsFor(c.team, q.map, s.side === 'attack' ? 'attack' : 'defense', q.sites, false, [], s.rank)[0];
    const tip = tipsFor(c.team, { ...s, sites: play?.play.site ? [play.play.site] : s.sites }, q.party, c.party).find((t) => !t.agent);
    // a party's own picks, then the best picks to ask random teammates for, and what they'd most likely pick on their own
    const rest = (team: readonly string[]) => team.filter((x) => !c.party.includes(x)).join(' ');
    const comp = q.party === 5 ? c.team.join(' ') : `${c.party.join('+')}, best with random teammates on ${rest(c.team)} (left to themselves, most likely ${rest(c.likely?.team ?? c.team)})`;
    out.push([
      `${head}: ${comp} (fit ${Math.round(c.fit)}, ${proLine(q.map, c.team)})`,
      `   next: ${a.comps.slice(1, 3).map((x) => (q.party === 5 ? x.team : x.party).join(' ')).join(' | ') || 'none'}`,
      // every pro, con and threat, as the comp's card shows them
      `   ${ex.plan}`, `   + ${ex.pros.join(' | ') || 'none'}`, `   - ${ex.cons.join(' | ') || 'none'}`,
      ...(ex.against.length ? [`   vs ${ex.against.map((x) => `${x.threat}. ${againstWords(x)}`).join(' | ')}`] : []),
      `   play: ${play ? `${play.play.name} (${play.play.kind}, ${DEMANDS[play.demand].name.toLowerCase()})` : 'none'}; tip: ${tip?.text ?? 'none'}`,
    ].join('\n'));
  }
  return out;
}
