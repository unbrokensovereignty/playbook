/**
 * Turns a situation (map, side, sites, rank) into the numbers the search scores teams with:
 * how much each strength matters, how much of each agent's kit a team at the rank gets out of it,
 * each agent's own fit, each pair's synergy and each role count's cost. "Any map" and "Both
 * sides" are the average of the situations they cover.
 */
import { AGENTS, agentById, earlyStats, type Agent } from '../kb/agents.ts';
import { MAPS, POOL, mapById, parseNeeds, type MapInfo, type Side, type SiteId } from '../kb/maps.ts';
import { OLDER, PRO, proKnown, proPick, proRoleMix } from '../kb/pro.ts';
import { RANKS, rankOf, type RankId } from '../kb/ranks.ts';
import { DIMS, ROLE_IDS, type Dim, type Role } from '../kb/roles.ts';
import { PAIRS } from '../kb/synergy.ts';
import { rulesFor, type ParsedRule } from '../kb/kitfit.ts';
import { THREATS, type Threat } from '../kb/counters.ts';
import { MAP_WINS } from '../kb/mapwins.ts';
import { RADIANT, RANKED_SOURCE } from '../kb/ranked.ts';
import { BASE, BY_RANK, EXEC, FIT, HARD, MAP_WIN, NEW_WIN_SHARE, PAIR_STEP, PARTY_RANDOM, PARTY_TEAM, RANKED_PULL, RANKED_ROLE, PRO_GAMES, PRO_RISE, RADIANT_WIN, RANK_NEAR, ROLE_COST, ROLE_MIX, SECOND_CONTROLLER, WIN_CAP, WIN_RANKS } from './weights.ts';

export type MapPick = string; // a map id, or 'any'
export type SidePick = Side | 'both';

/**
 * One situation to plan for. `sites` is empty for all of the map's sites; `enemy` is the other
 * team's agents, as far as they're known (none, or left out, when they aren't); `party` is the size
 * of the party planning, which sets how much its team plays together (PARTY_TEAM; left out, a
 * five-stack).
 */
export interface Situation { map: MapPick; side: SidePick; sites: readonly SiteId[]; rank: RankId; enemy?: readonly string[]; party?: 1 | 2 | 3 | 5 }

/** How much a team plays together at rank `rankT` for a party of `party` (PARTY_TEAM). */
export const teamAt = (rankT: number, party: 1 | 2 | 3 | 5 = 5): number => rankT * PARTY_TEAM[party];

export const N = AGENTS.length;
export const D = DIMS.length;
export const ROLES_N = ROLE_IDS.length;
export const roleIndex = (r: Role): number => ROLE_IDS.indexOf(r);

/** Each agent's role, as an index into ROLE_IDS. */
export const ROLE_OF = new Uint8Array(N);
for (const a of AGENTS) ROLE_OF[a.index] = roleIndex(a.role);

export interface Model {
  situation: Situation;
  /** How much each strength matters (sums to 1). */
  weight: Float64Array;
  /**
   * Per agent and strength: 1 − the strength a team at this rank gets out of the agent, which the
   * search multiplies to find a team's coverage: miss[a * D + d].
   */
  miss: Float64Array;
  /** Each agent's own fit. */
  base: Float64Array;
  /**
   * For a party of fewer than five, what each controller's own fit would be in a team that plays
   * together (a five-stack at the rank): a party that plays both controllers times its own smokes,
   * so it picks them that way (core/engine/party.ts). Equal to `base` for a five-stack.
   */
  together: Float64Array;
  /** Pair synergy, both ways: pair[a * N + b]. */
  pair: Float64Array;
  /** The cost of `c` agents of role `r`: roleCost[r * 5 + min(c, 4)]. */
  roleCost: Float64Array;
  /**
   * The parts that make up each agent's own fit, for the explanations. `win` includes `atTop`, the
   * part from Radiant's own win rates (radiantEdge); `ranked` is the pull toward what players at
   * Radiant pick (RANKED_PULL).
   */
  fitParts: { pro: Float64Array; rank: Float64Array; win: Float64Array; atTop: Float64Array; ranked: Float64Array; comfort?: Float64Array };
  /**
   * How many of each role pro teams run in the situation (by ROLE_IDS index; NaN without pro
   * numbers), the part of each role count's cost that comes from straying from it, and how much of
   * the cost of having none of a role is forgiven because pro teams there mostly play without it.
   */
  mix: { want: Float64Array; cost: Float64Array; relax: Float64Array };
  /** What a second controller costs at this rank, since it pays off only when a team plays its smokes together (SECOND_CONTROLLER). */
  secondController: number;
  /**
   * How much of `secondController` a duo or trio that plays both controllers itself gets back: it
   * plays its smokes together as well as a five-stack at its rank, so it pays what that five-stack
   * would. Nothing for a five-stack.
   */
  ownSecond: number;
  /**
   * The kit rules (kb/kitfit.ts) that change each agent's strengths here, by agent index, with how
   * much each adds to (or takes from) a team's score on its own, averaged over the situations covered.
   */
  kit: { rule: ParsedRule; gain: number }[][];
  /** How well each agent works alone here, by agent index (their `solo` as the kit rules change it, averaged over the situations covered). */
  solo: Float64Array;
  /**
   * What the other team's agents make you play around (kb/counters.ts), most first: how far each
   * threat goes (0 to 1, averaged over the situations covered) and their agents behind it, most first.
   */
  threats: ThreatAt[];
}

export interface ThreatAt { threat: Threat; level: number; who: string[] }

/**
 * The places on the climb (0 Iron to 1 Radiant) whose games a rank's answers take in, each with its
 * share: the rank's own and its neighbors' (RANK_NEAR).
 */
export function rankMix(rank: RankId): readonly (readonly [t: number, share: number])[] {
  const at = RANKS.findIndex((r) => r.id === rank);
  const near = [RANKS[at - 1], RANKS[at + 1]].filter((r) => !!r).map((r) => [r.t, RANK_NEAR] as const);
  return [[rankOf(rank).t, 1 - RANK_NEAR * near.length], ...near];
}

/** Something that changes with the rank's place on the climb, as a rank's answers count it (rankMix). */
export const atRank = (rank: RankId, f: (rankT: number) => number): number => rankMix(rank).reduce((acc, [t, w]) => acc + w * f(t), 0);

/**
 * How much of a strength a team at rank `rankT` gets out of an agent, as a share (see EXEC):
 * all of it at Radiant, less of a hard or team-dependent kit lower down, and all of gun play.
 * `teamT` is how much the team plays together (teamAt), which a team-dependent kit needs.
 */
export function execShare(a: Agent, dim: Dim, rankT: number, teamT = rankT): number {
  const keys = a.via[dim] ?? '';
  const gun = keys.includes('G') ? (keys.length === 1 ? 1 : 0.5) : 0;
  return gun + (1 - gun) * kitShare(a, rankT, teamT);
}

/** How much of an agent's abilities (gun play aside) a team at rank `rankT` gets out of them, playing together as far as `teamT`. */
export const kitShare = (a: { skill: number; solo: number }, rankT: number, teamT = rankT): number => 1 - (1 - rankT) * EXEC.skill * a.skill - (1 - teamT) * EXEC.team * (1 - a.solo);

/** The bumps a map, side and set of sites add to each strength. */
export function needsFor(map: MapInfo, side: Side, sites: readonly SiteId[]): Record<Dim, number> {
  const out = Object.fromEntries(DIMS.map((d) => [d, 0])) as Record<Dim, number>;
  const add = (spec: string | undefined, share: number) => {
    for (const [d, v] of Object.entries(parseNeeds(spec, map.name)) as [Dim, number][]) out[d] += v * share;
  };
  add(map.needs.both, 1);
  add(map.needs[side], 1);
  const chosen = map.sites.filter((s) => !sites.length || sites.includes(s.id));
  for (const s of chosen) {
    add(s.needs.both, 1 / chosen.length);
    add(s.needs[side], 1 / chosen.length);
  }
  return out;
}

/** How much a rank leans on pro play, from PRO_RISE.low at Iron to 1 from PRO_RISE.until up. */
export const proLean = (rankT: number): number => PRO_RISE.low + (1 - PRO_RISE.low) * Math.min(1, rankT / rankOf(PRO_RISE.until).t) ** PRO_RISE.power;

/** How far a team at rank `rankT` plays its smokes together, which two controllers need (SECOND_CONTROLLER). */
export const togetherAt = (rankT: number): number => Math.min(1, rankT / rankOf(SECOND_CONTROLLER.until).t) ** PRO_RISE.power;

/** How much a map's pro numbers count: less for a small sample or an earlier year's play (PRO_GAMES). */
export function proShare(map: string): number {
  const p = PRO[map];
  if (!p) return 0;
  if (p.dated) return PRO_GAMES.dated;
  return Math.max(PRO_GAMES.least, Math.min(1, ((p.games ?? 0) + OLDER * (p.regional ?? 0)) / PRO_GAMES.full));
}

/** −0.3 for an agent pros don't pick, about 0 at 9%, 0.7 for one picked every time. */
const proCurve = (pct: number) => Math.sqrt(pct / 100) - 0.3;

/** How much ranked win rates count at a rank (0 Iron to 1 Radiant): fully between WIN_RANKS.from and .to. */
export function winShare(rankT: number): number {
  const { iron, from, to, radiant } = WIN_RANKS;
  if (rankT < from) return iron + (1 - iron) * (rankT / from);
  if (rankT <= to) return 1;
  return 1 - (1 - radiant) * ((rankT - to) / (1 - to));
}

/**
 * How much better (or worse) than usual each agent does on each map in ranked, in points of win
 * rate, as far as it's more than chance (MAP_WIN): mapWin[map][agent id].
 */
const mapWin: Record<string, Record<string, number>> = (() => {
  // each map's rates moved so its average game is won 50%, as the overall rates are
  const moved = Object.entries(MAP_WINS).map(([map, m]) => {
    const rows = Object.entries(m.agents);
    const games = rows.reduce((t, [, [, n]]) => t + n, 0);
    const mean = rows.reduce((t, [, [w, n]]) => t + w * n, 0) / games;
    return [map, rows.map(([id, [w, n]]) => [id, w - mean + 50, n] as const)] as const;
  });
  // and each agent's rate across all the maps
  const all = new Map<string, { won: number; games: number }>();
  for (const [, rows] of moved) for (const [id, w, n] of rows) {
    const x = all.get(id) ?? { won: 0, games: 0 };
    all.set(id, { won: x.won + w * n, games: x.games + n });
  }
  return Object.fromEntries(moved.map(([map, rows]) => [map, Object.fromEntries(rows.map(([id, w, n]) => {
    const x = all.get(id)!;
    return [id, (w - x.won / x.games) * (n / (n + MAP_WIN.games))];
  }))]));
})();

/** How much better (or worse) than usual an agent does on a map in ranked, in points of win rate (0 without numbers). */
export const mapWinOf = (map: string, id: string): number => mapWin[map]?.[id] ?? 0;

/**
 * How far an agent's ranked win rate is from 50%, in points, as far as it counts (WIN_CAP,
 * NEW_WIN_SHARE): on `map`, with how much better or worse than usual they do there.
 */
export const winEdge = (a: Agent, map?: string): number =>
  Math.max(-WIN_CAP, Math.min(WIN_CAP, a.win - 50 + (map ? mapWinOf(map, a.id) : 0))) * (earlyStats(a) ? NEW_WIN_SHARE : 1);

/**
 * Radiant's own win rates (kb/ranked.ts), moved so the average pick there wins 50%, as points either
 * side of 50% as far as they count (WIN_CAP, RADIANT_WIN).
 */
const radiantWin: Record<string, number> = (() => {
  const rows = Object.entries(RADIANT);
  const picks = rows.reduce((t, [, [p]]) => t + p, 0);
  const mean = rows.reduce((t, [, [p, w]]) => t + p * w, 0) / picks;
  return Object.fromEntries(rows.map(([id, [p, w]]) => [id, Math.max(-WIN_CAP, Math.min(WIN_CAP, w - mean)) * (p / (p + RADIANT_WIN.pick))]));
})();
/** How far an agent's win rate at Radiant is from the average there, in points, as far as it counts (0 without one). */
export const radiantEdge = (id: string): number => radiantWin[id] ?? 0;
/** How much Radiant's own win rates count at a rank (0 Iron to 1 Radiant): from nothing at RADIANT_WIN.from to fully at Radiant. */
export const radiantShare = (rankT: number): number => Math.max(0, (rankT - rankOf(RADIANT_WIN.from).t) / (1 - rankOf(RADIANT_WIN.from).t));

/**
 * How often players at Radiant pick an agent (kb/ranked.ts), on the same curve as pro picks: as the
 * share of teams with them, −0.3 for an agent hardly anyone there picks. An agent out since those
 * numbers is neutral.
 */
export const radiantPickCurve = (a: Agent): number =>
  a.estimate || a.released >= RANKED_SOURCE.from ? 0 : proCurve(Math.min(100, 5 * (RADIANT[a.id]?.[0] ?? 0)));

/**
 * How much of a hard kit's cost (HARD) counts at a rank: all of it at Iron, fading to nothing at
 * HARD.until, or for the hardest kits all of it through HARD.full.until before it fades.
 */
export function hardFade(a: Agent, rankT: number): number {
  const end = rankOf(HARD.until).t, start = a.skill >= HARD.full.skill ? rankOf(HARD.full.until).t : 0;
  return rankT <= start ? 1 : Math.max(0, 1 - (rankT - start) / (end - start));
}

/** The agent fit parts for one map and rank, for a team that plays together as far as `teamT` (teamAt) and is `random` random players (PARTY_RANDOM). */
function agentFit(a: Agent, map: string, rankT: number, teamT = rankT, random = 0, solo = a.solo): { pro: number; rank: number; win: number; atTop: number; ranked: number } {
  // a new agent's map and rank fit start neutral: there's no play to go on yet
  if (a.estimate) return { pro: 0, rank: 0, win: 0, atTop: 0, ranked: 0 };
  // and an agent pros haven't had the chance to pick isn't pulled either way by pro play, here
  // (a map's numbers from an earlier year) or anywhere (one released since this year's events)
  const pro = proKnown(a) && !(a.released > (PRO[map]?.until ?? a.released)) ? FIT.pro * proLean(teamT) * proCurve(proPick(map, a.id)) * proShare(map) : 0;
  // and a notably hard kit costs more at the low ranks, until players have the mechanics for it (HARD)
  const hard = hardFade(a, rankT) * HARD.cost * Math.max(0, a.skill - HARD.from);
  const rank = (1 - teamT) * FIT.solo * (solo - 0.55) - (1 - rankT) * FIT.skill * (a.skill - 0.5) - hard;
  // Radiant's own rates come from ranked games of mostly random teams, so they count as far as the team is random
  const atTop = FIT.win * random * radiantShare(rankT) * radiantEdge(a.id);
  const win = FIT.win * winShare(rankT) * winEdge(a, map) + atTop;
  // and what players at the top pick in ranked pulls random teams there the way pro play pulls teams that play together (RANKED_PULL)
  const ranked = FIT.pro * RANKED_PULL.share * random * radiantShare(rankT) * radiantPickCurve(a);
  return { pro, rank, win, atTop, ranked };
}

/**
 * How far each threat of the other team's agents goes on a map, with you on `side`: each agent adds
 * what their kit brings to the threat's strength there above its `from` (only those after the
 * strongest, for a `second` threat), and `full` of that is the whole threat. Their kits count at
 * full strength, whatever the rank: you plan for the other team playing them well.
 */
export function threatsOf(enemy: readonly string[], map: MapInfo, side: Side, sites: readonly SiteId[]): ThreatAt[] {
  const them = enemy.map((id) => agentById(id)).filter((a): a is Agent => !!a);
  if (!them.length) return [];
  const theirSide: Side = side === 'attack' ? 'defense' : 'attack';
  const rules = them.map((a) => rulesFor(a.id, map.id, theirSide, sites));
  const out: ThreatAt[] = [];
  for (const t of THREATS) {
    if (t.side && t.side !== side) continue;
    const brings = them.map((a, i) => ({ id: a.id, over: capWith(a, t.dim, rules[i]!) - t.from })).filter((x) => x.over > 0).sort((a, b) => b.over - a.over);
    const counted = t.second ? brings.slice(1) : brings;
    const level = Math.min(1, counted.reduce((acc, x) => acc + x.over, 0) / t.full);
    if (level > 0) out.push({ threat: t, level, who: brings.map((x) => x.id) });
  }
  return out;
}

function single(map: MapInfo, side: Side, sites: readonly SiteId[], rankT: number, teamT: number, random: number, enemy: readonly string[]) {
  const needs = needsFor(map, side, sites);
  // what the other team makes you play around, as far as it goes
  const threats = threatsOf(enemy, map, side, sites);
  for (const { threat, level } of threats) for (const [d, v] of Object.entries(threat.needs) as [Dim, number][]) needs[d] += v * level;
  const weight = new Float64Array(D);
  let sum = 0;
  DIMS.forEach((d, j) => {
    const [lo, hi] = BY_RANK[d];
    weight[j] = BASE[side][d] * Math.max(0.05, 1 + needs[d]) * (lo + (hi - lo) * rankT);
    sum += weight[j]!;
  });
  for (let j = 0; j < D; j++) weight[j]! /= sum;
  // how this map, side and site change each agent's strengths, and how well they work alone (kb/kitfit.ts)
  const rules = AGENTS.map((a) => rulesFor(a.id, map.id, side, sites));
  const pro = new Float64Array(N), rank = new Float64Array(N), win = new Float64Array(N), atTop = new Float64Array(N), ranked = new Float64Array(N);
  for (const a of AGENTS) {
    const f = agentFit(playedWith(a, rules[a.index]!), map.id, rankT, teamT, random, soloWith(a, rules[a.index]!));
    pro[a.index] = f.pro;
    rank[a.index] = f.rank;
    win[a.index] = f.win;
    atTop[a.index] = f.atTop;
    ranked[a.index] = f.ranked;
  }
  return { weight, pro, rank, win, atTop, ranked, rules, threats };
}

/**
 * The ability keys behind an agent's strength in a situation: those of the kit rules that add to it
 * here first (kb/kitfit.ts, a rule's `via`), then the agent's own.
 */
export function viaIn(m: Model, a: Agent, d: Dim): string {
  let keys = '';
  for (const { rule } of m.kit[a.index]!) if (rule.via && (rule.bumps[d] ?? 0) > 0) keys += rule.via;
  return [...new Set(keys + (a.via[d] ?? ''))].join('');
}

/** How well an agent works alone once the kit rules that apply have changed it (a rule's `solo`). */
export const soloWith = (a: Agent, rules: readonly ParsedRule[]): number =>
  Math.max(0, Math.min(1, rules.reduce((v, r) => v + (r.solo ?? 0), a.solo)));

/**
 * An agent as the kit rules that apply have changed how hard the kit is to play well (a rule's
 * `skill`): the same agent when none do.
 */
export function playedWith(a: Agent, rules: readonly ParsedRule[]): Agent {
  const skill = Math.max(0, Math.min(1, rules.reduce((v, r) => v + (r.skill ?? 0), a.skill)));
  return skill === a.skill ? a : { ...a, skill };
}

/** An agent's strength once the kit rules that apply have changed it. */
const capWith = (a: Agent, d: Dim, rules: readonly ParsedRule[]): number =>
  Math.max(0, Math.min(1, rules.reduce((v, r) => v + (r.bumps[d] ?? 0), a.caps[d])));

const roleOfId = (id: string) => agentById(id)?.role;

/**
 * A map's pro role mix as a team at a rank should aim for it. Pro teams' second controller is
 * teamwork, which counts only as far as a team plays its smokes together (`together`, see
 * SECOND_CONTROLLER): below that, the mix leans toward one controller, and the place it frees is
 * shared evenly by the other roles, since a team can fill it with whatever it plays best. Otherwise
 * the mix would charge a team twice for playing one controller where pros play two, once for the
 * controller and once for the role that takes the place.
 */
function mixAt(mix: Record<Role, number> | undefined, together: number): Record<Role, number> | undefined {
  if (!mix || mix.controller <= 1 || together >= 1) return mix;
  const spare = (mix.controller - 1) * (1 - together);
  const out = { ...mix, controller: mix.controller - spare };
  const others = ROLE_IDS.filter((r) => r !== 'controller');
  for (const r of others) out[r] += spare / others.length;
  return out;
}
/** How many of each role pro teams run on a map, on average (see proRoleMix in kb/pro.ts). */
export const proMixOf = (map: string) => proRoleMix(map, roleOfId);

const cache = new Map<string, Model>();
/** Drops the kept models, for checks that change the knowledge base or the weights in place. */
export const forgetModels = (): void => cache.clear();
export const situationKey = (s: Situation) => `${s.map}|${s.side}|${[...s.sites].sort().join('')}|${s.rank}|${[...(s.enemy ?? [])].sort().join()}${s.party && s.party !== 5 ? `|${s.party}` : ''}`;

/** The numbers for a situation (kept, since the same ones are asked for again and again). */
export function modelFor(s: Situation): Model {
  const key = situationKey(s);
  const hit = cache.get(key);
  if (hit) return hit;
  const maps = s.map === 'any' ? POOL : [mapById(s.map) ?? MAPS[0]!];
  const sides: Side[] = s.side === 'both' ? ['attack', 'defense'] : [s.side];
  const weight = new Float64Array(D), pro = new Float64Array(N), rank = new Float64Array(N), win = new Float64Array(N), atTop = new Float64Array(N), ranked = new Float64Array(N);
  const miss = new Float64Array(N * D);
  const kit: { rule: ParsedRule; gain: number }[][] = AGENTS.map(() => []);
  const solo = new Float64Array(N);
  const threats: ThreatAt[] = [];
  // each map and side, at the rank and its neighbors (rankMix), each counting for its share
  const party = s.party ?? 5;
  const ownPair = new Float64Array(N);
  for (const [rankT, rankShare] of rankMix(s.rank)) for (const m of maps) {
    const teamT = teamAt(rankT, party);
    for (const side of sides) {
      const parts = (maps.length * sides.length) / rankShare;
      const one = single(m, side, s.map === 'any' ? [] : s.sites, rankT, teamT, PARTY_RANDOM[party], s.enemy ?? []);
      // a party's own pair of controllers, as a team that plays together would pick them (Model.together)
      if (party !== 5) for (const a of AGENTS) {
        if (a.role !== 'controller') continue;
        const f = agentFit(playedWith(a, one.rules[a.index]!), m.id, rankT, teamAt(rankT), PARTY_RANDOM[5], soloWith(a, one.rules[a.index]!));
        ownPair[a.index]! += (f.pro + f.rank + f.win + f.ranked) / parts;
      }
      for (const x of one.threats) {
        const had = threats.find((y) => y.threat === x.threat);
        if (had) { had.level += x.level / parts; had.who = [...new Set([...had.who, ...x.who])]; }
        else threats.push({ ...x, level: x.level / parts });
      }
      for (let j = 0; j < D; j++) weight[j]! += one.weight[j]! / parts;
      for (let i = 0; i < N; i++) { pro[i]! += one.pro[i]! / parts; rank[i]! += one.rank[i]! / parts; win[i]! += one.win[i]! / parts; atTop[i]! += one.atTop[i]! / parts; ranked[i]! += one.ranked[i]! / parts; }
      for (const a of AGENTS) {
        const rules = one.rules[a.index]!, played = playedWith(a, rules);
        solo[a.index]! += soloWith(a, rules) / parts;
        DIMS.forEach((d, j) => { miss[a.index * D + j]! += (1 - capWith(a, d, rules) * execShare(played, d, rankT, teamT)) / parts; });
        for (const rule of rules) {
          // what the rule adds on its own: each strength it changes, as the score weighs it here
          // (and what it changes in how well the agent works alone or how hard the kit is to play,
          // as the rank fit weighs those)
          const as = playedWith(a, [rule]);
          const gain = (DIMS.reduce((acc, d, j) => acc + one.weight[j]! * (capWith(a, d, [rule]) * execShare(as, d, rankT, teamT) - a.caps[d] * execShare(a, d, rankT, teamT)), 0)
            + (1 - teamT) * FIT.solo * (soloWith(a, [rule]) - a.solo)
            + (as === a ? 0 : agentFit(as, m.id, rankT, teamT).rank - agentFit(a, m.id, rankT, teamT).rank)) / parts;
          const had = kit[a.index]!.find((k) => k.rule === rule);
          if (had) had.gain += gain;
          else kit[a.index]!.push({ rule, gain });
        }
      }
    }
  }
  const base = new Float64Array(N);
  for (let i = 0; i < N; i++) base[i] = pro[i]! + rank[i]! + win[i]! + ranked[i]!;
  const ownBase = party === 5 ? base : Float64Array.from(base, (b, i) => (AGENTS[i]!.role === 'controller' ? ownPair[i]! : b));
  const pair = new Float64Array(N * N);
  const index = new Map(AGENTS.map((a) => [a.id, a.index]));
  // how far a team at this rank plays its smokes together: what two controllers need (SECOND_CONTROLLER)
  const together = atRank(s.rank, (t) => togetherAt(teamAt(t, party)));
  for (const p of PAIRS) {
    const a = index.get(p.a), b = index.get(p.b);
    if (a === undefined || b === undefined) continue;
    const share = p.side === 'both' ? 1 : sides.filter((x) => x === p.side).length / sides.length;
    // two controllers' pair is that teamwork, so it counts only as far as the team plays together,
    // and so is a flash timed for a teammate's entry, which pays off only if they swing as it pops
    const both = (AGENTS[a]!.role === 'controller' && AGENTS[b]!.role === 'controller') || p.timed ? together : 1;
    const v = p.strength * PAIR_STEP * share * both;
    pair[a * N + b] = v;
    pair[b * N + a] = v;
  }
  // the hard rules for role counts (ROLE_COST), and straying from each map's pro role mix (ROLE_MIX)
  const roleCost = new Float64Array(ROLES_N * 5), want = new Float64Array(ROLES_N), mixCost = new Float64Array(ROLES_N * 5), relaxed = new Float64Array(ROLES_N);
  let mixed = 0;
  const lean = atRank(s.rank, (t) => proLean(teamAt(t, party)));
  for (const m of maps) {
    const mix = proRoleMix(m.id, roleOfId), aim = mixAt(mix, together);
    const share = proShare(m.id);
    if (mix) mixed++;
    ROLE_IDS.forEach((r, ri) => {
      // where pros on the map mostly play without a role, the rule that a team needs one relaxes at high ranks
      const relax = mix ? lean * share * Math.max(0, 1 - mix[r]) : 0;
      relaxed[ri]! += relax / maps.length;
      for (let c = 0; c < 5; c++) {
        const hard = sides.reduce((acc, side) => acc + ROLE_COST[r][side][c]!, 0) / sides.length;
        // a team of random players (PARTY_RANDOM) pays what ranked teams with that many of the role lose (RANKED_ROLE)
        const random = PARTY_RANDOM[party] * sides.reduce((acc, side) => acc + RANKED_ROLE[r][side][c]!, 0) / sides.length;
        roleCost[ri * 5 + c]! += ((c === 0 ? hard * (1 - relax) : hard) + random) / maps.length;
        if (aim) mixCost[ri * 5 + c]! -= (ROLE_MIX * lean * share * (c - aim[r]) ** 2) / maps.length;
      }
      if (mix) want[ri]! += mix[r];
    });
  }
  for (let ri = 0; ri < ROLES_N; ri++) want[ri] = mixed ? want[ri]! / mixed : Number.NaN;
  for (let i = 0; i < roleCost.length; i++) roleCost[i]! += mixCost[i]!;
  // a second controller needs a team that plays its smokes together, which pro play shows how to do
  const secondController = SECOND_CONTROLLER.cost * (1 - together);
  const ownSecond = party === 5 ? 0 : secondController - SECOND_CONTROLLER.cost * (1 - atRank(s.rank, (t) => togetherAt(teamAt(t))));
  const ci = roleIndex('controller');
  for (let c = 2; c < 5; c++) roleCost[ci * 5 + c]! -= secondController;
  const model: Model = {
    situation: { ...s, sites: [...s.sites], enemy: [...(s.enemy ?? [])] }, weight, miss, base, together: ownBase, pair, roleCost, fitParts: { pro, rank, win, atTop, ranked }, mix: { want, cost: mixCost, relax: relaxed }, secondController, ownSecond, kit, solo,
    threats: threats.sort((a, b) => b.level - a.level),
  };
  if (cache.size > 200) cache.clear();
  cache.set(key, model);
  return model;
}
