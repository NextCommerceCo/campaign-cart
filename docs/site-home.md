# Campaign Cart SDK

The Campaign Cart SDK turns a plain HTML landing page into a working cart and checkout. You add `data-next-*` attributes to the markup you already have, and the SDK finds them, fetches the campaign's packages and prices, keeps a cart, and takes the visitor through checkout to an order, without you writing any JavaScript.

The shortest page that works:

```html
<head>
  <script
    type="module"
    src="https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v{{SDK_VERSION}}/dist/loader.js"
    data-campaign="{YOUR_CAMPAIGN_API_KEY}"
  ></script>
</head>

<body>
  <button data-next-action="addItem" data-next-package-id="42">
    Add to cart <span data-next-query="package.42.price"></span>
  </button>

  <span data-next-query="cart.quantity"></span> items, total <span data-next-query="cart.total"></span>
</body>
```

That page adds package 42 to a cart, shows its price in the campaign's currency, and keeps the two totals in sync as the visitor clicks. Everything else on this site is a variation on those three steps: mark an element, name a value, react to a change.

## Where to go next

**[Quickstart](./guides/quickstart.md)**: a whole landing page to copy, line by line. **[Recipes](./guides/recipes/bundle-tiers.md)**: one common task per page: bundle tiers, order bumps, variants, coupons, upsells, the receipt.

**[What 0.5 improves](./guides/whats-new-in-0.5.md)**: about 5× less JavaScript on a landing page, prices sooner, events shaped like webhooks.

**[What's new in 0.5.1](./guides/whats-new-in-0.5.1.md)**: prices that show which dollar, and fixes for purchases and tracking.

**[Migrating from 0.4.x](./guides/migrating-from-0.4.md)**: pages built for 0.4.x keep working. This lists what changes for a page builder.

**Building Pages**: one page per step of a funnel: [Landing and Presell](./guides/building-pages/landing-and-presell.md), [Checkout](./guides/building-pages/checkout-page.md), [Upsell](./guides/building-pages/upsell-page.md) and [Receipt](./guides/building-pages/receipt-page.md).

**Reference**: [Attributes](./guides/attributes.md) for everything the SDK reads from a page, [JavaScript API](./guides/javascript-api.md) for `window.next`, and [Events](./guides/events.md) for what `next.on` and `next.analytics.on` receive.

**[Event Reference](./guides/events.md#event-reference)**: every event `next.on` receives, with its fields and an example. [`window.next`](/nextapi) and the [event envelope](/sdkevent) are generated from the source.

## Reading this site

- [**Start Here**](./guides/migrating-from-0.4.md) is for a page moving from 0.4.x.
- **Attributes**, **Events** and **JavaScript API**, picked with the switcher above the sidebar, are for looking things up mid-build: an [attribute](./guides/attributes.md) you found in markup, a [method](./guides/javascript-api.md), an [event](./guides/events.md).
- The **Event Reference** is generated from the SDK's types, so its fields always match the shipped code.
- The version selector at the top of the page switches between released SDK versions. A page pinned to an older version documents that version, not this one.
