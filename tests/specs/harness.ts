/**
 * A tiny test harness shared by Node (`npm test`) and the in-app self-test (#selftest).
 * Specs register with `spec()`; checks throw on failure with a readable message.
 */
export interface Spec { group: string; name: string; run: () => void | Promise<void> }

export const specs: Spec[] = [];
let group = '';

export function describe(name: string, body: () => void): void {
  const prev = group;
  group = prev ? `${prev} › ${name}` : name;
  try { body(); } finally { group = prev; }
}

export function spec(name: string, run: () => void | Promise<void>): void {
  specs.push({ group, name, run });
}

const show = (v: unknown): string => {
  try { return typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v, (_k, x) => (x instanceof Set ? [...x] : x)) ?? String(v); } catch { return String(v); }
};

export function fail(msg: string): never { throw new Error(msg); }

export function ok(cond: unknown, msg = 'expected a true value'): asserts cond {
  if (!cond) fail(msg);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object), kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export function eq<T>(actual: T, expected: T, msg?: string): void {
  if (!deepEqual(actual, expected)) fail(`${msg ? msg + ': ' : ''}expected ${show(expected)}, got ${show(actual)}`);
}

export function near(actual: number, expected: number, tol = 1e-6, msg?: string): void {
  if (!(Math.abs(actual - expected) <= tol)) fail(`${msg ? msg + ': ' : ''}expected ${expected} ± ${tol}, got ${actual}`);
}

export function throws(fn: () => unknown, msg = 'expected an error'): void {
  try { fn(); } catch { return; }
  fail(msg);
}

/** Runs every spec (in the app); returns results in order. */
export async function runAll(filter?: (s: Spec) => boolean): Promise<{ spec: Spec; error?: string; ms: number }[]> {
  const out: { spec: Spec; error?: string; ms: number }[] = [];
  for (const s of specs) {
    if (filter && !filter(s)) continue;
    const t0 = performance.now();
    try { await s.run(); out.push({ spec: s, ms: performance.now() - t0 }); } catch (e) { out.push({ spec: s, error: (e instanceof Error ? e.message : String(e)) || 'failed (with no message)', ms: performance.now() - t0 }); }
  }
  return out;
}
