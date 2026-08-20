---
title: "Building Pages/Landing and Presell"
group: "Building Pages"
category: "Building Pages"
---

# Building landing and presell pages

Landing and presell pages are the front of the funnel: they sell, and their job for the SDK is only to keep the session intact on the way to checkout. In the starter templates both use `page_type: product`, boot a reduced head, and their call-to-action is a plain link to the checkout page, with no cart interaction at all. The examples below come from the `apollo` starter template's `_layouts/base-landing.html` and `_layouts/base-presell.html` ([campaign-cart-starter-templates](https://github.com/NextCommerceCo/campaign-cart-starter-templates)).

The head is three lines shorter than checkout's. There are no success or upsell URLs, because nothing on this page completes an order:

```html
<head>
  <script src="/assets/config.js"></script>
  <meta name="next-funnel" content="Apollo">
  <meta name="next-page-type" content="product">
  <script
    src="https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v{{SDK_VERSION}}/dist/loader.js"
    type="module"
  ></script>
</head>
```

And the call-to-action is a link:

```html
<a href="/checkout/">Claim Your 60% Discount</a>
```

That is the whole integration. Loading the SDK here still matters: it captures attribution (UTM tags, click ids, referrer) for the eventual order, keeps tracking parameters flowing to the next page when `utmTransfer` is enabled in your `config.js`, and fires the page-view analytics for the funnel step ([Analytics Events](../reference/analytics-events.md)).

A page that sells *and* drives the cart directly (a buy button that adds a package without going through a selector) uses the `data-next-action="add-to-cart"` attribute instead of a plain link. The starter templates don't; their product selection happens on the checkout page.

## Cart clearing

A returning visitor still carries the cart from their last session. If this page is the funnel's entry point, clear it:

```html
<meta name="next-clear-cart" content="true">
```

Entry pages only: the tag clears on every load of the page it is on, including refreshes.

## URL parameters

A landing page's real output is the link it sends people to. These parameters let one link decide what the next page shows, so you can run several offers off the same checkout page instead of building one page per variant.

### Send traffic to a pre-filled cart

Point the call to action at a checkout that already has the offer in it. The visitor lands on a page with no selector to click.

```html
<a href="/checkout/?forcePackageId=1:1">Claim Your 60% Discount</a>
```

The value is `{ID}` or `{ID}:{QTY}`, comma-separated for several packages. Use `?forceBundleId=` instead when the checkout has a bundle selector and you want one tier pre-picked.

This empties the cart first, every time. Keep it on ad links, never on a link a returning shopper might follow.

### Run one page in several currencies

A link can pin the currency and the address rules, which is how one landing page serves several markets.

```html
<a href="/checkout/?currency=EUR&country=DE">Jetzt bestellen</a>
```

| Parameter | Description |
|---|---|
| `currency` | Prices the campaign in that currency |
| `country` | Loads that country's address rules and shipping |

Set both. `country` on its own gives German address fields with US prices.

### Show different sections per source

Every parameter on the link is readable from your markup for the rest of the session, so one page can dress itself differently per audience.

```html
<div data-next-hide="param.banner=='n'">
  <promo-banner></promo-banner>
</div>
```

A visitor arriving on `?banner=n` never sees the banner, on that page or any later one in the funnel.

### Excluding internal traffic

```html
<a href="/?ignore=true">Preview</a>
```

Analytics stops for the whole tab, so QA clicks and demo runs do not land in the campaign's numbers.

### Credit the sale

Attribution parameters are captured on arrival and sent with the order, so a presell page at the front of the funnel is where they need to land.

| Parameter | Description |
|---|---|
| `utm_source` and the other `utm_*` | Where the visit came from |
| `affid` | The affiliate credited with the order |
| `gclid` | Google Ads click id, added by auto-tagging |
| `fbclid` | Facebook click id, added on outbound clicks |

These are remembered for the session, so they keep applying as the visitor moves through the funnel without the parameters in later URLs.

## Cautions

- **A presell can skip the SDK entirely, but then it captures nothing.** A static article page with a link to the landing page works without the loader. The cost is silent: no page-view event and no attribution capture from that first touch. Load the SDK on every page of the funnel unless you have a reason not to.
- **`next-clear-cart` on a shared layout clears carts mid-funnel.** The tag belongs to the entry page, not the layout every page inherits. The symptom is visitors losing their cart when they navigate back to the landing page.
