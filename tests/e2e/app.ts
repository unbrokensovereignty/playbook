/** Shared helpers for the end-to-end checks: open the built file, collect errors, find overlaps. */
import { expect, test as base, type Locator, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(import.meta.dirname, '../../dist');
// the build for the version in package.json, never a leftover file from another version
const { version } = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8')) as { version: string };
const file = `Playbook-v${version}.html`;
if (!existsSync(resolve(dist, file))) throw new Error(`Build the app first (npm run build): dist/${file} is missing.`);
export const APP_URL = 'file://' + resolve(dist, file);
export const APP_VERSION = version;

/** Every test fails if the page throws or logs an error. */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await use(errors);
    expect(errors).toEqual([]);
  },
});
export { expect };

/** Pages past the setup the app asks for when it's opened for the first time (each test starts with nothing saved). */
const welcomed = new WeakSet<Page>();

/**
 * Opens the app on a page. The first time, it asks how you play: skipped here, so tests start
 * from the usual settings, unless `setup` says the test answers it.
 */
export async function open(page: Page, hash = 'home', o: { setup?: boolean } = {}) {
  await page.goto(`${APP_URL}#/${hash}`);
  await ready(page);
  if (welcomed.has(page) || hash === 'selftest') return;
  welcomed.add(page);
  if (o.setup) return;
  const setup = page.getByRole('dialog', { name: 'Welcome to Playbook' });
  // from the keyboard, so the mouse isn't left over the page, where it would bring up a tooltip
  await setup.getByRole('button', { name: 'Skip' }).press('Enter');
  await expect(setup).toHaveCount(0);
  await still(page);
}

/** Reloads the page, as pressing F5 does, and waits until it's ready again. */
export async function reload(page: Page) {
  await page.reload();
  await ready(page);
}

/**
 * Waits until the page is drawn, is the tab that saves, and has stopped moving. Just after a
 * reload, the page being replaced can still hold the saving lock for a moment, and this one opens
 * read-only until it lets go; the banner that says so comes and goes above the page and moves
 * everything on it. Firefox now and then lost a click made just as the page opened, so the first
 * click waits for the page to stop moving too.
 */
async function ready(page: Page) {
  await page.waitForSelector('.shell');
  await expect(page.locator('.save-state')).not.toHaveText('Read-only', { timeout: 10_000 });
  await still(page);
}

/** Waits until everything that moves by itself has finished (a page sliding in, a card rising), and the next frame is drawn. */
export async function still(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations()
      .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity))
      .map((a) => a.finished.catch(() => {})));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

/** Puts focus on a control as if reached with Tab (the keyboard is in use, not the mouse), so Enter and Space go to it. */
export async function tabTo(page: Page, control: Locator) {
  await page.keyboard.press('Tab');
  await control.focus();
  await expect(control).toBeFocused();
}

/** Waits until every change has been written, so a reload that follows reads it back. */
export async function saved(page: Page) {
  await expect(page.locator('.save-state')).toHaveText('Saved');
}

export async function go(page: Page, hash: string) {
  await page.evaluate((h) => { location.hash = '#/' + h; }, hash);
  await page.waitForTimeout(300);
}

export interface Box { left: number; top: number; right: number; bottom: number }

/** Visible buttons whose boxes overlap the element matched by `sel`, leaving out its own contents. */
export function overlaps(page: Page, sel: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const m = document.querySelector(sel);
    if (!m) return [];
    const r = m.getBoundingClientRect(), hits: string[] = [];
    for (const b of document.querySelectorAll('button, a, input')) {
      if (m.contains(b) || b.contains(m) || getComputedStyle(b).visibility === 'hidden') continue;
      const q = b.getBoundingClientRect();
      if (!q.width || !q.height) continue;
      if (q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) hits.push((b.getAttribute('aria-label') ?? b.textContent ?? '').trim().slice(0, 40));
    }
    return hits;
  }, sel);
}
