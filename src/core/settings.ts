/**
 * Every setting in one schema: default, allowed values, and the words the Settings page and the
 * command palette show for it.
 */
import { isAgent } from './kb/agents.ts';
import { NEW_AGENTS } from './kb/new-agents.ts';
import { RANKS, type RankId } from './kb/ranks.ts';
import { PARTY_SIZES, sanitizeComfort, type Comfort, type PartySize } from './engine/query.ts';
import { clamp, isRecord } from './util.ts';

export type SectionId = 'you' | 'planner' | 'appearance' | 'sound';

interface Base { section: SectionId; label: string; help?: string; advanced?: boolean; keywords?: string }
export type SettingDef =
  | (Base & { type: 'bool'; def: boolean })
  | (Base & { type: 'number'; def: number; min: number; max: number; step?: number; unit?: string; percent?: boolean })
  | (Base & { type: 'choice'; def: string; options: readonly (readonly [string, string])[] })
  | (Base & { type: 'text'; def: string; validate?: (v: string) => boolean })
  | (Base & { type: 'agents'; def: readonly string[]; max: number })
  | (Base & { type: 'comfort'; def: Readonly<Record<string, Comfort>>; of: 'myAgents' });

export const SECTIONS: readonly { id: SectionId; title: string; blurb: string }[] = [
  { id: 'you', title: 'You', blurb: 'How you play. The Planner and Rankings start from here.' },
  { id: 'planner', title: 'Planner', blurb: 'What the Planner starts with and how much it shows.' },
  { id: 'appearance', title: 'Appearance', blurb: 'Themes, colors, sizes and motion.' },
  { id: 'sound', title: 'Sound', blurb: 'Sound effects and their volume.' },
];

const S = <T extends SettingDef>(d: T) => d;

export const SETTINGS = {
  // you
  defaultRank: S({ section: 'you', type: 'choice', def: 'gold', options: RANKS.map((r) => [r.id, r.name] as const), label: 'Your rank', help: 'The Planner and Rankings start on this rank.', keywords: 'elo tier usual' }),
  usualParty: S({ section: 'you', type: 'choice', def: '5', options: PARTY_SIZES.map((p) => [String(p.id), p.name] as const), label: 'How you queue', help: 'The Planner starts with this many of you, and the rest are random teammates.', keywords: 'party solo duo trio five-stack queue' }),
  myAgents: S({ section: 'you', type: 'agents', def: [] as readonly string[], max: 5, label: 'Agents you play', help: 'Up to five. The Planner gives you one of them in every plan, and Rankings marks them.', keywords: 'mains main agents pool' }),
  myComfort: S({ section: 'you', type: 'comfort', def: {} as Readonly<Record<string, Comfort>>, of: 'myAgents', label: 'How well you play them', help: 'The Planner leans toward your mains and away from agents you’re still learning, most at the low ranks, where your own fights decide rounds.', keywords: 'comfort main learning practice confidence' }),
  // planner
  includeNew: S({ section: 'planner', type: 'bool', def: true, label: 'Include new agents', help: 'New agents have little play behind them yet, so their scores are early estimates.', keywords: 'unreleased estimates' }),
  resultCount: S({ section: 'planner', type: 'number', def: 10, min: 3, max: 30, unit: 'comps', label: 'Comps to show', keywords: 'results length' }),
  showNumbers: S({ section: 'planner', type: 'bool', def: true, label: 'Show fit scores as numbers', help: 'When this is off, only the bars show.' }),
  // appearance
  themeMode: S({ section: 'appearance', type: 'choice', def: 'system', options: [['system', 'Match my computer'], ['light', 'Always light'], ['dark', 'Always dark']], label: 'Light or dark' }),
  themeLight: S({ section: 'appearance', type: 'text', def: 'paper', label: 'Light theme' }),
  themeDark: S({ section: 'appearance', type: 'text', def: 'lamp', label: 'Dark theme' }),
  accent: S({ section: 'appearance', type: 'text', def: '', label: 'Accent color', help: 'Leave on the theme’s own accent, or pick one.' }),
  textSize: S({ section: 'appearance', type: 'choice', def: 'm', options: [['s', 'Small'], ['m', 'Medium'], ['l', 'Large'], ['xl', 'Extra large']], label: 'Text size' }),
  motion: S({ section: 'appearance', type: 'choice', def: 'system', options: [['system', 'Match my computer'], ['full', 'Full'], ['reduced', 'Reduced'], ['off', 'Off']], label: 'Motion', help: 'Reduced keeps fades only.', keywords: 'animation' }),
  // sound
  sound: S({ section: 'sound', type: 'bool', def: true, label: 'Sound effects' }),
  soundSet: S({ section: 'sound', type: 'choice', def: 'desk', options: [['desk', 'Desk (paper and wood)'], ['chimes', 'Chimes (small bells)'], ['kalimba', 'Kalimba (plucked tines)']], label: 'Sound set' }),
  volMaster: S({ section: 'sound', type: 'number', def: 60, min: 0, max: 100, unit: '%', percent: true, label: 'Volume' }),
  volUi: S({ section: 'sound', type: 'number', def: 50, min: 0, max: 100, unit: '%', percent: true, label: 'Clicks and pages' }),
  volResults: S({ section: 'sound', type: 'number', def: 70, min: 0, max: 100, unit: '%', percent: true, label: 'Results', help: 'The note when a plan is ready or saved.' }),
} as const;

export type SettingKey = keyof typeof SETTINGS;
type ValueOf<D> = D extends { type: 'bool' } ? boolean : D extends { type: 'number' } ? number : D extends { type: 'agents' } ? readonly string[] : D extends { type: 'comfort' } ? Readonly<Record<string, Comfort>> : string;
export type Settings = { -readonly [K in SettingKey]: ValueOf<(typeof SETTINGS)[K]> };

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];
/** Whether a setting does anything yet: “Include new agents” waits for an agent too new for real numbers. */
export const inUse = (k: SettingKey): boolean => k !== 'includeNew' || NEW_AGENTS.length > 0;
export const defaultSettings = (): Settings => Object.fromEntries(SETTING_KEYS.map((k) => [k, SETTINGS[k].def])) as Settings;

/** A stored value made safe, or undefined (the default applies). */
export function sanitizeSetting(key: string, v: unknown): unknown {
  const def = (SETTINGS as Record<string, SettingDef>)[key];
  if (!def) return undefined;
  switch (def.type) {
    case 'bool': return typeof v === 'boolean' ? v : undefined;
    case 'number': {
      if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
      const x = clamp(v, def.min, def.max);
      return def.step ? Math.round(x / def.step) * def.step : Math.round(x);
    }
    case 'choice': return typeof v === 'string' && def.options.some(([o]) => o === v) ? v : undefined;
    case 'text': {
      if (typeof v !== 'string' || v.length > 200) return undefined;
      return def.validate && !def.validate(v) ? undefined : v;
    }
    case 'agents': return Array.isArray(v) ? [...new Set(v.filter(isAgent))].slice(0, def.max) : undefined;
    case 'comfort': return isRecord(v) ? sanitizeComfort(v) : undefined;
  }
}

/** Only known, valid settings. */
export function sanitizeSettings(o: unknown): Partial<Settings> {
  const out: Record<string, unknown> = {};
  if (!isRecord(o)) return out;
  for (const k of Object.keys(o)) {
    if (!(k in SETTINGS)) continue;
    const v = sanitizeSetting(k, o[k]);
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<Settings>;
}

/** The settings in effect: the saved changes over the defaults. */
export function resolveSettings(saved: Partial<Settings>): Settings {
  return Object.assign(defaultSettings(), sanitizeSettings(saved));
}

/** How a key is shown: "Space", "←", "Ctrl K". */
export function keyLabel(k: string): string {
  const map: Record<string, string> = { ' ': 'Space', arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓', escape: 'Esc', enter: 'Enter', backspace: 'Backspace', tab: 'Tab', pageup: 'Page Up', pagedown: 'Page Down' };
  if (!k) return 'none';
  return map[k] ?? (k.length === 1 ? k.toUpperCase() : k[0]!.toUpperCase() + k.slice(1));
}

/** How you play, as the settings say: your rank, how many of you queue together, the agents you play and how well. */
export interface You { rank: RankId; party: PartySize; agents: readonly string[]; comfort: Readonly<Record<string, Comfort>> }
export const youOf = (s: Settings): You => ({ rank: s.defaultRank as RankId, party: Number(s.usualParty) as PartySize, agents: s.myAgents, comfort: s.myComfort });
