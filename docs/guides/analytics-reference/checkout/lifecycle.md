---
title: 'Checkout tracking'
group: 'Analytics Reference/Checkout'
---

# Checkout tracking

Tracking events: `checkout_started`, `checkout_contact_info_submitted`,
`checkout_shipping_address_submitted`, `checkout_shipping_method_submitted`,
`checkout_payment_info_submitted`.

![Checkout tracking: checkout.started sends checkout_started, user.created sends checkout_contact_info_submitted, a valid shipping address sends checkout_shipping_address_submitted and, once the cart is priced with a shipping method, checkout_shipping_method_submitted, and checkout.submitted sends checkout_payment_info_submitted; the shipping and payment events wait for checkout_started](checkout-lifecycle.svg)

| Tracking event                        | Sent by                                                    | When                                                                                                                 | `dl_*` push                               |
| ------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `checkout_started`                    | `checkout.started`                                         | Once per checkout; on its next page when the page that started it was left first                                     | `dl_begin_checkout`                       |
| `checkout_contact_info_submitted`     | `user.created`                                             | Once per checkout, when the contact details save an Open Cart                                                        | `dl_generate_lead`                        |
| `checkout_shipping_address_submitted` | `address.entered`, `checkout.started`                      | Once per checkout, when the shipping address is valid, after `checkout_started`                                      | `dl_add_shipping_info`                    |
| `checkout_shipping_method_submitted`  | `address.entered`, `shipping.selected`, `checkout.started` | Once per checkout, when the address is valid and the cart is priced with a shipping method, after `checkout_started` | `dl_add_shipping_info`, if not pushed yet |
| `checkout_payment_info_submitted`     | `checkout.submitted`                                       | Once per checkout, when a submit passes its checks, after `checkout_started`                                         | `dl_add_payment_info`                     |

`shipping.selected` counts once the cart is priced with the method. `dl_add_shipping_info` is pushed
once per checkout, for the first of the two shipping events. A paid order sends
`checkout_completed`: see [Order tracking](../orders/lifecycle.md). The once-rules across pages are
in [How analytics works](../how-it-works.md#each-event-comes-once).
