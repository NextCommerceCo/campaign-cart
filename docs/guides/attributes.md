# Attributes

Everything the SDK reads from a page. The SDK sets classes and attributes; pages own their
CSS. Names marked _0.4.x_ are kept for old templates (see
[migrating-from-0.4.md](migrating-from-0.4.md)).

## Setup

```html
<script type="module" src=".../loader.js" data-campaign="pk_…" data-funnel="my-funnel"></script>
```

| Attribute / tag         | Meaning                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `data-campaign`         | Campaign API key. _0.4.x:_ `nextConfig.apiKey`, `<meta name="next-api-key">`                      |
| `data-funnel`           | Storage scope: two funnels on one domain never share a cart. _0.4.x:_ `<meta name="next-funnel">` |
| `html[data-next-ready]` | Set by the SDK when values are on the page (also 0.4.x's `next-display-ready` class)              |

## Values

| Attribute                           | Meaning                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `data-next-display="<path>"`        | Writes a value. Money and percentages are formatted in the campaign currency |
| `data-next-show` / `data-next-hide` | `path`, `!path`, `path == 'x'`, `path != 'x'`; `path()` also accepted        |
| `data-next-format`                  | Overrides the format (`currency`, `percentage`, …)                           |

Paths: `cart.*` (total, subtotal, shipping, discountAmount, savingsAmount, savingsPercentage,
quantity, itemCount, hasItems, isEmpty, hasCoupon, discountCode, isCalculating, …),
`shipping.*` (name, code, cost, isFree), `campaign.*`, `param.<name>`, `package.<id>.*`
(or `package.*` inside `[data-next-package-id]`), `bundle.<selector or card id>.*`,
`toggle.<package id>.*`, and on post-purchase pages `order.*`.

## Bundles

| Attribute                                                                                                | Meaning                                                                       |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `data-next-bundle-selector`, `data-next-selector-id`                                                     | A group of cards; one is picked. _0.4.x:_ `data-next-id`                      |
| `data-next-selection-mode="swap\|select"`                                                                | `swap` (default) puts the pick in the cart; `select` only records it          |
| `data-next-bundle-card`, `data-next-bundle-id`                                                           | A card                                                                        |
| `data-next-bundle-items='[{"packageId":1,"quantity":2,"configurable":true}]'`                            | The card's lines; `configurable` makes one slot per unit                      |
| `data-next-bundle-vouchers`, `data-next-shipping-id`                                                     | Vouchers and shipping method that come with the card                          |
| `data-next-selected="true"`                                                                              | The card picked first (the cart's own pick wins after a reload)               |
| `data-next-quantity`, `data-next-min-quantity`, `data-next-max-quantity`                                 | Card quantity and its limits                                                  |
| `data-next-bundle-qty-for="<selector id>"` with `data-next-quantity-increase` / `-decrease` / `-display` | Quantity stepper                                                              |
| `data-next-bundle-display="<prop>"`                                                                      | A card's own value (price, originalPrice, discountPercentage, hasDiscount, …) |
| `data-next-bundle-slot-template-id`, `data-next-bundle-slots-for`                                        | Multi-variant slots: template and where they are drawn                        |
| `data-next-variant-selectors`                                                                            | Inside a slot template: variant `<select>`s are drawn here                    |
| `data-next-property="<name>"`                                                                            | Inside a slot or bump: a personalisation sent with that line                  |
| `data-next-default-property="<name>"`                                                                    | A page-wide personalisation added to every line…                              |
| `data-next-exclude-property="<name,…\|*>"`                                                               | …except on this card                                                          |
| `data-next-upsell-context`                                                                               | Cards priced as a post-purchase offer (`?upsell=true`)                        |

## Order bumps and cart

| Attribute                                                      | Meaning                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `data-next-toggle-card`, `data-next-package-id`                | A bump that adds or removes its package. `data-next-is-upsell="true"` flags the line                                     |
| `data-next-package-sync` / `data-next-product-sync`            | The bump's quantity follows these packages / products in the cart                                                        |
| `data-next-toggle-display`, `data-next-toggle-image`           | The bump's own values and image                                                                                          |
| `data-next-action="add-to-cart"`                               | With `data-next-package-id` (+ `data-next-quantity`) or `data-next-selector-id`; `data-next-clear-cart`, `data-next-url` |
| `data-next-cart-summary`                                       | Cart lines and totals                                                                                                    |
| `data-next-coupon`, `data-next-remove-item`, quantity controls | Cart editing controls                                                                                                    |

## Checkout

| Attribute                                                                                                  | Meaning                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form[data-next-checkout]`                                                                                 | Loads the checkout chunk                                                                                                                                                                                                            |
| `data-next-checkout-field="<name>"`                                                                        | email, first_name, last_name, line1, line2, city, state, postcode, country, phone_number, accepts_marketing; `billing-` prefix for billing. _0.4.x:_ fname, lname, address1, address2, province, postal, phone, `os-checkout-field` |
| `data-next-required="true"` / `required`                                                                   | On the phone field: make it required                                                                                                                                                                                                |
| `input[name="use_shipping_address"]`, `data-next-component="different-billing-address"` / `"billing-form"` | Same-as-shipping toggle, billing section, rows cloned from `shipping-field-row`                                                                                                                                                     |
| `data-next-component="location"`                                                                           | Shown once a street address is typed                                                                                                                                                                                                |
| `input[name="payment_method"]`, `data-next-payment-method`, `data-next-payment-form`                       | Payment choice and its panels                                                                                                                                                                                                       |
| `data-next-checkout-field="cc-number" / "cvv" / "exp-month" / "exp-year"`                                  | Card fields (payment.js)                                                                                                                                                                                                            |
| `data-next-express-checkout="container" / "buttons"`                                                       | Express buttons are added here                                                                                                                                                                                                      |
| `data-next-component="<method>-error"` (+ `-error-text`)                                                   | Where order and payment errors are shown                                                                                                                                                                                            |
| `data-next-checkout-step="<next url>"`, `data-next-step-number`                                            | Multi-step checkout                                                                                                                                                                                                                 |
| `data-next-checkout-review="<field>"`                                                                      | Shows what was entered (email, address, phone, shippingMethod.name, …)                                                                                                                                                              |
| `<meta name="next-success-url">`, `next-failure-url`                                                       | Where the shopper goes after paying                                                                                                                                                                                                 |

## Upsell and receipt

| Attribute                                          | Meaning                                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `data-next-upsell="offer"`                         | An offer; its first bundle selector supplies the lines (or `data-next-package-id`)                       |
| `data-next-upsell-action="add\|skip"`              | Accept or decline; `data-next-url` or `<meta name="next-upsell-accept-url">` / `-decline-url`            |
| `[data-next-order-items]`, `data-item-template-id` | Order lines from a template with `{item.name}`, `{item.quantity}`, `{item.lineTotal}`, `{item.image}`, … |

## Page widgets

`data-next-accordion` (with `-trigger`, `-panel`, `-text`) and `data-next-tooltip`.
