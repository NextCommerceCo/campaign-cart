import { c as createLogger, u as useCheckoutStore, a as useCampaignStore, b as configStore, d as useAttributionStore, e as useCartStore, E as EventBus } from "./stores-ow46YhGU.js";
import { g as getCookie } from "./utils-BfE7Qi7b.js";
import { a as analyticsDebug } from "./debug-Mr2KqGdU.js";
createLogger("AnalyticsConfig");
const DEFAULT_DEBUG_CONFIG = {
  enabled: false,
  verbose: false,
  logEvents: true,
  logErrors: true,
  persistInLocalStorage: true
};
const DEFAULT_CONFIG = {
  debug: DEFAULT_DEBUG_CONFIG,
  providers: [],
  // transformFn: undefined, - omitted to avoid exactOptionalPropertyTypes issue
  enrichContext: true,
  sessionTimeout: 30 * 60 * 1e3,
  // 30 minutes
  eventValidation: true
};
const EVENT_VALIDATION_RULES = {
  // Required fields for all events
  required: ["event"],
  // Event-specific required fields (GA4 format)
  eventSpecific: {
    // GA4 dl_ events with flat structure
    dl_purchase: ["ecommerce.transaction_id", "ecommerce.value", "ecommerce.items"],
    dl_add_to_cart: ["ecommerce.items", "ecommerce.currency"],
    dl_remove_from_cart: ["ecommerce.items", "ecommerce.currency"],
    dl_view_item: ["ecommerce.items", "ecommerce.currency"],
    dl_view_item_list: ["ecommerce.items", "ecommerce.currency"],
    dl_view_search_results: ["ecommerce.items", "ecommerce.currency"],
    dl_select_item: ["ecommerce.items", "ecommerce.currency"],
    dl_begin_checkout: ["ecommerce.items", "ecommerce.currency"],
    dl_view_cart: ["ecommerce.items", "ecommerce.currency"],
    dl_add_payment_info: ["ecommerce.currency"],
    dl_add_shipping_info: ["ecommerce.currency"],
    dl_user_data: ["user_properties"],
    // ecommerce.items is optional for empty cart
    dl_sign_up: ["user_properties"],
    dl_login: ["user_properties"],
    dl_subscribe: ["user_properties", "lead_type"],
    dl_package_swapped: ["ecommerce.items_removed", "ecommerce.items_added"],
    dl_upsell_purchase: ["ecommerce.transaction_id", "ecommerce.value", "ecommerce.items"],
    // Standard GA4 events (kept for compatibility)
    purchase: ["ecommerce.value", "ecommerce.items"],
    add_to_cart: ["ecommerce.items"],
    remove_from_cart: ["ecommerce.items"],
    view_item: ["ecommerce.items"],
    view_item_list: ["ecommerce.items"],
    begin_checkout: ["ecommerce.items"],
    add_payment_info: ["ecommerce.value"],
    add_shipping_info: ["ecommerce.value"]
  },
  // Field type validations (Elevar format - most values are strings)
  fieldTypes: {
    "event": "string",
    "event_id": "string",
    "event_category": "string",
    "event_label": "string",
    "cart_total": "string",
    // Elevar uses strings for amounts
    "lead_type": "string",
    "pageType": "string",
    "ecommerce.currencyCode": "string",
    "ecommerce.currency": "string",
    "ecommerce.value": "number",
    // GA4 format
    "ecommerce.purchase.actionField.revenue": "string",
    // Elevar format
    "ecommerce.purchase.actionField.tax": "string",
    "ecommerce.purchase.actionField.shipping": "string",
    "ecommerce.purchase.actionField.sub_total": "string",
    "ecommerce.purchase.actionField.id": "string",
    "ecommerce.purchase.actionField.order_name": "string",
    "user_properties.visitor_type": "string",
    "user_properties.customer_id": "string",
    "user_properties.customer_order_count": "string",
    "user_properties.customer_total_spent": "string"
  }
};
const STORAGE_KEYS = {
  DEBUG_MODE: "nextDataLayer_debugMode",
  SESSION_ID: "nextDataLayer_sessionId",
  SESSION_START: "nextDataLayer_sessionStart",
  USER_PROPERTIES: "nextDataLayer_userProperties"
};
const logger$d = createLogger("PendingEventsHandler");
const STORAGE_KEY$1 = "next_v2_pending_events";
class PendingEventsHandler {
  constructor() {
  }
  static getInstance() {
    if (!PendingEventsHandler.instance) {
      PendingEventsHandler.instance = new PendingEventsHandler();
    }
    return PendingEventsHandler.instance;
  }
  /**
   * Queue an event to be fired after redirect
   */
  queueEvent(event) {
    try {
      const pending = this.getPendingEvents();
      const pendingEvent = {
        event,
        timestamp: Date.now(),
        id: `${event.event}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      pending.push(pendingEvent);
      sessionStorage.setItem(STORAGE_KEY$1, JSON.stringify(pending));
      logger$d.info(`Event queued for after redirect: ${event.event} (${pending.length} total queued)`);
    } catch (error) {
      logger$d.error("Failed to queue event:", error);
    }
  }
  /**
   * Get all pending events
   */
  getPendingEvents() {
    try {
      const data = sessionStorage.getItem(STORAGE_KEY$1);
      if (!data) return [];
      const events = JSON.parse(data);
      return Array.isArray(events) ? events : [];
    } catch (error) {
      logger$d.error("Failed to get pending events:", error);
      return [];
    }
  }
  /**
   * Process and fire all pending events
   * IMPORTANT: This should only be called AFTER dl_user_data has been fired on the current page
   */
  processPendingEvents() {
    const events = this.getPendingEvents();
    if (events.length === 0) {
      logger$d.debug("No pending analytics events to process");
      return;
    }
    logger$d.info(`Processing ${events.length} pending analytics events`);
    const filteredEvents = events.filter((e) => {
      if (e.event.event === "dl_user_data") {
        logger$d.warn("Skipping queued dl_user_data - current page should fire its own");
        return false;
      }
      return true;
    });
    const sortedEvents = [...filteredEvents].sort((a, b) => a.timestamp - b.timestamp);
    const processedIds = [];
    for (const pendingEvent of sortedEvents) {
      try {
        if (Date.now() - pendingEvent.timestamp > 5 * 60 * 1e3) {
          logger$d.warn("Skipping stale event:", pendingEvent.event.event);
          processedIds.push(pendingEvent.id);
          continue;
        }
        dataLayer.push(pendingEvent.event);
        processedIds.push(pendingEvent.id);
        logger$d.debug("Processed pending event:", pendingEvent.event.event);
      } catch (error) {
        logger$d.error("Failed to process pending event:", pendingEvent.event.event, error);
      }
    }
    const userDataEvents = events.filter((e) => e.event.event === "dl_user_data");
    processedIds.push(...userDataEvents.map((e) => e.id));
    if (processedIds.length > 0) {
      const remaining = events.filter((e) => !processedIds.includes(e.id));
      if (remaining.length === 0) {
        sessionStorage.removeItem(STORAGE_KEY$1);
      } else {
        sessionStorage.setItem(STORAGE_KEY$1, JSON.stringify(remaining));
      }
      logger$d.debug("Removed processed events:", processedIds.length);
    }
  }
  /**
   * Clear all pending events
   */
  clearPendingEvents() {
    try {
      sessionStorage.removeItem(STORAGE_KEY$1);
      logger$d.debug("Cleared all pending events");
    } catch (error) {
      logger$d.error("Failed to clear pending events:", error);
    }
  }
  /**
   * Reset the handler (called by NextAnalytics)
   */
  reset() {
    this.clearPendingEvents();
    logger$d.debug("PendingEventsHandler reset");
  }
  /**
   * Initialize the handler (called by NextAnalytics)
   */
  initialize() {
    logger$d.debug("PendingEventsHandler initialized");
  }
}
const pendingEventsHandler = PendingEventsHandler.getInstance();
const logger$c = createLogger("EventBuilder");
class EventBuilder {
  /**
   * Create base event with standard properties
   */
  static createEvent(eventName, eventData = {}) {
    const event = {
      event: eventName,
      event_id: this.generateEventId(),
      event_time: (/* @__PURE__ */ new Date()).toISOString(),
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
  static generateEventId() {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  /**
   * Get user properties from stores (Elevar format)
   */
  static getUserProperties() {
    const userProperties = {
      visitor_type: "guest"
      // Default to guest for Elevar
    };
    try {
      if (typeof window !== "undefined") {
        const checkoutState = useCheckoutStore.getState();
        if (checkoutState.billingAddress) {
          const billing = checkoutState.billingAddress;
          userProperties.customer_first_name = billing.first_name;
          userProperties.customer_last_name = billing.last_name;
          userProperties.customer_city = billing.city;
          userProperties.customer_province = billing.province;
          userProperties.customer_province_code = billing.province;
          userProperties.customer_zip = billing.postal;
          userProperties.customer_country = billing.country;
          userProperties.customer_phone = billing.phone;
          userProperties.customer_address_1 = billing.address1 || "";
          userProperties.customer_address_2 = billing.address2 || "";
        }
        if (checkoutState.formData?.email) {
          userProperties.customer_email = checkoutState.formData.email;
        }
        if (checkoutState.formData?.customerId) {
          userProperties.customer_id = String(
            checkoutState.formData.customerId
          );
          userProperties.visitor_type = "logged_in";
        }
        if (checkoutState.formData?.orderCount !== void 0) {
          userProperties.customer_order_count = String(
            checkoutState.formData.orderCount
          );
        }
        if (checkoutState.formData?.totalSpent !== void 0) {
          userProperties.customer_total_spent = String(
            checkoutState.formData.totalSpent
          );
        }
        if (checkoutState.formData?.tags) {
          userProperties.customer_tags = String(checkoutState.formData.tags);
        }
      }
    } catch (error) {
      logger$c.warn("Could not access store state for user properties:", error);
    }
    return userProperties;
  }
  /**
   * Get event context (page info, session, etc.)
   */
  static getEventContext() {
    const context = {};
    if (typeof window !== "undefined") {
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
   * campaign_* identifiers attached to every event (issue #473). Applied in
   * `DataLayerManager.enrichEvent` so events that bypass `createEvent`
   * (page_view, upsell, route change) get them too. Read fresh — campaign data
   * and the `ncsid` cookie load async; empty values omitted.
   */
  static getCampaignContext() {
    const ctx = {};
    if (typeof window === "undefined") return ctx;
    try {
      const campaign = useCampaignStore.getState().data;
      const config = configStore.getState();
      if (campaign?.name) ctx.campaign_name = campaign.name;
      if (config.apiKey) ctx.campaign_api_key = config.apiKey;
      if (campaign?.currency) ctx.campaign_currency = campaign.currency;
      if (campaign?.language) ctx.campaign_language = campaign.language;
      if (campaign?.id) ctx.campaign_id = String(campaign.id);
      const sessionId = getCookie("ncsid");
      if (sessionId) ctx.campaign_session_id = sessionId;
    } catch (error) {
      logger$c.warn("Could not build campaign context:", error);
    }
    return ctx;
  }
  /**
   * Get event metadata
   */
  static getEventMetadata() {
    return {
      pushed_at: Date.now(),
      debug_mode: false,
      // Can be controlled via config
      session_id: this.getSessionId(),
      sequence_number: this.getNextSequenceNumber(),
      source: "next-campaign-cart",
      // Replaced at build time with the package.json version (see __VERSION__
      // define in vite.config.ts); falls back to '0.2.0' when unset.
      version: "0.4.30"
    };
  }
  /**
   * Get or create session ID
   */
  static getSessionId() {
    if (typeof window !== "undefined") {
      let sessionId = sessionStorage.getItem("analytics_session_id");
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem("analytics_session_id", sessionId);
      }
      return sessionId;
    }
    return `session_${Date.now()}`;
  }
  /**
   * Get next sequence number for event ordering
   */
  static getNextSequenceNumber() {
    if (typeof window !== "undefined") {
      const current = parseInt(
        sessionStorage.getItem("analytics_sequence") || "0",
        10
      );
      const next = current + 1;
      sessionStorage.setItem("analytics_sequence", String(next));
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
  static sumItemsValue(items) {
    const total = items.reduce((sum, item) => {
      const price = typeof item.price === "number" ? item.price : parseFloat(String(item.price)) || 0;
      const quantity = typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity)) || 0;
      return sum + price * quantity;
    }, 0);
    return Math.round(total * 100) / 100;
  }
  /**
   * Get currency from campaign store
   */
  static getCurrency() {
    try {
      if (typeof window !== "undefined") {
        const campaignState = useCampaignStore.getState();
        return campaignState.currency ?? "USD";
      }
    } catch (error) {
      logger$c.warn("Could not access campaign store for currency:", error);
    }
    return "USD";
  }
  /**
   * Format cart item to ecommerce item
   */
  static formatEcommerceItem(item, index2, list) {
    const currency = this.getCurrency();
    let campaignName = "Campaign";
    let imageUrl;
    try {
      if (typeof window !== "undefined") {
        const campaignState = useCampaignStore.getState();
        const campaign = campaignState.data;
        if (campaign) {
          campaignName = campaign.name || "Campaign";
          const packageId = item.packageId || item.package_id || item.id;
          if (packageId && campaign.packages) {
            const packageData = campaign.packages.find(
              (p) => p.ref_id === packageId || p.external_id === packageId
            );
            if (packageData?.image) {
              imageUrl = packageData.image;
            }
          }
        }
      }
    } catch (error) {
      logger$c.warn(
        "Could not access campaign store for item formatting:",
        error
      );
    }
    let itemId = "";
    let itemName = "";
    let productId;
    let variantId;
    try {
      if (typeof window !== "undefined") {
        const campaignState = useCampaignStore.getState();
        const campaign = campaignState.data;
        const packageId = item.packageId || item.package_id || item.id;
        if (packageId && campaign?.packages) {
          const packageData = campaign.packages.find(
            (p) => String(p.ref_id) === String(packageId) || String(p.external_id) === String(packageId)
          );
          if (packageData) {
            itemId = packageData.product_sku || String(packageData.external_id);
            itemName = packageData.product_name || packageData.name;
            productId = String(packageData.product_id || "");
            variantId = String(packageData.product_variant_id || "");
          } else {
            logger$c.warn(
              `Could not find package data for packageId: ${packageId}`,
              {
                packageId,
                availablePackages: campaign.packages.map((p) => ({
                  ref_id: p.ref_id,
                  name: p.name
                }))
              }
            );
          }
        }
      }
    } catch (error) {
      logger$c.warn("Could not access campaign store for product data:", error);
    }
    if (!itemId) {
      itemId = String(item.packageId || item.package_id || item.id);
    }
    if (!itemName) {
      itemName = item.product?.title || item.title || item.product_title || item.name || `Package ${itemId}`;
    }
    if (!imageUrl) {
      imageUrl = item.image || item.product?.image || item.imageUrl || item.image_url;
    }
    let unitsPerPackage = 1;
    try {
      if (typeof window !== "undefined") {
        const campaignState = useCampaignStore.getState();
        const campaign = campaignState.data;
        const packageId = item.packageId || item.package_id || item.id;
        if (packageId && campaign?.packages) {
          const packageData = campaign.packages.find(
            (p) => String(p.ref_id) === String(packageId) || String(p.external_id) === String(packageId)
          );
          if (packageData?.qty) {
            unitsPerPackage = packageData.qty;
          }
        }
      }
    } catch (error) {
      logger$c.warn("Could not access campaign store for quantity:", error);
    }
    if (unitsPerPackage === 1 && typeof item.qty === "number" && item.qty > 0) {
      unitsPerPackage = item.qty;
    }
    const packageCount = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
    const quantity = unitsPerPackage * packageCount;
    const toNum = (v) => {
      if (typeof v === "number") return Number.isFinite(v) ? v : 0;
      if (typeof v === "string") {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : 0;
      }
      return 0;
    };
    let price = 0;
    if (item.unit_price !== void 0 && item.unit_price !== null && item.unit_price !== "") {
      price = toNum(item.unit_price);
    } else if (item.package_price !== void 0 && item.package_price !== null && unitsPerPackage > 0) {
      price = toNum(item.package_price) / unitsPerPackage;
    } else if (item.total !== void 0 && item.total !== null && quantity > 0) {
      price = toNum(item.total) / quantity;
    }
    if (price === 0) {
      try {
        if (typeof window !== "undefined") {
          const campaign = useCampaignStore.getState().data;
          const packageId = item.packageId || item.package_id || item.id;
          if (packageId && campaign?.packages) {
            const packageData = campaign.packages.find(
              (p) => String(p.ref_id) === String(packageId) || String(p.external_id) === String(packageId)
            );
            if (packageData?.price) {
              price = toNum(packageData.price);
            }
          }
        }
      } catch (error) {
        logger$c.warn("Could not access campaign store for price:", error);
      }
    }
    if (price === 0) {
      if (item.price_incl_tax) {
        price = toNum(item.price_incl_tax);
      } else if (item.price !== void 0 && item.price !== null) {
        if (typeof item.price === "object" && "incl_tax" in item.price) {
          price = item.price.incl_tax?.value ?? 0;
        } else {
          price = toNum(item.price);
        }
      }
    }
    const ecommerceItem = {
      item_id: itemId,
      item_name: itemName,
      item_category: campaignName,
      price,
      quantity,
      currency
    };
    let priceBeforeDiscount = toNum(item.original_unit_price) || toNum(item.price_retail);
    if (priceBeforeDiscount === 0) {
      try {
        if (typeof window !== "undefined") {
          const campaign = useCampaignStore.getState().data;
          const packageId = item.packageId || item.package_id || item.id;
          if (packageId && campaign?.packages) {
            const packageData = campaign.packages.find(
              (p) => String(p.ref_id) === String(packageId) || String(p.external_id) === String(packageId)
            );
            if (packageData?.price_retail) {
              priceBeforeDiscount = toNum(packageData.price_retail);
            }
          }
        }
      } catch (error) {
        logger$c.warn("Could not access campaign store for retail price:", error);
      }
    }
    if (priceBeforeDiscount > price) {
      ecommerceItem.discount = Math.round((priceBeforeDiscount - price) * 100) / 100;
    }
    if (productId) {
      ecommerceItem.item_product_id = productId;
    }
    if (variantId) {
      ecommerceItem.item_variant_id = variantId;
    }
    const variant = item.product_variant_name || item.product?.variant?.name || item.package_profile || item.variant;
    if (variant !== void 0) {
      ecommerceItem.item_variant = variant;
    }
    const brand = item.product_name || item.product?.name;
    if (brand) {
      ecommerceItem.item_brand = brand;
    }
    const sku = item.product_sku || item.product?.variant?.sku || item.sku;
    if (sku) {
      ecommerceItem.item_sku = sku;
    }
    if (index2 !== void 0) {
      ecommerceItem.index = index2;
    }
    if (list?.id) {
      ecommerceItem.item_list_id = list.id;
    }
    if (list?.name) {
      ecommerceItem.item_list_name = list.name;
    }
    if (imageUrl) {
      ecommerceItem.item_image = imageUrl;
    }
    return ecommerceItem;
  }
  /**
   * Get list attribution from sessionStorage
   */
  static getListAttribution() {
    if (typeof window !== "undefined") {
      const listId = sessionStorage.getItem("analytics_list_id");
      const listName = sessionStorage.getItem("analytics_list_name");
      if (listId || listName) {
        const result = {};
        if (listId) result.id = listId;
        if (listName) result.name = listName;
        return result;
      }
    }
    return void 0;
  }
  /**
   * Set list attribution in sessionStorage
   */
  static setListAttribution(listId, listName) {
    if (typeof window !== "undefined") {
      if (listId) {
        sessionStorage.setItem("analytics_list_id", listId);
      }
      if (listName) {
        sessionStorage.setItem("analytics_list_name", listName);
      }
    }
  }
  /**
   * Clear list attribution
   */
  static clearListAttribution() {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("analytics_list_id");
      sessionStorage.removeItem("analytics_list_name");
    }
  }
  /**
   * @deprecated Use formatEcommerceItem() instead for GA4 format
   * Format product for Elevar (matches their exact structure)
   * Kept for backward compatibility only
   */
  static formatElevarProduct(item, index2) {
    this.getCurrency();
    let campaignName = "Campaign";
    let packageData = null;
    try {
      if (typeof window !== "undefined") {
        const campaignStore = window.campaignStore;
        if (campaignStore) {
          const campaign = campaignStore.getState().data;
          campaignName = campaign?.name || "Campaign";
          const packageId = item.packageId || item.package_id || item.id;
          if (packageId && campaign?.packages) {
            packageData = campaign.packages.find(
              (p) => String(p.ref_id) === String(packageId)
            );
          }
        }
      }
    } catch (error) {
      logger$c.warn("Could not access campaign store:", error);
    }
    let priceValue = 0;
    if (packageData?.price) {
      priceValue = typeof packageData.price === "string" ? parseFloat(packageData.price) : packageData.price;
    } else if (item.price_incl_tax) {
      priceValue = typeof item.price_incl_tax === "string" ? parseFloat(item.price_incl_tax) : item.price_incl_tax;
    } else if (item.price) {
      if (typeof item.price === "object") {
        if ("incl_tax" in item.price && item.price.incl_tax?.value) {
          priceValue = item.price.incl_tax.value;
        } else if ("excl_tax" in item.price && item.price.excl_tax?.value) {
          priceValue = item.price.excl_tax.value;
        } else if ("value" in item.price && typeof item.price.value === "number") {
          priceValue = item.price.value;
        }
      } else {
        priceValue = typeof item.price === "string" ? parseFloat(item.price) : item.price;
      }
    }
    const product = {
      // Use SKU as id (Elevar expects SKU here)
      id: item.variantSku || item.sku || item.product?.sku || packageData?.product_sku || `SKU-${item.packageId || item.id}`,
      name: item.productName || item.product?.title || packageData?.product_name || item.title || "",
      product_id: String(
        item.productId || packageData?.product_id || item.packageId || ""
      ),
      variant_id: String(
        item.variantId || packageData?.product_variant_id || ""
      ),
      brand: item.productName || packageData?.product_name || campaignName,
      category: campaignName,
      variant: item.variantName || packageData?.product_variant_name || item.package_profile || "",
      price: priceValue.toFixed(2),
      // Format as string with 2 decimals
      quantity: String(item.quantity || item.qty || 1)
    };
    let comparePrice = "0.0";
    if (item.price_retail) {
      comparePrice = String(item.price_retail);
    } else if (packageData?.price_retail) {
      comparePrice = String(packageData.price_retail);
    } else if (typeof item.price === "object" && item.price && "original" in item.price && item.price.original?.value) {
      comparePrice = String(item.price.original.value);
    }
    product.compare_at_price = comparePrice;
    if (item.image || packageData?.image || item.product?.image) {
      product.image = item.image || packageData?.image || item.product?.image || "";
    }
    if (index2 !== void 0) {
      product.position = index2 + 1;
    }
    const currentUrl = typeof window !== "undefined" ? window.location.href : "";
    product.url = currentUrl;
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
  static formatElevarImpression(item, index2, list) {
    const product = this.formatElevarProduct(item, index2);
    const impression = {
      id: product.id,
      name: product.name,
      price: product.price,
      brand: product.brand,
      category: product.category,
      variant: product.variant
    };
    if (product.product_id) {
      impression.product_id = product.product_id;
    }
    if (product.variant_id) {
      impression.variant_id = product.variant_id;
    }
    if (product.image) {
      impression.image = product.image;
    }
    if (list) {
      impression.list = list;
    } else if (product.list) {
      impression.list = product.list;
    }
    if (product.position) {
      impression.position = product.position;
    } else if (index2 !== void 0) {
      impression.position = index2 + 1;
    }
    return impression;
  }
}
const logger$b = createLogger("NextDataLayer");
class DataLayerManager {
  constructor(config) {
    this.sequenceNumber = 0;
    this.debugMode = false;
    this.context = {};
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDataLayer();
    this.sessionId = this.getOrCreateSessionId();
    this.loadDebugMode();
    this.enrichContext();
  }
  /**
   * Get current context
   */
  getContext() {
    return this.context;
  }
  /**
   * Get singleton instance
   */
  static getInstance(config) {
    if (!DataLayerManager.instance) {
      DataLayerManager.instance = new DataLayerManager(config);
    }
    return DataLayerManager.instance;
  }
  /**
   * Initialize window.NextDataLayer array
   */
  initializeDataLayer() {
    if (typeof window === "undefined") return;
    if (!window.NextDataLayer) {
      window.NextDataLayer = [];
    }
    if (this.config.transformFn) {
      window.NextDataLayerTransformFn = this.config.transformFn;
    }
  }
  /**
   * Push event to data layer with validation
   */
  push(event) {
    try {
      if (this.config.eventValidation && !this.validateEvent(event)) {
        return;
      }
      const enrichedEvent = this.enrichEvent(event);
      let finalEvent = enrichedEvent;
      if (window.NextDataLayerTransformFn) {
        const transformed = window.NextDataLayerTransformFn(enrichedEvent);
        if (!transformed) {
          this.debug("Event filtered out by transform function", event);
          return;
        }
        finalEvent = transformed;
      }
      const willRedirect = finalEvent._willRedirect;
      this.debug(`Event ${finalEvent.event} has _willRedirect flag:`, willRedirect);
      delete finalEvent._willRedirect;
      if (willRedirect) {
        pendingEventsHandler.queueEvent(finalEvent);
        this.debug(`Event queued for after redirect: ${finalEvent.event}`, finalEvent);
        return;
      }
      window.NextDataLayer.push(finalEvent);
      this.debug("Event pushed to data layer", finalEvent);
      this.notifyProviders(finalEvent);
    } catch (error) {
      this.error("Error pushing event to data layer", error, event);
    }
  }
  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled, options) {
    this.debugMode = enabled;
    if (this.config.debug) {
      this.config.debug = { ...this.config.debug, enabled, ...options };
    }
    if (this.config.debug?.persistInLocalStorage) {
      try {
        localStorage.setItem(STORAGE_KEYS.DEBUG_MODE, JSON.stringify({ enabled, options }));
      } catch (e) {
        logger$b.error("Failed to persist debug mode", e);
      }
    }
    this.debug(`Debug mode ${enabled ? "enabled" : "disabled"}`);
  }
  /**
   * Get current debug mode status
   */
  isDebugMode() {
    return this.debugMode;
  }
  /**
   * Invalidate context (for route changes)
   */
  invalidateContext() {
    this.context = {};
    this.enrichContext();
    this.debug("Context invalidated and re-enriched");
  }
  /**
   * Update user properties
   */
  setUserProperties(properties) {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PROPERTIES, JSON.stringify(properties));
      this.debug("User properties updated", properties);
    } catch (e) {
      this.error("Failed to save user properties", e);
    }
  }
  /**
   * Get stored user properties
   */
  getUserProperties() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER_PROPERTIES);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      this.error("Failed to load user properties", e);
      return null;
    }
  }
  /**
   * Clear all data
   */
  clear() {
    window.NextDataLayer = [];
    this.sequenceNumber = 0;
    this.context = {};
    this.enrichContext();
    this.debug("Data layer cleared");
  }
  /**
   * Validate event structure
   */
  validateEvent(event) {
    for (const field of EVENT_VALIDATION_RULES.required) {
      if (!this.getNestedValue(event, field)) {
        this.error(`Missing required field: ${field}`, null, event);
        return false;
      }
    }
    const eventRules = EVENT_VALIDATION_RULES.eventSpecific[event.event];
    if (eventRules) {
      for (const field of eventRules) {
        if (!this.getNestedValue(event, field)) {
          this.error(`Missing required field for ${event.event}: ${field}`, null, event);
          return false;
        }
      }
    }
    for (const [field, expectedType] of Object.entries(EVENT_VALIDATION_RULES.fieldTypes)) {
      const value = this.getNestedValue(event, field);
      if (value !== void 0 && typeof value !== expectedType) {
        this.error(`Invalid type for field ${field}: expected ${expectedType}, got ${typeof value}`, null, event);
        return false;
      }
    }
    return true;
  }
  /**
   * Enrich event with metadata and context
   */
  enrichEvent(event) {
    const metadata = {
      pushed_at: Date.now(),
      session_id: this.sessionId,
      sequence_number: ++this.sequenceNumber,
      debug_mode: this.debugMode,
      source: "NextDataLayer",
      // Replaced at build time with the package.json version (__VERSION__ define).
      version: "0.4.30"
    };
    let attribution = {};
    try {
      const attributionStore = useAttributionStore.getState();
      const attributionData = attributionStore.getAttributionForApi();
      if (attributionData && Object.keys(attributionData).length > 0) {
        attribution = attributionData;
        this.debug("Attribution data added to event:", attribution);
      } else {
        this.debug("Attribution store exists but has no data yet");
      }
    } catch (error) {
      this.debug("Could not get attribution data:", error);
    }
    const enrichedEvent = {
      ...event,
      _metadata: metadata
    };
    if (attribution && Object.keys(attribution).length > 0) {
      enrichedEvent.attribution = attribution;
    }
    const campaignContext = EventBuilder.getCampaignContext();
    for (const [key, value] of Object.entries(campaignContext)) {
      if (enrichedEvent[key] === void 0) {
        enrichedEvent[key] = value;
      }
    }
    if (this.config.enrichContext) {
      enrichedEvent.event_time = enrichedEvent.event_time || (/* @__PURE__ */ new Date()).toISOString();
      enrichedEvent.event_id = enrichedEvent.event_id || this.generateEventId();
      const storedUserProperties = this.getUserProperties();
      if (storedUserProperties) {
        enrichedEvent.user_properties = {
          ...storedUserProperties,
          ...enrichedEvent.user_properties
        };
      }
    }
    return enrichedEvent;
  }
  /**
   * Enrich context information
   */
  enrichContext() {
    if (typeof window === "undefined") return;
    this.context = {
      page_location: window.location.href,
      page_title: document.title,
      page_referrer: document.referrer,
      user_agent: navigator.userAgent,
      screen_resolution: `${screen.width}x${screen.height}`,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`,
      session_id: this.sessionId,
      timestamp: Date.now()
    };
  }
  /**
   * Get or create session ID
   */
  getOrCreateSessionId() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
      const sessionStart = localStorage.getItem(STORAGE_KEYS.SESSION_START);
      const now = Date.now();
      const sessionTimeout = this.config.sessionTimeout || 30 * 60 * 1e3;
      if (stored && sessionStart && now - parseInt(sessionStart) < sessionTimeout) {
        localStorage.setItem(STORAGE_KEYS.SESSION_START, now.toString());
        return stored;
      }
      const newSessionId = this.generateSessionId();
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, newSessionId);
      localStorage.setItem(STORAGE_KEYS.SESSION_START, now.toString());
      return newSessionId;
    } catch (e) {
      return this.generateSessionId();
    }
  }
  /**
   * Load debug mode from localStorage
   */
  loadDebugMode() {
    if (!this.config.debug?.persistInLocalStorage) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DEBUG_MODE);
      if (stored) {
        const { enabled, options } = JSON.parse(stored);
        this.debugMode = enabled;
        if (options && this.config.debug) {
          this.config.debug = { ...this.config.debug, ...options };
        }
      }
    } catch (e) {
    }
  }
  /**
   * Notify analytics providers
   */
  notifyProviders(event) {
    if (!this.config.providers) return;
    for (const provider of this.config.providers) {
      try {
        if (typeof provider.isEnabled === "function") {
          if (provider.isEnabled() && provider.trackEvent) {
            provider.trackEvent(event);
          }
        } else if (provider.enabled !== false && provider.trackEvent) {
          provider.trackEvent(event);
        }
      } catch (error) {
        this.error(`Error in provider ${provider.name || "unknown"}`, error, event);
      }
    }
  }
  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `${this.sessionId}_${this.sequenceNumber}_${Date.now()}`;
  }
  /**
   * Generate session ID
   */
  generateSessionId() {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
  /**
   * Get nested value from object
   */
  getNestedValue(obj, path) {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }
  /**
   * Debug logging
   */
  debug(message, data) {
    if (!this.debugMode || !this.config.debug?.logEvents) return;
    if (this.config.debug?.verbose && data) {
      logger$b.debug(message, data);
    } else {
      logger$b.debug(message);
    }
  }
  /**
   * Error logging
   */
  error(message, error, data) {
    if (!this.config.debug?.logErrors) return;
    logger$b.error(message, { error, data });
  }
  /**
   * Initialize the data layer (called by tracking components)
   */
  initialize() {
    this.initializeDataLayer();
    this.debug("Data layer initialized");
  }
  /**
   * Add a provider to receive events
   */
  addProvider(provider) {
    if (!this.config.providers) {
      this.config.providers = [];
    }
    this.config.providers.push(provider);
    this.debug(`Provider ${provider.name || "unknown"} added`);
  }
  /**
   * Set transform function
   */
  setTransformFunction(fn) {
    window.NextDataLayerTransformFn = fn;
    this.debug("Transform function set");
  }
  /**
   * Get event count for statistics
   */
  getEventCount() {
    return window.NextDataLayer?.length || 0;
  }
  /**
   * Format an ecommerce event
   */
  formatEcommerceEvent(eventName, data) {
    return {
      event: eventName,
      event_time: (/* @__PURE__ */ new Date()).toISOString(),
      data: data.data || data,
      ecommerce: data.ecommerce || data
    };
  }
  /**
   * Format a user data event
   */
  formatUserDataEvent(userData) {
    return {
      event: "dl_user_data",
      event_time: (/* @__PURE__ */ new Date()).toISOString(),
      user_properties: userData.user_properties || userData,
      cart_total: userData.cart_total,
      ecommerce: userData.ecommerce
    };
  }
}
const dataLayer = DataLayerManager.getInstance();
const SKIP_TAG = "__analyticsSkip";
function notSupported(reason = "event not handled by this provider") {
  return { [SKIP_TAG]: true, reason };
}
function asSkipResult(result) {
  return typeof result === "object" && result !== null && result[SKIP_TAG] === true ? result : null;
}
class DispatchError extends Error {
  constructor(message, attemptedPayload) {
    super(message);
    this.attemptedPayload = attemptedPayload;
    this.name = "DispatchError";
  }
}
class ProviderAdapter {
  constructor(name, options = {}) {
    this.enabled = true;
    this.name = name;
    this.blockedEvents = options.blockedEvents ?? [];
    this.logger = createLogger(name);
    analyticsDebug.registerProvider(this);
  }
  /**
   * Enable or disable the adapter. A disabled adapter drops every event.
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  /**
   * Check if the adapter is enabled.
   */
  isEnabled() {
    return this.enabled;
  }
  /**
   * Optional async setup hook. Override in adapters that must load an external
   * script or resolve configuration before they can deliver events. The default
   * is a no-op.
   */
  initialize(_config) {
    return Promise.resolve();
  }
  /**
   * Whether a given event should reach this provider — enabled and not in
   * {@link blockedEvents}. Override to add provider-specific routing rules.
   */
  shouldTrack(event) {
    return this.enabled && !this.blockedEvents.includes(event.event);
  }
  /**
   * Entry point called by the DataLayerManager. Applies the enabled/blocked
   * gate, delegates to {@link sendEvent}, and reports the outcome
   * (`blocked` / `pending` → `sent` / `failed`) to {@link analyticsDebug} so the
   * Provider Delivery panel can show what each provider did. Captures both
   * synchronous throws and rejected promises so one provider can never break
   * the dispatch loop.
   */
  trackEvent(event) {
    if (!this.enabled) {
      analyticsDebug.record(this.name, event.event, "blocked", {
        eventId: event.event_id,
        detail: "provider disabled",
        payload: event
      });
      return;
    }
    if (this.blockedEvents.includes(event.event)) {
      this.logger.debug(`Event "${event.event}" is blocked for ${this.name}`);
      analyticsDebug.record(this.name, event.event, "blocked", {
        eventId: event.event_id,
        detail: "blockedEvents",
        payload: event
      });
      return;
    }
    const recordId = analyticsDebug.record(this.name, event.event, "pending", {
      eventId: event.event_id,
      payload: event
    });
    const resolve = (result) => {
      const skip = asSkipResult(result);
      if (skip) {
        analyticsDebug.update(recordId, "skipped", { detail: skip.reason });
      } else {
        analyticsDebug.update(recordId, "sent", { sentPayload: result });
      }
    };
    const reject = (error) => {
      const isDispatch = error instanceof DispatchError;
      const attempted = isDispatch ? error.attemptedPayload : void 0;
      const message = error instanceof Error ? error.message : String(error);
      analyticsDebug.update(recordId, "failed", {
        error: message,
        ...attempted !== void 0 ? { sentPayload: attempted } : {}
      });
      if (isDispatch) {
        this.logger.warn(`Event "${event.event}" not delivered: ${message}`);
      } else {
        this.logger.error(`Failed to send event "${event.event}"`, error);
      }
    };
    try {
      const result = this.sendEvent(event);
      if (result instanceof Promise) {
        result.then(resolve).catch(reject);
      } else {
        resolve(result);
      }
    } catch (error) {
      reject(error);
    }
  }
  /**
   * Whether the provider can deliver events right now — e.g. its external
   * script has finished loading. Override in adapters that depend on a
   * third-party SDK. Surfaced as `ready` in the Provider Status panel.
   */
  isReady() {
    return true;
  }
  /**
   * Adapter-specific diagnostics surfaced in the Provider Status panel
   * (pixel id, endpoint, queued event count, …). Override to add fields.
   */
  getDebugDetails() {
    return {};
  }
  /**
   * Snapshot of this provider's configuration and readiness for the debug
   * overlay, combining {@link isReady} and {@link getDebugDetails}.
   */
  getDebugInfo() {
    return {
      name: this.name,
      enabled: this.enabled,
      ready: this.isReady(),
      blockedEvents: [...this.blockedEvents],
      details: this.getDebugDetails()
    };
  }
  /**
   * Transform event data to provider-specific format.
   * Default implementation flattens `data` onto the event; override as needed.
   */
  transformEvent(event) {
    return {
      event: event.event,
      ...event.data
    };
  }
  /**
   * Log debug information. Routed through the shared logger so output respects
   * the SDK's log levels and is stripped from production builds.
   *
   * @deprecated Prefer `this.logger.debug(...)` directly in new code.
   */
  debug(message, data) {
    this.logger.debug(message, data ?? "");
  }
  /**
   * Check if we're in a browser environment.
   */
  isBrowser() {
    return typeof window !== "undefined";
  }
  /**
   * Safe property access helper.
   */
  getNestedProperty(obj, path) {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }
  /**
   * Format currency values.
   */
  formatCurrency(value) {
    return value.toFixed(2);
  }
  /**
   * Extract common ecommerce properties.
   */
  extractEcommerceData(event) {
    const ecommerceData = event.ecommerce || event.data || {};
    return {
      currency: ecommerceData.currency || "USD",
      value: ecommerceData.value || ecommerceData.total || 0,
      items: ecommerceData.items || ecommerceData.products || [],
      transaction_id: ecommerceData.transaction_id || ecommerceData.order_id,
      coupon: ecommerceData.coupon || ecommerceData.discount_code,
      shipping: ecommerceData.shipping || 0,
      tax: ecommerceData.tax || 0
    };
  }
}
class GTMAdapter extends ProviderAdapter {
  constructor(config) {
    super("GTM", { blockedEvents: config?.blockedEvents });
  }
  isReady() {
    return this.isBrowser() && Array.isArray(window.dataLayer);
  }
  getDebugDetails() {
    return {
      dataLayer: this.isBrowser() && Array.isArray(window.dataLayer),
      elevarDataLayer: this.isBrowser() && Array.isArray(window.ElevarDataLayer)
    };
  }
  /**
   * Send event to Google Tag Manager
   */
  sendEvent(event) {
    if (!this.isBrowser()) {
      return void 0;
    }
    window.dataLayer = window.dataLayer || [];
    window.ElevarDataLayer = window.ElevarDataLayer || [];
    if (event.event.startsWith("dl_")) {
      window.ElevarDataLayer.push(event);
      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push(event);
      this.debug("Elevar event sent to both ElevarDataLayer and dataLayer", event);
      return event;
    }
    const gtmEvent = this.transformToGTMFormat(event);
    if (this.isEcommerceEvent(event.event)) {
      window.dataLayer.push({ ecommerce: null });
    }
    window.dataLayer.push(gtmEvent);
    this.debug("Event sent to GTM", gtmEvent);
    return gtmEvent;
  }
  /**
   * Transform event to GTM-specific format
   */
  transformToGTMFormat(event) {
    const baseEvent = {
      event: event.event,
      event_timestamp: event.timestamp,
      event_id: event.id
    };
    const attribution = event.attribution;
    if (this.isEcommerceEvent(event.event)) {
      const gtmEvent2 = {
        ...baseEvent,
        ecommerce: this.buildEcommerceObject(event)
      };
      if (attribution && Object.keys(attribution).length > 0) {
        gtmEvent2.attribution = attribution;
        if (attribution.utm_source) gtmEvent2.utm_source = attribution.utm_source;
        if (attribution.utm_medium) gtmEvent2.utm_medium = attribution.utm_medium;
        if (attribution.utm_campaign) gtmEvent2.utm_campaign = attribution.utm_campaign;
        if (attribution.funnel) gtmEvent2.funnel = attribution.funnel;
        if (attribution.affiliate) gtmEvent2.affiliate = attribution.affiliate;
        if (attribution.gclid) gtmEvent2.gclid = attribution.gclid;
      }
      return gtmEvent2;
    }
    const gtmEvent = {
      ...baseEvent,
      ...event.data
    };
    if (attribution && Object.keys(attribution).length > 0) {
      gtmEvent.attribution = attribution;
      if (attribution.utm_source) gtmEvent.utm_source = attribution.utm_source;
      if (attribution.utm_medium) gtmEvent.utm_medium = attribution.utm_medium;
      if (attribution.utm_campaign) gtmEvent.utm_campaign = attribution.utm_campaign;
      if (attribution.funnel) gtmEvent.funnel = attribution.funnel;
      if (attribution.affiliate) gtmEvent.affiliate = attribution.affiliate;
      if (attribution.gclid) gtmEvent.gclid = attribution.gclid;
    }
    return gtmEvent;
  }
  /**
   * Build ecommerce object structure for GTM
   *
   * Field selection follows the GA4 ecommerce reference
   * (https://developers.google.com/analytics/devguides/collection/ga4/ecommerce):
   * only the parameters GA4 defines for each event are emitted, so list and
   * promotion events don't carry an out-of-spec `value`.
   */
  buildEcommerceObject(event) {
    const ecommerceData = this.extractEcommerceData(event);
    const eventType = this.getEcommerceEventType(event.event);
    const data = event.data ?? {};
    const eco = event.ecommerce ?? {};
    const pick = (key) => eco[key] ?? data[key];
    const ecommerceObject = {
      currency: ecommerceData.currency
    };
    if (this.eventHasValue(eventType)) {
      ecommerceObject.value = parseFloat(this.formatCurrency(ecommerceData.value));
    }
    if (ecommerceData.items.length > 0) {
      ecommerceObject.items = this.formatItems(ecommerceData.items);
    }
    if (eventType === "purchase" || eventType === "refund") {
      ecommerceObject.transaction_id = ecommerceData.transaction_id;
      ecommerceObject.tax = ecommerceData.tax;
      ecommerceObject.shipping = ecommerceData.shipping;
      if (eventType === "purchase") {
        ecommerceObject.affiliation = data.affiliation || "Online Store";
        const customerType = pick("customer_type");
        if (customerType) ecommerceObject.customer_type = customerType;
      }
    }
    if (ecommerceData.coupon && this.eventAcceptsCoupon(eventType)) {
      ecommerceObject.coupon = ecommerceData.coupon;
    }
    if (eventType === "add_to_cart" && data.cart_id) {
      ecommerceObject.cart_id = data.cart_id;
    }
    if (eventType === "view_item_list" || eventType === "select_item") {
      const listId = pick("item_list_id");
      const listName = pick("item_list_name");
      if (listId) ecommerceObject.item_list_id = listId;
      if (listName) ecommerceObject.item_list_name = listName;
    }
    if (eventType === "view_promotion" || eventType === "select_promotion") {
      for (const key of [
        "creative_name",
        "creative_slot",
        "promotion_id",
        "promotion_name"
      ]) {
        const value = pick(key);
        if (value != null) ecommerceObject[key] = value;
      }
    }
    if (eventType === "add_shipping_info" && pick("shipping_tier")) {
      ecommerceObject.shipping_tier = pick("shipping_tier");
    }
    if (eventType === "add_payment_info" && pick("payment_type")) {
      ecommerceObject.payment_type = pick("payment_type");
    }
    return ecommerceObject;
  }
  /**
   * Whether GA4 defines a `value` (revenue) parameter for this event. List,
   * select and promotion events carry items but no event-level value.
   */
  eventHasValue(eventType) {
    return [
      "view_item",
      "add_to_cart",
      "add_to_wishlist",
      "remove_from_cart",
      "view_cart",
      "begin_checkout",
      "add_shipping_info",
      "add_payment_info",
      "purchase",
      "refund"
    ].includes(eventType);
  }
  /**
   * Whether GA4 accepts an order-level `coupon` on this event.
   */
  eventAcceptsCoupon(eventType) {
    return [
      "begin_checkout",
      "add_shipping_info",
      "add_payment_info",
      "purchase",
      "refund"
    ].includes(eventType);
  }
  /**
   * Format items array for GTM
   */
  formatItems(items) {
    return items.map((item, index2) => {
      const formatted = {
        item_id: item.item_id || item.id || item.product_id || item.sku,
        item_name: item.item_name || item.name || item.title,
        index: item.index ?? index2,
        price: parseFloat(this.formatCurrency(item.price || 0)),
        quantity: item.quantity || 1
      };
      const optional = {
        affiliation: item.affiliation,
        coupon: item.coupon,
        discount: item.discount,
        item_brand: item.item_brand || item.brand,
        item_category: item.item_category || item.category,
        item_category2: item.item_category2 || item.category2,
        item_category3: item.item_category3 || item.category3,
        item_category4: item.item_category4 || item.category4,
        item_category5: item.item_category5 || item.category5,
        item_list_id: item.item_list_id || item.list_id,
        item_list_name: item.item_list_name || item.list_name,
        item_variant: item.item_variant || item.variant,
        item_image: item.item_image || item.image || item.image_url || item.imageUrl,
        item_sku: item.item_sku || item.sku,
        location_id: item.location_id,
        // Item-level promotion attribution (view_promotion / select_promotion).
        promotion_id: item.promotion_id,
        promotion_name: item.promotion_name,
        creative_name: item.creative_name,
        creative_slot: item.creative_slot,
        // Google Ads / Merchant Center feed linkage.
        google_business_vertical: item.google_business_vertical
      };
      for (const [key, value] of Object.entries(optional)) {
        if (value !== void 0 && value !== null) {
          formatted[key] = value;
        }
      }
      return formatted;
    });
  }
  /**
   * Check if event is an ecommerce event
   */
  isEcommerceEvent(eventName) {
    const ecommerceEvents = [
      "dl_add_to_cart",
      "dl_add_to_wishlist",
      "dl_remove_from_cart",
      "dl_view_cart",
      "dl_begin_checkout",
      "dl_add_payment_info",
      "dl_add_shipping_info",
      "dl_purchase",
      "dl_refund",
      "dl_view_item",
      "dl_view_item_list",
      "dl_select_item",
      "dl_select_promotion",
      "dl_view_promotion",
      // Standard GA4 ecommerce events
      "add_to_cart",
      "add_to_wishlist",
      "remove_from_cart",
      "view_cart",
      "begin_checkout",
      "add_payment_info",
      "add_shipping_info",
      "purchase",
      "refund",
      "view_item",
      "view_item_list",
      "select_item",
      "select_promotion",
      "view_promotion"
    ];
    return ecommerceEvents.includes(eventName);
  }
  /**
   * Get standardized ecommerce event type
   */
  getEcommerceEventType(eventName) {
    return eventName.replace(/^dl_/, "");
  }
}
class FacebookAdapter extends ProviderAdapter {
  constructor(config) {
    super("Facebook", { blockedEvents: config?.blockedEvents });
    this.eventMapping = {
      // Data layer events to Facebook events
      "dl_user_data": "PageView",
      // User data acts as PageView
      "dl_page_view": "PageView",
      "dl_view_item": "ViewContent",
      "dl_add_to_cart": "AddToCart",
      "dl_remove_from_cart": "RemoveFromCart",
      "dl_begin_checkout": "InitiateCheckout",
      "dl_add_shipping_info": "AddShippingInfo",
      "dl_add_payment_info": "AddPaymentInfo",
      "dl_purchase": "Purchase",
      "dl_search": "Search",
      "dl_add_to_wishlist": "AddToWishlist",
      "dl_sign_up": "CompleteRegistration",
      "dl_login": "Login",
      "dl_subscribe": "Subscribe",
      "dl_start_trial": "StartTrial",
      "dl_view_cart": "ViewCart",
      // Upsell events - using custom events
      "dl_viewed_upsell": "ViewedUpsell",
      "dl_accepted_upsell": "AcceptedUpsell",
      "dl_skipped_upsell": "SkippedUpsell",
      // Standard event names
      "user_data": "PageView",
      "page_view": "PageView",
      "view_item": "ViewContent",
      "add_to_cart": "AddToCart",
      "remove_from_cart": "RemoveFromCart",
      "begin_checkout": "InitiateCheckout",
      "add_shipping_info": "AddShippingInfo",
      "add_payment_info": "AddPaymentInfo",
      "purchase": "Purchase",
      "search": "Search",
      "add_to_wishlist": "AddToWishlist",
      "sign_up": "CompleteRegistration",
      "login": "Login",
      "subscribe": "Subscribe",
      "start_trial": "StartTrial",
      "view_cart": "ViewCart"
    };
    this.customEvents = [
      "AddShippingInfo",
      // Not a standard Facebook event
      "RemoveFromCart",
      // Not a standard Facebook event
      "Login",
      // Not a standard Facebook event
      "Subscribe",
      // Not a standard Facebook event
      "StartTrial",
      // Not a standard Facebook event
      "ViewCart",
      // Not a standard Facebook event
      "ViewedUpsell",
      // Custom upsell event
      "AcceptedUpsell",
      // Custom upsell event
      "SkippedUpsell"
      // Custom upsell event
    ];
    this.loadWarned = false;
    if (config?.storeName) {
      this.storeName = config.storeName;
    }
  }
  /** Warn once, with the fix, when the Meta Pixel never loads. */
  warnScriptMissing() {
    if (this.loadWarned) return;
    this.loadWarned = true;
    this.logger.warn(
      "Meta Pixel (fbq) not found — add the Meta Pixel base code to the page so events can be delivered. See https://www.facebook.com/business/help/952192354843755"
    );
  }
  /**
   * Check if Facebook Pixel is loaded
   */
  isFbqLoaded() {
    return this.isBrowser() && typeof window.fbq === "function";
  }
  isReady() {
    return this.isFbqLoaded();
  }
  getDebugDetails() {
    return {
      fbqLoaded: this.isFbqLoaded(),
      storeName: this.storeName ?? "(none)"
    };
  }
  /**
   * Send event to Facebook Pixel.
   *
   * Returns the transformed fbq payload actually dispatched. When the pixel is
   * not loaded yet, returns the promise that resolves to that payload once it
   * loads — or rejects (recorded as `failed`) if the pixel never loads, e.g. a
   * missing/misconfigured pixel. Returning a resolved-but-empty value here would
   * wrongly show a green `sent` for a pixel that never fired.
   */
  sendEvent(event) {
    if (!this.isFbqLoaded()) {
      const fbEventName = this.mapEventName(event.event);
      if (!fbEventName) {
        return notSupported("no Facebook mapping for this event");
      }
      const prepared = {
        method: "fbq",
        event: fbEventName,
        parameters: this.transformParameters(event, fbEventName)
      };
      return this.waitForFbq().then(() => this.sendEventInternal(event)).catch(() => {
        this.warnScriptMissing();
        throw new DispatchError("Facebook Pixel load timeout", prepared);
      });
    }
    return this.sendEventInternal(event);
  }
  /**
   * Wait for Facebook Pixel to be loaded
   */
  async waitForFbq(timeout = 5e3) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (this.isFbqLoaded()) {
          clearInterval(checkInterval);
          resolve();
        } else if (Date.now() - start > timeout) {
          clearInterval(checkInterval);
          reject(new Error("Facebook Pixel load timeout"));
        }
      }, 100);
    });
  }
  /**
   * Internal method to send event after fbq is confirmed loaded
   */
  sendEventInternal(event) {
    const fbEventName = this.mapEventName(event.event);
    if (!fbEventName) {
      this.debug(`No Facebook mapping for event: ${event.event}`);
      return notSupported("no Facebook mapping for this event");
    }
    const parameters = this.transformParameters(event, fbEventName);
    try {
      if (window.fbq) {
        if (this.customEvents.includes(fbEventName)) {
          window.fbq("trackCustom", fbEventName, parameters);
          this.debug(`Custom event sent to Facebook: ${fbEventName}`, parameters);
        } else if (fbEventName === "Purchase" && this.storeName) {
          const orderIdentifier = parameters.order_number || parameters.order_id;
          if (orderIdentifier) {
            const eventId = `${this.storeName}-${orderIdentifier}`;
            window.fbq("track", fbEventName, parameters, { eventID: eventId });
            this.debug(`Event sent to Facebook: ${fbEventName} with eventID: ${eventId}`, parameters);
          } else {
            window.fbq("track", fbEventName, parameters);
            this.debug(`Event sent to Facebook: ${fbEventName} (no order identifier for eventID)`, parameters);
          }
        } else {
          window.fbq("track", fbEventName, parameters);
          this.debug(`Event sent to Facebook: ${fbEventName}`, parameters);
        }
      }
    } catch (error) {
      throw new DispatchError(
        `Facebook dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
        { method: "fbq", event: fbEventName, parameters }
      );
    }
    return { method: "fbq", event: fbEventName, parameters };
  }
  /**
   * Map data layer event name to Facebook event name
   */
  mapEventName(eventName) {
    return this.eventMapping[eventName] || null;
  }
  /**
   * Transform event parameters for Facebook Pixel
   */
  transformParameters(event, fbEventName) {
    if (event.data?.value) {
      parseFloat(this.formatCurrency(event.data.value));
    }
    switch (fbEventName) {
      case "ViewContent":
        return this.buildViewContentParams(event);
      case "AddToCart":
      case "RemoveFromCart":
        return this.buildAddToCartParams(event);
      case "InitiateCheckout":
        return this.buildCheckoutParams(event);
      case "AddShippingInfo":
        return this.buildShippingInfoParams(event);
      case "AddPaymentInfo":
        return this.buildPaymentInfoParams(event);
      case "Purchase":
        return this.buildPurchaseParams(event);
      case "Search":
        return this.buildSearchParams(event);
      case "CompleteRegistration":
        return this.buildRegistrationParams(event);
      case "ViewedUpsell":
      case "AcceptedUpsell":
      case "SkippedUpsell":
        return this.buildUpsellParams(event, fbEventName);
      default:
        return this.buildGenericParams(event);
    }
  }
  /**
   * Calculate total value from items array
   */
  calculateTotalValue(items) {
    return items.reduce((sum, item) => {
      const price = item.price || item.item_price || 0;
      const quantity = item.quantity || 1;
      return sum + price * quantity;
    }, 0);
  }
  /**
   * Build ViewContent parameters
   */
  buildViewContentParams(event) {
    const ecommerceData = this.extractEcommerceData(event);
    const items = ecommerceData.items || [];
    const params = {
      content_type: "product",
      currency: ecommerceData.currency || "USD",
      value: ecommerceData.value || this.calculateTotalValue(items)
    };
    if (items.length > 0) {
      params.content_ids = items.map(
        (item) => item.item_id || item.id || item.product_id || item.sku || item.external_id
      );
      params.contents = items.map((item) => ({
        id: item.item_id || item.id || item.product_id || item.sku || item.external_id,
        quantity: item.quantity || 1,
        item_price: item.price || item.item_price || 0
      }));
      params.content_name = items[0].item_name || items[0].name || items[0].title;
      params.content_category = items[0].item_category || items[0].category || "uncategorized";
    }
    return params;
  }
  /**
   * Build AddToCart/RemoveFromCart parameters
   */
  buildAddToCartParams(event) {
    const ecommerceData = this.extractEcommerceData(event);
    const items = ecommerceData.items || [];
    const params = {
      content_type: "product",
      currency: ecommerceData.currency || "USD",
      value: ecommerceData.value || this.calculateTotalValue(items)
    };
    if (items.length > 0) {
      params.content_ids = items.map(
        (item) => item.item_id || item.id || item.product_id || item.sku || item.external_id
      );
      const itemNames = items.map((item) => item.item_name || item.name || item.title).filter(Boolean);
      if (itemNames.length > 0) {
        params.content_name = itemNames.join(", ");
      }
      const firstItemCategory = items[0].item_category || items[0].category;
      if (firstItemCategory) {
        params.content_category = firstItemCategory;
      }
      const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
      params.num_items = totalQuantity;
      params.contents = items.map((item) => ({
        id: item.item_id || item.id || item.product_id || item.sku || item.external_id,
        quantity: item.quantity || 1,
        item_price: item.price || item.item_price || 0,
        // Include additional fields Facebook can use
        name: item.item_name || item.name,
        category: item.item_category || item.category || "uncategorized"
      }));
    }
    return params;
  }
  /**
   * Build AddShippingInfo parameters
   */
  buildShippingInfoParams(event) {
    const ecommerceData = this.extractEcommerceData(event);
    const items = ecommerceData.items || [];
    const params = {
      content_type: "product",
      currency: ecommerceData.currency || "USD",
      value: ecommerceData.value || this.calculateTotalValue(items),
      num_items: items.length
    };
    if (items.length > 0) {
      params.content_ids = items.map(
        (item) => item.item_id || item.id || item.product_id || item.sku || item.external_id
      );
      params.contents = items.map((item) => ({
        id: item.item_id || item.id || item.product_id || item.sku || item.external_id,
        quantity: item.quantity || 1,
        item_price: item.price || item.item_price || 0
      }));
    }
    if (ecommerceData.shipping_tier || event.data?.shipping_tier) {
      params.shipping_tier = ecommerceData.shipping_tier || event.data?.shipping_tier;
    }
    return params;
  }
  /**
   * Build AddPaymentInfo parameters
   */
  buildPaymentInfoParams(event) {
    const ecommerceData = this.extractEcommerceData(event);
    const items = ecommerceData.items || [];
    const params = {
      content_type: "product",
      currency: ecommerceData.currency || "USD",
      value: ecommerceData.value || this.calculateTotalValue(items),
      num_items: items.length
    };
    if (items.length > 0) {
      params.content_ids = items.map(
        (item) => item.item_id || item.id || item.product_id || item.sku || item.external_id
      );
      params.contents = items.map((item) => ({
        id: item.item_id || item.id || item.product_id || item.sku || item.external_id,
        quantity: item.quantity || 1,
        item_price: item.price || item.item_price || 0
      }));
    }
    if (ecommerceData.payment_type || event.data?.payment_type) {
      params.payment_type = ecommerceData.payment_type || event.data?.payment_type;
    }
    return params;
  }
  /**
   * Build InitiateCheckout parameters
   */
  buildCheckoutParams(event) {
    const ecommerceData = event.ecommerce || event.data || {};
    const items = ecommerceData.items || ecommerceData.products || [];
    const params = {
      content_type: "product",
      currency: ecommerceData.currency || "USD",
      value: ecommerceData.value || ecommerceData.total || this.calculateTotalValue(items),
      num_items: items.length
    };
    if (items.length > 0) {
      params.content_ids = items.map(
        (item) => item.item_id || item.id || item.product_id || item.sku || item.external_id
      );
      params.contents = items.map((item) => ({
        id: item.item_id || item.id || item.product_id || item.sku || item.external_id,
        quantity: item.quantity || 1,
        item_price: item.price || item.item_price || 0
      }));
    }
    if (ecommerceData.coupon || ecommerceData.discount_code || event.data?.coupon) {
      params.coupon = ecommerceData.coupon || ecommerceData.discount_code || event.data?.coupon;
    }
    return params;
  }
  /**
   * Build Purchase parameters
   */
  buildPurchaseParams(event) {
    const ecommerceData = this.extractEcommerceData(event);
    const items = ecommerceData.items || [];
    const params = {
      content_type: "product",
      currency: ecommerceData.currency || "USD",
      value: ecommerceData.value || this.calculateTotalValue(items),
      num_items: items.length,
      order_id: ecommerceData.transaction_id || event.data?.order_id,
      order_number: event.data?.order_number
      // Include order_number for eventID deduplication
    };
    if (items.length > 0) {
      params.content_ids = items.map(
        (item) => item.item_id || item.id || item.product_id || item.sku || item.external_id
      );
      params.contents = items.map((item) => ({
        id: item.item_id || item.id || item.product_id || item.sku || item.external_id,
        quantity: item.quantity || 1,
        item_price: item.price || item.item_price || 0
      }));
    }
    return params;
  }
  /**
   * Build Search parameters
   */
  buildSearchParams(event) {
    const data = event.data || {};
    return {
      search_string: data.search_term || data.query || "",
      content_category: data.category,
      content_ids: data.product_ids || []
    };
  }
  /**
   * Build Registration parameters
   */
  buildRegistrationParams(event) {
    const data = event.data || {};
    return {
      content_name: data.registration_method || "email",
      status: data.status || "completed",
      value: data.value || 0,
      currency: data.currency || "USD"
    };
  }
  /**
   * Build Upsell parameters
   */
  buildUpsellParams(event, fbEventName) {
    const params = {
      content_type: "product",
      order_id: event.order_id || event.data?.order_id,
      event_name: fbEventName
    };
    if (event.upsell) {
      params.content_ids = [event.upsell.package_id];
      params.content_name = event.upsell.package_name || `Package ${event.upsell.package_id}`;
      if (event.upsell.value !== void 0) {
        params.value = parseFloat(this.formatCurrency(event.upsell.value));
      }
      if (event.upsell.price !== void 0) {
        params.value = parseFloat(this.formatCurrency(event.upsell.price));
      }
      if (event.upsell.currency) {
        params.currency = event.upsell.currency;
      }
      if (event.upsell.quantity !== void 0) {
        params.num_items = event.upsell.quantity;
      }
    }
    return params;
  }
  /**
   * Build generic parameters for other events
   */
  buildGenericParams(event) {
    const data = event.data || {};
    const params = {};
    if (data.value !== void 0) {
      params.value = data.value;
    }
    if (data.currency) {
      params.currency = data.currency;
    }
    if (data.content_name) {
      params.content_name = data.content_name;
    }
    if (data.content_type) {
      params.content_type = data.content_type;
    }
    if (data.content_category) {
      params.content_category = data.content_category;
    }
    return params;
  }
}
const logger$a = createLogger("RudderStack");
class RudderStackAdapter extends ProviderAdapter {
  constructor() {
    super("RudderStack");
    this.pageViewSent = false;
    this.loadWarned = false;
  }
  /** Warn once, with the fix, when the RudderStack SDK never loads. */
  warnScriptMissing() {
    if (this.loadWarned) return;
    this.loadWarned = true;
    this.logger.warn(
      "rudderanalytics not found — add the RudderStack JavaScript SDK snippet to the page so events can be delivered. See https://www.rudderstack.com/docs/sources/event-streams/sdks/rudderstack-javascript-sdk/"
    );
  }
  /**
   * Forward the campaign_* identifiers stamped on the event by DataLayerManager
   * (issue #473) onto the RudderStack payload, keeping their snake_case names.
   * Empty values omitted.
   */
  buildContextProps(event) {
    const keys = [
      "campaign_name",
      "campaign_api_key",
      "campaign_currency",
      "campaign_language",
      "campaign_id",
      "campaign_session_id"
    ];
    const out = {};
    for (const key of keys) {
      const value = event[key];
      if (value !== void 0 && value !== null && value !== "") {
        out[key] = String(value);
      }
    }
    return out;
  }
  /**
   * Check if RudderStack is loaded
   */
  isRudderStackLoaded() {
    return this.isBrowser() && typeof window.rudderanalytics === "object" && typeof window.rudderanalytics.track === "function";
  }
  isReady() {
    return this.isRudderStackLoaded();
  }
  getDebugDetails() {
    return {
      scriptLoaded: this.isRudderStackLoaded(),
      pageViewSent: this.pageViewSent
    };
  }
  /**
   * Send event to RudderStack.
   *
   * Returns the transformed payload actually dispatched (the RudderStack call +
   * its arguments) so the debug overlay can show exactly what this provider
   * sent. When RudderStack has not loaded yet, the returned promise resolves to
   * that payload once the send completes (or rejects on load timeout).
   */
  sendEvent(event) {
    if (!this.enabled) {
      this.debug("RudderStack adapter disabled");
      return void 0;
    }
    logger$a.info(`Processing event "${event.event}"`, {
      eventName: event.event,
      eventData: event
    });
    const plan = this.buildPlan(event);
    const skip = asSkipResult(plan);
    if (skip) return skip;
    const ready = plan;
    if (!this.isRudderStackLoaded()) {
      return this.waitForRudderStack().then(() => {
        ready.dispatch();
        return ready.descriptor;
      }).catch(() => {
        this.warnScriptMissing();
        throw new DispatchError("RudderStack load timeout", ready.descriptor);
      });
    }
    ready.dispatch();
    return ready.descriptor;
  }
  /**
   * Wait for RudderStack to be loaded
   */
  async waitForRudderStack(timeout = 5e3) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      if (window.rudderanalytics?.ready) {
        window.rudderanalytics.ready(() => resolve());
        setTimeout(() => {
          if (this.isRudderStackLoaded()) {
            resolve();
          } else {
            reject(new Error("RudderStack ready timeout"));
          }
        }, timeout);
      } else {
        const checkInterval = setInterval(() => {
          if (this.isRudderStackLoaded()) {
            clearInterval(checkInterval);
            resolve();
          } else if (Date.now() - start > timeout) {
            clearInterval(checkInterval);
            reject(new Error("RudderStack load timeout"));
          }
        }, 100);
      }
    });
  }
  /**
   * Build the RudderStack call(s) for an event WITHOUT dispatching: returns a
   * {@link RudderPlan} pairing the overlay descriptor with a `dispatch()` that
   * performs the actual `window.rudderanalytics.*` calls, or a
   * {@link notSupported} skip result when nothing would be sent. Splitting build
   * from dispatch lets the overlay show the payload even when the send fails.
   */
  buildPlan(event) {
    switch (event.event) {
      case "dl_page_view":
      case "page_view":
        return this.buildPageViewPlan(event);
      case "dl_user_data":
      case "user_data":
        return this.buildUserDataPlan(event);
      default: {
        const rudderEventName = this.mapEventName(event.event);
        if (!rudderEventName)
          return notSupported("no RudderStack mapping for this event");
        const properties = this.buildEventProperties(event, rudderEventName);
        return {
          descriptor: { method: "track", event: rudderEventName, properties },
          dispatch: () => {
            window.rudderanalytics.track(rudderEventName, properties);
            this.debug(
              `Event sent to RudderStack: ${rudderEventName}`,
              properties
            );
          }
        };
      }
    }
  }
  /** Build the `page()` + custom `track()` plan for a page-view event. */
  buildPageViewPlan(event) {
    if (this.pageViewSent) {
      return notSupported("duplicate page view");
    }
    const page = event.page || event.data || {};
    const { pageType, pageName } = this.getPageMetadata();
    const properties = {
      path: page.path || window.location.pathname,
      url: page.url || page.page_location || window.location.href,
      title: page.title || document.title,
      referrer: page.referrer || document.referrer,
      ...this.buildContextProps(event)
    };
    const pageTypeCapitalized = pageType.charAt(0).toUpperCase() + pageType.slice(1);
    const eventName = `${pageTypeCapitalized} Page View`;
    const customProperties = { page_name: pageName, ...properties };
    return {
      descriptor: {
        calls: [
          { method: "page", category: pageType, name: pageName, properties },
          { method: "track", event: eventName, properties: customProperties }
        ]
      },
      dispatch: () => {
        window.rudderanalytics.page(pageType, pageName, properties);
        window.rudderanalytics.track(eventName, customProperties);
        this.pageViewSent = true;
        this.debug("Page View tracked", { pageType, pageName, eventName });
      }
    };
  }
  /** Build the `identify()` plan for a user-data event. */
  buildUserDataPlan(event) {
    const userData = event.user_properties || event.data || {};
    if (!(userData.customer_email || userData.email || userData.user_id)) {
      return notSupported("no identifiable user (guest)");
    }
    const userId = userData.user_id || userData.customer_email || userData.email;
    const traits = {
      email: userData.customer_email || userData.email,
      firstName: userData.customer_first_name || userData.firstName || userData.first_name,
      lastName: userData.customer_last_name || userData.lastName || userData.last_name,
      phone: userData.customer_phone || userData.phone,
      city: userData.customer_city || userData.city,
      state: userData.customer_state || userData.state,
      country: userData.customer_country || userData.country,
      postalCode: userData.customer_zip || userData.postalCode || userData.postal_code,
      acceptsMarketing: userData.customer_accepts_marketing || userData.acceptsMarketing || userData.accepts_marketing
    };
    Object.keys(traits).forEach(
      (key) => traits[key] === void 0 && delete traits[key]
    );
    return {
      descriptor: { method: "identify", userId, traits },
      dispatch: () => {
        window.rudderanalytics.identify(userId, traits);
        this.debug("User Identified", { userId, traits });
      }
    };
  }
  /**
   * Map data layer event names to RudderStack event names
   */
  mapEventName(eventName) {
    const eventMapping = {
      // Ecommerce events
      dl_view_item: "Product Viewed",
      dl_select_item: "Product Clicked",
      dl_view_item_list: "Product List Viewed",
      dl_add_to_cart: "Product Added",
      dl_remove_from_cart: "Product Removed",
      dl_view_cart: "Cart Viewed",
      dl_cart_updated: "Cart Viewed",
      dl_begin_checkout: "Checkout Started",
      // Spec has no "shipping info" event; shipping selection is a checkout
      // step. Payment uses the spec's exact "Payment Info Entered" name.
      dl_add_shipping_info: "Checkout Step Completed",
      dl_add_payment_info: "Payment Info Entered",
      dl_purchase: "Order Completed",
      // Accepted upsell is a separate post-purchase transaction (its own
      // transaction_id, `<order>-US<n>`) → a second Order Completed.
      dl_upsell_purchase: "Order Completed",
      // Standard names
      view_item: "Product Viewed",
      select_item: "Product Clicked",
      view_item_list: "Product List Viewed",
      add_to_cart: "Product Added",
      remove_from_cart: "Product Removed",
      view_cart: "Cart Viewed",
      begin_checkout: "Checkout Started",
      add_shipping_info: "Checkout Step Completed",
      add_payment_info: "Payment Info Entered",
      purchase: "Order Completed",
      // Upsell offer events (custom — not part of the spec)
      dl_viewed_upsell: "Upsell Viewed",
      dl_skipped_upsell: "Upsell Skipped",
      // User events
      dl_sign_up: "Signed Up",
      dl_login: "Logged In",
      sign_up: "Signed Up",
      login: "Logged In"
    };
    return eventMapping[eventName] || null;
  }
  /**
   * Build event properties based on event type
   */
  buildEventProperties(event, rudderEventName) {
    const data = event.data || event.ecommerce || {};
    const pageMetadata = this.getPageMetadata();
    const baseProps = {
      page_type: pageMetadata.pageType,
      page_name: pageMetadata.pageName,
      ...this.buildContextProps(event)
    };
    const sessionId = event._metadata?.session_id;
    switch (rudderEventName) {
      case "Product Viewed":
      case "Product Clicked":
        return this.buildProductViewedProps(data, baseProps);
      case "Product List Viewed":
        return this.buildProductListViewedProps(data, baseProps);
      case "Product Added":
      case "Product Removed":
        return this.buildProductAddedRemovedProps(data, baseProps, sessionId);
      case "Cart Viewed":
        return this.buildCartViewedProps(data, baseProps, sessionId);
      case "Checkout Started":
        return this.buildCheckoutStartedProps(data, baseProps);
      case "Checkout Step Completed":
        return this.buildShippingStepProps(data, baseProps, sessionId);
      case "Payment Info Entered":
        return this.buildPaymentInfoProps(data, baseProps, sessionId);
      case "Order Completed": {
        const props = this.buildOrderCompletedProps(data, baseProps, sessionId);
        this.identifyFromUserProperties(event.user_properties, props.order_id);
        return props;
      }
      case "Upsell Viewed":
      case "Upsell Skipped":
        return this.buildUpsellProps(event, baseProps);
      default:
        return { ...data, ...baseProps };
    }
  }
  /**
   * Coerce a value to a finite number, defaulting to 0.
   */
  toNumber(value) {
    const n = typeof value === "number" ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : 0;
  }
  /**
   * Build Product Viewed / Product Clicked properties.
   * Spec: top-level Product fields + currency.
   */
  buildProductViewedProps(data, baseProps) {
    const item = (data.items || [])[0] || {};
    const campaignData = this.getCampaignData(data);
    return {
      ...this.formatProduct(item),
      currency: data.currency || campaignData.campaignCurrency || "USD",
      ...baseProps
    };
  }
  /**
   * Build Product List Viewed properties.
   * Spec: list_id, category, products[].
   */
  buildProductListViewedProps(data, baseProps) {
    const campaignData = this.getCampaignData(data);
    const props = {
      products: this.formatProducts(data.items || []),
      currency: data.currency || campaignData.campaignCurrency || "USD"
    };
    const listId = data.item_list_id || data.list_id;
    if (listId) props.list_id = listId;
    const category = data.item_list_name || data.item_list_id;
    if (category) props.category = category;
    return { ...props, ...baseProps };
  }
  /**
   * Build Product Added / Product Removed properties.
   * Spec: cart_id + top-level Product fields. cart_id is the per-session id
   * (see buildEventProperties); omitted only if the session id is unavailable.
   */
  buildProductAddedRemovedProps(data, baseProps, cartId) {
    const item = (data.items || [])[0] || {};
    const campaignData = this.getCampaignData(data);
    return {
      ...cartId ? { cart_id: cartId } : {},
      ...this.formatProduct(item),
      currency: data.currency || campaignData.campaignCurrency || "USD",
      ...baseProps
    };
  }
  /**
   * Build Cart Viewed properties.
   * Spec: cart_id + products[]; value/currency added for reporting.
   */
  buildCartViewedProps(data, baseProps, cartId) {
    const campaignData = this.getCampaignData(data);
    return {
      ...cartId ? { cart_id: cartId } : {},
      products: this.formatProducts(data.items || []),
      currency: data.currency || campaignData.campaignCurrency || "USD",
      value: this.toNumber(data.value),
      ...baseProps
    };
  }
  /**
   * Build Checkout Step Completed properties for the shipping step.
   * Spec: checkout_id, step, shipping_method, payment_method.
   */
  buildShippingStepProps(data, baseProps, checkoutId) {
    const props = {
      ...checkoutId ? { checkout_id: checkoutId } : {},
      step: 2
    };
    if (data.shipping_tier) props.shipping_method = data.shipping_tier;
    return { ...props, ...baseProps };
  }
  /**
   * Build Payment Info Entered properties.
   * Spec: checkout_id, order_id, step, shipping_method, payment_method.
   */
  buildPaymentInfoProps(data, baseProps, checkoutId) {
    const props = {
      ...checkoutId ? { checkout_id: checkoutId } : {},
      step: 3
    };
    if (data.payment_type) props.payment_method = data.payment_type;
    return { ...props, ...baseProps };
  }
  /**
   * Build Checkout Started properties.
   * Spec: order_id, affiliation, value, revenue, shipping, tax, discount,
   * coupon, currency, products[].
   */
  buildCheckoutStartedProps(data, baseProps) {
    const campaignData = this.getCampaignData(data);
    const value = this.toNumber(data.value);
    const props = {
      value,
      revenue: value,
      currency: data.currency || campaignData.campaignCurrency || "USD",
      affiliation: data.affiliation || campaignData.campaignName || "Funnels",
      products: this.formatProducts(data.items || [])
    };
    if (data.shipping !== void 0)
      props.shipping = this.toNumber(data.shipping);
    if (data.tax) props.tax = this.toNumber(data.tax);
    if (data.discount) props.discount = this.toNumber(data.discount);
    if (data.coupon) props.coupon = data.coupon;
    return { ...props, ...baseProps };
  }
  /**
   * Build Order Completed properties.
   * Spec: order_id, affiliation, subtotal, total, revenue, shipping, tax,
   * discount, coupon, currency, products[].
   */
  buildOrderCompletedProps(data, baseProps, checkoutId) {
    const campaignData = this.getCampaignData(data);
    const value = this.toNumber(data.value);
    const tax = this.toNumber(data.tax);
    const shipping = this.toNumber(data.shipping);
    const total = Math.round((value + tax + shipping) * 100) / 100;
    const props = {
      ...checkoutId ? { checkout_id: checkoutId } : {},
      order_id: data.transaction_id || "",
      affiliation: data.affiliation || campaignData.campaignName || "Funnels",
      subtotal: value,
      revenue: value,
      total,
      shipping,
      tax,
      currency: data.currency || campaignData.campaignCurrency || "USD",
      products: this.formatProducts(data.items || [])
    };
    if (data.discount) props.discount = this.toNumber(data.discount);
    if (data.coupon) props.coupon = data.coupon;
    return { ...props, ...baseProps };
  }
  /**
   * Build Upsell Viewed / Upsell Skipped properties. These custom events carry
   * their payload on `event.upsell` ({ package_id, package_name, price,
   * currency }) with the source order on `event.order_id`.
   */
  buildUpsellProps(event, baseProps) {
    const upsell = event.upsell || {};
    const campaignData = this.getCampaignData({});
    const props = {
      order_id: event.order_id || "",
      product_id: upsell.package_id || "",
      name: upsell.package_name || "",
      quantity: 1,
      currency: upsell.currency || campaignData.campaignCurrency || "USD"
    };
    if (upsell.price !== void 0) props.price = this.toNumber(upsell.price);
    return { ...props, ...baseProps };
  }
  /**
   * Identify the customer from the event's user_properties (fired on purchase).
   * Traits use the RudderStack-recommended names.
   */
  identifyFromUserProperties(userProperties, fallbackId) {
    const props = userProperties || {};
    const userId = props.customer_id || props.customer_email || fallbackId;
    if (!userId) return;
    const traits = {
      email: props.customer_email,
      firstName: props.customer_first_name,
      lastName: props.customer_last_name,
      phone: props.customer_phone,
      city: props.customer_city,
      state: props.customer_province || props.customer_province_code,
      country: props.customer_country,
      postalCode: props.customer_zip
    };
    Object.keys(traits).forEach(
      (key) => traits[key] === void 0 && delete traits[key]
    );
    if (Object.keys(traits).length > 0) {
      window.rudderanalytics.identify(String(userId), traits);
      this.debug("User Identified on Purchase", { userId });
    }
  }
  /**
   * Map a GA4-format item (item_id / item_product_id / item_sku / index /
   * item_image …) to a RudderStack spec Product object. Optional fields are
   * only included when present so the payload stays clean.
   */
  formatProduct(item) {
    const product = {
      // product_id = the product's database ID; sku = the stock-keeping unit.
      // GA4 `item_id` holds the product SKU, `item_product_id` the numeric id.
      product_id: String(
        item.item_product_id ?? item.product_id ?? item.item_id ?? item.id ?? ""
      ),
      sku: String(item.item_sku ?? item.item_id ?? item.sku ?? ""),
      name: item.item_name ?? item.name ?? "",
      price: this.toNumber(item.price),
      quantity: parseInt(item.quantity, 10) || 1,
      url: window.location.href
    };
    const category = item.item_category ?? item.category;
    if (category) product.category = category;
    const brand = item.item_brand ?? item.brand;
    if (brand) product.brand = brand;
    const variant = item.item_variant ?? item.variant;
    if (variant) product.variant = variant;
    if (item.coupon) product.coupon = item.coupon;
    const position = item.index ?? item.position;
    if (typeof position === "number") product.position = position;
    const imageUrl = item.item_image ?? item.image_url ?? item.image;
    if (imageUrl) product.image_url = imageUrl;
    return product;
  }
  /**
   * Map an array of GA4-format items to RudderStack spec Product objects.
   */
  formatProducts(items) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => this.formatProduct(item));
  }
  /**
   * Resolve the page type and a human page name.
   *
   * `pageType` comes from the config store (set from `meta[name="next-page-type"]`
   * / `window.nextConfig`, default `product`) — the canonical source, so it is
   * never `unknown` on a configured page. `pageName` has no dedicated field in
   * the SDK: an optional `meta[name="next-page-name"]` wins, otherwise the
   * document title, falling back to the page type. Empty strings are treated as
   * absent so a value is always returned.
   */
  getPageMetadata() {
    let pageType = "";
    try {
      pageType = configStore.getState().pageType || "";
    } catch {
      pageType = document.querySelector('meta[name="next-page-type"]')?.getAttribute("content") || "";
    }
    if (!pageType) pageType = "unknown";
    const pageNameMeta = document.querySelector('meta[name="next-page-name"]')?.getAttribute("content");
    const pageName = pageNameMeta || document.title || pageType;
    return { pageType, pageName };
  }
  /**
   * Get campaign data from event or SDK
   */
  getCampaignData(data) {
    if (data?.campaignName) {
      return {
        campaignName: data.campaignName,
        campaignApiKey: data.campaignApiKey || "",
        campaignCurrency: data.campaignCurrency || "USD",
        campaignLanguage: data.campaignLanguage || ""
      };
    }
    try {
      const campaign = useCampaignStore.getState().data;
      if (campaign) {
        return {
          campaignName: campaign.name || "",
          campaignApiKey: configStore.getState().apiKey || "",
          campaignCurrency: campaign.currency || "USD",
          campaignLanguage: campaign.language || ""
        };
      }
    } catch {
    }
    if (this.isBrowser() && window.next) {
      const sdk = window.next;
      const campaignData = sdk.getCampaignData?.();
      if (campaignData) {
        return {
          campaignName: campaignData.name || "",
          campaignApiKey: window.nextDebug?.stores?.config?.getState()?.apiKey || "",
          campaignCurrency: campaignData.currency || "USD",
          campaignLanguage: campaignData.language || ""
        };
      }
    }
    return {
      campaignName: "",
      campaignApiKey: "",
      campaignCurrency: "USD",
      campaignLanguage: ""
    };
  }
}
class NextCampaignAdapter extends ProviderAdapter {
  constructor() {
    super("NextCampaign");
    this.scriptLoaded = false;
    this.scriptLoading = false;
    this.loadPromise = null;
    this.apiKey = "";
    this.loadWarned = false;
  }
  /** Warn once, with the fix, when the NextCampaign SDK fails to load. */
  warnScriptMissing() {
    if (this.loadWarned) return;
    this.loadWarned = true;
    this.logger.warn(
      "NextCampaign SDK failed to load — check that a valid apiKey is set and that campaigns.apps.29next.com is reachable."
    );
  }
  /**
   * Initialize the adapter with configuration
   */
  async initialize(config) {
    this.logger.info("NextCampaign adapter initializing...");
    if (config?.apiKey) {
      this.apiKey = config.apiKey;
      this.logger.info("API key provided via config parameter");
    } else {
      const configStore$1 = configStore.getState();
      this.apiKey = configStore$1.apiKey || "";
      this.logger.info(
        `API key from config store: ${this.apiKey ? "found" : "not found"}`
      );
    }
    if (!this.apiKey) {
      this.logger.warn("No API key available for NextCampaign initialization");
      return;
    }
    this.logger.info(
      `NextCampaign API key found: ${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`
    );
    await this.loadScript();
  }
  isReady() {
    return this.scriptLoaded;
  }
  getDebugDetails() {
    return {
      scriptLoaded: this.scriptLoaded,
      apiKeySet: Boolean(this.apiKey)
    };
  }
  /**
   * Send event to NextCampaign
   */
  async sendEvent(event) {
    if (!this.enabled) {
      this.debug("NextCampaign adapter disabled");
      return void 0;
    }
    const mappedEvent = this.mapEvent(event);
    if (!mappedEvent) {
      return notSupported("NextCampaign only tracks page_view");
    }
    if (!this.scriptLoaded) {
      try {
        await this.loadScript();
      } catch {
        this.warnScriptMissing();
        throw new DispatchError("NextCampaign SDK load failed", mappedEvent);
      }
    }
    try {
      if (window.nextCampaign) {
        window.nextCampaign.event(mappedEvent.name, mappedEvent.data);
        this.debug(
          `Event sent to NextCampaign: ${mappedEvent.name}`,
          mappedEvent.data
        );
      }
    } catch (error) {
      throw new DispatchError(
        `NextCampaign dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
        mappedEvent
      );
    }
    return mappedEvent;
  }
  /**
   * Load the NextCampaign SDK script
   */
  async loadScript() {
    if (this.scriptLoaded) {
      return;
    }
    if (this.scriptLoading) {
      return this.loadPromise;
    }
    this.scriptLoading = true;
    this.loadPromise = this.performLoad();
    try {
      await this.loadPromise;
      this.scriptLoaded = true;
      this.logger.info(
        "NextCampaign SDK loaded and initialized successfully ✅"
      );
    } catch (error) {
      this.logger.error("Failed to load NextCampaign SDK:", error);
      throw error;
    } finally {
      this.scriptLoading = false;
    }
  }
  /**
   * Perform the actual script loading
   */
  async performLoad() {
    const scriptUrl = "https://campaigns.apps.29next.com/js/v1/campaign/";
    const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);
    if (existingScript) {
      await this.waitForNextCampaign();
      return;
    }
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = scriptUrl;
      script.onload = () => {
        this.logger.debug("NextCampaign script loaded");
        resolve();
      };
      script.onerror = () => {
        reject(new Error(`Failed to load NextCampaign script: ${scriptUrl}`));
      };
      document.head.appendChild(script);
    });
    await this.waitForNextCampaign();
    if (window.nextCampaign && this.apiKey) {
      window.nextCampaign.config({ apiKey: this.apiKey });
      this.logger.debug("NextCampaign configured with API key");
      this.fireInitialPageView();
    }
  }
  /**
   * Fire initial page view event on load
   */
  fireInitialPageView() {
    if (document.readyState === "complete") {
      this.sendPageView();
    } else {
      window.addEventListener("load", () => {
        this.sendPageView();
      });
    }
  }
  /**
   * Send page view event to NextCampaign
   */
  sendPageView() {
    try {
      if (window.nextCampaign) {
        window.nextCampaign.event("page_view", {
          title: document.title,
          url: window.location.href
        });
        this.logger.info("Initial page_view event sent to NextCampaign");
      }
    } catch (error) {
      this.logger.error(
        "Error sending initial page view to NextCampaign:",
        error
      );
    }
  }
  /**
   * Wait for nextCampaign object to be available
   */
  async waitForNextCampaign(timeout = 5e3) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (window.nextCampaign) {
          clearInterval(checkInterval);
          resolve();
        } else if (Date.now() - start > timeout) {
          clearInterval(checkInterval);
          reject(new Error("NextCampaign load timeout"));
        }
      }, 100);
    });
  }
  /**
   * Map DataLayer events to NextCampaign events
   * IMPORTANT: NextCampaign only tracks page_view events
   */
  mapEvent(event) {
    switch (event.event) {
      case "dl_page_view":
      case "page_view":
        return {
          name: "page_view",
          data: {
            title: document.title,
            url: window.location.href
          }
        };
      default:
        return null;
    }
  }
}
class CustomAdapter extends ProviderAdapter {
  constructor(config = {}) {
    super("Custom");
    this.eventQueue = [];
    this.batchTimer = null;
    this.retryQueue = /* @__PURE__ */ new Map();
    this.config = {
      endpoint: config.endpoint || "",
      headers: {
        "Content-Type": "application/json",
        ...config.headers
      },
      batchSize: config.batchSize || 10,
      batchIntervalMs: config.batchIntervalMs || 5e3,
      maxRetries: config.maxRetries || 3,
      retryDelayMs: config.retryDelayMs || 1e3,
      transformFunction: config.transformFunction || ((event) => event)
    };
  }
  /**
   * Update configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    if (config.headers) {
      this.config.headers = { ...this.config.headers, ...config.headers };
    }
  }
  isReady() {
    return Boolean(this.config.endpoint);
  }
  getDebugDetails() {
    return {
      endpoint: this.config.endpoint || "(none)",
      queued: this.eventQueue.length,
      batchSize: this.config.batchSize
    };
  }
  /**
   * Send event to custom endpoint.
   *
   * Events are batched, so the actual HTTP POST happens later; the returned
   * value is this event's transformed payload — the exact per-event shape that
   * gets wrapped into the batch body — so the debug overlay can show what the
   * Custom endpoint will receive for it.
   */
  sendEvent(event) {
    if (!this.enabled) {
      this.debug("Custom adapter disabled");
      return void 0;
    }
    if (!this.config.endpoint) {
      return notSupported("no endpoint configured");
    }
    this.eventQueue.push(event);
    this.debug(`Event queued. Queue size: ${this.eventQueue.length}`);
    if (this.eventQueue.length >= this.config.batchSize) {
      this.sendBatch();
    } else {
      this.scheduleBatch();
    }
    return this.config.transformFunction(event);
  }
  /**
   * Schedule batch sending
   */
  scheduleBatch() {
    if (this.batchTimer) {
      return;
    }
    this.batchTimer = setTimeout(() => {
      this.sendBatch();
    }, this.config.batchIntervalMs);
  }
  /**
   * Send batch of events
   */
  async sendBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    const eventsToSend = this.eventQueue.splice(0, this.config.batchSize);
    if (eventsToSend.length === 0) {
      return;
    }
    this.debug(`Sending batch of ${eventsToSend.length} events`);
    try {
      const transformedEvents = eventsToSend.map(
        (event) => this.config.transformFunction(event)
      );
      const body = {
        events: transformedEvents,
        batch_info: {
          size: transformedEvents.length,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          source: "next-campaign-cart"
        }
      };
      const response = await this.sendRequest(body);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      this.debug(`Batch sent successfully`);
    } catch (error) {
      this.logger.error("Error sending batch to custom endpoint:", error);
      eventsToSend.forEach((event) => {
        this.addToRetryQueue(event);
      });
    }
    if (this.eventQueue.length > 0) {
      this.scheduleBatch();
    }
  }
  /**
   * Send HTTP request with retry logic
   */
  async sendRequest(body, attempt = 1) {
    try {
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: this.config.headers,
        body: JSON.stringify(body)
      });
      return response;
    } catch (error) {
      if (attempt < this.config.maxRetries) {
        await this.delay(this.config.retryDelayMs * attempt);
        return this.sendRequest(body, attempt + 1);
      }
      throw error;
    }
  }
  /**
   * Add event to retry queue
   */
  addToRetryQueue(event) {
    const retryInfo = event.id ? this.retryQueue.get(event.id) : void 0;
    if (!retryInfo) {
      if (event.id) {
        this.retryQueue.set(event.id, { event, attempts: 1 });
        this.scheduleRetry(event.id);
      }
    } else if (retryInfo.attempts < this.config.maxRetries) {
      retryInfo.attempts++;
      if (event.id) {
        this.scheduleRetry(event.id);
      }
    } else {
      if (event.id) {
        this.retryQueue.delete(event.id);
      }
      this.logger.error(
        `Failed to send event after ${this.config.maxRetries} attempts:`,
        event
      );
    }
  }
  /**
   * Schedule retry for a specific event
   */
  scheduleRetry(eventId) {
    const retryInfo = this.retryQueue.get(eventId);
    if (!retryInfo) return;
    const delay = this.config.retryDelayMs * retryInfo.attempts;
    setTimeout(() => {
      const info = this.retryQueue.get(eventId);
      if (info) {
        this.retryQueue.delete(eventId);
        this.sendEvent(info.event);
      }
    }, delay);
  }
  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  /**
   * Force send all queued events immediately
   */
  async flush() {
    this.debug("Flushing all queued events");
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    while (this.eventQueue.length > 0) {
      await this.sendBatch();
    }
  }
  /**
   * Get current queue size
   */
  getQueueSize() {
    return this.eventQueue.length;
  }
  /**
   * Get retry queue size
   */
  getRetryQueueSize() {
    return this.retryQueue.size;
  }
  /**
   * Clear all queued events
   */
  clearQueue() {
    this.eventQueue = [];
    this.retryQueue.clear();
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}
const logger$9 = createLogger("ListAttributionTracker");
const STORAGE_KEY = "analytics_current_list";
const LIST_EXPIRY_MS = 30 * 60 * 1e3;
class ListAttributionTracker {
  constructor() {
    this.currentList = null;
    this.loadFromStorage();
    this.setupUrlTracking();
  }
  static getInstance() {
    if (!ListAttributionTracker.instance) {
      ListAttributionTracker.instance = new ListAttributionTracker();
    }
    return ListAttributionTracker.instance;
  }
  /**
   * Initialize the tracker (called by NextAnalytics)
   */
  initialize() {
    logger$9.debug("ListAttributionTracker initialized");
  }
  /**
   * Set the current list context
   */
  setCurrentList(listId, listName) {
    const context = {
      ...listId !== void 0 && { listId },
      ...listName !== void 0 && { listName },
      timestamp: Date.now(),
      url: window.location.href
    };
    this.currentList = context;
    this.saveToStorage();
    logger$9.debug("Set current list:", { listId, listName });
  }
  /**
   * Get the current list context if still valid
   */
  getCurrentList() {
    if (!this.currentList) {
      return null;
    }
    if (Date.now() - this.currentList.timestamp > LIST_EXPIRY_MS) {
      logger$9.debug("List context expired");
      this.clearCurrentList();
      return null;
    }
    return {
      ...this.currentList.listId !== void 0 && { listId: this.currentList.listId },
      ...this.currentList.listName !== void 0 && { listName: this.currentList.listName }
    };
  }
  /**
   * Clear the current list context
   */
  clearCurrentList() {
    this.currentList = null;
    this.removeFromStorage();
    logger$9.debug("Cleared current list");
  }
  /**
   * Reset the tracker (called by NextAnalytics)
   */
  reset() {
    this.clearCurrentList();
    logger$9.debug("ListAttributionTracker reset");
  }
  /**
   * Detect list from URL patterns
   */
  detectListFromUrl(url) {
    const targetUrl = url || window.location.href;
    const urlObj = new URL(targetUrl, window.location.origin);
    const pathname = urlObj.pathname.toLowerCase();
    const patterns = [
      // Collection pages
      { regex: /\/collections?\/([^\/]+)/, type: "collection" },
      // Category pages
      { regex: /\/category\/([^\/]+)/, type: "category" },
      { regex: /\/categories\/([^\/]+)/, type: "category" },
      // Product list pages
      { regex: /\/products\/?$/, type: "all_products" },
      { regex: /\/shop\/?$/, type: "shop" },
      { regex: /\/store\/?$/, type: "store" },
      // Search results
      { regex: /\/search/, type: "search" },
      // Tag pages
      { regex: /\/tag\/([^\/]+)/, type: "tag" },
      { regex: /\/tags\/([^\/]+)/, type: "tag" },
      // Brand pages
      { regex: /\/brand\/([^\/]+)/, type: "brand" },
      { regex: /\/brands\/([^\/]+)/, type: "brand" }
    ];
    for (const pattern of patterns) {
      const match = pathname.match(pattern.regex);
      if (match) {
        const listId = match[1] || pattern.type;
        const listName = this.formatListName(listId, pattern.type);
        logger$9.debug("Detected list from URL:", { listId, listName, type: pattern.type });
        return { listId, listName };
      }
    }
    const searchParams = urlObj.searchParams;
    if (searchParams.has("category")) {
      const category = searchParams.get("category");
      return {
        listId: category,
        listName: this.formatListName(category, "category")
      };
    }
    if (searchParams.has("collection")) {
      const collection = searchParams.get("collection");
      return {
        listId: collection,
        listName: this.formatListName(collection, "collection")
      };
    }
    if (searchParams.has("q") || searchParams.has("query") || searchParams.has("search")) {
      const query = searchParams.get("q") || searchParams.get("query") || searchParams.get("search") || "";
      return {
        listId: "search_results",
        listName: `Search Results: ${query}`
      };
    }
    return null;
  }
  /**
   * Automatically track list changes based on URL
   */
  setupUrlTracking() {
    if (typeof window === "undefined") {
      return;
    }
    this.trackCurrentUrl();
    window.addEventListener("popstate", () => {
      this.trackCurrentUrl();
    });
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(() => ListAttributionTracker.getInstance().trackCurrentUrl(), 0);
    };
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(() => ListAttributionTracker.getInstance().trackCurrentUrl(), 0);
    };
  }
  /**
   * Track the current URL for list context
   */
  trackCurrentUrl() {
    const detected = this.detectListFromUrl();
    if (detected) {
      this.setCurrentList(detected.listId, detected.listName);
    } else {
      const currentUrl = window.location.pathname.toLowerCase();
      if (!this.isProductPage(currentUrl)) {
        this.clearCurrentList();
      }
    }
  }
  /**
   * Check if URL is a product page (should preserve list context)
   */
  isProductPage(pathname) {
    const productPatterns = [
      /\/product\/[^\/]+/,
      /\/products\/[^\/]+/,
      /\/item\/[^\/]+/,
      /\/p\/[^\/]+/
    ];
    return productPatterns.some((pattern) => pattern.test(pathname));
  }
  /**
   * Format list name from ID
   */
  formatListName(listId, type) {
    const cleaned = listId.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    switch (type) {
      case "collection":
        return `${cleaned} Collection`;
      case "category":
        return `${cleaned} Category`;
      case "all_products":
        return "All Products";
      case "shop":
        return "Shop";
      case "store":
        return "Store";
      case "search":
        return "Search Results";
      case "tag":
        return `Tag: ${cleaned}`;
      case "brand":
        return `${cleaned} Brand`;
      default:
        return cleaned;
    }
  }
  /**
   * Load list context from storage
   */
  loadFromStorage() {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return;
    }
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const context = JSON.parse(stored);
        if (Date.now() - context.timestamp < LIST_EXPIRY_MS) {
          this.currentList = context;
          logger$9.debug("Loaded list context from storage:", context);
        } else {
          this.removeFromStorage();
        }
      }
    } catch (error) {
      logger$9.error("Error loading list context from storage:", error);
    }
  }
  /**
   * Save list context to storage
   */
  saveToStorage() {
    if (typeof window === "undefined" || !window.sessionStorage || !this.currentList) {
      return;
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentList));
    } catch (error) {
      logger$9.error("Error saving list context to storage:", error);
    }
  }
  /**
   * Remove list context from storage
   */
  removeFromStorage() {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return;
    }
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      logger$9.error("Error removing list context from storage:", error);
    }
  }
}
const listAttributionTracker = ListAttributionTracker.getInstance();
const MATCH_EPS = 0.02;
function num(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  return NaN;
}
function resolveOrderTaxBasis(order, packages = []) {
  const lines = Array.isArray(order?.lines) ? order.lines : [];
  for (const line of lines) {
    const pkg = packages.find((p) => String(p.ref_id) === String(line.package));
    const catalogUnit = num(pkg?.price);
    if (!Number.isFinite(catalogUnit) || catalogUnit <= 0) continue;
    const qty = parseInt(String(line.quantity ?? 1), 10) || 1;
    const inclUnit = num(line.price_incl_tax_excl_discounts) / qty;
    const exclUnit = num(line.price_excl_tax_excl_discounts) / qty;
    if (!Number.isFinite(inclUnit) || !Number.isFinite(exclUnit)) continue;
    if (Math.abs(inclUnit - exclUnit) <= MATCH_EPS) continue;
    const inclGap = Math.abs(inclUnit - catalogUnit);
    const exclGap = Math.abs(exclUnit - catalogUnit);
    return inclGap < exclGap ? "incl" : "excl";
  }
  return "excl";
}
const logger$8 = createLogger("EcommerceEvents");
class EcommerceEvents {
  /**
   * Build the GA4 `ecommerce` payload for the current cart: formatted items,
   * the cart total as `value`, and the applied coupon. Shared by view_cart,
   * begin_checkout, add_shipping_info and add_payment_info so they stay
   * consistent (same items, same value, same coupon handling).
   *
   * Uses `cartState.items` directly — `enrichedItems` is never populated by the
   * store, so mapping over it would emit an empty items array.
   */
  static buildCartEcommerce() {
    const cartState = useCartStore.getState();
    const items = cartState.items.map(
      (item, index2) => EventBuilder.formatEcommerceItem(item, index2)
    );
    const ecommerce = {
      currency: EventBuilder.getCurrency(),
      // Item revenue (Σ price × quantity), not the cart store `total` which
      // includes shipping — keeps `value` reconciled with `items` (GA4 semantics).
      value: EventBuilder.sumItemsValue(items),
      items
    };
    if (cartState.vouchers?.[0]) {
      ecommerce.coupon = cartState.vouchers[0];
    }
    if (cartState.shippingMethod?.price) {
      ecommerce.shipping = cartState.shippingMethod.price.toNumber();
    }
    return ecommerce;
  }
  /**
   * Create view_item_list event (GA4 format)
   */
  static createViewItemListEvent(items, listId, listName) {
    const currency = EventBuilder.getCurrency();
    const formattedItems = items.map(
      (item, index2) => EventBuilder.formatEcommerceItem(item, index2, {
        id: listId,
        name: listName
      })
    );
    EventBuilder.setListAttribution(listId, listName);
    const ecommerce = {
      currency,
      items: formattedItems,
      item_list_id: listId,
      item_list_name: listName || listId
    };
    return EventBuilder.createEvent("dl_view_item_list", {
      user_properties: EventBuilder.getUserProperties(),
      ecommerce
    });
  }
  /**
   * Create view_item event (GA4 format)
   */
  static createViewItemEvent(item) {
    const currency = EventBuilder.getCurrency();
    const list = EventBuilder.getListAttribution();
    const formattedItem = EventBuilder.formatEcommerceItem(item, 0, list);
    const ecommerce = {
      currency,
      // GA4 view_item requires `value` alongside `currency` (item revenue:
      // price × quantity). Without it GA4 cannot attribute item-view value.
      value: EventBuilder.sumItemsValue([formattedItem]),
      items: [formattedItem]
    };
    return EventBuilder.createEvent("dl_view_item", {
      user_properties: EventBuilder.getUserProperties(),
      ecommerce
    });
  }
  /**
   * Create add_to_cart event with list attribution (GA4 format)
   */
  static createAddToCartEvent(item, listId, listName) {
    const currency = EventBuilder.getCurrency();
    const list = EventBuilder.getListAttribution();
    const finalListId = listId || list?.id;
    const finalListName = listName || list?.name || finalListId;
    const formattedItem = EventBuilder.formatEcommerceItem(item, 0, {
      id: finalListId,
      name: finalListName
    });
    const value = formattedItem.price && formattedItem.quantity ? formattedItem.price * formattedItem.quantity : 0;
    const ecommerce = {
      currency,
      value,
      items: [formattedItem]
    };
    return EventBuilder.createEvent("dl_add_to_cart", {
      user_properties: EventBuilder.getUserProperties(),
      ecommerce
    });
  }
  /**
   * Create remove_from_cart event (GA4 format)
   */
  static createRemoveFromCartEvent(item) {
    const currency = EventBuilder.getCurrency();
    const list = EventBuilder.getListAttribution();
    const formattedItem = EventBuilder.formatEcommerceItem(item, 0, list);
    const value = formattedItem.price && formattedItem.quantity ? formattedItem.price * formattedItem.quantity : 0;
    const ecommerce = {
      currency,
      value,
      items: [formattedItem]
    };
    return EventBuilder.createEvent("dl_remove_from_cart", {
      user_properties: EventBuilder.getUserProperties(),
      ecommerce
    });
  }
  /**
   * Create package_swapped event for atomic package swaps
   */
  static createPackageSwappedEvent(previousItem, newItem, priceDifference) {
    const currency = EventBuilder.getCurrency();
    const formattedPreviousItem = EventBuilder.formatEcommerceItem(previousItem);
    const formattedNewItem = EventBuilder.formatEcommerceItem(newItem);
    const ecommerce = {
      currency,
      value_change: priceDifference,
      items_removed: [formattedPreviousItem],
      items_added: [formattedNewItem]
    };
    return EventBuilder.createEvent("dl_package_swapped", {
      ecommerce,
      event_category: "ecommerce",
      event_action: "swap",
      event_label: `${formattedPreviousItem.item_name} → ${formattedNewItem.item_name}`,
      swap_details: {
        previous_package_id: previousItem.packageId,
        new_package_id: newItem.packageId,
        price_difference: priceDifference
      }
    });
  }
  /**
   * Create select_item event (product click) (GA4 format)
   */
  static createSelectItemEvent(item, listId, listName) {
    const currency = EventBuilder.getCurrency();
    const formattedItem = EventBuilder.formatEcommerceItem(item, 0, {
      id: listId,
      name: listName || listId
    });
    const ecommerce = {
      currency,
      items: [formattedItem],
      item_list_id: listId,
      item_list_name: listName || listId
    };
    return EventBuilder.createEvent("dl_select_item", {
      user_properties: EventBuilder.getUserProperties(),
      ecommerce
    });
  }
  /**
   * Create begin_checkout event (GA4 format)
   */
  static createBeginCheckoutEvent() {
    const cartState = useCartStore.getState();
    const ecommerce = this.buildCartEcommerce();
    return EventBuilder.createEvent("dl_begin_checkout", {
      user_properties: EventBuilder.getUserProperties(),
      cart_total: String(cartState.total.toNumber() || "0.00"),
      ecommerce
    });
  }
  /**
   * Create purchase event (GA4 format)
   */
  static createPurchaseEvent(orderData) {
    const cartState = useCartStore.getState();
    const currency = EventBuilder.getCurrency();
    const campaignStore = useCampaignStore.getState();
    const order = orderData.order || orderData;
    const orderId = order.number || order.ref_id || orderData.orderId || orderData.transactionId || `order_${Date.now()}`;
    const orderTotal = parseFloat(
      order.total_incl_tax || order.total || orderData.total || cartState.total.toNumber() || 0
    );
    const taxBasis = resolveOrderTaxBasis(
      order,
      campaignStore.data?.packages ?? []
    );
    const taxInclusive = taxBasis === "incl";
    const orderTax = parseFloat(order.total_tax || orderData.tax || 0);
    const orderShipping = parseFloat(
      (taxInclusive ? order.shipping_incl_tax : order.shipping_excl_tax) || order.shipping_incl_tax || orderData.shipping || cartState.shippingMethod?.price.toNumber() || 0
    );
    let items = [];
    if (order.lines && order.lines.length > 0) {
      items = order.lines.map((line, index2) => {
        const packageData = campaignStore.data?.packages?.find(
          (p) => String(p.ref_id) === String(line.package)
        );
        const lineTotalPrice = taxInclusive ? line.price_incl_tax || line.price_excl_tax : line.price_excl_tax || line.price_incl_tax;
        const linePrice = parseFloat(lineTotalPrice || line.price || 0);
        const lineQuantity = parseInt(line.quantity || 1);
        const perUnitPrice = lineQuantity > 0 ? linePrice / lineQuantity : linePrice;
        const item = {
          item_id: line.product_sku || packageData?.product_sku || line.sku || `SKU-${line.product_id || line.id}`,
          item_name: line.product_title || packageData?.product_name || line.name || "Unknown Product",
          item_brand: packageData?.product_name || campaignStore.data?.name || "",
          item_category: line.campaign_name || campaignStore.data?.name || "Campaign",
          item_variant: line.package_profile || packageData?.product_variant_name || line.variant || "",
          price: perUnitPrice,
          quantity: lineQuantity,
          currency: order.currency || currency,
          index: index2
        };
        const productId = line.product_id ?? packageData?.product_id;
        const variantId = line.variant_id ?? packageData?.product_variant_id;
        if (productId != null) item.item_product_id = String(productId);
        if (variantId != null) item.item_variant_id = String(variantId);
        return item;
      });
    } else if (orderData.items || cartState.items.length > 0) {
      items = (orderData.items || cartState.items).map(
        (item, index2) => EventBuilder.formatEcommerceItem(item, index2)
      );
    }
    const itemsValue = EventBuilder.sumItemsValue(items);
    const value = itemsValue > 0 ? itemsValue : Math.max(0, orderTotal - orderTax - orderShipping);
    const ecommerce = {
      currency: order.currency || currency,
      transaction_id: orderId,
      value,
      tax: orderTax,
      shipping: orderShipping,
      affiliation: "Online Store",
      items
    };
    const coupon = order.vouchers?.[0]?.code || orderData.coupon || cartState.vouchers?.[0];
    if (coupon) {
      ecommerce.coupon = coupon;
    }
    const discountAmount = order.discount || orderData.discountAmount || 0;
    if (discountAmount) {
      ecommerce.discount = discountAmount;
    }
    EventBuilder.clearListAttribution();
    let userProperties = EventBuilder.getUserProperties();
    if (order.user || order.billing_address) {
      userProperties = {
        ...userProperties,
        visitor_type: order.user ? "logged_in" : "guest",
        ...order.user?.email && { customer_email: order.user.email },
        ...order.user?.first_name && {
          customer_first_name: order.user.first_name
        },
        ...order.user?.last_name && {
          customer_last_name: order.user.last_name
        },
        ...order.user?.phone_number && {
          customer_phone: order.user.phone_number
        },
        // Use billing address from order
        ...order.billing_address && {
          customer_first_name: order.billing_address.first_name || order.user?.first_name,
          customer_last_name: order.billing_address.last_name || order.user?.last_name,
          customer_address_1: order.billing_address.line1 || "",
          customer_address_2: order.billing_address.line2 || "",
          customer_city: order.billing_address.line4 || "",
          // line4 is city in this format
          customer_province: order.billing_address.state || "",
          customer_province_code: order.billing_address.state || "",
          customer_zip: order.billing_address.postcode || "",
          customer_country: order.billing_address.country || "",
          customer_phone: order.billing_address.phone_number || order.user?.phone_number
        }
      };
    }
    return EventBuilder.createEvent("dl_purchase", {
      pageType: "purchase",
      event_id: orderId,
      user_properties: userProperties,
      ecommerce
    });
  }
  /**
   * Create view_search_results event (GA4 format)
   */
  static createViewSearchResultsEvent(items, searchTerm) {
    const currency = EventBuilder.getCurrency();
    const formattedItems = items.map(
      (item, index2) => EventBuilder.formatEcommerceItem(item, index2, { name: "search results" })
    );
    const ecommerce = {
      currency,
      items: formattedItems,
      item_list_name: "search results"
    };
    return EventBuilder.createEvent("dl_view_search_results", {
      user_properties: EventBuilder.getUserProperties(),
      ecommerce,
      search_term: searchTerm
    });
  }
  /**
   * Create view_cart event (GA4 format)
   */
  static createViewCartEvent() {
    const cartState = useCartStore.getState();
    const ecommerce = this.buildCartEcommerce();
    return EventBuilder.createEvent("dl_view_cart", {
      user_properties: EventBuilder.getUserProperties(),
      cart_total: String(cartState.total.toNumber() || "0.00"),
      ecommerce
    });
  }
  /**
   * Create cart_updated event (GA4 format). Fires on any cart change and carries
   * the same GA4 `ecommerce` block as view_cart, so every provider receives the
   * full line items — not just the thin `cart` summary the AutoEventListener
   * attaches for backward compatibility.
   */
  static createCartUpdatedEvent() {
    const cartState = useCartStore.getState();
    const ecommerce = this.buildCartEcommerce();
    return EventBuilder.createEvent("dl_cart_updated", {
      user_properties: EventBuilder.getUserProperties(),
      cart_total: String(cartState.total.toNumber() || "0.00"),
      ecommerce
    });
  }
  /**
   * Create add_shipping_info event
   * Fires when user enters or confirms shipping details
   */
  static createAddShippingInfoEvent(shippingTier) {
    const cartState = useCartStore.getState();
    const ecommerce = this.buildCartEcommerce();
    ecommerce.currencyCode = ecommerce.currency;
    if (shippingTier) ecommerce.shipping_tier = shippingTier;
    return EventBuilder.createEvent("dl_add_shipping_info", {
      ecommerce,
      event_category: "ecommerce",
      event_value: cartState.total.toNumber(),
      shipping_tier: shippingTier
    });
  }
  /**
   * Create add_payment_info event
   * Fires when user enters or confirms payment method
   */
  static createAddPaymentInfoEvent(paymentType) {
    const cartState = useCartStore.getState();
    const ecommerce = this.buildCartEcommerce();
    if (paymentType) ecommerce.payment_type = paymentType;
    return EventBuilder.createEvent("dl_add_payment_info", {
      ecommerce,
      event_category: "ecommerce",
      event_value: cartState.total.toNumber(),
      payment_type: paymentType
    });
  }
  /**
   * Create accepted_upsell event (dl_upsell_purchase format)
   * Fires when user accepts an upsell offer
   * Uses GA4 format with proper transaction_id and value
   */
  static createAcceptedUpsellEvent(data) {
    const {
      orderId,
      packageId,
      packageName,
      quantity = 1,
      value = 0,
      discount,
      coupon,
      currency = "USD",
      upsellNumber = 1,
      item
    } = data;
    const upsellOrderId = `${orderId}-US${upsellNumber}`;
    let packageData;
    let campaignName = "Campaign";
    try {
      const campaign = useCampaignStore.getState().data;
      if (campaign) {
        campaignName = campaign.name || "Campaign";
        packageData = campaign.packages?.find(
          (p) => String(p.ref_id) === String(packageId)
        );
      }
    } catch (error) {
      logger$8.warn("Could not access campaign store for upsell data:", error);
    }
    const perUnitPrice = quantity > 0 ? value / quantity : value;
    const perUnitDiscount = discount !== void 0 && quantity > 0 ? discount / quantity : discount;
    const upsellItem = item ? EventBuilder.formatEcommerceItem(item) : {
      item_id: packageData?.product_sku || `SKU-${packageId}`,
      item_name: packageName || packageData?.product_name || `Package ${packageId}`,
      item_brand: packageData?.product_name || campaignName,
      item_category: campaignName,
      item_variant: packageData?.product_variant_name || "",
      price: perUnitPrice,
      quantity,
      currency,
      ...perUnitDiscount && perUnitDiscount > 0 ? { discount: Math.round(perUnitDiscount * 100) / 100 } : {}
    };
    if (item) {
      upsellItem.quantity = quantity;
      upsellItem.price = perUnitPrice;
      if (perUnitDiscount && perUnitDiscount > 0) {
        upsellItem.discount = Math.round(perUnitDiscount * 100) / 100;
      }
    }
    const additionalRevenue = value;
    const ecommerce = {
      currency,
      transaction_id: upsellOrderId,
      value: additionalRevenue,
      tax: 0,
      shipping: 0,
      affiliation: "Upsell",
      items: [upsellItem]
    };
    if (coupon) {
      ecommerce.coupon = coupon;
    }
    const userProperties = EventBuilder.getUserProperties();
    return EventBuilder.createEvent("dl_upsell_purchase", {
      pageType: "upsell",
      event_id: upsellOrderId,
      user_properties: userProperties,
      ecommerce,
      // Flag for pending events handler to queue this event
      _willRedirect: true,
      // Additional metadata for tracking
      upsell_metadata: {
        original_order_id: orderId,
        upsell_number: upsellNumber,
        package_id: packageId.toString(),
        package_name: packageName || `Package ${packageId}`
      }
    });
  }
}
const logger$7 = createLogger("MetaTagController");
class MetaTagController {
  constructor() {
    this.config = {
      disabledEvents: [],
      enabledOnlyEvents: [],
      listContext: {},
      viewItemListPackageIds: [],
      scrollThresholds: []
    };
    this.initialized = false;
    this.viewItemFired = false;
    this.viewItemListFired = false;
    this.reachedScrollThresholds = /* @__PURE__ */ new Set();
  }
  static getInstance() {
    if (!MetaTagController.instance) {
      MetaTagController.instance = new MetaTagController();
    }
    return MetaTagController.instance;
  }
  /**
   * Initialize the meta tag controller
   * Parses all analytics meta tags and sets up tracking
   */
  initialize() {
    if (this.initialized) {
      logger$7.debug("MetaTagController already initialized");
      return;
    }
    logger$7.info("Initializing MetaTagController...");
    this.config = {
      disabledEvents: this.parseArray("next-analytics-disable"),
      enabledOnlyEvents: this.parseArray("next-analytics-enable-only"),
      listContext: this.parseListContext(),
      viewItem: this.parseViewItemConfig(),
      viewItemListPackageIds: this.parseViewItemListConfig(),
      scrollThresholds: this.parseScrollThresholds()
    };
    logger$7.debug("Parsed meta tag config:", this.config);
    if (this.config.listContext.id || this.config.listContext.name) {
      const listTracker = ListAttributionTracker.getInstance();
      listTracker.setCurrentList(
        this.config.listContext.id,
        this.config.listContext.name
      );
      logger$7.info("Set list context from meta tags:", this.config.listContext);
    }
    if (this.config.viewItem) {
      this.fireViewItemEvent(this.config.viewItem);
    }
    if (this.config.viewItemListPackageIds.length > 0) {
      this.fireViewItemListEvent(this.config.viewItemListPackageIds);
    }
    if (this.config.scrollThresholds.length > 0) {
      this.setupScrollTracking();
    }
    this.initialized = true;
    logger$7.info("MetaTagController initialized", {
      hasViewItem: !!this.config.viewItem,
      viewItemListCount: this.config.viewItemListPackageIds.length,
      disabledEvents: this.config.disabledEvents,
      enabledOnlyEvents: this.config.enabledOnlyEvents
    });
  }
  /**
   * Check if event should be blocked globally (all providers)
   */
  shouldBlockEvent(eventName) {
    if (this.config.enabledOnlyEvents.length > 0) {
      const blocked2 = !this.config.enabledOnlyEvents.includes(eventName);
      if (blocked2) {
        logger$7.debug(`Event ${eventName} blocked by enable-only whitelist`);
      }
      return blocked2;
    }
    const blocked = this.config.disabledEvents.includes(eventName);
    if (blocked) {
      logger$7.debug(`Event ${eventName} blocked by disable list`);
    }
    return blocked;
  }
  /**
   * Check if meta tag should override auto-detection for this event
   * When true, ViewItemListTracker should skip auto-detection
   */
  hasMetaTagOverride(eventName) {
    if (eventName === "dl_view_item" && this.config.viewItem) {
      return true;
    }
    if (eventName === "dl_view_item_list" && this.config.viewItemListPackageIds.length > 0) {
      return true;
    }
    return false;
  }
  /**
   * Check if view_item event was fired from meta tag
   */
  wasViewItemFired() {
    return this.viewItemFired;
  }
  /**
   * Check if view_item_list event was fired from meta tag
   */
  wasViewItemListFired() {
    return this.viewItemListFired;
  }
  /**
   * Get the list context from meta tags
   */
  getListContext() {
    return this.config.listContext;
  }
  /**
   * Parse view_item meta tag configuration
   * Supports: content="123" or content="url:param_name" with optional trigger attribute
   */
  parseViewItemConfig() {
    const meta = document.querySelector('meta[name="next-analytics-view-item"]');
    if (!meta || !meta.content) return void 0;
    const content = meta.content.trim();
    const trigger = meta.getAttribute("trigger") || void 0;
    if (content.startsWith("url:")) {
      const paramName = content.substring(4);
      const urlParams = new URLSearchParams(window.location.search);
      const packageId = urlParams.get(paramName);
      if (!packageId) {
        logger$7.warn(`URL param "${paramName}" not found for view_item event`);
        return void 0;
      }
      logger$7.info(`Parsed view_item from URL param: ${paramName}=${packageId}`);
      return { packageId, trigger, fromUrl: true };
    }
    logger$7.info(`Parsed view_item from meta tag: packageId=${content}, trigger=${trigger || "immediate"}`);
    return { packageId: content, trigger };
  }
  /**
   * Parse view_item_list meta tag configuration
   * Supports: content="123,456,789" or content="url:param_name"
   */
  parseViewItemListConfig() {
    const meta = document.querySelector('meta[name="next-analytics-view-item-list"]');
    if (!meta || !meta.content) return [];
    const content = meta.content.trim();
    if (content.startsWith("url:")) {
      const paramName = content.substring(4);
      const urlParams = new URLSearchParams(window.location.search);
      const paramValue = urlParams.get(paramName);
      if (!paramValue) {
        logger$7.warn(`URL param "${paramName}" not found for view_item_list event`);
        return [];
      }
      const ids2 = paramValue.split(",").map((s) => s.trim()).filter((s) => s);
      logger$7.info(`Parsed view_item_list from URL param: ${paramName}=${ids2.join(",")}`);
      return ids2;
    }
    const ids = content.split(",").map((s) => s.trim()).filter((s) => s);
    logger$7.info(`Parsed view_item_list from meta tag: ${ids.join(",")}`);
    return ids;
  }
  /**
   * Fire view_item event based on meta tag configuration
   */
  fireViewItemEvent(config) {
    const campaignStore = useCampaignStore.getState();
    if (!campaignStore.data || !campaignStore.packages || campaignStore.packages.length === 0) {
      logger$7.debug("Campaign data not yet loaded, deferring view_item event");
      setTimeout(() => {
        if (!this.viewItemFired) {
          this.fireViewItemEvent(config);
        }
      }, 1e3);
      return;
    }
    const packageIdNum = parseInt(config.packageId, 10);
    const packageData = campaignStore.packages.find(
      (p) => p.ref_id === packageIdNum || String(p.ref_id) === config.packageId || String(p.external_id) === config.packageId
    );
    if (!packageData) {
      logger$7.warn(`Package ${config.packageId} not found for view_item event`);
      return;
    }
    const fireEvent = () => {
      if (this.viewItemFired) {
        logger$7.debug("view_item already fired from meta tag, skipping");
        return;
      }
      const item = {
        packageId: packageData.ref_id,
        package_id: packageData.ref_id,
        id: packageData.ref_id
      };
      const event = EcommerceEvents.createViewItemEvent(item);
      dataLayer.push(event);
      this.viewItemFired = true;
      logger$7.info("Fired dl_view_item from meta tag:", {
        packageId: config.packageId,
        productName: packageData.product_name || packageData.name,
        trigger: config.trigger || "immediate"
      });
    };
    if (!config.trigger) {
      fireEvent();
      return;
    }
    const [triggerType, triggerValue] = config.trigger.split(":");
    if (triggerType === "time") {
      const duration = parseInt(triggerValue, 10);
      if (!isNaN(duration) && duration > 0) {
        logger$7.debug(`Scheduling view_item to fire after ${duration}ms`);
        setTimeout(fireEvent, duration);
      } else {
        logger$7.warn(`Invalid time trigger value: ${triggerValue}, firing immediately`);
        fireEvent();
      }
    } else if (triggerType === "view") {
      const selector = triggerValue;
      const element = document.querySelector(selector);
      if (element) {
        logger$7.debug(`Setting up IntersectionObserver for view_item trigger: ${selector}`);
        const observer = new IntersectionObserver((entries) => {
          if (entries[0]?.isIntersecting) {
            fireEvent();
            observer.disconnect();
          }
        }, { threshold: 0.5 });
        observer.observe(element);
      } else {
        logger$7.warn(`Element ${selector} not found for view_item trigger, firing immediately`);
        fireEvent();
      }
    } else {
      logger$7.warn(`Unknown trigger type: ${triggerType}, firing immediately`);
      fireEvent();
    }
  }
  /**
   * Fire view_item_list event for multiple packages
   */
  fireViewItemListEvent(packageIds) {
    const campaignStore = useCampaignStore.getState();
    if (!campaignStore.data || !campaignStore.packages || campaignStore.packages.length === 0) {
      logger$7.debug("Campaign data not yet loaded, deferring view_item_list event");
      setTimeout(() => {
        if (!this.viewItemListFired) {
          this.fireViewItemListEvent(packageIds);
        }
      }, 1e3);
      return;
    }
    if (this.viewItemListFired) {
      logger$7.debug("view_item_list already fired from meta tag, skipping");
      return;
    }
    const items = [];
    packageIds.forEach((packageId) => {
      const packageIdNum = parseInt(packageId, 10);
      const packageData = campaignStore.packages.find(
        (p) => p.ref_id === packageIdNum || String(p.ref_id) === packageId || String(p.external_id) === packageId
      );
      if (packageData) {
        items.push({
          packageId: packageData.ref_id,
          package_id: packageData.ref_id,
          id: packageData.ref_id
        });
      } else {
        logger$7.warn(`Package ${packageId} not found for view_item_list event`);
      }
    });
    if (items.length === 0) {
      logger$7.warn("No valid packages found for view_item_list event");
      return;
    }
    const event = EcommerceEvents.createViewItemListEvent(
      items,
      this.config.listContext.id,
      this.config.listContext.name
    );
    dataLayer.push(event);
    this.viewItemListFired = true;
    logger$7.info("Fired dl_view_item_list from meta tag:", {
      packageCount: items.length,
      packageIds: items.map((i) => i.packageId),
      listId: this.config.listContext.id,
      listName: this.config.listContext.name
    });
  }
  /**
   * Parse list context meta tags
   */
  parseListContext() {
    const id = this.getMeta("next-analytics-list-id");
    const name = this.getMeta("next-analytics-list-name");
    return {
      id: id || void 0,
      name: name || void 0
    };
  }
  /**
   * Parse comma-separated array from meta tag
   */
  parseArray(metaName) {
    const content = this.getMeta(metaName);
    if (!content) return [];
    return content.split(",").map((s) => s.trim()).filter((s) => s);
  }
  /**
   * Parse scroll tracking thresholds
   */
  parseScrollThresholds() {
    const content = this.getMeta("next-analytics-scroll-tracking");
    if (!content) return [];
    return content.split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n) && n > 0 && n <= 100).sort((a, b) => a - b);
  }
  /**
   * Set up scroll depth tracking
   */
  setupScrollTracking() {
    const thresholds = this.config.scrollThresholds;
    if (thresholds.length === 0) return;
    logger$7.info("Setting up scroll tracking for thresholds:", thresholds);
    const scrollHandler = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const scrollPercent = window.scrollY / scrollHeight * 100;
      thresholds.forEach((threshold) => {
        if (scrollPercent >= threshold && !this.reachedScrollThresholds.has(threshold)) {
          this.reachedScrollThresholds.add(threshold);
          const event = EventBuilder.createEvent("dl_scroll_depth", {
            user_properties: EventBuilder.getUserProperties(),
            scroll_depth: Math.round(scrollPercent),
            scroll_threshold: threshold,
            page_height: document.documentElement.scrollHeight,
            viewport_height: window.innerHeight
          });
          dataLayer.push(event);
          logger$7.debug(`Fired dl_scroll_depth at ${threshold}%`);
        }
      });
      if (this.reachedScrollThresholds.size === thresholds.length) {
        window.removeEventListener("scroll", scrollHandler);
        logger$7.debug("All scroll thresholds reached, removing listener");
      }
    };
    window.addEventListener("scroll", scrollHandler, { passive: true });
    scrollHandler();
  }
  /**
   * Get meta tag content by name
   */
  getMeta(name) {
    const meta = document.querySelector(`meta[name="${name}"]`);
    return meta?.content?.trim() || null;
  }
  /**
   * Reset the controller (for testing or route changes)
   */
  reset() {
    this.viewItemFired = false;
    this.viewItemListFired = false;
    this.reachedScrollThresholds.clear();
    logger$7.debug("MetaTagController reset");
  }
  /**
   * Get current status for debugging
   */
  getStatus() {
    return {
      initialized: this.initialized,
      config: { ...this.config },
      viewItemFired: this.viewItemFired,
      viewItemListFired: this.viewItemListFired,
      scrollThresholdsReached: Array.from(this.reachedScrollThresholds)
    };
  }
}
const metaTagController = MetaTagController.getInstance();
const logger$6 = createLogger("ViewItemListTracker");
class ViewItemListTracker {
  constructor() {
    this.observer = null;
    this.trackedProducts = /* @__PURE__ */ new Set();
    this.lastScanTime = 0;
    this.scanDebounceMs = 500;
    this.isInitialized = false;
  }
  static getInstance() {
    if (!ViewItemListTracker.instance) {
      ViewItemListTracker.instance = new ViewItemListTracker();
    }
    return ViewItemListTracker.instance;
  }
  /**
   * Initialize the tracker
   */
  initialize() {
    if (this.isInitialized || typeof window === "undefined") {
      return;
    }
    this.isInitialized = true;
    dataLayer.initialize();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.scan());
    } else {
      setTimeout(() => this.scan(), 100);
    }
    this.setupObserver();
    logger$6.info("ViewItemListTracker initialized");
  }
  /**
   * Scan the page for products and fire appropriate events
   */
  scan() {
    const now = Date.now();
    if (now - this.lastScanTime < this.scanDebounceMs) {
      logger$6.debug("Scan debounced (too soon after last scan)");
      return;
    }
    this.lastScanTime = now;
    const hasViewItemOverride = metaTagController.hasMetaTagOverride("dl_view_item");
    const hasViewItemListOverride = metaTagController.hasMetaTagOverride("dl_view_item_list");
    if (hasViewItemOverride && hasViewItemListOverride) {
      logger$6.debug("Both view_item and view_item_list handled by meta tags, skipping auto-detection");
      return;
    }
    const products = this.findProductElements();
    if (products.length === 0) {
      logger$6.debug("No products found on page");
      return;
    }
    logger$6.debug(`Found ${products.length} products on page`);
    if (products.length === 1) {
      if (hasViewItemOverride) {
        logger$6.debug("view_item handled by meta tag, skipping auto-detection");
      } else {
        const product = products[0];
        if (product) {
          this.trackViewItem(product);
        }
      }
    } else {
      if (hasViewItemListOverride) {
        logger$6.debug("view_item_list handled by meta tag, skipping auto-detection");
      } else {
        this.trackViewItemList(products);
      }
      if (!hasViewItemOverride) {
        this.trackSelectedItemInSelectors();
      }
    }
  }
  /**
   * Rescan the page (public method for manual triggering)
   */
  rescan() {
    logger$6.debug("Manual rescan triggered");
    this.trackedProducts.clear();
    this.scan();
  }
  /**
   * Find all product elements on the page
   */
  findProductElements() {
    const swapSelectors = document.querySelectorAll('[data-next-selection-mode="swap"]');
    const selectSelectors = document.querySelectorAll('[data-next-selection-mode="select"]');
    const products = [];
    const seen = /* @__PURE__ */ new Set();
    if (swapSelectors.length > 0) {
      swapSelectors.forEach((selector) => {
        const selectedCard = selector.querySelector('[data-next-selector-card][data-next-selected="true"]');
        if (selectedCard) {
          const packageId = selectedCard.getAttribute("data-next-package-id");
          if (packageId && !seen.has(packageId)) {
            seen.add(packageId);
            products.push({
              packageId,
              element: selectedCard,
              index: products.length
            });
          }
        }
      });
    }
    if (selectSelectors.length > 0) {
      selectSelectors.forEach((selector) => {
        const selectorCards = selector.querySelectorAll("[data-next-selector-card]");
        selectorCards.forEach((card, index2) => {
          const packageId = card.getAttribute("data-next-package-id");
          if (packageId && !seen.has(packageId)) {
            seen.add(packageId);
            products.push({
              packageId,
              element: card,
              index: products.length
            });
          }
        });
      });
    }
    if (products.length > 0) {
      logger$6.debug(`Found ${products.length} products in selectors`);
      return products;
    }
    const elements = document.querySelectorAll("[data-next-package-id]");
    elements.forEach((element, index2) => {
      const isSelectorCard = element.hasAttribute("data-next-selector-card") && (element.closest('[data-next-selection-mode="swap"]') || element.closest('[data-next-selection-mode="select"]'));
      if (isSelectorCard) {
        return;
      }
      const packageId = element.getAttribute("data-next-package-id");
      if (packageId && !seen.has(packageId)) {
        seen.add(packageId);
        products.push({
          packageId,
          element,
          index: index2
        });
      }
    });
    return products;
  }
  /**
   * Track selected items in select mode selectors
   * This fires view_item events for the currently selected package in each selector
   */
  trackSelectedItemInSelectors() {
    const selectSelectors = document.querySelectorAll('[data-next-selection-mode="select"]');
    selectSelectors.forEach((selector) => {
      const selectedCard = selector.querySelector('[data-next-selector-card][data-next-selected="true"]');
      if (selectedCard) {
        const packageId = selectedCard.getAttribute("data-next-package-id");
        if (packageId) {
          const product = {
            packageId,
            element: selectedCard,
            index: 0
          };
          this.trackViewItemForSelected(product);
        }
      }
    });
  }
  /**
   * Track a single product view (for selected items, doesn't add to trackedProducts set)
   */
  trackViewItemForSelected(product) {
    const campaignStore = useCampaignStore.getState();
    if (!campaignStore.data || !campaignStore.packages || campaignStore.packages.length === 0) {
      logger$6.debug("Campaign data not yet loaded, deferring tracking");
      return;
    }
    const packageIdNum = parseInt(product.packageId, 10);
    const packageData = !isNaN(packageIdNum) ? campaignStore.getPackage(packageIdNum) : null;
    if (!packageData) {
      logger$6.warn("Package not found in store:", product.packageId);
      return;
    }
    const item = {
      packageId: packageIdNum,
      // EventBuilder will use this to lookup package data from campaign store
      package_id: packageIdNum,
      id: packageIdNum
    };
    const event = EcommerceEvents.createViewItemEvent(item);
    dataLayer.push(event);
    logger$6.debug("Tracked view_item for selected package:", product.packageId);
  }
  /**
   * Track a single product view
   */
  trackViewItem(product) {
    if (this.trackedProducts.has(product.packageId)) {
      logger$6.debug("Product already tracked:", product.packageId);
      return;
    }
    const campaignStore = useCampaignStore.getState();
    if (!campaignStore.data || !campaignStore.packages || campaignStore.packages.length === 0) {
      logger$6.debug("Campaign data not yet loaded, deferring tracking");
      setTimeout(() => this.scan(), 1e3);
      return;
    }
    const packageIdNum = parseInt(product.packageId, 10);
    const packageData = !isNaN(packageIdNum) ? campaignStore.getPackage(packageIdNum) : null;
    if (!packageData) {
      logger$6.warn("Package not found in store:", product.packageId);
      return;
    }
    const item = {
      packageId: packageIdNum,
      // EventBuilder will use this to lookup package data from campaign store
      package_id: packageIdNum,
      id: packageIdNum
    };
    const event = EcommerceEvents.createViewItemEvent(item);
    dataLayer.push(event);
    this.trackedProducts.add(product.packageId);
    logger$6.debug("Tracked view_item:", product.packageId);
  }
  /**
   * Track multiple products view
   */
  trackViewItemList(products) {
    const campaignStore = useCampaignStore.getState();
    const items = [];
    if (!campaignStore.data || !campaignStore.packages || campaignStore.packages.length === 0) {
      logger$6.debug("Campaign data not yet loaded, deferring tracking");
      setTimeout(() => this.scan(), 1e3);
      return;
    }
    const listContext = listAttributionTracker.getCurrentList() || listAttributionTracker.detectListFromUrl() || { listId: "product_list", listName: "Product List" };
    products.forEach((product, index2) => {
      if (this.trackedProducts.has(product.packageId)) {
        return;
      }
      const packageIdNum = parseInt(product.packageId, 10);
      const packageData = !isNaN(packageIdNum) ? campaignStore.getPackage(packageIdNum) : null;
      if (!packageData) {
        logger$6.warn("Package not found in store:", product.packageId);
        return;
      }
      items.push({
        packageId: packageIdNum,
        // EventBuilder will use this to lookup package data from campaign store
        package_id: packageIdNum,
        id: packageIdNum
      });
      this.trackedProducts.add(product.packageId);
    });
    if (items.length === 0) {
      logger$6.debug("No new products to track");
      return;
    }
    const event = EcommerceEvents.createViewItemListEvent(items, listContext.listId, listContext.listName);
    dataLayer.push(event);
    logger$6.debug(`Tracked view_item_list with ${items.length} items`);
  }
  /**
   * Set up mutation observer for dynamic content
   */
  setupObserver() {
    if (typeof window === "undefined" || !window.MutationObserver) {
      return;
    }
    this.observer = new MutationObserver((mutations) => {
      let hasRelevantChanges = false;
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (node && node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              if (element.hasAttribute("data-next-package-id") || element.querySelector("[data-next-package-id]")) {
                hasRelevantChanges = true;
                break;
              }
            }
          }
        } else if (mutation.type === "attributes") {
          if (mutation.attributeName === "data-next-package-id") {
            hasRelevantChanges = true;
          } else if (mutation.attributeName === "data-next-selected" && mutation.target instanceof Element && mutation.target.closest('[data-next-selection-mode="swap"]')) {
            const swapSelector = mutation.target.closest('[data-next-selection-mode="swap"]');
            if (swapSelector) {
              const selectorCards = swapSelector.querySelectorAll("[data-next-selector-card]");
              selectorCards.forEach((card) => {
                const pkgId = card.getAttribute("data-next-package-id");
                if (pkgId) {
                  this.trackedProducts.delete(pkgId);
                }
              });
            }
            hasRelevantChanges = true;
          }
        }
        if (hasRelevantChanges) {
          break;
        }
      }
      if (hasRelevantChanges) {
        logger$6.debug("Detected DOM changes with products");
        this.scan();
      }
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-next-package-id", "data-next-selected"]
    });
    logger$6.debug("Mutation observer set up");
  }
  /**
   * Reset the tracker (for route changes)
   */
  reset() {
    this.trackedProducts.clear();
    logger$6.debug("ViewItemListTracker reset");
    if (this.isInitialized) {
      this.scan();
    }
  }
  /**
   * Clean up the tracker
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.trackedProducts.clear();
    this.isInitialized = false;
    logger$6.debug("ViewItemListTracker destroyed");
  }
  /**
   * Get tracking status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      trackedCount: this.trackedProducts.size,
      observing: this.observer !== null
    };
  }
}
ViewItemListTracker.getInstance();
const logger$5 = createLogger("UserDataStorage");
class UserDataStorage {
  // 1 year
  constructor() {
    this.userData = {};
    this.cookieExpiryDays = 365;
    this.loadUserData();
  }
  static getInstance() {
    if (!UserDataStorage.instance) {
      UserDataStorage.instance = new UserDataStorage();
    }
    return UserDataStorage.instance;
  }
  /**
   * Set a cookie with user data
   */
  setCookie(name, value, days) {
    if (typeof document === "undefined") return;
    const date = /* @__PURE__ */ new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1e3);
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax`;
  }
  /**
   * Get a cookie value
   */
  getCookie(name) {
    if (typeof document === "undefined") return null;
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.indexOf(nameEQ) === 0) {
        return decodeURIComponent(cookie.substring(nameEQ.length));
      }
    }
    return null;
  }
  /**
   * Delete a cookie
   */
  deleteCookie(name) {
    if (typeof document === "undefined") return;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  }
  /**
   * Load user data from cookies and storage
   */
  loadUserData() {
    if (typeof window === "undefined") return;
    try {
      const cookieData = this.getCookie("next_user_data");
      if (cookieData) {
        try {
          this.userData = JSON.parse(cookieData);
          logger$5.debug("Loaded user data from cookie:", {
            hasEmail: !!this.userData.email,
            hasUserId: !!this.userData.userId
          });
        } catch (error) {
          logger$5.warn("Failed to parse user data cookie:", error);
        }
      }
      const sessionData = sessionStorage.getItem("user_data");
      if (sessionData) {
        try {
          const parsedSession = JSON.parse(sessionData);
          this.userData = { ...this.userData, ...parsedSession };
          logger$5.debug("Merged user data from sessionStorage");
        } catch (error) {
          logger$5.warn("Failed to parse sessionStorage user data:", error);
        }
      }
      if (!this.userData.visitorId) {
        let visitorId = localStorage.getItem("visitor_id");
        if (!visitorId) {
          visitorId = this.generateId("visitor");
          localStorage.setItem("visitor_id", visitorId);
        }
        this.userData.visitorId = visitorId;
      }
      if (!this.userData.sessionId) {
        let sessionId = sessionStorage.getItem("session_id");
        if (!sessionId) {
          sessionId = this.generateId("session");
          sessionStorage.setItem("session_id", sessionId);
        }
        this.userData.sessionId = sessionId;
      }
    } catch (error) {
      logger$5.error("Failed to load user data:", error);
    }
  }
  /**
   * Save user data to cookie and storage
   */
  saveUserData() {
    if (typeof window === "undefined") return;
    try {
      const dataToSave = JSON.stringify(this.userData);
      this.setCookie("next_user_data", dataToSave, this.cookieExpiryDays);
      sessionStorage.setItem("user_data", dataToSave);
      logger$5.debug("Saved user data to storage:", {
        hasEmail: !!this.userData.email,
        hasUserId: !!this.userData.userId
      });
    } catch (error) {
      logger$5.error("Failed to save user data:", error);
    }
  }
  /**
   * Generate a unique ID
   */
  generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${randomStr}`;
  }
  /**
   * Update user data
   */
  updateUserData(data) {
    const previousEmail = this.userData.email;
    this.userData = { ...this.userData, ...data };
    Object.keys(this.userData).forEach((key) => {
      if (this.userData[key] === void 0 || this.userData[key] === null || this.userData[key] === "") {
        delete this.userData[key];
      }
    });
    this.saveUserData();
    if (data.email && data.email !== previousEmail) {
      logger$5.info("User email updated:", data.email);
    }
  }
  /**
   * Get all user data
   */
  getUserData() {
    return { ...this.userData };
  }
  /**
   * Get specific user data field
   */
  getUserField(field) {
    return this.userData[field];
  }
  /**
   * Clear user data (logout)
   */
  clearUserData() {
    const { visitorId, sessionId } = this.userData;
    this.userData = {};
    if (visitorId !== void 0) {
      this.userData.visitorId = visitorId;
    }
    if (sessionId !== void 0) {
      this.userData.sessionId = sessionId;
    }
    this.deleteCookie("next_user_data");
    sessionStorage.removeItem("user_data");
    logger$5.info("User data cleared");
  }
  /**
   * Check if user is identified (has email or userId)
   */
  isIdentified() {
    return !!(this.userData.email || this.userData.userId);
  }
  /**
   * Update from checkout form fields
   */
  updateFromFormFields() {
    if (typeof document === "undefined") return;
    const updates = {};
    const fieldMappings = [
      { selector: '[name="email"], [data-next-checkout-field="email"], #email, [type="email"]', key: "email" },
      { selector: '[name="phone"], [data-next-checkout-field="phone"], #phone, [type="tel"]', key: "phone" },
      { selector: '[name="first_name"], [data-next-checkout-field="fname"], [name="firstName"], #first-name', key: "firstName" },
      { selector: '[name="last_name"], [data-next-checkout-field="lname"], [name="lastName"], #last-name', key: "lastName" }
    ];
    let hasUpdates = false;
    fieldMappings.forEach(({ selector, key }) => {
      const element = document.querySelector(selector);
      if (element && element.value && element.value !== this.userData[key]) {
        updates[key] = element.value;
        hasUpdates = true;
      }
    });
    if (hasUpdates) {
      this.updateUserData(updates);
      logger$5.debug("Updated user data from form fields:", updates);
    }
  }
}
const userDataStorage = UserDataStorage.getInstance();
const logger$4 = createLogger("UserEvents");
class UserEvents {
  /**
   * Create base user data event (GA4 format)
   * This is the foundation for all user-related events
   */
  static createUserDataEvent(eventName, userData, additionalData) {
    const userProperties = {
      ...EventBuilder.getUserProperties(),
      ...userData
    };
    if (eventName === "dl_user_data") {
      try {
        if (typeof window !== "undefined") {
          const cartState = useCartStore.getState();
          const campaignState = useCampaignStore.getState();
          const currency = campaignState?.currency ?? "USD";
          const cartItems = cartState?.items || [];
          const items = cartItems.length > 0 ? cartItems.map((item, idx) => EventBuilder.formatEcommerceItem(item, idx)) : [];
          const cartValue = EventBuilder.sumItemsValue(items);
          const cartTotal = cartState?.total?.toNumber() ?? 0;
          const ecommerce = {
            currency,
            value: cartValue,
            items
            // GA4 expects items array (can be empty)
          };
          return EventBuilder.createEvent(eventName, {
            user_properties: userProperties,
            cart_total: String(cartTotal),
            ecommerce,
            ...additionalData
          });
        }
      } catch (error) {
        logger$4.warn("Could not add cart contents to user data event:", error);
      }
    }
    return EventBuilder.createEvent(eventName, {
      user_properties: userProperties,
      event_category: "user",
      ...additionalData
    });
  }
  /**
   * Create sign_up event
   */
  static createSignUpEvent(method = "email", userData) {
    return this.createUserDataEvent("dl_sign_up", userData, {
      event_label: method,
      custom_properties: {
        method,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
  /**
   * Create login event
   */
  static createLoginEvent(method = "email", userData) {
    const enrichedUserData = {
      ...userData,
      visitor_type: userData?.customer_id ? "logged_in" : "guest"
    };
    return this.createUserDataEvent("dl_login", enrichedUserData, {
      event_label: method,
      custom_properties: {
        method,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
  /**
   * Create subscribe event (for email/SMS subscriptions)
   */
  static createSubscribeEvent(channel = "email", subscriptionData, userData) {
    const leadType = channel === "sms" || channel === "push" ? "phone" : "email";
    return this.createUserDataEvent("dl_subscribe", userData, {
      lead_type: leadType,
      event_label: channel,
      custom_properties: {
        channel,
        subscription_details: subscriptionData,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
  /**
   * Create user profile update event
   */
  static createProfileUpdateEvent(updatedFields, userData) {
    return this.createUserDataEvent("profile_update", userData, {
      event_label: `Updated: ${updatedFields.join(", ")}`,
      custom_properties: {
        updated_fields: updatedFields,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
  /**
   * Create email verification event
   */
  static createEmailVerificationEvent(status, userData) {
    return this.createUserDataEvent("email_verification", userData, {
      event_label: status,
      custom_properties: {
        verification_status: status,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
  /**
   * Create account deletion event
   */
  static createAccountDeletionEvent(reason, userData) {
    return this.createUserDataEvent("account_deletion", userData, {
      event_label: reason || "user_initiated",
      custom_properties: {
        deletion_reason: reason,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
  /**
   * Create password reset event
   */
  static createPasswordResetEvent(step, userData) {
    return this.createUserDataEvent("password_reset", userData, {
      event_label: step,
      custom_properties: {
        reset_step: step,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
  /**
   * Create user consent event (for GDPR/privacy)
   */
  static createConsentEvent(consentType, granted, userData) {
    return this.createUserDataEvent("user_consent", userData, {
      event_label: `${consentType}_${granted ? "granted" : "denied"}`,
      custom_properties: {
        consent_type: consentType,
        consent_granted: granted,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
}
const logger$3 = createLogger("UserDataTracker");
class UserDataTracker {
  // Track if initial event has been fired
  constructor() {
    this.eventBus = EventBus.getInstance();
    this.lastTrackTime = 0;
    this.trackDebounceMs = 1e3;
    this.isInitialized = false;
    this.unsubscribers = [];
    this.hasTrackedInitial = false;
  }
  static getInstance() {
    if (!UserDataTracker.instance) {
      UserDataTracker.instance = new UserDataTracker();
    }
    return UserDataTracker.instance;
  }
  /**
   * Initialize the tracker
   */
  initialize() {
    if (this.isInitialized || typeof window === "undefined") {
      return;
    }
    this.isInitialized = true;
    dataLayer.initialize();
    this.lastTrackTime = 0;
    this.trackUserData();
    this.hasTrackedInitial = true;
    setTimeout(() => {
      this.setupListeners();
      logger$3.debug("User data tracking listeners set up after initial tracking");
    }, 200);
    logger$3.info("UserDataTracker initialized - dl_user_data fired first");
  }
  /**
   * Track user data event
   */
  trackUserData() {
    const now = Date.now();
    if (this.hasTrackedInitial) {
      const stack = new Error().stack;
      logger$3.debug("trackUserData called after initial:", {
        timeSinceLastTrack: now - this.lastTrackTime,
        willDebounce: now - this.lastTrackTime < this.trackDebounceMs,
        stack: stack?.split("\n").slice(1, 4).join("\n")
      });
    }
    if (now - this.lastTrackTime < this.trackDebounceMs) {
      logger$3.debug("User data tracking debounced");
      return;
    }
    this.lastTrackTime = now;
    const userData = this.collectUserData();
    if (!userData || Object.keys(userData).length === 0) {
      logger$3.debug("No user data to track");
      return;
    }
    const userProperties = {
      customer_email: userData.email,
      customer_phone: userData.phone,
      customer_first_name: userData.firstName,
      customer_last_name: userData.lastName,
      visitor_type: userData.userId ? "logged_in" : "guest"
    };
    Object.keys(userProperties).forEach((key) => {
      if (userProperties[key] === void 0) {
        delete userProperties[key];
      }
    });
    const event = UserEvents.createUserDataEvent("dl_user_data", userProperties);
    dataLayer.push(event);
    logger$3.debug("Tracked user data:", {
      hasUserId: !!userData.userId,
      hasEmail: !!userData.email,
      cartValue: userData.cartValue,
      cartItems: userData.cartItems
    });
  }
  /**
   * Collect user data from stores
   */
  collectUserData() {
    const userData = userDataStorage.getUserData();
    userDataStorage.updateFromFormFields();
    try {
      const cartState = useCartStore.getState();
      if (cartState.items && cartState.items.length > 0) {
        userData.cartValue = cartState.total?.toNumber() || cartState.subtotal?.toNumber() || 0;
        userData.cartItems = cartState.totalQuantity || 0;
        userData.cartProducts = cartState.items.map(
          (item) => item.packageId?.toString() || "unknown"
        );
      } else {
        userData.cartValue = 0;
        userData.cartItems = 0;
        userData.cartProducts = [];
      }
    } catch (error) {
      logger$3.debug("Cart store not available or error accessing:", error);
    }
    try {
      const checkoutData = this.getCheckoutData();
      if (checkoutData) {
        Object.assign(userData, checkoutData);
      }
    } catch (error) {
      logger$3.debug("Error getting checkout data:", error);
    }
    return userData;
  }
  /**
   * Get checkout data from form fields if available
   */
  getCheckoutData() {
    if (typeof document === "undefined") {
      return null;
    }
    const checkoutData = {};
    const fieldMappings = [
      { selector: '[name="email"], #email, [type="email"]', key: "email" },
      { selector: '[name="phone"], #phone, [type="tel"]', key: "phone" },
      { selector: '[name="first_name"], [name="firstName"], #first-name', key: "firstName" },
      { selector: '[name="last_name"], [name="lastName"], #last-name', key: "lastName" },
      { selector: '[name="address"], [name="address1"], #address', key: "address" },
      { selector: '[name="city"], #city', key: "city" },
      { selector: '[name="state"], [name="province"], #state', key: "state" },
      { selector: '[name="zip"], [name="postal_code"], #zip', key: "postalCode" },
      { selector: '[name="country"], #country', key: "country" }
    ];
    fieldMappings.forEach(({ selector, key }) => {
      const element = document.querySelector(selector);
      if (element && element.value) {
        checkoutData[key] = element.value;
      }
    });
    return Object.keys(checkoutData).length > 0 ? checkoutData : null;
  }
  /**
   * Set up event listeners
   */
  setupListeners() {
    this.eventBus.on("route:changed", () => {
      logger$3.debug("Route changed, tracking user data");
      this.trackUserData();
    });
    this.eventBus.on("sdk:route-invalidated", () => {
      logger$3.debug("SDK route invalidated, tracking user data");
      this.trackUserData();
    });
    this.eventBus.on("user:logged-in", () => {
      logger$3.debug("User logged in, tracking user data");
      setTimeout(() => this.trackUserData(), 100);
    });
    this.eventBus.on("user:logged-out", () => {
      logger$3.debug("User logged out, tracking user data");
      setTimeout(() => this.trackUserData(), 100);
    });
    if (typeof window !== "undefined") {
      window.addEventListener("popstate", () => {
        logger$3.debug("Browser navigation, tracking user data");
        this.trackUserData();
      });
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      let lastUrl = window.location.href;
      history.pushState = function(...args) {
        originalPushState.apply(history, args);
        const newUrl = window.location.href;
        if (newUrl !== lastUrl) {
          const oldPath = new URL(lastUrl).pathname;
          const newPath = new URL(newUrl).pathname;
          if (oldPath !== newPath) {
            lastUrl = newUrl;
            logger$3.debug("pushState changed path, tracking user data");
            setTimeout(() => UserDataTracker.getInstance().trackUserData(), 0);
          }
        }
      };
      history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        logger$3.debug("replaceState called, not tracking user data (query param update)");
      };
    }
    logger$3.debug("User data tracking listeners set up");
  }
  /**
   * Force track user data (bypasses debounce)
   */
  forceTrack() {
    this.lastTrackTime = 0;
    this.trackUserData();
  }
  /**
   * Reset the tracker (called by NextAnalytics)
   */
  reset() {
    this.lastTrackTime = 0;
    this.trackUserData();
    logger$3.debug("UserDataTracker reset");
  }
  /**
   * Clean up the tracker
   */
  destroy() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    this.eventBus.removeAllListeners("route:changed");
    this.eventBus.removeAllListeners("sdk:route-invalidated");
    this.eventBus.removeAllListeners("user:logged-in");
    this.eventBus.removeAllListeners("user:logged-out");
    this.isInitialized = false;
    logger$3.debug("UserDataTracker destroyed");
  }
  /**
   * Get tracking status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      lastTrackTime: this.lastTrackTime,
      listenersCount: this.unsubscribers.length
    };
  }
}
UserDataTracker.getInstance();
const logger$2 = createLogger("AutoEventListener");
class AutoEventListener {
  constructor() {
    this.eventBus = EventBus.getInstance();
    this.isInitialized = false;
    this.eventHandlers = /* @__PURE__ */ new Map();
    this.lastEventTimes = /* @__PURE__ */ new Map();
    this.debounceConfig = {
      "cart:item-added": 1e3,
      "cart:item-removed": 500,
      "cart:quantity-changed": 500,
      "cart:updated": 1e3,
      "cart:package-swapped": 100
      // Low debounce since it's already atomic
    };
  }
  static getInstance() {
    if (!AutoEventListener.instance) {
      AutoEventListener.instance = new AutoEventListener();
    }
    return AutoEventListener.instance;
  }
  /**
   * Initialize the auto event listener
   */
  initialize() {
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;
    dataLayer.initialize();
    this.setupCartEventListeners();
    this.setupUpsellEventListeners();
    this.setupCheckoutEventListeners();
    this.setupPageEventListeners();
    this.setupExitIntentEventListeners();
    logger$2.info("AutoEventListener initialized");
  }
  /**
   * Check if event should be processed based on debounce
   */
  shouldProcessEvent(eventName) {
    const now = Date.now();
    const lastTime = this.lastEventTimes.get(eventName) || 0;
    const debounceTime = this.debounceConfig[eventName] || 0;
    if (now - lastTime < debounceTime) {
      logger$2.debug(`Event ${eventName} debounced`);
      return false;
    }
    this.lastEventTimes.set(eventName, now);
    return true;
  }
  /**
   * Resolve once the cart calculation triggered by a mutation has settled.
   *
   * Cart mutations emit their event (e.g. `cart:item-added`) BEFORE the async,
   * debounced `calculateTotals()` runs, so at emit time the line has only
   * catalog prices and not yet the discounted `unit_price` / `total`. Waiting
   * for the next `cart:updated` (emitted after calculation) lets the analytics
   * event report the final, calculated line price. Falls back after `timeoutMs`
   * so tracking never hangs if no calculation occurs.
   */
  waitForCartCalculation(timeoutMs = 3e3) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.eventBus.off("cart:updated", finish);
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      this.eventBus.on("cart:updated", finish);
    });
  }
  /**
   * Set up cart event listeners
   */
  setupCartEventListeners() {
    const handleAddToCart = async (data) => {
      if (!this.shouldProcessEvent("cart:item-added")) {
        return;
      }
      const packageId = data.packageId;
      const quantity = data.quantity || 1;
      const campaignStore = useCampaignStore.getState();
      const packageData = campaignStore.getPackage(packageId);
      if (!packageData) {
        logger$2.warn("Package not found for add to cart:", packageId);
        return;
      }
      const listContext = listAttributionTracker.getCurrentList();
      if (!data.willRedirect) {
        await this.waitForCartCalculation();
      }
      const cartStore = useCartStore.getState();
      const cartItem = cartStore.getItem(packageId);
      const event = EcommerceEvents.createAddToCartEvent(
        cartItem || {
          packageId,
          quantity,
          title: packageData.name,
          price: parseFloat(packageData.price_total),
          productId: packageData.product_id,
          productName: packageData.product_name,
          variantId: packageData.product_variant_id,
          variantName: packageData.product_variant_name,
          variantSku: packageData.product_sku
        },
        listContext?.listId,
        listContext?.listName
      );
      if (data.willRedirect) {
        event._willRedirect = true;
      }
      dataLayer.push(event);
      logger$2.debug("Tracked add to cart:", packageId);
    };
    this.eventBus.on("cart:item-added", handleAddToCart);
    this.eventHandlers.set("cart:item-added", handleAddToCart);
    const handleRemoveFromCart = async (data) => {
      if (!this.shouldProcessEvent("cart:item-removed")) {
        return;
      }
      const packageId = data.packageId;
      const quantity = data.quantity || 1;
      const campaignStore = useCampaignStore.getState();
      const packageData = campaignStore.getPackage(packageId);
      if (!packageData) {
        logger$2.warn("Package not found for remove from cart:", packageId);
        return;
      }
      const event = EcommerceEvents.createRemoveFromCartEvent({
        packageId,
        quantity,
        title: packageData.name,
        price: parseFloat(packageData.price_total),
        productId: packageData.product_id,
        productName: packageData.product_name,
        variantId: packageData.product_variant_id,
        variantName: packageData.product_variant_name,
        variantSku: packageData.product_sku
      });
      dataLayer.push(event);
      logger$2.debug("Tracked remove from cart:", packageId);
    };
    this.eventBus.on("cart:item-removed", handleRemoveFromCart);
    this.eventHandlers.set("cart:item-removed", handleRemoveFromCart);
    const handlePackageSwapped = async (data) => {
      const { previousPackageId, newPackageId, priceDifference } = data;
      const campaignStore = useCampaignStore.getState();
      const previousPackageData = campaignStore.getPackage(previousPackageId);
      const newPackageData = campaignStore.getPackage(newPackageId);
      if (!previousPackageData || !newPackageData) {
        logger$2.warn("Package data not found for swap:", { previousPackageId, newPackageId });
        return;
      }
      const previousItemFormatted = {
        item_id: previousPackageData.external_id.toString(),
        item_name: previousPackageData.name || `Package ${previousPackageId}`,
        currency: campaignStore.currency ?? "USD",
        price: parseFloat(previousPackageData.price_total || "0"),
        quantity: 1,
        item_category: campaignStore.data?.name || "Campaign",
        item_variant: previousPackageData.product_variant_name || previousPackageData.product?.variant?.name,
        item_brand: previousPackageData.product_name || previousPackageData.product?.name,
        item_sku: previousPackageData.product_sku || previousPackageData.product?.variant?.sku || void 0,
        ...previousPackageData.image && { item_image: previousPackageData.image }
      };
      const newItemFormatted = {
        item_id: newPackageData.external_id.toString(),
        item_name: newPackageData.name || `Package ${newPackageId}`,
        currency: campaignStore.currency ?? "USD",
        price: parseFloat(newPackageData.price_total || "0"),
        quantity: 1,
        item_category: campaignStore.data?.name || "Campaign",
        item_variant: newPackageData.product_variant_name || newPackageData.product?.variant?.name,
        item_brand: newPackageData.product_name || newPackageData.product?.name,
        item_sku: newPackageData.product_sku || newPackageData.product?.variant?.sku || void 0,
        ...newPackageData.image && { item_image: newPackageData.image }
      };
      const event = {
        event: "dl_package_swapped",
        event_category: "ecommerce",
        event_action: "swap",
        event_label: `${previousItemFormatted.item_name} → ${newItemFormatted.item_name}`,
        ecommerce: {
          currency: campaignStore.currency ?? "USD",
          value_change: priceDifference,
          items_removed: [previousItemFormatted],
          items_added: [newItemFormatted]
        },
        swap_details: {
          previous_package_id: previousPackageId,
          new_package_id: newPackageId,
          price_difference: priceDifference
        }
      };
      dataLayer.push(event);
      logger$2.debug("Tracked package swap:", { previousPackageId, newPackageId, priceDifference });
    };
    this.eventBus.on("cart:package-swapped", handlePackageSwapped);
    this.eventHandlers.set("cart:package-swapped", handlePackageSwapped);
    const handleCartUpdated = async () => {
      if (!this.shouldProcessEvent("cart:updated")) {
        return;
      }
      const event = EcommerceEvents.createCartUpdatedEvent();
      event.cart = this.getCartData();
      dataLayer.push(event);
    };
    this.eventBus.on("cart:updated", handleCartUpdated);
    this.eventHandlers.set("cart:updated", handleCartUpdated);
  }
  /**
   * Set up upsell event listeners
   */
  setupUpsellEventListeners() {
    const handleUpsellViewed = async (data) => {
      const orderId = data.orderId;
      const pagePath = data.pagePath;
      if (!data.packageId) {
        dataLayer.push({
          event: "dl_viewed_upsell",
          order_id: orderId,
          page_path: pagePath,
          // Generic upsell data when no specific package
          upsell: {
            package_id: "page_view",
            package_name: "Upsell Page View",
            currency: useCampaignStore.getState().currency ?? "USD"
          }
        });
        logger$2.info("Tracked upsell page view:", pagePath);
        return;
      }
      const packageId = data.packageId;
      const campaignStore = useCampaignStore.getState();
      const packageData = campaignStore.getPackage(packageId);
      if (!packageData) {
        logger$2.warn("Package not found for upsell view:", packageId);
        return;
      }
      dataLayer.push({
        event: "dl_viewed_upsell",
        order_id: orderId,
        upsell: {
          package_id: packageId.toString(),
          package_name: packageData.name || `Package ${packageId}`,
          price: parseFloat(packageData.price || "0"),
          currency: campaignStore.currency ?? "USD"
        }
      });
      logger$2.info("Tracked upsell view:", packageId);
    };
    this.eventBus.on("upsell:viewed", handleUpsellViewed);
    this.eventHandlers.set("upsell:viewed", handleUpsellViewed);
    const handleUpsellAccepted = async (data) => {
      const packageId = data.packageId;
      const quantity = data.quantity || 1;
      const orderId = data.orderId || data.order?.ref_id;
      const campaignStore = useCampaignStore.getState();
      const packageData = campaignStore.getPackage(packageId);
      let value = data.value;
      if (value === void 0 && packageData?.price) {
        value = parseFloat(packageData.price) * quantity;
      }
      const coupon = data.coupon ?? useCartStore.getState().vouchers?.[0];
      const upsellNumber = data.upsellNumber || (sessionStorage.getItem(`upsells_${orderId}`) ? parseInt(sessionStorage.getItem(`upsells_${orderId}`) || "0") + 1 : 1);
      if (orderId) {
        sessionStorage.setItem(`upsells_${orderId}`, String(upsellNumber));
      }
      const cartItem = {
        packageId,
        productId: packageData?.product_id,
        productName: packageData?.product_name,
        variantId: packageData?.product_variant_id,
        variantName: packageData?.product_variant_name,
        variantSku: packageData?.product_sku,
        quantity,
        price: value,
        image: packageData?.image
      };
      const acceptedUpsellEvent = EcommerceEvents.createAcceptedUpsellEvent({
        orderId,
        packageId,
        packageName: data.packageName || packageData?.name || `Package ${packageId}`,
        quantity,
        value: value || 0,
        discount: data.discount,
        coupon,
        currency: data.currency || (campaignStore.currency ?? "USD"),
        upsellNumber,
        item: cartItem
      });
      if (data.willRedirect) {
        logger$2.debug("Upsell event already marked for queueing due to redirect");
      }
      dataLayer.push(acceptedUpsellEvent);
      logger$2.info("Tracked upsell accepted:", {
        packageId,
        orderId,
        upsellOrderId: `${orderId}-US${upsellNumber}`,
        value
      });
    };
    this.eventBus.on("upsell:accepted", handleUpsellAccepted);
    this.eventBus.on("upsell:added", handleUpsellAccepted);
    this.eventHandlers.set("upsell:accepted", handleUpsellAccepted);
    this.eventHandlers.set("upsell:added", handleUpsellAccepted);
    const handleUpsellSkipped = async (data) => {
      dataLayer.push({
        event: "dl_skipped_upsell",
        order_id: data.orderId,
        upsell: {
          package_id: data.packageId?.toString() || "unknown",
          package_name: data.packageName || "Unknown Package"
        }
      });
      logger$2.info("Tracked upsell skipped:", data.packageId);
    };
    this.eventBus.on("upsell:skipped", handleUpsellSkipped);
    this.eventHandlers.set("upsell:skipped", handleUpsellSkipped);
  }
  /**
   * Set up checkout event listeners
   */
  setupCheckoutEventListeners() {
    const handleOrderCompleted = async (order) => {
      const orderId = order.ref_id || order.number || order.order_id || order.transaction_id;
      const total = parseFloat(order.total_incl_tax || order.total || "0");
      const cartStore = useCartStore.getState();
      const campaignStore = useCampaignStore.getState();
      if (order.lines && Array.isArray(order.lines)) {
        order.lines.map((line, index2) => ({
          item_id: line.product_sku || line.id?.toString() || `line_${index2}`,
          item_name: line.product_title || line.product_description || `Item ${line.id}`,
          currency: order.currency || "USD",
          price: parseFloat(line.price_incl_tax || line.price || "0"),
          quantity: parseInt(line.quantity?.toString() || "1"),
          item_category: campaignStore.data?.name || "uncategorized",
          item_variant: line.variant_title,
          discount: parseFloat(line.price_incl_tax_excl_discounts || "0") - parseFloat(line.price_incl_tax || "0"),
          index: index2
        }));
      } else {
        cartStore.items.map((item, index2) => {
          const packageData = campaignStore.getPackage(item.packageId);
          return {
            item_id: packageData?.external_id?.toString() || item.packageId.toString(),
            // Use external_id for analytics
            item_name: packageData?.name || `Package ${item.packageId}`,
            currency: campaignStore.currency ?? "USD",
            price: parseFloat(packageData?.price_total || "0"),
            // Use total package price
            quantity: item.quantity,
            // This is the number of packages in cart
            item_category: campaignStore.data?.name || "uncategorized",
            ...packageData?.image && { item_image: packageData.image },
            index: index2
          };
        });
      }
      const event = EcommerceEvents.createPurchaseEvent({
        order,
        orderId,
        transactionId: orderId,
        total,
        tax: parseFloat(order.total_tax || order.tax || "0"),
        shipping: parseFloat(order.shipping_incl_tax || order.shipping || "0"),
        coupon: order.discounts?.[0]?.code || order.coupon_code || order.coupon,
        items: cartStore.items,
        // Pass raw cart items with all product data
        currency: order.currency || "USD"
      });
      event._willRedirect = true;
      logger$2.debug("Marked purchase event for queueing with _willRedirect = true");
      dataLayer.push(event);
      logger$2.info("Tracked purchase:", orderId);
    };
    this.eventBus.on("order:completed", handleOrderCompleted);
    this.eventHandlers.set("order:completed", handleOrderCompleted);
    this.eventBus.on("express-checkout:completed", handleOrderCompleted);
    this.eventHandlers.set("express-checkout:completed", handleOrderCompleted);
  }
  /**
   * Set up page event listeners
   */
  setupPageEventListeners() {
    const handlePageView = async (data) => {
      dataLayer.push({
        event: "dl_page_view",
        page: {
          title: data.title || document.title,
          url: data.url || window.location.href,
          path: data.path || window.location.pathname,
          referrer: document.referrer
        }
      });
    };
    this.eventBus.on("page:viewed", handlePageView);
    this.eventHandlers.set("page:viewed", handlePageView);
    const handleRouteChanged = async (data) => {
      dataLayer.push({
        event: "dl_route_changed",
        route: {
          from: data.from,
          to: data.to,
          path: data.path || window.location.pathname
        }
      });
    };
    this.eventBus.on("route:changed", handleRouteChanged);
    this.eventHandlers.set("route:changed", handleRouteChanged);
  }
  /**
   * Set up exit intent event listeners
   */
  setupExitIntentEventListeners() {
    const handleExitIntentShown = (data) => {
      dataLayer.push({
        event: "dl_exit_intent_shown",
        event_category: "engagement",
        event_action: "exit_intent_shown",
        event_label: data.imageUrl || data.template || "exit-intent",
        exit_intent: {
          image_url: data.imageUrl || "",
          template: data.template || ""
        }
      });
      logger$2.debug("Tracked exit intent shown:", data);
    };
    this.eventBus.on("exit-intent:shown", handleExitIntentShown);
    this.eventHandlers.set("exit-intent:shown", handleExitIntentShown);
    const handleExitIntentClicked = (data) => {
      dataLayer.push({
        event: "dl_exit_intent_accepted",
        event_category: "engagement",
        event_action: "exit_intent_accepted",
        event_label: data.imageUrl || data.template || "exit-intent",
        exit_intent: {
          image_url: data.imageUrl || "",
          template: data.template || ""
        }
      });
      logger$2.debug("Tracked exit intent accepted:", data);
    };
    this.eventBus.on("exit-intent:clicked", handleExitIntentClicked);
    this.eventHandlers.set("exit-intent:clicked", handleExitIntentClicked);
    const handleExitIntentDismissed = (data) => {
      dataLayer.push({
        event: "dl_exit_intent_dismissed",
        event_category: "engagement",
        event_action: "exit_intent_dismissed",
        event_label: data.imageUrl || data.template || "exit-intent",
        exit_intent: {
          image_url: data.imageUrl || "",
          template: data.template || ""
        }
      });
      logger$2.debug("Tracked exit intent dismissed:", data);
    };
    this.eventBus.on("exit-intent:dismissed", handleExitIntentDismissed);
    this.eventHandlers.set("exit-intent:dismissed", handleExitIntentDismissed);
    const handleExitIntentClosed = (data) => {
      dataLayer.push({
        event: "dl_exit_intent_closed",
        event_category: "engagement",
        event_action: "exit_intent_closed",
        event_label: data.imageUrl || data.template || "exit-intent",
        exit_intent: {
          image_url: data.imageUrl || "",
          template: data.template || ""
        }
      });
      logger$2.debug("Tracked exit intent closed:", data);
    };
    this.eventBus.on("exit-intent:closed", handleExitIntentClosed);
    this.eventHandlers.set("exit-intent:closed", handleExitIntentClosed);
    const handleExitIntentAction = (data) => {
      dataLayer.push({
        event: "dl_exit_intent_action",
        event_category: "engagement",
        event_action: `exit_intent_${data.action}`,
        event_label: data.couponCode || data.action,
        exit_intent: {
          action: data.action,
          coupon_code: data.couponCode || ""
        }
      });
      logger$2.debug("Tracked exit intent action:", data);
    };
    this.eventBus.on("exit-intent:action", handleExitIntentAction);
    this.eventHandlers.set("exit-intent:action", handleExitIntentAction);
  }
  /**
   * Get current cart data
   */
  getCartData() {
    try {
      const cartStore = useCartStore.getState();
      const campaignStore = useCampaignStore.getState();
      const toNum = (v) => {
        if (typeof v === "number") return Number.isFinite(v) ? v : 0;
        if (typeof v === "string") {
          const n = parseFloat(v);
          return Number.isFinite(n) ? n : 0;
        }
        return 0;
      };
      const items = cartStore.items.map((item) => {
        let price = 0;
        if (item.package_price !== void 0 && item.package_price !== null) {
          price = toNum(item.package_price);
        } else if (item.total !== void 0 && item.total !== null && item.quantity > 0) {
          price = toNum(item.total) / item.quantity;
        } else {
          const pkg = campaignStore.getPackage(item.packageId);
          price = toNum(pkg?.price_total ?? pkg?.price);
        }
        return {
          package_id: item.packageId,
          quantity: item.quantity,
          price
        };
      });
      const totalValue = Math.round(
        items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100
      ) / 100;
      return {
        total_value: totalValue,
        total_items: cartStore.totalQuantity || 0,
        currency: campaignStore.currency ?? "USD",
        items
      };
    } catch (error) {
      logger$2.error("Error getting cart data:", error);
      return null;
    }
  }
  /**
   * Reset the auto event listener (called by NextAnalytics)
   */
  reset() {
    this.lastEventTimes.clear();
    logger$2.debug("AutoEventListener reset");
  }
  /**
   * Clean up the auto event listener
   */
  destroy() {
    this.eventHandlers.forEach((handler, eventName) => {
      this.eventBus.off(eventName, handler);
    });
    this.eventHandlers.clear();
    this.lastEventTimes.clear();
    this.isInitialized = false;
    logger$2.debug("AutoEventListener destroyed");
  }
  /**
   * Get listener status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      listenersCount: this.eventHandlers.size,
      debounceConfig: { ...this.debounceConfig }
    };
  }
  /**
   * Update debounce configuration
   */
  setDebounceConfig(config) {
    Object.assign(this.debounceConfig, config);
    logger$2.debug("Updated debounce config:", this.debounceConfig);
  }
}
AutoEventListener.getInstance();
const userPropertiesFields = {
  visitor_type: { type: "string" },
  customer_id: { type: "string" },
  customer_email: { type: "string" },
  customer_phone: { type: "string" },
  customer_first_name: { type: "string" },
  customer_last_name: { type: "string" },
  customer_address_city: { type: "string" },
  customer_address_province: { type: "string" },
  customer_address_province_code: { type: "string" },
  customer_address_country: { type: "string" },
  customer_address_country_code: { type: "string" },
  customer_address_zip: { type: "string" },
  customer_order_count: { type: "number" },
  customer_total_spent: { type: "number" },
  customer_tags: { type: "string" }
};
const productFields = {
  item_id: { type: "string", required: true },
  item_name: { type: "string", required: true },
  affiliation: { type: "string" },
  coupon: { type: "string" },
  currency: { type: "string" },
  discount: { type: "number" },
  index: { type: "number" },
  item_brand: { type: "string" },
  item_category: { type: "string" },
  item_category2: { type: "string" },
  item_category3: { type: "string" },
  item_category4: { type: "string" },
  item_category5: { type: "string" },
  item_list_id: { type: "string" },
  item_list_name: { type: "string" },
  item_variant: { type: "string" },
  item_image: { type: "string" },
  location_id: { type: "string" },
  price: { type: "number" },
  quantity: { type: "number" }
};
const ecommerceWithItemsFields = {
  currency: { type: "string" },
  value: { type: "number" },
  coupon: { type: "string" },
  items: {
    type: "array",
    items: {
      type: "object",
      properties: productFields
    }
  }
};
const eventSchemas = {
  dl_user_data: {
    name: "dl_user_data",
    fields: {
      event: { type: "string", required: true },
      user_properties: {
        type: "object",
        required: true,
        properties: userPropertiesFields
      },
      ecommerce: {
        type: "object",
        properties: {
          ...ecommerceWithItemsFields,
          // cart_contents is deprecated but still supported for backward compatibility
          cart_contents: {
            type: "array",
            items: {
              type: "object",
              properties: productFields
            }
          }
        }
      }
    }
  },
  dl_sign_up: {
    name: "dl_sign_up",
    fields: {
      event: { type: "string", required: true },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      },
      method: { type: "string" }
    }
  },
  dl_login: {
    name: "dl_login",
    fields: {
      event: { type: "string", required: true },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      },
      method: { type: "string" }
    }
  },
  dl_view_item_list: {
    name: "dl_view_item_list",
    fields: {
      event: { type: "string", required: true },
      ecommerce: {
        type: "object",
        required: true,
        properties: {
          ...ecommerceWithItemsFields,
          item_list_id: { type: "string" },
          item_list_name: { type: "string" },
          // impressions is deprecated but still supported for backward compatibility
          impressions: {
            type: "array",
            items: {
              type: "object",
              properties: productFields
            }
          }
        }
      },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      }
    }
  },
  dl_view_search_results: {
    name: "dl_view_search_results",
    fields: {
      event: { type: "string", required: true },
      search_term: { type: "string", required: true },
      ecommerce: {
        type: "object",
        properties: {
          ...ecommerceWithItemsFields,
          item_list_name: { type: "string" },
          // impressions is deprecated but still supported for backward compatibility
          impressions: {
            type: "array",
            items: {
              type: "object",
              properties: productFields
            }
          }
        }
      },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      }
    }
  },
  dl_select_item: {
    name: "dl_select_item",
    fields: {
      event: { type: "string", required: true },
      ecommerce: {
        type: "object",
        required: true,
        properties: {
          ...ecommerceWithItemsFields,
          item_list_id: { type: "string" },
          item_list_name: { type: "string" }
        }
      },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      }
    }
  },
  dl_view_item: {
    name: "dl_view_item",
    fields: {
      event: { type: "string", required: true },
      ecommerce: {
        type: "object",
        required: true,
        properties: ecommerceWithItemsFields
      },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      }
    }
  },
  dl_add_to_cart: {
    name: "dl_add_to_cart",
    fields: {
      event: { type: "string", required: true },
      ecommerce: {
        type: "object",
        required: true,
        properties: ecommerceWithItemsFields
      },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      }
    }
  },
  dl_remove_from_cart: {
    name: "dl_remove_from_cart",
    fields: {
      event: { type: "string", required: true },
      ecommerce: {
        type: "object",
        required: true,
        properties: ecommerceWithItemsFields
      },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      }
    }
  },
  dl_view_cart: {
    name: "dl_view_cart",
    fields: {
      event: { type: "string", required: true },
      ecommerce: {
        type: "object",
        required: true,
        properties: ecommerceWithItemsFields
      },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      }
    }
  },
  dl_begin_checkout: {
    name: "dl_begin_checkout",
    fields: {
      event: { type: "string", required: true },
      ecommerce: {
        type: "object",
        required: true,
        properties: {
          ...ecommerceWithItemsFields,
          checkout_id: { type: "string" },
          checkout_step: { type: "number" }
        }
      },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      }
    }
  },
  dl_add_shipping_info: {
    name: "dl_add_shipping_info",
    fields: {
      event: { type: "string", required: true },
      ecommerce: {
        type: "object",
        required: true,
        properties: {
          ...ecommerceWithItemsFields,
          shipping_tier: { type: "string" }
        }
      },
      shipping_tier: { type: "string" },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      }
    }
  },
  dl_add_payment_info: {
    name: "dl_add_payment_info",
    fields: {
      event: { type: "string", required: true },
      ecommerce: {
        type: "object",
        required: true,
        properties: {
          ...ecommerceWithItemsFields,
          payment_type: { type: "string" }
        }
      },
      payment_type: { type: "string" },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      }
    }
  },
  dl_purchase: {
    name: "dl_purchase",
    fields: {
      event: { type: "string", required: true },
      ecommerce: {
        type: "object",
        required: true,
        properties: {
          ...ecommerceWithItemsFields,
          transaction_id: { type: "string", required: true },
          affiliation: { type: "string" },
          tax: { type: "number" },
          shipping: { type: "number" },
          discount: { type: "number" }
        }
      },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      }
    }
  },
  dl_subscribe: {
    name: "dl_subscribe",
    fields: {
      event: { type: "string", required: true },
      ecommerce: {
        type: "object",
        properties: {
          ...ecommerceWithItemsFields,
          subscription_id: { type: "string" },
          subscription_status: { type: "string" }
        }
      },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      }
    }
  },
  // Upsell events
  dl_viewed_upsell: {
    name: "dl_viewed_upsell",
    fields: {
      event: { type: "string", required: true },
      order_id: { type: "string", required: true },
      upsell: {
        type: "object",
        required: true,
        properties: {
          package_id: { type: "string", required: true },
          package_name: { type: "string", required: true },
          price: { type: "number" },
          currency: { type: "string" }
        }
      }
    }
  },
  dl_accepted_upsell: {
    name: "dl_accepted_upsell",
    fields: {
      event: { type: "string", required: true },
      order_id: { type: "string", required: true },
      upsell: {
        type: "object",
        required: true,
        properties: {
          package_id: { type: "string", required: true },
          package_name: { type: "string" },
          quantity: { type: "number" },
          value: { type: "number", required: true },
          currency: { type: "string" }
        }
      }
    }
  },
  dl_skipped_upsell: {
    name: "dl_skipped_upsell",
    fields: {
      event: { type: "string", required: true },
      order_id: { type: "string", required: true },
      upsell: {
        type: "object",
        required: true,
        properties: {
          package_id: { type: "string" },
          package_name: { type: "string" }
        }
      }
    }
  },
  // Accepted upsell in GA4 purchase format (counterpart to dl_accepted_upsell).
  dl_upsell_purchase: {
    name: "dl_upsell_purchase",
    fields: {
      event: { type: "string", required: true },
      ecommerce: {
        type: "object",
        required: true,
        properties: {
          ...ecommerceWithItemsFields,
          transaction_id: { type: "string", required: true },
          affiliation: { type: "string" },
          tax: { type: "number" },
          shipping: { type: "number" }
        }
      },
      upsell_metadata: {
        type: "object",
        properties: {
          original_order_id: { type: "string" },
          upsell_number: { type: "number" },
          package_id: { type: "string" },
          package_name: { type: "string" }
        }
      },
      user_properties: {
        type: "object",
        properties: userPropertiesFields
      }
    }
  }
};
function validateEventSchema(eventData, schema) {
  const errors = [];
  function validateField(value, fieldDef, path) {
    if (fieldDef.required && (value === void 0 || value === null)) {
      errors.push(`Missing required field: ${path}`);
      return;
    }
    if (value === void 0 || value === null) {
      return;
    }
    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (actualType !== fieldDef.type) {
      errors.push(`Invalid type for ${path}: expected ${fieldDef.type}, got ${actualType}`);
      return;
    }
    if (fieldDef.enum && !fieldDef.enum.includes(value)) {
      errors.push(`Invalid value for ${path}: must be one of ${fieldDef.enum.join(", ")}`);
    }
    if (fieldDef.type === "object" && fieldDef.properties) {
      for (const [propName, propDef] of Object.entries(fieldDef.properties)) {
        validateField(value[propName], propDef, `${path}.${propName}`);
      }
    }
    if (fieldDef.type === "array" && fieldDef.items) {
      value.forEach((item, index2) => {
        validateField(item, fieldDef.items, `${path}[${index2}]`);
      });
    }
  }
  for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
    validateField(eventData[fieldName], fieldDef, fieldName);
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function getEventSchema(eventName) {
  return eventSchemas[eventName];
}
const RECONCILE_TOLERANCE_ABS = 0.01;
const RECONCILE_TOLERANCE_REL = 5e-3;
function reconcileValue(itemsTotal, value, tax = 0, shipping = 0) {
  const tolerance = Math.max(
    RECONCILE_TOLERANCE_ABS,
    Math.abs(value) * RECONCILE_TOLERANCE_REL
  );
  const diff = Math.abs(itemsTotal - value);
  const reconciles = diff <= tolerance;
  const expected = itemsTotal.toFixed(2);
  let diagnosis;
  if (!reconciles) {
    const near = (target) => Math.abs(itemsTotal - target) <= tolerance;
    if (tax && shipping && near(value - tax - shipping)) {
      diagnosis = `value includes tax (${tax.toFixed(2)}) and shipping (${shipping.toFixed(
        2
      )}). GA4 value must be item revenue only — report tax and shipping in their own fields.`;
    } else if (shipping && near(value - shipping)) {
      diagnosis = `value includes shipping (${shipping.toFixed(
        2
      )}). GA4 value must be item revenue only — report shipping in the \`shipping\` field.`;
    } else if (tax && near(value - tax)) {
      diagnosis = `value includes tax (${tax.toFixed(
        2
      )}). GA4 value must be item revenue only — report tax in the \`tax\` field.`;
    }
  }
  return { reconciles, diff, tolerance, expected, diagnosis };
}
const logger$1 = createLogger("EventValidator");
const PURCHASE_EVENTS = ["dl_purchase", "dl_upsell_purchase"];
const ITEMS_OPTIONAL_EVENTS = [
  "dl_user_data",
  "dl_view_cart",
  "dl_view_item_list",
  "dl_view_search_results"
];
const UNRESOLVED_TOKENS = ["", "undefined", "null", "nan"];
function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  return NaN;
}
function toNumberOrZero(value) {
  if (value == null || value === "") return 0;
  const n = toNumber(value);
  return Number.isFinite(n) ? n : 0;
}
function isUnresolvedId(value) {
  return value == null || UNRESOLVED_TOKENS.includes(String(value).trim().toLowerCase());
}
function looksUnresolvedName(value) {
  if (value == null) return true;
  const name = String(value).trim();
  return /undefined|\bnull\b/i.test(name) || /^package\s+0$/i.test(name);
}
class EventValidator {
  constructor(debug = false) {
    this.debug = debug;
  }
  /**
   * Validates an event against its schema
   */
  validateEvent(eventData) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };
    if (!eventData || typeof eventData !== "object") {
      result.valid = false;
      result.errors.push("Event data must be an object");
      return result;
    }
    if (!eventData.event) {
      result.valid = false;
      result.errors.push('Event must have an "event" field');
      return result;
    }
    const schema = getEventSchema(eventData.event);
    if (schema) {
      const schemaValidation = validateEventSchema(eventData, schema);
      result.valid = schemaValidation.valid;
      result.errors.push(...schemaValidation.errors);
    } else {
      result.warnings.push(`No schema defined for event: ${eventData.event}`);
    }
    this.performAdditionalValidation(eventData, result);
    if (this.debug && !result.valid) {
      logger$1.error(`Validation failed for ${eventData.event}:`, result.errors);
    }
    return result;
  }
  /**
   * Performs additional validation beyond schema validation
   */
  performAdditionalValidation(eventData, result) {
    const eventName = String(eventData.event);
    const isPurchase = PURCHASE_EVENTS.includes(eventName);
    const ecommerce = eventData.ecommerce;
    if (ecommerce) {
      const currency = ecommerce.currency;
      if (isUnresolvedId(currency)) {
        result.warnings.push("ecommerce.currency is missing");
      } else if (!this.isValidCurrency(currency)) {
        result.warnings.push(`Invalid currency format: ${currency}`);
      }
      if (ecommerce.value !== void 0 && toNumber(ecommerce.value) < 0) {
        result.warnings.push("Ecommerce value should not be negative");
      }
      const items = Array.isArray(ecommerce.items) ? ecommerce.items : [];
      const impressions = Array.isArray(ecommerce.impressions) ? ecommerce.impressions : [];
      if (items.length === 0 && impressions.length === 0 && !ITEMS_OPTIONAL_EVENTS.includes(eventName)) {
        result.warnings.push(
          `${eventName} has no items in the ecommerce payload`
        );
      }
      items.forEach(
        (item, index2) => this.validateProduct(
          item,
          `ecommerce.items[${index2}]`,
          result,
          currency
        )
      );
      impressions.forEach(
        (impression, index2) => this.validateProduct(
          impression,
          `ecommerce.impressions[${index2}]`,
          result,
          currency
        )
      );
      this.validateRevenueReconciliation(ecommerce, items, result);
    }
    if (eventData.user_properties) {
      this.validateUserProperties(eventData.user_properties, result);
    }
    if (isPurchase) {
      if (isUnresolvedId(ecommerce?.transaction_id)) {
        result.errors.push(`${eventName} must have ecommerce.transaction_id`);
        result.valid = false;
      }
      if (ecommerce?.value === void 0 || ecommerce?.value === null) {
        result.errors.push(`${eventName} must have ecommerce.value`);
        result.valid = false;
      }
    }
    switch (eventName) {
      case "dl_upsell_purchase":
        this.validateUpsellMetadata(eventData.upsell_metadata, result);
        break;
      case "dl_view_search_results":
        if (!eventData.search_term) {
          result.errors.push(
            "dl_view_search_results event must have search_term"
          );
          result.valid = false;
        }
        break;
      case "dl_viewed_upsell":
      case "dl_accepted_upsell":
      case "dl_skipped_upsell":
        this.validateUpsellEvent(eventData, result);
        break;
    }
  }
  /**
   * Σ(items[].price × quantity) must equal ecommerce.value (GA4: value excludes
   * tax and shipping). {@link reconcileValue} owns the rule so it stays identical
   * to the debug validator and diagnoses a value that wrongly includes them.
   */
  validateRevenueReconciliation(ecommerce, items, result) {
    if (items.length === 0) return;
    const value = toNumber(ecommerce.value);
    if (!Number.isFinite(value)) return;
    let itemsTotal = 0;
    for (const item of items) {
      const price = toNumber(item?.price);
      const quantity = toNumber(item?.quantity);
      if (!Number.isFinite(price) || !Number.isFinite(quantity)) return;
      if (price < 0 || quantity < 1) return;
      itemsTotal += price * quantity;
    }
    const { reconciles, diagnosis } = reconcileValue(
      itemsTotal,
      value,
      toNumberOrZero(ecommerce.tax),
      toNumberOrZero(ecommerce.shipping)
    );
    if (!reconciles) {
      result.warnings.push(
        `ecommerce.value ${value.toFixed(2)} does not reconcile with items total ${itemsTotal.toFixed(2)} — value must equal Σ(price × quantity)` + (diagnosis ? `; ${diagnosis}` : "")
      );
    }
  }
  /**
   * Validates the `upsell_metadata` block on dl_upsell_purchase for an
   * unresolved package (issues #51 / #54). The block is optional, but when
   * present its package id/name must be real.
   */
  validateUpsellMetadata(meta, result) {
    if (!meta || typeof meta !== "object") return;
    if (isUnresolvedId(meta.package_id) || String(meta.package_id) === "0") {
      result.errors.push(
        `upsell_metadata.package_id is unresolved ("${meta.package_id}")`
      );
      result.valid = false;
    }
    if (looksUnresolvedName(meta.package_name)) {
      result.errors.push(
        `upsell_metadata.package_name is unresolved ("${meta.package_name}")`
      );
      result.valid = false;
    }
  }
  /**
   * Validates a product object
   */
  validateProduct(product, path, result, ecommerceCurrency) {
    if (!product || typeof product !== "object") {
      result.errors.push(`${path} must be an object`);
      result.valid = false;
      return;
    }
    if (isUnresolvedId(product.item_id)) {
      result.errors.push(
        `${path}.item_id is missing or unresolved ("${product.item_id}")`
      );
      result.valid = false;
    }
    if (looksUnresolvedName(product.item_name)) {
      result.errors.push(
        `${path}.item_name is missing or unresolved ("${product.item_name}")`
      );
      result.valid = false;
    }
    const numericFields = ["price", "quantity", "discount", "index"];
    for (const field of numericFields) {
      if (product[field] !== void 0) {
        if (typeof product[field] !== "number" || !Number.isFinite(product[field])) {
          result.errors.push(`${path}.${field} must be a finite number`);
          result.valid = false;
        } else if (field !== "discount" && product[field] < 0) {
          result.warnings.push(`${path}.${field} should not be negative`);
        }
      }
    }
    if (typeof product.quantity === "number" && Number.isFinite(product.quantity)) {
      if (!Number.isInteger(product.quantity)) {
        result.warnings.push(`${path}.quantity should be an integer`);
      }
      if (product.quantity < 1) {
        result.errors.push(`${path}.quantity must be at least 1`);
        result.valid = false;
      }
    }
    if (product.currency && ecommerceCurrency && product.currency !== ecommerceCurrency) {
      result.warnings.push(
        `${path}.currency (${product.currency}) differs from ecommerce.currency (${ecommerceCurrency})`
      );
    }
  }
  /**
   * Validates user properties
   */
  validateUserProperties(userProperties, result) {
    if (typeof userProperties !== "object") {
      result.errors.push("user_properties must be an object");
      result.valid = false;
      return;
    }
    if (userProperties.customer_email && !this.isValidEmail(userProperties.customer_email)) {
      result.warnings.push("customer_email is not a valid email address");
    }
    if (userProperties.customer_order_count !== void 0) {
      if (typeof userProperties.customer_order_count !== "number" || !Number.isInteger(userProperties.customer_order_count)) {
        result.warnings.push("customer_order_count should be an integer");
      }
    }
    if (userProperties.customer_total_spent !== void 0) {
      if (typeof userProperties.customer_total_spent !== "number") {
        result.warnings.push("customer_total_spent should be a number");
      }
    }
    if (userProperties.customer_address_country_code && userProperties.customer_address_country_code.length !== 2) {
      result.warnings.push(
        "customer_address_country_code should be a 2-letter ISO code"
      );
    }
    if (userProperties.customer_address_province_code && userProperties.customer_address_province_code.length > 3) {
      result.warnings.push("customer_address_province_code seems too long");
    }
  }
  /**
   * Checks if a currency code is valid (3-letter ISO code)
   */
  isValidCurrency(currency) {
    return /^[A-Z]{3}$/.test(currency);
  }
  /**
   * Basic email validation
   */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  /**
   * Validates upsell events
   */
  validateUpsellEvent(eventData, result) {
    if (!eventData.order_id) {
      result.errors.push(`${eventData.event} must have order_id`);
      result.valid = false;
    }
    if (!eventData.upsell || typeof eventData.upsell !== "object") {
      result.errors.push(`${eventData.event} must have upsell object`);
      result.valid = false;
      return;
    }
    if (!eventData.upsell.package_id) {
      result.errors.push(`${eventData.event}.upsell.package_id is required`);
      result.valid = false;
    }
    if (eventData.event === "dl_accepted_upsell" && eventData.upsell.value === void 0) {
      result.errors.push("dl_accepted_upsell.upsell.value is required");
      result.valid = false;
    }
    if (eventData.upsell.price !== void 0 && typeof eventData.upsell.price !== "number") {
      result.errors.push(`${eventData.event}.upsell.price must be a number`);
      result.valid = false;
    }
    if (eventData.upsell.quantity !== void 0 && typeof eventData.upsell.quantity !== "number") {
      result.errors.push(`${eventData.event}.upsell.quantity must be a number`);
      result.valid = false;
    }
    if (eventData.upsell.value !== void 0 && typeof eventData.upsell.value !== "number") {
      result.errors.push(`${eventData.event}.upsell.value must be a number`);
      result.valid = false;
    }
  }
  /**
   * Get all available event schemas
   */
  getAvailableSchemas() {
    return Object.keys(eventSchemas);
  }
  /**
   * Get schema details for a specific event
   */
  getSchemaDetails(eventName) {
    return getEventSchema(eventName);
  }
  /**
   * Generate a sample event based on schema
   */
  generateSampleEvent(eventName) {
    const schema = getEventSchema(eventName);
    if (!schema) {
      return null;
    }
    const sample = {
      event: eventName,
      event_id: "sample_" + Date.now(),
      timestamp: Date.now()
    };
    this.generateSampleFromSchema(schema.fields, sample);
    return sample;
  }
  /**
   * Helper to generate sample data from schema
   */
  generateSampleFromSchema(fields, target) {
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      if (fieldName === "event") continue;
      if (fieldDef.required || Math.random() > 0.5) {
        switch (fieldDef.type) {
          case "string":
            target[fieldName] = fieldDef.enum ? fieldDef.enum[0] : `sample_${fieldName}`;
            break;
          case "number":
            target[fieldName] = fieldName.includes("price") || fieldName.includes("value") ? 99.99 : 1;
            break;
          case "boolean":
            target[fieldName] = true;
            break;
          case "object":
            target[fieldName] = {};
            if (fieldDef.properties) {
              this.generateSampleFromSchema(
                fieldDef.properties,
                target[fieldName]
              );
            }
            break;
          case "array":
            target[fieldName] = [];
            if (fieldDef.items && fieldDef.items.type === "object" && fieldDef.items.properties) {
              const item = {};
              this.generateSampleFromSchema(fieldDef.items.properties, item);
              target[fieldName].push(item);
            }
            break;
        }
      }
    }
  }
}
const logger = createLogger("NextAnalytics");
const PROVIDER_FACTORIES = {
  nextCampaign: () => new NextCampaignAdapter(),
  gtm: (config) => new GTMAdapter(config),
  facebook: (config, ctx) => config.settings?.pixelId ? new FacebookAdapter({ ...config, storeName: ctx.storeName }) : null,
  rudderstack: () => new RudderStackAdapter(),
  custom: (config) => config.settings?.endpoint ? new CustomAdapter(config.settings) : null
};
const PROVIDER_REQUIRED_SETTINGS = {
  facebook: "analytics.providers.facebook.settings.pixelId",
  custom: "analytics.providers.custom.settings.endpoint"
};
class NextAnalytics {
  constructor() {
    this.initialized = false;
    this.providers = /* @__PURE__ */ new Map();
    this.validator = new EventValidator();
    this.metaTagController = MetaTagController.getInstance();
    this.listTracker = ListAttributionTracker.getInstance();
    this.viewTracker = ViewItemListTracker.getInstance();
    this.userTracker = UserDataTracker.getInstance();
    this.autoListener = AutoEventListener.getInstance();
    if (typeof window !== "undefined") {
      window.NextDataLayerTransformFn = null;
      this.checkAndSetIgnoreFlag();
    }
  }
  static getInstance() {
    if (!NextAnalytics.instance) {
      NextAnalytics.instance = new NextAnalytics();
    }
    return NextAnalytics.instance;
  }
  /**
   * Check URL for ignore parameter and set session storage flag
   */
  checkAndSetIgnoreFlag() {
    if (typeof window === "undefined") return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const ignoreParam = urlParams.get("ignore");
      if (ignoreParam === "true") {
        sessionStorage.setItem("analytics_ignore", "true");
        logger.info("Analytics ignore flag set from URL parameter");
      }
    } catch (error) {
      logger.error("Error checking ignore parameter:", error);
    }
  }
  /**
   * Check if analytics should be ignored
   */
  shouldIgnoreAnalytics() {
    if (typeof window === "undefined") return false;
    try {
      const sessionIgnore = sessionStorage.getItem("analytics_ignore");
      if (sessionIgnore === "true") {
        return true;
      }
      const urlParams = new URLSearchParams(window.location.search);
      const ignoreParam = urlParams.get("ignore");
      return ignoreParam === "true";
    } catch (error) {
      logger.error("Error checking ignore status:", error);
      return false;
    }
  }
  /**
   * Check if analytics is initialized
   */
  isInitialized() {
    return this.initialized;
  }
  /**
   * Initialize the analytics system
   */
  async initialize() {
    if (this.initialized) {
      logger.debug("Analytics already initialized");
      return;
    }
    if (this.shouldIgnoreAnalytics()) {
      logger.info("Analytics ignored due to ignore parameter");
      return;
    }
    try {
      const config = configStore.getState();
      if (!config.analytics?.enabled) {
        logger.info("Analytics disabled in configuration");
        return;
      }
      this.warnMissingConfig(config);
      dataLayer.initialize();
      if (config.analytics.debug) {
        dataLayer.setDebugMode(true);
      }
      await this.initializeProviders(config.analytics, config.storeName);
      this.metaTagController.initialize();
      if (config.analytics.mode === "auto") {
        this.userTracker.initialize();
        await new Promise((resolve) => setTimeout(resolve, 100));
        this.listTracker.initialize();
        this.viewTracker.initialize();
        this.autoListener.initialize();
        logger.info("Auto-tracking initialized (user data fired first, meta tags processed)");
      } else {
        logger.info("Manual mode - meta tags processed, auto-tracking disabled");
      }
      setTimeout(() => {
        PendingEventsHandler.getInstance().processPendingEvents();
      }, 200);
      this.initialized = true;
      logger.info("NextAnalytics initialized successfully", {
        providers: Array.from(this.providers.keys()),
        mode: config.analytics.mode
      });
    } catch (error) {
      logger.error("Failed to initialize analytics:", error);
      throw error;
    }
  }
  /**
   * Warn (once) when config needed for campaign identifiers is missing, telling
   * the dev how to set it. Without `apiKey` the campaign never loads, so events
   * go out without campaign_id/name/currency/language. See the analytics README
   * ("Campaign identifiers on every event").
   */
  warnMissingConfig(config) {
    if (!config.apiKey) {
      logger.warn(
        'No campaign apiKey configured — analytics events will lack campaign identifiers. Set <meta name="next-api-key" content="..."> or window.nextConfig.apiKey.'
      );
    }
  }
  /**
   * Initialize analytics providers from configuration.
   *
   * Iterates the {@link PROVIDER_FACTORIES} registry, instantiating every
   * enabled provider whose preconditions are met and wiring it into the data
   * layer. Each adapter's {@link ProviderAdapter.initialize} hook is awaited so
   * script-loading providers (e.g. NextCampaign) are ready before events flow.
   */
  async initializeProviders(config, storeName) {
    const providerConfigs = config.providers ?? {};
    const ctx = { storeName };
    for (const [key, factory] of Object.entries(PROVIDER_FACTORIES)) {
      const providerConfig = providerConfigs[key];
      if (!providerConfig?.enabled) continue;
      const adapter = factory(providerConfig, ctx);
      if (!adapter) {
        const required = PROVIDER_REQUIRED_SETTINGS[key];
        logger.warn(
          required ? `Provider "${key}" is enabled but ${required} is missing — set it to enable ${key}; skipping.` : `Provider "${key}" is enabled but its preconditions are not met; skipping.`
        );
        continue;
      }
      await adapter.initialize(providerConfig.settings);
      this.providers.set(key, adapter);
      dataLayer.addProvider(adapter);
      logger.info(`${key} adapter initialized`, {
        blockedEvents: providerConfig.blockedEvents ?? []
      });
    }
  }
  /**
   * Track an event
   */
  track(event) {
    if (this.shouldIgnoreAnalytics()) {
      logger.debug("Event tracking skipped due to ignore flag:", event.event);
      return;
    }
    if (!this.initialized) {
      logger.warn("Analytics not initialized, queuing event:", event.event);
    }
    if (dataLayer.isDebugMode()) {
      const validation = this.validator.validateEvent(event);
      if (!validation.valid) {
        logger.error("Event validation failed:", validation.errors);
        if (validation.warnings.length > 0) {
          logger.warn("Event validation warnings:", validation.warnings);
        }
      }
    }
    dataLayer.push(event);
  }
  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled) {
    dataLayer.setDebugMode(enabled);
    logger.info(`Debug mode ${enabled ? "enabled" : "disabled"}`);
  }
  /**
   * Set transform function for events
   */
  setTransformFunction(fn) {
    dataLayer.setTransformFunction(fn);
  }
  /**
   * Handle route changes (for SPAs)
   */
  invalidateContext() {
    dataLayer.invalidateContext();
    if (typeof window !== "undefined" && window.ElevarInvalidateContext) {
      window.ElevarInvalidateContext();
      logger.debug("Called ElevarInvalidateContext");
    }
    this.metaTagController.reset();
    this.viewTracker.reset();
    this.track(UserEvents.createUserDataEvent("dl_user_data"));
  }
  /**
   * Get analytics status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      debugMode: dataLayer.isDebugMode(),
      providers: Array.from(this.providers.keys()),
      eventsTracked: dataLayer.getEventCount(),
      ignored: this.shouldIgnoreAnalytics()
    };
  }
  /**
   * Clear the analytics ignore flag from session storage
   */
  clearIgnoreFlag() {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("analytics_ignore");
        logger.info("Analytics ignore flag cleared");
      } catch (error) {
        logger.error("Error clearing ignore flag:", error);
      }
    }
  }
  /**
   * Convenience methods for common events
   */
  trackViewItemList(items, listId, listName) {
    this.track(EcommerceEvents.createViewItemListEvent(items, listId, listName));
  }
  trackViewItem(item) {
    this.track(EcommerceEvents.createViewItemEvent(item));
  }
  trackAddToCart(item, listId, listName) {
    this.track(EcommerceEvents.createAddToCartEvent(item, listId, listName));
  }
  trackBeginCheckout() {
    this.track(EcommerceEvents.createBeginCheckoutEvent());
  }
  trackPurchase(orderData) {
    this.track(EcommerceEvents.createPurchaseEvent(orderData));
  }
  trackSignUp(email) {
    const userData = email ? { customer_email: email } : void 0;
    this.track(UserEvents.createSignUpEvent("email", userData));
  }
  trackLogin(email) {
    const userData = email ? { customer_email: email } : void 0;
    this.track(UserEvents.createLoginEvent("email", userData));
  }
}
const nextAnalytics = NextAnalytics.getInstance();
if (typeof window !== "undefined") {
  window.NextAnalytics = nextAnalytics;
  window.NextDataLayerManager = dataLayer;
  window.NextMetaTagController = MetaTagController.getInstance();
  window.NextInvalidateContext = () => {
    nextAnalytics.invalidateContext();
  };
  window.NextAnalyticsClearIgnore = () => {
    nextAnalytics.clearIgnoreFlag();
  };
}
const index = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  EcommerceEvents,
  EventValidator,
  MetaTagController,
  NextAnalytics,
  UserEvents,
  dataLayer,
  metaTagController,
  nextAnalytics
});
export {
  EcommerceEvents as E,
  resolveOrderTaxBasis as a,
  index as i,
  nextAnalytics as n,
  reconcileValue as r,
  userDataStorage as u
};
