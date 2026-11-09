---
title: 'Building Pages/Landing and Presell'
group: 'Building Pages'
category: 'Building Pages'
---

# Landing and Presell

A landing page shows the offer and fills the cart; a presell page warms the shopper up and links
on. Both load the SDK the same way:

```html
<head>
  <script type="module" src=".../loader.js" data-campaign="pk_…"></script>
</head>
```

Every page of the campaign shares one cart, so the checkout sees the cart the landing page filled.
To keep two funnels of one campaign apart, give each its own optional `data-funnel`.

## Prices and packages

Write the campaign's values into the page with `data-next-query`. Until a value is known the
element shows its `data-next-empty`, so placeholder prices never flash.

```html
<div data-next-for="package.42">
  <img data-next-query="image" alt="" />
  <h3 data-next-query="product_title"></h3>
  <span data-next-query="price" data-next-empty="…"></span>
</div>
```

Hide anything that should wait for values with CSS on `html:not([data-next-ready])`.

## Picking an option

A selector is a group of options, one of which is picked. The pick is the cart, so a landing page
can send the shopper straight on.

```html
<div data-next-selector="main">
  <div data-next-option="one" data-next-items="1">1 bottle <span data-next-query="total"></span></div>
  <div data-next-option="three" data-next-items="1x3" data-next-vouchers="TRIO10" data-next-selected>
    3 bottles <span data-next-query="price"></span> each
    <s data-next-show="total_discount > 0" data-next-query="subtotal"></s>
    <span data-next-show="total_discount > 0">Save <span data-next-query="discount_percentage"></span></span>
  </div>
</div>

<div data-next-for="selector.main">
  <button data-next-action="setQuantity" data-next-quantity="-1">−</button>
  <span data-next-query="quantity"></span>
  <button data-next-action="setQuantity" data-next-quantity="+1">+</button>
</div>

<a href="checkout.html">Continue</a>
```

Each option is priced on the server with its own vouchers and the shopper's coupons; until that
price arrives the campaign's prices show. The picked option gets `data-next-selected`. Options and
their parameters are on [Selector and option](../attribute-reference/objects/selector.md).

A product with sizes or colors needs one option, not one per variant:

```html
<div data-next-option="tee" data-next-items="12">
  <select data-next-field="variants.size"></select>
  <div data-next-field="variants.color"></div>
</div>
```

## Add to cart buttons

For a page without a selector, a button adds a package and moves on once it is in the cart:

```html
<button data-next-action="addItem" data-next-package-id="42" data-next-replace data-next-go="checkout.html">
  Buy now
</button>
```

`data-next-selector-id="main"` in place of `data-next-package-id` adds the selector's pick, with a
`data-next-defer` selector that waits for this button.

## Links keep the visit

A same-site link carries the page's URL parameters (`utm_*`, `gclid`, `fbclid`, `affid`,
`sub1`…, `currency` and the rest) to the next page, unless that link sets them itself. Links to
another site carry only the attribution ones. One-shot parameters such as `forcePackageId`,
`forceBundleId`, `reset` and `debug` stay on the page they were opened with.

| URL parameter                          | On this page                                            |
| -------------------------------------- | ------------------------------------------------------- |
| `?forcePackageId=42` or `42:2,7:1`     | Puts those packages, with those quantities, in the cart |
| `?forceBundleId=three` or `main:three` | Picks that option                                       |
| `?reset=1`                             | Starts with an empty cart                               |
| `?debug=1`                             | Opens the debug panel and logs at `debug`               |

## Presell pages

A presell page usually has no cart at all: copy and a link to the landing page or the checkout. The
SDK still loads, so the visit's parameters reach the next page and the page is tracked.

```html
<a href="landing.html" data-next-promotion="presell-cta" data-next-promotion-name="Presell CTA">See the offer</a>
```

`data-next-promotion` sends `promotion.viewed` and `promotion.clicked` (see
[Promotion](../attribute-reference/objects/promotion.md)). An exit-intent popup is set up with
`next.exitIntent({ … })` (see the [JavaScript API](../javascript-api.md)).
