---
title: 'URL parameters'
group: 'Attribute Reference/Setup'
order: 103
---

# URL parameters

What the SDK reads from the page's query string. The visit keeps every parameter for the rest of
the tab, so `param.<name>` and attribution still see a `utm_source` the shopper arrived with
three pages earlier.

```text
landing.html?utm_source=fb&forceBundleId=three&currency=EUR
```

## Parameters

| Parameter                                                                                             | Means                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `currency=EUR`                                                                                        | Loads the campaign in that currency                                                                                                           |
| `lang=fr`                                                                                             | Writes prices and the checkout's texts in that language, over `nextConfig.locale` ([Language](language.md))                                   |
| `forcePackageId=42`, `42:2,7:1`                                                                       | Empties the cart and puts these packages in it (`id:quantity`, quantity 1 when left out)                                                      |
| `forceBundleId=three`, `main:three`                                                                   | Picks that card, in every selector or only in selector `main`; wins over `data-next-selected` and the cart's pick, on this page only          |
| `reset=1`                                                                                             | Starts with an empty cart, a new visit and nothing saved; the parameter is then removed from the address bar                                  |
| `debug=1` / `debug=0`                                                                                 | Opens the debug panel and logs at `debug` for the rest of the tab / turns it off again                                                        |
| `ignore=true` / `ignore=false`                                                                        | No tracking for the rest of the tab, for test orders / tracking again                                                                         |
| `country=DE`                                                                                          | The checkout's starting country, when it is one the campaign ships to and the shopper has not picked one                                      |
| `ref_id=…` (or `order_ref_id`)                                                                        | The order an upsell or receipt page shows; added by the checkout and the upsell buttons                                                       |
| `payment_failed=true`                                                                                 | Added by the SDK to the return URL a payment gateway uses after a declined payment: sends `payment.failed` for the order the checkout started |
| `utm_*`, `gclid`, `fbclid`, `affid`, `aff`, `sub1`–`sub5`, `subaffiliate1`–`5`, `evclid`, `funnel`, … | Attribution: sent with the order and on tracking events                                                                                       |
| any                                                                                                   | Readable on the page as `param.<name>` ([data-next-query](../display/data-next-query.md), [data-next-show](../display/data-next-show.md))     |

## Carried to the next page

A same-site link, an add-to-cart `data-next-url`, a checkout step, the redirect after paying (the
return from PayPal, Apple Pay or 3-D Secure too) and the upsell buttons all add the visit's
parameters to the next URL, unless that URL sets them itself. A link to another site gets only the attribution ones (`utm_*`, `gclid`, `gbraid`,
`wbraid`, `fbclid`, `ttclid`, `msclkid`, `clickid`, `evclid`, `affid`, `aff`, `sub1`…,
`subaffiliate1`…, `funnel`, `currency`).

A link followed before the SDK had loaded opens the next page without them. That page, when
its visit has no attribution parameter of its own, takes the attribution ones from the page it
came from, if that page is on the same site.

These stay on the page they were opened with and are never carried: `reset`, `forcePackageId`,
`forceBundleId`, `debug`, `debugger`, `payment_failed`, `payment_method`, `ref_id`,
`order_ref_id` (the next order page gets its `ref_id` from the SDK).

## 0.4.x

| 0.4.x                         | Now                       |
| ----------------------------- | ------------------------- |
| `debug=true`, `debugger=true` | Still read. Use `debug=1` |
| `reset=true`                  | Still read. Use `reset=1` |
