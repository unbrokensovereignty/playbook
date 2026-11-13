/**
 * The Planner's question: map and sites, side, rank, party, the agents you must or won't play, the
 * other team's agents and role counts. Every change asks again straight away; any field can be left open or asked for.
 */
import type { ComponentChildren } from 'preact';
import { MAPS, mapById } from '../../core/kb/maps.ts';
import { RANKS } from '../../core/kb/ranks.ts';
import { ROLES, type Role } from '../../core/kb/roles.ts';
import { NEW_AGENTS } from '../../core/kb/new-agents.ts';
import { myComfort, myPools, PARTY_SIZES, placesTaken, withMine, type PartySize, type Query } from '../../core/engine/query.ts';
import { agentById } from '../../core/kb/agents.ts';
import { comfortOf, poolsOf } from '../../core/saved.ts';
import { listJoin } from '../../core/text.ts';
import { countWord } from '../../core/util.ts';
import { MapThumb, RoleIcon } from '../art.tsx';
import { Button, Segmented, Select, Toggle } from '../components/controls.tsx';
import { openMenu, type MenuItem } from '../components/overlays.tsx';
import { AgentChips, pickMap } from '../components/pickers.tsx';
import { Icon } from '../icons.tsx';
import { go, toast, useSettings, watch } from '../state.ts';
import { ask, freshQuestion } from './store.ts';
import { mapWord } from './words.ts';

const COUNTS = ['0', '1', '2', '3'] as const;

/** One part of the question; a `wide` one takes the whole width when the question is in two columns. */
function Part({ title, help, tour, wide, children }: { title: string; help?: ComponentChildren; tour?: string; wide?: boolean; children: ComponentChildren }) {
  return (
    <div class={`q-part${wide ? ' q-wide' : ''}`} data-tour={tour}>
      <div class="q-label">{title}</div>
      {children}
      {help && <div class="q-help">{help}</div>}
    </div>
  );
}

/** Names of the agents each choice already uses, so a picker can say why one is unavailable. */
function taken(q: Query, except: 'include' | 'exclude' | 'locked'): Record<string, string> {
  const out: Record<string, string> = {};
  if (except !== 'include') for (const id of q.include) out[id] = 'Already a must-play';
  if (except !== 'exclude') for (const id of q.exclude) out[id] = 'Already left out';
  if (except !== 'locked') for (const id of q.locked) out[id] = 'A teammate has this agent';
  return out;
}

export function Question({ q }: { q: Query }) {
  const r = watch('parties');
  const s = useSettings();
  const map = mapById(q.map);
  const parties = r.parties();
  const partyOn = q.pools.length ? parties.find((p) => JSON.stringify(poolsOf(p)) === JSON.stringify(q.pools)) : undefined;
  const chooseMap = async () => {
    const id = await pickMap(q.map);
    if (id && id !== q.map) ask({ map: id, sites: [] }, true);
  };
  const partyMenu = (e: MouseEvent) => {
    const items: MenuItem[] = parties.map((p) => ({
      label: `${p.name} (${p.players.length === 2 ? 'duo' : p.players.length === 3 ? 'trio' : 'five-stack'})`, icon: 'users',
      run: () => ask({ party: p.players.length as PartySize, pools: poolsOf(p), comfort: comfortOf(p), locked: [] }, true),
    }));
    if (items.length) items.push('divider');
    items.push({ label: parties.length ? 'Edit parties' : 'Make a party', icon: 'edit', run: () => go('saved', 'parties') });
    openMenu(e, items);
  };
  const maxCount = Math.min(3, q.party);
  const rolePick = (role: Role) => {
    const v = q.roles[role];
    return (
      <div class="q-role" key={role}>
        <span class="q-role-name"><RoleIcon role={role} size={16} />{ROLES.find((x) => x.id === role)!.plural}</span>
        <Segmented<string> label={`${ROLES.find((x) => x.id === role)!.plural}: how many`} class="small-seg" value={v === undefined ? 'any' : String(v)}
          options={[['any', 'Any'], ...COUNTS.slice(0, maxCount + 1).map((c) => [c, c] as const)]}
          onChange={(x) => {
            const roles = { ...q.roles };
            if (x === 'any') delete roles[role]; else roles[role] = Number(x);
            // counts that no longer fit beside the must-play agents give way to the one just set
            for (const other of ROLES) if (placesTaken(q.include, roles) > q.party && other.id !== role) delete roles[other.id];
            if (placesTaken(q.include, roles) > q.party) {
              toast(`${x} ${ROLES.find((r) => r.id === role)!.plural.toLowerCase()} won’t fit beside the agents who must play.`);
              return;
            }
            ask({ roles }, true);
          }} />
      </div>
    );
  };
  const fresh = freshQuestion();
  const changed = JSON.stringify(q) !== JSON.stringify(fresh);
  // planning with the agents you play (Settings → You): one of them for you
  const mine = s.myAgents;
  const withMe = withMine(q, mine);
  return (
    <section class="question panel" aria-label="Your situation">
      <div class="row-between q-head">
        <h2>Your situation</h2>
        <Button kind="quiet" size="sm" icon="refresh" disabled={!changed} onClick={() => ask({ ...fresh }, true)}>Start over</Button>
      </div>

      <Part title="Map" tour="q-map">
        <button type="button" class="map-choice" onClick={() => void chooseMap()} aria-label={`Map: ${mapWord(q.map)}. Change`}>
          {map ? <MapThumb id={map.id} /> : <span class="map-thumb open"><Icon name={q.map === 'best' ? 'trophy' : 'grid'} size={22} /></span>}
          <span class="map-choice-text"><b>{mapWord(q.map)}</b><small>{map ? (map.pool ? 'In the pool' : 'Out of the pool') : q.map === 'best' ? 'Every map ranked for you' : 'Across the map pool'}</small></span>
          <Icon name="chevron-down" size={16} />
        </button>
      </Part>

      {map && (
        <Part title="Sites" help={q.sites.length ? `Planning for ${listJoin(q.sites)} only.` : 'All sites. Pick one or more to plan for them alone.'}>
          <div class="row wrap">
            {map.sites.map((site) => {
              const on = q.sites.includes(site.id);
              return (
                <button type="button" key={site.id} class="chip" aria-pressed={on} data-tip={site.about}
                  onClick={() => ask({ sites: on ? q.sites.filter((x) => x !== site.id) : [...q.sites, site.id].sort() }, true)}>{site.id} site</button>
              );
            })}
          </div>
        </Part>
      )}

      <Part title="Side" tour="q-side">
        <Segmented label="Side" value={q.side} onChange={(side) => ask({ side }, true)}
          options={[['attack', 'Attack'], ['defense', 'Defense'], ['both', 'Both'], ['best', 'Best']]} />
      </Part>

      <Part title="Rank" tour="q-rank">
        <Select label="Rank" value={q.rank} onChange={(rank) => ask({ rank: rank as Query['rank'] }, true)}
          options={[...RANKS.map((x) => [x.id, x.name] as const), ['best', 'Find the best rank']]} />
      </Part>

      <Part title="Party" tour="q-party">
        <div class="row wrap">
          <Segmented label="Party size" value={String(q.party)} onChange={(x) => ask({ party: Number(x) as PartySize, pools: withMe ? myPools(Number(x) as PartySize, mine) : [], comfort: withMe ? myComfort(mine, s.myComfort) : {} }, true)}
            options={PARTY_SIZES.map((p) => [String(p.id), p.name] as const)} />
          <Button size="sm" kind="quiet" icon="users" iconRight="chevron-down" onClick={partyMenu}>Saved party</Button>
        </div>
        {/* what the size means, above the switch for your agents, so it reads with the size */}
        <div class="q-help">{q.party === 5 ? 'All five of you pick together.' : `The other ${countWord(5 - q.party)} are random teammates, and the plan counts on what they usually pick.`}</div>
        {mine.length > 0 && (
          <Toggle checked={withMe} onChange={(on) => ask({ pools: on ? myPools(q.party, mine) : [], comfort: on ? myComfort(mine, s.myComfort) : {} }, true)}
            label={<>{q.party === 1 ? 'Play' : 'You play'} one of your agents <span class="muted">({listJoin(mine.map((id) => agentById(id)?.name ?? id), 'or')})</span></>} />
        )}
        {q.pools.length > 0 && !withMe && (
          <div class="q-party-on">
            <Icon name="users" size={16} />
            <span class="grow">Only agents {partyOn ? <b>{partyOn.name}</b> : 'your party'} {partyOn ? 'plays' : 'play'}</span>
            <Button kind="quiet" size="sm" onClick={() => ask({ pools: [], comfort: {} }, true)}>Clear</Button>
          </div>
        )}
      </Part>

      <Part title={q.party === 5 ? 'Must play' : q.party === 1 ? 'You play' : 'Your party plays'} tour="q-include">
        <AgentChips ids={q.include} empty={q.party === 1 ? 'Choose an agent' : 'Choose agents'} onChange={(include) => ask({ include }, true)}
          o={{ title: q.party === 5 ? 'Agents the team must play' : q.party === 1 ? 'The agent you’ll play' : 'Agents your party will play', max: q.party, taken: taken(q, 'include'), line: q.party === 5 ? 'The comps will all have these agents.' : q.party === 1 ? 'Leave it open and the Planner picks the best agent for you.' : 'Leave room and the Planner picks the rest of your party.' }} />
      </Part>

      {q.party < 5 && (
        <Part title="Teammates locked in" help="Agents your random teammates have already picked.">
          <AgentChips ids={q.locked} empty="Add their agents" onChange={(locked) => ask({ locked }, true)}
            o={{ title: 'Agents your teammates locked in', max: 5 - q.party, taken: taken(q, 'locked') }} />
        </Part>
      )}

      <Part title="Won’t play">
        <AgentChips ids={q.exclude} empty="Leave agents out" onChange={(exclude) => ask({ exclude }, true)}
          o={{ title: 'Agents to leave out', max: 25, taken: taken(q, 'exclude') }} />
      </Part>

      <Part title="Their team" tour="q-enemy" help={q.enemy.length ? 'Comps that answer them rank higher, and each comp says how it stands against them.' : 'Know who you’re playing against? Add their agents.'}>
        <AgentChips ids={q.enemy} empty="Add their agents" onChange={(enemy) => ask({ enemy }, true)}
          o={{ title: 'Agents the other team plays', max: 5, line: 'Both teams can play the same agent, so these don’t limit your picks.' }} />
      </Part>

      <Part title={q.party === 5 ? 'Roles in the team' : q.party === 1 ? 'Your role' : 'Roles in your party'} tour="q-roles" wide help={q.party === 1 ? 'Set the role you want to play.' : 'Set how many of a role you want, like two controllers.'}>
        <div class="q-roles"><div class="q-roles-grid">{ROLES.map((x) => rolePick(x.id))}</div></div>
      </Part>

      {(NEW_AGENTS.length > 0 || !map) && (
        <Part title="Options">
          <div class="stack q-options">
            {NEW_AGENTS.length > 0 && <Toggle checked={q.newAgents} onChange={(newAgents) => ask({ newAgents }, true)} label={`Include ${listJoin(NEW_AGENTS.map((a) => a.name))} (early estimates)`} />}
            {!map && <Toggle checked={q.allMaps} onChange={(allMaps) => ask({ allMaps }, true)} label={`All ${MAPS.length} maps, including those outside the pool`} />}
          </div>
        </Part>
      )}
    </section>
  );
}
