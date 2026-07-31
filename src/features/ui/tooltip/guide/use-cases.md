---
title: "Features/UI/Tooltip/Use Cases"
group: "Features"
category: "Tooltip"
---

# Use Cases

Where a hover explanation belongs on a campaign page, and where hiding the text
behind a hover works against you.

## Explaining a charge in the order summary

> Effort: lightweight

**When:** The summary shows a line the visitor did not expect — a handling fee, an
insurance line, a shipping upgrade — and the page has no room for a sentence of
explanation next to it.

**Why this enhancer:** The text and the trigger are one attribute, so there is no
extra element to position. The tooltip is appended to the page rather than nested
inside the line, which is what stops a summary card with `overflow: hidden` from
clipping it — the usual failure of a hand-rolled tooltip in a summary.

```html
<span data-next-tooltip="Charged once per order, not per shipment."
      data-next-tooltip-placement="right">
  What is this fee?
</span>
```

**Watch out for:** The value is plain text, written with `textContent`. Markup in
it is shown literally, so `<b>once</b>` appears as those characters on screen. If
the explanation needs more than a sentence or any formatting, put it in an
[`accordion`](../../../ui/accordion/guide/overview.md) panel instead.

---

## Clarifying a guarantee next to the buy button

> Effort: lightweight

**When:** A "60-day money-back guarantee" or "cancel anytime" line needs its terms
available without sending the visitor to another page mid-decision.

**Why this enhancer:** It responds to focus as well as hover, so a keyboard
visitor tabbing through the offer gets the same explanation, and
`aria-describedby` is set on the element while it is shown. The preferred side
flips automatically when the tooltip would run off the viewport, so a tooltip next
to a button at the page edge still lands on screen — and the side actually used is
written back as `data-placement` so a custom arrow can follow the flip.

**Watch out for:** There is no hover on a touch screen. A tap toggles the tooltip,
but nothing on the page says the element is tappable, so a phone visitor may never
open it. The symptom is a term that tests fine on a desktop and is invisible to
most of your traffic. Anything the purchase decision depends on belongs in visible
copy, not here.

---

## A longer explanation that has to wrap

> Effort: lightweight

**When:** The explanation is two sentences and the default 200px column turns it
into a narrow ribbon.

**Why this enhancer:** `data-next-tooltip-max-width` accepts any CSS length, so
`32ch` sizes the box to the text rather than to a guessed pixel count.

```html
<span data-next-tooltip="Your subscription renews every 30 days. Cancel from your account page at any time before the renewal date."
      data-next-tooltip-max-width="32ch"
      data-next-tooltip-class="next-tooltip--large">
  Subscription terms
</span>
```

**Watch out for:** `data-next-tooltip-max-width` is applied to the tooltip
wrapper, while the injected stylesheet caps the inner text block at 200px on its
own. Raising the attribute past that alone changes nothing — the symptom is a
tooltip that stays 200px wide no matter what you set. Either pass the wider
built-in variant as above (`next-tooltip--large` caps at 300px) or override
`.next-tooltip__content { max-width: 32ch; }` in your own CSS.

---

## When NOT to use this

### Information the purchase decision depends on

**Why not:** A tooltip is opt-in, delayed by 500ms of hovering by default, and
unreachable for most phone visitors. Price, shipping cost, and total are not
optional reading.

**Use instead:**
[`display-core`](../../../display/display-core/guide/overview.md) — render the
value into visible copy from cart or campaign data.

### Field errors on the checkout form

**Why not:** An error has to be announced when it happens, not when someone
hovers, and it must survive the field being re-rendered.

**Use instead:**
[`checkout-form`](../../../checkout/checkout-form/guide/overview.md) — it owns
field validation and its own error display.

### A paragraph, a list, or an image

**Why not:** The content is an HTML attribute value: one string, no markup, no
child elements, and it cannot be selected or copied because it disappears on
pointer-out.

**Use instead:**
[`accordion`](../../../ui/accordion/guide/overview.md) — a panel that holds real
markup and stays open until the visitor closes it.

## Next steps

- [reference/attributes.md](./reference/attributes.md) — placement, delay,
  sizing, and the styling hook
- [relations.md](./relations.md) — what has to be on the page
- [glossary.md](./glossary.md) — the terms used here
