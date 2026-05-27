import { D as Decimal, c as create, p as persist, s as subscribeWithSelector } from "./vendor-Dh2qjXKZ.js";
var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["ERROR"] = 0] = "ERROR";
  LogLevel2[LogLevel2["WARN"] = 1] = "WARN";
  LogLevel2[LogLevel2["INFO"] = 2] = "INFO";
  LogLevel2[LogLevel2["DEBUG"] = 3] = "DEBUG";
  return LogLevel2;
})(LogLevel || {});
const isDebugModeEnabled = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const windowConfig = window.nextConfig;
  return params.get("debug") === "true" || params.get("debugger") === "true" || windowConfig?.debug === true || windowConfig?.debugger === true;
};
const _Logger = class _Logger {
  constructor(context) {
    this.context = context;
  }
  static setLogLevel(level) {
    _Logger.globalLevel = level;
  }
  static getLogLevel() {
    return _Logger.globalLevel;
  }
  error(message, ...args) {
    if (_Logger.globalLevel >= 0) {
      console.error(`[${this.context}] ${message}`, ...args);
    }
  }
  warn(message, ...args) {
    if (!isDebugModeEnabled()) {
      return;
    }
    if (_Logger.globalLevel >= 1) {
      console.warn(`[${this.context}] ${message}`, ...args);
    }
  }
  info(message, ...args) {
    if (!isDebugModeEnabled()) {
      return;
    }
    if (_Logger.globalLevel >= 2) {
      console.info(`[${this.context}] ${message}`, ...args);
    }
  }
  debug(message, ...args) {
    if (!isDebugModeEnabled()) {
      return;
    }
    if (_Logger.globalLevel >= 3) {
      console.debug(`[${this.context}] ${message}`, ...args);
    }
  }
};
_Logger.globalLevel = 2;
let Logger = _Logger;
class ProductionLogger extends Logger {
  constructor(context) {
    super(context);
  }
  warn(message, ...args) {
    if (isDebugModeEnabled()) {
      super.warn(message, ...args);
    }
  }
  info(message, ...args) {
    if (isDebugModeEnabled()) {
      super.info(message, ...args);
    }
  }
  debug(message, ...args) {
    if (isDebugModeEnabled()) {
      super.debug(message, ...args);
    }
  }
}
function createLogger(context) {
  {
    return new ProductionLogger(context);
  }
}
createLogger("SDK");
class StorageManager {
  constructor(options = {}) {
    this.logger = createLogger("StorageManager");
    this.storage = options.storage ?? sessionStorage;
    this.serialize = options.serialize ?? JSON.stringify;
    this.deserialize = options.deserialize ?? JSON.parse;
  }
  set(key, value) {
    try {
      const serialized = this.serialize(value);
      this.storage.setItem(key, serialized);
      this.logger.debug(`Stored value for key: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to store value for key ${key}:`, error);
      return false;
    }
  }
  get(key, defaultValue) {
    try {
      const item = this.storage.getItem(key);
      if (item === null) {
        this.logger.debug(`No value found for key: ${key}`);
        return defaultValue;
      }
      const deserialized = this.deserialize(item);
      this.logger.debug(`Retrieved value for key: ${key}`);
      return deserialized;
    } catch (error) {
      this.logger.error(`Failed to retrieve value for key ${key}:`, error);
      return defaultValue;
    }
  }
  remove(key) {
    try {
      this.storage.removeItem(key);
      this.logger.debug(`Removed value for key: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove value for key ${key}:`, error);
      return false;
    }
  }
  clear() {
    try {
      this.storage.clear();
      this.logger.debug("Cleared all storage");
      return true;
    } catch (error) {
      this.logger.error("Failed to clear storage:", error);
      return false;
    }
  }
  has(key) {
    return this.storage.getItem(key) !== null;
  }
  keys() {
    const keys = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key !== null) {
        keys.push(key);
      }
    }
    return keys;
  }
  size() {
    let total = 0;
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key !== null) {
        const value = this.storage.getItem(key);
        if (value !== null) {
          total += key.length + value.length;
        }
      }
    }
    return total;
  }
}
const sessionStorageManager = new StorageManager({
  storage: sessionStorage
});
new StorageManager({
  storage: localStorage
});
const CART_STORAGE_KEY = "next-cart-state";
const CAMPAIGN_STORAGE_KEY = "next-campaign-cache";
const initialCartState = {
  items: [],
  enrichedItems: [],
  totalQuantity: 0,
  isEmpty: true,
  vouchers: [],
  subtotal: new Decimal(0),
  hasDiscounts: false,
  totalDiscount: new Decimal(0),
  totalDiscountPercentage: new Decimal(0),
  total: new Decimal(0),
  isCalculating: false
};
const createCartItemsSlice = (set, get) => ({
  reset: () => set(initialCartState),
  setLastCurrency: (currency) => set({ currency }),
  hasItem: (packageId) => get().items.some((item) => item.packageId === packageId),
  getItem: (packageId) => get().items.find((item) => item.packageId === packageId),
  getItemQuantity: (packageId) => get().items.find((item) => item.packageId === packageId)?.quantity ?? 0,
  getTotalWeight: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
  getTotalItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
  getCoupons: () => get().vouchers ?? []
});
const createCartUiSlice = (set) => ({
  swapInProgress: false,
  setSwapInProgress: (value) => set({ swapInProgress: value }),
  isCalculating: false
});
class EventBus {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map();
  }
  static getInstance() {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    this.listeners.get(event).add(handler);
  }
  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Event handler error for ${String(event)}:`, error);
        }
      });
    }
  }
  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
const events = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  EventBus
});
const logger$5 = createLogger("CartStore");
const CALC_DEBOUNCE_MS = 150;
let calcTimer = null;
let calcController = null;
function scheduleCalculate(fn) {
  calcController?.abort();
  calcController = new AbortController();
  const { signal } = calcController;
  if (calcTimer) clearTimeout(calcTimer);
  calcTimer = setTimeout(() => fn(signal), CALC_DEBOUNCE_MS);
}
function optimisticTotals(items) {
  const subtotal = items.reduce(
    (sum, item) => sum.plus(new Decimal(item.price).times(item.quantity)),
    new Decimal(0)
  );
  const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);
  return { subtotal, total: subtotal, totalQuantity, isEmpty: items.length === 0 };
}
const createCartApiSlice = (set, get) => ({
  addItem: async (item) => {
    const { useCampaignStore: useCampaignStore2 } = await Promise.resolve().then(() => index);
    const campaignStore = useCampaignStore2.getState();
    const finalPackageId = item.packageId ?? 0;
    const packageData = campaignStore.getPackage(finalPackageId);
    if (!packageData) {
      throw new Error(`Package ${finalPackageId} not found in campaign data`);
    }
    set((state) => {
      const newItem = {
        id: Date.now(),
        packageId: finalPackageId,
        originalPackageId: item.originalPackageId,
        quantity: item.quantity ?? 1,
        price: parseFloat(packageData.price_total),
        title: item.title ?? packageData.name,
        is_upsell: item.isUpsell ?? false,
        image: item.image ?? packageData.image ?? void 0,
        sku: item.sku ?? packageData.product_sku ?? void 0,
        price_per_unit: packageData.price,
        qty: packageData.qty,
        price_total: packageData.price_total,
        price_retail: packageData.price_retail,
        price_retail_total: packageData.price_retail_total,
        price_recurring: packageData.price_recurring,
        is_recurring: packageData.is_recurring,
        interval: packageData.interval,
        interval_count: packageData.interval_count,
        productId: packageData.product_id,
        productName: packageData.product_name,
        variantId: packageData.product_variant_id,
        variantName: packageData.product_variant_name,
        variantAttributes: packageData.product_variant_attribute_values,
        variantSku: packageData.product_sku ?? void 0
      };
      if (item.isUpsell) {
        logger$5.debug("Adding upsell item:", {
          packageId: newItem.packageId,
          isUpsell: item.isUpsell,
          finalItemIsUpsell: newItem.is_upsell,
          itemData: newItem
        });
      }
      const existingIndex = state.items.findIndex(
        (existing) => existing.packageId === newItem.packageId
      );
      let newItems;
      if (existingIndex >= 0) {
        newItems = [...state.items];
        newItems[existingIndex].quantity += newItem.quantity;
      } else {
        newItems = [...state.items, newItem];
      }
      return { ...state, items: newItems, ...optimisticTotals(newItems) };
    });
    EventBus.getInstance().emit("cart:item-added", {
      packageId: item.packageId ?? 0,
      quantity: item.quantity ?? 1
    });
    get().calculateTotals();
  },
  removeItem: async (packageId) => {
    const removedItem = get().items.find((item) => item.packageId === packageId);
    set((state) => {
      const newItems = state.items.filter((item) => item.packageId !== packageId);
      return { ...state, items: newItems, ...optimisticTotals(newItems) };
    });
    if (removedItem) {
      EventBus.getInstance().emit("cart:item-removed", { packageId });
    }
    get().calculateTotals();
  },
  updateQuantity: async (packageId, quantity) => {
    if (quantity <= 0) {
      return get().removeItem(packageId);
    }
    const currentItem = get().items.find((item) => item.packageId === packageId);
    const oldQuantity = currentItem?.quantity ?? 0;
    set((state) => {
      const newItems = state.items.map(
        (item) => item.packageId === packageId ? { ...item, quantity } : item
      );
      return { ...state, items: newItems, ...optimisticTotals(newItems) };
    });
    if (currentItem) {
      EventBus.getInstance().emit("cart:quantity-changed", {
        packageId,
        quantity,
        oldQuantity
      });
    }
    get().calculateTotals();
  },
  swapPackage: async (removePackageId, addItem) => {
    const { useCampaignStore: useCampaignStore2 } = await Promise.resolve().then(() => index);
    const campaignStore = useCampaignStore2.getState();
    const finalPackageId = addItem.packageId ?? 0;
    const newPackageData = campaignStore.getPackage(finalPackageId);
    if (!newPackageData) {
      throw new Error(`Package ${finalPackageId} not found in campaign data`);
    }
    const previousItem = get().items.find(
      (item) => item.packageId === removePackageId
    );
    const newItem = {
      id: Date.now(),
      packageId: finalPackageId,
      originalPackageId: void 0,
      quantity: addItem.quantity ?? 1,
      price: parseFloat(newPackageData.price_total),
      title: addItem.title ?? newPackageData.name,
      is_upsell: addItem.isUpsell ?? false,
      image: addItem.image ?? newPackageData.image ?? void 0,
      sku: addItem.sku ?? newPackageData.product_sku ?? void 0,
      price_per_unit: newPackageData.price,
      qty: newPackageData.qty,
      price_total: newPackageData.price_total,
      price_retail: newPackageData.price_retail,
      price_retail_total: newPackageData.price_retail_total,
      price_recurring: newPackageData.price_recurring,
      is_recurring: newPackageData.is_recurring,
      interval: newPackageData.interval,
      interval_count: newPackageData.interval_count,
      productId: newPackageData.product_id,
      productName: newPackageData.product_name,
      variantId: newPackageData.product_variant_id,
      variantName: newPackageData.product_variant_name,
      variantAttributes: newPackageData.product_variant_attribute_values,
      variantSku: newPackageData.product_sku ?? void 0
    };
    const priceDifference = newItem.price - (previousItem?.price ?? 0);
    set((state) => {
      const newItems = state.items.filter(
        (item) => item.packageId !== removePackageId
      );
      const existingIndex = newItems.findIndex(
        (existing) => existing.packageId === newItem.packageId
      );
      if (existingIndex >= 0) {
        newItems[existingIndex].quantity += newItem.quantity;
      } else {
        newItems.push(newItem);
      }
      return { ...state, items: newItems, swapInProgress: false, ...optimisticTotals(newItems) };
    });
    const eventBus = EventBus.getInstance();
    const swapEvent = {
      previousPackageId: removePackageId,
      newPackageId: finalPackageId,
      newItem,
      priceDifference,
      source: "package-selector"
    };
    if (previousItem) {
      swapEvent.previousItem = previousItem;
    }
    eventBus.emit("cart:package-swapped", swapEvent);
    get().calculateTotals();
  },
  swapCart: async (items) => {
    const { useCampaignStore: useCampaignStore2 } = await Promise.resolve().then(() => index);
    const campaignStore = useCampaignStore2.getState();
    logger$5.debug("Swapping cart with new items:", items);
    set((state) => ({ ...state, swapInProgress: true }));
    const newItems = [];
    for (const item of items) {
      const finalPackageId = item.packageId;
      const originalPackageId = item.originalPackageId;
      const packageData = campaignStore.getPackage(finalPackageId);
      if (!packageData) {
        logger$5.warn(`Package ${finalPackageId} not found in campaign data, skipping`);
        logger$5.debug(
          "Available packages:",
          campaignStore.data?.packages?.map((p) => p.ref_id)
        );
        continue;
      }
      logger$5.debug(`Package ${finalPackageId} found:`, packageData);
      newItems.push({
        id: Date.now() + Math.random(),
        packageId: finalPackageId,
        originalPackageId,
        title: packageData.name || `Package ${finalPackageId}`,
        price: parseFloat(packageData.price_total),
        price_retail: packageData.price_retail,
        quantity: item.quantity,
        is_upsell: item.isUpsell ?? false,
        selectorId: item.selectorId,
        image: packageData.image,
        sku: packageData.product_sku ?? void 0,
        qty: packageData.qty,
        price_total: packageData.price_total,
        price_retail_total: packageData.price_retail_total,
        price_per_unit: packageData.price,
        price_recurring: packageData.price_recurring,
        is_recurring: packageData.is_recurring,
        interval: packageData.interval,
        interval_count: packageData.interval_count,
        productId: packageData.product_id,
        productName: packageData.product_name,
        variantId: packageData.product_variant_id,
        variantName: packageData.product_variant_name,
        variantAttributes: packageData.product_variant_attribute_values,
        variantSku: packageData.product_sku ?? void 0
      });
    }
    set((state) => ({ ...state, items: newItems, swapInProgress: false, ...optimisticTotals(newItems) }));
    get().calculateTotals();
    logger$5.info(`Cart swapped successfully with ${newItems.length} items`);
  },
  clear: () => {
    set((state) => ({ ...state, items: [], ...optimisticTotals([]) }));
    get().calculateTotals();
  },
  syncWithAPI: async () => {
    logger$5.debug("syncWithAPI not yet implemented");
  },
  calculateTotals: () => {
    set({ isCalculating: true });
    scheduleCalculate(async (signal) => {
      try {
        const { useCampaignStore: useCampaignStore2 } = await Promise.resolve().then(() => index);
        const { useCheckoutStore: useCheckoutStore2 } = await Promise.resolve().then(() => checkoutStore);
        const { calculateCart } = await import("./utils-C4PNEPcs.js").then((n) => n.w);
        const campaignState = useCampaignStore2.getState();
        const checkoutState = useCheckoutStore2.getState();
        const state = get();
        try {
          const { subtotal, total, hasDiscounts, totalDiscount, totalDiscountPercentage, shippingMethod, summary } = await calculateCart({
            lines: state.items.map((item) => ({
              package_id: item.packageId,
              quantity: item.quantity,
              is_upsell: item.is_upsell ?? false
            })),
            vouchers: [...checkoutState.vouchers],
            currency: campaignState.currency ?? null,
            shippingMethod: state.shippingMethod?.id ?? 1,
            signal
          });
          if (!summary) return;
          const updatedItems = state.items.map((item) => {
            const line = summary.lines.find(
              (l) => l.package_id === item.packageId
            );
            if (line) {
              return {
                ...item,
                unit_price: line.unit_price,
                original_unit_price: line.original_unit_price,
                package_price: line.package_price,
                original_package_price: line.original_package_price,
                total: line.total,
                total_discount: line.total_discount,
                discounts: line.discounts ?? []
              };
            }
            return item;
          });
          const enrichedSummaryLines = summary.lines.map((line) => {
            const pkg = campaignState.getPackage(line.package_id);
            if (!pkg) return line;
            return {
              ...line,
              name: pkg.name,
              image: pkg.image,
              qty: pkg.qty,
              price: pkg.price,
              price_total: pkg.price_total,
              price_retail: pkg.price_retail,
              price_retail_total: pkg.price_retail_total,
              price_recurring: pkg.price_recurring,
              price_recurring_total: pkg.price_recurring_total,
              is_recurring: pkg.is_recurring,
              interval: pkg.interval,
              interval_count: pkg.interval_count,
              product_name: pkg.product_name,
              product_variant_name: pkg.product_variant_name,
              product_sku: pkg.product_sku,
              product_variant_attribute_values: pkg.product_variant_attribute_values
            };
          });
          if (signal.aborted) return;
          const totalQuantity = summary.lines.reduce((s, l) => s + l.quantity, 0);
          set({
            items: updatedItems,
            subtotal,
            total,
            hasDiscounts,
            totalDiscount,
            totalDiscountPercentage,
            shippingMethod,
            totalQuantity,
            isEmpty: updatedItems.length === 0,
            vouchers: [...checkoutState.vouchers],
            offerDiscounts: summary.offer_discounts ?? [],
            voucherDiscounts: summary.voucher_discounts ?? [],
            summary: { ...summary, lines: enrichedSummaryLines },
            isCalculating: false
          });
          EventBus.getInstance().emit("cart:updated", get());
        } catch (error) {
          if (signal.aborted) return;
          logger$5.error("Failed to sync cart with API:", error);
          set({ isCalculating: false });
        }
      } catch (error) {
        logger$5.error("Error calculating totals:", error);
        set({
          subtotal: new Decimal(0),
          total: new Decimal(0),
          hasDiscounts: false,
          totalDiscount: new Decimal(0),
          totalDiscountPercentage: new Decimal(0),
          totalQuantity: 0,
          isEmpty: true,
          isCalculating: false
        });
      }
    });
  },
  refreshItemPrices: async () => {
    try {
      logger$5.info("Refreshing cart item prices with new currency data...");
      const { useCampaignStore: useCampaignStore2 } = await Promise.resolve().then(() => index);
      const campaignStore = useCampaignStore2.getState();
      if (!campaignStore.data) {
        logger$5.warn("No campaign data available to refresh prices");
        return;
      }
      const state = get();
      const updatedItems = state.items.map((item) => {
        const packageData = campaignStore.getPackage(item.packageId);
        if (!packageData) {
          logger$5.warn(`Package ${item.packageId} not found in campaign data`);
          return item;
        }
        return {
          ...item,
          price: parseFloat(packageData.price_total),
          price_per_unit: packageData.price,
          price_total: packageData.price_total,
          price_retail: packageData.price_retail,
          price_retail_total: packageData.price_retail_total,
          price_recurring: packageData.price_recurring,
          productId: item.productId ?? packageData.product_id,
          productName: item.productName ?? packageData.product_name,
          variantId: item.variantId ?? packageData.product_variant_id,
          variantName: item.variantName ?? packageData.product_variant_name,
          variantAttributes: item.variantAttributes ?? packageData.product_variant_attribute_values,
          variantSku: item.variantSku ?? packageData.product_sku ?? void 0
        };
      });
      let updatedShippingMethod = state.shippingMethod;
      if (updatedShippingMethod && campaignStore.data.shipping_methods) {
        const shippingMethodData = campaignStore.data.shipping_methods.find(
          (method) => method.ref_id === updatedShippingMethod.id
        );
        if (shippingMethodData) {
          const newPrice = new Decimal(shippingMethodData.price ?? "0");
          updatedShippingMethod = {
            ...updatedShippingMethod,
            price: newPrice,
            originalPrice: newPrice
          };
          logger$5.info(
            `Updated shipping method price: ${updatedShippingMethod.code} = ${newPrice.toNumber()} ${campaignStore.currency ?? ""}`
          );
        }
      }
      set((state2) => ({
        ...state2,
        items: updatedItems,
        shippingMethod: updatedShippingMethod
      }));
      logger$5.info("Cart item prices and shipping refreshed with new currency");
      get().calculateTotals();
    } catch (error) {
      logger$5.error("Failed to refresh item prices:", error);
    }
  },
  setShippingMethod: async (methodId) => {
    try {
      const { useCampaignStore: useCampaignStore2 } = await Promise.resolve().then(() => index);
      const { useCheckoutStore: useCheckoutStore2 } = await Promise.resolve().then(() => checkoutStore);
      const campaignStore = useCampaignStore2.getState();
      const checkoutStore$1 = useCheckoutStore2.getState();
      const campaignData = campaignStore.data;
      if (!campaignData?.shipping_methods) {
        throw new Error("No shipping methods available");
      }
      const shippingMethod = campaignData.shipping_methods.find(
        (method) => method.ref_id === methodId
      );
      if (!shippingMethod) {
        throw new Error(`Shipping method ${methodId} not found`);
      }
      const price = new Decimal(shippingMethod.price ?? "0");
      set((state) => ({
        ...state,
        shippingMethod: {
          id: shippingMethod.ref_id,
          name: shippingMethod.code,
          code: shippingMethod.code,
          originalPrice: price,
          price,
          discountAmount: new Decimal(0),
          discountPercentage: new Decimal(0),
          hasDiscounts: false
        }
      }));
      checkoutStore$1.setShippingMethod({
        id: shippingMethod.ref_id,
        name: shippingMethod.code,
        price: price.toNumber(),
        code: shippingMethod.code
      });
      get().calculateTotals();
      EventBus.getInstance().emit("shipping:method-changed", {
        methodId,
        method: shippingMethod
      });
    } catch (error) {
      logger$5.error("Failed to set shipping method:", error);
      throw error;
    }
  },
  applyCoupon: async (code) => {
    const { useCheckoutStore: useCheckoutStore2 } = await Promise.resolve().then(() => checkoutStore);
    const checkoutState = useCheckoutStore2.getState();
    const normalizedCode = code.toUpperCase().trim();
    if (checkoutState.vouchers.includes(normalizedCode)) {
      return { success: false, message: "Coupon already applied" };
    }
    checkoutState.addVoucher(normalizedCode);
    get().calculateTotals();
    return {
      success: true,
      message: `Coupon ${normalizedCode} applied successfully`
    };
  },
  removeCoupon: async (code) => {
    const { useCheckoutStore: useCheckoutStore2 } = await Promise.resolve().then(() => checkoutStore);
    useCheckoutStore2.getState().removeVoucher(code);
    get().calculateTotals();
  }
});
const logger$4 = createLogger("CartStore");
const cartStoreInstance = create()(
  persist(
    subscribeWithSelector((...a) => ({
      ...initialCartState,
      ...createCartItemsSlice(...a),
      ...createCartUiSlice(...a),
      ...createCartApiSlice(...a)
    })),
    {
      name: CART_STORAGE_KEY,
      storage: {
        getItem: (name) => sessionStorageManager.get(name),
        setItem: (name, value) => sessionStorageManager.set(name, value),
        removeItem: (name) => sessionStorageManager.remove(name)
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          logger$4.debug("Cart store rehydrated, recalculating totals...");
          if (state.shippingMethod) {
            const sm = state.shippingMethod;
            state.shippingMethod = {
              ...sm,
              price: new Decimal(sm.price),
              originalPrice: new Decimal(sm.originalPrice),
              discountAmount: new Decimal(sm.discountAmount),
              discountPercentage: new Decimal(sm.discountPercentage)
            };
          }
          state.calculateTotals();
        }
      },
      partialize: (state) => ({
        items: state.items,
        vouchers: state.vouchers,
        shippingMethod: state.shippingMethod,
        totalQuantity: state.totalQuantity,
        isEmpty: state.isEmpty,
        enrichedItems: []
      })
    }
  )
);
const useCartStore = cartStoreInstance;
const index$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  useCartStore
});
const CACHE_EXPIRY_MS$1 = 10 * 60 * 1e3;
const logger$3 = createLogger("CampaignStore");
const initialCampaignState = {
  data: null,
  currency: null,
  packages: [],
  isLoading: false,
  error: null
};
const createCampaignItemsSlice = (set, get) => ({
  processPackagesWithVariants: (packages) => {
    return packages.map((pkg) => {
      if (pkg.product_id && pkg.product_variant_id) {
        const product = {
          id: pkg.product_id,
          name: pkg.product_name ?? "",
          variant: {
            id: pkg.product_variant_id,
            name: pkg.product_variant_name ?? "",
            attributes: pkg.product_variant_attribute_values ?? [],
            sku: pkg.product_sku
          },
          purchase_availability: pkg.product_purchase_availability ?? "available",
          inventory_availability: pkg.product_inventory_availability ?? "untracked"
        };
        return { ...pkg, product };
      }
      return pkg;
    });
  },
  getPackage: (id) => get().packages.find((pkg) => pkg.ref_id === id) ?? null,
  getProduct: (id) => get().getPackage(id),
  setError: (error) => set({ error }),
  reset: () => set(initialCampaignState),
  clearCache: () => {
    try {
      const storage = window.sessionStorage;
      const keysToRemove = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && (key.startsWith(CAMPAIGN_STORAGE_KEY) || key === CAMPAIGN_STORAGE_KEY)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => {
        sessionStorageManager.remove(key);
        logger$3.debug(`Removed cache: ${key}`);
      });
      logger$3.info(
        `Campaign cache cleared (${keysToRemove.length} entries removed)`
      );
    } catch (error) {
      logger$3.error("Failed to clear campaign cache:", error);
      const currencies = [
        "USD",
        "EUR",
        "GBP",
        "CAD",
        "AUD",
        "JPY",
        "BRL",
        "MXN",
        "INR"
      ];
      currencies.forEach((c) => {
        sessionStorageManager.remove(`${CAMPAIGN_STORAGE_KEY}_${c}`);
      });
      sessionStorageManager.remove(CAMPAIGN_STORAGE_KEY);
    }
  },
  getCacheInfo: () => {
    const currency = get().currency ?? "USD";
    const cacheKey = `${CAMPAIGN_STORAGE_KEY}_${currency}`;
    const cachedData = sessionStorageManager.get(cacheKey);
    if (!cachedData) {
      return { cached: false };
    }
    const now = Date.now();
    const timeLeft = CACHE_EXPIRY_MS$1 - (now - cachedData.timestamp);
    return {
      cached: true,
      expiresIn: Math.max(0, Math.round(timeLeft / 1e3)),
      apiKey: cachedData.apiKey,
      currency
    };
  }
});
const createCampaignVariantsSlice = (_set, get) => ({
  getVariantsByProductId: (productId) => {
    const productPackages = get().packages.filter(
      (pkg) => pkg.product_id === productId
    );
    if (productPackages.length === 0) return null;
    const attributeTypes = /* @__PURE__ */ new Set();
    productPackages.forEach((pkg) => {
      pkg.product_variant_attribute_values?.forEach((attr) => {
        attributeTypes.add(attr.code);
      });
    });
    const firstPackage = productPackages[0];
    return {
      productId,
      productName: firstPackage.product_name ?? "",
      attributeTypes: Array.from(attributeTypes),
      variants: productPackages.map((pkg) => ({
        variantId: pkg.product_variant_id ?? 0,
        variantName: pkg.product_variant_name ?? "",
        packageRefId: pkg.ref_id,
        attributes: pkg.product_variant_attribute_values ?? [],
        sku: pkg.product_sku,
        price: pkg.price,
        availability: {
          purchase: pkg.product_purchase_availability ?? "available",
          inventory: pkg.product_inventory_availability ?? "untracked"
        }
      }))
    };
  },
  getAvailableVariantAttributes: (productId, attributeCode) => {
    const variantGroup = get().getVariantsByProductId(productId);
    if (!variantGroup) return [];
    const values = /* @__PURE__ */ new Set();
    variantGroup.variants.forEach((variant) => {
      const attr = variant.attributes.find((a) => a.code === attributeCode);
      if (attr) values.add(attr.value);
    });
    return Array.from(values).sort();
  },
  getPackageByVariantSelection: (productId, selectedAttributes) => {
    return get().packages.find((pkg) => {
      if (pkg.product_id !== productId) return false;
      for (const [code, value] of Object.entries(selectedAttributes)) {
        const hasMatch = pkg.product_variant_attribute_values?.some(
          (attr) => attr.code === code && attr.value === value
        );
        if (!hasMatch) return false;
      }
      return true;
    }) ?? null;
  }
});
const CACHE_EXPIRY_MS = 10 * 60 * 1e3;
const logger$2 = createLogger("CampaignStore");
const createCampaignApiSlice = (set, get) => ({
  loadCampaign: async (apiKey, options) => {
    set({ isLoading: true, error: null });
    try {
      const { useConfigStore } = await Promise.resolve().then(() => configStore$1);
      const configStore2 = useConfigStore.getState();
      const requestedCurrency = configStore2.getCurrency();
      const now = Date.now();
      const requestedCacheKey = `${CAMPAIGN_STORAGE_KEY}_${requestedCurrency}`;
      const fallbackCacheKey = `${CAMPAIGN_STORAGE_KEY}_USD`;
      const urlParams = new URLSearchParams(window.location.search);
      const urlCurrency = urlParams.get("currency");
      const isUrlCurrencyOverride = urlCurrency != null && urlCurrency === requestedCurrency;
      const forceFresh = options?.forceFresh ?? false;
      let cachedData = sessionStorageManager.get(requestedCacheKey);
      if (!cachedData && requestedCurrency !== "USD" && !isUrlCurrencyOverride && !forceFresh) {
        cachedData = sessionStorageManager.get(fallbackCacheKey);
        if (cachedData) {
          logger$2.info(
            `No cache for ${requestedCurrency}, checking USD cache as potential fallback`
          );
        }
      }
      if (forceFresh && cachedData) {
        logger$2.info(
          `Force fresh fetch requested, skipping cache for ${requestedCurrency}`
        );
        cachedData = void 0;
      }
      if (cachedData && cachedData.apiKey === apiKey && now - cachedData.timestamp < CACHE_EXPIRY_MS && (!isUrlCurrencyOverride || cachedData.campaign.currency === requestedCurrency)) {
        const cachedCurrency = cachedData.campaign.currency;
        logger$2.info(
          `Using cached campaign data for ${cachedCurrency} (expires in ` + Math.round(
            (CACHE_EXPIRY_MS - (now - cachedData.timestamp)) / 1e3
          ) + " seconds)"
        );
        if (cachedCurrency !== requestedCurrency) {
          logger$2.warn(
            `Requested ${requestedCurrency} but using cached ${cachedCurrency} (fallback)`
          );
          configStore2.updateConfig({
            selectedCurrency: cachedCurrency,
            currencyFallbackOccurred: true
          });
          sessionStorage.setItem("next_selected_currency", cachedCurrency);
          const { EventBus: EventBus2 } = await Promise.resolve().then(() => events);
          EventBus2.getInstance().emit("currency:fallback", {
            requested: requestedCurrency,
            actual: cachedCurrency,
            reason: "cached"
          });
        }
        if (cachedData.campaign.payment_env_key) {
          configStore2.setSpreedlyEnvironmentKey(
            cachedData.campaign.payment_env_key
          );
        }
        const processedPackages2 = get().processPackagesWithVariants(
          cachedData.campaign.packages
        );
        set({
          data: { ...cachedData.campaign, packages: processedPackages2 },
          currency: cachedData.campaign.currency,
          packages: processedPackages2,
          isLoading: false,
          error: null,
          isFromCache: true,
          cacheAge: now - cachedData.timestamp
        });
        return;
      }
      if (isUrlCurrencyOverride && cachedData?.campaign.currency !== requestedCurrency) {
        logger$2.info(
          `URL parameter forcing fresh fetch for currency: ${requestedCurrency} (cache had ${cachedData?.campaign.currency ?? "none"})`
        );
      }
      logger$2.info(
        `Fetching campaign data from API with currency: ${requestedCurrency}...`
      );
      const { ApiClient } = await import("./api-ypWecDS1.js");
      const client = new ApiClient(apiKey);
      const campaign = await client.getCampaigns(requestedCurrency);
      if (!campaign) {
        throw new Error("Campaign data not found");
      }
      const actualCurrency = campaign.currency ?? requestedCurrency;
      if (actualCurrency !== requestedCurrency) {
        logger$2.warn(
          `API Fallback: Requested ${requestedCurrency}, received ${actualCurrency}`
        );
        configStore2.updateConfig({
          selectedCurrency: actualCurrency,
          currencyFallbackOccurred: true
        });
        sessionStorage.setItem("next_selected_currency", actualCurrency);
        const { EventBus: EventBus2 } = await Promise.resolve().then(() => events);
        EventBus2.getInstance().emit("currency:fallback", {
          requested: requestedCurrency,
          actual: actualCurrency,
          reason: "api"
        });
      } else {
        configStore2.updateConfig({ currencyFallbackOccurred: false });
      }
      if (campaign.payment_env_key) {
        configStore2.setSpreedlyEnvironmentKey(campaign.payment_env_key);
        logger$2.info(
          "Spreedly environment key updated from campaign API: " + campaign.payment_env_key
        );
      }
      const processedPackages = get().processPackagesWithVariants(
        campaign.packages
      );
      const actualCacheKey = `${CAMPAIGN_STORAGE_KEY}_${actualCurrency}`;
      const cacheData = {
        campaign: { ...campaign, packages: processedPackages },
        timestamp: now,
        apiKey
      };
      sessionStorageManager.set(actualCacheKey, cacheData);
      logger$2.info(`Campaign data cached for ${actualCurrency} (10 minutes)`);
      if (actualCurrency !== requestedCurrency) {
        sessionStorage.removeItem(requestedCacheKey);
        logger$2.debug(`Cleared invalid cache for ${requestedCurrency}`);
      }
      set({
        data: { ...campaign, packages: processedPackages },
        currency: actualCurrency,
        packages: processedPackages,
        isLoading: false,
        error: null,
        isFromCache: false,
        cacheAge: 0
      });
      const { useCartStore: useCartStore2 } = await Promise.resolve().then(() => index$1);
      const cartStore = useCartStore2.getState();
      if (!cartStore.isEmpty && cartStore.currency && cartStore.currency !== actualCurrency) {
        logger$2.info("Currency changed, refreshing cart prices...");
        await cartStore.refreshItemPrices();
        cartStore.setLastCurrency(actualCurrency);
      } else if (!cartStore.currency) {
        cartStore.setLastCurrency(actualCurrency);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load campaign";
      set({
        data: null,
        packages: [],
        isLoading: false,
        error: errorMessage
      });
      logger$2.error("Campaign load failed:", error);
      throw error;
    }
  }
});
const campaignStoreInstance = create()((set, get, store) => ({
  ...initialCampaignState,
  ...createCampaignItemsSlice(set, get),
  ...createCampaignVariantsSlice(set, get),
  ...createCampaignApiSlice(set, get)
}));
const useCampaignStore = campaignStoreInstance;
const index = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  useCampaignStore
});
const initialState$3 = {
  step: 1,
  isProcessing: false,
  errors: {},
  formData: {},
  paymentMethod: "credit-card",
  sameAsShipping: true,
  testMode: false,
  vouchers: []
};
const useCheckoutStore = create()(
  persist(
    (set) => ({
      ...initialState$3,
      setStep: (step) => {
        set({ step });
      },
      setProcessing: (isProcessing) => {
        set({ isProcessing });
      },
      setError: (field, error) => {
        set((state) => ({
          errors: { ...state.errors, [field]: error }
        }));
      },
      clearError: (field) => {
        set((state) => {
          const { [field]: _, ...errors } = state.errors;
          return { errors };
        });
      },
      clearAllErrors: () => {
        set({ errors: {} });
      },
      updateFormData: (data) => {
        set((state) => ({
          formData: { ...state.formData, ...data }
        }));
      },
      setPaymentToken: (paymentToken) => {
        set({ paymentToken });
      },
      setPaymentMethod: (paymentMethod) => {
        set({ paymentMethod });
      },
      setShippingMethod: (shippingMethod) => {
        set({ shippingMethod });
      },
      setBillingAddress: (billingAddress) => {
        set({ billingAddress });
      },
      setSameAsShipping: (sameAsShipping) => {
        set({ sameAsShipping });
      },
      setTestMode: (testMode) => {
        set({ testMode });
      },
      addVoucher: (code) => {
        set((state) => ({
          vouchers: [...state.vouchers, code]
        }));
      },
      removeVoucher: (code) => {
        set((state) => ({
          vouchers: state.vouchers.filter((v) => v !== code)
        }));
      },
      reset: () => {
        set(initialState$3);
      }
    }),
    {
      name: "next-checkout-store",
      // Key in sessionStorage
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        }
      },
      // Exclude transient state from persistence
      partialize: (state) => {
        const paymentMethod = state.paymentMethod === "apple_pay" || state.paymentMethod === "google_pay" || state.paymentMethod === "paypal" ? "credit-card" : state.paymentMethod;
        const {
          cvv,
          card_cvv,
          month,
          expiration_month,
          year,
          expiration_year,
          "exp-month": expMonth,
          "exp-year": expYear,
          card_number,
          ...remainingFormData
        } = state.formData;
        const safeFormData = Object.fromEntries(
          Object.entries(remainingFormData).filter(([_, value]) => {
            if (typeof value === "string") return value.trim() !== "";
            if (typeof value === "boolean" || typeof value === "number")
              return true;
            return false;
          })
        );
        let billingAddress = state.billingAddress;
        if (billingAddress) {
          const filteredBilling = Object.fromEntries(
            Object.entries(billingAddress).filter(([_, value]) => {
              if (typeof value === "string") return value.trim() !== "";
              return false;
            })
          );
          billingAddress = Object.keys(filteredBilling).length > 0 ? filteredBilling : void 0;
        }
        return {
          step: state.step,
          formData: safeFormData,
          // Exclude CVV, expiration, card number, and empty values
          shippingMethod: state.shippingMethod,
          billingAddress,
          // Only non-empty billing fields
          sameAsShipping: state.sameAsShipping,
          paymentMethod,
          // Only persist credit-card/klarna, not express methods
          vouchers: state.vouchers
          // Persist so user-entered coupons survive refresh; bundle vouchers are deduped on re-apply
          // Explicitly exclude:
          // - errors (transient validation state)
          // - isProcessing (transient UI state)
          // - paymentToken (sensitive, should not persist)
          // - testMode (session-specific)
          // - CVV, card number, expiration (sensitive payment data)
          // - Empty string values (no benefit to persist)
        };
      }
    }
  )
);
const checkoutStore = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  useCheckoutStore
});
const logger$1 = createLogger("OrderStore");
const initialState$2 = {
  order: null,
  refId: null,
  orderLoadedAt: null,
  isLoading: false,
  isProcessingUpsell: false,
  error: null,
  upsellError: null,
  pendingUpsells: [],
  completedUpsells: [],
  completedUpsellPages: [],
  viewedUpsells: [],
  viewedUpsellPages: [],
  upsellJourney: []
};
const useOrderStore = create()(
  persist(
    (set, get) => ({
      ...initialState$2,
      // Order management
      setOrder: (order) => {
        logger$1.debug("Setting order data:", order);
        set({
          order,
          error: null,
          orderLoadedAt: Date.now()
        });
      },
      setRefId: (refId) => {
        logger$1.debug("Setting ref ID:", refId);
        set({ refId });
      },
      loadOrder: async (refId, apiClient) => {
        const state = get();
        if (state.order && state.refId === refId && !get().isOrderExpired()) {
          logger$1.info("Using cached order data:", refId);
          return;
        }
        if (state.isLoading) {
          logger$1.warn("Order loading already in progress");
          return;
        }
        logger$1.info("Loading order:", refId);
        set({ isLoading: true, error: null, refId });
        try {
          const order = await apiClient.getOrder(refId);
          logger$1.info("Order loaded successfully:", order);
          const upsellPackageIds = [];
          if (order.lines && Array.isArray(order.lines)) {
            order.lines.forEach((line) => {
              if (line.is_upsell && line.product_sku) {
                const skuMatch = line.product_sku.match(/(\d+)/);
                if (skuMatch) {
                  upsellPackageIds.push(skuMatch[1]);
                } else {
                  upsellPackageIds.push(line.product_sku);
                }
                logger$1.debug("Detected upsell line:", {
                  sku: line.product_sku,
                  title: line.product_title,
                  extractedId: skuMatch ? skuMatch[1] : line.product_sku
                });
              }
            });
          }
          set({
            order,
            isLoading: false,
            isProcessingUpsell: false,
            // Reset processing state when loading order
            error: null,
            orderLoadedAt: Date.now(),
            completedUpsells: upsellPackageIds,
            // Reset journey when loading a new order
            upsellJourney: [],
            viewedUpsells: [],
            viewedUpsellPages: []
          });
          logger$1.debug(
            "Populated completed upsells from order:",
            upsellPackageIds
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to load order";
          logger$1.error("Failed to load order:", error);
          set({
            isLoading: false,
            error: errorMessage,
            order: null
          });
        }
      },
      clearOrder: () => {
        logger$1.debug("Clearing order data");
        set({
          order: null,
          refId: null,
          error: null,
          orderLoadedAt: null
        });
      },
      isOrderExpired: () => {
        const state = get();
        if (!state.orderLoadedAt) return true;
        const EXPIRY_TIME = 15 * 60 * 1e3;
        const now = Date.now();
        const isExpired = now - state.orderLoadedAt > EXPIRY_TIME;
        if (isExpired) {
          logger$1.info("Order data has expired (>15 minutes old)");
        }
        return isExpired;
      },
      // Upsell management
      addUpsell: async (upsellData, apiClient) => {
        const state = get();
        if (!state.refId) {
          const error = "No order reference ID available";
          logger$1.error(error);
          set({ upsellError: error });
          return null;
        }
        if (state.isProcessingUpsell) {
          logger$1.warn("Upsell processing already in progress");
          return null;
        }
        logger$1.info("Adding upsell to order:", state.refId, upsellData);
        set({ isProcessingUpsell: true, upsellError: null });
        try {
          const updatedOrder = await apiClient.addUpsell(
            state.refId,
            upsellData
          );
          logger$1.info("Upsell added successfully:", updatedOrder);
          const currentPagePath = window.location.pathname;
          const packageIds = upsellData.lines.map(
            (line) => line.package_id.toString()
          );
          const journeyEntries = packageIds.map((id) => ({
            packageId: id,
            pagePath: currentPagePath,
            action: "accepted",
            timestamp: Date.now()
          }));
          set({
            order: updatedOrder,
            isProcessingUpsell: false,
            upsellError: null,
            orderLoadedAt: Date.now(),
            // Refresh the timestamp
            completedUpsells: [...state.completedUpsells, ...packageIds],
            // Keep for backward compatibility
            completedUpsellPages: state.completedUpsellPages.includes(
              currentPagePath
            ) ? state.completedUpsellPages : [...state.completedUpsellPages, currentPagePath],
            upsellJourney: [...state.upsellJourney, ...journeyEntries]
          });
          return updatedOrder;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to add upsell";
          logger$1.error("Failed to add upsell:", error);
          set({
            isProcessingUpsell: false,
            upsellError: errorMessage
          });
          return null;
        }
      },
      addPendingUpsell: (upsellData) => {
        const state = get();
        logger$1.debug("Adding pending upsell:", upsellData);
        set({
          pendingUpsells: [...state.pendingUpsells, upsellData]
        });
      },
      removePendingUpsell: (index2) => {
        const state = get();
        const newPendingUpsells = [...state.pendingUpsells];
        newPendingUpsells.splice(index2, 1);
        logger$1.debug("Removing pending upsell at index:", index2);
        set({ pendingUpsells: newPendingUpsells });
      },
      clearPendingUpsells: () => {
        logger$1.debug("Clearing pending upsells");
        set({ pendingUpsells: [] });
      },
      markUpsellCompleted: (packageId) => {
        const state = get();
        if (!state.completedUpsells.includes(packageId)) {
          logger$1.debug("Marking upsell as completed:", packageId);
          set({
            completedUpsells: [...state.completedUpsells, packageId]
          });
        }
      },
      markUpsellViewed: (packageId) => {
        const state = get();
        if (!state.viewedUpsells.includes(packageId)) {
          logger$1.debug("Marking upsell as viewed:", packageId);
          const journeyEntry = {
            packageId,
            action: "viewed",
            timestamp: Date.now()
          };
          set({
            viewedUpsells: [...state.viewedUpsells, packageId],
            upsellJourney: [...state.upsellJourney, journeyEntry]
          });
        }
      },
      markUpsellPageViewed: (pagePath) => {
        const state = get();
        if (!state.viewedUpsellPages.includes(pagePath)) {
          logger$1.debug("Marking upsell page as viewed:", pagePath);
          const journeyEntry = {
            pagePath,
            action: "viewed",
            timestamp: Date.now()
          };
          set({
            viewedUpsellPages: [...state.viewedUpsellPages, pagePath],
            upsellJourney: [...state.upsellJourney, journeyEntry],
            isProcessingUpsell: false,
            // Reset processing state when viewing new page
            upsellError: null
            // Clear any previous errors
          });
        }
      },
      markUpsellSkipped: (packageId, pagePath) => {
        const state = get();
        logger$1.debug("Marking upsell as skipped:", { packageId, pagePath });
        const journeyEntry = {
          action: "skipped",
          timestamp: Date.now()
        };
        if (packageId !== void 0) journeyEntry.packageId = packageId;
        if (pagePath !== void 0) journeyEntry.pagePath = pagePath;
        set({
          upsellJourney: [...state.upsellJourney, journeyEntry],
          isProcessingUpsell: false,
          // Reset processing state when skipping
          upsellError: null
          // Clear any errors
        });
      },
      // Error handling
      setError: (error) => set({ error }),
      setUpsellError: (error) => set({ upsellError: error }),
      clearErrors: () => set({ error: null, upsellError: null }),
      // Loading states
      setLoading: (loading) => set({ isLoading: loading }),
      setProcessingUpsell: (processing) => set({ isProcessingUpsell: processing }),
      // Utility methods
      hasUpsellPageBeenCompleted: (pagePath) => {
        const state = get();
        return state.completedUpsellPages.includes(pagePath);
      },
      hasUpsellBeenViewed: (packageId) => {
        const state = get();
        return state.viewedUpsells.includes(packageId);
      },
      hasUpsellPageBeenViewed: (pagePath) => {
        const state = get();
        return state.viewedUpsellPages.includes(pagePath);
      },
      getUpsellJourney: () => {
        const state = get();
        return state.upsellJourney;
      },
      getOrderTotal: () => {
        const state = get();
        if (!state.order) return 0;
        return parseFloat(state.order.total_incl_tax || "0");
      },
      canAddUpsells: () => {
        const state = get();
        return !!(state.order && state.order.supports_post_purchase_upsells && !state.isProcessingUpsell);
      },
      reset: () => {
        logger$1.debug("Resetting order store");
        set(initialState$2);
      }
    }),
    {
      name: "next-order",
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        }
      }
    }
  )
);
const initialState$1 = {
  apiKey: "",
  campaignId: "",
  debug: false,
  debugger: false,
  pageType: "product",
  // spreedlyEnvironmentKey: undefined, - omitted to avoid exactOptionalPropertyTypes issue
  paymentConfig: {},
  googleMapsConfig: {},
  addressConfig: {},
  // Additional configuration with enterprise defaults
  autoInit: true,
  rateLimit: 4,
  cacheTtl: 300,
  retryAttempts: 3,
  timeout: 1e4,
  testMode: false,
  // API and performance settings
  maxRetries: 3,
  requestTimeout: 3e4,
  enableAnalytics: true,
  enableDebugMode: false,
  // Environment and deployment settings
  environment: "production",
  // version: undefined, - omitted
  // buildTimestamp: undefined, - omitted
  // Discount system
  discounts: {},
  // Attribution
  // utmTransfer: undefined, - omitted
  // Tracking configuration
  tracking: "auto",
  // 'auto', 'manual', 'disabled'
  // Location and currency detection
  detectedCountry: "",
  detectedCurrency: "",
  detectedIp: "",
  // User's IP address from location detection
  selectedCurrency: "",
  locationData: null,
  // Cache the entire location response
  currencyBehavior: "auto",
  // Default to auto-switch currency on country change
  currencyFallbackOccurred: false,
  // Track if currency fallback happened
  clearCartOnInit: false
  // Error monitoring removed - add externally via HTML/scripts
};
const configStore = create((set, get) => ({
  ...initialState$1,
  loadFromMeta: () => {
    if (typeof document === "undefined") return;
    const updates = {};
    const apiKeyMeta = document.querySelector('meta[name="next-api-key"]');
    if (apiKeyMeta) {
      updates.apiKey = apiKeyMeta.getAttribute("content") ?? "";
    }
    const campaignIdMeta = document.querySelector(
      'meta[name="next-campaign-id"]'
    );
    if (campaignIdMeta) {
      updates.campaignId = campaignIdMeta.getAttribute("content") ?? "";
    }
    const debugMeta = document.querySelector('meta[name="next-debug"]');
    if (debugMeta) {
      updates.debug = debugMeta.getAttribute("content") === "true";
    }
    const clearCartMeta = document.querySelector(
      'meta[name="next-clear-cart"]'
    );
    if (clearCartMeta) {
      updates.clearCartOnInit = clearCartMeta.getAttribute("content") === "true";
    }
    const pageTypeMeta = document.querySelector('meta[name="next-page-type"]');
    if (pageTypeMeta) {
      updates.pageType = pageTypeMeta.getAttribute("content");
    }
    const spreedlyKeyMeta = document.querySelector('meta[name="next-spreedly-key"]') || document.querySelector('meta[name="next-payment-env-key"]');
    if (spreedlyKeyMeta) {
      const spreedlyKey = spreedlyKeyMeta.getAttribute("content");
      if (spreedlyKey) {
        updates.spreedlyEnvironmentKey = spreedlyKey;
      }
    }
    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },
  loadFromWindow: () => {
    if (typeof window === "undefined") return;
    const windowConfig = window.nextConfig;
    if (!windowConfig || typeof windowConfig !== "object") return;
    const updates = {};
    if (typeof windowConfig.apiKey === "string") {
      updates.apiKey = windowConfig.apiKey;
    }
    if (typeof windowConfig.campaignId === "string") {
      updates.campaignId = windowConfig.campaignId;
    }
    if (typeof windowConfig.debug === "boolean") {
      updates.debug = windowConfig.debug;
    }
    if (typeof windowConfig.debugger === "boolean") {
      updates.debugger = windowConfig.debugger;
    }
    if (typeof windowConfig.storeName === "string") {
      updates.storeName = windowConfig.storeName;
    }
    if (typeof windowConfig.pageType === "string") {
      updates.pageType = windowConfig.pageType;
    }
    if (typeof windowConfig.spreedlyEnvironmentKey === "string") {
      updates.spreedlyEnvironmentKey = windowConfig.spreedlyEnvironmentKey;
    }
    if (windowConfig.payment && typeof windowConfig.payment === "object") {
      updates.paymentConfig = windowConfig.payment;
    }
    if (windowConfig.paymentConfig && typeof windowConfig.paymentConfig === "object") {
      updates.paymentConfig = windowConfig.paymentConfig;
    }
    if (windowConfig.cardInputConfig && typeof windowConfig.cardInputConfig === "object") {
      if (!updates.paymentConfig) {
        updates.paymentConfig = {};
      }
      updates.paymentConfig.cardInputConfig = windowConfig.cardInputConfig;
    } else if (windowConfig.spreedly && typeof windowConfig.spreedly === "object") {
      if (!updates.paymentConfig) {
        updates.paymentConfig = {};
      }
      updates.paymentConfig.cardInputConfig = windowConfig.spreedly;
    } else if (windowConfig.spreedlyConfig && typeof windowConfig.spreedlyConfig === "object") {
      if (!updates.paymentConfig) {
        updates.paymentConfig = {};
      }
      updates.paymentConfig.cardInputConfig = windowConfig.spreedlyConfig;
    }
    if (windowConfig.googleMaps && typeof windowConfig.googleMaps === "object") {
      updates.googleMapsConfig = windowConfig.googleMaps;
    }
    if (windowConfig.addressConfig && typeof windowConfig.addressConfig === "object") {
      updates.addressConfig = windowConfig.addressConfig;
    }
    if (windowConfig.currencyBehavior && (windowConfig.currencyBehavior === "auto" || windowConfig.currencyBehavior === "manual")) {
      updates.currencyBehavior = windowConfig.currencyBehavior;
    }
    if (windowConfig.discounts && typeof windowConfig.discounts === "object") {
      updates.discounts = windowConfig.discounts;
    }
    if (typeof windowConfig.tracking === "string") {
      updates.tracking = windowConfig.tracking;
    }
    if (windowConfig.analytics && typeof windowConfig.analytics === "object") {
      updates.analytics = windowConfig.analytics;
    }
    if (windowConfig.utmTransfer && typeof windowConfig.utmTransfer === "object") {
      updates.utmTransfer = windowConfig.utmTransfer;
    }
    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },
  updateConfig: (config) => {
    set((state) => ({ ...state, ...config }));
  },
  setSpreedlyEnvironmentKey: (key) => {
    set({ spreedlyEnvironmentKey: key });
  },
  reset: () => {
    set(initialState$1);
  },
  getCurrency: () => {
    const state = get();
    return state.selectedCurrency || state.detectedCurrency || "USD";
  }
}));
const configStore$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  configStore,
  useConfigStore: configStore
});
const getInitialMetadata = () => ({
  landing_page: typeof window !== "undefined" ? window.location.href : "",
  referrer: typeof document !== "undefined" ? document.referrer : "",
  device: typeof navigator !== "undefined" ? navigator.userAgent : "",
  device_type: typeof navigator !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) ? "mobile" : "desktop",
  domain: typeof window !== "undefined" ? window.location.hostname : "",
  timestamp: Date.now()
});
const initialState = {
  // Attribution fields
  affiliate: "",
  funnel: "",
  gclid: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_content: "",
  utm_term: "",
  subaffiliate1: "",
  subaffiliate2: "",
  subaffiliate3: "",
  subaffiliate4: "",
  subaffiliate5: "",
  // Metadata - initialized with actual browser values
  metadata: getInitialMetadata(),
  // Timestamps
  first_visit_timestamp: Date.now(),
  current_visit_timestamp: Date.now()
};
const useAttributionStore = create()(
  persist(
    (set, get) => ({
      ...initialState,
      initialize: async () => {
        try {
          const { AttributionCollector } = await import("./utils-C4PNEPcs.js").then((n) => n.A);
          const collector = new AttributionCollector();
          const data = await collector.collect();
          set((state) => ({
            ...state,
            ...data,
            // Merge metadata to preserve custom fields
            metadata: {
              ...state.metadata,
              // Preserve existing custom fields
              ...data.metadata
              // Update with new collected data
            },
            // Preserve first visit timestamp if it exists
            first_visit_timestamp: state.first_visit_timestamp || data.first_visit_timestamp
          }));
        } catch (error) {
          console.error(
            "[AttributionStore] Error initializing attribution:",
            error
          );
        }
      },
      updateAttribution: (data) => {
        set((state) => ({
          ...state,
          ...data,
          metadata: data.metadata ? { ...state.metadata, ...data.metadata } : state.metadata,
          current_visit_timestamp: Date.now()
        }));
      },
      setFunnelName: (funnel) => {
        if (!funnel) {
          console.warn("[AttributionStore] Cannot set empty funnel name");
          return;
        }
        const currentState = get();
        if (currentState.funnel) {
          console.info(
            `[AttributionStore] Funnel already set to: ${currentState.funnel}, ignoring new value: ${funnel}`
          );
          return;
        }
        const persistedFunnel = localStorage.getItem("next_funnel_name") || sessionStorage.getItem("next_funnel_name");
        if (persistedFunnel) {
          console.info(
            `[AttributionStore] Funnel already persisted as: ${persistedFunnel}, ignoring new value: ${funnel}`
          );
          set({ funnel: persistedFunnel });
          return;
        }
        set({ funnel });
        try {
          sessionStorage.setItem("next_funnel_name", funnel);
          localStorage.setItem("next_funnel_name", funnel);
          console.info(
            `[AttributionStore] Funnel name set and persisted: ${funnel}`
          );
        } catch (error) {
          console.error(
            "[AttributionStore] Error persisting funnel name:",
            error
          );
        }
      },
      setEverflowClickId: (evclid) => {
        if (!evclid) {
          console.warn("[AttributionStore] Cannot set empty Everflow click ID");
          return;
        }
        localStorage.setItem("evclid", evclid);
        sessionStorage.setItem("evclid", evclid);
        set((state) => ({
          ...state,
          metadata: {
            ...state.metadata,
            everflow_transaction_id: evclid
          }
        }));
        console.info(`[AttributionStore] Everflow click ID set to: ${evclid}`);
      },
      getAttributionForApi: () => {
        const state = get();
        const attribution = {};
        if (state.affiliate && state.affiliate !== "")
          attribution.affiliate = state.affiliate;
        if (state.funnel && state.funnel !== "")
          attribution.funnel = state.funnel;
        if (state.gclid && state.gclid !== "") attribution.gclid = state.gclid;
        if (state.metadata !== void 0) attribution.metadata = state.metadata;
        if (state.utm_source && state.utm_source !== "")
          attribution.utm_source = state.utm_source;
        if (state.utm_medium && state.utm_medium !== "")
          attribution.utm_medium = state.utm_medium;
        if (state.utm_campaign && state.utm_campaign !== "")
          attribution.utm_campaign = state.utm_campaign;
        if (state.utm_content && state.utm_content !== "")
          attribution.utm_content = state.utm_content;
        if (state.utm_term && state.utm_term !== "")
          attribution.utm_term = state.utm_term;
        if (state.subaffiliate1 && state.subaffiliate1 !== "")
          attribution.subaffiliate1 = state.subaffiliate1;
        if (state.subaffiliate2 && state.subaffiliate2 !== "")
          attribution.subaffiliate2 = state.subaffiliate2;
        if (state.subaffiliate3 && state.subaffiliate3 !== "")
          attribution.subaffiliate3 = state.subaffiliate3;
        if (state.subaffiliate4 && state.subaffiliate4 !== "")
          attribution.subaffiliate4 = state.subaffiliate4;
        if (state.subaffiliate5 && state.subaffiliate5 !== "")
          attribution.subaffiliate5 = state.subaffiliate5;
        if (state.metadata.everflow_transaction_id) {
          attribution.everflow_transaction_id = state.metadata.everflow_transaction_id;
        }
        return attribution;
      },
      debug: () => {
        const state = get();
        console.group("🔍 Attribution Debug Info");
        console.log("📊 Key Attribution Values:");
        console.log("- Affiliate:", state.affiliate || "(not set)");
        console.log("- Funnel:", state.funnel || "(not set)");
        console.log("- GCLID:", state.gclid || "(not set)");
        console.log("\n📈 UTM Parameters:");
        console.log("- Source:", state.utm_source || "(not set)");
        console.log("- Medium:", state.utm_medium || "(not set)");
        console.log("- Campaign:", state.utm_campaign || "(not set)");
        console.log("- Content:", state.utm_content || "(not set)");
        console.log("- Term:", state.utm_term || "(not set)");
        console.log("\n👥 Subaffiliates:");
        for (let i = 1; i <= 5; i++) {
          const key = `subaffiliate${i}`;
          console.log(`- Subaffiliate ${i}:`, state[key] || "(not set)");
        }
        console.log("\n🔄 Everflow:");
        console.log(
          "- Transaction ID:",
          state.metadata.everflow_transaction_id || "(not set)"
        );
        console.log(
          "- localStorage evclid:",
          localStorage.getItem("evclid") || "(not set)"
        );
        console.log(
          "- sessionStorage evclid:",
          sessionStorage.getItem("evclid") || "(not set)"
        );
        console.log("\n📘 Facebook:");
        console.log("- fbclid:", state.metadata.fbclid || "(not set)");
        console.log("- fb_fbp:", state.metadata.fb_fbp || "(not set)");
        console.log("- fb_fbc:", state.metadata.fb_fbc || "(not set)");
        console.log(
          "- fb_pixel_id:",
          state.metadata.fb_pixel_id || "(not set)"
        );
        console.log("\n🔗 Click Tracking:");
        console.log(
          "- Click ID (metadata):",
          state.metadata.clickid || "(not set)"
        );
        console.log("\n📋 Metadata:");
        console.log(
          "- SDK Version:",
          state.metadata.sdk_version || "(not set)"
        );
        console.log("- User IP:", state.metadata.user_ip || "(not set)");
        console.log("- Landing Page:", state.metadata.landing_page);
        console.log("- Referrer:", state.metadata.referrer || "(direct)");
        console.log("- Domain:", state.metadata.domain);
        console.log("- Device Type:", state.metadata.device_type);
        console.log(
          "- First Visit:",
          new Date(state.first_visit_timestamp).toLocaleString()
        );
        console.log(
          "- Current Visit:",
          new Date(state.current_visit_timestamp).toLocaleString()
        );
        if (state.metadata.conversion_timestamp) {
          console.log(
            "- Conversion Time:",
            new Date(state.metadata.conversion_timestamp).toLocaleString()
          );
        }
        console.log("\n📤 API Format:");
        console.log(JSON.stringify(get().getAttributionForApi(), null, 2));
        console.log("\n🔗 Current URL Parameters:");
        console.log(window.location.search || "(none)");
        console.groupEnd();
        return "Attribution debug info logged to console.";
      },
      reset: () => {
        set(initialState);
      },
      clearPersistedFunnel: () => {
        try {
          localStorage.removeItem("next_funnel_name");
          sessionStorage.removeItem("next_funnel_name");
          set({ funnel: "" });
          console.info("[AttributionStore] Cleared persisted funnel name");
        } catch (error) {
          console.error(
            "[AttributionStore] Error clearing persisted funnel:",
            error
          );
        }
      }
    }),
    {
      name: "next-attribution",
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        }
      }
    }
  )
);
const logger = createLogger("ParameterStore");
const useParameterStore = create()(
  persist(
    (set, get) => ({
      params: {},
      updateParam: (key, value) => {
        set((state) => ({
          params: { ...state.params, [key]: value }
        }));
        logger.debug(`Parameter updated: ${key} = ${value}`);
      },
      updateParams: (params) => {
        set({ params });
        logger.debug("Parameters replaced:", params);
      },
      mergeParams: (params) => {
        set((state) => ({
          params: { ...state.params, ...params }
        }));
        logger.debug("Parameters merged:", params);
      },
      getParam: (key) => {
        const state = get();
        return state.params[key];
      },
      hasParam: (key) => {
        const state = get();
        return key in state.params;
      },
      clearParams: () => {
        set({ params: {} });
        logger.info("All parameters cleared");
      },
      removeParam: (key) => {
        set((state) => {
          const newParams = { ...state.params };
          delete newParams[key];
          return { params: newParams };
        });
        logger.debug(`Parameter removed: ${key}`);
      },
      debug: () => {
        const state = get();
        console.group("🔍 URL Parameters Debug Info");
        const paramCount = Object.keys(state.params).length;
        console.log(`📊 Total parameters: ${paramCount}`);
        if (paramCount > 0) {
          console.log("\n📋 Current parameters:");
          console.table(state.params);
          const grouped = {};
          Object.entries(state.params).forEach(([key, value]) => {
            const prefix = key.includes("_") ? key.split("_")[0] : "other";
            if (!grouped[prefix]) grouped[prefix] = [];
            grouped[prefix].push(`${key}=${value}`);
          });
          console.log("\n🗂️ Parameters by prefix:");
          Object.entries(grouped).forEach(([prefix, params]) => {
            console.log(`  ${prefix}: ${params.join(", ")}`);
          });
        } else {
          console.log("No parameters currently stored");
        }
        const currentUrlParams = new URLSearchParams(window.location.search);
        const currentParams = {};
        currentUrlParams.forEach((value, key) => {
          currentParams[key] = value;
        });
        if (Object.keys(currentParams).length > 0) {
          console.log("\n🔗 Current URL parameters:");
          console.table(currentParams);
          const storedKeys = new Set(Object.keys(state.params));
          const urlKeys = new Set(Object.keys(currentParams));
          const onlyInStore = Array.from(storedKeys).filter(
            (k) => !urlKeys.has(k)
          );
          const onlyInUrl = Array.from(urlKeys).filter((k) => !storedKeys.has(k));
          const different = Array.from(storedKeys).filter(
            (k) => urlKeys.has(k) && state.params[k] !== currentParams[k]
          );
          if (onlyInStore.length > 0 || onlyInUrl.length > 0 || different.length > 0) {
            console.log("\n⚠️ Differences:");
            if (onlyInStore.length > 0) {
              console.log("  Only in store:", onlyInStore);
            }
            if (onlyInUrl.length > 0) {
              console.log("  Only in URL:", onlyInUrl);
            }
            if (different.length > 0) {
              console.log("  Different values:", different);
            }
          }
        }
        console.groupEnd();
        return "Parameter debug info logged to console.";
      }
    }),
    {
      name: "next-url-params",
      storage: {
        getItem: (name) => {
          try {
            const str = sessionStorage.getItem(name);
            return str ? JSON.parse(str) : null;
          } catch (error) {
            logger.error("Error reading from sessionStorage:", error);
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            sessionStorage.setItem(name, JSON.stringify(value));
          } catch (error) {
            logger.error("Error writing to sessionStorage:", error);
          }
        },
        removeItem: (name) => {
          try {
            sessionStorage.removeItem(name);
          } catch (error) {
            logger.error("Error removing from sessionStorage:", error);
          }
        }
      }
    }
  )
);
const parameterStore = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  useParameterStore
});
export {
  CART_STORAGE_KEY as C,
  EventBus as E,
  Logger as L,
  configStore as a,
  useCheckoutStore as b,
  createLogger as c,
  useCampaignStore as d,
  useCartStore as e,
  useOrderStore as f,
  useParameterStore as g,
  LogLevel as h,
  index$1 as i,
  index as j,
  checkoutStore as k,
  configStore$1 as l,
  parameterStore as p,
  sessionStorageManager as s,
  useAttributionStore as u
};
