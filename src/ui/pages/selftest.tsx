/**
 * The self-test (#selftest): runs the same checks as `npm test`, inside this browser, against a
 * throwaway in-memory copy. Your saved data isn't touched.
 */
import { useState } from 'preact/hooks';
import { PageHead } from '../shell.tsx';
import { Button, Badge } from '../components/controls.tsx';
import { specs } from '../../../tests/specs/harness.ts';
import '../../../tests/specs/index.ts';
import type { PageProps } from './index.ts';

interface Result { group: string; name: string; error: string; ms: number }

export function SelfTestPage(_p: PageProps) {
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const out: Result[] = [];
    for (const s of specs) {
      const t = performance.now();
      let error = '';
      try { await s.run(); } catch (e) { error = e instanceof Error ? e.message : String(e); }
      out.push({ group: s.group, name: s.name, error, ms: performance.now() - t });
      if (out.length % 20 === 0) { setResults([...out]); await new Promise((r) => setTimeout(r)); }
    }
    setResults(out);
    setBusy(false);
  };
  const failed = results?.filter((r) => r.error) ?? [];
  return (
    <>
      <PageHead eyebrow="Help" title="Self-test" actions={<Button kind="primary" icon="play" busy={busy} onClick={() => void run()}>{results ? 'Run again' : `Run ${specs.length} checks`}</Button>}>
        Checks the app’s logic in this browser. It works on a throwaway copy, so your saved plans, parties and settings aren’t touched.
      </PageHead>
      {results && (
        <div class="panel stack" data-testid="selftest-result">
          <div class="row">
            {failed.length ? <Badge tone="bad" icon="warning">{failed.length} failed</Badge> : !busy && <Badge tone="good" icon="check">All passed</Badge>}
            <span class="muted">{results.length} of {specs.length} run · {Math.round(results.reduce((a, r) => a + r.ms, 0))} ms</span>
          </div>
          {failed.map((f) => (
            <div key={f.group + f.name}>
              <b>{f.group} › {f.name}</b>
              <pre class="small" style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0' }}>{f.error}</pre>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
