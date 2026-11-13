// Made by tools/prepare-art.mjs from the game's own content: don't edit by hand.
// Each agent's description, colors and abilities, and each map's callouts with their places on the
// minimap (fractions of its width and height).

export interface KitAbility { key: 'C' | 'Q' | 'E' | 'X' | 'Passive'; slot: string; name: string; text: string }
export interface Kit { about: string; colors: string[]; abilities: KitAbility[] }

export const KITS: Record<string, Kit> = {
 "astra": {
  "about": "Ghanaian Agent Astra harnesses the energies of the cosmos to reshape battlefields to her whim. With full command of her astral form and a talent for deep strategic foresight, she's always eons ahead of her enemy's next move.",
  "colors": [
   "#26146c",
   "#0f1923",
   "#5210c6"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Gravity Well",
    "text": "ACTIVATE a <whitebold>Star</> to create a zone that <debuffred>pulls</> all players to the center, exploding and applying <debuffred>vulnerable</> to all players."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Nova Pulse",
    "text": "ACTIVATE a <whitebold>Star</> to detonate it, <debuffred>concussing</> all players hit."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Nebula",
    "text": "ACTIVATE a <whitebold>Star</> to transform it into a smoke."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Cosmic Divide",
    "text": "ENTER <whitebold>Astral Form</>. ALT FIRE to EQUIP <whitebold>Cosmic Divide</>. FIRE to set, pivot and FIRE again to create an indestructible wall that blocks audio."
   },
   {
    "key": "Passive",
    "slot": "passive",
    "name": "Astral Form",
    "text": "ACTIVATE ULTIMATE to ENTER <whitebold>Astral Form</>. FIRE to cast <whitebold>Stars</>. INTERACT to recall a <whitebold>Star</>. Recalling a <whitebold>Star</> forms a brief smoke."
   }
  ]
 },
 "breach": {
  "about": "The bionic Swede Breach fires powerful, targeted kinetic blasts to aggressively clear a path through enemy ground. The damage and disruption he inflicts ensures no fight is ever fair.",
  "colors": [
   "#81331a",
   "#0f1923",
   "#523a23"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Aftershock",
    "text": "EQUIP <whitebold>Aftershock</>. FIRE to send a zone through a wall, exploding to repeatedly deal <debuffred>damage</> to all players."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Flashpoint",
    "text": "EQUIP a <whitebold>Flashpoint</>. FIRE to send it through a wall, exploding to <debuffred>flash</> all players looking at it."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Fault Line",
    "text": "EQUIP <whitebold>Fault Line</>. HOLD FIRE to increase distance. RELEASE to detonate a zone that <debuffred>concusses</> all players."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Rolling Thunder",
    "text": "EQUIP <whitebold>Rolling Thunder</>. FIRE to send forward a wave that <debuffred>concusses</> and <debuffred>knocks up</> all players."
   }
  ]
 },
 "brimstone": {
  "about": "Joining from the U.S.A., Brimstone's orbital arsenal ensures his squad always has the advantage. His ability to deliver utility precisely and safely make him the unmatched boots-on-the-ground commander.",
  "colors": [
   "#363c4f",
   "#0f1923",
   "#211d21"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Stim Beacon",
    "text": "INSTANTLY throw a <whitebold>Stim Beacon</>. On landing, create a zone that grants <teal>combat stim</> and <teal>haste</> to allies."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Incendiary",
    "text": "EQUIP <whitebold>Incendiary</>. FIRE to launch. On landing, create a zone that deals <debuffred>damage</> to all players."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Sky Smoke",
    "text": "EQUIP a tactical map. FIRE to set smoke locations. ALT FIRE to cast smokes."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Orbital Strike",
    "text": "EQUIP a tactical map. FIRE to cast an <whitebold>Orbital Strike</> at a location, dealing high <debuffred>damage</> over time to all players."
   }
  ]
 },
 "chamber": {
  "about": "Well-dressed and well-armed, French weapons designer Chamber expels aggressors with deadly precision. He leverages his custom arsenal to hold the line and pick off enemies from afar, with a contingency built for every plan.",
  "colors": [
   "#20435b",
   "#0f1923",
   "#372d2b"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Trademark",
    "text": "EQUIP a destructible <whitebold>Trademark</>. FIRE to place. Triggers on nearby visible enemies in range, creating a zone that <debuffred>slows</> all players. Can be recalled."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Headhunter",
    "text": "EQUIP <whitebold>Headhunter</>. FIRE to shoot. ALT FIRE to aim down sights."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Rendezvous",
    "text": "EQUIP a destructible <whitebold>Rendezvous</>. FIRE to place. While in range, REACTIVATE to instantly teleport to it. Can be recalled."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Tour De Force",
    "text": "ACTIVATE to access a sniper rifle that deals <debuffred>lethal damage</> with direct hits to the upper body. FIRE to shoot. ALT FIRE to aim down sights. On kills, create a zone that <debuffred>slows</> all players."
   }
  ]
 },
 "clove": {
  "about": "Scottish troublemaker Clove makes mischief for enemies in both the heat of combat and the cold of death. The young immortal keeps foes guessing, even from beyond the grave, their return to the living only ever a moment away.",
  "colors": [
   "#4b1d80",
   "#0f1923",
   "#c347c7"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Pick-me-up",
    "text": "ACTIVATE on a targeted dead enemy that you damaged or killed to gain <teal>haste</> and <teal>overheal</>."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Meddle",
    "text": "EQUIP <whitebold>Meddle</>. FIRE to throw. Explodes on landing, <debuffred>decaying</> all players."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Ruse",
    "text": "EQUIP a tactical map. FIRE to set smoke locations. ALT FIRE to cast smokes. While dead, Clove can access <whitebold>Ruse</> to cast brief smokes."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Not Dead Yet",
    "text": "On death, ACTIVATE to channel a <teal>self-resurrect</>. During the channel, Clove is <teal>intangible</>. REACTIVATE to end the channel early. Once resurrected, secure a kill or damaging assist to stay alive."
   }
  ]
 },
 "cypher": {
  "about": "The Moroccan information broker, Cypher is a one-man surveillance network who keeps tabs on the enemy's every move. No secret is safe. No maneuver goes unseen. Cypher is always watching.",
  "colors": [
   "#2f5078",
   "#0f1923",
   "#3f3f6c"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Trapwire",
    "text": "EQUIP a destructible <whitebold>Trapwire</>. FIRE to place a wire between surfaces. <whitebold>Trapwire</> <teal>stealths</> after placement. Triggers when enemies come in contact, <debuffred>tethering</> enemies, and after a delay, <debuffred>revealing</> them if <whitebold>Trapwire</> is not destroyed. Can be picked up."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Cyber Cage",
    "text": "INSTANTLY throw a <whitebold>Cyber Cage</>. INTERACT to create a vision-blocking cylinder that plays an audio cue when enemies come in contact. Can be picked up during BUY PHASE."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Spycam",
    "text": "EQUIP a destructible <whitebold>Spycam</>. FIRE to place. <whitebold>Spycam</> <teal>stealths</> after placement. REACTIVATE to control it. FIRE to shoot a dart that <debuffred>snapshots</> enemies hit until they remove it. Can be picked up."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Neural Theft",
    "text": "ACTIVATE on a targeted dead enemy. After a delay, <debuffred>snapshot</> living enemies twice."
   }
  ]
 },
 "deadlock": {
  "about": "Norwegian operative Deadlock deploys an array of cutting-edge nanowire to secure the battlefield from even the most lethal assault. No one escapes her vigilant watch, nor survives her unyielding ferocity.",
  "colors": [
   "#425495",
   "#0f1923",
   "#221c3d"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "ability2",
    "name": "GravNet",
    "text": "EQUIP <whitebold>GravNet</>. FIRE to throw. ALT FIRE to lob. Explodes on landing, forcing all players to <debuffred>crouch</> and move <debuffred>slowly</> until they remove the net."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Sonic Sensor",
    "text": "EQUIP a destructible <whitebold>Sonic Sensor</>. FIRE to place. Triggers on nearby detected enemy noise, creating a zone that <debuffred>concusses</> all players. <whitebold>Sonic Sensor</> <teal>stealths</> after placement. Can be picked up."
   },
   {
    "key": "E",
    "slot": "grenade",
    "name": "Barrier Mesh",
    "text": "EQUIP <whitebold>Barrier Mesh</>. FIRE to throw. On landing, create destructible markers that fortify after a delay. These markers form barriers that block player movement."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Annihilation",
    "text": "EQUIP <whitebold>Annihilation</>. FIRE to launch a zone, forcing the first enemy caught into a destructible cocoon that pulls them along a path for <debuffred>lethal damage</> unless the cocoon is destroyed."
   }
  ]
 },
 "fade": {
  "about": "Turkish bounty hunter Fade unleashes the power of raw nightmare to seize enemy secrets. Attuned with terror itself, she hunts down targets and reveals their deepest fears - before crushing them in the dark.",
  "colors": [
   "#1d2846",
   "#0f1923",
   "#18344c"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Prowler",
    "text": "EQUIP a destructible <whitebold>Prowler</>. FIRE to send it forward. HOLD FIRE to steer towards your crosshair. <debuffred>Chases</> the first enemy or <whitebold>Terror Trail</> it sees, <debuffred>nearsighting</> on impact."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Seize",
    "text": "EQUIP <whitebold>Seize</>. FIRE to throw. REACTIVATE to drop early. On landing, <debuffred>deafen</>, <debuffred>decay</>, and <debuffred>tether</> enemies."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Haunt",
    "text": "EQUIP a destructible <whitebold>Haunt</>. FIRE to throw. REACTIVATE to drop early. On landing, <debuffred>mark</> and <debuffred>reveal</> enemies in range and line of sight."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Nightfall",
    "text": "EQUIP <whitebold>Nightfall</>. FIRE to send forward a wave that <debuffred>deafens</>, <debuffred>decays</>, and <debuffred>marks</> enemies."
   },
   {
    "key": "Passive",
    "slot": "passive",
    "name": "Terror Trails",
    "text": "<debuffred>Marked</> enemies have their location tracked by <whitebold>Terror Trails</>."
   }
  ]
 },
 "gekko": {
  "about": "Gekko the Angeleno leads a tight-knit crew of calamitous creatures. His buddies bound forward, scattering enemies out of the way, with Gekko chasing them down to regroup and go again.",
  "colors": [
   "#371c5c",
   "#0f1923",
   "#3a2656"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Mosh Pit",
    "text": "EQUIP <whitebold>Mosh</>. FIRE to throw. ALT FIRE to lob. On landing, create a zone that deals low <debuffred>damage</> over time before exploding, dealing high <debuffred>damage</> to all players. Reverts to a <whitebold>Globule</>."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Wingman",
    "text": "EQUIP a destructible <whitebold>Wingman</>. FIRE to send it forward. <debuffred>Chases</> the first enemy it sees, <debuffred>concussing</> on impact. ALT FIRE to have <whitebold>Wingman</> plant or defuse at a targeted bomb site. Reverts to a <whitebold>Globule</>."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Dizzy",
    "text": "EQUIP a destructible <whitebold>Dizzy</>. FIRE to throw. Fires plasma at enemies in line of sight, <debuffred>blinding</> them. Reverts to a <whitebold>Globule</>."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Thrash",
    "text": "EQUIP a destructible <whitebold>Thrash</>. FIRE to take control. FIRE again to lunge and explode, <debuffred>detaining</> all players. FIRE while lunging to explode early. Reverts to a <whitebold>Globule</> only once."
   },
   {
    "key": "Passive",
    "slot": "passive",
    "name": "Globule",
    "text": "Gekko’s abilities transform into a <whitebold>Globule</> after use. INTERACT to reclaim nearby <whitebold>Globules</> to gain another charge after a short cooldown."
   }
  ]
 },
 "harbor": {
  "about": "Hailing from India’s coast, Harbor storms the field wielding ancient technology with dominion over water. He unleashes frothing rapids and crushing waves to shield his allies, or pummel those that oppose him.",
  "colors": [
   "#275146",
   "#0f1923",
   "#11434e"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Storm Surge",
    "text": "EQUIP <whitebold>Storm Surge</>. FIRE to throw. Explodes on landing, <debuffred>nearsighting</> and <debuffred>slowing</> all players."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "High Tide",
    "text": "EQUIP <whitebold>High Tide</>. FIRE to send forward a vision-blocking wall that <debuffred>slows</> all players who come in contact. HOLD FIRE to steer towards your crosshair. ALT FIRE to stop early."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Cove",
    "text": "ENTER The Deep. REACTIVATE to cast a smoke. HOLD FIRE/ALT FIRE to adjust distance. RELOAD to toggle view. After casting, REACTIVATE to transform the smoke into a destructible shield."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Reckoning",
    "text": "EQUIP <whitebold>Reckoning</>. FIRE to push forward a vision-blocking wall that <debuffred>nearsights</> and <debuffred>slows</> all players who come in contact. REACTIVATE to stop the wall early."
   }
  ]
 },
 "hush": {
  "about": "Chinese operative Hush uses her telekinesis to close the most classified cases. Fighting with precision and finesse, she redirects her combat utility in midair to disrupt and displace the enemy team before suspending them helplessly for the killing blow.",
  "colors": [
   "#3d2c44",
   "#0f1923",
   "#f47ac7"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Flow",
    "text": "INSTANTLY create an anchor. If Hush is in the air, briefly levitate in place. After a delay, propel towards it."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Flashbulb",
    "text": "EQUIP <whitebold>Flashbulb</>. FIRE to throw. ALT FIRE to prepare it instead. REACTIVATE to direct it towards your crosshair. Explodes on any surface or after a delay, <debuffred>flashing</> all players looking at it."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Displacement",
    "text": "EQUIP <whitebold>Displacement</>. FIRE to throw. ALT FIRE to prepare it instead. REACTIVATE to direct it towards your crosshair. Explodes on any surface or after a delay, <debuffred>pulling</> all players towards the center and <debuffred>concussing</> them if they collide with any surface or another player. Resets every two kills."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Suspension",
    "text": "INSTANTLY prepare <whitebold>Suspension</>. FIRE to send it forward, steering with your crosshair. REACTIVATE or press FIRE again to detonate, <debuffred>levitating</> all players."
   },
   {
    "key": "Passive",
    "slot": "passive",
    "name": "Telekinesis",
    "text": "Hush can pick up weapons, the Spike, and INTERACT with switches from an increased range."
   }
  ]
 },
 "iso": {
  "about": "Chinese fixer for hire Iso falls into a flow state to dismantle the opposition. Reconfiguring ambient energy into bulletproof protection, he advances with focus towards his next duel to the death.",
  "colors": [
   "#30336e",
   "#0f1923",
   "#20155d"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Contingency",
    "text": "EQUIP <whitebold>Contingency</>. FIRE to push forward an indestructible vision-blocking wall. ALT FIRE for a slower wall."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Undercut",
    "text": "EQUIP an <whitebold>Undercut</>. FIRE to send it forward. Applies <debuffred>suppress</> and <debuffred>vulnerable</> to all players."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Double Tap",
    "text": "INSTANTLY channel <whitebold>Focus</>. Gain a shield that blocks one instance of damage."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Kill Contract",
    "text": "EQUIP <whitebold>Kill Contract</>. FIRE to send forward a zone that pulls you and the first enemy hit into a duel. Channel <whitebold>Focus</> at the start of a duel."
   },
   {
    "key": "Passive",
    "slot": "passive",
    "name": "Focus",
    "text": "While <whitebold>Focused</>, reload faster and spawn destructible energy orbs from dead enemies Iso has damaged or killed. When an energy orb is shot, grant a shield that blocks one instance of damage and refresh <whitebold>Focus</>."
   }
  ]
 },
 "jett": {
  "about": "Representing her home country of South Korea, Jett's agile and evasive fighting style lets her take risks no one else can. She runs circles around every skirmish, cutting enemies up before they even know what hit them.",
  "colors": [
   "#25607a",
   "#0f1923",
   "#0f1923"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Cloudburst",
    "text": "INSTANTLY throw a cloud. Forms into a brief smoke on any surface or after a delay. HOLD ACTIVATE to steer towards your crosshair."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Updraft",
    "text": "INSTANTLY propel high into the air."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Tailwind",
    "text": "INSTANTLY prepare a dash. REACTIVATE to dash forward or in your movement direction. Resets every two kills."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Blade Storm",
    "text": "INSTANTLY access five accurate throwing knives that deal <debuffred>lethal damage</> with direct hits to the head. FIRE to shoot. On kills, refresh your knives. ALT FIRE to throw all remaining knives without a refresh."
   },
   {
    "key": "Passive",
    "slot": "passive",
    "name": "Drift",
    "text": "HOLD JUMP while falling to <teal>glide</>."
   }
  ]
 },
 "kayo": {
  "about": "KAY/O is a machine of war built for a single purpose: neutralizing radiants. His power to Suppress enemy abilities dismantles his opponents' capacity to fight back, securing him and his allies the ultimate edge.",
  "colors": [
   "#1c2a69",
   "#0f1923",
   "#1a1e4b"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "FRAG/ment",
    "text": "EQUIP <whitebold>FRAG/ment</>. FIRE to throw. ALT FIRE to lob. Explodes on landing, repeatedly dealing pulses of <debuffred>damage</> to all players."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "FLASH/drive",
    "text": "EQUIP a <whitebold>FLASH/drive</>. FIRE to throw. ALT FIRE to lob. After a delay, explode, <debuffred>flashing</> all players looking at it."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "ZERO/point",
    "text": "EQUIP a destructible <whitebold>ZERO/point</>. FIRE to throw. Pulses on any surface, <debuffred>suppressing</> enemies within range."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "NULL/cmd",
    "text": "INSTANTLY gain <teal>overloaded</> and repeatedly send out a pulse that <debuffred>suppresses</> enemies within range. <teal>Overloaded</> grants <teal>combat stim</>. Upon taking <debuffred>lethal damage</>, KAY/O is downed and can be re-stabilized."
   }
  ]
 },
 "killjoy": {
  "about": "The genius of Germany, Killjoy effortlessly secures key battlefield positions with her arsenal of inventions. If their damage doesn't take her enemies out, the debuff her robots provide will make short work of them.",
  "colors": [
   "#522162",
   "#0f1923",
   "#413950"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Nanoswarm",
    "text": "EQUIP a destructible <whitebold>Nanoswarm</>. FIRE to throw. ALT FIRE to lob. <whitebold>Nanoswarm</> <teal>stealths</> after landing. INTERACT to create a zone that deals <debuffred>damage</> to all players. Can be picked up during BUY PHASE."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Alarmbot",
    "text": "EQUIP a destructible <whitebold>Alarmbot</>. FIRE to place. <whitebold>Alarmbot</> <teal>stealths</> after placement. Triggers on nearby visible enemies in range. <debuffred>Chases</> the first enemy it sees, exploding and applying <debuffred>vulnerable</>. Can be recalled."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Turret",
    "text": "EQUIP a destructible <whitebold>Turret</>. While equipped, REACTIVATE to flip the direction or HOLD ALT FIRE to rotate. FIRE to place. Shoots at enemies in line of sight. Can be recalled."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Lockdown",
    "text": "EQUIP a destructible <whitebold>Lockdown</>. FIRE to prepare a zone. After a delay, <debuffred>detain</> enemies within range."
   }
  ]
 },
 "miks": {
  "about": "Straight from Croatia, Miks takes the stage channeling pure sound energy. With his infectious passion and sonic powers, he rallies his squad to move as one as they set the tempo on the battlefield together.",
  "colors": [
   "#462b75",
   "#0f1923",
   "#344673"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "M-pulse",
    "text": "EQUIP a destructible <whitebold>M-Pulse</>. ALT FIRE to toggle between <debuffred>concuss</> or <teal>heal</>. FIRE to throw. Repeatedly pulses on landing, applying the selected effect on all players within range."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Harmonize",
    "text": "EQUIP <whitebold>Harmonize</>. FIRE on a targeted ally to grant <teal>combat stim</> and <teal>haste</> to them and yourself. On kills while active, refresh the <teal>buff</> if both <whitebold>Harmonized</> players are still alive. ALT FIRE to self-cast with no refresh."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Waveform",
    "text": "EQUIP a tactical map. FIRE to set smoke locations. ALT FIRE to cast smokes."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Bassquake",
    "text": "EQUIP <whitebold>Bassquake</>. FIRE to send forward a zone that <debuffred>deafens</>, <debuffred>knocks back</>, and <debuffred>slows</> all players."
   }
  ]
 },
 "neon": {
  "about": "Filipino Agent Neon surges forward at shocking speeds, discharging bursts of bioelectric radiance as fast as her body generates it. She races ahead to catch enemies off guard then strikes them down quicker than lightning.",
  "colors": [
   "#413476",
   "#0f1923",
   "#38328e"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Fast Lane",
    "text": "INSTANTLY launch two vision-blocking walls that extend until they hit a surface."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Relay Bolt",
    "text": "INSTANTLY throw a bolt that bounces once. Explodes on each surface, <debuffred>concussing</> all players."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "High Gear",
    "text": "INSTANTLY consume fuel to gain <teal>haste</>. REACTIVATE to cancel. ALT FIRE to slide forward or in your movement direction. Slide resets every two kills."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Overdrive",
    "text": "INSTANTLY refresh <whitebold>High Gear</>. Access an accurate lightning beam that can be used while activating <whitebold>High Gear</>. FIRE to shoot. On kills, fully recharge fuel."
   },
   {
    "key": "Passive",
    "slot": "passive",
    "name": "Battery",
    "text": "Passively recharge fuel over time."
   }
  ]
 },
 "omen": {
  "about": "A phantom of a memory, Omen hunts in the shadows. He renders enemies blind, teleports across the field, then lets paranoia take hold as his foe scrambles to uncover where he might strike next.",
  "colors": [
   "#433178",
   "#0f1923",
   "#344673"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Shrouded Step",
    "text": "EQUIP a <whitebold>Shrouded Step</>. FIRE to briefly channel, then teleport to a targeted location."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Paranoia",
    "text": "EQUIP <whitebold>Paranoia</>. FIRE to send it forward. Applies <debuffred>nearsight</> and <debuffred>deafens</> all players."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Dark Cover",
    "text": "ENTER Shadow Vision. REACTIVATE to cast a smoke. HOLD FIRE/ALT FIRE to adjust distance. RELOAD to toggle view."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "From the Shadows",
    "text": "EQUIP a tactical map. FIRE to begin a teleport to a selected location. While teleporting, Omen appears as a destructible shade at the destination. REACTIVATE to cancel."
   }
  ]
 },
 "phoenix": {
  "about": "Hailing from the U.K., Phoenix's star power shines through in his fighting style, igniting the battlefield with flash and flare. Whether he's got backup or not, he's rushing in to fight on his own terms.",
  "colors": [
   "#74321c",
   "#0f1923",
   "#262423"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Blaze",
    "text": "EQUIP <whitebold>Blaze</>. FIRE to send forward a vision-blocking <whitebold>fire</> wall that deals <debuffred>damage</> to all players. HOLD FIRE to steer towards your crosshair."
   },
   {
    "key": "Q",
    "slot": "ability2",
    "name": "Curveball",
    "text": "EQUIP a <whitebold>Curveball</>. FIRE to curve left, ALT FIRE to curve right. After a delay, explode, <debuffred>flashing</> all players looking at it. Resets every two kills."
   },
   {
    "key": "E",
    "slot": "ability1",
    "name": "Hot Hands",
    "text": "EQUIP <whitebold>Hot Hands</>. FIRE to throw. ALT FIRE to lob. On landing, create a <whitebold>fire</> zone that deals <debuffred>damage</> to all players."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Run it Back",
    "text": "INSTANTLY place a marker at your location. Upon taking <debuffred>lethal damage</> or when <whitebold>Run it Back</> expires, return to the marker with full health and the amount of armor you had when the ability was activated."
   },
   {
    "key": "Passive",
    "slot": "passive",
    "name": "Inner Fire",
    "text": "Phoenix <teal>heals</> while standing in his own <whitebold>fire</> instead of taking damage."
   }
  ]
 },
 "raze": {
  "about": "Raze explodes out of Brazil with her big personality and big guns. With her blunt-force-trauma playstyle, she excels at flushing entrenched enemies and clearing tight spaces with a generous dose of \"boom.\"",
  "colors": [
   "#742e1e",
   "#0f1923",
   "#2c5942"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Boom Bot",
    "text": "EQUIP a destructible <whitebold>Boom Bot</>. FIRE to send it forward. <debuffred>Chases</> the first enemy it sees, exploding and dealing <debuffred>damage</> to enemies on impact."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Blast Pack",
    "text": "INSTANTLY throw a destructible <whitebold>Blast Pack</> that sticks to surfaces that fully arms after a delay. REACTIVATE to detonate, <debuffred>knocking away</> anything hit. If fully armed, <whitebold>Blast Pack</> will also deal <debuffred>damage</> to enemies."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Paint Shells",
    "text": "EQUIP <whitebold>Paint Shells</>. FIRE to throw. ALT FIRE to lob. After a delay, explode, dealing <debuffred>damage</> and creating sub-munitions, each also dealing <debuffred>damage</> to all players. Resets every two kills."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Showstopper",
    "text": "INSTANTLY prepare <whitebold>Showstopper</>. FIRE to launch. Explodes on any surface, dealing high <debuffred>damage</> to all players."
   }
  ]
 },
 "reyna": {
  "about": "Forged in the heart of Mexico, Reyna dominates single combat, popping off with each kill she scores. Her capability is only limited by her raw skill, making her sharply dependent on performance.",
  "colors": [
   "#662d62",
   "#0f1923",
   "#2f2664"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Leer",
    "text": "EQUIP a destructible <whitebold>Leer</>. FIRE to send. After a delay, form, <debuffred>nearsighting</> enemies looking at it."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Devour",
    "text": "INSTANTLY consume a <whitebold>Soul Orb</> to <teal>heal</>. Excess healing is converted into <teal>overheal</>. While ULTIMATE is active, <whitebold>Devour</> auto-casts."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Dismiss",
    "text": "INSTANTLY consume a <whitebold>Soul Orb</> to briefly become <teal>intangible</>. REACTIVATE to cancel early. While ULTIMATE is active, also gain <teal>invisibility</>."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Empress",
    "text": "INSTANTLY gain <teal>Empress</>. <teal>Empress</> grants <teal>combat stim</>, endless <whitebold>Soul Orb</> consumption, and permanent <teal>overheal</>."
   },
   {
    "key": "Passive",
    "slot": "passive",
    "name": "Vitality",
    "text": "Spawn a <whitebold>Soul Orb</> from dead enemies Reyna has damaged or killed."
   }
  ]
 },
 "sage": {
  "about": "The bastion of China, Sage creates safety for herself and her team wherever she goes. Able to revive fallen friends and stave off forceful assaults, she provides a calm center to a hellish battlefield.",
  "colors": [
   "#1f5148",
   "#0f1923",
   "#102d23"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Barrier Orb",
    "text": "EQUIP a destructible <whitebold>Barrier Orb</>. While equipped, REACTIVATE to pivot the wall or HOLD ALT FIRE to rotate. FIRE to place a destructible wall that fortifies after a delay."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Slow Orb",
    "text": "EQUIP a <whitebold>Slow Orb</>. FIRE to throw. On landing, create a zone that <debuffred>slows</> all players and plays an audio cue when enemies run through it."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Healing Orb",
    "text": "EQUIP <whitebold>Healing Orb</>. FIRE on a damaged ally to grant <teal>healing</>. ALT FIRE to self-cast."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Resurrection",
    "text": "EQUIP <whitebold>Resurrection</>. FIRE on a targeted dead ally to <teal>resurrect</> them."
   }
  ]
 },
 "skye": {
  "about": "Hailing from Australia, Skye and her band of beasts trailblaze the way through hostile territory. With her creations hampering the enemy, and her power to heal others, the team is strongest and safest by Skye's side.",
  "colors": [
   "#436a51",
   "#0f1923",
   "#4f1413"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Regrowth",
    "text": "EQUIP <whitebold>Regrowth</>. HOLD FIRE to <teal>heal</> allies in range and line of sight. Uses a limited healing pool. Cannot heal self."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Trailblazer",
    "text": "EQUIP a destructible <whitebold>Trailblazer</>. FIRE to take control. FIRE again to lunge and explode, <debuffred>concussing</> all players and dealing <debuffred>damage</> to enemies on direct hits."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Guiding Light",
    "text": "EQUIP a <whitebold>Guiding Light</>. FIRE to send it forward. HOLD FIRE to steer towards your crosshair. REACTIVATE to detonate, <debuffred>flashing</> all players looking at it."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Seekers",
    "text": "EQUIP destructible <whitebold>Seekers</>. FIRE to send out up to three <whitebold>Seekers</>. <debuffred>Chases</> the three closest enemies, <debuffred>nearsighting</> and <debuffred>slowing</> on impact."
   }
  ]
 },
 "sova": {
  "about": "Born from the eternal winter of Russia's tundra, Sova tracks, finds, and eliminates enemies with ruthless efficiency and precision. His custom bow and incredible scouting abilities ensure that even if you run, you cannot hide.",
  "colors": [
   "#355285",
   "#0f1923",
   "#101c47"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Owl Drone",
    "text": "EQUIP a destructible <whitebold>Owl Drone</>. FIRE to take control. FIRE again to shoot a dart that repeatedly <debuffred>reveals</> enemies."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Shock Bolt",
    "text": "EQUIP a <whitebold>Shock Bolt</>. FIRE to shoot a bolt that explodes on any surface, dealing <debuffred>damage</> to all players. HOLD FIRE to increase the bolt’s velocity. ALT FIRE to add up to two bounces."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Recon Bolt",
    "text": "EQUIP a destructible <whitebold>Recon Bolt</>. FIRE to shoot a bolt that repeatedly <debuffred>reveals</> nearby enemies in range and line of sight. HOLD FIRE to increase the bolt’s velocity. ALT FIRE to add up to two bounces."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Hunter's Fury",
    "text": "EQUIP <whitebold>Hunter’s Fury</>. FIRE to shoot a zone that deals <debuffred>damage</>. Can be fired up to two more times. Enemies hit are <debuffred>revealed</> to Sova."
   }
  ]
 },
 "tejo": {
  "about": "A veteran intelligence consultant from Colombia, Tejo’s ballistic guidance system pressures the enemy to relinquish their ground - or their lives. His targeted strikes keep opponents off balance and under his heel.",
  "colors": [
   "#80451b",
   "#0f1923",
   "#ffffff"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Stealth Drone",
    "text": "EQUIP a destructible <whitebold>Stealth Drone</>. FIRE to take control. FIRE again to <debuffred>reveal</> and <debuffred>suppress</> nearby enemies in range and line of sight."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Special Delivery",
    "text": "EQUIP <whitebold>Special Delivery</>. FIRE to launch. ALT FIRE to launch with a bounce. Explodes on any surface, <debuffred>concussing</> and <debuffred>damaging</> all players."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Guided Salvo",
    "text": "EQUIP a tactical map. FIRE to set locations. ALT FIRE to launch missiles that travel to and repeatedly pulse, dealing <debuffred>damage</> to all players."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Armageddon",
    "text": "EQUIP a tactical map. FIRE to set, pivot and FIRE again to cast a wave that deals high <debuffred>damage</> to all players. ALT FIRE to cancel targeting."
   }
  ]
 },
 "veto": {
  "about": "Empowered by an unstoppable DNA mutation, Senegalese enforcer Veto defies the rules of engagement by nullifying his opponent's powers and technology. On Veto's battlefield, gunplay is your only guarantee.",
  "colors": [
   "#1a5d65",
   "#0f1923",
   "#0f1923"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Crosscut",
    "text": "EQUIP a destructible <whitebold>Crosscut</>. FIRE to place. While in range, INTERACT to teleport to it. Can be recalled during BUY PHASE."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Chokehold",
    "text": "EQUIP a destructible <whitebold>Chokehold</>. FIRE to throw. <whitebold>Chokehold</> <teal>stealths</> after landing. Triggers on nearby visible enemies in range, <debuffred>deafening</>, <debuffred>decaying</>, and <debuffred>tethering</> enemies. Can be recalled during BUY PHASE."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Interceptor",
    "text": "EQUIP a destructible <whitebold>Interceptor</>. FIRE to place. REACTIVATE to activate. While active, destroy any enemy utility that can be shot or would bounce off players in range and line of sight. Can be recalled."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Evolution",
    "text": "INSTANTLY gain <teal>evolution</>. <teal>Evolution</> grants <teal>combat stim</>, continuous <teal>healing</>, and <teal>immunity</> to all debuffs and damage, except weapons."
   }
  ]
 },
 "viper": {
  "about": "The American Chemist, Viper deploys an array of poisonous chemical devices to control the battlefield and choke the enemy's vision. If the toxins don't kill her prey, her mindgames surely will.",
  "colors": [
   "#1a5f46",
   "#0f1923",
   "#2c4f5e"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Snake Bite",
    "text": "EQUIP <whitebold>Snake Bite</>. FIRE to launch. On landing, create a zone that grants <debuffred>vulnerable</> and deals low <debuffred>damage</> to all players."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Poison Cloud",
    "text": "EQUIP <whitebold>Poison Cloud</>. FIRE to throw. ALT FIRE to lob. REACTIVATE to consume fuel to create a <whitebold>toxic</> smoke that <debuffred>decays</> enemies. Can be picked up during BUY PHASE."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Toxic Screen",
    "text": "EQUIP <whitebold>Toxic Screen</>. FIRE to send forward and place a line of emitters. REACTIVATE to consume fuel to create a <whitebold>toxic</> vision-blocking wall that <debuffred>decays</> enemies."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Viper's Pit",
    "text": "EQUIP <whitebold>Viper’s Pit</>. FIRE to form a large <whitebold>toxic</> vision-blocking cloud that <debuffred>decays</> enemies inside. HOLD ACTIVATE to cancel the cloud."
   },
   {
    "key": "Passive",
    "slot": "passive",
    "name": "Toxin",
    "text": "Viper’s <whitebold>Toxin</> continuously inflicts <debuffred>decay</> when enemies come in contact. Passively recharge fuel over time."
   }
  ]
 },
 "vyse": {
  "about": "Metallic mastermind Vyse unleashes liquid metal to isolate, trap, and disarm her enemies. Through cunning and manipulation, she forces all who oppose her to fear the battlefield itself.",
  "colors": [
   "#492280",
   "#0f1923",
   "#ffffff"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Razorvine",
    "text": "EQUIP a destructible <whitebold>Razorvine</>. FIRE to throw. <whitebold>Razorvine</> <teal>stealths</> after landing. INTERACT to create a zone that <debuffred>slows</> and deals <debuffred>damage</> when players move through it. Can be recalled during BUY PHASE."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Shear",
    "text": "EQUIP <whitebold>Shear</>. FIRE to place. <whitebold>Shear</> <teal>stealths</> after placement. Triggers when enemies walk on it, and after a delay, create a brief indestructible wall. Can be recalled during BUY PHASE."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Arc Rose",
    "text": "EQUIP a destructible <whitebold>Arc Rose</>. FIRE to place. ALT FIRE to place it through a wall. REACTIVATE to <debuffred>flash</> all players looking at it. Can be recalled."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Steel Garden",
    "text": "EQUIP <whitebold>Steel Garden</>. FIRE to prepare a zone. After a delay, <debuffred>jam</> enemy primary weapons within range."
   }
  ]
 },
 "waylay": {
  "about": "Thailand's prismatic radiant Waylay transforms into light itself as she darts across the battlefield, striking down her targets through shards of light before flitting back to safety, all in the blink of an eye.",
  "colors": [
   "#482e61",
   "#0f1923",
   "#0f1923"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Saturate",
    "text": "EQUIP <whitebold>Saturate</>. FIRE to throw. Explodes on landing, <debuffred>hindering</> all players."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Lightspeed",
    "text": "EQUIP <whitebold>Lightspeed</>. FIRE to dash forward twice. ALT FIRE to dash forward once. Only the first dash can launch upward."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Refract",
    "text": "INSTANTLY place a marker at your location. REACTIVATE to travel to it. While traveling, Waylay is <teal>immune</> but cannot see enemies. Resets every two kills."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Convergent Paths",
    "text": "EQUIP <whitebold>Convergent Paths</>. FIRE to gain <teal>haste</> and send forward a zone that <debuffred>hinders</> all players."
   }
  ]
 },
 "yoru": {
  "about": "Japanese native Yoru rips holes straight through reality to infiltrate enemy lines unseen. Using deception and aggression in equal measure, he gets the drop on each target before they know where to look.",
  "colors": [
   "#222b67",
   "#0f1923",
   "#261e4f"
  ],
  "abilities": [
   {
    "key": "C",
    "slot": "grenade",
    "name": "Fakeout",
    "text": "EQUIP <whitebold>Fakeout</>. FIRE to send a destructible clone forward. ALT FIRE to place a marker at your location. INTERACT to transform the marker into a clone. Clones continuously walk forward and will turn toward the first enemy that shoots it, <debuffred>flashing</> all players looking at it."
   },
   {
    "key": "Q",
    "slot": "ability1",
    "name": "Blindside",
    "text": "EQUIP <whitebold>Blindside</>. FIRE to throw. After bouncing off a surface, explode, <debuffred>flashing</> all players looking at it."
   },
   {
    "key": "E",
    "slot": "ability2",
    "name": "Gatecrash",
    "text": "EQUIP <whitebold>Gatecrash</>. FIRE to send it forward. ALT FIRE to place. REACTIVATE to teleport to it. INTERACT to fake a teleport. Resets every two kills."
   },
   {
    "key": "X",
    "slot": "ultimate",
    "name": "Dimensional Drift",
    "text": "EQUIP <whitebold>Dimensional Drift</>. FIRE to become <teal>intangible</> and <teal>invisible</>. <whitebold>Gatecrash</> is accessible during this state. REACTIVATE to exit early."
   }
  ]
 }
};

export const CALLOUTS: Record<string, [name: string, x: number, y: number][]> = {"abyss":[["A Bridge",0.47,0.038],["A Link",0.302,0.273],["A Lobby",0.775,0.237],["A Main",0.634,0.192],["A Secret",0.188,0.194],["A Security",0.259,0.103],["A Site",0.484,0.152],["A Tower",0.49,0.255],["A Vent",0.474,0.362],["Attacker Side Spawn",0.901,0.423],["B Danger",0.557,0.974],["B Link",0.31,0.662],["B Lobby",0.826,0.796],["B Main",0.624,0.86],["B Nest",0.674,0.903],["B Site",0.405,0.858],["B Tower",0.298,0.818],["Defender Side Spawn",0.073,0.423],["Mid Bend",0.587,0.638],["Mid Bottom",0.547,0.532],["Mid Catwalk",0.543,0.451],["Mid Library",0.451,0.526],["Mid Top",0.308,0.437]],"ascent":[["A Garden",0.285,0.309],["A Lobby",0.603,0.259],["A Main",0.484,0.201],["A Rafters",0.239,0.144],["A Site",0.35,0.142],["A Tree",0.398,0.295],["A Window",0.241,0.292],["A Wine",0.486,0.058],["Attacker Side Spawn",0.817,0.569],["B Boat House",0.27,0.887],["B Lobby",0.717,0.678],["B Main",0.405,0.712],["B Site",0.285,0.737],["Defender Side Spawn",0.132,0.434],["Mid Bottom",0.397,0.495],["Mid Catwalk",0.525,0.411],["Mid Courtyard",0.493,0.488],["Mid Cubby",0.455,0.336],["Mid Link",0.514,0.617],["Mid Market",0.298,0.497],["Mid Pizza",0.306,0.447],["Mid Top",0.665,0.38]],"bind":[["A Bath",0.839,0.43],["A Cubby",0.587,0.46],["A Exit",0.924,0.522],["A Lamps",0.582,0.339],["A Link",0.518,0.592],["A Lobby",0.763,0.607],["A Short",0.624,0.497],["A Site",0.734,0.333],["A Teleporter",0.606,0.411],["A Tower",0.728,0.208],["Attacker Side Cave",0.592,0.736],["Attacker Side Spawn",0.582,0.958],["B Elbow",0.158,0.306],["B Exit",0.473,0.441],["B Fountain",0.259,0.629],["B Garden",0.247,0.428],["B Hall",0.285,0.202],["B Link",0.422,0.592],["B Long",0.193,0.515],["B Short",0.397,0.53],["B Site",0.292,0.312],["B Teleporter",0.151,0.435],["B Window",0.323,0.447],["Defender Side Spawn",0.517,0.104]],"breeze":[["A Bridge",0.712,0.245],["A Lobby",0.703,0.921],["A Pyramids",0.847,0.469],["A Ramp",0.656,0.322],["A Shop",0.763,0.683],["A Site",0.908,0.495],["Attacker Side Spawn",0.434,0.873],["B Back",0.068,0.305],["B Elbow",0.262,0.506],["B Main",0.154,0.585],["B Site",0.07,0.382],["B Tunnel",0.364,0.382],["B Wall",0.255,0.235],["B Window",0.173,0.677],["Defender Side Arches",0.374,0.175],["Defender Side Spawn",0.712,0.21],["Mid Bottom",0.498,0.723],["Mid Cannon",0.336,0.63],["Mid Hall",0.639,0.535],["Mid Nest",0.484,0.228],["Mid Pillar",0.498,0.541],["Mid Top",0.502,0.401],["Mid Wood Doors",0.644,0.495]],"corrode":[["A Crane",0.243,0.203],["A Elbow",0.381,0.109],["A Link",0.453,0.375],["A Lobby",0.708,0.197],["A Main",0.612,0.085],["A Pocket",0.47,0.109],["A Site",0.398,0.258],["A Yard",0.47,0.197],["Attacker Side Spawn",0.923,0.502],["B Arch",0.218,0.717],["B Elbow",0.321,0.891],["B Link",0.398,0.59],["B Lobby",0.72,0.617],["B Main",0.579,0.69],["B Site",0.444,0.69],["B Tower",0.321,0.746],["Defender Side Spawn",0.124,0.499],["Mid Bottom",0.538,0.491],["Mid Stairs",0.423,0.491],["Mid Top",0.398,0.491],["Mid Window",0.309,0.491]],"fracture":[["A Dish",0.666,0.275],["A Door",0.708,0.703],["A Drop",0.777,0.43],["A Gate",0.679,0.145],["A Hall",0.717,0.761],["A Link",0.659,0.487],["A Main",0.826,0.697],["A Rope",0.639,0.638],["A Site",0.82,0.522],["Attacker Side Bridge",0.498,0.126],["Attacker Side Spawn",0.483,0.817],["B Arcade",0.231,0.362],["B Bench",0.331,0.261],["B Canteen",0.312,0.601],["B Generator",0.293,0.504],["B Link",0.343,0.438],["B Main",0.14,0.69],["B Site",0.093,0.518],["B Tower",0.12,0.442],["B Tree",0.236,0.769],["B Tunnel",0.24,0.579],["Defender Side Spawn",0.504,0.442]],"haven":[["A Garden",0.742,0.41],["A Link",0.29,0.324],["A Lobby",0.624,0.385],["A Long",0.576,0.177],["A Sewer",0.5,0.384],["A Site",0.402,0.17],["A Tower",0.308,0.139],["Attacker Side Spawn",0.895,0.512],["B Back",0.294,0.495],["B Site",0.401,0.501],["C Cubby",0.601,0.802],["C Garage",0.493,0.629],["C Link",0.343,0.649],["C Lobby",0.664,0.766],["C Long",0.644,0.894],["C Site",0.418,0.821],["C Window",0.419,0.643],["Defender Side Spawn",0.14,0.422],["Mid Courtyard",0.59,0.506],["Mid Doors",0.624,0.631],["Mid Window",0.676,0.496]],"icebox":[["A Belt",0.399,0.823],["A Nest",0.525,0.783],["A Pipes",0.493,0.747],["A Rafters",0.766,0.769],["A Screen",0.7,0.672],["A Site",0.691,0.765],["Attacker Side Spawn",0.14,0.587],["B Back",0.768,0.287],["B Cubby",0.39,0.229],["B Fence",0.719,0.279],["B Garage",0.358,0.395],["B Green",0.41,0.337],["B Hall",0.68,0.283],["B Hut",0.777,0.407],["B Kitchen",0.705,0.465],["B Orange",0.583,0.35],["B Site",0.646,0.18],["B Snow Pile",0.64,0.432],["B Snowman",0.745,0.143],["B Tube",0.552,0.47],["B Yellow",0.458,0.157],["Defender Side Spawn",0.97,0.575],["Mid Blue",0.53,0.508],["Mid Boiler",0.671,0.548],["Mid Pallet",0.588,0.625]],"lotus":[["A Door",0.829,0.514],["A Drop",0.893,0.233],["A Hut",0.855,0.348],["A Link",0.605,0.485],["A Lobby",0.666,0.724],["A Main",0.754,0.537],["A Root",0.692,0.601],["A Rubble",0.809,0.601],["A Site",0.855,0.361],["A Stairs",0.733,0.323],["A Top",0.818,0.251],["A Tree",0.855,0.475],["Attacker Side Spawn",0.511,0.817],["B Main",0.451,0.567],["B Pillars",0.503,0.661],["B Site",0.503,0.459],["B Upper",0.564,0.365],["C Bend",0.075,0.51],["C Door",0.329,0.571],["C Gravel",0.329,0.274],["C Hall",0.148,0.349],["C Link",0.356,0.377],["C Lobby",0.341,0.817],["C Main",0.228,0.535],["C Mound",0.341,0.64],["C Site",0.148,0.437],["C Waterfall",0.311,0.434],["Defender Side Spawn",0.577,0.22]],"pearl":[["A Art",0.746,0.56],["A Dugout",0.937,0.318],["A Flowers",0.676,0.193],["A Link",0.776,0.444],["A Main",0.779,0.419],["A Restaurant",0.7,0.57],["A Secret",0.779,0.1],["A Site",0.915,0.4],["Attacker Side Spawn",0.434,0.959],["B Club",0.367,0.854],["B Hall",0.094,0.331],["B Link",0.434,0.565],["B Main",0.139,0.6],["B Ramp",0.184,0.78],["B Screen",0.09,0.428],["B Site",0.258,0.464],["B Tower",0.258,0.25],["B Tunnel",0.312,0.216],["Defender Side Records",0.366,0.216],["Defender Side Spawn",0.51,0.051],["Defender Side Water",0.621,0.307],["Mid Connector",0.621,0.444],["Mid Doors",0.527,0.549],["Mid Plaza",0.455,0.702],["Mid Shops",0.367,0.854],["Mid Top",0.537,0.754]],"split":[["A Back",0.229,0.125],["A Lobby",0.65,0.166],["A Main",0.492,0.208],["A Rafters",0.354,0.274],["A Ramps",0.472,0.36],["A Screens",0.15,0.257],["A Sewer",0.658,0.318],["A Site",0.315,0.184],["A Tower",0.316,0.336],["Attacker Side Spawn",0.847,0.549],["B Alley",0.213,0.788],["B Back",0.264,0.94],["B Garage",0.542,0.868],["B Link",0.657,0.7],["B Lobby",0.687,0.797],["B Rafters",0.369,0.747],["B Site",0.354,0.867],["B Stairs",0.315,0.615],["B Tower",0.43,0.684],["Defender Side Spawn",0.143,0.53],["Mid Bottom",0.616,0.548],["Mid Mail",0.467,0.607],["Mid Top",0.484,0.54],["Mid Vent",0.426,0.451]],"summit":[["A Art",0.792,0.265],["A Cave",0.957,0.265],["A Garden",0.792,0.403],["A Hall",0.692,0.265],["A Link",0.651,0.36],["A Lobby",0.694,0.741],["A Main",0.694,0.566],["A Site",0.917,0.403],["Attacker Side Spawn",0.04,0.896],["B Drop",0.053,0.24],["B Gym",0.28,0.19],["B Link",0.331,0.416],["B Lobby",0.289,0.595],["B Main",0.186,0.491],["B Site",0.151,0.338],["B Tower",0.156,0.216],["B Trophy",0.323,0.298],["Defender Side Spawn",0.511,0.073],["Mid Bend",0.636,0.493],["Mid Bottom",0.484,0.416],["Mid Fountain",0.511,0.553],["Mid Tiles",0.365,0.607],["Mid Top",0.537,0.677],["Mid Window",0.484,0.326]],"sunset":[["A Alley",0.781,0.25],["A Elbow",0.828,0.5],["A Link",0.734,0.344],["A Lobby",0.656,0.656],["A Main",0.672,0.547],["A Site",0.75,0.438],["Attacker Side Spawn",0.469,0.986],["B Boba",0.126,0.344],["B Lobby",0.297,0.781],["B Main",0.059,0.672],["B Market",0.235,0.531],["B Site",0.044,0.562],["Defender Side Spawn",0.345,0.219],["Mid Bottom",0.342,0.656],["Mid Courtyard",0.406,0.562],["Mid Tiles",0.531,0.656],["Mid Top",0.344,0.36]]};
