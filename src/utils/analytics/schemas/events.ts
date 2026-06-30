// Canonical `dl_*` analytics event vocabulary — the SINGLE SOURCE OF TRUTH.
//
// Why this file exists
// --------------------
// The SDK fires/handles ~35 distinct `dl_*` dataLayer events, but their names
// historically lived scattered across `events/`, `tracking/AutoEventListener.ts`,
// and the provider adapters. Consumers that need the list — the Map Builder's
// blocked-events picker and the campaign-spec `AnalyticsContractShape` validator —
// were forced to hardcode their own copies, which drift. (A hardcoded
// `blockedEvents:['purchase']` was a silent no-op against the real `dl_purchase`.)
//
// This module is the one authoritative enumeration. `eventSchemas` in
// ./index.ts defines field-level validation for the subset that carries one
// (`hasSchema: true`); this file enumerates the FULL firable vocabulary, because
// `blockedEvents` matches by exact `event.event` name against EVERY event that
// passes through the DataLayerManager (see ProviderAdapter.shouldTrack) — so the
// blockable/known vocabulary is the superset, not just the schema'd events.
//
// Downstream (campaigns-os `campaign-spec/analytics-vocabulary.ts`) syncs from the
// generated `analytics-events.json` manifest emitted off this const. Keep this the
// edit point; add a new event here when the SDK starts firing one.

export type DlEventCategory =
  | 'ecommerce'
  | 'user'
  | 'upsell'
  | 'cart'
  | 'navigation'
  | 'engagement';

export interface DlEventDefinition {
  /** Exact dataLayer event name the SDK pushes — matched verbatim by `blockedEvents`. */
  name: string;
  /** Coarse grouping for picker UIs and docs. */
  category: DlEventCategory;
  /** True when ./index.ts `eventSchemas` defines field-level validation for it. */
  hasSchema: boolean;
  /** One-line human label for pickers and generated docs. */
  description: string;
}

/**
 * The canonical vocabulary. Order is category-grouped for readable pickers.
 * `as const` makes {@link DlEventName} a precise literal union; `satisfies`
 * enforces the shape without widening the literals.
 */
export const DL_EVENTS = [
  // — ecommerce (GA4 standard) —
  {
    name: 'dl_view_item_list',
    category: 'ecommerce',
    hasSchema: true,
    description: 'Product list / collection impression',
  },
  {
    name: 'dl_view_item',
    category: 'ecommerce',
    hasSchema: true,
    description: 'Product detail view',
  },
  {
    name: 'dl_select_item',
    category: 'ecommerce',
    hasSchema: true,
    description: 'Product clicked from a list',
  },
  {
    name: 'dl_view_search_results',
    category: 'ecommerce',
    hasSchema: true,
    description: 'Search results viewed',
  },
  {
    name: 'dl_search',
    category: 'ecommerce',
    hasSchema: false,
    description: 'Search performed (Meta Search)',
  },
  {
    name: 'dl_add_to_cart',
    category: 'ecommerce',
    hasSchema: true,
    description: 'Item added to cart',
  },
  {
    name: 'dl_remove_from_cart',
    category: 'ecommerce',
    hasSchema: true,
    description: 'Item removed from cart',
  },
  {
    name: 'dl_add_to_wishlist',
    category: 'ecommerce',
    hasSchema: false,
    description: 'Item added to wishlist',
  },
  {
    name: 'dl_view_cart',
    category: 'ecommerce',
    hasSchema: true,
    description: 'Cart viewed',
  },
  {
    name: 'dl_begin_checkout',
    category: 'ecommerce',
    hasSchema: true,
    description: 'Checkout started',
  },
  {
    name: 'dl_add_shipping_info',
    category: 'ecommerce',
    hasSchema: true,
    description: 'Shipping info added',
  },
  {
    name: 'dl_add_payment_info',
    category: 'ecommerce',
    hasSchema: true,
    description: 'Payment info added',
  },
  {
    name: 'dl_purchase',
    category: 'ecommerce',
    hasSchema: true,
    description: 'Main order purchase',
  },
  {
    name: 'dl_refund',
    category: 'ecommerce',
    hasSchema: false,
    description: 'Order refunded (adapter-mapped)',
  },
  {
    name: 'dl_view_promotion',
    category: 'ecommerce',
    hasSchema: false,
    description: 'Promotion impression',
  },
  {
    name: 'dl_select_promotion',
    category: 'ecommerce',
    hasSchema: false,
    description: 'Promotion clicked',
  },

  // — user / identity —
  {
    name: 'dl_user_data',
    category: 'user',
    hasSchema: true,
    description: 'User + cart context (fired first)',
  },
  {
    name: 'dl_sign_up',
    category: 'user',
    hasSchema: true,
    description: 'Account sign-up',
  },
  {
    name: 'dl_login',
    category: 'user',
    hasSchema: true,
    description: 'Account login',
  },
  {
    name: 'dl_subscribe',
    category: 'user',
    hasSchema: true,
    description: 'Subscription created',
  },
  {
    name: 'dl_start_trial',
    category: 'user',
    hasSchema: false,
    description: 'Trial started (Meta StartTrial)',
  },

  // — upsell (post-purchase) —
  {
    name: 'dl_viewed_upsell',
    category: 'upsell',
    hasSchema: true,
    description: 'Upsell offer viewed',
  },
  {
    name: 'dl_accepted_upsell',
    category: 'upsell',
    hasSchema: true,
    description: 'Upsell accepted',
  },
  {
    name: 'dl_skipped_upsell',
    category: 'upsell',
    hasSchema: true,
    description: 'Upsell skipped',
  },
  {
    name: 'dl_upsell_purchase',
    category: 'upsell',
    hasSchema: true,
    description: 'Accepted upsell in GA4 purchase format',
  },

  // — cart lifecycle —
  {
    name: 'dl_cart_updated',
    category: 'cart',
    hasSchema: false,
    description: 'Cart contents changed',
  },
  {
    name: 'dl_package_swapped',
    category: 'cart',
    hasSchema: false,
    description: 'Selected package swapped',
  },

  // — navigation —
  {
    name: 'dl_page_view',
    category: 'navigation',
    hasSchema: false,
    description: 'Page view (SPA-aware)',
  },
  {
    name: 'dl_route_changed',
    category: 'navigation',
    hasSchema: false,
    description: 'Client-side route change',
  },

  // — engagement / behavior —
  {
    name: 'dl_scroll_depth',
    category: 'engagement',
    hasSchema: false,
    description: 'Scroll-depth milestone',
  },
  {
    name: 'dl_exit_intent_shown',
    category: 'engagement',
    hasSchema: false,
    description: 'Exit-intent popup shown',
  },
  {
    name: 'dl_exit_intent_accepted',
    category: 'engagement',
    hasSchema: false,
    description: 'Exit-intent offer accepted',
  },
  {
    name: 'dl_exit_intent_dismissed',
    category: 'engagement',
    hasSchema: false,
    description: 'Exit-intent popup dismissed',
  },
  {
    name: 'dl_exit_intent_closed',
    category: 'engagement',
    hasSchema: false,
    description: 'Exit-intent popup closed',
  },
  {
    name: 'dl_exit_intent_action',
    category: 'engagement',
    hasSchema: false,
    description: 'Exit-intent custom action',
  },
] as const satisfies readonly DlEventDefinition[];

/** Precise literal union of every canonical event name. */
export type DlEventName = (typeof DL_EVENTS)[number]['name'];

/** Flat list of canonical event names — what pickers and validators iterate. */
export const DL_EVENT_NAMES: readonly DlEventName[] = DL_EVENTS.map(
  e => e.name
);

/** O(1) membership set for validation. */
export const DL_EVENT_NAME_SET: ReadonlySet<string> = new Set(DL_EVENT_NAMES);

/** True when `name` is a known canonical `dl_*` event. */
export function isKnownDlEvent(name: string): name is DlEventName {
  return DL_EVENT_NAME_SET.has(name);
}
