import type { Logger } from '@/core/logger';

/**
 * Which stores/events a parsed condition needs to be re-evaluated on.
 */
export interface ConditionDependencies {
  dependsOnCart: boolean;
  dependsOnPackage: boolean;
  dependsOnSelection: boolean;
  dependsOnOrder: boolean;
  dependsOnShipping: boolean;
  dependsOnParams: boolean;
}

/**
 * Walks a parsed condition tree and reports every state source it reads.
 * Defaults to the cart when nothing is detected, for backward compatibility.
 */
export function analyzeDependencies(
  condition: any,
  logger: Logger
): ConditionDependencies {
  const deps: ConditionDependencies = {
    dependsOnCart: conditionDependsOnCart(condition),
    dependsOnPackage: conditionDependsOnPackage(condition),
    dependsOnSelection: conditionDependsOnSelection(condition),
    dependsOnOrder: conditionDependsOnOrder(condition),
    dependsOnShipping: conditionDependsOnShipping(condition),
    dependsOnParams: conditionDependsOnParams(condition, logger),
  };

  // If no dependency is detected, default to cart for backward compatibility
  if (
    !deps.dependsOnCart &&
    !deps.dependsOnPackage &&
    !deps.dependsOnSelection &&
    !deps.dependsOnOrder &&
    !deps.dependsOnShipping &&
    !deps.dependsOnParams
  ) {
    deps.dependsOnCart = true;
  }

  return deps;
}

export function conditionDependsOnCart(condition: any): boolean {
  switch (condition.type) {
    case 'not':
      // Check if the inner condition depends on cart
      return conditionDependsOnCart(condition.condition);

    case 'logical':
      // Check if ANY sub-condition depends on cart
      return condition.conditions.some((cond: any) =>
        conditionDependsOnCart(cond)
      );

    case 'property':
      return condition.object === 'cart';

    case 'function':
      return condition.object === 'cart';

    case 'comparison':
      return (
        condition.left.object === 'cart' ||
        (condition.right &&
          typeof condition.right === 'object' &&
          condition.right.object === 'cart')
      );

    default:
      return false;
  }
}

export function conditionDependsOnPackage(condition: any): boolean {
  switch (condition.type) {
    case 'not':
      // Check if the inner condition depends on package
      return conditionDependsOnPackage(condition.condition);

    case 'logical':
      // Check if ANY sub-condition depends on package
      return condition.conditions.some((cond: any) =>
        conditionDependsOnPackage(cond)
      );

    case 'property':
      return condition.object === 'package';

    case 'function':
      return condition.object === 'package';

    case 'comparison':
      return (
        condition.left.object === 'package' ||
        (condition.right &&
          typeof condition.right === 'object' &&
          condition.right.object === 'package')
      );

    default:
      return false;
  }
}

export function conditionDependsOnSelection(condition: any): boolean {
  switch (condition.type) {
    case 'not':
      // Check if the inner condition depends on selection
      return conditionDependsOnSelection(condition.condition);

    case 'logical':
      // Check if ANY sub-condition depends on selection
      return condition.conditions.some((cond: any) =>
        conditionDependsOnSelection(cond)
      );

    case 'property':
      return (
        condition.object === 'selection' ||
        (condition.object && condition.object.startsWith('selection.'))
      );

    case 'function':
      return (
        condition.object === 'selection' ||
        (condition.object && condition.object.startsWith('selection.'))
      );

    case 'comparison':
      const leftIsSelection =
        condition.left.object === 'selection' ||
        (condition.left.object &&
          condition.left.object.startsWith('selection.'));
      const rightIsSelection =
        condition.right &&
        typeof condition.right === 'object' &&
        (condition.right.object === 'selection' ||
          (condition.right.object &&
            condition.right.object.startsWith('selection.')));
      return leftIsSelection || rightIsSelection;

    default:
      return false;
  }
}

export function conditionDependsOnOrder(condition: any): boolean {
  switch (condition.type) {
    case 'not':
      // Check if the inner condition depends on order
      return conditionDependsOnOrder(condition.condition);

    case 'logical':
      // Check if ANY sub-condition depends on order
      return condition.conditions.some((cond: any) =>
        conditionDependsOnOrder(cond)
      );

    case 'property':
      return condition.object === 'order';

    case 'function':
      return condition.object === 'order';

    case 'comparison':
      return (
        condition.left.object === 'order' ||
        (condition.right &&
          typeof condition.right === 'object' &&
          condition.right.object === 'order')
      );

    default:
      return false;
  }
}

export function conditionDependsOnShipping(condition: any): boolean {
  switch (condition.type) {
    case 'not':
      // Check if the inner condition depends on shipping
      return conditionDependsOnShipping(condition.condition);

    case 'logical':
      // Check if ANY sub-condition depends on shipping
      return condition.conditions.some((cond: any) =>
        conditionDependsOnShipping(cond)
      );

    case 'property':
      return condition.object === 'shipping';

    case 'function':
      return condition.object === 'shipping';

    case 'comparison':
      return (
        condition.left.object === 'shipping' ||
        (condition.right &&
          typeof condition.right === 'object' &&
          condition.right.object === 'shipping')
      );

    default:
      return false;
  }
}

export function conditionDependsOnParams(
  condition: any,
  logger: Logger
): boolean {
  if (!condition) return false;

  logger.debug('Checking if condition depends on params:', {
    condition,
    type: condition.type,
    leftObject: condition.left?.object,
    rightObject: condition.right?.object,
  });

  switch (condition.type) {
    case 'not':
      // Check if the inner condition depends on params
      return conditionDependsOnParams(condition.condition, logger);

    case 'logical':
      // Check if ANY sub-condition depends on params
      return condition.conditions.some((cond: any) =>
        conditionDependsOnParams(cond, logger)
      );

    case 'property':
      return condition.object === 'param' || condition.object === 'params';

    case 'function':
      return condition.object === 'param' || condition.object === 'params';

    case 'comparison':
      const dependsOnParams =
        (condition.left &&
          (condition.left.object === 'param' ||
            condition.left.object === 'params')) ||
        (condition.right &&
          typeof condition.right === 'object' &&
          (condition.right.object === 'param' ||
            condition.right.object === 'params'));

      logger.debug('Comparison depends on params:', dependsOnParams);
      return dependsOnParams;

    default:
      return false;
  }
}
