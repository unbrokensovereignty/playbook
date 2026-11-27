/**
 * Your games: your record by agent and by map from the games you logged (saved.ts), and when it's
 * worth offering to change how well you play an agent (query.ts, Comfort). A handful of games says
 * little, so an offer waits for enough of them, and it's an offer: you decide.
 */
import type { Comfort } from './engine/query.ts';
import type { Game } from './saved.ts';
import { SETTINGS } from './settings.ts';
import { isRecord } from './util.ts';

export interface GameRecord { key: string; games: number; wins: number; losses: number; draws: number }

/** Your record for each value of `by` (an agent, a map), most played first. */
export function recordBy(games: readonly Game[], by: (g: Game) => string): GameRecord[] {
  const out = new Map<string, GameRecord>();
  for (const g of games) {
    const k = by(g);
    const r = out.get(k) ?? { key: k, games: 0, wins: 0, losses: 0, draws: 0 };
    r.games++;
    if (g.result === 'win') r.wins++; else if (g.result === 'loss') r.losses++; else r.draws++;
    out.set(k, r);
  }
  return [...out.values()].sort((a, b) => b.games - a.games || b.wins - a.wins || a.key.localeCompare(b.key));
}

/** Wins as a share of the games that weren't drawn (0 with none). */
export const winShare = (r: Pick<GameRecord, 'wins' | 'losses'>): number => (r.wins + r.losses ? r.wins / (r.wins + r.losses) : 0);

/**
 * When to offer a change: an agent you've won or lost at least `games` games with (a draw says
 * nothing either way) and won at least `main` of is offered as a main; one you've won at most
 * `learning` of, as one you're still learning. Ranked games are close to even on average, so only a
 * clear lean counts.
 */
export const COMFORT_OFFER = { games: 10, main: 0.6, learning: 0.35 };

/** A change worth offering: how well you play `agent`, and whether it adds them to your agents first. */
export interface ComfortOffer { agent: string; to: Comfort; add: boolean; record: GameRecord }

/**
 * An offer put away with Not now: what it offered and the record it rested on. It stays away
 * until a game won or lost with that agent is logged or deleted (a draw says nothing either way).
 */
export interface PutOff { to: 'main' | 'learning'; wins: number; losses: number }
/** The offers put away, by agent (one each: putting away a newer one replaces it). */
export type PutOffs = Record<string, PutOff>;

/** What to keep when an offer is put away. */
export const putOffOf = (o: ComfortOffer): PutOff => ({ to: o.to === 'main' ? 'main' : 'learning', wins: o.record.wins, losses: o.record.losses });

const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** The offers put away, as read back from saved data: anything damaged is dropped, and old data has none. */
export function sanitizePutOff(x: unknown): PutOffs {
  const out: PutOffs = {};
  if (!isRecord(x)) return out;
  for (const [agent, v] of Object.entries(x).slice(0, 100)) {
    if (!/^[a-z0-9-]{1,40}$/.test(agent) || !isRecord(v) || (v.to !== 'main' && v.to !== 'learning') || !count(v.wins) || !count(v.losses)) continue;
    out[agent] = { to: v.to, wins: v.wins, losses: v.losses };
  }
  return out;
}

/**
 * The changes worth offering to how well you play your agents, from your record on each. An agent
 * you win a lot with who isn't one of yours is offered as a main while your list has room. An offer
 * put away (`putOff`) isn't made again while the record behind it is the same.
 */
export function comfortOffers(games: readonly Game[], mine: readonly string[], comfort: Readonly<Record<string, Comfort>>, putOff: Readonly<PutOffs> = {}): ComfortOffer[] {
  let room = SETTINGS.myAgents.max - mine.length;
  const away = (r: GameRecord, to: PutOff['to']) => {
    const p = putOff[r.key];
    return !!p && p.to === to && p.wins === r.wins && p.losses === r.losses;
  };
  return recordBy(games, (g) => g.agent).flatMap((r): ComfortOffer[] => {
    if (r.wins + r.losses < COMFORT_OFFER.games) return [];
    const share = winShare(r), now = comfort[r.key], ours = mine.includes(r.key);
    if (share >= COMFORT_OFFER.main && (!ours || now !== 'main')) {
      // one put away takes no room from the next
      if (away(r, 'main') || (!ours && room-- <= 0)) return [];
      return [{ agent: r.key, to: 'main', add: !ours, record: r }];
    }
    if (share <= COMFORT_OFFER.learning && ours && now !== 'learning' && !away(r, 'learning')) return [{ agent: r.key, to: 'learning', add: false, record: r }];
    return [];
  });
}

/** A record in words: "7 wins, 5 losses", with draws when there were any. */
export function recordWords(r: Pick<GameRecord, 'wins' | 'losses' | 'draws'>): string {
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  return [n(r.wins, 'win', 'wins'), n(r.losses, 'loss', 'losses'), ...(r.draws ? [n(r.draws, 'draw', 'draws')] : [])].join(', ');
}
