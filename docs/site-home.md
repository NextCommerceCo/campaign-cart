# Campaign Cart SDK

The Campaign Cart SDK turns a plain HTML landing page into a working cart and checkout. You add `data-next-*` attributes to the markup you already have, and the SDK finds them, fetches the campaign's packages and prices, keeps a cart, and takes the visitor through checkout to an order, without you writing any JavaScript.

The shortest page that works:

```html
<head>
  <script type="module" src=".../loader.js" data-campaign="{YOUR_CAMPAIGN_API_KEY}" data-funnel="my-funnel"></script>
</head>

<body>
  <button data-next-action="add-to-cart" data-next-package-id="42">
    Add to cart <span data-next-display="package.price">$0.00</span>
  </button>

  <span data-next-display="cart.totalQuantity">0</span> items, total <span data-next-display="cart.total">$0.00</span>
</body>
```

That page adds package 42 to a cart, shows its price in the campaign's currency, and keeps the two totals in sync as the visitor clicks. Everything else on this site is a variation on those three steps: mark an element, name a value, react to a change.

## Where to go next

**[Migrating from 0.4.x](./guides/migrating-from-0.4.md)**: pages built for 0.4.x keep working. This lists what changes for a page builder.

**Reference**: [Attributes](./guides/attributes.md) for everything the SDK reads from a page, [JavaScript API](./guides/javascript-api.md) for `window.next`, and [Events](./guides/events.md) for what `next.on` and `next.analytics.on` receive.

**API types**: generated from the source so they always match the shipped code: [NextApi](/module/boot/nextapi) (`window.next`), [EventMap](/module/engine-events/eventmap) (each event's data) and [SdkEvent](/module/boot/sdkevent) (the envelope).

## Reading this site

- [**Start Here**](./guides/migrating-from-0.4.md) is for a page moving from 0.4.x.
- [**Reference**](./guides/attributes.md) is for looking things up mid-build: an [attribute](./guides/attributes.md) you found in markup, a [method](./guides/javascript-api.md), an [event](./guides/events.md).
- Pages under **Classes**, **Interfaces** and **Type Aliases** are generated from the source: the exact fields and signatures.
- The version selector at the top of the page switches between released SDK versions. A page pinned to an older version documents that version, not this one.
