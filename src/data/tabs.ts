/**
 * Only one tab changes data at a time. The first tab holds a lock and writes; any other tab opens
 * read-only, follows the writer's saves, and can ask to take over. When the writing tab closes,
 * a waiting tab takes over by itself.
 */
import type { StoreName } from './tables.ts';

export type TabRole = 'writer' | 'reader';

type Message = ({ type: 'saved'; stores: StoreName[] } | { type: 'handover' }) & { id: string };

export interface TabGuard {
  readonly role: TabRole;
  /** Called when this tab starts or stops being the writer. */
  onRole(fn: (role: TabRole) => void): void;
  /** Called in reader tabs when the writer saved something. */
  onRemoteSave(fn: (stores: StoreName[]) => void): void;
  /** Tells other tabs about a save (writer only). */
  saved(stores: Iterable<StoreName>): void;
  /** Asks the writing tab to hand over, then takes over. */
  takeOver(): Promise<void>;
  close(): void;
}

interface Hooks { flush: () => Promise<void> }

export async function guardTabs(name: string, hooks: Hooks): Promise<TabGuard> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(name) : null;
  const roleFns = new Set<(r: TabRole) => void>(), saveFns = new Set<(s: StoreName[]) => void>();
  let role: TabRole = locks ? 'reader' : 'writer';
  let release: (() => void) | null = null;
  let held = 0, seq = 0;
  let waitCtl: AbortController | null = null;
  const setRole = (r: TabRole) => { if (r !== role) { role = r; for (const f of roleFns) f(r); } };
  // read through a function: the role changes while awaiting
  const isWriter = () => role === 'writer';

  /** Requests the lock and holds it until released. Resolves true when granted. */
  const request = (opts: LockOptions): Promise<boolean> => new Promise((resolve) => {
    if (!locks) { resolve(true); return; }
    const id = ++seq;
    locks.request(name, opts, (lock) => {
      if (!lock) { resolve(false); return undefined; }
      held = id;
      waitCtl = null;
      setRole('writer');
      resolve(true);
      return new Promise<void>((r) => { release = r; });
    }).catch(() => {
      // aborted on purpose (a queued request), or the lock was taken by another tab
      resolve(false);
      if (held === id) { held = 0; release = null; setRole('reader'); wait(); }
    });
  });

  /** As a reader, queue for the lock so this tab takes over when the writer closes. */
  const wait = () => {
    if (waitCtl || !locks || role === 'writer') return;
    waitCtl = new AbortController();
    void request({ signal: waitCtl.signal });
  };

  if (locks && !(await request({ ifAvailable: true }))) wait();

  // Messages go by BroadcastChannel and, for browsers that keep it from other pages opened from
  // disk, by a storage event too. Whichever arrives second is ignored.
  const me = Math.random().toString(36).slice(2);
  let sent = 0;
  // messages already handled, this tab's own among them
  const seen: string[] = [];
  const remember = (id: string) => { seen.push(id); if (seen.length > 50) seen.shift(); };
  const store = (() => { try { return globalThis.localStorage ?? null; } catch { return null; } })();
  const send = (m: { type: 'saved'; stores: StoreName[] } | { type: 'handover' }) => {
    const msg: Message = { ...m, id: `${me}.${++sent}` };
    remember(msg.id);
    channel?.postMessage(msg);
    try { store?.setItem(`${name}:tabs`, JSON.stringify(msg)); } catch { /* the channel still works */ }
  };
  const receive = (m: Message | null | undefined) => {
    if (!m || typeof m.id !== 'string' || seen.includes(m.id)) return;
    remember(m.id);
    if (m.type === 'saved' && role === 'reader') for (const f of saveFns) f(m.stores);
    if (m.type === 'handover' && role === 'writer' && locks) {
      void hooks.flush().then(() => {
        const r = release;
        release = null;
        held = 0;
        setRole('reader');
        r?.();
        wait();
      });
    }
  };
  const fromStore = (raw: string | null | undefined) => {
    if (!raw) return;
    try { receive(JSON.parse(raw) as Message); } catch { /* not ours */ }
  };
  channel?.addEventListener('message', (e: MessageEvent<Message>) => receive(e.data));
  globalThis.addEventListener?.('storage', (e: StorageEvent) => { if (e.key === `${name}:tabs`) fromStore(e.newValue); });
  // and a look every second, for browsers that drop both between pages opened from disk (a message
  // seen twice is ignored, and a reload reads everything, so one missed in between doesn't matter)
  let lastRaw = (() => { try { return store?.getItem(`${name}:tabs`) ?? null; } catch { return null; } })();
  const poll = store && typeof setInterval === 'function' ? setInterval(() => {
    let raw: string | null = null;
    try { raw = store.getItem(`${name}:tabs`); } catch { return; }
    if (raw === lastRaw) return;
    lastRaw = raw;
    fromStore(raw);
  }, 1000) : 0;

  return {
    get role() { return role; },
    onRole: (fn) => { roleFns.add(fn); },
    onRemoteSave: (fn) => { saveFns.add(fn); },
    saved: (stores) => { send({ type: 'saved', stores: [...stores] }); },
    async takeOver() {
      if (role === 'writer' || !locks) return;
      send({ type: 'handover' });
      // the writer saves and lets go, and the queued request gets the lock; if it doesn't answer, take it
      for (let i = 0; i < 15 && !isWriter(); i++) await new Promise((r) => setTimeout(r, 100));
      if (isWriter()) return;
      waitCtl?.abort();
      waitCtl = null;
      await request({ steal: true });
    },
    close() {
      if (poll) clearInterval(poll);
      waitCtl?.abort();
      channel?.close();
      release?.();
    },
  };
}
