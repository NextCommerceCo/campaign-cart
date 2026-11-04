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

| From      | What happens                                                        | To        | Events                                                    |
| --------- | ------------------------------------------------------------------- | --------- | --------------------------------------------------------- |
| `entered` | The code takes money off, or the cart is still empty                | `applied` | `cart.updated`, `coupon.applied`, then the cart is priced |
| `entered` | The code takes nothing off                                          | `denied`  | `coupon.denied`                                           |
| `applied` | A code applied to an empty cart takes nothing off once it is priced | `denied`  | `coupon.denied`, `cart.updated`                           |
| `applied` | The code is removed                                                 | `removed` | `cart.updated`, `coupon.removed`                          |

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`       | When                       | What the SDK does next                                  |
| -------------- | -------------------------- | ------------------------------------------------------- |
| `coupon.check` | A coupon cannot be checked | The code is not applied; `applyCoupon` resolves `false` |
