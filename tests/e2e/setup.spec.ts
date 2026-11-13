import AxeBuilder from '@axe-core/playwright';
import { expect, open, reload, saved, still, test } from './app.ts';

test('the first launch asks how you play, and the Planner, Rankings and Home start from the answers', async ({ page, errors }) => {
  await open(page, 'home', { setup: true });
  const setup = page.getByRole('dialog', { name: 'Welcome to Playbook' });
  await expect(setup).toBeVisible();
  await still(page);
  const r = await new AxeBuilder({ page }).include('[role=dialog]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  expect(r.violations.flatMap((v) => v.nodes.map((n) => `${v.id} at ${n.target.join(' ')}`))).toEqual([]);
  // the tour waits until it's answered
  await expect(page.getByRole('complementary', { name: 'Take the tour' })).toHaveCount(0);

  await setup.getByRole('combobox', { name: 'Your rank' }).selectOption({ label: 'Platinum' });
  await setup.getByRole('group', { name: 'How you queue' }).getByRole('button', { name: 'Solo' }).click();
  await setup.getByRole('button', { name: 'Agents you play: choose' }).click();
  const pick = page.getByRole('dialog', { name: 'Agents you play' });
  for (const n of ['Jett', 'Omen']) await pick.getByRole('button', { name: n, exact: true }).click();
  await pick.getByRole('button', { name: 'Done' }).click();
  await setup.getByRole('button', { name: 'Done' }).click();
  await expect(setup).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Take the tour' })).toBeVisible();

  // Home lists your agents at your rank
  const yours = page.locator('[data-tour=home-yours]');
  await expect(yours.getByRole('heading')).toHaveText('Your agents at Platinum');
  await expect(yours.locator('.list-row b')).toHaveText(['Jett', 'Omen']);
  await expect(yours.locator('.list-row small').first()).toContainText(/^Best on \w+ and \w+$/, { timeout: 30_000 });

  // the Planner starts solo at Platinum, with you on one of your agents
  await page.getByRole('link', { name: 'Planner' }).click();
  const q = page.getByRole('region', { name: 'Your situation' });
  await expect(q.getByRole('combobox', { name: 'Rank' })).toHaveValue('platinum');
  await expect(q.getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Solo' })).toHaveAttribute('aria-pressed', 'true');
  await expect(q.getByRole('switch', { name: /one of your agents/ })).toBeChecked();
  await expect(page.locator('.answers[aria-busy=true], .working')).toHaveCount(0, { timeout: 30_000 });
  for (const names of await page.locator('.comps .comp-team').allTextContents()) expect(names).toMatch(/^(Jett|Omen) with /);
  await expect(page.locator('.comp.open .party-box p').first()).toContainText(/^You play (Jett|Omen)\. If your random teammates play /);
  // off for one question, the Planner picks from everyone
  await q.locator('label.toggle', { hasText: 'one of your agents' }).click();
  await expect(q.getByRole('switch', { name: /one of your agents/ })).not.toBeChecked();
  await expect(page.locator('.answers[aria-busy=true], .working')).toHaveCount(0, { timeout: 30_000 });
  // (the answers can still be the last question's for a moment, so wait for the new ones)
  await expect.poll(() => page.locator('.comps .comp-team').count(), { timeout: 30_000 }).toBeGreaterThan(2);

  // Rankings starts on your rank and marks your agents
  await page.getByRole('link', { name: 'Rankings' }).click();
  await expect(page.getByRole('combobox', { name: 'Rank' })).toHaveValue('platinum');
  await expect(page.locator('.tier-agent.mine')).toHaveCount(2);
  expect((await page.locator('.tier-agent.mine .tier-agent-name').allTextContents()).sort()).toEqual(['Jett', 'Omen']);

  // and it isn't asked again
  await saved(page);
  await reload(page);
  await page.waitForTimeout(500);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('skipping the setup keeps the usual start, and it isn’t asked again', async ({ page, errors }) => {
  await open(page, 'planner', { setup: true });
  const setup = page.getByRole('dialog', { name: 'Welcome to Playbook' });
  await setup.getByRole('button', { name: 'Skip' }).click();
  await expect(setup).toHaveCount(0);
  const q = page.getByRole('region', { name: 'Your situation' });
  await expect(q.getByRole('combobox', { name: 'Rank' })).toHaveValue('gold');
  await expect(q.getByRole('group', { name: 'Party size' }).getByRole('button', { name: 'Five-stack' })).toHaveAttribute('aria-pressed', 'true');
  await expect(q.getByRole('switch', { name: /one of your agents/ })).toHaveCount(0);
  await saved(page);
  await reload(page);
  await page.waitForTimeout(500);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});
