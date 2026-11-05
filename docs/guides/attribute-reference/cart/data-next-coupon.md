---
title: 'data-next-coupon'
group: 'Attribute Reference/Cart'
order: 404
---

# data-next-coupon

A coupon field. The code in its input is applied when the button is clicked or Enter is pressed.

```html
<div data-next-coupon>
  <input type="text" placeholder="Coupon code" />
  <button type="button">Apply</button>
</div>
```

`data-next-coupon` can also sit on the `<input>` itself, with no button. Without an input a
warning is logged.

A code is kept only when the server gives a discount for it; otherwise
[coupon.denied](/event-reference/coupons/coupon.denied) is sent and the code stays in the input.
A code entered on an empty cart is checked once the cart is first priced. The input is cleared
once the code is applied.

Show the applied codes with [data-next-display](../values/data-next-display.md):
`cart.hasCoupon`, `cart.discountCode`, `cart.discountAmount`.

## Set by the SDK

| On the button   | When                                   |
| --------------- | -------------------------------------- |
| `next-loading`  | The code is being checked; clicks wait |
| `next-disabled` | The input is empty                     |

## Events

[coupon.applied](/event-reference/coupons/coupon.applied),
[coupon.denied](/event-reference/coupons/coupon.denied); see the
[Coupon lifecycle](../../event-reference/coupons/lifecycle.md).
