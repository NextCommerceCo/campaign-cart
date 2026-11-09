---
title: 'Recipes/Coupon field'
group: 'Recipes'
category: 'Recipes'
order: 8
---

# Coupon field

A code box with an Apply button, a line saying why a code was not applied, and each applied code
with what it takes off and a Remove button.

```html
<form data-next-action="applyCoupon">
  <input data-next-field="code" placeholder="Coupon code" />
  <button>Apply</button>
</form>
<p data-next-show="errors.code">This code cannot be used on this order.</p>

<div data-next-each="cart.discounts">
  <template>
    <p data-next-show="source == coupon">
      <span data-next-query="code"></span> −<span data-next-query="amount"></span>
      <button data-next-action="removeCoupon">Remove</button>
    </p>
  </template>
</div>
```

The form sends its `code` field to `applyCoupon` on submit. A code that takes nothing off is
refused: `errors.code` holds the reason until a code is applied, in the SDK's English for
developers, so the page shows its own words. Each row of `cart.discounts` is one offer on the
products; a row whose `source` is `coupon` has the `code`, and `removeCoupon` inside it takes that
code off. For the codes alone, a `data-next-each="cart.coupons"` row reads its code as `value`.

| Style                                       | When                      |
| ------------------------------------------- | ------------------------- |
| `form[data-next-action][data-next-loading]` | the code is being checked |
| `form[data-next-action][data-next-invalid]` | the last code was refused |
| `[data-next-each][data-next-empty]`         | no discount on the cart   |

**Events**: `coupon.applied`, `coupon.denied` (with its `reason`) or `coupon.removed`.

**See also**: [data-next-action](../attribute-reference/actions/data-next-action.md) for arguments
and errors, [Cart](../attribute-reference/objects/cart.md) for `discounts` and `coupons`.
