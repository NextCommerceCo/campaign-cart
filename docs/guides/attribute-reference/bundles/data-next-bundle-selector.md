---
title: 'data-next-bundle-selector'
group: 'Attribute Reference/Bundles'
order: 301
---

# data-next-bundle-selector

A group of [cards](data-next-bundle-card.md), one of which is picked. In `swap` mode the picked
card is the selector's part of the cart; in `select` mode it is only recorded, for an upsell offer
or a button to use.

```html
<div data-next-bundle-selector data-next-selector-id="main">
  <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":1,"quantity":1}]'>…</div>
  <div
    data-next-bundle-card
    data-next-bundle-id="three"
    data-next-selected="true"
    data-next-bundle-items='[{"packageId":1,"quantity":3}]'
  >
    …
  </div>
</div>
```

## Attributes

| Attribute                                 | Means                                                                                                                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-next-bundle-selector`               | Marks the selector. Its cards are the `[data-next-bundle-card]` elements inside it                                                                                         |
| `data-next-selector-id="<id>"`            | The selector's id, used by `bundle.<id>.*` paths, `data-next-bundle-qty-for` and `data-next-selector-id` on an add-to-cart button. Default `default`                       |
| `data-next-selection-mode="swap\|select"` | `swap` (default): picking a card replaces the selector's lines in the cart. `select`: the pick is only recorded. On a page with `[data-next-upsell]` it is always `select` |
| `data-next-selected="true"` on a card     | The card picked first                                                                                                                                                      |
| `data-next-upsell-context`                | Prices the cards as a post-purchase offer; see [data-next-upsell-context](data-next-upsell-context.md)                                                                     |

## Which card is picked first

The first of these that applies:

1. `?forceBundleId=<card>` or `?forceBundleId=<selector>:<card>` (several, comma-separated), on
   that page only. An id that matches no card logs a warning.
2. The card already in the cart, so a reload or the next page shows the shopper's own pick, with
   its quantity and slots.
3. The card with `data-next-selected="true"`.
4. The first card.

In `swap` mode that card goes into the cart as soon as the selector is bound. The selector's lines
are their own group in the cart: picking another card replaces them and leaves the other lines
alone. A card's `data-next-shipping-id` sets the shipping method when it is added.

A click on a card picks it, except a click on a link, input, select, textarea or label inside it.
While an order is being placed, a `swap` selector does not change.

## Set by the SDK

| On           | Set                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The selector | `data-selected-bundle="<card id>"`                                                                                                                                                   |
| Each card    | `next-selected`, `next-active`, `next-in-cart` on the picked card, `next-not-in-cart` on the others; `data-next-selected`, `data-next-active` and `aria-pressed` as `true` / `false` |
| Each card    | `next-loading` while the cards are being priced                                                                                                                                      |

## 0.4.x

| 0.4.x          | Now                     |
| -------------- | ----------------------- |
| `data-next-id` | `data-next-selector-id` |

## Events

[selector.viewed](/event-reference/selectors/selector.viewed) when the selector is bound,
[selector.selected](/event-reference/selectors/selector.selected) on each new pick,
[selector.updated](/event-reference/selectors/selector.updated) when the picked card's quantity
or slots change, and [selector.calculating](/event-reference/selectors/selector.calculating) /
[selector.calculated](/event-reference/selectors/selector.calculated) around pricing. See the
[Selector lifecycle](../../event-reference/selectors/lifecycle.md).
