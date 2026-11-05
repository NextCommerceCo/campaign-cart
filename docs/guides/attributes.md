---
title: 'Attributes'
group: 'Attribute Reference'
order: 0
---

# Attributes

Everything the SDK reads from a page, one page per attribute in the **Attribute Reference**. The
SDK sets classes and attributes; pages own their CSS. Names from 0.4.x still work and are listed
on each page (see [Migrating from 0.4.x](migrating-from-0.4.md)).

## Attribute Reference

### Setup

| Page                                                            | For                                                                  |
| --------------------------------------------------------------- | -------------------------------------------------------------------- |
| [Loader script](attribute-reference/setup/loader-script.md)     | `data-campaign`, `data-funnel`: loading the SDK                      |
| [data-next-ready](attribute-reference/setup/data-next-ready.md) | Set on `<html>` once values are on the page                          |
| [URL parameters](attribute-reference/setup/url-parameters.md)   | `forcePackageId`, `forceBundleId`, `reset`, `debug`, kept parameters |

### Values

| Page                                                                            | For                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------ |
| [data-next-display](attribute-reference/values/data-next-display.md)            | Writes a value, and every path it can name |
| [data-next-show / data-next-hide](attribute-reference/values/data-next-show.md) | Shows or hides an element on a condition   |
| [data-next-format](attribute-reference/values/data-next-format.md)              | Overrides how a value is formatted         |

### Bundles

| Page                                                                                  | For                                      |
| ------------------------------------------------------------------------------------- | ---------------------------------------- |
| [data-next-bundle-selector](attribute-reference/bundles/data-next-bundle-selector.md) | A group of cards, one picked             |
| [data-next-bundle-card](attribute-reference/bundles/data-next-bundle-card.md)         | A card: its lines, vouchers and shipping |
| [data-next-bundle-display](attribute-reference/bundles/data-next-bundle-display.md)   | A card's own prices and discount         |
| [Quantity stepper](attribute-reference/bundles/data-next-bundle-qty-for.md)           | `data-next-bundle-qty-for`               |
| [Variant slots](attribute-reference/bundles/data-next-bundle-slot-template-id.md)     | One slot per unit, with variant selects  |
| [Personalisation properties](attribute-reference/bundles/data-next-property.md)       | Properties sent with a line              |
| [data-next-upsell-context](attribute-reference/bundles/data-next-upsell-context.md)   | Cards priced as a post-purchase offer    |
| [data-next-discounts](attribute-reference/bundles/data-next-discounts.md)             | A card's discounts, from a template      |

### Cart

| Page                                                                           | For                                    |
| ------------------------------------------------------------------------------ | -------------------------------------- |
| [data-next-action="add-to-cart"](attribute-reference/cart/data-next-action.md) | A button that adds a package or a pick |
| [data-next-toggle-card](attribute-reference/cart/data-next-toggle-card.md)     | An order bump                          |
| [data-next-cart-summary](attribute-reference/cart/data-next-cart-summary.md)   | Cart lines and totals                  |
| [data-next-coupon](attribute-reference/cart/data-next-coupon.md)               | A coupon field                         |
| [Remove and quantity controls](attribute-reference/cart/cart-controls.md)      | Editing cart lines                     |

### Checkout

| Page                                                                                     | For                                        |
| ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| [data-next-checkout](attribute-reference/checkout/data-next-checkout.md)                 | The form, and where a paid order goes      |
| [data-next-checkout-field](attribute-reference/checkout/data-next-checkout-field.md)     | Every field name                           |
| [data-next-address](attribute-reference/checkout/data-next-address.md)                   | The country's address fields               |
| [Phone field](attribute-reference/checkout/phone-field.md)                               | Flag, mask and E.164                       |
| [Billing address](attribute-reference/checkout/billing-address.md)                       | Same-as-shipping toggle and billing fields |
| [data-next-lead](attribute-reference/checkout/data-next-lead.md)                         | When the shopper is saved as a lead        |
| [Payment methods](attribute-reference/checkout/payment-methods.md)                       | Method radios, panels and card fields      |
| [data-next-express-checkout](attribute-reference/checkout/data-next-express-checkout.md) | Apple Pay, Google Pay and PayPal buttons   |
| [Error messages](attribute-reference/checkout/error-messages.md)                         | Where order and payment errors show        |
| [data-next-checkout-step](attribute-reference/checkout/data-next-checkout-step.md)       | Multi-step checkout                        |
| [data-next-checkout-review](attribute-reference/checkout/data-next-checkout-review.md)   | What was entered on an earlier step        |
| [Floating labels](attribute-reference/checkout/floating-labels.md)                       | `has-value` and `is-focused` on labels     |

### Upsells

| Page                                                                              | For                        |
| --------------------------------------------------------------------------------- | -------------------------- |
| [data-next-upsell](attribute-reference/upsells/data-next-upsell.md)               | A post-purchase offer      |
| [data-next-upsell-action](attribute-reference/upsells/data-next-upsell-action.md) | Accept and decline buttons |

### Orders

| Page                                                                         | For                         |
| ---------------------------------------------------------------------------- | --------------------------- |
| [data-next-order-items](attribute-reference/orders/data-next-order-items.md) | Order lines from a template |
| [order.\* values](attribute-reference/orders/order-values.md)                | Every `order.*` path        |

### Promotions

| Page                                                                         | For                                       |
| ---------------------------------------------------------------------------- | ----------------------------------------- |
| [data-next-promotion](attribute-reference/promotions/data-next-promotion.md) | Banners, cards and links that are tracked |

The 0.4.x page widgets (`data-next-timer`, `data-next-accordion`, `data-next-tooltip`, scroll hint)
are deprecated; see [Page widgets](migrating-from-0.4.md#page-widgets).
