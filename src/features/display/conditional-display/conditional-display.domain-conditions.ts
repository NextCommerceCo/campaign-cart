import type { ConditionalDisplayContext } from './conditional-display.types';
import { getPackagePropertyValue } from './conditional-display.package-properties';
import { getOrderPropertyValue } from './conditional-display.order-properties';

/**
 * Evaluators for the two condition families backed by store data:
 * `package.*` (campaign data for the package this element sits inside) and
 * `order.*` (the order store's current order).
 *
 * Unlike the cart evaluator in `conditional-display.conditions.ts`, neither
 * family supports `function` conditions — only `not`, `logical`, `property`
 * and `comparison`.
 */

// ---------------------------------------------------------------------------
// package.*
// ---------------------------------------------------------------------------

export function evaluatePackageCondition(
  ctx: ConditionalDisplayContext
): boolean {
  try {
    switch (ctx.condition.type) {
      case 'not':
        return !evaluatePackageConditionRecursive(ctx, ctx.condition.condition);

      case 'logical':
        return evaluatePackageLogicalCondition(ctx, ctx.condition);

      case 'property':
        return evaluatePackageProperty(ctx, ctx.condition);

      case 'comparison':
        return evaluatePackageComparison(ctx, ctx.condition);

      default:
        ctx.logger.warn(
          `Unsupported condition type for package: ${ctx.condition.type}`
        );
        return false;
    }
  } catch (error) {
    ctx.logger.error('Error evaluating package condition:', error);
    return false;
  }
}

export function evaluatePackageLogicalCondition(
  ctx: ConditionalDisplayContext,
  condition: any
): boolean {
  const { operator, conditions } = condition;

  if (operator === '||') {
    return conditions.some((cond: any) =>
      evaluatePackageConditionRecursive(ctx, cond)
    );
  } else if (operator === '&&') {
    return conditions.every((cond: any) =>
      evaluatePackageConditionRecursive(ctx, cond)
    );
  }

  return false;
}

export function evaluatePackageConditionRecursive(
  ctx: ConditionalDisplayContext,
  condition: any
): boolean {
  switch (condition.type) {
    case 'not':
      return !evaluatePackageConditionRecursive(ctx, condition.condition);
    case 'logical':
      return evaluatePackageLogicalCondition(ctx, condition);
    case 'property':
      return evaluatePackageProperty(ctx, condition);
    case 'comparison':
      return evaluatePackageComparison(ctx, condition);
    default:
      return false;
  }
}

export function evaluatePackageProperty(
  ctx: ConditionalDisplayContext,
  condition: any
): boolean {
  const value = getPackagePropertyValue(ctx, condition.property);
  return Boolean(value);
}

export function evaluatePackageComparison(
  ctx: ConditionalDisplayContext,
  condition: any
): boolean {
  const leftValue = getPackagePropertyValue(ctx, condition.left.property);
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
// order.*
// ---------------------------------------------------------------------------

export function evaluateOrderCondition(
  ctx: ConditionalDisplayContext,
  orderState: any
): boolean {
  try {
    switch (ctx.condition.type) {
      case 'not':
        return !evaluateOrderConditionRecursive(
          ctx,
          orderState,
          ctx.condition.condition
        );

      case 'logical':
        return evaluateOrderLogicalCondition(ctx, orderState, ctx.condition);

      case 'property':
        return evaluateOrderProperty(orderState, ctx.condition);

      case 'comparison':
        return evaluateOrderComparison(orderState, ctx.condition);

      default:
        ctx.logger.warn(
          `Unsupported condition type for order: ${ctx.condition.type}`
        );
        return false;
    }
  } catch (error) {
    ctx.logger.error('Error evaluating order condition:', error);
    return false;
  }
}

export function evaluateOrderLogicalCondition(
  ctx: ConditionalDisplayContext,
  orderState: any,
  condition: any
): boolean {
  const { operator, conditions } = condition;

  if (operator === '||') {
    return conditions.some((cond: any) =>
      evaluateOrderConditionRecursive(ctx, orderState, cond)
    );
  } else if (operator === '&&') {
    return conditions.every((cond: any) =>
      evaluateOrderConditionRecursive(ctx, orderState, cond)
    );
  }

  return false;
}

export function evaluateOrderConditionRecursive(
  ctx: ConditionalDisplayContext,
  orderState: any,
  condition: any
): boolean {
  switch (condition.type) {
    case 'not':
      return !evaluateOrderConditionRecursive(
        ctx,
        orderState,
        condition.condition
      );
    case 'logical':
      return evaluateOrderLogicalCondition(ctx, orderState, condition);
    case 'property':
      return evaluateOrderProperty(orderState, condition);
    case 'comparison':
      return evaluateOrderComparison(orderState, condition);
    default:
      return false;
  }
}

export function evaluateOrderProperty(
  orderState: any,
  condition: any
): boolean {
  const value = getOrderPropertyValue(orderState, condition.property);
  return Boolean(value);
}

export function evaluateOrderComparison(
  orderState: any,
  condition: any
): boolean {
  const leftValue = getOrderPropertyValue(orderState, condition.left.property);
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
