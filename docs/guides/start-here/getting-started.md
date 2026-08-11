---
title: "Start Here/Getting Started"
group: "Start Here"
category: "Start Here"
---

# Getting started

This page takes you from an empty HTML file to a page the SDK boots on. You need two things before you start: a campaign set up in the Campaigns App, and that campaign's API key.

## The head of every funnel page

Every page in a live funnel carries the same four things in its `<head>`, in this order: the configuration script, the `next-*` meta tags, and the SDK loader. This is the head of the `olympus` starter template (`_layouts/base.html` in [campaign-cart-starter-templates](https://github.com/NextCommerceCo/campaign-cart-starter-templates)), with the build variables resolved:

```html
<head>
  <script src="/assets/config.js"></script>
  <meta name="next-funnel" content="Olympus">
  <meta name="next-page-type" content="checkout">
  <meta name="next-success-url" content="/upsell-1/">
  <script src="https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v0.4.34/dist/loader.js" type="module"></script>
</head>
```

Pin the loader to a real released tag, as above. Check [releases](https://github.com/NextCommerceCo/campaign-cart/releases) for the current one before you copy this into a live funnel.

And the smallest `config.js` that works:

```js
window.nextConfig = {
  apiKey: "{YOUR_CAMPAIGN_API_KEY}",
};
```

The order is load-bearing. The SDK reads its configuration in boot step 2 — from `window.nextConfig` first, then from the meta tags, which win on conflict — so `config.js` must run before the loader script. The olympus starter template ships a fully commented `config.js` (`assets/config.js`) with every key — payment, address autocomplete, analytics providers, UTM transfer — so copy it and delete what you don't use.

A page can also run without a config script at all: `next-api-key` as a meta tag is enough.

```html
<head>
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  <meta name="next-page-type" content="product">
  <script src="https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v0.4.34/dist/loader.js" type="module"></script>
</head>
```

## Page types and how a funnel chains

`next-page-type` declares which funnel step a page is: `product`, `cart`, `checkout`, `upsell`, or `receipt`. Analytics and post-purchase tracking key off it, so every page should declare one.

A funnel is a chain of pages, and the links in the chain are meta tags:

- `next-success-url` — where checkout sends the visitor after the order is created. The SDK appends the order's `ref_id` to it, which is how the next page finds the order (`checkout-form.enhancer.ts › CheckoutFormEnhancer`).
- `next-upsell-accept-url` / `next-upsell-decline-url` — where an upsell page sends the visitor after they accept or skip the offer.

A typical funnel: presell → landing → **checkout** → upsell → **receipt**. Each page's guide is under [Building Pages](../pages/checkout-page.md).

## Waiting for the SDK

`window.next` does not exist until boot finishes. Two safe ways to run code after it:

```html
<script>
  window.nextReady = window.nextReady || [];
  window.nextReady.push(function (next) {
    console.log('cart total', next.getCartData().totals.total.value);
  });
  window.addEventListener('next:initialized', function () {
    document.body.classList.add('my-page-is-live');
  });
</script>
```

## Where to go next

- [How it works](./how-it-works.md) — the mental model behind the attributes.
- [Building Pages](../pages/checkout-page.md) — one guide per funnel page, copied from the production starter templates.
- [Data Attributes](../reference/data-attributes.md) — every `data-next-*` attribute real funnels use, by task.
- [JavaScript API](../reference/javascript-api.md) — every `window.next` method, grouped by task.
- [Analytics Events](../reference/analytics-events.md) — what fires, when, and the traps that produce wrong numbers.

## Cautions

- **A stale `next-api-key` meta tag silently overrides `window.nextConfig.apiKey`.** Configuration is loaded from `window` first and meta tags second, and the tag wins. If a page loads the wrong campaign, check for a leftover meta tag before anything else.
- **`next:ready` is not `next:initialized`.** `next:ready` means the SDK file arrived; `next:initialized` means the cart is restored and `window.next` exists. Code that runs on `next:ready` reads an empty cart. Wait for `next:initialized` or use the `window.nextReady` queue.
- **`next-clear-cart` belongs on entry pages only.** It empties the cart on every load of the page it is on, including a refresh — a visitor who refreshes your checkout loses their cart. Put it on the first page of the funnel, never on cart, checkout, or upsell pages.
