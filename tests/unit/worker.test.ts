/** The engine's worker answers each job as the page would, and says when it's ready. */
import { test } from 'node:test';
import { deepStrictEqual as eq, ok } from 'node:assert/strict';
import { solve } from '../../src/core/engine/plan.ts';
import { newQuery } from '../../src/core/engine/query.ts';
import type { Situation } from '../../src/core/engine/model.ts';
import { pickNow, type SelectAsk } from '../../src/core/engine/select.ts';

test('the worker says it is ready, then answers solve and pickNow as the page would', async () => {
  const sent: any[] = [];
  const g = globalThis as any;
  g.postMessage = (m: unknown) => sent.push(JSON.parse(JSON.stringify(m)));
  await import('../../src/worker/engine.ts');
  ok(sent[0]?.ready, 'it says it is ready first');
  const s = { map: 'haven', side: 'attack', rank: 'gold', sites: [] } as unknown as Situation;
  const q = { ...newQuery(s.rank, false), map: s.map, side: s.side, sites: [] };
  g.onmessage({ data: { id: 1, job: 'solve', args: [q, s, 5] } });
  eq(sent[1], { id: 1, ok: true, answer: JSON.parse(JSON.stringify(solve(q, s, 5))) });
  const ask = { map: 'haven', rank: 'gold', locked: ['jett'], mine: [], comfort: {}, newAgents: false } as unknown as SelectAsk;
  g.onmessage({ data: { id: 2, job: 'pickNow', args: [ask] } });
  eq(sent[2], { id: 2, ok: true, answer: JSON.parse(JSON.stringify(pickNow(ask))) });
  g.onmessage({ data: { id: 3, job: 'solve', args: [null, null, 5] } });
  eq(sent[3].ok, false, 'a job that throws says so instead of going quiet');
});
