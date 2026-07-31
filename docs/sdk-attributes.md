---
title: "Reference/SDK-level Attributes"
group: "Reference"
category: "Attributes"
---

# SDK-level Attributes

<!-- Generated from the feature manifests. Do not edit by hand:
     edit the feature's *.manifest.ts, then run `npm run docs:reference`. -->

Attributes owned by the SDK itself rather than by any feature — the boot sequence, the shared action base, attribution, and the DOM observer. Looking up a feature will never find these, which is why they have their own page.

For the feature-owned attributes, and every one of these in a single table, see [All Attributes](./attribute-index.md).

## `data-next-sdk-loading`

| | |
|---|---|
| Owner | SDK boot |
| Type | `'true' | 'false'` |
| Direction | the SDK sets it, you read it |

Set on `<body>`: `true` while the SDK is starting, `false` once it is ready. Style your page off this to avoid the flash of un-enhanced markup — prices reading `{price}` and empty cart totals — before the SDK has run.

> **Watch out:** It is on `<body>`, not on any feature element, so a rule like `body[data-next-sdk-loading="true"] .price { visibility: hidden }` is the intended use.

## `data-next-page-type`

| | |
|---|---|
| Owner | SDK config / analytics |
| Type | `string` |
| Direction | you set it, the SDK reads it |

Declares what kind of page this is — product, cart, checkout, upsell, receipt — so analytics events are attributed to the right funnel step. Can also come from the loader configuration instead of markup.

## `data-next-tracking-tag`

| | |
|---|---|
| Owner | Attribution |
| Type | `string (meta tag)` |
| Direction | you set it, the SDK reads it |

Read from a `<meta>` tag, not from an element: `<meta name="data-next-tracking-tag" data-tag-name="funnel_name" content="…">`. Supplies campaign attribution values that are attached to the order.

> **Watch out:** The legacy `os-tracking-tag` meta name is still read as a fallback.

## `data-loading-text`

| | |
|---|---|
| Owner | Shared action base |
| Type | `string` |
| Direction | the SDK sets it, you read it |

Set on any action element — an add-to-cart or accept-upsell button — while its work is in flight, carrying the loading label. Available on every action feature rather than declared by each one.

## `data-next-validate`

| | |
|---|---|
| Owner | DOM observer |
| Type | `string` |
| Direction | you set it, the SDK reads it |

Watched by the DOM observer, so changing it re-runs the affected validation rather than needing a manual refresh. Relevant when your own code drives validation state.

## `data-next-await`

| | |
|---|---|
| Owner | Debug overlay |
| Type | `boolean (presence)` |
| Direction | you set it, the SDK reads it |

Recognised by the debug x-ray overlay, which highlights elements waiting on SDK data. It has no effect on a production page.

> **Watch out:** No non-debug code reads it. Treat it as a debugging aid, not a supported page attribute.

## `data-next-toggle`

| | |
|---|---|
| Owner | DOM observer / debug overlay |
| Type | `boolean (presence)` |
| Direction | you set it, the SDK reads it |

Watched by the DOM observer and highlighted by the debug overlay. For the package toggle feature use `data-next-package-toggle` — this shorter name is not its activating attribute.

> **Watch out:** Easy to confuse with `data-next-package-toggle`. Adding this one does not create a toggle.

## Classes

Applied outside any feature, on the document root, as boot signals.

| Class | Owner | Meaning |
|---|---|---|
| `next-display-ready` | SDK boot | Added to `<html>` once display bindings have resolved their first values. Pair it with `data-next-sdk-loading` on `<body>`: the attribute says the SDK is running, this class says the page is safe to show. |
