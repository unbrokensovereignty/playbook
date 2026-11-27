import AxeBuilder from '@axe-core/playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, go, open, reload, saved, still, tabTo, test } from './app.ts';

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

test('a saved plan for a solo player keeps their agent and fits as the Planner said the whole team does', async ({ page, errors }) => {
  await open(page, 'maps/bind');
  await page.getByRole('button', { name: 'Plan for Bind' }).click();
  await answered(page);
  const q = page.getByRole('region', { name: 'Your situation' });
  await q.getByRole('combobox', { name: 'Rank' }).selectOption({ label: 'Radiant' });
  await q.getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Solo' }).click();
  await answered(page);
  // "If your random teammates play …, the team fits 99 out of 100"
  const box = await page.locator('.comp.open .party-box p').first().textContent();
  const fit = /the team fits (\d+) out of 100/.exec(box ?? '')?.[1];
  const you = /^You play (.+?)\./.exec(box ?? '')?.[1];
  expect(fit).toBeTruthy();
  await savePlan(page, 'Bind solo');
  await go(page, 'saved');
  await page.getByRole('list', { name: 'Saved plans' }).getByRole('button', { name: /Bind solo/ }).click();
  const plan = page.getByRole('article', { name: 'Bind solo' });
  // the same fit, from the same numbers: a random team plays together less than a five-stack
  await expect(plan.locator('.plan-team .fit-num')).toHaveText(fit!);
  // and the agent you play still comes first, marked as yours
  await expect(plan.locator('.plan-team .team-icon').first()).toHaveAttribute('data-tip', `${you} (your party)`);
  expect(errors).toEqual([]);
});

test('a saved duo plan gives the pros, cons and tips the Planner gave its comp, about the duo’s own agents', async ({ page, errors }) => {
  await open(page, 'maps/bind');
  await page.getByRole('button', { name: 'Plan for Bind' }).click();
  await answered(page);
  const q = page.getByRole('region', { name: 'Your situation' });
  await q.getByRole('combobox', { name: 'Rank' }).selectOption({ label: 'Iron' });
  await q.getByRole('group', { name: 'Side' }).getByRole('button', { name: 'Attack' }).click();
  await q.getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Duo' }).click();
  await answered(page);
  const reasons = async (where: ReturnType<Page['locator']>) => {
    await expect(where.locator('.pros-cons > div').first().locator('li').first()).toBeVisible();
    await still(page);
    const why = { pros: await where.locator('.pros-cons > div').first().locator('li').allInnerTexts(), cons: await where.locator('.pros-cons > div').nth(1).locator('li').allInnerTexts() };
    await where.getByRole('tab', { name: 'Tips' }).click();
    const tips = await where.locator('.tips li').allInnerTexts();
    await where.getByRole('tab', { name: 'Pros and cons' }).click();
    return { ...why, tips };
  };
  const fromPlanner = await reasons(page.locator('.comp.open'));
  expect(fromPlanner.pros.length).toBeGreaterThan(0);
  await savePlan(page, 'Bind duo');
  await go(page, 'saved');
  await page.getByRole('list', { name: 'Saved plans' }).getByRole('button', { name: /Bind duo/ }).click();
  const plan = page.getByRole('article', { name: 'Bind duo' });
  // the same reasons, read off the same numbers, with tips for the duo's own agents, not their random teammates'
  expect(await reasons(plan)).toEqual(fromPlanner);
  // a saved plan has no numbers for random teammates, so there's no party box
  await expect(plan.locator('.party-box')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a saved solo plan’s teammates locked in are marked and named in the list and on Home, as on the plan', async ({ page, errors }) => {
  await open(page, 'planner');
  const q = page.getByRole('region', { name: 'Your situation' });
  await q.getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Solo' }).click();
  await page.getByRole('button', { name: 'Teammates locked in: choose' }).click();
  const picker = page.getByRole('dialog', { name: 'Agents your teammates locked in' });
  await picker.getByRole('button', { name: 'Jett', exact: true }).click();
  await picker.getByRole('button', { name: 'Done' }).click();
  await answered(page);
  await savePlan(page, 'Solo with Jett');
  await go(page, 'saved');
  const row = page.getByRole('list', { name: 'Saved plans' }).getByRole('button', { name: /Solo with Jett/ });
  await expect(row.locator('.team-icon[data-tip^="Jett"]')).toHaveAttribute('data-tip', 'Jett (locked in)');
  // its line names the teammate locked in, as the Planner's answers did
  await expect(row.locator('small')).toContainText('solo · Jett locked in');
  await row.click();
  await expect(page.getByRole('article', { name: 'Solo with Jett' }).locator('.plan-team .team-icon[data-tip^="Jett"]')).toHaveAttribute('data-tip', 'Jett (locked in)');
  await go(page, 'home');
  await expect(page.locator('.list-row').filter({ hasText: 'Solo with Jett' }).locator('.team-icon[data-tip^="Jett"]')).toHaveAttribute('data-tip', 'Jett (locked in)');
  await expect(page.locator('.list-row').filter({ hasText: 'Solo with Jett' }).locator('small')).toContainText('solo · Jett locked in');
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

test('a party planned from Search gets the same answers as from the Saved page, with its mains and the agents it’s still learning', async ({ page, errors }) => {
  await open(page, 'saved/parties');
  await page.getByRole('button', { name: 'Make a party' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Make a party' });
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Late trio');
  await dialog.getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Trio' }).click();
  for (const [i, agents] of [['Jett', 'Raze'], ['Omen'], ['Sova', 'Fade']].entries()) {
    await dialog.locator('.party-player').nth(i).getByRole('button', { name: /: choose$/ }).click();
    const picker = page.getByRole('dialog').last();
    for (const a of agents) await picker.getByRole('button', { name: a, exact: true }).click();
    await picker.getByRole('button', { name: 'Done' }).click();
  }
  await dialog.getByRole('group', { name: 'How well Me plays Raze' }).getByRole('button', { name: 'Main' }).click();
  await dialog.getByRole('group', { name: 'How well Me plays Jett' }).getByRole('button', { name: 'Learning' }).click();
  await dialog.getByRole('button', { name: 'Make the party' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const rows = async () => (await page.locator('.comps .comp-head').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
  await page.locator('.party-row').filter({ hasText: 'Late trio' }).getByRole('button', { name: 'Plan' }).click();
  await answered(page);
  const fromSaved = await rows();
  await go(page, 'home');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('Plan for Late trio');
  await expect(page.getByRole('dialog', { name: 'Search commands' }).getByRole('option').first()).toContainText('Plan for Late trio');
  await page.keyboard.press('Enter');
  await answered(page);
  await expect(page.getByText('Only agents Late trio plays')).toBeVisible();
  expect(await rows()).toEqual(fromSaved);
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
  await expect(pick.getByText(/^This team needs smokes( and [a-z -]+)? most here, and .+ brings (them|both)\./)).toBeVisible();
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

test('a pick a teammate has just locked in isn’t offered while the new pick is worked out, and the game logged is a real team', async ({ page, errors }) => {
  // the engine's answers wait while __hold is set, as on a slow computer
  await page.addInitScript(() => {
    const w = window as unknown as { __hold: boolean; __held: (() => void)[] };
    w.__hold = false; w.__held = [];
    const Base = Worker;
    window.Worker = class extends Base {
      override set onmessage(f: ((e: MessageEvent) => void) | null) {
        super.onmessage = f && ((e: MessageEvent) => { if (w.__hold && !e.data?.ready) w.__held.push(() => f.call(this, e)); else f.call(this, e); });
      }
    };
  });
  await open(page, 'select');
  const pick = page.locator('[data-tour=select-pick]');
  const name = pick.getByRole('heading', { level: 2 });
  await expect(name).toBeVisible({ timeout: 30_000 });
  const first = (await name.textContent())!;
  await page.evaluate(() => { (window as unknown as { __hold: boolean }).__hold = true; });
  // a teammate locks in the agent the page said to pick
  const box = page.getByLabel('Type an agent and press Enter');
  await box.fill(first);
  await box.press('Enter');
  await expect(page.getByRole('list', { name: 'Your teammates’ agents' }).getByText(first)).toBeVisible();
  await expect(page.getByText('Finding your pick…')).toBeVisible();
  await expect(name).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'How the game ended' })).toHaveCount(0);
  await page.evaluate(() => { const w = window as unknown as { __hold: boolean; __held: (() => void)[] }; w.__hold = false; for (const f of w.__held.splice(0)) f(); });
  await expect(name).not.toHaveText(first);
  const now = (await name.textContent())!;
  await page.getByRole('group', { name: 'How the game ended' }).getByRole('button', { name: 'Won', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: `as ${now}.` })).toBeVisible();
  await go(page, 'saved/games');
  await expect(page.getByRole('list', { name: 'Your games' }).getByText(`as ${now}`)).toBeVisible();
  expect(errors).toEqual([]);
});

test('Agent select’s box has focus however the page is reached, as Help says', async ({ page, errors }) => {
  await open(page, 'home');
  const box = page.getByLabel('Type an agent and press Enter');
  // by the sidebar, with the mouse
  await page.getByRole('navigation').getByRole('link', { name: 'Agent select' }).click();
  await expect(box).toBeFocused();
  await page.keyboard.type('je');
  await expect(page.locator('#select-type-hint')).toHaveText(/Enter adds Jett/);
  await box.fill('');
  // from Search, after another page
  await go(page, 'rankings');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('Agent select');
  await page.keyboard.press('Enter');
  await expect(box).toBeFocused();
  // a tour that opens the page keeps the keys on its card
  await go(page, 'help/tours');
  await page.getByRole('button', { name: 'Start the Agent select and your games tour' }).click();
  await expect(page.locator('.tour-card')).toBeVisible();
  await expect(box).not.toBeFocused();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('typing quickly in a plan’s note keeps every letter where it was typed, and the note still follows Undo', async ({ page, errors }) => {
  await open(page, 'maps/haven');
  await page.getByRole('button', { name: 'Plan for Haven' }).click();
  await answered(page);
  await savePlan(page, 'Haven note');
  await go(page, 'saved');
  await page.getByRole('list', { name: 'Saved plans' }).getByRole('button', { name: /Haven note/ }).click();
  const note = page.getByRole('article', { name: 'Haven note' }).getByRole('textbox', { name: 'Note' });
  await note.fill('Omen smokes B Main');
  // a slip of two spaces in the middle, then the word: what's kept has one space, and the letters stay put
  await note.evaluate((t: HTMLTextAreaElement) => t.setSelectionRange(4, 4));
  await page.keyboard.type('  and');
  await expect(note).toHaveValue('Omen  and smokes B Main');
  await expect.poll(() => note.evaluate((t: HTMLTextAreaElement) => t.selectionStart)).toBe(9);
  // a new line, then more
  await note.press('End');
  await note.press('Enter');
  await page.keyboard.type('Sova darts');
  await expect(note).toHaveValue('Omen  and smokes B Main\nSova darts');
  // quick presses, as a held Backspace makes: each takes off one letter
  for (let i = 0; i < 6; i++) await note.press('Backspace');
  await expect(note).toHaveValue('Omen  and smokes B Main\nSova');
  await saved(page);
  await reload(page);
  await expect(note).toHaveValue('Omen and smokes B Main Sova');
  // Ctrl Z from outside the box takes back the last change, and the box shows it
  await note.press('End');
  await page.keyboard.type(' first');
  await page.getByRole('article', { name: 'Haven note' }).getByRole('heading', { level: 2 }).click();
  await page.keyboard.press('Control+z');
  await expect(note).toHaveValue('Omen and smokes B Main Sova');
  expect(errors).toEqual([]);
});

// a row that leaves with motion on still hands keyboard focus to the nearest control
for (const motion of ['Full', 'Reduced'] as const) test(`deleting a plan from the keyboard keeps focus on the page, with motion ${motion.toLowerCase()}`, async ({ page, errors }) => {
  await open(page, 'settings/appearance');
  await page.getByRole('combobox', { name: 'Motion' }).selectOption({ label: motion });
  await go(page, 'maps/haven');
  await page.getByRole('button', { name: 'Plan for Haven' }).click();
  await answered(page);
  await savePlan(page, 'Haven one');
  await savePlan(page, 'Haven two');
  await go(page, 'saved');
  await page.getByRole('list', { name: 'Saved plans' }).getByRole('button', { name: /Haven one/ }).click();
  const del = page.getByRole('article', { name: 'Haven one' }).getByRole('button', { name: 'Delete' });
  await tabTo(page, del);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('list', { name: 'Saved plans' }).getByRole('button', { name: /Haven one/ })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.saved-layout'))).toBe(true);
  expect(errors).toEqual([]);
});

// with motion reduced, what changes at once at Full changes at once too: only what animates at Full fades
test('with motion reduced, pages, Search and tabs change at once', async ({ page, errors }) => {
  await open(page, 'settings/appearance');
  await page.getByRole('combobox', { name: 'Motion' }).selectOption({ label: 'Reduced' });
  await still(page);
  /** How many elements fade in, a frame after `act` runs on the page. */
  const fadesAfter = (act: string) => page.evaluate(async (code) => {
    new Function(code)();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    return document.getAnimations().filter((a) => (a as CSSAnimation).animationName === 'fade-only').length;
  }, act);
  expect(await fadesAfter("location.hash = '#/rankings'")).toBe(0);
  expect(await fadesAfter("dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))")).toBe(0);
  await expect(page.locator('.palette-box')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await fadesAfter("location.hash = '#/saved/games'")).toBe(0);
  expect(errors).toEqual([]);
});

test('the Saved tabs are one Tab stop, and the arrow keys move between them', async ({ page, errors }) => {
  await open(page, 'saved');
  const tabs = page.getByRole('tablist', { name: 'Saved' });
  await tabTo(page, tabs.getByRole('tab', { name: 'Plans' }));
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: 'Parties' })).toBeFocused();
  await expect(tabs.getByRole('tab', { name: 'Parties' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'Parties' })).toBeVisible();
  await page.keyboard.press('End');
  await expect(tabs.getByRole('tab', { name: 'Your games' })).toBeFocused();
  await expect(tabs.getByRole('tab', { selected: false }).first()).toHaveAttribute('tabindex', '-1');
  expect(errors).toEqual([]);
});

// one column at 1280: the plan opens above the list, so picking one far down must still show its name, and focus goes with it
test('a plan picked far down the list opens with its name in view and takes focus', async ({ page, errors }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, 'maps/haven');
  await page.getByRole('button', { name: 'Plan for Haven' }).click();
  await answered(page);
  await savePlan(page, 'Haven 1');
  await saved(page);
  await go(page, 'settings/data');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Back up now' }).click()]);
  const file = info.outputPath('backup.json');
  await download.saveAs(file);
  const b = JSON.parse(readFileSync(file, 'utf8'));
  const one = b.plans[0];
  b.plans = Array.from({ length: 12 }, (_, i) => ({ ...one, id: `p_many${String(i).padStart(4, '0')}`, name: `Haven ${i + 1}`, updated: one.updated - i * 1000 }));
  writeFileSync(file, JSON.stringify(b));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Restore…' }).click()]);
  await chooser.setFiles(file);
  await page.getByRole('dialog', { name: 'Restore this backup?' }).getByRole('button', { name: 'Replace' }).click();
  await go(page, 'saved');
  const last = page.getByRole('list', { name: 'Saved plans' }).getByRole('button', { name: /Haven 12/ });
  await last.scrollIntoViewIfNeeded();
  await tabTo(page, last);
  await page.keyboard.press('Enter');
  const head = page.getByRole('heading', { name: 'Haven 12', level: 2 });
  await expect(head).toBeFocused();
  const box = (await head.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(800);
  // the same plan again, from back down the list: it comes back into view
  await last.scrollIntoViewIfNeeded();
  await last.focus();
  await page.keyboard.press('Enter');
  await expect(head).toBeFocused();
  const again = (await head.boundingBox())!;
  expect(again.y).toBeGreaterThanOrEqual(0);
  expect(again.y + again.height).toBeLessThanOrEqual(800);
  expect(errors).toEqual([]);
});

test('a held Enter that opens a confirm doesn’t go on to press its buttons', async ({ page, errors }) => {
  await open(page, 'settings/data');
  await page.getByRole('button', { name: 'Erase…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Erase everything?' });
  await expect(dialog).toBeVisible();
  // the key's repeats land on the dialog's focused button: they must do nothing there
  const pressed = await page.evaluate(() => {
    const e = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true });
    (document.activeElement ?? document.body).dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(pressed).toBe(true);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('Not now puts an offer in Your games away until the record behind it changes, from the keyboard and with Undo', async ({ page, errors }, info) => {
  await open(page, 'settings/data');
  // a backup with Omen won 9 of 11 (not one of your agents yet) and Jett, one of yours, won 1 of 10
  const game = (agent: string, result: string, i: number) => ({ id: `g_${agent}${String(i).padStart(4, '0')}`, map: 'ascent', agent, team: [agent], result, note: '', played: Date.UTC(2026, 9, 1) + i * 60_000 });
  const games = [
    ...Array.from({ length: 9 }, (_, i) => game('omen', 'win', i)), ...Array.from({ length: 2 }, (_, i) => game('omen', 'loss', 20 + i)),
    game('jett', 'win', 40), ...Array.from({ length: 9 }, (_, i) => game('jett', 'loss', 50 + i)),
  ];
  const file = info.outputPath('games.json');
  writeFileSync(file, JSON.stringify({ kind: 'playbook-backup', format: 1, settings: { myAgents: ['jett'] }, themes: [], plans: [], parties: [], plays: [], games }));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Restore…' }).click()]);
  await chooser.setFiles(file);
  await page.getByRole('dialog', { name: 'Restore this backup?' }).getByRole('button', { name: 'Replace' }).click();
  await go(page, 'saved/games');
  const offers = page.locator('.game-offer');
  await expect(offers).toHaveCount(2);
  const omen = offers.filter({ hasText: 'Add Omen to your agents' });
  // each offer's Not now says which agent it's for
  const notNow = omen.getByRole('button', { name: 'Not now for Omen' });
  await expect(notNow).toHaveText('Not now');
  await tabTo(page, notNow);
  await page.keyboard.press('Enter');
  await expect(omen).toHaveCount(0);
  await expect(offers).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: 'won’t ask about Omen again until your record as Omen changes' })).toBeVisible();
  // focus moves on to the next control instead of falling to the page
  await expect(page.locator('body')).not.toBeFocused();
  // Undo brings it back
  await page.getByRole('status').filter({ hasText: 'Omen' }).getByRole('button', { name: /Undo/ }).click();
  await expect(offers).toHaveCount(2);
  // put away again, it stays away after a reload
  await notNow.click();
  await expect(offers).toHaveCount(1);
  await saved(page);
  await reload(page);
  await expect(offers).toHaveCount(1);
  await expect(offers).toContainText('Jett');
  // deleting one of Omen's losses changes the record (9 of 10), so the offer comes back
  await page.getByRole('button', { name: 'Delete the game on Ascent as Omen' }).first().click();
  await expect(omen).toHaveCount(1);
  await expect(omen).toContainText('You’ve won 9 of 10 games as Omen.');
  expect(errors).toEqual([]);
});
