/**
 * Drawing a play of your own: on a map and side, each step's jobs, its route clicked out on the
 * minimap (or chosen from a list) and a line on what to do. As you draw, the play is filled with the
 * pros' usual comp, so you see who'd do each job and where their utility lands, as it will look
 * beside the built-in plays. Saved, it's kept with your plans and backups (core/saved.ts).
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PageHead } from '../shell.tsx';
import { Button, Empty, Field, IconButton, Segmented, Select, TextInput } from '../components/controls.tsx';
import { confirm } from '../components/overlays.tsx';
import { Minimap, ROUTE_COLORS, type Route } from '../components/minimap.tsx';
import { AgentIcon } from '../art.tsx';
import { Icon } from '../icons.tsx';
import { data, dismissToast, editsText, go, overlayOpen, safely, toast, watch } from '../state.ts';
import { play } from '../sound.ts';
import { playsLink } from '../myplays.ts';
import { pageHistory } from '../undo.ts';
import { agentById } from '../../core/kb/agents.ts';
import { spotName, type MapInfo, type Side, type SiteId } from '../../core/kb/maps.ts';
import { JOBS, kindName, MOMENTS, momentName, SIDE_KINDS, whenOf, type Job, type Moment, type PlayKind } from '../../core/kb/plays.ts';
import { PRO } from '../../core/kb/pro.ts';
import { asPlay, LIMITS, PLAY_JOBS, sanitizeMyPlay, type MyStep } from '../../core/saved.ts';
import { fillPlay, JOB_NAMES, jobWords } from '../../core/engine/plays.ts';
import { listJoin } from '../../core/text.ts';

interface Draft { side: Side; site: SiteId | null; kind: PlayKind; name: string; about: string; steps: MyStep[] }

const newStep = (): MyStep => ({ jobs: [], route: [], text: '', when: null });
/** Each step's key while it's drawn, so its controls (and focus) go with it when it moves or one before it goes. */
const stepKeys = new WeakMap<MyStep, number>();
let stepSeq = 0;
const keyOfStep = (s: MyStep): number => { let k = stepKeys.get(s); if (k === undefined) stepKeys.set(s, (k = ++stepSeq)); return k; };
/** Drafts left without saving or cancelling (you went to another page), until the tab closes. */
const kept = new Map<string, Draft>();
// they go when the tab closes or reloads, so the browser asks first, as Cancel does
if (typeof addEventListener === 'function') addEventListener('beforeunload', (e) => { if (kept.size) e.preventDefault(); });

export function DrawPlayPage({ m, id }: { m: MapInfo; id: string }) {
  const r = watch('meta');
  const was = id ? r.myPlay(id) : undefined;
  if (id && !was) {
    return (
      <>
        <PageHead eyebrow={<a href={`#/maps/${m.id}/plays`} class="row"><Icon name="chevron-left" size={16} />Plays on {m.name}</a>} title="Draw a play" />
        <Empty level={2} title="There’s no such play" actions={<Button onClick={() => go('maps', playsLink(m.id))}>See the plays on {m.name}</Button>}>It may have been deleted.</Empty>
      </>
    );
  }
  return <Drawing m={m} id={id} key={`${m.id}|${id}`} />;
}

function Drawing({ m, id }: { m: MapInfo; id: string }) {
  const r = data();
  const was = id ? r.myPlay(id) : undefined;
  const key = `${m.id}|${id}`;
  const start = (): Draft => (was ? { side: was.side, site: was.site, kind: was.kind, name: was.name, about: was.about, steps: was.steps.map((s) => ({ ...s, jobs: [...s.jobs], route: [...s.route] })) }
    : { side: 'attack', site: null, kind: SIDE_KINDS.attack[0]!, name: '', about: '', steps: [newStep()] });
  const [d, setDraft] = useState<Draft>(() => kept.get(key) ?? start());
  const [picked] = useState(() => kept.has(key));
  const [at, setAt] = useState(0);
  const [dirty, setDirty] = useState(() => kept.has(key));
  // the drawing's own undo and redo: Ctrl Z on this page takes back the last change to the drawing (typing in
  // one field counts as one change), and Ctrl Shift Z or Ctrl Y puts it back, instead of an unrelated change to
  // your saved data. Once the drawing has been changed, the keys stop at its start rather than going on to the app's
  const past = useRef<Draft[]>([]);
  const future = useRef<Draft[]>([]);
  const typing = useRef<string | null>(null);
  const now = useRef(d);
  now.current = d;
  // a drawing back where it started (the name typed and cleared, every change undone) has nothing to
  // lose: it isn't kept, so the tab closes without asking and Cancel doesn't ask either
  const startsAs = useMemo(() => JSON.stringify(start()), []);
  const put = (next: Draft) => {
    now.current = next; setDraft(next); setDirty(true);
    if (JSON.stringify(next) === startsAs) kept.delete(key); else kept.set(key, next);
  };
  const set = (patch: Partial<Draft>, field: string | null = null) => {
    if (!field || field !== typing.current) past.current = [...past.current.slice(-49), now.current];
    typing.current = field; future.current = [];
    put({ ...now.current, ...patch });
  };
  const setStep = (i: number, patch: Partial<MyStep>, field: string | null = null) => set({ steps: now.current.steps.map((s, k) => { if (k !== i) return s; const next = { ...s, ...patch }; stepKeys.set(next, keyOfStep(s)); return next; }) }, field);
  // an undo that takes away the step holding focus (one you'd just added) leaves focus on the steps, not the page
  const refocus = useRef(false);
  const step1 = (from: { current: Draft[] }, to: { current: Draft[] }) => { const prev = from.current.at(-1); if (!prev) return false; from.current = from.current.slice(0, -1); to.current = [...to.current, now.current]; typing.current = null; refocus.current = !!document.activeElement?.closest('.draw-step'); put(prev); play('tick'); return true; };
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const a = document.activeElement;
    if (a && a !== document.body && a.isConnected) return;
    (document.querySelector<HTMLElement>('.draw-step.on button:not(:disabled)') ?? document.querySelector<HTMLElement>('.draw-steps > .row button:not(:disabled)'))?.focus({ preventScroll: true });
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || overlayOpen() || editsText(e.target)) return;
      const k = e.key.toLowerCase();
      const redo = (k === 'z' && e.shiftKey) || (k === 'y' && !e.shiftKey);
      if (!redo && (k !== 'z' || e.shiftKey)) return;
      const done = redo ? step1(future, past) : step1(past, future);
      // nothing left in the drawing: the key stops here once you've drawn, instead of going on to your saved data
      if (done || dirty) { e.preventDefault(); e.stopImmediatePropagation(); }
      if (!done && dirty && !e.repeat) toast(redo ? 'Nothing to redo.' : 'Nothing to undo.');
    };
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  });
  // once you've drawn, the sidebar's Undo and Redo and Search's are the drawing's too, as the keys are
  useEffect(() => {
    pageHistory.value = dirty ? {
      undo: () => { if (!step1(past, future)) toast('Nothing to undo.'); },
      redo: () => { if (!step1(future, past)) toast('Nothing to redo.'); },
      canUndo: past.current.length > 0, canRedo: future.current.length > 0,
    } : null;
  });
  useEffect(() => () => { pageHistory.value = null; }, []);
  // the message after taking out a step: its Undo puts that step back while it still can (the step isn't back
  // already, by Ctrl Z or as an edited copy, and there's room for it and its jobs). Once it can't, the message goes
  const out = useRef<{ id: number; s: MyStep } | null>(null);
  const canPutBack = (s: MyStep) => { const c = now.current.steps; return !c.some((x) => keyOfStep(x) === keyOfStep(s)) && c.length < LIMITS.steps && c.reduce((n, x) => n + x.jobs.length, 0) + s.jobs.length <= PLAY_JOBS; };
  useEffect(() => { const o = out.current; if (o && !canPutBack(o.s)) { dismissToast(o.id); out.current = null; } }, [d]);
  const takeOut = (i: number, s: MyStep) => {
    set({ steps: d.steps.filter((_, k) => k !== i) });
    if (!s.jobs.length && !s.route.length && !s.text) return;
    const id = toast(`Took out step ${i + 1}.`, { action: { label: 'Undo', live: () => canPutBack(s), run: () => { out.current = null; if (canPutBack(s)) { const c = now.current.steps; set({ steps: [...c.slice(0, i), s, ...c.slice(i)] }); } } } });
    out.current = { id, s };
  };
  const used = d.steps.reduce((n, s) => n + s.jobs.length, 0);
  const step = d.steps[Math.min(at, d.steps.length - 1)]!;

  // the play as it will be kept, filled with the pros' usual comp to show who does what
  const team = PRO[m.id]?.comps[0] ?? [];
  const filled = useMemo(() => {
    const clean = sanitizeMyPlay({ id: 'm_drawing', map: m.id, ...d, created: 1, updated: 1 });
    return clean ? fillPlay(asPlay(clean), team) : undefined;
  }, [d, m.id]);
  // drawn steps have a job and a spot; the filled play keeps them in order, so its nth is the nth drawn
  const drawnAt = d.steps.map((s, i) => (s.jobs.length && s.route.length ? i : -1)).filter((i) => i >= 0);
  const filledOf = (i: number) => filled?.steps.find((f) => drawnAt[f.at] === i);
  const onMap = d.steps.map((s, i) => ({ s, i })).filter((x) => x.s.route.length > 0);
  // a step's color is its route's on the map
  const color = (i: number) => { const k = onMap.findIndex((x) => x.i === i); return k < 0 ? 'none' : `r${k % ROUTE_COLORS}`; };
  const routes: Route[] = onMap.map(({ s, i }) => ({ route: s.route, who: filledOf(i)?.who.map((x) => x.id), throws: filledOf(i)?.throws }));

  const addSpot = (name: string) => {
    if (!name || step.route.at(-1) === name || step.route.length >= LIMITS.route) return;
    play('tick');
    setStep(at, { route: [...step.route, name] });
  };
  // what's still needed to save it: "a name, and every step needs a job and a spot on the map"
  const needs = [
    d.steps.some((s) => !s.jobs.length) && 'a job',
    d.steps.some((s) => !s.route.length) && 'a spot on the map',
    d.steps.some((s) => !s.text.trim()) && 'a line on what to do',
  ].filter((x): x is string => !!x);
  const one = d.steps.length === 1 ? 'the step needs' : 'every step needs';
  const missing = !d.name.trim() ? (needs.length ? `To save it, give it a name, and ${one} ${listJoin(needs)}.` : 'To save it, give it a name.')
    : needs.length ? `To save it, ${one} ${listJoin(needs)}.` : '';
  useEffect(() => { if (at >= d.steps.length) setAt(d.steps.length - 1); }, [d.steps.length]);

  const leave = (to: string) => { kept.delete(key); go('maps', to); };
  const save = () => {
    const out = safely(() => r.savePlay({ ...(was ? { id: was.id } : {}), map: m.id, ...d }));
    if (out === null) { play('error'); toast(`You can keep ${LIMITS.plays} plays of your own. Delete one to draw another.`, { tone: 'bad' }); return; }
    if (!out) return;
    play('saved');
    toast(was ? `Saved “${out.name}”.` : `Drew “${out.name}”. It’s kept with your plans.`, { tone: 'good', undo: true });
    leave(playsLink(m.id, out.id));
  };
  const cancel = async () => {
    if (kept.has(key) && !(await confirm({ title: 'Leave without saving?', body: 'What you drew since you last saved goes.', yes: 'Leave it', no: 'Keep drawing' }))) return;
    leave(was ? playsLink(m.id, was.id) : playsLink(m.id));
  };
  const remove = () => {
    if (!was) return;
    safely(() => { r.deletePlay(was.id); toast(`Deleted “${was.name}”.`, { undo: true }); });
    leave(playsLink(m.id));
  };
  const move = (i: number, by: number) => {
    const steps = [...d.steps];
    [steps[i], steps[i + by]] = [steps[i + by]!, steps[i]!];
    set({ steps });
    setAt(i + by);
  };
  const moments = (s: MyStep): [string, string][] => [
    ['', `As it reads: ${momentName(d, whenOf(d.side, d.kind, s.jobs, s.text))}`],
    ...MOMENTS.map((x): [string, string] => [x, momentName(d, x)]),
  ];

  return (
    <>
      <PageHead
        eyebrow={<a href={`#/maps/${m.id}/plays`} class="row"><Icon name="chevron-left" size={16} />Plays on {m.name}</a>}
        title={was ? `Change “${was.name}”` : 'Draw a play'}
        actions={<>
          {was && <Button kind="quiet" icon="trash" sound="remove" onClick={remove}>Delete</Button>}
          <Button onClick={() => void cancel()}>Cancel</Button>
          <Button kind="primary" icon="check" sound={false} disabled={!!missing} onClick={save}>Save</Button>
        </>}>
        Give each step its jobs, click its route on the map from where the player starts, and say what they do.
      </PageHead>
      <p class="small muted draw-missing" aria-live="polite">{missing}</p>
      {picked && <p class="small muted">Picking up where you left off.</p>}
      <div class="panel row wrap draw-about" data-tour="draw-about">
        <Field label="Name" for="draw-name">
          <TextInput id="draw-name" value={d.name} maxLength={LIMITS.name} placeholder="Like “Fast B through Main”" onInput={(v) => set({ name: v }, 'name')} />
        </Field>
        <Field label="Side">
          <Segmented<Side> label="Side" value={d.side} onChange={(v) => set({ side: v, kind: SIDE_KINDS[v].includes(d.kind) ? d.kind : SIDE_KINDS[v][0]! })} options={[['attack', 'Attack'], ['defense', 'Defense']]} />
        </Field>
        <Field label="Site">
          <Segmented<SiteId | ''> label="Site" value={d.site ?? ''} onChange={(v) => set({ site: v || null })} options={[['', 'Whole map'], ...m.sites.map((x) => [x.id, x.id] as const)]} />
        </Field>
        <Field label="Kind" for="draw-kind">
          <Select<PlayKind> id="draw-kind" label="Kind of play" value={d.kind} onChange={(v) => set({ kind: v })} options={SIDE_KINDS[d.side].map((k) => [k, kindName(k)] as const)} />
        </Field>
        <Field label="What it’s for (if you like)" for="draw-about">
          <TextInput id="draw-about" value={d.about} maxLength={LIMITS.note} placeholder="Like “For when they stack A”" onInput={(v) => set({ about: v }, 'about')} />
        </Field>
      </div>
      <div class="draw-play">
        <div class="stack draw-map">
          <Minimap map={m.id} zoomable labels="all" routes={routes} focus={onMap.findIndex((x) => x.i === at)} onSpot={addSpot} label={`Drawing step ${at + 1} on the ${m.name} minimap. Click a callout to add it to the route`} />
          <p class="small muted">Click the map to add the callout nearest the click to step {at + 1}’s route. Drag to move around when zoomed in. The faces and utility show the pros’ usual comp running it.</p>
        </div>
        <div class="stack draw-steps" data-tour="draw-steps">
          <ol class="plain-list stack">
            {d.steps.map((s, i) => {
              const f = filledOf(i);
              const free = PLAY_JOBS - used;
              return (
                <li key={keyOfStep(s)} class={`draw-step${i === at ? ' on' : ''}`} onFocusIn={() => setAt(i)} onClick={() => setAt(i)}>
                  <div class="row-between">
                    <h2 class="row"><span class={`step-dot ${color(i)}`} aria-hidden="true">{i + 1}</span>Step {i + 1}</h2>
                    <span class="row">
                      <IconButton icon="move-up" label={`Move step ${i + 1} up`} size="sm" disabled={i === 0} onClick={() => move(i, -1)} />
                      <IconButton icon="move-down" label={`Move step ${i + 1} down`} size="sm" disabled={i === d.steps.length - 1} onClick={() => move(i, 1)} />
                      <IconButton icon="trash" label={`Remove step ${i + 1}`} size="sm" sound="remove" disabled={d.steps.length === 1} onClick={(e) => { if (e.detail > 1) return; takeOut(i, s); }} />
                    </span>
                  </div>
                  <div class="stack draw-jobs" role="group" aria-label={`Jobs in step ${i + 1}, one or two`}>
                    <span class="small muted">Jobs, one or two</span>
                    <div class="row wrap">
                      {JOBS.map((j: Job) => {
                        const on = s.jobs.includes(j);
                        return <button type="button" key={j} class="chip" aria-pressed={on} disabled={!on && (s.jobs.length >= 2 || free <= 0)} onClick={() => { play('tick'); setStep(i, { jobs: on ? s.jobs.filter((x) => x !== j) : [...s.jobs, j] }); }}>{JOB_NAMES[j]}</button>;
                      })}
                    </div>
                  </div>
                  <div class="stack">
                    <span class="small muted">Route</span>
                    <div class="row wrap draw-route">
                      <span class="grow">{s.route.length ? s.route.map((c) => spotName(c).replace(/ /g, '\u00A0')).join(' → ') : <span class="muted">{i === at ? 'Click the map, or choose a spot' : 'No spots yet'}</span>}</span>
                      <Select<string> label={`Add a spot to step ${i + 1}`} value="" onChange={(v) => { setAt(i); if (v && s.route.at(-1) !== v && s.route.length < LIMITS.route) setStep(i, { route: [...s.route, v] }); }} options={[['', 'Add a spot…'], ...m.callouts.map((c) => [c.name, spotName(c.name)] as const).sort((a, b) => a[1].localeCompare(b[1]))]} />
                      <IconButton icon="undo" label={`Take back the last spot of step ${i + 1}`} size="sm" disabled={!s.route.length} onClick={() => setStep(i, { route: s.route.slice(0, -1) })} />
                    </div>
                  </div>
                  <Field label="What they do" for={`draw-text-${i}`}>
                    <TextInput id={`draw-text-${i}`} value={s.text} maxLength={LIMITS.line} placeholder="Like “Smoke A Tower and A Link, then hold A Main”" onInput={(v) => setStep(i, { text: v }, `text-${keyOfStep(s)}`)} />
                  </Field>
                  <div class="row wrap draw-when">
                    <span class="small muted">When</span>
                    <Select<string> label={`When step ${i + 1} happens`} value={s.when ?? ''} onChange={(v) => setStep(i, { when: (v || null) as Moment | null })} options={moments(s)} />
                  </div>
                  {f && f.who.length > 0 && (
                    <div class="step-who small">
                      {f.who.map((x) => <span key={x.id} class="step-agent"><AgentIcon id={x.id} size={20} /><b>{agentById(x.id)?.name}</b><span class="muted">{jobWords(x)}</span></span>)}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <div class="row wrap">
            <Button icon="plus" disabled={used >= PLAY_JOBS || d.steps.length >= LIMITS.steps} onClick={() => { set({ steps: [...d.steps, newStep()] }); setAt(d.steps.length); }}>Add a step</Button>
            <span class="small muted">{used >= PLAY_JOBS ? `All ${PLAY_JOBS} players have a job.` : `${used} of ${PLAY_JOBS} players ${used === 1 ? 'has' : 'have'} a job.`}</span>
          </div>
          <p class="small muted">The callouts a line names are where its smokes, flashes and information land, as in the built-in plays.</p>
        </div>
      </div>
    </>
  );
}
