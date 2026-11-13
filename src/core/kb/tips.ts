/**
 * Tips: short, plain advice for an agent, a map's side, a rank, a party and a team's role counts.
 * The planner picks the ones that fit a situation (engine/tips.ts). Each tip is one or two
 * sentences that end in a full stop; callouts are the game's own (see maps.ts).
 */
import type { RankId } from './ranks.ts';
import type { Side } from './maps.ts';
import type { Dim, Role } from './roles.ts';

/** Two tips per agent, about playing them with a team. */
export const AGENT_TIPS: Record<string, readonly [string, string]> = {
  jett: ['Dash in right after a flash or smoke lands. A Jett who goes in alone just gives the site away.', 'With the Operator, take one shot and dash out instead of holding the same angle twice.'],
  phoenix: ['Throw Curveball around a corner and swing as it pops. It’s your own flash, so you choose the timing.', 'Run it Back makes the first fight on site free, so use it to find where the defenders are.'],
  raze: ['Throw Paint Shells and Boom Bot into the close corners before the team walks past them.', 'Blast Pack onto site only once its close angles are cleared or flashed.'],
  reyna: ['Reyna brings almost no utility, so the other four have to cover information and flashes.', 'Take the first fight behind Leer, then Dismiss out or Devour to stay in the round.'],
  yoru: ['Gatecrash behind the defenders during a fake to pull their rotations the wrong way.', 'Fakeout and Blindside work best when the team hits right behind them.'],
  neon: ['Fast Lane lets the team cross wide lanes if everyone runs in right behind the walls.', 'Neon’s speed wins fast hits, as long as the team commits before the defenders can rotate.'],
  iso: ['Double Tap’s shield wins the first duel. Take fights where only one enemy can see you.', 'Contingency only covers a short crossing, so the team still needs smokes.'],
  waylay: ['Lightspeed in, and Refract back to safety if the fight goes wrong.', 'Saturate slows a group on site, and it works best with a flash for the entry.'],
  hush: ['Steer Displacement next to a wall, a box or a teammate. It only concusses enemies who hit something, so it does little in the open.', 'Let the main entry go first and set them up with Flashbulb and Displacement. Flow is too slow to dash in alone.'],
  sova: ['Use Recon Bolt before the hit, so the team knows where to go before anyone commits.', 'Save Shock Bolt and Hunter’s Fury for after the plant to stop the defuse.'],
  breach: ['Call your Flashpoint before throwing it so the entry swings as it pops.', 'Fault Line and Aftershock clear close spots so the entry doesn’t have to fight them.'],
  skye: ['Guiding Light tells you when it hits. Call it, so the entry knows when to swing.', 'Trailblazer can clear a corner by itself, so send it in before anyone peeks.'],
  kayo: ['Throw ZERO/point before the hit to show who is there and shut off their utility.', 'NULL/cmd makes a hit or a retake much safer when the whole team commits with it.'],
  fade: ['Follow your Prowler in. It finds the enemy in the corner and blinds them for you.', 'After the plant, throw Seize onto the Spike, and anyone who goes to defuse is held there, deafened and weakened.'],
  gekko: ['Pick Wingman and Dizzy back up after they land, and you get them again for free.', 'Let Wingman plant or defuse while you hold the angle that matters.'],
  tejo: ['Send the Stealth Drone ahead and push while the enemies are suppressed.', 'Guided Salvo and Armageddon stop a defuse from far away, so save them for after the plant.'],
  brimstone: ['Place Sky Smokes before the hit so the whole team crosses at once.', 'Keep Incendiary and Orbital Strike for the post-plant.'],
  viper: ['Toxic Screen cuts a whole site in two. Set it up before the team crosses.', 'Viper’s Pit lets two or three players hold a site or a plant against many.'],
  omen: ['Dark Cover can be placed from almost anywhere, so smoke from somewhere safe.', 'Shrouded Step and From the Shadows are good for lurks, but don’t leave the hit without smokes.'],
  astra: ['Place stars in the buy phase and use them when the team needs them.', 'Cosmic Divide cuts the map in two for a hit or a retake.'],
  harbor: ['Walk the team behind High Tide to cut off long sightlines.', 'Cast Cove over a plant or a defuse and turn it into a shield, which stops bullets until it breaks.'],
  clove: ['Clove can still smoke after dying, so you can take early fights.', 'Pick-me-up after a kill gives speed and health to take the next fight quickly.'],
  miks: ['Toggle M-pulse to heal the team after a fight, or to concuss a corner before one.', 'Harmonize an entry player so you both push faster with a combat stim.'],
  sage: ['Barrier Orb blocks a choke for a long time, which can stop a rush or a fast rotation.', 'Save Resurrection for the teammate who matters most to the round.'],
  cypher: ['Trapwire the flank and a site entrance, and check Spycam before the hit comes.', 'Neural Theft on a kill shows where the whole enemy team is.'],
  killjoy: ['Nanoswarm, Alarmbot and Turret stop working when you go too far away, so stay near them.', 'Lockdown wins a retake or stops a hit when you use it as the team commits.'],
  chamber: ['Take one shot and Rendezvous out before the enemy can trade.', 'Trademark watches the flank so you can hold the site.'],
  deadlock: ['GravNet stops a rush in place. Follow it with a molly or a spray.', 'Barrier Mesh blocks a choke and buys time for the rotation.'],
  vyse: ['Razorvine and Shear stop a rush, and Arc Rose blinds through walls for the retake.', 'Steel Garden jams primary weapons in an area, which can win a retake or stop a hit.'],
  veto: ['Interceptor destroys thrown utility, so place it where the enemy throws theirs.', 'Chokehold holds a push in place, and Crosscut gets you back to the fight fast.'],
};

/**
 * The tip a comp shows for an agent on defense, for the agents whose first tip above is about
 * attacking: their second tip when it fits defense, or one of its own (shown on their page too).
 */
export const DEFENSE_TIPS: Record<string, string> = {
  jett: 'With the Operator, take one shot and dash out instead of holding the same angle twice.',
  raze: 'Boom Bot and Paint Shells punish a push through a choke, so throw them at the first sound of a rush.',
  yoru: 'Place Gatecrash early on defense, so you can rotate or come in behind the push the moment the hit comes.',
  neon: 'Relay Bolt concusses a group coming through a choke, so peek as it goes off.',
  sova: 'A Recon Bolt early in the round finds a fast push. Keep Owl Drone for the retake.',
  kayo: 'Throw ZERO/point onto a choke as the push comes so the attackers can’t use their utility, and save NULL/cmd for the retake.',
  fade: 'Hold Seize until the attackers commit and use it to stop the entry, then throw Haunt over the site to start the retake.',
  tejo: 'Guided Salvo stops a push at a choke from safety. Fire it as the enemies commit.',
  brimstone: 'Smoke the choke the enemies push through, and save Orbital Strike to drive the attackers off the Spike on the retake.',
  viper: 'Put Toxic Screen across the choke the attackers come through, and save Viper’s Pit to take the site back on a retake.',
  harbor: 'Storm Surge and High Tide slow a push through a choke. Keep Cove to shield the defuse on the retake.',
};

/** The tip a comp shows for an agent on attack, for the sentinels whose first tip above is about defending (shown on their page too). */
export const ATTACK_TIPS: Record<string, string> = {
  sage: 'Put Barrier Orb across an angle the defenders hold, so the team can cross or plant behind it.',
  cypher: 'Trapwire the flank behind the team, and watch the Spike with Spycam after the plant.',
  deadlock: 'After the plant, put Barrier Mesh across a way into the site, so the retake has to break it or go around.',
  vyse: 'After the plant, put Razorvine on the Spike and Shear across a way in, so the retake comes in slow and split up.',
};

/** Two tips for each map and side, for teams that play for map control (see MAP_TIPS_LOW for the others). */
export const MAP_TIPS: Record<string, Record<Side, readonly [string, string]>> = {
  abyss: {
    attack: ['Win Mid Bend and Mid Catwalk, then split either site from two directions.', 'There are no walls at the edges, so a stun or a careless dash near one is a free kill.'],
    defense: ['A Tower and B Tower watch most of each site. Hold them with information, and fall back when utility comes.', 'Stay away from the edges in fights, since anyone knocked off dies.'],
  },
  ascent: {
    attack: ['Mid Catwalk opens A through A Tree and Mid Market opens B, so whoever holds mid can hit either site late.', 'Defenders can shut the doors on each site, so listen for them and plan the other way in.'],
    defense: ['An Operator on mid or A Main wins rounds when it’s played with information.', 'Holding Mid Market stops B splits and keeps your rotations short.'],
  },
  bind: {
    attack: ['Bind has no mid, so use the teleporters to fake one site and hit the other.', 'A Bath (Showers) and B Window (Hookah) are the fights that open each site.'],
    defense: ['Listen for the teleporter. Its sound means a rotation or a fake.', 'Bind’s ways in are narrow, so one molly or trap slows a whole push.'],
  },
  breeze: {
    attack: ['Cross open ground only behind a wall or smokes, because Breeze’s long angles punish dry peeks.', 'Take mid through Mid Top or Mid Hall to split A or reach B Tunnel.'],
    defense: ['An Operator is worth a lot here, with the longest sightlines in the game.', 'Mid Wood Doors and B Tunnel are the fast rotations, so keep an eye on both.'],
  },
  corrode: {
    attack: ['Clear the close corners (A Yard, A Pocket, A Elbow) with utility before planting.', 'Take one lane of mid to split a site through A Link or B Link.'],
    defense: ['Slow the hit early in the lobbies, then wait for help to arrive before you fight.', 'Long walls and smokes cut the lobbies off while a sentinel holds the other site.'],
  },
  fracture: {
    attack: ['You can reach each site from both ends, so split and make the defenders face two ways.', 'Time both groups together. The far group arrives later than you think.'],
    defense: ['Watch both ends of the site. A trip or alarm on the far side saves rounds.', 'Defenders spawn in the middle, close to both sites, so retakes are strong here.'],
  },
  haven: {
    attack: ['Three sites stretch the defense thin, so find information early and hit the weakest one.', 'C Garage and mid lead to more than one site, so control there sets up splits.'],
    defense: ['With three sites to cover, the floating players must rotate early.', 'Hold C Garage or Mid Window to see which way the attackers are going.'],
  },
  icebox: {
    attack: ['Clear the high angles first. Both sites have tall boxes, and ropes lead up to high ground that defenders hold.', 'A long wall splits a site in two, so you can take one half at a time.'],
    defense: ['Don’t hold a lost site alone. Stall the hit and retake together.', 'B Kitchen and mid let you see a B hit early, so hold them with information.'],
  },
  lotus: {
    attack: ['The rotating doors are loud, so turning one can fake a hit on that site.', 'Hit fast, because three close sites let defenders rotate quickly once they hear you.'],
    defense: ['Use the rotating doors to rotate between sites quickly.', 'One player per site plus two floaters covers all three sites best.'],
  },
  pearl: {
    attack: ['Mid control (Mid Plaza, Mid Doors) opens splits to both sites.', 'B Main is very long, so cross it behind smokes or a wall.'],
    defense: ['B Main and A Main are long sightlines where an Operator or a long wall pays off.', 'Mid gives fast rotations. Hold it with a smoke ready for either site.'],
  },
  split: {
    attack: ['Ropes let defenders hold high ground, so smoke A Tower and B Tower (Heaven) first.', 'Take mid (Mid Vent, Mid Mail) to pinch either site.'],
    defense: ['Split’s narrow ways in favor defenders. Slow the hit with utility and trade from close angles.', 'Hold mid with a smoke ready, since the ropes let you rotate quickly.'],
  },
  summit: {
    attack: ['Mid Fountain and Mid Tiles link to both sites, and fast entries do well from there.', 'Both sites have lots of cover, so clear them with utility instead of peeking each spot.'],
    defense: ['Hold close angles on site and stall until the rotation arrives.', 'Mid Window watches mid, and information there tells you which site is coming.'],
  },
  sunset: {
    attack: ['Mid connects to both sites, so win Mid Courtyard before committing.', 'B Market is a close fight. Clear it with utility before anyone walks in.'],
    defense: ['A Elbow and B Market are close-range fights where close angles pay off.', 'Hold mid with information so a split doesn’t catch you out.'],
  },
};

/**
 * The map tips for teams below the rank where coaches start asking for map control, fakes and splits
 * (see mapTipsFor in engine/tips.ts): one site at a time, together, with the map's own dangers.
 */
export const MAP_TIPS_LOW: Record<string, Record<Side, readonly [string, string]>> = {
  abyss: {
    attack: ['Pick A Main or B Main and go in as five, with the second player close enough to trade the first.', 'There are no walls at the edges, so a stun or a careless dash near one is a free kill.'],
    defense: ['Hold each site in a pair from A Tower or B Tower, and fall back to your team rather than fighting a full hit alone.', 'Stay away from the edges in fights, since anyone knocked off dies.'],
  },
  ascent: {
    attack: ['Hit one site together through A Main or B Main. Walking into mid one at a time just loses players.', 'Defenders can shut the doors on each site, so listen for them and plan the other way in.'],
    defense: ['Play two on each site and one near Mid Market, and say what you see before you take a fight.', 'If you lose Mid Catwalk, back off to a site with a teammate instead of taking the fight again alone.'],
  },
  bind: {
    attack: ['Choose a site and take its way in as a group, through A Short or A Bath for A and B Long or B Window for B.', 'Bind’s ways in are narrow, so throw your utility through the choke before the first player walks out.'],
    defense: ['Bind’s ways in are narrow, so one molly or trap slows a whole push.', 'Listen for the teleporter. Its sound means someone has moved to the other side, so call it out.'],
  },
  breeze: {
    attack: ['Cross open ground only behind a wall or smokes, because Breeze’s long angles punish dry peeks.', 'Send all five through A Lobby or B Main and plant before the defenders’ rotation arrives.'],
    defense: ['An Operator is worth a lot here, with the longest sightlines in the game.', 'Hold each site in a pair, and when five come at you, give ground until the rotation arrives.'],
  },
  corrode: {
    attack: ['Clear the close corners (A Yard, A Pocket, A Elbow) with utility before planting.', 'Push A Main or B Main as a group, near enough to each other that every fight can be traded.'],
    defense: ['Slow the hit early in the lobbies, then wait for help to arrive before you fight.', 'If the hit comes to your site, fall back and hold it with the teammate next to you until the rest arrive.'],
  },
  fracture: {
    attack: ['Go onto one site from one end as five, since a hit from both ends at once is hard to time.', 'After the plant, watch the ways in from the middle too. Defenders spawn between the sites, so their retake comes fast.'],
    defense: ['The attackers can reach each site from either end, so play close enough to your teammate to turn and help.', 'Defenders spawn in the middle, close to both sites, so retakes are strong here.'],
  },
  haven: {
    attack: ['Pick one of the three sites and hit it with all five. There are rarely more than two defenders on any one of them.', 'Use utility on C Garage before you walk through it, because defenders like to play close there.'],
    defense: ['Leave one player on B and hold A and C in pairs. B is the site closest to your spawn, so help gets there in time once B calls the hit.', 'Listen at C Garage and Mid Window. Footsteps there tell the team which way the attackers are going.'],
  },
  icebox: {
    attack: ['Clear the high angles first. Both sites have tall boxes, and ropes lead up to high ground that defenders hold.', 'Hit one site together, and plant behind cover where the whole team can see the Spike.'],
    defense: ['Don’t hold a lost site alone. Stall the hit and retake together.', 'B Kitchen and mid let you see a B hit early, so hold them with information.'],
  },
  lotus: {
    attack: ['Pick one of the three sites and hit it fast together. The sites are close, so a slow hit meets the whole team.', 'The rotating doors are loud, so stay off them when you want your hit to come as a surprise.'],
    defense: ['The three sites sit close together, so whoever plays B can reach A or C in seconds once someone calls the hit.', 'When a rotating door turns, say which one, because it tells the team where the attackers are headed.'],
  },
  pearl: {
    attack: ['B Main is very long, so cross it behind smokes or a wall.', 'Hit A through A Main or B through B Main together, and leave mid alone until the plant is down.'],
    defense: ['B Main and A Main are long sightlines where an Operator or a long wall pays off.', 'Play in pairs, and call the hit early so the far players can come.'],
  },
  split: {
    attack: ['Ropes let defenders hold high ground, so smoke A Tower and B Tower (Heaven) first.', 'Take A Main or B Garage as a group. One player alone in mid gets picked off.'],
    defense: ['Split’s narrow ways in favor defenders. Slow the hit with utility and trade from close angles.', 'Hold mid with a smoke ready, since the ropes let you rotate quickly.'],
  },
  summit: {
    attack: ['Both sites have lots of cover, so clear them with utility instead of peeking each spot.', 'Go through A Main or B Main together and plant where all of you can watch the Spike.'],
    defense: ['Hold close angles on site and stall until the rotation arrives.', 'Mid Window watches mid, and information there tells you which site is coming.'],
  },
  sunset: {
    attack: ['B Market is a close fight. Clear it with utility before anyone walks in.', 'Push A Main or B Main as five, with each player close enough to trade the one ahead.'],
    defense: ['A Elbow and B Market are close-range fights where close angles pay off.', 'Hold mid with information so a push there doesn’t catch you out.'],
  },
};

/**
 * Tips for an agent on a map: what the kit does there in particular, for the agents pro teams pick
 * there and the ones whose kits suit the map. A tip for both sides is a string; one for each side,
 * an object. Callouts are the game's own for the map.
 */
export const AGENT_MAP_TIPS: Record<string, Record<string, string | Partial<Record<Side, string>>>> = {
  abyss: {
    sova: 'Recon Bolt sees a long way on Abyss’s open sites. Dart the site before the hit, so the team knows who holds A Tower or B Tower.',
    harbor: 'High Tide runs across Abyss’s open sites in one line. Steer it to cut A Tower or B Tower off before the team crosses.',
    astra: 'Astra’s stars reach both of Abyss’s sites, so she can smoke a hit on one and still help a retake on the other.',
    yoru: 'Abyss’s long mid gives Yoru room to fake. Send Fakeout down one main and Gatecrash toward the other site.',
    waylay: 'Lightspeed crosses Abyss’s open ground fast. Dash onto site behind smokes, and Refract back if a tower sees you.',
    jett: 'Abyss’s long sightlines suit an Operator Jett who takes one shot from Mid Top or A Main and dashes back to cover.',
    omen: 'Dark Cover reaches a long way on Abyss, so smoke the site’s tower from cover for the hit and keep your second smoke for after the plant.',
  },
  ascent: {
    sova: 'A Recon Bolt from A Lobby or B Main before the hit finds the defenders on Ascent’s sites, and the lineups are worth learning.',
    omen: 'Smoke Mid Market or Mid Catwalk to take Ascent’s mid safely, and keep the other Dark Cover for the site the team hits.',
    chamber: { defense: 'Hold A Main or mid with the Operator, with Rendezvous back on site so you can get out after the shot.', attack: 'Hold mid with the Operator while the team takes Mid Catwalk, then Rendezvous onto the site after the plant.' },
    cypher: { defense: 'Cypher can hold B alone with Trapwires in B Main and a Spycam over the site, which frees a player for mid.' },
    sage: { defense: 'Barrier Orb across B Main or Mid Market stops a fast push on Ascent for the first seconds.' },
    hush: 'Telekinesis works Ascent’s site doors from range. Shut one way in to slow a hit, or open it for a retake, without standing in the doorway.',
  },
  bind: {
    viper: 'A Toxic Screen down B Long cuts the site’s long sightline, so the team can walk onto B together.',
    brimstone: 'Bind is small enough that Sky Smoke reaches every smoke a hit needs, and Stim Beacon speeds a rush through A Short or B Long.',
    yoru: 'Gatecrash and the teleporters make Bind Yoru’s best map for fakes. Send a Gatecrash or Fakeout toward one site and hit the other.',
    fade: 'Haunt over A Bath (Showers) or B Window (Hookah) shows the close angles before anyone peeks them.',
    raze: 'Paint Shells and Boom Bot clear Bind’s close spots, like A Lamps and B Elbow, before the team walks onto site.',
    skye: 'Send Trailblazer through A Bath (Showers) or B Window (Hookah) before anyone walks in, and it clears the spot on its own.',
    cypher: 'A Trapwire by a teleporter exit catches anyone who comes through it, on attack and on defense.',
  },
  breeze: {
    viper: 'A Toxic Screen across A Pyramids or down B Main is how the team crosses Breeze’s open ground, so set it up before the hit.',
    sova: 'Breeze’s open sites let a Recon Bolt see far. Dart A Pyramids or B Back before the team commits.',
    jett: 'Breeze has the longest sightlines in the game, so an Operator Jett in mid or A Shop wins rounds as long as she dashes out after each shot.',
    yoru: 'Breeze is so big that defenders stand far apart. Fake one site with Fakeout and Gatecrash behind the other.',
    omen: 'Omen’s smokes reach a long way across Breeze. Pair them with Viper’s wall so every long sightline on the hit is covered.',
    chamber: { defense: 'Hold Mid Hall or A Shop with the Operator, with Rendezvous behind cover so each long shot is safe.' },
  },
  corrode: {
    viper: 'Corrode’s lobbies are long ways in, and a Toxic Screen across A Main or B Main lets the team cross them together.',
    fade: 'Haunt and Prowlers find the defenders in the corners near Corrode’s plant spots, like A Yard, A Pocket and A Elbow.',
    vyse: { defense: 'Shear and Razorvine shut the narrow way from a lobby onto Corrode’s sites on whoever walks in first.' },
    waylay: 'Lightspeed gets Waylay onto Corrode’s sites before the defenders can settle. Go in the moment the team’s utility lands.',
  },
  fracture: {
    breach: 'Fracture’s sites are reached through narrow ways from both ends, and Fault Line and Flashpoint through the walls let both groups go in together.',
    brimstone: 'Attackers come from both ends of Fracture, close to the sites, so Brimstone’s smokes reach both sides of a split.',
    cypher: { defense: 'A Trapwire on the far way into each site, like A Rope or B Arcade, warns you of the pinch before it lands.' },
    raze: 'Paint Shells clear the narrow ways into Fracture’s sites, so the team doesn’t walk into a close angle.',
    fade: 'Haunt from one end of a Fracture site while the other group waits, so both groups know where the defenders are.',
  },
  haven: {
    sova: 'Haven’s three sites need early information, and a Recon Bolt down A Long or C Long shows where the defense is thin.',
    neon: 'Neon’s speed gets the team to whichever Haven site is weakest before defenders can rotate across three sites.',
    chamber: { defense: 'Hold A Long or C Long with the Operator, with Rendezvous placed to get you out after the shot.' },
    omen: 'Smoke C Garage or Mid Window to move between Haven’s lanes without being seen.',
    phoenix: 'Curveball around the corner of A Sewer (Short) or C Garage takes the close fight on your terms.',
    killjoy: { defense: 'Killjoy’s setup can hold one Haven site alone, which frees two teammates to cover the other sites.' },
  },
  icebox: {
    viper: 'Icebox’s B is crossed through B Yellow under long sightlines, and a Toxic Screen across it lets the team plant.',
    sova: 'Dart A Nest or B Yellow before the hit, because Icebox’s high spots are hard to clear by peeking.',
    killjoy: { defense: 'Lock one site down with Turret and Nanoswarms. Icebox’s sites are far apart, so the setup buys time to rotate.' },
    jett: 'Updraft and Drift take Jett to Icebox’s tall boxes, where she can take angles the defenders don’t expect.',
    kayo: 'ZERO/point onto a site before the hit stops the defenders’ utility, and FRAG/ment clears Icebox’s close spots.',
    gekko: 'Wingman can plant on Icebox while the team holds the tall boxes around the site.',
  },
  lotus: {
    omen: 'Lotus has three sites close together, so keep Dark Cover for the site you hit and send Paranoia down the narrow way onto it.',
    viper: 'A Toxic Screen across A Main or C Mound cuts Lotus’s close angles for the hit.',
    fade: 'Haunt over A Hut or C Waterfall shows Lotus’s close corners before the entry goes in.',
    raze: 'Paint Shells and Boom Bot clear Lotus’s corners, like A Hut, A Tree and C Hall, faster than anyone.',
    chamber: 'A Trademark that watches A Door or C Door catches and slows a rotation through it.',
    hush: {
      attack: 'Turn A Door or C Door from a distance with Telekinesis to fake a rotation. The noise pulls defenders away while the team hits elsewhere.',
      defense: 'Turn A Door or C Door from cover with Telekinesis to slow a push or cut off a flank, without standing in the doorway.',
    },
    vyse: 'Shear and Razorvine close Lotus’s narrow ways in, like A Main and C Mound.',
  },
  pearl: {
    astra: 'Pearl’s long mains and wide mid suit Astra, whose stars placed in the buy phase can cover A Main, B Main and mid in one round.',
    killjoy: { defense: 'Killjoy can hold B alone with a Turret down B Main and Nanoswarms where the Spike gets planted.' },
    sova: 'Pearl’s long A Main and B Main give Recon Bolt long lines. Dart the site before the team crosses.',
    yoru: 'Pearl’s long mid lets Yoru fake one site and Gatecrash onto the other.',
  },
  split: {
    viper: 'Split’s ways in are narrow, so a Toxic Screen through A Main or B Garage and a Poison Cloud on the tower let the team take space.',
    omen: 'Smoke A Tower and B Tower (Heaven) before the hit, since Split’s defenders hold from above.',
    raze: 'Blast Pack gets Raze up to A Tower or B Tower (Heaven) faster than the ropes, and Paint Shells clear the close spots on site.',
    fade: 'Haunt over A Ramps or B Garage shows who holds Split’s close angles.',
    neon: 'Neon’s speed takes Split’s sites before the defenders can rotate through mid. Run in right behind Fast Lane.',
    cypher: { defense: 'Trapwires at the top of A Ramps or in B Garage stop a rush on Split cold.' },
  },
  summit: {
    neon: 'Summit’s wide mid around Mid Fountain lets Neon cross fast to either site before the rotation.',
    fade: 'Summit’s sites have lots of cover, and Haunt and Prowlers clear them faster than peeking each spot.',
    chamber: 'Chamber holds Summit’s longer lanes with the Operator. Place Rendezvous behind cover so each shot is safe.',
    sage: { defense: 'Barrier Orb closes one way onto a Summit site while the team holds the other.' },
  },
  sunset: {
    omen: 'Smoke B Market and Mid Courtyard so the team can take Sunset’s close fights on its own terms.',
    neon: 'Sunset is compact, so Neon’s speed takes B Market or A Main before the defenders can rotate.',
    fade: 'Prowlers clear B Market’s close corners and A Elbow before the entry walks in.',
    chamber: 'Hold A Main or B Main with the Operator, with Rendezvous placed to fall back after the shot.',
    cypher: { defense: 'Trapwires in B Market catch the push into B before it reaches the site.' },
    sage: { defense: 'Barrier Orb stops a push through B Market or A Main for the first seconds.' },
  },
};

/** An agent's tip for a map and side ('both' prefers the tip for both sides, then the attack one), if there is one. */
export function agentMapTip(agent: string, map: string, side: Side | 'both'): string | undefined {
  const t = AGENT_MAP_TIPS[map]?.[agent];
  if (!t) return undefined;
  if (typeof t === 'string') return t;
  return side === 'both' ? t.attack ?? t.defense : t[side];
}

/**
 * How to use each agent's ultimate on each side, and the strength it mostly serves there (`for`):
 * a plan shows the one its situation leans on most (engine/tips.ts). Each names the ultimate as the
 * game does, which the specs check.
 */
export const ULT_TIPS: Record<string, Record<Side, { for: Dim; text: string }>> = {
  jett: { attack: { for: 'entry', text: 'Save Blade Storm for a full-buy hit. Its knives reset on a kill, so the first two fights on site go your way.' }, defense: { for: 'retake', text: 'Blade Storm wins a retake. Dash onto the site behind your team’s utility and clean up players stuck on the plant.' } },
  phoenix: { attack: { for: 'entry', text: 'Run it Back as the hit starts and take the first fight on site. If you die, you’re back where you started and the team knows where they are.' }, defense: { for: 'retake', text: 'Run it Back before a retake to clear the site yourself, and what you find tells the team where to swing.' } },
  raze: { attack: { for: 'clear', text: 'Showstopper clears a player sitting in the open after the plant, or the close corner on the way in. Jump with Blast Pack to fire it from cover.' }, defense: { for: 'stall', text: 'Showstopper stops a hit at its choke if you fire it into the group as they walk out together.' } },
  reyna: { attack: { for: 'duel', text: 'Empress makes every fight on a hit faster, so turn it on right as you swing the first angle.' }, defense: { for: 'retake', text: 'Use Empress for a retake, where each kill heals you and keeps you in the fight for the next one.' } },
  yoru: { attack: { for: 'entry', text: 'Dimensional Drift scouts the site unseen. Call where everyone is, then come out behind them as the team hits.' }, defense: { for: 'flank', text: 'Use Dimensional Drift behind a site that’s been taken to call the plant and the post-plant spots, then come out behind them for the retake.' } },
  neon: { attack: { for: 'entry', text: 'Save Overdrive for the hit, then sprint in with the team and keep moving so defenders can’t hold one angle on you.' }, defense: { for: 'retake', text: 'Overdrive wins a retake when you run onto the site from an angle they don’t expect and keep moving while you shoot.' } },
  iso: { attack: { for: 'duel', text: 'Kill Contract pulls the best-placed defender into a one-on-one, so use it on the player holding the site’s main angle.' }, defense: { for: 'anchor', text: 'Kill Contract the player planting or the one holding the plant, so your team only has to beat the rest.' } },
  waylay: { attack: { for: 'entry', text: 'Convergent Paths slows every defender in its path. Send it across the site as the team runs in behind you.' }, defense: { for: 'retake', text: 'Fire Convergent Paths over the plant on a retake, and anyone it catches is slow while your team swings.' } },
  hush: { attack: { for: 'disrupt', text: 'Suspension lifts the defenders off their angles. Steer it into a site’s close corners and hit as it goes off.' }, defense: { for: 'stall', text: 'Send Suspension into a group coming out of a choke, so they float in the open while your team shoots.' } },
  sova: { attack: { for: 'postplant', text: 'After the plant, fire Hunter’s Fury through the walls at whoever touches the Spike.' }, defense: { for: 'retake', text: 'Hunter’s Fury down the lanes attackers hold after the plant, so the retake walks into hurt or empty spots.' } },
  breach: { attack: { for: 'disrupt', text: 'Rolling Thunder stuns everyone on the site at once, so hit through it straight away before they recover.' }, defense: { for: 'retake', text: 'Open a retake with Rolling Thunder over the plant, and swing together while they’re stunned.' } },
  skye: { attack: { for: 'recon', text: 'Seekers find the last defenders on a site or a lurker on the flank. Call where each one goes.' }, defense: { for: 'retake', text: 'Fire Seekers before a retake. Each one finds and blinds an attacker, so the team knows who’s left and where.' } },
  kayo: { attack: { for: 'disrupt', text: 'NULL/cmd stops the abilities of every defender near you, so walk onto the site with the team while it pulses.' }, defense: { for: 'retake', text: 'NULL/cmd on a retake takes away the post-plant utility. Go in together while they can’t use it.' } },
  fade: { attack: { for: 'recon', text: 'Nightfall marks everyone it touches and leaves them hard of hearing. Send it through the site and hit as it passes.' }, defense: { for: 'retake', text: 'Send Nightfall over the site to start a retake, and everyone it marks is easy to find and can’t hear you coming.' } },
  gekko: { attack: { for: 'clear', text: 'Thrash catches a defender in a close corner, or one holding the plant from a spot you can’t see.' }, defense: { for: 'retake', text: 'Thrash the player on the defuse or the plant’s guard, then swing together onto the site.' } },
  tejo: { attack: { for: 'postplant', text: 'Cast Armageddon over the Spike as they start to defuse, and it keeps the Spike planted.' }, defense: { for: 'stall', text: 'Cast Armageddon across a choke as attackers come through, so the hit stalls or walks into it.' } },
  brimstone: { attack: { for: 'postplant', text: 'Call Orbital Strike on the Spike once they start to defuse, and they can’t stay on it.' }, defense: { for: 'retake', text: 'Orbital Strike the spot attackers hold after the plant, so the retake faces fewer of them.' } },
  viper: { attack: { for: 'postplant', text: 'Viper’s Pit over the planted Spike makes the post-plant yours, because defenders have to come into your cloud to defuse.' }, defense: { for: 'anchor', text: 'Put Viper’s Pit on the site you hold. Attackers have to clear it slowly, which buys the rotation time.' } },
  omen: { attack: { for: 'flank', text: 'Use From the Shadows behind the site to pull rotations or catch a defender off guard, and cancel it if you’re heard.' }, defense: { for: 'retake', text: 'Use From the Shadows on a site that’s been taken to see how many are there before the team retakes.' } },
  astra: { attack: { for: 'smoke', text: 'Cosmic Divide cuts the map in half. Drop it to cut off the rotation for a hit, or the retake after the plant.' }, defense: { for: 'stall', text: 'Cosmic Divide cuts the attackers off from the site for a while, which buys time for the rotation to arrive.' } },
  harbor: { attack: { for: 'disrupt', text: 'Send Reckoning across the site as the team hits. Defenders it touches are nearsighted and slowed, so swing as it passes.' }, defense: { for: 'retake', text: 'Send Reckoning over the plant for a retake. Anyone it touches is nearsighted and slowed while your team swings.' } },
  clove: { attack: { for: 'entry', text: 'With Not Dead Yet ready, take the first fight on site. If you go down, you can come back while the team trades.' }, defense: { for: 'retake', text: 'Not Dead Yet lets you take the risky first fight of a retake and come back for the next.' } },
  miks: { attack: { for: 'disrupt', text: 'Bassquake knocks defenders off their angles and slows them, so send it into the site as the team hits.' }, defense: { for: 'stall', text: 'Fire Bassquake into a hit as it comes through the choke, so the attackers are slow and can’t hear.' } },
  sage: { attack: { for: 'sustain', text: 'Resurrection gets the entry back after the first trade, so the team stays five on the site.' }, defense: { for: 'retake', text: 'After a retake, Resurrection brings a teammate back for the fights that follow. Do it from cover.' } },
  cypher: { attack: { for: 'recon', text: 'Neural Theft on a defender you killed early shows where the rest are, so you can hit the weak site.' }, defense: { for: 'retake', text: 'Neural Theft on an attacker who dies on the hit shows where the post-plant is, before the retake.' } },
  killjoy: { attack: { for: 'postplant', text: 'Drop Lockdown over the site after the plant. Defenders have to stay out of it or be held, so the Spike goes off.' }, defense: { for: 'retake', text: 'Drop Lockdown so it covers the site on a retake. The attackers have to leave it, and your team walks in once they do.' } },
  chamber: { attack: { for: 'angles', text: 'Tour De Force holds a long lane after the plant, since one shot kills and slows the others around it.' }, defense: { for: 'anchor', text: 'Tour De Force on a long angle makes the first hit through it cost a player, and slows the rest.' } },
  deadlock: { attack: { for: 'postplant', text: 'Annihilation catches the player going for the defuse. Hold the angles on the cocoon so no one comes to break it.' }, defense: { for: 'stall', text: 'Annihilation catches the entry as they come out of the choke. Watch the cocoon so no one breaks it.' } },
  vyse: { attack: { for: 'postplant', text: 'Steel Garden over the defuse spot leaves the retake with only their sidearms.' }, defense: { for: 'anchor', text: 'Cast Steel Garden on the site as they hit. Their rifles stop working, so your team wins the fights with its own.' } },
  veto: { attack: { for: 'entry', text: 'Evolution makes you immune to their utility and heals you, so take the first fight on site through their mollies and stuns.' }, defense: { for: 'retake', text: 'Use Evolution for a retake, where post-plant utility would stop anyone else, and walk through it onto the Spike.' } },
};

/**
 * Tips for each rank: two for any round, and one for each side. They follow what coaches tell
 * players at each rank: aim and calm first, then trading and simple utility, then timing, calls and
 * changing up what the other team has seen.
 */
export const RANK_TIPS: Record<RankId, { any: readonly [string, string]; attack: string; defense: string }> = {
  iron: {
    any: [
      'Keep your crosshair at head height where an enemy will appear, and stand still when you shoot. Most fights at this rank are won by the first clean shot.',
      'Learn one or two agents well instead of a new one every game. Knowing what each ability does wins more than any combo.',
    ],
    attack: 'Go in together through one way, since five players arriving one by one lose to two defenders.',
    defense: 'Hold one angle with a teammate near you instead of running around the site looking for enemies.',
  },
  bronze: {
    any: [
      'Use your abilities every round, even in simple ways. An ability saved for the perfect moment often never gets used.',
      'Walk when you’re close to enemies, because running tells them where you are.',
    ],
    attack: 'Once the Spike is down, play around it from cover instead of chasing kills across the map.',
    defense: 'After a fight, move a few steps before you peek again so the enemy can’t pre-aim you.',
  },
  silver: {
    any: [
      'Play close enough to a teammate that you can trade their death straight away.',
      'Buy with your team. Everyone saving or everyone buying beats a mix of rifles and pistols.',
    ],
    attack: 'Throw your smokes and flashes as the team goes in, before anyone has died.',
    defense: 'When a site falls, wait for the rest of the team and retake it together rather than one at a time.',
  },
  gold: {
    any: [
      'Throw your utility to start a fight, so the enemy is already blind or slowed when you peek.',
      'A short plan said at the start of the round beats five players doing their own thing.',
    ],
    attack: 'Plant where the team can see the Spike from cover, and spread out so one enemy can’t kill two of you.',
    defense: 'Call where the enemies are as soon as you see them, with the callout, so the team can rotate in time.',
  },
  platinum: {
    any: [
      'Learn your agent’s two or three most useful lineups or set spots for each map you play.',
      'Count the enemies you’ve seen before you rotate. A loud push with only two players is often a fake.',
    ],
    attack: 'Take map control early with a player or two, and decide the site once you know where the defenders are thin.',
    defense: 'Save some utility for the retake instead of spending it all on the first push.',
  },
  diamond: {
    any: [
      'Enemies play around your setups, so change them from round to round.',
      'Keep calls short. One clear call in the middle of the round beats five voices at once.',
    ],
    attack: 'Hit fast one round and slow the next, so the defenders can’t guess when you’ll come.',
    defense: 'Mix up where you play early fights and where you play back, so the attackers can’t plan around one look.',
  },
  ascendant: {
    any: [
      'At this rank, team utility decides more rounds than raw aim does.',
      'Think about the next round too. Save a rifle when this one is lost, and play for the plant on an eco.',
    ],
    attack: 'Time the entry with the flash and the smokes to the second, because a late flash is a wasted one.',
    defense: 'On a retake, the smokes and stuns go in before the players do.',
  },
  immortal: {
    any: [
      'Plan which rounds you’ll use your ultimate in, and pair it with a teammate’s.',
      'Watch what the other team does round to round and say it, so the team can play around their habits.',
    ],
    attack: 'Have a set play ready for each site and a fake to go with it, and call which one at the start of the round.',
    defense: 'Stack or push early when the other team keeps going the same way, and go back to the usual setup when they change.',
  },
  radiant: {
    any: [
      'Every player knows the plan and the calls for each map, so play the comp your team has practiced over one that only looks better on paper.',
      'Small things win rounds here, like sound, spacing and timing, as much as the shots do.',
    ],
    attack: 'Read the defense from what the first utility shows, and change the plan mid-round when it’s stronger than you thought.',
    defense: 'Give the attackers different looks on the same site, so the information they gather doesn’t tell them where you’ll be.',
  },
};

/** Tips for a duo or a trio, whose other players are random: how to play, and what to ask the others for (while some haven't locked in). */
export const PARTY_TIPS: Record<1 | 2 | 3, { play: string; ask: string }> = {
  1: {
    play: 'Pick late if you can. Once your teammates lock in, add their agents under Teammates locked in and play what the team is missing.',
    ask: 'Say what you’ll play early, and ask for the roles the Planner suggests before your teammates lock in.',
  },
  2: {
    play: 'Pick two agents who cover each other, like an entry and the sentinel who holds the site behind them, or a flash and the duelist who runs in on it. The other three are random.',
    ask: 'Ask your random teammates for the roles the Planner suggests before they lock in.',
  },
  3: {
    play: 'Play your three together and let the random teammates take the other site or lane.',
    ask: 'Three of you can cover most of a comp, so ask the other two for the roles that are missing.',
  },
};

/**
 * Tips for a team with two of a role (what doubling up asks of the team), shown under "Two duelists"
 * and so on: one for each side, and one for a question about both. Two initiators get a tip built
 * from their kits instead (engine/tips.ts), since which one finds enemies and which one flashes
 * depends on who they are.
 */
export const DOUBLE_TIPS: Record<Exclude<Role, 'initiator'>, Record<Side | 'both', string>> = {
  duelist: {
    attack: 'Go in one right after the other, so the second can trade the first.',
    defense: 'Split them up, with one taking early fights for information and the other staying back to trade or retake.',
    both: 'On attack, go in one right after the other so the second can trade the first. On defense, one takes early fights and the other stays back.',
  },
  controller: {
    attack: 'One smokes the hit and the other plays mid or saves smokes for after the plant.',
    defense: 'One slows the hit with smokes, and the other keeps some back for the retake.',
    both: 'One smokes the fight that’s on and the other keeps some back, for after the plant on attack or for the retake on defense.',
  },
  sentinel: {
    attack: 'One watches the flank, and the other locks down the site after the plant.',
    defense: 'One holds each site with a setup, so neither site falls without a fight.',
    both: 'On defense, one holds each site with a setup. On attack, one watches the flank and the other locks down the plant.',
  },
};
