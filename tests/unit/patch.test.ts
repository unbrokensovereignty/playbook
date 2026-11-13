// Checks tools/patch.mjs, which lists what changed in the game's content since a release: the word
// diff, and that each kind of change is found and nothing else is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentChanges, MOVED, wordDiff } from '../../tools/patch.mjs';
import { CALLOUTS, KITS } from '../../src/core/kb/content.gen.ts';

test('the word diff marks what went and what came, and keeps the rest', () => {
  assert.equal(wordDiff('a b c', 'a b c'), 'a b c');
  assert.equal(wordDiff('FIRE to throw a smoke', 'FIRE to send a long smoke'), 'FIRE to [-throw-] {+send+} a {+long+} smoke');
  assert.equal(wordDiff('one two', ''), '[-one two-]');
  assert.equal(wordDiff('', 'new text'), '{+new text+}');
});

test('the same content has no changes', () => {
  const c = contentChanges({ KITS, CALLOUTS }, { KITS, CALLOUTS });
  assert.deepEqual(c, { agents: { added: [], removed: [] }, abilities: [], maps: { added: [], removed: [] }, callouts: [] });
});

test('each change is found: agents, abilities (new text, new name, new marks only) and callouts', () => {
  const kits = structuredClone(KITS) as typeof KITS;
  const callouts = structuredClone(CALLOUTS) as typeof CALLOUTS;
  delete kits['hush'];
  const viper = kits['viper']!.abilities;
  viper[0]!.text = `${viper[0]!.text} And more.`;
  viper[1]!.name = 'Old Name';
  viper[2]!.text = viper[2]!.text.replace(/<[^>]*>/g, '');
  callouts['lotus'] = callouts['lotus']!.filter(([name]) => name !== 'A Root').map(([name, x, y]) => [name, name === 'A Main' ? x + 2 * MOVED : x, y]);
  const c = contentChanges({ KITS: kits, CALLOUTS: callouts }, { KITS, CALLOUTS });
  assert.deepEqual(c.agents, { added: ['hush'], removed: [] });
  const byKey = (k: string) => c.abilities.find((x) => x.agent === 'viper' && x.key === k);
  assert.match(byKey(viper[0]!.key)!.was, /And more\.$/);
  assert.equal(byKey(viper[1]!.key)!.renamed, 'Old Name');
  if (KITS['viper']!.abilities[2]!.text !== viper[2]!.text) assert.equal(byKey(viper[2]!.key)!.marksOnly, true);
  assert.equal(c.abilities.filter((x) => x.agent !== 'viper').length, 0);
  assert.deepEqual(c.callouts.map((x) => `${x.name} ${x.change}`).sort(), ['A Main moved', 'A Root added']);
});
