/**
 * Ranked play on each map: how often each agent's team won its games there, and how many games
 * that is, and the share of rounds each side wins. The engine counts an agent's win rate on a map
 * only as far as it differs from their win rate on the others by more than chance would (MAP_WIN
 * in engine/weights.ts): most of the difference between maps is chance, even with thousands of games.
 *
 * Source: metabot.gg, competitive games at all ranks, regions and platforms, each map's page read
 * as of the date given (`on`). `games` are the agent's games on the map. Icebox had no games there.
 * The two sides' rates come as the source gives them and don't quite add up to 100, so they're
 * read as shares of their sum (sideShare).
 *
 * Each map keeps its reads, newest first. The seven maps in the pool were read again on 19 and 20
 * November 2026, and those pages count only patch 13.10's games, ten days of play: a fifth to three
 * fifths as many games as the read of 5 and 6 November, and under 100 games for a third to a half
 * of the agents on each map. Taken alone, a new read would swing the rarely played agents by
 * several points on chance (Breach's 57.1% of 56 games on Abyss is now 48.3% of 29), so the two
 * reads are pooled game by game, with each earlier read's games counting EARLIER as much as the
 * next one's. Those games were played before the patch, which shortened how long Cypher, Killjoy and
 * Vyse wait to get destroyed utility back and changed how Sage's healing orb picks its target. The
 * newer read makes up from 29% (Haven) to 54% (Summit and Sunset) of each pooled map.
 * The other maps keep the numbers they had. Ascent and Split have been out of the pool since 13
 * October, so the few patch 13.10 games metabot.gg shows on them can't come from ranked queues.
 * Breeze, Fracture and Pearl gave back the 6 November numbers game for game when read again.
 */
export interface Read {
  on: string;
  /** Rounds won by each side, in percent. */
  attack: number;
  defense: number;
  /** Agent id: [win rate in percent, games]. */
  agents: Record<string, readonly [win: number, games: number]>;
}

export const READS: Record<string, readonly Read[]> = {
  abyss: [
    {
      on: '2026-11-20', attack: 51.4, defense: 49.1,
      agents: {
        astra: [48.0, 510], breach: [48.3, 29], brimstone: [37.5, 32], chamber: [49.9, 2291],
        clove: [53.1, 1982], cypher: [50.7, 337], deadlock: [47.8, 69], fade: [33.8, 74],
        gekko: [53.7, 41], harbor: [48.2, 137], hush: [48.8, 682], iso: [50.6, 344],
        jett: [51.2, 2575], kayo: [36.5, 63], killjoy: [61.1, 18], miks: [46.8, 77], neon: [51.6, 622],
        omen: [48.3, 362], phoenix: [50.2, 247], raze: [43.8, 64], reyna: [48.2, 1065],
        sage: [49.2, 118], skye: [50.0, 66], sova: [52.4, 2507], tejo: [45.5, 55], veto: [43.8, 96],
        viper: [21.1, 19], vyse: [47.7, 258], waylay: [49.9, 891], yoru: [48.8, 791]
      },
    },
    {
      on: '2026-11-05', attack: 51.4, defense: 49.6,
      agents: {
        astra: [47.6, 1370], breach: [57.1, 56], brimstone: [49.2, 61], chamber: [51.1, 5617],
        clove: [54.7, 5762], cypher: [52.1, 743], deadlock: [48.2, 195], fade: [34.8, 89],
        gekko: [53.5, 86], harbor: [48.2, 164], hush: [49.3, 284], iso: [52.8, 881],
        jett: [51.8, 6448], kayo: [50.2, 213], killjoy: [64.7, 17], miks: [47.9, 71],
        neon: [52.5, 1335], omen: [45.4, 884], phoenix: [52.8, 396], raze: [39.5, 129],
        reyna: [50.1, 2689], sage: [50.8, 193], skye: [47.2, 89], sova: [52.0, 6798],
        tejo: [49.8, 245], veto: [51.1, 577], viper: [31.3, 32], vyse: [53.1, 768],
        waylay: [51.2, 3024], yoru: [48.7, 2631]
      },
    },
  ],
  ascent: [
    {
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
  ],
  bind: [
    {
      on: '2026-11-20', attack: 47.3, defense: 53.2,
      agents: {
        astra: [30.0, 10], breach: [22.7, 22], brimstone: [55.1, 343], chamber: [49.0, 1217],
        clove: [50.2, 1404], cypher: [52.2, 345], deadlock: [47.1, 121], fade: [53.6, 621],
        gekko: [55.6, 27], harbor: [50.0, 14], hush: [49.0, 686], iso: [50.7, 69], jett: [49.4, 779],
        kayo: [44.4, 36], killjoy: [50.0, 34], miks: [47.4, 57], neon: [49.6, 345], omen: [45.9, 61],
        phoenix: [50.9, 214], raze: [50.3, 883], reyna: [50.0, 556], sage: [45.4, 97],
        skye: [51.3, 799], sova: [43.8, 89], tejo: [28.6, 21], veto: [72.1, 43], viper: [50.0, 180],
        vyse: [55.6, 27], waylay: [48.1, 262], yoru: [53.7, 374]
      },
    },
    {
      on: '2026-11-06', attack: 47.0, defense: 53.9,
      agents: {
        astra: [43.3, 60], breach: [40.5, 42], brimstone: [50.2, 1155], chamber: [50.9, 4390],
        clove: [52.7, 5756], cypher: [51.6, 1089], deadlock: [51.2, 699], fade: [53.0, 2492],
        gekko: [49.1, 108], harbor: [30.4, 46], hush: [53.1, 350], iso: [47.3, 264],
        jett: [50.2, 2978], kayo: [51.4, 70], killjoy: [59.4, 69], miks: [47.4, 346],
        neon: [51.0, 1510], omen: [48.3, 118], phoenix: [52.0, 540], raze: [51.3, 3257],
        reyna: [51.2, 2306], sage: [45.5, 222], skye: [52.6, 3131], sova: [49.5, 299],
        tejo: [52.0, 271], veto: [51.0, 239], viper: [53.4, 805], vyse: [65.8, 76],
        waylay: [50.8, 1974], yoru: [51.1, 2219]
      },
    },
  ],
  breeze: [
    {
      on: '2026-11-06', attack: 49.8, defense: 50.9,
      agents: {
        astra: [47.1, 2028], breach: [40.5, 37], brimstone: [44.3, 122], chamber: [51.3, 8560],
        clove: [52.1, 3606], cypher: [54.8, 540], deadlock: [57.6, 85], fade: [46.4, 97],
        gekko: [48.1, 104], harbor: [51.1, 958], iso: [47.8, 774], jett: [51.5, 10033],
        kayo: [40.1, 299], killjoy: [45.2, 31], miks: [53.1, 405], neon: [50.9, 2960],
        omen: [49.0, 584], phoenix: [51.4, 666], raze: [49.3, 136], reyna: [50.4, 4665],
        sage: [51.2, 320], skye: [52.1, 188], sova: [51.9, 8999], tejo: [46.4, 84], veto: [48.4, 159],
        viper: [51.0, 5274], vyse: [53.2, 94], waylay: [48.3, 718], yoru: [49.2, 2651]
      },
    },
  ],
  corrode: [
    {
      on: '2026-11-20', attack: 49.6, defense: 50.5,
      agents: {
        astra: [45.8, 24], breach: [38.9, 18], brimstone: [50.0, 40], chamber: [48.4, 1051],
        clove: [51.2, 1473], cypher: [48.6, 179], deadlock: [49.4, 83], fade: [48.8, 1368],
        gekko: [41.2, 17], harbor: [41.2, 17], hush: [49.7, 690], iso: [47.8, 90], jett: [46.9, 806],
        kayo: [37.2, 43], killjoy: [43.8, 16], miks: [39.6, 53], neon: [54.2, 666], omen: [44.6, 276],
        phoenix: [49.5, 291], raze: [53.0, 83], reyna: [46.7, 660], sage: [45.5, 189],
        skye: [47.8, 67], sova: [48.4, 161], tejo: [52.8, 36], veto: [41.7, 48], viper: [45.5, 66],
        vyse: [51.2, 402], waylay: [52.3, 599], yoru: [53.9, 319]
      },
    },
    {
      on: '2026-11-05', attack: 49.5, defense: 51.5,
      agents: {
        astra: [42.2, 102], breach: [50.0, 50], brimstone: [49.2, 61], chamber: [50.8, 3300],
        clove: [52.6, 5367], cypher: [53.0, 315], deadlock: [50.8, 384], fade: [51.3, 4487],
        gekko: [34.4, 32], harbor: [46.8, 47], hush: [47.4, 291], iso: [45.4, 313], jett: [51.1, 2421],
        kayo: [44.6, 157], killjoy: [38.1, 21], miks: [30.0, 30], neon: [54.3, 2050],
        omen: [51.1, 808], phoenix: [47.5, 484], raze: [52.9, 204], reyna: [50.1, 2215],
        sage: [51.4, 321], skye: [55.8, 129], sova: [52.3, 623], tejo: [52.7, 150], veto: [53.1, 356],
        viper: [51.1, 413], vyse: [53.9, 1281], waylay: [50.4, 3282], yoru: [50.7, 1828]
      },
    },
  ],
  fracture: [
    {
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
  ],
  haven: [
    {
      on: '2026-11-20', attack: 49.2, defense: 51.7,
      agents: {
        astra: [47.4, 19], breach: [48.6, 37], brimstone: [46.3, 41], chamber: [48.7, 1319],
        clove: [52.4, 2242], cypher: [52.5, 917], deadlock: [50.0, 36], fade: [56.1, 66],
        gekko: [53.3, 30], harbor: [63.2, 19], hush: [52.6, 603], iso: [48.8, 121], jett: [50.6, 2077],
        kayo: [49.0, 51], killjoy: [54.9, 326], miks: [35.5, 62], neon: [52.4, 1081],
        omen: [45.0, 511], phoenix: [52.8, 1027], raze: [58.0, 88], reyna: [50.7, 936],
        sage: [51.3, 115], skye: [50.0, 90], sova: [51.6, 2289], tejo: [52.0, 25], veto: [50.0, 32],
        viper: [45.0, 20], vyse: [35.0, 20], waylay: [52.6, 175], yoru: [51.5, 336]
      },
    },
    {
      on: '2026-11-05', attack: 48.8, defense: 52.1,
      agents: {
        astra: [47.3, 129], breach: [48.6, 255], brimstone: [51.8, 137], chamber: [48.7, 5500],
        clove: [52.6, 10928], cypher: [52.3, 3702], deadlock: [53.2, 124], fade: [52.3, 258],
        gekko: [51.0, 98], harbor: [37.7, 69], hush: [54.1, 257], iso: [47.5, 889],
        jett: [49.8, 11540], kayo: [43.7, 151], killjoy: [53.6, 3404], miks: [48.5, 555],
        neon: [52.8, 4587], omen: [48.8, 2713], phoenix: [53.2, 4364], raze: [51.5, 435],
        reyna: [50.3, 5198], sage: [48.5, 427], skye: [48.0, 369], sova: [51.9, 11912],
        tejo: [51.2, 123], veto: [47.4, 213], viper: [50.2, 213], vyse: [49.5, 101],
        waylay: [48.3, 1348], yoru: [52.0, 2278]
      },
    },
  ],
  lotus: [
    {
      on: '2026-11-19', attack: 50.5, defense: 49.7,
      agents: {
        astra: [55.2, 29], breach: [45.5, 112], brimstone: [45.0, 40], chamber: [50.5, 2210],
        clove: [52.2, 2451], cypher: [51.5, 229], deadlock: [47.6, 63], fade: [50.5, 2295],
        gekko: [53.8, 52], harbor: [29.4, 17], hush: [51.2, 674], iso: [55.1, 263], jett: [49.4, 1548],
        kayo: [44.7, 47], killjoy: [54.7, 139], miks: [44.2, 86], neon: [50.9, 1612],
        omen: [44.9, 537], phoenix: [49.0, 310], raze: [49.5, 1047], reyna: [49.2, 924],
        sage: [46.7, 107], skye: [44.9, 178], sova: [49.0, 98], tejo: [50.9, 57], veto: [43.9, 66],
        viper: [44.4, 126], vyse: [47.6, 502], waylay: [52.1, 361], yoru: [44.4, 333]
      },
    },
    {
      on: '2026-11-05', attack: 50.7, defense: 49.6,
      agents: {
        astra: [49.4, 79], breach: [47.9, 428], brimstone: [45.9, 109], chamber: [50.0, 5687],
        clove: [51.9, 6745], cypher: [53.9, 527], deadlock: [54.3, 223], fade: [51.2, 6672],
        gekko: [46.8, 203], harbor: [34.1, 44], hush: [47.5, 276], iso: [50.4, 972],
        jett: [49.4, 5412], kayo: [44.9, 98], killjoy: [51.1, 550], miks: [47.5, 669],
        neon: [51.0, 3575], omen: [45.3, 1873], phoenix: [51.1, 1127], raze: [48.6, 4003],
        reyna: [50.0, 3081], sage: [51.4, 311], skye: [42.6, 505], sova: [47.4, 289],
        tejo: [51.0, 263], veto: [49.3, 209], viper: [50.8, 392], vyse: [51.6, 1830],
        waylay: [52.7, 1386], yoru: [46.9, 554]
      },
    },
  ],
  pearl: [
    {
      on: '2026-11-06', attack: 48.0, defense: 52.8,
      agents: {
        astra: [49.4, 1689], breach: [43.3, 30], brimstone: [39.6, 91], chamber: [50.8, 5836],
        clove: [53.2, 6550], cypher: [50.9, 342], deadlock: [51.5, 97], fade: [51.0, 6282],
        gekko: [42.7, 96], harbor: [39.1, 110], iso: [47.5, 493], jett: [50.5, 6015],
        kayo: [49.5, 190], killjoy: [52.0, 1477], miks: [49.9, 519], neon: [51.3, 2605],
        omen: [46.5, 185], phoenix: [51.5, 2306], raze: [53.0, 200], reyna: [50.0, 3070],
        sage: [45.6, 193], skye: [47.1, 189], sova: [52.5, 853], tejo: [51.2, 410], veto: [47.7, 214],
        viper: [56.1, 57], vyse: [49.7, 662], waylay: [50.8, 2075], yoru: [50.3, 2163]
      },
    },
  ],
  split: [
    {
      on: '2026-11-01', attack: 47.8, defense: 52.9,
      agents: {
        astra: [48.2, 272], breach: [46.2, 407], brimstone: [49.6, 131], chamber: [49.9, 4883],
        clove: [52.6, 10726], cypher: [51.5, 3435], deadlock: [49.2, 522], fade: [53.0, 3348],
        gekko: [38.9, 95], harbor: [38.5, 52], iso: [42.9, 576], jett: [49.0, 7507], kayo: [47.4, 137],
        killjoy: [54.7, 316], miks: [47.8, 621], neon: [54.4, 2877], omen: [48.3, 2028],
        phoenix: [50.5, 1403], raze: [51.2, 5674], reyna: [48.9, 4710], sage: [52.9, 3036],
        skye: [51.3, 6573], sova: [50.7, 213], tejo: [48.1, 620], veto: [46.9, 486],
        viper: [50.4, 1522], vyse: [47.0, 460], waylay: [49.1, 2774], yoru: [50.1, 1934]
      },
    },
  ],
  summit: [
    {
      on: '2026-11-20', attack: 47.7, defense: 52.7,
      agents: {
        astra: [51.5, 68], breach: [54.5, 33], brimstone: [46.8, 77], chamber: [47.9, 1879],
        clove: [50.0, 2498], cypher: [53.3, 795], deadlock: [47.5, 80], fade: [49.6, 2106],
        gekko: [40.6, 32], harbor: [51.4, 107], hush: [48.5, 707], iso: [52.8, 144],
        jett: [52.5, 1702], kayo: [35.5, 62], killjoy: [32.1, 28], miks: [49.3, 75],
        neon: [52.1, 1400], omen: [48.3, 358], phoenix: [52.0, 811], raze: [52.1, 167],
        reyna: [48.4, 1110], sage: [54.8, 491], skye: [51.5, 136], sova: [50.0, 330], tejo: [46.6, 88],
        veto: [45.6, 57], viper: [68.0, 25], vyse: [49.4, 178], waylay: [48.1, 540], yoru: [51.8, 361]
      },
    },
    {
      on: '2026-11-05', attack: 47.5, defense: 52.9,
      agents: {
        astra: [48.3, 174], breach: [42.4, 66], brimstone: [48.5, 101], chamber: [46.8, 2732],
        clove: [51.4, 4270], cypher: [50.8, 1552], deadlock: [53.0, 198], fade: [51.2, 3407],
        gekko: [49.5, 111], harbor: [54.4, 171], hush: [51.2, 291], iso: [50.3, 296],
        jett: [50.5, 3487], kayo: [45.2, 115], killjoy: [50.8, 126], miks: [51.2, 127],
        neon: [51.0, 2156], omen: [47.6, 702], phoenix: [51.5, 1510], raze: [49.3, 351],
        reyna: [50.8, 2331], sage: [53.2, 878], skye: [49.2, 299], sova: [47.7, 709],
        tejo: [49.7, 197], veto: [44.5, 164], viper: [50.6, 87], vyse: [53.9, 332],
        waylay: [47.6, 1001], yoru: [50.9, 519]
      },
    },
  ],
  sunset: [
    {
      on: '2026-11-20', attack: 48.9, defense: 51.9,
      agents: {
        astra: [33.3, 18], breach: [49.1, 53], brimstone: [51.0, 49], chamber: [47.4, 1783],
        clove: [51.6, 2547], cypher: [54.3, 834], deadlock: [56.1, 98], fade: [52.2, 393],
        gekko: [45.2, 62], harbor: [52.6, 19], hush: [52.9, 629], iso: [53.3, 150], jett: [48.9, 1488],
        kayo: [43.2, 44], killjoy: [52.9, 34], miks: [44.8, 87], neon: [52.9, 1688], omen: [50.2, 470],
        phoenix: [54.1, 802], raze: [47.2, 494], reyna: [51.4, 1005], sage: [45.7, 245],
        skye: [45.9, 98], sova: [52.5, 2172], tejo: [52.2, 46], veto: [54.5, 66], viper: [53.8, 13],
        vyse: [50.3, 193], waylay: [49.6, 355], yoru: [52.4, 347]
      },
    },
    {
      on: '2026-11-05', attack: 48.6, defense: 51.9,
      agents: {
        astra: [40.6, 32], breach: [43.4, 145], brimstone: [56.9, 65], chamber: [47.7, 2545],
        clove: [52.2, 4399], cypher: [52.9, 1628], deadlock: [51.1, 270], fade: [52.0, 589],
        gekko: [51.7, 205], harbor: [47.8, 23], hush: [54.2, 238], iso: [50.8, 325],
        jett: [49.1, 2839], kayo: [45.3, 86], killjoy: [53.5, 43], miks: [45.9, 159],
        neon: [51.8, 2661], omen: [47.7, 813], phoenix: [52.2, 1566], raze: [47.7, 1034],
        reyna: [50.9, 1956], sage: [46.6, 399], skye: [49.7, 175], sova: [52.4, 3743],
        tejo: [47.0, 83], veto: [48.4, 188], viper: [53.6, 28], vyse: [51.5, 493], waylay: [49.4, 621],
        yoru: [51.7, 480]
      },
    },
  ],
};

/** On each map, each read before the newest counts this much of the one after it, game for game. */
export const EARLIER = 0.5;

/** A map's numbers, its reads pooled: `games` are the games as they count (EARLIER), and `on` is the newest read's day. */
export interface MapWins extends Read {
  reads: readonly Read[];
}

/** A map's reads pooled into one: each agent's games and wins, and each side's rounds, with each earlier read counting EARLIER as much. */
export function pooled(reads: readonly Read[]): MapWins {
  const weight = reads.map((_, i) => EARLIER ** i);
  const agents: Record<string, readonly [number, number]> = {};
  for (const id of [...new Set(reads.flatMap((r) => Object.keys(r.agents)))].sort()) {
    let won = 0, games = 0;
    reads.forEach((r, i) => { const x = r.agents[id]; if (x) { won += x[0] * x[1] * weight[i]!; games += x[1] * weight[i]!; } });
    agents[id] = [won / games, Math.round(games)];
  }
  const size = reads.map((r, i) => weight[i]! * Object.values(r.agents).reduce((t, [, n]) => t + n, 0));
  const all = size.reduce((t, x) => t + x, 0);
  const side = (k: 'attack' | 'defense') => reads.reduce((t, r, i) => t + r[k] * size[i]!, 0) / all;
  return { on: reads[0]!.on, attack: side('attack'), defense: side('defense'), agents, reads };
}

export const MAP_WINS: Record<string, MapWins> = Object.fromEntries(Object.entries(READS).map(([map, reads]) => [map, pooled(reads)]));

/** The share of rounds a side wins on a map, 0 to 1 (undefined without numbers). */
export function sideShare(map: string, side: 'attack' | 'defense'): number | undefined {
  const m = MAP_WINS[map];
  return m && m[side] / (m.attack + m.defense);
}
