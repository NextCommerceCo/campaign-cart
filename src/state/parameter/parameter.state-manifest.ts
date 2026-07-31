import { defineStore } from '@/core/docs/state-manifest';

export default defineStore({
  id: 'parameter',
  storeHook: 'useParameterStore',
  stateInterface: 'ParameterState',
  interfaceFile: 'state/parameter/parameter.state.ts',
  summary:
    'Holds the query-string parameters the visitor arrived with, kept for the whole session so a later page can still react to them — show a returning-visitor variant, skip a timer, hide a banner — after they have gone from the address bar.',

  persistence: {
    mechanism: 'zustand-persist',
    key: 'next-url-params',
    newFieldRule:
      'a new field is persisted automatically — this store has no `partialize`, so the whole state is written to sessionStorage. That also means a field meant to be runtime-only comes back on reload unless it is reset explicitly.',
  },

  fields: [
    {
      name: 'params',
      kind: 'persisted',
      description:
        'Every query-string key seen this session, as a flat `key → value` map of strings. The SDK captures the current URL during boot and merges it over what is already stored, so the newest value for a key wins and a key from an earlier page of the funnel survives on later pages that no longer carry it. **Whatever the link carried lands here**: a campaign link built with `?email=` or `?first_name=` puts personal data into this map and into sessionStorage, and `preserveQueryParams()` copies it onto outbound navigation URLs.',
      notes:
        'Values are always strings, never numbers or booleans — `?seen=0` is stored as `"0"`, which is truthy, so `if (next.getParam("seen"))` fires on a URL that meant "not seen". Compare against the string.',
    },
  ],

  setters: [
    {
      name: 'next.setParam(key, value)',
      effect:
        'Adds or replaces one parameter, leaving the rest in place. Subscribers such as conditional-display blocks re-evaluate.',
    },
    {
      name: 'next.setParams(params)',
      effect:
        'Replaces the whole map. Anything captured from the URL and not present in the object passed is dropped.',
    },
    {
      name: 'next.mergeParams(params)',
      effect:
        'Merges an object over the stored map — the additive counterpart to `setParams`.',
    },
    {
      name: 'next.clearParam(key)',
      effect:
        'Removes one parameter. This is how a page retires a one-shot flag such as `?seen=1` so it stops affecting later pages.',
    },
    {
      name: 'next.clearAllParams()',
      effect: 'Empties the map for the rest of the session.',
    },
    {
      name: 'debug()',
      effect:
        'Prints the stored parameters, the live query string, and the differences between them — the fastest way to see that a value is stored but no longer in the URL.',
    },
  ],

  selectors: [
    {
      name: 'next.getParam(key)',
      effect:
        'The value for a key, or `null` when it has not been seen this session. The store method behind it returns `undefined` instead of `null` — the public method normalises that.',
    },
    {
      name: 'next.getAllParams()',
      effect:
        'The whole map. It is returned by reference, not copied, so mutating the result edits state without notifying subscribers — spread it (`{ ...next.getAllParams() }`) before changing anything.',
    },
    {
      name: 'next.hasParam(key)',
      effect:
        'Whether the key is present at all. A key with an empty value (`?seen=`) counts as present, so this answers "was it in the URL", not "does it have a value".',
    },
  ],

  example: `{
  "params": {
    "utm_source": "facebook",
    "utm_medium": "paid-social",
    "utm_campaign": "summer-skin-prospecting",
    "affid": "aff_4417",
    "sub1": "adset_9912",
    "seen": "1",
    "timer": "0",
    "currency": "EUR",
    "debug": "true"
  }
}`,

  cautions: [
    '**Parameters are readable only after the SDK has processed the URL.** Anything that reads them earlier — an enhancer constructor, a `DOMContentLoaded` handler, an inline script above the SDK — sees an empty map, so `next.getParam("seen")` returns `null` and a `param.` condition evaluates false, which flashes a block that was meant to stay hidden. Wait for `sdk:url-parameters-processed` (`next.on("sdk:url-parameters-processed", handler)`) or subscribe to the store and re-read on change.',
    '**The store is not a mirror of the address bar.** Captured keys stay for the whole session, so `?seen=1` from two pages back still hides content on a clean URL and looks like a broken page. Retire one-shot flags with `next.clearParam("seen")`, and read `window.location.search` directly when the live URL is what you actually need.',
    '**Everything stored is copied onto outbound links.** `preserveQueryParams()` defaults to `"all"`, so every captured key — including anything personal a link carried, such as `?email=` — is appended to checkout and upsell URLs and lands in that page’s sessionStorage too. Keep personal data out of campaign links, or `clearParam()` it before navigating.',
    '**Values are strings and presence is not truthiness.** `"0"` and `""` are both truthy as strings, and `hasParam()` is true for a key with no value, so a guard written as `if (next.getParam("timer"))` runs the timer on `?timer=0`. Compare explicitly (`next.getParam("timer") === "1"`).',
    '**Persistence is not filtered and the key is permanent.** With no `partialize` the whole state is written to `next-url-params`; renaming that key drops every parameter for sessions already in flight, so visitors mid-funnel lose the variant they were shown. Add fields; never rename the key.',
  ],
});
