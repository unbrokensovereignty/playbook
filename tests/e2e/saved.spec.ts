import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, go, open, reload, saved, test } from './app.ts';

/** Waits for the Planner's answers to settle. */
async function answered(page: Page) {
  await page.waitForTimeout(300);
  await expect(page.locator('.answers[aria-busy=true], .working')).toHaveCount(0, { timeout: 30_000 });
}

/** Saves the Planner's open comp under `name`. */
async function savePlan(page: Page, name: string) {
  await page.locator('.comp.open').getByRole('button', { name: 'Save plan' }).click();
  const dialog = page.getByRole('dialog', { name: 'Save this plan' });
  await dialog.getByRole('textbox').fill(name);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: `Saved “${name}”.` })).toBeVisible();
}

const a11y = async (page: Page, where: string) => {
  const r = await new AxeBuilder({ page }).include(where).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};

test('a saved plan keeps its comp, fit and note, and can be starred, renamed, deleted and brought back', async ({ page, errors }) => {
  await open(page, 'maps/haven');
  await page.getByRole('button', { name: 'Plan for Haven' }).click();
  await answered(page);
  const team = await page.locator('.comp.open .comp-team').textContent();
  const fit = await page.locator('.comp.open .comp-head .fit-num').textContent();
  await savePlan(page, 'Haven default');
  await expect(page.getByRole('navigation', { name: 'Main' }).getByLabel('1 saved')).toBeVisible();
  // it opens from the toast's Open, or from the Saved page
  await go(page, 'saved');
  const row = page.getByRole('list', { name: 'Saved plans' }).getByRole('button', { name: /Haven default/ });
  await row.click();
  const plan = page.getByRole('article', { name: 'Haven default' });
  await expect(plan).toBeVisible();
  // the same team and fit the Planner gave it
  for (const name of (team ?? '').split(', ')) await expect(plan.locator('.plan-team').getByRole('img', { name, exact: true })).toBeVisible();
  await expect(plan.locator('.plan-team .fit-num')).toHaveText(fit ?? '');
  await expect(plan.getByRole('heading', { name: 'Pros' })).toBeVisible();
  await plan.getByRole('tab', { name: 'Plays' }).click();
  await expect(plan.locator('.minimap').first()).toBeVisible();
  expect(await a11y(page, '.saved-layout')).toEqual([]);
  // a note, a star and a new name are kept through a reload
  await plan.getByRole('textbox', { name: 'Note' }).fill('Jett ops from A Long.');
  await plan.getByRole('button', { name: 'Star' }).click();
  await plan.getByRole('button', { name: 'Rename' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Haven attack, default');
  await page.getByRole('dialog').getByRole('button', { name: 'Rename' }).click();
  await saved(page);
  await reload(page);
  const again = page.getByRole('article', { name: 'Haven attack, default' });
  await expect(again.getByRole('textbox', { name: 'Note' })).toHaveValue('Jett ops from A Long.');
  await expect(again.getByRole('button', { name: 'Star' })).toHaveAttribute('aria-pressed', 'true');
  // printed, it carries its name and note, and a play for each side
  await page.evaluate(() => { window.print = () => {}; });
  await again.getByRole('button', { name: 'Print' }).click();
  const sheet = page.locator('#print-sheet');
  await expect(sheet.locator('h1')).toHaveText('Haven attack, default');
  await expect(sheet.locator('.sheet-own')).toHaveText('Jett ops from A Long.');
  await expect(sheet.locator('h2').filter({ hasText: /^On attack: / })).toHaveCount(1);
  await expect(sheet.locator('h2').filter({ hasText: /^On defense: / })).toHaveCount(1);
  await page.evaluate(() => dispatchEvent(new Event('afterprint')));
  // Open in the Planner asks the same question again
  await again.getByRole('button', { name: 'Open in the Planner' }).click();
  await answered(page);
  await expect(page.locator('.answers-head h2')).toHaveText('Haven');
  // deleted, and brought back with Undo
  await go(page, 'saved');
  await page.getByRole('list', { name: 'Saved plans' }).getByRole('button', { name: /Haven attack, default/ }).click();
  await page.getByRole('article').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { name: 'No saved plans yet' })).toBeVisible();
  await page.getByRole('status').filter({ hasText: 'Deleted' }).getByRole('button', { name: /Undo/ }).click();
  await expect(page.getByRole('list', { name: 'Saved plans' }).getByRole('button', { name: /Haven attack, default/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a five-player party finds the maps to play and to ban', async ({ page, errors }) => {
  await open(page, 'saved/parties');
  await page.getByRole('button', { name: 'Make a party' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Make a party' });
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Premier team');
  await dialog.getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Five-stack' }).click();
  const pools: string[][] = [['Jett', 'Raze'], ['Omen', 'Brimstone'], ['Sova', 'Skye'], ['Killjoy', 'Cypher'], ['Sage', 'KAY/O']];
  for (const [i, agents] of pools.entries()) {
    await dialog.locator('.party-player').nth(i).getByRole('button', { name: /: choose$/ }).click();
    const picker = page.getByRole('dialog').last();
    for (const a of agents) await picker.getByRole('button', { name: a, exact: true }).click();
    await picker.getByRole('button', { name: 'Done' }).click();
  }
  await dialog.getByRole('button', { name: 'Make the party' }).click();
  await page.locator('.party-row').filter({ hasText: 'Premier team' }).getByRole('button', { name: 'Maps to play and ban' }).click();
  await answered(page);
  await expect(page.locator('.answers h2').first()).toHaveText('Best maps for you');
  const picks = page.getByRole('region', { name: 'Maps to play and to ban' });
  await expect(picks).toBeVisible();
  await expect(page.getByText('Only agents Premier team plays')).toBeVisible();
  expect(await picks.locator('.map-pick').count()).toBeGreaterThanOrEqual(2);
  expect(await a11y(page, '.map-picks')).toEqual([]);
  expect(errors).toEqual([]);
});

test('a party plans with the agents each player plays, and says when they can’t make a comp', async ({ page, errors }) => {
  await open(page, 'saved/parties');
  await page.getByRole('button', { name: 'Make a party' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Make a party' });
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Friday trio');
  await dialog.getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Trio' }).click();
  const pools: string[][] = [['Jett', 'Raze'], ['Omen'], ['Sova', 'Fade']];
  for (const [i, agents] of pools.entries()) {
    await dialog.locator('.party-player').nth(i).getByRole('button', { name: /: choose$/ }).click();
    const picker = page.getByRole('dialog').last();
    for (const a of agents) await picker.getByRole('button', { name: a, exact: true }).click();
    await picker.getByRole('button', { name: 'Done' }).click();
  }
  expect(await a11y(page, '[role=dialog]')).toEqual([]);
  await dialog.getByRole('button', { name: 'Make the party' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const party = page.locator('.party-row').filter({ hasText: 'Friday trio' });
  await expect(party).toContainText('Trio');
  // only a five-stack picks and bans maps
  await expect(party.getByRole('button', { name: 'Maps to play and ban' })).toHaveCount(0);
  await party.getByRole('button', { name: 'Plan' }).click();
  await answered(page);
  await expect(page.getByText('Only agents Friday trio plays')).toBeVisible();
  // every pick gives each player one of their own agents
  for (const names of await page.locator('.comps .comp-team b').allTextContents()) {
    expect(names).toMatch(/Jett|Raze/);
    expect(names).toContain('Omen');
    expect(names).toMatch(/Sova|Fade/);
  }
  // a party whose players all play only the same agent can't make a comp, and the page says why
  await go(page, 'saved/parties');
  await party.getByRole('button', { name: 'Edit Friday trio' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit the party' });
  for (let i = 0; i < 3; i++) {
    await edit.locator('.party-player').nth(i).getByRole('button', { name: /: change$/ }).click();
    const picker = page.getByRole('dialog').last();
    await picker.getByRole('button', { name: 'Clear' }).click();
    await picker.getByRole('button', { name: 'Jett', exact: true }).click();
    await picker.getByRole('button', { name: 'Done' }).click();
  }
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await party.getByRole('button', { name: 'Plan' }).click();
  await answered(page);
  await expect(page.getByRole('heading', { name: 'No comp fits all of these choices' })).toBeVisible();
  // the advice names the real cause, with nothing else chosen to loosen
  await expect(page.getByText('Your party’s players can’t each take a different agent from the ones they play. Add more agents to someone’s list.')).toBeVisible();
  // and the way out drops the players' lists, where clearing the agent and role choices would change nothing
  await expect(page.getByRole('button', { name: 'Clear the agent and role choices' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Plan with any agents' }).click();
  await answered(page);
  await expect(page.locator('.comps .comp-team').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('agent select says what to lock in as the team picks, and a logged game shows in your record and comes back after a reload', async ({ page, errors }) => {
  await open(page, 'select');
  await page.getByRole('combobox', { name: 'Map' }).selectOption('ascent');
  const box = page.getByLabel('Type an agent and press Enter');
  await expect(box).toBeFocused();
  // typed, Enter adds the first match; a click adds another; Backspace takes the last back out
  await box.fill('je');
  await expect(page.locator('#select-type-hint')).toHaveText(/Enter adds Jett/);
  await box.press('Enter');
  await box.fill('so');
  await box.press('Enter');
  await page.getByRole('group', { name: /Click an agent/ }).getByRole('button', { name: 'Killjoy' }).click();
  await page.getByRole('group', { name: /Click an agent/ }).getByRole('button', { name: 'Raze' }).click();
  await box.press('Backspace');
  const slots = page.getByRole('list', { name: 'Your teammates’ agents' });
  await expect(slots.getByText('Raze')).toHaveCount(0);
  await expect(slots.getByText('Killjoy')).toBeVisible();
  const pick = page.locator('[data-tour=select-pick]');
  await expect(pick.getByRole('heading', { level: 2 })).toHaveText(/^(Omen|Clove|Brimstone|Astra|Harbor|Viper|Miks)$/);
  await expect(pick.getByText(/brings smokes/)).toBeVisible();
  await expect(pick.getByText(/Ask the last player for a duelist/)).toBeVisible();
  expect(await a11y(page, '.select-page')).toEqual([]);
  const agent = await pick.getByRole('heading', { level: 2 }).textContent();
  await page.getByRole('group', { name: 'How the game ended' }).getByRole('button', { name: 'Won', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: `Logged a win on Ascent as ${agent}.` })).toBeVisible();
  await expect(slots.getByText('Killjoy')).toHaveCount(0);
  await saved(page);
  await reload(page);
  await go(page, 'saved/games');
  await expect(page.getByRole('list', { name: 'Your games' }).getByText(`Ascent as ${agent}`)).toBeVisible();
  await expect(page.getByText('1 win, 0 losses').first()).toBeVisible();
  expect(await a11y(page, 'main')).toEqual([]);
  expect(errors).toEqual([]);
});
