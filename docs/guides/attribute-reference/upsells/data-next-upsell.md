---
title: 'data-next-upsell'
group: 'Attribute Reference/Upsells'
order: 601
---

# data-next-upsell

A post-purchase offer, added to the order placed at checkout with no new payment. The page needs
the order: it is opened with `?ref_id=<order>`, as the checkout's `next-success-url` does. See the
[Upsell Page](../../building-pages/upsell-page.md) guide.

```html
<meta name="next-upsell-accept-url" content="upsell-2.html" />
<meta name="next-upsell-decline-url" content="receipt.html" />

<section data-next-upsell="offer" data-next-package-id="7" data-next-quantity="1">
  <button data-next-upsell-action="add">Yes, add it</button>
  <a href="#" data-next-upsell-action="skip">No thanks</a>
</section>
```

## Attributes

| Attribute                               | Means                                                                                                                                                                                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-next-upsell="offer"`              | The offer                                                                                                                                                                                                                                                       |
| `data-next-package-id`                  | The package it adds, when it has no bundle selector                                                                                                                                                                                                             |
| `data-next-quantity`                    | Its quantity. Default `1`                                                                                                                                                                                                                                       |
| `[data-next-bundle-selector]` inside    | The first one supplies the lines: its picked card is added. On an upsell page a selector only records the pick; `data-next-upsell-context` on it prices its cards as a post-purchase offer ([data-next-upsell-context](../bundles/data-next-upsell-context.md)) |
| `<meta name="next-upsell-accept-url">`  | The page after the offer is added                                                                                                                                                                                                                               |
| `<meta name="next-upsell-decline-url">` | The page after it is declined                                                                                                                                                                                                                                   |

The next page gets the order's `ref_id` and the visit's [URL parameters](../setup/url-parameters.md).
A button's own `data-next-url` wins over the meta tags; see
[data-next-upsell-action](data-next-upsell-action.md).

Values of the order (`order.*`) can be shown on the page; see [Order values](../orders/order-values.md).

## Set by the SDK

| Class on the offer               | When                                                       |
| -------------------------------- | ---------------------------------------------------------- |
| `next-available` / `next-hidden` | Once the order is loaded: it takes upsells, or it does not |
| `next-processing`                | The offer is being added                                   |
| `next-success`                   | Added; the next page opens after 0.1 s                     |
| `next-error`                     | It could not be added; the next page opens after 1 s       |
| `next-skipped`                   | Declined                                                   |

An offer is added once per order and page. Accepting it again, after going back, opens the next
page without adding it twice.

## 0.4.x

| 0.4.x                                       | Now                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `data-next-bundle-selector-id` on the offer | Still read: the selector with that id supplies the lines. Put the selector inside the offer |

## Events

[upsell.viewed](/event-reference/upsells/upsell.viewed) once the offer is shown, then
[upsell.accepted](/event-reference/upsells/upsell.accepted) with
[order.updated](/event-reference/orders/order.updated),
[upsell.failed](/event-reference/upsells/upsell.failed) or
[upsell.skipped](/event-reference/upsells/upsell.skipped); see the
[Upsell lifecycle](../../event-reference/upsells/lifecycle.md).
