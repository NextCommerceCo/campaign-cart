# Campaign Cart SDK

The Campaign Cart SDK turns a plain HTML landing page into a working cart and checkout. You add `data-next-*` attributes to the markup you already have, and the SDK finds them, fetches the campaign's packages and prices, keeps a cart, and takes the visitor through checkout to an order, without you writing any JavaScript.

The shortest page that works:

```html
<head>
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  <meta name="next-page-type" content="product">
  <script
    src="https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v{{SDK_VERSION}}/dist/loader.js"
    defer
  ></script>
</head>

<body>
  <button data-next-action="add-to-cart" data-next-package-id="42">
    Add to cart <span data-next-display="package.price">$0.00</span>
  </button>

  <span data-next-display="cart.totalQuantity">0</span> items,
  total <span data-next-display="cart.total">$0.00</span>
</body>
```

That page adds package 42 to a cart, shows its price in the campaign's currency, and keeps the two totals in sync as the visitor clicks. Everything else on this site is a variation on those three steps: mark an element, name a value, react to a change.

## Where to go next

**[Getting Started](./guides/start-here/getting-started.md)**: from an empty file to a booted page: the head every funnel page carries, the page types, and how pages chain into a funnel. Then **[How It Works](./guides/start-here/how-it-works.md)** for the mental model behind the attributes.

**[Building Pages](./guides/pages/checkout-page.md)**: one guide per funnel page, with markup condensed from the production starter templates: [Checkout](./guides/pages/checkout-page.md), [Upsell](./guides/pages/upsell-page.md), [Receipt](./guides/pages/receipt-page.md), and [Landing & Presell](./guides/pages/landing-presell.md).

**Reference**: [Data Attributes](./guides/reference/data-attributes.md) for every `data-next-*` attribute real funnels use, [JavaScript API](./guides/reference/javascript-api.md) for every `window.next` method, and [Analytics Events](./guides/reference/analytics-events.md) for what the SDK reports and the configuration mistakes that produce wrong numbers.

**API types**: the objects you receive in events and read from the stores, generated from the source so they always match the shipped code: {@link index!CartItem}, {@link index!Package}, {@link index!OrderData}, and {@link index!EventMap}. Every export is listed in the left sidebar under **Classes**, **Interfaces** and **Type Aliases**.

## Reading this site

- [**Start Here**](./guides/start-here/getting-started.md) and [**Building Pages**](./guides/pages/checkout-page.md) are the tutorials. Read them in order the first time.
- [**Reference**](./guides/reference/data-attributes.md) is for looking things up mid-build: an [attribute](./guides/reference/data-attributes.md) you found in markup, a [method](./guides/reference/javascript-api.md), an [analytics event](./guides/reference/analytics-events.md).
- Pages under **Classes**, **Interfaces** and **Type Aliases** are generated from the source: the exact fields and signatures. The sidebar lists every export on its own page.
- The version selector at the top of the page switches between released SDK versions. A page pinned to an older version documents that version, not this one.
