// Types for tools/patch.mjs, which tests/unit/patch.test.ts uses.
type Kits = Record<string, { abilities: { key: string; name: string; text: string }[] }>;
type Callouts = Record<string, [name: string, x: number, y: number][]>;
/** How far a callout's place has to move to count as moved, as a share of the minimap's size. */
export const MOVED: number;
/** The words of `a` and `b`, with those taken out as [-…-] and those put in as {+…+}. */
export function wordDiff(a: string, b: string): string;
/** The changes between two copies of content.gen.ts. */
export function contentChanges(was: { KITS: Kits; CALLOUTS: Callouts }, now: { KITS: Kits; CALLOUTS: Callouts }): {
  agents: { added: string[]; removed: string[] };
  abilities: { agent: string; key: string; name: string; was: string; now: string; renamed: string | undefined; marksOnly: boolean }[];
  maps: { added: string[]; removed: string[] };
  callouts: { map: string; name: string; change: 'added' | 'removed' | 'moved' }[];
};
