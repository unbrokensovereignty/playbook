// Builds the app into one self-contained HTML file: scripts, styles, fonts and images are all inlined,
// so the result opens straight from disk with no server and no network.
//
//   node tools/build.mjs            → dist/Playbook-v<version>.html (minified)
//   node tools/build.mjs --dev      → same file, readable and with source maps inlined
//   node tools/build.mjs --out FILE → write somewhere else
//   node tools/build.mjs --preview  → keeps its data apart from the real app's, for trying builds out
import { build } from 'esbuild';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dev = args.includes('--dev');
const preview = args.includes('--preview');
const outArg = args.indexOf('--out');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const version = pkg.version;
const outFile = outArg >= 0 ? resolve(args[outArg + 1]) : resolve(root, 'dist', `Playbook-v${version}.html`);

/** The largest file we're willing to ship. Fonts and the game art are most of it. */
const SIZE_BUDGET = 3.5 * 1024 * 1024;

/**
 * `import art from 'assets:agents'` gives every image in assets/agents/ as a data URL, by file
 * name without its extension ({ jett: 'data:image/webp;base64,…' }). An image that's missing just
 * isn't there; the app shows the name instead.
 */
const assetsPlugin = {
  name: 'assets',
  setup(b) {
    b.onResolve({ filter: /^assets:/ }, (a) => ({ path: a.path.slice('assets:'.length), namespace: 'assets' }));
    b.onLoad({ filter: /.*/, namespace: 'assets' }, async (a) => {
      const dir = resolve(root, 'assets', a.path);
      const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.webp')).sort();
      const out = {};
      for (const f of files) out[f.replace(/\.webp$/, '')] = `data:image/webp;base64,${(await readFile(resolve(dir, f))).toString('base64')}`;
      return { contents: `export default ${JSON.stringify(out)};`, loader: 'js', watchDirs: [dir] };
    });
  },
};

const result = await build({
  entryPoints: [resolve(root, 'src/main.tsx')],
  bundle: true,
  write: false,
  outdir: 'out',
  format: 'iife',
  platform: 'browser',
  target: ['chrome111', 'edge111', 'firefox115', 'safari16.4'],
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  legalComments: 'none',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.woff2': 'dataurl', '.svg': 'text', '.txt': 'text' },
  define: { __APP_VERSION__: JSON.stringify(version), __DEV__: String(dev), __DB_NAME__: JSON.stringify(preview ? 'playbook-preview' : 'playbook') },
  plugins: [assetsPlugin],
  logLevel: 'warning',
});

let js = '', css = '';
for (const f of result.outputFiles) {
  if (f.path.endsWith('.js')) js = f.text;
  else if (f.path.endsWith('.css')) css = f.text;
}
if (!js) throw new Error('The build produced no script.');

const template = await readFile(resolve(root, 'src/index.html'), 'utf8');
// A literal "</script" or "</style" inside the code would end the inline element early.
const safeJs = js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const safeCss = css.replace(/<\/(style)/gi, '<\\/$1');
const html = template
  .replaceAll('{{VERSION}}', version)
  .replace('<!--STYLE-->', () => `<style>\n${safeCss}</style>`)
  .replace('<!--SCRIPT-->', () => `<script>\n${safeJs}</script>`);

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, html);
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`Built ${outFile.replace(root + '/', '')} · ${kb(html.length)} (script ${kb(js.length)}, styles ${kb(css.length)})`);
if (!dev && html.length > SIZE_BUDGET) {
  console.error(`Over the size budget of ${kb(SIZE_BUDGET)}.`);
  process.exit(1);
}
