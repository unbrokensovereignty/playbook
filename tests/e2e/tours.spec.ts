import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { APP_URL, expect, go, open, reload, saved, still, test } from './app.ts';
import { TOURS, tourById } from '../../src/ui/tours/list.ts';
import { capitalize, countWord } from '../../src/core/util.ts';

/** The step on screen once it has arrived: its count line, whether its target is missing, and whether the card covers the spotlight. */
async function stepNow(page: Page) {
  await expect(page.locator('.tour.on')).toBeVisible();
  await page.waitForTimeout(300);
  // then until the card and the spotlight stop moving: a scroll to the target can take longer than that
  let last = '';
  await expect.poll(async () => {
    const now = await page.evaluate(() => JSON.stringify(['.tour-card', '.tour-spot'].map((q) => {
      const r = document.querySelector(q)!.getBoundingClientRect();
      return [r.left, r.top, r.width, r.height].map(Math.round);
    })));
    const same = now === last;
    last = now;
    return same;
  }, { intervals: [100] }).toBe(true);
  return page.evaluate(() => {
    const card = document.querySelector('.tour-card')!.getBoundingClientRect();
    const spot = document.querySelector('.tour-spot')!;
    const s = spot.getBoundingClientRect();
    const lit = !spot.classList.contains('none');
    return {
      count: document.querySelector('.tour-count')!.textContent ?? '',
      missing: !!document.querySelector('.tour-look'),
      lit,
      covers: lit && card.left < s.right - 2 && card.right > s.left + 2 && card.top < s.bottom - 2 && card.bottom > s.top + 2,
      focused: document.activeElement?.classList.contains('tour-card') ?? false,
    };
  });
}

test('Home offers the first steps once, and Not now puts it away for good', async ({ page, errors }) => {
  await open(page);
  const offer = page.getByRole('complementary', { name: 'Take the tour' });
  await expect(offer).toBeVisible();
  await expect(offer).toContainText(`${capitalize(countWord(tourById('first')!.steps.length))} quick steps`);
  await offer.getByRole('button', { name: 'Not now' }).click();
  await expect(offer).toHaveCount(0);
  await saved(page);
  await reload(page);
  await expect(page.locator('.home')).toBeVisible();
  await expect(offer).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a second tab offers the tour only once it takes over saving', async ({ page, context, errors }) => {
  const offer = (p: Page) => p.getByRole('complementary', { name: 'Take the tour' });
  await open(page);
  await expect(offer(page)).toBeVisible();
  const other = await context.newPage();
  other.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  other.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await other.goto(`${APP_URL}#/home`);
  await expect(other.locator('.save-state')).toHaveText('Read-only');
  await expect(other.locator('.home')).toBeVisible();
  await expect(offer(other)).toHaveCount(0);
  await other.getByRole('button', { name: 'Use this tab instead' }).click();
  await expect(other.locator('.save-state')).not.toHaveText('Read-only');
  await expect(offer(other)).toBeVisible();
  // the first tab is the read-only one now
  await expect(page.locator('.save-state')).toHaveText('Read-only');
  await expect(offer(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('every tour runs to the end with the keyboard, each step lit and clear of its card', async ({ page, errors }) => {
  test.setTimeout(120_000);
  await open(page, 'help/tours');
  for (const t of TOURS) {
    await page.locator(`#start-tour-${t.id}`).click();
    for (let i = 0; i < t.steps.length; i++) {
      const s = await stepNow(page);
      const where = `${t.name}, step ${i + 1}`;
      expect(s.count, where).toBe(`${t.name} · ${i + 1} of ${t.steps.length}`);
      expect(s.missing, `${where}: its target isn't on screen`).toBe(false);
      expect(s.lit, where).toBe(!!t.steps[i]!.target);
      expect(s.covers, `${where}: the card covers what it points at`).toBe(false);
      expect(s.focused, `${where}: the card has focus`).toBe(true);
      await page.keyboard.press('Space');
    }
    await expect(page.locator('.tour')).toHaveCount(0);
    await go(page, 'help/tours');
  }
  // every tour is ticked off, and offers a replay
  await expect(page.locator('.tour-done.on')).toHaveCount(TOURS.length);
  await expect(page.getByRole('button', { name: /^Replay the / })).toHaveCount(TOURS.length);
  expect(errors).toEqual([]);
});

test('a tour goes back, ends with Esc, keeps the page from being clicked, and ends when you leave its page', async ({ page, errors }) => {
  await open(page, 'help/tours');
  await page.locator('#start-tour-start').click();
  const of = tourById('start')!.steps.length;
  expect((await stepNow(page)).count).toBe(`Getting started · 1 of ${of}`);
  // two quick presses still show every step
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  expect((await stepNow(page)).count).toBe(`Getting started · 2 of ${of}`);
  await page.keyboard.press('Space');
  expect((await stepNow(page)).count).toBe(`Getting started · 3 of ${of}`);
  await page.keyboard.press('ArrowLeft');
  expect((await stepNow(page)).count).toBe(`Getting started · 2 of ${of}`);
  await expect(page).toHaveURL(/#\/home$/);
  // a click on the page lands on the tour's cover, not on the map under it
  await page.locator('.home-maps .map-tile').first().click({ force: true });
  await expect(page).toHaveURL(/#\/home$/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.tour')).toHaveCount(0);
  // not finished, so not ticked off
  await go(page, 'help/tours');
  await expect(page.locator('.tour-done.on')).toHaveCount(0);

  await page.locator('#start-tour-rankings').click();
  await stepNow(page);
  await go(page, 'maps');
  await expect(page.locator('.tour')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('Replay it any time from Help → Tours');

  // so does going back before the tour's page has come up
  await go(page, 'help/tours');
  await page.locator('#start-tour-plan').click();
  await page.goto(`${APP_URL}#/help/tours`);
  await page.waitForTimeout(2500);
  await expect(page.locator('.tour')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/help\/tours$/);
  expect(errors).toEqual([]);
});

test('the search starts a tour, and a dialog over it pauses it', async ({ page, errors }) => {
  await open(page, 'saved');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('Tour: Rankings');
  await page.keyboard.press('Enter');
  expect((await stepNow(page)).count).toBe('Rankings · 1 of 3');
  await expect(page).toHaveURL(/#\/rankings$/);
  await page.keyboard.press('Control+k');
  await expect(page.locator('.tour.paused')).toHaveCount(1);
  // the search has the keys while it's open
  await page.keyboard.press('Escape');
  await expect(page.locator('.palette')).toHaveCount(0);
  expect((await stepNow(page)).count).toBe('Rankings · 1 of 3');
  await page.getByRole('button', { name: 'Next' }).click();
  expect((await stepNow(page)).count).toBe('Rankings · 2 of 3');
  await page.getByRole('button', { name: 'End the tour (Esc)' }).click();
  await expect(page.locator('.tour')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('tours fit a small window, with reduced motion', async ({ page, errors }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 800, height: 600 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'help/tours');
  for (const id of ['plan', 'browse']) {
    const t = tourById(id)!;
    await page.locator(`#start-tour-${id}`).click();
    for (let i = 0; i < t.steps.length; i++) {
      const s = await stepNow(page);
      expect(s.missing, `${t.name}, step ${i + 1}`).toBe(false);
      const box = (await page.locator('.tour-card').boundingBox())!;
      expect(box.x >= 0 && box.y >= 0 && box.x + box.width <= 800 && box.y + box.height <= 600, `${t.name}, step ${i + 1}: the card is off screen`).toBe(true);
      await page.keyboard.press('Space');
    }
    await go(page, 'help/tours');
  }
  expect(errors).toEqual([]);
});

test('the tour card passes the accessibility check', async ({ page, errors }) => {
  await open(page, 'help/tours');
  await page.locator('#start-tour-plan').click();
  await stepNow(page);
  await still(page);
  const r = await new AxeBuilder({ page }).include('.tour-card').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  expect(r.violations.flatMap((v) => v.nodes.map((n) => `${v.id} at ${n.target.join(' ')}`))).toEqual([]);
  await expect(page.getByRole('dialog', { name: tourById('plan')!.steps[0]!.title })).toBeVisible();
  expect(errors).toEqual([]);
});
