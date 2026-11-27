// Game facts the app states in words, checked against what the game and its patch notes say.
// Node only, since a check reads the knowledge base's own notes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapById, parseNeeds } from '../../src/core/kb/maps.ts';
import { PRO } from '../../src/core/kb/pro.ts';
import { AGENT_MAP_TIPS, AGENT_TIPS, ATTACK_TIPS, DEFENSE_TIPS, MAP_TIPS, MAP_TIPS_LOW, RANK_TIPS, ULT_TIPS } from '../../src/core/kb/tips.ts';

/** Every tip the app can show, as plain strings. */
const ALL_TIPS: string[] = [
  ...Object.values(AGENT_TIPS).flat(), ...Object.values(DEFENSE_TIPS), ...Object.values(ATTACK_TIPS),
  ...Object.values(MAP_TIPS).flatMap((m) => Object.values(m).flat()), ...Object.values(MAP_TIPS_LOW).flatMap((m) => Object.values(m).flat()),
  ...Object.values(AGENT_MAP_TIPS).flatMap((m) => Object.values(m).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v)))),
  ...Object.values(ULT_TIPS).flatMap((m) => Object.values(m).map((v) => v.text)),
  ...Object.values(RANK_TIPS).flatMap((r) => [...r.any, r.attack, r.defense]),
];

test('a tip about Killjoy’s setups switching off with distance names only the ones that do, Alarmbot and Turret', () => {
  // Turret and Alarmbot switch off when Killjoy is more than 40 m from them (patch 1.11, as the
  // VALORANT wiki and Liquipedia quote it; dodge.gg's Killjoy guide, 21 March 2026, gives about
  // 40 m). Nanoswarm has no distance rule (both wikis, read 14 November 2026).
  const far = /too far|far away|metres|meters| m from|range/i;
  const sentences = ALL_TIPS.flatMap((t) => t.split(/(?<=\.)\s+/)).filter((s) => far.test(s) && /Alarmbot|Turret|Nanoswarm/.test(s));
  assert.ok(sentences.length > 0, 'Killjoy’s tip still says to stay near her setups');
  for (const s of sentences) assert.ok(!/Nanoswarm/.test(s), `“${s}” gives Nanoswarm a distance rule it doesn’t have`);
});

test('the knowledge base gives Hush’s Suspension no duration, since no source publishes one', () => {
  // Riot's 13.09 notes give none, and Beebom (29 October 2026), TurboSmurfs (30 October 2026) and
  // THESPIKE.GG (October 2026) all say the duration isn't published
  const notes = readFileSync(new URL('../../src/core/kb/agents.ts', import.meta.url), 'utf8');
  const about = notes.split(/(?<=\.)\s+/).filter((s) => /Suspension/.test(s));
  assert.ok(about.length > 0, 'agents.ts still describes Suspension');
  for (const s of about) assert.ok(!/\d+(\.\d+)? ?(seconds|s\b)/.test(s), `“${s.replace(/\s+/g, ' ')}” gives a duration no source has`);
});

test('Summit counts long walls the way pros use them there, and its keys name Sage', () => {
  // Summit has three walls that drop when their switch is shot and narrow lanes into each site
  // (hotspawn.com, June 2026). esportnow.gg's Summit guide (mid 2026) says Sage's wall is large enough
  // to block off its choke points, and pros picked Sage on 53% of Summit's maps at Champions 2026
  // (vlr.gg, 18 maps), with Harbor's walls on 44%.
  const summit = mapById('summit')!;
  const wall = parseNeeds(summit.needs.both, summit.name).wall ?? 0;
  assert.ok(Math.abs(wall - 0.3) <= 0.05, `Summit's wall need is +${wall}`);
  assert.ok((PRO.summit?.picks.sage ?? 0) >= 50, 'pros still pick Sage on most of Summit’s maps');
  assert.match(summit.keys, /\bSage\b/, `Summit's keys leave out Sage: “${summit.keys}”`);
});
