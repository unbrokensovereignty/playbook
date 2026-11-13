/**
 * Answers to single situations, for the pages that show many at once (Rankings by map, an
 * agent's best maps, a map's best comps). Each takes a moment, so they're worked out one at a
 * time after the page has drawn, newest asked first, and kept so going back is instant.
 */
import { signal } from '@preact/signals';
import { solve, type SituationAnswer } from '../core/engine/plan.ts';
import { situationKey, type Situation } from '../core/engine/model.ts';
import { newQuery } from '../core/engine/query.ts';
import { reportError } from './state.ts';

/** Comps kept per situation. */
const KEEP = 10;
const MOST = 200;

const cache = new Map<string, SituationAnswer>();
const waiting = new Map<string, { s: Situation; newAgents: boolean }>();
/** Situations that went wrong once aren't tried again (the problem is under Help, About). */
const failed = new Set<string>();
/** Goes up whenever an answer comes in, so the pages reading answers draw again. */
export const solvedCount = signal(0);
let busy = false;

const keyOf = (s: Situation, newAgents: boolean) => `${situationKey(s)}|${newAgents}`;

function work(s: Situation, newAgents: boolean): SituationAnswer {
  const a = solve({ ...newQuery(s.rank, newAgents), map: s.map, side: s.side, sites: [...s.sites] }, s, KEEP);
  if (cache.size >= MOST) cache.clear();
  cache.set(keyOf(s, newAgents), a);
  return a;
}

/** The answer for a five-stack with no other choices in a situation, or undefined while it's being worked out. */
export function answerFor(s: Situation, newAgents: boolean): SituationAnswer | undefined {
  void solvedCount.value;
  const k = keyOf(s, newAgents);
  const hit = cache.get(k);
  if (hit || failed.has(k)) return hit;
  // asked again: to the front of the line
  waiting.delete(k);
  waiting.set(k, { s, newAgents });
  if (!busy) { busy = true; setTimeout(next, 0); }
  return undefined;
}

/** The answer straight away, for the one situation a page can't draw without. */
export function answerNow(s: Situation, newAgents: boolean): SituationAnswer {
  return cache.get(keyOf(s, newAgents)) ?? work(s, newAgents);
}

function next() {
  const last = [...waiting.keys()].at(-1);
  if (last === undefined) { busy = false; return; }
  const { s, newAgents } = waiting.get(last)!;
  waiting.delete(last);
  try {
    if (!cache.has(last)) work(s, newAgents);
    solvedCount.value++;
  } catch (e) {
    failed.add(last);
    reportError(e);
  }
  setTimeout(next, 0);
}
