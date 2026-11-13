import { expect, go, open, reload, still, test } from './app.ts';
import { AGENTS, agentById } from '../../src/core/kb/agents.ts';
import { featuresOf } from '../../src/core/kb/features.ts';
import { MAPS } from '../../src/core/kb/maps.ts';

const hush = agentById('hush')!;

test('Rankings: tier lists move with the rank, comps open, and the by-map table fills in', async ({ page, errors }) => {
  await open(page, 'rankings');
  const tierS = page.getByRole('list', { name: /^Tier S: / });
  await page.getByRole('combobox', { name: 'Rank' }).selectOption({ label: 'Iron' });
  await expect(page.locator('.rank-where')).toContainText('Iron');
  const iron = await tierS.getAttribute('aria-label');
  await page.getByRole('combobox', { name: 'Rank' }).selectOption({ label: 'Radiant' });
  await expect(page.locator('.rank-where')).toContainText('Radiant');
  await expect(tierS).not.toHaveAttribute('aria-label', iron ?? '');
  // agents with the same fit are told apart by what they add over the next best of their role
  await expect(page.locator('.tier-agent').first()).toHaveAttribute('data-tip', /, (\d+ ahead of [A-Z/]+, the next best [a-z]+,|about as good as [A-Z/]+) in their best comp\./i);
  // every agent is in exactly one tier
  const tiers = await page.locator('.tier-agents').evaluateAll((uls) => uls.map((u) => u.querySelectorAll('.tier-agent').length));
  expect(tiers.reduce((a, b) => a + b, 0)).toBe(AGENTS.length);
  // a role filter keeps only that role
  await page.getByRole('group', { name: 'Role' }).getByRole('button', { name: 'Controllers' }).click();
  expect(await page.locator('.tier-agent').count()).toBeLessThanOrEqual(8);
  await page.getByRole('group', { name: 'Role' }).getByRole('button', { name: 'All' }).click();
  // a map changes the list's heading
  await page.getByRole('combobox', { name: 'Map' }).selectOption({ label: 'Lotus' });
  await expect(page.locator('.rank-where')).toHaveText('Lotus, both sides, Radiant');
  await page.getByRole('tab', { name: 'Comps' }).click();
  await expect(page.locator('.comps > li').first().getByRole('heading', { name: 'Pros' })).toBeVisible();
  await page.getByRole('tab', { name: 'Agents by map' }).click();
  // every cell is worked out in the background, then shows a tier
  await expect(page.getByRole('cell', { name: 'Working it out' })).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole('cell', { name: /^Sova on Abyss: tier [SABCD], fit \d+$/ })).toBeVisible();
  // an agent opens its page
  await page.getByRole('button', { name: 'Sova', exact: true }).first().click();
  await expect(page.locator('main h1')).toHaveText('Sova');
  expect(errors).toEqual([]);
});

test('a fit that rests on very little says it’s less sure, and why', async ({ page, errors }) => {
  await open(page, 'rankings');
  await page.getByRole('combobox', { name: 'Map' }).selectOption({ label: 'Lotus' });
  await page.getByRole('group', { name: 'Side' }).getByRole('button', { name: 'Attack' }).click();
  await page.getByRole('combobox', { name: 'Rank' }).selectOption({ label: 'Gold' });
  await expect(page.locator('.rank-where')).toHaveText('Lotus, attack, Gold');
  // Hush's ranked numbers are from her first days, and her kit on Lotus has no play to check it yet
  const hush = page.locator('.tier-agent', { hasText: 'Hush' });
  await expect(hush.locator('.tier-agent-unsure')).toHaveText('less sure');
  for (const why of [/ This fit is less sure and could be off by about \d+, since /, /kit does on Lotus attack is judged from the abilities alone/, /from Hush’s first days/]) await expect(hush).toHaveAttribute('data-tip', why);
  // an agent with settled numbers isn't
  await expect(page.locator('.tier-agent-unsure')).toHaveCount(1);
  // Hush's page marks the fits too
  await go(page, 'agents/hush');
  await expect(page.getByLabel('Working it out')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('.by-rank-cell .fit.unsure').first()).toBeVisible();
  await expect(page.locator('main')).toContainText('marked less sure');
  // and so does the Planner's Agents tab, on the row and, opened, with why
  await page.getByRole('button', { name: 'Plan with Hush' }).click();
  await expect(page.locator('.answers[aria-busy=true], .working')).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole('tab', { name: 'Agents' }).click();
  const row = page.locator('.agent-row', { hasText: 'Hush' });
  await expect(row.locator('.unsure-tag')).toHaveText('less sure');
  await expect(row.locator('.tier')).toHaveAttribute('aria-label', /^Tier [SABCD], less sure$/);
  expect(await page.locator('.agent-row .unsure-tag').count()).toBe(1);
  // the tab's contents are still fading in: a click while they move can miss
  await still(page);
  await row.click();
  await expect(page.locator('.agent-rows li.open .agent-more')).toContainText(/This fit is less sure and could be off by about \d+, since /);
  expect(errors).toEqual([]);
});

test('Agents: each agent’s page has the kit, strengths, best maps and partners, and plans with them', async ({ page, errors }) => {
  await open(page, 'agents');
  for (const role of ['Duelists', 'Initiators', 'Controllers', 'Sentinels']) await expect(page.getByRole('heading', { name: new RegExp(`^${role}`) })).toBeVisible();
  await page.getByRole('button', { name: /^Killjoy/ }).click();
  await expect(page.locator('main h1')).toHaveText('Killjoy');
  for (const h of ['Abilities', 'Strengths', 'Best maps', 'Partners']) await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
  await expect(page.locator('.kit li')).toHaveCount(4);
  await expect(page.getByLabel('Working it out')).toHaveCount(0, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Plan with Killjoy' }).click();
  await expect(page.locator('main h1')).toHaveText('Planner');
  await expect(page.locator('.answers-head')).toContainText('with Killjoy');
  // Hush's page has her kit in the game's words, with its marks shown, and says where her numbers come from
  await go(page, 'agents/hush');
  await expect(page.locator('.kit li')).toHaveCount(5);
  await expect(page.locator('.kit')).toContainText('Displacement');
  await expect(page.locator('.kit .kit-fx.enemy').first()).toBeVisible();
  await expect(page.locator('.kit')).not.toContainText('</>');
  await expect(page.locator('main')).toContainText('first days');
  await expect(page.locator('main')).toContainText('None yet');
  await expect(page.locator('main')).not.toContainText('estimate');
  expect(errors).toEqual([]);
});

test('Maps: the minimap zooms and moves, its callouts can be hidden, and each side has its tips, best comps and plays', async ({ page, errors }) => {
  await open(page, 'maps');
  await expect(page.getByRole('heading', { name: 'In the pool' })).toBeVisible();
  await page.getByRole('button', { name: /^Ascent/ }).click();
  await expect(page.locator('main h1')).toHaveText('Ascent');
  const map = page.getByRole('group', { name: /^Minimap of Ascent/ });
  await expect(map).toHaveAccessibleName(/^Minimap of Ascent with callouts\. Zoom with plus and minus/);
  await expect(map.locator('.minimap-label').first()).toBeVisible();
  // a dot on every callout, on by default
  const dots = map.locator('.minimap-dot');
  await expect(dots).toHaveCount(await map.locator('.minimap-label').count());
  await page.locator('label.toggle', { hasText: 'Dots on callouts' }).click();
  await expect(dots).toHaveCount(0);
  await page.locator('label.toggle', { hasText: 'Dots on callouts' }).click();
  await expect(dots.first()).toBeVisible();
  // the names grow with their size
  const label = map.locator('.minimap-label').first();
  const before = (await label.boundingBox())!.height;
  await page.getByRole('group', { name: 'Callout name size' }).getByRole('button', { name: 'Extra large' }).click();
  await expect.poll(async () => (await label.boundingBox())!.height).toBeGreaterThan(before * 1.3);
  await page.getByRole('group', { name: 'Callout name size' }).getByRole('button', { name: 'Medium' }).click();
  // zoom with the buttons and the keys, move with the arrows, and back out
  const stage = map.locator('.minimap-stage');
  await page.getByRole('button', { name: 'Zoom in' }).first().click();
  await expect(map).toHaveClass(/zoomed/);
  await map.focus();
  await page.keyboard.press('0');
  await expect(map).not.toHaveClass(/zoomed/);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await expect(map).toHaveClass(/zoomed/);
  const at = await stage.getAttribute('style');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => stage.getAttribute('style')).not.toBe(at);
  await page.getByRole('button', { name: 'Show the whole map' }).first().click();
  await expect(map).not.toHaveClass(/zoomed/);
  await page.locator('label.toggle', { hasText: 'Show callouts' }).click();
  await expect(page.getByRole('switch', { name: 'Show callouts' })).not.toBeChecked();
  await expect(map).toHaveAccessibleName(/^Minimap of Ascent\. /);
  await expect(map.locator('.minimap-label')).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Tips for attack' })).toBeVisible();
  await expect(page.locator('.comps > li')).toHaveCount(5, { timeout: 20_000 });
  await page.locator('.map-side').getByRole('button', { name: 'Defense' }).click();
  await expect(page.getByRole('list', { name: 'Tips for defense' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Plays', exact: true })).toBeVisible();
  // a site's Plan button asks about that site
  await page.getByRole('button', { name: 'Plan for B site' }).click();
  await expect(page.locator('.answers-head h2')).toHaveText('Ascent, B site');
  expect(errors).toEqual([]);
});

test('Maps: every mark on each minimap sits on its spot, and the plant spots show and hide with their switch', async ({ page, errors }) => {
  await open(page, 'maps');
  for (const m of MAPS) {
    await go(page, `maps/${m.id}`);
    const map = page.getByRole('group', { name: new RegExp(`^Minimap of ${m.name}`) });
    const svg = (await map.locator('svg').first().boundingBox())!;
    // where each mark is drawn, as a share of the map, against where it's placed
    const drawn = await map.locator('g.feature').evaluateAll((gs) => gs.map((g) => {
      const r = g.querySelector('.feature-mark')!.getBoundingClientRect();
      return { about: g.querySelector('title')!.textContent!, x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }));
    const placed = featuresOf(m.id);
    expect(drawn.length, `${m.name}: every mark is drawn`).toBe(placed.length);
    for (const f of placed) {
      const d = drawn.find((x) => x.about === f.about)!;
      expect(Math.hypot((d.x - svg.x) / svg.width - f.at[0], (d.y - svg.y) / svg.height - f.at[1]), `${m.name}: ${f.about}`).toBeLessThan(0.01);
    }
  }
  const plants = page.locator('g.feature.plant, g.feature.safeplant');
  await expect(plants).toHaveCount(4);
  await page.locator('label.toggle', { hasText: 'Plant spots' }).click();
  await expect(plants).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'What the marks mean' })).not.toContainText('plant');
  await page.locator('label.toggle', { hasText: 'Plant spots' }).click();
  await expect(plants).toHaveCount(4);
  await expect(page.getByRole('list', { name: 'What the marks mean' })).toContainText('Default plant');
  expect(errors).toEqual([]);
});

test(`Home tells of ${hush.name} before the release day, and that ${hush.name} is new after it`, async ({ page, errors }) => {
  const day = (key: string, add: number) => {
    const d = new Date(`${key}T12:00:00`);
    d.setDate(d.getDate() + add);
    return d;
  };
  await page.clock.setFixedTime(day(hush.released, -3));
  await open(page, 'home');
  await expect(page.getByRole('heading', { name: new RegExp(`^${hush.name} arrives on `) })).toBeVisible();
  await page.clock.setFixedTime(day(hush.released, 2));
  await reload(page);
  await expect(page.getByRole('heading', { name: `${hush.name} is new` })).toBeVisible();
  await page.getByRole('button', { name: `About ${hush.name}` }).click();
  await expect(page.getByRole('heading', { level: 1, name: hush.name, exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Settings: light or dark is applied at once and kept, and a theme of your own can be made', async ({ page, errors }) => {
  await open(page, 'settings');
  const html = page.locator('html');
  await page.getByRole('combobox', { name: 'Light or dark' }).selectOption({ label: 'Always dark' });
  await expect(html).toHaveAttribute('data-base', 'dark');
  await page.getByRole('combobox', { name: 'Light or dark' }).selectOption({ label: 'Always light' });
  await expect(html).toHaveAttribute('data-base', 'light');
  await reload(page);
  await expect(html).toHaveAttribute('data-base', 'light');
  await go(page, 'themes');
  await page.getByRole('button', { name: 'New theme' }).click();
  const dialog = page.getByRole('dialog', { name: 'Theme editor' });
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Night market');
  await dialog.getByRole('group', { name: 'Light or dark' }).getByRole('button', { name: 'Dark' }).click();
  await dialog.getByRole('button', { name: 'Save theme' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Yours' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Night market In use' })).toHaveAttribute('aria-pressed', 'true');
  await expect(html).toHaveAttribute('data-base', 'dark');
  expect(errors).toEqual([]);
});
