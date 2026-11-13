/**
 * Pairs of agents that work especially well together, or get in each other's way. Each pair has
 * a strength from -3 (clash) to 3 (a classic combo), the side it matters on, and the reason in
 * plain words (it becomes a pro or a con). A clash also says how to play around it. A pair that
 * counts on one side starts with a name, so "On attack, " can go in front of it. A pair that needs
 * both agents' ultimates isn't listed: the two are ready together too rarely to count every round.
 * Pairs not listed are neutral. A pair made with `F` is a flash that has to pop just as the other
 * agent swings, which counts only as far as a team plays its utility together (engine/model.ts).
 */
import type { Side } from './maps.ts';

export interface Pair {
  a: string;
  b: string;
  strength: number;
  side: Side | 'both';
  why: string;
  /** For a clash, what to do about it, as a sentence that follows `why`. */
  around?: string;
  /** The combo is a flash timed for the other agent's entry, so it needs a team that swings as it pops. */
  timed?: boolean;
}

const P = (a: string, b: string, strength: number, side: Pair['side'], why: string, around?: string): Pair => ({ a, b, strength, side, why, ...(around ? { around } : {}) });
const F = (a: string, b: string, strength: number, side: Pair['side'], why: string): Pair => ({ ...P(a, b, strength, side, why), timed: true });

export const PAIRS: readonly Pair[] = [
  // set-ups for an entry
  P('breach', 'raze', 3, 'attack', 'Breach’s Fault Line and Flashpoint go through walls just before Raze blasts in.'),
  P('breach', 'neon', 2, 'attack', 'Neon runs in while defenders are still stunned by Breach’s Fault Line.'),
  F('breach', 'jett', 2, 'attack', 'Breach’s Flashpoint goes off through the wall just as Jett dashes onto site.'),
  P('breach', 'waylay', 2, 'attack', 'Waylay dashes into enemies stunned by Breach.'),
  F('kayo', 'neon', 2, 'attack', 'KAY/O’s FLASH/drive and ZERO/point clear the way for Neon’s slide.'),
  P('kayo', 'raze', 2, 'attack', 'KAY/O’s ZERO/point suppresses defenders, so they can’t answer Raze’s entry with utility.'),
  F('kayo', 'jett', 2, 'attack', 'KAY/O’s FLASH/drive pops just as Jett dashes onto site.'),
  F('skye', 'raze', 2, 'attack', 'Skye’s Guiding Light and Trailblazer lead Raze onto site.'),
  F('skye', 'jett', 2, 'attack', 'Skye’s Guiding Light flashes for Jett’s entry.'),
  P('fade', 'raze', 2, 'attack', 'Fade’s Haunt shows where defenders stand, so Raze knows where to throw.'),
  P('fade', 'neon', 2, 'attack', 'Fade’s Haunt and Prowler tell Neon which space is safe to run into.'),
  P('fade', 'waylay', 2, 'attack', 'Fade reveals and tethers enemies, and Waylay dashes in on the ones she marks.'),
  P('sova', 'jett', 2, 'attack', 'Sova’s Recon Bolt finds defenders before Jett dashes in.'),
  P('sova', 'neon', 2, 'attack', 'Sova’s Recon Bolt and Owl Drone let Neon pick the open lane.'),
  P('gekko', 'raze', 2, 'attack', 'Wingman’s stun and Dizzy’s flash set Raze up.'),
  F('gekko', 'neon', 1, 'attack', 'Dizzy flashes for Neon’s slide onto site.'),
  P('tejo', 'raze', 2, 'attack', 'Tejo’s Guided Salvo forces defenders out of their spots for Raze to take.'),
  P('tejo', 'neon', 1, 'attack', 'Tejo’s Special Delivery concusses a corner for Neon.'),
  P('yoru', 'fade', 1, 'attack', 'Fade’s Haunt tells Yoru where a teleport will catch defenders unaware.'),
  P('hush', 'brimstone', 2, 'both', 'Hush’s Displacement pulls enemies together into Brimstone’s Incendiary and Orbital Strike.'),
  P('hush', 'raze', 2, 'both', 'Hush’s Displacement groups enemies up for Raze’s Paint Shells.'),
  P('hush', 'viper', 1, 'both', 'Hush’s Displacement drags enemies into Viper’s Snake Bite.'),
  P('hush', 'breach', 1, 'attack', 'Displacement and Fault Line chain concussions, leaving defenders helpless.'),
  P('hush', 'astra', 1, 'both', 'Gravity Well and Displacement pull twice, so enemies crash into each other and are concussed.'),
  P('hush', 'sova', 1, 'both', 'Sova’s Recon Bolt shows where to steer Displacement, and enemies lifted by Suspension are easy Shock Bolt targets.'),
  F('hush', 'neon', 1, 'attack', 'Neon goes in first, and Hush backs her up with a flash and a pull as the second duelist.'),
  // post-plant and lineups
  P('viper', 'brimstone', 2, 'attack', 'Viper’s Snake Bite and Brimstone’s Incendiary make defusing nearly impossible, which is why pro teams pair the two on Bind.'),
  P('viper', 'sova', 2, 'attack', 'Shock Bolts and Snake Bites stop the defuse from a distance.'),
  P('brimstone', 'sova', 2, 'attack', 'Sova’s Shock Bolts and Brimstone’s Incendiary stop defuses without peeking.'),
  P('viper', 'killjoy', 2, 'both', 'Viper’s Toxic Screen plus Killjoy’s Nanoswarms lock a site down, before or after the plant.'),
  P('tejo', 'viper', 1, 'attack', 'Guided Salvo and Snake Bite deny a defuse from two directions.'),
  P('gekko', 'brimstone', 1, 'attack', 'Mosh Pit and Brimstone’s Incendiary overlap on the Spike.'),
  // smokes, walls and executes
  P('omen', 'viper', 2, 'both', 'Viper’s Toxic Screen and Omen’s Dark Cover together cut a site off completely.'),
  P('brimstone', 'breach', 2, 'attack', 'Brimstone’s Stim Beacon and Sky Smokes plus Breach’s Fault Line make a fast, hard execute.'),
  P('brimstone', 'raze', 1, 'attack', 'Brimstone’s Stim Beacon and Sky Smokes speed up Raze’s entry.'),
  P('harbor', 'sova', 1, 'both', 'Harbor’s High Tide covers Sova on the way to the spots he shoots his Recon Bolt from.'),
  P('astra', 'sova', 1, 'both', 'Astra’s Gravity Well and Nova Pulse hit enemies Sova has found.'),
  P('astra', 'raze', 1, 'attack', 'Gravity Well pulls defenders into Raze’s Paint Shells.'),
  P('harbor', 'astra', 1, 'both', 'Harbor walls off long sightlines and Astra smokes anywhere on the map, which suits open maps.'),
  P('omen', 'yoru', 1, 'attack', 'Omen and Yoru both teleport to flank, so defenders can’t tell where the next fight comes from.'),
  P('omen', 'chamber', 1, 'defense', 'Omen’s Dark Cover lets Chamber reposition between Operator shots.'),
  P('miks', 'neon', 1, 'attack', 'Harmonize stims Neon, and each kill she gets keeps it going while both of them are alive.'),
  P('miks', 'raze', 1, 'attack', 'Harmonize stims Raze for a faster, steadier entry.'),
  // site holds and retakes
  P('cypher', 'viper', 1, 'defense', 'Cypher’s Trapwires watch the flank while Viper’s Toxic Screen cuts off the site.'),
  P('sage', 'reyna', 1, 'both', 'Sage keeps Reyna alive long enough to snowball.'),
  P('sage', 'chamber', 1, 'defense', 'Sage’s Barrier Orb and Slow Orb back up an Operator hold.'),
  P('fade', 'chamber', 1, 'defense', 'Fade’s Haunt gives Chamber’s Operator a target.'),
  P('vyse', 'viper', 1, 'defense', 'Vyse’s Razorvine and Viper’s Snake Bite wreck a slow push.'),
  // clashes
  P('reyna', 'iso', -2, 'both', 'Reyna and Iso both bring lots of firepower and little help for the team.', 'Let the other three bring the flashes and smokes, and have Reyna and Iso trade each other’s fights.'),
  P('reyna', 'yoru', -1, 'both', 'Reyna and Yoru both play for themselves, leaving the team short of set-ups.', 'Have the other three save their flashes and smokes for whichever of the two goes in first.'),
  P('jett', 'chamber', -1, 'both', 'Jett and Chamber both want the Operator, and a team can rarely afford two.', 'Decide before the round who buys it, and have the other play a rifle.'),
  P('sage', 'skye', -1, 'both', 'Sage and Skye both heal, which doubles up one job.', 'Play them on different sites or lanes, so each heals a different part of the team.'),
  P('cypher', 'killjoy', -1, 'attack', 'Cypher and Killjoy both hold ground with setups, which adds little on attack.', 'Have one watch the flank, and use the other’s setup to hold the planted Spike.'),
  P('deadlock', 'vyse', -1, 'attack', 'Deadlock and Vyse both hold ground with walls, which adds little on attack.', 'Have one cut off the flank, and save the other’s walls to hold the planted Spike.'),
];

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const BY_KEY = new Map(PAIRS.map((p) => [key(p.a, p.b), p]));
export const pairOf = (a: string, b: string): Pair | undefined => BY_KEY.get(key(a, b));
