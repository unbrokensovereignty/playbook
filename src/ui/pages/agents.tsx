/**
 * Agents: every agent by role, and for each one their kit, what they're strong at, the maps and
 * ranks they fit best, who they pair well with (and clash with), tips, and how often they're
 * picked and win.
 */
import { PageHead } from '../shell.tsx';
import { Badge, Bar, Button, Segmented, Empty } from '../components/controls.tsx';
import { Icon } from '../icons.tsx';
import { AbilityIcon, AgentIcon, MapThumb, RoleIcon } from '../art.tsx';
import { go, useSettings, useView } from '../state.ts';
import { play } from '../sound.ts';
import { answerFor } from '../solved.ts';
import { planWith } from '../planner/store.ts';
import { Fit } from '../planner/comp.tsx';
import { rankWord } from '../planner/words.ts';
import { agentById, AGENTS_BY_NAME, earlyStats, STATS_ON, type Agent } from '../../core/kb/agents.ts';
import { namedFor } from '../../core/kb/effects.ts';
import { kitOf, abilityNames, textParts } from '../../core/kb/kits.ts';
import { mapById, MAPS } from '../../core/kb/maps.ts';
import { agentRules, ruleHelps, ruleWhyAt } from '../../core/kb/kitfit.ts';
import { PRO, PRO_MAPS_COUNTED, proKnown } from '../../core/kb/pro.ts';
import { RANKS, type RankId } from '../../core/kb/ranks.ts';
import { DIM_INFO, DIMS, ROLES, roleOf, type Role } from '../../core/kb/roles.ts';
import { PAIRS, type Pair } from '../../core/kb/synergy.ts';
import type { Situation } from '../../core/engine/model.ts';
import { UNSETTLED, unsureWords } from '../../core/engine/sure.ts';
import { agentMapTips, agentTips } from '../../core/engine/tips.ts';
import { tierOf } from '../../core/engine/weights.ts';
import { fmtLongDay } from '../../core/dates.ts';
import { listJoin } from '../../core/text.ts';
import { plural } from '../../core/util.ts';
import { proDuos, troubleFrom } from '../../core/engine/matchups.ts';
import type { PageProps } from './index.ts';

type RoleFilter = Role | 'all';

function AgentGrid() {
  const [role, setRole] = useView<RoleFilter>('agents.role', 'all', (v) => v === 'all' || ROLES.some((r) => r.id === v));
  const groups = ROLES.filter((r) => role === 'all' || r.id === role);
  return (
    <>
      <Segmented<RoleFilter> label="Role" value={role} onChange={setRole} options={[['all', 'All'], ...ROLES.map((r) => [r.id, r.plural] as const)]} />
      {groups.map((r, i) => (
        <section key={r.id} class="agent-role-group" data-tour={i === 0 ? 'agent-group' : undefined}>
          <h2 class="row"><RoleIcon role={r.id} size={20} />{r.plural}<span class="muted small">{r.blurb}</span></h2>
          <ul class="agent-cards">
            {AGENTS_BY_NAME.filter((a) => a.role === r.id).map((a) => (
              <li key={a.id}>
                <button type="button" class="agent-card" onClick={() => { play('page'); go('agents', a.id); }}>
                  <AgentIcon id={a.id} size={64} />
                  <span class="agent-card-text">
                    <b>{a.name}</b>
                    <small class="muted">{a.line}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function Kit({ a }: { a: Agent }) {
  const kit = kitOf(a.id);
  if (!kit) return null;
  return (
    <section class="panel stack" data-tour="agent-kit">
      <h2>Abilities</h2>
      <ul class="kit">
        {kit.abilities.map((k) => (
          <li key={k.key + k.name}>
            <span class="kit-icon">{k.key === 'Passive' ? <Icon name="sparkle" size={22} /> : <AbilityIcon agent={a.id} k={k.key} size={30} />}</span>
            <div>
              <b>{k.name}</b> <span class="kit-key">{k.key === 'Passive' ? 'Passive' : k.key}</span>
              <p class="muted small">{textParts(k.text).map((t, i) => (t.kind === 'plain' ? t.text : t.kind === 'name' ? <b key={i}>{t.text}</b> : <span key={i} class={`kit-fx ${t.kind}`}>{t.text}</span>))}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Strengths({ a }: { a: Agent }) {
  const rows = DIMS.map((d) => ({ d, v: a.caps[d] })).filter((x) => x.v >= 0.15).sort((x, y) => y.v - x.v);
  return (
    <section class="panel stack" data-tour="agent-strengths">
      <h2>Strengths</h2>
      <table class="agent-strengths">
        <tbody>
          {rows.map(({ d, v }) => {
            const via = abilityNames(a.id, namedFor(a.id, a.via[d] ?? '', d));
            return (
              <tr key={d}>
                <th scope="row" data-tip={DIM_INFO[d].blurb}>{DIM_INFO[d].name}</th>
                <td><Bar value={v} size="thin" tone={v >= 0.75 ? 'good' : undefined} label={`${DIM_INFO[d].name}: ${Math.round(v * 100)} out of 100`} /></td>
                <td class="muted small">{via.length ? listJoin(via) : (a.via[d] ?? '').includes('G') ? 'Gun play' : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p class="small muted">From 0 (none) to the best in the game at it. {a.estimate ? 'These are early estimates.' : ''}</p>
    </section>
  );
}


function BestMaps({ a, rank, newAgents }: { a: Agent; rank: RankId; newAgents: boolean }) {
  const rows = MAPS.map((m) => {
    const s: Situation = { map: m.id, side: 'both', rank, sites: [] };
    const x = answerFor(s, newAgents)?.agents.find((y) => y.id === a.id);
    return { m, fit: x?.fit, unsure: x?.unsure && unsureWords(s, a.id, x.unsure) };
  });
  const ready = rows.every((r) => r.fit !== undefined);
  // best first; maps where the agent fits as well (many, for an agent in the best comp on several)
  // go in order of how often pros pick them there
  const pro = (id: string) => PRO[id]?.picks[a.id] ?? 0;
  const sorted = ready ? [...rows].sort((x, y) => Math.round(y.fit!) - Math.round(x.fit!) || pro(y.m.id) - pro(x.m.id)) : rows;
  return (
    <section class="panel stack" data-tour="agent-best-maps">
      <div class="row-between"><h2>Best maps</h2>{!ready && <span class="spinner" aria-label="Working it out" />}</div>
      <ul class="plain-list best-maps">
        {sorted.map(({ m, fit, unsure }) => (
          <li key={m.id}>
            <button type="button" class="list-row" data-tip={unsure || undefined} onClick={() => planWith({ map: m.id, include: [a.id], newAgents: newAgents || !!a.estimate })}>
              <MapThumb id={m.id} class="small" />
              <span class="list-row-text"><b>{m.name}</b>{!m.pool && <small class="muted">Out of the pool</small>}{(PRO[m.id]?.picks[a.id] ?? 0) >= 30 && <small class="muted">Pros pick {a.name} in {PRO[m.id]!.picks[a.id]}% of games here</small>}</span>
              {fit !== undefined ? <Fit fit={fit} tier={tierOf(fit)} label={`${a.name} on ${m.name}`} compact unsure={!!unsure} /> : <span class="faint small">…</span>}
            </button>
          </li>
        ))}
      </ul>
      <p class="small muted">For a five-stack, both sides, at {rankWord(rank)}. Maps where {a.name} fits as well go in order of how often pros pick {a.name} there. Pick a map to plan with {a.name} there.</p>
    </section>
  );
}

function ByRank({ a, rank, newAgents }: { a: Agent; rank: RankId; newAgents: boolean }) {
  const rows = RANKS.map((r) => {
    const s: Situation = { map: 'any', side: 'both', rank: r.id, sites: [] };
    const x = answerFor(s, newAgents)?.agents.find((y) => y.id === a.id);
    return { r, fit: x?.fit, unsure: x?.unsure && unsureWords(s, a.id, x.unsure) };
  });
  const ready = rows.every((x) => x.fit !== undefined);
  return (
    <section class="panel stack" data-tour="agent-by-rank">
      <div class="row-between"><h2>By rank</h2>{!ready && <span class="spinner" aria-label="Working it out" />}</div>
      <ul class="plain-list by-rank">
        {rows.map(({ r, fit, unsure }) => (
          <li key={r.id}>
            <button type="button" class={`by-rank-cell${r.id === rank ? ' current' : ''}`} aria-current={r.id === rank ? 'true' : undefined} data-tip={unsure || undefined} onClick={() => planWith({ rank: r.id, include: [a.id], newAgents })}>
              <span class="small">{r.name}</span>
              {fit !== undefined ? <Fit fit={fit} tier={tierOf(fit)} label={`${a.name} at ${r.name}`} compact unsure={!!unsure} /> : <span class="faint small">…</span>}
            </button>
          </li>
        ))}
      </ul>
      <p class="small muted">For a five-stack on any map in the pool, both sides, with your usual rank marked. Pick a rank to plan with {a.name} there.</p>
    </section>
  );
}

function Partners({ a }: { a: Agent }) {
  const mine = PAIRS.filter((p) => p.a === a.id || p.b === a.id);
  const other = (p: Pair) => (p.a === a.id ? p.b : p.a);
  const good = mine.filter((p) => p.strength > 0).sort((x, y) => y.strength - x.strength);
  const bad = mine.filter((p) => p.strength < 0).sort((x, y) => x.strength - y.strength);
  const row = (p: Pair) => {
    const o = agentById(other(p));
    if (!o) return null;
    return (
      <li key={o.id}>
        <button type="button" class="pair-row" onClick={() => go('agents', o.id)}>
          <AgentIcon id={o.id} size={32} />
          <span><b>{o.name}</b>{p.side !== 'both' && <span class="muted small"> · on {p.side}</span>}<small class="muted">{p.why}</small></span>
        </button>
      </li>
    );
  };
  if (!mine.length) return null;
  return (
    <section class="panel stack" data-tour="agent-partners">
      <h2>Partners</h2>
      {good.length > 0 && <><h3 class="row good-text"><Icon name="check" size={16} />Works well with</h3><ul class="plain-list pairs">{good.map(row)}</ul></>}
      {bad.length > 0 && <><h3 class="row bad-text"><Icon name="warning" size={16} />Gets in the way of</h3><ul class="plain-list pairs">{bad.map(row)}</ul></>}
    </section>
  );
}

/** Who pro teams played the agent with this year, most often first. */
function ProDuos({ a }: { a: Agent }) {
  const { maps, duos } = proDuos(a.id);
  if (!duos.length) return null;
  return (
    <section class="panel stack" data-tour="agent-pro-duos">
      <h2>With pros</h2>
      <p class="small muted">Who pro teams played {a.name} with at this year’s events, out of the {plural(maps, 'map')} they picked {a.name}.</p>
      <ul class="plain-list pairs">
        {duos.map((d) => {
          const o = agentById(d.id);
          return o && (
            <li key={d.id}>
              <button type="button" class="pair-row" onClick={() => go('agents', o.id)}>
                <AgentIcon id={o.id} size={32} />
                <span><b>{o.name}</b><small class="muted">On {Math.round(d.share * 100)}% of those maps ({d.maps} of {maps})</small></span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** What the agent makes the other team play around, who answers it, and how to play it without them. */
function PlayingAgainst({ a }: { a: Agent }) {
  const trouble = troubleFrom(a.id);
  if (!trouble.length) return null;
  return (
    <section class="panel stack" data-tour="agent-against">
      <h2>Playing against {a.name}</h2>
      <ul class="tips">
        {trouble.map((t) => (
          <li key={t.threat.id}>
            <b>{t.line}</b>
            {t.answers.length
              ? <span>Answered best by {listJoin(t.answers.map((id) => agentById(id)?.name ?? id))}. Without any of them, {t.advice.charAt(0).toLowerCase()}{t.advice.slice(1)}</span>
              : <span>{t.advice}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The maps' names, joined ("Bind, Lotus and Split"), or "Every map". */
const mapNames = (ids: readonly string[]) => (ids.length === MAPS.length ? 'Every map' : listJoin(ids.map((id) => mapById(id)?.name ?? id)));

/** What the agent's kit does on particular maps: the tips for each map, and where the kit does more or less. */
function MapByMap({ a }: { a: Agent }) {
  const tips = agentMapTips(a.id);
  const rules = agentRules(a.id);
  if (!tips.length && !rules.length) return null;
  const side = (s?: string) => (s === 'attack' ? ', attack' : s === 'defense' ? ', defense' : '');
  const more = rules.filter((r) => ruleHelps(r.rule)), less = rules.filter((r) => !ruleHelps(r.rule));
  return (
    <section class="panel stack" data-tour="agent-map-by-map">
      <h2>Map by map</h2>
      {tips.length > 0 && (
        <ul class="tips">
          {tips.map((t) => (
            <li key={t.map + (t.side ?? '')}><b><a href={`#/maps/${t.map}`}>{mapById(t.map)?.name}</a>{side(t.side)}</b><span>{t.text}</span></li>
          ))}
        </ul>
      )}
      {more.length > 0 && <><h3 class="row good-text"><Icon name="check" size={16} />Where the kit does more</h3><ul class="tips">{more.map((r) => <li key={r.rule.caps + r.maps.join()}><b>{mapNames(r.maps)}{side(r.rule.side)}</b><span>{ruleWhyAt(r.rule, r.maps)}</span></li>)}</ul></>}
      {less.length > 0 && <><h3 class="row bad-text"><Icon name="warning" size={16} />Where it does less</h3><ul class="tips">{less.map((r) => <li key={r.rule.caps + r.maps.join()}><b>{mapNames(r.maps)}{side(r.rule.side)}</b><span>{ruleWhyAt(r.rule, r.maps)} {r.rule.around}</span></li>)}</ul></>}
    </section>
  );
}

function AgentPage({ a }: { a: Agent }) {
  const s = useSettings();
  const rank = s.defaultRank as RankId;
  const tips = agentTips(a.id);
  const kit = kitOf(a.id);
  const newAgents = s.includeNew || !!a.estimate;
  return (
    <>
      <PageHead
        eyebrow={<a href="#/agents" class="row"><Icon name="chevron-left" size={16} />Agents</a>}
        title={<span class="row agent-title"><AgentIcon id={a.id} size={56} />{a.name}</span>}
        actions={<Button kind="primary" icon="planner" onClick={() => planWith({ include: [a.id], newAgents })}>Plan with {a.name}</Button>}>
        <span class="row wrap agent-sub">
          <span class="row"><RoleIcon role={a.role} size={16} />{roleOf(a.role).name}</span>
          {a.estimate && <Badge tone="accent" icon="sparkle">New, so the numbers are early estimates</Badge>}
          <span class="muted">{a.line}</span>
        </span>
      </PageHead>
      <div class="agent-detail">
        <div class="stack">
          {kit?.about && <p class="agent-about">{kit.about}</p>}
          <Kit a={a} />
          <Strengths a={a} />
        </div>
        <div class="stack">
          <BestMaps a={a} rank={rank} newAgents={newAgents} />
          <ByRank a={a} rank={rank} newAgents={newAgents} />
          <Partners a={a} />
          <ProDuos a={a} />
          <PlayingAgainst a={a} />
          <MapByMap a={a} />
          {tips.length > 0 && (
            <section class="panel stack">
              <h2>Tips</h2>
              <ul class="tips">{tips.map((t) => <li key={t}><span>{t}</span></li>)}</ul>
            </section>
          )}
          <section class="panel stack">
            <h2>Picks and wins</h2>
            <dl class="facts">
              <dt>In ranked</dt><dd>{a.estimate ? 'Not known yet' : `${a.pop}% of all picks`}</dd>
              <dt>Ranked wins</dt><dd>{a.estimate ? 'Not known yet' : `${a.win.toFixed(1)}% of games`}</dd>
              <dt>By pros</dt><dd>{a.estimate ? 'Not known yet' : proKnown(a) ? `${a.pro ? `${a.pro}% of` : 'Hardly ever, in'} the ${PRO_MAPS_COUNTED} maps counted from the year’s top events` : `None yet, since ${a.name} came out after the year’s top events`}</dd>
              <dt>Released</dt><dd>{fmtLongDay(a.released)}</dd>
            </dl>
            {!a.estimate && (
              <p class="small muted">
                Ranked numbers are across all ranks, as of {fmtLongDay(STATS_ON)}, and win rates are evened out so the average agent wins half its games.
                {earlyStats(a) && ` They’re from ${a.name}’s first days, while players are still learning the agent.`}
                {UNSETTLED.includes(a) && ` Until there’s more play behind ${a.name}, a fit that could still be off by about a tier is marked less sure, and pointing at it says why.`}
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export function AgentsPage({ arg }: PageProps) {
  if (arg) {
    const a = agentById(arg);
    if (a) return <AgentPage a={a} />;
    return (
      <>
        <PageHead title="Agents" />
        <Empty level={2} title="There’s no such agent" actions={<Button onClick={() => go('agents')}>See all agents</Button>}>The link may be from a newer version of Playbook.</Empty>
      </>
    );
  }
  return (
    <>
      <PageHead title="Agents">Every agent’s kit, strengths, best maps and partners.</PageHead>
      <div class="stack agents-page"><AgentGrid /></div>
    </>
  );
}
