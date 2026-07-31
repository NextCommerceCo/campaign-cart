---
title: "Features/Display/Order Display/Glossary"
group: "Features"
category: "Order Display"
---

# Glossary

Terms used in this feature's guide. Display-system vocabulary shared with every
other namespace — display path, namespace, modifier — lives in
[display-core's glossary](../../../display/display-core/guide/glossary.md).

## Order reference

The identifier that names one completed order, `ref_id`. It arrives in the page URL
as `?ref_id=` (`?order_ref_id=` is also accepted), which is how a generic receipt
page knows which order to load without being configured. It is also readable as
`order.ref_id`.

---

## Order retention window

The 15 minutes a loaded order stays available to the page. Past that, `order.*`
bindings have nothing to render. The window exists so a receipt link that is shared
or bookmarked does not keep displaying someone's purchase.

---

## Post-purchase page

Any page a visitor reaches after payment — the receipt or thank-you page, and any
upsell page between checkout and it. These are the only pages where the URL carries
an order reference, and therefore the only pages where `order.*` bindings resolve.

---

## Upsell

A one-click add-on offered after payment, charged against the existing order rather
than through a fresh checkout. `order.supports_upsells` says whether the order can
take one; `order.hasUpsells` says whether one was already accepted.
