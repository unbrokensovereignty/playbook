/**
 * The command palette (Ctrl+K): jump to any page, agent, map, saved plan or setting, or run an action, by typing.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon, type IconName } from '../icons.tsx';
import { Kbd } from './controls.tsx';
import { paletteOpen } from '../state.ts';
import { play } from '../sound.ts';
import { fold } from '../../core/text.ts';

export interface Command {
  id: string;
  group: 'Go to' | 'Saved plans' | 'Parties' | 'Actions' | 'Agents' | 'Maps' | 'Plays' | 'Plan for' | 'Settings' | 'Tours';
  label: string;
  icon: IconName;
  hint?: string;
  keywords?: string;
  run: () => void;
}

/** Text as search compares it: lowercase, without accents, with plain quotes and dashes ("Español" matches "espanol", "Don’t" "don't"). */
const loose = (s: string): string => fold(s);

/** Scores how well `q` matches a command: 0 means no match. */
export function scoreCommand(c: Pick<Command, 'label' | 'keywords' | 'hint'>, q: string): number {
  const query = loose(q.trim());
  if (!query) return 1;
  const label = loose(c.label);
  const at = label.indexOf(query);
  if (at === 0) return 100;
  if (at > 0) return (/[\s(“"-]/.test(label[at - 1] ?? '') ? 80 : 60) - Math.min(at, 20) / 2;
  const words = query.split(/\s+/);
  const hay = `${label} ${loose(c.keywords ?? '')} ${loose(c.hint ?? '')}`;
  if (words.every((w) => hay.includes(w))) return 40;
  // letters in order ("nwq" → "New question")
  let i = 0;
  for (const ch of label) if (ch === query[i]) i++;
  return i === query.length && query.length >= 2 ? 20 - Math.min(label.length, 19) / 2 : 0;
}

function highlight(label: string, q: string) {
  const plain = loose(label), query = loose(q.trim());
  // a letter that unfolds into two (ß) would shift the mark, so such a label goes without one
  const at = query && plain.length === label.length ? plain.indexOf(query) : -1;
  if (at < 0) return label;
  const n = query.length;
  return <>{label.slice(0, at)}<mark>{label.slice(at, at + n)}</mark>{label.slice(at + n)}</>;
}

const GROUP_ORDER: readonly Command['group'][] = ['Go to', 'Saved plans', 'Parties', 'Actions', 'Agents', 'Maps', 'Plays', 'Plan for', 'Settings', 'Tours'];
/** The groups shown before anything is typed (the rest are a search away). */
const AT_FIRST: ReadonlySet<Command['group']> = new Set(['Go to', 'Saved plans', 'Parties', 'Actions']);

export function Palette({ commands }: { commands: () => Command[] }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const all = useMemo(commands, []);
  const results = useMemo(() => {
    const scored = all.map((c) => ({ c, s: scoreCommand(c, q) })).filter((x) => x.s > 0);
    if (q.trim()) return scored.sort((a, b) => b.s - a.s).slice(0, 40).map((x) => x.c);
    // with nothing typed: pages, saved plans, parties and actions
    return GROUP_ORDER.flatMap((g) => scored.filter((x) => x.c.group === g && AT_FIRST.has(g)).map((x) => x.c));
  }, [q, all]);
  // focused before the next paint, so keys typed straight after Ctrl K land in the box
  useLayoutEffect(() => {
    const before = document.activeElement;
    input.current?.focus();
    play('open');
    // closed without going anywhere: focus goes back where it was
    return () => {
      const now = document.activeElement;
      const lost = !now || now === document.body || !now.isConnected || !!now.closest('.palette');
      if (lost && before instanceof HTMLElement && before !== document.body && before.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => setSel(0), [q]);
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const close = () => { paletteOpen.value = false; };
  const run = (c: Command | undefined) => {
    if (!c) return;
    close();
    play('tap');
    c.run();
  };
  let lastGroup = '';
  return (
    <div class="palette" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div class="palette-box" role="dialog" aria-modal="true" aria-label="Search commands">
        <div class="palette-input">
          <Icon name="search" size={20} />
          <input
            ref={input}
            value={q}
            placeholder="Search pages, agents, maps, plans and settings…"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[sel] ? `cmd-${results[sel].id}` : undefined}
            spellcheck={false}
            autoComplete="off"
            onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); run(results[sel]); }
              else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
              else if (e.key === 'Tab') e.preventDefault();
            }}
          />
          <Kbd k="escape" />
        </div>
        <div class="palette-list" id="palette-list" role="listbox" ref={list}>
          {results.length === 0 && <div class="palette-empty">Nothing matches “{q.trim()}”.</div>}
          {results.flatMap((c, i) => {
            // one flat keyed list (headings and items side by side), so reordering as you type
            // moves whole rows and never leaves an old row on screen
            const head = !q.trim() && c.group !== lastGroup ? c.group : '';
            lastGroup = c.group;
            const item = (
              <button key={c.id} id={`cmd-${c.id}`} type="button" role="option" class="palette-item" aria-selected={i === sel} tabIndex={-1}
                onMouseMove={() => { if (sel !== i) setSel(i); }} onClick={() => run(c)}>
                <Icon name={c.icon} size={18} />
                <span class="clamp-1">{highlight(c.label, q)}</span>
                <span class="hint">{c.hint ?? (q.trim() ? c.group : '')}</span>
              </button>
            );
            return head ? [<div key={`group-${head}`} class="palette-group">{head}</div>, item] : [item];
          })}
        </div>
        <div class="palette-foot">
          <span><Kbd k="arrowup" /><Kbd k="arrowdown" /> to move</span>
          <span><Kbd k="enter" /> to open</span>
        </div>
      </div>
    </div>
  );
}
