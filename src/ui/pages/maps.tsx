/**
 * Maps: every map, and for each one its minimap with callouts, sites, what wins there, what pros
 * play, the best comps for each side and the plays they run.
 */
import { useState } from 'preact/hooks';
import { PageHead } from '../shell.tsx';
import { Badge, Button, Empty, Segmented, Toggle } from '../components/controls.tsx';
import { FeatureSwatch, featureKindsOn, Minimap, TEXT_SIZES, useMapView, type TextSize } from '../components/minimap.tsx';
import { featuresOf, layerOf, type MapLayer } from '../../core/kb/features.ts';
import { sideShare } from '../../core/kb/mapwins.ts';
import { Icon } from '../icons.tsx';
import { AgentIcon, MapThumb } from '../art.tsx';
import { go, useSettings, useView } from '../state.ts';
import { play } from '../sound.ts';
import { answerFor } from '../solved.ts';
import { planWith } from '../planner/store.ts';
import { CompRow, TeamIcons } from '../planner/comp.tsx';
import { MapPlaysPage } from './mapplays.tsx';
import { DrawPlayPage } from './drawplay.tsx';
import { drawLink, playsLink, useMyPlays } from '../myplays.ts';
import { rankWord } from '../planner/words.ts';
import { agentById, AGENTS_BY_NAME } from '../../core/kb/agents.ts';
import { mapById, MAPS, MECHANICS, SPACE_INFO, type MapInfo, type Side } from '../../core/kb/maps.ts';
import { RULES, ruleApplies, ruleHelps } from '../../core/kb/kitfit.ts';
import { PRO, REGIONAL } from '../../core/kb/pro.ts';
import { DIM_INFO, DIMS, type Dim } from '../../core/kb/roles.ts';
import { needsFor, proMixOf } from '../../core/engine/model.ts';
import type { RankId } from '../../core/kb/ranks.ts';
import { newQuery } from '../../core/engine/query.ts';
import { mapAgentTips, mapTipsFor } from '../../core/engine/tips.ts';
import { listJoin } from '../../core/text.ts';
import { kindName, playsOn, SIDE_KINDS } from '../../core/kb/plays.ts';
import { manyOf, plural } from '../../core/util.ts';
import { rotations, siteWants } from '../../core/engine/sites.ts';
import type { PageProps } from './index.ts';

function MapGrid() {
  const groups: [string, MapInfo[]][] = [['In the pool', MAPS.filter((m) => m.pool)], ['Out of the pool', MAPS.filter((m) => !m.pool)]];
  return (
    <div class="stack">
      {groups.map(([title, maps], i) => (
        <section key={title} class="stack" data-tour={i === 0 ? 'map-group' : undefined}>
          <h2>{title}</h2>
          <div class="map-grid map-cards">
            {maps.map((m) => (
              <button type="button" key={m.id} class="map-tile" onClick={() => { play('page'); go('maps', m.id); }}>
                <MapThumb id={m.id} />
                <span class="map-tile-text"><b>{m.name}</b><small>{m.about}</small></span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** The strengths a side of the map asks for more than most maps do. */
function extraNeeds(m: MapInfo, side: Side): Dim[] {
  const n = needsFor(m, side, []);
  return DIMS.filter((d) => n[d] >= 0.15).sort((a, b) => n[b] - n[a]).slice(0, 4);
}

function Pro({ m }: { m: MapInfo }) {
  const pro = PRO[m.id];
  if (!pro) return null;
  const picks = Object.entries(pro.picks).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return (
    <section class="panel stack">
      <h2>What pros play</h2>
      <ul class="pro-picks">
        {picks.map(([id, pct]) => (
          <li key={id} data-tip={`${agentById(id)?.name ?? id}: picked in ${pct}% of games`}>
            <AgentIcon id={id} size={36} label />
            <span class="num small">{pct}%</span>
          </li>
        ))}
      </ul>
      <h3>Typical comps</h3>
      <ul class="plain-list pro-comps">
        {pro.comps.map((c) => <li key={c.join()}><TeamIcons team={c} size={28} /></li>)}
      </ul>
      <p class="small muted">{pro.dated ? `${m.name} wasn’t in this year’s pro pool, so these are from ${pro.event ? `${pro.event}, the last top event that played it` : 'the year before'}.` : pro.regional ? `From this year’s top events, with ${REGIONAL.name} blended in, since the top events played ${m.name} on only ${plural(pro.games ?? 0, 'map')}.` : 'From this year’s top events.'}</p>
    </section>
  );
}

/** How open the map is, its mechanics, and the agents whose kits make the most of them. */
/** What a site asks of each side beyond the rest of the map: "Attack: flashes and utility to clear corners. Defense: …". */
function wantsLine(m: MapInfo, site: MapInfo['sites'][number]): string {
  const w = siteWants(m, site);
  const words = (ds: readonly Dim[]) => listJoin(ds.map((d) => DIM_INFO[d].has));
  if (w.attack.length && w.attack.join() === w.defense.join()) return `Both sides need ${words(w.attack)} here.`;
  return [w.attack.length ? `Attack here needs ${words(w.attack)}.` : '', w.defense.length ? `Defense needs ${words(w.defense)}.` : ''].filter(Boolean).join(' ');
}

function HowItPlays({ m }: { m: MapInfo }) {
  // agents a rule helps here, on either side, by name (so the list doesn't read as a ranking)
  const users = (keep: (r: (typeof RULES)[number]) => boolean) => {
    const ids = new Set(RULES.filter((r) => keep(r) && ruleHelps(r) && (['attack', 'defense'] as const).some((sd) => ruleApplies(r, m.id, sd, []))).map((r) => r.agent));
    return AGENTS_BY_NAME.filter((a) => ids.has(a.id)).map((a) => a.id);
  };
  const space = SPACE_INFO[m.space];
  const forSpace = users((r) => r.space === m.space);
  const who = (ids: string[]) => ids.length > 0 && (
    <small class="muted map-users">{ids.map((id, i) => (
      <>{i > 0 && (i === ids.length - 1 ? ' and ' : ', ')}<a key={id} href={`#/agents/${id}`}>{agentById(id)?.name}</a></>
    ))} {ids.length === 1 ? 'makes' : 'make'} the most of it.</small>
  );
  return (
    <section class="panel stack" data-tour="map-how">
      <h2>How it plays</h2>
      <dl class="facts">
        <dt>{space.name}</dt>
        <dd>{space.blurb}{who(forSpace)}</dd>
        {(m.mechanics ?? []).map((x) => {
          return [
            <dt key={x.id + 't'}>{MECHANICS[x.id].name}</dt>,
            <dd key={x.id + 'd'}>{x.about}{who(users((r) => r.mechanic === x.id))}</dd>,
          ];
        })}
      </dl>
    </section>
  );
}

/** Which side wins more of the rounds on a map in ranked: "Defense wins about 54% of them". */
function sideWords(m: MapInfo): string {
  const def = Math.round(sideShare(m.id, 'defense')! * 100);
  if (def === 50) return 'About even between the sides';
  return def > 50 ? `Defense wins about ${def}% of them` : `Attack wins about ${100 - def}% of them`;
}

function BestComps({ m, side, rank, newAgents }: { m: MapInfo; side: Side; rank: RankId; newAgents: boolean }) {
  const [open, setOpen] = useState(-1);
  const ans = answerFor({ map: m.id, side, rank, sites: [] }, newAgents);
  if (!ans) return <p class="row muted"><span class="spinner" aria-hidden="true" />Finding the best comps…</p>;
  const q = { ...newQuery(rank, newAgents), map: m.id, side };
  return (
    <ol class="comps">
      {ans.comps.slice(0, 5).map((c, i) => <CompRow key={c.team.join()} c={c} i={i} ans={ans} q={q} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />)}
    </ol>
  );
}

/** How many plays the map has for a side, by kind, and the way to its plays page. */
function Plays({ m, side }: { m: MapInfo; side: Side }) {
  const mine = useMyPlays(m.id).filter((p) => p.side === side);
  const plays = [...playsOn(m.id, side), ...mine];
  const kinds = SIDE_KINDS[side].map((k) => [k, plays.filter((p) => p.kind === k).length] as const).filter(([, n]) => n > 0);
  const team = PRO[m.id]?.comps[0];
  return (
    <section class="panel stack map-plays" data-tour="map-plays">
      <div class="row-between wrap">
        <h2>Plays</h2>
        <span class="row">
          <Button kind="quiet" icon="draw" onClick={() => go('maps', drawLink(m.id))}>Draw a play</Button>
          <Button kind="primary" icon="play" onClick={() => go('maps', playsLink(m.id))}>See the plays</Button>
        </span>
      </div>
      <p>{plural(plays.length, 'play')} for {side === 'attack' ? 'attack' : 'defense'} on {m.name}{mine.length ? `, ${mine.length === 1 ? 'one' : mine.length} of them yours` : ''}: {listJoin(kinds.map(([k, n]) => `${n} ${(n === 1 ? kindName(k) : manyOf(kindName(k))).toLowerCase()}`))}.</p>
      {team && <p class="row wrap small muted">Each runs like a replay, filled with the pros’ usual comp<TeamIcons team={team} size={24} />or any other you choose.</p>}
    </section>
  );
}

/** How the minimap shows: callouts and their dots, the names' size, and the layers this map has, with a legend. */
function MapViewControls({ m, names, setNames }: { m: MapInfo; names: boolean; setNames: (v: boolean) => void }) {
  const view = useMapView();
  const has = (layer: MapLayer) => featureKindsOn(m.id, [layer]).length > 0;
  const marked = featuresOf(m.id).filter((f) => view.layers.includes(layerOf(f.kind)));
  const legend = featureKindsOn(m.id, view.layers);
  return (
    <div class="stack map-view" data-tour="map-view">
      <div class="row wrap map-view-toggles">
        <Toggle checked={names} onChange={setNames} label="Show callouts" />
        <Toggle checked={view.dots} onChange={view.setDots} disabled={!names} label="Dots on callouts" />
        {has('orbs') && <Toggle checked={view.orbs} onChange={view.setOrbs} label="Ultimate orbs" />}
        {has('features') && <Toggle checked={view.features} onChange={view.setFeatures} label="Doors, walls and more" />}
        {has('plants') && <Toggle checked={view.plants} onChange={view.setPlants} label="Plant spots" />}
      </div>
      <div class="row wrap">
        <span class="small muted">Callout names</span>
        <Segmented<TextSize> label="Callout name size" value={view.text} onChange={view.setText} options={TEXT_SIZES.map(([id, name]) => [id, <><span class={`size-${id}`} aria-hidden="true">A</span><span class="visually-hidden">{name}</span></>] as const)} />
      </div>
      {legend.length > 0 && (
        <ul class="plain-list row wrap map-legend" aria-label="What the marks mean">
          {legend.map((k) => <li key={k.kind} class="row"><FeatureSwatch kind={k.kind} /><span class="small">{k.name}</span></li>)}
        </ul>
      )}
      {marked.length > 0 && (
        <details class="map-marks">
          <summary class="small">What’s marked on {m.name}</summary>
          <ul class="plain-list stack map-marks-list">
            {marked.map((f) => <li key={f.about} class="row small"><FeatureSwatch kind={f.kind} /><span>{f.about}.</span></li>)}
          </ul>
        </details>
      )}
      {view.orbs && !has('orbs') && <p class="small muted">Ultimate orbs aren’t marked on {m.name} yet.</p>}
      <p class="small muted">Scroll or use the buttons to zoom, and drag to move around. Point at a mark to see what it is.</p>
    </div>
  );
}

function MapPage({ m }: { m: MapInfo }) {
  const s = useSettings();
  const [side, setSide] = useView<Side>('maps.side', 'attack', (v) => v === 'attack' || v === 'defense');
  const [names, setNames] = useView<string>('maps.names', 'yes', (v) => v === 'yes' || v === 'no');
  const rank = s.defaultRank as RankId;
  const view = useMapView();
  const tips = mapTipsFor(m.id, side, rank);
  const agentTips = mapAgentTips(m.id).filter((t) => !t.side || t.side === side);
  return (
    <>
      <PageHead
        eyebrow={<a href="#/maps" class="row"><Icon name="chevron-left" size={16} />Maps</a>}
        title={m.name}
        actions={<Button kind="primary" icon="planner" onClick={() => planWith({ map: m.id })}>Plan for {m.name}</Button>}>
        <span class="row wrap">{m.pool ? <Badge tone="good">In the pool</Badge> : <Badge>Out of the pool</Badge>}<span class="muted">{m.about}</span></span>
      </PageHead>
      <div class="map-detail">
        <div class="stack">
          <div class="map-big" data-tour="map-minimap">
            <Minimap map={m.id} zoomable labels={names === 'yes' ? 'all' : 'none'} layers={view.layers} label={`Minimap of ${m.name}${names === 'yes' ? ' with callouts' : ''}`} />
          </div>
          <MapViewControls m={m} names={names === 'yes'} setNames={(v) => setNames(v ? 'yes' : 'no')} />
        </div>
        <div class="stack">
          <section class="panel stack" data-tour="map-wins">
            <h2>What wins here</h2>
            <p>{m.keys}</p>
            <dl class="facts">
              {(['attack', 'defense'] as const).map((sd) => {
                const extra = extraNeeds(m, sd);
                return [<dt key={sd + 't'}>{sd === 'attack' ? 'Attack' : 'Defense'} needs</dt>, <dd key={sd + 'd'}>{extra.length ? listJoin(extra.map((d) => DIM_INFO[d].name.toLowerCase())) : 'The usual mix'}</dd>];
              })}
              <dt>Controllers</dt><dd>{Math.round(proMixOf(m.id)?.controller ?? 1) >= 2 ? 'Pros usually run two' : 'Pros usually run one'}</dd>
              {sideShare(m.id, 'defense') !== undefined && <><dt>Ranked rounds</dt><dd>{sideWords(m)}</dd></>}
            </dl>
          </section>
          <section class="panel stack">
            <h2>Sites</h2>
            <ul class="plain-list sites">
              {m.sites.map((site) => (
                <li key={site.id}>
                  <span class="site-id">{site.id}</span>
                  <div class="grow stack site-text"><p>{site.about}</p>{wantsLine(m, site) && <p class="small muted">{wantsLine(m, site)}</p>}</div>
                  <Button size="sm" kind="quiet" onClick={() => planWith({ map: m.id, sites: [site.id] })} label={`Plan for ${site.id} site`}>Plan</Button>
                </li>
              ))}
            </ul>
            {rotations(m).length > 0 && (
              <p class="small muted map-rotations">
                Running the shortest way with a rifle out, {listJoin(rotations(m).map((r) => `${r.from} to ${r.to} takes about ${r.seconds} seconds`))}.
              </p>
            )}
          </section>
          <HowItPlays m={m} />
          <Pro m={m} />
        </div>
      </div>

      <div class="row-between wrap map-side" data-tour="map-best">
        <h2>Best comps at {rankWord(rank)}</h2>
        <Segmented<Side> label="Side" value={side} onChange={setSide} options={[['attack', 'Attack'], ['defense', 'Defense']]} />
      </div>
      {tips.length > 0 && (
        <ul class="tips map-tips" aria-label={`Tips for ${side === 'attack' ? 'attack' : 'defense'}`}>{tips.map((t) => <li key={t}><span>{t}</span></li>)}</ul>
      )}
      <BestComps m={m} side={side} rank={rank} newAgents={s.includeNew} />
      {agentTips.length > 0 && (
        <section class="stack map-agent-tips">
          <h3>Agents on {side === 'attack' ? 'attack' : 'defense'}</h3>
          <ul class="tips">
            {agentTips.map((t) => <li key={t.agent}><b><a href={`#/agents/${t.agent}`}>{agentById(t.agent)?.name}</a></b><span>{t.text}</span></li>)}
          </ul>
        </section>
      )}
      <Plays m={m} side={side} />
    </>
  );
}

export function MapsPage({ arg }: PageProps) {
  if (arg) {
    // a map, its plays (and one of them), or drawing a play on it (or changing one)
    const [id = '', sub = '', play = ''] = arg.split('/');
    const m = mapById(id);
    if (m && !sub) return <MapPage m={m} />;
    if (m && sub === 'plays') return <MapPlaysPage m={m} open={play} />;
    if (m && sub === 'draw') return <DrawPlayPage m={m} id={play} />;
    return (
      <>
        <PageHead title="Maps" />
        <Empty level={2} title="There’s no such map" actions={<Button onClick={() => go('maps')}>See all maps</Button>}>The link may be from a newer version of Playbook.</Empty>
      </>
    );
  }
  return (
    <>
      <PageHead title="Maps">Callouts, sites, what wins on each map, and the plays to run there.</PageHead>
      <MapGrid />
    </>
  );
}
