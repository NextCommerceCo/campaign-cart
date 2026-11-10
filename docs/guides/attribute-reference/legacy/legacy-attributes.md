---
title: 'Legacy attributes'
group: 'Attribute Reference/Legacy'
order: 901
---

# Legacy attributes

Every attribute below still works, on every page, the way it did. New pages use the attributes in
this reference; this page says what each old one became. Names from 0.4.x are in
[Migrating from 0.4.x](../../migrating-from-0.4.md).

The SDK keeps setting the classes it set before (`next-selected`, `next-active`, `next-in-cart`,
`next-loading`, `next-hidden`, …), so page CSS keeps working; new pages style the attributes
instead (`[data-next-selected]`, `[data-next-loading]`, `[hidden]`).

## Converting a page

From a checkout of this repository, `node scripts/migrate.mjs page.html styles.css` says what it
would change in each file, and `--write` changes it. It rewrites only the attributes in the table
below, leaves every other character as it was, and lists what it left on the old attributes:
coupons, cart summaries, order item lists, payment method lists, a selector with variant slots,
and any path with no new field. A page can mix both sets, so the result works as it stands.

## Attributes

| Old                                                                                                        | Now                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `data-next-display="path"`                                                                                 | [`data-next-query`](../display/data-next-query.md), with the [new path names](#paths)                                          |
| `data-next-bundle-display`, `data-next-toggle-display`, `data-next-checkout-review`                        | `data-next-query` inside the option, or on `checkout.*`                                                                        |
| `data-next-toggle-image`                                                                                   | `<img data-next-query="lines.0.image">`                                                                                        |
| `data-next-fallback`                                                                                       | `data-next-empty`                                                                                                              |
| `data-next-bundle-selector`, `data-next-selector-id`, `data-next-selection-mode="select"`                  | [`data-next-selector="<id>"`](../objects/selector.md), `data-next-defer`                                                       |
| `data-next-bundle-card`, `data-next-bundle-id`                                                             | `data-next-option="<id>"`                                                                                                      |
| `data-next-bundle-items='[{"packageId":1,"quantity":3}]'`                                                  | `data-next-items="1x3"`                                                                                                        |
| `data-next-bundle-vouchers='["CODE"]'`                                                                     | `data-next-vouchers="CODE"`                                                                                                    |
| `data-next-upsell-context`, `data-next-upsell="offer"`                                                     | an option on a page opened with `?ref_id`                                                                                      |
| `data-next-toggle-card` (+ `data-next-package-id`, `data-next-quantity`)                                   | `data-next-option="<id>" data-next-items="9"` on its own                                                                       |
| `data-next-toggle-container`                                                                               | — (style the option)                                                                                                           |
| `data-next-package-sync`, `data-next-product-sync`                                                         | — (legacy only)                                                                                                                |
| `data-next-is-upsell`                                                                                      | — (legacy only)                                                                                                                |
| `data-next-bundle-qty-for`, `data-next-quantity-increase` / `-decrease` / `-display`                       | `data-next-for="selector.main"` with `data-next-action="setQuantity" data-next-quantity="+1"` and `data-next-query="quantity"` |
| `data-next-bundle-slot-template-id`, `data-next-bundle-slots-for`, `data-next-variant-selectors`           | `data-next-slots` on the option, `data-next-each="slots"`, `data-next-field="variants.<code>"`                                 |
| `data-next-property`, `data-next-default-property`, `data-next-exclude-property`                           | `data-next-field="properties.<name>"`                                                                                          |
| `data-next-discounts`                                                                                      | `data-next-each="discounts"`                                                                                                   |
| `data-next-cart-summary`, `data-summary-lines`, `{item.*}` tokens                                          | [`data-next-each="cart.lines"`](../display/data-next-each.md) and `data-next-query`                                            |
| `data-next-order-items`, `data-item-template-*`                                                            | `data-next-each="order.lines"`                                                                                                 |
| `data-next-action="add-to-cart"`, `data-next-clear-cart`, `data-next-url`                                  | [`data-next-action="addItem"`](../actions/data-next-action.md), `data-next-replace`, `data-next-go`                            |
| `data-next-quantity="increase"`, `data-next-remove-item`, `data-step`, `data-min`, `data-max`              | `data-next-action="setQuantity" data-next-quantity="+1"`, `removeItem`, `data-next-min-quantity`, `data-next-max-quantity`     |
| `data-next-coupon`                                                                                         | `<form data-next-action="applyCoupon">` with `data-next-field="code"`                                                          |
| `data-next-upsell-action="add"` / `"skip"`, `<meta name="next-upsell-accept-url">`                         | `data-next-action="acceptUpsell"` / `"skipUpsell"` with `data-next-go`                                                         |
| `data-next-checkout-field`, `billing-<field>`, `cc-number`, `exp-month` / `exp-year`                       | [`data-next-field`](../inputs/data-next-field.md): names of the model, `card.expiry`                                           |
| `input[name="use_shipping_address"]`, `data-next-component="different-billing-address"` / `"billing-form"` | `data-next-field="billing_same_as_shipping"`, `data-next-address="billing"`                                                    |
| `data-next-payment-method`, `data-next-payment-form`, `input[name="payment_method"]`                       | [`data-next-payment`](../widgets/data-next-payment.md)                                                                         |
| `data-next-express-checkout="container"` / `"buttons"`                                                     | [`data-next-express`](../widgets/data-next-express.md)                                                                         |
| `data-next-component="credit-error"` / `"<method>-error"`, `.next-error-label`                             | `data-next-query="checkout.errors.payment"` / `checkout.errors.<field>`                                                        |
| `<meta name="next-success-url">`, `data-next-checkout-step="<url>"`                                        | `data-next-go` on the form, `data-next-step`                                                                                   |
| `data-next-required`                                                                                       | `required`                                                                                                                     |
| `label.label-checkout`, `data-label-behavior` (floating labels)                                            | — (CSS `:placeholder-shown`, `:focus-within`)                                                                                  |
| `data-next-format="currency"`, `"percentage"`                                                              | the same, and `currency_code`, `currency_rounded`, `number`, `amount`                                                          |

## Paths

`data-next-query`, `next.query()` and events share snake_case field names. A path the old
attributes read keeps its old meaning there.

| Old path                                                                           | Now                                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `cart.discountAmount`, `cart.totalDiscount`                                        | `cart.total_discount`                                                     |
| `cart.discountPercentage`, `cart.totalDiscountPercentage`                          | `cart.discount_percentage`                                                |
| `cart.hasItems`, `cart.isEmpty`, `cart.itemCount`                                  | `cart.lines` (as a condition, or its count)                               |
| `cart.discountCode`, `cart.hasCoupon`                                              | `cart.coupons.0`, `cart.coupons`                                          |
| `shipping.cost`, `shipping.isFree`                                                 | `cart.shipping_method.price`, `cart.shipping_method.price == 0`           |
| `package.42.price`, `package.42.total`                                             | `package.42.price`, `package.42.total`                                    |
| `bundle.main.price`, `bundle.three.unitPrice`                                      | `selector.main.total`, `selector.main.options.three.price`                |
| `bundle.*.originalPrice`, `bundle.*.discountAmount`, `bundle.*.discountPercentage` | `subtotal`, `total_discount`, `discount_percentage`                       |
| `toggle.9.isSelected`                                                              | `selector.<option id>.in_cart`                                            |
| `order.customer.firstName`, `order.discounts`, `order.supportsUpsells`             | `order.user.first_name`, `order.total_discount`, `order.supports_upsells` |
| `hasDiscount`, `hasSavings` and other yes/no paths                                 | a condition: `total_discount > 0`                                         |
