/**
 * The page's side of the engine's worker (ui/engine.ts), against a stand-in worker the test answers
 * by hand: a newer job lets go of an older one without stopping the worker, a job left running long
 * after it was let go makes way for a fresh worker, and only a worker that never runs at all sends
 * the engine's work to the page for the rest of the session.
 */
import { afterEach, beforeEach, mock, test } from 'node:test';
import { deepStrictEqual as eq, equal, ok, rejects } from 'node:assert/strict';
import type { Engine } from '../../src/ui/engine.ts';
import { pickNow, type SelectAsk } from '../../src/core/engine/select.ts';

class FakeWorker {
  static all: FakeWorker[] = [];
  sent: { id: number; job: string }[] = [];
  ended = false;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: { preventDefault: () => void }) => void) | null = null;
  constructor() { FakeWorker.all.push(this); }
  postMessage(m: { id: number; job: string }) { this.sent.push({ id: m.id, job: m.job }); }
  terminate() { this.ended = true; }
  ready() { this.onmessage?.({ data: { ready: true } }); }
  answer(id: number, answer: unknown) { this.onmessage?.({ data: { id, ok: true, answer } }); }
}

const g = globalThis as Record<string, unknown>;
g.window = globalThis;
g.Worker = FakeWorker;
g.__ENGINE_WORKER__ = '';
/** A fresh copy of ui/engine.ts, with its own idea of whether workers run here. */
let copies = 0;
const fresh = async (): Promise<(() => Engine)> => (await import(`../../src/ui/engine.ts?copy=${++copies}`)).makeEngine;
const ask = { map: 'haven', rank: 'gold', locked: ['jett'], mine: [], comfort: {}, newAgents: false } as unknown as SelectAsk;
const live = () => FakeWorker.all.filter((w) => !w.ended);
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => { FakeWorker.all = []; mock.timers.enable({ apis: ['setTimeout'] }); });
afterEach(() => mock.timers.reset());

test('a newer job lets go of the older one without stopping the worker, and the older reply is ignored', async () => {
  const engine = (await fresh())();
  const first = engine.run('pickNow', ask);
  const w = FakeWorker.all[0]!;
  w.ready();
  eq(w.sent.map((x) => x.id), [1]);
  engine.cancel();
  await rejects(first, /stopped/);
  const second = engine.run('pickNow', ask);
  // one job at a time: the second waits until the worker is done with the first
  eq(w.sent.map((x) => x.id), [1]);
  ok(engine.busy());
  w.answer(1, 'old');
  eq(w.sent.map((x) => x.id), [1, 2]);
  w.answer(2, 'new');
  equal(await second, 'new');
  equal(FakeWorker.all.length, 1, 'no new worker');
  ok(!w.ended, 'the worker keeps running');
  ok(!engine.busy());
});

test('jobs let go of before the worker got to them never reach it', async () => {
  const engine = (await fresh())();
  const w = (void engine.run('pickNow', ask).catch(() => {}), FakeWorker.all[0]!);
  w.ready();
  for (let i = 0; i < 3; i++) { engine.cancel(); void engine.run('pickNow', ask).catch(() => {}); }
  engine.cancel();
  const last = engine.run('pickNow', ask);
  w.answer(1, 'old');
  // job 1 was on the worker; of the four after it only the newest is still wanted
  eq(w.sent.map((x) => x.id), [1, 5]);
  w.answer(5, 'new');
  equal(await last, 'new');
});

test('a job left running long after a newer one replaced it makes way for a fresh worker', async () => {
  const engine = (await fresh())();
  void engine.run('pickNow', ask).catch(() => {});
  const w = FakeWorker.all[0]!;
  w.ready();
  engine.cancel();
  const second = engine.run('pickNow', ask);
  mock.timers.tick(1000);
  equal(live().length, 1, 'a moment is fine');
  mock.timers.tick(5000);
  ok(w.ended, 'the stuck worker is stopped');
  const next = FakeWorker.all[1]!;
  ok(next && !next.ended, 'and a new one started');
  eq(next.sent.map((x) => x.id), [2]);
  next.ready();
  next.answer(2, 'new');
  equal(await second, 'new');
});

test('a restarted worker that’s slow to start does its job on the page, and the next job still goes to a worker', async () => {
  const makeEngine = await fresh();
  const engine = makeEngine();
  void engine.run('pickNow', ask).catch(() => {});
  FakeWorker.all[0]!.ready();
  engine.cancel();
  const second = engine.run('pickNow', ask);
  mock.timers.tick(6000);
  // the fresh worker never says it's ready: the page works the pick out itself
  mock.timers.tick(10_000);
  await flush(); mock.timers.tick(10); await flush();
  eq(await second, pickNow(ask));
  // other engines, and this one's next job, still get a worker
  const before = FakeWorker.all.length;
  void makeEngine().run('pickNow', ask).catch(() => {});
  equal(FakeWorker.all.length, before + 1, 'a new engine still starts a worker');
  void engine.run('pickNow', ask).catch(() => {});
  equal(FakeWorker.all.length, before + 2, 'and so does this one');
});

test('a worker that never says it’s ready sends the work to the page for the rest of the session', async () => {
  const makeEngine = await fresh();
  const first = makeEngine().run('pickNow', ask);
  mock.timers.tick(10_000);
  await flush(); mock.timers.tick(10); await flush();
  eq(await first, pickNow(ask));
  const before = FakeWorker.all.length;
  const other = makeEngine().run('pickNow', ask);
  equal(FakeWorker.all.length, before, 'no worker is tried again');
  await flush(); mock.timers.tick(10); await flush();
  eq(await other, pickNow(ask));
});
