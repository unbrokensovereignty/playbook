/**
 * The lineups pro teams played, map by map, at this year's international events: which five agents
 * each team picked, and the rounds each team won. `pro.ts` reads its pick rates and typical comps
 * from these, and the validation tests check the engine against them, an event at a time.
 *
 * Sources: each series' page on vlr.gg (the agents in each map's scoreboard, the map from its
 * header and the veto), read 5 November 2026. The pick rates these add up to match vlr.gg's own
 * agent tables for each event and map. Maps where a team swapped agents partway through (two at
 * Masters London) are left out.
 *
 * A row is [event, map, team, rounds, agents, other team, its rounds, its agents], with the agents
 * as ids split by spaces.
 */

export interface ProEvent {
  id: string;
  name: string;
  /** When it began and ended (YYYY-MM-DD). */
  from: string;
  to: string;
}

/** When the lineups were read from vlr.gg (YYYY-MM-DD). */
export const LINEUPS_READ = '2026-11-05';

/** The events, newest first. */
export const EVENTS: readonly ProEvent[] = [
  { id: 'champions', name: 'Champions 2026', from: '2026-09-24', to: '2026-10-18' },
  { id: 'london', name: 'Masters London 2026', from: '2026-06-05', to: '2026-06-21' },
  { id: 'santiago', name: 'Masters Santiago 2026', from: '2026-02-28', to: '2026-03-15' },
];

/**
 * Agents released during the year, after the first event began (the same dates as agents.ts, which
 * a spec checks): an event before an agent's release counts neither for nor against them.
 */
export const RELEASED_DURING: Readonly<Record<string, string>> = { miks: '2026-03-18' };
/** Whether pro teams could pick the agent at the event. */
export const pickable = (agent: string, event: ProEvent): boolean => !(RELEASED_DURING[agent]! > event.from);

/** One team's side of a map: its name, the rounds it won and its five agents. */
export interface LineupTeam { team: string; rounds: number; agents: readonly string[] }

/** A map played at an event, with both teams' lineups. */
export interface Lineup { event: string; map: string; teams: readonly [LineupTeam, LineupTeam] }

type Row = readonly [string, string, string, number, string, string, number, string];

const ROWS: readonly Row[] = [
  // Champions 2026
  // vlr.gg/753455: Team Liquid vs Paper Rex
  ['champions', 'ascent', 'Team Liquid', 4, 'sova cypher omen jett phoenix', 'Paper Rex', 13, 'yoru chamber sage omen sova'],
  ['champions', 'haven', 'Team Liquid', 13, 'raze harbor yoru killjoy fade', 'Paper Rex', 7, 'yoru phoenix fade astra chamber'],
  ['champions', 'lotus', 'Team Liquid', 10, 'yoru fade cypher raze omen', 'Paper Rex', 13, 'vyse yoru fade omen raze'],
  // vlr.gg/753454: TYLOO vs G2
  ['champions', 'lotus', 'TYLOO', 6, 'fade chamber omen viper neon', 'G2 Esports', 13, 'skye vyse viper omen raze'],
  ['champions', 'sunset', 'TYLOO', 3, 'sage omen chamber neon fade', 'G2 Esports', 13, 'skye neon omen sage chamber'],
  // vlr.gg/753460: NS vs NRG
  ['champions', 'lotus', 'Nongshim RedForce', 5, 'fade chamber viper omen neon', 'NRG', 13, 'raze vyse viper omen fade'],
  ['champions', 'split', 'Nongshim RedForce', 10, 'fade yoru omen neon viper', 'NRG', 13, 'viper raze fade omen neon'],
  // vlr.gg/753459: KC vs XLG
  ['champions', 'sunset', 'Karmine Corp', 13, 'fade neon omen chamber viper', 'Xi Lai Gaming', 3, 'fade yoru waylay cypher omen'],
  ['champions', 'abyss', 'Karmine Corp', 13, 'yoru sova cypher omen waylay', 'Xi Lai Gaming', 6, 'astra harbor waylay sova yoru'],
  // vlr.gg/753449: GE vs VIT
  ['champions', 'abyss', 'Global Esports', 10, 'astra waylay sova yoru omen', 'Team Vitality', 13, 'astra sova yoru harbor jett'],
  ['champions', 'ascent', 'Global Esports', 13, 'omen sova chamber neon sage', 'Team Vitality', 9, 'sage omen chamber yoru sova'],
  ['champions', 'summit', 'Global Esports', 11, 'astra tejo raze skye veto', 'Team Vitality', 13, 'chamber neon phoenix harbor sova'],
  // vlr.gg/753450: LOUD vs EDG
  ['champions', 'lotus', 'LOUD', 13, 'neon omen fade chamber viper', 'EDward Gaming', 8, 'chamber viper omen fade neon'],
  ['champions', 'summit', 'LOUD', 13, 'fade chamber neon omen sage', 'EDward Gaming', 5, 'tejo omen waylay cypher breach'],
  // vlr.gg/753444: 100T vs T1
  ['champions', 'summit', '100 Thieves', 13, 'chamber harbor fade neon sage', 'T1', 8, 'chamber sage fade omen neon'],
  ['champions', 'ascent', '100 Thieves', 13, 'phoenix cypher jett omen sova', 'T1', 9, 'sova chamber sage omen neon'],
  // vlr.gg/753445: JDG vs FUT
  ['champions', 'ascent', 'JD Gaming', 1, 'sova yoru omen deadlock cypher', 'FUT Esports', 13, 'sova jett omen cypher phoenix'],
  ['champions', 'summit', 'JD Gaming', 10, 'waylay fade omen cypher yoru', 'FUT Esports', 13, 'cypher phoenix neon fade harbor'],
  // vlr.gg/753456: G2 vs PRX
  ['champions', 'split', 'G2 Esports', 13, 'skye chamber viper neon omen', 'Paper Rex', 9, 'raze viper omen fade yoru'],
  ['champions', 'haven', 'G2 Esports', 11, 'chamber omen yoru neon fade', 'Paper Rex', 13, 'chamber astra phoenix fade yoru'],
  ['champions', 'lotus', 'G2 Esports', 9, 'omen raze vyse viper skye', 'Paper Rex', 13, 'raze fade vyse yoru omen'],
  // vlr.gg/753461: KC vs NRG
  ['champions', 'ascent', 'Karmine Corp', 13, 'cypher neon phoenix omen sova', 'NRG', 7, 'cypher sova omen jett phoenix'],
  ['champions', 'summit', 'Karmine Corp', 11, 'viper omen fade neon chamber', 'NRG', 13, 'kayo brimstone cypher sova neon'],
  ['champions', 'haven', 'Karmine Corp', 9, 'omen sova phoenix neon cypher', 'NRG', 13, 'neon sova chamber phoenix omen'],
  // vlr.gg/753451: VIT vs LOUD
  ['champions', 'ascent', 'Team Vitality', 13, 'omen sova sage chamber yoru', 'LOUD', 7, 'yoru sova waylay cypher omen'],
  ['champions', 'summit', 'Team Vitality', 19, 'fade neon phoenix chamber harbor', 'LOUD', 17, 'chamber neon sage fade omen'],
  // vlr.gg/753446: 100T vs FUT
  ['champions', 'split', '100 Thieves', 13, 'neon viper skye omen chamber', 'FUT Esports', 5, 'viper skye raze omen neon'],
  ['champions', 'lotus', '100 Thieves', 13, 'omen neon skye chamber viper', 'FUT Esports', 10, 'fade omen jett neon cypher'],
  // vlr.gg/753457: TYLOO vs TL
  ['champions', 'split', 'TYLOO', 8, 'jett omen skye raze viper', 'Team Liquid', 13, 'raze yoru astra viper fade'],
  ['champions', 'summit', 'TYLOO', 13, 'waylay fade phoenix omen cypher', 'Team Liquid', 7, 'harbor fade vyse yoru raze'],
  ['champions', 'lotus', 'TYLOO', 2, 'neon viper omen fade chamber', 'Team Liquid', 13, 'fade raze omen yoru cypher'],
  // vlr.gg/753462: XLG vs NS
  ['champions', 'summit', 'Xi Lai Gaming', 11, 'omen sage fade chamber waylay', 'Nongshim RedForce', 13, 'chamber harbor fade sage neon'],
  ['champions', 'sunset', 'Xi Lai Gaming', 11, 'cypher yoru fade waylay omen', 'Nongshim RedForce', 13, 'yoru fade omen cypher waylay'],
  // vlr.gg/753452: GE vs EDG
  ['champions', 'summit', 'Global Esports', 13, 'astra fade sage neon chamber', 'EDward Gaming', 5, 'neon sage fade yoru omen'],
  ['champions', 'sunset', 'Global Esports', 13, 'neon fade omen yoru chamber', 'EDward Gaming', 6, 'omen neon kayo sova cypher'],
  // vlr.gg/753447: T1 vs JDG
  ['champions', 'lotus', 'T1', 13, 'omen viper chamber fade neon', 'JD Gaming', 11, 'omen raze vyse chamber fade'],
  ['champions', 'abyss', 'T1', 3, 'yoru omen sova waylay brimstone', 'JD Gaming', 13, 'yoru harbor sova omen waylay'],
  ['champions', 'haven', 'T1', 13, 'neon killjoy omen phoenix sova', 'JD Gaming', 5, 'waylay omen neon sova cypher'],
  // vlr.gg/753458: G2 vs TL
  ['champions', 'split', 'G2 Esports', 13, 'skye omen chamber neon viper', 'Team Liquid', 10, 'astra raze fade yoru viper'],
  ['champions', 'abyss', 'G2 Esports', 13, 'harbor sova neon waylay astra', 'Team Liquid', 7, 'sova waylay harbor cypher yoru'],
  // vlr.gg/753463: KC vs NS
  ['champions', 'sunset', 'Karmine Corp', 13, 'viper chamber omen neon fade', 'Nongshim RedForce', 9, 'omen fade cypher waylay yoru'],
  ['champions', 'summit', 'Karmine Corp', 5, 'chamber viper neon fade omen', 'Nongshim RedForce', 13, 'neon sage fade harbor chamber'],
  ['champions', 'haven', 'Karmine Corp', 6, 'sova phoenix neon omen cypher', 'Nongshim RedForce', 13, 'neon omen killjoy yoru sova'],
  // vlr.gg/753453: LOUD vs GE
  ['champions', 'split', 'LOUD', 13, 'omen yoru viper fade neon', 'Global Esports', 8, 'viper yoru omen fade neon'],
  ['champions', 'sunset', 'LOUD', 13, 'omen sage chamber neon sova', 'Global Esports', 9, 'chamber omen yoru fade neon'],
  // vlr.gg/753448: FUT vs T1
  ['champions', 'sunset', 'FUT Esports', 10, 'cypher neon omen waylay sova', 'T1', 13, 'fade sage chamber neon omen'],
  ['champions', 'ascent', 'FUT Esports', 10, 'omen sova phoenix cypher jett', 'T1', 13, 'sova omen sage neon chamber'],
  // vlr.gg/754732: NRG vs T1
  ['champions', 'lotus', 'NRG', 13, 'vyse raze omen fade viper', 'T1', 11, 'neon viper chamber fade omen'],
  ['champions', 'summit', 'NRG', 13, 'brimstone sova kayo neon cypher', 'T1', 7, 'chamber neon fade sage harbor'],
  // vlr.gg/754733: PRX vs LOUD
  ['champions', 'split', 'Paper Rex', 9, 'yoru raze omen viper fade', 'LOUD', 13, 'omen yoru viper fade neon'],
  ['champions', 'sunset', 'Paper Rex', 13, 'fade chamber omen raze sage', 'LOUD', 15, 'chamber sage neon omen sova'],
  // vlr.gg/754730: 100T vs G2
  ['champions', 'abyss', '100 Thieves', 5, 'sova cypher phoenix jett harbor', 'G2 Esports', 13, 'astra sova neon waylay harbor'],
  ['champions', 'ascent', '100 Thieves', 11, 'phoenix jett omen cypher sova', 'G2 Esports', 13, 'sova chamber omen vyse neon'],
  // vlr.gg/754731: VIT vs NS
  ['champions', 'split', 'Team Vitality', 13, 'viper yoru fade omen neon', 'Nongshim RedForce', 8, 'viper omen yoru neon fade'],
  ['champions', 'abyss', 'Team Vitality', 4, 'harbor sova astra jett yoru', 'Nongshim RedForce', 13, 'sova omen yoru harbor neon'],
  ['champions', 'haven', 'Team Vitality', 14, 'sova astra chamber yoru neon', 'Nongshim RedForce', 12, 'killjoy yoru neon sova omen'],
  // vlr.gg/754739: T1 vs PRX
  ['champions', 'lotus', 'T1', 13, 'viper chamber omen neon fade', 'Paper Rex', 7, 'yoru vyse raze fade omen'],
  ['champions', 'ascent', 'T1', 6, 'chamber sova omen sage neon', 'Paper Rex', 13, 'sova omen yoru sage chamber'],
  ['champions', 'summit', 'T1', 13, 'fade sage neon omen chamber', 'Paper Rex', 11, 'sage viper omen neon fade'],
  // vlr.gg/754738: 100T vs NS
  ['champions', 'summit', '100 Thieves', 13, 'harbor sage chamber fade neon', 'Nongshim RedForce', 5, 'sage chamber fade neon harbor'],
  ['champions', 'sunset', '100 Thieves', 9, 'chamber omen phoenix neon fade', 'Nongshim RedForce', 13, 'omen yoru fade neon cypher'],
  ['champions', 'ascent', '100 Thieves', 13, 'cypher phoenix omen jett sova', 'Nongshim RedForce', 1, 'chamber sova sage omen neon'],
  // vlr.gg/754735: NRG vs LOUD
  ['champions', 'haven', 'NRG', 9, 'chamber neon sova phoenix omen', 'LOUD', 13, 'chamber omen sova viper neon'],
  ['champions', 'sunset', 'NRG', 13, 'chamber omen kayo fade neon', 'LOUD', 10, 'chamber sage sova neon omen'],
  ['champions', 'summit', 'NRG', 3, 'cypher neon kayo brimstone sova', 'LOUD', 13, 'sage fade chamber neon omen'],
  // vlr.gg/754734: G2 vs VIT
  ['champions', 'abyss', 'G2 Esports', 11, 'waylay harbor sova astra neon', 'Team Vitality', 13, 'yoru harbor sova astra jett'],
  ['champions', 'split', 'G2 Esports', 4, 'omen skye chamber viper neon', 'Team Vitality', 13, 'yoru neon omen fade viper'],
  // vlr.gg/754740: NRG vs 100T
  ['champions', 'sunset', 'NRG', 12, 'chamber neon fade omen kayo', '100 Thieves', 14, 'fade phoenix omen cypher neon'],
  ['champions', 'haven', 'NRG', 4, 'sova phoenix omen chamber neon', '100 Thieves', 13, 'phoenix neon omen cypher sova'],
  // vlr.gg/754741: G2 vs T1
  ['champions', 'lotus', 'G2 Esports', 13, 'raze skye omen vyse viper', 'T1', 11, 'chamber omen fade viper neon'],
  ['champions', 'abyss', 'G2 Esports', 10, 'neon harbor sova waylay astra', 'T1', 13, 'sova yoru omen waylay harbor'],
  ['champions', 'ascent', 'G2 Esports', 13, 'vyse chamber omen sova neon', 'T1', 6, 'chamber sage sova omen neon'],
  // vlr.gg/754736: VIT vs LOUD
  ['champions', 'lotus', 'Team Vitality', 13, 'fade viper omen raze chamber', 'LOUD', 8, 'omen viper chamber neon fade'],
  ['champions', 'summit', 'Team Vitality', 5, 'chamber harbor fade neon phoenix', 'LOUD', 13, 'chamber omen sage neon fade'],
  ['champions', 'haven', 'Team Vitality', 11, 'sova yoru astra chamber neon', 'LOUD', 13, 'omen chamber neon sova viper'],
  // vlr.gg/754742: 100T vs G2
  ['champions', 'lotus', '100 Thieves', 10, 'neon chamber viper skye omen', 'G2 Esports', 13, 'raze viper skye vyse omen'],
  ['champions', 'ascent', '100 Thieves', 13, 'cypher omen sova phoenix jett', 'G2 Esports', 10, 'sova chamber vyse omen neon'],
  ['champions', 'summit', '100 Thieves', 13, 'chamber harbor neon sage fade', 'G2 Esports', 7, 'harbor fade chamber vyse neon'],
  // vlr.gg/754743: VIT vs 100T
  ['champions', 'split', 'Team Vitality', 5, 'yoru viper omen neon fade', '100 Thieves', 13, 'neon fade chamber omen viper'],
  ['champions', 'summit', 'Team Vitality', 13, 'fade neon chamber phoenix harbor', '100 Thieves', 10, 'neon fade chamber harbor sage'],
  ['champions', 'lotus', 'Team Vitality', 13, 'chamber fade raze omen viper', '100 Thieves', 11, 'neon viper omen chamber skye'],
  ['champions', 'ascent', 'Team Vitality', 13, 'sova sage chamber omen yoru', '100 Thieves', 9, 'cypher sova jett omen phoenix'],
  // vlr.gg/754737: LOUD vs VIT
  ['champions', 'summit', 'LOUD', 13, 'sage omen fade chamber neon', 'Team Vitality', 11, 'fade phoenix harbor neon chamber'],
  ['champions', 'lotus', 'LOUD', 8, 'viper neon fade vyse omen', 'Team Vitality', 13, 'raze viper chamber fade omen'],
  ['champions', 'sunset', 'LOUD', 13, 'neon sage sova chamber omen', 'Team Vitality', 5, 'chamber fade omen neon kayo'],
  ['champions', 'haven', 'LOUD', 13, 'omen sova neon viper chamber', 'Team Vitality', 10, 'yoru neon sova chamber astra'],
  // Masters London 2026
  // vlr.gg/684613: XLG vs NRG (first header said Fracture, veto Pearl; comps are Pearl's)
  ['london', 'pearl', 'Xi Lai Gaming', 6, 'jett astra vyse phoenix fade', 'NRG', 13, 'vyse sova waylay tejo astra'],
  ['london', 'lotus', 'Xi Lai Gaming', 11, 'cypher fade sage omen deadlock', 'NRG', 13, 'omen viper fade raze vyse'],
  // vlr.gg/684610: VIT vs DRG
  ['london', 'lotus', 'Team Vitality', 13, 'raze viper omen fade vyse', 'Dragon Ranger Gaming', 5, 'cypher chamber skye waylay omen'],
  ['london', 'breeze', 'Team Vitality', 13, 'viper harbor jett sova kayo', 'Dragon Ranger Gaming', 3, 'chamber sova viper jett astra'],
  // vlr.gg/684611: FS vs FUT
  ['london', 'fracture', 'FULL SENSE', 3, 'phoenix brimstone fade cypher neon', 'FUT Esports', 13, 'jett cypher raze brimstone fade'],
  ['london', 'haven', 'FULL SENSE', 7, 'phoenix fade omen chamber neon', 'FUT Esports', 13, 'waylay sova omen jett cypher'],
  // vlr.gg/684612: LEV vs GE
  ['london', 'pearl', 'LEVIATAN', 4, 'chamber astra sova neon phoenix', 'Global Esports', 13, 'killjoy phoenix neon astra fade'],
  ['london', 'fracture', 'LEVIATAN', 13, 'waylay brimstone breach tejo neon', 'Global Esports', 11, 'chamber astra phoenix waylay fade'],
  ['london', 'split', 'LEVIATAN', 13, 'phoenix viper omen neon fade', 'Global Esports', 9, 'raze fade sage viper omen'],
  // vlr.gg/684614: VIT vs FUT
  ['london', 'pearl', 'Team Vitality', 13, 'kayo chamber sova astra neon', 'FUT Esports', 11, 'chamber astra jett kayo fade'],
  ['london', 'haven', 'Team Vitality', 4, 'phoenix sova jett cypher omen', 'FUT Esports', 13, 'cypher sova jett omen waylay'],
  ['london', 'fracture', 'Team Vitality', 13, 'brimstone raze cypher phoenix fade', 'FUT Esports', 10, 'raze cypher brimstone jett fade'],
  // vlr.gg/684615: NRG vs LEV
  ['london', 'ascent', 'NRG', 7, 'astra vyse sova phoenix jett', 'LEVIATAN', 13, 'phoenix chamber sova omen neon'],
  ['london', 'lotus', 'NRG', 13, 'fade viper raze omen vyse', 'LEVIATAN', 5, 'omen skye jett vyse raze'],
  ['london', 'pearl', 'NRG', 8, 'astra vyse sova tejo waylay', 'LEVIATAN', 13, 'neon astra sova chamber phoenix'],
  // vlr.gg/684616: DRG vs XLG
  ['london', 'haven', 'Dragon Ranger Gaming', 13, 'skye cypher omen waylay neon', 'Xi Lai Gaming', 4, 'cypher sova phoenix omen jett'],
  ['london', 'fracture', 'Dragon Ranger Gaming', 9, 'cypher brimstone fade waylay phoenix', 'Xi Lai Gaming', 13, 'waylay brimstone cypher tejo skye'],
  ['london', 'split', 'Dragon Ranger Gaming', 11, 'jett vyse phoenix fade astra', 'Xi Lai Gaming', 13, 'viper skye omen raze waylay'],
  // vlr.gg/684617: GE vs FS
  ['london', 'split', 'Global Esports', 9, 'fade omen sage raze viper', 'FULL SENSE', 13, 'jett sage fade viper omen'],
  ['london', 'breeze', 'Global Esports', 13, 'chamber sova neon sage viper', 'FULL SENSE', 8, 'jett sage viper omen sova'],
  ['london', 'pearl', 'Global Esports', 13, 'killjoy phoenix astra fade neon', 'FULL SENSE', 8, 'jett vyse astra phoenix fade'],
  // vlr.gg/684619: FUT vs NRG
  ['london', 'lotus', 'FUT Esports', 11, 'fade omen raze neon vyse', 'NRG', 13, 'omen viper vyse fade raze'],
  ['london', 'haven', 'FUT Esports', 14, 'sova cypher waylay omen jett', 'NRG', 12, 'cypher sova phoenix jett omen'],
  ['london', 'fracture', 'FUT Esports', 13, 'brimstone raze jett cypher fade', 'NRG', 11, 'cypher phoenix waylay fade brimstone'],
  // vlr.gg/670466: PRX vs LEV
  ['london', 'ascent', 'Paper Rex', 13, 'vyse yoru sova sage omen', 'LEVIATAN', 1, 'phoenix sova chamber neon omen'],
  ['london', 'lotus', 'Paper Rex', 13, 'skye jett vyse raze omen', 'LEVIATAN', 10, 'jett omen skye vyse raze'],
  // vlr.gg/670467: TH vs VIT (Breeze left out: agents swapped mid-map)
  ['london', 'lotus', 'Team Heretics', 7, 'neon vyse raze fade omen', 'Team Vitality', 13, 'raze omen vyse viper fade'],
  // vlr.gg/670465: EDG vs FUT
  ['london', 'haven', 'EDward Gaming', 4, 'waylay raze omen skye cypher', 'FUT Esports', 13, 'omen jett waylay cypher sova'],
  ['london', 'pearl', 'EDward Gaming', 14, 'omen jett phoenix vyse fade', 'FUT Esports', 12, 'jett kayo astra chamber fade'],
  ['london', 'fracture', 'EDward Gaming', 13, 'neon brimstone fade cypher phoenix', 'FUT Esports', 5, 'jett brimstone raze fade cypher'],
  // vlr.gg/684618: GE vs XLG
  ['london', 'haven', 'Global Esports', 13, 'omen sova deadlock neon cypher', 'Xi Lai Gaming', 10, 'jett cypher sova omen phoenix'],
  ['london', 'lotus', 'Global Esports', 9, 'jett raze vyse omen skye', 'Xi Lai Gaming', 13, 'sage omen deadlock fade cypher'],
  ['london', 'breeze', 'Global Esports', 10, 'neon sova sage viper chamber', 'Xi Lai Gaming', 13, 'omen sova viper phoenix jett'],
  // vlr.gg/670464: G2 vs XLG
  ['london', 'lotus', 'G2 Esports', 13, 'viper vyse raze fade omen', 'Xi Lai Gaming', 7, 'cypher omen fade sage deadlock'],
  ['london', 'ascent', 'G2 Esports', 4, 'phoenix sova omen neon vyse', 'Xi Lai Gaming', 13, 'cypher omen sova jett phoenix'],
  ['london', 'split', 'G2 Esports', 9, 'vyse fade raze viper astra', 'Xi Lai Gaming', 13, 'viper raze skye omen waylay'],
  // vlr.gg/670473: LEV vs TH
  ['london', 'split', 'LEVIATAN', 13, 'neon fade phoenix omen viper', 'Team Heretics', 3, 'vyse neon fade astra raze'],
  ['london', 'lotus', 'LEVIATAN', 11, 'jett raze omen skye vyse', 'Team Heretics', 13, 'neon vyse fade omen raze'],
  ['london', 'ascent', 'LEVIATAN', 13, 'phoenix chamber sova omen neon', 'Team Heretics', 6, 'sova cypher neon jett omen'],
  // vlr.gg/670472: G2 vs FUT
  ['london', 'ascent', 'G2 Esports', 6, 'sova vyse phoenix omen waylay', 'FUT Esports', 13, 'cypher omen sova sage jett'],
  ['london', 'lotus', 'G2 Esports', 13, 'raze viper omen fade vyse', 'FUT Esports', 15, 'raze neon omen fade vyse'],
  // vlr.gg/670468: XLG vs EDG
  ['london', 'lotus', 'Xi Lai Gaming', 10, 'cypher sage omen fade deadlock', 'EDward Gaming', 13, 'omen vyse raze jett skye'],
  ['london', 'breeze', 'Xi Lai Gaming', 13, 'phoenix viper jett sova omen', 'EDward Gaming', 10, 'viper sova kayo jett harbor'],
  ['london', 'split', 'Xi Lai Gaming', 3, 'viper omen raze waylay skye', 'EDward Gaming', 13, 'jett raze omen skye viper'],
  // vlr.gg/670469: PRX vs VIT
  ['london', 'breeze', 'Paper Rex', 13, 'viper sova jett neon omen', 'Team Vitality', 3, 'jett viper harbor kayo sova'],
  ['london', 'split', 'Paper Rex', 6, 'raze omen skye viper jett', 'Team Vitality', 13, 'jett viper raze omen skye'],
  ['london', 'fracture', 'Paper Rex', 13, 'brimstone breach raze killjoy skye', 'Team Vitality', 6, 'brimstone cypher fade raze phoenix'],
  // vlr.gg/670475: XLG vs LEV
  ['london', 'haven', 'Xi Lai Gaming', 7, 'jett sova phoenix cypher omen', 'LEVIATAN', 13, 'neon phoenix sova astra chamber'],
  ['london', 'lotus', 'Xi Lai Gaming', 3, 'sage omen fade cypher deadlock', 'LEVIATAN', 13, 'jett omen skye raze vyse'],
  // vlr.gg/670474: VIT vs FUT
  ['london', 'lotus', 'Team Vitality', 13, 'raze omen fade vyse viper', 'FUT Esports', 7, 'neon vyse fade raze omen'],
  ['london', 'ascent', 'Team Vitality', 13, 'jett omen vyse phoenix sova', 'FUT Esports', 2, 'sova omen cypher jett sage'],
  // vlr.gg/670470: EDG vs PRX
  ['london', 'breeze', 'EDward Gaming', 15, 'viper jett kayo sova harbor', 'Paper Rex', 13, 'omen jett sova viper neon'],
  ['london', 'fracture', 'EDward Gaming', 12, 'phoenix cypher brimstone fade neon', 'Paper Rex', 14, 'raze breach killjoy skye brimstone'],
  ['london', 'split', 'EDward Gaming', 6, 'skye viper raze omen jett', 'Paper Rex', 13, 'skye viper jett omen raze'],
  // vlr.gg/670476: VIT vs LEV (Lotus left out: agents swapped mid-map)
  ['london', 'split', 'Team Vitality', 4, 'viper skye omen raze jett', 'LEVIATAN', 13, 'neon fade phoenix viper omen'],
  // vlr.gg/670477: EDG vs LEV
  ['london', 'haven', 'EDward Gaming', 5, 'neon cypher raze skye omen', 'LEVIATAN', 13, 'astra phoenix chamber neon sova'],
  ['london', 'pearl', 'EDward Gaming', 9, 'fade jett phoenix astra vyse', 'LEVIATAN', 13, 'phoenix astra chamber neon sova'],
  ['london', 'split', 'EDward Gaming', 11, 'skye viper jett omen raze', 'LEVIATAN', 13, 'viper omen neon fade phoenix'],
  // vlr.gg/670471: PRX vs LEV
  ['london', 'fracture', 'Paper Rex', 13, 'raze brimstone skye breach killjoy', 'LEVIATAN', 2, 'brimstone breach waylay tejo neon'],
  ['london', 'split', 'Paper Rex', 6, 'jett skye raze omen viper', 'LEVIATAN', 13, 'phoenix omen fade neon viper'],
  ['london', 'breeze', 'Paper Rex', 13, 'sova jett viper omen neon', 'LEVIATAN', 11, 'sova jett neon omen harbor'],
  ['london', 'ascent', 'Paper Rex', 10, 'sage sova omen yoru vyse', 'LEVIATAN', 13, 'neon sova chamber omen phoenix'],
  ['london', 'lotus', 'Paper Rex', 5, 'skye jett raze vyse omen', 'LEVIATAN', 13, 'skye omen jett vyse raze'],
  // Masters Santiago 2026
  // vlr.gg/625788: GM vs EDG
  ['santiago', 'haven', 'Gentle Mates', 13, 'cypher sova yoru neon astra', 'EDward Gaming', 11, 'chamber neon sova omen viper'],
  ['santiago', 'pearl', 'Gentle Mates', 13, 'yoru astra cypher fade neon', 'EDward Gaming', 7, 'killjoy yoru astra neon sova'],
  // vlr.gg/625791: XLG vs NRG
  ['santiago', 'haven', 'Xi Lai Gaming', 2, 'viper neon killjoy omen sova', 'NRG', 13, 'neon viper killjoy sova omen'],
  ['santiago', 'abyss', 'Xi Lai Gaming', 10, 'omen astra yoru sova waylay', 'NRG', 13, 'omen sova tejo viper waylay'],
  // vlr.gg/625790: G2 vs PRX
  ['santiago', 'split', 'G2 Esports', 9, 'viper astra fade neon waylay', 'Paper Rex', 13, 'fade omen viper yoru raze'],
  ['santiago', 'corrode', 'G2 Esports', 5, 'astra skye iso viper waylay', 'Paper Rex', 13, 'viper vyse fade omen waylay'],
  // vlr.gg/625789: T1 vs TL
  ['santiago', 'breeze', 'T1', 8, 'sova viper yoru jett astra', 'Team Liquid', 13, 'neon yoru sova viper omen'],
  ['santiago', 'split', 'T1', 13, 'fade yoru raze omen viper', 'Team Liquid', 15, 'omen skye viper neon waylay'],
  // vlr.gg/626529: PRX vs NRG
  ['santiago', 'split', 'Paper Rex', 13, 'fade omen viper raze yoru', 'NRG', 10, 'omen skye vyse neon viper'],
  ['santiago', 'pearl', 'Paper Rex', 10, 'fade raze yoru astra veto', 'NRG', 13, 'killjoy waylay tejo astra sova'],
  ['santiago', 'haven', 'Paper Rex', 13, 'chamber omen fade phoenix yoru', 'NRG', 11, 'viper neon killjoy sova omen'],
  // vlr.gg/626530: GM vs TL
  ['santiago', 'pearl', 'Gentle Mates', 13, 'yoru fade cypher neon astra', 'Team Liquid', 11, 'waylay viper skye neon harbor'],
  ['santiago', 'bind', 'Gentle Mates', 13, 'yoru fade viper astra waylay', 'Team Liquid', 3, 'brimstone viper skye waylay neon'],
  // vlr.gg/626532: EDG vs T1
  ['santiago', 'bind', 'EDward Gaming', 1, 'chamber brimstone viper neon skye', 'T1', 13, 'fade waylay brimstone viper yoru'],
  ['santiago', 'haven', 'EDward Gaming', 10, 'chamber viper sova omen neon', 'T1', 13, 'omen viper sova neon killjoy'],
  // vlr.gg/626533: XLG vs G2
  ['santiago', 'abyss', 'Xi Lai Gaming', 8, 'astra omen yoru waylay sova', 'G2 Esports', 13, 'astra harbor waylay sova neon'],
  ['santiago', 'haven', 'Xi Lai Gaming', 3, 'viper killjoy sova neon omen', 'G2 Esports', 13, 'phoenix yoru fade chamber astra'],
  // vlr.gg/626535: NRG vs TL
  ['santiago', 'breeze', 'NRG', 13, 'jett yoru sova viper omen', 'Team Liquid', 11, 'sova omen viper yoru neon'],
  ['santiago', 'abyss', 'NRG', 13, 'omen viper tejo sova waylay', 'Team Liquid', 4, 'yoru astra harbor neon skye'],
  // vlr.gg/626534: G2 vs T1
  ['santiago', 'breeze', 'G2 Esports', 13, 'viper neon sova yoru astra', 'T1', 6, 'yoru astra jett viper sova'],
  ['santiago', 'haven', 'G2 Esports', 16, 'fade phoenix astra chamber yoru', 'T1', 14, 'cypher omen yoru iso sova'],
  // vlr.gg/626539: FURIA vs PRX
  ['santiago', 'haven', 'FURIA', 13, 'sova viper killjoy omen neon', 'Paper Rex', 9, 'chamber yoru omen phoenix fade'],
  ['santiago', 'breeze', 'FURIA', 4, 'yoru sova viper neon omen', 'Paper Rex', 13, 'jett viper omen sova yoru'],
  ['santiago', 'split', 'FURIA', 7, 'fade yoru omen viper waylay', 'Paper Rex', 13, 'yoru viper fade raze omen'],
  // vlr.gg/626537: NS vs GM
  ['santiago', 'haven', 'Nongshim RedForce', 13, 'killjoy omen sova neon yoru', 'Gentle Mates', 10, 'yoru astra sova cypher neon'],
  ['santiago', 'corrode', 'Nongshim RedForce', 13, 'yoru neon fade viper omen', 'Gentle Mates', 10, 'astra phoenix sova neon kayo'],
  // vlr.gg/626540: BBL vs NRG
  ['santiago', 'pearl', 'BBL Esports', 6, 'yoru astra cypher sova neon', 'NRG', 13, 'astra killjoy tejo waylay sova'],
  ['santiago', 'abyss', 'BBL Esports', 13, 'waylay omen yoru cypher sova', 'NRG', 6, 'tejo viper waylay sova omen'],
  ['santiago', 'split', 'BBL Esports', 15, 'omen yoru viper neon fade', 'NRG', 17, 'vyse skye omen neon viper'],
  // vlr.gg/626538: AG vs G2
  ['santiago', 'split', 'All Gamers', 6, 'waylay viper skye omen raze', 'G2 Esports', 13, 'waylay astra fade viper neon'],
  ['santiago', 'abyss', 'All Gamers', 4, 'astra waylay harbor sova yoru', 'G2 Esports', 13, 'harbor waylay sova neon astra'],
  // vlr.gg/626546: FURIA vs BBL
  ['santiago', 'haven', 'FURIA', 7, 'sova viper omen neon killjoy', 'BBL Esports', 13, 'yoru cypher omen neon sova'],
  ['santiago', 'breeze', 'FURIA', 13, 'sova neon yoru viper omen', 'BBL Esports', 10, 'jett sova viper cypher yoru'],
  ['santiago', 'abyss', 'FURIA', 11, 'sova astra waylay omen tejo', 'BBL Esports', 13, 'omen cypher sova waylay yoru'],
  // vlr.gg/626545: GM vs AG
  ['santiago', 'pearl', 'Gentle Mates', 13, 'yoru fade neon cypher astra', 'All Gamers', 5, 'fade killjoy yoru astra waylay'],
  ['santiago', 'split', 'Gentle Mates', 4, 'yoru fade astra viper raze', 'All Gamers', 13, 'omen raze viper skye waylay'],
  ['santiago', 'bind', 'Gentle Mates', 8, 'yoru fade waylay viper astra', 'All Gamers', 13, 'raze brimstone yoru viper fade'],
  // vlr.gg/626541: NS vs G2
  ['santiago', 'abyss', 'Nongshim RedForce', 7, 'waylay sova omen astra yoru', 'G2 Esports', 13, 'waylay sova astra harbor neon'],
  ['santiago', 'corrode', 'Nongshim RedForce', 13, 'neon viper yoru omen fade', 'G2 Esports', 7, 'viper skye iso astra waylay'],
  ['santiago', 'split', 'Nongshim RedForce', 14, 'fade neon yoru viper omen', 'G2 Esports', 12, 'viper astra fade waylay neon'],
  // vlr.gg/626542: PRX vs NRG
  ['santiago', 'pearl', 'Paper Rex', 12, 'yoru astra vyse phoenix sova', 'NRG', 14, 'astra waylay killjoy sova tejo'],
  ['santiago', 'bind', 'Paper Rex', 11, 'skye brimstone gekko raze harbor', 'NRG', 13, 'viper yoru brimstone fade raze'],
  // vlr.gg/626548: G2 vs BBL
  ['santiago', 'haven', 'G2 Esports', 13, 'phoenix astra yoru fade chamber', 'BBL Esports', 5, 'yoru sova omen cypher neon'],
  ['santiago', 'breeze', 'G2 Esports', 13, 'sova yoru astra neon viper', 'BBL Esports', 8, 'jett viper cypher yoru sova'],
  // vlr.gg/626547: PRX vs AG
  ['santiago', 'corrode', 'Paper Rex', 10, 'fade omen viper waylay vyse', 'All Gamers', 13, 'omen fade viper chamber neon'],
  ['santiago', 'pearl', 'Paper Rex', 13, 'yoru vyse sova neon astra', 'All Gamers', 7, 'yoru fade killjoy astra neon'],
  ['santiago', 'split', 'Paper Rex', 13, 'yoru raze fade viper omen', 'All Gamers', 4, 'skye raze viper waylay omen'],
  // vlr.gg/626543: NS vs NRG (first header misread; Brimstone and Viper on both sides, so Bind; checked against the map counts)
  ['santiago', 'bind', 'Nongshim RedForce', 13, 'yoru brimstone neon fade viper', 'NRG', 9, 'viper raze brimstone fade yoru'],
  ['santiago', 'abyss', 'Nongshim RedForce', 13, 'yoru cypher sova omen waylay', 'NRG', 11, 'omen viper sova waylay tejo'],
  // vlr.gg/626549: PRX vs G2
  ['santiago', 'haven', 'Paper Rex', 11, 'chamber phoenix omen yoru fade', 'G2 Esports', 13, 'phoenix astra fade yoru chamber'],
  ['santiago', 'breeze', 'Paper Rex', 13, 'jett yoru sova omen viper', 'G2 Esports', 9, 'sova neon astra viper yoru'],
  ['santiago', 'corrode', 'Paper Rex', 13, 'waylay vyse omen viper fade', 'G2 Esports', 4, 'neon vyse yoru fade astra'],
  // vlr.gg/626550: NRG vs PRX
  ['santiago', 'pearl', 'NRG', 13, 'killjoy waylay tejo sova astra', 'Paper Rex', 8, 'sova astra yoru vyse neon'],
  ['santiago', 'split', 'NRG', 7, 'viper neon omen skye vyse', 'Paper Rex', 13, 'yoru viper fade raze omen'],
  ['santiago', 'corrode', 'NRG', 6, 'viper omen waylay sova skye', 'Paper Rex', 13, 'vyse viper fade omen waylay'],
  ['santiago', 'breeze', 'NRG', 9, 'viper yoru omen sova jett', 'Paper Rex', 13, 'omen yoru viper sova jett'],
  // vlr.gg/626544: NS vs PRX
  ['santiago', 'corrode', 'Nongshim RedForce', 13, 'fade viper omen neon yoru', 'Paper Rex', 11, 'omen waylay vyse viper fade'],
  ['santiago', 'split', 'Nongshim RedForce', 13, 'viper fade yoru neon omen', 'Paper Rex', 4, 'omen fade viper raze yoru'],
  ['santiago', 'abyss', 'Nongshim RedForce', 13, 'sova yoru waylay cypher omen', 'Paper Rex', 3, 'vyse omen yoru sova waylay'],
];

export const LINEUPS: readonly Lineup[] = ROWS.map(([event, map, a, ra, aa, b, rb, ab]) => ({
  event,
  map,
  teams: [{ team: a, rounds: ra, agents: aa.split(' ') }, { team: b, rounds: rb, agents: ab.split(' ') }],
}));

/** A team's lineup won the map. */
export const won = (l: Lineup, i: 0 | 1): boolean => l.teams[i].rounds > l.teams[1 - i]!.rounds;
