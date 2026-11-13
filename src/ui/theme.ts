/**
 * Puts the chosen theme, text size and motion setting on the page.
 */
import { signal } from '@preact/signals';
import { findTheme, generateTheme, tokensCss, type Base, type GeneratedTheme, type ThemePicks } from '../core/theme.ts';
import type { Settings } from '../core/settings.ts';

const media = (q: string) => (typeof matchMedia === 'function' ? matchMedia(q) : null);
const darkQuery = media('(prefers-color-scheme: dark)');
const motionQuery = media('(prefers-reduced-motion: reduce)');

/** The computer's light/dark and motion preferences, as signals. */
export const systemDark = signal(darkQuery?.matches ?? false);
export const systemReduced = signal(motionQuery?.matches ?? false);
darkQuery?.addEventListener('change', (e) => { systemDark.value = e.matches; });
motionQuery?.addEventListener('change', (e) => { systemReduced.value = e.matches; });

let styleEl: HTMLStyleElement | null = null;
const cache = new Map<string, GeneratedTheme>();

export function themeFor(picks: ThemePicks, accent: string): GeneratedTheme {
  const key = JSON.stringify(picks) + accent;
  let g = cache.get(key);
  if (!g) { g = generateTheme(picks, accent); cache.set(key, g); }
  return g;
}

export const baseFor = (s: Settings, dark: boolean): Base => (s.themeMode === 'dark' || (s.themeMode === 'system' && dark) ? 'dark' : 'light');

/** The theme in effect. */
export function currentPicks(s: Settings, own: readonly ThemePicks[], dark: boolean): ThemePicks {
  const base = baseFor(s, dark);
  return findTheme(base === 'dark' ? s.themeDark : s.themeLight, own, base);
}

/** The motion level in effect: Full, Reduced (fades only) or Off. */
/** How to scroll to something: smoothly only with motion at full. */
export const scrollMotion = (): ScrollBehavior => (document.documentElement.dataset.motion === 'full' ? 'smooth' : 'auto');

export const motionLevel = (s: Settings, reduced: boolean): 'full' | 'reduced' | 'off' =>
  s.motion === 'off' ? 'off' : s.motion === 'reduced' || (s.motion === 'system' && reduced) ? 'reduced' : 'full';

let previewing: ThemePicks | null = null;

/** A theme as the page shows it. */
interface Painted { css: string; scheme: Base; id: string }
/** The theme most recently asked for; a switch that's overtaken by a newer one is dropped. */
let wanted: Painted | null = null;
let switching: ViewTransition | null = null;
let fallbackTimer = 0;

function write(p: Painted) {
  if (p !== wanted) return;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'theme';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = p.css;
  const root = document.documentElement;
  root.dataset.base = p.scheme;
  root.dataset.theme = p.id;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', p.scheme);
}

/**
 * Applies a theme's colors (the real theme, or a preview while editing one).
 *
 * A real switch cross-fades. Where the browser can, it fades a snapshot of the whole page on the GPU
 * (a view transition), so nothing re-lays out or repaints frame by frame and the page's gradient
 * fades along with everything else. Other browsers fade each element's colors instead.
 * Previews change at once, so dragging a color picker stays smooth.
 */
function paint(picks: ThemePicks, accent: string, animate: boolean) {
  const g = themeFor(picks, accent);
  const css = `:root {\n${tokensCss(g)}\n}`;
  if (css === wanted?.css) return;
  const first = !wanted;
  const next: Painted = { css, scheme: g.scheme, id: picks.id };
  wanted = next;
  const root = document.documentElement;
  switching?.skipTransition();
  if (first || !animate || root.dataset.motion === 'off' || document.visibilityState !== 'visible') {
    write(next);
    return;
  }
  if (typeof document.startViewTransition === 'function') {
    // a switch skipped by a quicker one still runs its update, and not always first, so each writes the latest choice
    const t = document.startViewTransition(() => write(wanted ?? next));
    switching = t;
    // a skipped switch rejects `ready`; that's expected, not an error
    t.ready.catch(() => {});
    void t.finished.finally(() => { if (switching === t) switching = null; });
    return;
  }
  root.classList.add('theme-switching');
  write(next);
  clearTimeout(fallbackTimer);
  fallbackTimer = window.setTimeout(() => root.classList.remove('theme-switching'), 320);
}

let settingsNow: { s: Settings; own: readonly ThemePicks[] } | null = null;

export function applyAppearance(s: Settings, own: readonly ThemePicks[]) {
  settingsNow = { s, own };
  const root = document.documentElement;
  root.dataset.text = s.textSize;
  root.dataset.motion = motionLevel(s, systemReduced.value);
  if (!previewing) paint(currentPicks(s, own, systemDark.value), s.accent, true);
}

/** Shows a theme without choosing it (hovering in the gallery, editing). Null goes back. */
export function previewTheme(picks: ThemePicks | null, accent = '') {
  previewing = picks;
  if (picks) paint(picks, accent, false);
  else if (settingsNow) applyAppearance(settingsNow.s, settingsNow.own);
}
