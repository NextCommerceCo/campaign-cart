---
title: "Start Here/What's new in 0.5.1"
group: 'Start Here'
category: 'Start Here'
order: 2
---

# What's new in 0.5.1

Fixes for pages that moved to 0.5.0, and four things a page can now do. Your page works without
changes.

## You will notice

- **Prices show which dollar.** CAD, AUD, NZD, HKD and MXN read `CA$49.90`, not `$49.90`. Selling
  in your home market? Set `locale: 'en-CA'` to keep `$`.
  [Language and currency](recipes/language-and-currency.md)
- **Meta gets PageView from the SDK.** Remove `fbq('track', 'PageView')` from your pixel code, or
  it is counted twice.

## New

- **A currency switch for your page.** `data-next-action="setCurrency"` opens the page again in
  the currency the shopper picks. [Language and currency](recipes/language-and-currency.md)
- **A total before shipping.** `cart.total_before_shipping` is the total without the shipping
  price, for a checkout that shows shipping on a later step.
  [Cart](attribute-reference/objects/cart.md)
- **Sums in `data-next-query`.** `data-next-query="total / 30"` writes a price per day, with no
  script. [data-next-query](attribute-reference/display/data-next-query.md#sums)
- **A name for a sum.** `data-next-define="cart.free_shipping_left = 75 - total_before_shipping"`
  makes it a field every query and condition can read.
  [data-next-define](attribute-reference/display/data-next-define.md)

## Fixed

- Order bumps count in the purchase again.
- `blockedEvents` keeps an event from one destination again, as on 0.4.x.
- The data layer carries the shopper's email and country before the purchase again, for tags that
  match the shopper early.
- The 0.4.x visitor id key is in `localStorage` again, holding the campaign session id, for pages
  that send it to Meta as `external_id`.
- `dl_user_data` no longer reports the bundle a checkout pre-selects at its list price, and
  `dl_begin_checkout` always comes after `dl_add_to_cart`.
- An add-to-cart button with `data-next-url` sends `dl_add_to_cart` on the page it is clicked on,
  once the price is in (3 s at most), before it leaves.
- A currency picked with `?currency=` stays for the rest of the tab.
- Affiliate and ad tracking reaches the order: on a first visit, after PayPal, Apple Pay or 3-D
  Secure, and when a shopper taps a link early.
- Checkout tells the shopper why an order could not be placed.
- A personalisation typed once for the whole order stays when the shopper picks another bundle.
- Pages are ready sooner on a slow connection: about a second sooner on a checkout page.
