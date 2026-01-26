# Card Game Engine — Project Context

This file captures the heavier, long-form project context so it does not need to live inside `AGENTS.md`.

## Product Goals
- Build a universal, event-driven card game engine (not tied to a single ruleset).
- Support multiple archetypes: Hearthstone-like, Magic-like, Slay the Spire, Gwent, classic card games.
- Keep the core headless (pure logic) and provide adapters for UI layers.

## Architecture Summary
**Fixed turn structure** (default):
```
phases: ['draw', 'main', 'combat', 'end']
```
Custom behavior is added through hooks:
```
onPhaseStart(phase, context) { ... }
onCardPlay(card, context) { ... }
```

**Event-driven core**:
- Everything emits/consumes events.
- Cards and mechanics subscribe via triggers with conditions and priorities.

**Effect Resolver**:
- Collects all modifiers for an effect.
- Applies in priority order.
- Ensures deterministic, reproducible outcomes.

## Data & Rules
- Cards are data (JSON5).
- Rules and engine logic are TypeScript.
- Rules must support complex, multi-step mechanics out of the box.

## Modes & Plugins
Examples:
```
GameEngine.use(new GraveyardPlugin())
GameEngine.use(new ManaSystemPlugin())

modes/draft.json
modes/constructed.json
```

## Networking
- Local play (MVP) + hot-seat.
- Online play: client-server, server-authoritative.
- WebSocket for real-time state updates.

## Performance Targets
- Core size <42KB gzipped (logic only).
- UI adapters add ~20–40KB depending on implementation.
- 60 FPS animation target.
- Turn resolution <20ms even with complex effects.
- Smooth handling of 1000+ cards.

## Determinism & Replay
- Deterministic outcomes from identical states.
- Seeded RNG for reproducible games.
- Logs suitable for replay/verification.

## Example Concepts
**Events**
- `beforeCardPlay`, `onCardPlayed`, `afterCardPlay`
- `beforeDamage`, `onDamage`, `afterDamage`
- `turnStart`, `turnEnd`, `phaseChange`
- `onDeath`, `onHeal`, `onDraw`

**Entity Model**
```
entity: {
  id: string,
  type: string,
  stats: Map<string, number>,
  tags: Set<string>,
  state: any
}
```

**Configurable Zones**
```
zones: ["hand", "deck", "discard", "exile", "field", "row1", "row2"]
```
