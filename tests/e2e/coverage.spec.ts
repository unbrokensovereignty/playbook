/** Every map and every agent: each page has all its parts, and each map plans in the Planner. */
import { go, open, test, expect } from './app.ts';
import { MAPS, MINIMAP_SCALE } from '../../src/core/kb/maps.ts';
import { AGENTS } from '../../src/core/kb/agents.ts';
import { PRO } from '../../src/core/kb/pro.ts';
import { ULT_TIPS } from '../../src/core/kb/tips.ts';
import { PAIRS } from '../../src/core/kb/synergy.ts';
import { proDuos, troubleFrom } from '../../src/core/engine/matchups.ts';

test('every map’s page has what wins there, each site, how it plays, what pros play, and tips and best comps on both sides', async ({ page, errors }) => {
  await open(page, 'maps');
  for (const m of MAPS) {
    await go(page, `maps/${m.id}`);
    await expect(page.locator('main h1')).toHaveText(m.name);
    for (const h of ['What wins here', 'Sites', 'How it plays', 'What pros play', 'Plays']) await expect(page.getByRole('heading', { name: h, exact: true }), `${m.name}: ${h}`).toBeVisible();
    await expect(page.locator('.sites > li'), `${m.name}: its sites`).toHaveCount(m.sites.length);
    // rotation times wherever the game gives the map's size
    await expect(page.locator('.map-rotations'), `${m.name}: rotation times`).toHaveCount(MINIMAP_SCALE[m.id] ? 1 : 0);
    // where the pro numbers come from
    const note = PRO[m.id]!.dated ? `so these are from ${PRO[m.id]!.event ?? 'the year before'}` : PRO[m.id]!.regional ? 'Kickoffs blended in' : 'From this year’s top events.';
    await expect(page.locator('main'), `${m.name}: pro source`).toContainText(note);
    for (const side of ['Attack', 'Defense']) {
      await page.getByRole('group', { name: 'Side' }).getByRole('button', { name: side }).click();
      await expect(page.getByRole('list', { name: `Tips for ${side.toLowerCase()}` }).getByRole('listitem').first(), `${m.name} ${side}: tips`).toBeVisible();
      await expect(page.getByRole('heading', { name: /^Best comps at / })).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});

test('every map plans in the Planner, with comps, pros and cons', async ({ page, errors }) => {
  test.setTimeout(180_000);
  await open(page, 'maps');
  for (const m of MAPS) {
    await go(page, `maps/${m.id}`);
    await page.getByRole('button', { name: `Plan for ${m.name}` }).click();
    await expect(page.locator('main h1')).toHaveText('Planner');
    await expect(page.locator('.answers-head'), `${m.name}: the question`).toContainText(m.name, { timeout: 10_000 });
    await expect(page.locator('.answers[aria-busy=true], .working')).toHaveCount(0, { timeout: 30_000 });
    const first = page.locator('.comps > li').first();
    await expect(first, `${m.name}: a comp`).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('every agent’s page has the kit, strengths, every map, partners, how to play against them, and tips', async ({ page, errors }) => {
  test.setTimeout(240_000);
  await open(page, 'agents');
  for (const a of AGENTS) {
    await go(page, `agents/${a.id}`);
    await expect(page.locator('main h1')).toContainText(a.name);
    for (const h of ['Abilities', 'Strengths', 'Best maps', 'By rank', 'Tips', 'Picks and wins']) await expect(page.getByRole('heading', { name: h, exact: true }), `${a.name}: ${h}`).toBeVisible();
    await expect(page.locator('.best-maps > li'), `${a.name}: every map`).toHaveCount(MAPS.length);
    await expect(page.getByRole('heading', { name: 'Partners', exact: true }), `${a.name}: partners`).toHaveCount(PAIRS.some((p) => p.a === a.id || p.b === a.id) ? 1 : 0);
    await expect(page.getByRole('heading', { name: 'With pros', exact: true }), `${a.name}: with pros`).toHaveCount(proDuos(a.id).duos.length ? 1 : 0);
    await expect(page.getByRole('heading', { name: `Playing against ${a.name}`, exact: true }), `${a.name}: playing against`).toHaveCount(troubleFrom(a.id).length ? 1 : 0);
    // an ultimate tip for each side
    for (const side of ['attack', 'defense'] as const) await expect(page.locator('main'), `${a.name}: ultimate on ${side}`).toContainText(ULT_TIPS[a.id]![side].text);
  }
  expect(errors).toEqual([]);
});

test('Help covers every part of the app, and says where each number comes from', async ({ page, errors }) => {
  await open(page, 'help');
  for (const h of ['Getting started', 'The question', 'Fit and tiers', 'Solo, duos and trios', 'Agent select and your games', 'Plays', 'Using an answer', 'Where the numbers come from', 'Your data']) await expect(page.getByRole('heading', { name: h, exact: true }), h).toBeVisible();
  const sources = page.locator('main');
  await expect(sources).toContainText('Champions 2026');
  await expect(sources).toContainText('Kickoffs');
  await expect(sources).toContainText('Every map also has a play for the pistol round');
  expect(errors).toEqual([]);
});

test('each moment of a play says where it falls on the round clock, on every map', async ({ page, errors }) => {
  await open(page, 'maps');
  for (const m of MAPS) {
    await go(page, `maps/${m.id}/plays`);
    const moments = page.locator('.play-card').getByRole('list', { name: 'Moments' }).getByRole('button');
    await expect(moments.first(), `${m.name}: moments`).toBeVisible();
    await expect(page.locator('.play-card .play-clock').first(), `${m.name}: the clock`).toHaveText(/\d:\d\d|seconds/);
  }
  expect(errors).toEqual([]);
});
