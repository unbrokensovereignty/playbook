// The map banners fill their cards edge to edge: none may keep the thin white frame some of the
// game's banners come with (tools/prepare-art.mjs cuts it off with tools/frame.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { frameOf } from '../../tools/frame.mjs';

test('no map banner has a light frame around it', async () => {
  const files = readdirSync('assets/banners').filter((f) => f.endsWith('.webp'));
  assert.ok(files.length >= 13);
  for (const f of files) {
    const { top, bottom, left, right } = await frameOf(`assets/banners/${f}`);
    assert.deepEqual({ top, bottom, left, right }, { top: 0, bottom: 0, left: 0, right: 0 }, f);
  }
});
