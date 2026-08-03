import type { CoreUnreadableLog } from './core-logs.types';

/**
 * `error`/`warn` messages the extractor cannot read as a literal — assembled from
 * concatenated string pieces, or forwarded through a private logging helper. See
 * {@link CoreUnreadableLog} for the shape and why these are declared by hand.
 */
export const CORE_UNREADABLE_LOGS: CoreUnreadableLog[] = [
  // ── analytics/index.ts — message assembled from several string literals ────
  {
    file: 'analytics/index.ts',
    level: 'warn',
    anchor: 'No campaign apiKey configured',
    message:
      'No campaign apiKey configured — analytics events will lack campaign identifiers. Set <meta name="next-api-key" content="..."> or window.nextConfig.apiKey.',
    meaning:
      'Analytics started without a campaign API key, so no event can carry campaign id, name, currency, or language. Events still arrive; they cannot be grouped by campaign.',
    action:
      'Add the key before the loader script — `<meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">` or `window.nextConfig.apiKey`. Without it the campaign never loads, so this warning usually comes with a page full of placeholder prices.',
  },
  {
    file: 'analytics/index.ts',
    level: 'warn',
    anchor: 'is missing — set it to enable',
    message:
      'Provider "{key}" is enabled but {required} is missing — set it to enable {key}; skipping.',
    meaning:
      'A provider is switched on in configuration but one setting it cannot start without is absent, so it is skipped. Events go to the other providers only, and that destination reports nothing.',
    action:
      'Set the setting named in the message, or turn the provider off so the gap in its reporting is deliberate rather than a surprise.',
  },
  {
    file: 'analytics/index.ts',
    level: 'warn',
    anchor: 'its preconditions are not met; skipping.',
    message:
      'Provider "{key}" is enabled but its preconditions are not met; skipping.',
    meaning:
      'A provider is switched on but its own start-up check said no, and it lists no single required setting to name. It is skipped and receives no events.',
    action:
      'Check that provider’s configuration block as a whole. `?debug=true` shows the providers that did start, which is the quickest way to confirm which one is missing.',
  },

  // ── Provider adapters — one-off "the snippet is missing" warnings ──────────
  {
    file: 'analytics/providers/facebook-adapter.ts',
    level: 'warn',
    anchor: 'Meta Pixel (fbq) not found',
    message:
      'Meta Pixel (fbq) not found — add the Meta Pixel base code to the page so events can be delivered. See https://www.facebook.com/business/help/952192354843755',
    meaning:
      'The Facebook provider is running but `fbq` is not on the page, so nothing can be delivered to Meta. Printed once per page load, not once per event.',
    action:
      'Add the Meta Pixel base code above the SDK loader. If it is already there, an ad blocker removed it — verify in a clean browser profile before changing the page.',
  },
  {
    file: 'analytics/providers/next-campaign-adapter.ts',
    level: 'warn',
    anchor: 'NextCampaign SDK failed to load',
    message:
      'NextCampaign SDK failed to load — check that a valid apiKey is set and that campaigns.apps.29next.com is reachable.',
    meaning:
      'The NextCampaign script never became available, so its events cannot be delivered. Printed once per page load.',
    action:
      'Confirm the campaign API key is set and that `campaigns.apps.29next.com` is reachable from the visitor’s network.',
  },
  {
    file: 'analytics/providers/rudderstack-adapter.ts',
    level: 'warn',
    anchor: 'rudderanalytics not found',
    message:
      'rudderanalytics not found — add the RudderStack JavaScript SDK snippet to the page so events can be delivered. See https://www.rudderstack.com/docs/sources/event-streams/sdks/rudderstack-javascript-sdk/',
    meaning:
      'The RudderStack provider is running but its SDK is not on the page, so nothing is delivered. Printed once per page load.',
    action:
      'Add the RudderStack JavaScript SDK snippet above the SDK loader, then reload and check for `Processing event "…"` lines.',
  },

  // ── analytics/data-layer-manager.ts — forwarded through a private helper ─────
  // Every error here goes through `private error(message, …)`, so the `logger.error`
  // call site carries a variable and the wording lives at the caller.
  {
    file: 'analytics/data-layer-manager.ts',
    level: 'error',
    anchor: 'Error pushing event to data layer',
    message: 'Error pushing event to data layer',
    forwarded: true,
    hasContext: true,
    meaning:
      'An event could not be pushed to `window.dataLayer`, so nothing downstream — GTM included — sees it. The event is lost, not retried.',
    action:
      'Read the attached error and data. Note that these `NextDataLayer` errors print only when `debug.logErrors` is on, so an apparently silent console does not mean nothing failed.',
  },
  {
    file: 'analytics/data-layer-manager.ts',
    level: 'error',
    anchor: 'Failed to save user properties',
    message: 'Failed to save user properties',
    forwarded: true,
    hasContext: true,
    meaning:
      'User properties could not be stored, so later events on this page load may go out without them.',
    action:
      'Read the attached error — storage being blocked is the usual cause.',
  },
  {
    file: 'analytics/data-layer-manager.ts',
    level: 'error',
    anchor: 'Failed to load user properties',
    message: 'Failed to load user properties',
    forwarded: true,
    hasContext: true,
    meaning:
      'Stored user properties could not be read back, so events start without them even though the visitor identified themselves earlier.',
    action:
      'Read the attached error. A corrupt stored value keeps failing until it is cleared.',
  },
  {
    file: 'analytics/data-layer-manager.ts',
    level: 'error',
    anchor: 'Missing required field: ',
    message: 'Missing required field: {field}',
    forwarded: true,
    hasContext: true,
    meaning:
      'An event reached the data layer without a field every event must have. It is still pushed, so the destination receives an incomplete event rather than none.',
    action:
      'The event is attached — find where it is built and set the named field. Fields required of every event are the shared ones (event name, id, timestamp), so this normally means an event was hand-built rather than made by `EventBuilder`.',
  },
  {
    file: 'analytics/data-layer-manager.ts',
    level: 'error',
    anchor: 'Missing required field for ',
    message: 'Missing required field for {event}: {field}',
    forwarded: true,
    hasContext: true,
    meaning:
      'An event is missing a field its own type requires — a purchase with no transaction id, for example. It is still pushed.',
    action:
      'Set the named field where that event is built. Destinations may accept the event and then report it as unattributed, which is harder to notice than a rejected event.',
  },
  {
    file: 'analytics/data-layer-manager.ts',
    level: 'error',
    anchor: 'Invalid type for field ',
    message:
      'Invalid type for field {field}: expected {expectedType}, got {typeof value}',
    forwarded: true,
    hasContext: true,
    meaning:
      'A field has the wrong type — most often a number sent as a string, or the reverse. The event is still pushed, and destinations that coerce silently will report a wrong value rather than an error.',
    action:
      'Convert the field at the point the event is built. Revenue fields are the ones to check first, since a string total can be dropped or read as zero.',
  },
  {
    file: 'analytics/data-layer-manager.ts',
    level: 'error',
    anchor: 'Error in provider ',
    message: 'Error in provider {name}',
    forwarded: true,
    hasContext: true,
    meaning:
      'One provider threw while handling an event. The others still receive it, so this is a gap in one destination rather than a lost event.',
    action:
      'Read the attached error and the provider named in the message; that adapter’s own errors are in [errors.md](./errors.md).',
  },
];
