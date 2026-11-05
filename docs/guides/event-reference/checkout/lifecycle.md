---
title: 'Checkout lifecycle'
group: 'Event Reference/Checkout'
---

# Checkout lifecycle

Events: `checkout.*`, `user.*`, `address.*` and `payment.selected`, with the order's
`order.created` and `order.paid` and the gateway's `payment.redirected` and `payment.failed`.

![Checkout lifecycle: idle, placing and placed on one checkout page, with the events each step sends and the pages it leaves for](checkout-lifecycle.svg)

The lifecycle is one checkout page's. Every checkout page starts at `idle`: the first page, a
later step, a reload, or a return from the gateway. The debug panel shows the state.

| State     | Means                                                                                    |
| --------- | ---------------------------------------------------------------------------------------- |
| `idle`    | The shopper fills in the form, and fixes what a submit pointed out                       |
| `placing` | The SDK checks the form, the cart and the card, then sends the order; the cart is frozen |
| `placed`  | The order is created; the page redirects to the next page, or to the gateway             |

| From      | What happens                                                                                  | To                              | Events, in order                                                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| none      | A checkout page loads and binds its form                                                      | `idle`                          | `payment.failed` when back from the gateway unpaid (`payment_failed=true` in the URL); else none                                                      |
| `idle`    | The cart has lines, at once or when the first lines arrive                                    | `idle`                          | `checkout.started`, once per checkout: a step, a reload or a return from the gateway sends nothing; when lines arrive, after that change's own events |
| `idle`    | The shopper fills in the form                                                                 | `idle`                          | in any order: `user.created`, `user.updated`, `address.autofilled`, `address.entered`, `address.updated`, `payment.selected`                          |
| `idle`    | On a step of a multi-step form (`data-next-checkout-step`), a submit passes the step's checks | `idle`, on the next step's page | `checkout.continued`                                                                                                                                  |
| `idle`    | A step's submit does not pass its checks                                                      | `idle`                          | `checkout.invalid` (with the `errors`)                                                                                                                |
| `idle`    | On the last page, the shopper submits, or uses an express button                              | `placing`                       | none; the cart freezes                                                                                                                                |
| `placing` | A check fails: a field, an empty cart, or the card                                            | `idle`                          | `checkout.invalid` (with the `errors`)                                                                                                                |
| `placing` | The checks pass and the card is tokenized                                                     | `placing`                       | `checkout.submitted`, then the order is sent                                                                                                          |
| `placing` | The order is not created: refused, or the request fails                                       | `idle`                          | `sdk.error` (`order.create`), `checkout.failed` (with `error`)                                                                                        |
| `placing` | The card is declined                                                                          | `idle`                          | `payment.failed` (`code: 'declined'`)                                                                                                                 |
| `placing` | The order is created without a `payment_complete_url`: it is paid at once                     | `placed`                        | `order.created` (`paid: true`), `order.paid`, `checkout.completed`; then the page redirects to the next page, which loads the order                   |
| `placing` | The order is created with a `payment_complete_url`                                            | `placed`                        | `order.created` (`paid: false`), `payment.redirected`; then the page redirects to the gateway. See the payment lifecycle                              |

## Once per checkout

- `checkout.started` comes once, and the Checkout's `id` names the checkout: its steps, reloads and
  a return from a gateway keep the same `id`. A paid order ends it; the next checkout gets a new one.
- The 0.4.x `checkout:started` still comes on each checkout page.
- Every form event comes after `checkout.started`: details entered before the cart has lines are
  checked once the checkout starts.
- The method the form starts with is the Checkout's `payment_method`; `payment.selected` comes only
  when the shopper changes it.

## Express buttons

An express button (Apple Pay, Google Pay, PayPal, … in `data-next-express-checkout`) pays with the
wallet's details:

- The form is not checked, only that the cart has lines, unless the 0.4.x
  `nextConfig.paymentConfig.expressCheckout.requireValidation` asks for its fields.
- PayPal or Klarna picked as the payment method in the form gets the full checks, like a card.

## The cart

- Frozen while `placing`; unfreezes when a check fails or the order is not created.
- A paid order empties it without cart events; `checkout.completed` ends the checkout.
- While the shopper is at a gateway it is kept until the paid order loads, so a shopper whose
  payment fails comes back to the same cart.
- `shipping.selected` is in the cart lifecycle.

## The next page

- `next-success-url`, with the order's `ref_id`.
- Without it, an order paid at once goes to the store's order status page, where the SDK does not
  run: no `order.loaded` there, and the checkout page logs an error when its form is bound. After a
  gateway, the shopper goes to `/success` on the site.
- After a failed payment, `param.payment_failed` is `'true'` on the checkout, for `data-next-show`.

## What each event carries

- `checkout.*`: the Checkout, with the Cart as `cart`, the `user`, the addresses,
  `billing_same_as_shipping` and `payment_method`; `errors` on `checkout.invalid`, `error` on
  `checkout.failed` and the order's `ref_id` on `checkout.completed`.
- `user.*`: the User.
- `address.*`: the Address with its `type`; `address.autofilled` only the fields it filled.
- `payment.selected`: the Payment.

## User

![User lifecycle: no user yet, saving, created and not saved, with the events each step sends](user-lifecycle.svg)

The lifecycle is the lead's: one shopper on one checkout, saved with an Open Cart. The Checkout's
`user` is the User from `user.created` on.

| State         | Means                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| `no user yet` | The checkout has not started, or what `data-next-lead` asks for is not in |
| `saving`      | The Open Cart is being created                                            |
| `not saved`   | The Open Cart was not created; the details are kept                       |
| `created`     | The Open Cart exists; the Checkout has the `user`                         |

| From          | What happens                                                                                                         | To          | Events, in order                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------- |
| `no user yet` | What `data-next-lead` asks for is in: when the checkout starts, or when the shopper then leaves a field they changed | `saving`    | none; the Open Cart is sent                    |
| `saving`      | The store creates the Open Cart                                                                                      | `created`   | `user.created`                                 |
| `saving`      | The Open Cart is not created: refused, or the request fails                                                          | `not saved` | `sdk.error` (`user.save`)                      |
| `not saved`   | The shopper leaves the next field they changed, with the details still in                                            | `saving`    | none; the Open Cart is sent again              |
| `created`     | The details change and are still what `data-next-lead` asks for                                                      | `created`   | `user.updated`                                 |
| `created`     | The details change and are not                                                                                       | `created`   | none; the Checkout keeps the last valid `user` |

- What `data-next-lead` asks for: by default a first and last name of at least two characters each
  and a valid email; see [data-next-lead](../../attribute-reference/checkout/data-next-lead.md).
  With `off`, nothing is saved and no `user.*` comes.
- Checked each time the shopper leaves a field they changed, or picks an option. Once per checkout:
  a step, a reload or a return from the gateway keeps the saved user; a paid order starts over.
- The details are `first_name`, `last_name`, `email` when valid, `phone` once the address service
  read it, and `accepts_marketing`. The Open Cart keeps the first ones; the order takes the latest.
- `language`, `ip` and `user_agent` are what the store recorded with the Open Cart, else the
  campaign's language and the browser's user agent, with no `ip`; the same on every `user.updated`.

## Address

![Address lifecycle: loading rules, incomplete, suggesting and entered, with the events each step sends](address-lifecycle.svg)

The lifecycle is one address `type`'s on one checkout: `shipping`, and `billing` while it is
separate from shipping. The Checkout's `shipping_address` and `billing_address` are the Address
from `address.entered` on.

| State           | Means                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------- |
| `loading rules` | The country list, then the country's fields, are loading; a `data-next-address` shows nothing |
| `incomplete`    | A field the country requires is missing, or a filled field fails its check                    |
| `suggesting`    | A list of addresses is open under line 1                                                      |
| `entered`       | Every field passes its check; the Checkout has the Address                                    |

| From            | What happens                                                                                | To              | Events, in order                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| none            | The form is bound                                                                           | `loading rules` | none                                                                                                                           |
| `loading rules` | The country list and the country's rules load                                               | `incomplete`    | none                                                                                                                           |
| `loading rules` | The country list, or the country's rules, cannot load                                       | `incomplete`    | `sdk.error` (`address.load_rules`); the campaign's countries for the list, a built-in layout and simpler checks for the fields |
| `incomplete`    | The shopper picks another country                                                           | `loading rules` | none; the state is emptied and the phone read again, then the address is checked again                                         |
| `incomplete`    | Two words are in line 1, with `addressConfig.enableAutocomplete`                            | `suggesting`    | none; `sdk.error` (`address.suggest`) and no list when the lookup fails                                                        |
| `suggesting`    | The list closes: Escape, a click elsewhere, or line 1 back under two words                  | `incomplete`    | none                                                                                                                           |
| `suggesting`    | The shopper picks a suggestion                                                              | `incomplete`    | `address.autofilled` with the fields it fills; then line 1, the city, the postcode, the country and the state change           |
| `incomplete`    | The shopper leaves a field they changed and every field is valid, once the checkout is open | `entered`       | `address.entered`                                                                                                              |
| `entered`       | The address changes, the name and the phone included, and is still valid                    | `entered`       | `address.updated`                                                                                                              |
| `entered`       | The address changes and is not                                                              | `entered`       | none; the Checkout keeps the last valid Address                                                                                |

### The country

- The list is the campaign's shipping countries, narrowed by the 0.4.x `addressConfig.countries`.
- The country at load: the field's value; else the first listed of `?country`, the shopper's
  location and `US`; else the first in the list.
- A `billing` address is sent only while billing is separate from shipping;
  `billing_same_as_shipping` on the Checkout says which. Unticking it starts the billing address
  with the shipping country.

### Suggestions

- Only with the 0.4.x `nextConfig.addressConfig.enableAutocomplete`; the lookup runs 300 ms after
  the second word, or on focus, for the country picked (else `US`).
- Picking one fills the fields through the form, so `address.entered` or `address.updated` follows
  once the address is valid.

### The checks

- Addresses are checked once the checkout is open on the page: the form is bound and the cart has
  lines. Once per `type` per checkout: a step, a reload or a return from the gateway keeps the
  saved address; a paid order starts over.
- Leaving a field checks what is in it: its format, the phone through the address service, the
  postcode with the state (a doubt is a `warning`). Blanks come up at a submit.
- Valid: every field the country requires is filled and passes its check, and so does each optional
  field the shopper filled, the phone included; the email is not part of it.
- On one field: the phone or postcode read first, then `address.*`, then `user.*`. At
  `checkout.started` too, `address.entered` comes before `user.created`.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`             | When                                                    | What the SDK does next                                                      |
| -------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `user.save`          | The Open Cart cannot be created                         | Tries again on the next field change                                        |
| `address.load_rules` | The country list or a country's rules cannot load       | Falls back to the campaign's countries and simpler checks                   |
| `address.suggest`    | Address suggestions cannot load                         | Shows no suggestions                                                        |
| `order.create`       | The order is not created: refused, or the request fails | `checkout.failed`; back to `idle`, and the cart unfreezes                   |
| `order.load`         | The next page cannot load the order                     | No `order.loaded` there, nor `order.paid` after a gateway; the cart is kept |
