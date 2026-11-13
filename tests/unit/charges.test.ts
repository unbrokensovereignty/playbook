// No play asks a player for more of their utility than they have in a round: Omen has one
// Paranoia, so he never flashes two corners. Every play on every map is filled with the pros'
// comps and hundreds of other teams, and each player's step is checked against their charges
// (kb/charges.ts): what's drawn on the map, what the sentence asks for, and "with flashes" said to
// someone with one. Node only (too slow for the in-app self-test); the teams are the same on every run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGENTS, agentById } from '../../src/core/kb/agents.ts';
import { CHARGES, reachesMore, usesOf } from '../../src/core/kb/charges.ts';
import { abilityOn } from '../../src/core/kb/kits.ts';
import { mapById } from '../../src/core/kb/maps.ts';
import { PLAYS, playsOn } from '../../src/core/kb/plays.ts';
import { PRO } from '../../src/core/kb/pro.ts';
import { AGENT_MAP_TIPS, AGENT_TIPS, ATTACK_TIPS, DEFENSE_TIPS } from '../../src/core/kb/tips.ts';
import { ROLE_IDS } from '../../src/core/kb/roles.ts';
import { fillPlay } from '../../src/core/engine/plays.ts';
import { askedCount, asksIn, fitText, needOf, useKind, usesFor } from '../../src/core/engine/uses.ts';
import { abilityNames } from '../../src/core/kb/kits.ts';

/** A small, seeded random number source, so a failure can be run again. */
function random(seed: number) {
  let s = seed;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const some = <T>(xs: readonly T[], n: number): T[] => [...xs].sort(() => next() - 0.5).slice(0, n);
  return { next, some };
}

/** The pros' comps, and teams with one of each role and an extra, so every agent ends up with every kind of job. */
function teams(): string[][] {
  const out = new Map<string, string[]>();
  const add = (t: readonly string[]) => out.set([...t].sort().join(), [...t]);
  for (const m of Object.values(PRO)) for (const c of m?.comps ?? []) add(c);
  const r = random(55);
  const byRole = ROLE_IDS.map((role) => AGENTS.filter((a) => a.role === role).map((a) => a.id));
  while (out.size < 600) {
    const t = byRole.map((ids) => r.some(ids, 1)[0]!);
    const rest = AGENTS.map((a) => a.id).filter((id) => !t.includes(id));
    add([...t, r.some(rest, 1)[0]!]);
  }
  return [...out.values()];
}

test('every agent has charges for each ability, and Astra’s share four Stars', () => {
  for (const a of AGENTS) {
    const c = CHARGES[a.id];
    assert.ok(c, `${a.name} has charges`);
    for (const k of ['C', 'Q', 'E'] as const) {
      assert.ok(abilityOn(a.id, k), `${a.name} has a ${k}`);
      assert.ok(Number.isInteger(c![k]) && c![k] >= 1 && c![k] <= 4, `${a.name} ${k}: ${c![k]}`);
    }
  }
  assert.equal(usesOf('omen', 'Q'), 1, 'one Paranoia');
  assert.equal(usesOf('omen', 'E'), 2, 'two Dark Covers');
  assert.equal(usesOf('brimstone', 'E'), 3, 'three Sky Smokes');
  assert.equal(usesOf('fade', 'EC'), 3, 'Haunt and two Prowlers');
  assert.equal(usesOf('astra', 'QC'), 4, 'four Stars in all');
  assert.equal(usesOf('tejo', 'E'), 2, 'one Guided Salvo, two missiles');
  assert.equal(usesOf('breach', 'EX'), 1, 'the ultimate counts only on its own');
  assert.equal(usesOf('vyse', 'X'), 1);
  assert.equal(usesOf('jett', 'G'), 0, 'a gun isn’t utility');
});

test('a sentence asks for one of each place it names for the job, and one for a choice', () => {
  const asked = (text: string, map: string, job: 'smoke' | 'flash' | 'clear' | 'wall' | 'stall', kind: 'smoke' | 'flash' | 'clear' | 'slow') => askedCount(asksIn(text, map, job, kind));
  assert.equal(asked('Flash A Elbow and A Alley as the team goes in, so whoever waits there is blind when you check it.', 'sunset', 'flash', 'flash'), 2);
  assert.equal(asked('Smoke Mid Market or Mid Cubby for the mid push.', 'ascent', 'smoke', 'smoke'), 1);
  assert.equal(asked('Smoke A Tower and A Link from A Lobby, then A Security once the site is taken.', 'abyss', 'smoke', 'smoke'), 3);
  assert.equal(asked('Smoke A Rafters (Heaven) and A Tree from A Lobby.', 'ascent', 'smoke', 'smoke'), 2);
  assert.equal(asked('Smoke Mid Market and the back of B Site from B Lobby.', 'ascent', 'smoke', 'smoke'), 2);
  assert.equal(asked('Flash B Danger and the site corners for the entry.', 'abyss', 'flash', 'flash'), 2);
  assert.equal(asked('Take A Elbow and the site with flashes.', 'sunset', 'flash', 'flash'), 2);
  assert.equal(asked('Take A Garden with flashes and push onto the site.', 'summit', 'flash', 'flash'), 1);
  assert.equal(asked('Flash over A Main and take A Wine, then the site.', 'ascent', 'flash', 'flash'), 1);
  assert.equal(asked('Flash and take A Short, then the site, checking A Cubby.', 'bind', 'flash', 'flash'), 0);
  assert.equal(asked('Wall down A Main to cut off A Tower and A Bridge while the team crosses.', 'abyss', 'wall', 'smoke'), 2);
  assert.equal(asked('Clear A Pipes and A Nest with utility.', 'icebox', 'clear', 'clear'), 2);
  assert.equal(asked('Slow A Short and A Bath with utility from A Lamps.', 'bind', 'stall', 'slow'), 2);
  // a step with two jobs that both work the places it names shares them
  assert.equal(needOf('haven', { jobs: ['recon', 'clear'], text: 'Clear A Yard, A Pocket and A Elbow with information and utility.' }, 'clear')('clear'), 0);
});

test('Omen, with one Paranoia, flashes one corner on Sunset’s anti-eco A play, and the step says the other goes without', () => {
  const p = playsOn('sunset', 'attack', ['A']).find((x) => x.name === 'Slow and together on A')!;
  const f = fillPlay(p, ['neon', 'fade', 'omen', 'sage', 'chamber'], 'radiant');
  const step = f.steps.find((s) => s.jobs.includes('flash'))!;
  const omen = step.who.find((d) => d.id === 'omen');
  if (omen) {
    assert.equal(step.throws.filter((t) => t.who === 'omen').length, 1, 'one flash drawn');
    assert.doesNotMatch(step.text, /A Elbow and A Alley/);
    assert.match(step.text, /^Flash A Elbow as the team goes in, .+\. Omen’s Paranoia has one charge, so A Alley goes without a flash\.$/);
  }
  for (const s of f.steps) for (const t of s.throws.filter((x) => x.kind === 'flash')) assert.ok(s.who.some((d) => d.id === t.who));
});

test('a step that asks twice, once a player’s charges run out on the first, says the second place goes without', () => {
  // Omen's one Paranoia goes on A Main, so A Garden, asked for after it, goes without
  const omen = agentById('omen')!;
  const text = fitText({ jobs: ['flash'], text: 'Flash A Main as the team walks in, then push on and flash A Garden.' }, 'ascent', omen, 'flash', ['flash']);
  assert.equal(text, 'Flash A Main as the team walks in, then push on. Omen’s Paranoia has one charge, so A Garden goes without a flash.');
});

test('no step on any map asks a player for more smokes, flashes, stuns, clearing or slowing utility than they have', () => {
  const problems: string[] = [];
  const all = teams();
  for (const p of PLAYS) for (const team of all) {
    const f = fillPlay(p, team);
    for (const s of f.steps) for (const d of s.who) {
      const kind = useKind(d.job, d.dims);
      if (!kind || d.value <= 0) continue;
      const a = agentById(d.id)!, uses = usesFor(a, d.job, d.dims);
      const where = `${mapById(p.map)!.name}, ${p.name}${p.branch ? ` (${p.branch.if})` : ''}, ${a.name} on ${d.job}`;
      const drawn = s.throws.filter((t) => t.who === d.id && t.kind !== 'wall').length;
      if (drawn > uses) problems.push(`${where}: ${drawn} drawn, has ${uses}`);
      const asked = needOf(p.map, s, d.job)(kind);
      if (asked > uses) problems.push(`${where}: “${s.text}” asks for ${asked}, has ${uses}`);
      if (uses === 1 && ((kind === 'flash' || kind === 'stun') ? /\bwith flashes\b/ : kind === 'smoke' ? /\b(with|your) smokes\b/ : /$^/).test(s.text)) problems.push(`${where}: “${s.text}” says more than one`);
    }
  }
  const unique = [...new Set(problems)];
  assert.deepEqual(unique.slice(0, 25), [], `${unique.length} steps ask for more than the player has`);
});

test('no agent’s tip asks for more smokes or flashes than their abilities hold', () => {
  const tips: { agent: string; map?: string; text: string }[] = [];
  for (const [map, by] of Object.entries(AGENT_MAP_TIPS)) for (const [agent, t] of Object.entries(by)) for (const text of typeof t === 'string' ? [t] : Object.values(t)) tips.push({ agent, map, text: text! });
  for (const [agent, t] of Object.entries(AGENT_TIPS)) for (const text of t) tips.push({ agent, text });
  for (const by of [ATTACK_TIPS, DEFENSE_TIPS]) for (const [agent, text] of Object.entries(by)) tips.push({ agent, text });
  const problems: string[] = [];
  for (const t of tips) {
    const a = agentById(t.agent)!;
    for (const kind of ['smoke', 'flash'] as const) {
      const keys = (a.via[kind] ?? '').replace(/[GX]/g, '');
      if (!keys) continue;
      const has = usesOf(a.id, keys), names = abilityNames(a.id, keys);
      // the places it names ("Smoke Mid Market and Mid Catwalk"), or two for a plural ("smoke the towers"),
      // and one more for one kept back ("then keep Dark Cover for the site")
      let asked = Math.max(t.map ? askedCount(asksIn(t.text, t.map, kind, kind)) : 0, new RegExp(`\\b${kind} the (?:\\w+ )?\\w+s\\b`, 'i').test(t.text) ? 2 : 0);
      if (asked && new RegExp(`\\b(?:keep|save) (?:one|another|the other|your (?:last|second)|${names.join('|')})\\b`).test(t.text)) asked++;
      if (asked > has) problems.push(`${a.name}${t.map ? ` on ${t.map}` : ''} asks for ${asked} ${kind}s and has ${has}: ${t.text}`);
      // an ability with one charge sent to several places at once
      for (const k of keys) if (CHARGES[a.id]![k as 'C' | 'Q' | 'E'] === 1 && !reachesMore(a.id, k)) {
        const n = abilityNames(a.id, k)[0]!;
        if (new RegExp(`\\b${n}\\b[^.]*?\\b(?:through|into|over|onto|down|across|at|on) the (?:\\w+ )?(?!walls)\\w+s\\b`).test(t.text)) problems.push(`${a.name}’s one ${n} goes to several places: ${t.text}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});
