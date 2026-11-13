/**
 * One comp in the answers: a row with its agents and fit, which opens into why it works (pros,
 * cons and strengths), the plays it can run, and tips. A duo or trio's row shows your party first
 * and the best agents for your random teammates after it.
 */
import { useRef, useState } from 'preact/hooks';
import { agentById } from '../../core/kb/agents.ts';
import { mapById, type Side } from '../../core/kb/maps.ts';
import { DIM_INFO, ROLES } from '../../core/kb/roles.ts';
import { againstWords, explainFor, explainTeam, swapLine, type AgainstRow, type StrengthRow } from '../../core/engine/explain.ts';
import { answerModel, type CompAnswer, type SituationAnswer } from '../../core/engine/plan.ts';
import { playsFor, type FilledPlay } from '../../core/engine/plays.ts';
import { partyOf, type PartySize, type Query } from '../../core/engine/query.ts';
import { chatText, summaryText } from '../../core/engine/summary.ts';
import { tipsFor } from '../../core/engine/tips.ts';
import { listJoin } from '../../core/text.ts';
import { articleOf, capitalize } from '../../core/util.ts';
import { AgentIcon } from '../art.tsx';
import { Bar, Button, Tabs } from '../components/controls.tsx';
import { openMenu, prompt } from '../components/overlays.tsx';
import { copyWithToast, printSheet } from '../files.ts';
import { Icon } from '../icons.tsx';
import { data, go, safely, toast, useSettings } from '../state.ts';
import { play } from '../sound.ts';
import { tourHook } from '../tours/now.ts';
import { PlaysPanel } from './plays.tsx';
import { PlanSheet, type SheetParts } from './sheet.tsx';
import { askedLine, askedTitle, howOften } from './words.ts';

const nameOf = (id: string) => agentById(id)?.name ?? id;

/**
 * A fit as a number and a bar (or only the bar, when numbers are off in Settings). A fit that's
 * less sure (core/engine/sure.ts) has a dashed ring on its tier and, unless compact, says so; what
 * it's on gives the reason.
 */
export function Fit({ fit, tier, label, compact, unsure }: { fit: number; tier: string; label: string; compact?: boolean; unsure?: boolean }) {
  const numbers = useSettings().showNumbers;
  const tierName = `Tier ${tier}${unsure ? ', less sure' : ''}`;
  return (
    <span class={`fit${compact ? ' compact' : ''}${unsure ? ' unsure' : ''}`}>
      {unsure && !compact && <span class="unsure-tag" aria-hidden="true">less sure</span>}
      <span class={`tier tier-${tier.toLowerCase()}`} data-tip={tierName} aria-label={tierName}>{tier}</span>
      {!(compact && numbers) && <Bar value={fit / 100} size="thin" label={`${label}: ${Math.round(fit)} out of 100`} />}
      {numbers && <span class="fit-num num" aria-label={compact ? `${label}: ${Math.round(fit)} out of 100` : undefined} aria-hidden={compact ? undefined : 'true'}>{Math.round(fit)}</span>}
    </span>
  );
}

/** The agents of a team as portraits, your party's first and marked; the others' names say whether they're locked in or a pick for a random teammate. */
export function TeamIcons({ team, party = [], locked = [], size = 40 }: { team: readonly string[]; party?: readonly string[]; locked?: readonly string[]; size?: number }) {
  const order = [...party, ...team.filter((id) => !party.includes(id))];
  const what = (id: string) => (party.includes(id) ? ' (your party)' : locked.includes(id) ? ' (locked in)' : ' (a pick for a random teammate)');
  return (
    <span class="team-icons">
      {order.map((id) => (
        <span key={id} class={`team-icon${party.length && !party.includes(id) ? ' other' : ''}`} data-tip={`${nameOf(id)}${party.length ? what(id) : ''}`}>
          <AgentIcon id={id} size={size} label />
        </span>
      ))}
    </span>
  );
}

export function CompRow({ c, i, ans, q, open, onToggle, onCompare }: { c: CompAnswer; i: number; ans: SituationAnswer; q: Query; open: boolean; onToggle: () => void; onCompare?: () => void }) {
  const party = c.party;
  const names = party.length
    ? <><b>{listJoin(party.map(nameOf))}</b><span class="muted"> with {listJoin(c.team.filter((x) => !party.includes(x)).map(nameOf))}</span></>
    : <b>{c.team.map(nameOf).join(', ')}</b>;
  const id = `comp-${i}`;
  // for a five-stack, what sets the comp apart from the best one, read off the same score
  const best = ans.comps[0];
  const swap = i > 0 && best && !party.length ? swapLine(answerModel(ans), best.team, c.team) : '';
  return (
    <li class={`comp${open ? ' open' : ''}`}>
      <button type="button" class="comp-head" data-tour={i === 0 ? 'comp-first' : undefined} aria-expanded={open} aria-controls={id} onClick={() => { play(open ? 'close' : 'open'); onToggle(); }}>
        <span class="comp-rank num">{i + 1}</span>
        <TeamIcons team={c.team} party={party} locked={q.locked} />
        <span class="comp-names"><span class="comp-team">{names}</span>{swap && <span class="comp-swap">{swap}</span>}</span>
        <Fit fit={c.fit} tier={c.tier} label={party.length ? `Fit among ${partyOf(party.length as PartySize).plural}` : 'Fit'} />
        <Icon name="chevron-down" size={18} class="comp-chev" />
      </button>
      {open && <div class="comp-body" id={id}><CompDetail c={c} i={i} ans={ans} q={q} onCompare={onCompare} /></div>}
    </li>
  );
}

type Tab = 'why' | 'plays' | 'tips';

/**
 * A comp opened up: pros and cons, plays and tips, with Copy (a few lines for a party chat, or the
 * whole plan), Print, Compare (when there's another comp to set it beside) and (unless it's saved
 * already) Save plan. A saved plan passes its name and note, for the printed sheet.
 */
export function CompDetail({ c, i, ans, q, saveable = true, plan, onCompare }: { c: CompAnswer; i: number; ans: SituationAnswer; q: Query; saveable?: boolean; plan?: { name: string; note: string }; onCompare?: () => void }) {
  const [chosen, setTab] = useState<Tab>('why');
  const numbers = useSettings().showNumbers;
  // the play on show on the Plays tab for each side, and the team it was for: a copied or printed plan carries it
  const shown = useRef<Partial<Record<Side, { team: string; f: FilledPlay }>>>({});
  // a tour step about the pros and cons or the strengths shows them
  const tab = tourHook.value === 'comp-reasons' || tourHook.value === 'comp-strengths' ? 'why' : chosen;
  const s = ans.situation;
  const why = explainTeam(answerModel(ans), c.team, explainFor(q, c));
  const tips = tipsFor(c.team, s, q.party, c.party, q.locked.length);
  const save = async () => {
    const name = await prompt({ title: 'Save this plan', label: 'Name', yes: 'Save', value: `${askedTitle(s)}: ${c.team.map(nameOf).join(', ')}`.slice(0, 60), maxLength: 60 });
    if (!name) return;
    // the plan keeps this situation, even when the question asked for the best map, side or rank
    const saved = safely(() => data().savePlan({ name, query: { ...q, map: s.map, side: s.side, rank: s.rank, sites: [...s.sites] }, team: c.team }));
    if (saved) { play('saved'); toast(`Saved “${saved.name}”.`, { tone: 'good', undo: true, action: { label: 'Open', run: () => go('saved', saved.id) } }); }
    else if (saved === null) toast('There are too many saved plans. Delete some on the Saved page first.', { tone: 'bad' });
  };
  /** The plan as copied or printed, with a play for each side: the one you chose on the Plays tab, or the best. */
  const parts = (): SheetParts => {
    const map = mapById(s.map);
    const sides: Side[] = s.side === 'both' ? ['attack', 'defense'] : [s.side];
    const plays = sides.map((side) => {
      const seen = shown.current[side];
      if (seen && seen.team === c.team.join() && (!map || seen.f.play.map === map.id)) return seen.f;
      return map ? playsFor(c.team, map.id, side, s.sites, false, [], s.rank)[0] : undefined;
    }).filter((f) => !!f);
    const ask = asksFor(c, i, ans)[0];
    const heading = askedTitle(s), line = askedLine({ ...q, rank: s.rank });
    return {
      title: `${heading} · ${line}`, heading, line, name: plan?.name, note: plan?.note, numbers,
      team: c.team, party: c.party, locked: q.locked, ask: ask && roleWord(ask.role), fit: c.fit, expected: c.expected, tier: c.tier, why, plays,
      // the sheet's map tips lead with the sites its plays are on
      tips: s.sites.length ? tips : tipsFor(c.team, s, q.party, c.party, q.locked.length, Object.fromEntries(plays.map((f) => [f.play.side, f.play.site ? [f.play.site] : []]))),
    };
  };
  const copy = (e: MouseEvent) => openMenu(e, [
    { label: 'Short, for party chat', icon: 'users', run: () => void copyWithToast(chatText(parts()), 'Copied a short plan for party chat.') },
    { label: 'The whole plan', icon: 'copy', run: () => void copyWithToast(summaryText(parts()), 'Copied the plan.') },
  ]);
  const print = () => void printSheet(<PlanSheet p={parts()} />);
  return (
    <>
      <div class="row-between comp-tools" data-tour="comp-tools">
        <Tabs<Tab> label="About this comp" value={tab} onChange={setTab} tabs={[['why', 'Pros and cons'], ['plays', 'Plays'], ['tips', 'Tips']]} />
        <div class="row">
          <Button size="sm" icon="copy" menu onClick={copy}>Copy</Button>
          <Button size="sm" icon="print" onClick={print}>Print</Button>
          {onCompare && <Button size="sm" icon="columns" onClick={onCompare}>Compare</Button>}
          {saveable && <Button size="sm" icon="bookmark" kind="soft" onClick={() => void save()}>Save plan</Button>}
        </div>
      </div>
      {tab === 'why' && <>
        {why.plan && <p class="comp-plan" data-tour="comp-plan"><Icon name="target" size={18} /><span><b>How it wins.</b> {why.plan}</span></p>}
        {c.party.length > 0 && <PartyBox c={c} i={i} ans={ans} locked={q.locked} />}
        {why.against.length > 0 && <Against rows={why.against} />}
        <div class="pros-cons" data-tour="comp-reasons">
          <div>
            <h3 class="row good-text"><Icon name="check" size={18} />Pros</h3>
            {why.pros.length ? <ul class="reasons">{why.pros.map((x) => <li key={x}>{x}</li>)}</ul> : <p class="muted">Nothing stands out. It’s a steady, all-round comp.</p>}
          </div>
          <div>
            <h3 class="row bad-text"><Icon name="warning" size={18} />Cons</h3>
            {why.cons.length ? <ul class="reasons">{why.cons.map((x) => <li key={x}>{x}</li>)}</ul> : <p class="muted">No real weak spots for this situation.</p>}
          </div>
        </div>
        {why.notes.map((n) => <p key={n} class="note"><Icon name="info" size={16} />{n}</p>)}
        <Strengths rows={why.strengths} />
      </>}
      {tab === 'plays' && <PlaysPanel team={c.team} map={s.map} side={s.side} sites={s.sites} rank={s.rank} onPick={(f) => { shown.current[f.play.side] = { team: c.team.join(), f }; }} />}
      {tab === 'tips' && (
        <ul class="tips">
          {tips.map((t) => <li key={t.about + t.text}><b>{t.about}</b><span>{t.text}</span></li>)}
        </ul>
      )}
    </>
  );
}

/** The roles worth asking random teammates for, best first: for the best party only, and only those that lift the team above what you'd expect anyway. */
const asksFor = (c: CompAnswer, i: number, ans: SituationAnswer) => (i === 0 ? ans.askFor ?? [] : []).filter((a) => a.fit > (c.expected ?? c.fit)).slice(0, 2);
const roleWord = (id: string) => ROLES.find((r) => r.id === id)?.name.toLowerCase() ?? id;

function PartyBox({ c, i, ans, locked }: { c: CompAnswer; i: number; ans: SituationAnswer; locked: readonly string[] }) {
  const expected = c.expected ?? c.fit;
  const ask = asksFor(c, i, ans);
  const role = roleWord;
  // the places your random teammates pick, and the agents in them
  const open = (id: string) => !c.party.includes(id) && !locked.includes(id);
  const picks = c.team.filter(open);
  const yours = c.party.length === 1 ? <>You play <b>{nameOf(c.party[0]!)}</b>.</> : <>Your party plays <b>{listJoin(c.party.map(nameOf))}</b>.</>;
  return (
    <div class="party-box">
      {picks.length > 0 ? (
        <p>
          {yours} If your random teammates play {listJoin(picks.map(nameOf))}, the team fits <b class="num">{Math.round(c.pickFit ?? expected)}</b> out of 100
          (the best five-stack is 100). If they pick on their own, expect a team that fits about <b class="num">{Math.round(expected)}</b>, give or take {Math.round(c.spread ?? 0)}.
        </p>
      ) : (
        <p>
          {yours} With the agents your teammates locked in, the team fits <b class="num">{Math.round(expected)}</b> out of 100 (the best five-stack is 100).
        </p>
      )}
      {ask.length > 0 && (
        <p>
          Ask your teammates for {articleOf(role(ask[0]!.role))} <b>{role(ask[0]!.role)}</b> first. They pick one on their own {howOften(ask[0]!.chance)}, and with one, expect about <span class="num">{Math.round(ask[0]!.fit)}</span>.
          {ask[1] && <> {capitalize(articleOf(role(ask[1].role)))} <b>{role(ask[1].role)}</b> helps next (<span class="num">{Math.round(ask[1].fit)}</span>).</>}
        </p>
      )}
      {!!c.others?.length && (
        <div class="row wrap party-best">
          <span class="muted">Other good picks for them</span>
          {c.others.map((o) => (
            <span key={o.team.join()} class="row party-team">
              <TeamIcons team={o.team.filter(open)} size={28} />
              <span class="muted num">fit {Math.round(o.fit)}</span>
            </span>
          ))}
        </div>
      )}
      {c.likely && c.likely.team.join() !== c.team.join() && (
        <div class="row wrap party-best">
          <span class="muted">If they pick on their own, most likely</span>
          <span class="row party-team">
            <TeamIcons team={c.likely.team.filter(open)} size={28} />
            <span class="muted num">fit {Math.round(c.likely.fit)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

const AGAINST_ICON = { answered: 'check', partly: 'minus', little: 'warning', around: 'info' } as const;

/** How the comp stands against what the other team makes you play around, the biggest threat first. */
function Against({ rows }: { rows: readonly AgainstRow[] }) {
  return (
    <div class="against" data-tour="comp-against">
      <h3>Against their team</h3>
      <ul class="against-list">
        {rows.map((r) => (
          <li key={r.id} class={`against-row ${r.verdict}`}>
            <Icon name={AGAINST_ICON[r.verdict]} size={18} />
            <span><b>{r.threat}.</b> {againstWords(r)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What the situation needs most and how well the comp covers it. */
function Strengths({ rows }: { rows: readonly StrengthRow[] }) {
  const top = [...rows].sort((a, b) => b.need - a.need).slice(0, 8);
  return (
    <div class="strengths" data-tour="comp-strengths">
      <h3>What this situation needs</h3>
      <table class="strength-table">
        <thead><tr><th scope="col">Need</th><th scope="col">How much</th><th scope="col">Covered</th><th scope="col">By</th></tr></thead>
        <tbody>
          {top.map((r) => (
            <tr key={r.dim}>
              <th scope="row" data-tip={DIM_INFO[r.dim].blurb}>{DIM_INFO[r.dim].name}</th>
              <td><span class="need">{r.need >= 1.4 ? 'A lot' : r.need >= 1 ? 'Some' : 'A little'}</span></td>
              <td><Bar value={r.cover} size="thin" tone={r.cover >= 0.8 ? 'good' : undefined} label={`${DIM_INFO[r.dim].name} covered`} /></td>
              <td class="by">{r.by.length ? r.by.slice(0, 3).map((b) => nameOf(b.id) + (b.abilities.length ? ` (${listJoin(b.abilities)})` : '')).join(', ') : <span class="faint">Nobody</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

