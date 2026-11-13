/**
 * Agent select: for the seconds before you lock in. Choose the map, add each agent as your
 * teammates lock in (type a few letters and press Enter, or click a face), and it says which agent
 * to lock in now, why, and what the team still needs. The answer is the Planner's own for a solo
 * player (core/engine/select.ts). After the game, log how it went in two clicks.
 */
import { signal } from '@preact/signals';
import { useMemo, useRef, useState } from 'preact/hooks';
import { PageHead } from '../shell.tsx';
import { AgentIcon, RoleIcon } from '../art.tsx';
import { Button, IconButton, Select } from '../components/controls.tsx';
import { Icon } from '../icons.tsx';
import { Fit } from '../planner/comp.tsx';
import { openPlanner, question } from '../planner/store.ts';
import { data, go, safely, toast, useSettings } from '../state.ts';
import { play } from '../sound.ts';
import { AGENTS_BY_NAME, agentById } from '../../core/kb/agents.ts';
import { MAPS, POOL, mapById } from '../../core/kb/maps.ts';
import { RANKS, type RankId } from '../../core/kb/ranks.ts';
import { DIM_INFO, ROLES, roleOf, type Role } from '../../core/kb/roles.ts';
import { freeAgents, pickNow, selectQuery, TEAM, type SelectAsk } from '../../core/engine/select.ts';
import { youOf } from '../../core/settings.ts';
import { GAME_RESULTS, type GameResult } from '../../core/saved.ts';
import { fold, listJoin } from '../../core/text.ts';
import { articleOf, countWord } from '../../core/util.ts';
import type { PageProps } from './index.ts';

/** What's on the page, kept while you look at other pages during the same agent select. */
const map = signal<string | null>(null);
const locked = signal<string[]>([]);
/** The rank for this page, when you change it here (null: your rank from Settings → You). */
const rankHere = signal<RankId | null>(null);

const nameOf = (id: string) => agentById(id)?.name ?? id;
const roleWord = (r: Role) => roleOf(r).name.toLowerCase();

/** Agents whose names start with what's typed (ignoring case and accents), then those whose names contain it. */
function matches(text: string, free: readonly string[]): string[] {
  const t = fold(text.trim());
  if (!t) return [];
  const all = AGENTS_BY_NAME.filter((a) => free.includes(a.id));
  return [...all.filter((a) => fold(a.name).startsWith(t)), ...all.filter((a) => !fold(a.name).startsWith(t) && fold(a.name).includes(t))].map((a) => a.id);
}

function lock(id: string) {
  if (locked.value.includes(id) || locked.value.length >= TEAM - 1) return;
  play('tick');
  locked.value = [...locked.value, id];
}
function unlock(id: string) {
  play('tick');
  locked.value = locked.value.filter((x) => x !== id);
}

/** The teammates' slots, the box to type into, and every agent's face to click. */
function Team({ newAgents }: { newAgents: boolean }) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const free = freeAgents(locked.value, newAgents).map((a) => a.id);
  const full = locked.value.length >= TEAM - 1;
  const found = full ? [] : matches(text, free);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && found[0]) { e.preventDefault(); lock(found[0]); setText(''); }
    else if (e.key === 'Escape' && text) { e.preventDefault(); e.stopPropagation(); setText(''); }
    else if (e.key === 'Backspace' && !text && locked.value.length) { e.preventDefault(); unlock(locked.value.at(-1)!); }
  };
  return (
    <section class="panel stack select-team" data-tour="select-team">
      <h2>Locked in by your team</h2>
      <ol class="plain-list select-slots" aria-label="Your teammates’ agents">
        {Array.from({ length: TEAM - 1 }, (_, i) => {
          const id = locked.value[i];
          return id ? (
            <li key={id} class="select-slot">
              <AgentIcon id={id} size={44} />
              <span class="grow">{nameOf(id)}</span>
              <IconButton icon="x" size="sm" label={`Remove ${nameOf(id)}`} onClick={() => unlock(id)} />
            </li>
          ) : <li key={`empty-${i}`} class="select-slot empty"><span class="muted small">{i === locked.value.length ? 'Next teammate' : 'Teammate'}</span></li>;
        })}
      </ol>
      <div class="stack" style={{ gap: '6px' }}>
        <label class="small" for="select-type">Type an agent and press Enter</label>
        <input id="select-type" ref={input} class="input" value={text} autoFocus autoComplete="off" spellcheck={false}
          placeholder={full ? 'Your team is in' : 'Omen, Jett, Sova…'} aria-describedby="select-type-hint"
          onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)} onKeyDown={onKey} />
        <p id="select-type-hint" class="small muted" aria-live="polite">
          {full ? 'All four teammates are in. Backspace takes the last one back out.'
            : text.trim() ? (found.length ? `Enter adds ${nameOf(found[0]!)}${found.length > 1 ? `; also ${listJoin(found.slice(1, 4).map(nameOf))}` : ''}.` : 'No free agent by that name.')
            : 'Backspace takes the last one back out.'}
        </p>
      </div>
      <div class="select-grid" role="group" aria-label="Click an agent your teammate locked in">
        {ROLES.map((r) => (
          <div key={r.id} class="select-role">
            <span class="select-role-name small muted"><RoleIcon role={r.id} size={14} />{r.plural}</span>
            <div class="row wrap select-faces">
              {AGENTS_BY_NAME.filter((a) => a.role === r.id && (newAgents || !a.estimate)).map((a) => {
                const on = locked.value.includes(a.id);
                return (
                  <button key={a.id} type="button" class={`select-face${on ? ' on' : ''}`} aria-pressed={on} disabled={!on && full} data-tip={a.name}
                    onClick={() => { if (on) unlock(a.id); else lock(a.id); input.current?.focus(); }}>
                    <AgentIcon id={a.id} size={34} label />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The agent to lock in, why, and what the team still needs; then logging the game. */
function Pick({ ask, mine }: { ask: SelectAsk; mine: readonly string[] }) {
  const a = useMemo(() => pickNow(ask), [ask.map, ask.rank, ask.locked.join(), ask.mine.join(), JSON.stringify(ask.comfort), ask.newAgents]);
  const [played, setPlayed] = useState<string | null>(null);
  if (!a.pick) return <section class="panel"><p>Every agent is taken.</p></section>;
  const pick = a.pick, name = nameOf(pick.id);
  const you = played && !locked.value.includes(played) ? played : pick.id;
  const brings = a.brings.length ? `${name} brings ${listJoin(a.brings.map((d) => DIM_INFO[d].has))}, what this team needs most here.` : `${name} fits this team best here.`;
  const rest = a.toPick
    ? a.askFor ? `Ask ${a.toPick === 1 ? 'the last player' : `the other ${countWord(a.toPick)}`} for ${articleOf(roleWord(a.askFor))} ${roleWord(a.askFor)}.` : ''
    : a.lacks.length ? `The team still has no ${listJoin(a.lacks.map(roleWord), 'or')}: play around it together.` : 'That makes a team with every role.';
  const log = (result: GameResult) => safely(() => {
    data().addGame({ map: ask.map, agent: you, team: [you, ...locked.value], result, note: '' });
    locked.value = [];
    setPlayed(null);
    play('saved');
    toast(`Logged a ${result} on ${mapById(ask.map)?.name} as ${nameOf(you)}.`, { undo: true, action: { label: 'See your games', run: () => go('saved', 'games') } });
  });
  return (
    <div class="stack">
      <section class="panel stack select-pick" data-tour="select-pick" aria-live="polite">
        <span class="eyebrow">Lock in</span>
        <div class="row select-pick-head">
          <AgentIcon id={pick.id} size={72} />
          <div class="grow stack" style={{ gap: '4px' }}>
            <h2 class="select-pick-name">{name}</h2>
            <span class="muted small">{roleOf(agentById(pick.id)!.role).name}</span>
          </div>
          <Fit fit={pick.fit} tier={pick.tier} label={`${name}’s fit among the picks`} />
        </div>
        <p>{brings}</p>
        {rest && <p>{rest}</p>}
        {!a.fromMine && mine.length > 0 && <p class="muted small">None of your agents is free, so this is from every agent.</p>}
        {a.anyone && <p class="muted small">If you could play any agent, the pick would be {nameOf(a.anyone.id)}.</p>}
        {a.others.length > 0 && (
          <div class="stack" style={{ gap: '6px' }}>
            <span class="small muted">Also good</span>
            <ul class="plain-list select-others">
              {a.others.map((o) => (
                <li key={o.id} class="row"><AgentIcon id={o.id} size={30} /><span class="grow">{nameOf(o.id)}</span><Fit compact fit={o.fit} tier={o.tier} label={`${nameOf(o.id)}’s fit among the picks`} /></li>
              ))}
            </ul>
          </div>
        )}
        <div class="row wrap">
          <Button kind="soft" icon="planner" onClick={() => openPlanner(selectQuery(ask, a.fromMine))}>Open in the Planner</Button>
          <Button kind="quiet" icon="refresh" disabled={!locked.value.length} onClick={() => { play('tick'); locked.value = []; setPlayed(null); }}>New game</Button>
        </div>
      </section>
      <section class="panel stack" data-tour="select-log">
        <h2>After the game</h2>
        <p class="small muted">Log how it went to see your record by agent and map under Saved → Your games.</p>
        <div class="row wrap">
          <label class="small" for="select-played">You played</label>
          <select id="select-played" class="select" value={you} onChange={(e) => { play('tick'); setPlayed((e.currentTarget as HTMLSelectElement).value); }}>
            {AGENTS_BY_NAME.filter((x) => !locked.value.includes(x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <div class="row wrap" role="group" aria-label="How the game ended">
          {GAME_RESULTS.map((r) => <Button key={r.id} kind={r.id === 'win' ? 'primary' : 'soft'} onClick={() => log(r.id)}>{r.name}</Button>)}
        </div>
      </section>
    </div>
  );
}

export function SelectPage(_: PageProps) {
  const s = useSettings();
  const you = youOf(s);
  const rank = rankHere.value ?? you.rank;
  const asked = question.value?.map;
  const where = map.value ?? (asked && mapById(asked) ? asked : POOL[0]!.id);
  const ask: SelectAsk = { map: where, rank, locked: locked.value, mine: you.agents, comfort: you.comfort, newAgents: s.includeNew };
  const maps = [...POOL, ...MAPS.filter((m) => !POOL.includes(m))];
  return (
    <>
      <PageHead title="Agent select" actions={
        <div class="row wrap select-where" data-tour="select-where">
          <Select<string> label="Map" value={where} options={maps.map((m) => [m.id, POOL.includes(m) ? m.name : `${m.name} (out of the pool)`] as const)} onChange={(v) => { map.value = v; }} />
          <Select<RankId> label="Rank" value={rank} options={RANKS.map((r) => [r.id, r.name] as const)} onChange={(v) => { rankHere.value = v === you.rank ? null : v; }} />
        </div>
      }>
        Add each agent as your teammates lock in, and see which one to lock in now.{you.agents.length ? ` Picks come from your agents (${listJoin(you.agents.map(nameOf))}).` : ''}
      </PageHead>
      <div class="grid-2 select-page">
        <Team newAgents={s.includeNew} />
        <Pick ask={ask} mine={you.agents} />
      </div>
      {!you.agents.length && <p class="small muted row"><Icon name="info" size={15} /><span>Say which agents you play in <a href="#/settings/you">Settings → You</a> to pick from those.</span></p>}
    </>
  );
}
