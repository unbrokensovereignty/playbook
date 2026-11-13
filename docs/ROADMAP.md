# Roadmap

What's planned for Playbook. Items marked **proposed** wait for Sovereign's OK before they're built, and small fixes don't need to be listed here. What each version changed is in `CHANGELOG.md`.

## Keeping the numbers current

1. With each new patch or event, refresh ranked pick rates (`pop` in `agents.ts`), pro picks and comps (`pro.ts`, and `PRO_CUTOFF` once there's a new event) and the map pool (`maps.ts`, which changes next on 6 January 2027), and note the patch and events in each file's sources.
2. A new agent goes into `src/core/kb/new-agents.ts` as an estimate while revealed but not out. Once out, they move into `agents.ts` with numbers from their first days, and the game's content is refreshed for their art and ability text (the steps are at the top of `new-agents.ts` and in `CONTRIBUTING.md`).

## Ideas (proposed)

1. Kit sense on Fracture and Abyss. With the pull toward pro play off, the engine still ranks Astra and Viper above the agents pros play there (Breach and Brimstone on Fracture, Harbor on Abyss).
2. A trial in real games. Play twenty ranked games on Playbook's picks and log them under Your games, to see how the advice does in practice.
3. Corrode's minimap scale. Rotation times are worked out on every map but Corrode, whose minimap scale the game's content doesn't list yet.
4. A buy helper, to say what to buy this round from the team's credits, for the plays that fit it.
