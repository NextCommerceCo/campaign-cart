/**
 * Cart Item List Enhancer
 * Displays individual cart items with product details, quantity, and actions
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import { TemplateRenderer, TemplateFormatters } from '@/shared/utils/TemplateRenderer';
import { DisplayFormatter } from '@/enhancers/display/DisplayEnhancerCore';
import type { CartState, CartItem } from '@/types/global';

export class CartItemListEnhancer extends BaseEnhancer {
  private template?: string;
  private emptyTemplate?: string;
  private titleMap?: Record<string, string>;
  private lastRenderedItems: string = '';  // Track last rendered state
  private groupItems: boolean = false;  // Group identical items together

  public async initialize(): Promise<void> {
    this.validateElement();

    // Get template from template ID, selector, data attribute or use original content
    const templateId = this.getAttribute('data-item-template-id');
    const templateSelector = this.getAttribute('data-item-template-selector');
    
    if (templateId) {
      const templateElement = document.getElementById(templateId);
      this.template = templateElement?.innerHTML.trim() ?? '';
    } else if (templateSelector) {
      const templateElement = document.querySelector(templateSelector);
      this.template = templateElement?.innerHTML.trim() ?? '';
    } else {
      this.template = this.getAttribute('data-item-template') || this.element.innerHTML.trim();
    }
    
    // If template is empty or just comments, use default template
    if (!this.template || this.template.replace(/<!--[\s\S]*?-->/g, '').trim() === '') {
      this.template = this.getDefaultItemTemplate();
    }
    
    this.emptyTemplate = this.getAttribute('data-empty-template') ||
      '<div class="cart-empty">Your cart is empty</div>';

    // Load title mapping from data attribute
    const titleMapAttr = this.getAttribute('data-title-map');
    if (titleMapAttr) {
      try {
        this.titleMap = JSON.parse(titleMapAttr);
      } catch (error) {
        this.logger.warn('Invalid title map JSON:', error);
      }
    }

    // Check if items should be grouped
    this.groupItems = this.hasAttribute('data-group-items');

    // Subscribe to cart changes
    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));

    // Initial render
    this.handleCartUpdate(useCartStore.getState());

    this.logger.debug('CartItemListEnhancer initialized');
  }

  public update(data?: any): void {
    if (data) {
      this.handleCartUpdate(data);
    }
  }

  private async handleCartUpdate(cartState: CartState): Promise<void> {
    try {
      if (cartState.isEmpty || cartState.items.length === 0) {
        this.renderEmptyCart();
      } else {
        await this.renderCartItems(cartState.items);
      }
    } catch (error) {
      this.handleError(error, 'handleCartUpdate');
    }
  }

  private renderEmptyCart(): void {
    this.element.innerHTML = this.emptyTemplate || '';
    this.addClass('cart-empty');
    this.removeClass('cart-has-items');
  }

  private async renderCartItems(items: CartItem[]): Promise<void> {
    this.removeClass('cart-empty');
    this.addClass('cart-has-items');

    const itemsHTML: string[] = [];

    // Group items if enabled
    const itemsToRender = this.groupItems ? this.groupIdenticalItems(items) : items;

    for (const item of itemsToRender) {
      const itemHTML = this.renderCartItem(item);
      if (itemHTML) {
        itemsHTML.push(itemHTML);
      }
    }

    const newHTML = itemsHTML.join('');

    // Only update DOM if content actually changed
    if (newHTML !== this.lastRenderedItems) {
      this.element.innerHTML = newHTML;
      this.lastRenderedItems = newHTML;

      // Re-enhance any new elements
      await this.enhanceNewElements();
    } else {
      this.logger.debug('Cart items HTML unchanged, skipping DOM update');
    }
  }

  private renderCartItem(item: CartItem): string {
    try {
      const itemData = this.prepareCartItemData(item);
      console.log('Rendering cart item with data:', itemData);
      const template = this.template || this.getDefaultItemTemplate();
      const formatters: TemplateFormatters = {
        ...TemplateRenderer.createDefaultFormatters(),
        currency: (value: any) => DisplayFormatter.formatCurrency(value)
      };
      return TemplateRenderer.render(template, { data: { item: itemData }, formatters });
    } catch (error) {
      this.logger.error('Error rendering cart item:', error);
      return '';
    }
  }

  private getDefaultItemTemplate(): string {
    return `
      <div class="cart-item" data-cart-item-id="{item.id}" data-package-id="{item.packageId}">
        <div class="cart-item-image">
          <img src="{item.image}" alt="{item.name}" onerror="this.style.display='none';">
          <span style="font-size: 1.5em;">📦</span>
        </div>
        <div class="cart-item-details">
          <h4 class="cart-item-name">{item.name}</h4>
          <div class="cart-item-variant" style="color: #666; font-size: 0.9em;">{item.variantAttributesFormatted}</div>
          <div class="cart-item-sku" style="color: #999; font-size: 0.85em;">SKU: {item.variantSku}</div>
          <div class="cart-item-pricing">
            <div class="original-price {item.showOriginalPrice}" style="text-decoration: line-through; color: #999;">{item.price} each</div>
            <div class="current-price">{item.finalPrice} each</div>
            <div class="discount-badge {item.showDiscount}" style="color: #e74c3c; font-weight: bold;">-{item.discountAmount} coupon discount</div>
            <div class="compare-price {item.showCompare}" style="text-decoration: line-through; color: #999;">{item.comparePrice}</div>
            <div class="savings {item.showSavings}" style="color: #0d7519; font-weight: bold;">Save {item.savingsAmount} ({item.savingsPct})</div>
            <div class="frequency">{item.frequency}</div>
            <div class="recurring-price {item.showRecurring}" style="color: #666;">Then {item.recurringPrice} recurring</div>
          </div>
        </div>
        <div class="quantity-controls">
          <button class="quantity-btn" data-next-quantity="decrease" data-package-id="{item.packageId}">-</button>
          <span class="quantity-display">{item.quantity}</span>
          <button class="quantity-btn" data-next-quantity="increase" data-package-id="{item.packageId}">+</button>
        </div>
        <div class="cart-item-total">
          <div class="line-total-original {item.showOriginalPrice}" style="text-decoration: line-through; color: #999; font-size: 0.9em;">{item.lineTotal}</div>
          <div class="line-total">{item.finalLineTotal}</div>
          <div class="line-compare {item.showCompare}" style="text-decoration: line-through; color: #999; font-size: 0.9em;">{item.lineCompare}</div>
        </div>
        <button class="remove-btn" data-next-remove-item data-package-id="{item.packageId}" data-confirm="true" data-confirm-message="Remove this item from your cart?">Remove</button>
      </div>
    `.trim();
  }

  private async enhanceNewElements(): Promise<void> {
    // Find and enhance any new quantity controls and remove buttons
    const quantityButtons = this.element.querySelectorAll('[data-next-quantity]');
    const removeButtons = this.element.querySelectorAll('[data-next-remove-item]');

    // Import and manually enhance the new elements
    if (quantityButtons.length > 0) {
      const { QuantityControlEnhancer } = await import('@/enhancers/cart/QuantityControlEnhancer');
      for (const button of Array.from(quantityButtons)) {
        if (button instanceof HTMLElement) {
          try {
            const enhancer = new QuantityControlEnhancer(button);
            await enhancer.initialize();
            this.logger.debug('Enhanced quantity control button', button);
          } catch (error) {
            this.logger.error('Failed to enhance quantity button:', error, button);
          }
        }
      }
    }

    if (removeButtons.length > 0) {
      const { RemoveItemEnhancer } = await import('@/enhancers/cart/RemoveItemEnhancer');
      for (const button of Array.from(removeButtons)) {
        if (button instanceof HTMLElement) {
          try {
            const enhancer = new RemoveItemEnhancer(button);
            await enhancer.initialize();
            this.logger.debug('Enhanced remove button', button);
          } catch (error) {
            this.logger.error('Failed to enhance remove button:', error, button);
          }
        }
      }
    }

    this.logger.debug(`Enhanced ${quantityButtons.length} quantity buttons and ${removeButtons.length} remove buttons`);
  }

  private prepareCartItemData(item: CartItem): any {
    // Parse API-provided price strings to raw numbers (no frontend calculations)
    const p = (s: string | undefined): number => parseFloat(s ?? '0') || 0;

    console.log('Preparing cart item data for item:', item);

    const packagePrice = item.price; // raw number (price_total)
    const packageQty = item.qty ?? 1;
    const unitPrice = p(item.price_per_unit);
    const retailPrice = p(item.price_retail);
    const retailPriceTotal = p(item.price_retail) * item.quantity;
    const hasSavings = (retailPriceTotal > 0 && retailPriceTotal > packagePrice) || p(item.total_discount) > 0;
    const retailLineTotal = retailPriceTotal * item.quantity;
    const lineTotalRaw = p(item.total) || packagePrice * item.quantity;

    // Discounts from API (unit_price_excl_discount = before discount, incl_discount = after discount)
    const discountAmountRaw = p(item.total_discount);
    const hasDiscount = discountAmountRaw > 0;
    const finalPriceRaw = p(item.package_price_incl_discount) || packagePrice;
    const finalLineTotalRaw = finalPriceRaw * item.quantity;
    const unitFinalPrice = p(item.unit_price_incl_discount) || unitPrice;

    // Recurring
    const hasRecurring = item.is_recurring ?? false;
    const recurringPriceRaw = p(item.price_recurring);
    const recurringTotalRaw = p(item.price_recurring_total);

    // Frequency text
    const frequencyText = hasRecurring
      ? (item.interval_count && item.interval_count > 1
          ? `Every ${item.interval_count} ${item.interval}s`
          : `Per ${item.interval}`)
      : 'One time';

    // Savings
    const savingsRaw = hasSavings ? retailLineTotal - lineTotalRaw : 0;
    const savingsPct = hasSavings && retailLineTotal > 0
      ? Math.round((savingsRaw / retailLineTotal) * 100)
      : 0;
    const unitSavings = hasSavings ? retailPrice - unitPrice : 0;
    const packageSavings = hasSavings ? retailPriceTotal - packagePrice : 0;

    // Custom title mapping
    const globalTitleMap = (window as any).nextConfig?.productTitleMap || {};
    const titleMap = this.titleMap || globalTitleMap;
    let customTitle = titleMap[item.packageId] || titleMap[String(item.packageId)];
    const titleTransform = (window as any).nextConfig?.productTitleTransform;
    if (!customTitle && typeof titleTransform === 'function') {
      try {
        customTitle = titleTransform(item.packageId, item.title);
      } catch (error) {
        this.logger.warn('Error in productTitleTransform:', error);
      }
    }

    const attrs = item.variantAttributes ?? [];

    return {
      // Basic item data
      id: item.id,
      packageId: item.packageId,
      title: customTitle || item.title,
      name: customTitle || item.title,
      quantity: item.quantity,

      // Product and variant information
      productId: item.productId,
      productName: item.productName ?? '',
      variantId: item.variantId,
      variantName: item.variantName ?? '',
      variantAttributes: attrs,
      variantSku: item.variantSku ?? '',

      // Formatted variant attributes for easy display
      variantAttributesFormatted: this.formatVariantAttributes(attrs),
      variantAttributesList: this.formatVariantAttributesList(attrs),

      // Individual variant attributes by code
      ...this.extractIndividualAttributes(attrs),

      // Pricing — raw numbers formatted by TemplateRenderer currency formatter
      price: packagePrice,
      unitPrice,
      lineTotal: lineTotalRaw,
      lineCompare: hasSavings ? retailLineTotal : 0,
      comparePrice: hasSavings ? retailPriceTotal : 0,
      unitComparePrice: hasSavings ? retailPrice : 0,
      recurringPrice: hasRecurring ? recurringPriceRaw : 0,
      savingsAmount: savingsRaw,
      unitSavings,

      // Discount fields (from API)
      discountAmount: discountAmountRaw,
      discountedPrice: finalPriceRaw,
      discountedLineTotal: finalLineTotalRaw,
      hasDiscount,
      finalPrice: hasDiscount ? finalPriceRaw : packagePrice,
      finalLineTotal: hasDiscount ? finalLineTotalRaw : lineTotalRaw,
      unitFinalPrice,

      // Package-level pricing
      packagePrice: unitPrice,
      packagePriceTotal: packagePrice,
      packageRetailPrice: retailPrice,
      packageRetailTotal: retailPriceTotal,
      packageSavings,
      recurringTotal: hasRecurring ? recurringTotalRaw : 0,

      // Calculated fields
      savingsPct: savingsPct > 0 ? `${savingsPct}%` : '',
      packageSavingsPct: savingsPct > 0 ? `${savingsPct}%` : '',
      packageQty,
      frequency: frequencyText,
      isRecurring: hasRecurring ? 'true' : 'false',
      hasSavings: savingsRaw > 0 ? 'true' : 'false',
      hasPackageSavings: packageSavings > 0 ? 'true' : 'false',

      // Product data
      image: item.image ?? '',
      sku: item.sku ?? item.variantSku ?? '',

      // Raw values (unformatted)
      'price.raw': packagePrice,
      'unitPrice.raw': unitPrice,
      'lineTotal.raw': lineTotalRaw,
      'lineCompare.raw': hasSavings ? retailLineTotal : 0,
      'comparePrice.raw': hasSavings ? retailPriceTotal : 0,
      'unitComparePrice.raw': hasSavings ? retailPrice : 0,
      'recurringPrice.raw': recurringPriceRaw,
      'savingsAmount.raw': savingsRaw,
      'unitSavings.raw': unitSavings,
      'packagePrice.raw': unitPrice,
      'packagePriceTotal.raw': packagePrice,
      'packageRetailPrice.raw': retailPrice,
      'packageRetailTotal.raw': retailPriceTotal,
      'packageSavings.raw': packageSavings,
      'recurringTotal.raw': recurringTotalRaw,
      'savingsPct.raw': savingsPct,
      'packageSavingsPct.raw': savingsPct,
      'discountAmount.raw': discountAmountRaw,
      'discountedPrice.raw': finalPriceRaw,
      'discountedLineTotal.raw': finalLineTotalRaw,
      'finalPrice.raw': hasDiscount ? finalPriceRaw : packagePrice,
      'finalLineTotal.raw': hasDiscount ? finalLineTotalRaw : lineTotalRaw,

      // Conditional display helpers
      showCompare: hasSavings ? 'show' : 'hide',
      showSavings: savingsRaw > 0 ? 'show' : 'hide',
      showUnitPrice: packageQty > 1 ? 'show' : 'hide',
      showUnitCompare: packageQty > 1 && hasSavings ? 'show' : 'hide',
      showUnitSavings: packageQty > 1 && unitSavings > 0 ? 'show' : 'hide',
      showRecurring: hasRecurring ? 'show' : 'hide',
      showPackageSavings: packageSavings > 0 ? 'show' : 'hide',
      showPackageTotal: packagePrice > 0 ? 'show' : 'hide',
      showRecurringTotal: hasRecurring && recurringTotalRaw > 0 ? 'show' : 'hide',
      showDiscount: hasDiscount ? 'show' : 'hide',
      showOriginalPrice: hasDiscount ? 'show' : 'hide',
    };
  }


  public getItemCount(): number {
    return this.element.querySelectorAll('[data-cart-item-id]').length;
  }

  public getItemElements(): NodeListOf<Element> {
    return this.element.querySelectorAll('[data-cart-item-id]');
  }

  public refreshItem(_packageId: number): void {
    const cartState = useCartStore.getState();
    this.handleCartUpdate(cartState);
  }

  /**
   * Group identical items together based on packageId
   * Combines quantities and preserves the first item's ID
   */
  private groupIdenticalItems(items: CartItem[]): CartItem[] {
    const grouped = new Map<number, CartItem>();

    for (const item of items) {
      const existing = grouped.get(item.packageId);
      if (existing) {
        // Combine quantities
        existing.quantity += item.quantity;
        // Keep track of individual item IDs for actions (optional)
        if (!existing.groupedItemIds) {
          existing.groupedItemIds = [existing.id];
        }
        existing.groupedItemIds.push(item.id);
      } else {
        // Clone item to avoid mutating original
        grouped.set(item.packageId, { ...item });
      }
    }

    return Array.from(grouped.values());
  }

  /**
   * Format variant attributes as a comma-separated string
   * Example: "Color: Obsidian Grey, Size: Twin"
   */
  private formatVariantAttributes(attributes: Array<{ code: string; name: string; value: string }>): string {
    if (!attributes || attributes.length === 0) return '';

    return attributes
      .map(attr => `${attr.name}: ${attr.value}`)
      .join(', ');
  }

  /**
   * Format variant attributes as an HTML list
   * Example: "<span>Color: Obsidian Grey</span> <span>Size: Twin</span>"
   */
  private formatVariantAttributesList(attributes: Array<{ code: string; name: string; value: string }>): string {
    if (!attributes || attributes.length === 0) return '';

    return attributes
      .map(attr => `<span class="variant-attr">${attr.name}: ${attr.value}</span>`)
      .join(' ');
  }

  /**
   * Extract individual variant attributes as separate properties
   * Returns an object with properties like:
   * - variantColor: "Obsidian Grey"
   * - variantSize: "Twin"
   * - variant.color: "Obsidian Grey"
   * - variant.size: "Twin"
   * - variantAttr.color: "Obsidian Grey"
   * - variantAttr.size: "Twin"
   */
  private extractIndividualAttributes(attributes: Array<{ code: string; name: string; value: string }>): Record<string, string> {
    const result: Record<string, string> = {};

    if (!attributes || attributes.length === 0) return result;

    attributes.forEach(attr => {
      // Convert code to camelCase for property name
      const camelCode = attr.code.charAt(0).toUpperCase() + attr.code.slice(1).toLowerCase();

      // Add multiple ways to access the attribute
      // 1. variantColor, variantSize, etc.
      result[`variant${camelCode}`] = attr.value;

      // 2. variant.color, variant.size (using dot notation in template)
      result[`variant.${attr.code.toLowerCase()}`] = attr.value;

      // 3. variantAttr.color, variantAttr.size (alternative naming)
      result[`variantAttr.${attr.code.toLowerCase()}`] = attr.value;

      // 4. Just the attribute code as-is for simple access
      result[`variant_${attr.code}`] = attr.value;
    });

    return result;
  }
}