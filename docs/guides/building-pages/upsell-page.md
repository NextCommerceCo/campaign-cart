---
title: 'Building Pages/Upsell Page'
group: 'Building Pages'
category: 'Building Pages'
---

# Upsell Page

An upsell page comes after a paid order and offers one more product, added to that same order
with no new payment. The checkout opens it with `?ref_id=<order>`; the SDK loads the order from
that, and every option on the page is a post-purchase offer, priced for the order.

```html
<head>
  <script
    type="module"
    src="https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v{{SDK_VERSION}}/dist/loader.js"
    data-campaign="pk_…"
  ></script>
</head>
```

## One package

```html
<div data-next-option="bottle" data-next-items="7">
  <h2>Add a second bottle for <span data-next-query="total"></span></h2>
  <button data-next-action="acceptUpsell" data-next-go="upsell-2.html">Yes, add it</button>
  <button data-next-action="skipUpsell" data-next-go="receipt.html">No thanks</button>
</div>
```

`data-next-go` opens the next page with the same `ref_id`, so a funnel can chain as many upsells
as it likes and end on the receipt.

## A choice of options

A selector picks what the offer adds; the buttons name it.

```html
<div data-next-selector="offer">
  <div data-next-option="one" data-next-items="7">1 more <span data-next-query="total"></span></div>
  <div data-next-option="two" data-next-items="7x2" data-next-selected>
    2 more <span data-next-query="total"></span>
  </div>
</div>
<button data-next-action="acceptUpsell" data-next-selector-id="offer" data-next-go="upsell-2.html">
  Add to my order
</button>
<button data-next-action="skipUpsell" data-next-selector-id="offer" data-next-go="receipt.html">No thanks</button>
```

## What the offer shows

| Read                         | For                                                                       |
| ---------------------------- | ------------------------------------------------------------------------- |
| `order.supports_upsells`     | Whether the order takes upsells (the payment method can be charged again) |
| `data-next-loading` (button) | The offer is being added; a second click does nothing                     |
| `data-next-invalid` (button) | It could not be added; `errors.order` says why                            |

```html
<div data-next-show="order.supports_upsells">…the offer…</div>
```

An offer is added once per order and page: going back and clicking again moves on without
charging twice. Each offer sends `upsell.viewed` once half of it is on screen, then
`upsell.accepted` (with `order.updated`), `upsell.skipped`, or `payment.failed` for a decline; see
the [Upsell lifecycle](../event-reference/upsells/lifecycle.md).

Values of the order are available here too, as on the [receipt](receipt-page.md):
`<span data-next-query="order.user.first_name"></span>, one more thing…`
