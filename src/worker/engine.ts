/**
 * The engine, run in a worker beside the page (see ui/engine.ts), so the page answers clicks and
 * keys while a question is worked out. It runs one job at a time and sends back its answer.
 * tools/build.mjs bundles this file on its own and inlines it into the app.
 */
import { JOBS, type JobName } from '../core/engine/jobs.ts';

export interface EngineAsk { id: number; job: JobName; args: unknown[] }

const me = globalThis as unknown as { onmessage: ((e: MessageEvent<EngineAsk>) => void) | null; postMessage: (m: unknown) => void };
me.onmessage = (e) => {
  const { id, job, args } = e.data;
  try { me.postMessage({ id, ok: true, answer: (JOBS[job] as (...a: unknown[]) => unknown)(...args) }); }
  catch (err) { me.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) }); }
};
// tells the page it's running, so a worker that loads but never answers is noticed
me.postMessage({ ready: true });
