// What the app says about a map's features matches the map: a tip that says both of Icebox's sites
// have ziplines is wrong when only A has one. Every piece of text tied to a map (its description and
// mechanics, its tips, agents' tips there, its plays and the kit rules that apply there) is read for
// ziplines, ropes, teleporters, doors and silent drops, and checked against the features placed on
// its minimap (kb/features.ts): the map has one, has more than one when the text says so, and has one
// at each site when the text says each site does. It also checks how many sites a map has and that
// no map's text names another map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featuresOf, siteAt, type FeatureKind } from '../../src/core/kb/features.ts';
import { KIT_RULES, ruleWhy } from '../../src/core/kb/kitfit.ts';
import { MAPS, mapById } from '../../src/core/kb/maps.ts';
import { PLAYS } from '../../src/core/kb/plays.ts';
import { AGENT_MAP_TIPS, MAP_TIPS, MAP_TIPS_LOW } from '../../src/core/kb/tips.ts';

const WORDS: readonly [FeatureKind, RegExp][] = [
  ['zipline', /\bziplines?\b/i], ['rope', /\bropes?\b/i], ['teleporter', /\bteleporters?\b/i], ['door', /\bdoors?\b/i], ['drop', /\bsilent drops?\b/i],
];

/** Every piece of text tied to one map. */
function texts(): { map: string; where: string; text: string }[] {
  const out: { map: string; where: string; text: string }[] = [];
  for (const m of MAPS) {
    out.push({ map: m.id, where: 'its description', text: m.about }, { map: m.id, where: 'its keys', text: m.keys });
    for (const x of m.mechanics ?? []) out.push({ map: m.id, where: `its ${x.id}`, text: x.about });
    for (const tips of [MAP_TIPS, MAP_TIPS_LOW]) for (const [side, t] of Object.entries(tips[m.id] ?? {})) for (const text of t) out.push({ map: m.id, where: `${side === 'attack' ? 'an' : 'a'} ${side} tip`, text });
    for (const [agent, t] of Object.entries(AGENT_MAP_TIPS[m.id] ?? {})) for (const text of typeof t === 'string' ? [t] : Object.values(t)) out.push({ map: m.id, where: `${agent}’s tip`, text: text! });
  }
  for (const p of PLAYS) for (const text of [p.about, ...p.steps.map((s) => s.text)]) out.push({ map: p.map, where: `the play ${p.name}`, text });
  for (const r of KIT_RULES) for (const m of r.map ? [mapById(r.map)!] : MAPS.filter((x) => !r.mechanic || x.mechanics?.some((y) => y.id === r.mechanic))) {
    out.push({ map: m.id, where: `${r.agent}’s kit rule`, text: ruleWhy(r, m.id) });
  }
  return out;
}

/** A map's features of a kind; a door that breaks open is a door too. */
const ofKind = (map: string, kind: FeatureKind) => featuresOf(map).filter((f) => f.kind === kind || (kind === 'door' && f.kind === 'breakable' && /^Door\b/.test(f.about)));
/** Whether a site has a feature of a kind: one end of it is nearer that site than any other, and close to it. */
function atSite(map: string, kind: FeatureKind, site: string): boolean {
  const c = mapById(map)!.callouts.find((x) => x.name === `${site} Site`)!;
  return ofKind(map, kind).some((f) => [f.at, f.to].some((p) => p && siteAt(map, p) === site && Math.hypot(p[0] - c.x, p[1] - c.y) < 0.3));
}

test('what the app says about each map’s ziplines, ropes, teleporters, doors and sites is true of the map', () => {
  const problems: string[] = [];
  const all = texts();
  assert.ok(all.length > 2000);
  for (const t of all) {
    const m = mapById(t.map)!;
    const no = (why: string) => problems.push(`${m.name}, ${t.where}: ${why}: “${t.text}”`);
    // callouts are names ("A Rope", "Mid Doors"), not claims about the map
    let text = t.text;
    for (const c of [...m.callouts].sort((a, b) => b.name.length - a.name.length)) text = text.split(c.name).join('·');
    const n = /\b(two|three) sites\b/.exec(text)?.[1];
    if (n && (n === 'two' ? 2 : 3) !== m.sites.length) no(`it has ${m.sites.length} sites`);
    for (const o of MAPS) if (o !== m && new RegExp(`\\b${o.name}\\b`).test(text)) no(`names ${o.name}`);
    for (const s of text.split(/(?<=[.?])\s+/)) for (const [kind, re] of WORDS) {
      const hit = re.exec(s);
      // "with no doors, ropes or teleporters" says there are none
      if (!hit || /\b(?:no|without)\b[\w ,]*$/.test(s.slice(0, hit.index))) continue;
      const have = ofKind(t.map, kind);
      if (!have.length) no(`it has no ${kind}`);
      else if (/s$/i.test(hit[0]) && have.length < 2) no(`it has one ${kind}`);
      if (have.length && /\b(?:(?:both sites|each site|every site|all three sites) (?:have|has|contain)|(?:on|by|at|in) (?:both sites|each site|every site|all three sites))\b/i.test(s)) {
        for (const site of m.sites) if (!atSite(t.map, kind, site.id)) no(`${site.id} has no ${kind}`);
      }
    }
  }
  assert.deepEqual([...new Set(problems)], []);
});
