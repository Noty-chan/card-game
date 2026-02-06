import type { Effect } from '../effects';
import type { ScheduleActionInput } from '../engine';
import type { GameContext, PlayerId } from '../types';
import type { CardDefinition, CardEffectDefinition, CardEffectTarget } from './card-schema';

export interface CardRuntimePlan {
  immediate: Effect[];
  delayed: Array<{
    schedule: Omit<ScheduleActionInput, 'run'>;
    effect: Effect;
  }>;
}

interface CardRuntimeOptions {
  playerId: PlayerId;
}

const resolveTargetPlayerId = (
  target: CardEffectTarget | undefined,
  context: GameContext,
  sourcePlayerId: PlayerId,
): PlayerId => {
  const fallback = context.state.players[sourcePlayerId]
    ? sourcePlayerId
    : context.activePlayerId;
  if (target === 'opponent') {
    const ordered = context.state.playerOrder;
    const opponent = ordered.find((id) => id !== fallback);
    return opponent ?? fallback;
  }
  return fallback;
};

const createEntityId = (card: CardDefinition, context: GameContext): string => {
  const count = Object.keys(context.state.entities).length + 1;
  return `${card.id}:summon:${count}`;
};

const buildEffect = (
  card: CardDefinition,
  effectDef: CardEffectDefinition,
  index: number,
  options: CardRuntimeOptions,
): Effect => {
  const id = `card:${card.id}:effect:${index}`;
  const priority = effectDef.priority ?? 0;

  const apply = (context: GameContext): void => {
    const targetId = resolveTargetPlayerId(
      effectDef.target,
      context,
      options.playerId,
    );
    const targetPlayer = context.state.players[targetId];
    if (!targetPlayer) {
      return;
    }

    switch (effectDef.kind) {
      case 'draw': {
        const fromZone = targetPlayer.zones.deck;
        const toZone = targetPlayer.zones.hand;
        if (!fromZone || !toZone) {
          return;
        }
        for (let i = 0; i < effectDef.amount; i += 1) {
          const cardId = fromZone.shift();
          if (!cardId) {
            break;
          }
          toZone.push(cardId);
        }
        return;
      }
      case 'damage': {
        const resource = effectDef.resource ?? 'health';
        const current = targetPlayer.resources[resource] ?? 0;
        targetPlayer.resources[resource] = Math.max(0, current - effectDef.amount);
        return;
      }
      case 'gainResource': {
        const resource = effectDef.resource;
        const current = targetPlayer.resources[resource] ?? 0;
        targetPlayer.resources[resource] = current + effectDef.amount;
        return;
      }
      case 'summon': {
        const zones = targetPlayer.zones;
        const targetZone = effectDef.targetZone ?? 'field';
        const zone = zones[targetZone];
        if (!zone) {
          return;
        }
        const entityId = effectDef.entityId ?? createEntityId(card, context);
        if (!context.state.entities[entityId]) {
          const statsSource = effectDef.stats ?? card.stats ?? {};
          const tagsSource = effectDef.tags ?? card.tags ?? [];
          context.state.entities[entityId] = {
            id: entityId,
            type: card.type,
            stats: new Map(Object.entries(statsSource)),
            tags: new Set(tagsSource),
          };
        }
        zone.push(entityId);
        return;
      }
      default: {
        return;
      }
    }
  };

  return { id, priority, apply };
};

export const buildCardRuntimePlan = (
  card: CardDefinition,
  options: CardRuntimeOptions,
): CardRuntimePlan => {
  const immediate: Effect[] = [];
  const delayed: CardRuntimePlan['delayed'] = [];
  const effects = card.effects ?? [];

  effects.forEach((effectDef, index) => {
    const effect = buildEffect(card, effectDef, index, options);
    if (effectDef.delayTurns !== undefined || effectDef.phase !== undefined) {
      delayed.push({
        schedule: {
          id: `${effect.id}:delayed`,
          priority: effectDef.priority,
          delayTurns: effectDef.delayTurns,
          phase: effectDef.phase,
        },
        effect,
      });
    } else {
      immediate.push(effect);
    }
  });

  return {
    immediate,
    delayed,
  };
};
