/**
 * Where the tables are kept. IndexedDB is the real home; if the browser won't allow it (some
 * private windows, or storage switched off), localStorage is used, and failing that the data only
 * lives in memory until the page closes. The app shows a banner in both fallback cases.
 */
import { STORES, emptyTables, type StoreName, type Tables, type Write } from './tables.ts';

export type BackendKind = 'indexeddb' | 'local' | 'memory';

export interface Backend {
  kind: BackendKind;
  load(): Promise<Tables>;
  write(writes: readonly Write[]): Promise<void>;
  clear(): Promise<void>;
  close(): void;
}

// ---------------------------------------------------------------- memory

/** Keeps nothing after the page closes. Also used by tests. */
export function memoryBackend(initial?: Tables): Backend {
  const t = initial ?? emptyTables();
  return {
    kind: 'memory',
    load: async () => {
      const copy = emptyTables();
      for (const s of STORES) for (const [k, v] of t[s]) copy[s].set(k, structuredClone(v));
      return copy;
    },
    write: async (ws) => { for (const w of ws) if (w.value == null) t[w.store].delete(w.key); else t[w.store].set(w.key, structuredClone(w.value)); },
    clear: async () => { for (const s of STORES) t[s].clear(); },
    close: () => {},
  };
}

// ---------------------------------------------------------------- IndexedDB

const req = <T>(r: IDBRequest<T>): Promise<T> => new Promise((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
const done = (tx: IDBTransaction): Promise<void> => new Promise((ok, fail) => {
  tx.oncomplete = () => ok();
  tx.onerror = () => fail(tx.error);
  tx.onabort = () => fail(tx.error ?? new Error('The save was canceled.'));
});

export async function idbBackend(name: string): Promise<Backend> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available.');
  const open = indexedDB.open(name, 1);
  open.onupgradeneeded = () => {
    const db = open.result;
    for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
  };
  const db = await new Promise<IDBDatabase>((ok, fail) => {
    open.onsuccess = () => ok(open.result);
    open.onerror = () => fail(open.error);
    open.onblocked = () => fail(new Error('The database is busy in another tab.'));
  });
  db.onversionchange = () => db.close();
  return {
    kind: 'indexeddb',
    async load() {
      const t = emptyTables();
      const tx = db.transaction([...STORES], 'readonly');
      await Promise.all(STORES.map(async (s) => {
        const store = tx.objectStore(s);
        const [keys, values] = await Promise.all([req(store.getAllKeys()), req(store.getAll())]);
        keys.forEach((k, i) => t[s].set(String(k), values[i]));
      }));
      return t;
    },
    async write(ws) {
      if (!ws.length) return;
      const stores = [...new Set(ws.map((w) => w.store))];
      const tx = db.transaction(stores, 'readwrite');
      for (const w of ws) {
        const store = tx.objectStore(w.store);
        if (w.value == null) store.delete(w.key); else store.put(w.value, w.key);
      }
      await done(tx);
    },
    async clear() {
      const tx = db.transaction([...STORES], 'readwrite');
      for (const s of STORES) tx.objectStore(s).clear();
      await done(tx);
    },
    close: () => db.close(),
  };
}

// ---------------------------------------------------------------- localStorage

export function localBackend(prefix: string): Backend {
  const keyOf = (s: StoreName) => `${prefix}:${s}`;
  const read = (s: StoreName): Record<string, unknown> => {
    try { const v = JSON.parse(localStorage.getItem(keyOf(s)) ?? '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
  };
  // probe: throws when storage is blocked
  localStorage.setItem(`${prefix}:probe`, '1');
  localStorage.removeItem(`${prefix}:probe`);
  return {
    kind: 'local',
    load: async () => {
      const t = emptyTables();
      for (const s of STORES) for (const [k, v] of Object.entries(read(s))) t[s].set(k, v);
      return t;
    },
    write: async (ws) => {
      const touched = new Map<StoreName, Record<string, unknown>>();
      for (const w of ws) {
        const obj = touched.get(w.store) ?? read(w.store);
        touched.set(w.store, obj);
        if (w.value == null) delete obj[w.key]; else obj[w.key] = w.value;
      }
      for (const [s, obj] of touched) localStorage.setItem(keyOf(s), JSON.stringify(obj));
    },
    clear: async () => { for (const s of STORES) localStorage.removeItem(keyOf(s)); },
    close: () => {},
  };
}

/** The best storage this browser allows. */
export async function openBackend(name: string): Promise<Backend> {
  try { return await idbBackend(name); } catch { /* fall through */ }
  try { return localBackend(name); } catch { /* fall through */ }
  return memoryBackend();
}
