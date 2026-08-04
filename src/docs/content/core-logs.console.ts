import type { CoreConsoleLog } from './core-logs.types';

/**
 * Every `console.error` / `console.warn` in `src/core` outside `debug/` and `logger.ts`.
 *
 * Checked from both ends by `coreLogs.test.ts`: each anchor must still be in its file,
 * and every such call site must be claimed here.
 */
export const CORE_CONSOLE_LOGS: CoreConsoleLog[] = [
  // ── attribution/attribution-collector.ts ───────────────────────────────────
  // Nine storage failures, each losing one attribution value. All write the
  // `[AttributionCollector]` prefix into the string by hand rather than using a logger.
  {
    file: 'attribution/attribution-collector.ts',
    level: 'error',
    anchor: 'Error storing ${key} in sessionStorage:',
    message: '[AttributionCollector] Error storing {key} in sessionStorage:',
    hasContext: true,
    meaning:
      'An attribution value arrived in the URL but could not be saved for the rest of the session, so the next page will not have it and the order may be attributed to nothing. The value named is the URL parameter.',
    action:
      'Read the attached error — sessionStorage blocked or full is the cause. On paid traffic, check whether orders from this session carry their UTM tags before spending more on the campaign.',
  },
  {
    file: 'attribution/attribution-collector.ts',
    level: 'error',
    anchor: 'Error reading ${key} from sessionStorage:',
    message: '[AttributionCollector] Error reading {key} from sessionStorage:',
    hasContext: true,
    meaning:
      'A stored attribution value could not be read back. The collector falls through to localStorage and then to the persisted attribution copy, so the value may still be found — this line alone does not mean it was lost.',
    action:
      'Read the attached error. Confirm the final result with `next.getAttribution()` rather than assuming from this line.',
  },
  {
    file: 'attribution/attribution-collector.ts',
    level: 'error',
    anchor: 'Error reading ${key} from localStorage:',
    message: '[AttributionCollector] Error reading {key} from localStorage:',
    hasContext: true,
    meaning:
      'The localStorage fallback for one attribution value failed. One more fallback remains (the persisted attribution record), after which the value is empty.',
    action:
      'Read the attached error. Check `next.getAttribution()` for the field named to see whether anything was recovered.',
  },
  {
    file: 'attribution/attribution-collector.ts',
    level: 'error',
    anchor: 'Error reading persisted attribution:',
    message: '[AttributionCollector] Error reading persisted attribution:',
    hasContext: true,
    meaning:
      'The stored `next-attribution` record could not be read or parsed, so the last fallback for every attribution value is unavailable. Values not in the current URL are lost.',
    action:
      'Read the attached error. If the record is corrupt it keeps failing on every page; clearing `next-attribution` from storage resets it, at the cost of the visitor’s earlier attribution.',
  },
  {
    file: 'attribution/attribution-collector.ts',
    level: 'error',
    anchor: 'Error persisting funnel from URL:',
    message: '[AttributionCollector] Error persisting funnel from URL:',
    hasContext: true,
    meaning:
      'A funnel name taken from the URL could not be saved, so later pages in the funnel will fall back to their own meta tag or to no funnel at all. Funnel reporting splits one journey into several.',
    action:
      'Read the attached error. Until it is fixed, set the funnel name with a meta tag on every page rather than relying on it carrying over from the URL.',
  },
  {
    file: 'attribution/attribution-collector.ts',
    level: 'error',
    anchor: 'Error reading persisted funnel:',
    message: '[AttributionCollector] Error reading persisted funnel:',
    hasContext: true,
    meaning:
      'The saved funnel name could not be read, so this page uses whatever its own configuration says — which on an upsell or receipt page is often nothing.',
    action:
      'Read the attached error, then check the funnel on the resulting order. `next.debugAttribution()` prints what the SDK resolved.',
  },
  {
    file: 'attribution/attribution-collector.ts',
    level: 'error',
    anchor: 'Error persisting funnel name:',
    message: '[AttributionCollector] Error persisting funnel name:',
    hasContext: true,
    meaning:
      'A funnel name read from a meta tag could not be saved for later pages. Same effect as the URL version: the funnel does not follow the visitor.',
    action:
      'Read the attached error. Put the funnel meta tag on every page of the funnel so each one can resolve it without storage.',
  },
  {
    file: 'attribution/attribution-collector.ts',
    level: 'error',
    anchor: 'Error persisting tag ${tagName}:',
    message: '[AttributionCollector] Error persisting tag {tagName}:',
    hasContext: true,
    meaning:
      'One tracking tag from a `<meta>` tag could not be saved, so it will be missing from later pages and from the order. The tag named is the one lost.',
    action:
      'Read the attached error. Repeat the tag’s meta tag on the pages that need it rather than depending on it persisting.',
  },
  {
    file: 'attribution/attribution-collector.ts',
    level: 'error',
    anchor: 'Error reading first visit timestamp:',
    message: '[AttributionCollector] Error reading first visit timestamp:',
    hasContext: true,
    meaning:
      'The first-visit timestamp could not be read, so this visit is treated as a first visit. Anything that distinguishes new from returning visitors will say "new".',
    action:
      'Read the attached error. Do not build returning-visitor logic on this field while it is failing — write your own marker instead.',
  },

  // ── events.ts ──────────────────────────────────────────────────────────────
  {
    file: 'events.ts',
    level: 'error',
    anchor: 'Event handler error for ',
    message: 'Event handler error for {event}:',
    hasContext: true,
    meaning:
      'A subscriber to an SDK event threw. The event bus catches it and continues with the other subscribers, so one broken handler cannot stop the rest. The line has **no** `[Prefix]`, because it is written with a bare `console.error` — that absence is how you recognise it.',
    action:
      'Read the attached error and the event name. Your own `next.on(...)` handlers arrive here too, so check the stack before assuming the SDK is at fault. Wrap risky handler bodies in their own try/catch so a failure is reported where you can see it.',
  },

  // ── storage.ts ─────────────────────────────────────────────────────────────
  {
    file: 'storage.ts',
    level: 'warn',
    anchor: 'Failed to estimate storage quota:',
    message: 'Failed to estimate storage quota:',
    hasContext: true,
    meaning:
      'The browser would not report how much storage is available. Nothing depends on the answer — it is used for diagnostics — so this affects no behaviour.',
    action:
      'Nothing. Some browsers do not implement the estimate at all, and the SDK works either way.',
  },

  // ── sdk-initializer.debug-utils.ts ────────────────────────────────────────
  {
    file: 'sdk-initializer/sdk-initializer.debug-utils.ts',
    level: 'error',
    anchor: 'Failed to set shipping method ${methodId}:',
    message: '❌ Failed to set shipping method {methodId}:',
    hasContext: true,
    meaning:
      'The `testShippingMethod()` debug helper could not apply a shipping method. It only appears when someone calls that helper from the console, never on its own.',
    action:
      'Read the attached error and check the method id against the campaign’s `shipping_methods`. Debug-only; a visitor never triggers it.',
  },

  // ── url-utils.ts ───────────────────────────────────────────────────────────
  {
    file: 'url-utils.ts',
    level: 'error',
    anchor: '[URL Utils] Error preserving query parameters:',
    message: '[URL Utils] Error preserving query parameters:',
    hasContext: true,
    meaning:
      'A target URL could not be parsed, so the visitor is sent there with none of the tracking parameters carried over. Navigation still happens — the original URL is used unchanged — but the next page starts with no UTM tags, so an order placed after it can be attributed to nothing.',
    action:
      'Read the attached error and check the URL that was passed — a relative path with a stray space or an unencoded template placeholder left in the markup is the usual cause. On paid traffic, confirm the destination page still receives its parameters before spending more on the campaign.',
  },
];
