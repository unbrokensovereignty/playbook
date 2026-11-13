/**
 * Ranked play on each map: how often each agent's team won its games there, and how many games
 * that is, and the share of rounds each side wins. The engine counts an agent's win rate on a map
 * only as far as it differs from their win rate on the others by more than chance would (MAP_WIN
 * in engine/weights.ts): most of the difference between maps is chance, even with thousands of games.
 *
 * Source: metabot.gg, competitive games at all ranks, regions and platforms, each map as of the date
 * given (`on`). `games` are the agent's games on the map. Icebox had no games there. The two sides'
 * rates come as the source gives them and don't quite add up to 100, so they're read as shares of
 * their sum (sideShare).
 */
export interface MapWins {
  on: string;
  /** Rounds won by each side, in percent. */
  attack: number;
  defense: number;
  /** Agent id: [win rate in percent, games]. */
  agents: Record<string, readonly [win: number, games: number]>;
}

export const MAP_WINS: Record<string, MapWins> = {
  abyss: {
    on: '2026-11-05', attack: 51.4, defense: 49.6,
    agents: {
      astra: [47.6, 1370], breach: [57.1, 56], brimstone: [49.2, 61], chamber: [51.1, 5617],
      clove: [54.7, 5762], cypher: [52.1, 743], deadlock: [48.2, 195], fade: [34.8, 89],
      gekko: [53.5, 86], harbor: [48.2, 164], hush: [49.3, 284], iso: [52.8, 881], jett: [51.8, 6448],
      kayo: [50.2, 213], killjoy: [64.7, 17], miks: [47.9, 71], neon: [52.5, 1335], omen: [45.4, 884],
      phoenix: [52.8, 396], raze: [39.5, 129], reyna: [50.1, 2689], sage: [50.8, 193], skye: [47.2, 89],
      sova: [52.0, 6798], tejo: [49.8, 245], veto: [51.1, 577], viper: [31.3, 32], vyse: [53.1, 768],
      waylay: [51.2, 3024], yoru: [48.7, 2631]
    },
  },
  ascent: {
    on: '2026-11-01', attack: 45.8, defense: 54.7,
    agents: {
      astra: [43.8, 48], breach: [43.9, 41], brimstone: [45.2, 93], chamber: [47.6, 2023],
      clove: [53.4, 5318], cypher: [51.2, 1796], deadlock: [46.8, 186], fade: [47.4, 116],
      gekko: [48.2, 56], harbor: [28.6, 35], iso: [49.8, 233], jett: [49.6, 6996], kayo: [49.0, 390],
      killjoy: [50.2, 2370], miks: [48.1, 233], neon: [50.1, 914], omen: [47.9, 1761],
      phoenix: [50.4, 3369], raze: [49.8, 243], reyna: [47.0, 2633], sage: [56.4, 305],
      skye: [36.4, 132], sova: [51.0, 6212], tejo: [46.4, 69], veto: [52.9, 85], viper: [50.0, 20],
      vyse: [47.6, 489], waylay: [47.0, 661], yoru: [49.5, 416]
    },
  },
  bind: {
    on: '2026-11-06', attack: 47.0, defense: 53.9,
    agents: {
      astra: [43.3, 60], breach: [40.5, 42], brimstone: [50.2, 1155], chamber: [50.9, 4390],
      clove: [52.7, 5756], cypher: [51.6, 1089], deadlock: [51.2, 699], fade: [53.0, 2492],
      gekko: [49.1, 108], harbor: [30.4, 46], hush: [53.1, 350], iso: [47.3, 264], jett: [50.2, 2978],
      kayo: [51.4, 70], killjoy: [59.4, 69], miks: [47.4, 346], neon: [51.0, 1510], omen: [48.3, 118],
      phoenix: [52.0, 540], raze: [51.3, 3257], reyna: [51.2, 2306], sage: [45.5, 222],
      skye: [52.6, 3131], sova: [49.5, 299], tejo: [52.0, 271], veto: [51.0, 239], viper: [53.4, 805],
      vyse: [65.8, 76], waylay: [50.8, 1974], yoru: [51.1, 2219]
    },
  },
  breeze: {
    on: '2026-11-06', attack: 49.8, defense: 50.9,
    agents: {
      astra: [47.1, 2028], breach: [40.5, 37], brimstone: [44.3, 122], chamber: [51.3, 8560],
      clove: [52.1, 3606], cypher: [54.8, 540], deadlock: [57.6, 85], fade: [46.4, 97],
      gekko: [48.1, 104], harbor: [51.1, 958], iso: [47.8, 774], jett: [51.5, 10033], kayo: [40.1, 299],
      killjoy: [45.2, 31], miks: [53.1, 405], neon: [50.9, 2960], omen: [49.0, 584],
      phoenix: [51.4, 666], raze: [49.3, 136], reyna: [50.4, 4665], sage: [51.2, 320],
      skye: [52.1, 188], sova: [51.9, 8999], tejo: [46.4, 84], veto: [48.4, 159], viper: [51.0, 5274],
      vyse: [53.2, 94], waylay: [48.3, 718], yoru: [49.2, 2651]
    },
  },
  corrode: {
    on: '2026-11-05', attack: 49.5, defense: 51.5,
    agents: {
      astra: [42.2, 102], breach: [50.0, 50], brimstone: [49.2, 61], chamber: [50.8, 3300],
      clove: [52.6, 5367], cypher: [53.0, 315], deadlock: [50.8, 384], fade: [51.3, 4487],
      gekko: [34.4, 32], harbor: [46.8, 47], hush: [47.4, 291], iso: [45.4, 313], jett: [51.1, 2421],
      kayo: [44.6, 157], killjoy: [38.1, 21], miks: [30.0, 30], neon: [54.3, 2050], omen: [51.1, 808],
      phoenix: [47.5, 484], raze: [52.9, 204], reyna: [50.1, 2215], sage: [51.4, 321],
      skye: [55.8, 129], sova: [52.3, 623], tejo: [52.7, 150], veto: [53.1, 356], viper: [51.1, 413],
      vyse: [53.9, 1281], waylay: [50.4, 3282], yoru: [50.7, 1828]
    },
  },
  fracture: {
    on: '2026-11-06', attack: 48.3, defense: 51.6,
    agents: {
      astra: [31.1, 61], breach: [45.9, 1007], brimstone: [49.9, 1119], chamber: [47.7, 2364],
      clove: [51.2, 1738], cypher: [51.5, 643], deadlock: [36.1, 72], fade: [55.8, 471],
      gekko: [60.7, 28], harbor: [19.4, 31], iso: [48.0, 273], jett: [49.2, 2642], kayo: [35.4, 65],
      killjoy: [46.4, 407], miks: [45.5, 666], neon: [50.7, 1223], omen: [36.8, 68],
      phoenix: [56.7, 824], raze: [52.3, 824], reyna: [49.1, 1399], sage: [47.0, 132],
      skye: [50.7, 211], sova: [44.4, 54], tejo: [50.2, 1719], veto: [47.5, 101], viper: [36.4, 33],
      vyse: [50.7, 144], waylay: [49.2, 723], yoru: [37.8, 82]
    },
  },
  haven: {
    on: '2026-11-05', attack: 48.8, defense: 52.1,
    agents: {
      astra: [47.3, 129], breach: [48.6, 255], brimstone: [51.8, 137], chamber: [48.7, 5500],
      clove: [52.6, 10928], cypher: [52.3, 3702], deadlock: [53.2, 124], fade: [52.3, 258],
      gekko: [51.0, 98], harbor: [37.7, 69], hush: [54.1, 257], iso: [47.5, 889], jett: [49.8, 11540],
      kayo: [43.7, 151], killjoy: [53.6, 3404], miks: [48.5, 555], neon: [52.8, 4587],
      omen: [48.8, 2713], phoenix: [53.2, 4364], raze: [51.5, 435], reyna: [50.3, 5198],
      sage: [48.5, 427], skye: [48.0, 369], sova: [51.9, 11912], tejo: [51.2, 123], veto: [47.4, 213],
      viper: [50.2, 213], vyse: [49.5, 101], waylay: [48.3, 1348], yoru: [52.0, 2278]
    },
  },
  lotus: {
    on: '2026-11-05', attack: 50.7, defense: 49.6,
    agents: {
      astra: [49.4, 79], breach: [47.9, 428], brimstone: [45.9, 109], chamber: [50.0, 5687],
      clove: [51.9, 6745], cypher: [53.9, 527], deadlock: [54.3, 223], fade: [51.2, 6672],
      gekko: [46.8, 203], harbor: [34.1, 44], hush: [47.5, 276], iso: [50.4, 972], jett: [49.4, 5412],
      kayo: [44.9, 98], killjoy: [51.1, 550], miks: [47.5, 669], neon: [51.0, 3575], omen: [45.3, 1873],
      phoenix: [51.1, 1127], raze: [48.6, 4003], reyna: [50.0, 3081], sage: [51.4, 311],
      skye: [42.6, 505], sova: [47.4, 289], tejo: [51.0, 263], veto: [49.3, 209], viper: [50.8, 392],
      vyse: [51.6, 1830], waylay: [52.7, 1386], yoru: [46.9, 554]
    },
  },
  pearl: {
    on: '2026-11-06', attack: 48.0, defense: 52.8,
    agents: {
      astra: [49.4, 1689], breach: [43.3, 30], brimstone: [39.6, 91], chamber: [50.8, 5836],
      clove: [53.2, 6550], cypher: [50.9, 342], deadlock: [51.5, 97], fade: [51.0, 6282],
      gekko: [42.7, 96], harbor: [39.1, 110], iso: [47.5, 493], jett: [50.5, 6015], kayo: [49.5, 190],
      killjoy: [52.0, 1477], miks: [49.9, 519], neon: [51.3, 2605], omen: [46.5, 185],
      phoenix: [51.5, 2306], raze: [53.0, 200], reyna: [50.0, 3070], sage: [45.6, 193],
      skye: [47.1, 189], sova: [52.5, 853], tejo: [51.2, 410], veto: [47.7, 214], viper: [56.1, 57],
      vyse: [49.7, 662], waylay: [50.8, 2075], yoru: [50.3, 2163]
    },
  },
  split: {
    on: '2026-11-01', attack: 47.8, defense: 52.9,
    agents: {
      astra: [48.2, 272], breach: [46.2, 407], brimstone: [49.6, 131], chamber: [49.9, 4883],
      clove: [52.6, 10726], cypher: [51.5, 3435], deadlock: [49.2, 522], fade: [53.0, 3348],
      gekko: [38.9, 95], harbor: [38.5, 52], iso: [42.9, 576], jett: [49.0, 7507], kayo: [47.4, 137],
      killjoy: [54.7, 316], miks: [47.8, 621], neon: [54.4, 2877], omen: [48.3, 2028],
      phoenix: [50.5, 1403], raze: [51.2, 5674], reyna: [48.9, 4710], sage: [52.9, 3036],
      skye: [51.3, 6573], sova: [50.7, 213], tejo: [48.1, 620], veto: [46.9, 486], viper: [50.4, 1522],
      vyse: [47.0, 460], waylay: [49.1, 2774], yoru: [50.1, 1934]
    },
  },
  summit: {
    on: '2026-11-05', attack: 47.5, defense: 52.9,
    agents: {
      astra: [48.3, 174], breach: [42.4, 66], brimstone: [48.5, 101], chamber: [46.8, 2732],
      clove: [51.4, 4270], cypher: [50.8, 1552], deadlock: [53.0, 198], fade: [51.2, 3407],
      gekko: [49.5, 111], harbor: [54.4, 171], hush: [51.2, 291], iso: [50.3, 296], jett: [50.5, 3487],
      kayo: [45.2, 115], killjoy: [50.8, 126], miks: [51.2, 127], neon: [51.0, 2156], omen: [47.6, 702],
      phoenix: [51.5, 1510], raze: [49.3, 351], reyna: [50.8, 2331], sage: [53.2, 878],
      skye: [49.2, 299], sova: [47.7, 709], tejo: [49.7, 197], veto: [44.5, 164], viper: [50.6, 87],
      vyse: [53.9, 332], waylay: [47.6, 1001], yoru: [50.9, 519]
    },
  },
  sunset: {
    on: '2026-11-05', attack: 48.6, defense: 51.9,
    agents: {
      astra: [40.6, 32], breach: [43.4, 145], brimstone: [56.9, 65], chamber: [47.7, 2545],
      clove: [52.2, 4399], cypher: [52.9, 1628], deadlock: [51.1, 270], fade: [52.0, 589],
      gekko: [51.7, 205], harbor: [47.8, 23], hush: [54.2, 238], iso: [50.8, 325], jett: [49.1, 2839],
      kayo: [45.3, 86], killjoy: [53.5, 43], miks: [45.9, 159], neon: [51.8, 2661], omen: [47.7, 813],
      phoenix: [52.2, 1566], raze: [47.7, 1034], reyna: [50.9, 1956], sage: [46.6, 399],
      skye: [49.7, 175], sova: [52.4, 3743], tejo: [47.0, 83], veto: [48.4, 188], viper: [53.6, 28],
      vyse: [51.5, 493], waylay: [49.4, 621], yoru: [51.7, 480]
    },
  },
};

/** The share of rounds a side wins on a map, 0 to 1 (undefined without numbers). */
export function sideShare(map: string, side: 'attack' | 'defense'): number | undefined {
  const m = MAP_WINS[map];
  return m && m[side] / (m.attack + m.defense);
}
