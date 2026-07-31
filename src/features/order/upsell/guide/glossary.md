---
title: "Features/Order/Upsell/Glossary"
group: "Features"
category: "Upsell"
---

# Glossary

## Completed order

An order that has already been paid for and created. A post-purchase upsell adds lines to this existing order rather than starting a new checkout.

---

## Direct mode

An upsell offering a single fixed package, activated by `data-next-upsell` together with `data-next-package-id`. The customer adds or skips it.

---

## Next URL

The page a customer is sent to after accepting or skipping an offer. Resolved from the button's `data-next-url` (then `data-next-next-url` / `data-os-next-url`), or from the page's `next-upsell-accept-url` / `next-upsell-decline-url` meta tags.

---

## Post-purchase upsell

An add-on offered *after* the order is complete, added without re-entering payment. Only possible when the order's `supports_post_purchase_upsells` flag is set.

---

## Selector mode

An upsell offering several options to choose from, activated by `data-next-upsell-selector` (with `data-next-upsell-option` cards or a `data-next-upsell-select` dropdown) or by linking an external package/bundle selector. The customer picks one, then adds it.

---

## Upsell journey

The record kept in `useOrderStore` of what happened with each offered package on this order — viewed, accepted, or skipped. Used for the duplicate-add guard and for analytics.
