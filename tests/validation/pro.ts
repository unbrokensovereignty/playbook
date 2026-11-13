// How close the engine's answers come to what pro teams played, map by map and event by event
// (kb/lineups.ts). Used by tests/unit/validation.test.ts and tools/validate.mjs. Node only.
import { forgetAnswers, solve } from '../../src/core/engine/plan.ts';
import { newQuery } from '../../src/core/engine/query.ts';
import { FIT } from '../../src/core/engine/weights.ts';
import { agentById, AGENTS } from '../../src/core/kb/agents.ts';
import { EVENTS, LINEUPS, pickable, won, type Lineup } from '../../src/core/kb/lineups.ts';
import { PRO, proFrom, proKnown, type ProMap } from '../../src/core/kb/pro.ts';
import type { RankId } from '../../src/core/kb/ranks.ts';

export const keyOf = (agents: readonly string[]) => [...agents].sort().join(' ');
const controllers = (agents: readonly string[]) => agents.filter((id) => agentById(id)?.role === 'controller').length;

/** Spearman's rank correlation (ties share their average rank). */
export function spearman(xs: readonly number[], ys: readonly number[]): number {
  const ranks = (v: readonly number[]) => {
    const order = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(v.length);
    for (let i = 0; i < order.length;) {
      let j = i;
      while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j++;
      for (let k = i; k <= j; k++) r[order[k]![1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const a = ranks(xs), b = ranks(ys), n = a.length;
  const ma = a.reduce((t, x) => t + x, 0) / n, mb = b.reduce((t, x) => t + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i]! - ma) * (b[i]! - mb); da += (a[i]! - ma) ** 2; db += (b[i]! - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Every lineup of an event on a map, each team's as its own entry. */
export function lineupsOf(event: string, map: string): { agents: readonly string[]; won: boolean }[] {
  return LINEUPS.filter((l: Lineup) => l.event === event && l.map === map).flatMap((l) => ([0, 1] as const).map((i) => ({ agents: l.teams[i].agents, won: won(l, i) })));
}

/** The comp played most (most wins breaking ties) and how often each agent was picked, in percent. */
export function summary(rows: readonly { agents: readonly string[]; won: boolean }[]) {
  const comps = new Map<string, { n: number; w: number }>();
  const picks = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r.agents);
    const c = comps.get(k) ?? { n: 0, w: 0 };
    comps.set(k, { n: c.n + 1, w: c.w + Number(r.won) });
    for (const id of r.agents) picks.set(id, (picks.get(id) ?? 0) + 1);
  }
  const top = [...comps.entries()].sort((a, b) => b[1].n - a[1].n || b[1].w - a[1].w || a[0].localeCompare(b[0]))[0]!;
  const ctrl = rows.map((r) => controllers(r.agents)).sort((a, b) => a - b);
  return {
    top: top[0].split(' '), topCount: top[1].n,
    pick: (id: string) => (100 * (picks.get(id) ?? 0)) / rows.length,
    controllers: ctrl[Math.floor(ctrl.length / 2)]!,
  };
}

export interface MapCheck {
  event: string; map: string; maps: number;
  /** Where the event's most played comp ranks among the engine's comps (1 is best; 0 when not in the top `keep`). */
  topAt: number;
  /** Agents the engine's best comp shares with the closest lineup played there. */
  shared: number;
  /** Agent order (by fit) against the event's pick rates. */
  order: number;
  ctrlBest: number; ctrlPro: number;
  best: string[];
}

/** Checks the engine at `rank` against each event's lineups on each map played at least `least` times there. */
export function checkPro(rank: RankId = 'radiant', least = 3, keep = 10, events: readonly string[] = EVENTS.map((e) => e.id)): MapCheck[] {
  const out: MapCheck[] = [];
  for (const e of EVENTS.filter((x) => events.includes(x.id))) {
    const maps = [...new Set(LINEUPS.filter((l) => l.event === e.id).map((l) => l.map))].sort();
    for (const map of maps) {
      const rows = lineupsOf(e.id, map);
      if (rows.length / 2 < least) continue;
      const s = summary(rows);
      // the engine picks from the agents pro teams could pick there too: none released after the event
      const unpickable = AGENTS.filter((a) => !proKnown(a) || !pickable(a.id, e)).map((a) => a.id);
      const ans = solve({ ...newQuery(rank, true), map, side: 'both', exclude: unpickable }, { map, side: 'both', rank, sites: [] }, keep);
      const best = ans.comps[0]!.team;
      const at = ans.comps.findIndex((c) => keyOf(c.team) === keyOf(s.top));
      const fits = new Map(ans.agents.map((a) => [a.id, a.fit]));
      // the order is over the agents pro teams could pick there
      const ids = AGENTS.filter((a) => proKnown(a) && pickable(a.id, e)).map((a) => a.id);
      out.push({
        event: e.id, map, maps: rows.length / 2, topAt: at + 1,
        shared: Math.max(...rows.map((r) => r.agents.filter((id) => best.includes(id)).length)),
        order: spearman(ids.map((id) => fits.get(id) ?? 0), ids.map((id) => s.pick(id))),
        ctrlBest: controllers(best), ctrlPro: s.controllers, best,
      });
    }
  }
  return out;
}

/** The same checks with the pull toward pro play turned off, so only the kits and the maps decide. */
export function checkProWithoutPull(rank: RankId = 'radiant', least = 3, keep = 10, events?: readonly string[]): MapCheck[] {
  const was = FIT.pro;
  (FIT as { pro: number }).pro = 0;
  forgetAnswers();
  try { return checkPro(rank, least, keep, events); } finally { (FIT as { pro: number }).pro = was; forgetAnswers(); }
}

/**
 * Runs `fn` with the pro numbers built without one event's lineups, as if it hadn't been played:
 * the maps it alone played have no pro numbers then. Maps from an earlier year (`dated`) stay.
 */
export function withoutEvent<T>(event: string, fn: () => T): T {
  const was: Record<string, ProMap> = { ...PRO };
  const rest = proFrom(LINEUPS.filter((l) => l.event !== event));
  for (const k of Object.keys(PRO)) if (!PRO[k]!.dated) delete PRO[k];
  Object.assign(PRO, rest);
  for (const [k, v] of Object.entries(was)) if (v.dated) PRO[k] = v;
  forgetAnswers();
  try { return fn(); } finally {
    for (const k of Object.keys(PRO)) delete PRO[k];
    Object.assign(PRO, was);
    forgetAnswers();
  }
}

/**
 * The checks held out: each event against the engine's answers with its pro numbers built from the
 * other events only, so being close to it can't come from the engine copying it.
 */
export function checkHeldOut(rank: RankId = 'radiant', least = 3, keep = 10, pull = true): MapCheck[] {
  return EVENTS.flatMap((e) => withoutEvent(e.id, () => (pull ? checkPro(rank, least, keep, [e.id]) : checkProWithoutPull(rank, least, keep, [e.id]))));
}

/**
 * The yardstick for a held-out event: the comp played most at the other events on the map, and how
 * many agents it shares with the closest lineup at this one (undefined when no other event played
 * the map). The meta moves between events, so this is about as close as copying pro play gets.
 */
export function copyOthers(event: string, map: string): number | undefined {
  const other = EVENTS.filter((e) => e.id !== event).flatMap((e) => lineupsOf(e.id, map));
  if (!other.length) return undefined;
  const guess = summary(other).top;
  return Math.max(...lineupsOf(event, map).map((r) => r.agents.filter((id) => guess.includes(id)).length));
}

/** The averages over a set of checks. */
export function means(xs: readonly MapCheck[]) {
  const n = xs.length || 1;
  return {
    maps: xs.length,
    inTop: xs.filter((x) => x.topAt > 0).length,
    shared: xs.reduce((t, x) => t + x.shared, 0) / n,
    order: xs.reduce((t, x) => t + x.order, 0) / n,
    ctrl: xs.filter((x) => x.ctrlBest === x.ctrlPro).length,
  };
}
