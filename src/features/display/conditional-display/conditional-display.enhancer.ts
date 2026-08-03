/**
 * Conditional Display Enhancer
 * Shows/hides elements based on cart state and other conditions
 *
 * Note: Uses shared PropertyResolver infrastructure for consistent property access
 * while maintaining its unique BaseEnhancer inheritance (visibility vs content display)
 *
 * This file is the orchestrator: lifecycle, store subscriptions and the DOM
 * writes that show or hide the element. The condition work lives in siblings:
 * - `conditional-display.dependencies.ts` — which stores a condition needs
 * - `conditional-display.conditions.ts` — the generic cart evaluator
 * - `conditional-display.domain-conditions.ts` — package/order conditions
 * - `conditional-display.context-conditions.ts` — selection/shipping conditions
 * - `conditional-display.param-conditions.ts` — URL parameter conditions
 * - `conditional-display.properties.ts` and its `*-properties` siblings —
 *   property readers that turn `{object}.{property}` into a value
 */

import { BaseEnhancer } from '@/core/base/base-enhancer';
import { AttributeParser } from '@/core/base/attribute-parser';
import { PackageContextResolver } from '@/features/display/display-core';
import { useCartStore } from '@/state/cart';
import { useCampaignStore } from '@/state/campaign';
import { useOrderStore } from '@/state/order';
import { useParameterStore } from '@/state/parameter';
import type { CartState } from '@/types/global';
import type { ConditionalDisplayContext } from './conditional-display.types';
import { analyzeDependencies } from './conditional-display.dependencies';
import { evaluateCondition } from './conditional-display.conditions';
import {
  evaluateOrderCondition,
  evaluatePackageCondition,
} from './conditional-display.domain-conditions';
import {
  evaluateSelectionCondition,
  evaluateShippingCondition,
} from './conditional-display.context-conditions';
import { evaluateParamsCondition } from './conditional-display.param-conditions';

export class ConditionalDisplayEnhancer extends BaseEnhancer {
  private condition: any;
  private showCondition!: boolean;
  private packageContext: number | null = null;
  private selectorId: string | null = null;
  private dependsOnCart: boolean = false;
  private dependsOnPackage: boolean = false;
  private dependsOnSelection: boolean = false;
  private dependsOnOrder: boolean = false;
  private dependsOnShipping: boolean = false;
  private dependsOnParams: boolean = false;
  private selectionChangeHandler: ((event: any) => void) | null = null;

  public async initialize(): Promise<void> {
    this.validateElement();

    // Detect package context using PackageContextResolver
    const packageId = PackageContextResolver.findPackageId(this.element);
    this.packageContext = packageId !== undefined ? packageId : null;

    // Detect selector context
    this.selectorId = this.detectSelectorContext();

    // Determine if this is a show or hide condition
    const showAttr = this.getAttribute('data-next-show');
    const hideAttr = this.getAttribute('data-next-hide');

    if (showAttr) {
      this.condition = AttributeParser.parseCondition(showAttr);
      this.showCondition = true;
    } else if (hideAttr) {
      this.condition = AttributeParser.parseCondition(hideAttr);
      this.showCondition = false;
    } else {
      throw new Error('Either data-next-show or data-next-hide is required');
    }

    if (this.condition) {
      this.analyzeDependencies();

      // Debug logging for condition analysis
      this.logger.debug('Condition analysis:', {
        condition: this.condition,
        dependsOnParams: this.dependsOnParams,
        dependsOnCart: this.dependsOnCart,
      });
    }

    // Subscribe only to relevant state changes
    if (this.dependsOnCart) {
      this.subscribe(useCartStore, this.handleStateUpdate.bind(this));
    }

    if (this.dependsOnPackage) {
      this.subscribe(useCampaignStore, this.handleCampaignUpdate.bind(this));
    }

    if (this.dependsOnSelection) {
      this.selectionChangeHandler = this.handleSelectionChange.bind(this);
      this.eventBus.on(
        'selector:selection-changed',
        this.selectionChangeHandler
      );
      this.eventBus.on('selector:item-selected', this.selectionChangeHandler);
    }

    if (this.dependsOnOrder) {
      this.subscribe(useOrderStore, this.handleOrderUpdate.bind(this));
    }

    if (this.dependsOnShipping) {
      this.subscribe(useCampaignStore, this.handleShippingUpdate.bind(this));
    }

    if (this.dependsOnParams) {
      this.subscribe(useParameterStore, this.handleParamsUpdate.bind(this));

      // Also listen for URL parameter updates
      this.eventBus.on('sdk:url-parameters-processed', () => {
        this.handleParamsUpdate(useParameterStore.getState());
      });
    }

    // Initial update - force immediate evaluation with current state
    // This ensures we get the correct state even after rehydration
    await new Promise(resolve => setTimeout(resolve, 0)); // Allow stores to fully initialize

    // Initial evaluation based on current dependency
    if (this.dependsOnParams) {
      this.handleParamsUpdate(useParameterStore.getState());
    } else if (this.dependsOnCart) {
      this.handleStateUpdate(useCartStore.getState());
    } else if (this.dependsOnPackage) {
      this.handlePackageUpdate();
    } else if (this.dependsOnSelection) {
      this.handleSelectionUpdate();
    } else if (this.dependsOnOrder) {
      this.handleOrderUpdate(useOrderStore.getState());
    } else if (this.dependsOnShipping) {
      this.handleShippingUpdate();
    }
  }

  public update(): void {
    if (this.dependsOnCart) {
      this.handleStateUpdate(useCartStore.getState());
    } else if (this.dependsOnPackage) {
      this.handlePackageUpdate();
    } else if (this.dependsOnSelection) {
      this.handleSelectionUpdate();
    } else if (this.dependsOnOrder) {
      this.handleOrderUpdate(useOrderStore.getState());
    } else if (this.dependsOnParams) {
      this.handleParamsUpdate(useParameterStore.getState());
    }
  }

  /**
   * Snapshot of what the evaluators need from this enhancer. Rebuilt on every
   * evaluation so it can never hold a stale condition or selector context.
   */
  private get context(): ConditionalDisplayContext {
    return {
      logger: this.logger,
      element: this.element,
      condition: this.condition,
      packageContext: this.packageContext,
      selectorId: this.selectorId,
    };
  }

  private analyzeDependencies(): void {
    const deps = analyzeDependencies(this.condition, this.logger);

    this.dependsOnCart = deps.dependsOnCart;
    this.dependsOnPackage = deps.dependsOnPackage;
    this.dependsOnSelection = deps.dependsOnSelection;
    this.dependsOnOrder = deps.dependsOnOrder;
    this.dependsOnShipping = deps.dependsOnShipping;
    this.dependsOnParams = deps.dependsOnParams;
  }

  private handleCampaignUpdate(): void {
    // Campaign data changed, re-evaluate package conditions
    if (this.dependsOnPackage) {
      this.handlePackageUpdate();
    }
  }

  private handleOrderUpdate(orderState: any): void {
    try {
      const conditionMet = evaluateOrderCondition(this.context, orderState);
      const shouldShow = this.showCondition ? conditionMet : !conditionMet;

      // Update element visibility
      this.element.style.display = shouldShow ? '' : 'none';

      // Add conditional classes
      this.toggleClass('next-condition-met', conditionMet);
      this.toggleClass('next-condition-not-met', !conditionMet);
      this.toggleClass('next-visible', shouldShow);
      this.toggleClass('next-hidden', !shouldShow);
    } catch (error) {
      this.handleError(error, 'handleOrderUpdate');
    }
  }

  private handlePackageUpdate(): void {
    try {
      const conditionMet = evaluatePackageCondition(this.context);
      const shouldShow = this.showCondition ? conditionMet : !conditionMet;

      // Update element visibility
      this.element.style.display = shouldShow ? '' : 'none';

      // Add conditional classes
      this.toggleClass('next-condition-met', conditionMet);
      this.toggleClass('next-condition-not-met', !conditionMet);
      this.toggleClass('next-visible', shouldShow);
      this.toggleClass('next-hidden', !shouldShow);
    } catch (error) {
      this.handleError(error, 'handlePackageUpdate');
    }
  }

  private handleShippingUpdate(): void {
    try {
      const conditionMet = evaluateShippingCondition(this.context);
      const shouldShow = this.showCondition ? conditionMet : !conditionMet;

      // Update element visibility
      this.element.style.display = shouldShow ? '' : 'none';

      // Add conditional classes
      this.toggleClass('next-condition-met', conditionMet);
      this.toggleClass('next-condition-not-met', !conditionMet);
      this.toggleClass('next-visible', shouldShow);
      this.toggleClass('next-hidden', !shouldShow);
    } catch (error) {
      this.handleError(error, 'handleShippingUpdate');
    }
  }

  private handleParamsUpdate(paramState: any): void {
    try {
      const conditionMet = evaluateParamsCondition(this.context, paramState);
      const shouldShow = this.showCondition ? conditionMet : !conditionMet;

      // Debug logging
      this.logger.debug('handleParamsUpdate:', {
        condition: this.condition,
        showCondition: this.showCondition,
        conditionMet,
        shouldShow,
        params: paramState.params,
        element: this.element.outerHTML.substring(0, 100),
      });

      // Update element visibility
      this.element.style.display = shouldShow ? '' : 'none';

      // Add conditional classes
      this.toggleClass('next-condition-met', conditionMet);
      this.toggleClass('next-condition-not-met', !conditionMet);
      this.toggleClass('next-visible', shouldShow);
      this.toggleClass('next-hidden', !shouldShow);
    } catch (error) {
      this.handleError(error, 'handleParamsUpdate');
    }
  }

  private handleStateUpdate(cartState: CartState): void {
    try {
      const conditionMet = evaluateCondition(this.context, cartState);
      const shouldShow = this.showCondition ? conditionMet : !conditionMet;

      // Update element visibility
      this.element.style.display = shouldShow ? '' : 'none';

      // Add conditional classes
      this.toggleClass('next-condition-met', conditionMet);
      this.toggleClass('next-condition-not-met', !conditionMet);
      this.toggleClass('next-visible', shouldShow);
      this.toggleClass('next-hidden', !shouldShow);
    } catch (error) {
      this.handleError(error, 'handleStateUpdate');
    }
  }

  private handleSelectionChange(event: any): void {
    // Only handle events for our selector
    if (this.selectorId && event.selectorId !== this.selectorId) return;

    this.handleSelectionUpdate();
  }

  private handleSelectionUpdate(): void {
    try {
      const conditionMet = evaluateSelectionCondition(this.context);
      const shouldShow = this.showCondition ? conditionMet : !conditionMet;

      // Update element visibility
      this.element.style.display = shouldShow ? '' : 'none';

      // Add conditional classes
      this.toggleClass('next-condition-met', conditionMet);
      this.toggleClass('next-condition-not-met', !conditionMet);
      this.toggleClass('next-visible', shouldShow);
      this.toggleClass('next-hidden', !shouldShow);
    } catch (error) {
      this.handleError(error, 'handleSelectionUpdate');
    }
  }

  private detectSelectorContext(): string | null {
    // First check the parsed condition for embedded selector ID
    if (this.condition) {
      // For property conditions
      if (this.condition.property && this.condition.property.includes('.')) {
        const parts = this.condition.property.split('.');
        if (parts.length >= 2) {
          this.logger.debug('Found selector ID in property:', parts[0]);
          return parts[0];
        }
      }

      // For comparison conditions, check left side
      if (
        this.condition.left &&
        this.condition.left.property &&
        this.condition.left.property.includes('.')
      ) {
        const parts = this.condition.left.property.split('.');
        if (parts.length >= 2) {
          this.logger.debug('Found selector ID in comparison:', parts[0]);
          return parts[0];
        }
      }
    }

    // Check for explicit selector ID attribute
    const explicitId =
      this.getAttribute('data-next-selector-id') ||
      this.getAttribute('data-selector-id');
    if (explicitId) return explicitId;

    // Search up the DOM tree for selector context
    let current: HTMLElement | null = this.element;

    while (current) {
      const selectorId = current.getAttribute('data-next-selector-id');
      if (selectorId) return selectorId;

      // Check if this is a selector element itself
      if (current.hasAttribute('data-next-cart-selector')) {
        return (
          current.getAttribute('data-next-selector-id') ||
          current.getAttribute('data-next-id') ||
          null
        );
      }

      current = current.parentElement;
    }

    return null;
  }

  public override destroy(): void {
    super.destroy();

    // Clean up selection event listeners
    if (this.selectionChangeHandler) {
      this.eventBus.off(
        'selector:selection-changed',
        this.selectionChangeHandler
      );
      this.eventBus.off('selector:item-selected', this.selectionChangeHandler);
    }
  }
}
