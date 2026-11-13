/** How well someone plays each of their agents: learning, comfortable or a main, one row per agent. */
import { COMFORTS, type Comfort } from '../../core/engine/query.ts';
import { agentById } from '../../core/kb/agents.ts';
import { AgentIcon } from '../art.tsx';
import { Segmented } from './controls.tsx';

/** How well you play each of the agents you play: learning, comfortable or a main. */
export function ComfortSetting({ agents, value, onSave, who = 'you play' }: { agents: readonly string[]; value: Readonly<Record<string, Comfort>>; onSave: (v: Record<string, Comfort>) => void; who?: string }) {
  const set = (id: string, c: Comfort | 'ok') => {
    const next: Record<string, Comfort> = Object.fromEntries(agents.filter((a) => value[a] && a !== id).map((a) => [a, value[a]!]));
    if (c !== 'ok') next[id] = c;
    onSave(next);
  };
  return (
    <ul class="plain-list stack comfort-list">
      {agents.map((id) => {
        const name = agentById(id)?.name ?? id;
        return (
          <li key={id} class="row comfort-row">
            <AgentIcon id={id} size={28} />
            <span class="comfort-name">{name}</span>
            <Segmented label={`How well ${who} ${name}`} value={value[id] ?? 'ok'} options={COMFORTS.map((c) => [c.id, c.name] as const)} onChange={(c) => set(id, c)} />
          </li>
        );
      })}
    </ul>
  );
}
