/**
 * Starts the app: opens the saved data, decides whether this tab saves or follows another tab,
 * applies the look and sound settings, and draws the screen.
 */
import '@fontsource-variable/literata/wght.css';
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import './ui/styles/fonts.css';
import './ui/styles/base.css';
import './ui/styles/components.css';
import './ui/styles/shell.css';
import './ui/styles/pages.css';
import './ui/styles/planner.css';
import './ui/styles/browse.css';

import { installTooltips } from './ui/tooltip.ts';
import { render } from 'preact';
import { effect } from '@preact/signals';
import { checkTables, openRepo, type Repo } from './data/repo.ts';
import { guardTabs } from './data/tabs.ts';
import { dropStash, restoreStash, stashUnsaved } from './data/rescue.ts';
import { App } from './ui/shell.tsx';
import {
  backendKind, bindRepo, data, minute, onHashChange, quarantinedCount, reportError, runLeaving, setTabGuard, tabRole, toast, versions,
} from './ui/state.ts';
import { applyAppearance } from './ui/theme.ts';
import { configureSound, SOUND_SETS, type SoundSet } from './ui/sound.ts';

/**
 * Reloads everything from storage (another tab saved, or this tab just took over). `ready` runs just
 * before the new data is shown, in the same moment, so a tab taking over can save from its first redraw.
 */
async function reload(repo: Repo, ready?: () => void) {
  const { tables } = checkTables(await repo.db.backend.load(), repo.clock());
  ready?.();
  if (repo.db.replaceTables(tables)) toast('Playbook changed in another tab, so there’s nothing to undo here now.');
}

async function start() {
  const { repo, quarantined } = await openRepo({ name: __DB_NAME__, strict: __DEV__ });
  quarantinedCount.value = quarantined.length;
  backendKind.value = repo.db.backend.kind;

  // handing over to another tab is like leaving: what a screen keeps is saved for that tab to pick up
  const guard = await guardTabs(__DB_NAME__, { flush: () => { runLeaving(); return repo.db.flush(); } });
  setTabGuard(guard);
  const setRole = (role: typeof guard.role) => {
    repo.db.readOnly = role === 'reader';
    tabRole.value = role;
  };
  // put back changes a tab kept when it closed before they were written (only the saving tab does)
  const rescue = () => { if (repo.db.backend.kind !== 'memory') restoreStash(repo, __DB_NAME__); };
  setRole(guard.role);
  if (!repo.db.readOnly) rescue();
  guard.onRole((role) => {
    // taking over: start from what the other tab saved last, plus anything it kept on closing
    if (role === 'writer') {
      void reload(repo, () => setRole(role)).then(rescue).catch(reportError).finally(() => setRole(role));
    } else setRole(role);
  });
  guard.onRemoteSave(() => { void reload(repo).catch(reportError); });
  repo.db.onSaved = (stores) => {
    guard.saved(stores);
    // everything's written, so a copy kept on closing isn't needed (the page came back from the cache)
    if (!repo.db.unwritten().length) dropStash(__DB_NAME__);
  };

  bindRepo(repo);

  // the look and the sounds follow the settings
  effect(() => {
    void versions.meta.value;
    const s = data().settings();
    applyAppearance(s, data().themes());
    configureSound({
      on: s.sound, set: SOUND_SETS.includes(s.soundSet as SoundSet) ? (s.soundSet as SoundSet) : 'desk',
      master: s.volMaster / 100, ui: s.volUi / 100, results: s.volResults / 100,
    });
  });

  addEventListener('hashchange', onHashChange);
  setInterval(() => { minute.value++; }, 60_000);
  // save what's waiting before the tab closes or is hidden
  const flush = () => { if (repo.db.unsaved) void repo.db.flush(); };
  addEventListener('pagehide', () => {
    // a screen keeps what it needs first
    runLeaving();
    // the write may not finish before the tab goes, so keep a copy that the next open puts back
    const w = repo.db.unwritten();
    if (w.length && !repo.db.readOnly && repo.db.backend.kind !== 'memory') stashUnsaved(__DB_NAME__, w);
    flush();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('beforeunload', (e) => {
    if (repo.db.unsaved || repo.db.saveState === 'error') { flush(); e.preventDefault(); }
  });
  addEventListener('error', (e) => reportError(e.error ?? e.message));
  addEventListener('unhandledrejection', (e) => reportError(e.reason));

  const root = document.getElementById('app');
  if (!root) throw new Error('The page is missing its app container.');
  render(<App />, root);
  // the first screen is built: the startup speed check reads this mark
  performance.mark('playbook:ready');
  installTooltips();
  document.getElementById('boot')?.remove();
}

start().catch((e: unknown) => {
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = `Playbook couldn’t start: ${e instanceof Error ? e.message : String(e)}. Try reloading; your saved data is untouched.`;
});
