import { defineStore } from '@/core/docs/state-manifest';

export default defineStore({
  id: 'order',
  storeHook: 'useOrderStore',
  stateInterface: 'OrderState',
  interfaceFile: 'state/order.state.ts',
  summary:
    'Holds the order the visitor has already paid for, so a receipt or upsell page can show it and add to it.',

  persistence: {
    mechanism: 'zustand-persist',
    key: 'next-order',
    expiry: '15 minutes from when the order was loaded',
    newFieldRule:
      'a new field is persisted automatically — this store has no `partialize`, so the whole state is written. That also means a transient flag would be restored on reload unless it is reset explicitly.',
  },

  fields: [
    {
      name: 'order',
      kind: 'persisted',
      description:
        'The completed order as the API returned it: lines, totals, addresses, and the status URL. `null` before an order has been loaded, which is the normal state of a page opened without a `?ref_id`.',
    },
    {
      name: 'refId',
      kind: 'persisted',
      description:
        "The order's reference, taken from the `?ref_id` query parameter. It is the only way the page knows which order to load, so a receipt link without it shows an empty page.",
    },
    {
      name: 'orderLoadedAt',
      kind: 'persisted',
      description:
        'When the order was fetched, as a timestamp. The 15-minute window is measured from this, not from the last interaction.',
      notes:
        'A visitor who sits on an upsell page for 20 minutes and then accepts finds the order gone, because the clock does not restart on activity.',
    },
    {
      name: 'isLoading',
      kind: 'transient',
      description: 'True while the order is being fetched.',
    },
    {
      name: 'isProcessingUpsell',
      kind: 'transient',
      description:
        'True while an upsell is being added. Use it to disable the accept button — an order write is not reversible from the page, so a second click can add the line twice.',
    },
    {
      name: 'error',
      kind: 'transient',
      description:
        'Why loading the order failed, as a message. `null` when the last attempt succeeded or none has been made.',
    },
    {
      name: 'upsellError',
      kind: 'transient',
      description:
        'Why the last upsell add failed. Kept apart from `error` so a failed upsell does not read as a failed order.',
    },
    {
      name: 'pendingUpsells',
      kind: 'persisted',
      description:
        'Upsell lines queued but not yet sent to the API.',
    },
    {
      name: 'completedUpsells',
      kind: 'persisted',
      description:
        'Package ids already accepted on this order.',
      notes:
        'Deprecated in favour of `completedUpsellPages`: ids cannot tell two offers of the same package apart, so a funnel offering one package on two pages saw the second page as already accepted.',
    },
    {
      name: 'completedUpsellPages',
      kind: 'persisted',
      description:
        'Page paths where an upsell was accepted. This is what stops a visitor being re-offered something after a back-button, and it is the field to check.',
    },
    {
      name: 'viewedUpsells',
      kind: 'persisted',
      description: 'Package ids that have been shown to the visitor.',
      notes: 'Deprecated for the same reason as `completedUpsells` — use `viewedUpsellPages`.',
    },
    {
      name: 'viewedUpsellPages',
      kind: 'persisted',
      description:
        'Page paths already shown, so a view is reported once per page rather than once per render.',
    },
    {
      name: 'upsellJourney',
      kind: 'persisted',
      description:
        'What the visitor did with each offer, in order — viewed, accepted, or skipped, each with a timestamp. This is the record to read when working out where a post-purchase funnel loses people.',
    },
  ],

  operations: [
    {
      name: 'loadOrder(refId, apiClient)',
      effect:
        'Fetches the order and stores it, stamping `orderLoadedAt`. Called by the SDK on any page opened with a `?ref_id`, so a page rarely needs to call it directly.',
    },
    {
      name: 'addUpsell(upsellData, apiClient)',
      effect:
        'Adds a line to the existing order and replaces `order` with the API response. Returns the updated order, or `null` if the add failed.',
    },
  ],

  setters: [
    { name: 'setOrder(order)', effect: 'Replaces the order without fetching.' },
    { name: 'setRefId(refId)', effect: 'Sets the reference the next load will use.' },
    { name: 'clearOrder()', effect: 'Drops the order and its reference.' },
    {
      name: 'markUpsellCompleted(packageId)',
      effect: 'Records an acceptance by package id.',
      deprecated: 'records against a package rather than a page; prefer the page-based record.',
    },
    { name: 'markUpsellPageViewed(pagePath)', effect: 'Records that a page was shown.' },
    {
      name: 'markUpsellSkipped(packageId, pagePath)',
      effect: 'Adds a `skipped` entry to `upsellJourney`.',
    },
    { name: 'clearErrors()', effect: 'Clears both `error` and `upsellError`.' },
  ],

  selectors: [
    {
      name: 'isOrderExpired()',
      effect:
        'Whether the 15-minute window has passed. Check this before offering an upsell, rather than assuming a loaded order is still usable.',
    },
    {
      name: 'hasUpsellPageBeenCompleted(pagePath)',
      effect: 'Whether this page has already been accepted — the guard against re-offering.',
    },
    { name: 'hasUpsellBeenViewed(packageId)', effect: 'Whether the offer has been shown.' },
  ],

  example: `{
  "refId": "ord_9fT2xK",
  "orderLoadedAt": 1769800000000,
  "order": {
    "ref_id": "ord_9fT2xK",
    "number": "NX-10428",
    "currency": "USD",
    "total_incl_tax": "59.98",
    "total_tax": "5.45",
    "supports_post_purchase_upsells": true,
    "is_test": false,
    "lines": [
      {
        "id": 41207,
        "product_title": "Starter Pack",
        "quantity": 1,
        "price_incl_tax": "29.99",
        "is_upsell": false
      },
      {
        "id": 41208,
        "product_title": "Bonus Bottle",
        "quantity": 1,
        "price_incl_tax": "29.99",
        "is_upsell": true
      }
    ]
  },
  "completedUpsellPages": ["/upsell-1"],
  "viewedUpsellPages": ["/upsell-1", "/upsell-2"],
  "upsellJourney": [
    { "pagePath": "/upsell-1", "action": "viewed", "timestamp": 1769800012000 },
    { "pagePath": "/upsell-1", "action": "accepted", "timestamp": 1769800031000 }
  ],
  "isLoading": false,
  "error": null
}`,

  cautions: [
    '**The 15-minute window is measured from load, not from activity.** A visitor reading a long upsell page finds the order expired when they finally accept, and the page shows an empty state rather than an error. Check `isOrderExpired()` before offering, and send them to the receipt if it has passed.',
    '**An order write cannot be undone from the page.** If `addUpsell` fails after the API accepted the line, a retry adds it twice. Read the order back before offering a retry.',
    '**`completedUpsells` and `viewedUpsells` are deprecated but still written.** Reading them to decide whether to show an offer breaks a funnel that offers the same package on two pages. Use the `*Pages` fields.',
    '**Persistence is not filtered.** With no `partialize`, transient flags are written to storage too, so a reload can restore `isProcessingUpsell: true` and leave a button disabled. Reset those on rehydrate rather than trusting them.',
  ],
});
