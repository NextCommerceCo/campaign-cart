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
  <script type="module" src=".../loader.js" data-campaign="pk_…" data-funnel="my-funnel"></script>
</head>
```

Every page of one funnel uses the same `data-funnel`: that is what lets the checkout see the
cart the landing page filled.

## Prices and packages

Write the campaign's own values into the page with `data-next-display`. The element is emptied until
the campaign loads, so placeholder text inside it does not show on the first page.

```html
<div data-next-package-id="42">
  <h3 data-next-display="package.name">Starter</h3>
  <span data-next-display="package.price">$39.00</span>
  <s data-next-show="package.hasSavings" data-next-display="package.compareTotal"></s>
</div>
```

Hide anything that should wait for values with CSS on `html:not([data-next-ready])`.

## Picking a bundle

A bundle selector is a group of cards, one of which is picked. In `swap` mode (the default) the
pick is the cart, so a landing page can send the shopper straight on.

```html
<div data-next-bundle-selector data-next-selector-id="main">
  <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":1,"quantity":1}]'>
    1 bottle <span data-next-bundle-display="price"></span>
  </div>
  <div
    data-next-bundle-card
    data-next-bundle-id="three"
    data-next-selected="true"
    data-next-bundle-items='[{"packageId":1,"quantity":3}]'
  >
    3 bottles <span data-next-bundle-display="price"></span>
    <span data-next-show="bundle.three.hasDiscount">
      Save <span data-next-bundle-display="discountPercentage"></span>
    </span>
  </div>
</div>

<a href="checkout.html">Continue</a>
```

Each card is priced on the server, so its price includes vouchers and coupons. The picked card
gets `next-selected`. Cards and their attributes are listed under
[Bundles](../attribute-reference/bundles/data-next-bundle-selector.md).

## Add to cart buttons

For a page without a selector, a button adds a package and can move on:

```html
<button
  data-next-action="add-to-cart"
  data-next-package-id="42"
  data-next-clear-cart="true"
  data-next-url="checkout.html"
>
  Buy now
</button>
```

`data-next-selector-id="main"` in place of `data-next-package-id` adds the selector's pick.

## Links keep the visit

A same-site link carries the page's URL parameters (`utm_*`, `gclid`, `fbclid`, `affid`,
`sub1`…, `currency` and the rest) to the next page, unless that link sets them itself. Links to
another site carry only the attribution ones. One-shot parameters such as `forcePackageId`,
`forceBundleId`, `reset` and `debug` stay on the page they were opened with.

| URL parameter                          | On this page                                            |
| -------------------------------------- | ------------------------------------------------------- |
| `?forcePackageId=42` or `42:2,7:1`     | Puts those packages, with those quantities, in the cart |
| `?forceBundleId=three` or `main:three` | Picks that card                                         |
| `?reset=1`                             | Starts with an empty cart                               |
| `?debug=1`                             | Opens the debug panel and logs at `debug`               |

## Presell pages

A presell page usually has no cart at all: copy and a link to the landing page or the checkout. The
SDK still loads, so the visit's parameters reach the next page and the page is tracked.

```html
<a href="landing.html" data-next-promotion="presell-cta" data-next-promotion-name="Presell CTA">See the offer</a>
```

`data-next-promotion` sends `promotion.viewed` and `promotion.clicked` (see
[data-next-promotion](../attribute-reference/promotions/data-next-promotion.md)). An exit-intent popup is set up with
`next.exitIntent({ … })` (see the [JavaScript API](../javascript-api.md)).
