// Checks that nothing the app says about a comp contradicts the kits in it, over many questions:
// the best comps and random ones, on every pool map, side and a spread of ranks, some against a
// known team. Every agent a line names is in the comp, every ability it names belongs to that
// agent (and the kit word it uses, "Omen’s smokes", is one the kit has), a play gives a job to an
// agent with the tools for it or says the agent stands in, and the other team's answers are named
// by the abilities that answer them. How a comp wins names only strengths it covers well, and why a
// comp ranks below the best names what the swapped agents really bring, as does the line on what
// sets a comp apart. Pros, cons and notes have
// their own checks in benchmarks.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve } from '../../src/core/engine/plan.ts';
import { newQuery } from '../../src/core/engine/query.ts';
import { belowParts, explainTeam, PHASES, swapLine, whyBelow } from '../../src/core/engine/explain.ts';
import { listJoin } from '../../src/core/text.ts';
import { PLAN_NOTE } from '../../src/core/engine/weights.ts';
import { scoreTeam } from '../../src/core/engine/search.ts';
import { D, modelFor, viaIn, type Model, type SidePick, type Situation } from '../../src/core/engine/model.ts';
import type { RankId } from '../../src/core/kb/ranks.ts';
import { JOB_SKILLS, jobWords, playsFor } from '../../src/core/engine/plays.ts';
import { tipsFor } from '../../src/core/engine/tips.ts';
import { AGENTS, agentById, type Agent } from '../../src/core/kb/agents.ts';
import { PLURAL_ABILITIES, SINGULAR_ABILITIES_IN_S, abilityNames, kitOf } from '../../src/core/kb/kits.ts';
import { POOL } from '../../src/core/kb/maps.ts';
import { THREATS } from '../../src/core/kb/counters.ts';
import { DIMS, type Dim } from '../../src/core/kb/roles.ts';

const none = (problems: string[]) => assert.deepEqual([...new Set(problems)].slice(0, 40), [], `\n${[...new Set(problems)].slice(0, 40).join('\n')}`);

/**
 * Words a line may use for part of an agent's kit ("Omen’s smokes"), and the strengths the kit must
 * have for them to be true. A word not listed here, and not an ability's name, fails the test, so a
 * new way of saying it gets checked once.
 */
const KIT_WORDS: Record<string, readonly Dim[] | 'any'> = {
  smokes: ['smoke'], stars: ['smoke'], flash: ['flash'], flashes: ['flash'], stuns: ['disrupt'], pull: ['disrupt'], pulls: ['disrupt'], concussive: ['disrupt'],
  wall: ['wall', 'stall'], walls: ['wall', 'stall'], slows: ['stall'], mollies: ['clear', 'postplant', 'stall'], fire: ['clear', 'postplant', 'stall'],
  grenade: ['clear', 'disrupt'], thorns: ['stall', 'anchor'], reveals: ['recon'], information: ['recon'], darts: ['recon'], dog: ['recon'],
  trips: ['flank', 'anchor'], setup: ['anchor'], speed: ['mobility', 'entry'], dash: ['mobility', 'entry'], slide: ['mobility', 'entry'],
  stim: ['entry', 'mobility'], entry: ['entry'], Operator: ['angles'], gun: ['duel'], kit: 'any', ultimate: 'any', best: 'any',
};

/** What's wrong with each "Agent’s …" in a line, given who's in the comp and the situation. */
function possessives(line: string, team: readonly string[], m: Model): string[] {
  const bad: string[] = [];
  for (const x of line.matchAll(/(?<![A-Za-z])([A-Z][\w/]*)’s ([^,.:;()]+)/g)) {
    const a = AGENTS.find((y) => y.name === x[1]);
    if (!a) continue; // a map's name ("Lotus’s doors")
    const rest = x[2]!;
    if (!team.includes(a.id)) bad.push(`"${line}": ${a.name} isn't in the comp`);
    // one of a list ("about 40% of Astra’s and about 60% of Hush’s kits"): the word comes later
    if (!rest.trim() || rest.startsWith('and ')) continue;
    // an ability's name, which can start with the agent's own ("Viper’s Pit")
    const said = `${a.name}’s ${rest}`.replaceAll('’', "'");
    if (kitOf(a.id)!.abilities.some((k) => rest.startsWith(k.name.replace(/\s+\/\s.*$/, '')) || said.startsWith(k.name.replaceAll('’', "'")))) continue;
    const word = rest.split(' ')[0]!;
    const dims = KIT_WORDS[word];
    // what the agent brings here, kit rules and all
    const brings = (d: Dim) => 1 - m.miss[a.index * D + DIMS.indexOf(d)]! > 1e-9;
    if (!dims) bad.push(`"${line}": "${a.name}’s ${word}" is neither an ability nor a kit word`);
    else if (dims !== 'any' && !dims.some(brings)) bad.push(`"${line}": ${a.name} has no ${word}`);
  }
  return bad;
}
/** A small, seeded random number source, so a failure can be run again. */
function random(seed: number) {
  let s = seed;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return { next, some: <T>(xs: readonly T[], n: number): T[] => [...xs].sort(() => next() - 0.5).slice(0, n) };
}

/** The comps the checks look at: each situation's best three and three random ones. */
function cases(): { s: Situation; team: string[] }[] {
  const r = random(17);
  const ids = AGENTS.map((a) => a.id);
  const out: { s: Situation; team: string[] }[] = [];
  for (const map of [...POOL.map((m) => m.id), 'any']) {
    for (const side of ['attack', 'defense', 'both'] as SidePick[]) {
      for (const rank of ['iron', 'gold', 'platinum', 'immortal'] as RankId[]) {
        // some questions know the other team
        const enemy = r.next() < 0.35 ? r.some(ids, 5) : [];
        const s: Situation = { map, side, rank, sites: [], enemy };
        const a = solve({ ...newQuery(rank, true), map, side, enemy }, s, 3);
        for (const c of a.comps) out.push({ s, team: c.team });
        for (let i = 0; i < 3; i++) out.push({ s, team: r.some(ids, 5) });
      }
    }
  }
  return out;
}
const CASES = cases();

test('every agent and ability a comp’s pros, cons, notes and tips name is the comp’s own, in kit words that are true', () => {
  const problems: string[] = [];
  for (const { s, team } of CASES) {
    const m = modelFor(s);
    const e = explainTeam(m, team);
    const tips = tipsFor(team, s).map((t) => t.text);
    for (const line of [e.plan, ...e.pros, ...e.cons, ...e.notes, ...tips].filter(Boolean)) {
      problems.push(...possessives(line, team, m));
      // a comp that has only one of something has nothing "other than" it
      if (/\bother than\b/i.test(line)) problems.push(`"${line}": "other than"`);
    }
  }
  none(problems);
});

test('advice only leans on utility the comp has, named by the ability to use', () => {
  const problems: string[] = [];
  // the advice forms that lean on another strength, and that strength
  const LEANS: [RegExp, Dim][] = [[/lean on (.+?) and close trades/, 'flash'], [/open the first fight with (.+?) and keep/, 'flash'], [/use (.+?) to take space/, 'flash'], [/block (?:them|the long sightlines) with (.+?)[.,]/, 'smoke']];
  for (const { s, team } of CASES) {
    const m = modelFor(s);
    const e = explainTeam(m, team);
    for (const line of e.cons) {
      for (const [re, d] of LEANS) {
        const said = re.exec(line)?.[1];
        if (!said) continue;
        const [who, what] = said.split('’s ');
        const a = team.map((id) => agentById(id)!).find((x) => x.name === who);
        if (!a || !what || !abilityNames(a.id, viaIn(m, a, d)).includes(what)) problems.push(`"${line}": ${said} isn't a ${d} in the comp`);
        else if (e.strengths.find((r) => r.dim === d)!.cover < 0.55) problems.push(`"${line}": leans on ${d} the comp is short of`);
      }
      if (/\blean on (?:flashes|smokes|utility)\b|\bsmoke (?:them|the long sightlines) off\b|\buse utility\b/.test(line)) problems.push(`"${line}": leans on utility without naming it`);
    }
  }
  none(problems);
});

test('a play gives each job to an agent with the tools for it, or says what stands in', () => {
  const problems: string[] = [];
  for (const { s, team } of CASES) {
    if (s.map === 'any' || s.side === 'both') continue;
    for (const p of [...playsFor(team, s.map, s.side), ...playsFor(team, s.map, s.side, [], true)]) for (const step of p.steps) for (const d of step.who) {
      const a = agentById(d.id)!;
      const words = jobWords(d);
      const first = Object.keys(JOB_SKILLS[d.job][0]!) as Dim[];
      // nothing at all for the job says so
      if (d.value <= 0) { if (!words.endsWith(', without the utility for it')) problems.push(`${p.play.name}: ${a.name} "${words}" with nothing for it`); continue; }
      if (!d.standIn && !first.some((x) => a.caps[x] > 0)) problems.push(`${p.play.name}: ${a.name} "${words}" without any ${first.join(' or ')}`);
      if (d.standIn !== words.includes(' in place of ')) problems.push(`${p.play.name}: ${a.name} "${words}"`);
      const own = new Set(Object.values(a.via).flatMap((k) => abilityNames(a.id, k ?? '')));
      for (const n of d.abilities) if (n !== 'gun play' && !own.has(n)) problems.push(`${p.play.name}: ${a.name} has no ${n}`);
      if (/\bother than\b/i.test(words)) problems.push(`${p.play.name}: "${words}"`);
    }
  }
  none(problems);
});

test('against a known team, who answers each threat is named by an ability of theirs that answers it', () => {
  const problems: string[] = [];
  for (const { s, team } of CASES) {
    if (!s.enemy?.length) continue;
    const m = modelFor(s);
    for (const r of explainTeam(m, team).against) {
      const t = THREATS.find((x) => x.id === r.id)!;
      for (const b of r.by) {
        const [who, what] = b.split('’s ');
        const a: Agent | undefined = team.map((id) => agentById(id)!).find((x) => x.name === who);
        if (!a) { problems.push(`${r.id}: ${b} isn't in the comp`); continue; }
        const answers = (Object.keys(t.needs) as Dim[]).flatMap((d) => abilityNames(a.id, viaIn(m, a, d)));
        if (!answers.includes(what!) && !(what === 'gun play')) problems.push(`${r.id}: ${b} doesn't answer it (${answers.join(', ')})`);
      }
    }
  }
  none(problems);
});

test('how a comp wins names, for each part, an ability of an agent in it that brings that strength, and the comp covers it well', () => {
  const problems: string[] = [];
  let said = 0;
  for (const { s, team } of CASES) {
    const m = modelFor(s);
    const e = explainTeam(m, team);
    if (!e.plan) continue;
    said++;
    if (!e.planParts.length) problems.push(`"${e.plan}": no parts behind it`);
    for (const p of e.planParts) {
      const a = agentById(p.agent);
      if (!a || !team.includes(p.agent)) { problems.push(`"${e.plan}": ${p.agent} isn't in the comp`); continue; }
      if (!PHASES[p.phase][p.dim]) problems.push(`"${e.plan}": nothing to say about ${p.dim} in ${p.phase}`);
      if (p.ability && !abilityNames(a.id, viaIn(m, a, p.dim)).includes(p.ability)) problems.push(`"${e.plan}": ${a.name}’s ${p.ability} isn't what brings ${p.dim}`);
      if (!p.ability && !viaIn(m, a, p.dim).includes('G')) problems.push(`"${e.plan}": ${a.name} brings ${p.dim} with an ability it doesn't name`);
      if (e.strengths.find((r) => r.dim === p.dim)!.cover < PLAN_NOTE.cover) problems.push(`"${e.plan}": the comp is short of ${p.dim}`);
      if (!e.plan.includes(`${PHASES[p.phase][p.dim]}${p.ability ? ` with ${p.ability}` : ''}`) && !(p.dim === 'duel' && !p.ability && e.plan.includes('wins the gunfights'))) problems.push(`"${e.plan}": doesn't say ${p.dim}`);
    }
    // every agent the plan names has a part in it, and no other agent is named
    for (const a of AGENTS) if (new RegExp(`\\b${a.name.replace('/', '\\/')}\\b`).test(e.plan) !== e.planParts.some((p) => p.agent === a.id)) problems.push(`"${e.plan}": ${a.name} named without a part, or a part without the name`);
    // plain sentences: no "-ing" chains
    if (/\b\w+ing [^.,]+, \w+ing [^.,]+ and \w+ing\b/.test(e.plan)) problems.push(`"${e.plan}": a chain of -ing phrases`);
  }
  assert.ok(said > CASES.length / 2, 'most comps say how they win');
  none(problems);
});

test('why a comp ranks below the best names what the agents swapped out and in really bring', () => {
  const problems: string[] = [];
  let checked = 0;
  for (const { s, team } of CASES.filter((_, i) => i % 3 === 0)) {
    const m = modelFor(s);
    const best = solve({ ...newQuery(s.rank, true), map: s.map, side: s.side, enemy: [...(s.enemy ?? [])] }, s, 1).comps[0]!.team;
    if (best.join() === team.join()) continue;
    checked++;
    const why = whyBelow(m, best, team);
    if (!why.out.length || why.out.length !== why.in.length) problems.push(`${team.join()}: swaps ${why.out.join()} for ${why.in.join()}`);
    for (const [list, from] of [[why.loses, why.out], [why.gains, why.in]] as const) {
      for (const line of list) {
        const x = /^(?:Less|Fewer|More) .+? \(([A-Z][\w/]*)’s ([^)]+)\)$/.exec(line);
        if (!x) continue;
        const a = AGENTS.find((y) => y.name === x[1]);
        if (!a || !from.includes(a.id)) problems.push(`"${line}": ${x[1]} isn't one of the agents swapped`);
        else if (!Object.values(a.via).some((k) => [...abilityNames(a.id, k ?? ''), 'gun play'].includes(x[2]!))) problems.push(`"${line}": ${a.name} has no ${x[2]}`);
      }
    }
    // a comp well below the best always says where it falls short
    const score = (ids: readonly string[]) => scoreTeam(m, ids.map((id) => agentById(id)!.index));
    if (score(best) - score(team) >= 0.03 && !why.loses.length) problems.push(`${team.join()}: well below ${best.join()} with nothing it gives up`);
  }
  assert.ok(checked > 50);
  none(problems);
});

test('what sets a comp apart names its swap and a gain or loss that the score really has', () => {
  const problems: string[] = [];
  let checked = 0;
  for (const { s, team } of CASES.filter((_, i) => i % 3 === 0)) {
    const m = modelFor(s);
    const best = solve({ ...newQuery(s.rank, true), map: s.map, side: s.side, enemy: [...(s.enemy ?? [])] }, s, 1).comps[0]!.team;
    const line = swapLine(m, best, team);
    if (best.join() === team.join()) { if (line) problems.push(`${team.join()}: a line for the best comp itself`); continue; }
    checked++;
    const why = whyBelow(m, best, team);
    const names = (ids: readonly string[]) => listJoin(ids.map((id) => agentById(id)!.name));
    const swap = `${names(why.in)} for ${names(why.out)}`;
    if (!line.startsWith(swap)) { problems.push(`"${line}" doesn't start with "${swap}"`); continue; }
    const words = line.slice(swap.length).replace(/^ · /, '').split(', ').filter(Boolean);
    const parts = belowParts(m, best, team);
    if (words.length !== Math.min(1, parts.filter((p) => p.size > 0).length) + Math.min(1, parts.filter((p) => p.size < 0).length)) problems.push(`"${line}": not one gain and one loss from ${parts.length} parts`);
    if (/\b(?:more|fewer|less) [A-Z]/.test(line.replace(/Operator/g, 'operator'))) problems.push(`"${line}": a capital in the middle`);
  }
  assert.ok(checked > 50);
  none(problems);
});

test('every ability name that ends in an s is known to read as one thing or as several', () => {
  const problems: string[] = [];
  for (const a of AGENTS) {
    for (const name of abilityNames(a.id, 'CQEX')) {
      if (/[^s]s$/.test(name) && !PLURAL_ABILITIES.has(name) && !SINGULAR_ABILITIES_IN_S.has(name)) problems.push(`${a.name}’s ${name}: add it to PLURAL_ABILITIES or SINGULAR_ABILITIES_IN_S in kb/kits.ts`);
    }
  }
  none(problems);
});
