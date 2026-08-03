# Campaign Cart SDK

The Campaign Cart SDK turns a plain HTML landing page into a working cart and
checkout. You add `data-next-*` attributes to the markup you already have, and the
SDK finds them, fetches the campaign's packages and prices, keeps a cart, and takes
the visitor through checkout to an order — without you writing any JavaScript.

The shortest page that works:

```html
<head>
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  <meta name="next-page-type" content="product">
  <script src="/next-campaign-cart.js" defer></script>
</head>

<body>
  <button data-next-action="add-to-cart" data-next-package-id="42">
    Add to cart — <span data-next-display="package.price">$0.00</span>
  </button>

  <span data-next-display="cart.totalQuantity">0</span> items,
  total <span data-next-display="cart.total">$0.00</span>
</body>
```

That page adds package 42 to a cart, shows its price in the campaign's currency, and
keeps the two totals in sync as the visitor clicks. Everything else in this reference
is a variation on those three moves: mark an element, name a value, react to a change.

## Where to go next

**[Feature guides](../src/features/cart/add-to-cart/guide/overview.md)** — one guide
per feature, each with an overview, a get-started, use cases, and a full reference for
its attributes, events, logs and errors. Start with
[Add to Cart](../src/features/cart/add-to-cart/guide/overview.md) or
[Package Selector](../src/features/cart/package-selector/guide/overview.md) if you are
building a product page, or
[Checkout Form](../src/features/checkout/checkout-form/guide/overview.md) if you are
building the checkout step. The sidebar lists all of them under **Features**.

**[Every `data-next-*` attribute](./attribute-index.md)** — the single door for
looking up an attribute you found in someone else's markup.

**[The SDK engine](../src/core/guide/overview.md)** — what happens on boot, in what
order, and what the SDK reads off your page. The reference under **Core** covers the
[meta tags](../src/core/guide/reference/meta-tags.md) that configure a page, the
[URL parameters](../src/core/guide/reference/url-parameters.md) it responds to, the
[storage keys](../src/core/guide/reference/storage-keys.md) it writes and how long
they live, the [`window.next` API](../src/core/guide/reference/javascript-api.md) for
the times you do need JavaScript, and the
[analytics events](../src/core/guide/reference/analytics-events.md) it emits.

**[State](../src/state/cart/guide/overview.md)** — the cart, campaign, checkout and
order stores: what each one holds, which fields survive a page reload, and how to read
a live value. Under **State** in the sidebar.

**Data shapes** — the objects you receive in events and read from the stores, generated
from the source types so they always match the shipped code. See {@link index.CartItem},
{@link index.Package}, {@link index.OrderData}, and {@link index.EventMap} for the full
event map.

## Reading this site

- Pages under **Features**, **Core** and **State** are the guides — written for someone
  building a page.
- Pages under **Modules**, **Classes**, **Interfaces** and **Type Aliases** are
  generated from the source. They are the exact shapes and signatures, useful when a
  guide mentions a type and you need its fields — and they are where a contributor
  reads the engine's internals.
- The version selector at the top of the page switches between released SDK versions.
  A page pinned to an older version documents that version, not this one.
