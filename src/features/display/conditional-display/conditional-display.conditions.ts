import type { CartState } from '@/types/global';
import type { ConditionalDisplayContext } from './conditional-display.types';
import { getPropertyValue } from './conditional-display.properties';

/**
 * Evaluates the element's condition against cart state. This is the generic
 * engine: it is the only evaluator that understands `function` conditions
 * (`cart.hasItem(...)`, `cart.hasCoupon(...)`) and cross-object comparisons.
 */
export function evaluateCondition(
  ctx: ConditionalDisplayContext,
  cartState: CartState
): boolean {
  try {
    switch (ctx.condition.type) {
      case 'not':
        return !evaluateConditionRecursive(
          ctx,
          cartState,
          ctx.condition.condition
        );

      case 'logical':
        return evaluateLogicalCondition(ctx, cartState, ctx.condition);

      case 'property':
        return evaluateProperty(ctx, cartState, ctx.condition);

      case 'function':
        return evaluateFunction(ctx, cartState, ctx.condition);

      case 'comparison':
        return evaluateComparison(ctx, cartState, ctx.condition);

      default:
        ctx.logger.warn(`Unknown condition type: ${ctx.condition.type}`);
        return false;
    }
  } catch (error) {
    ctx.logger.error('Error evaluating condition:', error);
    return false;
  }
}

export function evaluateLogicalCondition(
  ctx: ConditionalDisplayContext,
  cartState: CartState,
  condition: any
): boolean {
  const { operator, conditions } = condition;

  if (operator === '||') {
    // OR: return true if ANY condition is true
    return conditions.some((cond: any) =>
      evaluateConditionRecursive(ctx, cartState, cond)
    );
  } else if (operator === '&&') {
    // AND: return true only if ALL conditions are true
    return conditions.every((cond: any) =>
      evaluateConditionRecursive(ctx, cartState, cond)
    );
  }

  return false;
}

export function evaluateConditionRecursive(
  ctx: ConditionalDisplayContext,
  cartState: CartState,
  condition: any
): boolean {
  switch (condition.type) {
    case 'not':
      return !evaluateConditionRecursive(ctx, cartState, condition.condition);

    case 'logical':
      return evaluateLogicalCondition(ctx, cartState, condition);

    case 'property':
      return evaluateProperty(ctx, cartState, condition);

    case 'function':
      return evaluateFunction(ctx, cartState, condition);

    case 'comparison':
      return evaluateComparison(ctx, cartState, condition);

    default:
      return false;
  }
}

export function evaluateProperty(
  ctx: ConditionalDisplayContext,
  cartState: CartState,
  condition: any
): boolean {
  const value = getPropertyValue(
    ctx,
    cartState,
    condition.object,
    condition.property
  );
  return Boolean(value);
}

export function evaluateFunction(
  ctx: ConditionalDisplayContext,
  cartState: CartState,
  condition: any
): boolean {
  const { object, method, args } = condition;

  if (object === 'cart') {
    switch (method) {
      case 'hasItem':
        if (args.length > 0) {
          const packageId = args[0];
          return cartState.items.some(item => item.packageId === packageId);
        }
        return false;

      case 'hasItems':
        return !cartState.isEmpty;

      case 'hasCoupon':
        if (args.length > 0) {
          const code = normalizeCouponCode(args[0]);
          if (!code) return false;
          return (cartState.vouchers ?? []).some(
            voucher => normalizeCouponCode(voucher) === code
          );
        }
        return (cartState.vouchers ?? []).length > 0;

      default:
        ctx.logger.warn(`Unknown cart method: ${method}`);
        return false;
    }
  }

  return false;
}

export function normalizeCouponCode(value: unknown): string {
  const raw = String(value ?? '').trim();
  const unquoted =
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
      ? raw.slice(1, -1)
      : raw;
  return unquoted.trim().toUpperCase();
}

export function evaluateComparison(
  ctx: ConditionalDisplayContext,
  cartState: CartState,
  condition: any
): boolean {
  const leftValue = getPropertyValue(
    ctx,
    cartState,
    condition.left.object,
    condition.left.property
  );
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
