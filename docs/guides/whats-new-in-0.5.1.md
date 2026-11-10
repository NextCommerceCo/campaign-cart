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

## Fixed

- Order bumps count in the purchase again.
- Affiliate and ad tracking reaches the order: on a first visit, after PayPal, Apple Pay or 3-D
  Secure, and when a shopper taps a link early.
- Checkout tells the shopper why an order could not be placed.
