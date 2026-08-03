/**
 * Selection Display Enhancer
 * Displays values based on the currently selected package in a selector
 */

import {
  BaseDisplayEnhancer,
  PropertyResolver,
} from '@/core/base/base-display-enhancer';
import { useCampaignStore } from '@/state/campaign';
import { useCartStore } from '@/state/cart';
import type { Package, SelectorItem, CartState } from '@/types/global';
import {
  findSelectorIdFromContext,
  findAssociatedSelector,
  needsCartData,
  loadPackageData,
} from './selection-display.handlers';
import {
  getSelectionPrice,
  getSelectionTotal,
  getSelectionCompareTotal,
  getSelectionSavingsAmount,
  getSelectionSavingsPercentageFormatted,
  getSelectionHasSavings,
  getSelectionUnitPrice,
  getSelectionTotalUnits,
  getSelectionDiscountAmount,
  getSelectionIsBundle,
  calculateSelectionDiscountAmount,
  calculateSelectionDiscountedPrice,
  getSelectionHasDiscount,
  getSelectionDiscountPercentage,
  getSelectionAppliedDiscounts,
  parseCalculatedField,
} from './selection-display.price';
import type {
  LoadPackageDataResult,
  SelectionPriceContext,
} from './selection-display.types';

export class SelectionDisplayEnhancer extends BaseDisplayEnhancer {
  private selectorId?: string;
  private selectedItem: SelectorItem | null = null;
  private packageData?: Package;
  private campaignState?: any;
  private cartState?: CartState;
  private selectionChangeHandler: ((event: any) => void) | null = null;

  override async initialize(): Promise<void> {
    this.validateElement();
    this.parseDisplayAttributes();

    // Find associated selector
    this.applySelectedItem(
      findAssociatedSelector(this.selectorId, this.logger)
    );

    this.setupStoreSubscriptions();

    // Load package data if we found a selected item
    if (this.selectedItem) {
      this.applyPackageData(
        loadPackageData(this.selectedItem, this.campaignState, this.logger)
      );
    }

    await this.performInitialUpdate();

    this.logger.debug(`SelectionDisplayEnhancer initialized:`, {
      displayPath: this.displayPath,
      selectorId: this.selectorId,
    });
  }

  protected override parseDisplayAttributes(): void {
    super.parseDisplayAttributes();

    // Check if selector ID is embedded in the display path
    // Format: selection.{selectorId}.{property}
    const pathParts = this.displayPath!.split('.');
    if (pathParts.length >= 3 && pathParts[0] === 'selection') {
      // Extract selector ID from path
      const selectorId = pathParts[1];
      if (selectorId) {
        this.selectorId = selectorId;
      }
      // Update property to be the remaining parts
      this.property = pathParts.slice(2).join('.');

      this.logger.debug('Extracted selector ID from display path:', {
        displayPath: this.displayPath,
        selectorId: this.selectorId,
        property: this.property,
      });
    } else {
      // Fallback to attribute or context-based detection
      const selectorId =
        this.getAttribute('data-next-selector-id') ||
        this.getAttribute('data-selector-id') ||
        findSelectorIdFromContext(this.element.parentElement);
      if (selectorId) {
        this.selectorId = selectorId;
      }
    }

    if (!this.selectorId) {
      this.logger.warn('No selector ID found for SelectionDisplayEnhancer');
    }
  }

  protected setupStoreSubscriptions(): void {
    // Subscribe to campaign store for package data
    this.subscribe(useCampaignStore, this.handleCampaignUpdate.bind(this));
    this.campaignState = useCampaignStore.getState();

    // Subscribe to cart store only if needed for discount properties
    if (needsCartData(this.property)) {
      this.subscribe(useCartStore, this.handleCartUpdate.bind(this));
      this.cartState = useCartStore.getState();
    }

    // Create bound handler for proper cleanup
    this.selectionChangeHandler = this.handleSelectionChange.bind(this);

    // Subscribe to global selector events
    this.eventBus.on('selector:selection-changed', this.selectionChangeHandler);
    this.eventBus.on('selector:item-selected', this.selectionChangeHandler);
  }

  private handleCampaignUpdate(campaignState: any): void {
    this.campaignState = campaignState;
    this.applyPackageData(
      loadPackageData(this.selectedItem, this.campaignState, this.logger)
    );
    this.updateDisplay();
  }

  private handleCartUpdate(cartState: CartState): void {
    this.cartState = cartState;
    this.updateDisplay();
  }

  private handleSelectionChange(event: any): void {
    // Only handle events for our selector
    if (event.selectorId !== this.selectorId) return;

    this.logger.debug('Selection changed:', event);

    // Update selected item
    if (event.item) {
      this.selectedItem = event.item;
    } else if (event.packageId) {
      // Try to find the selector and get the item
      const selectorElement = document.querySelector(
        `[data-next-selector-id="${this.selectorId}"]`
      ) as HTMLElement;

      if (selectorElement) {
        const getSelectedItem = (selectorElement as any)._getSelectedItem;
        if (typeof getSelectedItem === 'function') {
          this.selectedItem = getSelectedItem();
        }
      }
    }

    this.applyPackageData(
      loadPackageData(this.selectedItem, this.campaignState, this.logger)
    );
    this.updateDisplay();
  }

  /** Assigns `selectedItem` only when the lookup produced a result — `undefined` means "no change". */
  private applySelectedItem(
    selectedItem: SelectorItem | null | undefined
  ): void {
    if (selectedItem !== undefined) {
      this.selectedItem = selectedItem;
    }
  }

  /** Assigns `packageData` only when the guard in `loadPackageData` passed. */
  private applyPackageData(result: LoadPackageDataResult): void {
    if (result.changed) {
      this.packageData = result.packageData;
    }
  }

  private getPriceContext(): SelectionPriceContext {
    return {
      selectedItem: this.selectedItem,
      packageData: this.packageData,
      cartState: this.cartState,
    };
  }

  protected getPropertyValue(): any {
    if (!this.selectedItem || !this.property) return undefined;

    // Snapshot once — selectedItem/packageData/cartState don't change mid-routing.
    const ctx = this.getPriceContext();

    // Handle selection properties
    switch (this.property) {
      case 'hasSelection':
        return this.selectedItem !== null;
      case 'packageId':
        return this.selectedItem.packageId;
      case 'quantity':
        return this.selectedItem.quantity;
      case 'name':
        return this.packageData?.name || this.selectedItem.name || '';

      // Pricing properties
      case 'price':
        return getSelectionPrice(ctx);
      case 'total':
      case 'price_total':
        return getSelectionTotal(ctx);
      case 'compareTotal':
      case 'price_retail_total':
        return getSelectionCompareTotal(ctx);
      case 'savings':
      case 'savingsAmount':
        return getSelectionSavingsAmount(ctx);
      case 'savingsPercentage':
        return getSelectionSavingsPercentageFormatted(ctx);
      case 'hasSavings':
        return getSelectionHasSavings(ctx);

      // Additional calculated fields
      case 'unitPrice':
      case 'pricePerUnit':
        return getSelectionUnitPrice(ctx);
      case 'totalUnits':
      case 'totalQuantity':
        return getSelectionTotalUnits(ctx);
      case 'discountAmount':
        return getSelectionDiscountAmount(ctx);

      // Cart discount properties
      case 'discountedPrice':
      case 'finalPrice':
        return calculateSelectionDiscountedPrice(ctx);
      case 'appliedDiscountAmount':
        return calculateSelectionDiscountAmount(ctx);
      case 'hasDiscount':
        return getSelectionHasDiscount(ctx);
      case 'discountPercentage':
        return getSelectionDiscountPercentage(ctx);
      case 'appliedDiscounts':
        return getSelectionAppliedDiscounts(ctx);
      case 'isMultiPack':
      case 'isBundle':
        return getSelectionIsBundle(ctx);
      case 'isSingleUnit':
        return !getSelectionIsBundle(ctx);

      default: {
        // Check for custom calculated fields with operators
        const calculatedValue = parseCalculatedField(
          this.property,
          ctx,
          property => {
            const oldProperty = this.property;
            this.property = property;
            const value = this.getPropertyValue();
            this.property = oldProperty;
            return value;
          }
        );
        if (calculatedValue !== undefined) {
          return calculatedValue;
        }

        // Try to get from package data
        if (this.packageData) {
          return PropertyResolver.getNestedProperty(
            this.packageData,
            this.property
          );
        }
        return undefined;
      }
    }
  }

  protected override async performInitialUpdate(): Promise<void> {
    // If we don't have a selected item yet, wait a bit for selector to initialize
    if (!this.selectedItem && this.selectorId) {
      // Give selector a chance to initialize
      await new Promise(resolve => setTimeout(resolve, 50));
      this.applySelectedItem(
        findAssociatedSelector(this.selectorId, this.logger)
      );
      if (this.selectedItem) {
        this.applyPackageData(
          loadPackageData(this.selectedItem, this.campaignState, this.logger)
        );
      }
    }

    await this.updateDisplay();
  }

  // Override to handle empty selection
  protected override async updateDisplay(): Promise<void> {
    // Handle empty selection
    if (this.selectedItem === null && this.property !== 'hasSelection') {
      this.hideElement();
      return;
    }

    // Use the base class implementation which uses the clean pipeline
    await super.updateDisplay();
  }

  public override destroy(): void {
    super.destroy();

    // Clean up event listeners
    if (this.selectionChangeHandler) {
      this.eventBus.off(
        'selector:selection-changed',
        this.selectionChangeHandler
      );
      this.eventBus.off('selector:item-selected', this.selectionChangeHandler);
    }
  }
}
