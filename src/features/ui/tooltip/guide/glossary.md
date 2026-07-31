---
title: "Features/UI/Tooltip/Glossary"
group: "Features"
category: "Tooltip"
---

# Glossary

Terms used across this feature's guide.

## Resolved placement

The side the tooltip actually rendered on, written to `data-placement` on the
tooltip element. `data-next-tooltip-placement` states a preference (default
`top`); when there is not enough room on that side the tooltip flips, so the
requested side and the resolved side can differ. The built-in arrow styling keys
off the resolved value, and custom arrow CSS should too.

---

## Variant class

A ready-made look you opt into through `data-next-tooltip-class`, on top of the
default dark tooltip. The SDK's injected stylesheet defines
`next-tooltip--light`, `next-tooltip--error`, `next-tooltip--success`,
`next-tooltip--warning`, `next-tooltip--large` (wider, larger text), and
`next-tooltip--small`. The attribute takes any class names, so your own variant
works the same way.
