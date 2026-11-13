/**
 * Choosing maps and agents: a dialog of map banners, a dialog of agent portraits by role, and the
 * row of chosen agents the Planner shows (each removable, with a button to add more).
 */
import { useMemo, useState } from 'preact/hooks';
import { AGENTS_BY_NAME, agentById } from '../../core/kb/agents.ts';
import { MAPS } from '../../core/kb/maps.ts';
import { ROLES } from '../../core/kb/roles.ts';
import { fold } from '../../core/text.ts';
import { AgentIcon, MapThumb, RoleIcon } from '../art.tsx';
import { Icon } from '../icons.tsx';
import { openDialog } from '../state.ts';
import { play } from '../sound.ts';
import { Button, CancelButton, SearchInput } from './controls.tsx';
import { DialogLayout } from './overlays.tsx';

// ---------------------------------------------------------------- maps

/** Asks for a map: one of the 13, or (when offered) any map or the best map. */
export function pickMap(current: string, o: { title?: string; open?: boolean } = {}): Promise<string | undefined> {
  return openDialog<string>('Choose a map', (close) => (
    <DialogLayout title={o.title ?? 'Choose a map'} icon="map" close={() => close()}>
      <div class="map-grid" role="listbox" aria-label="Maps">
        {o.open !== false && <>
          <MapTile id="any" name="Any map" line="Plans that work across the pool" current={current} pick={close} />
          <MapTile id="best" name="Find the best map" line="Ranks every map for your choices" current={current} pick={close} />
        </>}
        {[...MAPS].sort((a, b) => Number(b.pool) - Number(a.pool) || a.name.localeCompare(b.name)).map((m) => (
          <MapTile key={m.id} id={m.id} name={m.name} line={m.pool ? 'In the pool' : 'Out of the pool'} current={current} pick={close} />
        ))}
      </div>
    </DialogLayout>
  ), { wide: true });
}

function MapTile({ id, name, line, current, pick }: { id: string; name: string; line: string; current: string; pick: (v: string) => void }) {
  const open = id === 'any' || id === 'best';
  return (
    <button type="button" role="option" aria-selected={id === current} class={`map-tile${id === current ? ' current' : ''}`} onClick={() => { play('tick'); pick(id); }}>
      {open ? <span class="map-thumb open"><Icon name={id === 'best' ? 'trophy' : 'grid'} size={26} /></span> : <MapThumb id={id} />}
      <span class="map-tile-text"><b>{name}</b><small>{line}</small></span>
      {id === current && <Icon name="check" size={18} class="map-tile-check" />}
    </button>
  );
}

// ---------------------------------------------------------------- agents

export interface AgentPickOptions {
  title: string;
  /** What the choice is for, under the title. */
  line?: string;
  /** At most this many. */
  max?: number;
  /** Agents that can't be picked here, with why ("Must play"). */
  taken?: Record<string, string>;
}

/** Asks for a set of agents, starting from `chosen`. Resolves to the new set, or undefined if cancelled. */
export function pickAgents(chosen: readonly string[], o: AgentPickOptions): Promise<string[] | undefined> {
  return openDialog<string[]>(o.title, (close) => <AgentPicker chosen={chosen} o={o} close={close} />, { wide: true });
}

function AgentPicker({ chosen, o, close }: { chosen: readonly string[]; o: AgentPickOptions; close: (v?: string[]) => void }) {
  const [picked, setPicked] = useState<string[]>([...chosen]);
  const [search, setSearch] = useState('');
  const max = o.max ?? 30;
  const shown = useMemo(() => {
    const f = fold(search);
    return f ? AGENTS_BY_NAME.filter((a) => fold(a.name).includes(f) || a.role.includes(f)) : AGENTS_BY_NAME;
  }, [search]);
  const toggle = (id: string) => {
    play('tick');
    if (picked.includes(id)) setPicked(picked.filter((x) => x !== id));
    else if (max === 1) setPicked([id]);
    else if (picked.length < max) setPicked([...picked, id]);
  };
  const full = max > 1 && picked.length >= max;
  return (
    <DialogLayout title={o.title} icon="agents" close={() => close()} foot={<>
      <span class="muted small mr-auto">{picked.length ? `${picked.length} chosen${max < 30 ? ` of up to ${max}` : ''}` : 'None chosen'}</span>
      {picked.length > 0 && <Button kind="quiet" onClick={() => setPicked([])}>Clear</Button>}
      <CancelButton onClick={() => close()} />
      <Button kind="primary" onClick={() => close(picked)}>Done</Button>
    </>}>
      {o.line && <p>{o.line}</p>}
      <SearchInput value={search} onInput={setSearch} placeholder="Find an agent" />
      {ROLES.map((r) => {
        const list = shown.filter((a) => a.role === r.id);
        if (!list.length) return null;
        return (
          <section key={r.id} class="agent-group" aria-label={r.plural}>
            <h3 class="row"><RoleIcon role={r.id} size={16} />{r.plural}</h3>
            <div class="agent-grid">
              {list.map((a) => {
                const why = o.taken?.[a.id];
                const on = picked.includes(a.id);
                return (
                  <button type="button" key={a.id} class="agent-pick" aria-pressed={on} disabled={!!why || (full && !on)} onClick={() => toggle(a.id)} data-tip={why}>
                    <AgentIcon id={a.id} size={48} />
                    <span>{a.name}</span>
                    {on && <Icon name="check" size={14} class="agent-pick-check" />}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      {!shown.length && <p class="muted">No agent has that name.</p>}
    </DialogLayout>
  );
}

/** Chosen agents as removable chips, with a button that opens the picker. */
export function AgentChips({ ids, onChange, o, empty }: { ids: readonly string[]; onChange: (ids: string[]) => void; o: AgentPickOptions; empty: string }) {
  const add = async () => {
    const next = await pickAgents(ids, o);
    if (next) onChange(next);
  };
  return (
    <div class="agent-chips">
      {ids.map((id) => {
        const a = agentById(id);
        return (
          <span key={id} class="agent-chip">
            <AgentIcon id={id} size={24} />
            <span>{a?.name ?? id}</span>
            <button type="button" aria-label={`Remove ${a?.name ?? id}`} data-tip="Remove" onClick={() => { play('tick'); onChange(ids.filter((x) => x !== id)); }}>
              <Icon name="x" size={14} />
            </button>
          </span>
        );
      })}
      <button type="button" class="chip add-chip" onClick={() => void add()} aria-label={`${o.title}: ${ids.length ? 'change' : 'choose'}`}>
        <Icon name={ids.length ? 'edit' : 'plus'} size={15} />{ids.length ? 'Change' : empty}
      </button>
    </div>
  );
}
