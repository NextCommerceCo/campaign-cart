import { u as useCampaignStore, c as configStore, b as useProfileStore } from "./analytics-oP9thflZ.js";
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
  return params.get("debug") === "true" || params.get("debugger") === "true";
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
const _CurrencyFormatter = class _CurrencyFormatter {
  /**
   * Get the current currency from stores
   */
  static getCurrentCurrency() {
    const campaignStore = useCampaignStore.getState();
    if (campaignStore?.data?.currency) {
      return campaignStore.data.currency;
    }
    const configStore$1 = configStore.getState();
    return configStore$1?.selectedCurrency || configStore$1?.detectedCurrency || "USD";
  }
  /**
   * Get the user's locale (checking for override first)
   */
  static getUserLocale() {
    const selectedLocale = sessionStorage.getItem("next_selected_locale");
    if (selectedLocale) {
      return selectedLocale;
    }
    return navigator.language || "en-US";
  }
  /**
   * Clear all cached formatters (call when locale or currency changes)
   */
  static clearCache() {
    this.formatters.clear();
    this.formattersNoZeroCents.clear();
    this.numberFormatter = null;
  }
  /**
   * Get or create a currency formatter
   */
  static getCurrencyFormatter(currency, hideZeroCents = false) {
    const locale = this.getUserLocale();
    const key = `${locale}-${currency}-${hideZeroCents}`;
    const cache = hideZeroCents ? this.formattersNoZeroCents : this.formatters;
    if (!cache.has(key)) {
      const options = {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol"
        // Use narrowSymbol to avoid A$, CA$, etc.
      };
      if (hideZeroCents) {
        options.minimumFractionDigits = 0;
        options.maximumFractionDigits = 2;
      }
      cache.set(key, new Intl.NumberFormat(locale, options));
    }
    return cache.get(key);
  }
  /**
   * Get or create a number formatter
   */
  static getNumberFormatter() {
    const locale = this.getUserLocale();
    if (!this.numberFormatter) {
      this.numberFormatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    }
    return this.numberFormatter;
  }
  /**
   * Format a value as currency
   */
  static formatCurrency(value, currency, options) {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) {
      return "";
    }
    const currencyCode = currency || this.getCurrentCurrency();
    const formatter = this.getCurrencyFormatter(currencyCode, options?.hideZeroCents);
    return formatter.format(numValue);
  }
  /**
   * Format a number (non-currency)
   */
  static formatNumber(value) {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) {
      return "";
    }
    return this.getNumberFormatter().format(numValue);
  }
  /**
   * Format a percentage
   */
  static formatPercentage(value, decimals = 0) {
    return `${Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)}%`;
  }
  /**
   * Extract currency symbol from current currency
   */
  static getCurrencySymbol(currency) {
    const currencyCode = currency || this.getCurrentCurrency();
    const formatter = this.getCurrencyFormatter(currencyCode);
    const formatted = formatter.format(0);
    return formatted.replace(/[0-9.,\s]/g, "").trim();
  }
  /**
   * Check if a string is already formatted with the current currency
   */
  static isAlreadyFormatted(value, currency) {
    if (typeof value !== "string") return false;
    const symbol = this.getCurrencySymbol(currency);
    return value.includes(symbol);
  }
};
_CurrencyFormatter.formatters = /* @__PURE__ */ new Map();
_CurrencyFormatter.formattersNoZeroCents = /* @__PURE__ */ new Map();
_CurrencyFormatter.numberFormatter = null;
let CurrencyFormatter = _CurrencyFormatter;
const formatCurrency = CurrencyFormatter.formatCurrency.bind(CurrencyFormatter);
const formatNumber = CurrencyFormatter.formatNumber.bind(CurrencyFormatter);
const formatPercentage = CurrencyFormatter.formatPercentage.bind(CurrencyFormatter);
const getCurrencySymbol = CurrencyFormatter.getCurrencySymbol.bind(CurrencyFormatter);
const currencyFormatter = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  CurrencyFormatter,
  formatCurrency,
  formatNumber,
  formatPercentage,
  getCurrencySymbol
});
class CountryService {
  constructor() {
    this.cachePrefix = "next_country_";
    this.cacheExpiry = 36e5;
    this.baseUrl = "https://cdn-countries.muddy-wind-c7ca.workers.dev";
    this.config = {};
    this.logger = new Logger("CountryService");
  }
  static getInstance() {
    if (!CountryService.instance) {
      CountryService.instance = new CountryService();
    }
    return CountryService.instance;
  }
  /**
   * Set address configuration
   */
  setConfig(config) {
    this.config = { ...config };
    this.logger.debug("Address configuration updated:", this.config);
  }
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Get location data with user's detected country and list of all countries
   */
  async getLocationData() {
    const cached = this.getFromCache("location_data", true);
    if (cached) {
      return await this.applyCountryFiltering(cached);
    }
    try {
      const response = await fetch(`${this.baseUrl}/location`);
      if (!response.ok) {
        throw new Error(`Failed to fetch location data: ${response.statusText}`);
      }
      const data = await response.json();
      this.setCache("location_data", data, true);
      this.logger.debug("Location data fetched", {
        detectedCountry: data.detectedCountryCode,
        countriesCount: data.countries?.length
      });
      return await this.applyCountryFiltering(data);
    } catch (error) {
      this.logger.error("Failed to fetch location data:", error);
      return await this.applyCountryFiltering(this.getFallbackLocationData());
    }
  }
  /**
   * Get states for a specific country
   */
  async getCountryStates(countryCode) {
    const cacheKey = `states_${countryCode}`;
    const cached = this.getFromCache(cacheKey, true);
    if (cached) {
      return {
        ...cached,
        states: this.applyStateFiltering(cached.states || [])
      };
    }
    try {
      const response = await fetch(`${this.baseUrl}/countries/${countryCode}/states`);
      if (!response.ok) {
        throw new Error(`Failed to fetch states for ${countryCode}: ${response.statusText}`);
      }
      const data = await response.json();
      this.setCache(cacheKey, data, true);
      this.logger.debug(`States data fetched for ${countryCode}`, {
        statesCount: data.states?.length,
        stateLabel: data.countryConfig?.stateLabel
      });
      return {
        ...data,
        states: this.applyStateFiltering(data.states || [])
      };
    } catch (error) {
      this.logger.error(`Failed to fetch states for ${countryCode}:`, error);
      return {
        countryConfig: this.getDefaultCountryConfig(countryCode),
        states: []
      };
    }
  }
  /**
   * Get country configuration by country code
   */
  async getCountryConfig(countryCode) {
    const locationData = await this.getLocationData();
    if (locationData.detectedCountryCode === countryCode) {
      return locationData.detectedCountryConfig;
    }
    const statesData = await this.getCountryStates(countryCode);
    return statesData.countryConfig;
  }
  /**
   * Validate postal code based on country configuration
   */
  validatePostalCode(postalCode, _countryCode, countryConfig) {
    if (!postalCode) return false;
    if (postalCode.length < countryConfig.postcodeMinLength || postalCode.length > countryConfig.postcodeMaxLength) {
      return false;
    }
    if (countryConfig.postcodeRegex) {
      try {
        const regex = new RegExp(countryConfig.postcodeRegex);
        return regex.test(postalCode);
      } catch (error) {
        this.logger.error("Invalid postal code regex:", error);
        return true;
      }
    }
    return true;
  }
  /**
   * Clear all cached data
   */
  clearCache() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(this.cachePrefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => sessionStorage.removeItem(key));
      const localKeysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.cachePrefix)) {
          localKeysToRemove.push(key);
        }
      }
      localKeysToRemove.forEach((key) => localStorage.removeItem(key));
      this.logger.debug(`Country service cache cleared (${keysToRemove.length} session + ${localKeysToRemove.length} local entries)`);
    } catch (error) {
      this.logger.warn("Failed to clear cache:", error);
    }
  }
  /**
   * Clear cache for a specific country
   */
  clearCountryCache(countryCode) {
    try {
      const cacheKey = this.cachePrefix + `states_${countryCode}`;
      localStorage.removeItem(cacheKey);
      sessionStorage.removeItem(cacheKey);
      this.logger.debug(`Cache cleared for country: ${countryCode}`);
    } catch (error) {
      this.logger.warn(`Failed to clear cache for country ${countryCode}:`, error);
    }
  }
  getFromCache(key, useLocalStorage = false) {
    try {
      const cacheKey = this.cachePrefix + key;
      const storage = useLocalStorage ? localStorage : sessionStorage;
      const cached = storage.getItem(cacheKey);
      if (!cached) return null;
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      if (now - timestamp > this.cacheExpiry) {
        storage.removeItem(cacheKey);
        return null;
      }
      return data;
    } catch (error) {
      this.logger.warn("Failed to read from cache:", error);
      return null;
    }
  }
  setCache(key, data, useLocalStorage = false) {
    try {
      const cacheKey = this.cachePrefix + key;
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      const storage = useLocalStorage ? localStorage : sessionStorage;
      storage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      this.logger.warn("Failed to write to cache:", error);
    }
  }
  getDefaultCountryConfig(countryCode) {
    const configs = {
      US: {
        stateLabel: "State",
        stateRequired: true,
        postcodeLabel: "ZIP Code",
        postcodeRegex: "^\\d{5}(-\\d{4})?$",
        postcodeMinLength: 5,
        postcodeMaxLength: 10,
        postcodeExample: "12345 or 12345-6789",
        currencyCode: "USD",
        currencySymbol: "$"
      },
      CA: {
        stateLabel: "Province",
        stateRequired: true,
        postcodeLabel: "Postal Code",
        postcodeRegex: "^[A-Z]\\d[A-Z] ?\\d[A-Z]\\d$",
        postcodeMinLength: 6,
        postcodeMaxLength: 7,
        postcodeExample: "K1A 0B1",
        currencyCode: "CAD",
        currencySymbol: "$"
      },
      GB: {
        stateLabel: "County",
        stateRequired: false,
        postcodeLabel: "Postcode",
        postcodeRegex: "^[A-Z]{1,2}\\d{1,2}[A-Z]?\\s?\\d[A-Z]{2}$",
        postcodeMinLength: 5,
        postcodeMaxLength: 8,
        postcodeExample: "SW1A 1AA",
        currencyCode: "GBP",
        currencySymbol: "£"
      }
    };
    return configs[countryCode] || {
      stateLabel: "State/Province",
      stateRequired: false,
      postcodeLabel: "Postal Code",
      postcodeRegex: null,
      postcodeMinLength: 2,
      postcodeMaxLength: 20,
      postcodeExample: null,
      currencyCode: "USD",
      currencySymbol: "$"
    };
  }
  getFallbackLocationData() {
    return {
      detectedCountryCode: "US",
      detectedCountryConfig: this.getDefaultCountryConfig("US"),
      detectedStates: [],
      countries: [
        { code: "US", name: "United States", phonecode: "+1", currencyCode: "USD", currencySymbol: "$" },
        { code: "CA", name: "Canada", phonecode: "+1", currencyCode: "CAD", currencySymbol: "$" },
        { code: "GB", name: "United Kingdom", phonecode: "+44", currencyCode: "GBP", currencySymbol: "£" },
        { code: "AU", name: "Australia", phonecode: "+61", currencyCode: "AUD", currencySymbol: "$" },
        { code: "DE", name: "Germany", phonecode: "+49", currencyCode: "EUR", currencySymbol: "€" }
      ]
    };
  }
  async applyCountryFiltering(data) {
    let filteredCountries = [...data.countries];
    if (this.config.countries && this.config.countries.length > 0) {
      filteredCountries = this.config.countries.map((customCountry) => ({
        code: customCountry.code,
        name: customCountry.name,
        phonecode: "",
        currencyCode: "USD",
        currencySymbol: "$"
      }));
    } else if (this.config.showCountries && this.config.showCountries.length > 0) {
      filteredCountries = filteredCountries.filter(
        (country) => this.config.showCountries.includes(country.code)
      );
    }
    const originalDetectedCountryConfig = data.detectedCountryConfig;
    let detectedCountryCode = data.detectedCountryCode;
    let detectedCountryConfig = data.detectedCountryConfig;
    const detectedCountryAllowed = filteredCountries.some(
      (country) => country.code === detectedCountryCode
    );
    if ((!detectedCountryCode || !detectedCountryAllowed) && this.config.defaultCountry) {
      const defaultCountryExists = filteredCountries.some(
        (country) => country.code === this.config.defaultCountry
      );
      if (defaultCountryExists) {
        this.logger.info(`Using default country ${this.config.defaultCountry} for shipping (detected: ${detectedCountryCode}, allowed: ${detectedCountryAllowed})`);
        this.logger.info(`Preserving detected currency: ${originalDetectedCountryConfig.currencyCode} from detected location: ${data.detectedCountryCode}`);
        detectedCountryCode = this.config.defaultCountry;
        detectedCountryConfig = originalDetectedCountryConfig;
      }
    } else if (detectedCountryCode && detectedCountryAllowed) {
      this.logger.info(`Using detected country: ${detectedCountryCode}`);
    }
    return {
      ...data,
      countries: filteredCountries,
      detectedCountryCode,
      detectedCountryConfig
      // This will be the original detected config for currency
    };
  }
  applyStateFiltering(states) {
    const US_TERRITORIES_TO_HIDE = [
      "AS",
      "UM-81",
      "GU",
      "UM-84",
      "UM-86",
      "UM-67",
      "UM-89",
      "UM-71",
      "UM-76",
      "MP",
      "UM-95",
      "PR",
      "UM",
      "VI",
      "UM-79"
    ];
    let filteredStates = states.filter(
      (state) => !US_TERRITORIES_TO_HIDE.includes(state.code)
    );
    if (this.config.dontShowStates && this.config.dontShowStates.length > 0) {
      filteredStates = filteredStates.filter(
        (state) => !this.config.dontShowStates.includes(state.code)
      );
    }
    return filteredStates;
  }
}
class ProfileMapper {
  constructor() {
    this.logger = createLogger("ProfileMapper");
  }
  static getInstance() {
    if (!ProfileMapper.instance) {
      ProfileMapper.instance = new ProfileMapper();
    }
    return ProfileMapper.instance;
  }
  /**
   * Maps a package ID based on the active profile or a specific profile
   */
  mapPackageId(packageId, profileId) {
    if (!packageId || packageId <= 0) {
      return packageId;
    }
    const profileStore = useProfileStore.getState();
    const profile = profileId ? profileStore.getProfileById(profileId) : profileStore.getActiveProfile();
    if (!profile || !profile.packageMappings) {
      return packageId;
    }
    const mappedId = profile.packageMappings[packageId];
    if (mappedId !== void 0 && mappedId > 0) {
      this.logger.debug(`Mapped package ${packageId} -> ${mappedId} (profile: ${profile.id})`);
      return mappedId;
    }
    return packageId;
  }
  /**
   * Batch map multiple package IDs
   */
  mapPackageIds(packageIds, profileId) {
    if (!packageIds || packageIds.length === 0) {
      return [];
    }
    return packageIds.map((id) => this.mapPackageId(id, profileId));
  }
  /**
   * Reverse lookup - get original package ID from mapped ID
   */
  getOriginalPackageId(mappedId, profileId) {
    if (!mappedId || mappedId <= 0) {
      return null;
    }
    const profileStore = useProfileStore.getState();
    const profile = profileId ? profileStore.getProfileById(profileId) : profileStore.getActiveProfile();
    if (!profile) {
      return null;
    }
    if (profile.reverseMapping && profile.reverseMapping[mappedId] !== void 0) {
      const originalId = profile.reverseMapping[mappedId];
      this.logger.debug(`Reverse mapped ${mappedId} -> ${originalId} (profile: ${profile.id})`);
      return originalId;
    }
    for (const [original, mapped] of Object.entries(profile.packageMappings)) {
      if (mapped === mappedId) {
        const originalId = parseInt(original, 10);
        this.logger.debug(`Reverse mapped ${mappedId} -> ${originalId} (profile: ${profile.id}, linear search)`);
        return originalId;
      }
    }
    return null;
  }
  /**
   * Check if a package ID can be mapped in the current or specified profile
   */
  canMapPackage(packageId, profileId) {
    if (!packageId || packageId <= 0) {
      return false;
    }
    const profileStore = useProfileStore.getState();
    const profile = profileId ? profileStore.getProfileById(profileId) : profileStore.getActiveProfile();
    if (!profile || !profile.packageMappings) {
      return false;
    }
    return packageId in profile.packageMappings;
  }
  /**
   * Get all available mappings for a profile
   */
  getProfileMappings(profileId) {
    const profileStore = useProfileStore.getState();
    const profile = profileId ? profileStore.getProfileById(profileId) : profileStore.getActiveProfile();
    return profile?.packageMappings || null;
  }
  /**
   * Check if any profile is currently active
   */
  hasActiveProfile() {
    const profileStore = useProfileStore.getState();
    return profileStore.activeProfileId !== null;
  }
  /**
   * Get the currently active profile ID
   */
  getActiveProfileId() {
    const profileStore = useProfileStore.getState();
    return profileStore.activeProfileId;
  }
  /**
   * Map a cart item's package ID if a profile is active
   */
  mapCartItem(item, profileId) {
    const mappedPackageId = this.mapPackageId(item.packageId, profileId);
    if (mappedPackageId !== item.packageId) {
      return {
        ...item,
        packageId: mappedPackageId,
        originalPackageId: item.packageId
        // Preserve original for reference
      };
    }
    return item;
  }
  /**
   * Map multiple cart items
   */
  mapCartItems(items, profileId) {
    return items.map((item) => this.mapCartItem(item, profileId));
  }
  /**
   * Get mapping statistics for debugging
   */
  getMappingStats(profileId) {
    const profileStore = useProfileStore.getState();
    const profile = profileId ? profileStore.getProfileById(profileId) : profileStore.getActiveProfile();
    if (!profile) {
      return null;
    }
    return {
      profileId: profile.id,
      totalMappings: Object.keys(profile.packageMappings).length,
      activeMappings: Object.keys(profile.packageMappings).filter(
        (key) => profile.packageMappings[parseInt(key, 10)] !== void 0
      ).length,
      hasReverseMapping: !!profile.reverseMapping
    };
  }
}
const logger$2 = createLogger("AttributionCollector");
class AttributionCollector {
  /**
   * Collect attribution data from all available sources
   */
  async collect() {
    const metadata = this.collectMetadata();
    return {
      // Core attribution fields
      affiliate: this.getStoredValue("affid") || this.getStoredValue("aff") || "",
      funnel: this.getFunnelName(),
      gclid: this.getStoredValue("gclid") || "",
      // UTM parameters
      utm_source: this.getStoredValue("utm_source") || "",
      utm_medium: this.getStoredValue("utm_medium") || "",
      utm_campaign: this.getStoredValue("utm_campaign") || "",
      utm_content: this.getStoredValue("utm_content") || "",
      utm_term: this.getStoredValue("utm_term") || "",
      // Subaffiliates - limited to 225 characters to prevent API errors
      subaffiliate1: this.limitSubaffiliateLength(this.getStoredValue("subaffiliate1") || this.getStoredValue("sub1")),
      subaffiliate2: this.limitSubaffiliateLength(this.getStoredValue("subaffiliate2") || this.getStoredValue("sub2")),
      subaffiliate3: this.limitSubaffiliateLength(this.getStoredValue("subaffiliate3") || this.getStoredValue("sub3")),
      subaffiliate4: this.limitSubaffiliateLength(this.getStoredValue("subaffiliate4") || this.getStoredValue("sub4")),
      subaffiliate5: this.limitSubaffiliateLength(this.getStoredValue("subaffiliate5") || this.getStoredValue("sub5")),
      // Metadata
      metadata,
      // Timestamps
      first_visit_timestamp: this.getFirstVisitTimestamp(),
      current_visit_timestamp: Date.now()
    };
  }
  /**
   * Collect metadata including device info, referrer, and tracking data
   */
  collectMetadata() {
    const metadata = {
      landing_page: window.location.href,
      referrer: document.referrer || "",
      device: navigator.userAgent || "",
      device_type: this.getDeviceType(),
      domain: window.location.hostname,
      timestamp: Date.now(),
      // Facebook tracking
      fb_fbp: this.getCookie("_fbp") || "",
      fb_fbc: this.getCookie("_fbc") || "",
      fb_pixel_id: this.getFacebookPixelId()
    };
    const fbclid = this.getStoredValue("fbclid");
    if (fbclid) {
      metadata.fbclid = fbclid;
    }
    const clickid = this.getStoredValue("clickid");
    if (clickid) {
      metadata.clickid = clickid;
    }
    this.handleEverflowClickId(metadata);
    this.collectTrackingTags(metadata);
    return metadata;
  }
  /**
   * Limit subaffiliate value to 225 characters to prevent API errors
   */
  limitSubaffiliateLength(value) {
    if (!value) {
      return "";
    }
    if (value.length > 225) {
      logger$2.warn(`Subaffiliate value truncated from ${value.length} to 225 characters`);
      return value.substring(0, 225);
    }
    return value;
  }
  /**
   * Get value from URL parameters, sessionStorage, or localStorage
   * Priority: URL > sessionStorage > localStorage
   */
  getStoredValue(key) {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has(key)) {
      const value = urlParams.get(key) || "";
      try {
        sessionStorage.setItem(key, value);
      } catch (error) {
        console.error(`[AttributionCollector] Error storing ${key} in sessionStorage:`, error);
      }
      return value;
    }
    try {
      const sessionValue = sessionStorage.getItem(key);
      if (sessionValue) {
        return sessionValue;
      }
    } catch (error) {
      console.error(`[AttributionCollector] Error reading ${key} from sessionStorage:`, error);
    }
    try {
      const localValue = localStorage.getItem(key);
      if (localValue) {
        return localValue;
      }
    } catch (error) {
      console.error(`[AttributionCollector] Error reading ${key} from localStorage:`, error);
    }
    try {
      const persistedData = localStorage.getItem("next-attribution");
      if (persistedData) {
        const parsed = JSON.parse(persistedData);
        if (parsed.state && parsed.state[key]) {
          return parsed.state[key];
        }
      }
    } catch (error) {
      console.error("[AttributionCollector] Error reading persisted attribution:", error);
    }
    return "";
  }
  /**
   * Get cookie value by name
   */
  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(";").shift() || "";
    }
    return "";
  }
  /**
   * Detect device type based on user agent
   */
  getDeviceType() {
    const userAgent = navigator.userAgent;
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    return mobileRegex.test(userAgent) ? "mobile" : "desktop";
  }
  /**
   * Get funnel name from meta tag or campaign
   * Once a funnel is set, it persists and won't be overwritten
   */
  getFunnelName() {
    try {
      const sessionFunnel = sessionStorage.getItem("next_funnel_name");
      if (sessionFunnel) {
        logger$2.debug(`Using persisted funnel from session: ${sessionFunnel}`);
        return sessionFunnel;
      }
      const localFunnel = localStorage.getItem("next_funnel_name");
      if (localFunnel) {
        logger$2.debug(`Using persisted funnel from localStorage: ${localFunnel}`);
        sessionStorage.setItem("next_funnel_name", localFunnel);
        return localFunnel;
      }
      const persistedData = localStorage.getItem("next-attribution");
      if (persistedData) {
        const parsed = JSON.parse(persistedData);
        if (parsed.state && parsed.state.funnel) {
          logger$2.debug(`Using persisted funnel from attribution: ${parsed.state.funnel}`);
          sessionStorage.setItem("next_funnel_name", parsed.state.funnel);
          localStorage.setItem("next_funnel_name", parsed.state.funnel);
          return parsed.state.funnel;
        }
      }
    } catch (error) {
      console.error("[AttributionCollector] Error reading persisted funnel:", error);
    }
    const funnelMetaTag = document.querySelector(
      'meta[name="os-tracking-tag"][data-tag-name="funnel_name"], meta[name="data-next-tracking-tag"][data-tag-name="funnel_name"], meta[name="next-funnel"]'
    );
    if (funnelMetaTag) {
      const value = funnelMetaTag.getAttribute("data-tag-value") || funnelMetaTag.getAttribute("content");
      if (value) {
        logger$2.debug(`New funnel found from meta tag: ${value}`);
        try {
          sessionStorage.setItem("next_funnel_name", value);
          localStorage.setItem("next_funnel_name", value);
          logger$2.info(`Persisted funnel name: ${value}`);
        } catch (error) {
          console.error("[AttributionCollector] Error persisting funnel name:", error);
        }
        return value;
      }
    }
    return "";
  }
  /**
   * Handle Everflow click ID tracking
   */
  handleEverflowClickId(metadata) {
    const urlParams = new URLSearchParams(window.location.search);
    let evclid = localStorage.getItem("evclid");
    if (urlParams.has("evclid")) {
      evclid = urlParams.get("evclid") || "";
      localStorage.setItem("evclid", evclid);
      sessionStorage.setItem("evclid", evclid);
      logger$2.debug(`Everflow click ID found in URL: ${evclid}`);
    } else if (!evclid && sessionStorage.getItem("evclid")) {
      evclid = sessionStorage.getItem("evclid");
      if (evclid) {
        localStorage.setItem("evclid", evclid);
        logger$2.debug(`Everflow click ID found in sessionStorage: ${evclid}`);
      }
    }
    if (urlParams.has("sg_evclid")) {
      const sg_evclid = urlParams.get("sg_evclid") || "";
      sessionStorage.setItem("sg_evclid", sg_evclid);
      localStorage.setItem("sg_evclid", sg_evclid);
      metadata.sg_evclid = sg_evclid;
      logger$2.debug(`SG Everflow click ID found: ${sg_evclid}`);
    } else {
      const storedSgEvclid = localStorage.getItem("sg_evclid");
      if (storedSgEvclid) {
        metadata.sg_evclid = storedSgEvclid;
      }
    }
    if (evclid) {
      metadata.everflow_transaction_id = evclid;
      logger$2.debug(`Added Everflow transaction ID to metadata: ${evclid}`);
    }
  }
  /**
   * Collect custom tracking tags from meta elements
   */
  collectTrackingTags(metadata) {
    const trackingTags = document.querySelectorAll(
      'meta[name="os-tracking-tag"], meta[name="data-next-tracking-tag"]'
    );
    logger$2.debug(`Found ${trackingTags.length} tracking tags`);
    trackingTags.forEach((tag) => {
      const tagName = tag.getAttribute("data-tag-name");
      const tagValue = tag.getAttribute("data-tag-value");
      const shouldPersist = tag.getAttribute("data-persist") === "true";
      if (tagName && tagValue) {
        metadata[tagName] = tagValue;
        logger$2.debug(`Added tracking tag: ${tagName} = ${tagValue}`);
        if (shouldPersist) {
          try {
            sessionStorage.setItem(`tn_tag_${tagName}`, tagValue);
            logger$2.debug(`Persisted tracking tag: ${tagName}`);
          } catch (error) {
            console.error(`[AttributionCollector] Error persisting tag ${tagName}:`, error);
          }
        }
      }
    });
  }
  /**
   * Try to detect Facebook Pixel ID from the page
   */
  getFacebookPixelId() {
    const pixelMeta = document.querySelector(
      'meta[name="os-facebook-pixel"], meta[name="facebook-pixel-id"]'
    );
    if (pixelMeta) {
      const pixelId = pixelMeta.getAttribute("content");
      if (pixelId) {
        logger$2.debug(`Facebook Pixel ID found from meta tag: ${pixelId}`);
        return pixelId;
      }
    }
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const content = script.textContent || "";
      if (content.includes("fbq(") && content.includes("init")) {
        const match = content.match(/fbq\s*\(\s*['"]init['"],\s*['"](\d+)['"]/);
        if (match && match[1]) {
          logger$2.debug(`Facebook Pixel ID found from script: ${match[1]}`);
          return match[1];
        }
      }
    }
    return "";
  }
  /**
   * Get the first visit timestamp
   */
  getFirstVisitTimestamp() {
    try {
      const persistedData = localStorage.getItem("next-attribution");
      if (persistedData) {
        const parsed = JSON.parse(persistedData);
        if (parsed.state && parsed.state.first_visit_timestamp) {
          return parsed.state.first_visit_timestamp;
        }
      }
    } catch (error) {
      console.error("[AttributionCollector] Error reading first visit timestamp:", error);
    }
    return Date.now();
  }
}
const AttributionCollector$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  AttributionCollector
});
class DisplayValueValidator {
  static validatePercentage(value) {
    const num = Number(value);
    if (isNaN(num)) {
      console.warn(`Invalid percentage value: ${value}`);
      return 0;
    }
    if (num > 1 && num <= 100) return num;
    if (num >= 0 && num <= 1) return num * 100;
    if (num > 100) {
      console.warn(`Percentage exceeds 100: ${num}`);
      return 100;
    }
    return Math.max(0, num);
  }
  static validateCurrency(value) {
    if (typeof value === "string") {
      const cleanValue = value.replace(/[$,]/g, "").trim();
      const num2 = Number(cleanValue);
      if (!isNaN(num2)) {
        return Math.round(num2 * 100) / 100;
      }
    }
    const num = Number(value);
    if (isNaN(num)) {
      console.warn(`Invalid currency value: ${value}`);
      return 0;
    }
    return Math.round(num * 100) / 100;
  }
  static validateNumber(value) {
    const num = Number(value);
    if (isNaN(num)) {
      console.warn(`Invalid number value: ${value}`);
      return 0;
    }
    return num;
  }
  static validateBoolean(value) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      return lower === "true" || lower === "1" || lower === "yes";
    }
    return !!value;
  }
  static validateDate(value) {
    if (!value) return null;
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date value: ${value}`);
        return null;
      }
      return date;
    } catch {
      console.warn(`Invalid date value: ${value}`);
      return null;
    }
  }
  static validateString(value) {
    if (value === null || value === void 0) {
      return "";
    }
    return String(value);
  }
}
const _PackageContextResolver = class _PackageContextResolver {
  /**
   * Find package ID from parent DOM context
   * Searches up the DOM tree for package ID attributes
   */
  static findPackageId(element) {
    let current = element.parentElement;
    while (current) {
      for (const attr of this.PACKAGE_ID_ATTRS) {
        const value = current.getAttribute(attr);
        if (value) {
          const id = parseInt(value, 10);
          if (!isNaN(id)) {
            this.logger.debug(`Found context package ID: ${id} from element:`, current);
            return id;
          }
        }
      }
      current = current.parentElement;
    }
    this.logger.debug("No context package ID found in parent elements");
    return void 0;
  }
  /**
   * Get package ID from element or its context
   * First checks element itself, then searches parents
   */
  static getPackageId(element) {
    for (const attr of this.PACKAGE_ID_ATTRS) {
      const value = element.getAttribute(attr);
      if (value) {
        const id = parseInt(value, 10);
        if (!isNaN(id)) {
          this.logger.debug(`Found direct package ID: ${id} from element:`, element);
          return id;
        }
      }
    }
    return this.findPackageId(element);
  }
};
_PackageContextResolver.logger = createLogger("PackageContextResolver");
_PackageContextResolver.PACKAGE_ID_ATTRS = [
  "data-next-package-id",
  "data-next-package",
  "data-package-id"
];
let PackageContextResolver = _PackageContextResolver;
class PriceCalculator {
  /**
   * Calculate savings amount
   * @param retailPrice Original/compare price
   * @param currentPrice Sale/current price
   * @returns Savings amount (always >= 0)
   */
  static calculateSavings(retailPrice, currentPrice) {
    return Math.max(0, retailPrice - currentPrice);
  }
  /**
   * Calculate savings percentage
   * @param retailPrice Original/compare price
   * @param currentPrice Sale/current price
   * @returns Savings percentage (0-100)
   */
  static calculateSavingsPercentage(retailPrice, currentPrice) {
    const savings = this.calculateSavings(retailPrice, currentPrice);
    if (retailPrice <= 0 || savings <= 0) return 0;
    const percentage = savings / retailPrice * 100;
    return Math.round(percentage);
  }
  /**
   * Calculate unit price from total
   * @param totalPrice Total package price
   * @param quantity Number of units
   * @returns Price per unit
   */
  static calculateUnitPrice(totalPrice, quantity) {
    return quantity > 0 ? totalPrice / quantity : 0;
  }
  /**
   * Calculate line total
   * @param unitPrice Price per unit
   * @param quantity Number of units
   * @returns Total price
   */
  static calculateLineTotal(unitPrice, quantity) {
    return unitPrice * quantity;
  }
  /**
   * Calculate complete price metrics for a package
   * Note: 'price' from API is per-unit price, 'price_total' is for all units
   */
  static calculatePackageMetrics(params) {
    const totalPrice = params.priceTotal || params.price * params.quantity;
    const totalRetailPrice = params.retailPriceTotal || params.retailPrice * params.quantity;
    const unitPrice = this.calculateUnitPrice(totalPrice, params.quantity);
    const unitRetailPrice = this.calculateUnitPrice(totalRetailPrice, params.quantity);
    return {
      // Totals
      totalPrice,
      totalRetailPrice,
      totalSavings: this.calculateSavings(totalRetailPrice, totalPrice),
      totalSavingsPercentage: this.calculateSavingsPercentage(totalRetailPrice, totalPrice),
      // Units
      unitPrice,
      unitRetailPrice,
      unitSavings: this.calculateSavings(unitRetailPrice, unitPrice),
      unitSavingsPercentage: this.calculateSavingsPercentage(unitRetailPrice, unitPrice),
      // Helpers
      hasSavings: totalRetailPrice > totalPrice
    };
  }
}
function preserveQueryParams(targetUrl, preserveParams = ["debug", "debugger"]) {
  try {
    const url = new URL(targetUrl, window.location.origin);
    const currentParams = new URLSearchParams(window.location.search);
    preserveParams.forEach((param) => {
      const value = currentParams.get(param);
      if (value && !url.searchParams.has(param)) {
        url.searchParams.append(param, value);
      }
    });
    if (currentParams.get("debug") === "true" && !url.searchParams.has("debug")) {
      url.searchParams.append("debug", "true");
    }
    if (currentParams.get("debugger") === "true" && !url.searchParams.has("debugger")) {
      url.searchParams.append("debugger", "true");
    }
    return url.href;
  } catch (error) {
    console.error("[URL Utils] Error preserving query parameters:", error);
    return targetUrl;
  }
}
function isValidString(value) {
  return typeof value === "string" && value.length > 0;
}
function isValidNumber(value) {
  return typeof value === "number" && !isNaN(value) && isFinite(value);
}
function isValidPositiveNumber(value) {
  return isValidNumber(value) && value >= 0;
}
function isValidPrice(value) {
  return isValidPositiveNumber(value);
}
function parseValidPrice(priceString) {
  if (!isValidString(priceString)) return void 0;
  const priceMatch = priceString.match(/\$?(\d+\.?\d*)/);
  if (!priceMatch || !priceMatch[1]) return void 0;
  const parsed = parseFloat(priceMatch[1]);
  return isValidPrice(parsed) ? parsed : void 0;
}
const _ElementDataExtractor = class _ElementDataExtractor {
  /**
   * Extract price from an element using common price selectors
   */
  static extractPrice(element) {
    for (const selector of this.PRICE_SELECTORS) {
      const priceEl = element.querySelector(selector);
      if (priceEl?.textContent) {
        const price = parseValidPrice(priceEl.textContent.trim());
        if (price !== void 0) return price;
      }
    }
    return void 0;
  }
  /**
   * Extract name/title from an element using common selectors
   */
  static extractName(element) {
    for (const selector of this.NAME_SELECTORS) {
      const nameEl = element.querySelector(selector);
      const name = nameEl?.textContent?.trim();
      if (name) return name;
    }
    return void 0;
  }
  /**
   * Extract quantity from element attributes
   */
  static extractQuantity(element) {
    const qtyAttr = element.getAttribute("data-next-quantity") || element.getAttribute("data-quantity") || element.getAttribute("data-qty");
    return qtyAttr ? parseInt(qtyAttr, 10) || 1 : 1;
  }
};
_ElementDataExtractor.PRICE_SELECTORS = [
  ".pb-quantity__price.pb--current",
  ".price",
  '[data-next-display*="price"]',
  ".next-price",
  ".product-price",
  ".item-price"
];
_ElementDataExtractor.NAME_SELECTORS = [
  ".card-title",
  "h1, h2, h3, h4, h5, h6",
  ".title",
  ".name",
  '[data-next-display*="name"]',
  ".product-name",
  ".item-name"
];
let ElementDataExtractor = _ElementDataExtractor;
class FieldFinder {
  /**
   * Find a field by name using multiple selector strategies
   */
  static findField(fieldName, options = {}) {
    const container = options.container || document;
    const defaultSelectors = [
      `[data-next-checkout-field="${fieldName}"]`,
      `[os-checkout-field="${fieldName}"]`,
      `input[name="${fieldName}"]`,
      `select[name="${fieldName}"]`,
      `textarea[name="${fieldName}"]`,
      `#${fieldName}`,
      `[data-field="${fieldName}"]`,
      `[data-field-name="${fieldName}"]`
    ];
    const selectors = options.customSelectors || defaultSelectors;
    for (const selector of selectors) {
      try {
        const element = container.querySelector(selector);
        if (element) {
          const htmlElement = element;
          if (!options.includeHidden && htmlElement.offsetParent === null) {
            continue;
          }
          if (!options.includeDisabled && "disabled" in htmlElement) {
            const inputElement = htmlElement;
            if (inputElement.disabled) continue;
          }
          return htmlElement;
        }
      } catch (e) {
        console.warn(`Invalid selector: ${selector}`);
      }
    }
    return null;
  }
  /**
   * Find multiple fields by names
   */
  static findFields(fieldNames, options = {}) {
    const fields = /* @__PURE__ */ new Map();
    fieldNames.forEach((name) => {
      const field = this.findField(name, options);
      if (field) {
        fields.set(name, field);
      }
    });
    return fields;
  }
  /**
   * Find field wrapper element
   */
  static findFieldWrapper(field, customSelectors) {
    const wrapperSelectors = customSelectors || [
      ".form-group",
      ".frm-flds",
      ".form-input",
      ".select-form-wrapper",
      ".field-wrapper",
      ".input-wrapper",
      ".form-field"
    ];
    for (const selector of wrapperSelectors) {
      const wrapper = field.closest(selector);
      if (wrapper) return wrapper;
    }
    return field.parentElement;
  }
  /**
   * Find form container for a field
   */
  static findFormContainer(field) {
    return field.closest("form");
  }
  /**
   * Find label for a field
   */
  static findFieldLabel(field) {
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label) return label;
    }
    let parent = field.parentElement;
    while (parent) {
      const label = parent.querySelector("label");
      if (label) return label;
      if (parent.tagName === "LABEL") {
        return parent;
      }
      parent = parent.parentElement;
    }
    const wrapper = this.findFieldWrapper(field);
    if (wrapper) {
      const label = wrapper.querySelector("label");
      if (label) return label;
    }
    return null;
  }
  /**
   * Find all form fields in a container
   */
  static findAllFormFields(container, options = {}) {
    const selectors = [
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
      "select",
      "textarea"
    ];
    if (options.includeButtons) {
      selectors.push("button", 'input[type="submit"]', 'input[type="button"]');
    }
    const fields = [];
    const elements = container.querySelectorAll(selectors.join(", "));
    elements.forEach((element) => {
      fields.push(element);
    });
    return fields;
  }
  /**
   * Find fields by attribute pattern
   */
  static findFieldsByAttribute(attributeName, pattern, container = document.body) {
    const fields = [];
    const selector = pattern ? `[${attributeName}]` : `[${attributeName}]`;
    const elements = container.querySelectorAll(selector);
    elements.forEach((element) => {
      const attrValue = element.getAttribute(attributeName);
      if (!pattern || !attrValue) {
        fields.push(element);
      } else if (typeof pattern === "string") {
        if (attrValue.includes(pattern)) {
          fields.push(element);
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(attrValue)) {
          fields.push(element);
        }
      }
    });
    return fields;
  }
  /**
   * Check if element is a form field
   */
  static isFormField(element) {
    const fieldTags = ["INPUT", "SELECT", "TEXTAREA"];
    return fieldTags.includes(element.tagName);
  }
  /**
   * Get field type
   */
  static getFieldType(field) {
    if (field instanceof HTMLInputElement) {
      return field.type || "text";
    } else if (field instanceof HTMLSelectElement) {
      return "select";
    } else if (field instanceof HTMLTextAreaElement) {
      return "textarea";
    }
    return "unknown";
  }
  /**
   * Get field value safely
   */
  static getFieldValue(field) {
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      return field.value;
    }
    return "";
  }
  /**
   * Set field value safely
   */
  static setFieldValue(field, value) {
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      field.value = value;
      field.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }
}
const DEFAULT_OPTIONS = {
  wrapperClass: "form-group",
  errorClass: "next-error-field",
  errorLabelClass: "next-error-label",
  successClass: "no-error",
  iconErrorClass: "addErrorIcon",
  iconSuccessClass: "addTick"
};
class ErrorDisplayManager {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  /**
   * Show error on a field with consistent styling
   */
  showFieldError(field, message) {
    const wrapper = FieldFinder.findFieldWrapper(field);
    if (!wrapper) return;
    this.clearFieldError(field);
    field.classList.add("has-error", this.options.errorClass);
    field.classList.remove(this.options.successClass);
    wrapper.classList.add(this.options.iconErrorClass);
    wrapper.classList.remove(this.options.iconSuccessClass);
    const errorElement = document.createElement("div");
    errorElement.className = this.options.errorLabelClass;
    errorElement.textContent = message;
    errorElement.setAttribute("role", "alert");
    errorElement.setAttribute("aria-live", "polite");
    const formGroup = field.closest(`.${this.options.wrapperClass}`);
    if (formGroup) {
      formGroup.appendChild(errorElement);
    } else {
      wrapper.appendChild(errorElement);
    }
  }
  /**
   * Clear error from a field
   */
  clearFieldError(field) {
    const wrapper = FieldFinder.findFieldWrapper(field);
    field.classList.remove("has-error", this.options.errorClass);
    if (wrapper) {
      wrapper.classList.remove(this.options.iconErrorClass);
      const errorLabel = wrapper.querySelector(`.${this.options.errorLabelClass}`);
      if (errorLabel) {
        errorLabel.remove();
      }
      const formGroup = field.closest(`.${this.options.wrapperClass}`);
      if (formGroup) {
        const formGroupError = formGroup.querySelector(`.${this.options.errorLabelClass}`);
        if (formGroupError) {
          formGroupError.remove();
        }
      }
    }
  }
  /**
   * Show field as valid with success styling
   */
  showFieldValid(field) {
    const wrapper = FieldFinder.findFieldWrapper(field);
    this.clearFieldError(field);
    field.classList.add(this.options.successClass);
    if (wrapper) {
      wrapper.classList.add(this.options.iconSuccessClass);
    }
  }
  /**
   * Clear all error displays in a container
   */
  clearAllErrors(container) {
    const errorLabels = container.querySelectorAll(`.${this.options.errorLabelClass}`);
    errorLabels.forEach((label) => label.remove());
    const errorFields = container.querySelectorAll(`.${this.options.errorClass}, .has-error`);
    errorFields.forEach((field) => {
      field.classList.remove("has-error", this.options.errorClass);
    });
    const errorWrappers = container.querySelectorAll(`.${this.options.iconErrorClass}`);
    errorWrappers.forEach((wrapper) => {
      wrapper.classList.remove(this.options.iconErrorClass);
    });
  }
  /**
   * Display multiple field errors at once
   */
  displayErrors(errors, container) {
    this.clearAllErrors(container);
    Object.entries(errors).forEach(([fieldName, message]) => {
      const field = this.findField(fieldName, container);
      if (field) {
        this.showFieldError(field, message);
      }
    });
  }
  /**
   * Find a field by name within a container
   */
  findField(fieldName, container) {
    const selectors = [
      `[data-next-checkout-field="${fieldName}"]`,
      `[os-checkout-field="${fieldName}"]`,
      `[name="${fieldName}"]`,
      `#${fieldName}`
    ];
    for (const selector of selectors) {
      const field = container.querySelector(selector);
      if (field) return field;
    }
    return null;
  }
  /**
   * Show a toast error message
   */
  static showToastError(message, duration = 1e4) {
    const toastHandler = document.querySelector('[next-checkout-element="spreedly-error"]');
    if (!(toastHandler instanceof HTMLElement)) return;
    const messageElement = toastHandler.querySelector('[data-os-message="error"]');
    if (messageElement instanceof HTMLElement) {
      messageElement.textContent = message;
      toastHandler.style.display = "flex";
      setTimeout(() => {
        if (toastHandler.style.display === "flex") {
          toastHandler.style.display = "none";
        }
      }, duration);
    }
  }
  /**
   * Hide toast error message
   */
  static hideToastError() {
    const toastHandler = document.querySelector('[next-checkout-element="spreedly-error"]');
    if (toastHandler instanceof HTMLElement) {
      toastHandler.style.display = "none";
    }
  }
}
class EventHandlerManager {
  constructor() {
    this.handlers = /* @__PURE__ */ new Map();
    this.bindings = [];
  }
  /**
   * Add an event handler with automatic cleanup tracking
   */
  addHandler(element, event, handler, options) {
    if (!element) return;
    if (!this.handlers.has(element)) {
      this.handlers.set(element, /* @__PURE__ */ new Map());
    }
    const elementHandlers = this.handlers.get(element);
    if (elementHandlers.has(event)) {
      const existingHandler = elementHandlers.get(event);
      element.removeEventListener(event, existingHandler);
    }
    element.addEventListener(event, handler, options);
    elementHandlers.set(event, handler);
    const binding = { element, event, handler };
    if (options !== void 0) {
      binding.options = options;
    }
    this.bindings.push(binding);
  }
  /**
   * Add multiple handlers at once
   */
  addHandlers(bindings) {
    bindings.forEach((binding) => {
      this.addHandler(
        binding.element,
        binding.event,
        binding.handler,
        binding.options
      );
    });
  }
  /**
   * Remove a specific handler
   */
  removeHandler(element, event) {
    if (!element) return;
    const elementHandlers = this.handlers.get(element);
    if (!elementHandlers) return;
    const handler = elementHandlers.get(event);
    if (handler) {
      element.removeEventListener(event, handler);
      elementHandlers.delete(event);
      this.bindings = this.bindings.filter(
        (b) => !(b.element === element && b.event === event)
      );
    }
    if (elementHandlers.size === 0) {
      this.handlers.delete(element);
    }
  }
  /**
   * Remove all handlers for a specific element
   */
  removeElementHandlers(element) {
    const elementHandlers = this.handlers.get(element);
    if (!elementHandlers) return;
    elementHandlers.forEach((handler, event) => {
      element.removeEventListener(event, handler);
    });
    this.handlers.delete(element);
    this.bindings = this.bindings.filter((b) => b.element !== element);
  }
  /**
   * Remove all handlers
   */
  removeAllHandlers() {
    this.handlers.forEach((elementHandlers, element) => {
      elementHandlers.forEach((handler, event) => {
        element.removeEventListener(event, handler);
      });
    });
    this.handlers.clear();
    this.bindings = [];
  }
  /**
   * Add event delegation handler
   */
  addDelegatedHandler(container, selector, event, handler) {
    const delegatedHandler = (e) => {
      const target = e.target;
      const matchedElement = target.closest(selector);
      if (matchedElement && container.contains(matchedElement)) {
        handler(e, matchedElement);
      }
    };
    this.addHandler(container, event, delegatedHandler);
  }
  /**
   * Add handler with debounce
   */
  addDebouncedHandler(element, event, handler, delay = 300) {
    let timeoutId;
    const debouncedHandler = (e) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        handler(e);
      }, delay);
    };
    this.addHandler(element, event, debouncedHandler);
  }
  /**
   * Add handler with throttle
   */
  addThrottledHandler(element, event, handler, limit = 300) {
    let inThrottle = false;
    const throttledHandler = (e) => {
      if (!inThrottle) {
        handler(e);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
    this.addHandler(element, event, throttledHandler);
  }
  /**
   * Add one-time handler that auto-removes
   */
  addOnceHandler(element, event, handler) {
    const onceHandler = (e) => {
      handler(e);
      this.removeHandler(element, event);
    };
    this.addHandler(element, event, onceHandler);
  }
  /**
   * Get all active bindings (for debugging)
   */
  getActiveBindings() {
    return [...this.bindings];
  }
  /**
   * Check if element has handler for event
   */
  hasHandler(element, event) {
    const elementHandlers = this.handlers.get(element);
    return elementHandlers ? elementHandlers.has(event) : false;
  }
}
function getSuccessUrl() {
  const metaTag = document.querySelector('meta[name="next-success-url"]') || document.querySelector('meta[name="next-next-url"]') || document.querySelector('meta[name="os-next-page"]');
  if (metaTag?.content) {
    if (metaTag.content.startsWith("http://") || metaTag.content.startsWith("https://")) {
      return metaTag.content;
    }
    const path = metaTag.content.startsWith("/") ? metaTag.content : "/" + metaTag.content;
    return window.location.origin + path;
  }
  return window.location.origin + "/success";
}
function getFailureUrl() {
  const metaTag = document.querySelector('meta[name="next-failure-url"]') || document.querySelector('meta[name="os-failure-url"]');
  if (metaTag?.content) {
    if (metaTag.content.startsWith("http://") || metaTag.content.startsWith("https://")) {
      return metaTag.content;
    }
    const path = metaTag.content.startsWith("/") ? metaTag.content : "/" + metaTag.content;
    return window.location.origin + path;
  }
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set("payment_failed", "true");
  return currentUrl.href;
}
function getNextPageUrlFromMeta(refId) {
  const metaTag = document.querySelector('meta[name="next-success-url"]') || document.querySelector('meta[name="next-next-url"]') || document.querySelector('meta[name="os-next-page"]');
  if (!metaTag?.content) {
    return null;
  }
  const nextPagePath = metaTag.content;
  const redirectUrl = nextPagePath.startsWith("http") ? new URL(nextPagePath) : new URL(nextPagePath, window.location.origin);
  if (refId) {
    redirectUrl.searchParams.append("ref_id", refId);
  }
  return redirectUrl.href;
}
function handleOrderRedirect(order, logger2, emitCallback) {
  let redirectUrl;
  if (order.payment_complete_url) {
    logger2.debug(`Using payment_complete_url from API: ${order.payment_complete_url}`);
    redirectUrl = order.payment_complete_url;
  } else {
    const nextPageUrl = getNextPageUrlFromMeta(order.ref_id);
    if (nextPageUrl) {
      logger2.debug(`Using success URL from meta tag: ${nextPageUrl}`);
      redirectUrl = nextPageUrl;
    } else if (order.order_status_url) {
      logger2.debug(`Using order_status_url from API: ${order.order_status_url}`);
      redirectUrl = order.order_status_url;
    } else {
      logger2.warn("No order_status_url found in API response - using fallback URL");
      redirectUrl = `${window.location.origin}/checkout/confirmation/?ref_id=${order.ref_id || ""}`;
    }
  }
  if (redirectUrl) {
    const finalUrl = preserveQueryParams(redirectUrl);
    logger2.info("Redirecting to:", finalUrl);
    window.location.href = finalUrl;
  } else {
    logger2.error("No redirect URL could be determined");
    emitCallback("order:redirect-missing", { order });
  }
}
const logger$1 = createLogger("PaymentAvailability");
function isApplePayAvailable() {
  try {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      logger$1.debug("Android device detected - hiding Apple Pay");
      return false;
    }
    logger$1.debug("Apple Pay available (non-Android device)");
    return true;
  } catch (error) {
    logger$1.warn("Error checking Apple Pay availability:", error);
    return true;
  }
}
function isGooglePayAvailable() {
  return true;
}
function isPayPalAvailable() {
  return true;
}
function getPaymentCapabilities() {
  return {
    applePay: isApplePayAvailable(),
    googlePay: isGooglePayAvailable(),
    paypal: isPayPalAvailable(),
    userAgent: navigator.userAgent,
    platform: navigator.platform || "unknown"
  };
}
class TemplateRenderer {
  /**
   * Renders a template string by replacing {placeholder} patterns with actual values
   * @param template - Template string with {key.subkey} placeholders
   * @param options - Data, formatters, and default values
   * @returns Rendered HTML string
   */
  static render(template, options) {
    const { data, formatters = {}, defaultValues = {} } = options;
    return template.replace(/\{([^}]+)\}/g, (_, placeholder) => {
      try {
        const value = this.getValue(data, placeholder);
        const formattedValue = this.formatValue(value, placeholder, formatters);
        if (formattedValue === "" || formattedValue === null || formattedValue === void 0) {
          return defaultValues[placeholder] || "";
        }
        return String(formattedValue);
      } catch (error) {
        console.warn(`Template rendering error for placeholder ${placeholder}:`, error);
        return defaultValues[placeholder] || "";
      }
    });
  }
  /**
   * Extracts nested property value from data object
   * Handles paths like "item.price", "item.price.raw", "item.showUpsell"
   */
  static getValue(data, path) {
    const keys = path.split(".");
    let current = data;
    for (const key of keys) {
      if (current === null || current === void 0) {
        return void 0;
      }
      current = current[key];
    }
    return current;
  }
  /**
   * Applies formatting based on placeholder path and available formatters
   */
  static formatValue(value, placeholder, formatters) {
    if (placeholder.endsWith(".raw")) {
      return value;
    }
    const currencyFields = [
      "price",
      "total",
      "savings",
      "amount",
      "cost",
      "fee",
      "charge",
      "compare",
      "retail",
      "recurring",
      "subtotal",
      "tax",
      "shipping",
      "discount",
      "credit",
      "balance",
      "payment",
      "refund"
    ];
    const shouldFormatAsCurrency = currencyFields.some(
      (field) => placeholder.toLowerCase().includes(field.toLowerCase())
    );
    if (shouldFormatAsCurrency && typeof value === "number") {
      return formatters.currency ? formatters.currency(value) : value;
    }
    if (shouldFormatAsCurrency && typeof value === "string" && !isNaN(parseFloat(value))) {
      return formatters.currency ? formatters.currency(parseFloat(value)) : value;
    }
    if (placeholder.includes("date") || placeholder.includes("created_at")) {
      return formatters.date ? formatters.date(value) : value;
    }
    if (typeof value === "string" && (placeholder.includes("name") || placeholder.includes("title") || placeholder.includes("description"))) {
      return formatters.escapeHtml ? formatters.escapeHtml(value) : value;
    }
    return value;
  }
  /**
   * Validates template for common issues
   * Returns list of potential problems
   */
  static validateTemplate(template, availablePlaceholders) {
    const issues = [];
    const usedPlaceholders = this.extractPlaceholders(template);
    for (const placeholder of usedPlaceholders) {
      const basePlaceholder = placeholder.replace(".raw", "");
      if (!availablePlaceholders.some((p) => p.startsWith(basePlaceholder))) {
        issues.push(`Unknown placeholder: {${placeholder}}`);
      }
    }
    const unclosed = template.match(/\{[^}]*$/g);
    if (unclosed) {
      issues.push(`Unclosed placeholders found: ${unclosed.join(", ")}`);
    }
    return issues;
  }
  /**
   * Extracts all placeholders from template
   */
  static extractPlaceholders(template) {
    const matches = template.match(/\{([^}]+)\}/g) || [];
    return matches.map((match) => match.slice(1, -1));
  }
  /**
   * Creates default formatters that both cart and order enhancers can use
   */
  static createDefaultFormatters() {
    return {
      currency: (amount) => {
        const { formatCurrency: formatCurrency2 } = require("@/utils/currencyFormatter");
        return formatCurrency2(amount);
      },
      date: (dateValue) => {
        if (!dateValue) return "";
        try {
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return String(dateValue);
          return new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          }).format(date);
        } catch {
          return String(dateValue);
        }
      },
      escapeHtml: (text) => {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
      }
    };
  }
}
const logger = createLogger("UtmTransfer");
class UtmTransfer {
  constructor(config = {}) {
    this.config = {
      enabled: true,
      applyToExternalLinks: false,
      excludedDomains: [],
      paramsToCopy: [],
      debug: false,
      ...config
    };
    this.paramsToApply = new URLSearchParams();
  }
  /**
   * Initialize the UTM transfer feature
   */
  init() {
    if (!this.config.enabled) {
      logger.debug("UTM Transfer disabled by configuration");
      return;
    }
    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.toString() === "") {
      logger.debug("No URL parameters to transfer");
      return;
    }
    if (this.config.debug) {
      const availableParams = [];
      currentParams.forEach((value, key) => {
        availableParams.push(`${key}=${value}`);
      });
      logger.debug(`Available parameters: ${availableParams.join(", ")}`);
    }
    this.prepareParameters(currentParams);
    if (this.paramsToApply.toString() === "") {
      logger.debug("No matching parameters to transfer");
      return;
    }
    this.enhanceLinks();
    this.observeNewLinks();
    logger.debug(`UTM Transfer initialized with parameters: ${this.paramsToApply.toString()}`);
  }
  /**
   * Prepare parameters to apply based on configuration
   */
  prepareParameters(currentParams) {
    if (Array.isArray(this.config.paramsToCopy) && this.config.paramsToCopy.length > 0) {
      logger.debug(`Filtering to specific parameters: ${this.config.paramsToCopy.join(", ")}`);
      this.config.paramsToCopy.forEach((param) => {
        if (currentParams.has(param)) {
          this.paramsToApply.append(param, currentParams.get(param));
          logger.debug(`Found parameter to copy: ${param}=${currentParams.get(param)}`);
        }
      });
    } else {
      logger.debug("No specific parameters configured, will copy all parameters");
      currentParams.forEach((value, key) => {
        this.paramsToApply.append(key, value);
      });
    }
  }
  /**
   * Enhance all existing links on the page
   */
  enhanceLinks() {
    const links = document.querySelectorAll("a");
    logger.debug(`Found ${links.length} links on the page`);
    links.forEach((link) => {
      this.addClickListener(link);
    });
  }
  /**
   * Add click listener to a link
   */
  addClickListener(link) {
    if (link.dataset.utmEnhanced === "true") {
      return;
    }
    link.addEventListener("click", (_event) => {
      this.applyParamsToLink(link);
    });
    link.dataset.utmEnhanced = "true";
  }
  /**
   * Apply parameters to a specific link
   */
  applyParamsToLink(linkElement) {
    if (!linkElement || !linkElement.getAttribute) {
      logger.error("Invalid link element provided");
      return;
    }
    const href = linkElement.getAttribute("href");
    if (!href) return;
    if (this.shouldSkipLink(href)) {
      return;
    }
    if (this.isExternalLink(href)) {
      if (!this.config.applyToExternalLinks) {
        return;
      }
      if (this.isExcludedDomain(href)) {
        return;
      }
    }
    let url;
    try {
      url = new URL(href, window.location.origin);
    } catch (e) {
      logger.error("Invalid URL:", href);
      return;
    }
    const linkParams = new URLSearchParams(url.search);
    let paramsAdded = false;
    this.paramsToApply.forEach((value, key) => {
      if (!linkParams.has(key)) {
        linkParams.append(key, value);
        paramsAdded = true;
      }
    });
    if (paramsAdded) {
      url.search = linkParams.toString();
      linkElement.setAttribute("href", url.toString());
      logger.debug(`Updated link ${href} to ${url.toString()}`);
    }
  }
  /**
   * Check if link should be skipped
   */
  shouldSkipLink(href) {
    return href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("sms:") || href.startsWith("whatsapp:");
  }
  /**
   * Check if link is external
   */
  isExternalLink(href) {
    return href.includes("://") && !href.includes(window.location.hostname);
  }
  /**
   * Check if domain is excluded
   */
  isExcludedDomain(href) {
    if (!this.config.excludedDomains || this.config.excludedDomains.length === 0) {
      return false;
    }
    return this.config.excludedDomains.some((domain) => href.includes(domain));
  }
  /**
   * Observe DOM for new links
   */
  observeNewLinks() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (element.tagName === "A") {
              this.addClickListener(element);
            }
            const links = element.querySelectorAll("a");
            links.forEach((link) => {
              this.addClickListener(link);
            });
          }
        });
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Update configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
  }
}
const UtmTransfer$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  UtmTransfer
});
class GlobalErrorHandler {
  constructor() {
    this.logger = new Logger("ErrorHandler");
    this.initialized = false;
    this.isHandlingError = false;
  }
  initialize() {
    if (this.initialized) return;
    window.addEventListener("error", (event) => {
      this.handleError(event.error, {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
    window.addEventListener("unhandledrejection", (event) => {
      this.handleError(event.reason, {
        type: "unhandledRejection",
        promise: event.promise
      });
    });
    const originalConsoleError = console.error;
    console.error = (...args) => {
      originalConsoleError.apply(console, args);
      if (this.isHandlingError) return;
      const firstArg = args[0];
      if (firstArg instanceof Error) {
        this.handleError(firstArg, { source: "console.error" });
      } else if (typeof firstArg === "string" && firstArg.toLowerCase().includes("error")) {
        this.handleError(new Error(firstArg), {
          source: "console.error",
          additionalArgs: args.slice(1)
        });
      }
    };
    this.initialized = true;
    this.logger.debug("Global error handler initialized");
  }
  handleError(error, context) {
    if (!error) return;
    if (this.isHandlingError) return;
    try {
      this.isHandlingError = true;
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const enrichedContext = {
        ...context,
        sdk: {
          version: "0.2.0",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        }
      };
      this.logger.error("Captured error:", errorObj, enrichedContext);
      EventBus.getInstance().emit("error:occurred", {
        message: errorObj.message,
        code: errorObj.name,
        details: enrichedContext
      });
    } finally {
      this.isHandlingError = false;
    }
  }
  captureMessage(_message, _level = "info") {
  }
  addBreadcrumb(_breadcrumb) {
  }
}
const errorHandler = new GlobalErrorHandler();
const errorHandler$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  errorHandler
});
createLogger("Analytics");
const analytics = /* @__PURE__ */ Object.freeze({
  __proto__: null
});
export {
  AttributionCollector$1 as A,
  analytics as B,
  CAMPAIGN_STORAGE_KEY as C,
  DisplayValueValidator as D,
  EventBus as E,
  FieldFinder as F,
  Logger as L,
  ProfileMapper as P,
  StorageManager as S,
  TemplateRenderer as T,
  UtmTransfer$1 as U,
  CART_STORAGE_KEY as a,
  formatCurrency as b,
  createLogger as c,
  CountryService as d,
  LogLevel as e,
  formatPercentage as f,
  getCurrencySymbol as g,
  PackageContextResolver as h,
  ElementDataExtractor as i,
  PriceCalculator as j,
  ErrorDisplayManager as k,
  EventHandlerManager as l,
  getPaymentCapabilities as m,
  isApplePayAvailable as n,
  isPayPalAvailable as o,
  isGooglePayAvailable as p,
  getFailureUrl as q,
  getSuccessUrl as r,
  sessionStorageManager as s,
  handleOrderRedirect as t,
  preserveQueryParams as u,
  formatNumber as v,
  CurrencyFormatter as w,
  events as x,
  currencyFormatter as y,
  errorHandler$1 as z
};
