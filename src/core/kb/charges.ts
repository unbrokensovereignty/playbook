/**
 * How many times each agent can use each ability in a round, fully bought: the charges of C, Q and
 * E (an ultimate is once, when it's ready). A play never asks anyone for more than this, so Omen,
 * with one Paranoia, flashes one corner and not two (engine/uses.ts).
 *
 * A charge that comes back on a timer (Omen's Dark Cover, Sova's Recon Bolt) or after kills
 * (Jett's Tailwind) isn't counted again, since a step happens at one moment of the round. One use
 * of an ability that reaches several places counts each of them (PER_USE): Tejo's Guided Salvo
 * sends two missiles to two places. Astra's Gravity Well, Nova Pulse and Nebula all spend the same
 * four Stars.
 *
 * Checked on 12 November 2026, for patch 13.09, against the abilities on Liquipedia and the VALORANT
 * fandom wiki and the game's own numbers as valorant.gs lists them. Riot hasn't published Hush's
 * Flashbulb or Veto's Chokehold yet, so they count as one each until it does. After a patch, check
 * the patch notes for charge changes and update the agent here.
 */
export type ChargeKey = 'C' | 'Q' | 'E';

export const CHARGES: Record<string, Record<ChargeKey, number>> = {
  // duelists
  jett: { C: 2, Q: 2, E: 1 }, // Cloudburst, Updraft, Tailwind
  phoenix: { C: 1, Q: 2, E: 1 }, // Blaze, Curveball, Hot Hands
  raze: { C: 1, Q: 2, E: 1 }, // Boom Bot, Blast Pack, Paint Shells
  reyna: { C: 2, Q: 2, E: 2 }, // Leer, Devour, Dismiss
  yoru: { C: 1, Q: 2, E: 2 }, // Fakeout, Blindside, Gatecrash
  neon: { C: 1, Q: 1, E: 1 }, // Fast Lane, Relay Bolt, High Gear
  iso: { C: 1, Q: 1, E: 1 }, // Contingency, Undercut, Double Tap
  waylay: { C: 1, Q: 1, E: 1 }, // Saturate, Lightspeed (two dashes on one charge), Refract
  hush: { C: 1, Q: 1, E: 1 }, // Flow, Flashbulb, Displacement
  // initiators
  sova: { C: 1, Q: 2, E: 1 }, // Owl Drone, Shock Bolt, Recon Bolt
  breach: { C: 1, Q: 2, E: 1 }, // Aftershock, Flashpoint, Fault Line
  skye: { C: 1, Q: 1, E: 2 }, // Regrowth, Trailblazer, Guiding Light
  kayo: { C: 1, Q: 2, E: 1 }, // FRAG/ment, FLASH/drive, ZERO/point
  fade: { C: 2, Q: 1, E: 1 }, // Prowler, Seize, Haunt
  gekko: { C: 1, Q: 1, E: 1 }, // Mosh Pit, Wingman, Dizzy (picked back up only after it lands)
  tejo: { C: 1, Q: 1, E: 1 }, // Stealth Drone, Special Delivery, Guided Salvo
  // controllers
  brimstone: { C: 1, Q: 1, E: 3 }, // Stim Beacon, Incendiary, Sky Smoke
  viper: { C: 2, Q: 1, E: 1 }, // Snake Bite, Poison Cloud, Toxic Screen
  omen: { C: 2, Q: 1, E: 2 }, // Shrouded Step, Paranoia, Dark Cover
  astra: { C: 4, Q: 4, E: 4 }, // Gravity Well, Nova Pulse and Nebula, from four Stars in all
  harbor: { C: 2, Q: 1, E: 1 }, // Storm Surge, High Tide, Cove
  clove: { C: 1, Q: 1, E: 2 }, // Pick-me-up, Meddle, Ruse
  miks: { C: 2, Q: 1, E: 2 }, // M-pulse, Harmonize, Waveform
  // sentinels
  sage: { C: 1, Q: 2, E: 1 }, // Barrier Orb, Slow Orb, Healing Orb
  cypher: { C: 2, Q: 2, E: 1 }, // Trapwire, Cyber Cage, Spycam
  killjoy: { C: 2, Q: 1, E: 1 }, // Nanoswarm, Alarmbot, Turret
  chamber: { C: 1, Q: 1, E: 1 }, // Trademark, Headhunter, Rendezvous
  deadlock: { C: 1, Q: 2, E: 1 }, // GravNet, Sonic Sensor, Barrier Mesh
  vyse: { C: 2, Q: 1, E: 1 }, // Razorvine, Shear, Arc Rose
  veto: { C: 2, Q: 1, E: 1 }, // Crosscut, Chokehold, Interceptor
};

/** Abilities that reach more than one place with each use, and how many. */
const PER_USE: Record<string, Partial<Record<ChargeKey, number>>> = { tejo: { E: 2 } };

/** Abilities that spend one shared stock, and how big it is: Astra's Stars. */
const SHARED: Record<string, { keys: string; most: number }> = { astra: { keys: 'CQE', most: 4 } };

/** Whether one use of an agent's ability reaches more than one place. */
export const reachesMore = (id: string, key: string): boolean => (PER_USE[id]?.[key as ChargeKey] ?? 1) > 1;

/**
 * How many places an agent can reach with these abilities (keys such as "EC") in one round, all together.
 * The ultimate counts only when it's all there is, as one, since a play can't wait for it; a gun
 * (G) isn't utility. An agent with nothing here has none (0).
 */
export function usesOf(id: string, keys: string): number {
  const charges = CHARGES[id];
  const own = [...new Set(keys)].filter((k): k is ChargeKey => k === 'C' || k === 'Q' || k === 'E');
  if (!own.length) return keys.includes('X') ? 1 : 0;
  let n = own.reduce((sum, k) => sum + (charges?.[k] ?? 1) * (PER_USE[id]?.[k] ?? 1), 0);
  const shared = SHARED[id];
  if (shared && own.every((k) => shared.keys.includes(k))) n = Math.min(n, shared.most);
  return n;
}
