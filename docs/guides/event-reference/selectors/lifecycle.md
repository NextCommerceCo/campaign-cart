---
title: 'Selector lifecycle'
group: 'Event Reference/Selectors'
---

# Selector lifecycle

Events: `selector.*`.

![Selector lifecycle: picked, pricing, priced and unpriced on one selector, with the events each step sends](selector-lifecycle.svg)

The lifecycle is one selector's (`data-next-bundle-selector`) on one page. An option is a card in
it (`data-next-bundle-card`); `option_id` is its `data-next-bundle-id`. A toggle has its own, below.

| State      | Means                                                                          |
| ---------- | ------------------------------------------------------------------------------ |
| `picked`   | The selector is bound and an option is picked; its options are priced at once  |
| `pricing`  | The options with no price from the last 10 minutes are being priced            |
| `priced`   | Every option has a price                                                       |
| `unpriced` | Pricing failed; each option keeps its last price, else shows its package price |

| From                            | What happens                                                                                                            | To                                                                | Events, in order                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| none                            | The selector is bound and picks its option: `?forceBundleId`, the one in the cart, `data-next-selected`, else the first | `picked`                                                          | none; in swap mode `cart.updated` when the option was not in the cart yet                                       |
| any                             | Half of the selector comes on screen (at bind, in a browser without `IntersectionObserver`)                             | same state                                                        | `selector.viewed`, once per selector on the page                                                                |
| `picked`                        | Some options have no price from the last 10 minutes                                                                     | `pricing`                                                         | `selector.pricing`                                                                                              |
| `picked`                        | Every option has a price from the last 10 minutes                                                                       | `priced`                                                          | `selector.priced`                                                                                               |
| `pricing`                       | The prices arrive                                                                                                       | `priced`                                                          | `selector.priced`                                                                                               |
| `pricing`                       | Pricing fails                                                                                                           | `unpriced`                                                        | `sdk.error` (`selector.price`)                                                                                  |
| `priced`                        | Prices saved by an earlier page are checked again, once a page                                                          | `priced`                                                          | `selector.priced` with the fresh prices; if the check fails, `sdk.error` (`selector.price`) and the prices stay |
| any                             | Another option is picked                                                                                                | same state                                                        | `selector.selected`; in swap mode `cart.updated` follows                                                        |
| `pricing`, `priced`, `unpriced` | The picked option's quantity changes, or a slot of it (one unit of a configurable line) changes its variant or property | `pricing`, or `priced` if every price is from the last 10 minutes | `selector.updated`, then `selector.pricing` or `selector.priced`; in swap mode `cart.updated` follows           |
| `pricing`, `priced`, `unpriced` | The cart's coupons change, or the campaign arrives changed from its cached copy                                         | as above                                                          | `selector.pricing` or `selector.priced`, after the change's own events                                          |

## Picking

- At bind: `?forceBundleId` (`<option>`, or `<selector>:<option>`, comma-separated), else the option
  in the cart, else the card with `data-next-selected="true"`, else the first card.
- An option found in the cart comes back with its quantity and slots. A card with
  `data-next-shipping-id` also picks that shipping method: `shipping.selected`, in the cart lifecycle.
- Markup bound again under the same selector id, such as with `next.bind`, keeps its pick while the
  option is still there, else picks again and sends `selector.selected`; no second `selector.viewed`.
- The 0.4.x `selector:selection-changed` and `bundle:selection-changed` also come on the first bind.

## Modes

- Swap, the default (`data-next-selection-mode`): the picked option is the selector's own group in
  the cart, so `cart.updated` follows a pick, a quantity change and a slot change.
- Select: the cart is left alone. Every selector on an upsell page (`data-next-upsell`) is select.
- Offer (`data-next-upsell-context`, `type: 'offer'`): priced as an upsell, never put in the cart;
  see the upsell lifecycle.
- While an order is being placed the cart is frozen: a swap selector ignores picks, quantity and
  slot changes and sends nothing.

## Prices from the last 10 minutes

- Each option is priced at its quantity and slots, with the cart's coupons, in the campaign's
  currency; a change to any of these prices it again.
- Prices are kept 10 minutes in this browser, the newest 24.
- A later page shows them at once with `selector.priced`, checks them once in the background
  without `selector.pricing`, then sends `selector.priced` again with the fresh prices.
- A change while prices are pending drops that request without an event, and prices again as above.

## Toggles

- A toggle (`data-next-toggle-card`, a bump such as a warranty) has `type: 'toggle'`, `selector_id`
  `toggle:<package_id>`, its one line and no options; `selector.viewed` when half of it is on screen.
- While it is off its line is priced as if added: `selector.pricing`, then `selector.priced`;
  again when the rest of the cart, the coupons or its quantity change.
- `selector.selected` when it is switched on, `selector.deselected` when its line leaves the cart:
  switched off, removed, set to 0, or the cart cleared; both just before that change's `cart.updated`.
- Once on, its price comes with the cart on `cart.*`. A paid order empties the cart without events:
  no `selector.deselected`.

## What each event carries

- Every `selector.*` event carries the same `Selector`: `selector_id`, `type`, the picked `option_id`
  with its `lines` and `total`, the campaign's `currency`, and every option in `options`.
- A line has the product as in the cart, and is priced once its option has a price; an option has
  `total` and `original_total` once priced.
- The price that is paid comes with the cart on `cart.*`.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`         | When                                 | What the SDK does next                                                                       |
| ---------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `selector.price` | Options or a toggle cannot be priced | Each option keeps its last price, else shows its package price; the next change prices again |
