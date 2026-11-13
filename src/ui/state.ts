/**
 * App-wide screen state: the data (through signals that tick when it changes), the current page,
 * messages, dialogs and the other bits every page shares.
 */
import { signal, type Signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import type { Repo } from '../data/repo.ts';
import type { StoreName } from '../data/tables.ts';
import { STORES } from '../data/tables.ts';
import type { Action, SaveState } from '../data/db.ts';
import type { BackendKind } from '../data/backends.ts';
import type { TabGuard, TabRole } from '../data/tabs.ts';
import type { Settings } from '../core/settings.ts';
import { ReadOnlyError } from '../data/db.ts';

// ---------------------------------------------------------------- data

let current: Repo | null = null;
/** The data. Set once when the app starts. */
export const data = (): Repo => {
  if (!current) throw new Error('The app has not started yet.');
  return current;
};

/** One signal per store, bumped whenever that store changes, so screens that read it redraw. */
export const versions = Object.fromEntries(STORES.map((s) => [s, signal(0)])) as Record<StoreName, Signal<number>>;
export const saveState = signal<SaveState>('saved');
export const saveError = signal('');
export const canUndo = signal(false);
export const canRedo = signal(false);
export const tabRole = signal<TabRole>('writer');
export const backendKind = signal<BackendKind>('indexeddb');
/** Damaged records set aside when the app opened. */
export const quarantinedCount = signal(0);
/** Ticks once a minute, so time-based things ("saved 5 minutes ago") redraw. */
export const minute = signal(0);

let guard: TabGuard | null = null;
export const setTabGuard = (g: TabGuard) => { guard = g; };
/** Makes this tab the one that saves (when another tab has the app open). */
export async function takeOverTab() { await guard?.takeOver(); }

export function bindRepo(r: Repo) {
  current = r;
  const sync = () => { canUndo.value = r.db.canUndo; canRedo.value = r.db.canRedo; };
  r.db.subscribe((stores) => {
    for (const s of stores) versions[s].value++;
    sync();
  });
  r.db.onSaveState(() => { saveState.value = r.db.saveState; saveError.value = r.db.saveError; });
  sync();
}

/** Reads data and redraws when the named stores change. */
export function watch(...stores: StoreName[]): Repo {
  for (const s of stores) void versions[s].value;
  return data();
}

/**
 * A page's choice that's kept from visit to visit (its filter, sorting, range): what it was last
 * left on if that's still allowed, else `fallback`, and a setter that remembers the new one.
 */
export function useView<T extends string>(key: string, fallback: T, allowed: (v: string) => boolean): [T, (v: T) => void] {
  const saved = tabViews.value[key] ?? watch('meta').view(key);
  return [saved && allowed(saved) ? (saved as T) : fallback, (v: T) => {
    const { [key]: _, ...rest } = tabViews.peek();
    if (data().db.readOnly) tabViews.value = { ...rest, [key]: v };
    else { tabViews.value = rest; data().setView(key, v); }
  }];
}
/** Choices made in a tab that can only look (another tab has the data): kept for this tab alone. */
const tabViews = signal<Record<string, string>>({});

/** The settings in effect. */
export function useSettings(): Settings {
  return watch('meta').settings();
}

// ---------------------------------------------------------------- pages

export type Page = 'home' | 'planner' | 'select' | 'rankings' | 'agents' | 'maps' | 'saved' | 'settings' | 'help' | 'themes' | 'gallery' | 'selftest';
export const PAGES: readonly Page[] = ['home', 'planner', 'select', 'rankings', 'agents', 'maps', 'saved', 'settings', 'help', 'themes', 'gallery', 'selftest'];

export interface Route { page: Page; arg: string }

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  if (h === 'selftest') return { page: 'selftest', arg: '' };
  const [page, ...rest] = h.split('/');
  const p = PAGES.includes(page as Page) ? (page as Page) : 'home';
  return { page: p, arg: decodeURIComponent(rest.join('/')) };
}

export const route = signal<Route>(typeof location !== 'undefined' ? parseRoute(location.hash) : { page: 'home', arg: '' });
/** Which way the last page change went, for the slide. */
export const routeDir = signal<1 | -1>(1);

const order = (p: Page) => PAGES.indexOf(p);

/** Counts trips to the page already showing (Search picking the setting you're on): a page can react to them. */
export const revisit = signal(0);

export function go(page: Page, arg = '') {
  const next = `#/${page}${arg ? '/' + arg.split('/').map(encodeURIComponent).join('/') : ''}`;
  if (location.hash === next) { revisit.value++; return; }
  location.hash = next;
}

export function onHashChange() {
  const next = parseRoute(location.hash);
  const prev = route.value;
  if (next.page === prev.page && next.arg === prev.arg) return;
  routeDir.value = order(next.page) >= order(prev.page) ? 1 : -1;
  // a message about the page you're leaving would sit over the next one: let it go (Ctrl Z still undoes)
  dropOldToasts();
  route.value = next;
}

/** What a screen keeps as the tab closes or reloads: run just before the app's last save. */
const leaving = new Set<() => void>();
/** Runs `fn` as the tab closes or reloads (see runLeaving). Returns a stop function. */
export function onLeave(fn: () => void): () => void { leaving.add(fn); return () => { leaving.delete(fn); }; }
/** Called by the app as the tab goes, before it saves what's waiting. */
export function runLeaving() { for (const fn of leaving) fn(); }

// ---------------------------------------------------------------- focus mode and overlays

export const paletteOpen = signal(false);
/**
 * The sidebar narrows by itself in a small window; its button still switches it. When the window
 * has room again, the sidebar goes back to how you last set it.
 */
const smallWindow = typeof matchMedia === 'function' ? matchMedia('(max-width: 1000px)') : null;
let chosenNarrow = false;
export const sidebarNarrow = signal(smallWindow?.matches ?? false);
smallWindow?.addEventListener?.('change', (e) => { sidebarNarrow.value = e.matches || chosenNarrow; });
/** Narrows or widens the sidebar, and remembers that as your choice. */
export function toggleSidebar() { chosenNarrow = sidebarNarrow.value = !sidebarNarrow.value; }

// ---------------------------------------------------------------- messages

export type Tone = 'info' | 'good' | 'bad';
/**
 * `undo`: the change the message is about, which its Undo button takes back while it's still the latest.
 * `action.live`, when given, says whether its button still applies (it hides once it doesn't).
 */
export interface Toast { id: number; text: string; tone: Tone; undo: Action | null; action?: { label: string; run: () => void; live?: () => boolean }; ms: number; at: number }

export const toasts = signal<Toast[]>([]);
/** A message shown this recently survives a change of page (the action that showed it also moved you). */
const TOAST_CARRY_MS = 250;
let toastSeq = 0;

/** Shows a short message. `undo: true` adds an Undo button for the change just made (none if it changed nothing). */
export function toast(text: string, o: { tone?: Tone; undo?: boolean; action?: Toast['action']; ms?: number } = {}): number {
  const undo = o.undo && current ? current.db.takeFresh() : null;
  const t: Toast = { id: ++toastSeq, text, tone: o.tone ?? 'info', undo, action: o.action, ms: o.ms ?? (undo || o.action ? 6000 : 3500), at: Date.now() };
  // one message at a time per kind of thing: keep the three newest
  toasts.value = [...toasts.value, t].slice(-3);
  return t.id;
}
/** Lets go of messages shown before now (problems stay, and so does one the action that got here just showed). */
function dropOldToasts() { toasts.value = toasts.value.filter((t) => t.tone === 'bad' || Date.now() - t.at < TOAST_CARRY_MS); }
export const dismissToast = (id: number) => { toasts.value = toasts.value.filter((t) => t.id !== id); };

/** Runs a change and reports a read-only tab or an unexpected error as a message instead of failing. */
export function safely<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch (e) {
    if (e instanceof ReadOnlyError) toast(e.message, { tone: 'bad' });
    else { toast('Something went wrong. Nothing was changed.', { tone: 'bad' }); reportError(e); }
    return undefined;
  }
}

/** Errors are kept for Help → About, so a problem can be described without the console. */
export const errors = signal<string[]>([]);
export function reportError(e: unknown) {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  errors.value = [...errors.value, `${new Date().toISOString()} ${msg}`].slice(-20);
}

// ---------------------------------------------------------------- dialogs

export interface DialogSpec {
  id: number;
  render: (close: (value?: unknown) => void) => ComponentChildren;
  /** Esc and clicking outside close it (not for dialogs that would lose typing). */
  dismissable: boolean;
  resolve: (v: unknown) => void;
  label: string;
  wide?: boolean;
}

export const dialogs = signal<DialogSpec[]>([]);
let dialogSeq = 0;

/** The search or a dialog is open: a page's own keys wait until it closes. */
export const overlayOpen = (): boolean => paletteOpen.value || dialogs.value.length > 0;
/** A key press meant for a text field or a list box. */
export const typingIn = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
/** A field that edits text, with an undo of its own (not a switch, slider, checkbox or list box). */
export const editsText = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'TEXTAREA'
  || (t instanceof HTMLInputElement && !/^(checkbox|radio|range|button|submit|reset|color|file|image)$/.test(t.type)));

/**
 * Whether the keyboard is moving focus about (Tab), or the mouse (a click). Focus the app puts back
 * on a button after a mouse-opened menu or dialog follows the mouse, so the keys still mean the screen.
 */
let byKeys = true;
/** Keeps track of whether the keyboard or the mouse last moved focus (see pressesFocusedButton). Returns a stop function. */
export function watchClicks(): () => void {
  const down = () => { byKeys = false; };
  const key = (e: KeyboardEvent) => { if (e.key === 'Tab') byKeys = true; };
  addEventListener('pointerdown', down, true);
  addEventListener('keydown', key, true);
  return () => { removeEventListener('pointerdown', down, true); removeEventListener('keydown', key, true); };
}
/** The keyboard, not the mouse, last moved focus. */
export const keysMoveFocus = (): boolean => byKeys;
/**
 * Enter or Space on a button reached with the keyboard: the button handles it, so a screen's own
 * Enter and Space wait. (After a click, a button keeps focus too, but then the keys mean the screen.)
 * A menu's items always take their own keys.
 */
export const pressesFocusedButton = (e: KeyboardEvent): boolean =>
  (e.key === 'Enter' || e.key === ' ') && e.target instanceof HTMLElement
  && (e.target.matches('[role=menuitem]') || (byKeys && e.target.matches('button, a[href], [role=button], [role=radio]')));

export function openDialog<T>(label: string, render: DialogSpec['render'], o: { dismissable?: boolean; wide?: boolean } = {}): Promise<T | undefined> {
  // a message about the page would sit over the dialog: let it go, as on a change of page (Ctrl Z still undoes)
  dropOldToasts();
  return new Promise((resolve) => {
    const d: DialogSpec = { id: ++dialogSeq, render, dismissable: o.dismissable ?? true, resolve: resolve as (v: unknown) => void, label, wide: o.wide };
    dialogs.value = [...dialogs.value, d];
  });
}

/** Closes every open dialog, each as if cancelled. */
export function closeDialogs() {
  for (const d of dialogs.peek()) closeDialog(d.id);
}

export function closeDialog(id: number, value?: unknown) {
  const d = dialogs.value.find((x) => x.id === id);
  if (!d) return;
  dialogs.value = dialogs.value.filter((x) => x.id !== id);
  d.resolve(value);
}
