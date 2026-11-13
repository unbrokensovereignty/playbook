/**
 * Typed access to the saved data, and every action that changes it. Screens read through the
 * getters and change data only through these methods, each one a single undoable transaction.
 */
import { emptyBackup, mergeBackup, type BackupData } from '../core/backup.ts';
import { sanitizeQuery, type Query } from '../core/engine/query.ts';
import { LIMITS, sanitizeGame, sanitizeGames, sanitizeMyPlay, sanitizeMyPlays, sanitizeParty, sanitizePlan, type Game, type MyPlay, type Party, type SavedPlan } from '../core/saved.ts';
import { resolveSettings, sanitizeSetting, sanitizeSettings, SETTINGS, type SettingKey, type Settings } from '../core/settings.ts';
import { sanitizeTheme, MAX_THEMES, type ThemePicks } from '../core/theme.ts';
import { clean } from '../core/text.ts';
import { isRecord, uid } from '../core/util.ts';
import { Db, type Action } from './db.ts';
import { memoryBackend, openBackend, type Backend } from './backends.ts';
import { STORES, emptyTables, type StoreName, type Tables } from './tables.ts';

// ---------------------------------------------------------------- app state

/** Small facts about using the app (not settings). */
export interface AppState {
  firstUse: number;
  lastBackup: number;
  backupSnooze: number;
  welcomed: boolean;
  /** Page tips already shown. */
  tips: string[];
  /** The browser has been asked once to keep the saved data. */
  keepAsked: boolean;
  /** The version whose "What's new" note was last shown (or skipped, for a first visit). */
  seenVersion: string;
  /** How each page was last left: its filter, sorting, tab ("agents.role" → "duelist"). */
  views: Record<string, string>;
  /** The planner's question as it was last left. */
  draft: Query | null;
  /** Questions asked lately, newest first. */
  recent: Query[];
}

/** At most this many remembered page views and recent questions are kept. */
const VIEWS_MOST = 40;
export const RECENT_MOST = 8;

export const newAppState = (now: number): AppState => ({
  firstUse: now, lastBackup: 0, backupSnooze: 0, welcomed: false, tips: [], keepAsked: false, seenVersion: '', views: {}, draft: null, recent: [],
});

function sanitizeAppState(x: unknown, now: number): AppState {
  const a = newAppState(now);
  if (!isRecord(x)) return a;
  const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
  a.firstUse = n(x.firstUse, now) || now;
  a.lastBackup = n(x.lastBackup, 0);
  a.backupSnooze = n(x.backupSnooze, 0);
  a.welcomed = x.welcomed === true;
  a.tips = Array.isArray(x.tips) ? x.tips.filter((t): t is string => typeof t === 'string').slice(0, 100) : [];
  a.keepAsked = x.keepAsked === true;
  a.seenVersion = typeof x.seenVersion === 'string' && /^\d+\.\d+\.\d+$/.test(x.seenVersion) ? x.seenVersion : '';
  if (isRecord(x.views)) {
    for (const [k, v] of Object.entries(x.views).slice(0, VIEWS_MOST)) if (/^[a-z]+\.[a-z]+$/.test(k) && typeof v === 'string' && v.length <= 80) a.views[k] = v;
  }
  a.draft = isRecord(x.draft) ? sanitizeQuery(x.draft) : null;
  a.recent = Array.isArray(x.recent) ? x.recent.filter(isRecord).slice(0, RECENT_MOST).map(sanitizeQuery) : [];
  return a;
}

// ---------------------------------------------------------------- loading

export interface Quarantined { store: StoreName; key: string; value: unknown }

/** Checks every saved record. Damaged ones are set aside (never silently dropped) so they can be looked at. */
export function checkTables(raw: Tables, now: number): { tables: Tables; quarantined: Quarantined[] } {
  const t = emptyTables(), bad: Quarantined[] = [];
  const keep = <T extends { id: string }>(store: StoreName, key: string, value: unknown, fn: (v: unknown, now: number) => T | null) => {
    const v = fn(value, now);
    if (!v) { bad.push({ store, key, value }); return; }
    t[store].set(v.id, v);
  };
  for (const [k, v] of raw.plans) keep('plans', k, v, sanitizePlan);
  for (const [k, v] of raw.parties) keep('parties', k, v, sanitizeParty);
  const m = raw.meta;
  t.meta.set('settings', sanitizeSettings(m.get('settings')));
  t.meta.set('themes', (Array.isArray(m.get('themes')) ? (m.get('themes') as unknown[]) : []).map(sanitizeTheme).filter((x): x is ThemePicks => !!x && !!x.id).slice(0, MAX_THEMES));
  t.meta.set('plays', sanitizeMyPlays(m.get('plays'), now));
  t.meta.set('games', sanitizeGames(m.get('games'), now));
  t.meta.set('app', sanitizeAppState(m.get('app'), now));
  const prevBad = m.get('quarantine');
  const quarantine = [...(Array.isArray(prevBad) ? prevBad : []), ...bad.map((b) => ({ ...b, at: now }))].slice(-500);
  if (quarantine.length) t.meta.set('quarantine', quarantine);
  return { tables: t, quarantined: bad };
}

export interface OpenOptions { name?: string; backend?: Backend; strict?: boolean; clock?: () => number }

/** Opens the saved data (or an empty memory store for tests). */
export async function openRepo(o: OpenOptions = {}): Promise<{ repo: Repo; quarantined: Quarantined[] }> {
  const backend = o.backend ?? (o.name ? await openBackend(o.name) : memoryBackend());
  const clock = o.clock ?? Date.now;
  const { tables, quarantined } = checkTables(await backend.load(), clock());
  const db = new Db(backend, tables, o.strict ?? false);
  const repo = new Repo(db, clock);
  if (quarantined.length) {
    // keep the damaged records aside, out of the tables
    await backend.write([{ store: 'meta', key: 'quarantine', value: tables.meta.get('quarantine') }, ...quarantined.map((q) => ({ store: q.store, key: q.key, value: null }))]);
  }
  return { repo, quarantined };
}

// ---------------------------------------------------------------- the repository

/** Changes to one setting this close together (a slider dragged, a stepper pressed again) are one undo step. */
export const SETTING_JOIN_MS = 1500;

export interface NewPlan { name: string; note?: string; query: Query; team?: string[] }
export type PlanPatch = Partial<Pick<SavedPlan, 'name' | 'note' | 'query' | 'team' | 'starred'>>;

export class Repo {
  db: Db;
  clock: () => number;

  constructor(db: Db, clock: () => number) {
    this.db = db;
    this.clock = clock;
  }

  // ------------------------------------------------ reads

  savedSettings(): Partial<Settings> { return this.db.get<Partial<Settings>>('meta', 'settings') ?? {}; }
  settings(): Settings { return resolveSettings(this.savedSettings()); }
  themes(): ThemePicks[] { return this.db.get<ThemePicks[]>('meta', 'themes') ?? []; }
  app(): AppState { return this.db.get<AppState>('meta', 'app') ?? newAppState(this.clock()); }
  /** Saved plans, starred first, then newest first. */
  plans(): SavedPlan[] {
    return this.db.values<SavedPlan>('plans').sort((a, b) => Number(b.starred) - Number(a.starred) || b.updated - a.updated || a.id.localeCompare(b.id));
  }
  plan(id: string): SavedPlan | undefined { return this.db.get<SavedPlan>('plans', id); }
  /** Party presets in name order. */
  parties(): Party[] { return this.db.values<Party>('parties').sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)); }
  party(id: string): Party | undefined { return this.db.get<Party>('parties', id); }
  /** The plays you drew, last changed first. */
  myPlays(): MyPlay[] { return this.db.get<MyPlay[]>('meta', 'plays') ?? []; }
  myPlay(id: string): MyPlay | undefined { return this.myPlays().find((p) => p.id === id); }
  /** The games you logged, newest first. */
  games(): Game[] { return this.db.get<Game[]>('meta', 'games') ?? []; }
  quarantine(): unknown[] { return this.db.get<unknown[]>('meta', 'quarantine') ?? []; }

  // ------------------------------------------------ undo

  undo(): Action | null { return this.db.undo(); }
  redo(): Action | null { return this.db.redo(); }

  // ------------------------------------------------ settings

  /** Changes a setting. An invalid value is refused. */
  setSetting<K extends SettingKey>(key: K, value: Settings[K]): boolean {
    const v = sanitizeSetting(key, value);
    if (v === undefined) return false;
    const label = `Change “${SETTINGS[key].label}”`;
    // a setting that wasn't set when a run of quick changes began (a switch flicked on and off again),
    // set back to what it was then, is left unset again, so the run changes nothing
    const start = this.joinStart<Partial<Settings>>(label, 'meta', 'settings') ?? {};
    const next: Partial<Settings> = { ...this.savedSettings(), [key]: v };
    if (!(key in start) && v === resolveSettings({})[key]) delete next[key];
    this.db.transact(label, (tx) => tx.put('meta', 'settings', next), { join: SETTING_JOIN_MS });
    return true;
  }

  /** A record as it was before the run of quick changes the next one with `label` would join, or as it is now. */
  private joinStart<T>(label: string, store: StoreName, key: string): T | undefined {
    const last = this.db.undoStack.at(-1);
    const joins = !!last && !last.stale && !last.stepped && last.label === label && Date.now() - last.at < SETTING_JOIN_MS;
    const c = joins ? last.changes.find((x) => x.store === store && x.key === key) : undefined;
    return (c ? c.before ?? undefined : this.db.get<T>(store, key)) as T | undefined;
  }

  /** Changes several settings as one undoable step. Invalid values are left out. */
  setSettings(patch: Partial<Settings>, label: string): void {
    const next: Record<string, unknown> = { ...this.savedSettings() };
    for (const [k, v] of Object.entries(patch)) {
      const clean = k in SETTINGS ? sanitizeSetting(k, v) : undefined;
      if (clean !== undefined) next[k] = clean;
    }
    this.db.transact(label, (tx) => tx.put('meta', 'settings', next));
  }

  /** Goes back to the default. */
  resetSetting(key: SettingKey): void {
    const g = { ...this.savedSettings() } as Record<string, unknown>;
    if (!(key in g)) return;
    delete g[key];
    this.db.transact(`Reset “${SETTINGS[key].label}”`, (tx) => tx.put('meta', 'settings', g));
  }

  // ------------------------------------------------ small app facts (saved, but not something to undo)

  updateApp(patch: Partial<AppState>): void {
    this.db.transact('', (tx) => tx.put('meta', 'app', { ...this.app(), ...patch }), { undo: false });
  }

  /** How a page was last left (see AppState.views), or '' if it wasn't. */
  view(key: string): string { return this.app().views[key] ?? ''; }
  setView(key: string, value: string): void {
    const views = this.app().views;
    if (views[key] === value || (!(key in views) && Object.keys(views).length >= VIEWS_MOST)) return;
    this.updateApp({ views: { ...views, [key]: value } });
  }

  /** Keeps the planner's question as it's left. */
  setDraft(q: Query): void {
    const clean = sanitizeQuery(q);
    if (JSON.stringify(clean) === JSON.stringify(this.app().draft)) return;
    this.updateApp({ draft: clean });
  }

  /** Remembers a question just asked, newest first (the same question asked again moves to the front). */
  addRecent(q: Query): void {
    const clean = sanitizeQuery(q), key = JSON.stringify(clean);
    const rest = this.app().recent.filter((x) => JSON.stringify(x) !== key);
    this.updateApp({ recent: [clean, ...rest].slice(0, RECENT_MOST) });
  }

  clearRecent(): void { if (this.app().recent.length) this.updateApp({ recent: [] }); }

  noteBackup(): void { this.updateApp({ lastBackup: this.clock() }); }

  // ------------------------------------------------ saved plans

  savePlan(p: NewPlan): SavedPlan | null {
    if (this.db.values('plans').length >= LIMITS.plans) return null;
    const now = this.clock();
    const plan = sanitizePlan({ id: uid('p'), name: p.name, note: p.note ?? '', query: p.query, team: p.team ?? [], starred: false, created: now, updated: now }, now);
    if (!plan) return null;
    this.db.transact(`Save “${plan.name}”`, (tx) => tx.put('plans', plan.id, plan));
    return plan;
  }

  updatePlan(id: string, patch: PlanPatch, label?: string): boolean {
    const was = this.plan(id);
    if (!was) return false;
    const next = sanitizePlan({ ...was, ...patch, updated: this.clock() }, this.clock());
    if (!next) return false;
    const what = label ?? (patch.name !== undefined && patch.name !== was.name ? `Rename “${was.name}” to “${next.name}”` : patch.starred !== undefined && Object.keys(patch).length === 1 ? `${next.starred ? 'Star' : 'Unstar'} “${next.name}”` : `Change “${next.name}”`);
    this.db.transact(what, (tx) => tx.put('plans', id, next), { join: patch.note !== undefined ? SETTING_JOIN_MS : undefined });
    return true;
  }

  deletePlans(ids: readonly string[]): number {
    const gone = ids.map((id) => this.plan(id)).filter((p): p is SavedPlan => !!p);
    if (!gone.length) return 0;
    this.db.transact(gone.length === 1 ? `Delete “${gone[0]!.name}”` : `Delete ${gone.length} plans`, (tx) => { for (const p of gone) tx.del('plans', p.id); });
    return gone.length;
  }

  // ------------------------------------------------ parties

  saveParty(p: Omit<Party, 'id' | 'created' | 'updated'> & { id?: string }): Party | null {
    const now = this.clock();
    const was = p.id ? this.party(p.id) : undefined;
    if (!was && this.db.values('parties').length >= LIMITS.parties) return null;
    const party = sanitizeParty({ ...p, id: was?.id ?? uid('y'), name: clean(p.name), created: was?.created ?? now, updated: now }, now);
    if (!party) return null;
    this.db.transact(was ? `Change “${party.name}”` : `Make the party “${party.name}”`, (tx) => tx.put('parties', party.id, party));
    return party;
  }

  deleteParty(id: string): void {
    const p = this.party(id);
    if (!p) return;
    this.db.transact(`Delete the party “${p.name}”`, (tx) => tx.del('parties', id));
  }

  // ------------------------------------------------ your games

  /** Logs a game. Past the limit, the oldest game makes room. */
  addGame(g: Omit<Game, 'id' | 'played'>): Game {
    const now = this.clock();
    const game = sanitizeGame({ ...g, id: uid('g'), played: now }, now);
    if (!game) throw new Error('A game needs a map, the agent you played and how it ended.');
    this.db.transact('Log a game', (tx) => tx.put('meta', 'games', [game, ...this.games()].slice(0, LIMITS.games)));
    return game;
  }

  deleteGame(id: string): void {
    const list = this.games();
    if (!list.some((g) => g.id === id)) return;
    this.db.transact('Delete a game', (tx) => tx.put('meta', 'games', list.filter((g) => g.id !== id)));
  }

  // ------------------------------------------------ your plays

  /** Saves a play you drew, new (no id) or changed. Null when there are too many already. */
  savePlay(p: Omit<MyPlay, 'id' | 'created' | 'updated'> & { id?: string }): MyPlay | null {
    const list = this.myPlays(), was = p.id ? list.find((x) => x.id === p.id) : undefined;
    if (!was && list.length >= LIMITS.plays) return null;
    const now = this.clock();
    const play = sanitizeMyPlay({ ...p, id: was?.id ?? uid('m'), created: was?.created ?? now, updated: now }, now);
    if (!play) throw new Error('That play has no step with a job and a route.');
    this.db.transact(was ? `Change the play “${play.name}”` : `Draw the play “${play.name}”`, (tx) => tx.put('meta', 'plays', [play, ...list.filter((x) => x.id !== play.id)]));
    return play;
  }

  deletePlay(id: string): void {
    const p = this.myPlay(id);
    if (!p) return;
    this.db.transact(`Delete the play “${p.name}”`, (tx) => tx.put('meta', 'plays', this.myPlays().filter((x) => x.id !== id)));
  }

  // ------------------------------------------------ themes

  /** Saves a theme. A new one is put to use, with `mode` (light or dark) when the app is showing the other kind. */
  saveTheme(t: ThemePicks, mode?: 'light' | 'dark'): ThemePicks | null {
    const clean = sanitizeTheme({ ...t, id: t.id || uid('t') });
    if (!clean) return null;
    const list = this.themes();
    const isNew = !list.some((x) => x.id === clean.id);
    if (isNew && list.length >= MAX_THEMES) return null;
    this.db.transact(isNew ? `Make the theme “${clean.name}”` : `Change the theme “${clean.name}”`, (tx) => {
      tx.put('meta', 'themes', isNew ? [...list, clean] : list.map((x) => (x.id === clean.id ? clean : x)));
      if (isNew) {
        // a theme just made is the one in use (for its kind, light or dark)
        tx.put('meta', 'settings', { ...this.savedSettings(), [clean.base === 'dark' ? 'themeDark' : 'themeLight']: clean.id, ...(mode ? { themeMode: mode } : {}) });
      } else {
        // a theme in use that changes kind stays in use, as the other kind's (the old kind goes back to the usual one)
        const was = list.find((x) => x.id === clean.id)!, g = this.savedSettings();
        const from = was.base === 'dark' ? 'themeDark' : 'themeLight', to = clean.base === 'dark' ? 'themeDark' : 'themeLight';
        if (from !== to && g[from] === clean.id) tx.put('meta', 'settings', { ...g, [from]: SETTINGS[from].def, [to]: clean.id, ...(mode ? { themeMode: mode } : {}) });
      }
    });
    return clean;
  }

  deleteTheme(id: string): void {
    const t = this.themes().find((x) => x.id === id);
    if (!t) return;
    this.db.transact(`Delete the theme “${t.name}”`, (tx) => {
      tx.put('meta', 'themes', this.themes().filter((x) => x.id !== id));
      // the theme in use goes back to the usual one
      const g = this.savedSettings();
      if (g.themeLight === id || g.themeDark === id) {
        tx.put('meta', 'settings', { ...g, ...(g.themeLight === id ? { themeLight: SETTINGS.themeLight.def } : {}), ...(g.themeDark === id ? { themeDark: SETTINGS.themeDark.def } : {}) });
      }
    });
  }

  // ------------------------------------------------ backups

  /** Everything, in backup form. */
  snapshot(): BackupData {
    return { settings: this.savedSettings(), themes: this.themes(), plans: this.plans(), parties: this.parties(), plays: this.myPlays(), games: this.games() };
  }

  /** Replaces everything with a backup, or merges it in. One undoable change either way. */
  restore(data: BackupData, mode: 'replace' | 'merge', label = mode === 'merge' ? 'Merge a backup' : 'Restore a backup', app?: Partial<AppState>): void {
    const d = mode === 'merge' ? mergeBackup(this.snapshot(), data) : data;
    const want = emptyTables();
    want.meta.set('settings', d.settings);
    want.meta.set('themes', d.themes);
    want.meta.set('plays', d.plays);
    want.meta.set('games', d.games);
    for (const p of d.plans) want.plans.set(p.id, p);
    for (const p of d.parties) want.parties.set(p.id, p);
    this.db.transact(label, (tx) => {
      for (const s of STORES) {
        if (s === 'meta') continue;
        for (const k of this.db.tables[s].keys()) if (!want[s].has(k)) tx.del(s, k);
        for (const [k, v] of want[s]) tx.put(s, k, v);
      }
      for (const [k, v] of want.meta) tx.put('meta', k, v);
      if (app) tx.put('meta', 'app', { ...this.app(), ...app });
    });
  }

  /** Deletes everything (Settings → Data). One undoable change. */
  eraseAll(): void {
    // a fresh start: the tips show again, and the app counts from now (all of it undone together)
    this.restore(emptyBackup(), 'replace', 'Erase everything', { tips: [], firstUse: this.clock(), recent: [], draft: null });
  }
}
