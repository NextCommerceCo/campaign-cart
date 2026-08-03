---
title: "Features/UI/Accordion/Glossary"
group: "Features"
category: "Accordion"
---

# Glossary

Terms used across this feature's guide.

## Accordion group id

The value shared by the four parts of one accordion — the container
(`data-next-accordion`), the clickable element
(`data-next-accordion-trigger`), the section that expands
(`data-next-accordion-panel`), and the optional swapping label
(`data-next-accordion-text`). Parts opt in by carrying the same id, which is how
two accordions on one page stay independent. It is not an HTML `id` attribute and
does not have to be unique in the document, only among accordions.

---

## Initial state

Whether the section is expanded or collapsed when the page loads, set by
`data-initial-state` and defaulting to collapsed. An accordion that already
carries the toggle class in the markup is treated as open regardless of this
attribute, so a server-rendered open section stays open.

---

## Toggle class

The class the feature adds to the container and the panel while the section is
open — `next-expanded` unless `data-toggle-class` names another. It is the only
styling contract the feature has: it applies the class and writes the panel
height, and your stylesheet decides what open looks like.
