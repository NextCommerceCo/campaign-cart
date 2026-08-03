/**
 * Product Display Enhancer
 * Displays package/campaign data with context awareness and advanced calculations
 */

import { BaseDisplayEnhancer } from '@/core/base/base-display-enhancer';
import { AttributeParser } from '@/core/base/attribute-parser';
import {
  DisplayContextProvider,
  PackageContextResolver,
} from '@/features/display/display-core';
import { useCampaignStore } from '@/state/campaign';
import { useCartStore } from '@/state/cart';
import { getCalculatedProperty } from './product-display.price';
import {
  getPackageValue,
  getCampaignProperty,
  isPriceProperty,
  parseNumericValue,
} from './product-display.properties';
import type { Package } from '@/types/global';

export class ProductDisplayEnhancer extends BaseDisplayEnhancer {
  private campaignState?: any;
  private packageId?: number;
  private contextPackageId?: number | undefined;
  private packageData?: Package;
  private multiplyByQuantity: boolean = false;
  private currentQuantity: number = 1;
  private quantitySelectorId?: string;

  override async initialize(): Promise<void> {
    this.validateElement();
    this.parseDisplayAttributes();

    // Check for quantity multiplication attribute
    this.multiplyByQuantity = this.element.hasAttribute(
      'data-next-multiply-quantity'
    );
    this.quantitySelectorId =
      this.getAttribute('data-next-quantity-selector-id') || '';

    // PRESERVE: Package context detection
    this.detectPackageContext();

    this.setupStoreSubscriptions();
    this.setupQuantityListeners();
    this.setupCurrencyChangeListener();
    await this.performInitialUpdate();
    this.logger.debug(
      `ProductDisplayEnhancer initialized with package ${this.packageId}, path: ${this.displayPath}, format: ${this.formatType}, multiplyByQuantity: ${this.multiplyByQuantity}`
    );
  }

  protected setupStoreSubscriptions(): void {
    // Subscribe to campaign store updates
    this.subscribe(useCampaignStore, this.handleCampaignUpdate.bind(this));

    // Also subscribe to cart store for discount changes
    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));

    // Get initial state
    this.campaignState = useCampaignStore.getState();
    // Ensure we have access to all packages from the start
    if (!this.campaignState.packages && this.campaignState.data?.packages) {
      this.campaignState.packages = this.campaignState.data.packages;
    }

    // Load package data
    this.loadPackageData();
  }

  private handleCampaignUpdate(campaignState: any): void {
    this.campaignState = campaignState;
    // Ensure we have access to all packages
    if (!this.campaignState.packages && campaignState.data?.packages) {
      this.campaignState.packages = campaignState.data.packages;
    }
    this.loadPackageData();
    this.updateDisplay();
  }

  private handleCartUpdate(): void {
    // Update display when cart changes (discount codes might affect package price)
    this.updateDisplay();
  }

  protected override setupCurrencyChangeListener(): void {
    // Call base implementation first
    super.setupCurrencyChangeListener();

    // Add our specific handling for package data refresh. `this.listen` binds it to
    // this enhancer's lifetime — base `cleanupEventListeners()` drops it on destroy.
    this.listen(document, 'next:currency-changed', async () => {
      this.logger.debug('Currency changed, reloading package data');

      // Get fresh campaign state
      this.campaignState = useCampaignStore.getState();

      // Reload package data with new currency
      this.loadPackageData();

      // Force a complete re-render
      await this.updateDisplay();
    });
  }

  private setupQuantityListeners(): void {
    // Listen for quantity changes if multiplication is enabled
    if (!this.multiplyByQuantity) return;

    // Listen for quantity change events from UpsellEnhancer
    this.eventBus.on('upsell:quantity-changed', data => {
      // Check if this quantity change is relevant to us
      if (
        this.quantitySelectorId &&
        data.selectorId === this.quantitySelectorId
      ) {
        this.currentQuantity = data.quantity;
        this.updateDisplay();
      } else if (!this.quantitySelectorId && !data.selectorId) {
        // No selector IDs on either side - match by package ID
        if (data.packageId === this.packageId) {
          this.currentQuantity = data.quantity;
          this.updateDisplay();
        }
      } else if (!this.quantitySelectorId) {
        // Check if we're in a container with matching selector ID
        const container = this.element.closest('[data-next-selector-id]');
        if (container) {
          const containerSelectorId = container.getAttribute(
            'data-next-selector-id'
          );
          if (containerSelectorId === data.selectorId) {
            this.currentQuantity = data.quantity;
            this.updateDisplay();
          }
        } else if (data.packageId === this.packageId) {
          // Fallback: match by package ID if no selector context
          this.currentQuantity = data.quantity;
          this.updateDisplay();
        }
      }
    });

    // Try to get initial quantity from the container
    if (this.quantitySelectorId) {
      // Check for existing quantity in the UpsellEnhancer's shared state
      const quantityDisplay = document.querySelector(
        `[data-next-upsell-quantity="display"][data-next-quantity-selector-id="${this.quantitySelectorId}"]`
      );
      if (quantityDisplay && quantityDisplay.textContent) {
        const qty = parseInt(quantityDisplay.textContent, 10);
        if (!isNaN(qty)) {
          this.currentQuantity = qty;
        }
      }
    } else {
      // No selector ID - try to find quantity display in same container
      const container = this.element.closest('[data-next-upsell]');
      if (container) {
        const quantityDisplay = container.querySelector(
          '[data-next-upsell-quantity="display"]'
        );
        if (quantityDisplay && quantityDisplay.textContent) {
          const qty = parseInt(quantityDisplay.textContent, 10);
          if (!isNaN(qty)) {
            this.currentQuantity = qty;
          }
        }
      }
    }
  }

  // PRESERVE: Package context detection
  private detectPackageContext(): void {
    // Try new context provider first
    const context = DisplayContextProvider.resolve(this.element);
    if (context?.packageId) {
      this.contextPackageId = context.packageId;
    } else {
      // Fallback to legacy context resolver
      this.contextPackageId = PackageContextResolver.findPackageId(
        this.element
      );
    }

    // Parse the display path to extract package ID if it's a package-specific path
    const parsed = AttributeParser.parseDisplayPath(this.displayPath!);
    if (parsed.object === 'package' && parsed.property.includes('.')) {
      // Format: "package.2.name" or "package.2.price"
      const parts = parsed.property.split('.');
      if (parts[0] && !isNaN(Number(parts[0]))) {
        this.packageId = Number(parts[0]);
        // Update property to remove package ID part
        this.property = parts.slice(1).join('.');
      }
    } else if (this.contextPackageId) {
      // Use context package ID if available
      this.packageId = this.contextPackageId;
    }

    if (!this.packageId) {
      this.logger.warn('No package context found - package ID required');
    }
  }

  private loadPackageData(): void {
    if (!this.packageId || !this.campaignState) return;

    const packages =
      this.campaignState.data?.packages || this.campaignState.packages;
    this.packageData = packages?.find(
      (pkg: Package) => pkg.ref_id === this.packageId
    );

    if (!this.packageData) {
      this.logger.warn(`Package ${this.packageId} not found in campaign data`);
      const availableIds = packages?.map((p: Package) => p.ref_id).join(', ');
      this.logger.debug(
        `Available package IDs in campaign state: ${availableIds}`
      );
    } else {
      this.logger.debug(
        `Package ${this.packageId} loaded with price: ${this.packageData.price} ${this.campaignState.currency ?? ''}`
      );
    }
  }

  protected getPropertyValue(): any {
    if (!this.packageData || !this.property) return undefined;

    // Handle campaign properties
    if (this.displayPath?.startsWith('campaign.')) {
      return getCampaignProperty(
        this.campaignState,
        this.property,
        this.logger
      );
    }

    // Handle calculated properties
    const calculatedValue = getCalculatedProperty(
      this.packageData,
      this.property,
      this.logger
    );
    if (calculatedValue !== undefined) {
      // Apply quantity multiplication if enabled and value is a number
      if (this.multiplyByQuantity && typeof calculatedValue === 'number') {
        return calculatedValue * this.currentQuantity;
      }
      return calculatedValue;
    }

    // Direct property access on package
    const value = getPackageValue(this.packageData, this.property);

    // Apply quantity multiplication for price-related properties
    if (this.multiplyByQuantity && isPriceProperty(this.property)) {
      const numericValue = parseNumericValue(value);
      if (numericValue !== null) {
        return numericValue * this.currentQuantity;
      }
    }

    return value;
  }

  // Override to handle special element types and container hiding
  protected override updateElementContent(value: string): void {
    if (
      this.element instanceof HTMLInputElement ||
      this.element instanceof HTMLTextAreaElement
    ) {
      this.element.value = value;
    } else if (this.element instanceof HTMLImageElement) {
      this.element.src = value;
      this.element.alt = 'Product image';
    } else {
      this.element.textContent = value;
    }
  }

  // Override to handle container hiding support
  protected override hideElement(): void {
    this.element.style.display = 'none';
    this.addClass('display-hidden');
    this.removeClass('display-visible');

    // Also hide parent container if it has data-container attribute
    const container = this.element.closest('[data-container="true"]');
    if (container) {
      (container as HTMLElement).style.display = 'none';
    }
  }

  protected override showElement(): void {
    this.element.style.display = '';
    this.addClass('display-visible');
    this.removeClass('display-hidden');

    // Show parent container if it was hidden
    const container = this.element.closest('[data-container="true"]');
    if (container) {
      (container as HTMLElement).style.display = '';
    }
  }

  override update(data?: any): void {
    if (data) {
      this.handleCampaignUpdate(data);
    } else {
      this.updateDisplay();
    }
  }

  // COMPATIBILITY METHODS
  public getPackageProperty(property: string): any {
    // Compatibility method - delegate to new implementation
    const oldProperty = this.property;
    this.property = property;
    const value = this.getPropertyValue();
    this.property = oldProperty;
    return value;
  }

  public setPackageContext(packageId: number): void {
    // Compatibility method
    this.packageId = packageId;
    this.loadPackageData();
    this.updateDisplay();
  }
}
