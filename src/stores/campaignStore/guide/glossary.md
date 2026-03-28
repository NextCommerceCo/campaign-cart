# Glossary

## Campaign

The top-level object returned by the 29Next Campaigns API. Contains currency, language, payment configuration, and the full list of packages available for purchase.

---

## Cache key

The sessionStorage key used to store a cached campaign response. Format: `{CAMPAIGN_STORAGE_KEY}_{currency}` (e.g. `next_campaign_USD`). One key per currency.

---

## Currency fallback

When the campaign API cannot serve the requested currency, it returns pricing in a default currency (typically USD). The store treats this as a fallback, updates the config to reflect the actual currency, and emits `currency:fallback` so UI components can notify the user.

---

## Package

A purchasable SKU on a campaign. Each package has a `ref_id` (used throughout the SDK as the primary identifier), a price, a quantity, and optionally a linked product variant.

---

## Pricing tier

A grouping of packages by quantity level for the same product variant. For example, "Buy 1" and "Buy 2" of the same shirt in size M are two pricing tiers for that variant.

---

## Product variant

A specific combination of product attributes (e.g. color=Red, size=M) that maps to one or more packages. A single variant can have multiple packages representing different pricing tiers.

---

## Variant attribute

A single dimension of product variation, defined by a `code` (machine key, e.g. `color`) and a `value` (display value, e.g. `Red`). A product variant is identified by the full set of its attributes.


