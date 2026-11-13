/** Saving a file to the computer, picking one to open, copying text, and printing. */
import { render, type VNode } from 'preact';
import { toast } from './state.ts';
import { play } from './sound.ts';
import { keyOf } from '../core/dates.ts';
import { BUILT_IN_THEMES, DEFAULT_LIGHT, generateTheme, tokensCss } from '../core/theme.ts';

export function download(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The most we'll read from a chosen file. */
export const MAX_FILE = 50 * 1024 * 1024;

/** Asks for a file and reads it as text. Null when nothing was chosen; throws on a file too big to read. */
export function pickFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) { resolve(null); return; }
      if (f.size > MAX_FILE) { reject(new Error(`That file is over ${MAX_FILE / 1024 / 1024} MB, too big to be a Playbook file.`)); return; }
      f.arrayBuffer().then((b) => resolve({ name: f.name, text: new TextDecoder().decode(b) }), reject);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/** A file name with today's date: "Playbook backup 2026-10-24.json". */
export const datedName = (base: string, ext: string, now = new Date()): string => `${base} ${keyOf(now)}.${ext}`;

/** Copies text to the clipboard. False when the browser won't allow it. */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** Copies text and says how it went: `done` when it worked, or how to copy it by hand. */
export async function copyWithToast(text: string, done: string, failed = 'Copying didn’t work here. Select the text and copy it with Ctrl C.'): Promise<boolean> {
  if (await copyText(text)) { toast(done, { tone: 'good' }); return true; }
  play('error');
  toast(failed, { tone: 'bad', ms: 12_000 });
  return false;
}

/** Reads a file dropped on the page. Throws on one too big to read. */
export async function readFile(f: File): Promise<{ name: string; text: string }> {
  if (f.size > MAX_FILE) throw new Error(`That file is over ${MAX_FILE / 1024 / 1024} MB, too big to be a Playbook file.`);
  return { name: f.name, text: new TextDecoder().decode(await f.arrayBuffer()) };
}

let sheet: HTMLElement | null = null;

/**
 * Prints one sheet: it's drawn on its own, as the only thing on the paper (see base.css), in the
 * light theme's colors on white whatever the theme on screen, and put away once printing is done.
 */
export async function printSheet(node: VNode): Promise<void> {
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'print-sheet';
    const paper = BUILT_IN_THEMES.find((t) => t.id === DEFAULT_LIGHT)!;
    sheet.setAttribute('style', tokensCss(generateTheme({ ...paper, bg: '#FFFFFF', surface: '#FFFFFF', card: '#FFFFFF' })));
    document.body.appendChild(sheet);
    addEventListener('afterprint', () => {
      document.documentElement.classList.remove('printing');
      if (sheet) render(null, sheet);
    });
  }
  render(node, sheet);
  document.documentElement.classList.add('printing');
  // every picture drawn first, so none is missing from the paper
  await Promise.all([...sheet.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined)));
  window.print();
}
