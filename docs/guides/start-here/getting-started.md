---
title: "Start Here/Getting Started"
group: "Start Here"
category: "Start Here"
---

# Getting started

This page takes you from an empty HTML file to a page the SDK boots on. You need two things before you start: a campaign set up in the Campaigns App, and that campaign's API key.

## Loading the SDK

Every page in a live funnel carries the same three things in its `<head>`, in this order: the configuration, the `next-*` meta tags, and the SDK loader. The smallest complete head, with nothing to create but this one file:

```html
<head>
  <script>
    window.nextConfig = {
      apiKey: '{YOUR_CAMPAIGN_API_KEY}',
    };
  </script>
  <meta name="next-page-type" content="checkout">
  <meta name="next-success-url" content="/upsell-1/">
  <script
    src="https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v{{SDK_VERSION}}/dist/loader.js"
    type="module"
  ></script>
</head>
```

Pin the loader to a real released tag, as above. Check [releases](https://github.com/NextCommerceCo/campaign-cart/releases) for the current one before you copy this into a live funnel.

The starter templates keep that same configuration in a shared file instead, so every page in the funnel carries identical settings. This is the head of the `apollo` starter template (`_layouts/base.html` in [campaign-cart-starter-templates](https://github.com/NextCommerceCo/campaign-cart-starter-templates)), with the build variables resolved:

```html
<head>
  <script src="/assets/config.js"></script>
  <meta name="next-funnel" content="Apollo">
  <meta name="next-success-url" content="/upsell-1/">
  <meta name="next-page-type" content="checkout">
  <script
    src="https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v{{SDK_VERSION}}/dist/loader.js"
    type="module"
  ></script>
</head>
```

`config.js` is not an SDK file. It is a script you write that sets `window.nextConfig`, exactly like the inline version above. The apollo template ships a fully commented one (`assets/config.js`) with every key (payment, address autocomplete, analytics providers, UTM transfer), so copy it and delete what you don't use.

The order matters. The SDK reads its configuration in boot step 2, from `window.nextConfig` first and then from the meta tags, which win on conflict, so the configuration script must run before the loader script.

A page can also run without a config script at all: `next-api-key` as a meta tag is enough.

```html
<head>
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  <meta name="next-page-type" content="product">
  <script
    src="https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v{{SDK_VERSION}}/dist/loader.js"
    type="module"
  ></script>
</head>
```

To confirm it loaded, open the page with `?debugger=true`. The overlay reports the campaign it fetched and the prices it resolved, and installs `window.nextDebug` for checking state from the console. See [Debugger](../reference/debugger.md).

## Page types

`next-page-type` declares which funnel step a page is: `product`, `cart`, `checkout`, `upsell`, or `receipt`. Analytics and post-purchase tracking key off it, so every page should declare one.

A typical funnel, with what moves the visitor from page to page:

![Funnel page types: presell → landing → checkout → upsell → receipt, linked by the labelled URL meta tags](./diagrams/funnel-pages.svg)

- **Presell** declares `product`. Sells, and links forward to the landing page. Build it with [Landing & Presell](../pages/landing-presell.md).
- **Landing** declares `product`. Sells, and links to checkout. Build it with [Landing & Presell](../pages/landing-presell.md).
- **Checkout** declares `checkout`. Creates the order. Build it with [Checkout](../pages/checkout-page.md).
- **Upsell** declares `upsell`. Adds to the already-paid order. Build it with [Upsell](../pages/upsell-page.md).
- **Receipt** declares `receipt`. Confirms the order. Build it with [Receipt](../pages/receipt-page.md).

The links in the chain are meta tags:

- `next-success-url`: where checkout sends the visitor after the order is created. The SDK appends the order's `ref_id` to it, which is how the next page finds the order (`checkout-form.enhancer.ts › CheckoutFormEnhancer`).
- `next-upsell-accept-url` / `next-upsell-decline-url`: where an upsell page sends the visitor after they accept or skip the offer.

## Initialization

The SDK creates `window.next` once it has loaded the campaign and restored the cart. Push a callback onto `window.nextReady` and it runs at that point, or immediately if the SDK is already up:

```html
<script>
  window.nextReady = window.nextReady || [];
  window.nextReady.push(function (next) {
    console.log('cart total', next.getCartTotals().total.toNumber());
  });
  window.addEventListener('next:initialized', function () {
    document.body.classList.add('my-page-is-live');
  });
</script>
```

## Next steps

- [How it works](./how-it-works.md): the mental model behind the attributes.
- [Building Pages](../pages/checkout-page.md): one guide per funnel page, copied from the production starter templates.
- [Data Attributes](../reference/data-attributes.md): every `data-next-*` attribute real funnels use, by task.
- [JavaScript API](../reference/javascript-api.md): every `window.next` method, grouped by task.
- [Analytics Events](../reference/analytics-events.md): what fires, when, and the configuration mistakes that produce wrong numbers.

## Cautions

- **A stale `next-api-key` meta tag silently overrides `window.nextConfig.apiKey`.** Configuration is loaded from `window` first and meta tags second, and the tag wins. If a page loads the wrong campaign, check for a leftover meta tag before anything else.
- **`next:ready` is not `next:initialized`.** `next:ready` means the SDK file arrived; `next:initialized` means the cart is restored and `window.next` exists. Code that runs on `next:ready` reads an empty cart. Wait for `next:initialized` or use the `window.nextReady` queue.
- **`next-clear-cart` belongs on entry pages only.** It empties the cart on every load of the page it is on, including a refresh, so a visitor who refreshes your checkout loses their cart. Put it on the first page of the funnel, never on cart, checkout, or upsell pages.
