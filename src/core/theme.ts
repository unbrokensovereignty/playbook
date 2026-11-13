/**
 * Themes. A theme is a handful of picks (light or dark, background, surface, card, accent); every
 * other color is generated from them in OKLCH, and text colors are nudged until they're readable.
 * Built-in themes and your own themes go through the same generator, so they behave the same.
 */
import { clamp, isRecord } from './util.ts';

// ---------------------------------------------------------------- color math

export interface Rgb { r: number; g: number; b: number }
export interface Oklch { l: number; c: number; h: number }

export function parseHex(s: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return null;
  let h = m[1] as string;
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export const isHex = (s: unknown): s is string => typeof s === 'string' && parseHex(s) !== null;

export function toHex(c: Rgb): string {
  const x = (v: number) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0');
  return `#${x(c.r)}${x(c.g)}${x(c.b)}`.toUpperCase();
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

export function toOklch(c: Rgb): Oklch {
  const r = toLinear(c.r), g = toLinear(c.g), b = toLinear(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  const h = C < 1e-6 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c: C, h };
}

function rawRgb(o: Oklch): Rgb {
  const A = o.c * Math.cos((o.h * Math.PI) / 180), B = o.c * Math.sin((o.h * Math.PI) / 180);
  const l = (o.l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (o.l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (o.l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

const inGamut = (c: Rgb) => [c.r, c.g, c.b].every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH to sRGB, lowering chroma until the color fits. */
export function fromOklch(o: Oklch): Rgb {
  const L = clamp(o.l, 0, 1);
  let c = raw(L, o.c, o.h);
  if (inGamut(c)) return c;
  let lo = 0, hi = o.c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(raw(L, mid, o.h))) lo = mid; else hi = mid;
  }
  c = raw(L, lo, o.h);
  return { r: clamp(c.r, 0, 1), g: clamp(c.g, 0, 1), b: clamp(c.b, 0, 1) };
}
const raw = (l: number, c: number, h: number) => rawRgb({ l, c, h });

export const oklchHex = (o: Oklch): string => toHex(fromOklch(o));
const lch = (hex: string): Oklch => toOklch(parseHex(hex) ?? { r: 0, g: 0, b: 0 });

/** WCAG relative luminance and contrast ratio. */
export function luminance(hex: string): number {
  const c = parseHex(hex) ?? { r: 0, g: 0, b: 0 };
  return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b);
}
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Mixes two colors in OKLab (t = 0 gives a, 1 gives b). */
export function mix(a: string, b: string, t: number): string {
  const p = lch(a), q = lch(b);
  const ax = p.c * Math.cos((p.h * Math.PI) / 180), ay = p.c * Math.sin((p.h * Math.PI) / 180);
  const bx = q.c * Math.cos((q.h * Math.PI) / 180), by = q.c * Math.sin((q.h * Math.PI) / 180);
  const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
  return oklchHex({ l: p.l + (q.l - p.l) * t, c: Math.hypot(x, y), h: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360 });
}

/**
 * `fg` adjusted (lighter or darker, same hue) until it reaches `min` contrast against every
 * background in `bgs`. Returns the color and whether it had to change.
 */
export function readable(fg: string, bgs: readonly string[], min: number): { color: string; nudged: boolean } {
  const ok = (c: string) => bgs.every((b) => contrast(c, b) >= min);
  if (ok(fg)) return { color: toHex(parseHex(fg) ?? { r: 0, g: 0, b: 0 }), nudged: false };
  const o = lch(fg);
  // go the way that gives more contrast: darker on light backgrounds, lighter on dark ones
  const darkBg = bgs.reduce((s, b) => s + luminance(b), 0) / Math.max(1, bgs.length) < 0.18;
  const end = darkBg ? 1 : 0;
  let lo = o.l, hi = end, best = oklchHex({ ...o, l: end });
  if (!ok(best)) return { color: darkBg ? '#FFFFFF' : '#000000', nudged: true };
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2, c = oklchHex({ ...o, l: mid });
    if (ok(c)) { best = c; hi = mid; } else lo = mid;
  }
  return { color: best, nudged: true };
}

// ---------------------------------------------------------------- themes

export type Base = 'light' | 'dark';

/** What a theme is made of. `bg2` is the second color of a gradient background ('' for solid). */
export interface ThemePicks { id: string; name: string; base: Base; bg: string; bg2: string; surface: string; card: string; accent: string }

export const BUILT_IN_THEMES: readonly ThemePicks[] = [
  { id: 'paper', name: 'Paper', base: 'light', bg: '#ECEEF1', bg2: '', surface: '#F8F9FB', card: '#FFFEF8', accent: '#2F63D0' },
  { id: 'lamp', name: 'Lamp', base: 'dark', bg: '#121519', bg2: '', surface: '#1A1E24', card: '#20252C', accent: '#86A8F3' },
  { id: 'ash', name: 'Ash', base: 'light', bg: '#E4E4E2', bg2: '', surface: '#F3F3F1', card: '#FFFFFF', accent: '#5A55D2' },
  { id: 'onyx', name: 'Onyx', base: 'dark', bg: '#09090A', bg2: '', surface: '#131315', card: '#1B1B1E', accent: '#A597FF' },
  { id: 'sepia', name: 'Sepia', base: 'light', bg: '#E9DDC7', bg2: '', surface: '#F4ECDC', card: '#FBF6EA', accent: '#9A5A2C' },
  { id: 'forest', name: 'Forest', base: 'dark', bg: '#0E1913', bg2: '', surface: '#14231A', card: '#1B2D22', accent: '#7CC99B' },
  { id: 'ocean', name: 'Ocean', base: 'dark', bg: '#0A1A2A', bg2: '#0D3140', surface: '#10253A', card: '#163049', accent: '#5BC7DF' },
  { id: 'dusk', name: 'Dusk', base: 'dark', bg: '#1A1230', bg2: '#3B1C3E', surface: '#221938', card: '#2B2045', accent: '#F09BC1' },
  { id: 'sunrise', name: 'Sunrise', base: 'light', bg: '#FFE2C6', bg2: '#FFCAD8', surface: '#FFF6EE', card: '#FFFDF8', accent: '#C7462F' },
  { id: 'contrast', name: 'High contrast', base: 'dark', bg: '#000000', bg2: '', surface: '#000000', card: '#0A0A0A', accent: '#FFD60A' },
];
export const DEFAULT_LIGHT = 'paper', DEFAULT_DARK = 'lamp';

/** Accent colors offered in Settings (the theme's own accent is the default). */
export const ACCENTS: readonly { name: string; hex: string }[] = [
  { name: 'Ink blue', hex: '#2F63D0' }, { name: 'Clay', hex: '#B85C38' }, { name: 'Plum', hex: '#8C4FC2' }, { name: 'Teal', hex: '#12877F' },
  { name: 'Rose', hex: '#C73E6B' }, { name: 'Olive', hex: '#6D7F1C' }, { name: 'Slate', hex: '#4F6479' }, { name: 'Gold', hex: '#B7860B' },
];

/** The colors a theme gives the interface, as CSS custom properties (without the leading --). */
export interface Tokens { [name: string]: string }

export interface GeneratedTheme { tokens: Tokens; scheme: Base; nudged: string[] }

/** Colors that mean something: good and bad news, a warning, and the five tiers (S down to D). */
const MEANING_HUES = {
  good: '#2E9D5B', warn: '#D89614', bad: '#D64545',
  'tier-s': '#D9534F', 'tier-a': '#E07B2E', 'tier-b': '#C9A20E', 'tier-c': '#4FA14A', 'tier-d': '#4A87C9',
} as const;

/** Every color of the interface from a theme's picks (and an optional accent override). */
export function generateTheme(p: ThemePicks, accentOverride = ''): GeneratedTheme {
  const dark = p.base === 'dark';
  const nudged: string[] = [];
  const fix = (name: string, fg: string, bgs: string[], min: number) => {
    const r = readable(fg, bgs, min);
    if (r.nudged) nudged.push(name);
    return r.color;
  };
  const bg = toHex(parseHex(p.bg) ?? { r: 0, g: 0, b: 0 }), bg2 = p.bg2 && isHex(p.bg2) ? toHex(parseHex(p.bg2)!) : bg;
  const surface = toHex(parseHex(p.surface) ?? parseHex(bg)!), card = toHex(parseHex(p.card) ?? parseHex(surface)!);
  const accentPick = isHex(accentOverride) ? accentOverride : p.accent;
  const surf = lch(surface);
  // text is a near-neutral in the surface's hue
  const inkBase = oklchHex({ l: dark ? 0.94 : 0.23, c: Math.min(0.02, surf.c + 0.01), h: surf.h });
  const onSurfaces = [surface, card, bg, bg2];
  const text = fix('text', inkBase, onSurfaces, 7);
  // a high-contrast theme (near black and white) gets lines and shading strong enough to see
  const hc = contrast(text, surface) >= 18;
  // the faintest text still reads at 4.5:1 (WCAG AA), even on the shaded panels
  const shade = mix(surface, text, hc ? 0.1 : 0.045), shade2 = mix(surface, text, hc ? 0.24 : 0.09);
  const accent = fix('accent', accentPick, [surface, card], 3);
  const accentSoft = mix(surface, accent, dark ? 0.22 : 0.14);
  const text2 = fix('text2', mix(text, surface, 0.3), [surface, card, bg, bg2, shade2, accentSoft], 4.5);
  const text3 = fix('text3', mix(text, surface, 0.5), [surface, card, shade, accentSoft], 4.5);
  const accentText = fix('accent-text', accent, [surface, card, accentSoft], 4.5);
  const onAccent = contrast('#FFFFFF', accent) >= contrast('#111111', accent) ? '#FFFFFF' : '#111111';
  const t: Tokens = {
    bg, bg2, surface, card,
    'surface-2': shade,
    'surface-3': shade2,
    line: mix(surface, text, hc ? 0.4 : 0.14),
    'line-strong': mix(surface, text, hc ? 0.6 : 0.26),
    text, text2, text3,
    accent, 'accent-text': accentText,
    'on-accent': fix('on-accent', onAccent, [accent], 4.5),
    'accent-soft': accentSoft,
    'accent-line': mix(surface, accent, 0.45),
    'card-text': fix('card-text', text, [card], 7),
    focus: accentText,
    shadow: dark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(22, 30, 46, 0.12)',
  };
  for (const [name, hue] of Object.entries(MEANING_HUES)) {
    const base = dark ? mix(hue, '#FFFFFF', 0.18) : hue;
    t[name] = fix(name, base, [surface, card], 3);
    t[`${name}-soft`] = mix(surface, t[name] as string, dark ? 0.22 : 0.14);
    t[`${name}-text`] = fix(`${name}-text`, t[name] as string, [surface, card, t[`${name}-soft`] as string], 4.5);
    t[`on-${name}`] = contrast('#FFFFFF', t[name] as string) >= 4.5 ? '#FFFFFF' : fix(`on-${name}`, '#111111', [t[name] as string], 4.5);
  }
  return { tokens: t, scheme: p.base, nudged };
}

/** The tokens as CSS declarations for a :root block. */
export const tokensCss = (g: GeneratedTheme): string =>
  `color-scheme: ${g.scheme};\n` + Object.entries(g.tokens).map(([k, v]) => `--${k}: ${v};`).join('\n');

// ---------------------------------------------------------------- your themes

export const MAX_THEMES = 40;

export function sanitizeTheme(x: unknown): ThemePicks | null {
  if (!isRecord(x)) return null;
  const base: Base = x.base === 'dark' ? 'dark' : 'light';
  if (!isHex(x.bg) || !isHex(x.surface) || !isHex(x.card) || !isHex(x.accent)) return null;
  const name = typeof x.name === 'string' ? x.name.trim().slice(0, 40) : '';
  const id = typeof x.id === 'string' && /^[\w-]{1,40}$/.test(x.id) ? x.id : '';
  const h = (v: string) => toHex(parseHex(v)!);
  return { id, name: name || 'My theme', base, bg: h(x.bg), bg2: isHex(x.bg2) ? h(x.bg2) : '', surface: h(x.surface), card: h(x.card), accent: h(x.accent) };
}

/** What every theme code starts with, so a pasted code is easy to tell from other text. */
export const THEME_CODE_PREFIX = 'PLAYBOOK-THEME:';

/** A short code to share a theme. */
export function themeCode(p: ThemePicks): string {
  const hex = (v: string) => v.replace('#', '');
  const body = [p.base === 'dark' ? 'd' : 'l', hex(p.bg), hex(p.bg2 || ''), hex(p.surface), hex(p.card), hex(p.accent), p.name].join('|');
  const bytes = new TextEncoder().encode(body);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return THEME_CODE_PREFIX + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Reads a theme code (surrounding spaces and quotes are fine). Returns null when it isn't one. */
export function parseThemeCode(code: string): ThemePicks | null {
  const s = code.trim().replace(/^["'“”]+|["'“”]+$/g, '');
  if (!s.startsWith(THEME_CODE_PREFIX)) return null;
  try {
    const b64 = s.slice(THEME_CODE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const body = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
    const [base, bg, bg2, surface, card, accent, ...name] = body.split('|');
    const hx = (v: string | undefined) => (v ? '#' + v : '');
    return sanitizeTheme({ id: '', name: name.join('|'), base: base === 'd' ? 'dark' : 'light', bg: hx(bg), bg2: hx(bg2), surface: hx(surface), card: hx(card), accent: hx(accent) });
  } catch {
    return null;
  }
}

/** Finds a theme by id among the built-in and your own, falling back to the default for the base. */
export function findTheme(id: string, own: readonly ThemePicks[], base: Base): ThemePicks {
  const t = BUILT_IN_THEMES.find((x) => x.id === id) ?? own.find((x) => x.id === id);
  if (t && t.base === base) return t;
  return BUILT_IN_THEMES.find((x) => x.id === (base === 'dark' ? DEFAULT_DARK : DEFAULT_LIGHT)) as ThemePicks;
}
