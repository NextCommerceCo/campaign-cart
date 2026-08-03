---
title: "Features/Display/Display Core/Glossary"
group: "Features"
category: "Display Core"
---

# Glossary

Terms used across the display system's guide. Every `data-next-display` binding in
the SDK, whatever it points at, is described with these words.

## Context attribute

An attribute on an **ancestor** element that tells a binding which thing it is about
when the path leaves that out — `data-next-package-id`, `data-next-shipping-id`,
`data-next-selector-id`, `data-next-cart-item-id`. It is what lets one card or row
template serve many packages.

---

## Display path

The value of `data-next-display`, written as `{namespace}.{path}` — for example
`cart.total`, `package.101.price`, or `order.number`. It names where the value comes
from and which value it is.

---

## Format type

How a resolved value is rendered as text: `currency`, `number`, `percentage`,
`boolean`, `date`, `text`, or `auto`. Set with `data-next-format`; `auto` is the
default and infers the type from the value and the path.

---

## Modifier

An attribute that changes how a binding renders without changing which value it
reads — `data-next-format`, `data-hide-if-zero`, `data-hide-if-false`,
`data-hide-zero-cents`, `data-multiply-by`, `data-divide-by`. Modifiers are the same
for every namespace, which is why they are documented once here.

---

## Namespace

The first segment of a display path — `cart.`, `package.`, `selection.`, `order.`,
`shipping.`, `selector.`, `bundle.`, or `toggle.`. It decides which feature answers
the rest of the path, so it is the routing decision, not decoration. An unknown
namespace means no feature claims the element.

---

## Placeholder

The text you author inside a binding element. It is what a visitor sees before the
data behind the binding has loaded, and what stays on screen if the path never
resolves — so a meaningful placeholder ("—", "Loading") beats an empty element.
