---
title: 'Coupon lifecycle'
group: 'Event Reference/Coupons'
---

# Coupon lifecycle

![Coupon lifecycle: entered, applied, denied and removed, with the events each step sends](coupon-lifecycle.svg)

| State     | Means                                      |
| --------- | ------------------------------------------ |
| `entered` | A code is being checked against the cart   |
| `applied` | The code is on the cart                    |
| `denied`  | The code takes nothing off; it is not kept |
| `removed` | The code was taken off the cart            |

| From      | What happens                                                                    | To        | Events, in order                                                                         |
| --------- | ------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `entered` | The code takes money off, or the cart is still empty                            | `applied` | `cart.updated`, `coupon.applied`; a cart with packages is then priced                    |
| `entered` | The code takes nothing off                                                      | `denied`  | `coupon.denied`; the cart does not change                                                |
| `applied` | A code applied to an empty cart takes nothing off once the cart is first priced | `denied`  | `coupon.denied`, then `cart.updated` as the code comes off, and the cart is priced again |
| `applied` | The code is taken off                                                           | `removed` | `cart.updated`, `coupon.removed`; a cart with packages is then priced                    |
| `applied` | The cart is cleared                                                             | `removed` | `cart.updated` only; no `coupon.removed`                                                 |

While the checkout has the cart frozen (submitting, placing), `applyCoupon` resolves `false`,
`removeCoupon` does nothing, and no coupon event is sent.

A coupon event carries the `code`. What it takes off is in the cart's `discounts`, or
`shipping_method.discounts` for shipping, with `source` `coupon` and the same `code`, on the next `cart.calculated`, and follows the cart as it changes.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`       | When                       | What the SDK does next                                  |
| -------------- | -------------------------- | ------------------------------------------------------- |
| `coupon.check` | A coupon cannot be checked | The code is not applied; `applyCoupon` resolves `false` |
