/**
 * Scores teams. A team's score is how well its strengths cover what the situation needs, plus
 * each agent's own fit, each pair's synergy and the cost of its role counts:
 *
 *   score = Σ weight[d] · (1 − Π (1 − strength[a][d]))  +  Σ base[a]  +  Σ pair[a][b]  +  Σ roleCost[r][count]
 *
 * Coverage (the first part) is the chance that at least one agent brings a strength, so a second
 * smoker adds less than the first. `searchTeams` scores every team the rules allow (all 142,506
 * five-agent teams when nothing is fixed), building each team's numbers as it adds one agent at a
 * time so no work is repeated.
 */
import { D, N, ROLE_OF, ROLES_N, type Model } from './model.ts';

/** What a team must be. Agents are indices into AGENTS. */
export interface Rules {
  /** Agents that must be in the team. */
  include: readonly number[];
  /** Agents that may be picked (an included agent always may). */
  allowed: (i: number) => boolean;
  /** An exact count for a role (by its index in ROLE_IDS), or -1 for any. */
  roles: readonly number[];
  /** A last check on a finished team (its first `size` agents), such as whether each player can play one of them. */
  fits?: (team: Int32Array, size: number) => boolean;
}

export interface Team { agents: number[]; score: number }

export interface SearchResult {
  /** The best teams, best first. */
  top: Team[];
  /** The best team with each agent in it (null when no allowed team has the agent). */
  bestWith: (Team | null)[];
  /** How many teams were scored. */
  count: number;
  /** The best score, and the middle (median) one. */
  best: number;
  mid: number;
}

export const anyRoles = (): number[] => Array(ROLES_N).fill(-1);

/** One team's score, the slow, plain way (for explanations and to check the search). */
export function scoreTeam(m: Model, team: readonly number[]): number {
  let miss = 0, base = 0, pair = 0, roles = 0;
  const counts = new Array(ROLES_N).fill(0);
  for (let j = 0; j < D; j++) {
    let p = 1;
    for (const a of team) p *= m.miss[a * D + j]!;
    miss += m.weight[j]! * p;
  }
  team.forEach((a, i) => {
    base += m.base[a]!;
    counts[ROLE_OF[a]!]++;
    for (let k = 0; k < i; k++) pair += m.pair[a * N + team[k]!]!;
  });
  counts.forEach((c, r) => { roles += m.roleCost[r * 5 + Math.min(c, 4)]!; });
  return 1 - miss + base + pair + roles;
}

/** Scores spread over [LO, HI) in BINS steps, to find the median without keeping every score. */
const LO = -1.5, HI = 1.5, BINS = 3000;

export class Histogram {
  bins = new Uint32Array(BINS);
  n = 0;
  add(s: number) {
    const b = Math.min(BINS - 1, Math.max(0, Math.floor(((s - LO) / (HI - LO)) * BINS)));
    this.bins[b]!++;
    this.n++;
  }
  /** The score below which a share `q` of the scores fall. */
  quantile(q: number): number {
    const want = q * this.n;
    let seen = 0;
    for (let b = 0; b < BINS; b++) {
      seen += this.bins[b]!;
      if (seen >= want && seen > 0) return LO + ((b + 0.5) / BINS) * (HI - LO);
    }
    return LO;
  }
}

/** Keeps the K best teams seen. */
export class TopK {
  private scores: Float64Array;
  private teams: Int32Array;
  private n = 0;
  private k: number;
  constructor(k: number) {
    this.k = k;
    this.scores = new Float64Array(k);
    this.teams = new Int32Array(k * 5);
  }
  /** The lowest score kept, once full (anything lower can be skipped). */
  get floor(): number { return this.n < this.k ? -Infinity : this.scores[0]!; }
  push(score: number, team: Int32Array | readonly number[]) {
    if (this.n < this.k) {
      let i = this.n++;
      this.place(i, score, team);
      // sift up (a min-heap: the lowest score at the top)
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (this.scores[p]! <= this.scores[i]!) break;
        this.swap(i, p);
        i = p;
      }
      return;
    }
    if (score <= this.scores[0]!) return;
    this.place(0, score, team);
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let s = i;
      if (l < this.n && this.scores[l]! < this.scores[s]!) s = l;
      if (r < this.n && this.scores[r]! < this.scores[s]!) s = r;
      if (s === i) break;
      this.swap(i, s);
      i = s;
    }
  }
  private place(i: number, score: number, team: Int32Array | readonly number[]) {
    this.scores[i] = score;
    for (let k = 0; k < 5; k++) this.teams[i * 5 + k] = team[k]!;
  }
  private swap(a: number, b: number) {
    const s = this.scores[a]!; this.scores[a] = this.scores[b]!; this.scores[b] = s;
    for (let k = 0; k < 5; k++) {
      const x = this.teams[a * 5 + k]!; this.teams[a * 5 + k] = this.teams[b * 5 + k]!; this.teams[b * 5 + k] = x;
    }
  }
  /** Best first. */
  list(): Team[] {
    const out: Team[] = [];
    for (let i = 0; i < this.n; i++) out.push({ agents: Array.from(this.teams.subarray(i * 5, i * 5 + 5)).sort((a, b) => a - b), score: this.scores[i]! });
    return out.sort((a, b) => b.score - a.score || a.agents.join().localeCompare(b.agents.join()));
  }
}

/**
 * Walks every team the rules allow, adding agents one at a time in index order. `leaf` gets each
 * finished team: its agents, the product of misses per strength, the sum of agent fits and pair
 * synergy so far, and its role counts. Returns how many teams there were.
 */
export function walkTeams(
  m: Model, rules: Rules, size: number,
  leaf: (team: Int32Array, miss: Float64Array, baseSum: number, pairSum: number, counts: Int32Array) => void,
): number {
  const include = [...new Set(rules.include)].sort((a, b) => a - b);
  if (include.length > size) return 0;
  const inc = new Set(include);
  const pool: number[] = [];
  for (let i = 0; i < N; i++) if (!inc.has(i) && rules.allowed(i)) pool.push(i);
  const counts = new Int32Array(ROLES_N);
  const target = rules.roles;
  const team = new Int32Array(5);
  // misses per strength at each depth: level k holds the product over the first k agents
  const miss = new Float64Array((size + 1) * D).fill(1);
  let base0 = 0, pair0 = 0;
  for (let k = 0; k < include.length; k++) {
    const a = include[k]!;
    team[k] = a;
    counts[ROLE_OF[a]!]!++;
    base0 += m.base[a]!;
    for (let q = 0; q < k; q++) pair0 += m.pair[a * N + include[q]!]!;
    for (let j = 0; j < D; j++) miss[(k + 1) * D + j] = miss[k * D + j]! * m.miss[a * D + j]!;
  }
  // the included agents alone may already break a role count
  for (let r = 0; r < ROLES_N; r++) if (target[r]! >= 0 && counts[r]! > target[r]!) return 0;
  const deficit = () => {
    let d = 0;
    for (let r = 0; r < ROLES_N; r++) if (target[r]! > counts[r]!) d += target[r]! - counts[r]!;
    return d;
  };
  let n = 0;
  const leafMiss = new Float64Array(D);
  const rec = (depth: number, start: number, baseSum: number, pairSum: number) => {
    if (depth === size) {
      // every role with an exact count must have reached it
      for (let r = 0; r < ROLES_N; r++) if (target[r]! >= 0 && counts[r] !== target[r]) return;
      if (rules.fits && !rules.fits(team, size)) return;
      for (let j = 0; j < D; j++) leafMiss[j] = miss[depth * D + j]!;
      n++;
      leaf(team, leafMiss, baseSum, pairSum, counts);
      return;
    }
    const left = size - depth;
    for (let i = start; i <= pool.length - left; i++) {
      const a = pool[i]!, r = ROLE_OF[a]!;
      if (target[r]! >= 0 && counts[r]! >= target[r]!) continue;
      counts[r]!++;
      if (deficit() <= left - 1) {
        let add = 0;
        for (let k = 0; k < depth; k++) add += m.pair[a * N + team[k]!]!;
        team[depth] = a;
        const from = depth * D, to = from + D;
        for (let j = 0; j < D; j++) miss[to + j] = miss[from + j]! * m.miss[a * D + j]!;
        rec(depth + 1, i + 1, baseSum + m.base[a]!, pairSum + add);
      }
      counts[r]!--;
    }
  };
  rec(include.length, 0, base0, pair0);
  return n;
}

/** The cost of a team's role counts. */
export const roleCostOf = (m: Model, counts: ArrayLike<number>): number => {
  let s = 0;
  for (let r = 0; r < ROLES_N; r++) s += m.roleCost[r * 5 + Math.min(counts[r]!, 4)]!;
  return s;
};

/** Scores every five-agent team the rules allow. */
export function searchTeams(m: Model, rules: Rules, keep = 60): SearchResult {
  const top = new TopK(keep);
  const hist = new Histogram();
  const bestScore = new Float64Array(N).fill(-Infinity);
  const bestTeam = new Int32Array(N * 5);
  const w = m.weight;
  let best = -Infinity;
  const count = walkTeams(m, rules, 5, (team, miss, baseSum, pairSum, counts) => {
    let missed = 0;
    for (let j = 0; j < D; j++) missed += w[j]! * miss[j]!;
    const s = 1 - missed + baseSum + pairSum + roleCostOf(m, counts);
    hist.add(s);
    if (s > best) best = s;
    if (s > top.floor) top.push(s, team);
    for (let k = 0; k < 5; k++) {
      const a = team[k]!;
      if (s > bestScore[a]!) {
        bestScore[a] = s;
        for (let q = 0; q < 5; q++) bestTeam[a * 5 + q] = team[q]!;
      }
    }
  });
  const bestWith: (Team | null)[] = [];
  for (let a = 0; a < N; a++) {
    bestWith.push(bestScore[a] === -Infinity ? null : { agents: Array.from(bestTeam.subarray(a * 5, a * 5 + 5)).sort((x, y) => x - y), score: bestScore[a]! });
  }
  return { top: top.list(), bestWith, count, best: count ? best : 0, mid: count ? hist.quantile(0.5) : 0 };
}
