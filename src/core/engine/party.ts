/**
 * Picks for a duo or trio: the agents your party should play so the team stays strong whatever
 * random teammates lock in. Each party is scored by its expected score over every way the rest
 * of the team could fill, each fill weighted by how likely random players at your rank are to
 * pick it (they pick popular agents more, and usually fill a missing controller).
 */
import { AGENTS } from '../kb/agents.ts';
import { ROLE_IDS } from '../kb/roles.ts';
import { RANKS } from '../kb/ranks.ts';
import { BY_RANK, RADIANT, RANKED_SOURCE } from '../kb/ranked.ts';
import { D, N, ROLE_OF, ROLES_N, roleIndex, type Model } from './model.ts';
import { roleCostOf, scoreTeam, TopK, walkTeams, type Rules, type Team } from './search.ts';
import { FILL_MISSING, FILL_TOO_MANY_CONTROLLERS, FILL_TOO_MANY_DUELISTS } from './weights.ts';

const CONTROLLER = roleIndex('controller');

/**
 * Each agent's share of picks at each rank (kb/ranked.ts). The twenty agents picked most at a rank
 * get the shares the twenty picked most across all ranks have (agents.ts, `pop`), in their order at
 * that rank, and the rest share what's left evenly; at Radiant, where the shares themselves are
 * known, they're used as they are. An agent released since those numbers keeps their share across all ranks.
 */
const SHARES: readonly Float64Array[] = (() => {
  const counted = AGENTS.filter((a) => a.released < RANKED_SOURCE.from);
  const sorted = counted.map((a) => a.pop).sort((x, y) => y - x);
  return RANKS.map((r) => {
    const out = new Float64Array(AGENTS.length);
    const list = BY_RANK[r.id];
    const rest = sorted.slice(list.length);
    const tail = rest.length ? rest.reduce((t, x) => t + x, 0) / Math.max(1, counted.length - list.length) : 0;
    for (const a of AGENTS) {
      if (!counted.includes(a)) { out[a.index] = a.pop; continue; }
      const at = list.indexOf(a.id);
      if (r.id === 'radiant') out[a.index] = RADIANT[a.id]?.[0] ?? Math.min(0.1, tail);
      else out[a.index] = at >= 0 ? sorted[at]! : tail;
    }
    return out;
  });
})();

/** How often random players at rank `t` (0 Iron to 1 Radiant) lock an agent in, relative to others: their share of picks there, between the two nearest ranks. */
export function pickWeight(agent: number, t: number): number {
  const at = RANKS.findIndex((r) => r.t >= t - 1e-9);
  const hi = Math.max(0, at), lo = Math.max(0, hi - 1);
  const span = RANKS[hi]!.t - RANKS[lo]!.t;
  const f = span > 0 ? (t - RANKS[lo]!.t) / span : 1;
  return Math.max(0.05, SHARES[lo]![agent]! * (1 - f) + SHARES[hi]![agent]! * f);
}

const DUELIST = ROLE_IDS.indexOf('duelist');
/** How likely random players are to leave the team like this, as a factor. */
export function fillLikelihood(counts: ArrayLike<number>): number {
  let f = 1;
  ROLE_IDS.forEach((r, i) => { if (!counts[i]) f *= FILL_MISSING[r]; });
  if (counts[DUELIST]! >= 3) f *= FILL_TOO_MANY_DUELISTS;
  if (counts[CONTROLLER]! >= 3) f *= FILL_TOO_MANY_CONTROLLERS;
  return f;
}

export interface PartyPick {
  /** Your party's agents. */
  party: number[];
  /** The expected score of the whole team. */
  expected: number;
  /** How much the score swings with the fill (standard deviation). */
  spread: number;
  /** The most likely full team, and the best one: the agents to ask random teammates for. */
  likely: Team;
  best: Team;
  /** The next best full teams after `best`, best first (up to PICKS − 1). */
  others: Team[];
}

/** How many of the best full teams each party keeps: the best, and the next ones as other good picks. */
const PICKS = 3;

export interface PartyResult {
  top: PartyPick[];
  /** The best party with each agent in it. */
  bestWith: (PartyPick | null)[];
  count: number;
}

/** Agents as bits of two numbers (31 to each, so up to 62 agents), to tell fast whether two groups share one. */
const lo = (a: number) => (a < 31 ? 1 << a : 0);
const hi = (a: number) => (a < 31 ? 0 : 1 << (a - 31));

interface Fills {
  size: number;
  n: number;
  maskLo: Int32Array;
  maskHi: Int32Array;
  agents: Int32Array;
  miss: Float64Array;
  base: Float64Array;
  pair: Float64Array;
  counts: Uint8Array;
  /** Each fill's role counts packed into one number (see `packRoles`). */
  roles: Int32Array;
  weight: Float64Array;
}

/**
 * Role counts packed as one base-6 digit per role, so a team's packed counts are the sum of its
 * parts' and a table can hold what each mix of roles costs.
 */
const packRoles = (counts: ArrayLike<number>): number => {
  let c = 0;
  for (let r = ROLES_N - 1; r >= 0; r--) c = c * 6 + counts[r]!;
  return c;
};
const PACKED = 6 ** ROLES_N;

/** Every way `size` random teammates could fill from `pool`. */
function allFills(m: Model, pool: readonly number[], size: number, rankT: number): Fills {
  const combos: number[][] = [];
  const rec = (start: number, cur: number[]) => {
    if (cur.length === size) { combos.push(cur.slice()); return; }
    for (let i = start; i <= pool.length - (size - cur.length); i++) { cur.push(pool[i]!); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  const n = combos.length;
  const f: Fills = {
    size, n, maskLo: new Int32Array(n), maskHi: new Int32Array(n), agents: new Int32Array(n * Math.max(1, size)), miss: new Float64Array(n * D).fill(1),
    base: new Float64Array(n), pair: new Float64Array(n), counts: new Uint8Array(n * ROLES_N), roles: new Int32Array(n), weight: new Float64Array(n),
  };
  combos.forEach((c, i) => {
    let w = 1;
    c.forEach((a, k) => {
      f.maskLo[i]! |= lo(a);
      f.maskHi[i]! |= hi(a);
      f.agents[i * size + k] = a;
      f.base[i]! += m.base[a]!;
      f.counts[i * ROLES_N + ROLE_OF[a]!]!++;
      for (let q = 0; q < k; q++) f.pair[i]! += m.pair[a * N + c[q]!]!;
      for (let j = 0; j < D; j++) f.miss[i * D + j]! *= m.miss[a * D + j]!;
      w *= pickWeight(a, rankT);
    });
    f.weight[i] = w;
    f.roles[i] = packRoles(f.counts.subarray(i * ROLES_N, (i + 1) * ROLES_N));
  });
  return f;
}

/**
 * What a party that plays both controllers itself adds to its team's score. It plays its smokes
 * together as well as a five-stack at its rank, so it pays what that five-stack would for the
 * second (Model.ownSecond), and it picks the two as that five-stack would (Model.together).
 */
function ownSmokes(m: Model, party: readonly number[]): number {
  let n = 0, own = 0;
  for (const a of party) if (ROLE_OF[a] === CONTROLLER) { n++; own += m.together[a]! - m.base[a]!; }
  return n >= 2 ? m.ownSecond + own : 0;
}

export interface PartyRules extends Rules {
  /** Teammates already locked in (not part of the party). */
  locked: readonly number[];
  /** Agents random teammates may pick. */
  fillable: (i: number) => boolean;
}

/** Ranks every party of `size` the rules allow by its expected team score. */
export function searchParties(m: Model, rules: PartyRules, size: number, rankT: number, keep = 40): PartyResult {
  const locked = [...new Set(rules.locked)];
  const lockedSet = new Set(locked);
  const fillSize = 5 - size - locked.length;
  const fillPool: number[] = [];
  for (let i = 0; i < N; i++) if (!lockedSet.has(i) && rules.fillable(i)) fillPool.push(i);
  const fills = allFills(m, fillPool, Math.max(0, fillSize), rankT);
  // the locked teammates' own numbers
  const lockMiss = new Float64Array(D).fill(1);
  const lockCounts = new Int32Array(ROLES_N);
  let lockBase = 0, lockPair = 0, lockLo = 0, lockHi = 0;
  locked.forEach((a, k) => {
    lockLo |= lo(a);
    lockHi |= hi(a);
    lockBase += m.base[a]!;
    lockCounts[ROLE_OF[a]!]!++;
    for (let q = 0; q < k; q++) lockPair += m.pair[a * N + locked[q]!]!;
    for (let j = 0; j < D; j++) lockMiss[j]! *= m.miss[a * D + j]!;
  });
  const partyRules: Rules = { include: rules.include, roles: rules.roles, allowed: (i) => !lockedSet.has(i) && rules.allowed(i), fits: rules.fits };
  // what each mix of roles costs, and how likely random teammates are to leave the team with it
  const roleTable = new Float64Array(PACKED), likeTable = new Float64Array(PACKED);
  const digits = new Int32Array(ROLES_N);
  for (let c = 0; c < PACKED; c++) {
    for (let r = 0, x = c; r < ROLES_N; r++, x = Math.floor(x / 6)) digits[r] = x % 6;
    roleTable[c] = roleCostOf(m, digits);
    likeTable[c] = fillLikelihood(digits);
  }
  const lockRoles = packRoles(lockCounts);
  const w = m.weight;
  /** The weight of each strength the party and locked teammates leave uncovered. */
  const open = new Float64Array(D);
  /** Each agent's pairs with the party and the locked teammates. */
  const pairTo = new Float64Array(N);
  const top = new TopK(keep);
  const picks = new Map<string, PartyPick>();
  const bestWith: (PartyPick | null)[] = Array(N).fill(null);
  const { n: fN, size: fSize, maskLo: fLo, maskHi: fHi, miss: fMiss, agents: fAgents, base: fBase, pair: fPair, roles: fRoles, weight: fWeight } = fills;
  const count = walkTeams(m, partyRules, size, (team, miss, baseSum, pairSum, partyCounts) => {
    const party = Array.from(team.subarray(0, size));
    let maskLo = lockLo, maskHi = lockHi, cross = lockPair;
    for (const a of party) {
      maskLo |= lo(a);
      maskHi |= hi(a);
      for (const l of locked) cross += m.pair[a * N + l]!;
    }
    for (let j = 0; j < D; j++) open[j] = w[j]! * miss[j]! * lockMiss[j]!;
    const fixed = [...party, ...locked];
    for (let f = 0; f < N; f++) {
      let p = 0;
      for (const a of fixed) p += m.pair[f * N + a]!;
      pairTo[f] = p;
    }
    const roles0 = packRoles(partyCounts) + lockRoles;
    const s0 = 1 + baseSum + lockBase + pairSum + cross + ownSmokes(m, party);
    let sw = 0, sws = 0, sws2 = 0, likelyW = -1, likelyS = 0, likelyI = -1;
    // the best fills, best first
    const topS: number[] = Array(PICKS).fill(-Infinity), topI: number[] = Array(PICKS).fill(-1);
    for (let i = 0; i < fN; i++) {
      if ((fLo[i]! & maskLo) | (fHi[i]! & maskHi)) continue;
      let missed = 0;
      for (let j = 0, o = i * D; j < D; j++) missed += open[j]! * fMiss[o + j]!;
      let pairs = fPair[i]!;
      for (let k = 0, o = i * fSize; k < fSize; k++) pairs += pairTo[fAgents[o + k]!]!;
      const roles = roles0 + fRoles[i]!;
      const s = s0 - missed + fBase[i]! + pairs + roleTable[roles]!;
      const wt = fWeight[i]! * likeTable[roles]!;
      sw += wt; sws += wt * s; sws2 += wt * s * s;
      if (wt > likelyW) { likelyW = wt; likelyS = s; likelyI = i; }
      if (s > topS[PICKS - 1]!) {
        let k = PICKS - 1;
        while (k > 0 && s > topS[k - 1]!) { topS[k] = topS[k - 1]!; topI[k] = topI[k - 1]!; k--; }
        topS[k] = s; topI[k] = i;
      }
    }
    if (sw <= 0) return;
    const fillOf = (i: number) => (i < 0 ? [] : Array.from(fills.agents.subarray(i * fills.size, (i + 1) * fills.size)));
    // with nobody left to fill there's one (empty) fill, and the team is the party and the locked teammates
    const exp = fills.size ? sws / sw : likelyS;
    const spread = fills.size ? Math.sqrt(Math.max(0, sws2 / sw - exp * exp)) : 0;
    const sorted = (xs: number[]) => xs.sort((a, b) => a - b);
    const pick: PartyPick = {
      party: sorted(party), expected: exp, spread,
      likely: { agents: sorted([...fixed, ...fillOf(likelyI)]), score: fills.size ? likelyS : exp },
      best: { agents: sorted([...fixed, ...fillOf(topI[0]!)]), score: fills.size ? topS[0]! : exp },
      others: fills.size ? topI.slice(1).filter((i) => i >= 0).map((i, k) => ({ agents: sorted([...fixed, ...fillOf(i)]), score: topS[k + 1]! })) : [],
    };
    for (const a of party) if (!bestWith[a] || exp > bestWith[a]!.expected) bestWith[a] = pick;
    if (exp > top.floor) {
      // TopK keeps five slots per entry: the party padded with -1
      const key = pick.party.join(',');
      picks.set(key, pick);
      top.push(exp, [...pick.party, ...Array(5 - size).fill(-1)]);
    }
  });
  const list = top.list().map((t) => picks.get(t.agents.filter((a) => a >= 0).sort((a, b) => a - b).join(','))!).filter(Boolean);
  return { top: list, bestWith, count };
}

/**
 * For one party: which role random teammates should pick. Returns each role with the expected
 * score when at least one random teammate plays it, and how often they do without being asked
 * (0 to 1), best first.
 */
export function askFor(m: Model, party: readonly number[], rules: PartyRules, rankT: number): { role: string; expected: number; chance: number }[] {
  const fixed = [...party, ...rules.locked];
  const fixedSet = new Set(fixed);
  const pool: number[] = [];
  for (let i = 0; i < N; i++) if (!fixedSet.has(i) && rules.fillable(i)) pool.push(i);
  const fills = allFills(m, pool, 5 - fixed.length, rankT);
  const bonus = ownSmokes(m, party);
  const sums = ROLE_IDS.map(() => ({ w: 0, ws: 0 }));
  const counts = new Int32Array(ROLES_N);
  let all = 0;
  for (let i = 0; i < fills.n; i++) {
    const team = [...fixed, ...fills.agents.subarray(i * fills.size, (i + 1) * fills.size)];
    counts.fill(0);
    for (const a of team) counts[ROLE_OF[a]!]!++;
    const s = scoreTeam(m, team) + bonus;
    const wt = fills.weight[i]! * fillLikelihood(counts);
    all += wt;
    for (let r = 0; r < ROLES_N; r++) {
      if (fills.counts[i * ROLES_N + r]! > 0) { sums[r]!.w += wt; sums[r]!.ws += wt * s; }
    }
  }
  return ROLE_IDS.map((role, r) => ({ role, expected: sums[r]!.w ? sums[r]!.ws / sums[r]!.w : -Infinity, chance: all ? sums[r]!.w / all : 0 }))
    .filter((x) => x.expected > -Infinity)
    .sort((a, b) => b.expected - a.expected);
}
