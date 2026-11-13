/**
 * The plays a comp can run, filled with its agents: a list to choose from (best fit first) and the
 * chosen play's steps beside its routes on the minimap. Pointing at a step (or focusing it) brings its route forward.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { agentById } from '../../core/kb/agents.ts';
import { mapById, MAPS, POOL, spotName, type Side, type SiteId } from '../../core/kb/maps.ts';
import { KIND_NAMES, MOMENTS, momentName, playTitle, roundOf, type Play } from '../../core/kb/plays.ts';
import { demandLine, JOB_NAMES, momentClock, momentLabel, jobWords, plantLine, playFitLabel, playsFor, THROW_KINDS, WEAK_JOB, type FilledPlay } from '../../core/engine/plays.ts';
import type { RankId } from '../../core/kb/ranks.ts';
import { listJoin } from '../../core/text.ts';
import { AgentIcon } from '../art.tsx';
import { Badge, Button, IconButton, Segmented, Select } from '../components/controls.tsx';
import { Minimap, REPLAY_MS, ROUTE_COLORS, SpikeSwatch, THROW_NAMES, ThrowSwatch, type Replay } from '../components/minimap.tsx';
import { Icon } from '../icons.tsx';
import { drawLink, useMyPlays } from '../myplays.ts';
import { play } from '../sound.ts';
import { go } from '../state.ts';

const fitTone = (fit: number) => ({ 'Fits well': 'good', Works: undefined, 'A stretch': 'warn' } as const)[playFitLabel(fit)];

/**
 * Plays for a team on a map, at a rank. With no map (any map), a map to look at is chosen here.
 * `onPick` hears of the play on show, so a printed plan can carry the one you chose.
 */
export function PlaysPanel({ team, map: mapId, side: sidePick, sites, rank, onPick }: { team: readonly string[]; map: string; side: Side | 'both'; sites: readonly SiteId[]; rank: RankId; onPick?: (f: FilledPlay) => void }) {
  const [own, setOwn] = useState(POOL[0]!.id);
  const [sideOwn, setSide] = useState<Side>('attack');
  const map = mapById(mapId) ?? mapById(own)!;
  const side: Side = sidePick === 'both' ? sideOwn : sidePick;
  const mine = useMyPlays(map.id);
  // the plays for a bought round, then those for one kind of round (pistol, eco and anti-eco), yours among them
  const [bought, low] = useMemo(() => [playsFor(team, map.id, side, mapById(mapId) ? sites : [], false, mine, rank), playsFor(team, map.id, side, [], true, mine, rank)], [team.join(), map.id, side, sites.join(), mine, rank]);
  const list = [...bought, ...low];
  const [pick, setPick] = useState(0);
  useEffect(() => setPick(0), [team.join(), map.id, side, rank]);
  const chosen = list[Math.min(pick, list.length - 1)];
  useEffect(() => { if (chosen) onPick?.(chosen); }, [chosen?.play.id]);
  const rows = (fs: readonly FilledPlay[], from: number) => <PlayRows plays={fs} chosen={chosen} onPick={(i) => setPick(from + i)} />;
  return (
    <div class="plays">
      {(!mapById(mapId) || sidePick === 'both') && (
        <div class="row wrap plays-tools">
          {!mapById(mapId) && <Select label="Map for the plays" value={own} onChange={setOwn} options={[...POOL, ...MAPS.filter((m) => !m.pool)].map((m) => [m.id, m.pool ? m.name : `${m.name} (out of the pool)`] as const)} />}
          {sidePick === 'both' && <Segmented label="Side for the plays" value={sideOwn} onChange={setSide} options={[['attack', 'Attack'], ['defense', 'Defense']]} />}
          {!mapById(mapId) && <span class="muted small">Plays are for one map, so choose one to look at.</span>}
        </div>
      )}
      <div class="play-list" role="listbox" aria-label={`Plays on ${map.name}`}>{rows(bought, 0)}</div>
      {low.length > 0 && <>
        <h3 class="play-group" id={`low-${map.id}-${side}`}>Pistol, eco and anti-eco rounds</h3>
        <div class="play-list" role="listbox" aria-labelledby={`low-${map.id}-${side}`}>{rows(low, bought.length)}</div>
      </>}
      <p class="row wrap small muted plays-own">
        <span>Know a play that isn’t here? Draw it on the map, and it’s filled with any comp like these.</span>
        <Button size="sm" kind="quiet" icon="draw" onClick={() => go('maps', drawLink(map.id))}>Draw a play</Button>
      </p>
      {chosen && <PlayCard f={chosen} rank={rank} key={chosen.play.id} />}
    </div>
  );
}

/**
 * Plays to choose from, as options of a list box: what each is (`label`, its kind and site unless
 * given), its name, whether it's one you drew, and how well the comp fits it.
 */
export function PlayRows({ plays, chosen, onPick, label }: { plays: readonly FilledPlay[]; chosen: FilledPlay | undefined; onPick: (i: number) => void; label?: (p: Play) => string }) {
  return (
    <>
      {plays.map((f, i) => (
        <button type="button" role="option" key={f.play.id} aria-selected={f.play.id === chosen?.play.id} class="play-row" onClick={() => { play('tick'); onPick(i); }}>
          <span class="play-kind">{label ? label(f.play) : `${KIND_NAMES[f.play.kind]}${f.play.site ? ` ${f.play.site}` : ''}`}</span>
          <span class="play-name">{f.play.name}</span>
          {f.play.mine && <Badge tone="accent">Yours</Badge>}
          <Badge tone={fitTone(f.fit)}>{playFitLabel(f.fit)}</Badge>
        </button>
      ))}
    </>
  );
}

/**
 * One play: what it is and how much teamwork it asks for (at `rank`, when given), its steps with who
 * does what, in the order they happen, and the routes on the minimap, each ending in its players'
 * faces, with the utility drawn where it lands. Pointing at
 * a step brings its route forward for a moment; stepping through the play keeps one step forward
 * until you move on; and the replay runs the play one moment at a time, the players walking their
 * routes and their utility landing as they arrive.
 */
export function PlayCard({ f: listed, rank }: { f: FilledPlay; rank?: RankId }) {
  // a play that reads and reacts shows one branch at a time, the best one first
  const [branch, setBranch] = useState(listed.play.id);
  const f = listed.branches?.find((b) => b.play.id === branch) ?? listed;
  return <BranchCard key={f.play.id} f={f} rank={rank} branches={listed.branches} onBranch={setBranch} />;
}

function BranchCard({ f, rank, branches, onBranch }: { f: FilledPlay; rank?: RankId; branches?: readonly FilledPlay[]; onBranch: (id: string) => void }) {
  const [hover, setFocus] = useState(-1);
  const [step, setStep] = useState(-1);
  const [replay, setReplay] = useState<Replay | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const focus = hover >= 0 ? hover : step;
  const last = f.steps.length - 1;
  const map = mapById(f.play.map)!;
  const round = roundOf(f.play);
  // the moments this play has, in order, and each step's place among them
  const moments = MOMENTS.filter((m) => f.steps.some((s) => s.when === m));
  const momentOf = (i: number) => moments.indexOf(f.steps[i]!.when);
  const kinds = THROW_KINDS.filter((k) => f.steps.some((s) => s.throws.some((t) => t.kind === k)));
  // the Spike, from the moment it's down
  const spike = f.plant && { at: f.plant.at, about: f.plant.about, when: moments.indexOf(f.plant.when), end: f.plant.end };
  // a replay moves on by itself, a moment at a time, and stops at the last
  useEffect(() => {
    if (!playing || !replay) return;
    const t = setTimeout(() => {
      if (replay.at >= moments.length - 1) setPlaying(false);
      else setReplay({ at: replay.at + 1, run: replay.run + 1 });
    }, REPLAY_MS + REPLAY_PAUSE);
    return () => clearTimeout(t);
  }, [playing, replay?.run]);
  const show = (at: number) => { setReplay({ at, run: (replay?.run ?? 0) + 1 }); setStep(-1); };
  const done = !!replay && !playing && replay.at >= moments.length - 1;
  const toggle = () => {
    if (playing) { play('tick'); setPlaying(false); return; }
    play('open');
    show(!replay || done ? 0 : replay.at + 1 > moments.length - 1 ? 0 : replay.at + 1);
    setPlaying(true);
  };
  const reset = () => { setStep(-1); setReplay(undefined); setPlaying(false); };
  const stateOf = (i: number) => (!replay ? '' : momentOf(i) === replay.at ? ' now' : momentOf(i) > replay.at ? ' later' : '');
  return (
    <article class="play-card" aria-label={playTitle(f.play)}>
      <div class="play-map stack">
        <Minimap map={map.id} zoomable replay={replay} spike={spike} routes={f.steps.map((s, i) => ({ route: s.route, who: s.who.map((d) => d.id), throws: s.throws, when: momentOf(i) }))} focus={focus} onFocus={setFocus} label={`${f.play.name} on the ${map.name} minimap`} />
        {(kinds.length > 0 || spike) && (
          <ul class="plain-list row wrap map-legend play-legend" aria-label="What the marks mean">
            {kinds.map((k) => <li key={k} class="row"><ThrowSwatch kind={k} /><span class="small">{THROW_NAMES[k]}</span></li>)}
            {spike && <li class="row"><SpikeSwatch /><span class="small">Spike</span></li>}
          </ul>
        )}
      </div>
      <div class="play-body">
        <div class="row-between play-title">
          <h3>{playTitle(f.play)}</h3>
          {f.play.mine && <Button size="sm" kind="quiet" icon="draw" onClick={() => go('maps', drawLink(map.id, f.play.id))}>Change</Button>}
        </div>
        {f.play.about ? <p class="muted">{f.play.about}</p> : f.play.mine && <p class="muted">A play you drew.</p>}
        <p class="small muted play-demand">{demandLine(f, rank)}</p>
        {f.plant && <p class="small muted play-plant">{plantLine(f.play, f.plant)}</p>}
        {branches && branches.length > 1 && (
          <div class="row wrap play-branches" data-tour="play-branches">
            <span class="small">What the team finds out</span>
            <Segmented label="What the team finds out" value={f.play.id} onChange={onBranch} options={branches.map((b) => [b.play.id, b.play.branch!.if] as const)} />
          </div>
        )}
        <div class="row wrap play-replay" role="group" aria-label="Replay the play" data-tour="play-replay">
          <Button size="sm" sound={false} kind={playing ? 'quiet' : 'secondary'} icon={playing ? 'pause' : 'play'} onClick={toggle}>{playing ? 'Pause' : done || !replay ? 'Replay' : 'Go on'}</Button>
          <ol class="plain-list row play-moments" aria-label="Moments">
            {moments.map((m, k) => (
              <li key={m}><button type="button" class={`play-moment${replay?.at === k ? ' on' : ''}`} aria-pressed={replay?.at === k} onClick={() => { play('tick'); setPlaying(false); show(k); }}>{momentName(f.play, m)}{momentClock(f, m) && <span class="play-clock"><span class="visually-hidden">, </span>{momentClock(f, m)}</span>}</button></li>
            ))}
          </ol>
          <span class="visually-hidden" aria-live="polite">{replay ? momentLabel(f, moments[replay.at]!) : ''}</span>
        </div>
        <div class="row play-walk" role="group" aria-label="Step through the play">
          <IconButton icon="chevron-left" label="Previous step" size="sm" disabled={step === 0} onClick={() => setStep(step <= 0 ? last : step - 1)} />
          <span class="play-walk-at" aria-live="polite">{step < 0 ? 'All steps' : `Step ${step + 1} of ${f.steps.length}`}</span>
          <IconButton icon="chevron-right" label="Next step" size="sm" disabled={step === last} onClick={() => setStep(step + 1)} />
          {(step >= 0 || replay) && <Button kind="quiet" size="sm" onClick={reset}>Show all</Button>}
        </div>
        {moments.map((m) => (
          <section key={m} class="play-when" aria-label={momentLabel(f, m)}>
            {moments.length > 1 && <h4 class="play-when-name">{momentLabel(f, m)}</h4>}
            <ol class="play-steps" start={f.steps.findIndex((s) => s.when === m) + 1}>
              {f.steps.map((s, i) => (s.when !== m ? null : (
                <li key={i} class={`${focus === i ? 'focus' : ''}${stateOf(i)}`} onClick={() => setStep(step === i ? -1 : i)} tabIndex={0} onMouseEnter={() => setFocus(i)} onMouseLeave={() => setFocus(-1)} onFocus={() => setFocus(i)} onBlur={() => setFocus(-1)}>
                  <span class={`step-dot r${i % ROUTE_COLORS}`} aria-hidden="true">{i + 1}</span>
                  <div class="step-text">
                    <div class="step-who">
                      {s.who.map((d) => (
                        <span key={d.id} class="step-agent">
                          <AgentIcon id={d.id} size={22} />
                          <b>{agentById(d.id)?.name}</b>
                          <span class="muted">{jobWords(d)}</span>
                          {d.value < WEAK_JOB && <span class="step-weak" data-tip="A stretch, since nobody free in this comp is good at this job"><Icon name="warning" size={14} label="A stretch for this comp" /></span>}
                        </span>
                      ))}
                    </div>
                    <div class="step-route">{s.route.map(spotName).join(' → ')}</div>
                    <p>{s.text}</p>
                  </div>
                </li>
              )))}
            </ol>
          </section>
        ))}
        {round && <p class="note"><Icon name="info" size={16} /><span><b>{round.name}.</b> {round.text}</span></p>}
        {f.weak.length > 0 && (
          <p class="play-note"><Icon name="info" size={16} />This comp is light on {listJoin([...new Set(f.weak.map((d) => JOB_NAMES[d.job].toLowerCase()))])} for this play, so the steps marked with a warning are a stretch.</p>
        )}
      </div>
    </article>
  );
}

/** The pause between a replay's moments (ms), so each can be taken in before the next. */
const REPLAY_PAUSE = 900;
