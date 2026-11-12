---
title: "Start Here/What's new in 0.5.1"
group: 'Start Here'
category: 'Start Here'
order: 2
---

# What's new in 0.5.1

Fixes for pages that moved to 0.5.0. Your page works without changes.

## You will notice

- **Prices show which dollar.** CAD, AUD, NZD, HKD and MXN read `CA$49.90`, not `$49.90`. Selling
  in your home market? Set `locale: 'en-CA'` to keep `$`.
  [Language and currency](recipes/language-and-currency.md)
- **Meta gets PageView from the SDK.** Remove `fbq('track', 'PageView')` from your pixel code, or
  it is counted twice.

## New

- **Sums in `data-next-query`.** `data-next-query="total / 30"` writes a price per day, with no
  script. [data-next-query](attribute-reference/display/data-next-query.md#sums)
- **A total before shipping.** `cart.total_before_shipping` is the total without the shipping
  price, for a checkout that shows shipping on a later step.
  [Cart](attribute-reference/objects/cart.md)
- **A currency switch for your page.** `data-next-action="setCurrency"` opens the page again in
  the currency the shopper picks. [Language and currency](recipes/language-and-currency.md)

## Fixed

- Order bumps count in the purchase again.
- Affiliate and ad tracking reaches the order: on a first visit, after PayPal, Apple Pay or 3-D
  Secure, and when a shopper taps a link early.
- Checkout tells the shopper why an order could not be placed.
- A personalisation typed once for the whole order stays when the shopper picks another bundle.
- Pages are ready sooner on a slow connection: about a second sooner on a checkout page.
