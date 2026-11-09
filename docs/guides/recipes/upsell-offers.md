---
title: 'Recipes/Upsell offer tiers'
group: 'Recipes'
category: 'Recipes'
order: 9
---

# Upsell offer tiers

After the order is paid: one or two earbuds cases at their offer price, "Yes, add it" to add the
picked one to the order, and "No thanks" to go on without it.

```html
<div data-next-selector="cases">
  <button data-next-option="one" data-next-items="3">1 case · <span data-next-query="total"></span></button>
  <button data-next-option="two" data-next-items="3x2" data-next-selected>
    2 cases · <span data-next-query="price"></span> each
  </button>
</div>
<button data-next-action="acceptUpsell" data-next-selector-id="cases" data-next-go="receipt.html">
  Yes, add it to my order
</button>
<button data-next-action="skipUpsell" data-next-selector-id="cases" data-next-go="receipt.html">No thanks</button>
```

The page is opened with `?ref_id=<order>`, so the selector is a post-purchase offer, priced for
that order. `acceptUpsell` adds the picked option to the same order with no new payment;
`data-next-go` then opens the next page with the same `ref_id`, so offers chain until the
receipt. An offer is added once per order and page: a second accept moves on without charging
again.

| Style                                    | When                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `[data-next-option][data-next-selected]` | the picked tier                                                            |
| `[data-next-option][data-next-loading]`  | the tiers are being priced                                                 |
| `[data-next-action][data-next-loading]`  | the offer is being added                                                   |
| `[data-next-action][data-next-invalid]`  | it could not be added; `errors.order` is `unsupported`, `failed` or `busy` |

**Events**: `upsell.viewed`, then `upsell.accepted` with `order.updated`, `upsell.skipped`, or
`payment.failed` for a decline.

**See also**: [Upsell Page](../building-pages/upsell-page.md),
[Order and upsell](../attribute-reference/objects/order.md),
[Action list](../attribute-reference/actions/action-list.md).
