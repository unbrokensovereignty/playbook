# How Playbook is checked against real play

Playbook's answers are checked three ways: against what pro teams played at this year's events, against what coaches and analysts write, and by a graded review of answers drawn at random. The first two run with the unit tests (`tests/unit/validation.test.ts`), so a change that makes the engine worse at something it could already do fails `npm test`. The review is redone whenever the engine changes a lot.

```sh
node --experimental-strip-types tools/validate.mjs            # the pro checks and the claims register
node --experimental-strip-types tools/validate.mjs --sample   # the 180 answers for the review
```

## 1. Against pro play

Each check asks the engine for the best comps on a map at Radiant, for a five-stack on both sides, and compares them with the comps pro teams played there (`core/kb/lineups.ts`, 21 map pools across Masters Santiago, Masters London and Champions 2026). For each event and map it reports three numbers.

| Number | What it measures |
| --- | --- |
| Shares | How many of the five agents in the engine's best comp are in the comp pros played most there. |
| Order | How closely the engine's ranking of agents follows the pros' pick rates (rank correlation, 1 is the same order). |
| Controllers | Whether the best comp has as many controllers as the pros' most played one. |

| Check | Shares | Order | Controllers right | Pass mark |
| --- | --- | --- | --- | --- |
| Against every event, pro numbers from all of them | 4.52 | 0.77 | 20 of 21 | shares ≥ 4.4, order ≥ 0.75 |
| Each event held out | 3.81 | 0.63 | 20 of 21 | shares ≥ 3.8, order ≥ 0.6, no map below 0.3 |
| Each event held out, no pull toward pro play | 3.29 | 0.55 | 20 of 21 | shares ≥ 3.2, order ≥ 0.5 |

Held out means the event being checked is taken out of the pro numbers first, so the engine can't just repeat what it was told. It's the honest number. As a yardstick, copying the comp the other events played most on the same map shares 3.94 agents on the 16 maps with another event. The engine, held out, shares 4.13 there, and the test requires it to do at least as well as copying.

The check with no pull toward pro play turns off the lean toward pro comps (`FIT.pro`), leaving only the kits, the maps' needs and ranked numbers. It shows how much the engine knows on its own. The aim is 3.5 agents shared here, and it reaches 3.29. The kit rules for Brimstone on Bind and Fracture, Phoenix and Clove on open maps, and Sova and Fade on open maps closed much of the gap. What's left is mostly Ascent, Bind and Lotus. On Ascent the kits alone rank Astra above the Omen pros play, and on Bind and Lotus they rank Breach above the Fade and Skye pros play there.

Refitting the kits to pro play doesn't carry over. To see whether the kit numbers could follow pro play more closely, each agent's kit was scaled up or down (by up to 15%) to fit two events' lineups, and the result checked on the third, in turn. On two of the three events held out this way, the refit did worse than the numbers it started from, and the scales it chose disagreed from one event to the next (Phoenix up for one, down for another). Scaling what the situation needs, one strength at a time, moved the held-out numbers by a hair either way, and the pull toward pro play came out best where it is. What's left between the engine and each event is mostly how the picks changed between events, which no fixed set of numbers can foresee, so the kits stay as they are and tuning them further against these lineups would only fit them to the past.

The engine is checked only against agents the pros could pick at each event, so an agent released after an event can't count against it there.

The marks were set from the first held-out run, a little under it. They only go up.

## 2. Against ranked play

Ranked numbers (`win` in `core/kb/agents.ts`) are for all ranks together, since no source publishes win rates per rank that this app can bundle. So the checks lean on the low and middle ranks, where most ranked games are played:

- From Iron to Diamond, agents who win more ranked games fit better (rank correlation at least 0.5 at each rank).
- From Iron to Silver, the top comps have at most one agent who is hard to play well (`skill` 0.75 or more).
- From Iron to Platinum, at most one S-tier agent is in the bottom quarter for ranked wins. That one is Omen. Pros pick him on most maps (he was in all five most played comps at Champions 2026), and his ranked rate of 46.5% is across all ranks. His comps say so in their cons ("wins fewer ranked games than most agents").

## 3. The claims register

`tests/validation/claims.ts` holds 171 claims from coaches', analysts' and guide writers' articles and from pro pick tables, each with at least two independent sources (listed there with their links and dates, read on 5, 6 and 12 November 2026). Every one of the 13 maps has at least six, and Haven has the most with 14. The rank claims cover Iron to Radiant, and a set from this year's solo-queue and rank-by-rank guides says how agents should rise or fall with rank (Reyna, Breach, Clove, Omen, Killjoy, Fade and Sova, Jett, Viper, Cypher, Yoru, Neon, KAY/O and Hush). Each claim the engine can be checked against has a check, and the rest are notes for the review.

All 155 checked claims hold, and the test fails if one stops holding. A few need a word:

- Complex kits pay off later. The agents notably harder to play well than most (`skill` above 0.6, from Jett and Waylay up to Neon and Astra) cost a little more at the low ranks, fading out by Diamond (`HARD` in `core/engine/weights.ts`). The four hardest, Neon, Astra, Yoru and Hush, pay the whole cost through Gold, since the guides tell players to learn them later still at Silver and Gold. Nothing changes at Immortal and Radiant, so the pro checks above are the same.
- For Omen on Summit from Gold to Diamond, Clove's comp and Omen's come within a point of each other (Clove wins the most ranked games of any controller), so the check asks for Omen in one of the three best comps at those ranks, and in the best one at Immortal and Radiant.
- Jett at every rank is checked for a solo player, as the guides mean it. A team that plays together leans on pro play, and at this year's events pros picked her on about a fifth of maps, mostly Ascent, Breeze and Lotus, playing Neon, Yoru and Waylay more on the maps in the pool.

Sixteen claims are notes. In thirteen of them the guides disagree with this year's pro play and the engine follows the pros. They're KAY/O on Abyss, Ascent and Pearl, Breach on Split, Haven and Sunset, Astra on Split, Lotus and Ascent, Skye on Summit, Gekko on Sunset and Cypher on Split. Sova on Sunset is one of them too. At the international events pros played Fade there far more than Sova (71% to 25%), while in the Americas league it was the other way round, and the engine follows the international events. The last three are advice that the review reads in the plays and tips. They cover mid control on Pearl, where the attack plays lead with mid from Platinum up, team play climbing from Platinum, which the plays-by-rank tests also check, and buying together.

## 4. The graded review

A hundred and eighty answers drawn with a fixed seed (`tests/validation/sample.ts`), twenty at each rank. Every map comes up at least twelve times, and the maps in the pool more often, as people play them. The side and the party size are drawn at random. Most questions add one thing a player would, which can be an agent they must play or won't, teammates who have locked in, the other team's agents, a role count or one site. Each answer is graded 1 to 5 on the comp, its pros and cons, and the first play, against the pro lineups for Immortal and up and the claims register and the rank guides below that. The grading is blind. It goes by the lineups, the claims, the maps and the kits, without looking at the engine or its weights.

| Grade | What it means |
| --- | --- |
| 5 | What this year's pros played (four or five agents shared) or what the guides advise for the rank, with true reasons and a play that suits the rank. |
| 4 | Sound, with a small point a coach might change. |
| 3 | Works, but a coach would change something you'd notice. |
| 2 | Wrong in a way that costs rounds. |
| 1 | Harmful or nonsense. |

The aim is an average of 4.5 or more at every rank, with nothing below 4. Every answer graded 3 or lower is looked into, and each one a change can lift without breaking a check elsewhere becomes a fix with a test.

### What the passes found and fixed

Seven passes so far, each over the sample as the engine stood then.

| Pass | Average | Below 4 |
| --- | --- | --- |
| 1 | 3.88 | 44 |
| 2 | 4.35 | 28 |
| 3 | 4.26 | 31 |
| 4 | 4.59 | 19 |
| 5 | 4.69 | 2 |
| 6 | 4.74 | 7 |
| 7 | 4.78 | 5 |

Most of what the third pass marked down was wording that repeated itself or left someone out, which the fourth no longer found. These are the fixes that came out of the seven, by kind.

| Found | Fix | Test |
| --- | --- | --- |
| A play had Omen blind two spots with his one Paranoia, and some lines named the wrong ability, such as Sage slowing a push with Barrier Orb. | Plays and tips count each ability's charges (`core/kb/charges.ts`), and what each ability does is read from the game's own text (`core/kb/effects.ts`). | `tests/unit/charges.test.ts`, `tests/unit/abilities.test.ts` |
| Icebox's description and two of its tips said both sites have ziplines. Only A has one. | Every piece of text tied to a map is checked against the features on its minimap. | `tests/unit/mapfacts.test.ts` |
| Neon, Astra, Yoru and Hush made best comps below Platinum, and Breach did at Iron, though the rank guides say to learn them later. | The hardest kits pay the whole cost of practice through Gold (`HARD` in `core/engine/weights.ts`), and Breach counts for less on a team that doesn't play together. | `tests/unit/scenarios.test.ts` |
| Cards said a kit answered the other team's Sova or Fade when nothing does, and sold fakes to ranks that rarely run them. | The information threat comes with advice on playing around it, and fakes are offered from Platinum up. | `tests/unit/counters.test.ts`, `tests/unit/benchmarks.test.ts` |
| Two pros made the same point, a con left out someone who brings the strength it said was missing, and an Operator con turned up on maps without long sightlines. | Each pro makes its own point, a con names everyone who brings the strength, and the Operator con shows only on maps that reward long angles, from Gold up. | `tests/unit/benchmarks.test.ts` |
| A duo or trio playing both controllers paid for the second as a random team would, and expected its teammates to lock in a third. | Such a party smokes together as well as a five-stack at its rank, and a fill with three controllers is as rare as one with none. | `tests/unit/benchmarks.test.ts`, `tests/specs/engine.spec.ts` |
| A con said nobody brings crowd control with Killjoy's Lockdown in the comp, and a pro said Veto wins fights alone on the strength of his ultimate. | A con names the ultimate that does it and says most rounds don't have one. A pro about winning fights alone needs the gun or a basic ability. | `tests/unit/abilities.test.ts` |
| KAY/O made the best comp for open-map attacks at Silver and Gold, on flashes that pay off only when a teammate swings just as they pop. | A pair built on a flash timed for a teammate's entry counts as far as the team plays its utility together, and a kit rule can make a kit easier to play on one map, as Viper's single long wall on Breeze is. | `tests/specs/engine.spec.ts`, `tests/unit/scenarios.test.ts` |
| A card's line about its thinnest strength said "Utility to clear corners comes only from Sova's Shock Bolt" with Phoenix's Hot Hands in the comp. | The line names everyone the score counts for that strength, as the other gap lines do. | `tests/unit/benchmarks.test.ts` |

### The grades

The seventh pass averaged 4.78, with 146 fives, 29 fours and 5 threes, and nothing lower. At Immortal and Radiant, 31 of the 40 best comps share four or five agents with a comp pro teams played on two or more maps there (from Masters Toronto 2025 for Icebox, which this year's events didn't play).

| Rank | Average | Threes |
| --- | --- | --- |
| Iron | 4.85 | none |
| Bronze | 4.75 | none |
| Silver | 4.85 | none |
| Gold | 4.85 | 40 |
| Platinum | 4.55 | 95, 122, 158 |
| Diamond | 4.60 | 60 |
| Ascendant | 4.80 | none |
| Immortal | 4.85 | none |
| Radiant | 4.95 | none |

The numbers are the answers' places in `tools/validate.mjs --sample`.

### What the threes have in common

Two of the five come within a point of the comp the grader would have played, and ranked results back the pick in three.

Answer 40 is an Abyss attack at Gold with Clove where the Abyss guides name Omen. In ranked games on Abyss, Clove wins 54.7% of 5,762 and Omen 45.4% of 884 (metabot.gg, 5 November 2026). The comp with Omen comes second, half a point behind.

Answers 122 and 158 are the same Corrode defense for a Platinum trio. The trio plays Sage, and the best picks for its random teammates add Chamber, so the card warns about an extra sentinel. The grader wanted Viper in Sage's place, as pros played her in 12 of the 14 Corrode lineups this year, but a trio with Viper comes about 7 points behind. The 2026 Corrode guides call it Omen's map and give Viper a wall for the A attack, so nothing backs a rule that adds her on defense at Platinum. One with Killjoy is a fraction of a point behind, though Killjoy wins only 38.1% of her ranked games on Corrode. Ranked players rarely pick a second sentinel (none of metabot.gg's 51 most played ranked comps has two), and a change that has random teammates do the same fixed both answers. It also moved 16 of the 180 answers and broke three checks, Jett as the solo pick at Iron among them, so it wasn't made.

Answer 95 is a Breeze attack at Platinum that must play Deadlock. It keeps Neon where the grader wanted Omen or KAY/O, and its card says nobody brings flashes. Those comps come about 1.5 points behind. On Breeze, Neon wins 50.9% of his ranked games, Omen 49.0% and KAY/O 40.1%, and the comp with Phoenix, who'd bring the flashes, is only 0.2 behind.

Answer 60 is an Icebox attack at Diamond that asks for B. KAY/O takes the place of the second controller Toronto's teams paired with Viper, and the comp with Omen beside her is 0.8 behind. At Diamond a second controller still costs a team that doesn't always play its smokes together, and only one of metabot.gg's 51 most played ranked comps has two. Its first play is a simple B hit, which this comp fits best of the B plays, with the fake on B third.

The fours are mostly small swaps. Eleven low-rank answers pick a sentinel or initiator the guides don't name for the rank, such as Cypher where they give Killjoy, or Sova over Fade at Iron. Near the top, seven leave out a map's pro staple, like Fade on Summit or Astra on Pearl, and from Platinum up five go without Viper on Corrode, Icebox, Breeze or Split.

## What isn't checked yet

- A twenty-game trial, playing Playbook's picks in ranked and logging how each game goes, is left for later at Sovereign's choice. Your games (Saved → Your games) records exactly what it would need.
- Exact lineups for each ability are left out on purpose, to keep the plays simple to follow.
