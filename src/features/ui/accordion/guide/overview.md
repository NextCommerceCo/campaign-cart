---
title: "Features/UI/Accordion/Overview"
group: "Features"
category: "Accordion"
---

# Accordion

> Category: `ui`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Collapses a section behind a trigger — an order summary on mobile, an FAQ, a
shipping-details panel.

## Concept

An accordion here is not one element but a **set of elements sharing an id**: the
accordion itself, its trigger, its panel, and optionally a label that swaps text.

That indirection is what makes it usable in real layouts. The trigger does not have
to wrap the panel, and the label does not have to sit inside the trigger — they just
have to agree on the id. So an accordion can span a header and a body that a design
keeps in separate containers.

State is expressed as a class on the accordion, and you choose which class. That
means the feature does not impose a stylesheet: point it at whatever your CSS
already uses for an expanded state.

## Business logic

- `data-next-accordion` names the accordion. Trigger, panel, and text elements opt in
  by carrying the same id.
- A missing trigger or panel logs a warning naming the id it looked for, and the
  accordion does nothing — it does not half-work.
- `data-initial-state` decides whether it starts open or closed; closed is the
  default.
- `data-toggle-class` is the class applied while open, defaulting to
  `next-expanded`.
- `data-animation-duration` is the expand/collapse time in milliseconds; `0` switches
  instantly.
- `data-open-text` and `data-close-text` are written into the
  `data-next-accordion-text` element. Without that element the labels have nowhere to
  go.
- `accordion:toggled` fires for both directions and carries `isOpen`;
  `accordion:opened` and `accordion:closed` are the one-directional equivalents.

## Decisions

- We match parts by id rather than by nesting, so a design can separate a trigger
  from its panel.
- We let you name the state class instead of shipping our own, so an accordion drops
  into an existing stylesheet without overrides.
- We warn and stop when a part is missing rather than guessing, because a silently
  half-initialised accordion is harder to debug than one that says what it wanted.
- We emit a single `toggled` event as well as the directional pair, so one handler can
  cover both without subscribing twice.

## Limitations

- Does not enforce one-open-at-a-time. Several accordions are independent; group
  behaviour is yours to write.
- Does not manage focus or keyboard interaction beyond a click on the trigger — add
  `role` and key handling if you need full keyboard support.
- Does not remember its state across page loads.
- Does not measure content changes. A panel that grows while open may need its height
  refreshed by your own code.

## Reference

- [Attributes](./reference/attributes.md) — the four parts and the options
- [Events](./reference/events.md) — `accordion:toggled`, `:opened`, `:closed`
