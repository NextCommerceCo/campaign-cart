import { defineStore } from '@/core/docs/state-manifest';

export default defineStore({
  id: 'attribution',
  storeHook: 'useAttributionStore',
  stateInterface: 'AttributionState',
  interfaceFile: 'state/attribution/attribution.state.ts',
  summary:
    'Holds where this visitor came from — funnel, affiliate, UTM tags, click ids and the context of the visit — so the order created at checkout is credited to the traffic that produced it.',

  persistence: {
    mechanism: 'zustand-persist',
    key: 'next-attribution',
    newFieldRule:
      'a new field is persisted automatically — this store has no `partialize`, so the whole state is written to sessionStorage. That also means a field meant to be runtime-only comes back on reload unless it is reset explicitly. Persisting it is not enough to send it: a new attribution field also has to be added to the `Attribution` shape in `types/api.ts` and copied in `getAttributionForApi()`, or the order API never sees it.',
  },

  fields: [
    {
      name: 'metadata',
      kind: 'persisted',
      description:
        'Everything about the visit that is not one of the named attribution tags: the landing page URL, the referrer, the user agent and whether it read as a phone, the domain, the moment the visit was recorded, the SDK version, and every tracking id the SDK could find — the Facebook `_fbp` / `_fbc` cookies, `fbclid`, the detected pixel id, a generic `clickid`, and the Everflow transaction id. Custom `os-tracking-tag` / `data-next-tracking-tag` meta tags on the page are written onto the same object under their tag name. **This object holds personal data**: `user_ip` is the visitor’s IP address as detected during location lookup, `device` is the full user agent, and the click ids identify one individual across sites — treat the whole object as personal data when deciding what to forward to an analytics provider.',
      notes:
        'Custom tracking tags share the namespace with the SDK’s own keys, so a tag named `device`, `domain`, `referrer` or `timestamp` overwrites the real value and the order is attributed with the wrong context. Prefix custom tag names (`acme_device`) instead.',
    },
    {
      name: 'first_visit_timestamp',
      kind: 'persisted',
      description:
        'When this visitor was first seen, as a timestamp — the value to read when telling a first-time visitor from someone coming back mid-funnel.',
      notes:
        'The collector recovers this from `localStorage["next-attribution"]`, but the store persists to **sessionStorage**, so the localStorage copy is never written and a new tab starts a fresh "first visit". Do not build returning-visitor logic on it; write your own marker to localStorage if you need cross-session truth.',
    },
    {
      name: 'current_visit_timestamp',
      kind: 'persisted',
      description:
        'When attribution was last touched in this session. `updateAttribution()` re-stamps it on every call, so it tracks the most recent attribution write rather than the start of the visit.',
    },

    // ── Inherited from `Attribution` (src/types/api.ts) ──────────────────────
    // These are what actually reaches the order, so they belong in the schema even
    // though the state interface only declares them by extending.
    {
      name: 'utm_source',
      kind: 'persisted',
      description:
        'Where the visit came from, from the `?utm_source` on the landing URL — `facebook`, `google`, a newsletter name. This is the field most attribution reporting groups by.',
    },
    {
      name: 'utm_medium',
      kind: 'persisted',
      description:
        'What kind of traffic it was — `cpc`, `email`, `social`. Read from `?utm_medium`.',
    },
    {
      name: 'utm_campaign',
      kind: 'persisted',
      description:
        'Which campaign the visit belongs to, from `?utm_campaign`. Distinct from the SDK\'s own campaign: this is the marketing campaign, not the package set.',
    },
    {
      name: 'utm_content',
      kind: 'persisted',
      description:
        'Which creative or placement was clicked, from `?utm_content`. Use it to tell two ads in the same campaign apart.',
    },
    {
      name: 'utm_term',
      kind: 'persisted',
      description: 'The paid keyword, from `?utm_term`.',
    },
    {
      name: 'affiliate',
      kind: 'persisted',
      description:
        'The partner who sent the visit, for commission. Empty means the order is unattributed and pays no commission — which is why a link that drops this parameter is a revenue problem, not only a reporting one.',
    },
    {
      name: 'funnel',
      kind: 'persisted',
      description:
        'Which funnel the visitor entered, used to compare page variants. Also written to a separate `localStorage` key, so clearing sessionStorage does not reset it.',
    },
    {
      name: 'gclid',
      kind: 'persisted',
      description:
        'Google click identifier, from `?gclid`. Google uses it to tie a conversion back to a click.',
      notes:
        'This is a personal identifier under most privacy regimes — it identifies a click, and therefore a person. Treat it as PII when deciding what to forward to a third party.',
    },
    {
      name: 'everflow_transaction_id',
      kind: 'persisted',
      description:
        'Everflow click identifier, for networks tracking through Everflow. Also mirrored to `localStorage` under its own key.',
      notes: 'Another click-level identifier — see the note on `gclid`.',
    },
    {
      name: 'subaffiliate1',
      kind: 'persisted',
      description:
        "A partner's own sub-tracking slot, passed through untouched. The SDK gives it no meaning; whatever the affiliate puts in the link arrives on the order.",
    },
    {
      name: 'subaffiliate2',
      kind: 'persisted',
      description: 'Second pass-through slot. Same handling as `subaffiliate1`.',
    },
    {
      name: 'subaffiliate3',
      kind: 'persisted',
      description: 'Third pass-through slot.',
    },
    {
      name: 'subaffiliate4',
      kind: 'persisted',
      description: 'Fourth pass-through slot.',
    },
    {
      name: 'subaffiliate5',
      kind: 'persisted',
      description: 'Fifth pass-through slot.',
    },
  ],

  operations: [
    {
      name: 'initialize()',
      effect:
        'Runs `AttributionCollector`: reads `utm_source` / `utm_medium` / `utm_campaign` / `utm_content` / `utm_term`, `affid` or `aff`, `gclid`, `fbclid`, `clickid`, `evclid` and `subaffiliate1`–`subaffiliate5` from the query string, falling back to sessionStorage then localStorage when the URL has none; reads the Facebook `_fbp` and `_fbc` cookies; resolves the funnel name; then merges the result over current state, keeping custom `metadata` keys and the existing `first_visit_timestamp`. The SDK calls this during boot — a page does not call it itself.',
    },
    {
      name: 'next.setAttribution(fields)',
      effect:
        'Overwrites named attribution fields (for example `{ utm_source: "newsletter" }`) and re-stamps `current_visit_timestamp`. Use it when the traffic source is only known from page logic, not from the URL.',
    },
    {
      name: 'next.addMetadata(key, value)',
      effect:
        'Adds or replaces one key inside `metadata`, keeping everything already collected.',
    },
    {
      name: 'next.setMetadata(fields)',
      effect:
        'Merges an object into `metadata`. It merges rather than replaces, so the automatic fields survive.',
    },
    {
      name: 'next.clearMetadata()',
      effect:
        'Drops every custom and tracking key from `metadata`, keeping only `landing_page`, `referrer`, `device`, `device_type`, `domain` and `timestamp`. This is the way to strip collected click ids from a page before checkout.',
    },
  ],

  setters: [
    {
      name: 'updateAttribution(data)',
      effect:
        'Shallow-merges the given fields into state, merging `metadata` key by key rather than replacing it, and re-stamps `current_visit_timestamp`.',
    },
    {
      name: 'setFunnelName(funnel)',
      effect:
        'Sets the funnel **only if none is set yet** — an existing value in state, or a value in `next_funnel_name` in session/localStorage, wins and the new name is ignored. Also mirrors the name into both storages.',
    },
    {
      name: 'setEverflowClickId(evclid)',
      effect:
        'Records an Everflow click id in `metadata.everflow_transaction_id` and mirrors it into session and localStorage under `evclid`, so it survives a reload and later pages of the funnel.',
    },
    {
      name: 'clearPersistedFunnel()',
      effect:
        'Removes `next_funnel_name` from both storages and blanks the funnel, which is what lets the next `setFunnelName()` take a new value.',
    },
    {
      name: 'reset()',
      effect:
        'Returns state to the values captured when the module first loaded. It does not clear the `next_funnel_name` and `evclid` keys, so the next `initialize()` re-populates both.',
    },
    {
      name: 'debug()',
      effect:
        'Prints the current attribution, the API-shaped payload and the live query string to the console. Reachable as `next.debugAttribution()`.',
    },
  ],

  selectors: [
    {
      name: 'getAttributionForApi()',
      effect:
        'Builds the `attribution` object sent with cart and order creation: `affiliate`, `funnel`, `gclid`, the five `utm_*` tags, `subaffiliate1`–`subaffiliate5`, the whole `metadata` object, and `everflow_transaction_id` lifted out of `metadata` to the top level. Empty strings are dropped, so a tag that was never set is absent rather than blank. Read it as `next.getAttribution()`.',
    },
    {
      name: 'next.getMetadata()',
      effect:
        'Returns the `metadata` object as stored. Check it before forwarding anything onward — it can contain the visitor’s IP address and click ids.',
    },
  ],

  example: `{
  "funnel": "summer-skin-2026",
  "affiliate": "aff_4417",
  "gclid": "",
  "utm_source": "facebook",
  "utm_medium": "paid-social",
  "utm_campaign": "summer-skin-prospecting",
  "utm_content": "carousel-a",
  "utm_term": "",
  "subaffiliate1": "adset_9912",
  "subaffiliate2": "",
  "metadata": {
    "landing_page": "https://shop.example.com/lp/summer-skin?utm_source=facebook&utm_medium=paid-social",
    "referrer": "https://l.facebook.com/",
    "device": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15",
    "device_type": "mobile",
    "domain": "shop.example.com",
    "timestamp": 1769800000000,
    "conversion_timestamp": 1769800142000,
    "sdk_version": "0.4.12",
    "user_ip": "203.0.113.42",
    "fbclid": "IwAR2xK9pQ7bZ",
    "fb_fbp": "fb.1.1769799990123.1846273901",
    "fb_fbc": "fb.1.1769799990123.IwAR2xK9pQ7bZ",
    "fb_pixel_id": "182736450192837",
    "clickid": "ck_88213",
    "everflow_transaction_id": "1f9c4d2e8a",
    "funnel_name": "summer-skin-2026"
  },
  "first_visit_timestamp": 1769799990000,
  "current_visit_timestamp": 1769800142000
}`,

  cautions: [
    '**The schema table above is short because most attribution fields are inherited.** `AttributionState` declares only `metadata` and the two timestamps; `funnel`, `affiliate`, `gclid`, the five `utm_*` tags and `subaffiliate1`–`subaffiliate5` come from the shared `Attribution` interface, so grepping `attribution.state.ts` for `utm_source` finds nothing and reads as "the store does not carry it". Their declarations are in `types/api.ts` (`interface Attribution`), and `getAttributionForApi()` lists every one of them.',
    '**The funnel name is write-once per browser.** `setFunnelName()` ignores a new value once state or `next_funnel_name` has one, so a visitor who lands on a second campaign in the same browser keeps the first funnel and those orders are credited to the wrong one. A `?funnel=` in the URL always overrides — the collector re-persists it; from code, call `clearPersistedFunnel()` before setting a new name.',
    '**`next_funnel_name` and `evclid` are written to localStorage, outside the persist blob.** Clearing sessionStorage or the `next-attribution` key does not clear them, so testing a second funnel or a second Everflow click keeps showing the previous value. Remove those two localStorage keys as well when resetting attribution by hand.',
    '**`metadata` can carry personal data.** `user_ip`, `device` (full user agent) and the click ids (`fbclid`, `clickid`, `fb_fbc`, `everflow_transaction_id`) identify an individual, and `getAttributionForApi()` forwards the whole object. Forwarding `metadata` wholesale to a third-party pixel or logger ships that data with it — pick the keys you need explicitly instead.',
    '**Subaffiliate values are truncated at 225 characters.** The collector cuts anything longer and logs a warning, so a long tracking payload passed as `sub1` arrives at the API clipped and stops matching on the partner side. Keep subaffiliate values short and put long payloads in a custom tracking tag.',
    '**Persistence is not filtered and the key is permanent.** With no `partialize` the whole state is written to `next-attribution`, and renaming that key silently discards the attribution of every session already in flight — so those orders arrive with no source. Add fields; never rename the key.',
  ],
});
