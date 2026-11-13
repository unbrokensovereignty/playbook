import { describe, spec, eq, ok, near } from './harness.ts';
import { AGENTS, agentById } from '../../src/core/kb/agents.ts';
import { NEW_AGENTS } from '../../src/core/kb/new-agents.ts';
import { POOL, MAPS, MINIMAP_SCALE, RUN_SPEED, mapById } from '../../src/core/kb/maps.ts';
import { rotations, runSeconds, siteWants, SITE_WANTS } from '../../src/core/engine/sites.ts';
import { RANK_IDS } from '../../src/core/kb/ranks.ts';
import { DIMS, ROLE_IDS } from '../../src/core/kb/roles.ts';
import { D, N, ROLE_OF, kitShare, modelFor, proMixOf, proShare, roleIndex, type Situation } from '../../src/core/engine/model.ts';
import { anyRoles, scoreTeam, searchTeams, TopK, walkTeams, type Rules } from '../../src/core/engine/search.ts';
import { askFor, fillLikelihood, pickWeight, searchParties, type PartyRules } from '../../src/core/engine/party.ts';
import { newQuery, placesTaken, sanitizeQuery, situationsOf, asksBest, nothingFixed, myPools, startingQuery, withMine, type Query } from '../../src/core/engine/query.ts';
import { agentFitOf, answerModel, bestTeamFor, comfortValue, fitOf, modelForQuery, poolsFit, referenceFor, rulesOf, solve, teamFit } from '../../src/core/engine/plan.ts';
import { asksMapPicks, mapPicks } from '../../src/core/engine/mappick.ts';
import { ANSWERERS, answerOf, DUO_MAPS, proDuos, troubleFrom } from '../../src/core/engine/matchups.ts';
import { explainFor, explainTeam } from '../../src/core/engine/explain.ts';
import { BRINGS_MOST, pickNow, selectQuery, SELECT_OTHERS, TEAM } from '../../src/core/engine/select.ts';
import { COMFORT_OFFER, comfortOffers, recordBy, recordWords, winShare } from '../../src/core/games.ts';
import type { Game } from '../../src/core/saved.ts';
import { UNSETTLED, unsureWords } from '../../src/core/engine/sure.ts';
import { COMFORT, MAP_PICK, ROLE_COST, SURE, TIERS, tierOf } from '../../src/core/engine/weights.ts';

const at = (map: string, side: Situation['side'] = 'both', rank: Situation['rank'] = 'gold', sites: Situation['sites'] = []): Situation => ({ map, side, rank, sites });
const ix = (id: string) => agentById(id)!.index;
const ids = (xs: readonly number[]) => xs.map((i) => AGENTS[i]!.id);
const anyone: Rules = { include: [], allowed: () => true, roles: anyRoles() };
const q = (patch: Partial<Query>): Query => sanitizeQuery({ ...newQuery(), ...patch });
const choose = (n: number, k: number): number => (k === 0 ? 1 : (n * choose(n - 1, k - 1)) / k);

/** Every team of `size` from `pool`, the plain way. */
function combos(pool: readonly number[], size: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, cur: number[]) => {
    if (cur.length === size) { out.push(cur.slice()); return; }
    for (let i = start; i < pool.length; i++) { cur.push(pool[i]!); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}

describe('the model', () => {
  spec('strength weights add up to one for every situation, and both sides or any map are the average', () => {
    for (const m of MAPS) for (const side of ['attack', 'defense', 'both'] as const) {
      const w = modelFor(at(m.id, side)).weight;
      near(w.reduce((a, b) => a + b, 0), 1, 1e-9, `${m.name} ${side}`);
      ok(w.every((x) => x > 0), `${m.name} ${side}: every strength counts a little`);
    }
    const a = modelFor(at('haven', 'attack')).weight, d = modelFor(at('haven', 'defense')).weight, b = modelFor(at('haven', 'both')).weight;
    for (let j = 0; j < D; j++) near(b[j]!, (a[j]! + d[j]!) / 2, 1e-12);
    const any = modelFor(at('any', 'attack')).weight;
    for (let j = 0; j < D; j++) near(any[j]!, POOL.reduce((s, m) => s + modelFor(at(m.id, 'attack')).weight[j]!, 0) / POOL.length, 1e-12);
  });
  spec('a model is kept and handed back for the same situation, whatever order its sites came in', () => {
    eq(modelFor(at('haven', 'attack', 'gold', ['A', 'C'])), modelFor(at('haven', 'attack', 'gold', ['C', 'A'])));
  });
  spec('a team far from the map’s pro role mix gives up a little, more so at high ranks', () => {
    const cost = (map: string, rank: Situation['rank'], c: number) => modelFor(at(map, 'attack', rank)).mix.cost[roleIndex('controller') * 5 + c]!;
    // pros run about two controllers on Lotus and about one on Sunset
    near(proMixOf('lotus')!.controller, 1.68, 0.01);
    near(proMixOf('sunset')!.controller, 1.08, 0.01);
    ok(cost('lotus', 'radiant', 2) > cost('lotus', 'radiant', 1));
    ok(cost('sunset', 'radiant', 1) > cost('sunset', 'radiant', 2));
    ok(cost('lotus', 'radiant', 2) - cost('lotus', 'radiant', 1) > cost('lotus', 'iron', 2) - cost('lotus', 'iron', 1));
    // a small sample pulls less: Fracture's numbers come from nine maps; Bind's five take in its regional maps
    ok(proShare('fracture') < proShare('lotus') && proShare('fracture') >= 0.5);
    ok(proShare('bind') > 0.5 + 1e-9);
    // the role costs hold the mix's part on top of the hard rules
    const m = modelFor(at('lotus', 'attack', 'radiant'));
    for (let c = 0; c < 5; c++) near(m.roleCost[roleIndex('controller') * 5 + c]!, ROLE_COST.controller.attack[c]! + m.mix.cost[roleIndex('controller') * 5 + c]!, 1e-12);
    // any map is the average of the pool
    near(cost('any', 'radiant', 1), POOL.reduce((acc, p) => acc + cost(p.id, 'radiant', 1), 0) / POOL.length, 1e-12);
    const cons = (team: string[], map: string) => explainTeam(modelFor(at(map, 'attack', 'radiant')), team).cons.join(' ');
    ok(/Pro teams on Abyss usually run two controllers, so with one, /.test(cons(['omen', 'sova', 'yoru', 'waylay', 'cypher'], 'abyss')));
    ok(!/controller/i.test(cons(['omen', 'fade', 'raze', 'neon', 'killjoy'], 'sunset')));
    ok(/Pro teams on Sunset usually run one controller, so the extra smokes/.test(cons(['omen', 'viper', 'fade', 'neon', 'chamber'], 'sunset')));
    ok(!/Pro teams on/.test(cons(['omen', 'viper', 'fade', 'raze', 'chamber'], 'lotus')));
    // at Iron the pro mix hardly counts, so the cons leave it out
    ok(!/Pro teams on/.test(explainTeam(modelFor(at('abyss', 'attack', 'iron')), ['omen', 'sova', 'yoru', 'waylay', 'cypher']).cons.join(' ')));
  });
  spec('where pro teams mostly play without a role, having none of it costs less at high ranks, and the con says why', () => {
    const none = (rank: Situation['rank']) => modelFor(at('abyss', 'defense', rank)).roleCost[roleIndex('sentinel') * 5]!;
    // pros on Abyss hardly ever run a sentinel
    ok(proMixOf('abyss')!.sentinel < 0.5);
    ok(none('radiant') > none('iron'));
    ok(none('radiant') < 0, 'still a cost: a defense without one gives something up');
    const con = (rank: Situation['rank']) => explainTeam(modelFor(at('abyss', 'defense', rank)), ['yoru', 'waylay', 'sova', 'astra', 'harbor']).cons[0]!;
    eq(con('radiant').startsWith('With no sentinel (most pro teams play Abyss without one too), '), true, con('radiant'));
    eq(con('iron').startsWith('With no sentinel, '), true, con('iron'));
    // the gaps it leaves are said once, with how to play around them
    ok(!explainTeam(modelFor(at('abyss', 'defense', 'iron')), ['yoru', 'waylay', 'sova', 'astra', 'harbor']).cons.some((c) => /^(Nobody brings (site setups|flank watch)|(Site setups|Flank watch) comes? only)/.test(c)));
    // on a map where pros run one, nothing changes
    const lotus = modelFor(at('lotus', 'defense', 'radiant'));
    near(lotus.mix.relax[roleIndex('sentinel')]!, 0, 1e-12);
  });
  spec('pair synergy is the same both ways', () => {
    const m = modelFor(at('bind'));
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) eq(m.pair[a * N + b], m.pair[b * N + a]);
  });
  spec('a flash timed for a teammate’s entry counts as far as the team plays its utility together, and a stun counts in full', () => {
    const pair = (rank: Situation['rank'], a: string, b: string) => modelFor(at('breeze', 'attack', rank)).pair[agentById(a)!.index * N + agentById(b)!.index]!;
    // KAY/O’s FLASH/drive has to pop just as Jett dashes in, which a team that doesn’t swing on its flashes misses
    ok(pair('silver', 'kayo', 'jett') < pair('immortal', 'kayo', 'jett') / 2, `${pair('silver', 'kayo', 'jett')} at Silver, ${pair('immortal', 'kayo', 'jett')} at Immortal`);
    near(pair('immortal', 'kayo', 'jett'), pair('radiant', 'kayo', 'jett'), 1e-12);
    // Breach’s stun leaves defenders dazed long enough for Raze to go in without split-second timing
    near(pair('silver', 'breach', 'raze'), pair('radiant', 'breach', 'raze'), 1e-12);
  });
  spec('a kit rule that makes a kit easier to play somewhere gives a low-rank team more of it there', () => {
    // Viper’s Breeze wall takes no lineups, so a team at Iron gets more of her wall there than on Ascent
    const wall = DIMS.indexOf('wall'), viper = agentById('viper')!.index;
    const miss = (map: string, rank: Situation['rank'] = 'iron') => modelFor(at(map, 'attack', rank)).miss[viper * D + wall]!;
    ok(miss('breeze') < miss('ascent'), `${miss('breeze')} on Breeze, ${miss('ascent')} on Ascent`);
    // and near the top, where players have the mechanics for any kit, it makes little difference
    ok(miss('ascent', 'radiant') - miss('breeze', 'radiant') < (miss('ascent') - miss('breeze')) / 5);
  });
});

describe('searching teams', () => {
  spec('every five-agent team is scored when nothing is fixed', () => {
    const r = searchTeams(modelFor(at('ascent')), anyone, 5);
    eq(r.count, choose(N, 5));
    ok(r.best >= r.top[0]!.score - 1e-12 && r.best <= r.top[0]!.score + 1e-12);
    ok(r.mid < r.best);
  });
  spec('the fast search scores teams exactly as the plain sum does', () => {
    for (const s of [at('haven', 'attack', 'iron'), at('lotus', 'defense', 'radiant'), at('any', 'both', 'platinum')]) {
      const m = modelFor(s);
      const r = searchTeams(m, anyone, 30);
      for (const t of r.top) near(t.score, scoreTeam(m, t.agents), 1e-9, ids(t.agents).join(','));
      for (let a = 0; a < N; a++) near(r.bestWith[a]!.score, scoreTeam(m, r.bestWith[a]!.agents), 1e-9);
    }
  });
  spec('with a few agents to choose from, the search finds the same best teams as trying them all', () => {
    const m = modelFor(at('split', 'attack', 'diamond'));
    const pool = ['omen', 'viper', 'sova', 'fade', 'raze', 'jett', 'killjoy', 'cypher', 'skye', 'brimstone'].map(ix);
    const include = [ix('omen'), ix('raze')];
    const rules: Rules = { include, allowed: (i) => pool.includes(i), roles: anyRoles() };
    const r = searchTeams(m, rules, 200);
    const plain = combos(pool.filter((i) => !include.includes(i)), 3).map((c) => [...include, ...c]).map((t) => ({ t: [...t].sort((a, b) => a - b), s: scoreTeam(m, t) })).sort((a, b) => b.s - a.s);
    eq(r.count, plain.length);
    eq(r.top.length, plain.length);
    r.top.forEach((t, i) => near(t.score, plain[i]!.s, 1e-9, `team ${i + 1}`));
    eq(r.top[0]!.agents, plain[0]!.t);
  });
  spec('included agents are always in, left-out agents never, and role counts are exact', () => {
    const m = modelFor(at('haven', 'both', 'gold'));
    const rules: Rules = { include: [ix('sage')], allowed: (i) => i !== ix('omen') && i !== ix('jett'), roles: ROLE_IDS.map((r) => (r === 'controller' ? 2 : r === 'duelist' ? 0 : -1)) };
    const r = searchTeams(m, rules, 40);
    ok(r.top.length === 40);
    for (const t of r.top) {
      ok(t.agents.includes(ix('sage')), 'Sage is in');
      ok(!t.agents.includes(ix('omen')) && !t.agents.includes(ix('jett')), 'Omen and Jett are out');
      eq(t.agents.filter((a) => AGENTS[a]!.role === 'controller').length, 2, 'two controllers');
      eq(t.agents.filter((a) => AGENTS[a]!.role === 'duelist').length, 0, 'no duelist');
    }
    for (let a = 0; a < N; a++) if (r.bestWith[a]) ok(r.bestWith[a]!.agents.includes(ix('sage')));
    eq(r.bestWith[ix('omen')], null, 'no team has a left-out agent');
  });
  spec('rules that can’t be met give no teams rather than wrong ones', () => {
    const m = modelFor(at('bind'));
    eq(searchTeams(m, { include: [ix('omen'), ix('viper'), ix('brimstone')], allowed: () => true, roles: ROLE_IDS.map((r) => (r === 'controller' ? 2 : -1)) }).count, 0);
    eq(searchTeams(m, { include: [], allowed: () => true, roles: ROLE_IDS.map(() => 2) }).count, 0, 'eight role slots in a team of five');
    const none = searchTeams(m, { include: [], allowed: (i) => i < 3, roles: anyRoles() });
    eq([none.count, none.top.length, none.best, none.mid], [0, 0, 0, 0]);
  });
  spec('keeping the best few keeps exactly the best few', () => {
    const k = new TopK(3);
    for (const s of [5, 1, 9, 3, 7, 2, 8]) k.push(s, [s, 0, 0, 0, 0]);
    eq(k.list().map((t) => t.score), [9, 8, 7]);
  });
  spec('walking teams of fewer than five, for a party, counts them all', () => {
    eq(walkTeams(modelFor(at('pearl')), anyone, 2, () => {}), choose(N, 2));
    eq(walkTeams(modelFor(at('pearl')), anyone, 3, () => {}), choose(N, 3));
  });
});

describe('fits and tiers', () => {
  spec('the best team fits 100, the middle team 50, and fits stay between 0 and 100', () => {
    const ref = { best: 2, mid: 1 };
    eq([fitOf(2, ref), fitOf(1, ref), fitOf(1.5, ref), fitOf(9, ref), fitOf(-9, ref)], [100, 50, 75, 100, 0]);
    eq(fitOf(1, { best: 1, mid: 1 }), 100, 'all teams equal');
    eq(agentFitOf(2, ref), 100);
    ok(agentFitOf(1.9, ref) < fitOf(1.9, ref), 'agent fits are spread out more');
    eq(agentFitOf(1.8, ref, { score: 1.8, fit: 90 }), 90, 'spread from the best comp a question allows');
  });
  spec('when the rules keep every comp low, the best agents share the best comp’s fit', () => {
    const query = q({ map: 'corrode', side: 'defense', rank: 'platinum', sites: ['B'], roles: { sentinel: 0 } });
    const a = solve(query, situationsOf(query)[0]!, 3);
    ok(a.comps[0]!.fit < 90, `the rules cost something (${a.comps[0]!.fit})`);
    eq(Math.round(a.agents[0]!.fit), Math.round(a.comps[0]!.fit));
    ok(a.agents.filter((x) => x.fit > 0).length >= 5, 'the agents aren’t all 0');
  });
  spec('tiers go from S down, and every fit has one', () => {
    eq(TIERS.map((t) => t.id), ['S', 'A', 'B', 'C', 'D']);
    eq([tierOf(100), tierOf(TIERS[0]!.min), tierOf(TIERS[0]!.min - 0.6), tierOf(0)], ['S', 'S', 'A', 'D']);
  });
  spec('a tier goes by the fit as shown, so comps that show the same number share a tier', () => {
    const min = TIERS[0]!.min;
    eq([tierOf(min - 0.4), tierOf(min - 0.5), tierOf(min - 0.51)], ['S', 'S', 'A']);
  });
  spec('the yardstick for a situation is all teams, whatever a question fixes', () => {
    const m = modelFor(at('icebox'));
    const ref = referenceFor(m, true);
    const r = searchTeams(m, anyone, 1);
    near(ref.best, r.best, 1e-12);
    const answer = solve(q({ map: 'icebox', include: ['sage', 'reyna'] }), at('icebox'), 5);
    eq(answer.ref, ref);
    ok(answer.comps[0]!.fit < 100, 'a fixed pick fits less than the best team');
  });
  spec('agents with the same fit are told apart by what they add over the next best of their role', () => {
    const s = at('lotus', 'attack', 'gold');
    const m = modelFor(s);
    const answer = solve(q({ map: 'lotus', side: 'attack', rank: 'gold' }), s, 3);
    ok(answer.agents.filter((a) => a.fit === 100).length > 1, 'several agents fit 100 here');
    for (const a of answer.agents) {
      const e = a.edge;
      if (!e) { ok(false, `${a.id} has an edge`); continue; }
      const role = agentById(a.id)!.role;
      eq(agentById(e.over)!.role, role, `${a.id} is held against their own role`);
      ok(!a.team.includes(e.over), `${a.id}: ${e.over} isn’t in the comp already`);
      // the next best is the best of the rest in that place, and the edge says who does better there
      const swap = (id: string) => scoreTeam(m, a.team.map((x) => ix(x === a.id ? id : x)));
      for (const y of AGENTS) if (y.role === role && !a.team.includes(y.id)) ok(swap(y.id) <= swap(e.over) + 1e-12, `${a.id}: ${y.id} does better than ${e.over}`);
      eq(e.by > 0, scoreTeam(m, a.team.map(ix)) > swap(e.over), `${a.id}: the edge’s sign`);
    }
    for (let i = 1; i < answer.agents.length; i++) {
      const x = answer.agents[i - 1]!, y = answer.agents[i]!;
      if (x.fit === y.fit) ok(x.edge!.by >= y.edge!.by, `${x.id} before ${y.id}`);
    }
    // a party's teammates aren't theirs to choose, so its agents have none
    ok(solve(q({ map: 'lotus', side: 'attack', rank: 'gold', party: 2 }), s, 3).agents.every((a) => !a.edge), 'no edges for a party');
  });
  spec('a fit is less sure when parts of it that rest on very little could move it a tier', () => {
    const unsure = (map: string, side: Situation['side'], rank: Situation['rank'], id: string, party: Query['party'] = 5) =>
      solve(q({ map, side, rank, party }), at(map, side, rank), 3).agents.find((a) => a.id === id)?.unsure;
    // Hush: ranked numbers from the first days, a kit no play has checked yet, and no pro play
    const gold = unsure('lotus', 'attack', 'gold', 'hush');
    ok(gold && gold.by >= SURE.less, 'Hush on Lotus attack at Gold');
    eq(gold!.why.slice().sort(), ['early', 'kit'], 'win rates count at Gold, and pro play hardly does');
    const radiant = unsure('lotus', 'attack', 'radiant', 'hush');
    ok(radiant && radiant.why.includes('pro') && !radiant.why.includes('early'), 'at Radiant, pro play counts and win rates hardly do');
    ok(gold!.by > (unsure('icebox', 'attack', 'gold', 'hush')?.by ?? 0), 'more of Hush’s kit rests on judgment on Lotus than on Icebox');
    ok(unsure('lotus', 'attack', 'gold', 'hush', 2), 'a duo’s answers say so too');
    // agents with settled numbers and pro play behind them are always sure
    for (const map of ['any', 'lotus', 'bind', 'icebox']) for (const rank of ['iron', 'gold', 'radiant'] as const) {
      const ans = solve(q({ map, rank }), at(map, 'both', rank), 3);
      for (const a of ans.agents) if (!UNSETTLED.some((x) => x.id === a.id)) ok(!a.unsure, `${a.id} on ${map} at ${rank}`);
    }
    ok(UNSETTLED.some((a) => a.id === 'hush'), 'Hush is still settling');
  });
  spec('why a fit is less sure is a plain sentence, the biggest reason first', () => {
    const s = at('lotus', 'attack', 'gold');
    const u = solve(q({ map: 'lotus', side: 'attack', rank: 'gold' }), s, 3).agents.find((a) => a.id === 'hush')!.unsure!;
    const words = unsureWords(s, 'hush', u);
    ok(/^This fit is less sure and could be off by about \d+, since [^.]+\.$/.test(words), words);
    const first = { early: 'the ranked numbers', kit: 'what Hush’s kit does on Lotus attack', pro: 'pros haven’t' }[u.why[0]!];
    ok(words.includes(`, since ${first}`), words);
  });
  spec('a saved team gets the same fit the answers gave it', () => {
    const s = at('lotus', 'attack', 'platinum', ['A']);
    const answer = solve(q({ map: 'lotus', side: 'attack', rank: 'platinum', sites: ['A'] }), s, 3);
    for (const c of answer.comps) {
      const t = teamFit(s, [...c.team].reverse(), true);
      near(t.fit, c.fit, 1e-9, c.team.join());
      eq(t.tier, c.tier);
    }
  });
});

describe('questions', () => {
  spec('a damaged question falls back to the defaults, and parts that clash are dropped', () => {
    eq(sanitizeQuery(null), newQuery());
    eq(sanitizeQuery({ map: 'nowhere', side: 'up', rank: 'gold 2', party: 4 }), newQuery());
    // a question for all ranks plans as Platinum does
    eq(sanitizeQuery({ rank: 'any' }).rank, 'platinum');
    const x = sanitizeQuery({ map: 'haven', sites: ['A', 'A', 'D', 'C'], party: 3, include: ['jett', 'jett', 'sova', 'omen', 'sage'], locked: ['jett', 'viper', 'nobody'], exclude: ['viper', 'reyna'] });
    eq(x.sites, ['A', 'C']);
    eq(x.include, ['jett', 'sova', 'omen'], 'no more than the party');
    eq(x.locked, ['viper'], 'locked agents aren’t also yours');
    eq(x.exclude, ['reyna'], 'left-out agents aren’t yours or locked');
    eq(sanitizeQuery({ map: 'haven', sites: ['A', 'B', 'C'] }).sites, [], 'every site is the same as none');
    eq(sanitizeQuery({ map: 'any', sites: ['A'] }).sites, [], 'sites need a map');
    eq(sanitizeQuery({ party: 5, locked: ['jett'] }).locked, [], 'a five-stack has no random teammates');
  });
  spec('role counts that can’t add up are dropped', () => {
    eq(sanitizeQuery({ roles: { duelist: 2, controller: 2, initiator: 2 } }).roles, {}, 'six in a team of five');
    eq(sanitizeQuery({ party: 2, roles: { duelist: 3 } }).roles, {}, 'three in a duo');
    eq(sanitizeQuery({ include: ['jett', 'raze'], roles: { duelist: 1, controller: 2 } }).roles, { controller: 2 }, 'fewer duelists than included');
    eq(sanitizeQuery({ roles: { duelist: 1.5, sentinel: -1, controller: 1 } }).roles, { controller: 1 });
    eq(sanitizeQuery({ include: ['jett', 'omen', 'sova'], roles: { sentinel: 3 } }).roles, {}, 'no room beside three must-play agents');
    eq(sanitizeQuery({ include: ['jett', 'omen'], roles: { sentinel: 3 } }).roles, { sentinel: 3 }, 'room for exactly three');
    eq(placesTaken(['jett', 'omen', 'viper'], { controller: 1, sentinel: 2 }), 5, 'two controllers must play though one was asked for');
  });
  spec('pools come one per player, or not at all', () => {
    eq(sanitizeQuery({ party: 2, pools: [['jett'], ['omen'], ['sova']] }).pools, []);
    eq(sanitizeQuery({ party: 2, pools: [['jett', 'nobody'], []] }).pools, [['jett'], []]);
    eq(sanitizeQuery({ party: 2, pools: [[], []] }).pools, [], 'nobody restricted');
  });
  spec('“find the best” asks about every value of that field', () => {
    eq(situationsOf(newQuery()).length, 1);
    eq(situationsOf(q({ map: 'best' })).length, POOL.length);
    eq(situationsOf(q({ map: 'best', allMaps: true })).length, MAPS.length);
    eq(situationsOf(q({ map: 'best', side: 'best' })).length, POOL.length * 2);
    eq(situationsOf(q({ rank: 'best' })).map((s) => s.rank), [...RANK_IDS]);
    eq(situationsOf(q({ map: 'haven', sites: ['C'] }))[0]!.sites, ['C']);
    eq(asksBest(q({ map: 'best', rank: 'best' })), ['map', 'rank']);
    ok(nothingFixed(newQuery()) && !nothingFixed(q({ include: ['jett'] })) && !nothingFixed(q({ party: 2 })));
  });
});

describe('answers', () => {
  spec('a five-stack question gives comps best first, and every agent a fit', () => {
    const a = solve(q({ map: 'ascent' }), at('ascent'), 10);
    eq(a.comps.length, 10);
    for (let i = 1; i < a.comps.length; i++) ok(a.comps[i - 1]!.score >= a.comps[i]!.score);
    eq(a.comps[0]!.fit, 100);
    eq(a.agents.length, N);
    for (const x of a.agents) ok(x.team.includes(x.id) && x.fit >= 0 && x.fit <= 100, x.id);
    eq(a.agents[0]!.fit, 100, 'the best team’s agents fit 100');
    eq(new Set(a.comps.map((c) => c.team.join())).size, 10, 'no comp twice');
  });
  spec('leaving out new agents leaves them out of every answer', () => {
    const a = solve(q({ map: 'haven', newAgents: false }), at('haven'), 30);
    for (const d of NEW_AGENTS) {
      ok(!a.comps.some((c) => c.team.includes(d.id)), d.name);
      ok(!a.agents.some((x) => x.id === d.id), d.name);
    }
    ok(a.agents.some((x) => x.id === 'hush'), 'Hush is a full agent now, so she stays in');
  });
  spec('saved party pools: each player gets an agent they play', () => {
    const pools = [['jett', 'reyna'], ['omen'], ['sova', 'fade'], [], ['killjoy', 'cypher', 'jett']];
    const a = solve(q({ map: 'bind', pools }), at('bind'), 20);
    ok(a.comps.length > 0);
    const fits = poolsFit(pools.map((p) => p.map(ix)))!;
    for (const c of a.comps) ok(fits(c.team.map(ix), 5), c.team.join(', '));
    ok(a.comps.every((c) => c.team.includes('omen')), 'the one-agent player plays Omen');
  });
  spec('matching players to agents tries every way round', () => {
    const f = poolsFit([[1, 2], [1]])!;
    ok(f([1, 2], 2), 'the first player takes 2 so the second can take 1');
    ok(!poolsFit([[1], [1]])!([1, 2], 2), 'two players can’t both play 1');
    ok(poolsFit([[], [3]])!([3, 7], 2));
    eq(poolsFit([]), undefined);
  });
  spec('the rules of a question: left out, locked and new agents can’t be picked', () => {
    const r = rulesOf(q({ party: 3, exclude: ['reyna'], locked: ['jett'], newAgents: false }));
    ok(!r.allowed(ix('reyna')) && !r.allowed(ix('jett')) && r.allowed(ix('omen')) && r.allowed(ix('hush')));
    for (const d of NEW_AGENTS) ok(!r.allowed(ix(d.id)), d.name);
    const pooled = rulesOf(q({ party: 2, pools: [['omen'], ['sova']] }));
    ok(pooled.allowed(ix('omen')) && !pooled.allowed(ix('jett')), 'only agents someone plays');
    ok(rulesOf(q({ party: 2, pools: [['omen'], []] })).allowed(ix('jett')), 'a player who plays anyone can take anyone');
  });
});

describe('solo', () => {
  spec('on your own, the Planner ranks the agent for you to play, with the best picks for your four random teammates', () => {
    const a = solve(q({ map: 'haven', side: 'attack', party: 1 }), at('haven', 'attack'), 5);
    eq(a.comps.length, 5);
    for (const c of a.comps) {
      eq(c.party.length, 1);
      eq(c.team.length, 5);
      ok(c.team.includes(c.party[0]!));
      ok(c.pickFit! >= c.expected!, 'the best picks are at least what to expect');
    }
    const picked: string[] = a.comps[0]!.team.filter((id) => id !== a.comps[0]!.party[0]).map((id) => agentById(id)!.role);
    ok(a.askFor!.every((x) => picked.includes(x.role)), 'the role to ask for is one the picks play');
  });
  spec('with the agents you play, you get one of them', () => {
    const mine = ['jett', 'omen'];
    const a = solve(q({ map: 'lotus', side: 'defense', party: 1, pools: myPools(1, mine) }), at('lotus', 'defense'), 5);
    eq(a.comps.map((c) => c.party[0]).sort(), [...mine].sort());
    const five = solve(q({ map: 'lotus', side: 'defense', pools: myPools(5, mine) }), at('lotus', 'defense'), 5);
    ok(five.comps.every((c) => c.team.some((id) => mine.includes(id))), 'a five-stack plays one of them');
  });
  spec('a question for you: your rank and party, and your agents for you, only when you’ve said which', () => {
    eq(myPools(1, []), []);
    eq(myPools(3, ['jett']), [['jett'], [], []]);
    const q1 = startingQuery({ rank: 'diamond', party: 2, agents: ['sova', 'fade'] }, true);
    eq([q1.rank, q1.party, q1.pools], ['diamond', 2, [['sova', 'fade'], []]]);
    ok(withMine(q1, ['sova', 'fade']) && !withMine({ ...q1, pools: [] }, ['sova', 'fade']) && !withMine(q1, []));
    eq(sanitizeQuery(q1), q1, 'it reads back as it was');
    const solo = sanitizeQuery({ party: 1, include: ['jett', 'omen'], locked: ['sova', 'jett', 'fade', 'sage', 'raze', 'neon'] });
    eq([solo.include, solo.locked], [['jett'], ['sova', 'fade', 'sage', 'raze']], 'one of you, and four teammates who can lock in');
  });
});

describe('duos and trios', () => {
  spec('random teammates favour popular agents, and teams without a controller or with three are rare', () => {
    const t = 0.5;
    ok(pickWeight(ix('jett'), t) > pickWeight(ix('harbor'), t));
    const counts = (roles: Record<string, number>) => ROLE_IDS.map((r) => roles[r] ?? 0);
    ok(fillLikelihood(counts({ duelist: 2, initiator: 2, sentinel: 1 })) < fillLikelihood(counts({ duelist: 1, initiator: 2, sentinel: 1, controller: 1 })));
    ok(fillLikelihood(counts({ duelist: 3, controller: 1, initiator: 1 })) < fillLikelihood(counts({ duelist: 2, controller: 1, initiator: 1, sentinel: 1 })));
    ok(fillLikelihood(counts({ duelist: 1, controller: 3, initiator: 1 })) < fillLikelihood(counts({ duelist: 1, controller: 2, initiator: 1, sentinel: 1 })));
  });
  spec('a duo’s expected score is the weighted average over every fill', () => {
    const m = modelFor(at('sunset', 'attack', 'platinum'));
    const rules: PartyRules = { include: [ix('omen'), ix('sova')], allowed: () => true, roles: anyRoles(), locked: [ix('jett')], fillable: () => true };
    const r = searchParties(m, rules, 2, 0.5, 1);
    eq(r.count, 1);
    const pick = r.top[0]!;
    const fixed = [ix('omen'), ix('sova'), ix('jett')];
    let sw = 0, sws = 0, best = -Infinity;
    for (const fill of combos([...Array(N).keys()].filter((i) => !fixed.includes(i)), 2)) {
      const team = [...fixed, ...fill];
      const c = new Array(ROLE_IDS.length).fill(0);
      for (const a of team) c[ROLE_OF[a]!]++;
      const w = pickWeight(fill[0]!, 0.5) * pickWeight(fill[1]!, 0.5) * fillLikelihood(c);
      const s = scoreTeam(m, team);
      sw += w; sws += w * s;
      best = Math.max(best, s);
    }
    near(pick.expected, sws / sw, 1e-9);
    near(pick.best.score, best, 1e-9);
    ok(pick.spread > 0);
    ok(pick.likely.agents.length === 5 && fixed.every((a) => pick.likely.agents.includes(a)));
  });
  spec('a trio answer keeps the party in every comp and says which roles to hope for', () => {
    const a = solve(q({ map: 'lotus', party: 3, include: ['viper'] }), at('lotus'), 5);
    eq(a.comps.length, 5);
    for (const c of a.comps) {
      eq(c.party.length, 3);
      ok(c.party.includes('viper') && c.team.includes('viper'));
      // the comp shown is the party with the best picks for the random teammates
      ok(c.pickFit! >= c.expected!, 'the best picks are at least what to expect');
      ok(c.others!.every((o) => o.fit <= c.pickFit! + 1e-9 && o.team.includes('viper')), 'other picks come after the best, with the party');
      ok(c.likely!.fit <= c.pickFit! + 1e-9 && c.party.every((id) => c.likely!.team.includes(id)), 'the likeliest team keeps the party');
      ok(c.fit <= 100 && c.expected! <= c.fit + 1e-9, 'ranked against the best party, which a five-stack beats');
      eq(c.team.length, 5);
    }
    // only roles the best party's picks play, so the role to ask for is one the picks have
    const picked: string[] = a.comps[0]!.team.filter((id) => !a.comps[0]!.party.includes(id)).map((id) => agentById(id)!.role);
    ok(a.askFor && a.askFor.length >= 1 && a.askFor.every((x) => picked.includes(x.role)), 'roles the picks play');
    for (let i = 1; i < a.askFor!.length; i++) ok(a.askFor![i - 1]!.fit >= a.askFor![i]!.fit);
  });
  spec('asking for a role compares teams where a random teammate plays it', () => {
    const m = modelFor(at('haven'));
    const rules: PartyRules = { include: [], allowed: () => true, roles: anyRoles(), locked: [], fillable: () => true };
    const party = [ix('jett'), ix('raze'), ix('reyna')];
    const ask = askFor(m, party, rules, 0.5);
    eq(ask[0]!.role, 'controller', 'three duelists want a controller most');
    ok(ask.every((x) => x.chance > 0 && x.chance < 1), 'random teammates bring each role in some games, not all');
    // the two random teammates play two agents, so the chances of the four roles add up to between one and two
    const total = ask.reduce((n, x) => n + x.chance, 0);
    ok(total >= 1 - 1e-9 && total <= 2 + 1e-9, `the chances add up to ${total}`);
  });
  spec('asking for a role scores the team the way the party is scored, with both controllers its own', () => {
    // four of you leave one random teammate, so each fill plays one role and the roles' scores,
    // weighted by how often each comes up, add back up to the party's own expected score
    const m = modelFor({ ...at('abyss', 'attack', 'immortal'), party: 3 });
    const party = [ix('omen'), ix('clove'), ix('sova'), ix('jett')];
    const rules: PartyRules = { include: party, allowed: () => true, roles: anyRoles(), locked: [], fillable: () => true };
    const pick = searchParties(m, rules, 4, 0.9, 1).top[0]!;
    const ask = askFor(m, party, rules, 0.9);
    near(ask.reduce((n, x) => n + x.chance, 0), 1, 1e-9);
    near(ask.reduce((n, x) => n + x.chance * x.expected, 0), pick.expected, 1e-9);
  });
});

describe('explanations', () => {
  spec('a team without a controller hears it first', () => {
    const e = explainTeam(modelFor(at('ascent', 'attack')), ['jett', 'raze', 'sova', 'killjoy', 'breach']);
    ok(e.cons[0]!.startsWith('With no controller'));
  });
  spec('strengths are credited to the agents who bring them, with their abilities', () => {
    const e = explainTeam(modelFor(at('bind', 'attack', 'diamond')), ['raze', 'breach', 'brimstone', 'viper', 'cypher']);
    for (const row of e.strengths) {
      for (const b of row.by) ok(['raze', 'breach', 'brimstone', 'viper', 'cypher'].includes(b.id));
      ok(row.cover >= 0 && row.cover <= 1);
    }
    ok(e.pros.some((p) => p.includes('Breach’s stuns')), 'the Breach and Raze combo is a pro');
    ok([...e.pros, ...e.cons].every((x) => /[.]$/.test(x) && !x.includes('!') && !x.includes('  ')), 'plain sentences');
  });
  spec('a comp with no real gap still names its thinnest spot, and how to play around it', () => {
    const s = at('lotus', 'attack', 'immortal');
    const best = solve({ ...newQuery('immortal'), map: 'lotus', side: 'attack' }, s, 1).comps[0]!.team;
    const e = explainTeam(modelFor(s), best);
    ok(e.cons.length > 0);
    const thin = e.cons.find((c) => c.startsWith('The comp is thinnest on ') || / only from .+, so (once|if) /.test(c));
    if (thin) ok(!e.cons.some((c) => /^(Nobody brings|The comp is light on)|.+ comes? only from .+?(\. .+ needs more)?, so (?!once|if)/.test(c)), 'only when there is no real gap');
    ok(e.cons.every((x) => /[.]$/.test(x)));
  });
  spec('a new agent gets a note that the numbers are estimates', () => {
    for (const d of NEW_AGENTS) {
      const e = explainTeam(modelFor(at('pearl')), [d.id, 'omen', 'sova', 'killjoy', 'fade']);
      ok(e.notes.some((n) => n.includes(`${d.name} is new`)), d.name);
    }
    const e = explainTeam(modelFor(at('pearl')), ['hush', 'omen', 'sova', 'killjoy', 'fade']);
    ok(!e.notes.some((n) => n.includes('estimate')), 'Hush’s numbers aren’t estimates any more');
  });
  spec('pro play doesn’t pull an agent who came out after the pro events either way', () => {
    for (const rank of ['iron', 'radiant'] as const) {
      const m = modelFor(at('haven', 'attack', rank));
      eq(m.fitParts.pro[ix('hush')], 0, rank);
    }
    // her hard kit still costs at low ranks, and nothing at Radiant
    const hush = agentById('hush')!;
    ok(kitShare(hush, 0) < 0.75, 'a team at Iron gets less of her kit');
    eq(kitShare(hush, 1), 1);
    // (Radiant's answers take in a little of Immortal's games, where it costs next to nothing)
    ok(Math.abs(modelFor(at('haven', 'attack', 'radiant')).fitParts.rank[ix('hush')]!) < 1e-4, 'next to nothing at Radiant');
  });
});

describe('map picks', () => {
  const answersTo = (q: Query) => situationsOf(q).map((s) => solve(q, s, 3));
  const fitOfAnswer = (a: ReturnType<typeof solve>) => a.comps[0]?.fit ?? -1;
  spec('only a five-stack asking for its best map at one rank, with something chosen, gets them', () => {
    const q = { ...newQuery('gold'), map: 'best', include: ['viper'] };
    ok(asksMapPicks(q), 'a team with a must-play agent');
    ok(!asksMapPicks({ ...q, include: [] }), 'nothing chosen: every map fits fully');
    ok(!asksMapPicks({ ...q, party: 2 }), 'a duo can’t pick maps');
    ok(!asksMapPicks({ ...q, rank: 'best' }), 'not across ranks');
    ok(!asksMapPicks({ ...q, map: 'bind' }), 'not for one map');
  });
  spec('the maps to play are the best ones and the maps to ban the worst, each far enough apart, each with why', () => {
    const q: Query = { ...newQuery('gold'), map: 'best', include: ['harbor', 'killjoy'] };
    const answers = answersTo(q);
    const fits = new Map(answers.map((a) => [a.situation.map, fitOfAnswer(a)]));
    const top = Math.max(...fits.values()), bottom = Math.min(...fits.values());
    const p = mapPicks(answers, q);
    eq(p.even, top - bottom < MAP_PICK.gap);
    ok(p.play.length > 0 && p.play.length <= MAP_PICK.most && p.ban.length > 0 && p.ban.length <= MAP_PICK.most, 'both lists, not too long');
    near(p.play[0]!.fit, top, 1e-9);
    eq(p.ban[0]!.fit, bottom);
    for (const x of p.play) ok(x.fit >= bottom + MAP_PICK.gap, `${x.map} is worth playing`);
    for (const x of p.ban) ok(x.fit <= top - MAP_PICK.gap && !p.play.some((y) => y.map === x.map), `${x.map} is worth banning`);
    for (const x of [...p.play, ...p.ban]) {
      ok(x.why.length > 0 && x.why.length <= MAP_PICK.why, `${x.map} says why`);
      eq(x.tier, tierOf(x.fit));
      ok(x.team.includes('harbor') && x.team.includes('killjoy'), 'the comp keeps the must-play agents');
      eq(x.best, bestTeamFor(modelFor({ map: x.map, side: 'both', rank: 'gold', sites: [], enemy: [] }), q.newAgents));
    }
  });
  spec('a team that can play a map’s best comp hears so', () => {
    const q: Query = { ...newQuery('gold'), map: 'best', exclude: ['sage'] };
    const p = mapPicks(answersTo(q), q);
    for (const x of p.play) eq(x.lead !== '', [...x.best].sort().join() === [...x.team].sort().join());
  });
  spec('a map’s reasons are lines its comp’s own card shows, or how the map differs from the rest', () => {
    // a reason read off the card leaves out what the card leaves out for the question (a con about
    // two controllers for a team that asked for two), and counts how well the team plays its agents
    for (const extra of [{ roles: { controller: 2 } }, { include: ['harbor', 'killjoy'] }, { exclude: ['omen', 'viper'], roles: { sentinel: 2 } }] as Partial<Query>[]) {
      const q: Query = { ...newQuery('gold'), map: 'best', ...extra };
      const answers = answersTo(q);
      for (const x of [...mapPicks(answers, q).play, ...mapPicks(answers, q).ban]) {
        const a = answers.find((y) => y.situation.map === x.map)!, c = a.comps[0]!;
        const card = explainTeam(answerModel(a), c.team, explainFor(q, c)), raw = explainTeam(modelFor(a.situation), c.team);
        for (const line of x.why) ok(![...raw.pros, ...raw.cons].includes(line) || [...card.pros, ...card.cons].includes(line), `${x.map}: ${line}`);
      }
    }
  });
  spec('maps that all fit about the same give no picks', () => {
    const q: Query = { ...newQuery('gold'), map: 'best' };
    eq(mapPicks(answersTo(q), q), { even: true, play: [], ban: [] });
  });
});

describe('how well you play your agents', () => {
  const s: Situation = { map: 'ascent', side: 'attack', rank: 'iron', sites: [] };
  const solo = (comfort: Query['comfort'], rank: Situation['rank'] = 'iron') =>
    solve({ ...newQuery(rank), map: 'ascent', side: 'attack', party: 1, pools: [['jett', 'sova', 'omen']], comfort }, { ...s, rank }, 3);
  spec('with nothing said, nothing changes', () => {
    ok(modelForQuery({ comfort: {} }, s) === modelFor(s), 'the same numbers');
    eq(solo({}).comps.map((c) => c.party), solo({ nobody: 'main' } as Query['comfort']).comps.map((c) => c.party));
  });
  spec('a main counts for more and an agent you’re learning for less, most at Iron', () => {
    ok(comfortValue('main', 'iron') > comfortValue('main', 'radiant') && comfortValue('main', 'radiant') > 0, 'a main, less on the way up');
    ok(comfortValue('learning', 'iron') < comfortValue('learning', 'radiant') && comfortValue('learning', 'radiant') < 0, 'learning, less on the way up');
    near(comfortValue('main', 'radiant'), COMFORT.main * COMFORT.radiant, 1e-9);
    const plain = solo({}), first = plain.comps[0]!.party[0]!, learning = solo({ [first]: 'learning' });
    eq(plain.comps[0]!.party, ['jett'], 'a self-sufficient duelist, as guides advise for a solo player at Iron');
    ok(learning.comps[0]!.party[0] !== first, 'an agent you’re learning gives way');
    const fitOfParty = (a: ReturnType<typeof solo>, id: string) => a.comps.find((c) => c.party[0] === id)!.fit;
    ok(fitOfParty(solo({ omen: 'main' }), 'omen') > fitOfParty(plain, 'omen'), 'a main rises');
  });
  spec('a comp’s pros and cons say when it plays your mains or agents you’re learning, and the fit of one team agrees', () => {
    const a = solo({ omen: 'main', jett: 'learning' });
    const omen = a.comps.find((c) => c.party[0] === 'omen')!, jett = a.comps.find((c) => c.party[0] === 'jett')!;
    ok(explainTeam(answerModel(a), omen.team).pros.some((p) => p.startsWith('Omen is one of your mains')), 'the main');
    ok(explainTeam(answerModel(a), jett.team).cons.some((p) => p.startsWith('You’re still learning Jett')), 'the one you’re learning');
    ok(!explainTeam(modelFor(s), jett.team).cons.some((p) => p.includes('still learning')), 'not without it');
    ok(teamFit(s, jett.team, true, { jett: 'learning' }).fit < teamFit(s, jett.team, true).fit, 'one team, with and without');
  });
});

describe('agent pages: playing against an agent, and who pros play them with', () => {
  spec('each threat an agent poses reads plainly, as the engine counts it, with the agents who answer it best', () => {
    for (const a of AGENTS.filter((x) => !x.estimate)) {
      for (const t of troubleFrom(a.id)) {
        ok(a.caps[t.threat.dim] > t.threat.from && !t.threat.second, `${a.id} ${t.threat.id}: counted as the engine counts it`);
        ok(t.line.startsWith(`${a.name} `) && t.line.endsWith('.') && !/\{|\}|Their /.test(t.line), t.line);
        // a threat no kit answers (their information) names nobody
        if (!Object.keys(t.threat.needs).length) { eq(t.answers, [], `${a.id} ${t.threat.id}: nobody answers it`); continue; }
        eq(t.answers.length, ANSWERERS, `${a.id} ${t.threat.id}: answers`);
        ok(!t.answers.includes(a.id), `${a.id}: not their own answer`);
        // nobody left out answers it better than the last one named
        const last = answerOf(agentById(t.answers[ANSWERERS - 1]!)!, t.threat);
        ok(AGENTS.filter((o) => !o.estimate && o.id !== a.id && !t.answers.includes(o.id)).every((o) => answerOf(o, t.threat) <= last + 1e-9), `${a.id} ${t.threat.id}: the best answers`);
      }
    }
    ok(troubleFrom('jett').some((t) => t.threat.id === 'operator'), 'Jett holds long angles');
    ok(troubleFrom('killjoy').some((t) => t.threat.id === 'setups'), 'Killjoy holds a site alone');
    eq(troubleFrom('nobody'), []);
  });
  spec('pro duos come from the lineups played, most often first, only with enough maps', () => {
    const { maps, duos } = proDuos('omen');
    ok(maps >= DUO_MAPS && duos.length === 4, `${maps} maps`);
    for (let i = 1; i < duos.length; i++) ok(duos[i - 1]!.maps >= duos[i]!.maps, 'most first');
    for (const d of duos) near(d.share, d.maps / maps, 1e-9);
    for (const a of AGENTS) { const p = proDuos(a.id); ok(p.maps >= DUO_MAPS || p.duos.length === 0, `${a.id}: ${p.maps} maps`); }
  });
});

describe('map pages: what each site needs, and rotations', () => {
  spec('a site’s needs on each side come from its own needs, strongest first', () => {
    for (const m of MAPS) for (const site of m.sites) {
      const w = siteWants(m, site);
      for (const side of ['attack', 'defense'] as const) {
        ok(w[side].length <= SITE_WANTS, `${m.id} ${site.id} ${side}`);
        const spec = `${site.needs.both ?? ''};${site.needs[side] ?? ''}`;
        for (const d of w[side]) ok(spec.includes(d), `${m.id} ${site.id} ${side}: ${d} is in its needs`);
      }
    }
  });
  spec('every map with a known scale has a rotation between each two sites, the time a run takes the shortest way', () => {
    for (const m of MAPS) {
      const r = rotations(m);
      if (!MINIMAP_SCALE[m.id]) { eq(r, [], `${m.id}: no scale, no times`); continue; }
      eq(r.length, (m.sites.length * (m.sites.length - 1)) / 2, `${m.id}: each two sites`);
      for (const x of r) ok(x.seconds >= 5 && x.seconds <= 40, `${m.id} ${x.from}-${x.to}: ${x.seconds}s`);
    }
    // on a three-site map, the sites at the ends are the farthest apart
    const haven = rotations(mapById('haven')!), secs = (a: string, b: string) => haven.find((x) => x.from === a && x.to === b)!.seconds;
    ok(secs('A', 'C') > secs('A', 'B') && secs('A', 'C') > secs('B', 'C'), 'Haven: A to C is the longest');
    near(runSeconds('ascent', [[0, 0], [MINIMAP_SCALE.ascent! * 100 * RUN_SPEED, 0]])!, 1, 1e-9);
  });
});

describe('agent select', () => {
  const ask = (locked: string[], mine: string[] = [], map = 'ascent', rank: Situation['rank'] = 'gold') => ({ map, rank, locked, mine, newAgents: true });
  spec('the pick is the Planner’s own best solo pick, never an agent a teammate locked in', () => {
    for (const locked of [[], ['jett'], ['jett', 'sova', 'killjoy'], ['jett', 'sova', 'killjoy', 'raze']]) {
      const a = pickNow(ask(locked));
      const q = selectQuery(ask(locked), false);
      const best = solve(q, situationsOf(q)[0]!, 1).comps[0]!;
      eq(a.pick?.id, best.party[0], `with ${locked.join(', ') || 'nobody'} locked in`);
      ok(!locked.includes(a.pick!.id));
      ok(a.others.length <= SELECT_OTHERS && a.others.every((o) => o.id !== a.pick!.id && !locked.includes(o.id)));
      eq(a.toPick, TEAM - 1 - locked.length);
    }
  });
  spec('a team missing its controller is told to take one, with smokes among what it brings', () => {
    const a = pickNow(ask(['jett', 'sova', 'killjoy', 'raze']));
    eq(agentById(a.pick!.id)!.role, 'controller');
    ok(a.brings.includes('smoke') && a.brings.length <= BRINGS_MOST, a.brings.join());
    eq(a.lacks, [], 'a full team with every role');
    eq(a.askFor, undefined, 'nobody left to ask');
  });
  spec('with players still to pick, it names a role to ask them for; with four duelists in, the roles still missing', () => {
    ok(!!pickNow(ask(['jett', 'sova', 'killjoy'])).askFor);
    const a = pickNow(ask(['reyna', 'jett', 'raze', 'phoenix'], [], 'bind', 'iron'));
    eq(a.lacks.length, 2, a.lacks.join());
  });
  spec('picks come from your agents while one is free, and from everyone when none is', () => {
    const a = pickNow(ask(['jett', 'omen'], ['sage', 'killjoy', 'reyna'], 'lotus', 'immortal'));
    ok(a.fromMine && ['sage', 'killjoy', 'reyna'].includes(a.pick!.id));
    ok(!a.anyone || !['sage', 'killjoy', 'reyna'].includes(a.anyone.id), 'the best of anyone, when it isn’t one of yours');
    const b = pickNow(ask(['omen'], ['omen'], 'haven', 'diamond'));
    ok(!b.fromMine && b.pick!.id !== 'omen');
  });
});

describe('your record from your games', () => {
  const g = (agent: string, result: Game['result'], map = 'ascent', i = 0): Game => ({ id: `g_${agent}${i}`, map, agent, team: [agent], result, note: '', played: i + 1 });
  const many = (agent: string, wins: number, losses: number, draws = 0) => [
    ...Array.from({ length: wins }, (_, i) => g(agent, 'win', 'ascent', i)), ...Array.from({ length: losses }, (_, i) => g(agent, 'loss', 'bind', 100 + i)), ...Array.from({ length: draws }, (_, i) => g(agent, 'draw', 'bind', 200 + i)),
  ];
  spec('a record counts wins, losses and draws, most played first', () => {
    const r = recordBy([...many('omen', 3, 1, 1), ...many('jett', 1, 1)], (x) => x.agent);
    eq(r.map((x) => [x.key, x.games, x.wins, x.losses, x.draws]), [['omen', 5, 3, 1, 1], ['jett', 2, 1, 1, 0]]);
    eq(recordWords(r[0]!), '3 wins, 1 loss, 1 draw');
    eq(winShare(r[0]!), 0.75, 'draws don’t count');
    eq(recordBy(many('omen', 2, 3), (x) => x.map).map((x) => x.key), ['bind', 'ascent']);
  });
  spec('an offer waits for enough games and a clear lean, and never repeats what’s already set', () => {
    const n = COMFORT_OFFER.games;
    const wins = Math.ceil(n * COMFORT_OFFER.main);
    eq(comfortOffers(many('omen', wins - 1, 0), ['omen'], {}), [], 'too few games');
    eq(comfortOffers(many('omen', wins, n - wins), ['omen'], {}).map((o) => [o.agent, o.to, o.add]), [['omen', 'main', false]]);
    eq(comfortOffers(many('omen', wins, n - wins), ['omen'], { omen: 'main' }), [], 'already a main');
    eq(comfortOffers(many('jett', 2, n - 2), ['jett'], {}).map((o) => o.to), ['learning']);
    eq(comfortOffers(many('jett', 2, n - 2), [], {}), [], 'still learning is only offered for your own agents');
    eq(comfortOffers(many('sova', n, 0), ['a', 'b', 'c', 'd'], {}).map((o) => o.add), [true], 'a winning agent who isn’t yours is offered while there’s room');
    eq(comfortOffers(many('sova', n, 0), ['a', 'b', 'c', 'd', 'e'], {}), [], 'and not when your list is full');
  });
});
