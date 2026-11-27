// How the checks read the engine's sentences back, whichever of its wordings a comp gets: who a con
// names as the sources of a strength the comp is short of, and whether a comp's plan says each of
// its parts. The wordings themselves live in src/core/engine/explain.ts; this file only recognises
// them, so a check finds the same facts in every form.
import { PHASES, type PlanPart } from '../../src/core/engine/explain.ts';
import { agentById } from '../../src/core/kb/agents.ts';
import { DIM_INFO, type Dim } from '../../src/core/kb/roles.ts';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Who a con names as the sources of a strength, as one list ("Fade’s Haunt and Prowler, and Killjoy’s Turret"). */
export interface Sources {
  list: string;
  /**
   * 'gap': a strength the comp is short of; 'little': three or more sources that add up to only a
   * little of it; 'thin': the comp's thinnest spot, gone once the utility is used or the player is down.
   */
  kind: 'gap' | 'little' | 'thin';
}

/** The first sentence of a con, which names the sources, and the rest (what the map needs, and the advice). */
function split(line: string): [string, string] {
  const [first = '', ...rest] = line.split(/(?<=\.) (?=[A-Z])/);
  return [first.replace(/\.$/, ''), rest.join(' ')];
}

/** The second sentence of a con about a comp's thinnest spot: what to do once it's gone. */
const THEN = /^(?:Once (?:it’s|they’re) used|When (?:it’s|they’re) spent|After (?:that|those)|If .+? go(?:es)? down), /;

/** The sources a con names for a strength, in any of its leads, or undefined when it isn't one of those cons. */
export function sourcesIn(line: string, d: Dim): Sources | undefined {
  const info = DIM_INFO[d], has = esc(info.has), Has = esc(capital(info.has));
  const [head, then] = split(line);
  const kind: Sources['kind'] = THEN.test(then) ? 'thin' : 'gap';
  const little = new RegExp(`^(.+) bring only a (?:little|few) ${has}$`).exec(head);
  if (little) return { list: little[1]!, kind: 'little' };
  const main = new RegExp(`^(.+?) (?:is|are) the main source of ${has} here, with a little from (.+)$`).exec(head);
  if (main) return { list: `${main[1]}, and ${main[2]}`, kind };
  for (const re of [`^${Has} comes? only from (.+)$`, `^Only (.+) brings? ${has}$`, `^${Has} rests? on (.+)$`, `^(.+) (?:is|are) all the ${has} this comp has$`]) {
    const x = new RegExp(re).exec(head);
    if (x) return { list: x[1]!, kind };
  }
  return undefined;
}

/** The text before a con's advice: the sources it names, for a check of the abilities in it. */
export const sourcesPart = (line: string): string => split(line)[0];

/** A verb phrase after "can" or a plural: "takes space" is "take space". */
const plain = (v: string): string => {
  const [w, ...rest] = v.split(' ');
  return [/(?:ch|sh|x|ss)es$/.test(w!) ? w!.slice(0, -2) : w!.replace(/s$/, ''), ...rest].join(' ');
};

/**
 * Whether a plan says a part of it: what the agent does with the ability ("finds the defenders with
 * Recon Bolt", "Sova’s Recon Bolt finds the defenders", "so Neon can take space with High Gear"), a
 * way out after it ("holds the long angles, with Tailwind to get out"), a heal of the agent's own
 * ("stays in the fight with Devour", "wins fights and stays in them with Devour"), or gun play.
 */
export function planSays(plan: string, p: PlanPart): boolean {
  const verb = PHASES[p.phase][p.dim]!, base = plain(verb), object = verb.slice(verb.indexOf(' ') + 1);
  const name = agentById(p.agent)!.name;
  const forms: string[] = [];
  if (!p.ability) forms.push(...(p.dim === 'duel' ? ['wins the gunfights', 'can win the gunfights'] : [verb, `can ${base}`]));
  else if (p.how === 'self') forms.push(`stays in the fight with ${p.ability}`, `can stay in the fight with ${p.ability}`);
  else if (p.how === 'escape') for (const v of [verb, `can ${base}`, `and ${object}`]) forms.push(`${v}, with ${p.ability} to get `);
  else if (p.heals) forms.push(`${verb} and stays in them with ${p.ability}`, `can ${base} and stay in them with ${p.ability}`);
  else {
    const owned = p.ability.startsWith(`${name}’s `) ? p.ability : `${name}’s ${p.ability}`;
    forms.push(`${verb} with ${p.ability}`, `can ${base} with ${p.ability}`, `and ${object} with ${p.ability}`, `${owned} ${verb}`, `${owned} ${base}`);
  }
  return forms.some((f) => plan.includes(f));
}
