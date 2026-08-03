---
title: "Features/Display/Product Display/Glossary"
group: "Features"
category: "Product Display"
---

# Glossary

## Calculated property

A display value that is computed rather than read directly off the package — e.g. `savingsPercentage`, `unitPrice`, `finalPriceTotal`. Produced by `PriceCalculator` from the package's price and retail fields.

---

## Display path

The value of `data-next-display`, e.g. `package.price`, `package.123.name`, or `campaign.name`. It names the object, the (optional) package id, and the property to show.

---

## Format type

How a resolved value is rendered: `currency`, `number`, `percentage`, `boolean`, `date`, or `auto` (inferred). Set with `data-next-format`; `auto` is the default.

---

## Package context

The package id an element inherits from an ancestor's `data-next-package-id` (or a selector card) when its display path omits the id. Lets one card template serve any package.

---

## Raw value

The unformatted numeric form of a calculated property, addressed with a `.raw` suffix (e.g. `savingsPercentage.raw`). Useful when feeding another calculation rather than displaying directly.

---

## Retail-based savings

Savings measured against the package's retail/compare-at price (`price_retail*`), as opposed to coupon/offer discounts (which are tracked on the cart, not per package here).
