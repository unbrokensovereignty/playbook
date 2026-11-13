/** Small helpers shared by every part of the app. Pure functions only. */

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** A finite number, or the fallback. */
export const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** A whole number ≥ 0, or 0. */
export const count = (v: unknown, max = Number.MAX_SAFE_INTEGER): number => clamp(Math.floor(num(v, 0)), 0, max);

export const round = (v: number, places = 0): number => {
  const f = 10 ** places;
  return Math.round(v * f) / f;
};

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

/** A random id: a short prefix plus 12 characters of randomness (e.g. "c_k3j9x0a1b2c3"). */
export function uid(prefix: string): string {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += (b % 36).toString(36);
  return `${prefix}_${Date.now().toString(36).slice(-3)}${s}`;
}

export type Rng = () => number;

/** A seeded random number generator (mulberry32), for games and tests that must repeat exactly. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A well-mixed 32-bit number from a whole number, the same every time: neighbors land far apart. */
export function hash32(n: number): number {
  let h = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A new array in random order (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export function pick<T>(items: readonly T[], rng: Rng = Math.random): T | undefined {
  return items.length ? items[Math.floor(rng() * items.length)] : undefined;
}

/** Picks one item with probability proportional to its weight (weights ≤ 0 are never picked). */
export function weightedPick<T>(items: readonly T[], weight: (x: T) => number, rng: Rng = Math.random): T | undefined {
  let total = 0;
  for (const x of items) total += Math.max(0, weight(x));
  if (total <= 0) return undefined;
  let r = rng() * total;
  for (const x of items) {
    r -= Math.max(0, weight(x));
    if (r < 0) return x;
  }
  return items[items.length - 1];
}

/** Numbers with thousands separators ("12,345"). */
export const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

/**
 * A number as typed. For a whole number, a comma, dot or space before three digits groups thousands
 * ("1,000", "1.000", "1 000"); with `decimals`, a comma is a decimal point ("0,85"). NaN when blank
 * or not a number.
 */
export function typedNumber(text: string, decimals = false): number {
  const t = text.trim();
  if (!t) return NaN;
  return Number(decimals ? t.replace(',', '.') : t.replace(/(\d)[,.\s'’](?=\d{3}(?!\d))/g, '$1'));
}

/** "1 plan", "3 plans", "1,200 teams". */
export function plural(n: number, one: string, many = one + 's'): string {
  return `${fmt(n)} ${Math.round(n) === 1 ? one : many}`;
}

/** A word's plural: "rushes", "catches", "days". */
export const manyOf = (word: string): string => (/(s|sh|ch|x|z)$/i.test(word) ? `${word}es` : /[^aeiou]y$/i.test(word) ? `${word.slice(0, -1)}ies` : `${word}s`);

/** "a" or "an", for the word that follows: "a sentinel", "an initiator". */
export const articleOf = (word: string): string => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/** A word with "a" or "an" before it: "a duelist", "an initiator". */
export const aWord = (word: string): string => `${articleOf(word)} ${word}`;

/** A unit after a number: "2 days" but "1 day", and "1 card a day". */
export const unitFor = (n: number, unit: string): string => (n === 1 ? unit.replace(/^(\p{L}+?)s\b/u, '$1') : unit);

/** A share in words: "half", "a quarter", "a third", or "30%". */
export function share(x: number): string {
  const words: [number, string][] = [[0.5, 'half'], [0.25, 'a quarter'], [1 / 3, 'a third'], [0.75, 'three quarters'], [0.125, 'an eighth']];
  return words.find(([v]) => Math.abs(v - x) < 1e-9)?.[1] ?? `${Math.round(x * 100)}%`;
}

/** A fraction as a whole percentage, for numbers and compact notes: 0.35 → "35%". In sentences, use `share()`. */
export const pct = (x: number): string => `${Math.round(x * 100)}%`;
/** A share rounded down ("79%" for 79.7%), for a share set against a threshold it mustn't seem to reach. */
export const pctDown = (x: number): string => `${Math.floor(Math.round(x * 10_000) / 100)}%`;

/** A small count in words: "three", "ten"; 11 and up stay as digits. */
export function countWord(n: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n);
}

/** A few seconds in words: "a second", "two seconds". */
export function secondsWord(ms: number): string {
  const n = Math.round(ms / 1000);
  return n === 1 ? 'a second' : `${countWord(n)} seconds`;
}

/** How many times as long or as much, in words: "once", "twice", "three times", "2.5 times". */
export const timesWord = (x: number): string => (x === 1 ? 'once' : x === 2 ? 'twice' : `${countWord(x)} times`);

/** Choices in a sentence: "Q", "Q or W", "Q, W or E". */
export function orList(items: readonly string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

/** A sentence's first letter in capitals: "three" → "Three". */
export const capitalize = (s: string): string => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** "3 min", "1 h 5 min", "45 s" for a duration in milliseconds. */
export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), rest = m % 60;
  return rest ? `${fmt(h)} h ${rest} min` : `${fmt(h)} h`;
}

/** A game's time, to the tenth of a second as its clock shows it: "4.8 s", "1 min 5.2 s". Each number keeps
 *  its unit on the same line (a no-break space), so a narrow stat never ends a line with a lone "s". */
export function fmtSeconds(ms: number): string {
  const tenths = Math.max(0, Math.round(ms / 100));
  const m = Math.floor(tenths / 600), s = ((tenths % 600) / 10).toFixed(1);
  return m ? `${fmt(m)}\u00a0min ${s}\u00a0s` : `${s}\u00a0s`;
}

/** Keys of an object that pass `keep`, safe against inherited properties. */
export function ownKeys(o: unknown, keep: (k: string) => boolean = () => true): string[] {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return [];
  return Object.keys(o).filter((k) => Object.prototype.hasOwnProperty.call(o, k) && keep(k));
}

export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export const clone = <T>(v: T): T => structuredClone(v);

/** Unique values, keeping the first of each (by key). */
export function uniqueBy<T>(items: readonly T[], key: (x: T) => string): T[] {
  const seen = new Set<string>(), out: T[] = [];
  for (const x of items) {
    const k = key(x);
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
}

export function sum(items: readonly number[]): number {
  let s = 0;
  for (const x of items) s += x;
  return s;
}

export function mean(items: readonly number[]): number {
  return items.length ? sum(items) / items.length : 0;
}
