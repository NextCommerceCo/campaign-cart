---
title: "Features/Display/Selection Display/Glossary"
group: "Features"
category: "Selection Display"
---

# Glossary

Terms used in this feature's guide. Display-system vocabulary shared with every other
namespace — display path, namespace, modifier — lives in
[display-core's glossary](../../../display/display-core/guide/glossary.md).

## Compare total

The price the selection is being compared **against** — the package's retail or
compare-at total, exposed as `selection.compareTotal`. It is the number a
strikethrough shows, and the basis every savings figure here is measured from.

---

## Selection

What a selector currently has picked, and not yet added to the cart. It is a live
answer: it changes when the visitor clicks another card, when code changes the
selection, and when the cart is synced back into the selector on page load. With
nothing picked there is no selection and `selection.*` paths resolve to nothing.

---

## Selector id

The name a package selector is given with `data-next-selector-id`, so more than one
selector can live on a page and a binding elsewhere can say which one it follows.
A binding inside a selector inherits it and needs no id of its own.

---

## Unit price

The price of one single unit of whatever is selected, `selection.unitPrice` — the
pack price divided by the pack's quantity. It is what "only $8.33 per bottle" copy
is made of, and it comes from the quantity declared on the selected card.
