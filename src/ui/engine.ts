/**
 * The engine's work, done in a worker beside the page (src/worker/engine.ts) so a long answer never
 * holds up a click or a key. Each user of it (the Planner, the pages that show many situations,
 * Agent select) has its own worker, so one can be busy without holding up the others. Where a worker
 * can't start, or starts and never says it's ready, the page does the work itself, with a pause for
 * the screen after each job.
 */
import { JOBS, type JobName, type Jobs } from '../core/engine/jobs.ts';

/** How long a new worker has to say it's running before the page works answers out itself. */
const READY_MS = 4000;
/**
 * How long a job that's no longer wanted (a newer question came) may keep the worker from a newer
 * one. A worker can't be interrupted, so past this it's stopped and a fresh one started.
 */
const LET_GO_MS = 2500;
let url = '';
/** Once workers have failed to run here, no more are started. */
let broken = typeof Worker === 'undefined' || typeof __ENGINE_WORKER__ === 'undefined';
/**
 * A worker has said it's running in this tab. After that, a worker slow to start (a restart on a
 * busy computer) is only slow: its jobs are done on the page, and the next job tries a worker again.
 */
let workersRun = false;

export interface Engine {
  /** Runs a job and gives its answer. A job let go of by `cancel` rejects with the message "stopped". */
  run<K extends JobName>(job: K, ...args: Parameters<Jobs[K]>): Promise<ReturnType<Jobs[K]>>;
  /**
   * Lets go of every job still waiting (they reject with "stopped"). The worker keeps running: what it's
   * on finishes and is ignored, and jobs it hadn't got to are never sent.
   */
  cancel(): void;
  /** Whether a job is still waiting. */
  busy(): boolean;
}

type Job = { id: number; ok: (a: unknown) => void; fail: (e: Error) => void; job: JobName; args: unknown[] };

export function makeEngine(): Engine {
  let worker: Worker | null = null, ready = false, readyTimer = 0, letGoTimer = 0, seq = 0;
  /** Jobs the worker hasn't been sent yet: it gets one at a time, so one let go of before its turn never runs. */
  const queue: Job[] = [];
  /** The job the worker is on, `wanted` until it's let go of, and when that was. */
  let current: { job: Job; wanted: boolean; since: number } | null = null;
  const here = async (job: JobName, args: unknown[]) => {
    const a = (JOBS[job] as (...x: unknown[]) => unknown)(...args);
    await new Promise((r) => setTimeout(r, 0)); // let the screen draw, and a newer question cancel this one
    return a;
  };
  const onPage = (j: Job) => { here(j.job, j.args).then(j.ok, j.fail); };
  const drop = () => {
    clearTimeout(readyTimer);
    clearTimeout(letGoTimer);
    letGoTimer = 0;
    worker?.terminate();
    worker = null;
  };
  // the worker can't do the work: what's waiting is done here instead. `forGood`, so is all that follows
  const giveUp = (forGood: boolean) => {
    if (forGood) broken = true;
    drop();
    const all = [...(current?.wanted ? [current.job] : []), ...queue.splice(0)];
    current = null;
    for (const j of all) onPage(j);
  };
  const start = (): Worker | null => {
    if (worker || broken) return worker;
    try {
      url ||= URL.createObjectURL(new Blob([__ENGINE_WORKER__], { type: 'text/javascript' }));
      const w = new Worker(url);
      ready = false;
      // one that never says it's ready means workers don't run here, unless one already has
      readyTimer = window.setTimeout(() => { if (!ready && worker === w) giveUp(!workersRun); }, READY_MS);
      w.onmessage = (e: MessageEvent<{ ready?: boolean; id: number; ok: boolean; answer?: unknown; error?: string }>) => {
        if (worker !== w) return;
        if (e.data.ready) { ready = workersRun = true; clearTimeout(readyTimer); return; }
        if (!current || current.job.id !== e.data.id) return;
        const { job, wanted } = current;
        current = null;
        clearTimeout(letGoTimer);
        letGoTimer = 0;
        if (wanted) {
          if (e.data.ok) job.ok(e.data.answer);
          else job.fail(new Error(e.data.error ?? 'The engine stopped.'));
        }
        send();
      };
      w.onerror = (e) => { e.preventDefault(); if (worker === w) giveUp(true); };
      worker = w;
      return w;
    } catch {
      broken = true;
      return null;
    }
  };
  /** Gives the worker the next job, once it's free. */
  const send = () => {
    if (current || !queue.length) return;
    const w = start();
    if (!w) { for (const j of queue.splice(0)) onPage(j); return; }
    const job = queue.shift()!;
    current = { job, wanted: true, since: performance.now() };
    w.postMessage({ id: job.id, job: job.job, args: job.args });
  };
  // a job nobody wants any more, still on the worker while a newer one waits: it has LET_GO_MS from
  // when it was let go of, then the worker is stopped and a fresh one takes the newer job
  const watch = () => {
    if (letGoTimer || !current || current.wanted || !queue.length) return;
    letGoTimer = window.setTimeout(() => {
      letGoTimer = 0;
      if (!current || current.wanted || !queue.length) return;
      drop();
      current = null;
      send();
    }, Math.max(0, current.since + LET_GO_MS - performance.now()));
  };
  return {
    run(job, ...args) {
      return new Promise((ok, fail) => {
        queue.push({ id: ++seq, ok: ok as (a: unknown) => void, fail, job, args });
        send();
        watch();
      }) as never;
    },
    cancel() {
      for (const j of queue.splice(0)) j.fail(new Error('stopped'));
      if (current?.wanted) {
        current.wanted = false;
        current.since = performance.now();
        current.job.fail(new Error('stopped'));
      }
    },
    busy: () => queue.length > 0 || !!current?.wanted,
  };
}
