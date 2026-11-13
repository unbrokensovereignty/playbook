/**
 * The one way data changes. Every change runs in a transaction that updates the tables in memory,
 * tells the screens what changed, queues the save, and records how to undo it. Saving happens in
 * the background and retries on failure, so a click never waits for storage.
 */
import type { Backend } from './backends.ts';
import { deepEqual, revertValue, STORES, type Change, type StoreName, type Tables, type Write } from './tables.ts';

export type Origin = 'local' | 'undo' | 'redo' | 'remote';
export type Listener = (stores: ReadonlySet<StoreName>, origin: Origin) => void;
export type SaveState = 'saved' | 'saving' | 'error';

/** A recorded change. `stale` marks one that undo or redo found nothing left to take back in (it changed since). */
/** `stepped`: brought back by an undo or redo, so a change after it is a step of its own, however soon. */
export interface Action { label: string; changes: Change[]; at: number; stale?: boolean; stepped?: boolean }

export interface Tx {
  get<T>(store: StoreName, key: string): T | undefined;
  /** `whole`: undoing puts back the whole old record, even if it changed since (a run started over). */
  put(store: StoreName, key: string, value: unknown, o?: { whole?: boolean }): void;
  del(store: StoreName, key: string): void;
}

export class ReadOnlyError extends Error {}

/** Stores bigger than this are taken as changed when read back, rather than compared record by record. */
export const COMPARE_MAX = 5000;

/** Does a store read back hold just what it held before? */
function sameTable(a: Map<string, unknown>, b: Map<string, unknown>): boolean {
  if (a.size !== b.size || b.size > COMPARE_MAX) return false;
  for (const [k, v] of b) if (!a.has(k) || !deepEqual(a.get(k), v)) return false;
  return true;
}

/** Deep-freezes a value (in strict mode), so code that edits saved records in place fails loudly. */
function freeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) freeze(x);
  }
  return v;
}

export const UNDO_LIMIT = 50;

export class Db {
  tables: Tables;
  backend: Backend;
  readOnly = false;
  /** Freeze saved values (tests and development builds). */
  strict: boolean;
  undoStack: Action[] = [];
  redoStack: Action[] = [];
  saveState: SaveState = 'saved';
  saveError = '';
  private listeners = new Set<Listener>();
  private saveListeners = new Set<() => void>();
  private pending = new Map<string, Write>();
  /** The batch being written right now (so a closing tab can keep a copy). */
  private inflight: Write[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  private retryMs = 0;
  /** Called after each successful save with the stores it touched (for other tabs). */
  onSaved: ((stores: ReadonlySet<StoreName>) => void) | null = null;
  /**
   * More changes to make along with an undo or redo (records that depend on ones it deletes),
   * worked out from its changes before they're applied. They go into the step, so the next undo
   * or redo takes them back too.
   */
  alsoOnUndo: ((changes: readonly Change[], tables: Tables) => Change[]) | null = null;
  /** The undoable change the last undoable transaction made (for an Undo button about that change). */
  private fresh: Action | null = null;

  constructor(backend: Backend, tables: Tables, strict = false) {
    this.backend = backend;
    this.tables = tables;
    this.strict = strict;
    if (strict) for (const s of STORES) for (const v of tables[s].values()) freeze(v);
  }

  get<T>(store: StoreName, key: string): T | undefined {
    return this.tables[store].get(key) as T | undefined;
  }

  values<T>(store: StoreName): T[] {
    return [...this.tables[store].values()] as T[];
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onSaveState(fn: () => void): () => void {
    this.saveListeners.add(fn);
    return () => this.saveListeners.delete(fn);
  }

  private notify(stores: ReadonlySet<StoreName>, origin: Origin) {
    if (!stores.size) return;
    for (const fn of [...this.listeners]) fn(stores, origin);
  }

  private setSave(s: SaveState, err = '') {
    if (this.saveState === s && this.saveError === err) return;
    this.saveState = s;
    this.saveError = err;
    for (const fn of [...this.saveListeners]) fn();
  }

  /** Applies changes to the tables and queues them for saving. */
  private apply(changes: readonly Change[]) {
    for (const c of changes) {
      if (c.after == null) this.tables[c.store].delete(c.key); else this.tables[c.store].set(c.key, this.strict ? freeze(c.after) : c.after);
      this.pending.set(`${c.store}\u0000${c.key}`, { store: c.store, key: c.key, value: c.after ?? null });
    }
    // waiting to be written is not saved yet: the indicator says so until the write lands
    if (this.saveState === 'saved') this.setSave('saving');
    this.schedule(30);
  }

  /**
   * Runs `fn` as one change. Reads inside see the transaction's own writes. If `fn` throws, nothing
   * is changed. Returns the recorded action (null when nothing changed).
   */
  /**
   * `join` (ms): a change with the same label as the last undo step, within that long of it, joins
   * that step (a slider dragged, a stepper pressed again and again), so one undo takes it all back.
   */
  transact(label: string, fn: (tx: Tx) => void, opts: { undo?: boolean; join?: number } = {}): Action | null {
    if (this.readOnly) throw new ReadOnlyError('Playbook is open in another tab, so this tab can only look.');
    const touched = new Map<string, Change>();
    const tx: Tx = {
      get: <T>(store: StoreName, key: string) => {
        const c = touched.get(`${store}\u0000${key}`);
        return (c ? c.after ?? undefined : this.tables[store].get(key)) as T | undefined;
      },
      put: (store, key, value, o) => {
        const k = `${store}\u0000${key}`;
        const prev = touched.get(k);
        touched.set(k, { store, key, before: prev ? prev.before : this.tables[store].get(key) ?? null, after: value ?? null, ...(o?.whole || prev?.whole ? { whole: true } : {}) });
      },
      del: (store, key) => {
        const k = `${store}\u0000${key}`;
        const prev = touched.get(k);
        touched.set(k, { store, key, before: prev ? prev.before : this.tables[store].get(key) ?? null, after: null });
      },
    };
    if (opts.undo !== false) this.fresh = null;
    fn(tx);
    // a value put back as it was (a setting set to what it is) changes nothing
    const changes = [...touched.values()].filter((c) => c.before !== c.after && !deepEqual(c.before, c.after));
    if (!changes.length) return null;
    this.apply(changes);
    let action: Action = { label, changes, at: Date.now() };
    const last = this.undoStack.at(-1);
    if (opts.undo !== false && opts.join && last && !last.stale && !last.stepped && last.label === label && action.at - last.at < opts.join) {
      // the same change again, a moment later: one step, from where it started to where it is now
      for (const c of changes) {
        const i = last.changes.findIndex((x) => x.store === c.store && x.key === c.key);
        if (i < 0) last.changes.push(c); else last.changes[i] = { ...last.changes[i]!, after: c.after };
      }
      last.changes = last.changes.filter((c) => !deepEqual(c.before, c.after));
      last.at = action.at;
      // back where it started: no step at all
      if (!last.changes.length) this.undoStack.pop();
      this.redoStack = [];
      this.fresh = last.changes.length ? last : null;
      action = last;
    } else if (opts.undo !== false) {
      this.undoStack.push(action);
      if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
      this.redoStack = [];
      this.fresh = action;
    }
    this.notify(new Set(changes.map((c) => c.store)), 'local');
    return action;
  }

  /** The changes that take `a` back, given what's there now (fields changed since are kept). */
  private reverse(a: Action): Change[] {
    const out: Change[] = [];
    for (const c of [...a.changes].reverse()) {
      const current = this.tables[c.store].get(c.key) ?? null;
      const v = c.whole ? (deepEqual(current, c.before) ? undefined : c.before ?? null) : revertValue(current, c.before, c.after);
      if (v === undefined) continue;
      out.push({ store: c.store, key: c.key, before: current, after: v, ...(c.whole ? { whole: true } : {}) });
    }
    return out;
  }

  private step(from: Action[], to: Action[], origin: 'undo' | 'redo'): Action | null {
    if (this.readOnly) return null;
    const a = from.pop();
    if (!a) return null;
    const changes = this.reverse(a);
    // nothing left to take back (it all changed since): say so, and let the next undo reach further
    if (!changes.length) return { ...a, stale: true };
    const keys = new Set(changes.map((c) => `${c.store}\u0000${c.key}`));
    const more = (this.alsoOnUndo?.(changes, this.tables) ?? []).filter((c) => !keys.has(`${c.store}\u0000${c.key}`) && !deepEqual(c.before, c.after));
    const all = [...changes, ...more];
    to.push({ label: a.label, changes: all, at: Date.now(), stepped: true });
    // (and after an undo, the step it uncovered doesn't take in the next change either)
    const top = this.undoStack.at(-1);
    if (top) top.stepped = true;
    this.apply(all);
    this.notify(new Set(all.map((c) => c.store)), origin);
    return a;
  }

  /**
   * Adds `changes` to `a`, the latest undo step, so undo and redo take them along. Returns false
   * (and changes nothing) when `a` isn't the latest step any more.
   */
  amend(a: Action, changes: readonly Change[]): boolean {
    if (this.readOnly || this.undoStack.at(-1) !== a) return false;
    const real = changes.filter((c) => !deepEqual(c.before, c.after));
    if (!real.length) return true;
    this.apply(real);
    a.changes.push(...real);
    this.notify(new Set(real.map((c) => c.store)), 'local');
    return true;
  }

  /** Takes back one recorded change that isn't on the undo list (like an answer in a session). */
  revert(a: Action): void {
    if (this.readOnly) return;
    const changes = this.reverse(a);
    if (!changes.length) return;
    this.apply(changes);
    this.notify(new Set(changes.map((c) => c.store)), 'undo');
  }

  /** Undoes the last change. Returns it (for the message), or null when there's nothing to undo. */
  undo(): Action | null { return this.step(this.undoStack, this.redoStack, 'undo'); }
  redo(): Action | null { return this.step(this.redoStack, this.undoStack, 'redo'); }

  /**
   * The change the last undoable transaction just made, if it's still the one an undo would take
   * back; then forgotten. Null when that transaction changed nothing.
   */
  takeFresh(): Action | null {
    const a = this.fresh;
    this.fresh = null;
    return a && this.undoStack.at(-1) === a && Date.now() - a.at < 2000 ? a : null;
  }

  get canUndo(): boolean { return !this.readOnly && this.undoStack.length > 0; }
  get canRedo(): boolean { return !this.readOnly && this.redoStack.length > 0; }

  /** Replaces everything with what's saved (another tab changed it). Undo history is cleared; returns whether there was any. */
  replaceTables(t: Tables): boolean {
    const had = this.undoStack.length + this.redoStack.length > 0;
    // a store read back just as it was isn't announced, so what shows it (an adventure under way) carries
    // on; a big store is announced without checking, as comparing it would cost more than redrawing
    const changed = new Set(STORES.filter((s) => !sameTable(this.tables[s], t[s])));
    this.tables = t;
    if (this.strict) for (const s of STORES) for (const v of t[s].values()) freeze(v);
    this.undoStack = [];
    this.redoStack = [];
    this.pending.clear();
    if (this.saveState === 'saving' && !this.flushing) this.setSave('saved');
    this.notify(changed, 'remote');
    return had;
  }

  private schedule(ms: number) {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, ms);
  }

  /** Saves everything waiting now. Resolves when it's written (or has failed and will retry). */
  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    while (this.flushing) await this.flushing;
    if (!this.pending.size) { if (this.saveState !== 'error') this.setSave('saved'); return; }
    const batch = [...this.pending.values()];
    this.pending.clear();
    this.setSave('saving');
    this.inflight = batch;
    this.flushing = (async () => {
      try {
        await this.backend.write(batch);
        this.retryMs = 0;
        this.setSave(this.pending.size ? 'saving' : 'saved');
        this.onSaved?.(new Set(batch.map((w) => w.store)));
      } catch (e) {
        // put the batch back unless newer changes to the same keys are waiting
        for (const w of batch) {
          const k = `${w.store}\u0000${w.key}`;
          if (!this.pending.has(k)) this.pending.set(k, w);
        }
        const name = e instanceof Error ? e.name : '';
        this.setSave('error', name === 'QuotaExceededError' ? 'Your browser’s storage is full.' : 'Your changes couldn’t be saved yet.');
        this.retryMs = Math.min(10_000, this.retryMs ? this.retryMs * 2 : 1000);
        this.schedule(this.retryMs);
      } finally {
        this.inflight = [];
        this.flushing = null;
      }
    })();
    await this.flushing;
    if (this.pending.size && this.saveState !== 'error') await this.flush();
  }

  /** Changes waiting to be saved. */
  get unsaved(): number { return this.pending.size; }

  /** Everything not known to be written yet: the batch being written, then what's waiting (newest wins). */
  unwritten(): Write[] {
    const all = new Map<string, Write>();
    for (const w of this.inflight) all.set(`${w.store}\u0000${w.key}`, w);
    for (const [k, w] of this.pending) all.set(k, w);
    return [...all.values()];
  }

  /** Queues writes for values already in the tables (changes kept from a tab that closed before saving). */
  queue(writes: readonly Write[]) {
    if (!writes.length) return;
    for (const w of writes) this.pending.set(`${w.store}\u0000${w.key}`, w);
    if (this.saveState === 'saved') this.setSave('saving');
    this.schedule(30);
  }
}
