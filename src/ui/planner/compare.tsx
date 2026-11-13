/**
 * Two comps for the same situation side by side, for a team choosing between its favorites: their
 * fits, how each wins, their best plays, how well each covers what the situation needs, and where
 * the lower one falls short or does better, read off the same score (explain.ts, whyBelow).
 */
import { useState } from 'preact/hooks';
import { agentById } from '../../core/kb/agents.ts';
import { mapById } from '../../core/kb/maps.ts';
import { playTitle } from '../../core/kb/plays.ts';
import { DIM_INFO } from '../../core/kb/roles.ts';
import { explainTeam, whyBelow } from '../../core/engine/explain.ts';
import { answerModel, type SituationAnswer } from '../../core/engine/plan.ts';
import { playFitLabel, playsFor } from '../../core/engine/plays.ts';
import { listJoin } from '../../core/text.ts';
import { Bar, Select } from '../components/controls.tsx';
import { DialogLayout } from '../components/overlays.tsx';
import { openDialog } from '../state.ts';
import { Fit, TeamIcons } from './comp.tsx';
import { askedTitle } from './words.ts';

const names = (ids: readonly string[]) => listJoin(ids.map((id) => agentById(id)?.name ?? id));

/** Opens the comparison with comp `i` of the answer on the left, and the best other comp on the right. */
export function compareComps(ans: SituationAnswer, i: number): Promise<unknown> {
  return openDialog('Compare comps', (close) => <Compare ans={ans} first={i} close={close} />, { wide: true });
}

function Compare({ ans, first, close }: { ans: SituationAnswer; first: number; close: () => void }) {
  const [left, setLeft] = useState(first);
  const [right, setRight] = useState(first === 0 ? 1 : 0);
  const s = ans.situation;
  const m = answerModel(ans);
  const options = ans.comps.map((c, i) => [String(i), `${i + 1}. ${c.team.map((id) => agentById(id)?.name ?? id).join(', ')}`] as const);
  const shown = [left, right].map((i) => ans.comps[i]!);
  const why = shown.map((c) => explainTeam(m, c.team));
  // the needs that matter most here, and how well each comp covers them
  const needs = [...why[0]!.strengths].sort((a, b) => b.need - a.need).slice(0, 8);
  const cover = (k: number, dim: string) => why[k]!.strengths.find((r) => r.dim === dim)?.cover ?? 0;
  // where the lower one falls short of the higher one, and where it does better
  const [hi, lo] = shown[0]!.fit >= shown[1]!.fit ? [0, 1] : [1, 0];
  const below = left === right ? null : whyBelow(m, shown[hi]!.team, shown[lo]!.team);
  const map = mapById(s.map);
  const side = s.side === 'both' ? 'attack' : s.side;
  return (
    <DialogLayout title="Compare comps" icon="columns" close={close}>
      <p class="muted small">{askedTitle(s)}: two of the comps the Planner found, side by side.</p>
      <div class="compare-cols">
        {shown.map((c, k) => {
          const best = map ? playsFor(c.team, map.id, side, s.sites, false, [], s.rank)[0] : undefined;
          return (
            <section key={k} class="compare-col" aria-label={k === 0 ? 'First comp' : 'Second comp'}>
              <Select label={k === 0 ? 'First comp' : 'Second comp'} value={String(k === 0 ? left : right)} options={options} onChange={(v) => (k === 0 ? setLeft : setRight)(Number(v))} />
              <div class="row wrap compare-team">
                <TeamIcons team={c.team} size={36} />
                <Fit fit={c.fit} tier={c.tier} label="Fit" />
              </div>
              {why[k]!.plan && <p class="compare-plan"><b>How it wins.</b> {why[k]!.plan}</p>}
              {best && <p class="muted small">Best play{s.side === 'both' ? ' on attack' : ''}: <b>{playTitle(best.play)}</b> ({playFitLabel(best.fit).toLowerCase()})</p>}
            </section>
          );
        })}
      </div>
      <table class="strength-table compare-table">
        <caption class="visually-hidden">How well each comp covers what the situation needs</caption>
        <thead><tr><th scope="col">Need</th><th scope="col">First comp</th><th scope="col">Second comp</th></tr></thead>
        <tbody>
          {needs.map((r) => {
            const a = cover(0, r.dim), b = cover(1, r.dim);
            return (
              <tr key={r.dim}>
                <th scope="row" data-tip={DIM_INFO[r.dim].blurb}>{DIM_INFO[r.dim].name}</th>
                <td><Bar value={a} size="thin" tone={a > b + 0.05 ? 'good' : undefined} label={`${DIM_INFO[r.dim].name} covered by the first comp`} /></td>
                <td><Bar value={b} size="thin" tone={b > a + 0.05 ? 'good' : undefined} label={`${DIM_INFO[r.dim].name} covered by the second comp`} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {left === right ? (
        <p class="muted">Both sides show the same comp. Choose another one to compare.</p>
      ) : below && (
        <div class="why-not">
          <p>
            The {lo === 0 ? 'first' : 'second'} comp plays {names(below.in)} instead of {names(below.out)}
            {Math.round(shown[lo]!.fit) >= Math.round(shown[hi]!.fit) ? ', and fits as well.' : <>, and fits <span class="num">{Math.round(shown[lo]!.fit)}</span> against <span class="num">{Math.round(shown[hi]!.fit)}</span>.</>}
          </p>
          {below.loses.length > 0 && <div><span class="muted small">Where it falls short</span><ul class="reasons">{below.loses.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          {below.gains.length > 0 && <div><span class="muted small">Where it’s better</span><ul class="reasons">{below.gains.map((x) => <li key={x}>{x}</li>)}</ul></div>}
        </div>
      )}
    </DialogLayout>
  );
}
