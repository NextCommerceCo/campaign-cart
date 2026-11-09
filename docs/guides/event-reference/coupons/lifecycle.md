---
title: 'Coupon lifecycle'
group: 'Event Reference/Coupons'
---

# Coupon lifecycle

Events: `coupon.*`, with the cart's `cart.updated`, `cart.calculating` and `cart.calculated`.

![Coupon lifecycle: held, checking, applied and removed on one cart, denied beside them, with the events each step sends](coupon-lifecycle.svg)

The lifecycle is one code's on one cart: entered with `next.actions.applyCoupon` or a
`data-next-coupon` form, checked against the cart, then on it or not. The Cart's `coupons` lists
the codes on it.

| State      | Means                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `held`     | Entered while the cart is empty or the campaign has not loaded; waits for the cart's first price. Kept across pages in this tab |
| `checking` | The cart is priced with and without the code                                                                                    |
| `applied`  | The code takes money off and is on the cart                                                                                     |
| `denied`   | The code is not applied; the cart does not change                                                                               |
| `removed`  | The code was taken off the cart                                                                                                 |

| From               | What happens                                                                           | To                             | Events, in order                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| none               | A code is entered, the cart has lines and the campaign has loaded                      | `checking`                     | none                                                                                                                     |
| none               | A code is entered while the cart is empty, or before the campaign loads                | `held`                         | none                                                                                                                     |
| none               | The code is already on the cart (a bundle card's own code too), held, or being checked | `denied`                       | `coupon.denied` (`reason: 'duplicate'`)                                                                                  |
| `held`             | The cart is priced, with lines                                                         | `checking`                     | none, after `cart.calculated`                                                                                            |
| `checking`         | The code takes money off: a new discount, or a lower total                             | `applied`                      | `cart.updated`, `coupon.applied` (with `amount` and `discounts`), then `cart.calculating`, `cart.calculated`             |
| `checking`         | The code takes nothing off this cart                                                   | `denied`                       | `coupon.denied` (`reason: 'no_discount'`)                                                                                |
| `checking`         | The code cannot be checked                                                             | `denied`                       | `sdk.error` (`coupon.check`), `coupon.denied` (`reason: 'check_failed'`, with `message`)                                 |
| `checking`         | The cart froze for an order before the check ended                                     | none; a held code stays `held` | none; `applyCoupon` resolves `false`, or keeps waiting for a held code                                                   |
| `held`, `checking` | `removeCoupon`, or the cart is cleared                                                 | none                           | none; `applyCoupon` resolves `false`                                                                                     |
| `applied`          | `removeCoupon`                                                                         | `removed`                      | `cart.updated`, `coupon.removed` (`reason: 'shopper'`), then `cart.calculating`, `cart.calculated` if the cart has lines |
| `applied`          | The cart is cleared                                                                    | `removed`                      | `cart.updated`, `cart.removed` if it had lines, `coupon.removed` (`reason: 'cleared'`)                                   |

## Checks

- `next.actions.applyCoupon` resolves `true` once the code is applied, and `false` when it is
  denied or dropped.
- Codes are trimmed and uppercased; an empty code resolves `false` with no event.
- Codes are checked one at a time, each against the codes already on the cart, so two codes that
  do not stack are not both applied.
- The price without the code is the cart's settled one; after a failed cart price the check prices
  the cart again.

## Held codes

- Kept across pages in this tab: a held code still waiting on a later page is checked there once
  the cart is priced.
- Held codes are checked in the order entered, after each `cart.calculated`, until none is left.
- `applyCoupon` for a held code resolves when it is checked, if that happens on the same page. The
  0.4.x `next.applyCoupon` resolves `true` at once for a code it holds.

## Duplicates

- A code already on the cart, held, or being checked is denied at once, without a request; a bundle
  card's own code counts as on the cart.
- `removeCoupon` for a code that is not on the cart, nor held, does nothing.

## Frozen cart

- While an order is being placed the cart is frozen: `applyCoupon` resolves `false`,
  `removeCoupon` does nothing, and no coupon event is sent.
- A check that ends after the cart froze applies nothing and sends nothing; a held code stays held
  and is checked at the next `cart.calculated` once the cart unfreezes.
- A paid order empties the cart without coupon events; an `applyCoupon` still waiting resolves
  `false`.

## The cart

- Applying or removing a code is a cart change: `cart.updated`, then the cart is priced again.
- The cart's own `discounts`, or `shipping_method.discounts` for shipping, list the code with
  `source` `coupon` and the same `code` from the next `cart.calculated`, and follow the cart.
- Applying or removing a code prices every selector's options again; see the selector lifecycle.

## What each event carries

- `coupon.*`: the `code`, uppercase.
- `coupon.applied`: what the code takes off this cart, as `amount` and the `discounts` with its
  `code`; neither when the priced cart lists no discount with the code.
- `coupon.denied`: the `reason`; with `check_failed` a `message` for developers and logs.
- `coupon.removed`: `reason` `shopper` for `removeCoupon`, `cleared` for a cleared cart.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`         | When                      | What the SDK does next                                                                          |
| ---------------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| `coupon.check`   | A code cannot be checked  | `coupon.denied` with `reason: 'check_failed'`; `applyCoupon` resolves `false`                   |
| `cart.calculate` | The cart cannot be priced | Held codes wait for the next `cart.calculated`; a check prices the cart without the code itself |
