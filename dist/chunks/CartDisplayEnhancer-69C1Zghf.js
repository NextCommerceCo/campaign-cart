import { B as BaseDisplayEnhancer, P as PropertyResolver, g as getPropertyConfig } from "./DisplayEnhancerCore-aGYRF6-t.js";
import { A as AttributeParser } from "./index-D7N528rT.js";
import { g as getCurrencySymbol, f as formatCurrency, e as PackageContextResolver } from "./utils-CJHo6zrd.js";
import { a as useCartStore, u as useCampaignStore, c as configStore } from "./analytics-C593VfhV.js";
class CartDisplayEnhancer extends BaseDisplayEnhancer {
  constructor() {
    super(...arguments);
    this.includeDiscounts = false;
  }
  async initialize() {
    this.includeDiscounts = this.element.hasAttribute("data-include-discounts");
    await super.initialize();
  }
  setupStoreSubscriptions() {
    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));
    this.cartState = useCartStore.getState();
    if (this.cartState.items?.length > 0 && this.cartState.isEmpty) {
      this.logger.debug("Cart has items but totals are empty, triggering recalculation");
      useCartStore.getState().calculateTotals?.();
    }
  }
  handleCartUpdate(cartState) {
    const prevState = this.cartState;
    this.cartState = cartState;
    const shouldLog = this.property === "total" || this.property === "itemCount";
    if (shouldLog && (prevState?.total !== cartState.total || prevState?.items?.length !== cartState.items?.length)) {
      this.logger.debug("Cart updated", {
        isEmpty: cartState.isEmpty,
        itemCount: cartState.items.length,
        total: cartState.total,
        totalsTotal: cartState.total?.toNumber()
      });
    }
    this.toggleClass("next-cart-empty", cartState.isEmpty);
    this.toggleClass("next-cart-has-items", !cartState.isEmpty);
    this.updateDisplay();
  }
  getPropertyValue() {
    if (!this.cartState || !this.property) {
      this.logger.debug("Missing cartState or property", {
        hasCartState: !!this.cartState,
        property: this.property
      });
      return void 0;
    }
    if (this.property.endsWith(".raw")) {
      const baseProp = this.property.slice(0, -4);
      const config2 = getPropertyConfig("cart", baseProp);
      const path = config2 && typeof config2 === "object" && "path" in config2 ? config2.path : typeof config2 === "string" ? config2 : baseProp;
      const value = PropertyResolver.getNestedProperty(this.cartState, path);
      return value != null && typeof value.toNumber === "function" ? value.toNumber() : value;
    }
    if (this.property === "currency" || this.property === "currencyCode") {
      const campaignStore = useCampaignStore.getState();
      if (campaignStore?.currency) {
        return campaignStore.currency;
      } else {
        const configStore$1 = configStore.getState();
        return configStore$1?.selectedCurrency || configStore$1?.detectedCurrency || "USD";
      }
    }
    if (this.property === "currencySymbol") {
      const configStore$1 = configStore.getState();
      if (configStore$1?.locationData?.detectedCountryConfig?.currencySymbol) {
        return configStore$1.locationData.detectedCountryConfig.currencySymbol;
      }
      let currency = "USD";
      const campaignStore = useCampaignStore.getState();
      if (campaignStore?.currency) {
        currency = campaignStore.currency;
      } else {
        currency = configStore$1?.selectedCurrency || configStore$1?.detectedCurrency || "USD";
      }
      return getCurrencySymbol(currency) || currency;
    }
    if (this.includeDiscounts && this.property === "subtotal") {
      this.logger.debug("Handling subtotal with discounts", {
        subtotal: this.cartState.subtotal?.toNumber(),
        totalDiscount: this.cartState.totalDiscount?.toNumber()
      });
      const subtotalValue = this.cartState.subtotal?.toNumber() ?? 0;
      const discountsValue = this.cartState.totalDiscount?.toNumber() ?? 0;
      const discountedSubtotal = subtotalValue - discountsValue;
      let currency = "USD";
      const campaignStore = useCampaignStore.getState();
      if (campaignStore?.currency) {
        currency = campaignStore.currency;
      } else {
        const configStore$1 = configStore.getState();
        currency = configStore$1?.selectedCurrency || configStore$1?.detectedCurrency || "USD";
      }
      const formatted = formatCurrency(discountedSubtotal, currency);
      this.logger.debug("Returning discounted subtotal", { discountedSubtotal, formatted, currency });
      return { _preformatted: true, value: formatted };
    }
    if (this.includeDiscounts && this.property === "subtotal.raw") {
      const subtotalValue = this.cartState.subtotal?.toNumber() ?? 0;
      const discountsValue = this.cartState.totalDiscount?.toNumber() ?? 0;
      return subtotalValue - discountsValue;
    }
    const config = getPropertyConfig("cart", this.property);
    if (config) {
      const { path, preformatted } = config;
      if (path.startsWith("!")) {
        const actualPath = path.substring(1);
        const value2 = PropertyResolver.getNestedProperty(this.cartState, actualPath);
        return !value2;
      }
      const value = PropertyResolver.getNestedProperty(this.cartState, path);
      if (preformatted) {
        return { _preformatted: true, value };
      }
      return value;
    }
    return PropertyResolver.getNestedProperty(this.cartState, this.property);
  }
  async performInitialUpdate() {
    if (this.displayPath) {
      const parsed = AttributeParser.parseDisplayPath(this.displayPath);
      if (parsed.object === "package") {
        this.logger.warn(`CartDisplayEnhancer is handling package property "${this.displayPath}" - this may be incorrect!`, {
          element: this.element.outerHTML.substring(0, 200) + "...",
          hasPackageContext: PackageContextResolver.findPackageId(this.element) !== void 0
        });
      }
    }
    await super.performInitialUpdate();
  }
  getCartProperty(cartState, property) {
    const oldCartState = this.cartState;
    const oldProperty = this.property;
    this.cartState = cartState;
    this.property = property;
    const value = this.getPropertyValue();
    if (oldCartState !== void 0) {
      this.cartState = oldCartState;
    }
    if (oldProperty !== void 0) {
      this.property = oldProperty;
    }
    return value;
  }
  refreshDisplay() {
    this.updateDisplay();
  }
}
export {
  CartDisplayEnhancer
};
