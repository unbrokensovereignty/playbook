/**
 * Every number the engine weighs teams by, in one place. Tuning the engine means changing these
 * (and running `npm run check`, whose scenario tests say if the answers still make sense).
 */
import type { Dim, Role } from '../kb/roles.ts';
import type { Side } from '../kb/maps.ts';
import type { RankId } from '../kb/ranks.ts';
import type { Demand } from '../kb/plays.ts';

/** How much each strength matters on a side before the map, site and rank change it. */
export const BASE: Record<Side, Record<Dim, number>> = {
  attack: {
    smoke: 1, wall: 0.2, flash: 0.7, recon: 0.75, entry: 0.85, clear: 0.6, disrupt: 0.55, stall: 0.1,
    anchor: 0.05, flank: 0.35, retake: 0.05, postplant: 0.6, sustain: 0.25, duel: 0.7, angles: 0.2, mobility: 0.3,
  },
  defense: {
    smoke: 0.7, wall: 0.15, flash: 0.45, recon: 0.7, entry: 0.2, clear: 0.3, disrupt: 0.45, stall: 0.8,
    anchor: 0.8, flank: 0.55, retake: 0.7, postplant: 0.05, sustain: 0.35, duel: 0.7, angles: 0.45, mobility: 0.3,
  },
};

/**
 * How much each strength counts at Iron (first) and at Radiant (second), as a factor; ranks in
 * between are in proportion. Low ranks win on aim and simple, selfish utility; high ranks get the
 * most out of coordinated utility such as lineups and walls.
 */
export const BY_RANK: Record<Dim, readonly [number, number]> = {
  smoke: [0.85, 1.1], wall: [0.75, 1.15], flash: [0.8, 1.05], recon: [0.7, 1.1], entry: [1, 1], clear: [0.9, 1],
  disrupt: [0.8, 1.1], stall: [0.8, 1.05], anchor: [1.05, 0.95], flank: [1, 0.9], retake: [0.8, 1.05],
  postplant: [0.6, 1.15], sustain: [1.2, 0.8], duel: [1.5, 1], angles: [1, 1], mobility: [0.9, 1.05],
};

/**
 * How much a party's team plays together, as a share of its rank's place on the climb (0 Iron to
 * 1 Radiant). A five-stack plans its utility together; a solo player, a duo or a trio gets random
 * teammates who rarely play off each other's utility, even at the top. So for them everything that
 * rests on teamwork (what a team-dependent kit is worth, the reward for agents who work alone, a
 * second controller and the pull toward pro play) counts as it would a few ranks lower, while aim
 * and how hard each kit is to play count at the rank itself. A solo Radiant player's teammates
 * play together about like a Diamond five-stack.
 */
export const PARTY_TEAM: Record<1 | 2 | 3 | 5, number> = { 1: 0.6, 2: 0.7, 3: 0.8, 5: 1 };

/**
 * How much of an agent's kit a team gets out of it, by rank. At Iron, each point of `skill` (how
 * hard the agent is to play well) costs `skill` of the kit, and each point the agent depends on
 * the team (1 − `solo`) costs `team`; both fade to nothing at Radiant. Strengths that come only
 * from gun play (the G key in kb/agents.ts) count in full at every rank, and those that come
 * partly from it, halfway between.
 */
export const EXEC = { skill: 0.4, team: 0.3 };

/**
 * Agent fit beyond the team's strengths. `pro`: the pull toward what pros play on the map, at
 * Radiant (see PRO_RISE for lower ranks). `solo` and `skill`: at Iron, the reward for agents who
 * work alone and the cost of hard agents (both fade to nothing at Radiant; EXEC and HARD do most of
 * the work for hard agents). `win`: the reward per point of ranked win rate above 50% (and the cost
 * per point below), where win rates count fully (WIN_RANKS).
 */
export const FIT = { pro: 0.07, solo: 0.06, skill: 0.01, win: 0.004 };

/**
 * The agents notably harder to play well than most (`skill` above `from`, Neon, Astra, Yoru and Hush most of all)
 * cost `cost` per point above it at Iron, fading to nothing at `until`. Their kits ask for aim on
 * the move or exact timing that guides for the low ranks say to learn later. EXEC already gives a
 * team less of every hard kit, but a fast kit like Neon's still outran easier ones from Iron to
 * Gold. By `until`, players have the mechanics for them. The hardest (`skill` from `full.skill`:
 * Neon, Astra, Yoru and Hush) cost all of it through `full.until`, since guides tell players to learn
 * them later still at Silver and Gold (Sequel, GAMES.GG; iTechGuides on Hush), and fade from there.
 */
export const HARD: { from: number; cost: number; until: RankId; full: { skill: number; until: RankId } } = { from: 0.6, cost: 0.11, until: 'diamond', full: { skill: 0.85, until: 'gold' } };

/**
 * How the pull toward pro play grows with rank: `low` of the full pull at Iron, rising with the
 * rank's place on the way up to `until` (kb/ranks.ts) to the power `power`, so it stays small through
 * the middle ranks, grows fast from Diamond up and is full from `until`. The same goes for each map's
 * pro role mix. A second controller stops costing one rank sooner (SECOND_CONTROLLER): Diamond and
 * Ascendant five-stacks already layer smokes the way pros do on the maps built for two (Viper with
 * Omen on Split and Corrode, Brimstone with Viper on Bind), while the rest of the pros' mix, such as
 * playing without a sentinel, waits for the full pull. Bringing both in at Immortal left those maps
 * with one controller through Diamond, which neither ranked players there nor pros play.
 */
export const PRO_RISE: { low: number; power: number; until: RankId } = { low: 0.1, power: 2, until: 'immortal' };

/**
 * Ranked games are played with and against players of the ranks next to yours, so each rank's
 * answers take in this share of each neighboring rank's (Iron and Radiant, with one neighbor, keep
 * the rest for themselves). It also keeps a rating from jumping between two ranks and back.
 */
export const RANK_NEAR = 0.25;

/**
 * Pro numbers from fewer than this many maps of play pull less, in proportion, but never under
 * half; numbers from an earlier year's play pull `dated` of the full amount. Icebox's are a whole
 * top event's maps from the year before (kb/pro.ts), so they lose only a little for their age.
 */
export const PRO_GAMES = { full: 10, least: 0.5, dated: 0.85 };

/**
 * Each map's role mix in pro play (how many of each role a pro team runs there, from kb/pro.ts):
 * at Radiant, a team gives up this much per role, times the square of how far it is from that mix.
 * Being one agent off costs the full amount, half an agent off a quarter of it.
 */
export const ROLE_MIX = 0.08;

/**
 * Ranked win rates are taken across all ranks, so they mostly come from games between Silver and
 * Diamond. They count fully from `from` to `to` (a rank's place from 0 at Iron to 1 at Radiant)
 * and fade in a straight line to `iron` of that at Iron and to `radiant` at Radiant.
 */
export const WIN_RANKS = { iron: 0.5, from: 0.25, to: 0.625, radiant: 0.2 };

/**
 * Ranked win rates on each map (kb/mapwins.ts). An agent's rate on a map, moved so the map's average
 * game is won 50%, counts as far as it differs from their rate across all the maps, and only for the
 * share games / (games + `games`) of that difference: with fewer games than that, most of it is
 * chance. (Across the maps, the differences beyond chance come to about a third of a point for the
 * agents with thousands of games, so it takes this many to trust half of one.)
 */
export const MAP_WIN = { games: 15000 };

/**
 * Win rates at Radiant itself (kb/ranked.ts), for the top ranks, where the rates across all ranks
 * hardly count (WIN_RANKS). They count from nothing at `from` to fully at Radiant, as FIT.win per
 * point. Radiant is a few hundred players, so an agent's rate there counts only for the share
 * pick / (pick + `pick`) of it, by their percent of picks: the rate of an agent one player in a
 * hundred picks says more about that player than about the agent. Radiant's games are played mostly
 * by solo players and duos, so the rates count as far as a party's team is random (PARTY_RANDOM):
 * fully for a solo player and not for a five-stack.
 */
export const RADIANT_WIN: { from: RankId; pick: number } = { from: 'ascendant', pick: 4 };

/** A win rate also says who plays the agent, so only this many points either side of 50% count. */
export const WIN_CAP = 3;

/**
 * An agent's first weeks are played by people still learning them, which drags the win rate down:
 * within NEW_DAYS of release (kb/agents.ts), only this share of the gap from 50% counts.
 */
export const NEW_WIN_SHARE = 0.5;

/**
 * How much an agent's win rate has to add to (or take from) its fit before a comp's pros (or cons)
 * say so. A pro that an agent wins more games than most leaves out one whose team won under half its
 * games on the map, over at least `games` games there (kb/mapwins.ts): their rate across all maps
 * would mislead there, even where most of the gap is chance.
 */
export const WIN_NOTE = { more: 0.005, fewer: 0.006, games: 300 };

/**
 * A comp's cons say it's short of Operator play only on a map whose long angles add at least `map`
 * to what it needs there (kb/maps.ts), and below `from` only on a map built around them, whose
 * angles add `low` on both sides (Breeze): on tight maps, and at the low ranks where rifles and
 * trades decide most fights, the Operator isn't what a comp is missing.
 */
export const OPERATOR_NOTE: { map: number; low: number; from: RankId } = { map: 0.15, low: 0.5, from: 'gold' };

/**
 * When a comp's role count is this far from the map's pro mix, and costs at least `cost`, its cons
 * say so (so only from the middle ranks up, where the pro mix starts to count). When at least
 * `relax` of the cost of having none of a role is forgiven (pro teams on the map mostly play
 * without it), the con for the missing role says that pro teams play that way too. Below
 * `sentinels`, a defense isn't told off for a second sentinel: there, locking sites down wins rounds.
 */
export const MIX_NOTE: { off: number; cost: number; relax: number; sentinels: RankId } = { off: 0.6, cost: 0.03, relax: 0.3, sentinels: 'platinum' };

/**
 * A comp's cons say an agent takes practice to play well when a team at Iron would get less than
 * `hard` of the kit (engine/model.ts, kitShare): the agents notably harder than most, not every
 * agent who isn't the easiest. They say so at ranks up to `upTo` on the climb from Iron (0) to
 * Radiant (1), with the share a team at that rank gets. Its pros say an agent works well without
 * much teamwork only below `teamwork` (Platinum), where coaches start asking for map control,
 * fakes and rotations.
 */
export const KIT_NOTE = { hard: 0.6, upTo: 0.5, teamwork: 0.5 };

/**
 * How much a kit rule (kb/kitfit.ts) has to add to (or take from) a team's score on its own before
 * a comp's pros (or cons) give its reason, and how many such reasons each list gets at most.
 */
export const KIT_RULE_NOTE = { gain: 0.006, most: 2 };

/**
 * How a comp wins, in a line (explain.ts): the strengths it plays through are those the situation
 * needs at least `need` (1 = an average share) and the comp covers at least `cover`, each named by
 * the ability of an agent who brings at least `brings` of it, at most `most` before the plant or
 * retake and one after.
 */
export const PLAN_NOTE = { need: 0.8, cover: 0.6, brings: 0.45, most: 3 };

/**
 * Why one comp ranks below another (explain.ts): a part of the score counts as a reason when it
 * moves the score at least `part`, and at most `most` of what it gives up and `gains` of what it
 * gains are said.
 */
export const BELOW_NOTE = { part: 0.004, most: 3, gains: 2 };

/**
 * Map pick help (mappick.ts): up to `most` maps to play and `most` to ban, each with up to `why`
 * reasons. A map is worth banning only when its fit is at least `gap` points below the best map's
 * (and worth playing only when it's that far above the worst); maps all within `gap` of each other
 * fit about the same.
 */
export const MAP_PICK = { most: 2, why: 2, gap: 3 };

/**
 * How a comp's answers to the other team are told (kb/counters.ts, explain.ts): threats that go at
 * least `level` of the way are listed; a comp covering at least `answered` of what answers one has
 * the answer, below `little` it has little of it; and it names up to `by` agents who bring at least
 * `brings` of a strength that answers it.
 */
export const THREAT_NOTE = { level: 0.3, answered: 0.75, little: 0.5, by: 2, brings: 0.45 };

/**
 * Plays by rank (engine/plays.ts). A play runs as written from the rank its demand (kb/plays.ts,
 * DEMANDS) lists in `from`: most teams below it don't time utility and groups that closely, or
 * don't call and follow a change of plan mid-round, so each rank below costs `cost` of the play's fit.
 * The other way, from `read.from` up defenders hear a simple attack coming (all five one way, little
 * to time) and stack against it, while utility thrown together starts to win rounds, so a simple
 * attack costs `read.cost` there and as much again at each rank above. Defense has the same from
 * `read.defense` up, where attackers start to take mid and fake before they commit: a simple hold
 * that only waits on the sites, or a stack on one, gives up that fight and the first information.
 */
export const PLAY_RANK: { from: Record<Demand, RankId>; cost: number; read: { from: RankId; defense: RankId; cost: number } } = {
  from: { 1: 'iron', 2: 'silver', 3: 'platinum', 4: 'diamond' },
  cost: 0.25,
  read: { from: 'silver', defense: 'platinum', cost: 0.02 },
};

/**
 * How well you play an agent (core/engine/query.ts, Comfort): an agent you're still learning costs
 * `learning` and one of your mains adds `main`, in full at Iron and fading in a straight line to
 * `radiant` of that at Radiant. At low ranks your own fights decide rounds, so how well you know your
 * agent counts for the most there. From `note` either way, a comp's pros or cons say so.
 */
export const COMFORT = { learning: -0.06, main: 0.03, radiant: 0.4, note: 0.006 };

/** Points per step of a pair's strength (−3 to 3, see kb/synergy.ts). */
export const PAIR_STEP = 0.006;

/**
 * Role counts. Each role's entry lists the cost of having 0, 1, 2, 3 and 4 or more of it, on
 * attack and on defense. Strengths already reward a balanced team; these add the hard rules
 * every team needs, such as having a controller.
 */
export const ROLE_COST: Record<Role, Record<Side, readonly [number, number, number, number, number]>> = {
  controller: { attack: [-0.3, 0, 0, -0.15, -0.4], defense: [-0.25, 0, 0, -0.15, -0.4] },
  duelist: { attack: [-0.05, 0, 0, -0.08, -0.3], defense: [-0.015, 0, -0.01, -0.1, -0.3] },
  initiator: { attack: [-0.05, 0, 0, -0.06, -0.25], defense: [-0.04, 0, 0, -0.06, -0.25] },
  sentinel: { attack: [-0.015, 0, -0.01, -0.12, -0.3], defense: [-0.07, 0, -0.01, -0.1, -0.3] },
};

/**
 * What a team of random players loses (or gains) with each count of a role, on top of ROLE_COST,
 * written like it (0, 1, 2, 3, 4 or more). Blitz's numbers for ranked games at Diamond and up
 * (AgentSelect, “The most important role in VALORANT?”) have teams without a controller winning 40%
 * of games, without a duelist 45.5% and without a sentinel 46.1%, but teams without an initiator
 * 51.3%, teams with two initiators 47.6% and teams of three duelists with a controller and a
 * sentinel 51.2%. Scored the way the engine scores random teams, a team without a controller loses
 * about 0.37, so 10 points of win rate are about 0.036 here. That makes a duelist and a sentinel
 * matter more to random teams than ROLE_COST says, an initiator less (their utility still counts
 * through the team's strengths, which random teammates rarely play off, so the cost of having none
 * is given back and a little more), a second initiator cost a little, and a third duelist cost less.
 */
export const RANKED_ROLE: Record<Role, Record<Side, readonly [number, number, number, number, number]>> = {
  controller: { attack: [0, 0, 0, 0, 0], defense: [0, 0, 0, 0, 0] },
  duelist: { attack: [-0.08, 0, 0, 0.04, 0], defense: [-0.08, 0, 0, 0.04, 0] },
  initiator: { attack: [0.09, 0, -0.03, -0.03, -0.03], defense: [0.09, 0, -0.03, -0.03, -0.03] },
  sentinel: { attack: [-0.05, 0, 0, 0, 0], defense: [-0.05, 0, 0, 0, 0] },
};
/**
 * What players at Radiant pick in ranked (kb/ranked.ts) pulls a team of random players at the top
 * the way pro play pulls a team that plays together: `share` of the pro pull (FIT.pro), on the same
 * curve, counting from nothing at RADIANT_WIN.from to fully at Radiant and as far as the team is
 * random (PARTY_RANDOM). Players there know the game about as well as anyone, and the agents they
 * pick most also win more than most there: Jett and Clove are on nearly every team and win 51% and
 * 52% of games, while Astra, Harbor and Breach are hardly picked at all.
 */
export const RANKED_PULL = { share: 1 };
/** How much of the team a party leaves to random players (4 of 4 for a solo player, none for a five-stack), which RANKED_ROLE counts. */
export const PARTY_RANDOM: Record<1 | 2 | 3 | 5, number> = { 1: 1, 2: 0.75, 3: 0.5, 5: 0 };

/**
 * A second controller pays off only for a team that plays its smokes together, the way pro teams
 * layer smokes and walls for a hit. How far teams do grows with the square of the way up to `until`
 * (under half of the way at Platinum, about two thirds at Diamond, all of it from `until` up), so a team gives
 * up `cost` for a second controller at Iron, less at each rank up, and nothing from `until` up. Two
 * controllers' pair (synergy.ts) is that same teamwork, so it counts as far as teams play together,
 * and so do a flash timed for a teammate's entry (a pair's `timed`: KAY/O's FLASH/drive pays off
 * only if Jett dashes in as it pops) and the second controller in a map's pro role mix (ROLE_MIX). A duo or trio that plays
 * both controllers itself smokes together as well as a five-stack at its rank, so it pays what that
 * five-stack would for the second (core/engine/party.ts).
 * From `note` up, the comp's cons say so.
 */
export const SECOND_CONTROLLER: { cost: number; until: RankId; note: number } = { cost: 0.06, until: 'ascendant', note: 0.02 };

/**
 * Random teammates, for a duo or trio. They pick as often as players at your rank do (kb/ranked.ts),
 * and they usually fill a role the team is missing: a fill that leaves the team without one of
 * these roles is that much less likely. Ranked teams almost always end up with a controller and
 * rarely with three duelists: the fifty comps played most in ranked (metabot.gg, November 2026) all
 * have a controller, and all but one have two duelists, an initiator and a sentinel.
 */
export const FILL_MISSING: Record<Role, number> = { controller: 0.1, initiator: 0.4, sentinel: 0.4, duelist: 0.9 };
/** A fill that makes three or more duelists is this much less likely. */
export const FILL_TOO_MANY_DUELISTS = 0.4;
/**
 * A fill that makes three or more controllers is this much less likely, as unlikely as one that
 * leaves the team without any: at most one of those fifty comps has more than one controller.
 */
export const FILL_TOO_MANY_CONTROLLERS = 0.1;

/** Fit on screen: the best team for the situation is 100 and the middle of all possible teams is 50. */
export const FIT_MID = 50;

/**
 * Agent fits come from the best team each agent fits into. Those sit close together (the other
 * four make up for a lot), so the gap below the best team counts this many times over. That's for a
 * five-stack, where all four others are chosen to suit the agent. A duo or trio chooses only its own
 * players, so the gap counts once for each of them (stretchFor): a solo player's agent fits are the
 * fits of their picks.
 */
export const AGENT_STRETCH = 5;
/** How many times over the gap below the best counts in agent fits for a party of `size` (AGENT_STRETCH for a five-stack). */
export const stretchFor = (size: number): number => (AGENT_STRETCH * size) / 5;

/**
 * How sure a fit is (sure.ts). An agent who came out after the year's top events could have been
 * picked by pros anywhere from never to about a third of maps, which moves their pull by up to `pro`
 * either way (proCurve in model.ts); each kit rule of an agent with early numbers could be off by
 * `kit` of what it adds. A fit that could be off by `less` points or more is less sure, and the
 * reasons named are those that make up at least `part` of that.
 */
export const SURE = { pro: 0.3, kit: 0.5, less: 8, part: 0.25 };

/** Tiers by fit. */
export const TIERS: readonly { id: string; min: number }[] = [
  { id: 'S', min: 95 }, { id: 'A', min: 88 }, { id: 'B', min: 78 }, { id: 'C', min: 65 }, { id: 'D', min: 0 },
];
/** A fit's tier, going by the whole number shown, so two comps that both show 95 share a tier. */
export const tierOf = (fit: number): string => TIERS.find((t) => Math.round(fit) >= t.min)!.id;
