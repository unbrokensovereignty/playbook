import { describe, spec, eq, ok } from './harness.ts';
import { AGENTS, agentById } from '../../src/core/kb/agents.ts';
import { DIMS } from '../../src/core/kb/roles.ts';
import { abilityOn } from '../../src/core/kb/kits.ts';
import { MAPS, mapById, type SiteId } from '../../src/core/kb/maps.ts';
import { PRO } from '../../src/core/kb/pro.ts';
import { listJoin } from '../../src/core/text.ts';
import { BUY_GUIDE, DEMANDS, ROUND, branchesOf, JOBS, MOMENTS, PLAYS, SIDE_KINDS, demandOf, isRoundPlay, landsOf, momentName, namedIn, playTitle, playsOn, roundOf, whenOf, type Job, type Play } from '../../src/core/kb/plays.ts';
import { AGENT_TIPS, ATTACK_TIPS, DEFENSE_TIPS, MAP_TIPS, MAP_TIPS_LOW, RANK_TIPS, PARTY_TIPS, DOUBLE_TIPS, ULT_TIPS } from '../../src/core/kb/tips.ts';
import { needOf, useKind, usesFor } from '../../src/core/engine/uses.ts';
import { JOB_SKILLS, PLAY_FIT, HIT_AT, clockTime, momentClock, momentLabel, demandLine, fillPlay, jobSkill, paceOf, plantLine, playFitLabel, playsFor, ranksShort, WEAK_JOB, type FilledPlay } from '../../src/core/engine/plays.ts';
import { plantSpots } from '../../src/core/kb/features.ts';
import { PLAY_RANK } from '../../src/core/engine/weights.ts';
import { RANK_IDS, rankOf, type RankId } from '../../src/core/kb/ranks.ts';
import { agentTips, tipsFor, ultTip } from '../../src/core/engine/tips.ts';
import { CHAT_TIPS, chatText, summaryText } from '../../src/core/engine/summary.ts';
import { explainTeam } from '../../src/core/engine/explain.ts';
import { modelFor, type Situation } from '../../src/core/engine/model.ts';

// a whole sentence, with no clause joined on by a colon or a semicolon
const plain = (s: string) => /^[A-Z]/.test(s) && /[.?]$/.test(s) && !s.includes('!') && !/[a-z’)] ?: |; /.test(s);

describe('plays by rank', () => {
  spec('every map and side has a simple play for a bought round', () => {
    for (const m of MAPS) for (const side of ['attack', 'defense'] as const) {
      ok(playsOn(m.id, side).some((p) => !isRoundPlay(p.kind) && demandOf(p).level === 1), `${m.name} ${side}: a simple play`);
    }
    for (const d of [1, 2, 3, 4] as const) ok(plain(`${DEMANDS[d].name}, ${DEMANDS[d].about}.`), DEMANDS[d].name);
  });
  spec('a play fits the same from the rank its demand runs from and less for each rank below; a simple attack or hold fits less where the other team reads it', () => {
    const team = ['omen', 'sova', 'jett', 'killjoy', 'breach'];
    for (const p of PLAYS.filter((x) => x.map === 'ascent')) {
      const level = demandOf(p).level, plain = fillPlay(p, team), from = RANK_IDS.indexOf(PLAY_RANK.from[level]);
      // a simple attack is read from read.from, and a simple hold or a stack from read.defense
      const hold = p.side === 'defense' && (p.kind === 'setup' || p.kind === 'stack');
      const readable = level === 1 && (p.side === 'attack' || hold);
      const readFrom = RANK_IDS.indexOf(p.side === 'attack' ? PLAY_RANK.read.from : PLAY_RANK.read.defense);
      let last = -1;
      RANK_IDS.forEach((rank, i) => {
        const f = fillPlay(p, team, rank);
        eq(f.short, Math.max(0, from - i), `${p.id} at ${rank}`);
        eq(f.read, readable ? Math.max(0, i - readFrom + 1) : 0, `${p.id} at ${rank}: read`);
        eq(Math.round(f.fit * 1e9), Math.round(Math.max(0, plain.fit - f.short * PLAY_RANK.cost - f.read * PLAY_RANK.read.cost) * 1e9), `${p.id} at ${rank}: fit`);
        // never less on the way up, until defenders start reading it
        if (i < readFrom) ok(f.fit >= last - 1e-9, `${p.id}: no lower at ${rank}`);
        last = f.fit;
      });
      eq(plain.short + plain.read, 0, `${p.id}: no rank, no cost`);
    }
  });
  spec('a play’s demand comes from its steps: utility landing together, groups arriving at once, lurks, calls', () => {
    for (const p of PLAYS) {
      const d = demandOf(p);
      if (p.kind === 'split' || p.kind === 'fake' || p.kind === 'default' || p.kind === 'push' || p.kind === 'fallback') ok(d.level >= 3, `${p.id}: coordinated`);
      if (!p.reads && p.steps.some((s) => s.jobs.includes('lurk'))) ok(d.needs.includes('a lurk timed with the hit'), `${p.id}: lurk`);
      eq(d.level === 1, d.needs.length === 0, `${p.id}: a simple play needs nothing more`);
      for (const n of d.needs) ok(/^[a-z0-9]/.test(n) && !/[.,;]$/.test(n), `${p.id}: "${n}"`);
    }
  });
  spec('a play’s demand says from which rank most teams run it, when the rank is below it', () => {
    const p = PLAYS.find((x) => x.map === 'ascent' && x.kind === 'split')!, team = ['omen', 'sova', 'jett', 'killjoy', 'breach'];
    eq(demandOf(p).level, 3);
    const low = fillPlay(p, team, 'iron'), high = fillPlay(p, team, 'diamond');
    eq(ranksShort(low.demand, 'iron'), low.short);
    ok(demandLine(low, 'iron').includes('from Platinum') && demandLine(low, 'iron').includes('At Iron'), demandLine(low, 'iron'));
    ok(demandLine(high, 'diamond').startsWith(`${DEMANDS[3].name}, since it needs `) && !demandLine(high, 'diamond').includes('Platinum'), demandLine(high, 'diamond'));
    // a simple play says what it is rather than what it needs
    const simple = fillPlay(PLAYS.find((x) => x.map === 'ascent' && demandOf(x).level === 1 && x.side === 'attack')!, team, 'iron');
    eq(demandLine(simple, 'iron'), `${DEMANDS[1].name}, ${DEMANDS[1].about}.`);
    ok(demandLine(fillPlay(simple.play, team, 'immortal'), 'immortal').includes(`From ${rankOf(PLAY_RANK.read.from).name} up`), `read from ${PLAY_RANK.read.from}`);
    const pairs = PLAYS.find((x) => x.map === 'ascent' && x.name === 'Hold in pairs')!;
    const held = (rank: RankId) => demandLine(fillPlay(pairs, team, rank), rank);
    ok(held('immortal').includes(`From ${rankOf(PLAY_RANK.read.defense).name} up, attackers`), held('immortal'));
    eq(held(RANK_IDS[RANK_IDS.indexOf(PLAY_RANK.read.defense) - 1]!), `${DEMANDS[1].name}, ${DEMANDS[1].about}.`);
    ok(plain(held('immortal')), 'a plain sentence');
    ok(plain(demandLine(low, 'iron')) && plain(demandLine(high)), 'plain sentences');
  });
  spec('on defense the plain holds are simple, and with no site asked a stack never comes first', () => {
    const team = ['omen', 'sova', 'jett', 'killjoy', 'breach'];
    for (const m of MAPS) {
      for (const p of playsOn(m.id, 'defense').filter((x) => x.name === 'Hold in pairs')) eq(demandOf(p).level, 1, `${m.name}: ${p.name}`);
      for (const rank of ['iron', 'gold', 'immortal'] as const) {
        const first = playsFor(team, m.id, 'defense', [], false, [], rank)[0]!;
        ok(first.play.kind !== 'stack', `${m.name} at ${rank}: ${first.play.name} first`);
      }
    }
  });
  spec('every map has a play that reads and reacts on attack, listed once with each branch', () => {
    const team = ['omen', 'sova', 'jett', 'killjoy', 'breach'];
    for (const m of MAPS) {
      const reads = PLAYS.filter((p) => p.map === m.id && p.branch);
      ok(reads.length >= 2 && reads.every((p) => p.side === 'attack' && p.reads && demandOf(p).level === 4), `${m.name}: two branches or more, read and react`);
      eq(new Set(reads.map((p) => p.branch!.if)).size, reads.length, `${m.name}: each branch finds out something else`);
      eq(branchesOf(reads[0]!).map((p) => p.id).join(), reads.map((p) => p.id).join(), `${m.name}: branches in the order written`);
      const listed = playsFor(team, m.id, 'attack', [], false, [], 'immortal').filter((f) => f.play.branch);
      eq(listed.length, 1, `${m.name}: listed once`);
      eq(listed[0]!.branches!.map((b) => b.play.id).join(), reads.map((p) => p.id).join(), `${m.name}: with every branch`);
      ok(listed[0]!.branches!.every((b) => b.fit <= listed[0]!.fit + 1e-9), `${m.name}: as its best branch`);
      // the same player reads, and the same players do the same jobs, whichever way the call goes
      const who = (f: FilledPlay) => f.steps.flatMap((s) => s.who.map((d) => `${d.job}:${d.id}`)).sort().join();
      eq(new Set(listed[0]!.branches!.map(who)).size, 1, `${m.name}: same jobs for the same players`);
    }
  });
  spec('each moment of a play falls on the round clock: a simple hit early, a set one at about a minute, a default later, all later from Ascendant', () => {
    const team = ['omen', 'sova', 'jett', 'killjoy', 'breach'];
    eq(clockTime(ROUND.length), '1:40'); eq(clockTime(65), '1:05'); eq(clockTime(5), '0:05');
    const on = (pred: (p: (typeof PLAYS)[number]) => boolean) => PLAYS.find((p) => p.map === 'ascent' && pred(p))!;
    const simple = on((p) => p.kind === 'hit' && demandOf(p).level === 1), set = on((p) => p.kind === 'split'), dflt = on((p) => p.kind === 'default');
    for (const [p, at, high] of [[simple, HIT_AT.fast, HIT_AT.fast], [set, HIT_AT.set, HIT_AT.set - HIT_AT.later], [dflt, HIT_AT.slow, HIT_AT.slow - HIT_AT.later]] as const) {
      eq(momentClock(fillPlay(p, team, 'gold'), 'hit'), `about ${clockTime(at)}`, `${p.id} at Gold`);
      eq(momentClock(fillPlay(p, team, 'immortal'), 'hit'), `about ${clockTime(high)}`, `${p.id} at Immortal`);
      eq(momentLabel(fillPlay(p, team), 'early'), `${momentName(p, 'early')}, from 1:40`);
      eq(momentClock(fillPlay(p, team), 'late'), `${ROUND.spike} seconds on the Spike`);
    }
    // a defense can't say when the attackers will hit
    const setup = PLAYS.find((p) => p.side === 'defense' && p.kind === 'setup')!;
    eq(momentClock(fillPlay(setup, team), 'hit'), undefined);
    eq(momentLabel(fillPlay(setup, team), 'hit'), momentName(setup, 'hit'));
  });
});

describe('plays', () => {
  spec('the Spike goes down on a plant spot: the safe one on a fast hit that comes in by it, the default otherwise, and on the default for a retake', () => {
    const team = ['omen', 'sova', 'jett', 'killjoy', 'breach'];
    for (const m of MAPS) {
      let safe = 0, deep = 0;
      for (const p of PLAYS.filter((x) => x.map === m.id)) {
        const f = fillPlay(p, team), at = f.plant;
        const who = `${m.name}: ${p.name}${p.branch ? ` (${p.branch.if})` : ''}`;
        const has = (w: string) => f.steps.some((s) => s.when === w);
        if (p.side === 'defense') {
          ok(!!at === (p.kind === 'retake' || (p.kind === 'fallback' && has('late'))), `${who}: a Spike only in a retake, or a retake setup's retake`);
          if (at) ok(!at.safe && at.site === p.site && at.when === (p.kind === 'retake' ? f.steps[0]!.when : 'late') && !at.end, `${who}: down on the default plant from the retake's start`);
        } else if (at) {
          ok(!p.site || at.site === p.site, `${who}: on the play's own site`);
          ok(f.steps.some((s) => s.when === 'hit' && s.route[s.route.length - 1] === `${at.site} Site`), `${who}: someone goes onto ${at.site} before it's planted`);
          eq(at.when, has('late') ? 'late' : 'hit', `${who}: down after the plant, or as the hit ends`);
          ok(!at.safe || paceOf(f) === 'fast', `${who}: a safe plant only on a fast hit`);
          if (at.safe) safe++; else deep++;
        } else ok(!p.site || isRoundPlay(p.kind), `${who}: an attack on a site plants`);
        if (at) {
          const spots = plantSpots(m.id, at.site);
          ok((at.safe ? spots.safe : spots.plant)?.at === at.at, `${who}: on the site's ${at.safe ? 'safe' : 'default'} plant`);
          ok(plain(plantLine(p, at)) && plantLine(p, at).includes(`${at.site} Site`), `${who}: says where the Spike is`);
        }
      }
      ok(safe > 0 && deep > 0, `${m.name}: some attacks plant safe and some on the default spot`);
    }
  });
  spec('every map has every kind of play on each side, the same as every other map', () => {
    for (const m of MAPS) for (const side of ['attack', 'defense'] as const) {
      const have = new Set(PLAYS.filter((p) => p.map === m.id && p.side === side).map((p) => p.kind));
      for (const kind of SIDE_KINDS[side]) ok(have.has(kind), `${m.name} ${side}: a ${kind}`);
    }
  });
  spec('every map has plays for both sides and every site, five jobs each', () => {
    eq(new Set(PLAYS.map((p) => p.id)).size, PLAYS.length, 'ids are unique');
    for (const m of MAPS) {
      for (const s of m.sites) {
        ok(playsOn(m.id, 'attack', [s.id]).some((p) => p.site === s.id), `${m.name}: an attack play for ${s.id}`);
        ok(playsOn(m.id, 'defense', [s.id]).some((p) => p.site === s.id && p.kind === 'retake'), `${m.name}: a retake for ${s.id}`);
        // and as many choices on defense as on attack: a stack, an early push and a setup for the retake
        for (const kind of ['stack', 'push', 'fallback'] as const) ok(playsOn(m.id, 'defense', [s.id]).some((p) => p.site === s.id && p.kind === kind), `${m.name}: a ${kind} for ${s.id}`);
      }
      ok(playsOn(m.id, 'defense').some((p) => p.kind === 'setup'), `${m.name}: a defense setup`);
      ok(playsOn(m.id, 'attack').some((p) => !p.site), `${m.name}: a play for the whole map`);
      ok(playsOn(m.id, 'attack').some((p) => p.kind === 'fake'), `${m.name}: a fake`);
    }
    for (const p of PLAYS) {
      eq(p.steps.reduce((n, s) => n + s.jobs.length, 0), 5, `${p.name}: five jobs`);
      ok(SIDE_KINDS[p.side].includes(p.kind), `${p.name}: a kind of play for ${p.side}`);
      ok(plain(p.about), `${p.name}: a plain line about it`);
      const map = mapById(p.map)!;
      for (const s of p.steps) {
        ok(plain(s.text), `${p.name}: “${s.text}” is a plain sentence`);
        for (const c of s.route) ok(map.callouts.some((x) => x.name === c), `${p.name}: ${c} is a callout`);
      }
    }
  });
  spec('an attack play never smokes the way a teammate comes in or the spot they hold', () => {
    for (const p of PLAYS.filter((x) => x.side === 'attack')) {
      const names = mapById(p.map)!.callouts.map((c) => c.name).filter((c) => !c.endsWith(' Site'));
      for (const s of p.steps.filter((x) => x.jobs.includes('smoke'))) {
        // the callouts the smoke goes on: those its text names, up to anything it says to leave open
        const on = names.filter((c) => s.text.replace(/\bleave .*$/i, '').includes(c) && !s.route.includes(c));
        for (const o of p.steps) if (o !== s) for (const c of o.route) ok(!on.includes(c), `${p.map}, ${p.name}: the smoke on ${c} is on a teammate’s way`);
      }
    }
  });
  spec('every map has a pistol-round, an eco and an anti-eco play for each side, kept apart from the plays for a bought round', () => {
    const team = ['omen', 'sova', 'jett', 'killjoy', 'breach'];
    for (const m of MAPS) {
      for (const side of ['attack', 'defense'] as const) {
        const low = playsFor(team, m.id, side, [], true);
        for (const kind of ['pistol', 'eco', 'antieco'] as const) ok(low.some((f) => f.play.kind === kind), `${m.name} ${side}: a ${kind} play`);
        eq(low.filter((f) => f.play.kind === 'antieco').length, 1, `${m.name} ${side}: one anti-eco play`);
        ok(low.every((f) => isRoundPlay(f.play.kind)) && playsFor(team, m.id, side).every((f) => !isRoundPlay(f.play.kind)), `${m.name} ${side}: kept apart`);
        // the round decides them, not the site asked about
        eq(playsFor(team, m.id, side, ['A'], true).length, low.length, `${m.name} ${side}: whatever the sites`);
      }
    }
    for (const p of PLAYS.filter((x) => isRoundPlay(x.kind))) eq(playTitle(p), `${roundOf(p)!.name}: ${p.name}`);
    eq(playTitle(playsOn('haven', 'attack', ['C']).find((p) => p.kind === 'hit')!), 'C hit down Long', 'a play for a bought round goes by its name');
    for (const r of BUY_GUIDE) ok(plain(r.text) && plain(`${r.name}.`), `${r.name}: plain sentences`);
  });
  spec('an anti-eco play is simple, keeps everyone close enough to trade and holds the plant from range', () => {
    for (const p of PLAYS.filter((x) => x.kind === 'antieco')) {
      const who = `${p.map} ${p.side}`;
      eq(demandOf(p).level, 1, `${who}: simple`);
      ok(p.steps.every((s) => !s.jobs.includes('lurk') && !s.jobs.includes('flank')), `${who}: no one plays alone`);
      if (p.side === 'attack') {
        const f = fillPlay(p, ['omen', 'sova', 'jett', 'killjoy', 'breach']);
        ok(f.plant && !f.plant.safe, `${who}: plants on the default spot`);
        const hold = p.steps.find((s) => s.jobs.includes('postplant'))!;
        ok(!hold.route.at(-1)!.endsWith(' Site'), `${who}: holds the plant from off the site`);
      }
    }
  });
  spec('every step has a moment, in an order that makes sense', () => {
    for (const p of PLAYS) {
      for (const s of p.steps) {
        ok(MOMENTS.includes(s.when), `${p.name}: a moment`);
        if (p.side === 'attack' && s.jobs.includes('postplant')) eq(s.when, 'late', `${p.map}, ${p.name}: the post-plant comes after the plant`);
        if (p.side === 'attack' && s.jobs.includes('entry')) ok(s.when !== 'late', `${p.map}, ${p.name}: the entry isn’t after the plant`);
      }
      if (p.kind === 'retake') ok(p.steps.some((s) => s.when === 'hit'), `${p.map}, ${p.name}: someone goes in on the retake`);
      if (p.side === 'attack' && !isRoundPlay(p.kind) && p.kind !== 'default') ok(p.steps.some((s) => s.when === 'hit'), `${p.map}, ${p.name}: someone goes in on the hit`);
    }
    eq(momentName({ side: 'attack', kind: 'hit' }, 'late'), 'After the plant');
    eq(momentName({ side: 'defense', kind: 'retake' }, 'hit'), 'On the retake');
    // written moments win over the words
    eq(whenOf('attack', 'hit', ['recon'], 'Clear A Main as the hit starts.'), 'hit');
    eq(whenOf('attack', 'hit', ['recon'], 'Clear A Main first.'), 'early');
  });
  spec('a step’s utility lands on what its sentence names, never on the way it walks', () => {
    for (const p of PLAYS) {
      const names = mapById(p.map)!.callouts.map((c) => c.name);
      for (const s of p.steps) {
        for (const c of [...s.on, ...(s.lane ? [s.lane] : [])]) ok(names.includes(c) && !/ Side Spawn$/.test(c), `${p.map}, ${p.name}: ${c} is a callout off spawn`);
        if (s.jobs.includes('smoke')) for (const c of s.on) ok(!s.route.includes(c), `${p.map}, ${p.name}: a smoke on its own way`);
        // a step that says what it smokes, flashes or walls off throws it somewhere
        if (s.jobs.some((j) => j === 'smoke' || j === 'flash' || j === 'wall') && namedIn(s.text, p.map, p.site).some((c) => !s.route.includes(c))) ok(s.on.length > 0 || !!s.lane, `${p.map}, ${p.name}: “${s.text}” lands somewhere`);
      }
    }
    const lands = (jobs: Job[], route: string[], text: string) => landsOf(jobs, route, text, 'abyss', 'A');
    eq(lands(['smoke'], ['Attacker Side Spawn', 'A Lobby'], 'Smoke A Tower and A Link from A Lobby, then A Security once the site is taken.').on, ['A Tower', 'A Link', 'A Security']);
    eq(lands(['wall'], ['A Lobby', 'A Main'], 'Wall down A Main to cut off A Tower and A Bridge while the team crosses.'), { on: ['A Tower', 'A Bridge'], lane: 'A Main' });
    eq(lands(['wall'], ['B Lobby', 'B Main'], 'Wall the site from B Main so the plant is hidden.').lane, 'A Site');
    eq(lands(['flash', 'retake'], ['A Link', 'A Site'], 'Flash and retake together.').on, ['A Site'], 'a flash with no target goes where the player is heading');
    eq(lands(['smoke'], ['Attacker Side Spawn'], 'Keep your smokes for the hit.').on, []);
    eq(lands(['smoke'], ['A Lobby'], 'Smoke the back of the site and leave A Main open.').on, ['A Site']);
  });
  spec('only the chosen sites’ plays come, with the whole-map ones', () => {
    const c = playsOn('haven', 'attack', ['C']);
    ok(c.every((p) => p.site === 'C' || p.site === null));
    ok(c.some((p) => p.site === 'C') && c.some((p) => p.site === null));
    ok(playsOn('haven', 'attack').some((p) => p.site === 'A'));
  });
});

describe('filling plays', () => {
  spec('every job draws on real strengths', () => {
    for (const j of JOBS) ok(JOB_SKILLS[j].length > 0, `${j} has a way to be done`);
  });
  spec('each job goes to a different agent, the best overall', () => {
    const team = ['omen', 'sova', 'jett', 'killjoy', 'breach'];
    for (const p of playsOn('haven', 'attack')) {
      const f = fillPlay(p, team);
      const who = f.steps.flatMap((s) => s.who.map((d) => d.id));
      eq(new Set(who).size, 5, `${p.name}: five different agents`);
      ok(f.fit > 0 && f.fit <= 1, `${p.name}: a fit from 0 to 1`);
      for (const s of f.steps) for (const d of s.who) ok(s.jobs.includes(d.job), `${p.name}: ${d.id} does a job of their step`);
    }
    const hit = fillPlay(playsOn('haven', 'attack', ['C']).find((p) => p.kind === 'hit')!, team);
    const jobOf = (id: string) => hit.steps.flatMap((s) => s.who).find((d) => d.id === id)?.job;
    eq(jobOf('omen'), 'smoke');
    eq(jobOf('sova'), 'recon');
    eq(jobOf('jett'), 'entry');
  });
  spec('each player’s utility is drawn where it lands, the way their kit throws it', () => {
    const team = ['omen', 'viper', 'kayo', 'sova', 'jett'];
    for (const p of PLAYS) {
      const f = fillPlay(p, team);
      for (const s of f.steps) for (const t of s.throws) {
        ok([t.at, ...(t.to ? [t.to] : [])].every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1), `${p.name}: on the map`);
        ok(s.who.some((d) => d.id === t.who), `${p.name}: thrown by someone in the step`);
        eq(t.kind === 'wall', !!t.to, `${p.name}: only a wall has two ends`);
      }
      // in the order they happen
      const order = f.steps.map((s) => MOMENTS.indexOf(s.when));
      ok(order.every((m, i) => !i || m >= order[i - 1]!), `${p.name}: steps in the order they happen`);
    }
    const hit = fillPlay(playsOn('abyss', 'attack', ['A']).find((x) => x.name === 'A hit through Main')!, team);
    const kinds = (id: string) => hit.steps.flatMap((s) => s.throws).filter((t) => t.who === id).map((t) => t.kind);
    // two Dark Covers: A Tower and A Link, and the step says A Security goes without (engine/uses.ts)
    eq(kinds('omen'), ['smoke', 'smoke'], 'Omen smokes A Tower and A Link');
    eq(hit.steps.find((s) => s.who.some((d) => d.id === 'omen'))!.text, 'Smoke A Tower and A Link from A Lobby. Omen’s Dark Cover has two charges, so A Security goes without a smoke.');
    eq(fillPlay(hit.play, ['brimstone', 'viper', 'kayo', 'sova', 'jett']).steps.flatMap((s) => s.throws).filter((t) => t.who === 'brimstone').length, 3, 'Brimstone’s three Sky Smokes reach all three');
    eq(kinds('viper'), ['wall'], 'Viper walls down A Main');
    eq(kinds('kayo'), ['flash', 'flash']);
    eq(kinds('sova'), ['recon']);
    // a wall's job done with smokes smokes off what it cuts off, and a flash done with a stun is a stun
    const noWall = fillPlay(hit.play, ['omen', 'brimstone', 'breach', 'fade', 'jett']);
    const wall = noWall.steps.find((s) => s.jobs.includes('wall'))!;
    ok(wall.throws.length > 0 && wall.throws.every((t) => t.kind === 'smoke'), 'smokes in place of a wall');
    const flash = fillPlay(hit.play, ['omen', 'viper', 'deadlock', 'sova', 'jett']).steps.find((s) => s.jobs.includes('flash'))!;
    ok(flash.throws.every((t) => t.kind !== 'flash'), 'nobody throws a flash they don’t have');
  });
  spec('no way of sharing out the jobs fits the play better, and of those that fit as well, none does the jobs better', () => {
    const cap = (weak: number) => (weak > 1 ? PLAY_FIT.works : weak ? PLAY_FIT.well : Infinity) - 0.01;
    const cases: [readonly string[], Play][] = [
      [['viper', 'fade', 'raze', 'cypher', 'harbor'], playsOn('breeze', 'attack')[0]!],
      // the most done overall leaves one job to someone weak at it; this sharing leaves none
      [['omen', 'sova', 'chamber', 'neon', 'sage'], playsOn('ascent', 'attack', ['B']).find((x) => x.name === 'B hit through Main')!],
      [['viper', 'sova', 'killjoy', 'jett', 'kayo'], playsOn('icebox', 'defense').find((x) => x.name === 'Hold in pairs')!],
    ];
    for (const [team, p] of cases) {
      const f = fillPlay(p, team);
      const slots = p.steps.flatMap((step) => step.jobs.map((job) => ({ step, job })));
      let bestFit = -1, bestSum = -1;
      const perm = (left: readonly string[], k: number, sum: number, weak: number) => {
        if (k === slots.length) {
          const fit = Math.min(sum / slots.length, cap(weak));
          if (fit > bestFit + 1e-9 || (fit > bestFit - 1e-9 && sum > bestSum)) { bestFit = fit; bestSum = sum; }
          return;
        }
        left.forEach((id, i) => {
          const v = jobSkill(AGENTS.find((a) => a.id === id)!, slots[k]!.job, needOf(p.map, slots[k]!.step, slots[k]!.job)).value;
          perm(left.filter((_, j) => j !== i), k + 1, sum + v, weak + Number(v < WEAK_JOB));
        });
      };
      perm(team, 0, 0, 0);
      ok(Math.abs(f.fit - bestFit) < 1e-9 && Math.abs(f.average * slots.length - bestSum) < 1e-9, `${p.map}, ${p.name}: the best fit, then the best total`);
    }
    eq(fillPlay(cases[1]![1], cases[1]![0]).weak.length, 0, 'no job left weak when a sharing can avoid it');
  });
  spec('no step asks a player for more smokes, flashes or other utility than they have in a round (the pros’ comps on every play)', () => {
    for (const p of PLAYS) for (const c of PRO[p.map]?.comps ?? []) for (const s of fillPlay(p, c).steps) for (const d of s.who) {
      const kind = useKind(d.job, d.dims);
      if (!kind || d.value <= 0) continue;
      const uses = usesFor(agentById(d.id)!, d.job, d.dims), where = `${p.map}, ${p.name}, ${d.id}`;
      ok(s.throws.filter((t) => t.who === d.id && t.kind !== 'wall').length <= uses, `${where}: no more drawn than ${uses}`);
      ok(needOf(p.map, s, d.job)(kind) <= uses, `${where}: “${s.text}” asks for no more than ${uses}`);
    }
  });
  spec('the pros’ usual comps run most of their map’s plays in full', () => {
    let n = 0, full = 0;
    for (const p of PLAYS) for (const c of PRO[p.map]?.comps ?? []) { n++; if (!fillPlay(p, c).weak.length) full++; }
    ok(n > 900 && full / n >= 0.8, `${full} of ${n}`);
  });
  spec('a job nobody can do well is flagged, and a team that suits the play fits it better', () => {
    const p = playsOn('ascent', 'attack', ['A']).find((x) => x.kind === 'hit')!;
    const duelists = fillPlay(p, ['jett', 'reyna', 'raze', 'phoenix', 'iso']);
    const usual = fillPlay(p, ['omen', 'sova', 'jett', 'killjoy', 'kayo']);
    ok(duelists.weak.length > 0 && duelists.weak.every((d) => d.value < WEAK_JOB));
    eq(usual.weak.length, 0);
    ok(usual.fit > duelists.fit + 0.15);
    // and a play with a job nobody can do never fits well: a hit that needs a flash, with no flash in the comp
    const lotus = playsOn('lotus', 'attack', ['C']).find((x) => x.name === 'C hit through Main')!;
    const noFlash = fillPlay(lotus, ['raze', 'fade', 'viper', 'omen', 'chamber']);
    ok(noFlash.weak.length === 1 && noFlash.average >= PLAY_FIT.well, 'the other jobs are done well');
    eq(playFitLabel(noFlash.fit), 'Works');
    for (const team of [['jett', 'reyna', 'raze', 'phoenix', 'iso'], ['raze', 'fade', 'viper', 'omen', 'chamber'], ['omen', 'sova', 'jett', 'killjoy', 'kayo']]) {
      for (const f of playsOn('ascent', 'attack').concat(playsOn('lotus', 'attack')).map((x) => fillPlay(x, team))) {
        if (f.weak.length) ok(playFitLabel(f.fit) !== 'Fits well', `${f.play.name} with ${team.join()}: never fits well with a job nobody can do`);
        if (f.weak.length > 1) eq(playFitLabel(f.fit), 'A stretch', `${f.play.name} with ${team.join()}`);
      }
    }
  });
  spec('the abilities named are the agent’s own', () => {
    const f = fillPlay(playsOn('breeze', 'attack')[0]!, ['viper', 'fade', 'raze', 'cypher', 'harbor']);
    for (const s of f.steps) for (const d of s.who) for (const name of d.abilities) {
      ok(['C', 'Q', 'E', 'X'].some((k) => abilityOn(d.id, k)?.name.startsWith(name)), `${d.id}: ${name}`);
    }
  });
  spec('plays come best fit first, and on defense the holds before the retakes', () => {
    const team = ['omen', 'sova', 'jett', 'killjoy', 'breach'];
    for (const m of MAPS) for (const side of ['attack', 'defense'] as const) for (const rank of [undefined, 'iron', 'radiant'] as const) {
      const list = playsFor(team, m.id, side, [], false, [], rank);
      const firstRetake = list.findIndex((p) => p.play.kind === 'retake');
      ok(firstRetake < 0 || list.slice(firstRetake).every((p) => p.play.kind === 'retake'), `${m.name} ${side}: holds first`);
      for (let i = 1; i < list.length; i++) if ((list[i - 1]!.play.kind === 'retake') === (list[i]!.play.kind === 'retake')) ok(list[i - 1]!.fit >= list[i]!.fit, `${m.name} ${side}: best fit first`);
    }
  });
  spec('with sites chosen, their plays come first, then the whole map’s, each best fit first', () => {
    const team = ['yoru', 'neon', 'fade', 'astra', 'killjoy'];
    for (const side of ['attack', 'defense'] as const) {
      const list = playsFor(team, 'pearl', side, ['B']);
      const first = list.findIndex((p) => !p.play.site);
      ok(list[0]!.play.site === 'B', `${side}: a B play first`);
      ok(first < 0 || list.slice(first).every((p) => !p.play.site), `${side}: then the whole map’s`);
      const kind = (p: FilledPlay) => `${!p.play.site} ${p.play.kind === 'retake'}`;
      for (let i = 1; i < list.length; i++) if (kind(list[i - 1]!) === kind(list[i]!)) ok(list[i - 1]!.fit >= list[i]!.fit, `${side}: best fit first`);
    }
  });
});

describe('tips', () => {
  spec('every agent and map has plain tips', () => {
    for (const a of AGENTS) {
      const t = AGENT_TIPS[a.id];
      ok(t, `${a.name} has tips`);
      for (const s of t!) ok(plain(s), `${a.name}: “${s}”`);
    }
    for (const m of MAPS) for (const side of ['attack', 'defense'] as const) {
      for (const s of [...MAP_TIPS[m.id]![side], ...MAP_TIPS_LOW[m.id]![side]]) ok(plain(s), `${m.name}: “${s}”`);
    }
    for (const [id, s] of [...Object.entries(ATTACK_TIPS), ...Object.entries(DEFENSE_TIPS)]) ok(AGENTS.some((a) => a.id === id) && plain(s), `${id}: “${s}”`);
    for (const s of [...Object.values(RANK_TIPS).flatMap((t) => [...t.any, t.attack, t.defense]), ...Object.values(PARTY_TIPS).flatMap((t) => [t.play, t.ask]), ...Object.values(DOUBLE_TIPS).flatMap((t) => Object.values(t))]) ok(plain(s), s);
  });
  spec('every agent has a plain tip for their ultimate on each side, naming it as the game does, and a plan shows the one its situation leans on most', () => {
    const name = (t: string) => t.replaceAll('’', "'");
    for (const a of AGENTS.filter((x) => !x.estimate)) for (const side of ['attack', 'defense'] as const) {
      const t = ULT_TIPS[a.id]?.[side];
      ok(t && plain(t.text), `${a.name} ${side}: an ultimate tip`);
      const ult = abilityOn(a.id, 'X')?.name;
      ok(ult && name(t!.text).includes(name(ult)), `${a.name} ${side}: names ${ult}`);
    }
    // Viper's Pit holds a post-plant: on attack it's the one to plan around over Jett's Blade Storm, wherever post-plant counts more than entry
    const s = { map: 'ascent', side: 'attack', sites: [], rank: 'immortal' } as const;
    const w = modelFor(s).weight, at = (d: string) => w[DIMS.indexOf(d as (typeof DIMS)[number])]!;
    const pick = ultTip([agentById('viper')!, agentById('jett')!], s)!;
    eq(pick.agent, at('postplant') >= at('entry') ? 'viper' : 'jett');
    ok(tipsFor(['viper', 'jett', 'sova', 'omen', 'killjoy'], s).some((t) => /ultimate/.test(t.about)), 'a plan has an ultimate tip');
    eq(tipsFor(['viper', 'jett', 'sova', 'omen', 'killjoy'], s).filter((t) => /ultimate/.test(t.about)).length, 1, 'just one');
  });
  spec('tips name only the map’s own callouts', () => {
    for (const m of MAPS) {
      const names = new Set(m.callouts.map((c) => c.name));
      for (const s of [...MAP_TIPS[m.id]!.attack, ...MAP_TIPS[m.id]!.defense, ...MAP_TIPS_LOW[m.id]!.attack, ...MAP_TIPS_LOW[m.id]!.defense]) {
        for (const c of s.match(/\b(?:A|B|C|Mid) [A-Z][a-z]+(?: [A-Z][a-z]+)?/g) ?? []) {
          ok(names.has(c) || names.has(c.split(' ').slice(0, 2).join(' ')), `${m.name}: ${c}`);
        }
      }
    }
  });
  spec('a plan for one site leads with the map tips about that site', () => {
    const at = (sites: SiteId[]) => tipsFor(['jett'], { map: 'pearl', side: 'attack', sites, rank: 'iron' }).filter((x) => x.about === 'Pearl, attack').map((x) => x.text);
    eq(at(['A']).length, 2, 'both tips stay');
    ok(/^B Main/.test(at([])[0]!), `without a site the usual order: ${at([])[0]}`);
    ok(!/^B Main/.test(at(['A'])[0]!), `a plan for A doesn’t lead with B Main: ${at(['A'])[0]}`);
    eq(at(['B'])[0], at([])[0], 'a plan for B keeps the B tip first');
    for (const m of MAPS) for (const side of ['attack', 'defense'] as const) for (const site of m.sites.map((x) => x.id)) {
      const all = tipsFor(['jett'], { map: m.id, side, sites: [], rank: 'gold' }).filter((x) => x.agent === undefined && x.about.startsWith(m.name)).map((x) => x.text);
      const one = tipsFor(['jett'], { map: m.id, side, sites: [site], rank: 'gold' }).filter((x) => x.agent === undefined && x.about.startsWith(m.name)).map((x) => x.text);
      eq([...one].sort(), [...all].sort(), `${m.name} ${side} ${site}: the same tips, only in another order`);
    }
  });
  spec('a copied plan’s map tips lead with each side’s play site, and every other tip is the one on screen', () => {
    // the sheet orders the map tips by its plays' sites without asking about another situation, so its
    // ultimate tip (read off the situation's needs) can't differ from the Tips tab
    const s: Situation = { map: 'pearl', side: 'both', sites: [], rank: 'gold' };
    const team = ['jett', 'sova', 'astra', 'killjoy', 'kayo'];
    const screen = tipsFor(team, s), sheet = tipsFor(team, s, 5, [], 0, { attack: ['A'], defense: ['B'] });
    const notMap = (xs: readonly { about: string }[]) => xs.filter((x) => !x.about.startsWith('Pearl,'));
    eq(notMap(sheet), notMap(screen));
    const first = (side: 'attack' | 'defense', site: SiteId) => tipsFor(team, { ...s, side, sites: [site] }).find((x) => x.about === `Pearl, ${side}`)!.text;
    eq(sheet.find((x) => x.about === 'Pearl, attack')!.text, first('attack', 'A'));
    eq(sheet.find((x) => x.about === 'Pearl, defense')!.text, first('defense', 'B'));
  });
  spec('a plan gets tips for its map, side, doubled roles, agents, rank and party', () => {
    const team = ['omen', 'viper', 'sova', 'jett', 'killjoy'];
    const t = tipsFor(team, { map: 'haven', side: 'attack', sites: [], rank: 'gold' });
    ok(t.some((x) => x.about === 'Haven, attack'));
    ok(t.some((x) => x.about === 'Two controllers'));
    // doubling up asks for something else on defense
    const two = (side: 'attack' | 'defense' | 'both') => tipsFor(team, { map: 'haven', side, sites: [], rank: 'gold' }).find((x) => x.about === 'Two controllers')!.text;
    ok(two('attack') !== two('defense') && two('defense') !== two('both'), 'a tip for each side');
    ok(!/plant/.test(two('defense')), 'defenders don’t plant');
    for (const name of ['Omen', 'Viper', 'Sova', 'Jett', 'Killjoy']) ok(t.some((x) => x.about === name), name);
    // and every agent's tip on defense is about defending
    for (const a of AGENTS) {
      const tip = tipsFor([a.id], { map: 'haven', side: 'defense', sites: [], rank: 'gold' }).find((x) => x.about === a.name)!.text;
      ok(!/after the plant|post-plant|before the hit(?! comes)|the team crosses|walk the team|enters alone|(?:stop|or) the defuse|a hit\b/.test(tip), `${a.name} on defense: “${tip}”`);
      // and on attack, about attacking
      const attack = tipsFor([a.id], { map: 'haven', side: 'attack', sites: [], rank: 'gold' }).find((x) => x.about === a.name)!.text;
      ok(!/\ba rush\b|the hit comes|for the retake|site entrance/.test(attack), `${a.name} on attack: “${attack}”`);
      // an agent's page has every tip once
      eq(new Set(agentTips(a.id)).size, agentTips(a.id).length, `${a.name}: no tip twice`);
    }
    ok(t.some((x) => x.about === 'Gold'));
    const solo = tipsFor(team, { map: 'any', side: 'both', sites: [], rank: 'gold' }, 1, ['sova']);
    ok(solo.some((x) => x.about === 'Solo') && solo.some((x) => x.about === 'Sova') && !solo.some((x) => x.about === 'Jett'), 'a solo player’s own agent, and the solo tips');
    const duo = tipsFor(team, { map: 'any', side: 'both', sites: [], rank: 'gold' }, 2, ['sova', 'jett']);
    ok(!duo.some((x) => x.about === 'Omen'), 'only your party’s agents');
    ok(duo.some((x) => x.about === 'Duo'));
    ok(!duo.some((x) => x.about.startsWith('Haven')));
    // once teammates have locked in every other spot, there's no one left to ask for a role
    const trio = (locked: number) => tipsFor(team, { map: 'any', side: 'both', sites: [], rank: 'gold' }, 3, ['sova', 'jett', 'omen'], locked).filter((x) => x.about === 'Trio').map((x) => x.text);
    ok(trio(1).includes(PARTY_TIPS[3].ask) && !trio(2).includes(PARTY_TIPS[3].ask) && trio(2).includes(PARTY_TIPS[3].play));
  });
});

describe('copying a plan', () => {
  spec('a party’s plan says what its fit means, what to expect, and the role to ask random teammates for', () => {
    const team = ['sova', 'clove', 'jett', 'reyna', 'chamber'];
    const s = { map: 'haven', side: 'attack', sites: [], rank: 'gold' } as const;
    const parts = { title: 'Haven, attack · Gold · duo', team, party: ['sova', 'clove'], fit: 100, tier: 'S', why: explainTeam(modelFor(s), team), tips: tipsFor(team, s, 2, ['sova', 'clove']) };
    const text = summaryText({ ...parts, ask: 'sentinel', expected: 77.4 });
    ok(text.includes('Comp: Sova, Clove, Jett, Reyna, Chamber (your party plays Sova and Clove). Fit 100 among duos, tier S.\nThe best picks for your random teammates are Jett, Reyna and Chamber.\nIf they pick on their own, expect a team that fits about 77 out of 100.\nAsk your random teammates for a sentinel first.'), text);
    ok(summaryText({ ...parts, party: [] }).includes('. Fit 100, tier S.'), 'a five-stack’s fit is just its fit');
    ok(!summaryText(parts).includes('teammates for a sentinel first'), 'nothing to ask, no line');
  });
  spec('the short version for a party chat has the comp with roles, how it wins, who does what in the play and two tips', () => {
    const team = ['omen', 'sova', 'jett', 'killjoy', 'breach'];
    const s = { map: 'haven', side: 'attack', sites: ['C'], rank: 'gold' } as const;
    const f = playsFor(team, 'haven', 'attack', ['C'], false, [], 'gold')[0]!;
    const parts = { title: 'Haven, attack, C site · Gold · five-stack', team, fit: 90, tier: 'A', why: explainTeam(modelFor(s), team), plays: [f], tips: tipsFor(team, s, 5, []) };
    const text = chatText(parts), lines = text.split('\n');
    eq(lines[0], 'Playbook: Haven, attack, C site · Gold · five-stack');
    eq(lines[1], 'Comp: Omen (controller), Sova (initiator), Jett (duelist), Killjoy (sentinel), Breach (initiator).');
    if (parts.why.plan) ok(text.includes(`\n${parts.why.plan}\n`), 'how it wins');
    ok(text.includes(`\nPlay: ${playTitle(f.play)}\n`), 'the play');
    // a line for each step, in the order they happen: who, then what to do
    for (const st of f.steps) ok(text.includes(`\n- ${listJoin(st.who.map((d) => agentById(d.id)!.name))}: ${st.text}`), st.text);
    eq(lines.filter((l) => l.startsWith('- ')).length, f.steps.length + CHAT_TIPS, 'the steps and the tips');
    ok(parts.tips.length > CHAT_TIPS && text.includes(`\nTips\n- ${parts.tips[0]!.about}: ${parts.tips[0]!.text}`), 'the first tips');
    ok(text.length < summaryText(parts).length / 2, 'well under half the whole plan');
    eq(CHAT_TIPS, 2);
  });
});
