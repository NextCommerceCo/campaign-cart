---
title: "Building Pages/Landing and Presell"
group: "Building Pages"
category: "Building Pages"
---

# Building landing and presell pages

Landing and presell pages are the front of the funnel: they sell, and their job for the SDK is only to keep the session intact on the way to checkout. In the starter templates both use `page_type: product`, boot a reduced head, and their call-to-action is a plain link to the checkout page — no cart interaction at all. The examples below come from the `olympus` starter template's `_layouts/base-landing.html` and `_layouts/base-presell.html` ([campaign-cart-starter-templates](https://github.com/NextCommerceCo/campaign-cart-starter-templates)).

The head is three lines shorter than checkout's — no success or upsell URLs, because nothing on this page completes an order:

```html
<head>
  <script src="/assets/config.js"></script>
  <meta name="next-funnel" content="Olympus">
  <meta name="next-page-type" content="product">
  <script src="https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v0.4.18/dist/loader.js" type="module"></script>
</head>
```

And the call-to-action is a link:

```html
<a href="/checkout/">Claim Your 60% Discount</a>
```

That is the whole integration. Loading the SDK here still earns its keep: it captures attribution (UTM tags, click ids, referrer) for the eventual order, keeps tracking parameters flowing to the next page when `utmTransfer` is enabled in your `config.js`, and fires the page-view analytics for the funnel step ([Analytics Events](../reference/analytics-events.md)).

A page that sells *and* drives the cart directly — a buy button that adds a package without going through a selector — uses the `data-next-action="add-to-cart"` attribute instead of a plain link. The starter templates don't; their product selection happens on the checkout page.

## Starting the funnel clean

A returning visitor still carries the cart from their last session. If this page is the funnel's entry point, clear it:

```html
<meta name="next-clear-cart" content="true">
```

Entry pages only — the tag clears on every load of the page it is on, including refreshes.

## Driving the page from the URL

Two URL-parameter tricks the shop starter templates use, both driven by query parameters the SDK captures at boot:

**Preload the cart from the link.** The shop templates' landing CTA points at `/checkout/?forcePackageId=1:1` — the checkout page then has no selector at all; the cart arrives fully formed from the URL.

**Toggle page sections per traffic source.** Every URL parameter is stored for the session, and conditional display can read it through the `param.*` namespace:

```html
<div data-next-hide="param.banner=='n'">
  <promo-banner></promo-banner>
</div>
```

A link with `?banner=n` hides the promo banner for that whole session.

## Cautions

- **A presell can skip the SDK entirely — but then it captures nothing.** A static article page with a link to the landing page works without the loader. The cost is silent: no page-view event and no attribution capture from that first touch. Load the SDK on every page of the funnel unless you have a reason not to.
- **`next-clear-cart` on a shared layout clears carts mid-funnel.** The tag belongs to the entry page, not the layout every page inherits. The symptom is visitors losing their cart when they navigate back to the landing page.
