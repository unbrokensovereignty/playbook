// With motion Reduced, only what animates at Full fades, so a page, Search or a tab that changes
// at once at Full changes at once at Reduced too. base.css names those animations one by one, and
// this checks that every animation in the styles is on its list, so a new one can't slip past.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(import.meta.dirname, '../../src/ui/styles');
const files = readdirSync(dir).filter((f) => f.endsWith('.css'));
const base = readFileSync(resolve(dir, 'base.css'), 'utf8');

/** Every [selector, block] in a style sheet, outside @keyframes, with comments taken out. */
function rules(css: string): [string, string][] {
  const out: [string, string][] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push([m[1]!.trim().replace(/\s+/g, ' '), m[2]!]);
  return out;
}

/** What fades at Reduced: the selectors the Reduced rules give an animation of their own. */
const reduced = rules(base)
  .filter(([sel, body]) => sel.includes("data-motion='reduced'") && /animation-name:/.test(body))
  .flatMap(([sel]) => sel.split(/,(?![^(]*\))/).map((s) => s.trim().replace(/^html\[data-motion='reduced'\] /, '')))
  .flatMap((s) => { const m = /^:is\((.*)\)$/.exec(s); return m ? m[1]!.split(',').map((x) => x.trim()) : [s]; });

test('the Reduced rule on everything sets no animation of its own', () => {
  const all = rules(base).find(([sel]) => sel.startsWith("html[data-motion='reduced'] *,"));
  assert.ok(all, 'the Reduced rule for every element is in base.css');
  assert.doesNotMatch(all[1], /animation-name/);
});

test('every animation in the styles fades with motion Reduced', () => {
  const missing: string[] = [];
  for (const f of files) {
    for (const [sel, body] of rules(readFileSync(resolve(dir, f), 'utf8'))) {
      if (sel.includes('data-motion') || !/(^|;|\s)animation(-name)?\s*:(?!\s*none)/.test(body)) continue;
      for (const s of sel.split(/,(?![^(]*\))/).map((x) => x.trim())) {
        // `.throw.flash.fresh:not(.waiting)` is covered by `.throw.flash.fresh`
        if (!reduced.some((r) => s === r || s.startsWith(r + ':'))) missing.push(`${f}: ${s}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
