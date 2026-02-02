import type { GameContext } from './types';

export interface Effect {
  id: string;
  priority: number;
  apply: (context: GameContext) => void;
}

export function resolveEffects(effects: Effect[], context: GameContext): void {
  const ordered = [...effects].sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return a.id.localeCompare(b.id);
  });

  for (const effect of ordered) {
    effect.apply(context);
  }
}
