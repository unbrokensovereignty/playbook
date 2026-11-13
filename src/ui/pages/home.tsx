/**
 * Home: a map to plan for, the questions you asked lately, your saved plans, the agents you play and your parties, a word
 * about agents that are new or on their way, and (until it's taken or put off) the offer of a tour.
 * Until you've set it up, the offer to (setup.tsx).
 */
import { PageHead } from '../shell.tsx';
import { Button } from '../components/controls.tsx';
import { Icon } from '../icons.tsx';
import { AgentIcon, MapThumb } from '../art.tsx';
import { data, go, minute, safely, toast, watch } from '../state.ts';
import { play } from '../sound.ts';
import { openPlanner, planWith } from '../planner/store.ts';
import { askedLine, askedTitle, partyWord, rankWord } from '../planner/words.ts';
import { Fit, TeamIcons } from '../planner/comp.tsx';
import { pickAgents } from '../components/pickers.tsx';
import { answerFor } from '../solved.ts';
import { TourOffer } from '../tours/engine.tsx';
import { SetupOffer } from '../setup.tsx';
import { AGENTS, agentById, isNew } from '../../core/kb/agents.ts';
import type { RankId } from '../../core/kb/ranks.ts';
import { SETTINGS } from '../../core/settings.ts';
import { unsureWords } from '../../core/engine/sure.ts';
import { tierOf } from '../../core/engine/weights.ts';
import { PATCH, POOL, POOL_SINCE } from '../../core/kb/maps.ts';
import { comfortOf, poolsOf, type Party } from '../../core/saved.ts';
import type { PartySize } from '../../core/engine/query.ts';
import { diffDays, fmtLongDay, keyOf } from '../../core/dates.ts';
import { listJoin } from '../../core/text.ts';
import { plural } from '../../core/util.ts';
import type { PageProps } from './index.ts';

function greeting(hour: number): string {
  return hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

/** Agents released lately or about to be, with when. */
function NewAgents() {
  const today = keyOf(new Date());
  const fresh = AGENTS.filter((a) => isNew(a, today));
  if (!fresh.length) return null;
  return (
    <div class="home-new">
      {fresh.map((a) => {
        const ahead = diffDays(a.released, today) < 0;
        return (
          <section key={a.id} class="panel home-new-agent">
            <AgentIcon id={a.id} size={52} />
            <div class="grow">
              <h2>{ahead ? `${a.name} arrives on ${fmtLongDay(a.released)}` : `${a.name} is new`}</h2>
              <p class="muted">{a.line} {a.estimate ? 'The numbers are early estimates from the kit that was shown, so treat the fits as a first guess.' : ''}</p>
            </div>
            <div class="row">
              <Button kind="soft" icon="planner" onClick={() => planWith({ include: [a.id], newAgents: true })}>Plan with {a.name}</Button>
              <Button kind="quiet" iconRight="arrow-right" onClick={() => go('agents', a.id)}>About {a.name}</Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Maps() {
  return (
    <section class="panel home-maps" data-tour="home-maps">
      <div class="row-between wrap">
        <h2>Plan for a map</h2>
        <span class="muted small">The pool since {fmtLongDay(POOL_SINCE)}, patch {PATCH}</span>
      </div>
      <div class="map-grid">
        {POOL.map((m) => (
          <button type="button" key={m.id} class="map-tile" onClick={() => { play('tap'); planWith({ map: m.id }); }}>
            <MapThumb id={m.id} />
            <span class="map-tile-text"><b>{m.name}</b><small>{plural(m.sites.length, 'site')}: {listJoin(m.sites.map((s) => s.id))}</small></span>
          </button>
        ))}
        <button type="button" class="map-tile" onClick={() => { play('tap'); planWith({ map: 'best' }); }}>
          <span class="map-thumb open"><Icon name="trophy" size={26} /></span>
          <span class="map-tile-text"><b>Find your best map</b><small>Every map ranked for your choices</small></span>
        </button>
      </div>
    </section>
  );
}

function Recent() {
  const r = watch('meta');
  const recent = r.app().recent.slice(0, 6);
  const clear = () => safely(() => { r.clearRecent(); toast('Cleared your recent questions.', { undo: true }); });
  return (
    <section class="panel stack home-list">
      <div class="row-between">
        <h2>Recent questions</h2>
        {recent.length > 0 && <Button size="sm" kind="quiet" onClick={clear}>Clear</Button>}
      </div>
      {recent.length ? (
        <ul class="plain-list">
          {recent.map((q) => (
            <li key={JSON.stringify(q)}>
              <button type="button" class="list-row" onClick={() => { play('tap'); openPlanner(q); }}>
                {q.map === 'any' || q.map === 'best' ? <span class="map-thumb open small"><Icon name={q.map === 'best' ? 'trophy' : 'grid'} size={18} /></span> : <MapThumb id={q.map} class="small" />}
                <span class="list-row-text"><b>{askedTitle(q)}</b><small class="muted">{askedLine(q)}</small></span>
                <Icon name="chevron-right" size={18} class="faint" />
              </button>
            </li>
          ))}
        </ul>
      ) : <p class="muted">The questions you ask on the Planner show up here, so you can ask them again in one click.</p>}
    </section>
  );
}

function SavedPlans() {
  const r = watch('plans');
  const plans = r.plans();
  return (
    <section class="panel stack home-list">
      <div class="row-between">
        <h2>Saved plans</h2>
        {plans.length > 0 && <Button size="sm" kind="quiet" iconRight="arrow-right" onClick={() => go('saved')}>All {plans.length}</Button>}
      </div>
      {plans.length ? (
        <ul class="plain-list">
          {plans.slice(0, 5).map((p) => (
            <li key={p.id}>
              <button type="button" class="list-row" onClick={() => { play('tap'); go('saved', p.id); }}>
                {p.team.length ? <TeamIcons team={p.team} size={26} /> : <MapThumb id={p.query.map} class="small" />}
                <span class="list-row-text"><b>{p.starred && <Icon name="star" size={14} class="star-on" />}{p.name}</b><small class="muted">{askedTitle(p.query)} · {askedLine(p.query)}</small></span>
                <Icon name="chevron-right" size={18} class="faint" />
              </button>
            </li>
          ))}
        </ul>
      ) : <p class="muted">Open a comp on the Planner and press <b>Save plan</b> to keep it here, with its plays and tips.</p>}
    </section>
  );
}

function PartyCard({ p }: { p: Party }) {
  const size = p.players.length as PartySize;
  return (
    <li class="party-card">
      <div class="grow">
        <b>{p.name}</b>
        <small class="muted"> {partyWord(size).toLowerCase()}: {listJoin(p.players.map((x) => x.name))}</small>
        <div class="party-pools">
          {p.players.map((x, i) => (
            <span key={i} class="party-pool" data-tip={`${x.name}: ${x.agents.length ? plural(x.agents.length, 'agent') : 'any agent'}`}>
              {x.agents.length ? x.agents.slice(0, 4).map((id) => <AgentIcon key={id} id={id} size={22} />) : <span class="muted small">Any</span>}
              {x.agents.length > 4 && <span class="muted small num">+{x.agents.length - 4}</span>}
            </span>
          ))}
        </div>
      </div>
      <Button size="sm" kind="soft" icon="planner" onClick={() => planWith({ party: size, pools: poolsOf(p), comfort: comfortOf(p) })}>Plan</Button>
    </li>
  );
}

/** The agents you play (Settings → You), each with their fit at your rank and the maps they fit best. */
function YourAgents() {
  const r = watch('meta');
  const s = r.settings();
  const rank = s.defaultRank as RankId;
  const mine = s.myAgents.map((id) => agentById(id)).filter((a) => !!a);
  const { myAgents } = SETTINGS;
  const choose = async () => {
    const next = await pickAgents(s.myAgents, { title: myAgents.label, max: myAgents.max, line: myAgents.help });
    if (next) safely(() => r.setSetting('myAgents', next));
  };
  const answerOn = (id: string, map: string) => answerFor({ map, side: 'both', rank, sites: [] }, s.includeNew)?.agents.find((x) => x.id === id);
  const fitOn = (id: string, map: string) => answerOn(id, map)?.fit;
  return (
    <section class="panel stack home-list" data-tour="home-yours">
      <div class="row-between">
        <h2>Your agents at {rankWord(rank)}</h2>
        <Button size="sm" kind="quiet" icon={mine.length ? 'edit' : 'plus'} onClick={() => void choose()}>{mine.length ? 'Change' : 'Choose'}</Button>
      </div>
      {mine.length ? (
        <ul class="plain-list">
          {mine.map((a) => {
            const fit = fitOn(a.id, 'any'), unsure = answerOn(a.id, 'any')?.unsure;
            const maps = POOL.map((m) => ({ m, fit: fitOn(a.id, m.id) }));
            const best = maps.every((x) => x.fit !== undefined) ? [...maps].sort((x, y) => y.fit! - x.fit!).slice(0, 2).map((x) => x.m.name) : [];
            return (
              <li key={a.id}>
                <button type="button" class="list-row" data-tip={unsure && unsureWords({ map: 'any', side: 'both', rank, sites: [] }, a.id, unsure)} onClick={() => { play('page'); go('agents', a.id); }}>
                  <AgentIcon id={a.id} size={32} />
                  <span class="list-row-text"><b>{a.name}</b><small class="muted">{best.length ? `Best on ${listJoin(best)}` : 'Working out their best maps…'}</small></span>
                  {fit !== undefined ? <Fit fit={fit} tier={tierOf(fit)} label={`${a.name} at ${rankWord(rank)}`} compact unsure={!!unsure} /> : <span class="faint small">…</span>}
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p class="muted">Choose the agents you play, and every plan gives you one of them. Rankings marks them too.</p>}
    </section>
  );
}

function Parties() {
  const r = watch('parties');
  const parties = r.parties();
  return (
    <section class="panel stack home-list">
      <div class="row-between">
        <h2>Your parties</h2>
        <Button size="sm" kind="quiet" icon={parties.length ? 'edit' : 'plus'} onClick={() => go('saved', 'parties')}>{parties.length ? 'Edit' : 'Make a party'}</Button>
      </div>
      {parties.length
        ? <ul class="plain-list party-cards">{parties.map((p) => <PartyCard key={p.id} p={p} />)}</ul>
        : <p class="muted">Save the people you queue with and the agents each of you plays. Plans for the party then give each player one of their own agents.</p>}
    </section>
  );
}

export function HomePage(_p: PageProps) {
  void minute.value;
  const draft = data().app().draft;
  return (
    <>
      <PageHead title={greeting(new Date().getHours())} actions={<Button kind="primary" icon="planner" onClick={() => go('planner')}>{draft ? 'Back to the Planner' : 'Open the Planner'}</Button>}>
        Where are you playing next? Pick a map, or ask the Planner anything.
      </PageHead>
      <div class="home">
        <SetupOffer />
        <TourOffer />
        <NewAgents />
        <Maps />
        <div class="grid-2" data-tour="home-lists">
          <Recent />
          <SavedPlans />
        </div>
        <div class="grid-2">
          <YourAgents />
          <Parties />
        </div>
      </div>
    </>
  );
}
