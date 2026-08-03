---
title: "Features/Display/Quantity Text/Glossary"
group: "Features"
category: "Quantity Text"
---

# Glossary

Terms used in this feature's guide.

## Package context

Which package a sentence is about, taken from the nearest enclosing element carrying
`data-next-package-id`. It is why a sentence written inside an offer card needs no
configuration — the card already declares its package.

---

## Plural token

A `{singular|plural}` pair in the template, such as `{bottle|bottles}`. The feature
picks the left form when the quantity is exactly 1 and the right form otherwise, so
the wording and the number stay agreed inside one string.

---

## Quantity selector id

The name of the quantity control a sentence follows, set with
`data-next-quantity-selector-id` and matching the id on an
[upsell](../../../order/upsell/guide/overview.md) offer's quantity control. Needed
only when the sentence sits away from the control it describes.

---

## Quantity template

The sentence you put in `data-next-quantity-text`, tokens and all. The whole string
is the unit of authorship — it is re-rendered from scratch on every quantity change,
which is what keeps the wording and the number in step and lets the sentence be
translated as one phrase.

---

## Quantity token

The `{qty}` placeholder, and its arithmetic forms `{qty*2}`, `{qty+1}`, and
`{qty-1}`, which derive a second number from the same quantity — "buy `{qty}`, get
`{qty*3}` free". Subtraction never goes below zero.
