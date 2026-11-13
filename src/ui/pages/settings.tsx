/**
 * Settings, drawn from the one settings schema, and your data: backups, restoring and erasing.
 * Changes save as they're made, and Ctrl Z undoes them.
 */
import { useEffect, useState } from 'preact/hooks';
import { PageHead } from '../shell.tsx';
import { Badge, Button, ColorField, IconButton, Segmented, Select, Slider, Stepper, Toggle } from '../components/controls.tsx';
import { confirm, UNDO_NOTE } from '../components/overlays.tsx';
import { Icon } from '../icons.tsx';
import { data, go, revisit, safely, tabRole, toast, watch } from '../state.ts';
import { scrollMotion } from '../theme.ts';
import { play } from '../sound.ts';
import { backUpNow, restoreFromFile } from '../backup.tsx';
import { AgentChips } from '../components/pickers.tsx';
import { askToKeep, sizeText, storageState, type Kept } from '../storage.ts';
import { inUse, SECTIONS, SETTING_KEYS, SETTINGS, type SectionId, type SettingDef, type SettingKey, type Settings } from '../../core/settings.ts';
import { ACCENTS, BUILT_IN_THEMES, type ThemePicks } from '../../core/theme.ts';
import { dayKey, fmtDay, keyOf } from '../../core/dates.ts';
import { plural } from '../../core/util.ts';
import type { Comfort } from '../../core/engine/query.ts';
import { ComfortSetting } from '../components/comfort.tsx';
import type { PageProps } from './index.ts';

/** Settings that only matter while sound is on. */
const SOUND_KEYS: readonly SettingKey[] = ['soundSet', 'volMaster', 'volUi', 'volResults'];
const shown = (k: SettingKey, s: Settings): boolean => inUse(k) && (!SOUND_KEYS.includes(k) || s.sound) && (k !== 'myComfort' || s.myAgents.length > 0);


function ThemeSetting({ base, value, onSave, own }: { base: 'light' | 'dark'; value: string; onSave: (v: string) => void; own: readonly ThemePicks[] }) {
  const list = [...BUILT_IN_THEMES, ...own].filter((t) => t.base === base);
  return (
    <div class="row">
      <Select value={list.some((t) => t.id === value) ? value : (list[0]?.id ?? '')} options={list.map((t) => [t.id, t.name] as [string, string])} onChange={onSave} label={base === 'dark' ? 'Dark theme' : 'Light theme'} />
      <Button size="sm" kind="quiet" icon="palette" onClick={() => go('themes')}>All themes</Button>
    </div>
  );
}

function AccentSetting({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const custom = value && !ACCENTS.some((a) => a.hex === value);
  return (
    <div class="stack" style={{ gap: '8px', alignItems: 'flex-end' }}>
      <div class="swatches" role="radiogroup" aria-label="Accent color">
        <button type="button" role="radio" aria-checked={!value} class="swatch theme-own" title="The theme’s own" aria-label="The theme’s own" onClick={() => onSave('')} />
        {ACCENTS.map((a) => (
          <button key={a.hex} type="button" role="radio" aria-checked={value === a.hex} class="swatch" style={{ '--swatch': a.hex }} title={a.name} aria-label={a.name} onClick={() => onSave(a.hex)} />
        ))}
      </div>
      <ColorField value={custom ? value : '#2F63D0'} onChange={onSave} label="Custom accent" />
    </div>
  );
}

function Control({ k, s, save }: { k: SettingKey; s: Settings; save: (k: SettingKey, v: unknown) => void }) {
  const def = SETTINGS[k] as SettingDef;
  const v = s[k];
  if (k === 'themeLight' || k === 'themeDark') return <ThemeSetting base={k === 'themeDark' ? 'dark' : 'light'} value={String(v)} onSave={(x) => save(k, x)} own={data().themes()} />;
  if (k === 'accent') return <AccentSetting value={String(v)} onSave={(x) => save(k, x)} />;
  if (k === 'usualParty' && def.type === 'choice') return <Segmented value={String(v)} options={def.options} onChange={(x) => save(k, x)} label={def.label} />;
  switch (def.type) {
    case 'bool': return <Toggle checked={v as boolean} onChange={(x) => save(k, x)} label={<span class="visually-hidden">{def.label}</span>} />;
    case 'choice':
      return def.options.length <= 3 && def.options.every(([, t]) => t.length <= 12)
        ? <Segmented value={String(v)} options={def.options} onChange={(x) => save(k, x)} label={def.label} />
        : <Select value={String(v)} options={def.options} onChange={(x) => save(k, x)} label={def.label} />;
    case 'number':
      if (def.percent) return <Slider value={v as number} min={def.min} max={def.max} step={def.step ?? 1} label={def.label} format={(n) => `${n}%`} onChange={(x) => save(k, x)} />;
      return <Stepper value={v as number} min={def.min} max={def.max} step={def.step ?? 1} unit={def.unit} label={def.label} onChange={(x) => save(k, x)} />;
    case 'text': return null;
    case 'agents':
      return <AgentChips ids={v as readonly string[]} empty="Choose agents" onChange={(x) => save(k, x)} o={{ title: def.label, max: def.max, line: def.help }} />;
    case 'comfort':
      return <ComfortSetting agents={s[def.of]} value={v as Readonly<Record<string, Comfort>>} onSave={(x) => save(k, x)} />;
  }
}

function Row({ k, s, save, reset }: { k: SettingKey; s: Settings; save: (k: SettingKey, v: unknown) => void; reset: (k: SettingKey) => void }) {
  const def = SETTINGS[k] as SettingDef;
  const changed = k in data().savedSettings() && k !== 'themeLight' && k !== 'themeDark';
  return (
    <div class="setting-row" id={`k-${k}`}>
      <div class="setting-text">
        <span class="setting-label">{def.label}</span>
        {def.help && <span class="setting-help">{def.help}</span>}
      </div>
      <div class="setting-control">
        <Control k={k} s={s} save={save} />
        {changed && <IconButton icon="undo" size="sm" label="Back to the usual value" onClick={() => reset(k)} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- your data

function StorageRow() {
  const [st, setSt] = useState<{ kept: Kept; used: number | null } | null>(null);
  useEffect(() => { void storageState().then(setSt); }, []);
  if (!st || st.kept === 'unknown') return null;
  const ask = async () => {
    const kept = await askToKeep();
    setSt({ ...st, kept });
    if (kept === 'kept') { play('saved'); toast('Your browser will keep Playbook’s data, even when it’s short of space.', { tone: 'good' }); }
    else toast('Your browser didn’t agree this time. Some browsers decide by how often you use a page. Backups keep your data safe either way.', { ms: 9000 });
  };
  return (
    <div class="setting-row" id="k-storage">
      <div class="setting-text">
        <span class="setting-label">Keeping your data</span>
        <span class="setting-help">
          {st.kept === 'kept' ? 'Your browser has agreed to keep Playbook’s data, even when it’s short of space.' : 'Your browser may clear Playbook’s data if it runs short of space. Ask it to keep the data, and back up now and then.'}
          {st.used !== null && ` About ${sizeText(st.used)} is stored.`}
        </span>
      </div>
      <div class="setting-control">
        {st.kept === 'kept' ? <Badge tone="good" icon="check">Kept</Badge> : <Button icon="lock" onClick={() => void ask()}>Ask to keep it</Button>}
      </div>
    </div>
  );
}

function DataSection() {
  const r = watch('meta', 'plans', 'parties');
  const app = r.app();
  const today = keyOf(new Date());
  const last = app.lastBackup ? fmtDay(dayKey(app.lastBackup, 0), today) : 'never';
  const reader = tabRole.value === 'reader';
  const plans = r.plans().length, parties = r.parties().length;
  const erase = async () => {
    const yes = await confirm({
      title: 'Erase everything?', danger: true, yes: 'Erase everything',
      body: <p>This deletes your {plural(plans, 'saved plan')}, {plural(parties, 'party', 'parties')}, themes and settings from this computer. {UNDO_NOTE} To keep a copy for later, back up first.</p>,
    });
    if (yes) safely(() => { r.eraseAll(); toast('Erased everything.', { undo: true }); });
  };
  return (
    <>
      <div class="setting-row">
        <div class="setting-text">
          <span class="setting-label">Backups</span>
          <span class="setting-help">A backup file has your saved plans, parties, themes and settings. {last === 'never' ? 'You haven’t made one yet.' : `Your last backup was ${last}.`}</span>
        </div>
        <div class="setting-control">
          <Button icon="export" onClick={backUpNow}>Back up now</Button>
          <Button icon="import" disabled={reader} onClick={() => void restoreFromFile()}>Restore…</Button>
        </div>
      </div>
      <StorageRow />
      <div class="setting-row">
        <div class="setting-text">
          <span class="setting-label">Erase everything</span>
          <span class="setting-help">Starts over with nothing saved.</span>
        </div>
        <div class="setting-control"><Button kind="danger" icon="trash" disabled={reader} onClick={() => void erase()}>Erase…</Button></div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- the page

const ALL_SECTIONS: readonly { id: SectionId | 'data'; title: string; blurb: string }[] = [...SECTIONS, { id: 'data', title: 'Your data', blurb: 'Back up, restore or erase what Playbook keeps on this computer.' }];

export function SettingsPage({ arg }: PageProps) {
  const r = watch('meta');
  const s = r.settings();
  const [flash, setFlash] = useState('');

  // #/settings/<section or setting> scrolls to it
  useEffect(() => {
    if (!arg) return;
    const isKey = (SETTING_KEYS as readonly string[]).includes(arg);
    // a hidden sound setting points at the sound switch; one not in use yet, at its section
    const key = !isKey || shown(arg as SettingKey, s) ? arg : inUse(arg as SettingKey) ? 'sound' : '';
    requestAnimationFrame(() => {
      const el = document.getElementById(key ? (isKey ? `k-${key}` : `s-${key}`) : `s-${SETTINGS[arg as SettingKey].section}`);
      el?.scrollIntoView({ block: isKey && key ? 'center' : 'start', behavior: scrollMotion() });
      if (isKey && key) { setFlash(key); setTimeout(() => setFlash(''), 1600); }
    });
  }, [arg, revisit.value]);

  const save = (k: SettingKey, v: unknown) => safely(() => {
    if (!r.setSetting(k, v as never)) { toast('That value can’t be used.', { tone: 'bad' }); return; }
    // a new sound set plays a little of itself once it's in use
    if (k === 'soundSet') setTimeout(() => play('ready'), 60);
  });
  const reset = (k: SettingKey) => safely(() => r.resetSetting(k));
  const keysIn = (sec: SectionId) => SETTING_KEYS.filter((k) => (SETTINGS[k] as SettingDef).section === sec && shown(k, s));

  return (
    <>
      <PageHead title="Settings">Changes save as you make them. Ctrl Z undoes the last one.</PageHead>
      <div class="settings-layout">
        <nav class="settings-nav" aria-label="Sections">
          {ALL_SECTIONS.map((sec) => (
            <button key={sec.id} type="button" onClick={() => { play('tick'); document.getElementById(`s-${sec.id}`)?.scrollIntoView({ block: 'start', behavior: scrollMotion() }); }}>{sec.title}</button>
          ))}
          <a href="#/themes"><Icon name="palette" size={16} /> Themes</a>
        </nav>
        <div class="settings-body">
          {ALL_SECTIONS.map((sec) => (
            <section key={sec.id} class="panel settings-section" id={`s-${sec.id}`} data-tour={`settings-section-${sec.id}`}>
              <h2>{sec.title}</h2>
              <p class="muted">{sec.blurb}</p>
              {sec.id !== 'data' && keysIn(sec.id).map((k) => (
                <div key={k} class={flash === k ? 'flash' : undefined}><Row k={k} s={s} save={save} reset={reset} /></div>
              ))}
              {sec.id === 'data' && <DataSection />}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
