import { defineStore } from '@/core/docs/state-manifest';

export default defineStore({
  id: 'campaign',
  storeHook: 'useCampaignStore',
  stateInterface: 'CampaignState',
  interfaceFile: 'state/campaign/campaign.types.ts',
  summary:
    'Holds the campaign the page is selling — its packages, their prices, the currency those prices are quoted in, and the shipping options a shopper can pick.',

  persistence: {
    mechanism: 'manual',
    key: 'next-campaign-cache_{currency}',
    expiry: '10 minutes from the moment the campaign was fetched',
    newFieldRule:
      'nothing about a new field is cached. The cache entry is a fixed shape written by `state/campaign/api.slice.ts` — `{ campaign, timestamp, apiKey }` — so only what is inside the campaign payload comes back. A new state field survives a page only if `loadCampaign` recomputes it from that payload; it is never restored from storage on its own.',
  },

  fields: [
    {
      name: 'data',
      kind: 'transient',
      description:
        'The campaign the page is selling: its packages, prices, currency, shipping options, and payment gateway key. `null` means no campaign has loaded yet on this page — the normal state for the first moments after boot, and the lasting state if the load failed.',
      notes:
        'The field is `data`, not `campaign`. `useCampaignStore.getState().campaign` is `undefined` with no error, so code reading it looks like a campaign that never loads. Always `useCampaignStore.getState().data`.',
    },
    {
      name: 'currency',
      kind: 'transient',
      description:
        'The currency every price on this campaign is quoted in, as an ISO code such as `USD`. `null` until a campaign has loaded, so money formatting has nothing to format yet.',
      notes:
        'This is the currency actually served, which is not always the one requested — a cached or API fallback can hand back a different one. Format from this field rather than from the configured currency, or the page shows the wrong symbol.',
    },
    {
      name: 'packages',
      kind: 'transient',
      description:
        'Every purchasable package in the campaign, flattened for lookup — this is what selectors, add-to-cart, and price displays read through `getPackage(refId)`. Variant packages arrive with their product and variant fields promoted into a nested `product` object so every consumer reads one shape.',
      notes:
        'It holds the same processed packages as `data.packages`, so the two never disagree — but a load failure empties `packages` and sets `data` to `null` together. Read `packages`, not `data.packages`, so variant processing is guaranteed to have run.',
    },
    {
      name: 'isLoading',
      kind: 'transient',
      description:
        'True while the campaign is being fetched or read from cache. Use it to hold back price rendering, since prices are absent rather than zero until it turns false.',
    },
    {
      name: 'error',
      kind: 'transient',
      description:
        'Why the last campaign load failed, as a message a developer can read. `null` when the last attempt succeeded or none has been made.',
      notes:
        '`loadCampaign` sets this **and** re-throws, so a caller that only inspects the field will also see an unhandled rejection unless it catches.',
    },
    {
      name: 'isFromCache',
      kind: 'transient',
      description:
        'Whether the campaign on screen came from the 10-minute sessionStorage copy (`true`) or from a fresh API fetch (`false`). `undefined` means no load has finished yet. This is what a debug panel reports and what tells you whether a price you changed in the backend could still be stale.',
      notes:
        '`reset()` does not clear it: the initial state object omits the key, and Zustand merges rather than replaces, so the flag keeps reporting the previous load against an empty store. Set it explicitly if you need it cleared.',
    },
    {
      name: 'cacheAge',
      kind: 'transient',
      description:
        'How old the cached copy was, in milliseconds, at the moment it was served — `0` on a fresh fetch, `undefined` before any load. Read it to tell a five-second-old cache from a nine-minute-old one.',
      notes:
        'It is a snapshot, not a clock: it does not tick while the page is open, so a page left open for twenty minutes still reports the age it had at load. Use `getCacheInfo().expiresIn` for time remaining, and carry the same `reset()` caveat as `isFromCache`.',
    },
  ],

  operations: [
    {
      name: 'loadCampaign(apiKey, { forceFresh })',
      effect:
        'Fills the store with a campaign: serves the sessionStorage copy when one exists for the requested currency, was written under the same API key, and is under 10 minutes old, otherwise fetches from the API and writes a fresh cache entry. Also pushes the payment gateway key onto the config store and reprices an existing cart when the currency changed. Pass `forceFresh: true` to skip the cache. Sets `error` and re-throws on failure. The SDK calls it once during boot, so a page rarely calls it directly.',
    },
  ],

  setters: [
    {
      name: 'setError(error)',
      effect: 'Records or clears the load error message without touching the campaign.',
    },
    {
      name: 'reset()',
      effect:
        'Returns the campaign, packages, currency, and error to their empty state. Leaves `isFromCache` and `cacheAge` behind, and leaves the sessionStorage cache in place — the next `loadCampaign` serves from it.',
    },
    {
      name: 'clearCache()',
      effect:
        'Deletes every `next-campaign-cache*` entry from sessionStorage, across all currencies. Does not change what is already in the store, so the current page keeps rendering the campaign it has until something reloads it.',
    },
  ],

  selectors: [
    {
      name: 'getPackage(refId)',
      effect:
        'The package with that `ref_id`, or `null` when the campaign does not sell it — the lookup every add-to-cart and price display goes through.',
    },
    {
      name: 'getProduct(id)',
      effect: 'Identical to `getPackage(id)`.',
      deprecated:
        'the name suggests a product lookup, but it resolves a package `ref_id`. Call `getPackage()` so the intent is readable.',
    },
    {
      name: 'getCacheInfo()',
      effect:
        'What is in the cache for the currently loaded currency: whether an entry exists, how many seconds until it expires, and which API key wrote it. Returns `{ cached: false }` when there is no entry. Falls back to the USD entry when no campaign has loaded yet.',
    },
    {
      name: 'getVariantsByProductId(productId)',
      effect:
        'Every buyable variant of one product — colours, sizes, and which package `ref_id` each combination maps to — plus the attribute types that product varies by. `null` when the campaign has no packages for that product.',
    },
    {
      name: 'getAvailableVariantAttributes(productId, attributeCode)',
      effect:
        'The distinct values a product offers for one attribute (`color` → `["Black", "Red"]`), sorted, for building a variant picker.',
    },
    {
      name: 'getPackageByVariantSelection(productId, selectedAttributes)',
      effect:
        'The package matching a chosen set of attribute values, or `null` when that combination is not sold. Matching is partial — a selection naming one of two attributes returns the first package that satisfies it, so pass every attribute once the shopper has chosen them all.',
    },
    {
      name: 'processPackagesWithVariants(packages)',
      effect:
        'Promotes flat product and variant fields on each package into a nested `product` object and returns the new list. `loadCampaign` runs it on every load, cached or fresh; call it only when handling packages that did not come through the store.',
    },
  ],

  emits: ['currency:fallback'],

  example: `{
  "data": {
    "name": "Summer Wellness Funnel",
    "currency": "USD",
    "language": "en",
    "payment_env_key": "PUBLIC-KEY-Xk29fT",
    "packages": [
      {
        "ref_id": 2,
        "external_id": 4417,
        "name": "6 Bottle Pack",
        "qty": 6,
        "price": "6.66",
        "price_total": "39.98",
        "price_retail": "9.99",
        "price_retail_total": "59.94",
        "is_recurring": false,
        "product_id": 88,
        "product_name": "Daily Greens",
        "product_sku": "NX-6PK"
      }
    ],
    "shipping_methods": [
      { "ref_id": 1, "code": "standard", "price": "4.95" },
      { "ref_id": 2, "code": "express", "price": "9.95" }
    ],
    "available_currencies": [
      { "code": "USD", "label": "US Dollar" },
      { "code": "EUR", "label": "Euro" }
    ]
  },
  "currency": "USD",
  "packages": [
    {
      "ref_id": 2,
      "name": "6 Bottle Pack",
      "price": "6.66",
      "price_total": "39.98",
      "product_id": 88
    }
  ],
  "isLoading": false,
  "error": null,
  "isFromCache": true,
  "cacheAge": 42000
}`,

  cautions: [
    '**The campaign lives on `.data`, never on `.campaign`.** `useCampaignStore.getState().campaign` returns `undefined` with no warning, so the page renders as though the campaign never loaded — empty prices, missing package names, no error in the console. Read `useCampaignStore.getState().data`, and read `packages` (not `data.packages`) when you want the variant-processed list.',
    '**Nothing is in the store on a fresh page.** This store does not use Zustand `persist`; the sessionStorage copy is only read back inside `loadCampaign`, so `data` is `null` and `packages` is `[]` until that resolves. A feature that reads packages in its constructor gets nothing — subscribe to the store, or gate on `isLoading`.',
    '**A cache miss for the requested currency can be served the USD entry.** The symptom is a page showing dollar prices while the shopper asked for euros. It happens whenever no entry exists for the requested currency, no `?currency=` override is present, and `forceFresh` was not set. Listen for `currency:fallback`, and format money from the `currency` field rather than from the configured one. To force a currency, pass it as `?currency=EUR` or call `loadCampaign(apiKey, { forceFresh: true })`.',
    '**The 10-minute expiry is only checked when `loadCampaign` runs.** A page left open does not notice its data going stale, so a price changed in the backend keeps rendering the old figure for as long as the tab is open. Reload the page, or call `loadCampaign(apiKey, { forceFresh: true })`, before trusting prices on a long-lived page.',
    '**A failed load leaves parts of the previous one behind.** The error path clears `data` and `packages` but not `currency`, `isFromCache`, or `cacheAge` — so a currency-formatted display keeps rendering against a store that has no campaign. Check `data` or `error` before formatting, rather than assuming `currency` implies a loaded campaign.',
    '**Cache keys are per currency and per API key.** Entries are written as `next-campaign-cache_{currency}`, and an entry whose `apiKey` differs from the current one is ignored. Switching API keys in a live tab therefore forces a fresh fetch rather than reusing a matching-currency entry — expected, but worth knowing when a cache hit you were counting on does not happen. `clearCache()` removes every currency at once.',
  ],
});
