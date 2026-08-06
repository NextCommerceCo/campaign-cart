export declare const BILLING_CONTAINER_SELECTOR = "[os-checkout-element=\"different-billing-address\"], [data-next-component=\"different-billing-address\"]";
export declare const SHIPPING_FORM_SELECTOR = "[os-checkout-component=\"shipping-form\"], [data-next-component=\"shipping-form\"]";
export declare const BILLING_FORM_CONTAINER_SELECTOR = "[os-checkout-component=\"billing-form\"], [data-next-component=\"billing-form\"]";
export declare const BILLING_TOGGLE_SELECTOR = "input[name=\"use_shipping_address\"]";
export declare const META_TAG_SELECTORS: {
    readonly SUCCESS_URL: readonly ["meta[name=\"next-success-url\"]", "meta[name=\"next-next-url\"]", "meta[name=\"os-next-page\"]"];
    readonly FAILURE_URL: readonly ["meta[name=\"next-failure-url\"]", "meta[name=\"os-failure-url\"]"];
    readonly NEXT_PAGE: readonly ["meta[name=\"next-success-url\"]", "meta[name=\"next-next-url\"]", "meta[name=\"os-next-page\"]"];
};
//# sourceMappingURL=selectors.d.ts.map