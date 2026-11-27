import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, go, open, overlaps, reload, saved, still, tabTo, test } from './app.ts';

const answers = (page: Page) => page.locator('.answers:not(.stale)');
const comps = (page: Page) => page.locator('.comps > li');
const question = (page: Page) => page.getByRole('region', { name: 'Your situation' });

/** Picks a map in the map dialog. */
async function chooseMap(page: Page, name: string) {
  await page.getByRole('button', { name: /^Map: .*\. Change$/ }).click();
  // the dialog rises in: a click while it moves can miss its option
  await still(page);
  await page.getByRole('listbox', { name: 'Maps' }).getByRole('option', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Opens an agent picker by its title, picks the agents named, and presses Done. */
async function chooseAgents(page: Page, title: string, names: string[]) {
  await page.getByRole('button', { name: `${title}: choose` }).click();
  const dialog = page.getByRole('dialog', { name: title });
  for (const n of names) await dialog.getByRole('button', { name: n, exact: true }).click();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Waits for the answers to a question: its line under the title (when given) and no work left. */
const settledAnswers = async (page: Page, line?: string) => {
  if (line) await expect(page.locator('.answers-head')).toContainText(line, { timeout: 10_000 });
  await expect(page.locator('.answers[aria-busy=true], .working')).toHaveCount(0, { timeout: 30_000 });
  await expect(comps(page).first()).toBeVisible();
  await still(page);
};

test('ask for a map, side and rank, and get comps with pros and cons, plays and tips', async ({ page, errors }) => {
  await open(page, 'planner');
  await chooseMap(page, 'Haven');
  await question(page).getByRole('group', { name: 'Side' }).getByRole('button', { name: 'Attack' }).click();
  await question(page).getByRole('combobox', { name: 'Rank' }).selectOption({ label: 'Diamond' });
  await settledAnswers(page);
  await expect(answers(page).locator('h2').first()).toHaveText('Haven, attack');
  await expect(answers(page)).toContainText('Diamond · five-stack');
  expect(await comps(page).count()).toBeGreaterThanOrEqual(5);
  // the best comp starts open, with its reasons
  const first = comps(page).first();
  await expect(first.locator('.comp-head')).toHaveAttribute('aria-expanded', 'true');
  await expect(first.getByRole('heading', { name: 'Pros' })).toBeVisible();
  await expect(first.getByRole('heading', { name: 'Cons' })).toBeVisible();
  // its plays draw on the minimap, and every job goes to someone on the team
  await first.getByRole('tab', { name: 'Plays' }).click();
  await expect(first.locator('.minimap').first()).toBeVisible();
  // the pistol-round, eco and anti-eco plays come apart from the rest, with what to buy
  await first.getByRole('listbox', { name: 'Pistol, eco and anti-eco rounds' }).getByRole('option', { name: /^Pistol/ }).click();
  await expect(first.getByRole('article', { name: /^Pistol round: / })).toContainText('Pistol round. The first round of each half');
  await first.getByRole('tab', { name: 'Tips' }).click();
  await expect(first.locator('.tips li').first()).toBeVisible();
  // another comp opens, and the first one closes
  await comps(page).nth(2).locator('.comp-head').click();
  await expect(comps(page).nth(2).locator('.comp-head')).toHaveAttribute('aria-expanded', 'true');
  await expect(first.locator('.comp-head')).toHaveAttribute('aria-expanded', 'false');
  // a site narrows the question
  await question(page).getByRole('button', { name: 'C site' }).click();
  await settledAnswers(page);
  await expect(answers(page).locator('h2').first()).toHaveText('Haven, attack, C site');
  const r = await new AxeBuilder({ page }).include('.answers').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  expect(await overlaps(page, '.answers-head')).toEqual([]);
  // the Agents tab says what each agent adds to their best comp over the next best of their role
  await page.getByRole('tab', { name: 'Agents' }).click();
  await page.locator('.agent-row').first().click();
  await expect(page.locator('.agent-more')).toContainText(/In that comp, (.+ is \d+ ahead of .+, the next best (duelist|initiator|controller|sentinel)|.+ would do about as well as .+)\./);
  expect(errors).toEqual([]);
});

/** How many pages a PDF has. */
const pages = (pdf: Buffer) => pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;

test('a comp prints as one sheet, with the play chosen on its Plays tab, in light colors whatever the theme', async ({ page, browserName, errors }) => {
  await page.addInitScript(() => { const w = window as unknown as { printed: number }; w.printed = 0; window.print = () => { w.printed++; }; });
  await open(page, 'planner');
  await chooseMap(page, 'Breeze');
  await question(page).getByRole('group', { name: 'Side' }).getByRole('button', { name: 'Attack' }).click();
  await question(page).getByRole('combobox', { name: 'Rank' }).selectOption({ label: 'Immortal' });
  await settledAnswers(page, 'Immortal');
  const first = comps(page).first();
  const team = (await first.locator('.comp-team').textContent())!.split(', ');
  // the second play, chosen on the Plays tab, is the one that prints
  await first.getByRole('tab', { name: 'Plays' }).click();
  const second = first.getByRole('listbox', { name: 'Plays on Breeze' }).getByRole('option').nth(1);
  const play = (await second.locator('.play-name').textContent())!;
  await second.click();
  await first.getByRole('button', { name: 'Print' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  // on screen nothing changes; on paper the sheet is all there is
  const sheet = page.locator('#print-sheet');
  await expect(sheet).toBeHidden();
  await page.emulateMedia({ media: 'print' });
  await expect(sheet).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
  await expect(sheet.getByRole('heading', { level: 1 })).toHaveText('Breeze, attack');
  await expect(sheet).toContainText('Immortal · five-stack');
  for (const name of team) await expect(sheet.locator('.sheet-team')).toContainText(name);
  await expect(sheet.locator('.sheet-plan')).toContainText('How it wins.');
  await expect(sheet.getByRole('heading', { name: 'Pros' })).toBeVisible();
  await expect(sheet.getByRole('heading', { name: `Play: ${play}`, exact: false })).toBeVisible();
  await expect(sheet.locator('.minimap .route').first()).toBeAttached();
  await expect(sheet.getByRole('heading', { name: 'Tips' })).toBeVisible();
  // dark text on white paper, even in the dark theme
  const ink = await sheet.locator('.sheet').evaluate((el) => getComputedStyle(el).color.match(/\d+/g)!.slice(0, 3).map(Number));
  expect(Math.max(...ink)).toBeLessThan(90);
  // on one page of A4 or Letter (only Chromium makes PDFs)
  if (browserName === 'chromium') for (const format of ['A4', 'Letter']) expect(pages(await page.pdf({ format })), format).toBe(1);
  // and once printing is done, it's put away
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => dispatchEvent(new Event('afterprint')));
  await expect(sheet.locator('.sheet')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('two comps compare side by side: fits, how each wins, what each covers, and where the lower one falls short', async ({ page, errors }) => {
  await open(page, 'planner');
  await chooseMap(page, 'Lotus');
  await question(page).getByRole('group', { name: 'Side' }).getByRole('button', { name: 'Defense' }).click();
  await settledAnswers(page);
  await comps(page).first().getByRole('button', { name: 'Compare' }).click();
  const d = page.getByRole('dialog', { name: 'Compare comps' });
  // the comp it opened from, beside the best other one
  await expect(d.getByRole('combobox', { name: 'First comp' })).toHaveValue('0');
  await expect(d.getByRole('combobox', { name: 'Second comp' })).toHaveValue('1');
  for (const which of ['First comp', 'Second comp']) await expect(d.getByRole('region', { name: which })).toContainText('How it wins.');
  await expect(d.getByRole('table')).toContainText('Smokes');
  await d.getByRole('combobox', { name: 'Second comp' }).selectOption('4');
  await expect(d.locator('.why-not')).toContainText(/^The second comp plays .+ instead of .+/);
  await expect(d.locator('.why-not')).toContainText('Where it falls short');
  const r = await new AxeBuilder({ page }).include('.dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  // the same comp on both sides says so
  await d.getByRole('combobox', { name: 'Second comp' }).selectOption('0');
  await expect(d).toContainText('Both sides show the same comp');
  await page.keyboard.press('Escape');
  await expect(d).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a smaller party says which choices no longer fit, instead of dropping them quietly', async ({ page, errors }) => {
  await open(page, 'planner');
  await chooseAgents(page, 'Agents the team must play', ['Jett', 'Omen', 'Sova', 'Killjoy']);
  await question(page).getByRole('group', { name: 'Controllers: how many' }).getByRole('button', { name: '2' }).click();
  await settledAnswers(page, 'two controllers');
  await question(page).getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Duo' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'A duo plays two agents, so Sova and Killjoy came off the list. The role counts don’t fit a duo, so they’re back to Any.' })).toBeVisible();
  await settledAnswers(page, 'duo · with Jett and Omen');
  await expect(question(page).getByRole('group', { name: 'Controllers: how many' }).getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('a five-stack says the teammates locked in came off, and a saved duo says which must-plays no longer fit', async ({ page, errors }) => {
  await open(page, 'planner');
  const size = question(page).getByRole('group', { name: 'Party size' });
  await size.getByRole('button', { name: 'Solo' }).click();
  await chooseAgents(page, 'Teammates locked in', ['Jett', 'Omen']);
  await settledAnswers(page, 'solo');
  await size.getByRole('button', { name: 'Five-stack' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'A five-stack has no random teammates, so Jett and Omen came off Teammates locked in.' })).toBeVisible();
  await settledAnswers(page, 'five-stack');
  // a saved duo, picked from the Saved party menu, can't keep four must-plays or two controllers either
  await go(page, 'saved/parties');
  await page.getByRole('button', { name: 'Make a party' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Make a party' });
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Night duo');
  await dialog.getByRole('button', { name: 'Make the party' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await go(page, 'planner');
  await chooseAgents(page, 'Agents the team must play', ['Jett', 'Omen', 'Sova', 'Killjoy']);
  await question(page).getByRole('group', { name: 'Controllers: how many' }).getByRole('button', { name: '2' }).click();
  await settledAnswers(page, 'two controllers');
  await question(page).getByRole('button', { name: 'Saved party' }).click();
  await page.getByRole('menuitem', { name: /Night duo/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'A duo plays two agents, so Sova and Killjoy came off the list. The role counts don’t fit a duo, so they’re back to Any.' })).toBeVisible();
  await settledAnswers(page, 'duo');
  expect(errors).toEqual([]);
});

test('changing how many comps to show takes effect on the Planner’s answer already there', async ({ page, errors }) => {
  await open(page, 'planner');
  await settledAnswers(page);
  await expect(comps(page)).toHaveCount(10);
  await page.evaluate(() => { location.hash = '#/settings/resultCount'; });
  const count = page.locator('input[aria-label="Comps to show"]');
  await count.fill('5');
  await count.press('Enter');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Planner' }).click();
  await settledAnswers(page);
  await expect(comps(page)).toHaveCount(5);
  expect(errors).toEqual([]);
});

test('the arrow keys move along a row of choices and through a list of plays, as Help → Keyboard says', async ({ page, errors }) => {
  await open(page, 'planner');
  const side = question(page).getByRole('group', { name: 'Side' });
  await tabTo(page, side.getByRole('button', { name: 'Attack' }));
  await page.keyboard.press('ArrowRight');
  await expect(side.getByRole('button', { name: 'Defense' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(side.getByRole('button', { name: 'Best' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(side.getByRole('button', { name: 'Both' })).toBeFocused();
  // focus moves, and Enter chooses
  await expect(side.getByRole('button', { name: 'Both' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(side.getByRole('button', { name: 'Defense' })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { location.hash = '#/maps/ascent/plays'; });
  const hits = page.getByRole('listbox', { name: 'Hits' });
  const first = hits.getByRole('option').first();
  await tabTo(page, first);
  await page.keyboard.press('ArrowDown');
  await expect(hits.getByRole('option').nth(1)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
  expect(errors).toEqual([]);
});

test('must-play agents are in every comp, and role counts are kept', async ({ page, errors }) => {
  await open(page, 'planner');
  await chooseMap(page, 'Bind');
  await chooseAgents(page, 'Agents the team must play', ['Jett', 'Omen']);
  await settledAnswers(page, 'with Jett and Omen');
  for (const names of await page.locator('.comps .comp-team').allTextContents()) {
    expect(names).toContain('Jett');
    expect(names).toContain('Omen');
  }
  // two controllers: Omen and one more in every comp
  await question(page).getByRole('group', { name: 'Controllers: how many' }).getByRole('button', { name: '2' }).click();
  await settledAnswers(page, 'two controllers');
  const controllers = ['Astra', 'Brimstone', 'Clove', 'Harbor', 'Miks', 'Viper'];
  for (const names of await page.locator('.comps .comp-team').allTextContents()) expect(controllers.filter((c) => names.includes(c))).toHaveLength(1);
  // a count that no longer fits gives way to the one just set
  await question(page).getByRole('group', { name: 'Sentinels: how many' }).getByRole('button', { name: '3' }).click();
  await expect(question(page).getByRole('group', { name: 'Controllers: how many' }).getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'true');
  await expect(question(page).getByRole('group', { name: 'Sentinels: how many' }).getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'true');
  await settledAnswers(page, 'three sentinels');
  // a third must-play agent leaves no room for three sentinels, and asking for them again says so
  await page.getByRole('button', { name: 'Agents the team must play: change' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sova', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  await settledAnswers(page, 'with Jett, Omen and Sova');
  await expect(answers(page)).not.toContainText('sentinels');
  await expect(question(page).getByRole('group', { name: 'Sentinels: how many' }).getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'true');
  await question(page).getByRole('group', { name: 'Sentinels: how many' }).getByRole('button', { name: '3' }).click();
  await expect(page.getByText('3 sentinels won’t fit beside the agents who must play.')).toBeVisible();
  await expect(question(page).getByRole('group', { name: 'Sentinels: how many' }).getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'true');
  // a left-out agent is never suggested, and Start over clears it all
  await chooseAgents(page, 'Agents to leave out', ['Sage']);
  await page.waitForTimeout(400);
  await settledAnswers(page);
  for (const names of await page.locator('.comps .comp-team').allTextContents()) expect(names).not.toContain('Sage');
  await question(page).getByRole('button', { name: 'Start over' }).click();
  await settledAnswers(page);
  await expect(question(page).getByRole('button', { name: 'Start over' })).toBeDisabled();
  await expect(answers(page).locator('h2').first()).toHaveText('Any map');
  expect(errors).toEqual([]);
});

test('their team: each comp says how it stands against the agents they play, and they can still be picked', async ({ page, errors }) => {
  await open(page, 'planner');
  await chooseMap(page, 'Breeze');
  await question(page).getByRole('group', { name: 'Side' }).getByRole('button', { name: 'Attack' }).click();
  await question(page).getByRole('combobox', { name: 'Rank' }).selectOption({ label: 'Immortal' });
  await chooseAgents(page, 'Agents the other team plays', ['Chamber', 'Jett', 'Viper']);
  await settledAnswers(page, 'against Chamber, Jett and Viper');
  const first = comps(page).first();
  await expect(first.getByRole('heading', { name: 'Against their team' })).toBeVisible();
  await expect(first.locator('.against-row').first()).toContainText('Their Chamber and Jett hold long angles with the Operator.');
  // both teams can play the same agent: Viper is still in the comps
  expect((await page.locator('.comps .comp-team').allTextContents()).some((n) => n.includes('Viper'))).toBe(true);
  const r = await new AxeBuilder({ page }).include('.against').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  // without their agents, the comps don't speak of them
  for (const name of ['Chamber', 'Jett', 'Viper']) await question(page).getByRole('button', { name: `Remove ${name}` }).click();
  await settledAnswers(page);
  await expect(page.locator('.answers-head')).not.toContainText('against');
  await expect(page.locator('.against')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a duo finds its best map: the maps are ranked and each one opens its picks', async ({ page, errors }) => {
  test.setTimeout(90_000);
  await open(page, 'planner');
  await question(page).getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Duo' }).click();
  await chooseMap(page, 'Find the best map');
  await settledAnswers(page);
  await expect(answers(page).locator('h2').first()).toHaveText('Best maps for you');
  const options = page.getByRole('listbox', { name: 'Situations, best first' }).getByRole('option');
  await expect(options).toHaveCount(7);
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  const sub = answers(page).locator('h2.answers-sub');
  const before = await sub.textContent();
  await options.nth(3).click();
  await expect(options.nth(3)).toHaveAttribute('aria-selected', 'true');
  await expect(sub).not.toHaveText(before ?? '');
  // a duo's pick names the two of you and the picks for your random teammates
  await expect(comps(page).first().locator('.comp-team')).toContainText(' with ');
  await expect(page.getByRole('tab', { name: 'Duo picks' })).toBeVisible();
  // the agents tab ranks every agent for the situation
  await page.getByRole('tab', { name: 'Agents' }).click();
  expect(await page.locator('.agent-row').count()).toBeGreaterThanOrEqual(25);
  expect(errors).toEqual([]);
});

test('a team finds the maps to play and to ban, each with why, and each opens its comps', async ({ page, errors }) => {
  test.setTimeout(90_000);
  await open(page, 'planner');
  await chooseMap(page, 'Find the best map');
  await settledAnswers(page);
  // with nothing chosen every map fits fully, so there's nothing to pick between
  await expect(page.locator('[data-tour="map-picks"]')).toHaveCount(0);
  await chooseAgents(page, 'Agents the team must play', ['Harbor', 'Killjoy']);
  await settledAnswers(page, 'with Harbor and Killjoy');
  const picks = page.getByRole('region', { name: 'Maps to play and to ban' });
  await expect(picks).toBeVisible();
  const play = picks.locator('.map-picks-col').first().locator('.map-pick'), ban = picks.locator('.map-picks-col.ban .map-pick');
  await expect(play).toHaveCount(2);
  expect(await ban.count()).toBeGreaterThanOrEqual(1);
  for (const li of [...await play.all(), ...await ban.all()]) expect(await li.locator('.map-pick-why li').count()).toBeGreaterThanOrEqual(1);
  // a map to ban shows the team's best comp there next to the best comp for the map
  await expect(ban.first().locator('.team-icons')).toHaveCount(2);
  // choosing a map shows its comps, and the best map in the list is the first to play
  const options = page.getByRole('listbox', { name: 'Situations, best first' }).getByRole('option');
  const first = (await play.first().locator('.map-pick-name b').textContent())!;
  await expect(options.first()).toContainText(first);
  const name = (await ban.first().locator('.map-pick-name b').textContent())!;
  await ban.first().locator('.map-pick-head').click();
  await expect(answers(page).locator('h2.answers-sub')).toHaveText(name);
  await expect(page.getByRole('listbox', { name: 'Situations, best first' }).getByRole('option', { selected: true })).toContainText(name);
  expect(errors).toEqual([]);
});

test('a duo’s best pick says which role to ask random teammates for, and how often they pick one', async ({ page, errors }) => {
  await open(page, 'planner');
  await question(page).getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Duo' }).click();
  await chooseMap(page, 'Ascent');
  await settledAnswers(page);
  // the picks for your random teammates, then what to expect if they pick on their own
  await expect(comps(page).first().locator('.party-box p').first()).toHaveText(/^Your party plays .+\. If your random teammates play .+, the team fits \d+ out of 100 \(the best five-stack is 100\)\. If they pick on their own, expect a team that fits about \d+, give or take \d+\.$/);
  const ask = comps(page).first().locator('.party-box p').nth(1);
  await expect(ask).toHaveText(/^Ask your teammates for (?:a (?:duelist|controller|sentinel)|an initiator) first\. They pick one on their own (?:in about \d+ of 10 games|in nearly every game|hardly ever), and with one, expect about \d+\./);
  expect(await ask.textContent()).not.toMatch(/\ba [aeiou]/i);
  expect(errors).toEqual([]);
});

test('teammates already locked in are part of every team and never in your party', async ({ page, errors }) => {
  await open(page, 'planner');
  // the first answers in place, so nothing moves under the click
  await settledAnswers(page, 'Any map');
  await question(page).getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Trio' }).click();
  await chooseAgents(page, 'Agents your teammates locked in', ['Jett', 'Omen']);
  await page.waitForTimeout(400);
  await settledAnswers(page);
  for (const li of await comps(page).all()) {
    const names = (await li.locator('.comp-team').textContent()) ?? '';
    const [party, rest] = names.split(' with ');
    expect(party).not.toMatch(/Jett|Omen/);
    expect(rest).toContain('Jett');
    expect(rest).toContain('Omen');
  }
  expect(errors).toEqual([]);
});

test('with one random teammate left to pick, the party box speaks of them as one, and the answers name who’s locked in', async ({ page, errors }) => {
  await open(page, 'planner');
  await settledAnswers(page, 'Any map');
  await question(page).getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Solo' }).click();
  await chooseAgents(page, 'Agents your teammates locked in', ['Jett', 'Omen', 'Sova']);
  await settledAnswers(page, 'solo · Jett, Omen and Sova locked in');
  const box = comps(page).first().locator('.party-box');
  await expect(box.locator('p').first()).toHaveText(/^You play .+\. If your random teammate plays [A-Z][\w/]+, the team fits \d+ out of 100/);
  await expect(box).not.toContainText('teammates play');
  await expect(box).not.toContainText('Ask your teammates');
  expect(errors).toEqual([]);
});

test('the question is kept: a reload brings back the same question and answers', async ({ page, errors }) => {
  await open(page, 'planner');
  await chooseMap(page, 'Lotus');
  await question(page).getByRole('group', { name: 'Side' }).getByRole('button', { name: 'Defense' }).click();
  await settledAnswers(page, 'Lotus, defense');
  const best = await comps(page).first().locator('.comp-team').textContent();
  await saved(page);
  await reload(page);
  await settledAnswers(page);
  await expect(answers(page).locator('h2').first()).toHaveText('Lotus, defense');
  await expect(comps(page).first().locator('.comp-team')).toHaveText(best ?? '');
  expect(errors).toEqual([]);
});

test('the Planner works from the keyboard alone', async ({ page, errors }) => {
  await open(page, 'planner');
  const mapButton = page.getByRole('button', { name: /^Map: .*\. Change$/ });
  await tabTo(page, mapButton);
  await page.keyboard.press('Enter');
  const listbox = page.getByRole('listbox', { name: 'Maps' });
  await expect(listbox).toBeVisible();
  const ascent = listbox.getByRole('option', { name: /^Ascent/ });
  await ascent.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // focus goes back to the button that opened the dialog
  await expect(mapButton).toBeFocused();
  await expect(mapButton).toHaveAccessibleName('Map: Ascent. Change');
  await settledAnswers(page, 'Ascent');
  // a comp opens and closes with Enter
  const head = comps(page).nth(1).locator('.comp-head');
  await head.focus();
  await page.keyboard.press('Enter');
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Enter');
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  // Escape closes the agent picker without changing anything
  await page.getByRole('button', { name: 'Agents the team must play: choose' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Agents the team must play: choose' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('opening a comp below the open one keeps its head where it was clicked', async ({ page, errors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, 'planner');
  await chooseMap(page, 'Haven');
  await settledAnswers(page);
  await expect(comps(page).first()).toHaveClass(/open/);
  const head = comps(page).nth(2).locator('.comp-head');
  await head.scrollIntoViewIfNeeded();
  const before = (await head.boundingBox())!.y;
  await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  expect(Math.abs((await head.boundingBox())!.y - before)).toBeLessThan(2);
  expect(errors).toEqual([]);
});

test('with fit scores as numbers off, the party box, Why not, Compare, Copy and Print name tiers instead', async ({ page, errors }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { copied: string[]; printed: number };
    w.copied = []; w.printed = 0;
    window.print = () => { w.printed++; };
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { w.copied.push(t); } } });
  });
  await open(page, 'settings/planner');
  const numbers = page.getByRole('switch', { name: 'Show fit scores as numbers' });
  await numbers.focus();
  await page.keyboard.press('Space');
  await expect(numbers).not.toBeChecked();
  await go(page, 'planner');
  await chooseMap(page, 'Ascent');
  await question(page).getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Solo' }).click();
  await settledAnswers(page, 'solo');
  // a fit said with a number: "fits 87", "fit 99", "about 83", "out of 100", "(91)"
  const said = /\bfits? (about )?\d|expect about \d|out of 100|\(\d+\)|give or take/i;
  const box = comps(page).first().locator('.party-box');
  await expect(box).toBeVisible();
  await expect(box.locator('p').first()).toHaveText(/^You play .+\. If your random teammates play .+, the team is tier [SABCD]\. If they pick on their own, expect a tier [SABCD] team\.$/);
  expect(await box.textContent()).not.toMatch(said);
  // the role to ask for names the team it makes the same way ("expect a tier A team")
  await expect(box.locator('p').nth(1)).toHaveText(/, and with one, expect a tier [SABCD] team\./);
  await expect(box.locator('.party-team .num').first()).toHaveText(/^Tier [SABCD]$/);
  await page.screenshot({ path: test.info().outputPath('party-box.png') });

  // Copy and Print say the tier
  const first = comps(page).first();
  await first.getByRole('button', { name: 'Copy' }).click();
  await page.getByRole('menuitem', { name: 'The whole plan' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Copied the plan.' })).toBeVisible();
  const text = await page.evaluate(() => (window as unknown as { copied: string[] }).copied[0] ?? '');
  expect(text).toMatch(/\nComp: .+\. Tier [SABCD]\.\n/);
  expect(text).not.toMatch(said);
  await first.getByRole('button', { name: 'Print' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  const sheet = page.locator('#print-sheet');
  await expect(sheet.locator('.sheet-fit')).toContainText(/Tier [SABCD]/);
  expect(await sheet.textContent()).not.toMatch(said);
  await page.evaluate(() => dispatchEvent(new Event('afterprint')));

  // a five-stack's Agents tab: Why not, and what an agent adds over the next best of their role
  await question(page).getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Five-stack' }).click();
  await settledAnswers(page, 'five-stack');
  await page.getByRole('tab', { name: 'Agents' }).click();
  const rows = page.locator('.agent-row');
  // open agents until one isn't in the best comp, so it has a Why not
  for (let i = 0; i < 12 && !(await page.locator('.why-not').count()); i++) await rows.nth(i).click();
  const why = page.locator('.why-not');
  await expect(why).toContainText(/^Why not .+ in the best comp\? .+’s best comp plays .+ instead of .+, and (fits as well as the best|is tier [SABCD], the same tier as the best comp|is tier [SABCD] where the best comp is tier [SABCD])\./);
  expect(await page.locator('.agent-more').textContent()).not.toMatch(/\d+ ahead of|do \d+ better|\bfits? \d|against \d/);
  await page.screenshot({ path: test.info().outputPath('why-not.png') });

  // Compare says the tiers too
  await page.getByRole('tab', { name: 'Comps', exact: true }).click();
  await comps(page).first().getByRole('button', { name: 'Compare' }).click();
  const d = page.getByRole('dialog', { name: 'Compare comps' });
  await d.getByRole('combobox', { name: 'Second comp' }).selectOption('4');
  await expect(d.locator('.why-not p').first()).toHaveText(/^The second comp plays .+ instead of .+, and (fits as well|is tier [SABCD] too|is tier [SABCD] where the first is tier [SABCD])\.$/);
  await page.keyboard.press('Escape');

  // a fit that's less sure says why, without how many points it could be off by
  await go(page, 'rankings');
  const hush = page.locator('.tier-agent').filter({ hasText: 'Hush' });
  await expect(hush).toHaveAttribute('data-tip', /This fit is less sure, since /);
  expect(await hush.getAttribute('data-tip')).not.toMatch(/off by|\bfit \d/);
  expect(errors).toEqual([]);
});

test('a newer question while one is still being worked out keeps the same worker, and gets its answer', async ({ page, errors }) => {
  // counts the workers the page starts and stops
  await page.addInitScript(() => {
    const w = window as unknown as { __workers: { made: number; ended: number } };
    w.__workers = { made: 0, ended: 0 };
    const Base = Worker;
    window.Worker = class extends Base {
      constructor(url: string | URL, o?: WorkerOptions) { super(url, o); w.__workers.made++; }
      override terminate() { w.__workers.ended++; super.terminate(); }
    };
  });
  await open(page, 'planner');
  await chooseMap(page, 'Find the best map');
  await question(page).getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Duo' }).click();
  await settledAnswers(page);
  const counts = () => page.evaluate(() => (window as unknown as { __workers: { made: number; ended: number } }).__workers);
  const start = await counts();
  // each rank asked while the one before is still being worked out (a duo's best map takes a second or so)
  const rank = question(page).getByRole('combobox', { name: 'Rank' });
  for (const r of ['Platinum', 'Diamond', 'Ascendant']) { await rank.selectOption({ label: r }); await page.waitForTimeout(250); }
  await rank.selectOption({ label: 'Immortal' });
  await settledAnswers(page, 'Immortal');
  expect(await counts()).toEqual(start);
  expect(errors).toEqual([]);
});
