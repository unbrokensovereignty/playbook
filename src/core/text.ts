/** Small text helpers: clean stored text, loose comparison for search, and joining lists in plain English. */

/** Unicode NFC, so "é" typed two ways compares equal. */
export const nfc = (s: unknown): string => (s == null ? '' : String(s)).normalize('NFC');

/** Collapses runs of whitespace and trims. */
export const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Clean text as stored: NFC, plain spaces, trimmed, without zero-width spaces. */
export const clean = (s: unknown): string => squash(nfc(s).replace(/[  ]/g, ' ').replace(/[​﻿]/g, ''));

/** The loosest comparison form, for search: lower case, no accents, plain quotes and dashes, single spaces. */
export const fold = (s: string): string => squash(
  nfc(s).normalize('NFD').replace(/\p{M}+/gu, '')
    .replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"').replace(/[‐‑‒–—―−]/g, '-')
    .toLocaleLowerCase('en-US'),
);

/** Text made safe to match literally inside a regular expression ("KAY/O", "A (Heaven)"). */
export const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** "A", "A and B", "A, B and C". */
export function listJoin(items: readonly string[], and = 'and'): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}
