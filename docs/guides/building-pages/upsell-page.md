---
title: 'Building Pages/Upsell Page'
group: 'Building Pages'
category: 'Building Pages'
---

# Upsell Page

An upsell page comes after a paid order and offers one more product, added to that same order
with no new payment. The checkout opens it with `?ref_id=<order>`; the SDK loads the order from
that, so the page needs no setup beyond its offer.

```html
<head>
  <meta name="next-upsell-accept-url" content="upsell-2.html" />
  <meta name="next-upsell-decline-url" content="receipt.html" />
  <script type="module" src=".../loader.js" data-campaign="pk_…" data-funnel="my-funnel"></script>
</head>
```

The next page gets the same `ref_id`, so a funnel can chain as many upsells as it likes and end
on the receipt.

## One package

```html
<section data-next-upsell="offer" data-next-package-id="7">
  <h2>Add a second bottle for <span data-next-display="package.7.price"></span></h2>
  <button data-next-upsell-action="add">Yes, add it</button>
  <a href="#" data-next-upsell-action="skip">No thanks</a>
</section>
```

`data-next-quantity` on the offer sets the quantity. A button's own `data-next-url` wins over the
meta tags.

## A choice of options

Put a bundle selector inside the offer; the picked card is what gets added. On an upsell page a
selector only records the pick (`select` mode), and `data-next-upsell-context` prices its cards
as a post-purchase offer.

```html
<section data-next-upsell="offer">
  <div data-next-bundle-selector data-next-selector-id="upsell" data-next-upsell-context>
    <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":7,"quantity":1}]'>
      1 more <span data-next-bundle-display="price"></span>
    </div>
    <div
      data-next-bundle-card
      data-next-bundle-id="two"
      data-next-selected="true"
      data-next-bundle-items='[{"packageId":7,"quantity":2}]'
    >
      2 more <span data-next-bundle-display="price"></span>
    </div>
  </div>
  <button data-next-upsell-action="add">Add to my order</button>
  <a href="#" data-next-upsell-action="skip">No thanks</a>
</section>
```

## What the offer shows

The SDK sets classes on the `[data-next-upsell]` element; the page styles them.

| Class                            | When                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `next-available` / `next-hidden` | The order takes upsells, or it does not (the payment method cannot be charged again)     |
| `next-processing`                | The offer is being added; a second click does nothing                                    |
| `next-success`                   | Added. The next page opens a moment later                                                |
| `next-error`                     | It could not be added. The next page opens after a second, so the shopper is never stuck |
| `next-skipped`                   | Declined                                                                                 |
| `next-disabled` (on the buttons) | While an offer is being added, or the page is leaving                                    |

An offer is added once per order and page: going back and clicking again moves on without
charging twice. Each offer sends `upsell.viewed` once it is shown, then `upsell.accepted` (with
`order.updated`) or `upsell.skipped`; see the [Upsell lifecycle](../event-reference/upsells/lifecycle.md).

Values of the order are available here too, as on the [receipt](receipt-page.md):
`<span data-next-display="order.customer.firstName"></span>, one more thing…`
