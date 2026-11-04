---
title: 'Payment lifecycle'
group: 'Event Reference/Payments'
---

# Payment lifecycle

![Payment lifecycle: at the gateway, then paid or not paid, with the events each step sends](payment-lifecycle.svg)

A payment that leaves the page: PayPal, Klarna, a wallet, 3-D Secure, or any order the store
creates with a `payment_complete_url`. A card paid at once never comes here; see the checkout
lifecycle. `payment.selected`, the method picked in the form, is a checkout event.

| State            | Means                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| `at the gateway` | The order exists unpaid; the shopper pays at its `payment_complete_url`  |
| `paid`           | The gateway took the payment; the next page loads the order              |
| `not paid`       | The gateway sent the shopper back unpaid; the checkout has the same cart |

| From             | What happens                                                                           | To                         | Events, in order                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| none             | On the checkout, the order is created with a `payment_complete_url`                    | `at the gateway`           | `payment.redirected` (`method`, `ref_id`, `url`), then the shopper is redirected to `url`; no `order.created` |
| `at the gateway` | Paid; the gateway redirects the shopper to the next page, which loads the order        | `paid`                     | `order.loaded`, then `order.paid` the first time; the cart kept for the order is emptied without cart events  |
| `at the gateway` | Not paid; the gateway redirects the shopper back with `payment_failed=true` in the URL | `not paid`                 | `payment.failed` (`method`, `ref_id`, `error` with `code: 'payment_failed'`), once per order                  |
| `at the gateway` | The shopper comes back without paying, such as with the browser's Back button          | none, back on the checkout | none                                                                                                          |
| `not paid`       | The shopper submits again                                                              | none, back on the checkout | a new order, from `submitting` in the checkout lifecycle                                                      |

`order.created` never comes for a gateway payment: the store has the order's details once it is
paid, and `order.loaded` carries them. The next page is `next-success-url`, else `/success` on the
site, with the order's `order_ref_id`; see the order lifecycle.

`payment.failed` comes on the page the gateway sends the shopper back to, when its URL has
`payment_failed=true` and no `ref_id`: the checkout itself, or the `next-failure-url` page; the
store adds `payment_failed=true` and `payment_method` to either. The order is not loaded, since
the store has nothing to load until it is paid. `method` is the URL's `payment_method`, else the
express button's method, else the method picked in the form. The shopper is back in the same checkout with the same cart, so
`checkout.started` does not come again, and `param.payment_failed` is `'true'` for
`data-next-show`.

## Errors

A payment the gateway does not take is not an SDK failure: `payment.failed` comes without
`sdk.error`. The SDK lifecycle lists every action and `code`.

| `action`     | When                                             | What the SDK does next                              |
| ------------ | ------------------------------------------------ | --------------------------------------------------- |
| `order.load` | The page after the gateway cannot load the order | No `order.loaded` or `order.paid`; the cart is kept |
