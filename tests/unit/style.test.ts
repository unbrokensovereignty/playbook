// Checks how everything the app writes reads, over the game knowledge and over what the engine
// says about many comps: whole sentences with a capital and a full stop, no long dashes, no clause
// joined on with a colon or a semicolon, no "X, not Y" contrasts, no exclamation marks, curly
// apostrophes, no word said twice in a row and no agent named twice before an ability. The house
// style is in docs/PRODUCT.md (Wording), and `npm run lint` checks the words themselves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerModel, solve } from '../../src/core/engine/plan.ts';
import { newQuery, type PartySize } from '../../src/core/engine/query.ts';
import { againstWords, explainFor, explainTeam, swapLine, whyBelow } from '../../src/core/engine/explain.ts';
import { modelFor, type SidePick, type Situation } from '../../src/core/engine/model.ts';
import { playsFor } from '../../src/core/engine/plays.ts';
import { agentTips, tipsFor } from '../../src/core/engine/tips.ts';
import { UNSETTLED, unsureWords } from '../../src/core/engine/sure.ts';
import { AGENTS } from '../../src/core/kb/agents.ts';
import { MAPS, MECHANICS, POOL, SPACE_INFO } from '../../src/core/kb/maps.ts';
import { FEATURES } from '../../src/core/kb/features.ts';
import { PAIRS } from '../../src/core/kb/synergy.ts';
import { KIT_RULES } from '../../src/core/kb/kitfit.ts';
import { THREATS } from '../../src/core/kb/counters.ts';
import { DIM_INFO, ROLES } from '../../src/core/kb/roles.ts';
import { BUY_GUIDE, DEMANDS, PLAYS } from '../../src/core/kb/plays.ts';
import { AGENT_MAP_TIPS, DOUBLE_TIPS, MAP_TIPS, MAP_TIPS_LOW, PARTY_TIPS, RANK_TIPS } from '../../src/core/kb/tips.ts';
import type { RankId } from '../../src/core/kb/ranks.ts';

const none = (problems: string[]) => assert.deepEqual([...new Set(problems)].slice(0, 40), [], `\n${[...new Set(problems)].slice(0, 40).join('\n')}`);

/** What's wrong with one piece of text; `sentence` asks for a capital at the start and a full stop at the end. */
function faults(text: string, sentence: boolean): string[] {
  const out: string[] = [];
  const say = (why: string) => out.push(`${why}: "${text}"`);
  if (/[\u2013\u2014]/.test(text)) say('a long dash');
  if (/[a-z’)\]] ?: /i.test(text)) say('a clause joined on with a colon');
  if (/; /.test(text)) say('a clause joined on with a semicolon');
  if (/!/.test(text)) say('an exclamation mark');
  if (/\w'\w/.test(text)) say('a straight apostrophe');
  if (/, not (?!yet\b)[a-z]|\bnot (just|only)\b|\bisn’t about\b/.test(text)) say('an "X, not Y" contrast');
  if (/\b(\w{2,}) \1\b/i.test(text)) say('a word said twice in a row');
  if (/(\b[A-Z][\w/]*)’s \1’s\b/.test(text)) say('an agent named twice before an ability');
  // "so swing in pairs, so whoever gets caught is traded" stacks one reason on another
  if (text.split(/(?<=[.?])\s+/).some((x) => /\bso\b(?! (?:far|much|many|little|long|often|well|fast|close|that)\b)[^.]*\bso\b(?! (?:far|much|many|little|long|often|well|fast|close|that)\b)/.test(x))) say('two "so" clauses in one sentence');
  if (/ {2}| [,.]|\.\.|,,|\(\s|\s\)/.test(text)) say('stray spacing or punctuation');
  if (/\{[a-z]+\}|undefined|NaN|\[object/.test(text)) say('a gap left unfilled');
  if (sentence && !/^[A-Z0-9“(]/.test(text)) say('no capital at the start');
  if (sentence && !/[.?”)]$/.test(text)) say('no full stop at the end');
  return out;
}

/** The game knowledge the app shows as written: [text, is it a sentence]. */
function written(): [string, boolean][] {
  const out: [string, boolean][] = [];
  const add = (t: string | undefined, sentence = true) => { if (t) out.push([t, sentence]); };
  for (const a of AGENTS) { add(a.line); for (const t of agentTips(a.id)) add(t); }
  for (const m of MAPS) {
    add(m.about); add(m.keys);
    for (const s of m.sites) add(s.about);
    for (const x of m.mechanics ?? []) add(x.about);
    for (const side of ['attack', 'defense'] as const) for (const t of [...(MAP_TIPS[m.id]?.[side] ?? []), ...(MAP_TIPS_LOW[m.id]?.[side] ?? [])]) add(t);
    for (const f of FEATURES[m.id] ?? []) add(f.about, false);
  }
  for (const byAgent of Object.values(AGENT_MAP_TIPS)) for (const t of Object.values(byAgent)) for (const x of typeof t === 'string' ? [t] : Object.values(t)) add(x);
  for (const r of Object.values(RANK_TIPS)) { for (const t of r.any) add(t); add(r.attack); add(r.defense); }
  for (const p of Object.values(PARTY_TIPS)) { add(p.play); add(p.ask); }
  for (const d of Object.values(DOUBLE_TIPS)) for (const t of Object.values(d)) add(t);
  for (const x of [...Object.values(MECHANICS), ...Object.values(SPACE_INFO), ...Object.values(DIM_INFO), ...ROLES]) add(x.blurb);
  for (const p of PAIRS) add(p.why);
  for (const r of KIT_RULES) add(r.why.replaceAll('{map}', 'Lotus'));
  for (const t of THREATS) add(t.advice, false);
  for (const r of BUY_GUIDE) add(r.text);
  for (const d of Object.values(DEMANDS)) add(d.about, false);
  for (const p of PLAYS) { add(p.about); for (const s of p.steps) add(s.text); }
  return out;
}

test('the game knowledge reads as plain, whole sentences', () => {
  const all = written();
  assert.ok(all.length > 1500, `only ${all.length} pieces of text`);
  none(all.flatMap(([t, s]) => faults(t, s)));
});

/** Questions over every pool map, side, party size and a spread of ranks, some against a known team. */
function* questions() {
  const ids = AGENTS.map((a) => a.id);
  let n = 0;
  for (const map of [...POOL.map((m) => m.id), 'any']) {
    for (const side of ['attack', 'defense', 'both'] as SidePick[]) {
      for (const rank of ['iron', 'silver', 'platinum', 'ascendant', 'radiant'] as RankId[]) {
        n++;
        const party = ([5, 1, 2, 3] as PartySize[])[n % 4]!;
        const enemy = n % 3 === 0 ? ids.filter((_, i) => (i * 7 + n) % 9 === 0).slice(0, 5) : [];
        const q = { ...newQuery(rank, true), map, side, party, enemy };
        const s: Situation = { map, side, rank, sites: [], enemy };
        yield { q, s };
      }
    }
  }
}

test('what the engine says about a comp reads as plain, whole sentences', () => {
  const problems: string[] = [];
  let lines = 0;
  const check = (t: string, sentence = true) => { lines++; problems.push(...faults(t, sentence)); };
  for (const { q, s } of questions()) {
    const a = solve(q, s, 3);
    const m = answerModel(a);
    for (const c of a.comps) {
      const ex = explainTeam(m, c.team, explainFor(q, c));
      check(ex.plan);
      for (const t of [...ex.pros, ...ex.cons, ...ex.notes]) check(t);
      for (const x of ex.against) check(`${x.threat}. ${againstWords(x)}`);
      for (const t of tipsFor(c.team, s, q.party, c.party)) { check(t.text); check(t.about, false); }
      if (s.map !== 'any' && s.side !== 'both') for (const f of playsFor(c.team, s.map, s.side, [], false, [], s.rank).slice(0, 2)) check(f.play.about);
    }
    // what sets the others apart from the best five-stack
    const five = solve({ ...q, party: 5 }, s, 4).comps;
    const model = modelFor(s);
    for (const c of five.slice(1)) {
      check(swapLine(model, five[0]!.team, c.team), false);
      const why = whyBelow(model, five[0]!.team, c.team);
      for (const t of [...why.loses, ...why.gains]) check(t, false);
    }
  }
  for (const a of UNSETTLED) for (const map of ['lotus', 'any']) {
    const s: Situation = { map, side: 'attack', rank: 'gold', sites: [], enemy: [] };
    check(unsureWords(s, a.id, { by: 12, why: ['early', 'kit', 'pro'] }));
  }
  assert.ok(lines > 3000, `only ${lines} lines checked`);
  none(problems);
});
