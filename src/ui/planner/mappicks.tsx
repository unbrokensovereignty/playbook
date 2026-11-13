/**
 * Map pick help, above the list of maps when a team asks for its best map: the maps to play and the
 * ones to ban, each with why (core/engine/mappick.ts). Choosing a map shows its comps below.
 */
import { useMemo } from 'preact/hooks';
import { mapById } from '../../core/kb/maps.ts';
import { mapPicks, type MapPick } from '../../core/engine/mappick.ts';
import type { SituationAnswer } from '../../core/engine/plan.ts';
import type { Query } from '../../core/engine/query.ts';
import { MapThumb } from '../art.tsx';
import { Icon, type IconName } from '../icons.tsx';
import { play } from '../sound.ts';
import { Fit, TeamIcons } from './comp.tsx';

export function MapPicks({ answers, q, onPick }: { answers: readonly SituationAnswer[]; q: Query; onPick: (i: number) => void }) {
  const picks = useMemo(() => mapPicks(answers, q), [answers, q]);
  if (picks.even) {
    return <p class="note" data-tour="map-picks"><Icon name="info" size={16} />Your team fits every map about as well, so pick or ban the maps you know best.</p>;
  }
  // the situation a pick's reasons are about, to show its comps
  const show = (p: MapPick) => {
    const i = answers.findIndex((a) => a.situation.map === p.map && (!p.side || a.situation.side === p.side));
    if (i >= 0) { play('tick'); onPick(i); }
  };
  return (
    <section class="map-picks" aria-label="Maps to play and to ban" data-tour="map-picks">
      <Column title="Play" icon="trophy" picks={picks.play} show={show} />
      <Column title="Ban" icon="x" picks={picks.ban} show={show} ban />
    </section>
  );
}

function Column({ title, icon, picks, show, ban }: { title: string; icon: IconName; picks: readonly MapPick[]; show: (p: MapPick) => void; ban?: boolean }) {
  return (
    <div class={`map-picks-col${ban ? ' ban' : ''}`}>
      <h3 class="row small"><Icon name={icon} size={16} />{title}</h3>
      {picks.length ? (
        <ul class="plain-list stack">
          {picks.map((p) => {
            const name = mapById(p.map)?.name ?? p.map;
            return (
              <li key={p.map} class="map-pick stack">
                <button type="button" class="map-pick-head" onClick={() => show(p)}>
                  <MapThumb id={p.map} />
                  <span class="map-pick-name"><b>{name}</b>{p.side && <small class="muted">{ban ? 'Weaker' : 'Stronger'} on {p.side}</small>}</span>
                  <Fit fit={p.fit} tier={p.tier} label={`${name}’s fit`} compact />
                </button>
                {p.lead && <p class="small">{p.lead}</p>}
                {p.why.length > 0 && <ul class="small map-pick-why">{p.why.map((w) => <li key={w}>{w.replace(/\.$/, '')}.</li>)}</ul>}
                {ban && p.team.length > 0 && (
                  <div class="map-pick-teams small">
                    <span class="muted">Your best comp there</span><TeamIcons team={p.team} size={24} />
                    <span class="muted">The best comp for {name}</span><TeamIcons team={p.best} size={24} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : <p class="small muted">{ban ? 'No map is much weaker than the others.' : 'No map is much stronger than the others.'}</p>}
    </div>
  );
}
