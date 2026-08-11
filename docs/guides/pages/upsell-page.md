---
title: "Building Pages/Upsell Page"
group: "Building Pages"
category: "Building Pages"
---

# Building an upsell page

An upsell page offers one more product after the order is placed. The visitor arrives from checkout with `?ref_id=` in the URL, the SDK loads the completed order from it, and accepting the offer adds a line to that order — no second checkout. The examples below are condensed from `upsell-bundle-tier-cards.html` in the `olympus` starter template ([campaign-cart-starter-templates](https://github.com/NextCommerceCo/campaign-cart-starter-templates)).

The head declares the page type and both exits:

```html
<meta name="next-page-type" content="upsell">
<meta name="next-upsell-accept-url" content="/upsell-2/">
<meta name="next-upsell-decline-url" content="/receipt/">
```

`upsell` as the page type is what fires the upsell page-view event — without it the funnel reports purchases with no upsell views. Accept and decline can point at the same page; the starter templates set the decline URL to the receipt.

## The offer

Everything the visitor can act on sits inside one wrapper: `data-next-upsell="offer"`. Inside it, a bundle selector in upsell context carries the tiers, and two links accept or skip the offer:

```html
<div data-next-upsell="offer" data-next-await="">
  <div data-next-bundle-selector data-next-upsell-context data-next-selector-id="upsell-bundle">
    <div role="button" data-next-bundle-card data-next-bundle-id="upsell-bundle-1x" data-next-bundle-items='[{"packageId":3,"quantity":1}]' data-next-bundle-vouchers='["UP50"]' data-next-selected="true">
      <div data-next-package-id="3">
        <p>Buy 1</p>
        <span data-next-bundle-display="price">—</span>
        <span data-next-bundle-display="originalPrice"></span>
        <div data-next-bundle-display="hasDiscount"><span data-next-bundle-display="discountPercentage" data-next-format="percentage"></span> off</div>
      </div>
    </div>
    <div role="button" data-next-bundle-card data-next-bundle-id="upsell-bundle-2x" data-next-bundle-items='[{"packageId":3,"quantity":2}]' data-next-bundle-vouchers='["UP60"]'>
      <div data-next-package-id="3">
        <p>Buy 2</p>
        <span data-next-bundle-display="price">—</span>
      </div>
    </div>
  </div>
  <a data-next-upsell-action="add" href="#">Yes, Add to My Order</a>
  <a data-next-upsell-action="skip" href="#">No thank you, I don't want this one-time offer</a>
</div>
```

How it behaves:

- Clicking a card selects a tier; the SDK marks it `next-selected` and recalculates its price.
- `data-next-bundle-vouchers` rides a coupon code on each tier — `UP50` on 1×, `UP60` on 2×. The code is priced into the card *and* sent with the add, so the discount the visitor saw is the discount the order gets. The codes must exist in the Campaigns App.
- `add` submits the selected tier to the order, then forwards to the accept URL. `skip` forwards to the decline URL without touching the order.

## Prices outside the cards

A summary block elsewhere on the page can mirror the selected tier through the `bundle.<selectorId>.*` display namespace:

```html
<div data-next-display="bundle.upsell-bundle.originalPrice" data-next-format="currency">$49.99</div>
<div data-next-display="bundle.upsell-bundle.price" data-next-format="currency">$24.95</div>
<span data-next-display="bundle.upsell-bundle.discountPercentage" data-next-format="percentage"></span>
```

These remote bindings need an explicit `data-next-format` — `currency` or `percentage` — to render as money or percent. Inside a card, `data-next-bundle-display` formats itself.

## Cautions

- **The first selector inside the offer wrapper is the one that submits.** The upsell feature resolves its bundle from the first `[data-next-bundle-selector]` inside `[data-next-upsell="offer"]`. A display-only selector — one that exists to feed a `bundle.*` headline, like the hidden `upsell-bundle-1x` block in the olympus template — must sit *outside* the wrapper, or the visitor's click adds the wrong tier.
- **The offer expires with the order store.** The completed order is kept for 15 minutes; after that an upsell page has nothing to add to. A visitor who parks on the page and returns later sees an offer that cannot complete — keep upsell chains short and always give both exits.
- **Missing `next-page-type="upsell"` breaks tracking, not the page.** The offer still works, so the gap only shows up later as a funnel with no upsell views. Set it on every upsell page.
