/**
 * Saved: your saved plans (each opens to its comp's pros and cons, plays and tips, with a note
 * of your own), your parties (the people you queue with and the agents each of them plays), the
 * plays you drew, and the games you logged with your record by agent and map.
 */
import { useState } from 'preact/hooks';
import { PageHead } from '../shell.tsx';
import { Badge, Button, CancelButton, Empty, Field, IconButton, Segmented, Tabs, TextInput } from '../components/controls.tsx';
import { confirm, DialogLayout, prompt, UNDO_NOTE } from '../components/overlays.tsx';
import { AgentChips } from '../components/pickers.tsx';
import { Icon } from '../icons.tsx';
import { AgentIcon } from '../art.tsx';
import { data, go, openDialog, safely, toast, useSettings, watch } from '../state.ts';
import { copyWithToast } from '../files.ts';
import { play } from '../sound.ts';
import { openPlanner, planWith } from '../planner/store.ts';
import { CompDetail, Fit, TeamIcons } from '../planner/comp.tsx';
import { askedLine, askedTitle, partyWord } from '../planner/words.ts';
import { agentById } from '../../core/kb/agents.ts';
import type { RankId } from '../../core/kb/ranks.ts';
import { ComfortSetting } from '../components/comfort.tsx';
import { comfortOf, GAME_RESULTS, LIMITS, parsePlayCode, PLAY_CODE_PREFIX, playCode, poolsOf, type Game, type MyPlay, type Party, type Player, type SavedPlan } from '../../core/saved.ts';
import { mapById, POOL } from '../../core/kb/maps.ts';
import { kindName } from '../../core/kb/plays.ts';
import { MapThumb } from '../art.tsx';
import { drawLink, playsLink } from '../myplays.ts';
import type { Situation } from '../../core/engine/model.ts';
import { teamFit, type CompAnswer, type SituationAnswer } from '../../core/engine/plan.ts';
import { myComfort, type PartySize } from '../../core/engine/query.ts';
import { fmtDay, keyOf } from '../../core/dates.ts';
import { listJoin } from '../../core/text.ts';
import { plural } from '../../core/util.ts';
import { comfortOffers, recordBy, recordWords, type ComfortOffer, type GameRecord } from '../../core/games.ts';
import type { PageProps } from './index.ts';

type Tab = 'plans' | 'parties' | 'plays' | 'games';

/** The one situation a saved plan is about (a plan saved from "the best map" keeps the map it picked). */
function situationOf(p: SavedPlan): Situation {
  const q = p.query;
  const rank = q.rank === 'best' ? data().settings().defaultRank as RankId : q.rank;
  return { map: q.map === 'best' ? 'any' : q.map, side: q.side === 'best' ? 'both' : q.side, rank, sites: q.sites, enemy: q.enemy };
}

// ---------------------------------------------------------------- plans

function PlanDetail({ p }: { p: SavedPlan }) {
  const [note, setNote] = useState(p.note);
  const s = situationOf(p);
  const r = data();
  const rename = async () => {
    const name = await prompt({ title: 'Rename this plan', label: 'Name', yes: 'Rename', value: p.name, maxLength: LIMITS.name });
    if (name && name !== p.name) safely(() => r.updatePlan(p.id, { name }));
  };
  const remove = () => safely(() => {
    r.deletePlans([p.id]);
    go('saved');
    toast(`Deleted “${p.name}”.`, { undo: true });
  });
  const comp = (): { c: CompAnswer; ans: SituationAnswer } => {
    const { fit, tier } = teamFit(s, p.team, p.query.newAgents || p.team.some((id) => agentById(id)?.estimate), p.query.comfort);
    const c: CompAnswer = { team: p.team, party: [], fit, tier, score: 0 };
    return { c, ans: { situation: s, comfort: p.query.comfort, ref: { best: 0, mid: 0 }, comps: [c], agents: [], count: 1 } };
  };
  const filled = p.team.length === 5 ? comp() : null;
  return (
    <article class="panel stack plan-detail" aria-label={p.name}>
      <div class="row-between plan-head">
        <div class="grow">
          <h2>{p.name}</h2>
          <p class="muted small">{askedTitle(s)} · {askedLine(p.query)} · saved {fmtDay(keyOf(new Date(p.created)), keyOf(new Date()))}</p>
        </div>
        <div class="row">
          <IconButton icon="star" label="Star" pressed={p.starred} class="star-toggle" onClick={() => safely(() => r.updatePlan(p.id, { starred: !p.starred }))} />
          <IconButton icon="edit" label="Rename" onClick={() => void rename()} />
          <IconButton icon="trash" label="Delete" onClick={remove} />
        </div>
      </div>
      {filled && (
        <div class="row wrap plan-team">
          <TeamIcons team={p.team} size={40} />
          <Fit fit={filled.c.fit} tier={filled.c.tier} label="Fit" />
        </div>
      )}
      <div class="row wrap">
        <Button kind="soft" icon="planner" onClick={() => openPlanner(p.query)}>Open in the Planner</Button>
      </div>
      <Field label="Note" for={`note-${p.id}`} help="Who plays what, the lineups you use, anything to remember.">
        <textarea id={`note-${p.id}`} class="input" value={note} maxLength={LIMITS.note} rows={3}
          onInput={(e) => { const v = (e.target as HTMLTextAreaElement).value; setNote(v); safely(() => r.updatePlan(p.id, { note: v })); }} />
      </Field>
      {filled && <CompDetail c={filled.c} i={0} ans={filled.ans} q={p.query} saveable={false} plan={{ name: p.name, note }} />}
    </article>
  );
}

function Plans({ open }: { open: string }) {
  const r = watch('plans');
  const plans = r.plans();
  const chosen = plans.find((p) => p.id === open);
  if (!plans.length) {
    return (
      <Empty level={2} title="No saved plans yet" actions={<Button kind="primary" icon="planner" onClick={() => go('planner')}>Open the Planner</Button>}>
        Open a comp on the Planner and press Save plan to keep it here, with its plays, tips and a note of your own.
      </Empty>
    );
  }
  return (
    <div class="saved-layout">
      <ul class="plain-list saved-list" aria-label="Saved plans">
        {plans.map((p) => (
          <li key={p.id}>
            <button type="button" class={`list-row${p.id === open ? ' current' : ''}`} aria-current={p.id === open ? 'true' : undefined} onClick={() => { play('tick'); go('saved', p.id); }}>
              <span class="list-row-text">
                <b>{p.starred && <Icon name="star" size={14} class="star-on" />}{p.name}</b>
                <small class="muted">{askedTitle(situationOf(p))} · {askedLine(p.query)}</small>
                {p.team.length > 0 && <TeamIcons team={p.team} size={22} />}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {chosen ? <PlanDetail key={chosen.id} p={chosen} /> : <p class="muted saved-pick">Pick a plan to see its comp, plays and tips.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- parties

const sizeOf = (n: number): PartySize => (n === 2 ? 2 : n === 3 ? 3 : 5);

function PartyEditor({ initial, close }: { initial: Party | null; close: (v?: unknown) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  // a new party starts with you, playing the agents you play (Settings → You)
  const mine = data().settings();
  const [players, setPlayers] = useState<Player[]>(initial?.players.map((x) => ({ ...x, agents: [...x.agents] })) ?? [{ name: 'Me', agents: [...mine.myAgents], comfort: myComfort(mine.myAgents, mine.myComfort) }, { name: 'Player 2', agents: [] }]);
  const resize = (n: PartySize) => setPlayers((ps) => Array.from({ length: n }, (_, i) => ps[i] ?? { name: `Player ${i + 1}`, agents: [] }));
  const set = (i: number, patch: Partial<Player>) => setPlayers((ps) => ps.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const save = () => {
    const out = safely(() => data().saveParty({ id: initial?.id, name: name.trim() || 'My party', players }));
    if (out === null) { toast(`You can keep up to ${LIMITS.parties} parties. Delete one first.`, { tone: 'bad' }); return; }
    if (out) { play('saved'); toast(initial ? `Saved “${out.name}”.` : `Made the party “${out.name}”.`, { tone: 'good', undo: true }); close(out); }
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      <DialogLayout title={initial ? 'Edit the party' : 'Make a party'} icon="users" close={() => close()} foot={<>
        <CancelButton onClick={() => close()} />
        <Button kind="primary" type="submit" sound={false}>{initial ? 'Save' : 'Make the party'}</Button>
      </>}>
        <div class="stack party-editor">
          <Field label="Name" for="party-name">
            <TextInput id="party-name" value={name} onInput={setName} placeholder="Friday squad" maxLength={LIMITS.name} autoFocus />
          </Field>
          <Field label="How many of you">
            <Segmented<string> label="Party size" value={String(players.length)} onChange={(v) => resize(Number(v) as PartySize)} options={[['2', 'Duo'], ['3', 'Trio'], ['5', 'Five-stack']]} />
          </Field>
          <div class="stack">
            {players.map((x, i) => (
              <div key={i} class="party-player">
                <TextInput value={x.name} onInput={(v) => set(i, { name: v })} label={`Player ${i + 1}’s name`} maxLength={LIMITS.name} />
                <AgentChips ids={x.agents} empty="Choose agents" onChange={(agents) => set(i, { agents })}
                  o={{ title: `Agents ${x.name || `player ${i + 1}`} plays`, max: LIMITS.pool, line: 'Plans for the party only give each player one of their agents. Leave it empty for anyone.' }} />
                {x.agents.length > 0 && <ComfortSetting agents={x.agents} value={x.comfort ?? {}} who={`${x.name || `player ${i + 1}`} plays`} onSave={(comfort) => set(i, { comfort })} />}
              </div>
            ))}
          </div>
          <p class="small muted">A player with no agents chosen can play anyone. The Planner leans toward each player’s mains and away from agents they’re still learning.</p>
        </div>
      </DialogLayout>
    </form>
  );
}

export const editParty = (p: Party | null) => openDialog<Party>(p ? 'Edit the party' : 'Make a party', (close) => <PartyEditor initial={p} close={close} />, { wide: true });

function Parties() {
  const r = watch('parties');
  const parties = r.parties();
  const remove = async (p: Party) => {
    const yes = await confirm({ title: `Delete “${p.name}”?`, yes: 'Delete', danger: true, body: <p>Saved plans made for this party keep their agents. {UNDO_NOTE}</p> });
    if (yes) safely(() => { r.deleteParty(p.id); toast(`Deleted “${p.name}”.`, { undo: true }); });
  };
  return (
    <div class="stack">
      <div><Button kind="primary" icon="plus" tour="party-make" onClick={() => void editParty(null)}>Make a party</Button></div>
      {parties.length ? (
        <ul class="plain-list party-list">
          {parties.map((p) => (
            <li key={p.id} class="panel party-row">
              <div class="grow stack" style={{ gap: '8px' }}>
                <div><b>{p.name}</b> <span class="muted small">{partyWord(sizeOf(p.players.length))}</span></div>
                <ul class="plain-list party-players">
                  {p.players.map((x, i) => (
                    <li key={i}>
                      <span class="party-player-name">{x.name}</span>
                      {x.agents.length
                        ? <span class="row wrap" style={{ gap: '4px' }} aria-label={listJoin(x.agents.map((id) => agentById(id)?.name ?? id))}>{x.agents.map((id) => <AgentIcon key={id} id={id} size={26} />)}</span>
                        : <span class="muted small">Any agent</span>}
                    </li>
                  ))}
                </ul>
              </div>
              <div class="row party-actions">
                <Button size="sm" kind="soft" icon="planner" onClick={() => planWith({ party: sizeOf(p.players.length), pools: poolsOf(p), comfort: comfortOf(p) })}>Plan</Button>
                {p.players.length === 5 && <Button size="sm" kind="quiet" icon="trophy" onClick={() => planWith({ party: 5, pools: poolsOf(p), comfort: comfortOf(p), map: 'best', side: 'both', sites: [] })}>Maps to play and ban</Button>}
                <IconButton icon="edit" label={`Edit ${p.name}`} onClick={() => void editParty(p)} />
                <IconButton icon="trash" label={`Delete ${p.name}`} onClick={() => void remove(p)} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p class="muted">Save the people you queue with, and the agents each of you plays. Plans for the party then give each player one of their own agents.</p>
      )}
      <p class="small muted">{plural(parties.length, 'party', 'parties')} of {LIMITS.parties} at most.</p>
    </div>
  );
}

// ---------------------------------------------------------------- your plays

/** What a play you drew is: "Abyss, attack, A site hit". */
const playWhat = (p: MyPlay) => `${mapById(p.map)?.name ?? p.map}, ${p.side}, ${p.site ? `${p.site} site ` : ''}${kindName(p.kind).toLowerCase()}`;

function MyPlays() {
  const r = watch('meta');
  const plays = r.myPlays();
  const remove = (p: MyPlay) => safely(() => { r.deletePlay(p.id); toast(`Deleted “${p.name}”.`, { undo: true }); });
  const copy = (p: MyPlay) => { const code = playCode(p); void copyWithToast(code, 'Play code copied. Anyone with Playbook can add it under Your plays.', `Copying didn’t work here. The play code is ${code}`); };
  const add = async () => {
    const code = await prompt({ title: 'Add a shared play', label: 'Play code', yes: 'Add play', placeholder: `${PLAY_CODE_PREFIX}…`, maxLength: 8000, check: (v) => (parsePlayCode(v) ? '' : `That isn’t a play code. It starts with ${PLAY_CODE_PREFIX}`) });
    const p = code ? parsePlayCode(code) : null;
    if (!p) return;
    safely(() => {
      const saved = r.savePlay(p);
      if (!saved) toast(`You have ${LIMITS.plays} plays, the most there can be. Delete one to add this.`);
      else toast(`Added “${saved.name}” on ${mapById(saved.map)?.name ?? saved.map}.`);
    });
  };
  const addButton = <Button icon="import" onClick={() => void add()}>Add from code</Button>;
  if (!plays.length) {
    return (
      <Empty level={2} title="No plays of your own yet" actions={<><Button kind="primary" icon="draw" onClick={() => go('maps', drawLink(POOL[0]!.id))}>Draw a play</Button>{addButton}</>}>
        Draw a play on any map’s minimap, with each player’s job, their route and what they do. It’s filled with any comp like the built-in plays, and kept here and in backups.
      </Empty>
    );
  }
  return (
    <div class="stack">
      <ul class="plain-list item-list" aria-label="Plays you drew">
        {plays.map((p) => (
          <li key={p.id} class="panel item-row my-play-row">
            <span class="my-play-thumb"><MapThumb id={p.map} /></span>
            <div class="grow stack" style={{ gap: '6px' }}>
              <p><b>{p.name}</b></p>
              <p class="muted small">{playWhat(p)} · {plural(p.steps.length, 'step')} · changed {fmtDay(keyOf(new Date(p.updated)), keyOf(new Date()))}</p>
              {p.about && <p class="small">{p.about}</p>}
            </div>
            <div class="row item-actions">
              <Button size="sm" kind="soft" icon="play" onClick={() => go('maps', playsLink(p.map, p.id))}>Open</Button>
              <IconButton icon="export" label={`Copy a code to share ${p.name}`} onClick={() => copy(p)} />
              <IconButton icon="edit" label={`Change ${p.name}`} onClick={() => go('maps', drawLink(p.map, p.id))} />
              <IconButton icon="trash" label={`Delete ${p.name}`} onClick={() => remove(p)} />
            </div>
          </li>
        ))}
      </ul>
      <div class="row-between wrap">
        <p class="small muted">{plural(plays.length, 'play')} of {LIMITS.plays} at most. Draw more from any map’s plays, or share one with its code.</p>
        {addButton}
      </div>
    </div>
  );
}

/** Your record on each agent or map, most played first. */
function RecordList({ title, rows, face }: { title: string; rows: readonly GameRecord[]; face: (key: string) => preact.ComponentChildren }) {
  return (
    <section class="panel stack">
      <h2>{title}</h2>
      <ul class="plain-list record-list">
        {rows.map((r) => (
          <li key={r.key} class="row">
            {face(r.key)}
            <span class="grow">{plural(r.games, 'game')}</span>
            <span class="muted small num">{recordWords(r)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function offerWords(o: ComfortOffer): string {
  const name = agentById(o.agent)?.name ?? o.agent;
  const won = `You’ve won ${o.record.wins} of ${plural(o.record.wins + o.record.losses, 'game')} as ${name}${o.record.draws ? ', not counting draws' : ''}.`;
  return o.to === 'main' ? `${won} ${o.add ? `Add ${name} to your agents as one of your mains?` : `Mark ${name} as one of your mains?`}` : `${won} Mark ${name} as one you’re still learning?`;
}

function Games() {
  const r = watch('meta');
  const s = useSettings();
  const games = r.games();
  const offers = comfortOffers(games, s.myAgents, s.myComfort);
  const remove = (g: Game) => safely(() => { r.deleteGame(g.id); toast('Deleted the game.', { undo: true }); });
  const accept = (o: ComfortOffer) => safely(() => {
    const name = agentById(o.agent)?.name ?? o.agent;
    r.setSettings({ myAgents: o.add ? [...s.myAgents, o.agent] : s.myAgents, myComfort: { ...s.myComfort, [o.agent]: o.to } }, `Mark ${name} as ${o.to === 'main' ? 'a main' : 'still learning'}`);
    play('saved');
    toast(`${name} is ${o.to === 'main' ? 'one of your mains' : 'one you’re still learning'} now. Change it in Settings → You.`, { undo: true });
  });
  if (!games.length) {
    return (
      <Empty level={2} title="No games logged yet" actions={<Button kind="primary" icon="crosshair" onClick={() => go('select')}>Open Agent select</Button>}>
        After a game, log how it went on the Agent select page in two clicks. Your record by agent and map shows here, and once you’ve played an agent enough, Playbook offers to mark them as one of your mains or one you’re still learning.
      </Empty>
    );
  }
  const today = keyOf(new Date());
  return (
    <div class="stack">
      {offers.map((o) => (
        <div key={o.agent} class="panel row wrap game-offer">
          <AgentIcon id={o.agent} size={36} />
          <p class="grow">{offerWords(o)}</p>
          <Button size="sm" kind="primary" onClick={() => accept(o)}>{o.to === 'main' ? 'Mark as a main' : 'Mark as still learning'}</Button>
        </div>
      ))}
      <div class="grid-2">
        <RecordList title="By agent" rows={recordBy(games, (g) => g.agent)} face={(id) => <><AgentIcon id={id} size={30} /><span class="record-name">{agentById(id)?.name ?? id}</span></>} />
        <RecordList title="By map" rows={recordBy(games, (g) => g.map)} face={(id) => <><MapThumb id={id} class="tiny" /><span class="record-name">{mapById(id)?.name ?? id}</span></>} />
      </div>
      <section class="panel stack">
        <div class="row wrap">
          <h2 class="grow">Every game</h2>
          <Button size="sm" kind="soft" icon="crosshair" onClick={() => go('select')}>Log a game</Button>
        </div>
        <ul class="plain-list game-list" aria-label="Your games">
          {games.map((g) => (
            <li key={g.id} class="row game-row">
              <Badge tone={g.result === 'win' ? 'good' : g.result === 'loss' ? 'bad' : undefined}>{GAME_RESULTS.find((x) => x.id === g.result)!.name}</Badge>
              <span class="game-what">{mapById(g.map)?.name} as {agentById(g.agent)?.name}</span>
              <span class="grow"><TeamIcons team={g.team} size={24} /></span>
              <span class="muted small">{fmtDay(keyOf(new Date(g.played)), today)}</span>
              <IconButton icon="trash" size="sm" label={`Delete the game on ${mapById(g.map)?.name} as ${agentById(g.agent)?.name}`} onClick={() => remove(g)} />
            </li>
          ))}
        </ul>
        <p class="small muted">{plural(games.length, 'game')}. The newest {LIMITS.games} are kept.</p>
      </section>
    </div>
  );
}

export function SavedPage({ arg }: PageProps) {
  const tab: Tab = arg === 'parties' || arg === 'plays' || arg === 'games' ? arg : 'plans';
  return (
    <>
      <PageHead title="Saved">Your saved plans, the parties you play with, the plays you drew and the games you logged.</PageHead>
      <Tabs<Tab> label="Saved" tour="saved-tabs" value={tab} onChange={(t) => go('saved', t === 'plans' ? '' : t)} tabs={[['plans', 'Plans'], ['parties', 'Parties'], ['plays', 'Your plays'], ['games', 'Your games']]} />
      <div class="tab-body" key={tab}>
        {tab === 'plans' ? <Plans open={arg} /> : tab === 'parties' ? <Parties /> : tab === 'plays' ? <MyPlays /> : <Games />}
      </div>
    </>
  );
}
