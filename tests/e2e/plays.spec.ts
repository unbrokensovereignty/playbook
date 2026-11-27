/** Plays: each map's page of plays, the replay, defense setups for each site, and plays you draw yourself. */
import AxeBuilder from '@axe-core/playwright';
import { go, open, reload, saved, tabTo, test, expect } from './app.ts';
import { PRO } from '../../src/core/kb/pro.ts';
import { agentById } from '../../src/core/kb/agents.ts';
import { MAPS } from '../../src/core/kb/maps.ts';
import { featuresOf } from '../../src/core/kb/features.ts';

test('a map’s plays have a page of their own, filled with the pros’ usual comp, and run like a replay', async ({ page, errors }) => {
  await open(page, 'maps/ascent');
  await page.getByRole('button', { name: 'See the plays' }).click();
  await expect(page.locator('main h1')).toHaveText('Plays on Ascent');
  await expect(page).toHaveURL(/#\/maps\/ascent\/plays$/);
  // filled with the pros' usual comp: every job goes to one of them
  await expect(page.getByRole('combobox', { name: 'Comp to fill the plays with' })).toHaveValue('pro0');
  const pros = PRO.ascent!.comps[0]!.map((id) => agentById(id)!.name);
  const card = page.locator('.play-card');
  for (const name of await card.locator('.step-agent b').allTextContents()) expect(pros).toContain(name);
  // the plays come in groups by kind
  for (const kind of ['Hits', 'Splits', 'Defaults']) await expect(page.getByRole('heading', { name: kind, exact: true })).toBeVisible();
  // the replay runs a moment at a time and stops at the last
  await card.getByRole('button', { name: 'Replay' }).click();
  const moments = card.getByRole('list', { name: 'Moments' }).getByRole('button');
  await expect(moments.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(moments.last()).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
  await expect(card.getByRole('button', { name: 'Replay' })).toBeVisible({ timeout: 5_000 });
  await expect(card.locator('.minimap .throw').first()).toBeAttached();
  // a moment chosen by hand shows the play up to then
  await moments.first().click();
  await expect(card.locator('.play-steps li.later').first()).toBeVisible();
  await card.getByRole('button', { name: 'Show all' }).click();
  await expect(card.locator('.play-steps li.later')).toHaveCount(0);
  // every site on defense has a stack, an early push and a setup for the retake
  await page.getByRole('group', { name: 'Side' }).getByRole('button', { name: 'Defense' }).click();
  for (const kind of ['Stacks', 'Pushes', 'Retake setups']) {
    const list = page.getByRole('listbox', { name: kind, exact: true });
    for (const site of ['A site', 'B site']) await expect(list.getByRole('option', { name: new RegExp(`^${site}`) })).toHaveCount(1);
  }
  // a site keeps to its plays and the whole map's
  await page.getByRole('group', { name: 'Site' }).getByRole('button', { name: 'B site' }).click();
  await expect(page.locator('.plays-index .play-kind', { hasText: 'A site' })).toHaveCount(0);
  // another comp fills them again
  const best = page.getByRole('combobox', { name: 'Comp to fill the plays with' });
  await best.selectOption({ index: 1 });
  await expect(page.locator('.plays-comp .team-icons')).toBeVisible();
  const r = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  expect(errors).toEqual([]);
});

test('draw a play on the minimap: it’s kept with your plans, filled like the built-in plays, and can be changed and deleted', async ({ page, errors }) => {
  await open(page, 'maps/haven/plays');
  await page.getByRole('button', { name: 'Draw a play' }).first().click();
  await expect(page.locator('main h1')).toHaveText('Draw a play');
  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeDisabled();
  await page.getByLabel('Name', { exact: true }).fill('C long fast');
  await page.getByRole('group', { name: 'Site' }).getByRole('button', { name: 'C' }).click();
  // step 1: a smoke, its route clicked on the map, and what it smokes
  const step = (n: number) => page.locator('.draw-step').nth(n - 1);
  await step(1).getByRole('button', { name: 'Smokes' }).click();
  const map = page.getByRole('group', { name: /^Drawing step 1 on the Haven minimap/ });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(step(1).locator('.draw-route .grow')).not.toHaveText(/No spots|Click the map/);
  await step(1).getByLabel('What they do').fill('Smoke C Garage and C Cubby.');
  // step 2, from the keyboard: two jobs and a route chosen from the list
  await page.getByRole('button', { name: 'Add a step' }).click();
  await step(2).getByRole('button', { name: 'Entry' }).click();
  await step(2).getByRole('button', { name: 'Flashes' }).click();
  await expect(step(2).getByRole('button', { name: 'Wall' })).toBeDisabled();
  await step(2).getByRole('combobox', { name: 'Add a spot to step 2' }).selectOption('C Long');
  await step(2).getByRole('combobox', { name: 'Add a spot to step 2' }).selectOption('C Site');
  await expect(step(2).locator('.draw-route .grow')).toHaveText('C Long → C Site');
  await step(2).getByLabel('What they do').fill('Flash C Site and take it together.');
  // the pros' usual comp fills it as you draw, and step 1's utility lands on the map (a smoke, or a
  // wall from a controller with one smoke for two spots)
  await expect(step(2).locator('.step-agent')).toHaveCount(2);
  await expect(page.locator('.draw-map :is(.throw-smoke, .throw-wall)').first()).toBeAttached();
  await save.click();
  // it opens among the map's plays, marked as yours
  await expect(page.locator('main h1')).toHaveText('Plays on Haven');
  const mine = page.getByRole('option', { name: /C long fast/ });
  await expect(mine).toHaveAttribute('aria-selected', 'true');
  await expect(mine).toContainText('Yours');
  await expect(page.getByRole('article', { name: 'C long fast' })).toContainText('Flash C Site and take it together.');
  // it's kept, and Saved lists it
  await reload(page);
  await open(page, 'saved/plays');
  const row = page.getByRole('list', { name: 'Plays you drew' }).getByRole('listitem');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Haven, attack, C site hit');
  // the Planner fills it with its comps, beside the built-in plays
  await page.evaluate(() => { location.hash = '#/maps/haven'; });
  await page.getByRole('button', { name: 'Plan for Haven' }).click();
  const first = page.locator('.comps > li').first();
  await first.getByRole('tab', { name: 'Plays' }).click({ timeout: 30_000 });
  await expect(first.getByRole('option', { name: /C long fast/ })).toBeVisible();
  // change it, then delete it, and undo that
  await open(page, 'saved/plays');
  await page.getByRole('button', { name: 'Change C long fast' }).click();
  await expect(page.locator('main h1')).toHaveText('Change “C long fast”');
  await page.getByLabel('Name', { exact: true }).fill('C long, faster');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('option', { name: /C long, faster/ })).toBeVisible();
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Plays on Haven');
  await expect(page.getByRole('option', { name: /C long, faster/ })).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('option', { name: /C long, faster/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('leaving a play half drawn asks first, and coming back to it picks up where you left off', async ({ page, errors }) => {
  await open(page, 'maps/bind/draw');
  const leaving = () => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); dispatchEvent(e); return e.defaultPrevented; });
  // the tab asks, too, while a change of its own is still being written (skipping the setup is one)
  await saved(page);
  expect(await leaving(), 'a clean drawing closes without asking').toBe(false);
  await page.getByLabel('Name', { exact: true }).fill('Half drawn');
  // closing or reloading the tab asks too, since a drawing lives only in this tab until it's saved
  expect(await leaving(), 'a half-drawn play asks before the tab closes').toBe(true);
  // back to how it started, there's nothing to lose, by typing or by Ctrl Z
  await page.getByLabel('Name', { exact: true }).fill('');
  expect(await leaving(), 'a drawing back at its start closes without asking').toBe(false);
  await page.getByLabel('Name', { exact: true }).fill('Half drawn');
  await page.locator('.draw-step').first().getByRole('button', { name: 'Smokes', exact: true }).click();
  expect(await leaving()).toBe(true);
  await page.locator('main h1').click();
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
  expect(await leaving(), 'undone back to its start, it closes without asking').toBe(false);
  await page.getByLabel('Name', { exact: true }).fill('Half drawn');
  await page.evaluate(() => { location.hash = '#/maps/bind'; });
  await expect(page.locator('main h1')).toHaveText('Bind');
  await page.evaluate(() => { location.hash = '#/maps/bind/draw'; });
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Half drawn');
  await page.getByRole('button', { name: 'Cancel' }).click();
  const ask = page.getByRole('dialog', { name: 'Leave without saving?' });
  await ask.getByRole('button', { name: 'Keep drawing' }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Half drawn');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await ask.getByRole('button', { name: 'Leave it' }).click();
  await expect(page.locator('main h1')).toHaveText('Plays on Bind');
  await page.getByRole('button', { name: 'Draw a play' }).first().click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
  expect(await leaving(), 'once it\'s left, the tab closes without asking').toBe(false);
  // nor does Cancel ask about a drawing that's back where it started
  await page.getByLabel('Name', { exact: true }).fill('Typed and cleared');
  await page.getByLabel('Name', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('main h1')).toHaveText('Plays on Bind');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a message’s Redo puts back its own change, even once a play is being drawn', async ({ page, errors }) => {
  await open(page, 'select');
  await page.getByRole('group', { name: 'How the game ended' }).getByRole('button', { name: 'Won', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Logged a win/ })).toBeVisible();
  await go(page, 'maps/bind/draw');
  // nothing drawn yet: Ctrl Z takes the game back, and the message offers to redo it
  await page.locator('main h1').click();
  await page.keyboard.press('Control+z');
  const undone = page.getByRole('status').filter({ hasText: 'Undone: Log a game.' });
  await expect(undone).toBeVisible();
  // a job, taken back with Ctrl Z: the drawing has a redo of its own now
  const smokes = page.locator('.draw-step').first().getByRole('button', { name: 'Smokes', exact: true });
  await smokes.click();
  await page.locator('main h1').click();
  await page.keyboard.press('Control+z');
  await expect(smokes).toHaveAttribute('aria-pressed', 'false');
  // the message's Redo is about the game, and leaves the drawing alone
  await undone.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Redone: Log a game.' })).toBeVisible();
  await expect(smokes).toHaveAttribute('aria-pressed', 'false');
  await go(page, 'saved/games');
  await expect(page.getByRole('list', { name: 'Your games' }).getByRole('listitem')).toHaveCount(1);
  expect(errors).toEqual([]);
});

// each motion setting on every third map
const MOTIONS = ['Full', 'Reduced', 'Off'] as const;
for (const [k, motion] of MOTIONS.entries()) test(`a hit and an anti-eco round put the Spike on a plant spot, and a replay run from the keyboard sets it down, with motion ${motion.toLowerCase()}`, async ({ page, errors }) => {
  test.setTimeout(180_000);
  await open(page, 'settings/appearance');
  await page.getByRole('combobox', { name: 'Motion' }).selectOption({ label: motion });
  await expect(page.locator('html')).toHaveAttribute('data-motion', motion.toLowerCase());
  for (const m of MAPS.filter((_, i) => i % MOTIONS.length === k)) {
    await go(page, `maps/${m.id}/plays`);
    await expect(page.locator('main h1')).toHaveText(`Plays on ${m.name}`);
    const plants = featuresOf(m.id).filter((f) => f.kind === 'plant' || f.kind === 'safeplant');
    const card = page.locator('.play-card');
    // where the Spike is drawn, as a share of the map, and the plant spot nearest it (polled: with
    // motion on, it scales in, and Firefox and WebKit move its box while it does)
    const spikeSpot = async () => {
      const svg = (await card.locator('.minimap svg').first().boundingBox())!;
      const r = (await card.locator('.minimap .spike .spike-body').boundingBox())!;
      const x = (r.x + r.width / 2 - svg.x) / svg.width, y = (r.y + r.height / 2 - svg.y) / svg.height;
      return Math.min(...plants.map((f) => Math.hypot(f.at[0] - x, f.at[1] - y)));
    };
    for (const [kind, side] of [['Hits', 'Attack'], ['Anti-eco rounds', 'Attack'], ['Anti-eco rounds', 'Defense']] as const) {
      const where = `${m.name}, ${side.toLowerCase()}, ${kind.toLowerCase()} (motion ${motion.toLowerCase()})`;
      await page.getByRole('group', { name: 'Side' }).getByRole('button', { name: side }).click();
      await page.getByRole('listbox', { name: kind, exact: true }).getByRole('option').first().click();
      const spike = card.locator('.minimap .spike');
      if (kind === 'Anti-eco rounds' && side === 'Defense') {
        // on defense the team holds from range and retakes, so no Spike is down yet, but what it watches is drawn
        await expect(spike, where).toHaveCount(0);
        await expect(card.locator('.minimap .throw-recon').first(), where).toBeAttached();
        continue;
      }
      // the Spike is down on one of the site's plant spots, and the play says which
      await expect(spike.locator('title'), where).toHaveText(/^The Spike: (Default|Safe) plant /);
      if (kind === 'Anti-eco rounds') await expect(spike.locator('title'), where).toHaveText(/^The Spike: Default plant /);
      await expect(card.locator('.play-plant'), where).toHaveText(/^The Spike goes down on the (default|safe) plant /);
      await expect.poll(spikeSpot, { message: where }).toBeLessThan(0.012);
      if (kind !== 'Hits') continue;
      // a replay run from the keyboard ends with the Spike down where it was
      const replay = card.getByRole('button', { name: 'Replay' });
      await tabTo(page, replay);
      await page.keyboard.press('Enter');
      const moments = card.getByRole('list', { name: 'Moments' }).getByRole('button');
      await expect(moments.last(), where).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
      await expect(replay, where).toBeVisible({ timeout: 10_000 });
      await expect(spike, where).toHaveCount(1);
      await expect(spike, where).not.toHaveClass(/waiting/);
      await expect.poll(spikeSpot, { message: where }).toBeLessThan(0.012);
      // utility lands somewhere on the map
      await expect(card.locator('.minimap .throw').first(), where).toBeAttached();
    }
  }
  expect(errors).toEqual([]);
});

test('every map has the same kinds of plays: pistol, eco and anti-eco rounds on both sides, and a default that reads and reacts', async ({ page, errors }) => {
  for (const m of MAPS) {
    await open(page, `maps/${m.id}/plays`);
    await expect(page.locator('main h1')).toHaveText(`Plays on ${m.name}`);
    for (const side of ['Attack', 'Defense']) {
      await page.getByRole('group', { name: 'Side' }).getByRole('button', { name: side }).click();
      for (const kind of ['Pistol rounds', 'Eco rounds', 'Anti-eco rounds']) await expect(page.getByRole('heading', { name: kind, exact: true }), `${m.name} ${side}: ${kind}`).toBeVisible();
    }
    await page.getByRole('group', { name: 'Side' }).getByRole('button', { name: 'Attack' }).click();
    await page.getByRole('listbox', { name: 'Defaults', exact: true }).getByRole('option', { name: /\bRead [^,]+, then hit\b/ }).click();
    const branches = page.getByRole('group', { name: 'What the team finds out' }).getByRole('button');
    await expect(branches, `${m.name}: two branches`).toHaveCount(2);
    await branches.last().click();
    await expect(branches.last()).toHaveAttribute('aria-pressed', 'true');
  }
  expect(errors).toEqual([]);
});

test('Pause holds a replay where it is, and Go on carries on from there', async ({ page, errors }) => {
  await open(page, 'maps/ascent/plays');
  const card = page.locator('.play-card').first();
  const face = card.locator('[data-face]').first();
  await card.getByRole('button', { name: 'Replay' }).click();
  await page.waitForTimeout(500);
  await card.getByRole('button', { name: 'Pause' }).click();
  const held = await face.getAttribute('transform');
  await page.waitForTimeout(700);
  // the faces stay where they were
  expect(await face.getAttribute('transform')).toBe(held);
  await expect(card.locator('.play-moment.on')).toHaveCount(1);
  const moment = await card.locator('.play-moment.on').textContent();
  await card.getByRole('button', { name: 'Go on' }).click();
  // the same moment carries on walking
  await expect(card.locator('.play-moment.on')).toHaveText(moment ?? '');
  await expect.poll(() => face.getAttribute('transform')).not.toBe(held);
  expect(errors).toEqual([]);
});

test('a small wheel move zooms the minimap a little', async ({ page, errors }) => {
  await open(page, 'maps/ascent/plays');
  const map = page.locator('.minimap.zoomable').first();
  await map.scrollIntoViewIfNeeded();
  const zoom = () => map.locator('.minimap-stage').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -3);
  await page.waitForTimeout(100);
  const k = await zoom();
  expect(k).toBeGreaterThan(1);
  expect(k).toBeLessThan(1.2);
  expect(errors).toEqual([]);
});

// at 1280 the list and the map sit side by side, so a pick shows its map without scrolling
test('at 1280, the plays page draws the picked play beside the list', async ({ page, errors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, 'maps/ascent/plays');
  const card = page.locator('.play-card');
  await expect(card).toBeVisible();
  expect((await card.boundingBox())!.y).toBeLessThan(400);
  await page.locator('.play-list [role=option]').last().click();
  expect((await card.boundingBox())!.y).toBeLessThan(400);
  expect(errors).toEqual([]);
});

/** Draws a one-step play on Bind's attack and saves it: a smoke from A Bath, with a note and a line of `about` and `text`. */
async function drawBindPlay(page: import('@playwright/test').Page, name: string, about: string, text: string) {
  await open(page, 'maps/bind/draw');
  await page.getByLabel('Name', { exact: true }).fill(name);
  if (about) await page.getByLabel('What it’s for (if you like)').fill(about);
  const step = page.locator('.draw-step').first();
  await step.getByRole('button', { name: 'Smokes' }).click();
  await step.getByRole('combobox', { name: 'Add a spot to step 1' }).selectOption('A Bath');
  await step.getByRole('combobox', { name: 'Add a spot to step 1' }).selectOption('A Short');
  await step.getByLabel('What they do').fill(text);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('main h1')).toHaveText('Plays on Bind');
}

test('Copy carries the play the Plays tab puts first, a play you drew among them, before the tab is opened', async ({ page, errors }) => {
  await page.addInitScript(() => {
    const copied: string[] = [];
    (window as unknown as { copied: string[] }).copied = copied;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { copied.push(t); } } });
  });
  await drawBindPlay(page, 'Quick A smoke', '', 'Smoke A Short.');
  await page.getByRole('group', { name: 'Side' }).getByRole('button', { name: 'Attack' }).click();
  await page.getByRole('button', { name: 'Plan for Bind' }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('.answers[aria-busy=true], .working')).toHaveCount(0, { timeout: 30_000 });
  const comp = page.locator('.comp.open');
  await comp.getByRole('button', { name: 'Copy' }).click();
  await page.getByRole('menuitem', { name: 'The whole plan' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Copied the plan.' })).toBeVisible();
  const copied = await page.evaluate(() => (window as unknown as { copied: string[] }).copied[0] ?? '');
  // the play the Plays tab shows first is the one the copied plan carries
  await comp.getByRole('tab', { name: 'Plays' }).click();
  const first = (await comp.locator('.play-card h3').textContent()) ?? '';
  expect(first).toBe('Quick A smoke');
  expect(copied).toContain(`\nPlay: ${first} (`);
  // a play you drew with nothing said of what it's for goes straight on to its steps
  expect(copied).toMatch(/\nPlay: Quick A smoke \(.+\)\n1\. /);
  expect(errors).toEqual([]);
});

test('a play you drew with long unbroken words in it keeps its card inside the page', async ({ page, errors }) => {
  const word = 'Averylongwordwithnospacesthatgoesonandonandon'.repeat(3);
  await drawBindPlay(page, 'Long words', `For ${word}`, `Smoke A Short ${word}`);
  const card = page.getByRole('article', { name: 'Long words' });
  await expect(card).toContainText(word);
  // nothing in the card is wider than the card, so it needn't scroll sideways
  const wide = await card.evaluate((c) => [c, ...c.querySelectorAll('*')].filter((e) => !e.closest('svg') && e.getBoundingClientRect().right > c.getBoundingClientRect().right + 1).map((e) => `${e.tagName}.${e.className}`));
  expect(wide).toEqual([]);
  expect(await card.evaluate((c) => c.scrollWidth <= c.clientWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
