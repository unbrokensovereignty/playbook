/**
 * Agent select: the agent to lock in now, as the rest of your team locks in theirs. It asks the
 * Planner's own question for a solo player (query.ts: your rank, your agents, the teammates locked
 * in) on one map and both sides, so the pick always matches what the Planner would say, and reads
 * its reasons off the same numbers: what the pick adds to the team's coverage of what the map
 * needs (the score's own coverage, model.ts), and the role the team still lacks.
 */
import { AGENTS, agentById } from '../kb/agents.ts';
import { DIMS, ROLE_IDS, type Dim, type Role } from '../kb/roles.ts';
import { D, type Model } from './model.ts';
import { answerModel, solve, type SituationAnswer } from './plan.ts';
import { myComfort, myPools, newQuery, sanitizeQuery, situationsOf, type Comfort } from './query.ts';
import type { RankId } from '../kb/ranks.ts';

/** Players on a team. */
export const TEAM = 5;
/** Other picks shown after the best one. */
export const SELECT_OTHERS = 3;
/** Most strengths named for what a pick brings. */
export const BRINGS_MOST = 2;
/**
 * How much a pick must add to the team's coverage of a strength, as much as the situation needs it
 * (1 is an average strength covered from nothing to fully), to be named as something it brings.
 */
export const BRINGS_FROM = 0.12;

export interface SelectAsk {
  map: string;
  rank: RankId;
  /** Agents your teammates have locked in, in the order they did. */
  locked: readonly string[];
  /** The agents you play (empty: anyone). */
  mine: readonly string[];
  comfort?: Readonly<Record<string, Comfort>>;
  newAgents: boolean;
}

export interface SelectPick { id: string; fit: number; tier: string }

export interface SelectAnswer {
  /** The agent to lock in, or undefined when nobody is left to pick. */
  pick?: SelectPick;
  /** The next best picks. */
  others: SelectPick[];
  /** What the pick adds most to what the team covers, strongest first. */
  brings: Dim[];
  /** The roles the team has none of with the pick in, when the team is full. */
  lacks: Role[];
  /** The role to ask the players still to pick for, when some are. */
  askFor?: Role;
  /** How many teammates are still to pick after you. */
  toPick: number;
  /** Whether the pick comes from your agents (false when you play anyone, or none of yours is left). */
  fromMine: boolean;
  /** The best pick of any agent, when it isn't one of yours. */
  anyone?: SelectPick;
  /** The full answer, for opening on the Planner. */
  answer?: SituationAnswer;
}

/** The Planner's question for agent select: a solo player on the map, both sides, with these teammates locked in. */
export function selectQuery(a: SelectAsk, mine: boolean) {
  return sanitizeQuery({
    ...newQuery(a.rank, a.newAgents), map: a.map, side: 'both', party: 1, locked: [...a.locked],
    pools: mine ? myPools(1, a.mine) : [], comfort: mine ? myComfort(a.mine, a.comfort ?? {}) : {},
  });
}

const solveOne = (a: SelectAsk, mine: boolean): SituationAnswer => {
  const q = selectQuery(a, mine);
  return solve(q, situationsOf(q)[0]!, SELECT_OTHERS + 1);
};

const picksOf = (ans: SituationAnswer): SelectPick[] =>
  ans.comps.filter((c) => c.party.length).map((c) => ({ id: c.party[0]!, fit: c.fit, tier: c.tier }));

/** How much of each strength a group of agents covers, as the score counts it (1 − the chance all of them miss it). */
function coverOf(m: Model, ids: readonly string[]): number[] {
  return DIMS.map((_, j) => 1 - ids.reduce((miss, id) => miss * m.miss[agentById(id)!.index * D + j]!, 1));
}

/** The strengths a pick adds most to the team's, as much as the situation needs each. */
export function bringsOf(m: Model, team: readonly string[], pick: string): Dim[] {
  const before = coverOf(m, team), after = coverOf(m, [...team, pick]);
  return DIMS.map((d, j) => ({ d, gain: m.weight[j]! * D * (after[j]! - before[j]!) }))
    .filter((x) => x.gain >= BRINGS_FROM).sort((x, y) => y.gain - x.gain).slice(0, BRINGS_MOST).map((x) => x.d);
}

/** The agent to lock in now, and why. */
export function pickNow(a: SelectAsk): SelectAnswer {
  const locked = a.locked.filter((id) => agentById(id)).slice(0, TEAM - 1);
  const ask = { ...a, locked };
  const toPick = TEAM - 1 - locked.length;
  let fromMine = ask.mine.some((id) => !locked.includes(id));
  let ans = solveOne(ask, fromMine);
  // none of your agents can be picked (all locked by teammates): fall back to anyone
  if (fromMine && !picksOf(ans).length) { fromMine = false; ans = solveOne(ask, false); }
  const picks = picksOf(ans);
  const pick = picks[0];
  if (!pick) return { others: [], brings: [], lacks: [], toPick, fromMine: false };
  const m = answerModel(ans);
  const team = [...locked, pick.id];
  const lacks = toPick ? [] : ROLE_IDS.filter((r) => !team.some((id) => agentById(id)!.role === r));
  const askFor = toPick ? (ans.askFor?.[0]?.role as Role | undefined) : undefined;
  let anyone: SelectPick | undefined;
  if (fromMine) {
    const best = picksOf(solveOne(ask, false))[0];
    if (best && best.id !== pick.id) anyone = best;
  }
  return { pick, others: picks.slice(1, SELECT_OTHERS + 1), brings: bringsOf(m, locked, pick.id), lacks, askFor, toPick, fromMine, anyone, answer: ans };
}

/** The agents still free to pick: everyone but those locked in. */
export const freeAgents = (locked: readonly string[], newAgents: boolean) => AGENTS.filter((x) => !locked.includes(x.id) && (newAgents || !x.estimate));
