/**
 * How sure a fit is. Most of a fit rests on things with a lot of play behind them, but three parts
 * can rest on very little, and each could be off by about as much as it could count:
 *
 * - `early`: the ranked win rate of an agent in their first days (earlyStats in kb/agents.ts), which
 *   could turn out anywhere within WIN_CAP once players have learned the agent;
 * - `pro`: what pro teams would pick, for an agent who came out after the year's top events
 *   (proKnown in kb/pro.ts), whose pull could be anywhere within SURE.pro of none;
 * - `kit`: the kit rules (kb/kitfit.ts) of an agent with early numbers, which no play has checked
 *   yet; each could be off by SURE.kit of what it adds.
 *
 * They're taken as independent, so they add up as the root of the sum of their squares, and are
 * measured in points of the agent's fit, against the same reference the fit was read from. A fit
 * is less sure when that comes to SURE.less points or more: about a tier's worth.
 */
import { AGENTS, agentById, earlyStats, type Agent } from '../kb/agents.ts';
import { POOL } from '../kb/maps.ts';
import { proKnown } from '../kb/pro.ts';
import { listJoin } from '../text.ts';
import { whereWords } from './explain.ts';
import { atRank, proLean, proShare, winShare, type Model, type Situation } from './model.ts';
import { AGENT_STRETCH, FIT, FIT_MID, SURE, WIN_CAP } from './weights.ts';

export type DoubtWhy = 'early' | 'pro' | 'kit';

/** A fit that's less sure: how far it could be off, in points of the fit, and why, biggest first. */
export interface Unsure { by: number; why: DoubtWhy[] }

/** The parts of an agent's own score in a situation that rest on very little, each as far as it could be off, in score points. */
export function doubtsOf(m: Model, a: Agent): { why: DoubtWhy; by: number }[] {
  const s = m.situation;
  const out: { why: DoubtWhy; by: number }[] = [];
  if (earlyStats(a)) out.push({ why: 'early', by: FIT.win * atRank(s.rank, winShare) * WIN_CAP });
  if (!proKnown(a)) {
    const maps = s.map === 'any' ? POOL.map((x) => x.id) : [s.map];
    const share = maps.reduce((acc, x) => acc + proShare(x), 0) / maps.length;
    out.push({ why: 'pro', by: FIT.pro * atRank(s.rank, proLean) * SURE.pro * share });
  }
  if (earlyStats(a)) out.push({ why: 'kit', by: SURE.kit * Math.hypot(...m.kit[a.index]!.map((k) => k.gain)) });
  return out.filter((x) => x.by > 0);
}

/** The score points behind one point of an agent's fit, against a reference (as agentFitOf in plan.ts reads it). */
const perPoint = (ref: { best: number; mid: number }, stretch: number) => Math.max(1e-9, ref.best - ref.mid) / (stretch * (100 - FIT_MID));

/** How sure an agent's fit is, against the reference it was read from: undefined when it's sure enough. */
export function agentUnsure(m: Model, id: string, ref: { best: number; mid: number }, stretch = AGENT_STRETCH): Unsure | undefined {
  const a = agentById(id);
  if (!a) return undefined;
  const parts = doubtsOf(m, a).map((x) => ({ why: x.why, by: x.by / perPoint(ref, stretch) }));
  const by = Math.hypot(...parts.map((x) => x.by));
  if (by < SURE.less) return undefined;
  // the parts that count for something, biggest first
  return { by, why: parts.filter((x) => x.by >= SURE.part * by).sort((x, y) => y.by - x.by).map((x) => x.why) };
}

/** Why each part is thin, for an agent. */
function clause(why: DoubtWhy, a: Agent, s: Situation): string {
  switch (why) {
    case 'early': return `the ranked numbers are from ${a.name}’s first days`;
    case 'kit': return `what ${a.name}’s kit does ${whereWords(s)} is judged from the abilities alone`;
    case 'pro': return `pros haven’t played ${a.name} yet`;
  }
}

/** Why an agent's fit is less sure, as a sentence. */
export function unsureWords(s: Situation, id: string, u: Unsure): string {
  const a = agentById(id);
  if (!a) return 'This fit is less sure.';
  return `This fit is less sure and could be off by about ${Math.round(u.by)}, since ${listJoin(u.why.map((w) => clause(w, a, s)))}.`;
}

/** The agents whose fits can be less sure at all: those with early ranked numbers or no pro play yet. */
export const UNSETTLED: readonly Agent[] = AGENTS.filter((a) => earlyStats(a) || !proKnown(a));
