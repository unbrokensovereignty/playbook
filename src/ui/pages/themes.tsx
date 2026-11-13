/**
 * Themes: pick a built-in one or make your own from five colors. Every theme is checked so text
 * stays readable; colors that had to be adjusted are named in the editor.
 */
import { useEffect, useState } from 'preact/hooks';
import { PageHead } from '../shell.tsx';
import { Button, CancelButton, ColorField, Field, IconButton, Segmented, TextInput, Toggle } from '../components/controls.tsx';
import { confirm, DialogLayout, openMenu, prompt, UNDO_NOTE } from '../components/overlays.tsx';
import { Icon } from '../icons.tsx';
import { data, openDialog, safely, toast, useSettings, watch } from '../state.ts';
import { copyWithToast } from '../files.ts';
import { SETTINGS } from '../../core/settings.ts';
import { baseFor, previewTheme, systemDark, themeFor } from '../theme.ts';
import { play } from '../sound.ts';
import { BUILT_IN_THEMES, MAX_THEMES, oklchHex, parseThemeCode, THEME_CODE_PREFIX, themeCode, type Base, type ThemePicks } from '../../core/theme.ts';
import type { PageProps } from './index.ts';

/** The theme's colors as CSS variables, so a preview can wear a theme other than the app's. */
export function themeVars(picks: ThemePicks, accent = ''): Record<string, string> {
  const g = themeFor(picks, accent);
  return Object.fromEntries(Object.entries(g.tokens).map(([k, v]) => [`--${k}`, v]));
}

export function ThemePreview({ picks, big }: { picks: ThemePicks; big?: boolean }) {
  return (
    <div class={`theme-preview${big ? ' big' : ''}`} style={themeVars(picks)} aria-hidden="true">
      <div class="tp-side"><i class="on" /><i /><i /><i /></div>
      <div class="tp-main">
        <div class="tp-card"><b>Ascent</b><span>A split through Mid</span></div>
        <div class="tp-row"><span class="tp-btn s" /><span class="tp-btn a" /><span class="tp-btn b" /><span class="tp-btn c" /></div>
      </div>
    </div>
  );
}

/** Plain names for the colors a theme can have adjusted. */
function friendlyToken(n: string): string {
  if (/^(on-)?tier/.test(n)) return 'tier colors';
  if (/^(on-)?(good|warn|bad)/.test(n)) return 'colors for good and bad news';
  if (/accent/.test(n)) return 'accent';
  if (n.startsWith('card')) return 'card text';
  if (/^text/.test(n)) return 'text';
  return n.replace(/-/g, ' ');
}

/** A random but pleasant theme: a hue for the room, its complement-ish for the accent. */
function shuffled(base: Base): Omit<ThemePicks, 'id' | 'name'> {
  const h = Math.random() * 360, ah = (h + 150 + Math.random() * 60) % 360;
  const dark = base === 'dark';
  const c = 0.015 + Math.random() * 0.03;
  const bg = oklchHex({ l: dark ? 0.17 : 0.93, c, h });
  const gradient = Math.random() < 0.35;
  return {
    base,
    bg,
    bg2: gradient ? oklchHex({ l: dark ? 0.2 : 0.9, c: c * 2, h: (h + 40) % 360 }) : '',
    surface: oklchHex({ l: dark ? 0.21 : 0.97, c: c * 0.8, h }),
    card: oklchHex({ l: dark ? 0.25 : 0.995, c: c * 0.5, h }),
    accent: oklchHex({ l: dark ? 0.76 : 0.52, c: 0.14, h: ah }),
  };
}

function ThemeEditor({ initial, close }: { initial: ThemePicks; close: (v?: unknown) => void }) {
  const [t, setT] = useState<ThemePicks>(initial);
  const [gradient, setGradient] = useState(!!initial.bg2);
  const picks: ThemePicks = { ...t, bg2: gradient ? t.bg2 || t.surface : '' };
  const g = themeFor(picks, '');
  useEffect(() => { previewTheme(picks); }, [JSON.stringify(picks)]);
  useEffect(() => () => previewTheme(null), []);
  const set = (patch: Partial<ThemePicks>) => setT((x) => ({ ...x, ...patch }));
  const nudged = [...new Set(g.nudged.map(friendlyToken))];
  // Esc closes only when nothing would be lost
  const dirty = JSON.stringify(picks) !== JSON.stringify({ ...initial, bg2: initial.bg2 || '' });
  const save = () => {
    // a new theme is put to use, and so is the one showing now when its kind changes; if the app is
    // showing the other kind, it switches to this one's
    const r = data(), s = r.settings(), nowBase = baseFor(s, systemDark.value);
    const showing = !!initial.id && (initial.base === 'dark' ? s.themeDark : s.themeLight) === initial.id && initial.base === nowBase;
    const out = safely(() => r.saveTheme({ ...picks, name: t.name.trim() || 'My theme' }, (!initial.id || showing) && picks.base !== nowBase ? picks.base : undefined));
    if (out === null) { toast(`You can keep up to ${MAX_THEMES} themes. Delete one first.`, { tone: 'bad' }); return; }
    if (out) close(out);
  };
  return (
    <div onKeyDown={(e) => { if (e.key === 'Escape' && !dirty) { e.stopPropagation(); close(); } }}>
      <DialogLayout title={initial.id ? 'Edit theme' : 'New theme'} icon="palette" close={() => close()} foot={<>
        <Button kind="quiet" icon="shuffle" class="mr-auto" onClick={() => { play('tick'); const x = shuffled(t.base); setGradient(!!x.bg2); set(x); }}>Shuffle</Button>
        <CancelButton onClick={() => close()} />
        <Button kind="primary" onClick={save}>Save theme</Button>
      </>}>
        <div class="theme-editor">
          <div class="stack">
            <Field label="Name" for="theme-name"><TextInput id="theme-name" value={t.name} maxLength={40} onInput={(v) => set({ name: v })} placeholder="My theme" /></Field>
            <Field label="Kind"><Segmented value={t.base} label="Light or dark" options={[['light', 'Light'], ['dark', 'Dark']]} onChange={(b) => set({ base: b })} /></Field>
            <div class="color-grid">
              <Field label="Background"><ColorField value={t.bg} onChange={(v) => set({ bg: v })} label="Background" /></Field>
              <div class="field">
                <Toggle checked={gradient} onChange={setGradient} label="Gradient" />
                {gradient && <ColorField value={t.bg2 || t.surface} onChange={(v) => set({ bg2: v })} label="Second background color" />}
              </div>
              <Field label="Panels"><ColorField value={t.surface} onChange={(v) => set({ surface: v })} label="Panels" /></Field>
              <Field label="Cards"><ColorField value={t.card} onChange={(v) => set({ card: v })} label="Cards" /></Field>
              <Field label="Accent"><ColorField value={t.accent} onChange={(v) => set({ accent: v })} label="Accent" /></Field>
            </div>
          </div>
          <div class="stack">
            <ThemePreview picks={picks} big />
            {nudged.length > 0 ? (
              <p class="small muted" role="status"><Icon name="info" size={15} class="inline-icon" /> To keep things readable, the {nudged.length > 1 ? `${nudged.slice(0, -1).join(', ')} and ${nudged.at(-1)}` : nudged[0]} {nudged.length === 1 && !nudged[0]?.endsWith('colors') ? 'was' : 'were'} adjusted a little.</p>
            ) : <p class="small muted"><Icon name="check" size={15} class="inline-icon" /> Every color is readable as picked.</p>}
          </div>
        </div>
      </DialogLayout>
    </div>
  );
}

export function editTheme(initial: ThemePicks) {
  return openDialog<ThemePicks>('Theme editor', (close) => <ThemeEditor initial={initial} close={close} />, { wide: true, dismissable: false });
}

function ThemeTile({ t, chosen, own }: { t: ThemePicks; chosen: 'now' | 'other' | ''; own: boolean }) {
  const r = data();
  const s = r.settings();
  const use = () => {
    const nowBase = baseFor(s, systemDark.value);
    safely(() => r.setSettings({ [t.base === 'dark' ? 'themeDark' : 'themeLight']: t.id, ...(nowBase !== t.base ? { themeMode: t.base } : {}) }, `Use the theme “${t.name}”`));
    play('toggle');
  };
  const menu = (e: MouseEvent) => openMenu(e, [
    { label: 'Edit…', icon: 'edit', run: () => void editTheme(t) },
    { label: 'Make a copy…', icon: 'copy', run: () => void editTheme({ ...t, id: '', name: `${t.name} (copy)` }) },
    { label: 'Copy theme code', icon: 'export', run: () => void copyWithToast(themeCode(t), 'Theme code copied.', `Copying didn’t work here. The theme code is ${themeCode(t)}`) },
    'divider',
    { label: 'Delete…', icon: 'trash', danger: true, run: async () => {
      if (await confirm({ title: `Delete “${t.name}”?`, body: `Anything using it goes back to the usual theme. ${UNDO_NOTE}`, yes: 'Delete theme', danger: true })) safely(() => { r.deleteTheme(t.id); toast(`Deleted “${t.name}”.`, { undo: true }); });
    } },
  ]);
  return (
    <div class={`theme-tile${chosen === 'now' ? ' current' : ''}`}>
      <button type="button" class="theme-pick" onClick={use} aria-pressed={chosen !== ''}>
        <ThemePreview picks={t} />
        <span class="theme-name">
          {t.name}
          {chosen === 'now' && <Icon name="check" size={16} label="In use" />}
          {chosen === 'other' && <span class="faint small">for {t.base}</span>}
        </span>
      </button>
      {own
        ? <IconButton icon="more" size="sm" label={`More for “${t.name}”`} class="theme-more" onClick={menu} />
        : <IconButton icon="copy" size="sm" label="Make a copy to change" class="theme-more" onClick={() => void editTheme({ ...t, id: '', name: `${t.name} (copy)` })} />}
    </div>
  );
}

export function ThemesPage(_p: PageProps) {
  const r = watch('meta');
  const s = useSettings();
  const own = r.themes();
  const nowBase = baseFor(s, systemDark.value);
  const chosen = (t: ThemePicks): 'now' | 'other' | '' => {
    const picked = t.base === 'dark' ? s.themeDark === t.id : s.themeLight === t.id;
    return !picked ? '' : t.base === nowBase ? 'now' : 'other';
  };
  const current = [...BUILT_IN_THEMES, ...own].find((t) => t.base === nowBase && chosen(t) === 'now') ?? BUILT_IN_THEMES[0]!;
  const importCode = async () => {
    const code = await prompt({ title: 'Add a shared theme', label: 'Theme code', yes: 'Add theme', placeholder: `${THEME_CODE_PREFIX}…`, maxLength: 400, check: (v) => (parseThemeCode(v) ? '' : `That isn’t a theme code. It starts with ${THEME_CODE_PREFIX}`) });
    const t = code ? parseThemeCode(code) : null;
    if (t) await editTheme(t);
  };
  const groups: [string, ThemePicks[]][] = [
    ['Light', BUILT_IN_THEMES.filter((t) => t.base === 'light')],
    ['Dark', BUILT_IN_THEMES.filter((t) => t.base === 'dark')],
  ];
  return (
    <>
      <PageHead eyebrow={<a href="#/settings/appearance">Settings</a>} title="Themes" actions={<>
        <Button icon="import" onClick={() => void importCode()}>Add from code</Button>
        <Button kind="primary" icon="plus" onClick={() => void editTheme({ ...current, id: '', name: 'My theme' })}>New theme</Button>
      </>}>
        One light theme and one dark theme are chosen, and “Light or dark” in Settings decides which one shows.
      </PageHead>
      <div class="row wrap" style={{ marginBottom: '8px' }}>
        <Segmented value={s.themeMode} label="Light or dark" onChange={(v) => safely(() => r.setSetting('themeMode', v))} options={SETTINGS.themeMode.options} />
      </div>
      {own.length > 0 && (
        <section class="section">
          <h2>Yours</h2>
          <div class="theme-grid">{own.map((t) => <ThemeTile key={t.id} t={t} chosen={chosen(t)} own />)}</div>
        </section>
      )}
      {groups.map(([name, list]) => (
        <section class="section" key={name}>
          <h2>{name}</h2>
          <div class="theme-grid">{list.map((t) => <ThemeTile key={t.id} t={t} chosen={chosen(t)} own={false} />)}</div>
        </section>
      ))}
    </>
  );
}
