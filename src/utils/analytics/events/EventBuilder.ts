/**
 * Event Builder
 * Base class for creating standardized analytics events
 */

import type { DataLayerEvent, UserProperties, EventContext, EventMetadata, EcommerceItem, ElevarProduct, ElevarImpression } from '../types';
import { useCampaignStore } from '@/stores/campaignStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { createLogger } from '@/utils/logger';

const logger = createLogger('EventBuilder');

// Define minimal types to avoid external dependencies
interface MinimalCartItem {
  id?: string | number;
  packageId?: string | number;
  package_id?: string | number;
  title?: string;
  name?: string;
  product_title?: string;
  price?: number | string | {
    excl_tax: { value: number; formatted: string };
    incl_tax: { value: number; formatted: string };
    original: { value: number; formatted: string };
    savings: { value: number; formatted: string };
    value?: number;
  };
  price_incl_tax?: number | string;
  price_retail?: number | string;
  quantity?: number;
  qty?: number;
  package_profile?: string;
  variant?: string;
  product?: {
    title?: string;
    image?: string;
    sku?: string;
  };
  image?: string;
  imageUrl?: string;
  image_url?: string;
  // Cart store fields
  productId?: string | number;
  productName?: string;
  variantId?: string | number;
  variantName?: string;
  variantSku?: string;
  sku?: string;
  [key: string]: any; // Allow additional properties
}

export class EventBuilder {
  /**
   * Create base event with standard properties
   */
  static createEvent(
    eventName: string,
    eventData: Partial<DataLayerEvent> = {}
  ): DataLayerEvent {
    const event: DataLayerEvent = {
      event: eventName,
      event_id: this.generateEventId(),
      event_time: new Date().toISOString(),
      user_properties: this.getUserProperties(),
      ...this.getEventContext(),
      ...eventData,
      _metadata: this.getEventMetadata()
    };

    return event;
  }

  /**
   * Generate unique event ID
   */
  private static generateEventId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get user properties from stores (Elevar format)
   */
  static getUserProperties(): UserProperties {
    const userProperties: UserProperties = {
      visitor_type: 'guest', // Default to guest for Elevar
    };

    // Try to get store states safely
    try {
      if (typeof window !== 'undefined') {
        // Access checkout store directly
        const checkoutState = useCheckoutStore.getState();

        // Add billing address info if available (Elevar format without address_ prefix)
        if (checkoutState.billingAddress) {
          const billing = checkoutState.billingAddress;
          userProperties.customer_first_name = billing.first_name;
          userProperties.customer_last_name = billing.last_name;
          userProperties.customer_city = billing.city; // No address_ prefix
          userProperties.customer_province = billing.province; // No address_ prefix
          userProperties.customer_province_code = billing.province;
          userProperties.customer_zip = billing.postal; // No address_ prefix
          userProperties.customer_country = billing.country; // No address_ prefix
          userProperties.customer_phone = billing.phone;

          // Add address lines for Elevar
          userProperties.customer_address_1 = billing.address1 || '';
          userProperties.customer_address_2 = billing.address2 || '';
        }

        // Add customer email if available from form data
        if (checkoutState.formData?.email) {
          userProperties.customer_email = checkoutState.formData.email;
        }

        // Add customer ID if available (from order or other sources)
        if (checkoutState.formData?.customerId) {
          userProperties.customer_id = String(checkoutState.formData.customerId);
          userProperties.visitor_type = 'logged_in'; // Elevar uses 'logged_in' not 'customer'
        }

        // Add customer metrics if available (convert to string for Elevar)
        if (checkoutState.formData?.orderCount !== undefined) {
          userProperties.customer_order_count = String(checkoutState.formData.orderCount);
        }
        if (checkoutState.formData?.totalSpent !== undefined) {
          userProperties.customer_total_spent = String(checkoutState.formData.totalSpent);
        }
        if (checkoutState.formData?.tags) {
          userProperties.customer_tags = String(checkoutState.formData.tags);
        }
      }
    } catch (error) {
      // Fallback to default properties if store access fails
      logger.warn('Could not access store state for user properties:', error);
    }

    return userProperties;
  }

  /**
   * Get event context (page info, session, etc.)
   */
  static getEventContext(): EventContext {
    const context: EventContext = {};

    if (typeof window !== 'undefined') {
      context.page_location = window.location.href;
      context.page_title = document.title;
      context.page_referrer = document.referrer;
      context.user_agent = navigator.userAgent;
      context.screen_resolution = `${window.screen.width}x${window.screen.height}`;
      context.viewport_size = `${window.innerWidth}x${window.innerHeight}`;
      context.session_id = this.getSessionId();
      context.timestamp = Date.now();
    }

    return context;
  }

  /**
   * Get event metadata
   */
  private static getEventMetadata(): EventMetadata {
    return {
      pushed_at: Date.now(),
      debug_mode: false, // Can be controlled via config
      session_id: this.getSessionId(),
      sequence_number: this.getNextSequenceNumber(),
      source: 'next-campaign-cart',
      // Replaced at build time with the package.json version (see __VERSION__
      // define in vite.config.ts); falls back to '0.2.0' when unset.
      version: __VERSION__
    };
  }

  /**
   * Get or create session ID
   */
  static getSessionId(): string {
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('analytics_session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem('analytics_session_id', sessionId);
      }
      return sessionId;
    }
    return `session_${Date.now()}`;
  }

  /**
   * Get next sequence number for event ordering
   */
  private static getNextSequenceNumber(): number {
    if (typeof window !== 'undefined') {
      const current = parseInt(sessionStorage.getItem('analytics_sequence') || '0', 10);
      const next = current + 1;
      sessionStorage.setItem('analytics_sequence', String(next));
      return next;
    }
    return 0;
  }

  /**
   * Sum a formatted item list to the cart's item revenue (Σ price × quantity).
   *
   * This is the correct GA4 `value` for cart-contents events (dl_user_data,
   * dl_view_cart, dl_begin_checkout, …): item revenue only, excluding shipping
   * and tax. Deriving it from the items — rather than the cart store `total`,
   * which includes shipping — keeps `value` reconciled with the items array and
   * matches GA4 semantics (shipping is reported separately on add_shipping_info
   * and purchase).
   */
  static sumItemsValue(items: EcommerceItem[]): number {
    const total = items.reduce((sum, item) => {
      const price =
        typeof item.price === 'number'
          ? item.price
          : parseFloat(String(item.price)) || 0;
      const quantity =
        typeof item.quantity === 'number'
          ? item.quantity
          : parseFloat(String(item.quantity)) || 0;
      return sum + price * quantity;
    }, 0);
    // Round to cents to avoid floating-point drift (e.g. 0.1 + 0.2).
    return Math.round(total * 100) / 100;
  }

  /**
   * Get currency from campaign store
   */
  static getCurrency(): string {
    try {
      if (typeof window !== 'undefined') {
        const campaignState = useCampaignStore.getState();
        return campaignState.currency ?? 'USD';
      }
    } catch (error) {
      logger.warn('Could not access campaign store for currency:', error);
    }
    return 'USD';
  }

  /**
   * Format cart item to ecommerce item
   */
  static formatEcommerceItem(
    item: MinimalCartItem,
    index?: number,
    list?: { id?: string; name?: string }
  ): EcommerceItem {
    const currency = this.getCurrency();
    let campaignName = 'Campaign';
    let imageUrl: string | undefined;

    try {
      if (typeof window !== 'undefined') {
        const campaignState = useCampaignStore.getState();
        const campaign = campaignState.data;

        if (campaign) {
          campaignName = campaign.name || 'Campaign';

          // Try to get image from campaign packages
          const packageId = item.packageId || item.package_id || item.id;
          if (packageId && campaign.packages) {
            const packageData = campaign.packages.find((p: any) =>
              p.ref_id === packageId || p.external_id === packageId
            );
            if (packageData?.image) {
              imageUrl = packageData.image;
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Could not access campaign store for item formatting:', error);
    }

    // Handle different item formats
    // Use product data instead of package data for consistent tracking
    let itemId: string = '';
    let itemName: string = '';
    let productId: string | undefined;
    let variantId: string | undefined;

    try {
      // Try to get product data from campaign store
      if (typeof window !== 'undefined') {
        const campaignState = useCampaignStore.getState();
        const campaign = campaignState.data;
        const packageId = item.packageId || item.package_id || item.id;

        if (packageId && campaign?.packages) {
          const packageData = campaign.packages.find((p: any) =>
            String(p.ref_id) === String(packageId) || String(p.external_id) === String(packageId)
          );

          if (packageData) {
            // Use product SKU as item_id (matches purchase event format)
            itemId = (packageData as any).product_sku || String(packageData.external_id);
            itemName = (packageData as any).product_name || packageData.name;
            productId = String((packageData as any).product_id || '');
            variantId = String((packageData as any).product_variant_id || '');
          } else {
            logger.warn(`Could not find package data for packageId: ${packageId}`, {
              packageId,
              availablePackages: campaign.packages.map((p: any) => ({ ref_id: p.ref_id, name: p.name }))
            });
          }
        }
      }
    } catch (error) {
      logger.warn('Could not access campaign store for product data:', error);
    }

    // Fallback if campaign store lookup failed or variables not set
    if (!itemId) {
      itemId = String(item.packageId || item.package_id || item.id);
    }
    if (!itemName) {
      itemName = item.product?.title ||
                item.title ||
                item.product_title ||
                item.name ||
                `Package ${itemId}`;
    }

    // Get image from various possible sources
    if (!imageUrl) {
      imageUrl = (item as any).image ||
                 (item as any).product?.image ||
                 (item as any).imageUrl ||
                 (item as any).image_url;
    }

    // Quantity = total product units across every package in this cart line.
    // `item.quantity` is the number of packages added; `qty` is the units per
    // package (e.g. 2 packages of a "3x Drone" pack => 6 units). The previous
    // implementation reported only `packageData.qty` and dropped the package
    // count entirely, so multi-package lines were undercounted.
    let unitsPerPackage = 1;
    try {
      if (typeof window !== 'undefined') {
        const campaignState = useCampaignStore.getState();
        const campaign = campaignState.data;
        const packageId = item.packageId || item.package_id || item.id;

        if (packageId && campaign?.packages) {
          const packageData = campaign.packages.find((p: any) =>
            String(p.ref_id) === String(packageId) || String(p.external_id) === String(packageId)
          );

          if (packageData?.qty) {
            unitsPerPackage = packageData.qty;
          }
        }
      }
    } catch (error) {
      logger.warn('Could not access campaign store for quantity:', error);
    }

    // Fall back to the units carried on the item when no package match was found.
    if (unitsPerPackage === 1 && typeof item.qty === 'number' && item.qty > 0) {
      unitsPerPackage = item.qty;
    }

    const packageCount =
      typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
    const quantity = unitsPerPackage * packageCount;

    // Price = final per-unit price for this line, AFTER offer/voucher discounts.
    // GA4 `price` is the price of a single unit, so price * quantity equals the
    // line's final total. The cart store writes the calculated, discount-aware
    // figures onto each item (`unit_price`, `package_price`, `total`); prefer
    // them over the catalog price so discounts are reflected. Per unit they are
    // interchangeable:
    //   unit_price === package_price / unitsPerPackage === total / quantity
    const toNum = (v: unknown): number => {
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
      if (typeof v === 'string') {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : 0;
      }
      return 0;
    };

    let price = 0;
    if (item.unit_price !== undefined && item.unit_price !== null && item.unit_price !== '') {
      price = toNum(item.unit_price);
    } else if (item.package_price !== undefined && item.package_price !== null && unitsPerPackage > 0) {
      price = toNum(item.package_price) / unitsPerPackage;
    } else if (item.total !== undefined && item.total !== null && quantity > 0) {
      price = toNum(item.total) / quantity;
    }

    // No calculated figures on the line (e.g. read before cart calculation, or a
    // plain product / impression) — fall back to the catalog per-unit price.
    if (price === 0) {
      try {
        if (typeof window !== 'undefined') {
          const campaign = useCampaignStore.getState().data;
          const packageId = item.packageId || item.package_id || item.id;

          if (packageId && campaign?.packages) {
            const packageData = campaign.packages.find((p: any) =>
              String(p.ref_id) === String(packageId) ||
              String(p.external_id) === String(packageId)
            );
            if (packageData?.price) {
              price = toNum(packageData.price); // catalog per-unit price
            }
          }
        }
      } catch (error) {
        logger.warn('Could not access campaign store for price:', error);
      }
    }

    // Last-resort fallbacks for non-cart item shapes.
    if (price === 0) {
      if (item.price_incl_tax) {
        price = toNum(item.price_incl_tax);
      } else if (item.price !== undefined && item.price !== null) {
        if (typeof item.price === 'object' && 'incl_tax' in item.price) {
          price = item.price.incl_tax?.value ?? 0;
        } else {
          price = toNum(item.price);
        }
      }
    }

    const ecommerceItem: EcommerceItem = {
      item_id: itemId,
      item_name: itemName,
      item_category: campaignName,
      price,
      quantity,
      currency,
    };

    // Add product_id and variant_id if available
    if (productId) {
      ecommerceItem.item_product_id = productId;
    }
    if (variantId) {
      ecommerceItem.item_variant_id = variantId;
    }

    // Add variant information - prefer product_variant_name over package_profile
    const variant = (item as any).product_variant_name ||
                   (item as any).product?.variant?.name ||
                   item.package_profile ||
                   item.variant;
    if (variant !== undefined) {
      ecommerceItem.item_variant = variant;
    }

    // Add brand information (using product name as brand)
    const brand = (item as any).product_name ||
                  (item as any).product?.name;
    if (brand) {
      ecommerceItem.item_brand = brand;
    }

    // Add SKU as a custom dimension (can be tracked in GTM)
    const sku = (item as any).product_sku ||
                (item as any).product?.variant?.sku ||
                (item as any).sku;
    if (sku) {
      ecommerceItem.item_sku = sku;
    }

    if (index !== undefined) {
      ecommerceItem.index = index;
    }

    // Add list attribution if provided
    if (list?.id) {
      ecommerceItem.item_list_id = list.id;
    }
    if (list?.name) {
      ecommerceItem.item_list_name = list.name;
    }

    // Add image URL if available
    if (imageUrl) {
      ecommerceItem.item_image = imageUrl;
    }

    return ecommerceItem;
  }

  /**
   * Get list attribution from sessionStorage
   */
  static getListAttribution(): { id?: string; name?: string } | undefined {
    if (typeof window !== 'undefined') {
      const listId = sessionStorage.getItem('analytics_list_id');
      const listName = sessionStorage.getItem('analytics_list_name');
      
      if (listId || listName) {
        const result: { id?: string; name?: string } = {};
        if (listId) result.id = listId;
        if (listName) result.name = listName;
        return result;
      }
    }
    return undefined;
  }

  /**
   * Set list attribution in sessionStorage
   */
  static setListAttribution(listId?: string, listName?: string): void {
    if (typeof window !== 'undefined') {
      if (listId) {
        sessionStorage.setItem('analytics_list_id', listId);
      }
      if (listName) {
        sessionStorage.setItem('analytics_list_name', listName);
      }
    }
  }

  /**
   * Clear list attribution
   */
  static clearListAttribution(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('analytics_list_id');
      sessionStorage.removeItem('analytics_list_name');
    }
  }

  /**
   * @deprecated Use formatEcommerceItem() instead for GA4 format
   * Format product for Elevar (matches their exact structure)
   * Kept for backward compatibility only
   */
  static formatElevarProduct(
    item: MinimalCartItem,
    index?: number
  ): ElevarProduct {
    const currency = this.getCurrency();
    let campaignName = 'Campaign';

    // Get campaign and package data
    let packageData: any = null;
    try {
      if (typeof window !== 'undefined') {
        const campaignStore = (window as any).campaignStore;
        if (campaignStore) {
          const campaign = campaignStore.getState().data;
          campaignName = campaign?.name || 'Campaign';

          // Find package data
          const packageId = item.packageId || item.package_id || item.id;
          if (packageId && campaign?.packages) {
            packageData = campaign.packages.find((p: any) =>
              String(p.ref_id) === String(packageId)
            );
          }
        }
      }
    } catch (error) {
      logger.warn('Could not access campaign store:', error);
    }

    // Get price value - handle various price formats
    let priceValue: number = 0;
    if (packageData?.price) {
      priceValue = typeof packageData.price === 'string' ? parseFloat(packageData.price) : packageData.price;
    } else if (item.price_incl_tax) {
      priceValue = typeof item.price_incl_tax === 'string' ? parseFloat(item.price_incl_tax) : item.price_incl_tax;
    } else if (item.price) {
      if (typeof item.price === 'object') {
        // Handle nested price structure
        if ('incl_tax' in item.price && item.price.incl_tax?.value) {
          priceValue = item.price.incl_tax.value;
        } else if ('excl_tax' in item.price && item.price.excl_tax?.value) {
          priceValue = item.price.excl_tax.value;
        } else if ('value' in item.price && typeof item.price.value === 'number') {
          priceValue = item.price.value;
        }
      } else {
        priceValue = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
      }
    }

    // Build Elevar product object with exact field names
    // Prioritize cart store fields (productName, variantSku, etc.) which are directly on the item
    const product: ElevarProduct = {
      // Use SKU as id (Elevar expects SKU here)
      id: item.variantSku ||
          item.sku ||
          item.product?.sku ||
          packageData?.product_sku ||
          `SKU-${item.packageId || item.id}`,

      name: item.productName ||
            item.product?.title ||
            packageData?.product_name ||
            item.title ||
            '',

      product_id: String(
        item.productId ||
        packageData?.product_id ||
        item.packageId ||
        ''
      ),

      variant_id: String(
        item.variantId ||
        packageData?.product_variant_id ||
        ''
      ),

      brand: item.productName ||
             packageData?.product_name ||
             campaignName,

      category: campaignName,

      variant: item.variantName ||
               packageData?.product_variant_name ||
               item.package_profile ||
               '',

      price: priceValue.toFixed(2), // Format as string with 2 decimals
      quantity: String(item.quantity || item.qty || 1)
    };

    // Add optional fields
    // Always add compare_at_price (use "0.0" if not available as per Elevar docs)
    let comparePrice = "0.0";
    if (item.price_retail) {
      comparePrice = String(item.price_retail);
    } else if (packageData?.price_retail) {
      comparePrice = String(packageData.price_retail);
    } else if (typeof item.price === 'object' && item.price && 'original' in item.price && item.price.original?.value) {
      comparePrice = String(item.price.original.value);
    }
    product.compare_at_price = comparePrice;

    // Handle image from various sources
    if (item.image ||
        packageData?.image ||
        item.product?.image) {
      product.image = item.image ||
                     packageData?.image ||
                     item.product?.image ||
                     '';
    }

    // Add position (1-based for Elevar)
    if (index !== undefined) {
      product.position = index + 1;
    }

    // Add URL if this is add to cart
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    product.url = currentUrl;

    // Add list if available
    const list = this.getListAttribution();
    if (list?.name || list?.id) {
      product.list = list.name || list.id;
    }

    return product;
  }

  /**
   * @deprecated Use formatEcommerceItem() instead for GA4 format
   * Format impression for Elevar (similar to product but for list views)
   * Kept for backward compatibility only
   */
  static formatElevarImpression(
    item: MinimalCartItem,
    index?: number,
    list?: string
  ): ElevarImpression {
    const product = this.formatElevarProduct(item, index);

    // Create impression from product, excluding quantity and url
    const impression: ElevarImpression = {
      id: product.id,
      name: product.name,
      price: product.price,
      brand: product.brand,
      category: product.category,
      variant: product.variant
    };

    // Add optional fields
    if (product.product_id) {
      impression.product_id = product.product_id;
    }
    if (product.variant_id) {
      impression.variant_id = product.variant_id;
    }
    if (product.image) {
      impression.image = product.image;
    }

    // Add list if provided
    if (list) {
      impression.list = list;
    } else if (product.list) {
      impression.list = product.list;
    }

    // Add position
    if (product.position) {
      impression.position = product.position;
    } else if (index !== undefined) {
      impression.position = index + 1;
    }

    return impression;
  }
}