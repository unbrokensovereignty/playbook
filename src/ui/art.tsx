/**
 * The game's art: agent portraits, ability and role icons, map banners and minimaps. Each falls
 * back to plain text or the app's own drawing when an image is missing (a new agent, say), so
 * nothing else needs to know whether there's art.
 */
import agentArt from 'assets:agents';
import abilityArt from 'assets:abilities';
import roleArt from 'assets:roles';
import bannerArt from 'assets:banners';
import minimapArt from 'assets:minimaps';
import { agentById, isNew } from '../core/kb/agents.ts';
import { keyOf } from '../core/dates.ts';
import { abilityOn } from '../core/kb/kits.ts';
import { mapById } from '../core/kb/maps.ts';
import { roleOf, type Role } from '../core/kb/roles.ts';

const SLOT: Record<string, string> = { C: 'grenade', Q: 'ability1', E: 'ability2', X: 'ultimate' };

/** An agent's portrait in a rounded square, or their initial when there's no portrait. */
export function AgentIcon({ id, size = 40, label }: { id: string; size?: number; label?: boolean }) {
  const a = agentById(id);
  const src = agentArt[id];
  const name = a?.name ?? id;
  return (
    <span class={`agent-icon role-${a?.role ?? 'none'}`} style={{ width: `${size}px`, height: `${size}px` }} role={label ? 'img' : undefined} aria-label={label ? name : undefined} aria-hidden={label ? undefined : 'true'}>
      {src ? <img src={src} alt="" width={size} height={size} draggable={false} /> : <span class="agent-initial" style={{ fontSize: `${Math.round(size * 0.42)}px` }}>{[...name][0]}</span>}
      {a && isNew(a, keyOf(new Date())) && <span class="agent-new" aria-hidden="true">New</span>}
    </span>
  );
}

/** An ability's icon, drawn in the text color (the art is a white shape on clear). */
export function AbilityIcon({ agent, k, size = 22 }: { agent: string; k: string; size?: number }) {
  const src = abilityArt[`${agent}-${SLOT[k] ?? ''}`];
  const name = abilityOn(agent, k)?.name ?? '';
  if (!src) return <span class="ability-key" style={{ width: `${size}px`, height: `${size}px` }} aria-hidden="true">{k}</span>;
  return <span class="ability-icon" title={name} aria-hidden="true" style={{ width: `${size}px`, height: `${size}px`, '--art': `url("${src}")` }} />;
}

/** A role's icon, drawn in the text color. */
export function RoleIcon({ role, size = 18 }: { role: Role; size?: number }) {
  const src = roleArt[role];
  return <span class={`role-icon role-${role}`} title={roleOf(role).name} aria-hidden="true" style={{ width: `${size}px`, height: `${size}px`, ...(src ? { '--art': `url("${src}")` } : {}) }} />;
}

/** A map's wide banner (cropped to fill), or its initial. */
export function MapThumb({ id, class: cls }: { id: string; class?: string }) {
  const src = bannerArt[id];
  const name = mapById(id)?.name ?? id;
  return src ? <img class={`map-thumb${cls ? ' ' + cls : ''}`} src={src} alt="" draggable={false} /> : <span class={`map-thumb none${cls ? ' ' + cls : ''}`} aria-hidden="true">{[...name][0]}</span>;
}

/** A map's minimap image, or null when there's none. */
export const minimapOf = (id: string): string | null => minimapArt[id] ?? null;
export const hasAgentArt = (id: string): boolean => !!agentArt[id];
/** An agent's portrait, for drawing in an SVG (null when there's none). */
export const agentArtOf = (id: string): string | null => agentArt[id] ?? null;
