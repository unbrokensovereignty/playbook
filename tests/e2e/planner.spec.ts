import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, open, overlaps, reload, saved, still, tabTo, test } from './app.ts';

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
