/**
 * Changes are written a moment after they're made. If the tab closes in that moment, the write may
 * never land, so the closing tab keeps a quick copy of what's unwritten in localStorage (which
 * writes at once) and the next tab that saves puts it back, checked like any saved record.
 */
import type { Repo } from './repo.ts';
import { checkTables } from './repo.ts';
import { STORES, type StoreName, type Tables, type Write } from './tables.ts';

export type StashStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const keyOf = (name: string) => `${name}:unsaved`;

/** localStorage, or null where the browser blocks it. */
function local(): StashStore | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Keeps a copy of unwritten changes. Returns false when there was no room or no storage. */
export function stashUnsaved(name: string, writes: readonly Write[], store: StashStore | null = local()): boolean {
  if (!store || !writes.length) return false;
  try { store.setItem(keyOf(name), JSON.stringify(writes)); return true; } catch { return false; }
}

export function dropStash(name: string, store: StashStore | null = local()): void {
  try { store?.removeItem(keyOf(name)); } catch { /* nothing to drop */ }
}

/** The kept changes, with anything that isn't a change to a known store left out. */
export function readStash(name: string, store: StashStore | null = local()): Write[] {
  let raw: unknown;
  try { raw = JSON.parse(store?.getItem(keyOf(name)) ?? '[]'); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  return raw.filter((w): w is Write =>
    !!w && typeof w === 'object' && STORES.includes(w.store as StoreName) && typeof w.key === 'string' && 'value' in w);
}

/**
 * Puts kept changes back and queues them for saving. Each value is checked the same way loading
 * checks it; a damaged one is skipped and the saved value stays. Returns how many were put back.
 */
export function restoreStash(repo: Repo, name: string, store: StashStore | null = local()): number {
  const writes = readStash(name, store);
  if (!writes.length) { dropStash(name, store); return 0; }
  const raw = Object.fromEntries(STORES.map((s) => [s, new Map(repo.db.tables[s])])) as Tables;
  for (const w of writes) if (w.value == null) raw[w.store].delete(w.key); else raw[w.store].set(w.key, w.value);
  const { tables } = checkTables(raw, repo.clock());
  // only the kept keys change; everything else stays exactly as loaded
  const next = Object.fromEntries(STORES.map((s) => [s, new Map(repo.db.tables[s])])) as Tables;
  const back: Write[] = [];
  for (const w of writes) {
    const v = w.value == null ? null : tables[w.store].get(w.key);
    if (v === undefined) continue; // damaged: keep what's saved
    if (v === null) next[w.store].delete(w.key); else next[w.store].set(w.key, v);
    back.push({ store: w.store, key: w.key, value: v });
  }
  if (back.length) {
    repo.db.replaceTables(next);
    repo.db.queue(back);
  }
  dropStash(name, store);
  return back.length;
}
