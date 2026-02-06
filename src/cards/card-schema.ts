import type { Phase } from '../types';

export type CardEffectTarget = 'self' | 'opponent';

export interface CardEffectBase {
  delayTurns?: number;
  phase?: Phase;
  priority?: number;
}

export interface DrawEffectDefinition extends CardEffectBase {
  kind: 'draw';
  amount: number;
  target?: CardEffectTarget;
}

export interface DamageEffectDefinition extends CardEffectBase {
  kind: 'damage';
  amount: number;
  resource?: string;
  target?: CardEffectTarget;
}

export interface GainResourceEffectDefinition extends CardEffectBase {
  kind: 'gainResource';
  amount: number;
  resource: string;
  target?: CardEffectTarget;
}

export interface SummonEffectDefinition extends CardEffectBase {
  kind: 'summon';
  entityId?: string;
  targetZone?: string;
  stats?: Record<string, number>;
  tags?: string[];
  target?: CardEffectTarget;
}

export type CardEffectDefinition =
  | DrawEffectDefinition
  | DamageEffectDefinition
  | GainResourceEffectDefinition
  | SummonEffectDefinition;

export interface CardDefinition {
  id: string;
  name: string;
  type: string;
  cost: number;
  text?: string;
  tags?: string[];
  stats?: Record<string, number>;
  rules?: string[];
  effects?: CardEffectDefinition[];
}

export interface CardSetDefinition {
  set: string;
  version: number;
  cards: CardDefinition[];
}

const VALID_TARGETS: CardEffectTarget[] = ['self', 'opponent'];
const VALID_PHASES: Phase[] = ['draw', 'main', 'combat', 'end'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const validateDelay = (effect: CardEffectBase, errors: string[]): void => {
  if (effect.delayTurns !== undefined && !isNumber(effect.delayTurns)) {
    errors.push('delayTurns должен быть числом');
  }
  if (effect.phase !== undefined && !VALID_PHASES.includes(effect.phase)) {
    errors.push(`неизвестная фаза: ${String(effect.phase)}`);
  }
  if (effect.priority !== undefined && !isNumber(effect.priority)) {
    errors.push('priority должен быть числом');
  }
};

const validateTarget = (target: unknown, errors: string[]): void => {
  if (target !== undefined && !VALID_TARGETS.includes(target as CardEffectTarget)) {
    errors.push(`неизвестная цель: ${String(target)}`);
  }
};

const validateStatsRecord = (
  stats: unknown,
  errors: string[],
  fieldName: string,
): void => {
  if (stats === undefined) {
    return;
  }
  if (!isRecord(stats)) {
    errors.push(`${fieldName} должен быть объектом`);
    return;
  }
  for (const [key, value] of Object.entries(stats)) {
    if (!isNumber(value)) {
      errors.push(`${fieldName}.${key} должен быть числом`);
    }
  }
};

export const validateCardEffect = (
  effect: CardEffectDefinition,
  index: number,
): string[] => {
  const errors: string[] = [];

  if (!isString(effect.kind)) {
    errors.push(`effects[${index}].kind должен быть строкой`);
    return errors;
  }

  switch (effect.kind) {
    case 'draw': {
      if (!isNumber(effect.amount)) {
        errors.push(`effects[${index}].amount должен быть числом`);
      }
      validateTarget(effect.target, errors);
      validateDelay(effect, errors);
      return errors;
    }
    case 'damage': {
      if (!isNumber(effect.amount)) {
        errors.push(`effects[${index}].amount должен быть числом`);
      }
      if (effect.resource !== undefined && !isString(effect.resource)) {
        errors.push(`effects[${index}].resource должен быть строкой`);
      }
      validateTarget(effect.target, errors);
      validateDelay(effect, errors);
      return errors;
    }
    case 'gainResource': {
      if (!isNumber(effect.amount)) {
        errors.push(`effects[${index}].amount должен быть числом`);
      }
      if (!isString(effect.resource)) {
        errors.push(`effects[${index}].resource обязателен и должен быть строкой`);
      }
      validateTarget(effect.target, errors);
      validateDelay(effect, errors);
      return errors;
    }
    case 'summon': {
      if (effect.entityId !== undefined && !isString(effect.entityId)) {
        errors.push(`effects[${index}].entityId должен быть строкой`);
      }
      if (effect.targetZone !== undefined && !isString(effect.targetZone)) {
        errors.push(`effects[${index}].targetZone должен быть строкой`);
      }
      if (effect.tags !== undefined) {
        if (!Array.isArray(effect.tags) || effect.tags.some((tag) => !isString(tag))) {
          errors.push(`effects[${index}].tags должен быть массивом строк`);
        }
      }
      validateStatsRecord(effect.stats, errors, `effects[${index}].stats`);
      validateTarget(effect.target, errors);
      validateDelay(effect, errors);
      return errors;
    }
    default: {
      errors.push(`effects[${index}].kind "${String(effect.kind)}" не поддерживается`);
      return errors;
    }
  }
};

export const validateCardDefinition = (card: CardDefinition): string[] => {
  const errors: string[] = [];

  if (!isString(card.id)) {
    errors.push('id обязателен и должен быть строкой');
  }
  if (!isString(card.name)) {
    errors.push(`name обязателен для карты ${String(card.id)}`);
  }
  if (!isString(card.type)) {
    errors.push(`type обязателен для карты ${String(card.id)}`);
  }
  if (!isNumber(card.cost)) {
    errors.push(`cost обязателен и должен быть числом для карты ${String(card.id)}`);
  }
  if (card.text !== undefined && !isString(card.text)) {
    errors.push(`text должен быть строкой для карты ${String(card.id)}`);
  }
  if (card.tags !== undefined) {
    if (!Array.isArray(card.tags) || card.tags.some((tag) => !isString(tag))) {
      errors.push(`tags должен быть массивом строк для карты ${String(card.id)}`);
    }
  }
  validateStatsRecord(card.stats, errors, `stats карты ${String(card.id)}`);

  if (card.rules !== undefined) {
    if (!Array.isArray(card.rules) || card.rules.some((rule) => !isString(rule))) {
      errors.push(`rules должен быть массивом строк для карты ${String(card.id)}`);
    }
  }

  if (card.effects !== undefined) {
    if (!Array.isArray(card.effects)) {
      errors.push(`effects должен быть массивом для карты ${String(card.id)}`);
    } else {
      card.effects.forEach((effect, index) => {
        errors.push(...validateCardEffect(effect, index));
      });
    }
  }

  return errors;
};

export const validateCardSet = (cardSet: CardSetDefinition): string[] => {
  const errors: string[] = [];

  if (!isString(cardSet.set)) {
    errors.push('set обязателен и должен быть строкой');
  }
  if (!isNumber(cardSet.version)) {
    errors.push('version обязателен и должен быть числом');
  }
  if (!Array.isArray(cardSet.cards)) {
    errors.push('cards обязателен и должен быть массивом');
    return errors;
  }

  cardSet.cards.forEach((card, index) => {
    const cardErrors = validateCardDefinition(card);
    if (cardErrors.length > 0) {
      errors.push(`cards[${index}]: ${cardErrors.join('; ')}`);
    }
  });

  return errors;
};

export const assertCardDefinition = (card: CardDefinition): void => {
  const errors = validateCardDefinition(card);
  if (errors.length > 0) {
    throw new Error(`Некорректная схема карты ${String(card.id)}: ${errors.join('; ')}`);
  }
};

export const assertCardSet = (cardSet: CardSetDefinition): void => {
  const errors = validateCardSet(cardSet);
  if (errors.length > 0) {
    throw new Error(`Некорректная схема набора карт: ${errors.join('; ')}`);
  }
};
