export type DlEventCategory = 'ecommerce' | 'user' | 'upsell' | 'cart' | 'navigation' | 'engagement';
export interface DlEventDefinition {
    name: string;
    category: DlEventCategory;
    hasSchema: boolean;
    description: string;
}
export declare const DL_EVENTS: readonly [{
    readonly name: "dl_view_item_list";
    readonly category: "ecommerce";
    readonly hasSchema: true;
    readonly description: "Product list / collection impression";
}, {
    readonly name: "dl_view_item";
    readonly category: "ecommerce";
    readonly hasSchema: true;
    readonly description: "Product detail view";
}, {
    readonly name: "dl_select_item";
    readonly category: "ecommerce";
    readonly hasSchema: true;
    readonly description: "Product clicked from a list";
}, {
    readonly name: "dl_view_search_results";
    readonly category: "ecommerce";
    readonly hasSchema: true;
    readonly description: "Search results viewed";
}, {
    readonly name: "dl_search";
    readonly category: "ecommerce";
    readonly hasSchema: false;
    readonly description: "Search performed (Meta Search)";
}, {
    readonly name: "dl_add_to_cart";
    readonly category: "ecommerce";
    readonly hasSchema: true;
    readonly description: "Item added to cart";
}, {
    readonly name: "dl_remove_from_cart";
    readonly category: "ecommerce";
    readonly hasSchema: true;
    readonly description: "Item removed from cart";
}, {
    readonly name: "dl_add_to_wishlist";
    readonly category: "ecommerce";
    readonly hasSchema: false;
    readonly description: "Item added to wishlist";
}, {
    readonly name: "dl_view_cart";
    readonly category: "ecommerce";
    readonly hasSchema: true;
    readonly description: "Cart viewed";
}, {
    readonly name: "dl_begin_checkout";
    readonly category: "ecommerce";
    readonly hasSchema: true;
    readonly description: "Checkout started";
}, {
    readonly name: "dl_add_shipping_info";
    readonly category: "ecommerce";
    readonly hasSchema: true;
    readonly description: "Shipping info added";
}, {
    readonly name: "dl_add_payment_info";
    readonly category: "ecommerce";
    readonly hasSchema: true;
    readonly description: "Payment info added";
}, {
    readonly name: "dl_purchase";
    readonly category: "ecommerce";
    readonly hasSchema: true;
    readonly description: "Main order purchase";
}, {
    readonly name: "dl_refund";
    readonly category: "ecommerce";
    readonly hasSchema: false;
    readonly description: "Order refunded (adapter-mapped)";
}, {
    readonly name: "dl_view_promotion";
    readonly category: "ecommerce";
    readonly hasSchema: false;
    readonly description: "Promotion impression";
}, {
    readonly name: "dl_select_promotion";
    readonly category: "ecommerce";
    readonly hasSchema: false;
    readonly description: "Promotion clicked";
}, {
    readonly name: "dl_user_data";
    readonly category: "user";
    readonly hasSchema: true;
    readonly description: "User + cart context (fired first)";
}, {
    readonly name: "dl_sign_up";
    readonly category: "user";
    readonly hasSchema: true;
    readonly description: "Account sign-up";
}, {
    readonly name: "dl_login";
    readonly category: "user";
    readonly hasSchema: true;
    readonly description: "Account login";
}, {
    readonly name: "dl_subscribe";
    readonly category: "user";
    readonly hasSchema: true;
    readonly description: "Subscription created";
}, {
    readonly name: "dl_start_trial";
    readonly category: "user";
    readonly hasSchema: false;
    readonly description: "Trial started (Meta StartTrial)";
}, {
    readonly name: "dl_viewed_upsell";
    readonly category: "upsell";
    readonly hasSchema: true;
    readonly description: "Upsell offer viewed";
}, {
    readonly name: "dl_accepted_upsell";
    readonly category: "upsell";
    readonly hasSchema: true;
    readonly description: "Upsell accepted";
}, {
    readonly name: "dl_skipped_upsell";
    readonly category: "upsell";
    readonly hasSchema: true;
    readonly description: "Upsell skipped";
}, {
    readonly name: "dl_upsell_purchase";
    readonly category: "upsell";
    readonly hasSchema: true;
    readonly description: "Accepted upsell in GA4 purchase format";
}, {
    readonly name: "dl_cart_updated";
    readonly category: "cart";
    readonly hasSchema: false;
    readonly description: "Cart contents changed";
}, {
    readonly name: "dl_package_swapped";
    readonly category: "cart";
    readonly hasSchema: false;
    readonly description: "Selected package swapped";
}, {
    readonly name: "dl_page_view";
    readonly category: "navigation";
    readonly hasSchema: false;
    readonly description: "Page view (SPA-aware)";
}, {
    readonly name: "dl_route_changed";
    readonly category: "navigation";
    readonly hasSchema: false;
    readonly description: "Client-side route change";
}, {
    readonly name: "dl_scroll_depth";
    readonly category: "engagement";
    readonly hasSchema: false;
    readonly description: "Scroll-depth milestone";
}, {
    readonly name: "dl_exit_intent_shown";
    readonly category: "engagement";
    readonly hasSchema: false;
    readonly description: "Exit-intent popup shown";
}, {
    readonly name: "dl_exit_intent_accepted";
    readonly category: "engagement";
    readonly hasSchema: false;
    readonly description: "Exit-intent offer accepted";
}, {
    readonly name: "dl_exit_intent_dismissed";
    readonly category: "engagement";
    readonly hasSchema: false;
    readonly description: "Exit-intent popup dismissed";
}, {
    readonly name: "dl_exit_intent_closed";
    readonly category: "engagement";
    readonly hasSchema: false;
    readonly description: "Exit-intent popup closed";
}, {
    readonly name: "dl_exit_intent_action";
    readonly category: "engagement";
    readonly hasSchema: false;
    readonly description: "Exit-intent custom action";
}];
export type DlEventName = (typeof DL_EVENTS)[number]['name'];
export declare const DL_EVENT_NAMES: readonly DlEventName[];
export declare const DL_EVENT_NAME_SET: ReadonlySet<string>;
export declare function isKnownDlEvent(name: string): name is DlEventName;
//# sourceMappingURL=events.d.ts.map