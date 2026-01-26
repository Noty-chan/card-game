<INSTRUCTIONS>
## Scope
These instructions apply to the entire repository.

## Project goals
- Build a lightweight, deterministic, event-driven card game engine in TypeScript.
- Keep the core (headless logic only) under 42KB gzipped.
- Separate headless core from UI adapters (DOM/Canvas/CLI).

## Architecture expectations
- Fixed turn structure by default: draw → main → combat → end.
- Extensibility via events, hooks, and plugins.
- Cards are data (JSON5) while rules remain in TypeScript.
- Deterministic outcomes: seeded RNG and ordered resolution by priority.
- Client-server model for online play with an authoritative server.

## Performance targets
- 60 FPS for animations (UI layer).
- Turn resolution under 20ms even with complex effects.
- Support 1000+ cards without lag.

## Output expectations
- Prefer headless-first design with adapters.
- Provide unit tests and basic documentation as development progresses.
- Keep the core code dependency-light and optimized.

## Collaboration notes
- Preserve separation of concerns: core logic vs UI.
- Ensure plugins/modes are loadable via configuration.
</INSTRUCTIONS>
