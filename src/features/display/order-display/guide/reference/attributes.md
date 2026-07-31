---
title: "Features/Display/Order Display/Attributes"
group: "Features"
category: "Order Display"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Shows values from a completed order — number, totals, customer, shipping — on receipt and upsell pages.

Turned on by `[data-next-display]`.

## `data-next-display`

| | |
|---|---|
| Type | `string (order path)` |
| Required | yes |
| Default | — |

The order value to show, as `order.{path}`. The order is loaded from the reference in the page URL, so these elements work on any post-purchase page without extra wiring.

> **Watch out:** The order store keeps a completed order for 15 minutes. After that the values are gone and these elements render empty — expected on a page revisited much later, not a bug to chase.

## CSS classes

Toggled by the feature. Style these rather than tracking the same state yourself.

| Name | Values | Meaning |
|---|---|---|
| `next-loaded` | — | On the element once the order has arrived and its value is rendered. Removed while loading or after a failure, so it is the signal that what is on screen is real. |

## Loading and error states

The order arrives asynchronously, so the namespace exposes its own status paths.
Use them rather than assuming the values are there on first paint:

```html
<div data-next-display="order.isLoading">Loading your order…</div>
<div data-next-display="order.hasError">We could not load your order.</div>
<div data-next-display="order.errorMessage"></div>

<p>Order <span data-next-display="order.number"></span> —
   <span data-next-display="order.total_incl_tax"></span></p>
```

For a per-line breakdown of what was bought, use the order item list feature
rather than these single-value bindings. Modifiers are documented once in
[display-core](../../../../display/display-core/guide/reference/attributes.md).
