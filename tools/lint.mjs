// Project rules that the type checker can't see. Run with `npm run lint`.
//  1. Layers: src/core is pure logic (no DOM, no storage, no UI); src/data may use core; src/ui may use both.
//  2. The app only knows its own versions: the one in package.json and those with a heading in CHANGELOG.md,
//     and what ships in the app (src/ and the specs in tests/specs/) names only the one in package.json.
//     No other version numbers, no "beta" or the like, and no other app's name.
//  3. No stray console.log, debugger or focused tests.
//  4. Plain wording in everything people read, the app's text, the docs and the comments alike: no
//     long dashes, no hype or filler words, and none of the stock phrases that make writing sound
//     canned (the list is WORDING below; the game's own ability text in content.gen.ts is the game's).
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const report = (file, line, msg) => problems.push(`${relative(root, file)}:${line}  ${msg}`);

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const changelog = await readFile(join(root, 'CHANGELOG.md'), 'utf8').catch(() => '');
const known = new Set([version, ...[...changelog.matchAll(/^## (\d+\.\d+\.\d+)\b/gm)].map((m) => m[1])]);
const VERSIONISH = /\bv?\d+\.\d+\.\d+\b/g;
const WORDS = /\b(beta|legacy|previous version|older version|earlier version|old version|pre-release|flashcards?)\b/i;

// hype and filler, and stock phrases; a match that's code (a call, a property, a CSS class) is left alone
const WORDING = [
  /\b(seamless(ly)?|robust|effortless(ly)?|powerful|unlock(s|ing)? (the|your) (full |true )?(power|potential)|elevat(e|es|ed|ing)|delv(e|es|ed|ing)|leverag(e|es|ed|ing)|tailored|comprehensive|journey|game-?changer|tapestry|testament|pivotal|underscor(e|es|ed|ing)|showcas(e|es|ed|ing)|intricate|vibrant|crucial|multifaceted|boast(s|ed|ing)?|nestled|utili[sz](e|es|ed|ing)|empower(s|ed|ing)?|harness(es|ed|ing)? the|harnessing|streamlin(e|es|ed|ing)|cutting-edge|world-class|enhanc(e|es|ed|ing)|optimi[sz](e|es|ed|ing)|ensur(e|es|ed|ing))\b/gi,
  /\b(not just|not only|worth noting|important to note|in short|simply|additionally|moreover|furthermore|in today[’']s)\b/gi,
  /\b(Note that|Here[’']s|Let[’']s)\b/g,
  /\u2014/g,
];
const WORDING_SKIP = new Set(['tools/lint.mjs', 'src/core/kb/content.gen.ts', 'src/core/text.ts']);
// the files that stay in the workshop (PRIVATE in tools/publish.mjs, where that tool is) may quote the words they ban
const workshop = new Set(await readFile(join(root, 'tools/publish.mjs'), 'utf8')
  .then((t) => [...(t.match(/const PRIVATE = new Set\(\[([^\]]*)\]\)/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]))
  .catch(() => []));
const isCode = (line, at, len) => /^[(:]/.test(line.slice(at + len)) || /[.#-]$/.test(line.slice(0, at)) || /[A-Za-z_$]/.test(line[at + len] ?? '');

const files = [];
for (const d of ['src', 'tests', 'tools', 'docs', '.github']) {
  try { for await (const f of walk(join(root, d))) files.push(f); } catch { /* folder may not exist yet */ }
}
// the top-level docs: every Markdown file in the root, and the license
for (const f of (await readdir(root)).filter((x) => x.endsWith('.md') || x === 'LICENSE')) files.push(join(root, f));

for (const file of files) {
  if (!/\.(ts|tsx|mjs|js|css|html|md|txt|yml|json)$/.test(file) && !file.endsWith('LICENSE')) continue;
  let text; try { text = await readFile(file, 'utf8'); } catch { continue; }
  const rel = relative(root, file);
  const lines = text.split('\n');
  const inCore = rel.startsWith('src/core/');
  const inData = rel.startsWith('src/data/');
  const ships = rel.startsWith('src/') || rel.startsWith('tests/specs/');
  lines.forEach((line, i) => {
    const n = i + 1;
    // SVG path data ("a1.2.9 ...") is full of number runs that only look like versions
    const svgPath = /\bp\(['`]|\bd=["{`]/.test(line);
    if (!rel.startsWith('tools/lint.mjs')) {
      for (const m of svgPath ? [] : line.matchAll(VERSIONISH)) {
        const v = m[0].replace(/^v/, '');
        // dates and tool versions in the CI workflow are fine; anything else (the issue forms too) must be one of the app's own versions
        if (/^\d{4}\./.test(v) || rel.startsWith('.github/workflows/')) continue;
        // what ships in the app (its code and the specs its self-test runs) names no version but its own
        if (ships && v !== version) { report(file, n, `mentions version "${m[0]}": the app names no version but its own (${version})`); continue; }
        if (known.has(v)) continue;
        report(file, n, `mentions version "${m[0]}" (the app only knows ${[...known].join(', ')}; add a CHANGELOG.md heading for a new one)`);
      }
      // (the Greek letters, as named in HTML: "alpha, beta" is the alphabet, not a test build)
      const words = line.replace(/\balpha\W+beta\b/gi, '');
      if (WORDS.test(words)) report(file, n, `wording about other versions: "${words.match(WORDS)[0]}"`);
    }
    if (!WORDING_SKIP.has(rel) && !workshop.has(rel)) {
      for (const re of WORDING) for (const m of line.matchAll(re)) if (!isCode(line, m.index, m[0].length)) report(file, n, `wording: "${m[0]}" (see docs/PRODUCT.md, Wording)`);
    }
    if (/\.(ts|tsx)$/.test(rel)) {
      const imp = line.match(/from\s+['"]([^'"]+)['"]/);
      if (imp) {
        const spec = imp[1];
        if (inCore && (spec.includes('/ui/') || spec.includes('/data/') || spec.startsWith('preact'))) report(file, n, `core must not import "${spec}"`);
        if (inData && (spec.includes('/ui/') || spec.startsWith('preact'))) report(file, n, `data must not import "${spec}"`);
        if (spec.startsWith('.') && !/\.(ts|tsx|mjs|css|svg|txt|woff2|json)$/.test(spec)) report(file, n, `relative import needs its file extension: "${spec}"`);
      }
      if (inCore && /\b(document|window|localStorage|indexedDB|navigator)\./.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) report(file, n, 'core must not touch the DOM or browser storage');
      if (/\bconsole\.log\(/.test(line)) report(file, n, 'console.log left in');
      if (/\bdebugger\b/.test(line)) report(file, n, 'debugger left in');
      if (/\b(test|it|describe)\.only\(/.test(line)) report(file, n, 'focused test left in');
    }
  });
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}.`);
  process.exit(1);
}
console.log(`Lint passed (${files.length} files).`);
