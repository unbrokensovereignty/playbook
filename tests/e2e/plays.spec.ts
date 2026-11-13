/** Plays: each map's page of plays, the replay, defense setups for each site, and plays you draw yourself. */
import AxeBuilder from '@axe-core/playwright';
import { go, open, reload, tabTo, test, expect } from './app.ts';
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
