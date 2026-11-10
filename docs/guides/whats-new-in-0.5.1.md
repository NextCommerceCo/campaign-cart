---
title: 'Start Here/What 0.5.1 changes'
group: 'Start Here'
category: 'Start Here'
order: 2
---

# What 0.5.1 changes

0.5.1 fixes what pages and tags noticed after moving to 0.5.0. Nothing in a page has to change
to take it, but three things look different once it is live: prices in a shared-`$` currency,
what the Meta pixel receives, and when `dl_add_shipping_info` is pushed.

- [**Prices say which dollar**](#prices-say-which-dollar): `CA$49.90`, not `$49.90`.
- [**Purchases as tags expect them**](#purchases-as-tags-expect-them): order bumps, the customer,
  and the shipping step.
- [**Meta gets PageView, and one AddToCart**](#meta-gets-pageview-and-one-addtocart).
- [**Attribution reaches the order**](#attribution-reaches-the-order): metadata set after load,
  the Meta cookies, and the return from a payment gateway.
- [**Checkout says why an order was refused**](#checkout-says-why-an-order-was-refused).

## Prices say which dollar

CAD, AUD, NZD, HKD and MXN are written with their prefix. A page in the currency's home language
keeps the bare sign:

| Currency | Page in `en` | Page in its home locale |
| -------- | ------------ | ----------------------- |
| CAD      | `CA$49.90`   | `en-CA`: `$49.90`       |
| AUD      | `A$49.90`    | `en-AU`: `$49.90`       |
| NZD      | `NZ$49.90`   | `en-NZ`: `$49.90`       |
| MXN      | `MX$49.90`   | `es-MX`: `$49.90`       |
| HKD      | `HK$49.90`   | `en-HK`: `HK$49.90`     |

USD, SGD and every other currency are written as before. A store that sells in its home market
sets the locale; a page can also write a currency its own way:

```html
<script>
  window.nextConfig = {
    locale: 'en-CA',
    translations: { en: { 'formats.currency.CAD': 'C${amount}' } },
  };
</script>
```

`formats.currency.<code>` takes `narrowSymbol`, `symbol` or `code`, or a pattern of `{amount}`,
`{symbol}`, `{narrowSymbol}` and `{code}`. `data-next-format="amount"` writes `49.90` with no
symbol. See [Language and currency](recipes/language-and-currency.md).

## Purchases as tags expect them

- **An order bump is part of the purchase.** A line flagged `data-next-is-upsell="true"` that was
  in the order when it was paid is in `dl_purchase` and `checkout_completed`. `dl_upsell_purchase`
  is sent only for an upsell accepted after payment.
- **`dl_purchase` and `dl_upsell_purchase` carry the customer** in `user_properties`, with the
  0.4.x field names (`customer_email`, `customer_first_name`, `customer_phone`, `customer_city`,
  …). Every other `dl_*` push keeps `visitor_type` only.
- **`dl_add_shipping_info` waits for a valid shipping address**, and always comes after
  `dl_begin_checkout`.

## Meta gets PageView, and one AddToCart

The Meta destination sends `PageView` on every page load and `AddToCart` for the first add of a
session only. Remove `fbq('track', 'PageView')` from the page's pixel base code, or Meta gets
two. GA4, RudderStack and the `dl_*` pushes still get every add. See
[How analytics works](analytics-reference/how-it-works.md).

## Attribution reaches the order

A value the page learns after it loaded, such as a click id, is set with one call and stays for
the rest of the tab:

```js
await next.actions.setMetadata({ everflow_transaction_id: 'abc123' });
```

- The 0.4.x `next.setMetadata`, `addMetadata`, `getMetadata` and `clearMetadata` work again on
  0.4.x pages, and `localStorage.evclid` is read again.
- The Meta `_fbp` and `_fbc` cookies are read when the order is sent, so a first visit has them.
- A shopper returning from PayPal, Apple Pay or 3-D Secure lands with the visit's affiliate and
  `utm_*` parameters.
- A page opened without attribution parameters takes them from the page it came from, when that
  page is on the same site.
- A metadata value longer than 2000 characters is cut to 2000, so the order is accepted.

See [JavaScript API](javascript-api.md) and
[URL parameters](attribute-reference/setup/url-parameters.md).

## Checkout says why an order was refused

An order the API refuses by field, such as an item out of stock, shows a message for that field
on express and card orders, and the API's own text is in the log and in the `checkout.failed`
event. The texts are `order.errors.<field>`, translated like the rest of the form
([Language](attribute-reference/setup/language.md)). The card expiry months the SDK fills are
named in the page's language.
