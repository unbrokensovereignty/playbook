// Checks the engine against numbers from outside it, and checks that what it says is true.
//
// The benchmarks: pro play at Champions 2026 and Masters Santiago 2026 (kb/pro.ts) for the high
// ranks, and ranked win rates and low-rank tier lists (metabot.gg, winio.ai, October 2026) for the
// low ones. The truth checks read every pro, con and note the explanations give for hundreds of
// random teams and situations, and check each claim against the numbers behind it. Node only (too
// slow for the in-app self-test); the random teams are the same on every run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, teamFit } from '../../src/core/engine/plan.ts';
import { newQuery } from '../../src/core/engine/query.ts';
import { D, atRank, kitShare, modelFor, needsFor, viaIn, type Situation } from '../../src/core/engine/model.ts';
import { explainFor, explainTeam, STRONG, type ExplainFor } from '../../src/core/engine/explain.ts';
import { KIT_NOTE, OPERATOR_NOTE, PLAY_RANK, tierOf, TIERS, WIN_NOTE } from '../../src/core/engine/weights.ts';
import { AGENTS, agentById, type Agent } from '../../src/core/kb/agents.ts';
import { abilityNames } from '../../src/core/kb/kits.ts';
import { RULES, ruleWhy } from '../../src/core/kb/kitfit.ts';
import { MAPS, POOL, parseNeeds } from '../../src/core/kb/maps.ts';
import { MAP_WINS } from '../../src/core/kb/mapwins.ts';
import { LINEUPS } from '../../src/core/kb/lineups.ts';
import { PLAYED, PRO, proOverlap } from '../../src/core/kb/pro.ts';
import { RADIANT } from '../../src/core/kb/ranked.ts';
import { PAIRS } from '../../src/core/kb/synergy.ts';
import { RANK_IDS, rankOf, type RankId } from '../../src/core/kb/ranks.ts';
import { DIMS, DIM_INFO, ROLES, ROLE_IDS, type Role } from '../../src/core/kb/roles.ts';

const name = (id: string) => agentById(id)!.name;
const none = (problems: string[]) => assert.deepEqual(problems, [], `\n${problems.join('\n')}`);
const answers = new Map<string, ReturnType<typeof solve>>();
function answer(map: string, rank: RankId, side: Situation['side'] = 'both', keep = 3) {
  const key = [map, rank, side, keep].join('|');
  let a = answers.get(key);
  if (!a) answers.set(key, (a = solve({ ...newQuery(rank, true), map, side }, { map, side, rank, sites: [] }, keep)));
  return a;
}
/** The most agents a team shares with any comp pros played on the map at the events (or a typical one, for a map with an earlier year's numbers). */
const overlap = (map: string, team: readonly string[]) => Math.max(0, ...(PLAYED[map]?.map((c) => c.agents) ?? PRO[map]!.comps).map((c) => c.filter((id) => team.includes(id)).length));

test('at Immortal and Radiant, the best comp on each pool map is close to a comp pros play', () => {
  const problems: string[] = [];
  for (const rank of ['immortal', 'radiant'] as const) {
    let sum = 0;
    for (const m of POOL) {
      const best = answer(m.id, rank).comps[0]!.team;
      const shared = overlap(m.id, best);
      sum += shared;
      if (shared < 4) problems.push(`${rank} ${m.name}: ${best.map(name).join(', ')} shares only ${shared} with a pro comp`);
      // an agent pros pick on nearly every map of it belongs in the best comp at Radiant
      if (rank === 'radiant') for (const [id, pct] of Object.entries(PRO[m.id]!.picks)) if (pct >= 90 && !best.includes(id)) problems.push(`radiant ${m.name}: no ${name(id)} (picked on ${pct}%)`);
    }
    const mean = sum / POOL.length;
    if (mean < 4.4) problems.push(`${rank}: the best comps share ${mean.toFixed(2)} agents with a pro comp on average`);
  }
  none(problems);
});

test('at Radiant, the Operator players and the controller counts follow pro play', () => {
  const problems: string[] = [];
  // Chamber was picked on 57–69% of these maps at Champions 2026, Jett on 56% of Breeze's at Santiago
  for (const [map, id] of [['summit', 'chamber'], ['sunset', 'chamber'], ['haven', 'chamber'], ['lotus', 'chamber'], ['breeze', 'jett']] as const) {
    if (!answer(map, 'radiant').comps.slice(0, 3).some((c) => c.team.includes(id))) problems.push(`${map}: no ${name(id)} in the top three`);
  }
  // pros ran one controller on Sunset and Summit, and two on Lotus and Abyss
  for (const [map, n] of [['sunset', 1], ['summit', 1], ['lotus', 2], ['abyss', 2]] as const) {
    const best = answer(map, 'radiant').comps[0]!.team;
    const got = best.filter((id) => agentById(id)!.role === 'controller').length;
    if (got !== n) problems.push(`${map}: ${got} controllers in ${best.map(name).join(', ')}, where pros run ${n}`);
  }
  none(problems);
});

test('the comps pros played most on each map fit well there at Radiant', () => {
  const problems: string[] = [];
  const min = (tier: string) => TIERS.find((x) => x.id === tier)!.min;
  for (const [map, list] of Object.entries(PLAYED)) {
    const fitOf = (agents: readonly string[]) => teamFit({ map, side: 'both', rank: 'radiant', sites: [] }, agents, true).fit;
    // the comp played most there, and every comp more than one team played on three maps or more
    const top = list[0]!;
    if (top.teams > 1 && fitOf(top.agents) < min('A')) problems.push(`${map}: ${top.agents.map(name).join(', ')}, the most played, fits ${Math.round(fitOf(top.agents))}`);
    for (const c of list.filter((x) => x.teams > 1 && x.maps >= 3)) {
      if (fitOf(c.agents) < min('B')) problems.push(`${map}: ${c.agents.map(name).join(', ')}, played on ${c.maps} maps by ${c.teams} teams, fits ${Math.round(fitOf(c.agents))}`);
    }
  }
  none(problems);
});

test('low-rank tiers follow ranked results: easy winners high, hard team agents low', () => {
  const problems: string[] = [];
  const tiers = (rank: RankId) => new Map(answer('any', rank, 'both', 1).agents.map((x) => [x.id, x]));
  const order = TIERS.map((x) => x.id);
  const at = (rank: RankId, ids: string[], test: (place: number) => boolean, want: string) => {
    const t = tiers(rank);
    for (const id of ids) {
      const x = t.get(id)!;
      if (!test(order.indexOf(x.tier))) problems.push(`${rank}: ${name(id)} is ${x.tier} (${Math.round(x.fit)}), not ${want}`);
    }
  };
  // easy agents with the best ranked win rates
  at('iron', ['reyna', 'phoenix', 'sage', 'clove'], (p) => p <= order.indexOf('A'), 'A or better');
  at('gold', ['clove', 'jett', 'sage', 'phoenix'], (p) => p <= order.indexOf('B'), 'B or better');
  // hard or team-dependent kits with low ranked win rates
  at('gold', ['kayo', 'breach', 'harbor', 'astra'], (p) => p >= order.indexOf('C'), 'C or lower');
  at('iron', ['astra', 'harbor'], (p) => p >= order.indexOf('C'), 'C or lower');
  none(problems);
});

/** A small, seeded random number source, so a failure can be run again. */
function random(seed: number) {
  let s = seed;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!;
  const some = <T>(xs: readonly T[], n: number): T[] => [...xs].sort(() => next() - 0.5).slice(0, n);
  return { next, pick, some };
}

const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five'];
const pct = (x: number) => `${Math.round(x)}%`;
/** The average pick's win rate at Radiant (kb/ranked.ts). */
const RADIANT_MEAN = (() => { const rows = Object.values(RADIANT); return rows.reduce((t, [p, w]) => t + p * w, 0) / rows.reduce((t, [p]) => t + p, 0); })();

/** Every claim in a team's explanation that doesn't hold, in words. */
function untrue(s: Situation, team: readonly string[], who: ExplainFor = {}): string[] {
  const m = modelFor(s);
  const e = explainTeam(m, team, who);
  const agents = team.map((id) => agentById(id)!);
  const row = (d: string) => e.strengths.find((r) => r.dim === d)!;
  const count = (r: Role) => agents.filter((a) => a.role === r).length;
  const t = rankOf(s.rank).t;
  const map = MAPS.find((x) => x.id === s.map);
  const bad: string[] = [];
  type Kind = 'pro' | 'con' | 'note';
  const tag = (kind: Kind) => (l: string): [Kind, string] => [kind, l];
  const lines = [...e.pros.map(tag('pro')), ...e.cons.map(tag('con')), ...e.notes.map(tag('note'))];
  for (const [kind, line] of lines) {
    const no = (why: string) => bad.push(`${kind} "${line}": ${why}`);
    // "only a little smokes": things you count come in a few
    for (const d of DIMS) if (DIM_INFO[d].few && line.includes(`a little ${DIM_INFO[d].has}`)) no(`a little ${DIM_INFO[d].has}`);
    if (!/[.]$/.test(line) || line.includes('!') || /undefined|NaN|\$\{/.test(line)) no('not a plain sentence');
    // only the team's own agents are named
    for (const a of AGENTS) if (!team.includes(a.id) && new RegExp(`(?<![A-Za-z])${a.name.replace('/', '\\/')}(?![A-Za-z])`).test(line)) no(`names ${a.name}, who isn't in the team`);
    for (const d of DIMS) {
      const info = DIM_INFO[d], r = row(d);
      const here = (a: Agent) => 1 - m.miss[a.index * D + DIMS.indexOf(d)]! > 1e-9;
      const bring = agents.filter(here);
      // a pro for a strength the comp has plenty of: the agents it names bring it
      const verb = [STRONG[d].one, STRONG[d].many].find((v) => new RegExp(` ${v}[,.]`).test(line));
      const spread = line.startsWith(`Between them, the team has plenty of ${info.has}`) && /^[,.]/.test(line.slice(`Between them, the team has plenty of ${info.has}`.length));
      if (kind === 'pro' && (verb || spread)) {
        if (r.cover < 0.8 || r.need < 1) no(`${d} covers ${r.cover.toFixed(2)} at need ${r.need.toFixed(2)}`);
        const who = verb ? line.split(` ${verb}`)[0]! : '';
        for (const a of agents) if (who.includes(a.name) && !r.by.some((b) => b.id === a.id && b.value >= 0.45)) no(`${a.name} doesn't bring ${d}`);
      }
      if (kind !== 'con') continue;
      // a gap: nobody brings it, or only these do (all of them named, by ability), or the comp is light on it
      const nobody = line.startsWith(`Nobody brings ${info.lacks}`) && /^[,]/.test(line.slice(`Nobody brings ${info.lacks}`.length));
      const lead = `${info.has.charAt(0).toUpperCase()}${info.has.slice(1)} ${info.few ? 'come' : 'comes'} only from `;
      const little = new RegExp(`^(.+) bring only a (?:little|few) ${info.has}(?:\\. [A-Z][^.]*? needs more)?, so `).exec(line)?.[1];
      const only = line.startsWith(lead) ? line.slice(lead.length).split(/(?:, so |\. [A-Z][^.]*? needs more, so )/)[0]! : little ?? '';
      const thinOnly = !!only && !little && (line.includes(', so once ') || line.includes(' goes down, ') || line.includes(' go down, '));
      // the thinnest spot of a strength named by player (Operator play) names who plays it
      if (thinOnly && info.unnamed) for (const a of agents) if (only.includes(a.name) && !r.by.some((b) => b.id === a.id && b.value >= 0.6)) no(`${a.name} doesn't play ${d}`);
      if (little && only.split(/, | and /).length < 3) no(`only ${only} bring a little ${d}`);
      const light = line.startsWith(`The comp is light on ${info.lacks},`);
      if (nobody || light || (only && !thinOnly)) {
        if (r.cover >= 0.55 || r.need < 0.9) no(`${d} covers ${r.cover.toFixed(2)} at need ${r.need.toFixed(2)}`);
        if (nobody && bring.length) no(`${bring.map((a) => a.name).join(', ')} bring some ${d}`);
        if ((light || only) && !bring.length) no(`nobody brings ${d}`);
        // a strength whose bits aren't what the name means (a teleport isn't Operator play) names nobody
        if (info.unnamed && only) no(`${d}: names ${only}, though a con about it names nobody`);
        if (!info.unnamed && light) no(`${d}: says nothing of what ${bring.map((a) => a.name).join(', ')} bring`);
        if (only) for (const a of agents) {
          // firepower names the agent, as a pro does, and the rest name an agent's abilities together ("Vyse’s Razorvine and Steel Garden")
          const said = d === 'duel' ? new RegExp(`(?<![\\w’/])${a.name.replace(/[/]/g, '\\/')}(?![\\w’/])`).test(only) : only.includes(`${a.name}’s`);
          let group = only.slice(Math.max(0, only.indexOf(`${a.name}’s `)));
          for (const b of agents) if (b !== a && group.indexOf(`${b.name}’s `) > 0) group = group.slice(0, group.indexOf(`${b.name}’s `));
          if (said && !here(a)) no(`${a.name} brings no ${d}`);
          if (said && d !== 'duel' && !abilityNames(a.id, viaIn(m, a, d)).some((n) => group.includes(n.replace(new RegExp(`^${a.name}’s `), ''))) && !group.includes('gun play')) no(`${a.name}'s ability for ${d} isn't the one named`);
          if (!said && here(a) && bring.length <= 3) no(`${a.name} brings some ${d} too`);
        }
      }
      if (thinOnly && (r.cover >= 0.8 || r.need < 1)) no(`${d} covers ${r.cover.toFixed(2)}`);
      // the thinnest spot names everyone who brings some of it too: "only Sova’s Shock Bolt" is wrong
      // with Phoenix’s Hot Hands in the comp (grading round 7)
      if (thinOnly && !info.unnamed && d !== 'duel' && bring.length <= 3) for (const a of agents) if (here(a) && !only.includes(`${a.name}’s`)) no(`${a.name} brings some ${d} too`);
      if (line.startsWith(`The comp is thinnest on ${info.lacks},`) && (r.cover >= 0.8 || r.need < 1)) no(`${d} covers ${r.cover.toFixed(2)}`);
    }
    for (const role of ROLES) {
      if ((line.startsWith(`With no ${role.name.toLowerCase()}`) || line.startsWith(`If no one picks an ${role.name.toLowerCase()}`) || line.startsWith(`If no one picks a ${role.name.toLowerCase()}`)) && count(role.id) !== 0) no(`the team has ${count(role.id)}`);
      const many = new RegExp(`^(Three|Four|Five) ${role.plural.toLowerCase()} `).exec(line);
      if (many && NUMBERS.indexOf(many[1]!.toLowerCase()) !== count(role.id)) no(`the team has ${count(role.id)}`);
      const mix = new RegExp(`^(?:Pro teams on (.+?) (?:usually run (\\w+) (?:${role.name}|${role.plural})\\b|rarely run an? ${role.name}\\b)|(Few|Only about half the) pro teams on (.+?) run an? ${role.name}\\b)`, 'i').exec(line);
      if (mix) {
        const want = m.mix.want[ROLE_IDS.indexOf(role.id)]!;
        if ((mix[1] ?? mix[4]) !== map?.name) no('another map');
        const fits = mix[2] ? NUMBERS.indexOf(mix[2]) === Math.round(want) && want >= 0.6 : mix[3] === 'Few' ? want >= 0.3 && want < 0.4 : mix[3] ? want >= 0.4 && want < 0.6 : want < 0.3;
        if (!fits) no(`pros run ${want.toFixed(2)}`);
        if (mix[2] ? count(role.id) === Math.round(want) : count(role.id) === 0) no(`the team has ${count(role.id)}`);
        const has = /, so with (\w+), /.exec(line)?.[1];
        if (has && NUMBERS.indexOf(has) !== count(role.id)) no(`the team has ${count(role.id)}`);
      }
    }
    if (line === `Pro teams play this comp on ${map?.name}.` && proOverlap(map!.id, team) !== 5) no('not a pro comp');
    if (line === `Four of these five are in a comp pro teams play on ${map?.name}.` && proOverlap(map!.id, team) !== 4) no(`${proOverlap(map!.id, team)} in common`);
    // ranked win rates: the right way round, and the numbers the knowledge base has
    const win = /win(?:s)? (more|fewer) ranked games than most agents \((.+?)\)/.exec(line);
    if (win) {
      const named = agents.filter((a) => line.split(' win')[0]!.includes(a.name));
      if (!named.length) no('names nobody');
      for (const a of named) {
        // Radiant's own rate, where that's the one quoted: against the average pick there
        const top = RADIANT[a.id];
        if (top && win[2]!.includes(`${pct(top[1])} at Radiant`) && (named.length === 1 || win[2]!.includes(`${a.name} ${pct(top[1])} at Radiant`))) {
          if (!s.party || s.party === 5) no(`a five-stack's answer quotes ${a.name}'s rate at Radiant`);
          if (win[1] === 'more' ? top[1] <= RADIANT_MEAN : top[1] >= RADIANT_MEAN) no(`${a.name} wins ${top[1]}% at Radiant`);
          continue;
        }
        if (win[1] === 'more' ? a.win <= 50 : a.win >= 50) no(`${a.name} wins ${a.win}%`);
        if (!win[2]!.includes(pct(a.win))) no(`${a.name}'s rate is ${pct(a.win)}`);
      }
    }
    // the practice a kit takes, as the score counts it
    if (/takes? practice to play well/.test(line)) {
      for (const a of agents.filter((x) => line.split(' take')[0]!.includes(x.name))) {
        const k = atRank(s.rank, (x) => kitShare(a, x));
        if (kitShare(a, 0) >= KIT_NOTE.hard || t > KIT_NOTE.upTo) no(`${a.name} isn’t one of the hard kits, keeping ${pct(100 * k)} of it`);
        // the pick is one the score keeps part of, so the words say a part of it
        if (k > 0.9) no(`${a.name} keeps ${pct(100 * k)} of the kit, which isn't "only part"`);
      }
    }
    // what a party's own agent brings, said when no other pro is about them
    const yours = /^Your (.+?) brings (.+?)(?: with (.+))?\.$/.exec(line);
    if (yours) {
      const a = agents.find((x) => x.name === yours[1]), d = DIMS.find((x) => DIM_INFO[x].has === yours[2]);
      if (!a || !d) no('names no agent or strength');
      else {
        if (!who.party?.includes(a.id)) no(`${a.name} isn't the party's`);
        if (!row(d).by.some((b) => b.id === a.id && b.value >= 0.45)) no(`${a.name} brings too little ${d}`);
        if (yours[3] && !abilityNames(a.id, viaIn(m, a, d)).includes(yours[3])) no(`${yours[3]} isn't how ${a.name} brings ${d}`);
      }
    }
    if (/work(?:s)? well without much teamwork/.test(line)) for (const a of agents.filter((x) => line.split(' work')[0]!.includes(x.name))) if (a.solo < 0.8) no(`${a.name} needs the team`);
  }
  return bad;
}

test('what the explanations say is true, for random teams and for the best comps', () => {
  const r = random(20261029);
  const ids = AGENTS.map((a) => a.id);
  const problems: string[] = [];
  const check = (s: Situation, team: readonly string[], who: ExplainFor = {}) => {
    for (const p of untrue(s, team, who)) problems.push(`${s.map} ${s.side} ${s.rank}${who.party ? ` party ${who.party.join('+')}` : ''} [${team.map(name).join(', ')}] ${p}`);
  };
  for (let n = 0; n < 400; n++) {
    const map = r.pick(['any', ...MAPS.map((m) => m.id)]);
    const m = MAPS.find((x) => x.id === map);
    // a five-stack half the time, and otherwise a solo player, a duo or a trio with random teammates
    const party = r.pick([1, 2, 3, 5, 5, 5] as const);
    const s: Situation = { map, side: r.pick(['attack', 'defense', 'both'] as const), rank: r.pick(RANK_IDS), sites: m && r.next() < 0.3 ? [r.pick(m.sites).id] : [], ...(party === 5 ? {} : { party }) };
    // a party's answer, which leads with its own agents, is checked as the party sees it
    const team = r.some(ids, 5);
    check(s, team, party === 5 ? {} : { party: team.slice(0, party) });
    if (n % 8 === 0) {
      const c = solve({ ...newQuery(s.rank, true), map: s.map, side: s.side, sites: [...s.sites], party }, s, 1).comps[0]!;
      check(s, c.team, party === 5 ? {} : { party: c.party });
    }
  }
  none(problems.slice(0, 40));
});

test('what a comp says about how many of a role pro teams run matches the lineups they played', () => {
  // (grading round 3: "pro teams on Corrode rarely run a sentinel", where 7 of the 14 lineups there ran one)
  const r = random(20261112);
  const ids = AGENTS.map((a) => a.id);
  const problems: string[] = [];
  for (const map of MAPS) {
    const teams = LINEUPS.filter((l) => l.map === map.id).flatMap((l) => l.teams.map((t) => t.agents));
    if (!teams.length) continue;
    /** The share of the pro lineups on the map whose count of a role passes a test. */
    const share = (role: Role, ok: (n: number) => boolean) => teams.filter((t) => ok(t.filter((id) => agentById(id)!.role === role).length)).length / teams.length;
    for (const rank of ['gold', 'platinum', 'immortal'] as const) for (const side of ['attack', 'defense'] as const) {
      const m = modelFor({ map: map.id, side, rank, sites: [] });
      for (let n = 0; n < 40; n++) for (const line of explainTeam(m, r.some(ids, 5)).cons) for (const role of ROLES) {
        const no = (why: string) => problems.push(`${map.name} ${side} at ${rank}: ${why}: "${line}"`);
        const name = role.name.toLowerCase(), some = share(role.id, (c) => c > 0), none = 1 - some;
        const said = (re: string) => new RegExp(re.replace('ROLE', `an? ${name}\\b`), 'i').test(line);
        if (said('pro teams on [^,]+? rarely run ROLE') && some >= 0.3) no(`${pct(100 * some)} of the lineups ran one`);
        if (said('^few pro teams on [^,]+? run ROLE') && some >= 0.4) no(`${pct(100 * some)} of the lineups ran one`);
        if (said('about half the pro teams on [^,]+? run ROLE') && Math.abs(some - 0.5) > 0.15) no(`${pct(100 * some)} of the lineups ran one`);
        // and a sentinel most pro teams there skip comes with what to do with the one the comp has
        if (role.id === 'sentinel' && said('^(?:pro teams on [^,]+? rarely|few pro teams on [^,]+?|only about half the pro teams on [^,]+?) run ROLE') && !/\. [A-Z][^.]+\.$/.test(line)) no('no word on how to play it');
        const without = new RegExp(`\\b${name} \\((.+?) pro teams play [^,]+? without one too\\)`).exec(line)?.[1];
        if (without && !(without === 'most' ? none >= 0.6 : without === 'about half the' ? Math.abs(none - 0.5) <= 0.15 : false)) no(`${pct(100 * none)} of the lineups ran none`);
        const usually = new RegExp(`usually run (\\w+) (?:${name}|${role.plural.toLowerCase()})\\b`).exec(line)?.[1];
        if (usually && share(role.id, (c) => c === NUMBERS.indexOf(usually)) < 0.5) no(`only ${pct(100 * share(role.id, (c) => c === NUMBERS.indexOf(usually)))} of the lineups ran ${usually}`);
      }
    }
  }
  none([...new Set(problems)].slice(0, 30));
});

test('a con that says a pick struggles here says how to play around it', () => {
  // (grading round 3: "Sage’s Barrier Orb can’t wall off Breeze’s wide ways in" on a comp that plays
  // Sage, and "pros rarely run a sentinel" with nothing on what to do about it)
  const r = random(20261113);
  const problems: string[] = [];
  let seen = 0;
  const costs = RULES.filter((x) => Object.values(x.bumps).some((v) => v < 0));
  const clashes = PAIRS.filter((p) => p.strength < 0);
  for (const map of MAPS) for (const side of ['attack', 'defense', 'both'] as const) for (const rank of ['silver', 'platinum'] as const) {
    const m = modelFor({ map: map.id, side, rank, sites: [] });
    const teams = [...costs.map((x) => x.agent), ...clashes.flatMap((p) => [p.a, p.b])].map((id) => [id, ...r.some(AGENTS.map((a) => a.id).filter((x) => x !== id), 4)]);
    for (const p of clashes) teams.push([p.a, p.b, ...r.some(AGENTS.map((a) => a.id).filter((x) => x !== p.a && x !== p.b), 3)]);
    for (const team of teams) for (const line of explainTeam(m, team).cons) {
      const why = [...costs.map((x) => ruleWhy(x, map.id)), ...clashes.map((p) => p.why)].find((w) => line.includes(w));
      if (!why) continue;
      seen++;
      // the reason, then what to do about it
      const rest = line.slice(line.indexOf(why) + why.length).trim();
      if (!/^[A-Z][^.]+\.$/.test(rest)) problems.push(`${map.name} ${side} at ${rank}: "${line}"`);
    }
  }
  assert.ok(seen > 200, `only ${seen} such cons`);
  none([...new Set(problems)].slice(0, 30));
});

test('a pro never credits an agent with what a con says the map takes from their kit', () => {
  // (grading round 3: "Jett and Phoenix win plenty of fights alone, and Breeze rewards that" next to
  // "Breeze’s long sightlines keep most fights out of their reach" for Phoenix's kit)
  const r = random(20261114);
  const problems: string[] = [];
  let seen = 0;
  const costs = RULES.filter((x) => Object.values(x.bumps).some((v) => v < 0));
  for (const map of MAPS) for (const side of ['attack', 'defense', 'both'] as const) for (const rank of ['silver', 'gold', 'diamond'] as const) {
    const m = modelFor({ map: map.id, side, rank, sites: [] });
    for (const id of new Set(costs.map((x) => x.agent))) for (let k = 0; k < 3; k++) {
      const team = [id, ...r.some(AGENTS.map((a) => a.id).filter((x) => x !== id), 4)];
      const e = explainTeam(m, team);
      for (const rule of costs.filter((x) => team.includes(x.agent) && e.cons.some((line) => line.includes(ruleWhy(x, map.id))))) {
        seen++;
        const name = agentById(rule.agent)!.name;
        for (const d of Object.keys(rule.bumps).filter((x) => rule.bumps[x as keyof typeof rule.bumps]! < 0) as (keyof typeof STRONG)[]) {
          const says = [STRONG[d].one, STRONG[d].many, `brings ${DIM_INFO[d].has}`];
          for (const line of e.pros) if (line.includes(name) && says.some((w) => line.includes(w))) problems.push(`${map.name} ${side} at ${rank}: "${line}" with "${ruleWhy(rule, map.id)}"`);
        }
      }
    }
  }
  assert.ok(seen > 200, `only ${seen} such cons`);
  none([...new Set(problems)].slice(0, 30));
});

test('a pro about ranked win rates names nobody who loses most of their games on that map', () => {
  // (grading round 3: "Phoenix and Sage win more ranked games than most agents (Phoenix 52%…)" on
  // Corrode, where Phoenix's team won 47.5% of its games)
  const r = random(20261115);
  const problems: string[] = [];
  let seen = 0;
  for (const map of MAPS.filter((x) => MAP_WINS[x.id])) for (const side of ['attack', 'defense'] as const) for (const rank of ['silver', 'gold', 'platinum', 'diamond'] as const) {
    const m = modelFor({ map: map.id, side, rank, sites: [] });
    for (const a of AGENTS.filter((x) => !x.estimate)) {
      const line = explainTeam(m, [a.id, ...r.some(AGENTS.map((x) => x.id).filter((x) => x !== a.id), 4)]).pros.find((x) => x.includes('more ranked games than most agents'));
      if (!line) continue;
      seen++;
      for (const b of AGENTS) {
        const [won, games] = MAP_WINS[map.id]!.agents[b.id] ?? [50, 0];
        if (new RegExp(`\\b${b.name}\\b`).test(line.slice(0, line.indexOf(' win'))) && won < 50 && games >= WIN_NOTE.games) problems.push(`${map.name} ${side} at ${rank}: "${line}" (${b.name} ${won}% over ${games} games there)`);
      }
    }
  }
  assert.ok(seen > 200, `only ${seen} such pros`);
  none([...new Set(problems)].slice(0, 30));
});

test('a pair that counts on one side reads as one sentence when both sides are asked for', () => {
  // "On attack, Two setup sentinels add little on attack." said the side twice, with a capital in the middle
  const problems: string[] = [];
  const m = modelFor({ map: 'ascent', side: 'both', rank: 'immortal', sites: [] });
  let seen = 0;
  for (const p of PAIRS.filter((x) => x.side !== 'both')) {
    const names = [p.a, p.b].flatMap((id) => [name(id), ...abilityNames(id, 'CQEX').map((n) => n.replace(/^.*?’s /, ''))]);
    const line = [...explainTeam(m, [p.a, p.b, ...AGENTS.map((a) => a.id).filter((id) => id !== p.a && id !== p.b).slice(0, 3)]).pros, ...explainTeam(m, [p.a, p.b, 'omen', 'sova', 'jett'].filter((id, i, all) => all.indexOf(id) === i).slice(0, 5)).cons].find((l) => l.includes(p.why));
    if (line) seen++;
    const says = /\bon (?:attack|defense)\b/.test(p.why);
    if (!says && !names.some((n) => p.why.startsWith(n))) problems.push(`${p.a}+${p.b}: "${p.why}" can't follow "On ${p.side}, "`);
    if (line && (line.match(/\bon (?:attack|defense)\b/gi) ?? []).length > 1) problems.push(line);
  }
  assert.ok(seen > 5, `only ${seen} pairs seen`);
  none(problems);
});

test('advice for one side is given only on that side', () => {
  // (grading round 3: defense cons ending "cross open ground fast and together, or take a covered way in")
  const r = random(20261114);
  const ids = AGENTS.map((a) => a.id);
  const only = { attack: /cross open ground fast|a covered way in|before (?:planting|the plant)|commit to a site early|hold the planted Spike/i, defense: /when you retake|stop the plant|rotate early on information|before a retake/i };
  const problems: string[] = [];
  for (const map of MAPS) for (const side of ['attack', 'defense'] as const) for (const rank of RANK_IDS) {
    const m = modelFor({ map: map.id, side, rank, sites: [] });
    const other = side === 'attack' ? 'defense' : 'attack';
    for (let n = 0; n < 12; n++) for (const line of explainTeam(m, r.some(ids, 5)).cons) if (only[other].test(line)) problems.push(`${map.name} ${side} at ${rank}: "${line}"`);
  }
  none([...new Set(problems)].slice(0, 20));
});

test('a duo or trio hears a pro about each of its own agents', () => {
  // (grading round 3: a trio of Jett, Astra and Killjoy whose pros were about Jett and the locked Reyna and Skye)
  const r = random(20261115);
  const problems: string[] = [];
  for (let n = 0; n < 120; n++) {
    const map = r.pick(MAPS), party = r.pick([1, 2, 3] as const), rank = r.pick(RANK_IDS), side = r.pick(['attack', 'defense'] as const);
    const s: Situation = { map: map.id, side, rank, sites: [], party };
    const c = solve({ ...newQuery(rank, true), map: map.id, side, party }, s, 1).comps[0]!;
    const m = modelFor(s);
    const e = explainTeam(m, c.team, { party: c.party });
    for (const id of c.party) {
      const a = agentById(id)!;
      // one who brings something the situation needs, as the reasons count it
      if (!e.strengths.some((x) => x.need >= 0.8 && x.by.some((b) => b.id === id && b.value >= 0.45))) continue;
      if (!e.pros.some((l) => new RegExp(`(?<![\\w/])${a.name.replace(/[/]/g, '\\/')}(?![\\w/])`).test(l))) problems.push(`${map.name} ${side} at ${rank}, party ${c.party.map(name).join('+')}: nothing on ${a.name}: ${e.pros.join(' | ')}`);
    }
  }
  none(problems.slice(0, 20));
});

test('a duo or trio that plays both controllers itself hears that two need a team that plays together only where a five-stack would', () => {
  // (grading round 4: a trio of Sova, Viper and Omen on Icebox at Ascendant heard that most teams
  // there don't play their smokes together; the party smokes together as well as a five-stack at
  // its rank, so it hears what that five-stack would)
  const problems: string[] = [];
  let told = 0, quiet = 0;
  for (const map of ['icebox', 'split', 'bind', 'abyss'] as const) for (const party of [2, 3] as const) for (const rank of ['gold', 'platinum', 'diamond', 'ascendant'] as const) {
    const s: Situation = { map, side: 'attack', rank, sites: [], party };
    const c = solve({ ...newQuery(rank, true), map, side: 'attack', party, roles: { controller: 2 } }, s, 1).comps[0]!;
    const says = (e: ReturnType<typeof explainTeam>) => e.cons.some((l) => l.startsWith('Two controllers pay off only'));
    const theirs = says(explainTeam(modelFor(s), c.team, { party: c.party }));
    const five = says(explainTeam(modelFor({ ...s, party: undefined }), c.team));
    if (theirs !== five) problems.push(`${map} at ${rank}, party ${c.party.map(name).join('+')}: ${theirs ? 'told' : 'not told'}, where a five-stack ${five ? 'is' : 'isn’t'}`);
    if (theirs) told++; else quiet++;
  }
  none(problems);
  assert.ok(told > 0 && quiet > 0, `${told} told, ${quiet} not`);
});

test('a card warns about a role nobody plays only where the score pays for having none', () => {
  // (grading round 4: solo players on Haven and Summit heard "if no one picks an initiator" on teams
  // the engine ranks best, since random teams without one win as often as any, RANKED_ROLE)
  const problems: string[] = [];
  let seen = 0;
  for (const map of MAPS) for (const party of [1, 2, 3, 5] as const) for (const rank of ['silver', 'platinum', 'ascendant'] as const) for (const side of ['attack', 'defense'] as const) {
    const s: Situation = { map: map.id, side, rank, sites: [], party };
    const m = modelFor(s);
    const c = solve({ ...newQuery(rank, true), map: map.id, side, party }, s, 1).comps[0]!;
    const e = explainTeam(m, c.team, { party: c.party });
    ROLE_IDS.forEach((r, ri) => {
      if (c.team.some((id) => agentById(id)!.role === r)) return;
      seen++;
      const said = e.cons.find((l) => new RegExp(`^(If no one picks an? |With no )${r}\\b`).test(l));
      if (said && m.roleCost[ri * 5]! >= 0) problems.push(`${map.name} ${side} at ${rank}, party of ${party}: ${said}`);
    });
  }
  assert.ok(seen > 20, `only ${seen} teams without a role`);
  none(problems);
});

test('an agent your party won\u2019t play, picked by a random teammate, comes with a word on why', () => {
  // (grading round 3: a solo player asked for no Neon and found Neon among the likely teammates)
  const problems: string[] = [];
  let seen = 0;
  for (const map of POOL) for (const party of [1, 2, 3] as const) {
    const rank = 'radiant' as const, side = 'defense' as const;
    const s: Situation = { map: map.id, side, rank, sites: [], party };
    const first = solve({ ...newQuery(rank, true), map: map.id, side, party }, s, 1).comps[0]!;
    const out = first.team.find((id) => !first.party.includes(id));
    if (!out) continue;
    const q = { ...newQuery(rank, true), map: map.id, side, party, exclude: [out] };
    const c = solve(q, s, 1).comps[0]!;
    if (!c.team.includes(out) || c.party.includes(out)) continue;
    seen++;
    const e = explainTeam(modelFor(s), c.team, explainFor(q, c));
    if (!e.notes.some((l) => l.includes(name(out)))) problems.push(`${map.name} party of ${party}, won't play ${name(out)}: ${e.notes.join(' | ') || 'no notes'}`);
  }
  assert.ok(seen > 5, `only ${seen} answers kept the agent`);
  none(problems);
});

test('a map’s numbers from an earlier year don’t pull an agent released since, either way', () => {
  // Icebox's pro numbers are from 2025, before Veto and Miks came out, so neither counts against them
  for (const id of ['veto', 'miks']) for (const rank of ['diamond', 'radiant'] as const) {
    const m = modelFor({ map: 'icebox', side: 'both', rank, sites: [] });
    assert.equal(m.fitParts.pro[agentById(id)!.index], 0, `${name(id)} at ${rank}`);
  }
});

test('the tiers on screen come from the fit the rankings sort by', () => {
  const problems: string[] = [];
  for (const rank of ['iron', 'gold', 'radiant'] as const) {
    for (const x of answer('any', rank, 'both', 1).agents) if (x.tier !== tierOf(x.fit)) problems.push(`${rank} ${name(x.id)}: ${x.tier} at ${x.fit}`);
  }
  none(problems);
});

test('below Platinum, every hard kit in a comp gets the practice warning, one the player must play too', () => {
  // a must-play is the player's call, but they still hear that the rank gets only part of the kit
  // (claims hush-hard and neon-silver; grading round 3, Hush at Silver with no word on it)
  const problems: string[] = [];
  const hard = AGENTS.filter((a) => kitShare(a, 0) < KIT_NOTE.hard && !a.estimate);
  for (const rank of ['iron', 'silver', 'gold'] as const) for (const map of POOL) for (const a of hard) {
    const s: Situation = { map: map.id, side: 'attack', rank, sites: [] };
    const m = modelFor(s);
    const team = solve({ ...newQuery(rank, true), map: map.id, side: 'attack', include: [a.id] }, s, 1).comps[0]!.team;
    for (const who of [{ chosen: [a.id] }, { chosen: [a.id], party: [a.id] }] as ExplainFor[]) {
      const cons = explainTeam(m, team, who).cons;
      if (!cons.some((c) => / takes? practice to play well/.test(c) && new RegExp(`(?<![\\w/])${a.name.replace(/[/]/g, '\\/')}(?![\\w/])`).test(c))) problems.push(`${map.name} at ${rank}, ${who.party ? 'solo' : 'five-stack'} must play ${a.name}: ${cons.join(' | ')}`);
    }
  }
  none(problems);
});

test('a defense isn’t told an extra sentinel makes it slow to take space, and below Platinum isn’t told off for a second one', () => {
  // taking space is the attack's job; on defense two sentinels lock sites down, which wins rounds
  // from Silver to Gold (claim gold-sentinel; grading round 5, Corrode at Gold and Platinum)
  const problems: string[] = [];
  for (const rank of ['silver', 'gold', 'platinum', 'diamond'] as const) for (const m of MAPS) for (const side of ['attack', 'defense'] as const) {
    const s: Situation = { map: m.id, side, rank, sites: [] };
    for (const c of solve({ ...newQuery(rank, true), map: m.id, side, roles: { sentinel: 2 } }, s, 3).comps) {
      for (const con of explainTeam(modelFor(s), c.team).cons) {
        if (!/extra sentinel/.test(con)) continue;
        if (side === 'defense' && /take space/.test(con)) problems.push(`${m.name} defense at ${rank}: "${con}"`);
        if (side === 'defense' && RANK_IDS.indexOf(rank) < RANK_IDS.indexOf('platinum')) problems.push(`${m.name} defense at ${rank}: "${con}"`);
      }
    }
  }
  none(problems);
});

test('a comp hears it’s short of Operator play only on maps that reward long angles, and from Gold up', () => {
  // on tight maps such as Lotus, and from Iron to Silver where rifles and trades decide fights, the
  // Operator isn't what a comp is missing (grading round 5: eight answers)
  const problems: string[] = [];
  for (const rank of ['iron', 'bronze', 'silver', 'gold', 'platinum'] as const) for (const m of MAPS) for (const side of ['attack', 'defense'] as const) {
    const s: Situation = { map: m.id, side, rank, sites: [] };
    // (below Gold, only on a map built around long angles: Breeze, claim breeze-operator)
    const wants = needsFor(m, side, []).angles >= OPERATOR_NOTE.map && (RANK_IDS.indexOf(rank) >= RANK_IDS.indexOf(OPERATOR_NOTE.from) || (parseNeeds(m.needs.both, m.name).angles ?? 0) >= OPERATOR_NOTE.low);
    for (const party of [5, 2] as const) for (const c of solve({ ...newQuery(rank, true), map: m.id, side, party }, s, 3).comps) {
      for (const con of explainTeam(modelFor({ ...s, party }), c.team).cons) if (/Operator play/.test(con) && !wants) problems.push(`${m.name} ${side} at ${rank}: "${con}"`);
    }
  }
  none(problems);
});

test('below Platinum, no reason on a card sells fakes or splitting the defenders', () => {
  // the research keeps plans simple below Platinum (PLAY_RANK.from[3]); grading round 5, #93: Hush's
  // door switch "to fake a hit, split the defenders" for a Silver trio
  const problems: string[] = [];
  const words = /\bfak(?:e|es|ing)\b|split the defenders/i;
  for (const rank of RANK_IDS.slice(0, RANK_IDS.indexOf(PLAY_RANK.from[3]))) for (const m of MAPS) for (const side of ['attack', 'defense'] as const) {
    const s: Situation = { map: m.id, side, rank, sites: [] };
    for (const include of [[], ['hush'], ['yoru'], ['omen']]) for (const c of solve({ ...newQuery(rank, true), map: m.id, side, include }, s, 2).comps) {
      const why = explainTeam(modelFor(s), c.team);
      for (const line of [why.plan, ...why.pros, ...why.cons, ...why.notes]) if (words.test(line)) problems.push(`${m.name} ${side} at ${rank}: "${line}"`);
    }
  }
  none([...new Set(problems)]);
});

test('from Ascendant up, a duo or trio that plays both controllers picks them as a team that plays together would', () => {
  // the party times its own smokes, so its two controllers are a pair pro teams run on the map, or
  // one of the pairs the three best five-stacks with two controllers run there, not the ones random
  // solo players do best with (grading round 5, #53: Omen with Clove on Abyss at Immortal, where pro teams pair
  // Astra or Harbor with Omen)
  const problems: string[] = [];
  for (const map of ['abyss', 'bind', 'split', 'icebox', 'breeze', 'lotus', 'corrode'] as const) for (const rank of ['ascendant', 'immortal', 'radiant'] as const) for (const side of ['attack', 'defense'] as const) {
    const five = solve({ ...newQuery(rank, true), map, side, roles: { controller: 2 } }, { map, side, rank, sites: [] }, 3).comps.flatMap((c) => c.team);
    const ok = (id: string) => (PRO[map]!.picks[id] ?? 0) >= 20 || five.includes(id);
    for (const party of [2, 3] as const) {
      const s: Situation = { map, side, rank, sites: [], party };
      const c = solve({ ...newQuery(rank, true), map, side, party, roles: { controller: 2 } }, s, 1).comps[0]!;
      const theirs = c.party.filter((id) => agentById(id)!.role === 'controller');
      if (theirs.length < 2 || !theirs.every(ok)) problems.push(`${map} ${side} at ${rank}, party ${c.party.map(name).join('+')}`);
    }
  }
  none(problems);
});

test('below Platinum, a duo or trio not asked for two controllers plays one', () => {
  // a party smokes together only as well as a team at its rank does, and below Platinum teams
  // rarely combine their utility (claim one-controller-low), so a party there that plays both
  // controllers itself gets no more out of the second than a five-stack would
  const problems: string[] = [];
  for (const rank of ['iron', 'bronze', 'silver', 'gold'] as const) for (const party of [2, 3] as const) for (const side of ['attack', 'defense'] as const) for (const m of MAPS) {
    const c = solve({ ...newQuery(rank, true), map: m.id, side, party }, { map: m.id, side, rank, sites: [], party }, 1).comps[0]!;
    const controllers = (team: readonly string[]) => team.filter((id) => agentById(id)!.role === 'controller').length;
    if (controllers(c.party) > 1 || controllers(c.team) > 1) problems.push(`${m.id} ${side} at ${rank}, party ${c.party.map(name).join('+')}: ${c.team.map(name).join(', ')}`);
  }
  none(problems);
});
