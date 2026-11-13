import { describe, spec, eq, ok, throws } from './harness.ts';
import { AGENTS, agentById, isNew, parseCaps } from '../../src/core/kb/agents.ts';
import { kitOf, abilityOn, abilityNames, plainText, textParts } from '../../src/core/kb/kits.ts';
import { MAPS, MECHANICS, POOL, mapById, parseNeeds, calloutLabel } from '../../src/core/kb/maps.ts';
import { hasFloor, onFloor, walk, type Spot } from '../../src/core/kb/floor.ts';
import { FEATURES, FEATURE_KINDS, plantSpots, siteAt } from '../../src/core/kb/features.ts';
import { PLAYS } from '../../src/core/kb/plays.ts';
import { AGENT_MAP_TIPS, MAP_TIPS, MAP_TIPS_LOW } from '../../src/core/kb/tips.ts';
import { EVENTS, LINEUPS, pickable, RELEASED_DURING } from '../../src/core/kb/lineups.ts';
import { PLAYED, PRO, PRO_MAPS_COUNTED, REGIONAL_BELOW, proKnown, proOverall, proPick, proRoleMix } from '../../src/core/kb/pro.ts';
import { PAIRS, pairOf } from '../../src/core/kb/synergy.ts';
import { RANKS } from '../../src/core/kb/ranks.ts';
import { DIMS, DIM_INFO, ROLE_IDS } from '../../src/core/kb/roles.ts';
import { NEW_AGENTS } from '../../src/core/kb/new-agents.ts';
import { MAP_WINS, sideShare } from '../../src/core/kb/mapwins.ts';
import { inUse } from '../../src/core/settings.ts';

describe('agents', () => {
  spec('every agent has a role, strengths from 0 to 1, and fair numbers', () => {
    ok(AGENTS.length >= 29, 'all the agents are in');
    eq(new Set(AGENTS.map((a) => a.id)).size, AGENTS.length, 'ids are unique');
    for (const a of AGENTS) {
      ok(ROLE_IDS.includes(a.role), `${a.name}: a known role`);
      for (const d of DIMS) ok(a.caps[d] >= 0 && a.caps[d] <= 1, `${a.name}: ${d} between 0 and 1`);
      ok(a.solo >= 0 && a.solo <= 1 && a.skill >= 0 && a.skill <= 1, `${a.name}: solo and skill between 0 and 1`);
      ok(a.pop >= 0 && a.pop <= 100 && a.pro >= 0 && a.pro <= 100, `${a.name}: pick rates are percents`);
      ok(/^\d{4}-\d\d-\d\d$/.test(a.released), `${a.name}: a release date`);
      ok(a.line.length > 20 && !a.line.includes('!'), `${a.name}: a plain line about them`);
      eq(agentById(a.id), a);
    }
  });
  spec('each role has agents, and the ranked pick shares add up to about everything', () => {
    for (const r of ROLE_IDS) ok(AGENTS.filter((a) => a.role === r).length >= 4, `${r}: at least four agents`);
    const total = AGENTS.reduce((s, a) => s + a.pop, 0);
    ok(total > 90 && total < 110, `pick shares add to ${total}`);
  });
  spec('strengths name abilities the agent really has', () => {
    for (const a of AGENTS) {
      for (const [dim, keys] of Object.entries(a.via)) {
        for (const k of keys!) if (k !== 'G') ok(abilityOn(a.id, k), `${a.name}: ${dim} names ${k}, an ability they have`);
      }
    }
  });
  spec('a typo in a strength fails loudly', () => {
    throws(() => parseCaps('smok .5 Q', 'x'));
    throws(() => parseCaps('smoke 1.5 Q', 'x'));
    throws(() => parseCaps('smoke .5 Z', 'x'));
    eq(parseCaps('smoke .5 Q; wall .25', 'x'), { caps: { smoke: 0.5, wall: 0.25 }, via: { smoke: 'Q' } });
  });
  spec('new agents are in, with their numbers marked as estimates', () => {
    for (const d of NEW_AGENTS) ok(agentById(d.id)?.name === d.name && agentById(d.id)?.estimate, `${d.name} is an agent, marked as an estimate`);
    for (const a of AGENTS) if (a.estimate) ok(NEW_AGENTS.some((d) => d.id === a.id), `${a.name} is kept with the new agents`);
    eq(inUse('includeNew'), NEW_AGENTS.length > 0, '“Include new agents” is offered only while there are some');
  });
  spec('Hush is a full agent now that she’s out', () => {
    const hush = agentById('hush')!;
    ok(!hush.estimate, 'not an estimate');
    ok(isNew(hush, '2026-10-26') && isNew(hush, '2026-10-29') && isNew(hush, '2026-12-26'), 'new from just before her release to two months after');
    ok(!isNew(hush, '2026-12-27') && !isNew(agentById('jett')!, '2026-10-29'), 'and not after that, nor an agent out for years');
    ok(!proKnown(hush), 'released after the pro events, so pro play doesn’t count for her yet');
    eq(['C', 'Q', 'E', 'X'].map((k) => abilityOn('hush', k)?.name), ['Flow', 'Flashbulb', 'Displacement', 'Suspension']);
  });
  spec('agents released before the pro events count their pro picks', () => {
    for (const a of AGENTS) if (a.id !== 'hush') ok(proKnown(a), a.name);
  });
});

describe('kits', () => {
  spec('every agent has a kit with an ability on each key', () => {
    for (const a of AGENTS) {
      const kit = kitOf(a.id);
      ok(kit, `${a.name} has a kit`);
      for (const k of ['C', 'Q', 'E', 'X']) ok(abilityOn(a.id, k)?.name, `${a.name}: an ability on ${k}`);
      ok(kit!.about.length > 20, `${a.name}: a line about them`);
    }
  });
  spec('ability names leave out gun play and alternate names', () => {
    eq(abilityNames('omen', 'EG'), ['Dark Cover']);
    eq(abilityNames('jett', 'G'), []);
    eq(abilityNames('kayo', 'Q'), ['FLASH/drive']);
    eq(abilityNames('astra', 'X'), ['Cosmic Divide']);
  });
  spec('abilities sit on the keys players press, with names in normal case', () => {
    eq(abilityOn('phoenix', 'Q')?.name, 'Curveball');
    eq(abilityOn('phoenix', 'E')?.name, 'Hot Hands');
    eq(abilityOn('deadlock', 'C')?.name, 'GravNet');
    eq(abilityOn('deadlock', 'E')?.name, 'Barrier Mesh');
    for (const a of AGENTS) for (const x of kitOf(a.id)!.abilities) ok(/[a-z]/.test(x.name), `${a.name}: “${x.name}”`);
  });
  spec('the game’s marks in ability text are all known, so none shows as code', () => {
    eq(textParts('EQUIP <whitebold>Flashbulb</>. Explodes, <debuffred>flashing</> all players.'), [
      { kind: 'plain', text: 'EQUIP ' }, { kind: 'name', text: 'Flashbulb' }, { kind: 'plain', text: '. Explodes, ' },
      { kind: 'enemy', text: 'flashing' }, { kind: 'plain', text: ' all players.' },
    ]);
    eq(plainText('grants <teal>haste</> to allies'), 'grants haste to allies');
    for (const a of AGENTS) for (const x of kitOf(a.id)!.abilities) {
      ok(!/[<>]/.test(plainText(x.text)), `${a.name}: ${x.name} has no stray marks`);
      ok(textParts(x.text).every((p) => p.kind !== 'plain' || !p.text.includes('</>')), `${a.name}: ${x.name}`);
    }
  });
});

describe('maps', () => {
  spec('Corrode reads as mixed, with long sightlines in mid and on A and a tight B', () => {
    // dodge.gg and esports.net's Corrode guides (2026): "Corrode's mid lane and A Site feature long
    // sightlines" while "B Site in particular features tight entries"
    const m = mapById('corrode')!;
    eq(m.space, 'mixed');
    eq(m.sites.find((x) => x.id === 'B')!.space, 'tight');
    eq(m.sites.find((x) => x.id === 'A')!.space ?? m.space, 'mixed');
  });
  spec('every map has sites, a minimap with callouts, and needs that read', () => {
    eq(MAPS.length, 13);
    eq(POOL.length, 7, 'seven maps in the pool');
    for (const m of MAPS) {
      ok(m.sites.length >= 2 && m.sites.length <= 3, `${m.name}: two or three sites`);
      ok(m.callouts.length >= 15, `${m.name}: callouts`);
      ok(m.spawns.attack && m.spawns.defense, `${m.name}: both spawns`);
      for (const c of m.callouts) ok(c.x >= 0 && c.x <= 1 && c.y >= 0 && c.y <= 1, `${m.name}: ${c.name} on the minimap`);
      for (const s of m.sites) ok(m.callouts.some((c) => c.name === `${s.id} Site`), `${m.name}: ${s.id} Site is a callout`);
      for (const n of [m.needs.both, m.needs.attack, m.needs.defense]) parseNeeds(n, m.name);
      for (const s of m.sites) for (const n of [s.needs.both, s.needs.attack, s.needs.defense]) parseNeeds(n, `${m.name} ${s.id}`);
      for (const name of Object.keys(m.aka ?? {})) ok(m.callouts.some((c) => c.name === name), `${m.name}: “${name}” is a callout`);
      for (const name of Object.keys(m.places ?? {})) ok(m.callouts.some((c) => c.name === name), `${m.name}: “${name}” is a callout to move`);
      eq(mapById(m.id), m);
    }
  });
  spec('every callout stands on its minimap’s floor', () => {
    for (const m of MAPS) {
      ok(hasFloor(m.id), `${m.name}: the floor was read from its minimap`);
      for (const c of m.callouts) ok(onFloor(m.id, [c.x, c.y]), `${m.name}: ${c.name} is on the floor, not in a wall`);
    }
  });
  spec('every orb and feature on a minimap stands on the floor, and each map’s doors, teleporters and the rest are marked', () => {
    const kindOf: Record<string, string> = { doors: 'door', teleporters: 'teleporter', ropes: 'rope', ziplines: 'zipline', breakable: 'breakable', walls: 'wall', autodoors: 'door' };
    for (const [id, fs] of Object.entries(FEATURES)) {
      const m = mapById(id);
      ok(!!m, `${id} is a map`);
      for (const f of fs) {
        ok(FEATURE_KINDS.some((k) => k.kind === f.kind), `${id}: ${f.kind} is a kind the legend knows`);
        ok(f.about.length > 10 && !f.about.endsWith('.'), `${id}: “${f.about}” says what it is, without a full stop`);
        if (f.to) ok(f.kind === 'teleporter' || f.kind === 'zipline' || f.kind === 'rope', `${id}: only teleporters, ziplines and ropes have two ends`);
        if (f.kind === 'teleporter' || f.kind === 'zipline') ok(!!f.to, `${id}: a ${f.kind} has two ends`);
        if (f.angle !== undefined) ok(Number.isInteger(f.angle) && f.angle > 0 && f.angle < 360, `${id}: ${f.about} is turned by a whole number of degrees, 1 to 359`);
        for (const s of [f.at, ...(f.to ? [f.to] : [])]) ok(onFloor(id, s), `${id}: ${f.about} is on the floor`);
      }
      const orbs = fs.filter((f) => f.kind === 'orb').length;
      ok(orbs === 0 || orbs === (id === 'fracture' ? 4 : 2), `${id}: two ultimate orbs (four on Fracture), or none marked`);
    }
    for (const m of MAPS) for (const x of m.mechanics ?? []) ok((FEATURES[m.id] ?? []).some((f) => f.kind === kindOf[x.id]), `${m.name}: its ${x.id} are marked on the minimap`);
  });
  spec('every site has a default plant and a safe plant on the floor, apart, with the safe one by a way onto the site', () => {
    for (const m of MAPS) for (const s of m.sites) {
      const { plant, safe } = plantSpots(m.id, s.id);
      ok(!!plant && !!safe, `${m.name} ${s.id}: a default plant and a safe plant`);
      if (!plant || !safe) continue;
      eq((FEATURES[m.id] ?? []).filter((f) => (f.kind === 'plant' || f.kind === 'safeplant') && siteAt(m.id, f.at) === s.id).length, 2, `${m.name} ${s.id}: two plant spots, no more`);
      ok(plant.about === `Default plant in the middle of ${s.id} Site`, `${m.name} ${s.id}: the default plant says where it is (“${plant.about}”)`);
      const way = new RegExp(`^Safe plant on ${s.id} Site, just in from (.+)$`).exec(safe.about)?.[1];
      const w = way ? m.callouts.find((c) => c.name === way) : undefined;
      ok(!!w, `${m.name} ${s.id}: the safe plant names the way it's by (“${safe.about}”)`);
      if (w) ok(Math.hypot(w.x - safe.at[0], w.y - safe.at[1]) < Math.hypot(w.x - plant.at[0], w.y - plant.at[1]), `${m.name} ${s.id}: the safe plant is nearer ${way} than the default`);
      ok(Math.hypot(plant.at[0] - safe.at[0], plant.at[1] - safe.at[1]) >= 0.03, `${m.name} ${s.id}: the two spots are apart`);
    }
  });
  spec('every route in a play keeps to the floor, and goes no long way round', () => {
    const length = (ps: readonly Spot[]) => ps.slice(1).reduce((t, q, k) => t + Math.hypot(q[0] - ps[k]![0], q[1] - ps[k]![1]), 0);
    for (const p of PLAYS) {
      const m = mapById(p.map)!;
      for (const s of p.steps) {
        const spots = s.route.map((n) => m.callouts.find((c) => c.name === n)!).map((c): Spot => [c.x, c.y]);
        for (let i = 1; i < spots.length; i++) {
          const a = spots[i - 1]!, b = spots[i]!, line = walk(m.id, a, b);
          const where = `${m.name}: ${s.route[i - 1]} to ${s.route[i]}`;
          // a spot every half a percent of the minimap along the line
          for (let k = 1; k < line.length; k++) {
            const [x0, y0] = line[k - 1]!, [x1, y1] = line[k]!;
            const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 200);
            for (let j = 0; j <= n; j++) ok(onFloor(m.id, [x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n]), `${where} goes through a wall`);
          }
          ok(length(line) <= 2.2 * length([a, b]) + 0.05, `${where} goes a long way round`);
        }
      }
    }
  });
  spec('a route goes round a wall rather than through it', () => {
    // Lotus: from C Mound to B Main there's a wall in the straight line, so the route bends
    const lotus = mapById('lotus')!, at = (n: string): Spot => { const c = lotus.callouts.find((x) => x.name === n)!; return [c.x, c.y]; };
    const line = walk('lotus', at('C Mound'), at('B Main'));
    ok(line.length > 2, 'it has a corner');
    eq(line[0], at('C Mound'));
    eq(line[line.length - 1], at('B Main'));
    eq(walk('nowhere', [0.1, 0.1], [0.9, 0.9]), [[0.1, 0.1], [0.9, 0.9]], 'a map without a floor gets the straight line');
  });
  spec('a typo in a need fails loudly', () => {
    throws(() => parseNeeds('smok +.5', 'x'));
    throws(() => parseNeeds('smoke +2', 'x'));
    eq(parseNeeds('smoke +.5; smoke -.25; wall .1', 'x'), { smoke: 0.25, wall: 0.1 });
  });
  spec('callouts show what players also call them', () => {
    const haven = mapById('haven')!;
    eq(calloutLabel(haven, 'Nowhere'), 'Nowhere');
    const named = MAPS.find((m) => m.aka && Object.keys(m.aka).length);
    if (named) {
      const [name, aka] = Object.entries(named.aka!)[0]!;
      eq(calloutLabel(named, name), `${name} (${aka})`);
    }
  });
});

describe('pro play', () => {
  spec('regional play is blended in only where the international events played a map too little, and its picks still add up to five agents', () => {
    for (const m of MAPS) {
      const p = PRO[m.id]!;
      if (!p.regional) continue;
      ok(!p.dated && (p.games ?? 0) < REGIONAL_BELOW, `${m.name}: few international maps`);
      const sum = Object.values(p.picks).reduce((t, x) => t + x, 0);
      ok(sum > 480 && sum < 520, `${m.name}: picks add up to ${sum}%`);
    }
    ok(MAPS.some((m) => PRO[m.id]!.regional), 'some map takes in regional play');
  });
  spec('every map has pro picks and typical comps of five real agents, one of each role at least where pros play it', () => {
    for (const m of MAPS) {
      const p = PRO[m.id];
      ok(p, `${m.name} has pro picks`);
      for (const [id, pct] of Object.entries(p!.picks)) ok(agentById(id) && pct > 0 && pct <= 100, `${m.name}: ${id} at ${pct}%`);
      ok(p!.comps.length >= 2, `${m.name}: typical comps`);
      for (const c of p!.comps) {
        eq(new Set(c).size, 5, `${m.name}: five different agents`);
        for (const id of c) ok(agentById(id), `${m.name}: ${id} is an agent`);
        ok(c.some((id) => agentById(id)!.role === 'controller'), `${m.name}: a controller in ${c.join(', ')}`);
      }
    }
    eq(proPick('nowhere', 'jett'), 0);
  });
  spec('each map’s picks add up to about five agents a team, from a count of maps or marked as an earlier year’s', () => {
    for (const [id, p] of Object.entries(PRO)) {
      const sum = Object.values(p.picks).reduce((a, b) => a + b, 0);
      ok(sum >= 440 && sum <= 530, `${id}: picks add to ${sum}%`);
      if (p.dated) eq(p.games, undefined, `${id}: an earlier year’s numbers have no count of maps`);
      else ok(Number.isInteger(p.games) && p.games! >= 1, `${id}: picks from a number of maps`);
      for (const c of p.comps) for (const a of c) ok(proPick(id, a) > 0, `${id}: ${a} is in a typical comp, so pros picked them there`);
      const mix = proRoleMix(id, (x) => agentById(x)?.role)!;
      ok(Math.abs(Object.values(mix).reduce((a, b) => a + b, 0) - 5) < 1e-9, `${id}: the role mix is five agents`);
    }
  });
  spec('Icebox’s numbers are Masters Toronto 2025’s, the last top event that played it', () => {
    // vlr.gg's agent table for the event, Icebox, 11 maps (read 12 November 2026)
    eq(PRO.icebox!.picks, { viper: 95, killjoy: 91, sova: 86, jett: 73, omen: 50, gekko: 32, harbor: 23, sage: 23, kayo: 14, chamber: 5, clove: 5, neon: 5 });
    // its most played comp, on six of the 22 lineups
    eq([...PRO.icebox!.comps[0]!].sort(), ['jett', 'killjoy', 'omen', 'sova', 'viper']);
  });
  spec('a map’s line about what wins there names only agents pros often pick on it', () => {
    for (const m of MAPS) {
      for (const a of AGENTS) {
        if (!new RegExp(`(?<![A-Za-z])${a.name.replace('/', '\\/')}(?![A-Za-z])`).test(m.keys)) continue;
        ok(proPick(m.id, a.id) >= 40, `${m.name} names ${a.name}, picked on ${proPick(m.id, a.id)}% of its pro maps`);
      }
    }
  });
  spec('an agent’s pro share is their picks over every map counted', () => {
    eq(PRO_MAPS_COUNTED, Object.values(PRO).reduce((sum, p) => sum + (p.games ?? 0), 0));
    const games = (a: string) => Object.values(PRO).reduce((sum, p) => sum + ((p.picks[a] ?? 0) / 100) * (p.games ?? 0), 0);
    for (const a of AGENTS) {
      eq(a.pro, proOverall(a.id));
      ok(Math.abs(a.pro - (100 * games(a.id)) / PRO_MAPS_COUNTED) <= 0.5, `${a.name}: ${a.pro}%`);
    }
    eq(agentById('hush')!.pro, 0, 'none yet for an agent released after the events');
  });
  spec('the pro lineups are five different agents a team, on known maps at known events, with a winner', () => {
    ok(LINEUPS.length >= 100);
    for (const l of LINEUPS) {
      ok(mapById(l.map), `${l.map} is a map`);
      ok(EVENTS.some((e) => e.id === l.event), `${l.event} is an event`);
      ok(l.teams[0].rounds !== l.teams[1].rounds && Math.max(l.teams[0].rounds, l.teams[1].rounds) >= 13, `${l.map}: ${l.teams[0].rounds}-${l.teams[1].rounds}`);
      for (const t of l.teams) {
        eq(new Set(t.agents).size, 5, t.agents.join(', '));
        for (const id of t.agents) ok(agentById(id) && proKnown(agentById(id)!) && pickable(id, EVENTS.find((e) => e.id === l.event)!), `${id} is an agent pros could pick at ${l.event}`);
      }
    }
    for (const [map, list] of Object.entries(PLAYED)) for (const c of list) ok(c.won <= c.maps && c.seen > 0 && c.seen <= c.maps, `${map}: ${c.agents.join(', ')}`);
  });
  spec('the agents released while the events were on are listed with their release dates', () => {
    const first = EVENTS[EVENTS.length - 1]!.from, last = EVENTS[0]!.from;
    const during = AGENTS.filter((a) => !a.estimate && a.released > first && a.released < last).map((a) => a.id).sort();
    eq(Object.keys(RELEASED_DURING).sort(), during);
    for (const [id, on] of Object.entries(RELEASED_DURING)) eq(on, agentById(id)!.released, id);
  });
});

describe('ranked play by map', () => {
  spec('every map’s numbers are for a known map and known agents, with sensible rates and games', () => {
    for (const [map, m] of Object.entries(MAP_WINS)) {
      ok(mapById(map), `${map} is a map`);
      ok(/^\d{4}-\d{2}-\d{2}$/.test(m.on), `${map} has a date`);
      ok(m.attack > 40 && m.attack < 60 && m.defense > 40 && m.defense < 60, `${map}’s sides are near even`);
      eq(Math.round((sideShare(map, 'attack')! + sideShare(map, 'defense')!) * 1e9) / 1e9, 1);
      ok(Object.keys(m.agents).length >= 25, `${map} has most agents`);
      for (const [id, [win, games]] of Object.entries(m.agents)) {
        ok(agentById(id), `${id} on ${map} is an agent`);
        ok(win >= 0 && win <= 100 && Number.isInteger(games) && games > 0, `${id} on ${map}: ${win}% of ${games}`);
      }
    }
    eq(sideShare('icebox', 'attack'), undefined);
  });
});

describe('pairs', () => {
  spec('pairs are two different agents, listed once, with a reason', () => {
    const seen = new Set<string>();
    for (const p of PAIRS) {
      ok(agentById(p.a) && agentById(p.b) && p.a !== p.b, `${p.a} and ${p.b}`);
      const k = [p.a, p.b].sort().join('|');
      ok(!seen.has(k), `${k} is listed once`);
      seen.add(k);
      ok(p.strength >= -3 && p.strength <= 3 && p.strength !== 0, `${k}: strength ${p.strength}`);
      ok(p.why.endsWith('.') && !p.why.includes('!'), `${k}: a plain reason`);
      eq(pairOf(p.b, p.a), p, 'either order finds it');
    }
  });
});

describe('ranks and strengths', () => {
  spec('ranks climb from Iron to Radiant, and every strength is described', () => {
    eq(RANKS.map((r) => r.id), ['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'ascendant', 'immortal', 'radiant']);
    for (let i = 1; i < RANKS.length; i++) ok(RANKS[i]!.t > RANKS[i - 1]!.t);
    for (const d of DIMS) ok(DIM_INFO[d].name && DIM_INFO[d].has && DIM_INFO[d].lacks && DIM_INFO[d].blurb, `${d} is described`);
  });
});

describe('map tips and mechanics', () => {
  // words that start an ability's or agent's name ("A Toxic Screen", "A Killjoy Alarmbot"), not a callout
  const names = new Set(AGENTS.flatMap((a) => [a.name, ...(kitOf(a.id)?.abilities.map((x) => x.name) ?? [])]).flatMap((n) => n.split(/[\s/]+/)));
  /** "A Main", "Mid Market" and the like in a text that aren't callouts on the map. */
  const unknownCallouts = (mapId: string, text: string): string[] => {
    const map = mapById(mapId)!;
    const has = (name: string) => map.callouts.some((c) => c.name === name);
    const out: string[] = [];
    for (const m of text.matchAll(/\b(A|B|C|Mid) ([A-Z][a-z]+)(?: ([A-Z][a-z]+))?/g)) {
      if (names.has(m[2]!) || (m[1] === 'A' && m.index === 0)) continue;
      if (!has(`${m[1]} ${m[2]}`) && !(m[3] && has(`${m[1]} ${m[2]} ${m[3]}`))) out.push(m[0]);
    }
    return out;
  };
  spec('every callout named in a map’s tips, agent tips and mechanics is one of the map’s own', () => {
    for (const m of MAPS) {
      const texts = [...[MAP_TIPS, MAP_TIPS_LOW].flatMap((t) => [...(t[m.id]?.attack ?? []), ...(t[m.id]?.defense ?? [])]), ...(m.mechanics ?? []).map((x) => x.about)];
      for (const t of Object.values(AGENT_MAP_TIPS[m.id] ?? {})) texts.push(...(typeof t === 'string' ? [t] : Object.values(t)));
      for (const t of texts) eq(unknownCallouts(m.id, t), [], `${m.name}: “${t}”`);
    }
  });
  spec('agent tips are for real agents on real maps, and each is a full sentence', () => {
    for (const [map, byAgent] of Object.entries(AGENT_MAP_TIPS)) {
      ok(mapById(map), `${map} is a map`);
      for (const [agent, t] of Object.entries(byAgent)) {
        ok(agentById(agent), `${agent} is an agent`);
        for (const text of typeof t === 'string' ? [t] : Object.values(t)) ok(/^[A-Z].*[.]$/.test(text) && !text.includes('!'), `${map} ${agent}: “${text}”`);
      }
    }
  });
  spec('every map says how open it is, and only names mechanics it has once', () => {
    for (const m of MAPS) {
      ok(['tight', 'mixed', 'open'].includes(m.space), `${m.name}: space`);
      const ids = (m.mechanics ?? []).map((x) => x.id);
      eq(new Set(ids).size, ids.length, `${m.name}: mechanics listed once`);
      for (const x of m.mechanics ?? []) ok(MECHANICS[x.id] && /[.]$/.test(x.about), `${m.name}: ${x.id}`);
    }
  });
});
