// The floor the minimap routes walk on (src/core/kb/floor.gen.ts) is read from the minimaps in
// assets/minimaps: it must be read again whenever they change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { floorFile } from '../../tools/floor.mjs';

test('the floors match the minimaps (node tools/floor.mjs writes them)', async () => {
  assert.equal(readFileSync('src/core/kb/floor.gen.ts', 'utf8'), await floorFile());
});
