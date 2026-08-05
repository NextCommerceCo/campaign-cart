import type { CoreLogSource } from './core-logs.types';

/**
 * One subsystem of `src/core` per console prefix it logs under. See
 * {@link CoreLogSource} for what each field means.
 */
export const CORE_LOG_SOURCES: CoreLogSource[] = [
  // ── Boot and wiring ────────────────────────────────────────────────────────
  // Several entries below share the `SDKInitializer` prefix, because the boot
  // sequence is split across files that all print under the logger the class
  // owns. The healthy-boot check in `src/tests/docs/coreLogs.test.ts` used to
  // build its lookup as `new Map(CORE_LOG_SOURCES.map(s => [s.prefix, …]))`,
  // which silently kept only the last-declared file per prefix — so the order
  // of these entries decided what the check could see, and two clean splits of
  // `sdk-initializer.ts` (location/currency detection, attribution capture)
  // were abandoned to work around it (finding #155). That lookup now
  // accumulates across every file sharing a prefix, so declaration order here
  // carries no meaning beyond readability.
  {
    prefix: 'SDKInitializer',
    file: 'sdk-initializer/sdk-initializer.location-currency.ts',
    area: 'Boot and wiring',
    what: 'Detects the visitor\'s country and picks the display currency, before campaign prices are fetched so they arrive in the right currency. Runs as its own boot step, right after configuration loads.',
    dynamicPrefix: true,
    prefixFrom: 'sdk-initializer/sdk-initializer.ts',
    prefixNote: 'A free function, not a class with its own logger. `SDKInitializer` builds one `Logger(\'SDKInitializer\')` in `sdk-initializer.ts` and passes it in through a `{ logger }` context, so every line here prints under `[SDKInitializer]`.',
  },
  {
    prefix: 'SDKInitializer',
    file: 'sdk-initializer/sdk-initializer.attribution.ts',
    area: 'Boot and wiring',
    what: 'Captures where the visitor came from — funnel name, UTM transfer, conversion timestamp, landing page — and keeps the attribution event listeners idempotent across a boot retry or `reinitialize()`. Runs as its own boot step, right after location/currency detection.',
    dynamicPrefix: true,
    prefixFrom: 'sdk-initializer/sdk-initializer.ts',
    prefixNote: 'A free function, not a class with its own logger. `SDKInitializer` builds one `Logger(\'SDKInitializer\')` in `sdk-initializer.ts` and passes it in through a `{ logger }` context, so every line here prints under `[SDKInitializer]`.',
  },
  {
    prefix: 'SDKInitializer',
    file: 'sdk-initializer/sdk-initializer.url-params.ts',
    area: 'Boot and wiring',
    what: 'The `forcePackageId` / `forceShippingId` URL overrides and the session\'s captured URL parameters, applied once configuration and campaign data are loaded.',
    dynamicPrefix: true,
    prefixFrom: 'sdk-initializer/sdk-initializer.ts',
    prefixNote: 'A free function, not a class with its own logger. `SDKInitializer` builds one `Logger(\'SDKInitializer\')` in `sdk-initializer.ts` and passes it in through a `{ logger }` context, so every line here prints under `[SDKInitializer]`.',
  },
  {
    prefix: 'SDKInitializer',
    file: 'sdk-initializer/sdk-initializer.storage-reset.ts',
    area: 'Boot and wiring',
    what: 'Clears the SDK\'s own sessionStorage, localStorage, and cookies when the page carries `?reset=true`, for a clean-slate reload.',
    dynamicPrefix: true,
    prefixFrom: 'sdk-initializer/sdk-initializer.ts',
    prefixNote: 'A free function, not a class with its own logger. `SDKInitializer` builds one `Logger(\'SDKInitializer\')` in `sdk-initializer.ts` and passes it in through a `{ logger }` context, so every line here prints under `[SDKInitializer]`.',
  },
  {
    prefix: 'SDKInitializer',
    file: 'sdk-initializer/sdk-initializer.debug-utils.ts',
    area: 'Boot and wiring',
    what: 'Builds `window.nextDebug` — the console surface for inspecting and driving the stores, the cart, campaign, attribution, and analytics from devtools.',
    dynamicPrefix: true,
    prefixFrom: 'sdk-initializer/sdk-initializer.ts',
    prefixNote: 'A free function, not a class with its own logger. `SDKInitializer` builds one `Logger(\'SDKInitializer\')` in `sdk-initializer.ts` and passes it in through a `{ logger }` context, so every line here prints under `[SDKInitializer]`.',
  },
  {
    prefix: 'SDKInitializer',
    file: 'sdk-initializer/sdk-initializer.ts',
    area: 'Boot and wiring',
    what: 'Starts the SDK: reads configuration, delegates to location/currency detection and attribution capture, loads the campaign, applies URL parameters such as `forcePackageId`, then hands over to the DOM scan. Most "the page did nothing" investigations start here.',
  },
  {
    prefix: 'AttributeScanner',
    file: 'attribute-scanner/attribute-scanner.ts',
    area: 'Boot and wiring',
    what: 'Finds every `data-next-*` element on the page and starts the feature bound to it. If a feature never runs, this is where its element was either skipped or failed to initialize.',
  },
  {
    prefix: 'NextCommerce',
    file: 'next-commerce/next-commerce.analytics.ts',
    area: 'Boot and wiring',
    what: 'Part of the `window.next` API — the analytics calls a page makes by hand — tracking a view, a sign-up, or a custom event through the SDK rather than the provider.',
    dynamicPrefix: true,
    prefixFrom: 'next-commerce/next-commerce.ts',
    prefixNote: 'A free function, not a class with its own logger. `NextCommerce` builds one `Logger(\'NextCommerce\')` in `next-commerce.ts` and passes it in, so every line here prints under `[NextCommerce]`.',
  },
  {
    prefix: 'NextCommerce',
    file: 'next-commerce/next-commerce.attribution.ts',
    area: 'Boot and wiring',
    what: 'Part of the `window.next` API — metadata and attribution a page sets on itself, which every later order carries.',
    dynamicPrefix: true,
    prefixFrom: 'next-commerce/next-commerce.ts',
    prefixNote: 'A free function, not a class with its own logger. `NextCommerce` builds one `Logger(\'NextCommerce\')` in `next-commerce.ts` and passes it in, so every line here prints under `[NextCommerce]`.',
  },
  {
    prefix: 'NextCommerce',
    file: 'next-commerce/next-commerce.cart.ts',
    area: 'Boot and wiring',
    what: 'Part of the `window.next` API — the cart operations a page drives directly — adding, swapping, clearing.',
    dynamicPrefix: true,
    prefixFrom: 'next-commerce/next-commerce.ts',
    prefixNote: 'A free function, not a class with its own logger. `NextCommerce` builds one `Logger(\'NextCommerce\')` in `next-commerce.ts` and passes it in, so every line here prints under `[NextCommerce]`.',
  },
  {
    prefix: 'NextCommerce',
    file: 'next-commerce/next-commerce.events.ts',
    area: 'Boot and wiring',
    what: 'Part of the `window.next` API — the callbacks a page registers through `next.on…`, and the SDK calling them back.',
    dynamicPrefix: true,
    prefixFrom: 'next-commerce/next-commerce.ts',
    prefixNote: 'A free function, not a class with its own logger. `NextCommerce` builds one `Logger(\'NextCommerce\')` in `next-commerce.ts` and passes it in, so every line here prints under `[NextCommerce]`.',
  },
  {
    prefix: 'NextCommerce',
    file: 'next-commerce/next-commerce.popups.ts',
    area: 'Boot and wiring',
    what: 'Part of the `window.next` API — exit-intent and FOMO popups a page turns on or off from JavaScript.',
    dynamicPrefix: true,
    prefixFrom: 'next-commerce/next-commerce.ts',
    prefixNote: 'A free function, not a class with its own logger. `NextCommerce` builds one `Logger(\'NextCommerce\')` in `next-commerce.ts` and passes it in, so every line here prints under `[NextCommerce]`.',
  },
  {
    prefix: 'NextCommerce',
    file: 'next-commerce/next-commerce.upsells.ts',
    area: 'Boot and wiring',
    what: 'Part of the `window.next` API — post-purchase upsells accepted from JavaScript rather than from markup.',
    dynamicPrefix: true,
    prefixFrom: 'next-commerce/next-commerce.ts',
    prefixNote: 'A free function, not a class with its own logger. `NextCommerce` builds one `Logger(\'NextCommerce\')` in `next-commerce.ts` and passes it in, so every line here prints under `[NextCommerce]`.',
  },
  {
    prefix: 'NextCommerce',
    file: 'next-commerce/next-commerce.url-params.ts',
    area: 'Boot and wiring',
    what: 'Part of the `window.next` API — the URL parameters a page reads or applies through the API.',
    dynamicPrefix: true,
    prefixFrom: 'next-commerce/next-commerce.ts',
    prefixNote: 'A free function, not a class with its own logger. `NextCommerce` builds one `Logger(\'NextCommerce\')` in `next-commerce.ts` and passes it in, so every line here prints under `[NextCommerce]`.',
  },
  {
    prefix: 'ErrorHandler',
    file: 'monitoring/error-handler.ts',
    area: 'Boot and wiring',
    what: 'Catches uncaught page errors and rejected promises, wraps them with SDK version and URL, and re-publishes them as the `error:occurred` event.',
  },
  {
    prefix: 'StorageManager',
    file: 'storage.ts',
    area: 'Boot and wiring',
    what: 'The thin wrapper the SDK uses for its own sessionStorage and localStorage reads and writes. Its errors are storage being unavailable, not data being wrong.',
  },

  // ── Shared base ────────────────────────────────────────────────────────────
  {
    prefix: '{EnhancerClassName}',
    file: 'base/base-enhancer.ts',
    area: 'Shared base',
    dynamicPrefix: true,
    prefixNote:
      'The base class every feature extends builds its logger from the subclass name, so this line appears under the feature’s own prefix — `[AddToCartEnhancer]`, `[TimerEnhancer]`, and so on.',
    what: 'The behaviour every feature inherits: reading attributes, subscribing to stores, and the shared error path that turns a thrown error into a log line plus an `error:occurred` event.',
  },
  {
    prefix: 'DOMObserver',
    file: 'base/dom-observer.ts',
    area: 'Shared base',
    what: 'Watches the page for elements added or attributes changed after boot, so markup injected by a page builder or an A/B tool still gets enhanced.',
  },
  {
    prefix: 'AttributeParser',
    file: 'base/attribute-parser.ts',
    area: 'Shared base',
    what: 'Turns attribute text into something the features can act on — including the comparison expressions behind `data-next-show` and `data-next-hide`.',
  },
  {
    prefix: '{DisplayEnhancerClassName}',
    file: 'base/base-display-enhancer.ts',
    area: 'Shared base',
    dynamicPrefix: true,
    prefixNote:
      'Like `base-enhancer.ts`, the logger is built from the subclass name, so the line appears under whichever display feature you are looking at — `[ProductDisplayEnhancer]`, `[CartSummaryEnhancer]`, and so on.',
    what: 'Everything behind a `data-next-display` binding: resolving the namespaced path to a value, formatting it, and re-rendering when the value or the currency changes. Four `features/cart/**` display files extend it as well as the display features, which is why it is a base class here rather than a file in the display folder.',
  },
  {
    prefix: 'DisplayErrorBoundary',
    file: 'base/display-error-boundary.ts',
    area: 'Shared base',
    what: 'Contains a failure inside one display binding so it cannot blank out the rest of the page. A line here means one element gave up, not that the SDK stopped — which is exactly the distinction to establish first when "some prices are missing".',
  },
  {
    prefix: 'TemplateRenderer',
    file: 'rendering/template-renderer.ts',
    area: 'Shared base',
    what: 'Renders the `data-next-*` placeholder templates that cart, package, and order item rows are built from. A line here means one field in one row could not be formatted — the row still renders, with that field blank.',
  },
  {
    prefix: 'DisplayValueValidator',
    file: 'base/display-value-validator.ts',
    area: 'Shared base',
    what: 'Coerces a resolved value into the shape its format needs — a price to a 2-decimal number, a date string to a `Date`. Every line here means a value was replaced by a fallback, so the element rendered something plausible instead of the truth. These are the quietest wrong-number bugs in the SDK.',
  },

  // ── Location and currency ──────────────────────────────────────────────────
  {
    prefix: 'CountryService',
    file: 'country-service/country-service.postal-code.ts',
    area: 'Location and currency',
    what: 'Validates and formats a postal code against a country’s rules, and holds the built-in per-country defaults used when the CDN has none for a country.',
    dynamicPrefix: true,
    prefixFrom: 'country-service/country-service.ts',
    prefixNote: 'A free function, not a class with its own logger. `CountryService` builds one `Logger(\'CountryService\')` in `country-service.ts` and passes it in as a parameter, so every line here prints under `[CountryService]`.',
  },
  {
    prefix: 'CountryService',
    file: 'country-service/country-service.filtering.ts',
    area: 'Location and currency',
    what: 'Filters the country and state lists to what the campaign actually ships to, and picks a fallback country when the visitor’s detected one is not on that list.',
    dynamicPrefix: true,
    prefixFrom: 'country-service/country-service.ts',
    prefixNote: 'A free function, not a class with its own logger. `CountryService` builds one `Logger(\'CountryService\')` in `country-service.ts` and passes it in through a `{ campaignShippingCountries, config, logger }` context, so every line here prints under `[CountryService]`.',
  },
  {
    prefix: 'CountryService',
    file: 'country-service/country-service.ts',
    area: 'Location and currency',
    what: 'Detects the visitor’s country, fetches and caches the country and state lists for the address form, and delegates postal-code rules and shipping-country filtering to its sibling modules.',
  },

  // ── Attribution ────────────────────────────────────────────────────────────
  {
    prefix: 'AttributionCollector',
    file: 'attribution/attribution-collector.ts',
    area: 'Attribution',
    what: 'Collects where the visitor came from — funnel name, UTM tags, Everflow click id, tracking-tag meta tags — and keeps it for the order.',
  },
  {
    prefix: 'UtmTransfer',
    file: 'attribution/utm-transfer.ts',
    area: 'Attribution',
    what: 'Copies the current page’s URL parameters onto the links leaving it, so attribution survives a click through to the next page.',
  },

  // ── Analytics core ─────────────────────────────────────────────────────────
  {
    prefix: 'NextAnalytics',
    file: 'analytics/index.ts',
    area: 'Analytics core',
    what: 'The analytics entry point: reads configuration, builds the enabled providers, and accepts every event the rest of the SDK tracks.',
  },
  {
    prefix: 'NextDataLayer',
    file: 'analytics/data-layer-manager.ts',
    area: 'Analytics core',
    what: 'Pushes finished events onto `window.dataLayer` and fans them out to the providers, adding attribution and validating required fields on the way.',
  },
  {
    prefix: 'AnalyticsConfig',
    file: 'analytics/config.ts',
    area: 'Analytics core',
    what: 'Holds the per-provider settings — which fields each provider needs before it can be switched on.',
  },
  {
    prefix: 'UserDataStorage',
    file: 'analytics/user-data-storage.ts',
    area: 'Analytics core',
    what: 'Remembers who the visitor is across pages — email, name, ids — in a cookie plus sessionStorage, so events after a redirect still identify them.',
  },
  {
    prefix: 'EventBuilder',
    file: 'analytics/events/event-builder.context.ts',
    area: 'Analytics',
    what: 'Session, page and campaign context attached to every analytics event.',
  },
  {
    prefix: 'EventBuilder',
    file: 'analytics/events/ecommerce-item-formatter.ts',
    area: 'Analytics',
    what: 'Turning a cart or order line into the item shape every provider expects — price, discount and currency resolution live here.',
  },
  {
    prefix: 'EventBuilder',
    file: 'analytics/events/elevar-legacy-formatter.ts',
    area: 'Analytics',
    what: 'The deprecated Elevar payload shape, kept for pages still reading it.',
  },
  {
    prefix: 'RudderStack',
    file: 'analytics/providers/rudderstack-properties.ts',
    area: 'Analytics',
    what: 'The per-event property builders the RudderStack adapter sends.',
  },
  {
    prefix: 'AutoEventListener',
    file: 'analytics/tracking/auto-event-cart-handlers.ts',
    area: 'Analytics',
    what: 'Cart events picked up from the event bus and pushed to the data layer.',
  },
  {
    prefix: 'AutoEventListener',
    file: 'analytics/tracking/auto-event-checkout-handlers.ts',
    area: 'Analytics',
    what: 'Checkout and order-completed events picked up from the event bus.',
  },
  {
    prefix: 'AutoEventListener',
    file: 'analytics/tracking/auto-event-upsell-handlers.ts',
    area: 'Analytics',
    what: 'Post-purchase upsell events picked up from the event bus.',
  },
  {
    prefix: 'AutoEventListener',
    file: 'analytics/tracking/auto-event-exit-intent-handlers.ts',
    area: 'Analytics',
    what: 'Exit-intent popup events picked up from the event bus.',
  },
  {
    prefix: 'EcommerceEvents',
    file: 'analytics/events/ecommerce-events.upsell.ts',
    area: 'Analytics core',
    what: 'Builds the purchase-funnel events — view item, add to cart, begin checkout, purchase, upsell. Split across `ecommerce-events.browse.ts` / `.cart.ts` / `.checkout.ts` / `.upsell.ts`; this one logs a warn when the campaign store cannot be read for an accepted-upsell item.',
  },
  {
    prefix: 'EcommerceEvents',
    file: 'analytics/events/ecommerce-events.checkout.ts',
    area: 'Analytics core',
    what: 'Builds `dl_begin_checkout` and `dl_purchase` from the order the API returned. Logs an error when an order payload carries no identifier to report as `transaction_id`, because that purchase is dropped rather than sent with a made-up id.',
  },
  {
    prefix: 'UserEvents',
    file: 'analytics/events/user-events.ts',
    area: 'Analytics core',
    what: 'Builds the `dl_user_data` event that identifies the visitor and carries the current cart contents.',
  },
  {
    prefix: 'EventValidator',
    file: 'analytics/validation/event-validator.ts',
    area: 'Analytics core',
    what: 'Checks an event against its schema in debug mode, so a missing or mistyped field is caught while you are looking rather than in a report a week later.',
  },

  // ── Analytics tracking ─────────────────────────────────────────────────────
  {
    prefix: 'AutoEventListener',
    file: 'analytics/tracking/auto-event-listener.ts',
    area: 'Analytics tracking',
    what: 'Turns the SDK’s own cart, upsell, and exit-intent events into analytics events, so a page gets tracking without writing any.',
  },
  {
    prefix: 'MetaTagController',
    file: 'analytics/tracking/meta-tag-controller.ts',
    area: 'Analytics tracking',
    what: 'Fires `view_item` / `view_item_list` and scroll-depth events from `<meta>` tags, including reading the package id out of a URL parameter and waiting for a time, an element, or a scroll threshold.',
  },
  {
    prefix: 'PendingEventsHandler',
    file: 'analytics/tracking/pending-events-handler.ts',
    area: 'Analytics tracking',
    what: 'Holds events that were raised as the page was navigating away, and replays them on the next page so a redirect does not lose a purchase.',
  },
  {
    prefix: 'PurchaseTracking',
    file: 'analytics/tracking/purchase-tracking.ts',
    area: 'Analytics tracking',
    what: 'Decides whether an order may be reported as a purchase yet — an order still awaiting payment at a gateway may not — and remembers the orders already reported so one order produces one `dl_purchase`.',
  },
  {
    prefix: 'UserDataTracker',
    file: 'analytics/tracking/user-data-tracker.ts',
    area: 'Analytics tracking',
    what: 'Fires `dl_user_data` first on every page and again when the visitor is identified or the route changes.',
  },
  {
    prefix: 'ViewItemListTracker',
    file: 'analytics/tracking/view-item-list-tracker.ts',
    area: 'Analytics tracking',
    what: 'Detects the products present on a page and fires `view_item` / `view_item_list` for them without any meta tags.',
  },
  {
    prefix: 'ListAttributionTracker',
    file: 'analytics/tracking/list-attribution-tracker.ts',
    area: 'Analytics tracking',
    what: 'Remembers which list a product was clicked from so the next page’s events can say where the visitor came from within the site.',
  },

  // ── Analytics providers ────────────────────────────────────────────────────
  {
    prefix: '{ProviderName}',
    file: 'analytics/providers/provider-adapter.ts',
    area: 'Analytics providers',
    dynamicPrefix: true,
    prefixNote:
      'The shared adapter base logs under the provider’s own name, so these lines appear as `[GTM]`, `[Facebook]`, `[RudderStack]`, `[NextCampaign]`, or `[Custom]` depending on which provider was delivering the event.',
    what: 'The delivery contract every provider shares: the enabled and blocked-event gate, and reporting each event as sent, skipped, or failed.',
  },
  {
    prefix: 'Facebook',
    file: 'analytics/providers/facebook-adapter.ts',
    area: 'Analytics providers',
    dynamicPrefix: true,
    prefixNote:
      "Set by the name the adapter passes to the shared base — `super('Facebook')`.",
    what: 'Delivers events to the Meta Pixel (`fbq`).',
  },
  {
    prefix: 'NextCampaign',
    file: 'analytics/providers/next-campaign-adapter.ts',
    area: 'Analytics providers',
    dynamicPrefix: true,
    prefixNote:
      "Set by the name the adapter passes to the shared base — `super('NextCampaign')`.",
    what: 'Loads the NextCampaign script with the campaign API key and sends it the page view.',
  },
  {
    prefix: 'RudderStack',
    file: 'analytics/providers/rudderstack-adapter.ts',
    area: 'Analytics providers',
    what: 'Translates events into RudderStack’s track / page / identify calls.',
  },
  {
    prefix: 'Custom',
    file: 'analytics/providers/custom-adapter.ts',
    area: 'Analytics providers',
    dynamicPrefix: true,
    prefixNote:
      "Set by the name the adapter passes to the shared base — `super('Custom')`.",
    what: 'Posts batches of events to an endpoint you configure, with a retry queue for the ones that fail.',
  },

  // ── Debug tools ────────────────────────────────────────────────────────────
  {
    prefix: 'DebugModule',
    file: 'debug/debug-module.ts',
    area: 'Debug tools',
    what: 'Loads the debug overlay on demand when debug mode is on, so none of it is in the bundle a normal visitor downloads.',
  },
  {
    prefix: 'DebugOverlay',
    file: 'debug/debug-overlay/debug-overlay.ts',
    area: 'Debug tools',
    what: 'The on-page debug panel itself — state inspectors, the event pipeline, and the country / currency / locale switchers.',
  },
  {
    prefix: 'CountrySelector',
    file: 'debug/country-selector.ts',
    area: 'Debug tools',
    what: 'The debug overlay’s country switcher, for checking an address form and shipping options as a visitor in another country.',
  },
  {
    prefix: 'CurrencySelector',
    file: 'debug/currency-selector.ts',
    area: 'Debug tools',
    what: 'The debug overlay’s currency switcher, for checking prices in every currency the campaign offers.',
  },
  {
    prefix: 'LocaleSelector',
    file: 'debug/locale-selector.ts',
    area: 'Debug tools',
    what: 'The debug overlay’s locale switcher, for checking how prices and dates are formatted.',
  },
  {
    prefix: 'UpsellSelector',
    file: 'debug/upsell-selector.ts',
    area: 'Debug tools',
    what: 'The debug overlay’s post-purchase upsell inspector: what the page offers and what is currently selected.',
  },
];
