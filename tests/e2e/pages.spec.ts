import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, go, open, still, test } from './app.ts';

const PAGES = ['home', 'planner', 'select', 'rankings', 'agents', 'agents/sova', 'agents/hush', 'maps', 'maps/haven', 'maps/haven/plays', 'maps/haven/draw', 'saved', 'saved/parties', 'saved/plays', 'saved/games',
  'settings', 'themes', 'help', 'help/tours', 'help/keys', 'help/about', 'gallery'];

/** Text that is cut off without an ellipsis, or anything pushed past the window's sides. */
function layoutProblems() {
  const out: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('body *')) {
    if (el.closest('.tooltip, svg, .visually-hidden, [aria-hidden=true]')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const scrolls = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
    if (cs.overflowX !== 'visible' && !scrolls && cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 2) out.push(`cut off: ${el.tagName}.${el.className}`);
    // a box that scrolls sideways may hold wider things
    if (!el.parentElement?.closest('.heat-wrap') && (r.right > innerWidth + 1 || r.left < -1)) out.push(`off screen: ${el.tagName}.${el.className}`);
    // a tab's or a choice's label stays on one line
    if (el.matches('.tabs button, .segmented button')) {
      for (const n of el.childNodes) {
        if (n.nodeType !== Node.TEXT_NODE || !n.textContent!.trim()) continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        if (new Set([...rg.getClientRects()].map((q) => Math.round(q.top))).size > 1) out.push(`label wraps: ${el.textContent!.trim()}`);
      }
    }
  }
  // the Planner's role rows line up: every row's counts start at the same place (in each pair of
  // columns, when the roles go two to a row)
  const counts = [...document.querySelectorAll('.q-roles-grid .segmented')].map((e) => Math.round(e.getBoundingClientRect().left));
  const grid = document.querySelector('.q-roles-grid');
  const pairs = grid ? Math.max(1, Math.floor(getComputedStyle(grid).gridTemplateColumns.split(' ').length / 2)) : 1;
  if (new Set(counts).size > pairs) out.push('the role counts don’t line up');
  if (document.documentElement.scrollWidth > innerWidth) out.push('the page scrolls sideways');
  return [...new Set(out)];
}

/** Waits for the page's entrance and any answers being worked out, so it's measured where it rests. */
async function settled(page: Page) {
  await expect(page.locator('.spinner')).toHaveCount(0, { timeout: 20_000 });
  await still(page);
}

for (const [width, narrow] of [[1280, false], [1280, true], [800, false]] as const) {
  test(`every page lays out cleanly at ${width} px${narrow ? ' with a narrow sidebar' : ''}`, async ({ page, errors }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    if (narrow) {
      await page.getByRole('button', { name: 'Narrow the sidebar' }).click();
      await page.waitForTimeout(400);
    }
    for (const p of PAGES) {
      await go(page, p);
      await expect(page.locator('main h1').first(), p).toBeVisible();
      await settled(page);
      expect(await page.evaluate(layoutProblems), p).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
}

test('every page lays out cleanly with extra-large text and motion off', async ({ page, errors }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1024, height: 800 });
  await open(page, 'settings/appearance');
  await page.getByRole('combobox', { name: 'Text size' }).selectOption({ label: 'Extra large' });
  await page.getByRole('combobox', { name: 'Motion' }).selectOption({ label: 'Off' });
  await expect(page.locator('html')).toHaveAttribute('data-text', 'xl');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  for (const p of PAGES) {
    await go(page, p);
    await expect(page.locator('main h1').first(), p).toBeVisible();
    await settled(page);
    expect(await page.evaluate(layoutProblems), p).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('the Planner’s pickers and an open comp pass the accessibility check too', async ({ page, errors }) => {
  await open(page, 'planner');
  const found: string[] = [];
  const check = async (where: string, name: string) => {
    const r = await new AxeBuilder({ page }).include(where).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
    for (const v of r.violations) for (const n of v.nodes) found.push(`${name}: ${v.id} at ${n.target.join(' ')}`);
  };
  await page.getByRole('button', { name: /^Map: .*\. Change$/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await settled(page);
  await check('[role=dialog]', 'map picker');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Agents the team must play: choose' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await settled(page);
  await check('[role=dialog]', 'agent picker');
  await page.keyboard.press('Escape');
  await settled(page);
  for (const tab of ['Plays', 'Tips']) {
    await page.locator('.comp.open').getByRole('tab', { name: tab }).click();
    await check('.comp.open', `comp ${tab}`);
  }
  await page.getByRole('tab', { name: 'Agents' }).click();
  await page.locator('.agent-row').first().click();
  await check('.answers', 'agents tab');
  expect(found).toEqual([]);
  expect(errors).toEqual([]);
});

test('every page passes an automated accessibility check (WCAG AA: contrast, names, roles, headings)', async ({ page, errors }) => {
  test.setTimeout(180_000);
  await open(page);
  const found: string[] = [];
  for (const p of PAGES) {
    await go(page, p);
    await settled(page);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
    for (const v of r.violations) for (const n of v.nodes) found.push(`${p}: ${v.id} at ${n.target.join(' ')}: ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`);
  }
  expect(found).toEqual([]);
  expect(errors).toEqual([]);
});

test('a page that doesn’t exist, or an agent or map that doesn’t, says so and offers a way back', async ({ page, errors }) => {
  await open(page, 'agents/nobody');
  await expect(page.getByText('There’s no such agent')).toBeVisible();
  await page.getByRole('button', { name: 'See all agents' }).click();
  await expect(page.locator('main h1')).toHaveText('Agents');
  await go(page, 'maps/nowhere');
  await expect(page.getByText('There’s no such map')).toBeVisible();
  await go(page, 'nothing-here');
  await expect(page.locator('main h1').first()).toBeVisible();
  expect(errors).toEqual([]);
});
