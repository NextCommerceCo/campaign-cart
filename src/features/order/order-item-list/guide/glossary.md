---
title: "Features/Order/Order Item List/Glossary"
group: "Features"
category: "Order Item List"
---

# Glossary

The post-purchase vocabulary used across this guide. The distinction to hold onto:
before payment there is a **cart** with cart lines; after payment there is an
**order** with order lines, and the two are different shapes with different field
names.

## Line total

The amount charged for a whole order line — the price for all units of that line,
including tax. The API reports order money as line totals, so the per-unit figure
shown by `{item.price}` is derived by dividing the line total by the quantity.
Expect a per-unit value on a three-for-two line to look like an unusual number for
that reason: it is the average paid per unit, not the list price.

---

## Order line

One purchased row of a completed order: a product, the quantity bought, and what
was actually charged for it after discounts. It is the post-payment counterpart of
a cart line, and its field names are its own — see
[order display paths](../../../display/order-display/guide/reference/display-paths.md).
This feature renders exactly one row per order line, in the order the API returns
them.

---

## Order reference

The identifier of a placed order, carried in the page URL as `?ref_id=`. It is how
a post-purchase page knows which order to show, which is why a confirmation or
upsell link must never lose it. The SDK's page-level loader also accepts
`order_ref_id`; this feature's own fallback loader reads `ref_id` only, and either
way the order lands in the same place. A loaded order is kept for 15 minutes before
it is fetched again.

---

## Receipt page

Any page shown after payment that reports on the order — the thank-you or
confirmation page, and the post-purchase upsell pages that follow it. All of them
load the same order from the same reference, so the same markup works on each.

---

## Row template

The single row of markup you author with `{item.*}` tokens, stamped out once per
order line. It can be supplied four ways — `data-item-template-id`,
`data-item-template-selector`, `data-item-template`, or the container's own content
— resolved in that order, with a built-in default when none is given. Full rules in
[reference/attributes.md](./reference/attributes.md).

---

## Upsell line

An order line added after payment, by accepting a post-purchase offer rather than
during checkout. The order marks these lines, and the tokens `{item.isUpsell}`,
`{item.showUpsell}`, and `{item.upsellBadge}` expose the flag so a receipt can label
them — worth doing, because a line the visitor does not remember buying at checkout
is a chargeback risk. The offer itself is presented by
[`upsell`](../../../order/upsell/guide/overview.md).
