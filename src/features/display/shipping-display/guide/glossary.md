---
title: "Features/Display/Shipping Display/Glossary"
group: "Features"
category: "Shipping Display"
---

# Glossary

Terms used in this feature's guide. Display-system vocabulary shared with every other
namespace — display path, namespace, modifier — lives in
[display-core's glossary](../../../display/display-core/guide/glossary.md).

## Free shipping

A campaign shipping method that costs nothing, reported as `shipping.isFree`. It is a
property of the **method**, deliberately separate from a cost of zero, so a row can
print the word "Free" rather than the number `$0.00`. It is not the same as a cart
whose shipping charge has been discounted away.

---

## Shipping method

One delivery option the campaign offers — a name, a code, and a cost, such as
"Standard, 5–7 days, $4.95". The set of them comes from the campaign, so adding an
option is an admin change rather than a markup change.

---

## Shipping method id

The `ref_id` that identifies one shipping method within the campaign, and the value
you put in `data-next-shipping-id`. It is how a row of options tells each row which
method it describes. Also readable as `shipping.id` / `shipping.refId`.
