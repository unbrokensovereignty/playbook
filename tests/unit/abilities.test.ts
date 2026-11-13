// Every ability the app names for a strength does what the sentence says it does: Sage slows a push
// with Slow Orb (Barrier Orb only walls it off), Jett's Tailwind is how she gets away after an
// Operator shot, and Reyna's Devour heals only Reyna. What each ability does comes from the
// game's own text (kb/effects.ts). The reasons, plans, swaps, threats, tips and plays are read for
// the pros' comps and hundreds of other teams on every map. Node only (too slow for the in-app
// self-test); the teams are the same on every run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelFor, viaIn, type Situation } from '../../src/core/engine/model.ts';
import { belowParts, explainTeam, PHASES, STRONG, type ExplainFor } from '../../src/core/engine/explain.ts';
import { fillPlay } from '../../src/core/engine/plays.ts';
import { tipsFor } from '../../src/core/engine/tips.ts';
import { AGENTS, agentById, type Agent } from '../../src/core/kb/agents.ts';
import { PLAIN, effectsOf, fitOf, namedFor, plainKeys, type Fit } from '../../src/core/kb/effects.ts';
import { RULES } from '../../src/core/kb/kitfit.ts';
import { abilityNames, abilityOn, kitOf } from '../../src/core/kb/kits.ts';
import { MAPS } from '../../src/core/kb/maps.ts';
import { PLAYS } from '../../src/core/kb/plays.ts';
import { PRO } from '../../src/core/kb/pro.ts';
import { PAIRS } from '../../src/core/kb/synergy.ts';
import { RANK_IDS } from '../../src/core/kb/ranks.ts';
import { DIMS, DIM_INFO, ROLE_IDS, type Dim } from '../../src/core/kb/roles.ts';

const none = (problems: string[]) => assert.deepEqual(problems.slice(0, 30), [], `${problems.length} problems:\n${problems.slice(0, 30).join('\n')}`);

/** A small, seeded random number source, so a failure can be run again. */
function random(seed: number) {
  let s = seed;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const some = <T>(xs: readonly T[], n: number): T[] => [...xs].sort(() => next() - 0.5).slice(0, n);
  return { next, some };
}

/** The pros' comps on a map, and teams with one of each role and an extra, so every agent turns up often. */
function teamsFor(map: string, r: ReturnType<typeof random>, n: number): string[][] {
  const out = (PRO[map]?.comps ?? []).map((c) => [...c]);
  const byRole = ROLE_IDS.map((role) => AGENTS.filter((a) => a.role === role).map((a) => a.id));
  for (let i = 0; i < n; i++) {
    const t = byRole.map((ids) => r.some(ids, 1)[0]!);
    out.push([...t, r.some(AGENTS.map((a) => a.id).filter((id) => !t.includes(id)), 1)[0]!]);
  }
  return out;
}

/** The key of an agent's ability by the name the app gives it ("Dark Cover", or "FRAG" for FRAG/ment). */
const keyOf = (id: string, name: string) => kitOf(id)?.abilities.find((x) => x.name === name || x.name.replace(/\s+\/\s.*$/, '') === name)?.key;
const fit = (id: string, name: string, d: Dim): Fit => { const k = keyOf(id, name); return k ? fitOf(id, k, d) : 'none'; };
const does = (f: Fit) => f === 'does' || f === 'also';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
/** The abilities of an agent a piece of text names. */
const namedIn = (text: string, a: Agent) => (kitOf(a.id)?.abilities ?? []).filter((x) => x.key !== 'Passive').map((x) => x.name)
  .filter((n) => new RegExp(`(?<![\\w’])${esc(n)}(?![\\w])`).test(text));
/** Whether an agent has an ability that does a strength outright (an ultimate only when it's all they have for it). */
const better = (a: Agent, keys: string, d: Dim, than: Fit) => [...keys].some((k) => k !== 'G' && k !== 'X' && (than === 'also' ? fitOf(a.id, k, d) === 'does' : does(fitOf(a.id, k, d))));

test('each ability does what it’s named for, from the game’s own text', () => {
  assert.ok(effectsOf('sage', 'Q').has('slow') && !effectsOf('sage', 'C').has('slow'), 'Slow Orb slows; Barrier Orb is a wall');
  assert.equal(fitOf('sage', 'Q', 'stall'), 'does');
  assert.equal(fitOf('sage', 'C', 'stall'), 'also', 'a wall slows a push, less directly');
  assert.equal(namedFor('sage', 'CQ', 'stall'), 'QC', 'Slow Orb first');
  assert.equal(fitOf('jett', 'E', 'angles'), 'escape', 'Tailwind is the way out after the shot');
  assert.equal(fitOf('reyna', 'Q', 'sustain'), 'self', 'Devour heals Reyna');
  assert.equal(fitOf('sage', 'E', 'sustain'), 'does');
  assert.equal(fitOf('kayo', 'E', 'recon'), 'does', 'ZERO/point tells the team who it suppressed');
  assert.equal(fitOf('omen', 'E', 'stall'), 'also');
  assert.equal(fitOf('omen', 'C', 'smoke'), 'none');
  assert.equal(namedFor('chamber', 'EX', 'angles'), 'EX', 'Rendezvous every round before Tour De Force');
  // the abilities a map's kit rules say do a strength there do it
  for (const r of RULES) for (const k of r.via ?? '') for (const d of Object.keys(r.bumps) as Dim[]) if ((r.bumps[d] ?? 0) > 0) assert.notEqual(fitOf(r.agent, k, d), 'none', `${r.agent} ${k} on ${r.map ?? r.mechanic}: does nothing for ${d}`);
  // every strength an agent brings has something to name, or is the gun
  for (const a of AGENTS) for (const [d, keys] of Object.entries(a.via) as [Dim, string][]) {
    assert.ok(namedFor(a.id, keys, d).length, `${a.name} ${d}: nothing in ${keys} does it`);
    for (const k of keys) if (k !== 'G') assert.notEqual(fitOf(a.id, k, d), 'none', `${a.name}’s ${abilityNames(a.id, k)[0]} does nothing for ${d}`);
  }
});

test('reasons, plans, swaps and threats name only abilities that do what they say', () => {
  const r = random(20261112);
  const problems: string[] = [];
  const ranks = ['iron', 'gold', 'immortal', 'radiant'] as const;
  for (const map of MAPS) for (const side of ['attack', 'defense'] as const) for (const rank of ranks) {
    const teams = teamsFor(map.id, r, 12);
    const enemy = teams[0]!;
    const s: Situation = { map: map.id, side, rank, sites: [], enemy };
    const m = modelFor(s);
    teams.forEach((team, ti) => {
      const agents = team.map((id) => agentById(id)!);
      const who: ExplainFor = ti % 3 === 1 ? { party: team.slice(0, 2) } : {};
      const e = explainTeam(m, team, who);
      const where = `${map.name} ${side} ${rank} [${agents.map((a) => a.name).join(', ')}]`;
      const no = (why: string) => problems.push(`${where}: ${why}`);
      const check = (line: string, d: Dim, ok: (f: Fit) => boolean = does) => {
        for (const a of agents) for (const n of namedIn(line, a)) if (!ok(fit(a.id, n, d))) no(`"${line}" names ${a.name}’s ${n} (${fit(a.id, n, d)}) for ${d}`);
      };
      for (const line of e.pros) {
        for (const d of DIMS) {
          const verb = [STRONG[d].one, STRONG[d].many].find((v) => new RegExp(` ${v}[,.]`).test(line));
          if (verb) check(line.split(` ${verb}`)[0]!, d);
        }
        const yours = /^Your (.+?) brings (.+?) with (.+)\.$/.exec(line);
        if (yours) {
          const a = agents.find((x) => x.name === yours[1])!, d = DIMS.find((x) => DIM_INFO[x].has === yours[2])!;
          if (!does(fit(a.id, yours[3]!, d))) no(`"${line}": ${yours[3]} is ${fit(a.id, yours[3]!, d)} for ${d}`);
        }
      }
      for (const line of e.cons) for (const d of DIMS) {
        const info = DIM_INFO[d];
        const only = line.startsWith(`${info.has.charAt(0).toUpperCase()}${info.has.slice(1)} ${info.few ? 'come' : 'comes'} only from `) || new RegExp(` bring only a (?:little|few) ${info.has}\\b`).test(line);
        if (only) check(line.split(/, so |\. [A-Z]/)[0]!, d, (f) => does(f) || f === 'self');
      }
      for (const line of e.cons) {
        const smoke = /block (?:them|the long sightlines) with (.+?)[,.]/.exec(line)?.[1];
        if (smoke) check(smoke, 'smoke');
        const flash = /(?:use (.+?) to take space|lean on (.+?) and close trades|open the first fight with (.+?) and keep)/.exec(line);
        if (flash) check(flash.slice(1).find(Boolean)!, 'flash');
      }
      // the plan: each part's ability does the strength, or the plan says how it helps
      for (const p of e.planParts) {
        if (!p.ability) continue;
        const a = agentById(p.agent)!, f = fit(a.id, p.ability, p.dim);
        if (f === 'none') no(`plan "${e.plan}": ${a.name}’s ${p.ability} does nothing for ${p.dim}`);
        if (f === 'escape' && !e.plan.includes(`with ${p.ability} to get away`)) no(`plan "${e.plan}": ${p.ability} is ${a.name}’s way out, not how they ${PHASES[p.phase][p.dim]}`);
        if (f === 'self' && !e.plan.includes(`stays in the fight with ${p.ability}`)) no(`plan "${e.plan}": ${p.ability} heals only ${a.name}`);
        if (f !== 'does' && better(a, viaIn(m, a, p.dim), p.dim, f)) no(`plan "${e.plan}": ${a.name} has better than ${p.ability} for ${p.dim}`);
      }
      // why another comp ranks lower: "Less information (Sova’s Recon Bolt)"
      if (ti > 0) for (const part of belowParts(m, teams[0]!, team)) {
        if (!(DIMS as readonly string[]).includes(part.key)) continue;
        const named = /\((.+)\)$/.exec(part.words)?.[1];
        if (named) check(named, part.key as Dim, (f) => does(f) || f === 'self');
      }
      // what answers the other team's threats
      for (const row of e.against) {
        const threat = m.threats.find((x) => x.threat.id === row.id)!.threat;
        for (const by of row.by) for (const a of agents) for (const n of namedIn(by, a)) {
          if (by === `${a.name}’s ${n}` && !(Object.keys(threat.needs) as Dim[]).some((d) => does(fit(a.id, n, d)) || fit(a.id, n, d) === 'self')) no(`threat ${row.id}: ${by} answers none of ${Object.keys(threat.needs).join(', ')}`);
        }
      }
    });
  }
  none(problems);
});

test('the tip for two initiators gives each the ability that does their job', () => {
  const problems: string[] = [];
  const initiators = AGENTS.filter((a) => a.role === 'initiator');
  const s: Situation = { map: 'ascent', side: 'attack', rank: 'gold', sites: [] };
  for (const a of initiators) for (const b of initiators) {
    if (a === b) continue;
    const tip = tipsFor([a.id, b.id, 'omen', 'jett', 'killjoy'], s).find((t) => t.about === 'Two initiators')!.text;
    const x = /^(.+?) finds the enemies with (.+?) and (.+?) (flashes them|stops them) with (.+?)\./.exec(tip);
    if (!x) continue;
    const f = agents(x[1]!), h = agents(x[3]!);
    if (!does(fit(f.id, x[2]!, 'recon'))) problems.push(`"${tip}": ${x[2]} doesn’t find anyone`);
    const d: Dim = x[4] === 'flashes them' ? 'flash' : 'disrupt';
    if (!does(fit(h.id, x[5]!, d))) problems.push(`"${tip}": ${x[5]} isn’t for ${d}`);
  }
  none(problems);
  function agents(name: string) { return AGENTS.find((a) => a.name === name)!; }
});

test('plays list the abilities that do each job, best first', () => {
  const r = random(1112);
  const problems: string[] = [];
  const all = new Map<string, string[][]>();
  for (const p of PLAYS) {
    if (!all.has(p.map)) all.set(p.map, teamsFor(p.map, r, 25));
    for (const team of all.get(p.map)!) for (const s of fillPlay(p, team).steps) for (const d of s.who) {
      if (d.value <= 0) continue;
      const a = agentById(d.id)!;
      // how well each does the job, the ultimate aside (it comes last, since most rounds don't have it)
      const best = (n: string) => d.dims.map((x) => fit(a.id, n, x)).sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y))[0]!;
      const fits = d.abilities.filter((n) => n !== 'gun play' && keyOf(a.id, n) !== 'X').map(best);
      if (d.abilities.some((n) => n !== 'gun play' && best(n) === 'none')) problems.push(`${p.name} (${p.map}), ${a.name} on ${d.job}: ${d.abilities.join(', ')}: one does nothing for ${d.dims.join('/')}`);
      const where = `${p.name} (${p.map}), ${a.name} on ${d.job}: ${d.abilities.join(', ')}`;
      for (let i = 1; i < fits.length; i++) if (ORDER.indexOf(fits[i]!) < ORDER.indexOf(fits[i - 1]!)) problems.push(`${where}: ${fits.join(', ')}, not best first`);
    }
  }
  none([...new Set(problems)]);
});
const ORDER: Fit[] = ['does', 'also', 'escape', 'self', 'none'];

/** The abilities of a team's agents a line names, as agent|ability ("Brimstone’s Sky Smokes" is his Sky Smoke). */
const mentions = (line: string, agents: readonly Agent[]) => agents.flatMap((a) => (kitOf(a.id)?.abilities ?? []).filter((x) => x.key !== 'Passive')
  .filter((x) => new RegExp(`(?<![\\w’])${esc(x.name)}s?(?![\\w])`).test(line)).map((x) => `${a.name}’s ${x.name}`));

test('no two pros make the same point: an ability is named once, and an agent who wins fights alone isn’t praised again for needing no help', () => {
  const r = random(1113);
  const problems: string[] = [];
  for (const map of MAPS) for (const side of ['attack', 'defense'] as const) for (const rank of RANK_IDS) {
    const s: Situation = { map: map.id, side, rank, sites: [] };
    const m = modelFor(s);
    teamsFor(map.id, r, 6).forEach((team, ti) => {
      const agents = team.map((id) => agentById(id)!);
      const e = explainTeam(m, team, ti % 3 === 1 ? { party: team.slice(0, 2) } : {});
      const where = `${map.name} ${side} ${rank} [${agents.map((a) => a.name).join(', ')}]`;
      const seen = new Map<string, string>();
      for (const line of e.pros) for (const x of new Set(mentions(line, agents))) {
        if (seen.has(x)) problems.push(`${where}: ${x} is in “${seen.get(x)}” and “${line}”`);
        else seen.set(x, line);
      }
      const alone = e.pros.find((l) => / wins? plenty of fights alone\b/.test(l)), help = e.pros.find((l) => / works? well without much teamwork\b/.test(l));
      for (const a of agents) if (alone && help && [alone, help].every((l) => new RegExp(`(?<![\\w/])${esc(a.name)}(?![\\w/])`).test(l))) problems.push(`${where}: “${alone}” and “${help}” both say ${a.name} needs no help`);
    });
  }
  none(problems);
});

test('a pair names its agents’ abilities by the game’s names, so the planner can tell when an earlier pro named one', () => {
  // "Viper’s mollies" is her Snake Bite, but only the name says so; the gun and moves that aren't abilities stay as they are
  const NOT_ABILITIES = /^(?:Operator|slide|entry)\b/;
  const problems: string[] = [];
  for (const p of PAIRS.filter((x) => x.strength > 0)) for (const id of [p.a, p.b]) {
    const a = agentById(id)!;
    for (const hit of p.why.matchAll(new RegExp(`(?<![\\w/])${esc(a.name)}’s (\\S.*)`, 'g'))) {
      const rest = hit[1]!;
      if (!NOT_ABILITIES.test(rest) && !(kitOf(id)?.abilities ?? []).some((x) => rest.startsWith(x.name))) problems.push(`${a.name} in “${p.why}”`);
    }
  }
  none(problems);
});

test('a con that says who brings a strength leaves nobody out: Sage’s Slow Orb is crowd control, and Fade’s Prowler is a flash', () => {
  const r = random(1114);
  const problems: string[] = [];
  for (const map of MAPS) for (const side of ['attack', 'defense'] as const) for (const rank of ['iron', 'gold', 'diamond', 'radiant'] as const) {
    const m = modelFor({ map: map.id, side, rank, sites: [] });
    for (const team of teamsFor(map.id, r, 10)) {
      const agents = team.map((id) => agentById(id)!);
      const where = `${map.name} ${side} ${rank} [${agents.map((a) => a.name).join(', ')}]`;
      for (const line of explainTeam(m, team).cons) for (const d of PLAIN) {
        const info = DIM_INFO[d];
        const nobody = line.startsWith(`Nobody brings ${info.lacks},`) || line.startsWith(`Nobody brings ${info.lacks}.`);
        const only = line.startsWith(`${capital(info.has)} ${info.few ? 'come' : 'comes'} only from `) || new RegExp(` bring only a (?:little|few) ${esc(info.has)}[,.]`).test(line);
        if (!nobody && !only) continue;
        // the abilities that do it, the ultimate aside (most rounds don't have it)
        for (const a of agents) for (const k of ['C', 'Q', 'E']) {
          const name = abilityOn(a.id, k)?.name;
          if (name && fitOf(a.id, k, d) === 'does' && !namedIn(line.split(/, so |\. [A-Z]/)[0]!, a).includes(name)) problems.push(`${where}: “${line}” leaves out ${a.name}’s ${name}`);
        }
      }
    }
  }
  none([...new Set(problems)]);
});
test('a con says nobody brings a plain strength only when no ability on the team does it, an ultimate included', () => {
  // (grading round 6: Icebox cards said nobody brings crowd control with Killjoy's Lockdown in the comp)
  const r = random(1115);
  const problems: string[] = [];
  let ult = 0;
  for (const map of MAPS) for (const side of ['attack', 'defense'] as const) for (const rank of ['iron', 'gold', 'diamond', 'radiant'] as const) {
    const m = modelFor({ map: map.id, side, rank, sites: [] });
    const teams = [...teamsFor(map.id, r, 10), ['jett', 'sova', 'viper', 'omen', 'killjoy']];
    for (const team of teams) {
      const agents = team.map((id) => agentById(id)!);
      for (const line of explainTeam(m, team).cons) for (const d of PLAIN) {
        const info = DIM_INFO[d];
        if (line.includes('an ultimate most rounds') || line.includes('ultimates most rounds')) ult++;
        if (!line.startsWith(`Nobody brings ${info.lacks},`) && !line.startsWith(`Nobody brings ${info.lacks}.`)) continue;
        for (const a of agents) for (const k of ['C', 'Q', 'E', 'X']) {
          const name = abilityOn(a.id, k)?.name;
          if (name && fitOf(a.id, k, d) === 'does') problems.push(`${map.name} ${side} ${rank} [${agents.map((x) => x.name).join(', ')}]: “${line}” with ${a.name}’s ${name}`);
        }
      }
    }
  }
  none([...new Set(problems)]);
  assert.ok(ult > 0, 'a strength only an ultimate brings is named as that');
});
test('a pro says an agent wins fights alone only when the gun or a basic ability does it, not an ultimate alone', () => {
  // (grading round 6: Veto, whose fights come from his Evolution ultimate, heard that he wins plenty of fights alone)
  const r = random(1116);
  const problems: string[] = [];
  for (const map of MAPS) for (const side of ['attack', 'defense'] as const) for (const rank of ['gold', 'immortal'] as const) {
    const m = modelFor({ map: map.id, side, rank, sites: [] });
    for (const team of [...teamsFor(map.id, r, 8), ['jett', 'sova', 'viper', 'omen', 'veto'], ['reyna', 'veto', 'fade', 'omen', 'killjoy']]) {
      for (const line of explainTeam(m, team).pros) {
        if (!new RegExp(`${STRONG.duel.one}|${STRONG.duel.many}`).test(line)) continue;
        for (const id of team) {
          const a = agentById(id)!;
          if (new RegExp(`\\b${a.name}\\b(?!’s)`).test(line.split(new RegExp(STRONG.duel.one + '|' + STRONG.duel.many))[0]!) && !/[^X]/.test(viaIn(m, a, 'duel'))) problems.push(`${map.name} ${side} ${rank}: “${line}” for ${a.name}`);
        }
      }
    }
  }
  none([...new Set(problems)]);
});
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

test('an agent whose basic ability does a plain strength has some of it in their numbers, so the score and the cons agree', () => {
  const problems: string[] = [];
  for (const a of AGENTS) for (const d of PLAIN) if (plainKeys(a.id, d) && !(a.caps[d] > 0)) problems.push(`${a.name} has ${abilityNames(a.id, plainKeys(a.id, d)).join(', ')} for ${d}, and no ${d} in agents.ts`);
  none(problems);
});

test('a line never names a strength as if it were one of an agent’s abilities, as in “Sage’s flank watch”', () => {
  // the words for a strength (DIM_INFO.has) after an agent's name stand in for an ability they don't
  // have; the sentinel advice on maps where pros rarely run one read "Let Sage’s flank watch watch the flank"
  const generic = new RegExp(`’s (?:${DIMS.map((d) => DIM_INFO[d].has).filter((h) => h && h !== 'gun play').join('|')})\\b`);
  const problems: string[] = [];
  const sentinels = AGENTS.filter((a) => a.role === 'sentinel' && !a.estimate).map((a) => a.id);
  for (const map of MAPS) for (const side of ['attack', 'defense', 'both'] as const) for (const rank of ['silver', 'ascendant', 'radiant'] as const) {
    const m = modelFor({ map: map.id, side, rank, sites: [] });
    for (const four of [['omen', 'sova', 'jett', 'raze'], ['viper', 'fade', 'neon', 'yoru']]) for (const s of sentinels) {
      const team = [s, ...four];
      const ex = explainTeam(m, team);
      for (const line of [ex.plan, ...ex.pros, ...ex.cons]) if (generic.test(line) || /\b(\w{3,}) \1\b/.test(line)) problems.push(`${map.name} ${side} ${rank} ${team.join(' ')}: ${line}`);
    }
  }
  none([...new Set(problems)]);
});
