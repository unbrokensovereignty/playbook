/**
 * Agents too new for their numbers to be known, kept apart so they're easy to update. None right
 * now: Hush, the last one, is in agents.ts with numbers from her first days of play.
 *
 * To add one that has been revealed but isn't out yet (or has only just come out):
 * 1. Give it an entry below with `estimate: true` (what each number means is at the top of
 *    agents.ts), and its revealed abilities in NEW_KITS. The app then marks it as an estimate
 *    wherever it shows it, and people can leave it out of a question.
 * 2. Once it's out and has been played for a while, change the numbers, take out `estimate: true`
 *    and move the entry into agents.ts.
 * 3. Put its ability names and text in content.gen.ts with `npm run fetch-art -- <folder>` and
 *    then `npm run art -- <folder>` (see CONTRIBUTING.md), which also adds its portrait and icons;
 *    that kit then takes over from the one in NEW_KITS.
 * 4. Add its pairs to synergy.ts, two tips to tips.ts, and its map picks to pro.ts once pros play it.
 * 5. Run `npm run check`: the tests say if anything doesn't fit.
 */
import type { AgentDef } from './agents.ts';
import type { Kit } from './content.gen.ts';

export const NEW_AGENTS: readonly AgentDef[] = [];

/** A new agent's abilities as revealed, until a fresh download puts the game's own text in content.gen.ts. */
export const NEW_KITS: Record<string, Kit> = {};
