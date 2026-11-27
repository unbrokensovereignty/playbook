// The sounds as the browser draws them: the gallery's level check renders every take of every cue
// of every set through the app's own bus, so a file that's silent, clips or runs on shows up here.
import { statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { APP_URL, expect, open, test } from './app.ts';

type Level = { peak: number; loud: number; length: number };
type Levels = Record<string, Record<string, Level & { quiet: number; takes: Level[] }>>;
const dB = (x: number) => 20 * Math.log10(x);
const SETS = ['clarity', 'felt', 'beacon'];
const ASSETS = resolve(import.meta.dirname, '../../assets/sounds');
/** A recording's size, which says which file a sound played. */
const size = (file: string) => statSync(join(ASSETS, `${file}.mp3`)).size;

/** Opens the gallery and draws every take of every sound of every set. */
async function levels(page: Page): Promise<Levels> {
  await open(page, 'gallery');
  await page.getByRole('button', { name: 'Check sound levels' }).click();
  const table = page.locator('.sound-levels');
  await expect(table).toBeVisible({ timeout: 45_000 });
  return JSON.parse((await table.getAttribute('data-levels'))!) as Levels;
}

test('every sound in every set is heard, never clips, ends in time, and keeps its place in the mix', async ({ page }) => {
  const lv = await levels(page);
  const mean = (set: string) => Object.values(lv).reduce((n, by) => n + dB(by[set]!.loud), 0) / Object.keys(lv).length;
  for (const set of SETS) {
    for (const [name, by] of Object.entries(lv)) {
      const l = by[set]!;
      for (const [i, t] of l.takes.entries()) {
        const what = `${set} ${name} take ${i + 1}`;
        expect(dB(t.loud), `${what} is heard`).toBeGreaterThan(-60);
        expect(dB(t.peak), `${what} peak`).toBeLessThan(-6);
        // a click is over well inside a second, and a ready plan or a save inside two and a half
        expect(t.length, `${what} length`).toBeLessThanOrEqual(name === 'ready' || name === 'saved' ? 2500 : 1300);
      }
    }
    // a set's results stand out over its clicks: louder than the quietest click
    const clicks = ['tap', 'tick', 'toggle', 'page', 'open', 'close', 'pick', 'unpick'].map((n) => lv[n]![set]!.quiet);
    for (const name of ['ready', 'saved']) expect(lv[name]![set]!.quiet, `${set} ${name}`).toBeGreaterThan(Math.min(...clicks));
  }
  // every set sits at about the same level, so changing set keeps the volume
  const means = SETS.map(mean);
  expect(Math.max(...means) - Math.min(...means), `the sets average ${means.map((m) => m.toFixed(1)).join(', ')} dB`).toBeLessThanOrEqual(2);
  // and about where the rest of the app's sound sits: the cues average near -32 dB on the meter
  for (const m of means) { expect(m).toBeGreaterThan(-36); expect(m).toBeLessThan(-26); }
});

test('playing every sound of every set raises no error', async ({ page }) => {
  await open(page, 'gallery');
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Sounds' }) });
  for (const set of SETS) {
    await page.evaluate(() => { location.hash = '#/settings'; });
    await page.getByLabel('Sound set').selectOption(set);
    await page.evaluate(() => { location.hash = '#/gallery'; });
    for (const b of await section.getByRole('button').filter({ hasNotText: 'Check sound levels' }).all()) await b.click();
  }
});

test('a browser that can’t decode the recordings stays quiet and keeps working', async ({ page }) => {
  await page.addInitScript(() => {
    BaseAudioContext.prototype.decodeAudioData = () => Promise.reject(new DOMException('Unable to decode audio data', 'EncodingError'));
  });
  await open(page, 'gallery');
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Sounds' }) });
  for (const b of await section.getByRole('button').filter({ hasNotText: 'Check sound levels' }).all()) await b.click();
  await page.getByRole('button', { name: 'Check sound levels' }).click();
  await expect(page.locator('.sound-levels')).toBeVisible({ timeout: 45_000 });
});

/** Notes the size of every recording that starts playing, from the moment the page opens. */
const listen = () => {
  const w = window as unknown as { started: number[]; decoded: number };
  w.started = [];
  w.decoded = 0;
  const size = new WeakMap<AudioBuffer, number>();
  const decode = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (this: BaseAudioContext, b: ArrayBuffer) {
    const n = b.byteLength;
    return decode.call(this, b).then((buf) => { size.set(buf, n); w.decoded++; return buf; });
  } as typeof decode;
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...a: Parameters<typeof start>) {
    const n = this.buffer ? size.get(this.buffer) : undefined;
    if (n && !(this.context instanceof OfflineAudioContext)) w.started.push(n);
    return start.apply(this, a);
  };
};

test('Agent select plays Clarity’s select for a teammate locked in, and a soft type for one taken out', async ({ page }) => {
  const pick = size('snd-sine/select'), unpick = ['type_01', 'type_02', 'type_03'].map((f) => size(`snd-sine/${f}`));
  await page.addInitScript(listen);
  await open(page, 'select');
  // closing the welcome dialog played the first sound, which decodes Clarity's 18 recordings
  await expect.poll(() => page.evaluate(() => (window as unknown as { decoded: number }).decoded), { timeout: 10_000 }).toBeGreaterThanOrEqual(18);
  const started = () => page.evaluate(() => { const w = window as unknown as { started: number[] }; const s = w.started; w.started = []; return s; });
  await started();
  const face = page.getByRole('group', { name: 'Click an agent your teammate locked in' }).getByRole('button').first();
  await face.click();
  expect(await started(), 'one sound for the pick').toEqual([pick]);
  await face.click();
  const out = await started();
  expect(out.length, 'one sound for taking it out').toBe(1);
  expect(unpick, 'a soft type').toContain(out[0]);
});

test('a sound plays with the click it goes with, not when the row it took away has finished leaving', async ({ page, errors }, info) => {
  // every sound that starts is noted with the page's clock
  await page.addInitScript(() => {
    const w = window as unknown as { started: number[] };
    w.started = [];
    for (const C of [OscillatorNode, AudioBufferSourceNode]) {
      const start = C.prototype.start;
      C.prototype.start = function (this: AudioScheduledSourceNode, ...a: Parameters<AudioScheduledSourceNode['start']>) { w.started.push(performance.now()); return start.apply(this, a); };
    }
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page, 'settings/data');
  // Omen won 9 of 11, so Your games offers Omen as a main
  const games = Array.from({ length: 11 }, (_, i) => ({ id: `g_omen${String(i).padStart(4, '0')}`, map: 'ascent', agent: 'omen', team: ['omen'], result: i < 9 ? 'win' : 'loss', note: '', played: Date.UTC(2026, 9, 1) + i * 60_000 }));
  const file = info.outputPath('games.json');
  writeFileSync(file, JSON.stringify({ kind: 'playbook-backup', format: 1, settings: { motion: 'full' }, themes: [], plans: [], parties: [], plays: [], games }));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Restore…' }).click()]);
  await chooser.setFiles(file);
  await page.getByRole('dialog', { name: 'Restore this backup?' }).getByRole('button', { name: 'Replace' }).click();
  await page.evaluate(() => { location.hash = '#/saved/games'; });
  const offer = page.locator('.game-offer');
  await expect(offer).toHaveCount(1);
  await page.waitForTimeout(600);
  await page.evaluate(() => { const w = window as unknown as { started: number[]; clicked: number }; w.started = []; addEventListener('click', () => { w.clicked = performance.now(); }, { capture: true, once: true }); });
  await offer.getByRole('button', { name: 'Mark as a main' }).click();
  await expect(offer).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Omen is one of your mains now' })).toBeVisible();
  const late = await page.evaluate(() => { const w = window as unknown as { started: number[]; clicked: number }; return w.started.map((t) => Math.round(t - w.clicked)); });
  expect(late.length).toBeGreaterThan(0);
  // the row leaves over 200 ms at Full: nothing may wait for that
  expect(Math.max(...late)).toBeLessThan(60);
  expect(errors).toEqual([]);
});

test('a tab that can only look taps for Mark as a main, since nothing is saved, and the tab that saves plays the saved sound', async ({ page, context, errors }, info) => {
  // the recordings' sizes say which file a sound played: Clarity's saved sound is SND's celebration
  const saved = size('snd-sine/celebration');
  await context.addInitScript(listen);
  await open(page, 'settings/data');
  // Omen won 9 of 11, so Your games offers Omen as a main
  const games = Array.from({ length: 11 }, (_, i) => ({ id: `g_omen${String(i).padStart(4, '0')}`, map: 'ascent', agent: 'omen', team: ['omen'], result: i < 9 ? 'win' : 'loss', note: '', played: Date.UTC(2026, 9, 1) + i * 60_000 }));
  const file = info.outputPath('games.json');
  writeFileSync(file, JSON.stringify({ kind: 'playbook-backup', format: 1, settings: {}, themes: [], plans: [], parties: [], plays: [], games }));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Restore…' }).click()]);
  await chooser.setFiles(file);
  await page.getByRole('dialog', { name: 'Restore this backup?' }).getByRole('button', { name: 'Replace' }).click();
  await page.evaluate(() => { location.hash = '#/saved/games'; });
  await expect(page.locator('.game-offer')).toHaveCount(1);

  const other = await context.newPage();
  other.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  other.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await other.goto(`${APP_URL}#/saved/games`);
  await expect(other.locator('.save-state')).toHaveText('Read-only');
  const offer = other.locator('.game-offer');
  await expect(offer).toHaveCount(1);
  const heard = async (p: Page, press: () => Promise<void>) => {
    // a first sound (the tab already open) decodes the recordings: wait for them, then listen to the press alone
    await p.getByRole('tab', { name: 'Plans' }).click();
    await p.getByRole('tab', { name: 'Your games' }).click();
    await expect.poll(() => p.evaluate(() => (window as unknown as { decoded: number }).decoded), { timeout: 10_000 }).toBeGreaterThanOrEqual(18);
    await p.evaluate(() => { (window as unknown as { started: number[] }).started = []; });
    await press();
    await p.waitForTimeout(500);
    return p.evaluate(() => (window as unknown as { started: number[] }).started);
  };
  const looking = await heard(other, () => offer.getByRole('button', { name: 'Mark as a main' }).click());
  await expect(other.locator('.toast').filter({ hasText: 'this tab can only look' })).toBeVisible();
  await expect(offer).toHaveCount(1);
  expect(looking.length, 'a sound for the press').toBeGreaterThan(0);
  expect(looking, 'no saved sound where nothing was saved').not.toContain(saved);

  await page.bringToFront();
  const saving = await heard(page, () => page.locator('.game-offer').getByRole('button', { name: 'Mark as a main' }).click());
  await expect(page.getByRole('status').filter({ hasText: 'Omen is one of your mains now' })).toBeVisible();
  expect(saving, 'the saved sound where it was saved').toContain(saved);
  expect(errors).toEqual([]);
});
