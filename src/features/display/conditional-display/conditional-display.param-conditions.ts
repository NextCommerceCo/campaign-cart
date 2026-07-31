import type { ConditionalDisplayContext } from './conditional-display.types';

/**
 * Evaluates a `param.*` / `params.*` condition against the parameter store.
 *
 * Params are read straight off the store's `hasParam` / `getParam` accessors
 * and compared as strings, so `param.seen == 'n'` matches the URL value
 * verbatim rather than being coerced to a number first.
 */
export function evaluateParamsCondition(
  ctx: ConditionalDisplayContext,
  paramState: any
): boolean {
  try {
    switch (ctx.condition.type) {
      case 'not':
        return !evaluateParamsConditionRecursive(
          paramState,
          ctx.condition.condition
        );

      case 'logical':
        return evaluateParamsLogicalCondition(paramState, ctx.condition);

      case 'property':
        // param.seen would check if 'seen' parameter exists
        return paramState.hasParam(ctx.condition.property);

      case 'comparison':
        // param.seen == 'n' would check the value
        const paramValue = String(
          paramState.getParam(ctx.condition.left.property) || ''
        );
        const compareValue = String(ctx.condition.right); // Ensure string comparison

        ctx.logger.info('evaluateParamsCondition comparison:', {
          condition: ctx.condition,
          property: ctx.condition.left.property,
          paramValue,
          compareValue,
          operator: ctx.condition.operator,
          willMatch: paramValue === compareValue,
          paramValueType: typeof paramValue,
          compareValueType: typeof compareValue,
          allParams: paramState.params,
        });

        switch (ctx.condition.operator) {
          case '===':
          case '==':
            return paramValue === compareValue;
          case '!==':
          case '!=':
            return paramValue !== compareValue;
          case '>':
            return Number(paramValue) > Number(compareValue);
          case '>=':
            return Number(paramValue) >= Number(compareValue);
          case '<':
            return Number(paramValue) < Number(compareValue);
          case '<=':
            return Number(paramValue) <= Number(compareValue);
          default:
            return false;
        }

      case 'function':
        // Handle param.has('seen') or param.exists('seen')
        if (
          ctx.condition.method === 'has' ||
          ctx.condition.method === 'exists'
        ) {
          const paramName = ctx.condition.args[0];
          return paramState.hasParam(paramName);
        }
        // Handle param.is('seen', 'n')
        if (
          ctx.condition.method === 'is' ||
          ctx.condition.method === 'equals'
        ) {
          const paramName = ctx.condition.args[0];
          const expectedValue = String(ctx.condition.args[1]);
          const actualValue = paramState.getParam(paramName) || '';
          return actualValue === expectedValue;
        }
        return false;

      default:
        ctx.logger.warn(
          `Unsupported condition type for params: ${ctx.condition.type}`
        );
        return false;
    }
  } catch (error) {
    ctx.logger.error('Error evaluating params condition:', error);
    return false;
  }
}

export function evaluateParamsLogicalCondition(
  paramState: any,
  condition: any
): boolean {
  const { operator, conditions } = condition;

  if (operator === '||') {
    return conditions.some((cond: any) =>
      evaluateParamsConditionRecursive(paramState, cond)
    );
  } else if (operator === '&&') {
    return conditions.every((cond: any) =>
      evaluateParamsConditionRecursive(paramState, cond)
    );
  }

  return false;
}

export function evaluateParamsConditionRecursive(
  paramState: any,
  condition: any
): boolean {
  switch (condition.type) {
    case 'not':
      return !evaluateParamsConditionRecursive(paramState, condition.condition);
    case 'logical':
      return evaluateParamsLogicalCondition(paramState, condition);
    case 'property':
      // param.seen would check if 'seen' parameter exists
      return paramState.hasParam(condition.property);
    case 'comparison':
      // param.seen == 'n' would check the value
      const paramValue = String(
        paramState.getParam(condition.left.property) || ''
      );
      const compareValue = String(condition.right);
      switch (condition.operator) {
        case '===':
        case '==':
          return paramValue === compareValue;
        case '!==':
        case '!=':
          return paramValue !== compareValue;
        case '>':
          return Number(paramValue) > Number(compareValue);
        case '>=':
          return Number(paramValue) >= Number(compareValue);
        case '<':
          return Number(paramValue) < Number(compareValue);
        case '<=':
          return Number(paramValue) <= Number(compareValue);
        default:
          return false;
      }
    case 'function':
      // Handle param.has('seen') or param.exists('seen')
      if (condition.method === 'has' || condition.method === 'exists') {
        const paramName = condition.args[0];
        return paramState.hasParam(paramName);
      }
      // Handle param.is('seen', 'n')
      if (condition.method === 'is' || condition.method === 'equals') {
        const paramName = condition.args[0];
        const expectedValue = String(condition.args[1]);
        const actualValue = paramState.getParam(paramName) || '';
        return actualValue === expectedValue;
      }
      return false;
    default:
      return false;
  }
}
