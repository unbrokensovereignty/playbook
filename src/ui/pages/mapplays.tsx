/**
 * A map's plays on a page of their own: every play for a side, by kind, filled with the comp you
 * choose (the pros' usual comp to start with, the best comp at your rank, or one you saved), with
 * the plays you drew among them.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { PageHead } from '../shell.tsx';
import { Button, Empty, Segmented, Select } from '../components/controls.tsx';
import { Icon } from '../icons.tsx';
import { go, useSettings, useView, watch } from '../state.ts';
import { answerFor } from '../solved.ts';
import { drawLink, useMyPlays } from '../myplays.ts';
import { planWith } from '../planner/store.ts';
import { TeamIcons } from '../planner/comp.tsx';
import { PlayCard, PlayRows } from '../planner/plays.tsx';
import { rankWord } from '../planner/words.ts';
import { agentById } from '../../core/kb/agents.ts';
import type { MapInfo, Side, SiteId } from '../../core/kb/maps.ts';
import { isRoundPlay, kindName, PLAYS, SIDE_KINDS, type PlayKind } from '../../core/kb/plays.ts';
import { PRO } from '../../core/kb/pro.ts';
import type { RankId } from '../../core/kb/ranks.ts';
import { playsFor, type FilledPlay } from '../../core/engine/plays.ts';
import { listJoin } from '../../core/text.ts';
import { manyOf } from '../../core/util.ts';

/** A group's heading: "Hits", "Retake setups", "Pistol rounds". */
const kindsName = (k: PlayKind) => manyOf(kindName(k));
const names = (team: readonly string[]) => listJoin(team.map((id) => agentById(id)?.name ?? id));

export function MapPlaysPage({ m, open }: { m: MapInfo; open: string }) {
  const s = useSettings();
  const rank = s.defaultRank as RankId;
  const [side, setSide] = useView<Side>('maps.side', 'attack', (v) => v === 'attack' || v === 'defense');
  const [site, setSite] = useState<SiteId | 'all'>('all');
  const mine = useMyPlays(m.id);
  // the comps to fill the plays with: the pros', the best at your rank, and your saved plans with a comp on this map
  const pro = PRO[m.id]?.comps ?? [];
  const best = answerFor({ map: m.id, side, rank, sites: [] }, s.includeNew)?.comps[0]?.team;
  const plans = watch('plans').plans().filter((p) => p.team.length === 5 && p.query.map === m.id);
  const comps: [string, string, readonly string[]][] = [
    ...pro.map((team, i): [string, string, readonly string[]] => [`pro${i}`, i === 0 ? 'The pros’ usual comp' : `Another pro comp (${names(team)})`, team]),
    ...(best ? [['best', `Best comp at ${rankWord(rank)} (${names(best)})`, best] as [string, string, readonly string[]]] : []),
    ...plans.map((p): [string, string, readonly string[]] => [`plan:${p.id}`, `Your plan “${p.name}”`, p.team]),
  ];
  const [comp, setComp] = useView<string>('maps.plays.comp', 'pro0', () => true);
  const team = (comps.find((c) => c[0] === comp) ?? comps[0])?.[2] ?? [];
  // a play asked for by its link opens on its side
  const [pick, setPick] = useState(open);
  useEffect(() => {
    if (!open) return;
    const p = [...PLAYS, ...mine].find((x) => x.id === open);
    if (p) { setSide(p.side); setSite('all'); setPick(open); }
  }, [open]);
  const sites = site === 'all' ? [] : [site];
  const all = useMemo(() => [...playsFor(team, m.id, side, sites, false, mine, rank), ...playsFor(team, m.id, side, [], true, mine, rank)], [team.join(), m.id, side, site, mine, rank]);
  const shown = site === 'all' ? all : all.filter((f) => !isRoundPlay(f.play.kind));
  const chosen = shown.find((f) => f.play.id === pick) ?? shown[0];
  const groups = SIDE_KINDS[side].map((k) => [k, shown.filter((f) => f.play.kind === k)] as const).filter(([, fs]) => fs.length > 0);
  const where = (f: FilledPlay['play']) => (f.site ? `${f.site} site` : 'Whole map');
  return (
    <>
      <PageHead
        eyebrow={<a href={`#/maps/${m.id}`} class="row"><Icon name="chevron-left" size={16} />{m.name}</a>}
        title={`Plays on ${m.name}`}
        actions={<>
          <Button icon="draw" onClick={() => go('maps', drawLink(m.id))}>Draw a play</Button>
          <Button kind="primary" icon="planner" onClick={() => planWith({ map: m.id, side })}>Plan for {m.name}</Button>
        </>}>
        Every play for {m.name}, filled with the comp you choose. Each job goes to the agent in it best at the job.
      </PageHead>
      <div class="row wrap plays-tools plays-page-tools" data-tour="map-plays-tools">
        <Segmented<Side> label="Side" value={side} onChange={(v) => { setSide(v); setPick(''); }} options={[['attack', 'Attack'], ['defense', 'Defense']]} />
        <Segmented<SiteId | 'all'> label="Site" value={site} onChange={(v) => { setSite(v); setPick(''); }} options={[['all', 'Every site'], ...m.sites.map((x) => [x.id, `${x.id} site`] as const)]} />
        <span class="row plays-comp">
          <Select label="Comp to fill the plays with" value={comps.some((c) => c[0] === comp) ? comp : comps[0]?.[0] ?? ''} onChange={setComp} options={comps.map(([id, text]) => [id, text] as const)} />
          {team.length > 0 && <TeamIcons team={team} size={28} />}
        </span>
      </div>
      {!shown.length ? (
        <Empty title={`No plays for ${site === 'all' ? 'this side' : `${site} site`} yet`} actions={<Button icon="draw" onClick={() => go('maps', drawLink(m.id))}>Draw a play</Button>}>Draw one on the map, and it’s kept with your plans.</Empty>
      ) : (
        <div class="plays-browse">
          <nav class="stack plays-index" aria-label={`Plays on ${m.name}`}>
            {groups.map(([k, fs]) => (
              <section key={k} class="stack">
                <h2 class="play-group" id={`kind-${k}`}>{kindsName(k)}</h2>
                <div class="play-list" role="listbox" aria-labelledby={`kind-${k}`}>
                  <PlayRows plays={fs} chosen={chosen} onPick={(i) => setPick(fs[i]!.play.id)} label={where} />
                </div>
              </section>
            ))}
            <p class="small muted">{mine.length ? `${mine.length === 1 ? 'One play is' : `${mine.length} plays are`} yours, kept with your plans.` : 'Plays you draw are listed here too.'}</p>
          </nav>
          {chosen && <PlayCard f={chosen} rank={rank} key={`${chosen.play.id}|${team.join()}`} />}
        </div>
      )}
    </>
  );
}
