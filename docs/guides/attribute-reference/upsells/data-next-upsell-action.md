---
title: 'data-next-upsell-action'
group: 'Attribute Reference/Upsells'
order: 602
---

# data-next-upsell-action

The accept and decline buttons inside a [data-next-upsell](data-next-upsell.md) offer.

```html
<section data-next-upsell="offer" data-next-package-id="7">
  <button data-next-upsell-action="add" data-next-url="upsell-2.html">Yes, add it</button>
  <a href="#" data-next-upsell-action="skip">No thanks</a>
</section>
```

## Attributes

| Attribute                        | Means                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `data-next-upsell-action="add"`  | Adds the offer to the order, then opens the next page                                                                                    |
| `data-next-upsell-action="skip"` | Declines the offer and opens the next page at once. Any value other than `add` declines                                                  |
| `data-next-url`                  | This button's next page. Without it, `<meta name="next-upsell-accept-url">` or `next-upsell-decline-url`; without either, the page stays |

The next page gets `?ref_id=<order>` unless the URL sets one.

While the offer is being added, further clicks on any of its buttons do nothing.

## Set by the SDK

| On the buttons  | When                                                  |
| --------------- | ----------------------------------------------------- |
| `next-disabled` | While an offer is being added, or the page is leaving |

## 0.4.x

| 0.4.x                                    | Now                             |
| ---------------------------------------- | ------------------------------- |
| `data-next-upsell-action="accept"`       | Still read. Use `add`           |
| `data-next-upsell-action="decline"`      | Still read. Use `skip`          |
| `data-next-next-url`, `data-os-next-url` | Still read. Use `data-next-url` |

## Events

[upsell.accepted](/event-reference/upsells/upsell.accepted),
[upsell.failed](/event-reference/upsells/upsell.failed),
[payment.failed](/event-reference/payments/payment.failed) for a decline,
[upsell.skipped](/event-reference/upsells/upsell.skipped); see the
[Upsell lifecycle](../../event-reference/upsells/lifecycle.md).
