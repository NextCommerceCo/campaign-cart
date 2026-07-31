---
title: "State/Order/State Reference"
group: "State"
category: "Order Store"
---

# useOrderStore

<!-- Generated from the store manifest. Do not edit by hand:
     edit <store>.state-manifest.ts, then run `npm run docs:reference`. -->

Holds the order the visitor has already paid for, so a receipt or upsell page can show it and add to it.

Persisted to Zustand `persist` over sessionStorage under `next-order`, valid for **15 minutes from when the order was loaded**.

Past that window the stored copy is discarded and the store starts empty — so a reader coming back later sees a blank state rather than stale data.

## Schema

The **Survives** column is the part that is invisible in the type: two fields can look identical and only one comes back after a refresh.

| Field | Type | Survives | Meaning |
|---|---|---|---|
| `order` | `Order \| null` | persisted — survives a reload | The completed order as the API returned it: lines, totals, addresses, and the status URL. `null` before an order has been loaded, which is the normal state of a page opened without a `?ref_id`. |
| `refId` | `string \| null` | persisted — survives a reload | The order's reference, taken from the `?ref_id` query parameter. It is the only way the page knows which order to load, so a receipt link without it shows an empty page. |
| `orderLoadedAt` | `number \| null` | persisted — survives a reload | When the order was fetched, as a timestamp. The 15-minute window is measured from this, not from the last interaction.<br>⚠️ A visitor who sits on an upsell page for 20 minutes and then accepts finds the order gone, because the clock does not restart on activity. |
| `isLoading` | `boolean` | transient — runtime only | True while the order is being fetched. |
| `isProcessingUpsell` | `boolean` | transient — runtime only | True while an upsell is being added. Use it to disable the accept button — an order write is not reversible from the page, so a second click can add the line twice. |
| `error` | `string \| null` | transient — runtime only | Why loading the order failed, as a message. `null` when the last attempt succeeded or none has been made. |
| `upsellError` | `string \| null` | transient — runtime only | Why the last upsell add failed. Kept apart from `error` so a failed upsell does not read as a failed order. |
| `pendingUpsells` | `AddUpsellLine[]` | persisted — survives a reload | Upsell lines queued but not yet sent to the API. |
| `completedUpsells` | `string[]` | persisted — survives a reload | Package ids already accepted on this order.<br>⚠️ Deprecated in favour of `completedUpsellPages`: ids cannot tell two offers of the same package apart, so a funnel offering one package on two pages saw the second page as already accepted. |
| `completedUpsellPages` | `string[]` | persisted — survives a reload | Page paths where an upsell was accepted. This is what stops a visitor being re-offered something after a back-button, and it is the field to check. |
| `viewedUpsells` | `string[]` | persisted — survives a reload | Package ids that have been shown to the visitor.<br>⚠️ Deprecated for the same reason as `completedUpsells` — use `viewedUpsellPages`. |
| `viewedUpsellPages` | `string[]` | persisted — survives a reload | Page paths already shown, so a view is reported once per page rather than once per render. |
| `upsellJourney` | `Array<{ packageId?: string; pagePath?: string; action: 'viewed' \| 'accepted' \| 'skipped'; timestamp: number; }>` | persisted — survives a reload | What the visitor did with each offer, in order — viewed, accepted, or skipped, each with a timestamp. This is the record to read when working out where a post-purchase funnel loses people. |

New fields: a new field is persisted automatically — this store has no `partialize`, so the whole state is written. That also means a transient flag would be restored on reload unless it is reset explicitly.

## What you can do

### Do this

The supported path. These carry the business logic and talk to the API.

| Call | Effect |
|---|---|
| `loadOrder(refId, apiClient)` | Fetches the order and stores it, stamping `orderLoadedAt`. Called by the SDK on any page opened with a `?ref_id`, so a page rarely needs to call it directly. |
| `addUpsell(upsellData, apiClient)` | Adds a line to the existing order and replaces `order` with the API response. Returns the updated order, or `null` if the add failed. |

### Direct writes

Set state without an API call. Nothing recalculates unless the effect says so.

| Call | Effect |
|---|---|
| `setOrder(order)` | Replaces the order without fetching. |
| `setRefId(refId)` | Sets the reference the next load will use. |
| `clearOrder()` | Drops the order and its reference. |
| `markUpsellCompleted(packageId)` | Records an acceptance by package id. **Deprecated** — records against a package rather than a page; prefer the page-based record. |
| `markUpsellPageViewed(pagePath)` | Records that a page was shown. |
| `markUpsellSkipped(packageId, pagePath)` | Adds a `skipped` entry to `upsellJourney`. |
| `clearErrors()` | Clears both `error` and `upsellError`. |

### Reads

Lookups and derived values. None of these change state.

| Call | Effect |
|---|---|
| `isOrderExpired()` | Whether the 15-minute window has passed. Check this before offering an upsell, rather than assuming a loaded order is still usable. |
| `hasUpsellPageBeenCompleted(pagePath)` | Whether this page has already been accepted — the guard against re-offering. |
| `hasUpsellBeenViewed(packageId)` | Whether the offer has been shown. |

## What the data looks like

```json
{
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
}
```

## Cautions

- **The 15-minute window is measured from load, not from activity.** A visitor reading a long upsell page finds the order expired when they finally accept, and the page shows an empty state rather than an error. Check `isOrderExpired()` before offering, and send them to the receipt if it has passed.
- **An order write cannot be undone from the page.** If `addUpsell` fails after the API accepted the line, a retry adds it twice. Read the order back before offering a retry.
- **`completedUpsells` and `viewedUpsells` are deprecated but still written.** Reading them to decide whether to show an offer breaks a funnel that offers the same package on two pages. Use the `*Pages` fields.
- **Persistence is not filtered.** With no `partialize`, transient flags are written to storage too, so a reload can restore `isProcessingUpsell: true` and leave a button disabled. Reset those on rehydrate rather than trusting them.
