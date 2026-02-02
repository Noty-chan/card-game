import type { GameContext } from './types';

export interface GameEvent<TPayload = unknown> {
  type: string;
  payload?: TPayload;
}

export interface EventHandler<TPayload = unknown> {
  priority: number;
  order: number;
  handle: (event: GameEvent<TPayload>, context: GameContext) => void;
  filter?: (event: GameEvent<TPayload>, context: GameContext) => boolean;
}

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private counter = 0;

  subscribe<TPayload>(
    type: string,
    handle: (event: GameEvent<TPayload>, context: GameContext) => void,
    priority = 0,
    filter?: (event: GameEvent<TPayload>, context: GameContext) => boolean,
  ): () => void {
    const entry: EventHandler<TPayload> = {
      priority,
      order: this.counter++,
      handle,
      filter,
    };
    const list = this.handlers.get(type) ?? [];
    list.push(entry as EventHandler);
    this.handlers.set(type, list);

    return () => {
      const next = (this.handlers.get(type) ?? []).filter(
        (item) => item !== entry,
      );
      if (next.length === 0) {
        this.handlers.delete(type);
      } else {
        this.handlers.set(type, next);
      }
    };
  }

  emit<TPayload>(event: GameEvent<TPayload>, context: GameContext): void {
    const list = this.handlers.get(event.type);
    if (!list || list.length === 0) {
      return;
    }

    const ordered = [...list].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.order - b.order;
    });

    for (const handler of ordered) {
      if (handler.filter && !handler.filter(event, context)) {
        continue;
      }
      handler.handle(event, context);
    }
  }
}
