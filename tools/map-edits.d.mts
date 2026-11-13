// Types for tools/map-edits.mjs, which tests/unit/map-edits.test.ts uses.
export interface EditsMap {
  id: string;
  name: string;
  /** Its callouts as the app has them now, with `places` applied. */
  callouts: { name: string; at: [number, number] }[];
  /** Where the game's own content puts each callout. */
  game: Record<string, [number, number]>;
  /** The callout names that plays use. */
  inPlays: string[];
}
/** The new text of maps.ts and features.ts for a file of edits, what was done and what's left to do by hand. */
export function applyEdits(edits: unknown, files: { mapsTs: string; featuresTs: string; maps: EditsMap[] }): { mapsTs: string; featuresTs: string; done: string[]; todo: string[] };
