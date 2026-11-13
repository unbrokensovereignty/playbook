/**
 * The frame around every page: the sidebar, the page area with its slide between pages, banners
 * about saving, and the keys that work everywhere.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { Icon, type IconName } from './icons.tsx';
import { Button, IconButton, Kbd } from './components/controls.tsx';
import { DialogHost, MenuHost, ToastHost, openMenu, type MenuItem } from './components/overlays.tsx';
import { Palette, type Command } from './components/palette.tsx';
import { checkWhatsNew } from './components/whatsnew.tsx';
import { openSetup, setupDue } from './setup.tsx';
import {
  backendKind, canRedo, canUndo, data, dialogs, go, minute, overlayOpen, paletteOpen, quarantinedCount, route, routeDir,
  safely, saveError, saveState, sidebarNarrow, tabRole, takeOverTab, toggleSidebar, editsText, watch, watchClicks, type Page,
} from './state.ts';
import { inUse, SECTIONS, SETTING_KEYS, SETTINGS } from '../core/settings.ts';
import { PAGE_VIEWS } from './pages/index.ts';
import { play } from './sound.ts';
import { systemDark } from './theme.ts';
import { redo, undo } from './undo.ts';
import { keepFocus } from './focuskeep.ts';
import { AGENTS_BY_NAME } from '../core/kb/agents.ts';
import { mapById, MAPS } from '../core/kb/maps.ts';
import { playsLink } from './myplays.ts';
import { ROLES } from '../core/kb/roles.ts';
import { askedLine, askedTitle } from './planner/words.ts';
import { openPlanner, planWith, question } from './planner/store.ts';
import { backUpNow } from './backup.tsx';
import { MapThumb } from './art.tsx';
import { startTour, TourHost } from './tours/engine.tsx';
import { TOURS } from './tours/list.ts';

// ---------------------------------------------------------------- sidebar

interface NavItem { page: Page; label: string; icon: IconName }
const NAV: readonly NavItem[] = [
  { page: 'home', label: 'Home', icon: 'home' },
  { page: 'planner', label: 'Planner', icon: 'planner' },
  { page: 'select', label: 'Agent select', icon: 'crosshair' },
  { page: 'rankings', label: 'Rankings', icon: 'rankings' },
  { page: 'agents', label: 'Agents', icon: 'agents' },
  { page: 'maps', label: 'Maps', icon: 'map' },
  { page: 'saved', label: 'Saved', icon: 'bookmark' },
];
const NAV_BOTTOM: readonly NavItem[] = [
  { page: 'settings', label: 'Settings', icon: 'settings' },
  { page: 'help', label: 'Help', icon: 'help' },
];

function NavLink({ item, count }: { item: NavItem; count?: number }) {
  const cur = route.value.page === item.page || (item.page === 'settings' && route.value.page === 'themes');
  const narrow = sidebarNarrow.value;
  return (
    <a href={`#/${item.page}`} aria-current={cur ? 'page' : undefined} data-tip={narrow ? item.label : undefined} data-tip-side="right" onClick={() => { if (!cur) play('page'); }}>
      <Icon name={item.icon} size={20} />
      <span class="nav-label">{item.label}</span>
      {!!count && <span class="count" aria-label={`${count} saved`}>{count > 99 ? '99+' : count}</span>}
    </a>
  );
}

/** The question the planner is on, and a menu of recent ones. */
function PlanSwitch() {
  const r = watch('meta');
  const app = r.app();
  // the Planner's question as it stands, or as it was last left
  const q = question.value ?? app.draft;
  const open = (e: MouseEvent) => {
    const items: MenuItem[] = app.recent.slice(0, 6).map((x) => ({ label: `${askedTitle(x)} · ${askedLine(x)}`, icon: 'refresh', run: () => openPlanner(x) }));
    if (items.length) items.push('divider');
    items.push({ label: 'New question', icon: 'plus', run: () => planWith({}) });
    items.push({ label: 'Saved plans', icon: 'bookmark', run: () => go('saved') });
    openMenu(e, items);
  };
  const title = q ? askedTitle(q) : 'No question yet';
  return (
    <button type="button" class="plan-switch" data-tour="plan-switch" onClick={open} aria-haspopup="menu" data-tip={sidebarNarrow.value ? title : undefined} data-tip-side="right">
      <span class="plan-dot map-dot">{q && q.map !== 'any' && q.map !== 'best' ? <MapThumb id={q.map} /> : <Icon name="planner" size={16} />}</span>
      <span class="plan-text">
        <b>{title}</b>
        <small>{q ? askedLine(q) : 'Ask the Planner for a comp'}</small>
      </span>
      <Icon name="chevron-down" size={16} class="plan-chev" />
    </button>
  );
}

function SaveIndicator() {
  const st = saveState.value, kind = backendKind.value, reader = tabRole.value === 'reader';
  const text = reader ? 'Read-only' : kind === 'memory' ? 'Not saving' : st === 'saving' ? 'Saving…' : st === 'error' ? 'Not saved' : 'Saved';
  const tip = reader ? 'Another tab is saving your changes' : kind === 'memory' ? 'This browser won’t let the app save' : st === 'error' ? saveError.value : kind === 'local' ? 'Saved in the browser (basic storage)' : 'Saved on this computer';
  return (
    <span class={`save-state ${reader || kind === 'memory' ? 'error' : st}`} data-tip={tip} role="status">
      <span class="dot" /><span class="save-text">{text}</span>
    </span>
  );
}

/** The app's mark: a clipboard with a play drawn on it. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg class="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5" y="5" width="22" height="24" rx="4" fill="var(--card)" stroke="var(--accent)" stroke-width="2" />
      <rect x="11" y="2.5" width="10" height="5" rx="2" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.6" />
      <path d="M10 13.5l3.5 3.5M13.5 13.5 10 17" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" />
      <circle cx="21" cy="22" r="2.4" fill="none" stroke="var(--accent)" stroke-width="2" />
      <path d="M13 22.5c3.5 0 5.5-2.5 6.5-5.5" fill="none" stroke="var(--accent-line)" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="2 2.2" />
    </svg>
  );
}

function Sidebar() {
  const narrow = sidebarNarrow.value;
  const r = watch('plans');
  return (
    <nav class="sidebar" aria-label="Main">
      <div class="brand">
        <BrandMark />
        <span class="brand-name">Playbook</span>
        <IconButton icon="sidebar" size="sm" label={narrow ? 'Widen the sidebar' : 'Narrow the sidebar'} tipSide={narrow ? 'right' : 'below'} onClick={toggleSidebar} />
      </div>
      <button type="button" class="search-btn" data-tour="search" onClick={() => { paletteOpen.value = true; }} data-tip={narrow ? 'Search (Ctrl K)' : undefined} data-tip-side="right">
        <Icon name="search" size={17} /><span>Search</span><Kbd k="ctrl+k" />
      </button>
      <PlanSwitch />
      <div class="nav">
        {NAV.map((n) => <NavLink key={n.page} item={n} count={n.page === 'saved' ? r.plans().length : undefined} />)}
        <div class="nav-sep" />
        {NAV_BOTTOM.map((n) => <NavLink key={n.page} item={n} />)}
      </div>
      <div class="sidebar-foot">
        <div class="foot-row">
          <SaveIndicator />
          <IconButton icon="undo" size="sm" label="Undo (Ctrl Z)" disabled={!canUndo.value} onClick={undo} sound={false} tipSide={narrow ? 'right' : undefined} />
          <IconButton icon="redo" size="sm" label="Redo (Ctrl Shift Z)" disabled={!canRedo.value} onClick={redo} sound={false} tipSide={narrow ? 'right' : undefined} />
        </div>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------- banners

function Banner({ tone, icon, children, actions }: { tone?: 'info' | 'bad'; icon: IconName; children: ComponentChildren; actions?: ComponentChildren }) {
  return (
    <div class={`banner${tone ? ' ' + tone : ''}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <Icon name={icon} size={20} />
      <p>{children}</p>
      {actions}
    </div>
  );
}

function Banners() {
  const out: ComponentChildren[] = [];
  if (tabRole.value === 'reader') {
    out.push(<Banner key="tab" tone="info" icon="lock" actions={<Button size="sm" onClick={() => void takeOverTab()}>Use this tab instead</Button>}>
      Playbook is open in another tab, so this one is read-only. It keeps up with changes made there.
    </Banner>);
  }
  if (backendKind.value === 'memory') {
    out.push(<Banner key="mem" tone="bad" icon="warning" actions={<Button size="sm" icon="export" onClick={backUpNow}>Back up now</Button>}>
      This browser won’t let Playbook save, so changes last only until you close this tab. Back up to keep them.
    </Banner>);
  }
  if (saveState.value === 'error' && tabRole.value === 'writer') {
    out.push(<Banner key="save" tone="bad" icon="warning" actions={<Button size="sm" onClick={() => void data().db.flush()}>Try again</Button>}>
      {saveError.value} It will keep trying, and your work stays on screen in the meantime.
    </Banner>);
  }
  if (quarantinedCount.value > 0) {
    const n = quarantinedCount.value;
    out.push(<Banner key="bad" icon="warning" actions={<>
      <Button size="sm" onClick={() => go('help', 'about')}>Details</Button>
      <IconButton icon="x" size="sm" label="Dismiss" onClick={() => { quarantinedCount.value = 0; }} />
    </>}>
      {n} damaged {n === 1 ? 'record was' : 'records were'} found and set aside so the rest opens normally.
    </Banner>);
  }
  return out.length ? <div class="banners">{out}</div> : null;
}

// ---------------------------------------------------------------- the command list

function commands(): Command[] {
  const r = data();
  const out: Command[] = [];
  const pages: [Page, string, IconName, string?][] = [
    ['home', 'Home', 'home'], ['planner', 'Planner', 'planner', 'plan comp team best'], ['select', 'Agent select', 'crosshair', 'lock in pick teammates draft'], ['rankings', 'Rankings', 'rankings', 'tier list best agents comps'],
    ['agents', 'Agents', 'agents', 'abilities kit'], ['maps', 'Maps', 'map', 'sites callouts plays'], ['saved', 'Saved', 'bookmark', 'plans parties presets plays games record'],
    ['settings', 'Settings', 'settings', 'options preferences'], ['themes', 'Themes', 'palette', 'colors appearance dark light'], ['help', 'Help', 'help', 'guide about'],
  ];
  for (const [page, label, icon, keywords] of pages) out.push({ id: `go-${page}`, group: 'Go to', label, icon, keywords, run: () => go(page) });
  for (const a of AGENTS_BY_NAME) {
    const role = ROLES.find((x) => x.id === a.role)!.name;
    out.push({ id: `agent-${a.id}`, group: 'Agents', label: a.name, icon: 'agents', hint: role, keywords: role, run: () => go('agents', a.id) });
  }
  for (const m of MAPS) out.push({ id: `map-${m.id}`, group: 'Maps', label: m.name, icon: 'map', hint: m.pool ? 'In the pool' : undefined, run: () => go('maps', m.id) });
  for (const m of MAPS) out.push({ id: `plays-${m.id}`, group: 'Plays', label: `Plays on ${m.name}`, icon: 'play', keywords: 'hit retake setup replay draw', run: () => go('maps', playsLink(m.id)) });
  for (const p of r.myPlays()) out.push({ id: `myplay-${p.id}`, group: 'Plays', label: p.name, icon: 'draw', hint: `Your play on ${mapById(p.map)?.name ?? p.map}`, run: () => go('maps', playsLink(p.map, p.id)) });
  for (const m of MAPS) out.push({ id: `plan-${m.id}`, group: 'Plan for', label: `Plan for ${m.name}`, icon: 'planner', keywords: 'comp best team', run: () => planWith({ map: m.id }) });
  for (const p of r.plans()) out.push({ id: `saved-${p.id}`, group: 'Saved plans', label: p.name, icon: 'bookmark', hint: askedTitle(p.query), run: () => go('saved', p.id) });
  for (const p of r.parties()) out.push({ id: `party-${p.id}`, group: 'Parties', label: `Plan for ${p.name}`, icon: 'users', run: () => planWith({ party: p.players.length as 2 | 3 | 5, pools: p.players.map((x) => x.agents) }) });
  const s = r.settings();
  const dark = s.themeMode === 'dark' || (s.themeMode === 'system' && systemDark.value);
  const acts: Omit<Command, 'group'>[] = [
    { id: 'new-plan', label: 'New question', icon: 'plus', keywords: 'plan comp', run: () => planWith({}) },
    { id: 'undo', label: 'Undo', icon: 'undo', hint: 'Ctrl Z', run: undo },
    { id: 'redo', label: 'Redo', icon: 'redo', hint: 'Ctrl Shift Z', run: redo },
    { id: 'mode', label: dark ? 'Switch to light' : 'Switch to dark', icon: dark ? 'sun' : 'moon', keywords: 'theme dark light mode', run: () => safely(() => r.setSetting('themeMode', dark ? 'light' : 'dark')) },
    { id: 'sound', label: s.sound ? 'Turn sound off' : 'Turn sound on', icon: s.sound ? 'speaker-off' : 'speaker', keywords: 'mute audio effects', run: () => safely(() => r.setSetting('sound', !s.sound)) },
    { id: 'backup', label: 'Back up now', icon: 'export', keywords: 'save export download', run: backUpNow },
    { id: 'keys', label: 'Keyboard shortcuts', icon: 'keyboard', keywords: 'keys hotkeys', run: () => go('help', 'keys') },
    { id: 'sidebar', label: sidebarNarrow.value ? 'Widen the sidebar' : 'Narrow the sidebar', icon: 'sidebar', run: toggleSidebar },
  ];
  for (const a of acts) out.push({ ...a, group: 'Actions' });
  for (const t of TOURS) out.push({ id: `tour-${t.id}`, group: 'Tours', label: `Tour: ${t.name}`, icon: 'compass', keywords: `guide help show me around ${t.blurb}`, run: () => startTour(t.id) });
  for (const k of SETTING_KEYS.filter(inUse)) {
    const def = SETTINGS[k];
    const section = SECTIONS.find((x) => x.id === def.section)?.title ?? '';
    out.push({ id: `setting-${k}`, group: 'Settings', label: def.label, icon: 'settings', hint: section, keywords: `${'keywords' in def ? def.keywords : ''} ${section}`, run: () => go('settings', k) });
  }
  return out;
}

// ---------------------------------------------------------------- keys that work everywhere

function onKey(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === 'k') {
    e.preventDefault();
    if (!dialogs.value.length) paletteOpen.value = !paletteOpen.value;
    return;
  }
  // a text field keeps its own keys (and its own undo); a switch, slider or checkbox leaves them to the app,
  // and a list box too, except the letters it picks by
  if (overlayOpen() || editsText(e.target)) return;
  const picks = e.target instanceof HTMLSelectElement;
  if (mod && !e.altKey && ((key === 'z' && e.shiftKey) || key === 'y')) { e.preventDefault(); redo(); }
  else if (mod && !e.altKey && key === 'z') { e.preventDefault(); undo(); }
  else if (mod && key === '\\') { e.preventDefault(); toggleSidebar(); }
  else if (!mod && !e.altKey && !picks && e.key === '?') { e.preventDefault(); go('help', 'keys'); }
  else if (!mod && !e.altKey && !picks && e.key === '/') { e.preventDefault(); paletteOpen.value = true; }
}

// ---------------------------------------------------------------- the app

/** Pages with side-by-side panels get more room on a wide screen. */
const WIDE: readonly Page[] = ['home', 'planner', 'select', 'rankings', 'maps', 'agents', 'saved'];

export function App() {
  const main = useRef<HTMLElement>(null);
  const { page, arg } = route.value;
  void minute.value;
  useEffect(() => {
    // opened for the first time ever: ask how you play (setup.tsx), before anything else
    const first = !data().app().seenVersion;
    checkWhatsNew(true);
    if (first && setupDue() && route.peek().page !== 'selftest') void openSetup();
    addEventListener('keydown', onKey);
    const stopKeeping = keepFocus(), stopWatching = watchClicks();
    return () => { removeEventListener('keydown', onKey); stopKeeping(); stopWatching(); };
  }, []);
  useLayoutEffect(() => { main.current?.scrollTo({ top: 0 }); }, [page]);
  // a new version's note waits until a page has settled
  useEffect(() => { const t = setTimeout(checkWhatsNew, 900); return () => clearTimeout(t); }, [page]);
  const View = PAGE_VIEWS[page];
  return (
    <div class={`shell${sidebarNarrow.value ? ' narrow' : ''}`}>
      <Sidebar />
      <main class="main" ref={main} id="main">
        <div class={`page${routeDir.value < 0 ? ' back' : ''}${WIDE.includes(page) ? ' wide' : ''}`} key={page}>
          <Banners />
          <View arg={arg} />
        </div>
      </main>
      {paletteOpen.value && <Palette commands={commands} />}
      <TourHost />
      <MenuHost />
      <DialogHost />
      <ToastHost />
    </div>
  );
}

/** A page's heading row: eyebrow, title, a line of text and actions on the right. */
export function PageHead({ eyebrow, title, children, actions }: { eyebrow?: ComponentChildren; title: ComponentChildren; children?: ComponentChildren; actions?: ComponentChildren }) {
  return (
    <header class="page-head">
      <div class="titles">
        {eyebrow && <span class="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && <div class="row">{actions}</div>}
    </header>
  );
}
