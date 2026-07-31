---
title: "Features/UI/Tooltip/Overview"
group: "Features"
category: "Tooltip"
---

# Tooltip

> Category: `ui`
> Last reviewed: 2026-07-31
> Owner: Campaigns

Shows a short explanation on hover or focus — what a fee covers, what a guarantee
includes, why a price differs from the one above it.

## Concept

One attribute does two jobs: it marks the element as having a tooltip and carries the
text. There is no separate tooltip element to write.

The tooltip is rendered **outside** the element it belongs to, appended to the page
and positioned against it. That is what stops a parent with `overflow: hidden` — a
card, a table cell, a scrolling summary — from clipping it, which is the failure mode
of a nested tooltip.

Placement is a preference rather than an instruction. You say `right`, and if there
is not enough room on the right it flips. The side it actually used is written back as
an attribute so the arrow can point the correct way.

## Business logic

- `data-next-tooltip` is the text and is required.
- `data-next-tooltip-placement` prefers a side (default `top`); it flips when space
  runs out.
- `data-placement` is set on the rendered tooltip with the side actually used. The
  built-in arrow styling keys off it, and so can yours.
- `data-next-tooltip-delay` (default 500ms) is how long the pointer must rest first.
  The delay is what stops tooltips flickering as a pointer crosses a row of them.
- `data-next-tooltip-offset` (default 8px) is the gap; `data-next-tooltip-max-width`
  (default `200px`) is where the text wraps and accepts any CSS length.
- `next-tooltip--visible` is toggled on the tooltip while shown — animate from that
  rather than from insertion, since the element persists.
- `data-next-tooltip-class` adds your own classes for a variant.

## Decisions

- We render to the page rather than inside the element, so ancestor overflow cannot
  clip the tooltip.
- We treat placement as a preference and flip automatically, because a tooltip that
  renders off-screen to honour a request is useless.
- We write the resolved placement back as an attribute instead of keeping it internal,
  so custom arrow styling can follow the flip.
- We default to a delay rather than showing instantly, because instant tooltips make
  a dense interface feel noisy.

## Limitations

- Plain text only — the value is an attribute, so it cannot contain markup.
- One tooltip per element.
- On a touch screen a **tap toggles it** — there is no hover, so the first tap
  opens it and the next one closes it. It is not unreachable on touch, but it does
  cost the shopper a tap they may not know to make, so still do not put essential
  information here.
- Does not stay open for selection or copying.
- A tooltip whose fade-out is interrupted by a new tap is removed immediately
  rather than fading, because the new tooltip supersedes it.

## Reference

- [Attributes](./reference/attributes.md) — placement, delay, sizing, styling hooks
