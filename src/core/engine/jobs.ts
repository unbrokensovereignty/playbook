/**
 * The engine's jobs that can run beside the page (src/worker/engine.ts) or in it (ui/engine.ts):
 * each takes plain data and gives back plain data, so it can cross to a worker and back.
 */
import { solve } from './plan.ts';
import { pickNow } from './select.ts';

export const JOBS = { solve, pickNow } as const;
export type Jobs = typeof JOBS;
export type JobName = keyof Jobs;
