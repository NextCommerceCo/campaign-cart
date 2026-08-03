import type { ConditionalDisplayContext } from './conditional-display.types';
import {
  getSelectionPropertyValue,
  getShippingPropertyValue,
} from './conditional-display.properties';

/**
 * Evaluators for the two condition families that resolve against the
 * element's own DOM context rather than a store snapshot:
 * `selection.*` (the package a nearby selector has selected) and
 * `shipping.*` (the shipping method named by an ancestor's
 * `data-next-shipping-id`).
 */
// ---------------------------------------------------------------------------
// selection.*
// ---------------------------------------------------------------------------

export function evaluateSelectionCondition(
  ctx: ConditionalDisplayContext
): boolean {
  try {
    switch (ctx.condition.type) {
      case 'not':
        return !evaluateSelectionConditionRecursive(
          ctx,
          ctx.condition.condition
        );

      case 'logical':
        return evaluateSelectionLogicalCondition(ctx, ctx.condition);

      case 'property':
        return evaluateSelectionProperty(ctx, ctx.condition);

      case 'comparison':
        return evaluateSelectionComparison(ctx, ctx.condition);

      default:
        ctx.logger.warn(
          `Unsupported condition type for selection: ${ctx.condition.type}`
        );
        return false;
    }
  } catch (error) {
    ctx.logger.error('Error evaluating selection condition:', error);
    return false;
  }
}

export function evaluateSelectionLogicalCondition(
  ctx: ConditionalDisplayContext,
  condition: any
): boolean {
  const { operator, conditions } = condition;

  if (operator === '||') {
    return conditions.some((cond: any) =>
      evaluateSelectionConditionRecursive(ctx, cond)
    );
  } else if (operator === '&&') {
    return conditions.every((cond: any) =>
      evaluateSelectionConditionRecursive(ctx, cond)
    );
  }

  return false;
}

export function evaluateSelectionConditionRecursive(
  ctx: ConditionalDisplayContext,
  condition: any
): boolean {
  switch (condition.type) {
    case 'not':
      return !evaluateSelectionConditionRecursive(ctx, condition.condition);
    case 'logical':
      return evaluateSelectionLogicalCondition(ctx, condition);
    case 'property':
      return evaluateSelectionProperty(ctx, condition);
    case 'comparison':
      return evaluateSelectionComparison(ctx, condition);
    default:
      return false;
  }
}

export function evaluateSelectionProperty(
  ctx: ConditionalDisplayContext,
  condition: any
): boolean {
  const value = getSelectionPropertyValue(ctx, condition.property);
  return Boolean(value);
}

export function evaluateSelectionComparison(
  ctx: ConditionalDisplayContext,
  condition: any
): boolean {
  const leftValue = getSelectionPropertyValue(ctx, condition.left.property);
  const rightValue = condition.right;

  switch (condition.operator) {
    case '>':
      return Number(leftValue) > Number(rightValue);
    case '>=':
      return Number(leftValue) >= Number(rightValue);
    case '<':
      return Number(leftValue) < Number(rightValue);
    case '<=':
      return Number(leftValue) <= Number(rightValue);
    case '==':
    case '===':
      return leftValue === rightValue;
    case '!=':
    case '!==':
      return leftValue !== rightValue;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// shipping.*
// ---------------------------------------------------------------------------

export function evaluateShippingCondition(
  ctx: ConditionalDisplayContext
): boolean {
  try {
    switch (ctx.condition.type) {
      case 'not':
        return !evaluateShippingConditionRecursive(
          ctx,
          ctx.condition.condition
        );

      case 'logical':
        return evaluateShippingLogicalCondition(ctx, ctx.condition);

      case 'property':
        return evaluateShippingProperty(ctx, ctx.condition);

      case 'comparison':
        return evaluateShippingComparison(ctx, ctx.condition);

      default:
        ctx.logger.warn(
          `Unsupported condition type for shipping: ${ctx.condition.type}`
        );
        return false;
    }
  } catch (error) {
    ctx.logger.error('Error evaluating shipping condition:', error);
    return false;
  }
}

export function evaluateShippingLogicalCondition(
  ctx: ConditionalDisplayContext,
  condition: any
): boolean {
  const { operator, conditions } = condition;

  if (operator === '||') {
    return conditions.some((cond: any) =>
      evaluateShippingConditionRecursive(ctx, cond)
    );
  } else if (operator === '&&') {
    return conditions.every((cond: any) =>
      evaluateShippingConditionRecursive(ctx, cond)
    );
  }

  return false;
}

export function evaluateShippingConditionRecursive(
  ctx: ConditionalDisplayContext,
  condition: any
): boolean {
  switch (condition.type) {
    case 'not':
      return !evaluateShippingConditionRecursive(ctx, condition.condition);
    case 'logical':
      return evaluateShippingLogicalCondition(ctx, condition);
    case 'property':
      return evaluateShippingProperty(ctx, condition);
    case 'comparison':
      return evaluateShippingComparison(ctx, condition);
    default:
      return false;
  }
}

export function evaluateShippingProperty(
  ctx: ConditionalDisplayContext,
  condition: any
): boolean {
  const value = getShippingPropertyValue(ctx, condition.property);
  return Boolean(value);
}

export function evaluateShippingComparison(
  ctx: ConditionalDisplayContext,
  condition: any
): boolean {
  const leftValue = getShippingPropertyValue(ctx, condition.left.property);
  const rightValue = condition.right;

  switch (condition.operator) {
    case '>':
      return Number(leftValue) > Number(rightValue);
    case '>=':
      return Number(leftValue) >= Number(rightValue);
    case '<':
      return Number(leftValue) < Number(rightValue);
    case '<=':
      return Number(leftValue) <= Number(rightValue);
    case '==':
    case '===':
      return leftValue === rightValue;
    case '!=':
    case '!==':
      return leftValue !== rightValue;
    default:
      return false;
  }
}
