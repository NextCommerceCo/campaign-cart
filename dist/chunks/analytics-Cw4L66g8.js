import { c as create, p as persist, s as subscribeWithSelector } from "./vendor-CPGw6ITf.js";
import { s as sessionStorageManager, C as CAMPAIGN_STORAGE_KEY, c as createLogger, S as StorageManager, a as CART_STORAGE_KEY, f as formatPercentage, b as formatCurrency, E as EventBus } from "./utils-BYdmVAcS.js";
const CACHE_EXPIRY_MS = 10 * 60 * 1e3;
const logger$a = createLogger("CampaignStore");
const initialState$5 = {
  data: null,
  packages: [],
  isLoading: false,
  error: null
};
const campaignStoreInstance = create((set, get) => ({
  ...initialState$5,
  processPackagesWithVariants: (packages) => {
    return packages.map((pkg) => {
      if (pkg.product_id && pkg.product_variant_id) {
        const product = {
          id: pkg.product_id,
          name: pkg.product_name || "",
          variant: {
            id: pkg.product_variant_id,
            name: pkg.product_variant_name || "",
            attributes: pkg.product_variant_attribute_values || [],
            sku: pkg.product_sku
          },
          purchase_availability: pkg.product_purchase_availability || "available",
          inventory_availability: pkg.product_inventory_availability || "untracked"
        };
        return {
          ...pkg,
          product
        };
      }
      return pkg;
    });
  },
  loadCampaign: async (apiKey, options) => {
    set({ isLoading: true, error: null });
    try {
      const { useConfigStore } = await Promise.resolve().then(() => configStore$1);
      const configStore2 = useConfigStore.getState();
      const requestedCurrency = configStore2.selectedCurrency || configStore2.detectedCurrency || "USD";
      const now = Date.now();
      const requestedCacheKey = `${CAMPAIGN_STORAGE_KEY}_${requestedCurrency}`;
      const fallbackCacheKey = `${CAMPAIGN_STORAGE_KEY}_USD`;
      const urlParams = new URLSearchParams(window.location.search);
      const urlCurrency = urlParams.get("currency");
      const isUrlCurrencyOverride = urlCurrency && urlCurrency === requestedCurrency;
      const forceFresh = options?.forceFresh || false;
      let cachedData = sessionStorageManager.get(requestedCacheKey);
      if (!cachedData && requestedCurrency !== "USD" && !isUrlCurrencyOverride && !forceFresh) {
        cachedData = sessionStorageManager.get(fallbackCacheKey);
        if (cachedData) {
          logger$a.info(`No cache for ${requestedCurrency}, checking USD cache as potential fallback`);
        }
      }
      if (forceFresh && cachedData) {
        logger$a.info(`🔄 Force fresh fetch requested, skipping cache for ${requestedCurrency}`);
        cachedData = void 0;
      }
      if (cachedData && cachedData.apiKey === apiKey && now - cachedData.timestamp < CACHE_EXPIRY_MS && (!isUrlCurrencyOverride || cachedData.campaign.currency === requestedCurrency)) {
        const cachedCurrency = cachedData.campaign.currency;
        logger$a.info(`🎯 Using cached campaign data for ${cachedCurrency} (expires in ` + Math.round((CACHE_EXPIRY_MS - (now - cachedData.timestamp)) / 1e3) + " seconds)");
        if (cachedCurrency !== requestedCurrency) {
          logger$a.warn(`⚠️ Requested ${requestedCurrency} but using cached ${cachedCurrency} (fallback)`);
          configStore2.updateConfig({
            selectedCurrency: cachedCurrency,
            currencyFallbackOccurred: true
          });
          sessionStorage.setItem("next_selected_currency", cachedCurrency);
          const { EventBus: EventBus2 } = await import("./utils-BYdmVAcS.js").then((n) => n.y);
          EventBus2.getInstance().emit("currency:fallback", {
            requested: requestedCurrency,
            actual: cachedCurrency,
            reason: "cached"
          });
        }
        if (cachedData.campaign.payment_env_key) {
          configStore2.setSpreedlyEnvironmentKey(cachedData.campaign.payment_env_key);
        }
        const processedPackages2 = get().processPackagesWithVariants(cachedData.campaign.packages);
        set({
          data: { ...cachedData.campaign, packages: processedPackages2 },
          packages: processedPackages2,
          isLoading: false,
          error: null,
          isFromCache: true,
          cacheAge: now - cachedData.timestamp
        });
        return;
      }
      if (isUrlCurrencyOverride && cachedData?.campaign.currency !== requestedCurrency) {
        logger$a.info(`🔄 URL parameter forcing fresh fetch for currency: ${requestedCurrency} (cache had ${cachedData?.campaign.currency || "none"})`);
      }
      logger$a.info(`🌐 Fetching campaign data from API with currency: ${requestedCurrency}...`);
      const { ApiClient } = await import("./api-5dYcqF6q.js");
      const client = new ApiClient(apiKey);
      const campaign = await client.getCampaigns(requestedCurrency);
      if (!campaign) {
        throw new Error("Campaign data not found");
      }
      const actualCurrency = campaign.currency || requestedCurrency;
      if (actualCurrency !== requestedCurrency) {
        logger$a.warn(`⚠️ API Fallback: Requested ${requestedCurrency}, received ${actualCurrency}`);
        configStore2.updateConfig({
          selectedCurrency: actualCurrency,
          currencyFallbackOccurred: true
        });
        sessionStorage.setItem("next_selected_currency", actualCurrency);
        const { EventBus: EventBus2 } = await import("./utils-BYdmVAcS.js").then((n) => n.y);
        EventBus2.getInstance().emit("currency:fallback", {
          requested: requestedCurrency,
          actual: actualCurrency,
          reason: "api"
        });
      } else {
        configStore2.updateConfig({
          currencyFallbackOccurred: false
        });
      }
      if (campaign.payment_env_key) {
        configStore2.setSpreedlyEnvironmentKey(campaign.payment_env_key);
        logger$a.info("💳 Spreedly environment key updated from campaign API: " + campaign.payment_env_key);
      }
      const processedPackages = get().processPackagesWithVariants(campaign.packages);
      const actualCacheKey = `${CAMPAIGN_STORAGE_KEY}_${actualCurrency}`;
      const cacheData = {
        campaign: { ...campaign, packages: processedPackages },
        timestamp: now,
        apiKey
      };
      sessionStorageManager.set(actualCacheKey, cacheData);
      logger$a.info(`💾 Campaign data cached for ${actualCurrency} (10 minutes)`);
      if (actualCurrency !== requestedCurrency) {
        sessionStorage.removeItem(requestedCacheKey);
        logger$a.debug(`Cleared invalid cache for ${requestedCurrency}`);
      }
      set({
        data: { ...campaign, packages: processedPackages },
        packages: processedPackages,
        isLoading: false,
        error: null,
        isFromCache: false,
        cacheAge: 0
      });
      const { useCartStore: useCartStore2 } = await Promise.resolve().then(() => cartStore);
      const cartStore$1 = useCartStore2.getState();
      if (!cartStore$1.isEmpty && cartStore$1.lastCurrency && cartStore$1.lastCurrency !== actualCurrency) {
        logger$a.info("Currency changed, refreshing cart prices...");
        await cartStore$1.refreshItemPrices();
        cartStore$1.setLastCurrency(actualCurrency);
      } else if (!cartStore$1.lastCurrency) {
        cartStore$1.setLastCurrency(actualCurrency);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load campaign";
      set({
        data: null,
        packages: [],
        isLoading: false,
        error: errorMessage
      });
      logger$a.error("Campaign load failed:", error);
      throw error;
    }
  },
  getPackage: (id) => {
    const { packages } = get();
    return packages.find((pkg) => pkg.ref_id === id) ?? null;
  },
  getProduct: (id) => {
    return get().getPackage(id);
  },
  setError: (error) => {
    set({ error });
  },
  reset: () => {
    set(initialState$5);
  },
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
        logger$a.debug(`Removed cache: ${key}`);
      });
      logger$a.info(`🗑️ Campaign cache cleared (${keysToRemove.length} entries removed)`);
    } catch (error) {
      logger$a.error("Failed to clear campaign cache:", error);
      const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "BRL", "MXN", "INR"];
      currencies.forEach((currency) => {
        sessionStorageManager.remove(`${CAMPAIGN_STORAGE_KEY}_${currency}`);
      });
      sessionStorageManager.remove(CAMPAIGN_STORAGE_KEY);
    }
  },
  getCacheInfo: () => {
    const { useConfigStore } = require("./configStore");
    const configStore2 = useConfigStore.getState();
    const currency = configStore2.selectedCurrency || configStore2.detectedCurrency || "USD";
    const cacheKey = `${CAMPAIGN_STORAGE_KEY}_${currency}`;
    const cachedData = sessionStorageManager.get(cacheKey);
    if (!cachedData) {
      return { cached: false };
    }
    const now = Date.now();
    const timeLeft = CACHE_EXPIRY_MS - (now - cachedData.timestamp);
    return {
      cached: true,
      expiresIn: Math.max(0, Math.round(timeLeft / 1e3)),
      // seconds until expiry
      apiKey: cachedData.apiKey,
      currency
    };
  },
  getVariantsByProductId: (productId) => {
    const { packages } = get();
    const productPackages = packages.filter((pkg) => pkg.product_id === productId);
    if (productPackages.length === 0) {
      return null;
    }
    const attributeTypes = /* @__PURE__ */ new Set();
    productPackages.forEach((pkg) => {
      pkg.product_variant_attribute_values?.forEach((attr) => {
        attributeTypes.add(attr.code);
      });
    });
    const firstPackage = productPackages[0];
    return {
      productId,
      productName: firstPackage.product_name || "",
      attributeTypes: Array.from(attributeTypes),
      variants: productPackages.map((pkg) => ({
        variantId: pkg.product_variant_id || 0,
        variantName: pkg.product_variant_name || "",
        packageRefId: pkg.ref_id,
        attributes: pkg.product_variant_attribute_values || [],
        sku: pkg.product_sku,
        price: pkg.price,
        availability: {
          purchase: pkg.product_purchase_availability || "available",
          inventory: pkg.product_inventory_availability || "untracked"
        }
      }))
    };
  },
  getAvailableVariantAttributes: (productId, attributeCode) => {
    const variantGroup = get().getVariantsByProductId(productId);
    if (!variantGroup) {
      return [];
    }
    const values = /* @__PURE__ */ new Set();
    variantGroup.variants.forEach((variant) => {
      const attribute = variant.attributes.find((attr) => attr.code === attributeCode);
      if (attribute) {
        values.add(attribute.value);
      }
    });
    return Array.from(values).sort();
  },
  getPackageByVariantSelection: (productId, selectedAttributes) => {
    const { packages } = get();
    return packages.find((pkg) => {
      if (pkg.product_id !== productId) {
        return false;
      }
      for (const [code, value] of Object.entries(selectedAttributes)) {
        const hasMatch = pkg.product_variant_attribute_values?.some(
          (attr) => attr.code === code && attr.value === value
        );
        if (!hasMatch) {
          return false;
        }
      }
      return true;
    }) ?? null;
  },
  getProductVariantsWithPricing: (productId) => {
    const { packages } = get();
    const productPackages = packages.filter((pkg) => pkg.product_id === productId);
    if (productPackages.length === 0) {
      return null;
    }
    const variantsMap = /* @__PURE__ */ new Map();
    const attributeTypes = /* @__PURE__ */ new Set();
    productPackages.forEach((pkg) => {
      const variantKey = pkg.product_variant_attribute_values?.map((attr) => `${attr.code}:${attr.value}`).sort().join("|") || "";
      pkg.product_variant_attribute_values?.forEach((attr) => {
        attributeTypes.add(attr.code);
      });
      if (!variantsMap.has(variantKey)) {
        variantsMap.set(variantKey, {
          variantId: pkg.product_variant_id || 0,
          variantName: pkg.product_variant_name || "",
          attributes: pkg.product_variant_attribute_values || [],
          sku: pkg.product_sku,
          availability: {
            purchase: pkg.product_purchase_availability || "available",
            inventory: pkg.product_inventory_availability || "untracked"
          },
          pricingTiers: []
        });
      }
      const tierMatch = pkg.name.match(/^(Buy \d+|Subscribe)/i);
      const tierType = tierMatch ? tierMatch[1] : "Standard";
      variantsMap.get(variantKey).pricingTiers.push({
        packageRefId: pkg.ref_id,
        name: pkg.name,
        price: pkg.price,
        retailPrice: pkg.price_retail,
        quantity: pkg.qty,
        tierType
      });
    });
    variantsMap.forEach((variant) => {
      variant.pricingTiers.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    });
    const firstPackage = productPackages[0];
    return {
      productId,
      productName: firstPackage.product_name || "",
      attributeTypes: Array.from(attributeTypes),
      variants: variantsMap
    };
  },
  getVariantPricingTiers: (productId, variantKey) => {
    const productGroup = get().getProductVariantsWithPricing(productId);
    if (!productGroup) {
      return [];
    }
    const variant = productGroup.variants.get(variantKey);
    return variant ? variant.pricingTiers : [];
  },
  getLowestPriceForVariant: (productId, variantKey) => {
    const pricingTiers = get().getVariantPricingTiers(productId, variantKey);
    if (pricingTiers.length === 0) {
      return null;
    }
    return pricingTiers.reduce(
      (lowest, current) => parseFloat(current.price) < parseFloat(lowest.price) ? current : lowest
    );
  }
}));
const useCampaignStore = campaignStoreInstance;
const campaignStore = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  useCampaignStore
});
const profileStorageManager = new StorageManager({ storage: localStorage });
const logger$9 = createLogger("ProfileStore");
const initialState$4 = {
  profiles: /* @__PURE__ */ new Map(),
  activeProfileId: null,
  previousProfileId: null,
  mappingHistory: [],
  originalCartSnapshot: void 0
};
const useProfileStore = create()(
  persist(
    subscribeWithSelector((set, get) => ({
      ...initialState$4,
      registerProfile: (profile) => {
        set((state) => {
          const profiles = new Map(state.profiles);
          const reverseMapping = {};
          Object.entries(profile.packageMappings).forEach(([original, mapped]) => {
            reverseMapping[mapped] = parseInt(original, 10);
          });
          profiles.set(profile.id, {
            ...profile,
            reverseMapping
          });
          logger$9.info(`Profile "${profile.id}" registered with ${Object.keys(profile.packageMappings).length} mappings`);
          return { profiles };
        });
      },
      activateProfile: (profileId) => {
        const state = get();
        if (!state.profiles.has(profileId)) {
          logger$9.error(`Cannot activate profile "${profileId}" - not found`);
          return;
        }
        set({
          previousProfileId: state.activeProfileId,
          activeProfileId: profileId
        });
        logger$9.info(`Profile "${profileId}" activated`);
      },
      deactivateProfile: () => {
        const state = get();
        set({
          previousProfileId: state.activeProfileId,
          activeProfileId: null
        });
        logger$9.info("Profile deactivated");
      },
      getMappedPackageId: (originalId) => {
        const state = get();
        if (!state.activeProfileId) {
          return originalId;
        }
        const profile = state.profiles.get(state.activeProfileId);
        if (!profile) {
          return originalId;
        }
        const mappedId = profile.packageMappings[originalId];
        if (mappedId !== void 0) {
          logger$9.debug(`Mapped package ${originalId} -> ${mappedId} (profile: ${state.activeProfileId})`);
          return mappedId;
        }
        return originalId;
      },
      getOriginalPackageId: (mappedId) => {
        const state = get();
        if (!state.activeProfileId) {
          return null;
        }
        const profile = state.profiles.get(state.activeProfileId);
        if (!profile) {
          return null;
        }
        if (profile.reverseMapping && profile.reverseMapping[mappedId] !== void 0) {
          return profile.reverseMapping[mappedId];
        }
        for (const [original, mapped] of Object.entries(profile.packageMappings)) {
          if (mapped === mappedId) {
            return parseInt(original, 10);
          }
        }
        return null;
      },
      mapPackageIds: (packageIds) => {
        const getMappedId = get().getMappedPackageId;
        return packageIds.map((id) => getMappedId(id));
      },
      getActiveProfile: () => {
        const state = get();
        if (!state.activeProfileId) {
          return null;
        }
        return state.profiles.get(state.activeProfileId) || null;
      },
      hasProfile: (profileId) => {
        return get().profiles.has(profileId);
      },
      getProfileById: (profileId) => {
        return get().profiles.get(profileId) || null;
      },
      getAllProfiles: () => {
        return Array.from(get().profiles.values());
      },
      setOriginalCartSnapshot: (items) => {
        set({ originalCartSnapshot: [...items] });
        logger$9.debug(`Cart snapshot saved with ${items.length} items`);
      },
      clearOriginalCartSnapshot: () => {
        set({ originalCartSnapshot: void 0 });
        logger$9.debug("Cart snapshot cleared");
      },
      addMappingEvent: (event) => {
        set((state) => ({
          mappingHistory: [
            ...state.mappingHistory,
            {
              ...event,
              timestamp: Date.now()
            }
          ].slice(-50)
          // Keep last 50 events
        }));
      },
      clearHistory: () => {
        set({ mappingHistory: [] });
      },
      reset: () => {
        set(initialState$4);
        logger$9.info("ProfileStore reset to initial state");
      }
    })),
    {
      name: "next-profile-store",
      storage: {
        getItem: (name) => {
          const str = profileStorageManager.get(name);
          if (!str) return null;
          const stored = JSON.parse(str);
          if (stored.state?.profiles) {
            stored.state.profiles = new Map(stored.state.profiles);
          }
          return stored;
        },
        setItem: (name, value) => {
          const toStore = { ...value };
          if (toStore.state?.profiles instanceof Map) {
            toStore.state.profiles = Array.from(toStore.state.profiles.entries());
          }
          profileStorageManager.set(name, JSON.stringify(toStore));
        },
        removeItem: (name) => {
          profileStorageManager.remove(name);
        }
      }
    }
  )
);
const profileStore = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  useProfileStore
});
const initialState$3 = {
  apiKey: "",
  campaignId: "",
  debug: false,
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
  selectedCurrency: "",
  locationData: null,
  // Cache the entire location response
  currencyBehavior: "auto",
  // Default to auto-switch currency on country change
  currencyFallbackOccurred: false,
  // Track if currency fallback happened
  // Profile configuration
  profiles: {},
  defaultProfile: void 0,
  activeProfile: void 0
  // Error monitoring removed - add externally via HTML/scripts
};
const configStore = create((set, _get) => ({
  ...initialState$3,
  loadFromMeta: () => {
    if (typeof document === "undefined") return;
    const updates = {};
    const apiKeyMeta = document.querySelector('meta[name="next-api-key"]');
    if (apiKeyMeta) {
      updates.apiKey = apiKeyMeta.getAttribute("content") ?? "";
    }
    const campaignIdMeta = document.querySelector('meta[name="next-campaign-id"]');
    if (campaignIdMeta) {
      updates.campaignId = campaignIdMeta.getAttribute("content") ?? "";
    }
    const debugMeta = document.querySelector('meta[name="next-debug"]');
    if (debugMeta) {
      updates.debug = debugMeta.getAttribute("content") === "true";
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
    if (windowConfig.spreedly && typeof windowConfig.spreedly === "object") {
      if (!updates.paymentConfig) {
        updates.paymentConfig = {};
      }
      updates.paymentConfig.spreedly = windowConfig.spreedly;
    }
    if (windowConfig.spreedlyConfig && typeof windowConfig.spreedlyConfig === "object") {
      if (!updates.paymentConfig) {
        updates.paymentConfig = {};
      }
      updates.paymentConfig.spreedly = windowConfig.spreedlyConfig;
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
    if (windowConfig.profiles && typeof windowConfig.profiles === "object") {
      updates.profiles = windowConfig.profiles;
    }
    if (typeof windowConfig.defaultProfile === "string") {
      updates.defaultProfile = windowConfig.defaultProfile;
    }
    if (typeof windowConfig.activeProfile === "string") {
      updates.activeProfile = windowConfig.activeProfile;
    }
    if (Object.keys(updates).length > 0) {
      set(updates);
      if (updates.profiles) {
        const profileStore2 = useProfileStore.getState();
        Object.entries(updates.profiles).forEach(([id, config]) => {
          profileStore2.registerProfile({
            id,
            name: config.name,
            description: config.description || "",
            packageMappings: config.packageMappings
          });
        });
      }
    }
  },
  loadProfiles: () => {
    const state = _get();
    if (!state.profiles || Object.keys(state.profiles).length === 0) {
      return;
    }
    const profileStore2 = useProfileStore.getState();
    Object.entries(state.profiles).forEach(([id, config]) => {
      profileStore2.registerProfile({
        id,
        name: config.name,
        description: config.description || "",
        packageMappings: config.packageMappings
      });
    });
  },
  updateConfig: (config) => {
    set((state) => ({ ...state, ...config }));
  },
  setSpreedlyEnvironmentKey: (key) => {
    set({ spreedlyEnvironmentKey: key });
  },
  reset: () => {
    set(initialState$3);
  }
}));
const configStore$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  configStore,
  useConfigStore: configStore
});
const logger$8 = createLogger("CartStore");
const initialState$2 = {
  items: [],
  subtotal: 0,
  shipping: 0,
  tax: 0,
  total: 0,
  totalQuantity: 0,
  isEmpty: true,
  appliedCoupons: [],
  enrichedItems: [],
  totals: {
    subtotal: { value: 0, formatted: "$0.00" },
    shipping: { value: 0, formatted: "FREE" },
    tax: { value: 0, formatted: "$0.00" },
    discounts: { value: 0, formatted: "$0.00" },
    total: { value: 0, formatted: "$0.00" },
    totalExclShipping: { value: 0, formatted: "$0.00" },
    count: 0,
    isEmpty: true,
    savings: { value: 0, formatted: "$0.00" },
    savingsPercentage: { value: 0, formatted: "0%" },
    compareTotal: { value: 0, formatted: "$0.00" },
    hasSavings: false,
    totalSavings: { value: 0, formatted: "$0.00" },
    totalSavingsPercentage: { value: 0, formatted: "0%" },
    hasTotalSavings: false
  }
};
const cartStoreInstance = create()(
  persist(
    subscribeWithSelector((set, get) => ({
      ...initialState$2,
      addItem: async (item) => {
        const { useCampaignStore: useCampaignStore2 } = await Promise.resolve().then(() => campaignStore);
        const { useProfileStore: useProfileStore2 } = await Promise.resolve().then(() => profileStore);
        const campaignStore$1 = useCampaignStore2.getState();
        const profileStore$1 = useProfileStore2.getState();
        let finalPackageId = item.packageId ?? 0;
        if (!item.originalPackageId && profileStore$1.activeProfileId) {
          const mappedId = profileStore$1.getMappedPackageId(finalPackageId);
          if (mappedId !== finalPackageId) {
            logger$8.debug(`Applying profile mapping: ${finalPackageId} -> ${mappedId}`);
            finalPackageId = mappedId;
          }
        }
        const packageData = campaignStore$1.getPackage(finalPackageId);
        if (!packageData) {
          throw new Error(`Package ${finalPackageId} not found in campaign data`);
        }
        set((state) => {
          const newItem = {
            id: Date.now(),
            packageId: finalPackageId,
            originalPackageId: item.originalPackageId || (finalPackageId !== (item.packageId ?? 0) ? item.packageId : void 0),
            quantity: item.quantity ?? 1,
            price: parseFloat(packageData.price_total),
            // Use total package price, not per-unit
            title: item.title ?? packageData.name,
            is_upsell: item.isUpsell ?? false,
            image: item.image ?? packageData.image ?? void 0,
            sku: item.sku ?? packageData.product_sku ?? void 0,
            // Add campaign response data for display
            price_per_unit: packageData.price,
            qty: packageData.qty,
            price_total: packageData.price_total,
            price_retail: packageData.price_retail,
            price_retail_total: packageData.price_retail_total,
            price_recurring: packageData.price_recurring,
            is_recurring: packageData.is_recurring,
            interval: packageData.interval,
            interval_count: packageData.interval_count,
            // Product and variant information
            productId: packageData.product_id,
            productName: packageData.product_name,
            variantId: packageData.product_variant_id,
            variantName: packageData.product_variant_name,
            variantAttributes: packageData.product_variant_attribute_values,
            variantSku: packageData.product_sku || void 0 || void 0
          };
          if (item.isUpsell) {
            logger$8.debug(`Adding upsell item:`, {
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
          return { ...state, items: newItems };
        });
        get().calculateTotals();
        const eventBus = EventBus.getInstance();
        eventBus.emit("cart:item-added", {
          packageId: item.packageId ?? 0,
          quantity: item.quantity ?? 1
        });
        eventBus.emit("cart:updated", get());
      },
      removeItem: async (packageId) => {
        const removedItem = get().items.find((item) => item.packageId === packageId);
        set((state) => {
          const newItems = state.items.filter((item) => item.packageId !== packageId);
          return { ...state, items: newItems };
        });
        get().calculateTotals();
        if (removedItem) {
          const eventBus = EventBus.getInstance();
          eventBus.emit("cart:item-removed", {
            packageId
          });
          eventBus.emit("cart:updated", get());
        }
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
          return { ...state, items: newItems };
        });
        get().calculateTotals();
        if (currentItem) {
          const eventBus = EventBus.getInstance();
          eventBus.emit("cart:quantity-changed", {
            packageId,
            quantity,
            oldQuantity
          });
          eventBus.emit("cart:updated", get());
        }
      },
      swapPackage: async (removePackageId, addItem) => {
        const { useCampaignStore: useCampaignStore2 } = await Promise.resolve().then(() => campaignStore);
        const { useProfileStore: useProfileStore2 } = await Promise.resolve().then(() => profileStore);
        const campaignStore$1 = useCampaignStore2.getState();
        const profileStore$1 = useProfileStore2.getState();
        let mappedRemovePackageId = removePackageId;
        if (profileStore$1.activeProfileId) {
          const mappedRemoveId = profileStore$1.getMappedPackageId(removePackageId);
          if (mappedRemoveId !== removePackageId) {
            logger$8.debug(`Applying profile mapping to remove package: ${removePackageId} -> ${mappedRemoveId}`);
            mappedRemovePackageId = mappedRemoveId;
          }
        }
        let finalPackageId = addItem.packageId ?? 0;
        if (profileStore$1.activeProfileId) {
          const mappedId = profileStore$1.getMappedPackageId(finalPackageId);
          if (mappedId !== finalPackageId) {
            logger$8.debug(`Applying profile mapping in swapPackage: ${finalPackageId} -> ${mappedId}`);
            finalPackageId = mappedId;
          }
        }
        const newPackageData = campaignStore$1.getPackage(finalPackageId);
        if (!newPackageData) {
          throw new Error(`Package ${finalPackageId} not found in campaign data`);
        }
        const previousItem = get().items.find((item) => item.packageId === mappedRemovePackageId);
        const newItem = {
          id: Date.now(),
          packageId: finalPackageId,
          originalPackageId: finalPackageId !== (addItem.packageId ?? 0) ? addItem.packageId ?? 0 : void 0,
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
          // Product and variant information
          productId: newPackageData.product_id,
          productName: newPackageData.product_name,
          variantId: newPackageData.product_variant_id,
          variantName: newPackageData.product_variant_name,
          variantAttributes: newPackageData.product_variant_attribute_values,
          variantSku: newPackageData.product_sku || void 0
        };
        const priceDifference = newItem.price - (previousItem?.price ?? 0);
        set((state) => {
          const newItems = state.items.filter((item) => item.packageId !== mappedRemovePackageId);
          const existingIndex = newItems.findIndex(
            (existing) => existing.packageId === newItem.packageId
          );
          if (existingIndex >= 0) {
            newItems[existingIndex].quantity += newItem.quantity;
          } else {
            newItems.push(newItem);
          }
          return { ...state, items: newItems, swapInProgress: false };
        });
        get().calculateTotals();
        const eventBus = EventBus.getInstance();
        const swapEvent = {
          previousPackageId: mappedRemovePackageId,
          newPackageId: finalPackageId,
          newItem,
          priceDifference,
          source: "package-selector"
        };
        if (previousItem) {
          swapEvent.previousItem = previousItem;
        }
        eventBus.emit("cart:package-swapped", swapEvent);
        eventBus.emit("cart:updated", get());
      },
      clear: async () => {
        set((state) => ({
          ...state,
          items: []
        }));
        get().calculateTotals();
      },
      swapCart: async (items) => {
        const { useCampaignStore: useCampaignStore2 } = await Promise.resolve().then(() => campaignStore);
        const { useProfileStore: useProfileStore2 } = await Promise.resolve().then(() => profileStore);
        const campaignStore$1 = useCampaignStore2.getState();
        const profileStore$1 = useProfileStore2.getState();
        const eventBus = EventBus.getInstance();
        logger$8.debug("Swapping cart with new items:", items);
        set((state) => ({
          ...state,
          swapInProgress: true
        }));
        const newItems = [];
        for (const item of items) {
          let finalPackageId = item.packageId;
          let originalPackageId = item.originalPackageId;
          if (!originalPackageId && profileStore$1.activeProfileId) {
            const mappedId = profileStore$1.getMappedPackageId(finalPackageId);
            if (mappedId !== finalPackageId) {
              logger$8.debug(`Applying profile mapping: ${finalPackageId} -> ${mappedId}`);
              originalPackageId = finalPackageId;
              finalPackageId = mappedId;
            }
          }
          const packageData = campaignStore$1.getPackage(finalPackageId);
          if (!packageData) {
            logger$8.warn(`Package ${finalPackageId} not found in campaign data, skipping`);
            logger$8.debug("Available packages:", campaignStore$1.data?.packages?.map((p) => p.ref_id));
            continue;
          }
          logger$8.debug(`Package ${finalPackageId} found:`, packageData);
          const newItem = {
            id: Date.now() + Math.random(),
            // Ensure unique IDs
            packageId: finalPackageId,
            originalPackageId,
            title: packageData.name || `Package ${finalPackageId}`,
            // Use 'title' instead of 'name'
            price: parseFloat(packageData.price_total),
            // Use total package price, not per-unit
            price_retail: packageData.price_retail,
            quantity: item.quantity,
            is_upsell: item.isUpsell || false,
            // Preserve isUpsell flag if provided
            image: packageData.image,
            sku: packageData.product_sku || void 0,
            qty: packageData.qty,
            price_total: packageData.price_total,
            price_retail_total: packageData.price_retail_total,
            price_per_unit: packageData.price,
            price_recurring: packageData.price_recurring,
            is_recurring: packageData.is_recurring,
            interval: packageData.interval,
            interval_count: packageData.interval_count,
            // Product and variant information
            productId: packageData.product_id,
            productName: packageData.product_name,
            variantId: packageData.product_variant_id,
            variantName: packageData.product_variant_name,
            variantAttributes: packageData.product_variant_attribute_values,
            variantSku: packageData.product_sku || void 0 || void 0
          };
          newItems.push(newItem);
        }
        set((state) => ({
          ...state,
          items: newItems,
          swapInProgress: false
        }));
        get().calculateTotals();
        eventBus.emit("cart:updated", get());
        logger$8.info(`Cart swapped successfully with ${newItems.length} items`);
      },
      syncWithAPI: async () => {
        logger$8.debug("syncWithAPI not yet implemented");
      },
      calculateTotals: async () => {
        try {
          const { useCampaignStore: useCampaignStore2 } = await Promise.resolve().then(() => campaignStore);
          const campaignState = useCampaignStore2.getState();
          const state = get();
          const subtotal = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const totalQuantity = state.items.reduce((sum, item) => sum + item.quantity, 0);
          const isEmpty = state.items.length === 0;
          const compareTotal = state.items.reduce((sum, item) => {
            const packageData = campaignState.getPackage(item.packageId);
            let retailTotal = 0;
            if (packageData?.price_retail_total) {
              retailTotal = parseFloat(packageData.price_retail_total);
            } else if (packageData?.price_total) {
              retailTotal = parseFloat(packageData.price_total);
            }
            return sum + retailTotal * item.quantity;
          }, 0);
          const savings = Math.max(0, compareTotal - subtotal);
          const savingsPercentage = compareTotal > 0 ? savings / compareTotal * 100 : 0;
          const hasSavings = savings > 0;
          const shipping = get().calculateShipping();
          const tax = get().calculateTax();
          let totalDiscounts = 0;
          const appliedCoupons = state.appliedCoupons || [];
          const updatedCoupons = appliedCoupons.map((appliedCoupon) => {
            const discountAmount = get().calculateDiscountAmount(appliedCoupon.definition);
            totalDiscounts += discountAmount;
            return {
              ...appliedCoupon,
              discount: discountAmount
            };
          });
          if (updatedCoupons.length > 0) {
            set((currentState) => ({
              ...currentState,
              appliedCoupons: updatedCoupons
            }));
          }
          const total = subtotal + shipping + tax - totalDiscounts;
          const totalExclShipping = subtotal + tax - totalDiscounts;
          const totalSavings = savings + totalDiscounts;
          const totalSavingsPercentage = compareTotal > 0 ? totalSavings / compareTotal * 100 : 0;
          const hasTotalSavings = totalSavings > 0;
          const totals = {
            subtotal: { value: subtotal, formatted: formatCurrency(subtotal) },
            shipping: { value: shipping, formatted: shipping === 0 ? "FREE" : formatCurrency(shipping) },
            tax: { value: tax, formatted: formatCurrency(tax) },
            discounts: { value: totalDiscounts, formatted: formatCurrency(totalDiscounts) },
            total: { value: total, formatted: formatCurrency(total) },
            totalExclShipping: { value: totalExclShipping, formatted: formatCurrency(totalExclShipping) },
            count: totalQuantity,
            isEmpty,
            savings: { value: savings, formatted: formatCurrency(savings) },
            savingsPercentage: { value: savingsPercentage, formatted: formatPercentage(savingsPercentage) },
            compareTotal: { value: compareTotal, formatted: formatCurrency(compareTotal) },
            hasSavings,
            totalSavings: { value: totalSavings, formatted: formatCurrency(totalSavings) },
            totalSavingsPercentage: { value: totalSavingsPercentage, formatted: formatPercentage(totalSavingsPercentage) },
            hasTotalSavings
          };
          set({
            subtotal,
            shipping,
            tax,
            total,
            totalQuantity,
            isEmpty,
            totals
          });
          await get().calculateEnrichedItems();
        } catch (error) {
          console.error("Error calculating totals:", error);
          set({
            subtotal: 0,
            shipping: 0,
            tax: 0,
            total: 0,
            totalQuantity: 0,
            isEmpty: true,
            totals: {
              subtotal: { value: 0, formatted: "$0.00" },
              shipping: { value: 0, formatted: "FREE" },
              tax: { value: 0, formatted: "$0.00" },
              discounts: { value: 0, formatted: "$0.00" },
              total: { value: 0, formatted: "$0.00" },
              totalExclShipping: { value: 0, formatted: "$0.00" },
              count: 0,
              isEmpty: true,
              savings: { value: 0, formatted: "$0.00" },
              savingsPercentage: { value: 0, formatted: "0%" },
              compareTotal: { value: 0, formatted: "$0.00" },
              hasSavings: false,
              totalSavings: { value: 0, formatted: "$0.00" },
              totalSavingsPercentage: { value: 0, formatted: "0%" },
              hasTotalSavings: false
            }
          });
        }
      },
      hasItem: (packageId) => {
        const state = get();
        return state.items.some((item) => item.packageId === packageId);
      },
      getItem: (packageId) => {
        const state = get();
        return state.items.find((item) => item.packageId === packageId);
      },
      getItemQuantity: (packageId) => {
        const state = get();
        const item = state.items.find((item2) => item2.packageId === packageId);
        return item?.quantity ?? 0;
      },
      calculateShipping: () => {
        const state = get();
        if (state.isEmpty || state.items.length === 0) {
          return 0;
        }
        if (state.shippingMethod) {
          return state.shippingMethod.price;
        }
        return 0;
      },
      calculateTax: () => {
        return 0;
      },
      setShippingMethod: async (methodId) => {
        try {
          const { useCampaignStore: useCampaignStore2 } = await Promise.resolve().then(() => campaignStore);
          const { useCheckoutStore: useCheckoutStore2 } = await Promise.resolve().then(() => checkoutStore);
          const campaignStore$1 = useCampaignStore2.getState();
          const checkoutStore$1 = useCheckoutStore2.getState();
          const campaignData = campaignStore$1.data;
          if (!campaignData?.shipping_methods) {
            throw new Error("No shipping methods available");
          }
          const shippingMethod = campaignData.shipping_methods.find(
            (method) => method.ref_id === methodId
          );
          if (!shippingMethod) {
            throw new Error(`Shipping method ${methodId} not found`);
          }
          const price = parseFloat(shippingMethod.price || "0");
          set((state) => ({
            ...state,
            shippingMethod: {
              id: shippingMethod.ref_id,
              name: shippingMethod.code,
              price,
              code: shippingMethod.code
            }
          }));
          checkoutStore$1.setShippingMethod({
            id: shippingMethod.ref_id,
            name: shippingMethod.code,
            price,
            code: shippingMethod.code
          });
          get().calculateTotals();
          const eventBus = EventBus.getInstance();
          eventBus.emit("shipping:method-changed", {
            methodId,
            method: shippingMethod
          });
        } catch (error) {
          console.error("Failed to set shipping method:", error);
          throw error;
        }
      },
      getTotalWeight: () => {
        const state = get();
        return state.items.reduce((sum, item) => sum + item.quantity, 0);
      },
      getTotalItemCount: () => {
        const state = get();
        return state.items.reduce((sum, item) => sum + item.quantity, 0);
      },
      calculateEnrichedItems: async () => {
        try {
          const { useCampaignStore: useCampaignStore2 } = await Promise.resolve().then(() => campaignStore);
          const campaignState = useCampaignStore2.getState();
          const state = get();
          const enrichedItems = state.items.map((item) => {
            const packageData = campaignState.getPackage(item.packageId);
            const actualUnitPrice = parseFloat(packageData?.price || "0");
            const retailUnitPrice = parseFloat(packageData?.price_retail || packageData?.price || "0");
            const packagePrice = item.price;
            const lineTotal = packagePrice * item.quantity;
            let retailPackagePrice = 0;
            if (packageData?.price_retail_total) {
              retailPackagePrice = parseFloat(packageData.price_retail_total);
            } else if (packageData?.price_total) {
              retailPackagePrice = parseFloat(packageData.price_total);
            }
            const retailLineTotal = retailPackagePrice * item.quantity;
            const unitSavings = Math.max(0, retailUnitPrice - actualUnitPrice);
            const lineSavings = Math.max(0, retailLineTotal - lineTotal);
            const savingsPct = retailUnitPrice > actualUnitPrice ? Math.round(unitSavings / retailUnitPrice * 100) : 0;
            const hasRecurring = packageData?.is_recurring === true;
            const recurringPrice = hasRecurring ? parseFloat(packageData?.price_recurring || "0") : 0;
            const frequencyText = hasRecurring ? packageData?.interval_count && packageData.interval_count > 1 ? `Every ${packageData.interval_count} ${packageData.interval}s` : `Per ${packageData.interval}` : "One time";
            return {
              id: item.id,
              packageId: item.packageId,
              quantity: item.quantity,
              price: {
                excl_tax: { value: actualUnitPrice, formatted: formatCurrency(actualUnitPrice) },
                incl_tax: { value: actualUnitPrice, formatted: formatCurrency(actualUnitPrice) },
                original: { value: retailUnitPrice, formatted: formatCurrency(retailUnitPrice) },
                savings: { value: unitSavings, formatted: formatCurrency(unitSavings) },
                recurring: { value: recurringPrice, formatted: formatCurrency(recurringPrice) },
                // Line totals
                lineTotal: { value: lineTotal, formatted: formatCurrency(lineTotal) },
                lineCompare: { value: retailLineTotal, formatted: formatCurrency(retailLineTotal) },
                lineSavings: { value: lineSavings, formatted: formatCurrency(lineSavings) },
                // Calculated fields
                savingsPct: { value: savingsPct, formatted: formatPercentage(savingsPct) }
              },
              product: {
                title: item.title || packageData?.name || "",
                sku: packageData?.external_id?.toString() || "",
                image: item.image || packageData?.image || ""
              },
              is_upsell: item.is_upsell ?? false,
              is_recurring: hasRecurring,
              interval: packageData?.interval || void 0,
              interval_count: packageData?.interval_count,
              frequency: frequencyText,
              is_bundle: false,
              bundleComponents: void 0,
              // Conditional flags for templates
              hasSavings: lineSavings > 0,
              hasComparePrice: retailUnitPrice > actualUnitPrice,
              showCompare: retailUnitPrice > actualUnitPrice ? "show" : "hide",
              showSavings: lineSavings > 0 ? "show" : "hide",
              showRecurring: hasRecurring ? "show" : "hide"
            };
          });
          set({ enrichedItems });
        } catch (error) {
          console.error("Error calculating enriched items:", error);
        }
      },
      // Coupon methods
      applyCoupon: async (code) => {
        const { useConfigStore } = await Promise.resolve().then(() => configStore$1);
        const configState = useConfigStore.getState();
        const state = get();
        const normalizedCode = code.toUpperCase().trim();
        if ((state.appliedCoupons || []).some((c) => c.code === normalizedCode)) {
          return { success: false, message: "Coupon already applied" };
        }
        const discount = configState.discounts[normalizedCode];
        if (!discount) {
          return { success: false, message: "Invalid coupon code" };
        }
        const validation = get().validateCoupon(normalizedCode);
        if (!validation.valid) {
          return { success: false, message: validation.message || "Coupon cannot be applied" };
        }
        set((state2) => ({
          ...state2,
          appliedCoupons: [...state2.appliedCoupons, {
            code: normalizedCode,
            discount: 0,
            // Will be calculated dynamically in calculateTotals
            definition: discount
          }]
        }));
        get().calculateTotals();
        return { success: true, message: `Coupon ${normalizedCode} applied successfully` };
      },
      removeCoupon: (code) => {
        set((state) => ({
          ...state,
          appliedCoupons: (state.appliedCoupons || []).filter((c) => c.code !== code)
        }));
        get().calculateTotals();
      },
      getCoupons: () => {
        return get().appliedCoupons || [];
      },
      validateCoupon: (code) => {
        const state = get();
        const windowConfig = window.nextConfig;
        if (!windowConfig?.discounts) {
          return { valid: false, message: "No discounts configured" };
        }
        const discount = windowConfig.discounts[code];
        if (!discount) {
          return { valid: false, message: "Invalid coupon code" };
        }
        if (discount.minOrderValue && state.subtotal < discount.minOrderValue) {
          return { valid: false, message: `Minimum order value of $${discount.minOrderValue} required` };
        }
        if (!discount.combinable && (state.appliedCoupons || []).length > 0) {
          return { valid: false, message: "Cannot combine with other coupons" };
        }
        return { valid: true };
      },
      calculateDiscountAmount: (coupon) => {
        const state = get();
        let discountAmount = 0;
        if (coupon.scope === "order") {
          if (coupon.type === "percentage") {
            discountAmount = state.subtotal * (coupon.value / 100);
            if (coupon.maxDiscount) {
              discountAmount = Math.min(discountAmount, coupon.maxDiscount);
            }
          } else {
            discountAmount = coupon.value;
          }
        } else if (coupon.scope === "package" && coupon.packageIds) {
          const eligibleTotal = state.items.filter((item) => coupon.packageIds?.includes(item.packageId)).reduce((sum, item) => sum + item.price * item.quantity, 0);
          if (coupon.type === "percentage") {
            discountAmount = eligibleTotal * (coupon.value / 100);
            if (coupon.maxDiscount) {
              discountAmount = Math.min(discountAmount, coupon.maxDiscount);
            }
          } else {
            discountAmount = Math.min(coupon.value, eligibleTotal);
          }
        }
        return Math.min(discountAmount, state.subtotal);
      },
      refreshItemPrices: async () => {
        try {
          logger$8.info("Refreshing cart item prices with new currency data...");
          const { useCampaignStore: useCampaignStore2 } = await Promise.resolve().then(() => campaignStore);
          const campaignStore$1 = useCampaignStore2.getState();
          if (!campaignStore$1.data) {
            logger$8.warn("No campaign data available to refresh prices");
            return;
          }
          const state = get();
          const updatedItems = state.items.map((item) => {
            const packageData = campaignStore$1.getPackage(item.packageId);
            if (!packageData) {
              logger$8.warn(`Package ${item.packageId} not found in campaign data`);
              return item;
            }
            return {
              ...item,
              price: parseFloat(packageData.price_total),
              // Update package total price
              price_per_unit: packageData.price,
              price_total: packageData.price_total,
              price_retail: packageData.price_retail,
              price_retail_total: packageData.price_retail_total,
              price_recurring: packageData.price_recurring,
              // Keep other fields unchanged (quantity, title, etc.)
              // Preserve existing variant data or update if changed
              productId: item.productId ?? packageData.product_id,
              productName: item.productName ?? packageData.product_name,
              variantId: item.variantId ?? packageData.product_variant_id,
              variantName: item.variantName ?? packageData.product_variant_name,
              variantAttributes: item.variantAttributes ?? packageData.product_variant_attribute_values,
              variantSku: item.variantSku ?? packageData.product_sku
            };
          });
          let updatedShippingMethod = state.shippingMethod;
          if (updatedShippingMethod && campaignStore$1.data.shipping_methods) {
            const shippingMethodData = campaignStore$1.data.shipping_methods.find(
              (method) => method.ref_id === updatedShippingMethod.id
            );
            if (shippingMethodData) {
              const newPrice = parseFloat(shippingMethodData.price || "0");
              updatedShippingMethod = {
                ...updatedShippingMethod,
                price: newPrice
              };
              logger$8.info(`Updated shipping method price: ${updatedShippingMethod.code} = ${newPrice} ${campaignStore$1.data.currency}`);
            }
          }
          set((state2) => {
            const updates = {
              ...state2,
              items: updatedItems
            };
            if (updatedShippingMethod !== void 0) {
              updates.shippingMethod = updatedShippingMethod;
            }
            return updates;
          });
          logger$8.info("Cart item prices and shipping refreshed with new currency");
          setTimeout(() => {
            get().calculateTotals();
          }, 0);
        } catch (error) {
          logger$8.error("Failed to refresh item prices:", error);
        }
      },
      reset: () => {
        set(initialState$2);
      },
      setLastCurrency: (currency) => {
        set({ lastCurrency: currency });
      }
    })),
    {
      name: CART_STORAGE_KEY,
      storage: {
        getItem: (name) => {
          const value = sessionStorageManager.get(name);
          return value;
        },
        setItem: (name, value) => {
          sessionStorageManager.set(name, value);
        },
        removeItem: (name) => {
          sessionStorageManager.remove(name);
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          logger$8.debug("Cart store rehydrated, recalculating totals...");
          state.calculateTotals();
        }
      },
      partialize: (state) => ({
        items: state.items,
        appliedCoupons: state.appliedCoupons,
        subtotal: state.subtotal,
        shipping: state.shipping,
        shippingMethod: state.shippingMethod,
        // Include shipping method to persist selection
        tax: state.tax,
        total: state.total,
        totalQuantity: state.totalQuantity,
        isEmpty: state.isEmpty,
        totals: state.totals,
        enrichedItems: []
        // Include but keep empty - will be recalculated
      })
    }
  )
);
const useCartStore = cartStoreInstance;
const cartStore = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  useCartStore
});
const initialState$1 = {
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
      ...initialState$1,
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
        set(initialState$1);
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
            if (typeof value === "boolean" || typeof value === "number") return true;
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
          paymentMethod
          // Only persist credit-card/klarna, not express methods
          // Explicitly exclude:
          // - errors (transient validation state)
          // - isProcessing (transient UI state)
          // - paymentToken (sensitive, should not persist)
          // - testMode (session-specific)
          // - vouchers (will be revalidated on page load)
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
  // Metadata
  metadata: {
    landing_page: "",
    referrer: "",
    device: "",
    device_type: "desktop",
    domain: "",
    timestamp: Date.now()
  },
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
          const { AttributionCollector } = await import("./utils-BYdmVAcS.js").then((n) => n.B);
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
          console.error("[AttributionStore] Error initializing attribution:", error);
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
          console.info(`[AttributionStore] Funnel already set to: ${currentState.funnel}, ignoring new value: ${funnel}`);
          return;
        }
        const persistedFunnel = localStorage.getItem("next_funnel_name") || sessionStorage.getItem("next_funnel_name");
        if (persistedFunnel) {
          console.info(`[AttributionStore] Funnel already persisted as: ${persistedFunnel}, ignoring new value: ${funnel}`);
          set({ funnel: persistedFunnel });
          return;
        }
        set({ funnel });
        try {
          sessionStorage.setItem("next_funnel_name", funnel);
          localStorage.setItem("next_funnel_name", funnel);
          console.info(`[AttributionStore] Funnel name set and persisted: ${funnel}`);
        } catch (error) {
          console.error("[AttributionStore] Error persisting funnel name:", error);
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
        if (state.affiliate && state.affiliate !== "") attribution.affiliate = state.affiliate;
        if (state.funnel && state.funnel !== "") attribution.funnel = state.funnel;
        if (state.gclid && state.gclid !== "") attribution.gclid = state.gclid;
        if (state.metadata !== void 0) attribution.metadata = state.metadata;
        if (state.utm_source && state.utm_source !== "") attribution.utm_source = state.utm_source;
        if (state.utm_medium && state.utm_medium !== "") attribution.utm_medium = state.utm_medium;
        if (state.utm_campaign && state.utm_campaign !== "") attribution.utm_campaign = state.utm_campaign;
        if (state.utm_content && state.utm_content !== "") attribution.utm_content = state.utm_content;
        if (state.utm_term && state.utm_term !== "") attribution.utm_term = state.utm_term;
        if (state.subaffiliate1 && state.subaffiliate1 !== "") attribution.subaffiliate1 = state.subaffiliate1;
        if (state.subaffiliate2 && state.subaffiliate2 !== "") attribution.subaffiliate2 = state.subaffiliate2;
        if (state.subaffiliate3 && state.subaffiliate3 !== "") attribution.subaffiliate3 = state.subaffiliate3;
        if (state.subaffiliate4 && state.subaffiliate4 !== "") attribution.subaffiliate4 = state.subaffiliate4;
        if (state.subaffiliate5 && state.subaffiliate5 !== "") attribution.subaffiliate5 = state.subaffiliate5;
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
        console.log("- Transaction ID:", state.metadata.everflow_transaction_id || "(not set)");
        console.log("- SG EVCLID:", state.metadata.sg_evclid || "(not set)");
        console.log("- localStorage evclid:", localStorage.getItem("evclid") || "(not set)");
        console.log("- sessionStorage evclid:", sessionStorage.getItem("evclid") || "(not set)");
        console.log("\n📘 Facebook:");
        console.log("- fbclid:", state.metadata.fbclid || "(not set)");
        console.log("- fb_fbp:", state.metadata.fb_fbp || "(not set)");
        console.log("- fb_fbc:", state.metadata.fb_fbc || "(not set)");
        console.log("- fb_pixel_id:", state.metadata.fb_pixel_id || "(not set)");
        console.log("\n🔗 Click Tracking:");
        console.log("- Click ID (metadata):", state.metadata.clickid || "(not set)");
        console.log("\n📋 Metadata:");
        console.log("- SDK Version:", state.metadata.sdk_version || "(not set)");
        console.log("- Landing Page:", state.metadata.landing_page);
        console.log("- Referrer:", state.metadata.referrer || "(direct)");
        console.log("- Domain:", state.metadata.domain);
        console.log("- Device Type:", state.metadata.device_type);
        console.log("- First Visit:", new Date(state.first_visit_timestamp).toLocaleString());
        console.log("- Current Visit:", new Date(state.current_visit_timestamp).toLocaleString());
        if (state.metadata.conversion_timestamp) {
          console.log("- Conversion Time:", new Date(state.metadata.conversion_timestamp).toLocaleString());
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
          console.error("[AttributionStore] Error clearing persisted funnel:", error);
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
const logger$7 = createLogger("PendingEventsHandler");
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
      logger$7.info(`Event queued for after redirect: ${event.event} (${pending.length} total queued)`);
    } catch (error) {
      logger$7.error("Failed to queue event:", error);
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
      logger$7.error("Failed to get pending events:", error);
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
      logger$7.debug("No pending analytics events to process");
      return;
    }
    logger$7.info(`Processing ${events.length} pending analytics events`);
    const filteredEvents = events.filter((e) => {
      if (e.event.event === "dl_user_data") {
        logger$7.warn("Skipping queued dl_user_data - current page should fire its own");
        return false;
      }
      return true;
    });
    const sortedEvents = [...filteredEvents].sort((a, b) => a.timestamp - b.timestamp);
    const processedIds = [];
    for (const pendingEvent of sortedEvents) {
      try {
        if (Date.now() - pendingEvent.timestamp > 5 * 60 * 1e3) {
          logger$7.warn("Skipping stale event:", pendingEvent.event.event);
          processedIds.push(pendingEvent.id);
          continue;
        }
        dataLayer.push(pendingEvent.event);
        processedIds.push(pendingEvent.id);
        logger$7.debug("Processed pending event:", pendingEvent.event.event);
      } catch (error) {
        logger$7.error("Failed to process pending event:", pendingEvent.event.event, error);
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
      logger$7.debug("Removed processed events:", processedIds.length);
    }
  }
  /**
   * Clear all pending events
   */
  clearPendingEvents() {
    try {
      sessionStorage.removeItem(STORAGE_KEY$1);
      logger$7.debug("Cleared all pending events");
    } catch (error) {
      logger$7.error("Failed to clear pending events:", error);
    }
  }
  /**
   * Reset the handler (called by NextAnalytics)
   */
  reset() {
    this.clearPendingEvents();
    logger$7.debug("PendingEventsHandler reset");
  }
  /**
   * Initialize the handler (called by NextAnalytics)
   */
  initialize() {
    logger$7.debug("PendingEventsHandler initialized");
  }
}
const pendingEventsHandler = PendingEventsHandler.getInstance();
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
        console.error("Failed to persist debug mode", e);
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
      version: "0.2.0"
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
    const prefix = "[NextDataLayer]";
    if (this.config.debug?.verbose && data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
  /**
   * Error logging
   */
  error(message, error, data) {
    if (!this.config.debug?.logErrors) return;
    const prefix = "[NextDataLayer ERROR]";
    console.error(`${prefix} ${message}`, { error, data });
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
class ProviderAdapter {
  constructor(name) {
    this.enabled = true;
    this.name = name;
  }
  /**
   * Enable or disable the adapter
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  /**
   * Check if the adapter is enabled
   */
  isEnabled() {
    return this.enabled;
  }
  /**
   * Track event - called by DataLayerManager
   */
  trackEvent(event) {
    this.sendEvent(event);
  }
  /**
   * Transform event data to provider-specific format
   */
  transformEvent(event) {
    return {
      event: event.event,
      ...event.data
    };
  }
  /**
   * Log debug information
   */
  debug(message, data) {
    if (typeof window !== "undefined" && window.localStorage?.getItem("analytics_debug") === "true") {
      console.log(`[${this.name}]`, message, data || "");
    }
  }
  /**
   * Check if we're in a browser environment
   */
  isBrowser() {
    return typeof window !== "undefined";
  }
  /**
   * Safe property access helper
   */
  getNestedProperty(obj, path) {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }
  /**
   * Format currency values
   */
  formatCurrency(value) {
    return value.toFixed(2);
  }
  /**
   * Extract common ecommerce properties
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
    super("GTM");
    this.blockedEvents = [];
    if (config?.blockedEvents) {
      this.blockedEvents = config.blockedEvents;
    }
  }
  /**
   * Track event - called by DataLayerManager
   */
  trackEvent(event) {
    this.sendEvent(event);
  }
  /**
   * Send event to Google Tag Manager
   */
  sendEvent(event) {
    if (!this.enabled || !this.isBrowser()) {
      return;
    }
    if (this.blockedEvents.includes(event.event)) {
      this.debug(`Event ${event.event} is blocked for GTM`);
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.ElevarDataLayer = window.ElevarDataLayer || [];
    if (event.event.startsWith("dl_")) {
      window.ElevarDataLayer.push(event);
      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push(event);
      this.debug("Elevar event sent to both ElevarDataLayer and dataLayer", event);
      return;
    }
    const gtmEvent = this.transformToGTMFormat(event);
    if (this.isEcommerceEvent(event.event)) {
      window.dataLayer.push({ ecommerce: null });
    }
    window.dataLayer.push(gtmEvent);
    this.debug("Event sent to GTM", gtmEvent);
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
   */
  buildEcommerceObject(event) {
    const ecommerceData = this.extractEcommerceData(event);
    const eventType = this.getEcommerceEventType(event.event);
    const ecommerceObject = {
      currency: ecommerceData.currency,
      value: parseFloat(this.formatCurrency(ecommerceData.value))
    };
    if (ecommerceData.items.length > 0) {
      ecommerceObject.items = this.formatItems(ecommerceData.items);
    }
    if (eventType === "purchase") {
      ecommerceObject.transaction_id = ecommerceData.transaction_id;
      ecommerceObject.affiliation = event.data?.affiliation || "Online Store";
      ecommerceObject.tax = ecommerceData.tax;
      ecommerceObject.shipping = ecommerceData.shipping;
      if (ecommerceData.coupon) {
        ecommerceObject.coupon = ecommerceData.coupon;
      }
    }
    if (eventType === "add_to_cart" && event.data?.cart_id) {
      ecommerceObject.cart_id = event.data.cart_id;
    }
    if (eventType === "view_item_list" && event.data?.item_list_name) {
      ecommerceObject.item_list_name = event.data.item_list_name;
      ecommerceObject.item_list_id = event.data.item_list_id;
    }
    if (eventType === "add_shipping_info" && (event.data?.shipping_tier || ecommerceData.shipping_tier)) {
      ecommerceObject.shipping_tier = event.data?.shipping_tier || ecommerceData.shipping_tier;
    }
    if (eventType === "add_payment_info" && (event.data?.payment_type || ecommerceData.payment_type)) {
      ecommerceObject.payment_type = event.data?.payment_type || ecommerceData.payment_type;
    }
    return ecommerceObject;
  }
  /**
   * Format items array for GTM
   */
  formatItems(items) {
    return items.map((item, index2) => ({
      item_id: item.item_id || item.id || item.product_id || item.sku,
      item_name: item.item_name || item.name || item.title,
      affiliation: item.affiliation || "Online Store",
      coupon: item.coupon || void 0,
      discount: item.discount || 0,
      index: item.index || index2,
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
      price: parseFloat(this.formatCurrency(item.price || 0)),
      quantity: item.quantity || 1
    }));
  }
  /**
   * Check if event is an ecommerce event
   */
  isEcommerceEvent(eventName) {
    const ecommerceEvents = [
      "dl_add_to_cart",
      "dl_remove_from_cart",
      "dl_view_cart",
      "dl_begin_checkout",
      "dl_add_payment_info",
      "dl_add_shipping_info",
      "dl_purchase",
      "dl_view_item",
      "dl_view_item_list",
      "dl_select_item",
      "dl_select_promotion",
      "dl_view_promotion",
      // Standard GA4 ecommerce events
      "add_to_cart",
      "remove_from_cart",
      "view_cart",
      "begin_checkout",
      "add_payment_info",
      "add_shipping_info",
      "purchase",
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
    super("Facebook");
    this.blockedEvents = [];
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
    if (config?.blockedEvents) {
      this.blockedEvents = config.blockedEvents;
    }
    if (config?.storeName) {
      this.storeName = config.storeName;
    }
  }
  /**
   * Track event - called by DataLayerManager
   */
  trackEvent(event) {
    this.sendEvent(event);
  }
  /**
   * Check if Facebook Pixel is loaded
   */
  isFbqLoaded() {
    return this.isBrowser() && typeof window.fbq === "function";
  }
  /**
   * Send event to Facebook Pixel
   */
  sendEvent(event) {
    if (!this.enabled) {
      this.debug("Facebook adapter disabled");
      return;
    }
    if (this.blockedEvents.includes(event.event)) {
      this.debug(`Event ${event.event} is blocked for Facebook`);
      return;
    }
    if (!this.isFbqLoaded()) {
      this.waitForFbq().then(() => {
        this.sendEventInternal(event);
      }).catch((error) => {
        this.debug("Facebook Pixel failed to load, skipping event:", event.event);
      });
      return;
    }
    this.sendEventInternal(event);
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
      return;
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
      this.debug("Error sending event to Facebook:", error);
    }
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
const logger$6 = createLogger("RudderStack");
class RudderStackAdapter extends ProviderAdapter {
  constructor() {
    super("RudderStack");
    this.pageViewSent = false;
  }
  /**
   * Track event - called by DataLayerManager
   */
  trackEvent(event) {
    this.sendEvent(event);
  }
  /**
   * Check if RudderStack is loaded
   */
  isRudderStackLoaded() {
    return this.isBrowser() && typeof window.rudderanalytics === "object" && typeof window.rudderanalytics.track === "function";
  }
  /**
   * Send event to RudderStack
   */
  sendEvent(event) {
    if (!this.enabled) {
      this.debug("RudderStack adapter disabled");
      return;
    }
    logger$6.info(`Processing event "${event.event}"`, {
      eventName: event.event,
      eventData: event
    });
    if (!this.isRudderStackLoaded()) {
      this.waitForRudderStack().then(() => {
        this.sendEventInternal(event);
      }).catch(() => {
        this.debug("RudderStack failed to load, skipping event:", event.event);
      });
      return;
    }
    this.sendEventInternal(event);
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
   * Internal method to send event after RudderStack is confirmed loaded
   */
  sendEventInternal(event) {
    try {
      switch (event.event) {
        case "dl_page_view":
        case "page_view":
          this.handlePageView(event);
          break;
        case "dl_user_data":
        case "user_data":
          this.handleUserData(event);
          break;
        default:
          const rudderEventName = this.mapEventName(event.event);
          if (rudderEventName) {
            const properties = this.buildEventProperties(event, rudderEventName);
            window.rudderanalytics.track(rudderEventName, properties);
            this.debug(`Event sent to RudderStack: ${rudderEventName}`, properties);
          }
      }
    } catch (error) {
      console.error("Error sending event to RudderStack:", error);
    }
  }
  /**
   * Handle page view events
   */
  handlePageView(event) {
    if (this.pageViewSent) {
      this.debug("Page view already sent, skipping duplicate");
      return;
    }
    const data = event.data || {};
    const pageType = data.page_type || "unknown";
    const pageName = data.page_name || "unknown";
    const campaignData = this.getCampaignData(data);
    const properties = {
      path: data.page_location || window.location.pathname,
      url: data.page_location || window.location.href,
      title: data.page_title || document.title,
      referrer: data.page_referrer || document.referrer,
      campaignName: campaignData.campaignName,
      campaignApiKey: campaignData.campaignApiKey,
      campaignCurrency: campaignData.campaignCurrency,
      campaignLanguage: campaignData.campaignLanguage
    };
    window.rudderanalytics.page(pageType, pageName, properties);
    const pageTypeCapitalized = pageType.charAt(0).toUpperCase() + pageType.slice(1);
    const eventName = `${pageTypeCapitalized} Page View`;
    window.rudderanalytics.track(eventName, {
      pageName,
      ...properties
    });
    this.pageViewSent = true;
    this.debug("Page View tracked", { pageType, pageName, eventName });
  }
  /**
   * Handle user data events for identification
   */
  handleUserData(event) {
    const userData = event.user_properties || event.data || {};
    if (userData.customer_email || userData.email || userData.user_id) {
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
      window.rudderanalytics.identify(userId, traits);
      this.debug("User Identified", { userId, traits });
    }
  }
  /**
   * Map data layer event names to RudderStack event names
   */
  mapEventName(eventName) {
    const eventMapping = {
      // Ecommerce events
      "dl_view_item": "Product Viewed",
      "dl_view_item_list": "Product List Viewed",
      "dl_add_to_cart": "Product Added",
      "dl_remove_from_cart": "Product Removed",
      "dl_view_cart": "Cart Viewed",
      "dl_cart_updated": "Cart Viewed",
      "dl_begin_checkout": "Checkout Started",
      "dl_add_shipping_info": "Shipping Info Added",
      "dl_add_payment_info": "Payment Info Added",
      "dl_purchase": "Order Completed",
      // Standard names
      "view_item": "Product Viewed",
      "view_item_list": "Product List Viewed",
      "add_to_cart": "Product Added",
      "remove_from_cart": "Product Removed",
      "view_cart": "Cart Viewed",
      "begin_checkout": "Checkout Started",
      "add_shipping_info": "Shipping Info Added",
      "add_payment_info": "Payment Info Added",
      "purchase": "Order Completed",
      // Upsell events
      "dl_viewed_upsell": "Upsell Viewed",
      "dl_accepted_upsell": "Upsell Accepted",
      "dl_skipped_upsell": "Upsell Skipped",
      // User events
      "dl_sign_up": "Signed Up",
      "dl_login": "Logged In",
      "sign_up": "Signed Up",
      "login": "Logged In"
    };
    return eventMapping[eventName] || null;
  }
  /**
   * Build event properties based on event type
   */
  buildEventProperties(event, rudderEventName) {
    const data = event.data || event.ecommerce || {};
    const pageMetadata = this.getPageMetadata();
    const campaignData = this.getCampaignData(data);
    const baseProps = {
      pageType: pageMetadata.pageType,
      pageName: pageMetadata.pageName,
      campaignName: campaignData.campaignName,
      campaignApiKey: campaignData.campaignApiKey
    };
    switch (rudderEventName) {
      case "Product Viewed":
        return this.buildProductViewedProps(data, baseProps);
      case "Product List Viewed":
        return this.buildProductListViewedProps(data, baseProps);
      case "Product Added":
      case "Product Removed":
        return this.buildProductAddedRemovedProps(data, baseProps);
      case "Cart Viewed":
        return this.buildCartViewedProps(data, baseProps);
      case "Checkout Started":
        return this.buildCheckoutStartedProps(data, baseProps);
      case "Shipping Info Added":
        return this.buildShippingInfoProps(data, baseProps);
      case "Payment Info Added":
        return this.buildPaymentInfoProps(data, baseProps);
      case "Order Completed":
        return this.buildOrderCompletedProps(data, baseProps);
      case "Upsell Viewed":
      case "Upsell Accepted":
      case "Upsell Skipped":
        return this.buildUpsellProps(event, rudderEventName, baseProps);
      default:
        return { ...data, ...baseProps };
    }
  }
  /**
   * Build Product Viewed properties
   */
  buildProductViewedProps(data, baseProps) {
    const items = data.items || [];
    const item = items[0] || {};
    return {
      product_id: item.item_id || "",
      sku: item.item_id || "",
      name: item.item_name || "",
      price: parseFloat(item.price) || 0,
      currency: data.currency || "USD",
      quantity: parseInt(item.quantity) || 1,
      position: item.position || 0,
      url: window.location.href,
      ...baseProps
    };
  }
  /**
   * Build Product List Viewed properties
   */
  buildProductListViewedProps(data, baseProps) {
    const products = this.formatProducts(data.items || []);
    return {
      list_id: data.list_id || "main-product-list",
      category: baseProps.pageType,
      products,
      currency: data.currency || "USD",
      ...baseProps
    };
  }
  /**
   * Build Product Added/Removed properties
   */
  buildProductAddedRemovedProps(data, baseProps) {
    const items = data.items || [];
    const item = items[0] || {};
    const campaignData = this.getCampaignData(data);
    return {
      cart_id: `cart-${Date.now()}`,
      product_id: item.item_id || "",
      sku: item.item_id || "",
      name: item.item_name || "",
      price: parseFloat(item.price) || 0,
      currency: data.currency || campaignData.campaignCurrency || "USD",
      quantity: parseInt(item.quantity) || 1,
      category: item.item_category || "",
      position: item.position || 0,
      url: window.location.href,
      ...baseProps
    };
  }
  /**
   * Build Cart Viewed properties
   */
  buildCartViewedProps(data, baseProps) {
    const products = this.formatProducts(data.items || []);
    const campaignData = this.getCampaignData(data);
    return {
      cart_id: `cart-${Date.now()}`,
      products,
      currency: data.currency || campaignData.campaignCurrency || "USD",
      value: parseFloat(data.value) || 0,
      ...baseProps
    };
  }
  /**
   * Build Shipping Info Added properties
   */
  buildShippingInfoProps(data, baseProps) {
    const products = this.formatProducts(data.items || []);
    const campaignData = this.getCampaignData(data);
    return {
      checkout_id: `checkout-${Date.now()}`,
      value: parseFloat(data.value) || 0,
      currency: data.currency || campaignData.campaignCurrency || "USD",
      shipping_tier: data.shipping_tier || "standard",
      products,
      ...baseProps
    };
  }
  /**
   * Build Payment Info Added properties
   */
  buildPaymentInfoProps(data, baseProps) {
    const products = this.formatProducts(data.items || []);
    const campaignData = this.getCampaignData(data);
    return {
      checkout_id: `checkout-${Date.now()}`,
      value: parseFloat(data.value) || 0,
      currency: data.currency || campaignData.campaignCurrency || "USD",
      payment_type: data.payment_type || "credit_card",
      products,
      ...baseProps
    };
  }
  /**
   * Build Checkout Started properties
   */
  buildCheckoutStartedProps(data, baseProps) {
    const products = this.formatProducts(data.items || []);
    const campaignData = this.getCampaignData(data);
    return {
      order_id: `pending-${Date.now()}`,
      value: parseFloat(data.value) || 0,
      revenue: parseFloat(data.value) || 0,
      currency: data.currency || campaignData.campaignCurrency || "USD",
      products,
      ...baseProps
    };
  }
  /**
   * Build Order Completed properties
   */
  buildOrderCompletedProps(data, baseProps) {
    const products = this.formatProducts(data.items || []);
    const campaignData = this.getCampaignData(data);
    const props = {
      checkout_id: `checkout-${Date.now()}`,
      order_id: data.transaction_id || "",
      affiliation: data.affiliation || campaignData.campaignName || "Funnels",
      total: parseFloat(data.value) || 0,
      revenue: parseFloat(data.value) || 0,
      shipping: parseFloat(data.shipping) || 0,
      tax: parseFloat(data.tax) || 0,
      discount: parseFloat(data.discount) || 0,
      coupon: data.coupon || "",
      currency: data.currency || campaignData.campaignCurrency || "USD",
      products,
      ...baseProps
    };
    if (data.email_hash || data.firstname) {
      const userId = data.email_hash || `user-${data.transaction_id}`;
      const traits = {
        firstName: data.firstname || "",
        lastName: data.lastname || "",
        city: data.city || "",
        state: data.state || "",
        postalCode: data.zipcode || "",
        country: data.country || ""
      };
      Object.keys(traits).forEach(
        (key) => traits[key] === "" && delete traits[key]
      );
      if (Object.keys(traits).length > 0) {
        window.rudderanalytics.identify(userId, traits);
        this.debug("User Identified on Purchase", { userId });
      }
    }
    return props;
  }
  /**
   * Build Upsell properties
   */
  buildUpsellProps(event, eventName, baseProps) {
    const data = event.data || event;
    const campaignData = this.getCampaignData(data);
    if (eventName === "Upsell Accepted") {
      const productProps = {
        cart_id: `cart-upsell-${Date.now()}`,
        product_id: data.upsell_id || "",
        sku: data.upsell_id || "",
        name: data.upsell_name || "",
        price: parseFloat(data.upsell_price) || 0,
        currency: data.currency || campaignData.campaignCurrency || "USD",
        quantity: 1,
        url: window.location.href,
        isUpsell: true,
        upsellRef: data.upsell_id || "",
        originalOrderId: data.order_id || data.transaction_id || "",
        ...baseProps
      };
      window.rudderanalytics.track("Product Added", productProps);
    }
    return {
      order_id: data.order_id || data.transaction_id || "",
      product_id: data.upsell_id || "",
      product_name: data.upsell_name || "",
      price: parseFloat(data.upsell_price) || 0,
      quantity: 1,
      total: parseFloat(data.value || data.upsell_price) || 0,
      currency: data.currency || campaignData.campaignCurrency || "USD",
      ref_id: data.upsell_id || "",
      ...baseProps
    };
  }
  /**
   * Format products array to match old integration format
   */
  formatProducts(items) {
    if (!items || !Array.isArray(items)) return [];
    return items.map((item) => ({
      product_id: item.item_id || item.id || "",
      sku: item.item_id || item.id || "",
      name: item.item_name || item.name || "",
      price: parseFloat(item.price) || 0,
      quantity: parseInt(item.quantity) || 1,
      category: item.item_category || item.category || "",
      brand: item.item_brand || item.brand || "",
      variant: item.item_variant || "",
      position: item.position || 0,
      url: window.location.href,
      image_url: item.image_url || ""
    }));
  }
  /**
   * Get page metadata
   */
  getPageMetadata() {
    const pageType = document.querySelector('meta[name="next-page-type"]')?.getAttribute("content") || "unknown";
    const pageName = document.querySelector('meta[name="next-page-name"]')?.getAttribute("content") || "unknown";
    return { pageType, pageName };
  }
  /**
   * Get campaign data from event or SDK
   */
  getCampaignData(data) {
    if (data.campaignName) {
      return {
        campaignName: data.campaignName,
        campaignApiKey: data.campaignApiKey || "",
        campaignCurrency: data.campaignCurrency || "USD",
        campaignLanguage: data.campaignLanguage || ""
      };
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
    this.logger = createLogger("NextCampaignAdapter");
    this.scriptLoaded = false;
    this.scriptLoading = false;
    this.loadPromise = null;
    this.apiKey = "";
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
      const configStore$12 = configStore.getState();
      this.apiKey = configStore$12.apiKey || "";
      this.logger.info(`API key from config store: ${this.apiKey ? "found" : "not found"}`);
    }
    if (!this.apiKey) {
      this.logger.warn("No API key available for NextCampaign initialization");
      return;
    }
    this.logger.info(`NextCampaign API key found: ${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`);
    await this.loadScript();
  }
  /**
   * Track event - called by DataLayerManager
   */
  trackEvent(event) {
    this.sendEvent(event);
  }
  /**
   * Send event to NextCampaign
   */
  async sendEvent(event) {
    if (!this.enabled) {
      this.debug("NextCampaign adapter disabled");
      return;
    }
    if (!this.scriptLoaded) {
      await this.loadScript();
    }
    const mappedEvent = this.mapEvent(event);
    if (mappedEvent) {
      try {
        if (window.nextCampaign) {
          window.nextCampaign.event(mappedEvent.name, mappedEvent.data);
          this.debug(`Event sent to NextCampaign: ${mappedEvent.name}`, mappedEvent.data);
        }
      } catch (error) {
        this.logger.error("Error sending event to NextCampaign:", error);
      }
    }
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
      this.logger.info("NextCampaign SDK loaded and initialized successfully ✅");
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
      this.logger.error("Error sending initial page view to NextCampaign:", error);
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
  /**
   * Send event to custom endpoint
   */
  sendEvent(event) {
    if (!this.enabled || !this.config.endpoint) {
      this.debug("Custom adapter disabled or no endpoint configured");
      return;
    }
    this.eventQueue.push(event);
    this.debug(`Event queued. Queue size: ${this.eventQueue.length}`);
    if (this.eventQueue.length >= this.config.batchSize) {
      this.sendBatch();
    } else {
      this.scheduleBatch();
    }
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
      console.error("Error sending batch to custom endpoint:", error);
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
      console.error(`Failed to send event after ${this.config.maxRetries} attempts:`, event);
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
const logger$5 = createLogger("ListAttributionTracker");
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
    logger$5.debug("ListAttributionTracker initialized");
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
    logger$5.debug("Set current list:", { listId, listName });
  }
  /**
   * Get the current list context if still valid
   */
  getCurrentList() {
    if (!this.currentList) {
      return null;
    }
    if (Date.now() - this.currentList.timestamp > LIST_EXPIRY_MS) {
      logger$5.debug("List context expired");
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
    logger$5.debug("Cleared current list");
  }
  /**
   * Reset the tracker (called by NextAnalytics)
   */
  reset() {
    this.clearCurrentList();
    logger$5.debug("ListAttributionTracker reset");
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
        logger$5.debug("Detected list from URL:", { listId, listName, type: pattern.type });
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
          logger$5.debug("Loaded list context from storage:", context);
        } else {
          this.removeFromStorage();
        }
      }
    } catch (error) {
      logger$5.error("Error loading list context from storage:", error);
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
      logger$5.error("Error saving list context to storage:", error);
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
      logger$5.error("Error removing list context from storage:", error);
    }
  }
}
const listAttributionTracker = ListAttributionTracker.getInstance();
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
          userProperties.customer_id = String(checkoutState.formData.customerId);
          userProperties.visitor_type = "logged_in";
        }
        if (checkoutState.formData?.orderCount !== void 0) {
          userProperties.customer_order_count = String(checkoutState.formData.orderCount);
        }
        if (checkoutState.formData?.totalSpent !== void 0) {
          userProperties.customer_total_spent = String(checkoutState.formData.totalSpent);
        }
        if (checkoutState.formData?.tags) {
          userProperties.customer_tags = String(checkoutState.formData.tags);
        }
      }
    } catch (error) {
      console.warn("Could not access store state for user properties:", error);
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
      version: "0.2.0"
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
      const current = parseInt(sessionStorage.getItem("analytics_sequence") || "0", 10);
      const next = current + 1;
      sessionStorage.setItem("analytics_sequence", String(next));
      return next;
    }
    return 0;
  }
  /**
   * Get currency from campaign store
   */
  static getCurrency() {
    try {
      if (typeof window !== "undefined") {
        const campaignState = useCampaignStore.getState();
        return campaignState.data?.currency || "USD";
      }
    } catch (error) {
      console.warn("Could not access campaign store for currency:", error);
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
      console.warn("Could not access campaign store for item formatting:", error);
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
            console.warn(`Could not find package data for packageId: ${packageId}`, {
              packageId,
              availablePackages: campaign.packages.map((p) => ({ ref_id: p.ref_id, name: p.name }))
            });
          }
        }
      }
    } catch (error) {
      console.warn("Could not access campaign store for product data:", error);
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
    let quantity = 1;
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
            quantity = packageData.qty;
          }
        }
      }
    } catch (error) {
      console.warn("Could not access campaign store for quantity:", error);
    }
    if (quantity === 1 && (item.quantity || item.qty)) {
      quantity = item.quantity || item.qty || 1;
    }
    let price = 0;
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
            price = typeof packageData.price === "string" ? parseFloat(packageData.price) : packageData.price;
          }
        }
      }
    } catch (error) {
      console.warn("Could not access campaign store for price:", error);
    }
    if (price === 0) {
      if (item.price_incl_tax) {
        price = typeof item.price_incl_tax === "string" ? parseFloat(item.price_incl_tax) : item.price_incl_tax;
      } else if (item.price) {
        if (typeof item.price === "object" && "incl_tax" in item.price) {
          price = item.price.incl_tax.value;
        } else {
          price = typeof item.price === "string" ? parseFloat(item.price) : item.price;
        }
      }
    }
    const ecommerceItem = {
      item_id: itemId,
      item_name: itemName,
      item_category: campaignName,
      price: typeof price === "string" ? parseFloat(price) : price,
      quantity,
      currency
    };
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
        const campaignStore2 = window.campaignStore;
        if (campaignStore2) {
          const campaign = campaignStore2.getState().data;
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
      console.warn("Could not access campaign store:", error);
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
class EcommerceEvents {
  /**
   * Create view_item_list event (GA4 format)
   */
  static createViewItemListEvent(items, listId, listName) {
    const currency = EventBuilder.getCurrency();
    const formattedItems = items.map(
      (item, index2) => EventBuilder.formatEcommerceItem(item, index2, { id: listId, name: listName })
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
    const currency = EventBuilder.getCurrency();
    const items = cartState.items.map(
      (item, index2) => EventBuilder.formatEcommerceItem(item, index2)
    );
    const ecommerce = {
      currency,
      value: cartState.totals.total.value || 0,
      items
    };
    if (cartState.appliedCoupons?.[0]?.code) {
      ecommerce.coupon = cartState.appliedCoupons[0].code;
    }
    return EventBuilder.createEvent("dl_begin_checkout", {
      user_properties: EventBuilder.getUserProperties(),
      cart_total: String(cartState.totals.total.value || "0.00"),
      ecommerce
    });
  }
  /**
   * Create purchase event (GA4 format)
   */
  static createPurchaseEvent(orderData) {
    const cartState = useCartStore.getState();
    const currency = EventBuilder.getCurrency();
    const campaignStore2 = useCampaignStore.getState();
    const order = orderData.order || orderData;
    const orderId = order.number || order.ref_id || orderData.orderId || orderData.transactionId || `order_${Date.now()}`;
    const orderTotal = parseFloat(
      order.total_incl_tax || order.total || orderData.total || cartState.totals.total.value || 0
    );
    const orderTax = parseFloat(
      order.total_tax || orderData.tax || cartState.totals.tax.value || 0
    );
    const orderShipping = parseFloat(
      order.shipping_incl_tax || orderData.shipping || cartState.totals.shipping.value || 0
    );
    let items = [];
    if (order.lines && order.lines.length > 0) {
      items = order.lines.map((line, index2) => {
        const packageData = campaignStore2.data?.packages?.find(
          (p) => String(p.ref_id) === String(line.package)
        );
        const linePrice = parseFloat(line.price_incl_tax || line.price || 0);
        const lineQuantity = parseInt(line.quantity || 1);
        const perUnitPrice = lineQuantity > 0 ? linePrice / lineQuantity : linePrice;
        const item = {
          item_id: line.product_sku || packageData?.product_sku || line.sku || `SKU-${line.product_id || line.id}`,
          item_name: line.product_title || line.name || "Unknown Product",
          item_brand: packageData?.product_name || campaignStore2.data?.name || "",
          item_category: line.campaign_name || campaignStore2.data?.name || "Campaign",
          item_variant: line.package_profile || line.variant || "",
          price: perUnitPrice,
          quantity: lineQuantity,
          currency: order.currency || currency,
          index: index2
        };
        return item;
      });
    } else if (orderData.items || cartState.enrichedItems.length > 0) {
      items = (orderData.items || cartState.enrichedItems).map(
        (item, index2) => EventBuilder.formatEcommerceItem(item, index2)
      );
    }
    const ecommerce = {
      currency: order.currency || currency,
      transaction_id: orderId,
      value: orderTotal,
      tax: orderTax,
      shipping: orderShipping,
      affiliation: "Online Store",
      items
    };
    const coupon = order.vouchers?.[0]?.code || orderData.coupon || cartState.appliedCoupons?.[0]?.code;
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
        ...order.user?.first_name && { customer_first_name: order.user.first_name },
        ...order.user?.last_name && { customer_last_name: order.user.last_name },
        ...order.user?.phone_number && { customer_phone: order.user.phone_number },
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
    const currency = EventBuilder.getCurrency();
    const items = cartState.enrichedItems.map(
      (item, index2) => EventBuilder.formatEcommerceItem(item, index2)
    );
    const ecommerce = {
      currency,
      value: cartState.totals.total.value || 0,
      items
    };
    return EventBuilder.createEvent("dl_view_cart", {
      user_properties: EventBuilder.getUserProperties(),
      cart_total: String(cartState.totals.total.value || "0.00"),
      ecommerce
    });
  }
  /**
   * Create add_shipping_info event
   * Fires when user enters or confirms shipping details
   */
  static createAddShippingInfoEvent(shippingTier) {
    const cartState = useCartStore.getState();
    const currency = EventBuilder.getCurrency();
    const formattedItems = cartState.enrichedItems.map(
      (item, index2) => EventBuilder.formatEcommerceItem(item, index2)
    );
    const ecommerce = {
      currency,
      currencyCode: currency,
      // Add currencyCode for Elevar compatibility
      value: cartState.totals.total.value,
      items: formattedItems,
      ...shippingTier && { shipping_tier: shippingTier }
    };
    if (cartState.appliedCoupons?.[0]?.code) {
      ecommerce.coupon = cartState.appliedCoupons[0].code;
    }
    return EventBuilder.createEvent("dl_add_shipping_info", {
      ecommerce,
      event_category: "ecommerce",
      event_value: cartState.totals.total.value,
      shipping_tier: shippingTier
    });
  }
  /**
   * Create add_payment_info event
   * Fires when user enters or confirms payment method
   */
  static createAddPaymentInfoEvent(paymentType) {
    const cartState = useCartStore.getState();
    const currency = EventBuilder.getCurrency();
    const formattedItems = cartState.enrichedItems.map(
      (item, index2) => EventBuilder.formatEcommerceItem(item, index2)
    );
    const ecommerce = {
      currency,
      value: cartState.totals.total.value,
      items: formattedItems,
      ...paymentType && { payment_type: paymentType }
    };
    if (cartState.appliedCoupons?.[0]?.code) {
      ecommerce.coupon = cartState.appliedCoupons[0].code;
    }
    return EventBuilder.createEvent("dl_add_payment_info", {
      ecommerce,
      event_category: "ecommerce",
      event_value: cartState.totals.total.value,
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
      currency = "USD",
      upsellNumber = 1,
      item
    } = data;
    const upsellOrderId = `${orderId}-US${upsellNumber}`;
    let campaignStore2;
    let packageData;
    try {
      if (typeof window !== "undefined") {
        campaignStore2 = window.campaignStore;
        if (campaignStore2) {
          const campaign = campaignStore2.getState().data;
          if (campaign?.packages) {
            packageData = campaign.packages.find(
              (p) => String(p.ref_id) === String(packageId)
            );
          }
        }
      }
    } catch (error) {
      console.warn("Could not access campaign store for upsell data:", error);
    }
    const upsellItem = item ? EventBuilder.formatEcommerceItem(item) : {
      item_id: packageData?.product_sku || `SKU-${packageId}`,
      item_name: packageName || packageData?.product_name || `Package ${packageId}`,
      item_brand: packageData?.product_name || campaignStore2?.getState().data?.name || "",
      item_category: campaignStore2?.getState().data?.name || "Campaign",
      item_variant: packageData?.product_variant_name || "",
      price: value,
      quantity,
      currency
    };
    const additionalRevenue = value * quantity;
    const ecommerce = {
      currency,
      transaction_id: upsellOrderId,
      value: additionalRevenue,
      tax: 0,
      shipping: 0,
      affiliation: "Upsell",
      items: [upsellItem]
    };
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
const logger$4 = createLogger("ViewItemListTracker");
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
    logger$4.info("ViewItemListTracker initialized");
  }
  /**
   * Scan the page for products and fire appropriate events
   */
  scan() {
    const now = Date.now();
    if (now - this.lastScanTime < this.scanDebounceMs) {
      logger$4.debug("Scan debounced (too soon after last scan)");
      return;
    }
    this.lastScanTime = now;
    const products = this.findProductElements();
    if (products.length === 0) {
      logger$4.debug("No products found on page");
      return;
    }
    logger$4.debug(`Found ${products.length} products on page`);
    if (products.length === 1) {
      const product = products[0];
      if (product) {
        this.trackViewItem(product);
      }
    } else {
      this.trackViewItemList(products);
      this.trackSelectedItemInSelectors();
    }
  }
  /**
   * Rescan the page (public method for manual triggering)
   */
  rescan() {
    logger$4.debug("Manual rescan triggered");
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
      logger$4.debug(`Found ${products.length} products in selectors`);
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
    const campaignStore2 = useCampaignStore.getState();
    if (!campaignStore2.data || !campaignStore2.packages || campaignStore2.packages.length === 0) {
      logger$4.debug("Campaign data not yet loaded, deferring tracking");
      return;
    }
    const packageIdNum = parseInt(product.packageId, 10);
    const packageData = !isNaN(packageIdNum) ? campaignStore2.getPackage(packageIdNum) : null;
    if (!packageData) {
      logger$4.warn("Package not found in store:", product.packageId);
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
    logger$4.debug("Tracked view_item for selected package:", product.packageId);
  }
  /**
   * Track a single product view
   */
  trackViewItem(product) {
    if (this.trackedProducts.has(product.packageId)) {
      logger$4.debug("Product already tracked:", product.packageId);
      return;
    }
    const campaignStore2 = useCampaignStore.getState();
    if (!campaignStore2.data || !campaignStore2.packages || campaignStore2.packages.length === 0) {
      logger$4.debug("Campaign data not yet loaded, deferring tracking");
      setTimeout(() => this.scan(), 1e3);
      return;
    }
    const packageIdNum = parseInt(product.packageId, 10);
    const packageData = !isNaN(packageIdNum) ? campaignStore2.getPackage(packageIdNum) : null;
    if (!packageData) {
      logger$4.warn("Package not found in store:", product.packageId);
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
    logger$4.debug("Tracked view_item:", product.packageId);
  }
  /**
   * Track multiple products view
   */
  trackViewItemList(products) {
    const campaignStore2 = useCampaignStore.getState();
    const items = [];
    if (!campaignStore2.data || !campaignStore2.packages || campaignStore2.packages.length === 0) {
      logger$4.debug("Campaign data not yet loaded, deferring tracking");
      setTimeout(() => this.scan(), 1e3);
      return;
    }
    const listContext = listAttributionTracker.getCurrentList() || listAttributionTracker.detectListFromUrl() || { listId: "product_list", listName: "Product List" };
    products.forEach((product, index2) => {
      if (this.trackedProducts.has(product.packageId)) {
        return;
      }
      const packageIdNum = parseInt(product.packageId, 10);
      const packageData = !isNaN(packageIdNum) ? campaignStore2.getPackage(packageIdNum) : null;
      if (!packageData) {
        logger$4.warn("Package not found in store:", product.packageId);
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
      logger$4.debug("No new products to track");
      return;
    }
    const event = EcommerceEvents.createViewItemListEvent(items, listContext.listId, listContext.listName);
    dataLayer.push(event);
    logger$4.debug(`Tracked view_item_list with ${items.length} items`);
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
        logger$4.debug("Detected DOM changes with products");
        this.scan();
      }
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-next-package-id", "data-next-selected"]
    });
    logger$4.debug("Mutation observer set up");
  }
  /**
   * Reset the tracker (for route changes)
   */
  reset() {
    this.trackedProducts.clear();
    logger$4.debug("ViewItemListTracker reset");
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
    logger$4.debug("ViewItemListTracker destroyed");
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
const logger$3 = createLogger("UserDataStorage");
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
          logger$3.debug("Loaded user data from cookie:", {
            hasEmail: !!this.userData.email,
            hasUserId: !!this.userData.userId
          });
        } catch (error) {
          logger$3.warn("Failed to parse user data cookie:", error);
        }
      }
      const sessionData = sessionStorage.getItem("user_data");
      if (sessionData) {
        try {
          const parsedSession = JSON.parse(sessionData);
          this.userData = { ...this.userData, ...parsedSession };
          logger$3.debug("Merged user data from sessionStorage");
        } catch (error) {
          logger$3.warn("Failed to parse sessionStorage user data:", error);
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
      logger$3.error("Failed to load user data:", error);
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
      logger$3.debug("Saved user data to storage:", {
        hasEmail: !!this.userData.email,
        hasUserId: !!this.userData.userId
      });
    } catch (error) {
      logger$3.error("Failed to save user data:", error);
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
      logger$3.info("User email updated:", data.email);
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
    logger$3.info("User data cleared");
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
      logger$3.debug("Updated user data from form fields:", updates);
    }
  }
}
const userDataStorage = UserDataStorage.getInstance();
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
          const currency = campaignState?.data?.currency || "USD";
          const cartItems = cartState?.items || [];
          const items = cartItems.length > 0 ? cartItems.map((item, idx) => EventBuilder.formatEcommerceItem(item, idx)) : [];
          const cartTotal = cartState?.totals?.total?.value || cartState?.total || 0;
          const ecommerce = {
            currency,
            value: cartTotal,
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
        console.warn("Could not add cart contents to user data event:", error);
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
const logger$2 = createLogger("UserDataTracker");
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
      logger$2.debug("User data tracking listeners set up after initial tracking");
    }, 200);
    logger$2.info("UserDataTracker initialized - dl_user_data fired first");
  }
  /**
   * Track user data event
   */
  trackUserData() {
    const now = Date.now();
    if (this.hasTrackedInitial) {
      const stack = new Error().stack;
      logger$2.debug("trackUserData called after initial:", {
        timeSinceLastTrack: now - this.lastTrackTime,
        willDebounce: now - this.lastTrackTime < this.trackDebounceMs,
        stack: stack?.split("\n").slice(1, 4).join("\n")
      });
    }
    if (now - this.lastTrackTime < this.trackDebounceMs) {
      logger$2.debug("User data tracking debounced");
      return;
    }
    this.lastTrackTime = now;
    const userData = this.collectUserData();
    if (!userData || Object.keys(userData).length === 0) {
      logger$2.debug("No user data to track");
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
    logger$2.debug("Tracked user data:", {
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
        userData.cartValue = cartState.total || cartState.subtotal || 0;
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
      logger$2.debug("Cart store not available or error accessing:", error);
    }
    try {
      const checkoutData = this.getCheckoutData();
      if (checkoutData) {
        Object.assign(userData, checkoutData);
      }
    } catch (error) {
      logger$2.debug("Error getting checkout data:", error);
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
      logger$2.debug("Route changed, tracking user data");
      this.trackUserData();
    });
    this.eventBus.on("sdk:route-invalidated", () => {
      logger$2.debug("SDK route invalidated, tracking user data");
      this.trackUserData();
    });
    this.eventBus.on("user:logged-in", () => {
      logger$2.debug("User logged in, tracking user data");
      setTimeout(() => this.trackUserData(), 100);
    });
    this.eventBus.on("user:logged-out", () => {
      logger$2.debug("User logged out, tracking user data");
      setTimeout(() => this.trackUserData(), 100);
    });
    if (typeof window !== "undefined") {
      window.addEventListener("popstate", () => {
        logger$2.debug("Browser navigation, tracking user data");
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
            logger$2.debug("pushState changed path, tracking user data");
            setTimeout(() => UserDataTracker.getInstance().trackUserData(), 0);
          }
        }
      };
      history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        logger$2.debug("replaceState called, not tracking user data (query param update)");
      };
    }
    logger$2.debug("User data tracking listeners set up");
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
    logger$2.debug("UserDataTracker reset");
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
    logger$2.debug("UserDataTracker destroyed");
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
const logger$1 = createLogger("AutoEventListener");
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
    logger$1.info("AutoEventListener initialized");
  }
  /**
   * Check if event should be processed based on debounce
   */
  shouldProcessEvent(eventName) {
    const now = Date.now();
    const lastTime = this.lastEventTimes.get(eventName) || 0;
    const debounceTime = this.debounceConfig[eventName] || 0;
    if (now - lastTime < debounceTime) {
      logger$1.debug(`Event ${eventName} debounced`);
      return false;
    }
    this.lastEventTimes.set(eventName, now);
    return true;
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
      const campaignStore2 = useCampaignStore.getState();
      const packageData = campaignStore2.getPackage(packageId);
      if (!packageData) {
        logger$1.warn("Package not found for add to cart:", packageId);
        return;
      }
      const listContext = listAttributionTracker.getCurrentList();
      ({
        item_id: packageData.external_id.toString()
      });
      const cartStore2 = useCartStore.getState();
      const cartItem = cartStore2.getItem(packageId);
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
      logger$1.debug("Tracked add to cart:", packageId);
    };
    this.eventBus.on("cart:item-added", handleAddToCart);
    this.eventHandlers.set("cart:item-added", handleAddToCart);
    const handleRemoveFromCart = async (data) => {
      if (!this.shouldProcessEvent("cart:item-removed")) {
        return;
      }
      const packageId = data.packageId;
      const quantity = data.quantity || 1;
      const campaignStore2 = useCampaignStore.getState();
      const packageData = campaignStore2.getPackage(packageId);
      if (!packageData) {
        logger$1.warn("Package not found for remove from cart:", packageId);
        return;
      }
      ({
        item_id: packageData.external_id.toString()
      });
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
      logger$1.debug("Tracked remove from cart:", packageId);
    };
    this.eventBus.on("cart:item-removed", handleRemoveFromCart);
    this.eventHandlers.set("cart:item-removed", handleRemoveFromCart);
    const handlePackageSwapped = async (data) => {
      const { previousPackageId, newPackageId, priceDifference } = data;
      const campaignStore2 = useCampaignStore.getState();
      const previousPackageData = campaignStore2.getPackage(previousPackageId);
      const newPackageData = campaignStore2.getPackage(newPackageId);
      if (!previousPackageData || !newPackageData) {
        logger$1.warn("Package data not found for swap:", { previousPackageId, newPackageId });
        return;
      }
      const previousItemFormatted = {
        item_id: previousPackageData.external_id.toString(),
        item_name: previousPackageData.name || `Package ${previousPackageId}`,
        currency: campaignStore2.data?.currency || "USD",
        price: parseFloat(previousPackageData.price_total || "0"),
        quantity: 1,
        item_category: campaignStore2.data?.name || "Campaign",
        item_variant: previousPackageData.product_variant_name || previousPackageData.product?.variant?.name,
        item_brand: previousPackageData.product_name || previousPackageData.product?.name,
        item_sku: previousPackageData.product_sku || previousPackageData.product?.variant?.sku || void 0,
        ...previousPackageData.image && { item_image: previousPackageData.image }
      };
      const newItemFormatted = {
        item_id: newPackageData.external_id.toString(),
        item_name: newPackageData.name || `Package ${newPackageId}`,
        currency: campaignStore2.data?.currency || "USD",
        price: parseFloat(newPackageData.price_total || "0"),
        quantity: 1,
        item_category: campaignStore2.data?.name || "Campaign",
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
          currency: campaignStore2.data?.currency || "USD",
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
      logger$1.debug("Tracked package swap:", { previousPackageId, newPackageId, priceDifference });
    };
    this.eventBus.on("cart:package-swapped", handlePackageSwapped);
    this.eventHandlers.set("cart:package-swapped", handlePackageSwapped);
    const handleCartUpdated = async () => {
      if (!this.shouldProcessEvent("cart:updated")) {
        return;
      }
      dataLayer.push({
        event: "dl_cart_updated",
        cart: this.getCartData()
      });
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
            currency: useCampaignStore.getState().data?.currency || "USD"
          }
        });
        logger$1.info("Tracked upsell page view:", pagePath);
        return;
      }
      const packageId = data.packageId;
      const campaignStore2 = useCampaignStore.getState();
      const packageData = campaignStore2.getPackage(packageId);
      if (!packageData) {
        logger$1.warn("Package not found for upsell view:", packageId);
        return;
      }
      dataLayer.push({
        event: "dl_viewed_upsell",
        order_id: orderId,
        upsell: {
          package_id: packageId.toString(),
          package_name: packageData.name || `Package ${packageId}`,
          price: parseFloat(packageData.price || "0"),
          currency: campaignStore2.data?.currency || "USD"
        }
      });
      logger$1.info("Tracked upsell view:", packageId);
    };
    this.eventBus.on("upsell:viewed", handleUpsellViewed);
    this.eventHandlers.set("upsell:viewed", handleUpsellViewed);
    const handleUpsellAccepted = async (data) => {
      const packageId = data.packageId;
      const quantity = data.quantity || 1;
      const orderId = data.orderId || data.order?.ref_id;
      const campaignStore2 = useCampaignStore.getState();
      const packageData = campaignStore2.getPackage(packageId);
      let value = data.value;
      if (value === void 0 && packageData?.price) {
        value = parseFloat(packageData.price) * quantity;
      }
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
        currency: data.currency || campaignStore2.data?.currency || "USD",
        upsellNumber,
        item: cartItem
      });
      if (data.willRedirect) {
        logger$1.debug("Upsell event already marked for queueing due to redirect");
      }
      dataLayer.push(acceptedUpsellEvent);
      logger$1.info("Tracked upsell accepted:", {
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
      logger$1.info("Tracked upsell skipped:", data.packageId);
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
      const cartStore2 = useCartStore.getState();
      const campaignStore2 = useCampaignStore.getState();
      if (order.lines && Array.isArray(order.lines)) {
        order.lines.map((line, index2) => ({
          item_id: line.product_sku || line.id?.toString() || `line_${index2}`,
          item_name: line.product_title || line.product_description || `Item ${line.id}`,
          currency: order.currency || "USD",
          price: parseFloat(line.price_incl_tax || line.price || "0"),
          quantity: parseInt(line.quantity?.toString() || "1"),
          item_category: campaignStore2.data?.name || "uncategorized",
          item_variant: line.variant_title,
          discount: parseFloat(line.price_incl_tax_excl_discounts || "0") - parseFloat(line.price_incl_tax || "0"),
          index: index2
        }));
      } else {
        cartStore2.items.map((item, index2) => {
          const packageData = campaignStore2.getPackage(item.packageId);
          return {
            item_id: packageData?.external_id?.toString() || item.packageId.toString(),
            // Use external_id for analytics
            item_name: packageData?.name || `Package ${item.packageId}`,
            currency: campaignStore2.data?.currency || "USD",
            price: parseFloat(packageData?.price_total || "0"),
            // Use total package price
            quantity: item.quantity,
            // This is the number of packages in cart
            item_category: campaignStore2.data?.name || "uncategorized",
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
        items: cartStore2.items,
        // Pass raw cart items with all product data
        currency: order.currency || "USD"
      });
      event._willRedirect = true;
      logger$1.debug("Marked purchase event for queueing with _willRedirect = true");
      dataLayer.push(event);
      logger$1.info("Tracked purchase:", orderId);
    };
    this.eventBus.on("order:completed", handleOrderCompleted);
    this.eventHandlers.set("order:completed", handleOrderCompleted);
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
      logger$1.debug("Tracked exit intent shown:", data);
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
      logger$1.debug("Tracked exit intent accepted:", data);
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
      logger$1.debug("Tracked exit intent dismissed:", data);
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
      logger$1.debug("Tracked exit intent closed:", data);
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
      logger$1.debug("Tracked exit intent action:", data);
    };
    this.eventBus.on("exit-intent:action", handleExitIntentAction);
    this.eventHandlers.set("exit-intent:action", handleExitIntentAction);
  }
  /**
   * Get current cart data
   */
  getCartData() {
    try {
      const cartStore2 = useCartStore.getState();
      const campaignStore2 = useCampaignStore.getState();
      return {
        total_value: cartStore2.total || cartStore2.subtotal || 0,
        total_items: cartStore2.totalQuantity || 0,
        currency: campaignStore2.data?.currency || "USD",
        items: cartStore2.items.map((item) => ({
          package_id: item.packageId,
          quantity: item.quantity,
          price: campaignStore2.getPackage(item.packageId)?.price || 0
        }))
      };
    } catch (error) {
      logger$1.error("Error getting cart data:", error);
      return null;
    }
  }
  /**
   * Reset the auto event listener (called by NextAnalytics)
   */
  reset() {
    this.lastEventTimes.clear();
    logger$1.debug("AutoEventListener reset");
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
    logger$1.debug("AutoEventListener destroyed");
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
    logger$1.debug("Updated debounce config:", this.debounceConfig);
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
    if (!schema) {
      result.warnings.push(`No schema defined for event: ${eventData.event}`);
      return result;
    }
    const schemaValidation = validateEventSchema(eventData, schema);
    result.valid = schemaValidation.valid;
    result.errors.push(...schemaValidation.errors);
    this.performAdditionalValidation(eventData, result);
    if (this.debug && !result.valid) {
      console.error(`[EventValidator] Validation failed for ${eventData.event}:`, result.errors);
    }
    return result;
  }
  /**
   * Performs additional validation beyond schema validation
   */
  performAdditionalValidation(eventData, result) {
    if (eventData.ecommerce) {
      if (eventData.ecommerce.currency && !this.isValidCurrency(eventData.ecommerce.currency)) {
        result.warnings.push(`Invalid currency format: ${eventData.ecommerce.currency}`);
      }
      if (eventData.ecommerce.value !== void 0 && eventData.ecommerce.value < 0) {
        result.warnings.push("Ecommerce value should not be negative");
      }
      if (eventData.ecommerce.items && Array.isArray(eventData.ecommerce.items)) {
        eventData.ecommerce.items.forEach((item, index2) => {
          this.validateProduct(item, `ecommerce.items[${index2}]`, result);
        });
      }
      if (eventData.ecommerce.impressions && Array.isArray(eventData.ecommerce.impressions)) {
        eventData.ecommerce.impressions.forEach((impression, index2) => {
          this.validateProduct(impression, `ecommerce.impressions[${index2}]`, result);
        });
      }
    }
    if (eventData.user_properties) {
      this.validateUserProperties(eventData.user_properties, result);
    }
    switch (eventData.event) {
      case "dl_purchase":
        if (!eventData.ecommerce?.transaction_id) {
          result.errors.push("dl_purchase event must have ecommerce.transaction_id");
          result.valid = false;
        }
        break;
      case "dl_view_search_results":
        if (!eventData.search_term) {
          result.errors.push("dl_view_search_results event must have search_term");
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
   * Validates a product object
   */
  validateProduct(product, path, result) {
    if (!product || typeof product !== "object") {
      result.errors.push(`${path} must be an object`);
      result.valid = false;
      return;
    }
    if (!product.item_id) {
      result.errors.push(`${path}.item_id is required`);
      result.valid = false;
    }
    if (!product.item_name) {
      result.errors.push(`${path}.item_name is required`);
      result.valid = false;
    }
    const numericFields = ["price", "quantity", "discount", "index"];
    for (const field of numericFields) {
      if (product[field] !== void 0) {
        if (typeof product[field] !== "number") {
          result.errors.push(`${path}.${field} must be a number`);
          result.valid = false;
        } else if (field !== "discount" && product[field] < 0) {
          result.warnings.push(`${path}.${field} should not be negative`);
        }
      }
    }
    if (product.quantity !== void 0 && !Number.isInteger(product.quantity)) {
      result.warnings.push(`${path}.quantity should be an integer`);
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
      result.warnings.push("customer_address_country_code should be a 2-letter ISO code");
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
              this.generateSampleFromSchema(fieldDef.properties, target[fieldName]);
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
class NextAnalytics {
  constructor() {
    this.initialized = false;
    this.providers = /* @__PURE__ */ new Map();
    this.validator = new EventValidator();
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
      dataLayer.initialize();
      if (config.analytics.debug) {
        dataLayer.setDebugMode(true);
      }
      await this.initializeProviders(config.analytics, config.storeName);
      if (config.analytics.mode === "auto") {
        this.userTracker.initialize();
        await new Promise((resolve) => setTimeout(resolve, 100));
        this.listTracker.initialize();
        this.viewTracker.initialize();
        this.autoListener.initialize();
        logger.info("Auto-tracking initialized (user data fired first)");
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
   * Initialize analytics providers
   */
  async initializeProviders(config, storeName) {
    if (config.providers?.nextCampaign?.enabled) {
      const nextCampaignAdapter = new NextCampaignAdapter();
      await nextCampaignAdapter.initialize();
      this.providers.set("nextCampaign", nextCampaignAdapter);
      dataLayer.addProvider(nextCampaignAdapter);
      logger.info("NextCampaign adapter initialized");
    }
    if (config.providers?.gtm?.enabled) {
      const gtmAdapter = new GTMAdapter(config.providers.gtm);
      this.providers.set("gtm", gtmAdapter);
      dataLayer.addProvider(gtmAdapter);
      logger.info("GTM adapter initialized", {
        blockedEvents: config.providers.gtm.blockedEvents || []
      });
    }
    if (config.providers?.facebook?.enabled && config.providers.facebook.settings?.pixelId) {
      const fbConfig = {
        ...config.providers.facebook,
        storeName
        // Pass storeName from root config
      };
      const fbAdapter = new FacebookAdapter(fbConfig);
      this.providers.set("facebook", fbAdapter);
      dataLayer.addProvider(fbAdapter);
      logger.info("Facebook Pixel adapter initialized", {
        blockedEvents: config.providers.facebook.blockedEvents || [],
        storeName
      });
    }
    if (config.providers?.rudderstack?.enabled) {
      const rudderAdapter = new RudderStackAdapter();
      this.providers.set("rudderstack", rudderAdapter);
      dataLayer.addProvider(rudderAdapter);
      logger.info("RudderStack adapter initialized");
    }
    if (config.providers?.custom?.enabled && config.providers.custom.settings?.endpoint) {
      const customAdapter = new CustomAdapter(config.providers.custom.settings);
      this.providers.set("custom", customAdapter);
      dataLayer.addProvider(customAdapter);
      logger.info("Custom adapter initialized");
    }
  }
  /**
   * Initialize automatic tracking features
   * NOTE: This method is no longer used - tracking is initialized inline
   * in the initialize() method to ensure proper ordering
   */
  initializeAutoTracking() {
    logger.warn("initializeAutoTracking called but is deprecated");
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
  NextAnalytics,
  UserEvents,
  dataLayer,
  nextAnalytics
});
export {
  EcommerceEvents as E,
  useCartStore as a,
  useCheckoutStore as b,
  configStore as c,
  useProfileStore as d,
  useAttributionStore as e,
  userDataStorage as f,
  campaignStore as g,
  cartStore as h,
  index as i,
  nextAnalytics as n,
  profileStore as p,
  useCampaignStore as u
};
