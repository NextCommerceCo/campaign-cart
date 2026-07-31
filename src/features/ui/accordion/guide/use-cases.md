---
title: "Features/UI/Accordion/Use Cases"
group: "Features"
category: "Accordion"
---

# Use Cases

Where an accordion earns its place on a campaign page, and where something else
fits better.

## Collapsing the order summary on a phone

> Effort: lightweight

**When:** The checkout page shows the full order summary above the form. On a
phone that summary pushes the first form field below the fold, so the visitor has
to scroll before they can start typing.

**Why this enhancer:** The trigger, the panel, and the label are matched by a
shared id rather than by nesting, so the summary header can stay in the page
header and the summary body can stay in its own container — the design does not
have to change. `data-initial-state="closed"` collapses it on load, and the
label swaps itself between the two wordings you supply.

```html
<div data-next-accordion="order-summary"
     data-initial-state="closed"
     data-open-text="Hide order summary"
     data-close-text="Show order summary">

  <button data-next-accordion-trigger="order-summary">
    <span data-next-accordion-text="order-summary">Show order summary</span>
  </button>

  <div data-next-accordion-panel="order-summary">
    <div data-next-cart-summary></div>
  </div>
</div>
```

**Watch out for:** The two label attributes are named after the state the panel
is *in*, not after the action they invite. `data-open-text` is written into the
label while the panel is **open**, `data-close-text` while it is **closed**. The
symptom of getting them the wrong way round is a button reading "Show order
summary" while the summary is already showing. The fix is above: put the
collapsed wording in `data-close-text`.

---

## An FAQ block that answers objections before checkout

> Effort: lightweight

**When:** A long-form landing page lists the questions that stop people buying —
shipping times, the guarantee, what happens after the trial. Showing every answer
at once buries the buy button; showing none loses the reassurance.

**Why this enhancer:** Each question is its own accordion with its own id, and
they run independently. Triggers are made focusable (`tabindex="0"`) and respond
to Enter and Space, so a keyboard visitor can open an answer without extra code,
and `aria-expanded` is kept in step for screen readers.

**Watch out for:** The panel is animated by writing an inline `height` — the
feature ships no CSS of its own. Without `overflow: hidden` and a height
transition on the panel, the answer snaps open instead of sliding, and its text
spills out while the panel is collapsed. Match the transition to
`data-animation-duration` (default 300ms):

```css
[data-next-accordion-panel] {
  overflow: hidden;
  transition: height 300ms ease;
}
```

---

## One answer open at a time

> Effort: moderate

**When:** The design calls for a set of sections where opening one closes the
rest, so the page never grows past a screen.

**Why this enhancer:** It reports every state change. `accordion:toggled`
carries the id and `isOpen`, so a handful of lines can close the others by
clicking their triggers.

```js
window.nextReady.push(() => {
  next.on('accordion:opened', ({ id }) => {
    document.querySelectorAll('[data-next-accordion]').forEach(el => {
      const other = el.getAttribute('data-next-accordion');
      if (other === id || !el.classList.contains('next-expanded')) return;
      el.querySelector(`[data-next-accordion-trigger="${other}"]`)?.click();
    });
  });
});
```

**Watch out for:** Group behaviour is not built in — several accordions can be
open at once, and nothing coordinates them. The symptom of skipping the handler
above is a page that keeps growing as the visitor opens sections. If you write
the handler, test the class name you check against `data-toggle-class`: change
that attribute and the check above stops matching.

---

## When NOT to use this

### Hiding a section depending on cart or campaign state

**Why not:** An accordion opens and closes on a click. It has no idea what is in
the cart, so it cannot decide on its own that a shipping row or an upsell block
should not be on the page at all.

**Use instead:**
[`conditional-display`](../../../display/conditional-display/guide/overview.md) —
it shows and hides an element from cart and campaign state, with no click
involved.

### Rendering the order summary itself

**Why not:** The accordion only reveals a panel; it renders nothing and knows no
totals.

**Use instead:** [`cart-summary`](../../../cart/cart-summary/guide/overview.md)
inside the panel — that is the combination the first use case above shows.

### Remembering that a section was open on the previous page

**Why not:** State lives in a class on the element and is rebuilt from
`data-initial-state` on every load.

**Use instead:** Store your own flag and set `data-initial-state="open"` when you
render the page. No SDK feature persists accordion state.

## Next steps

- [reference/attributes.md](./reference/attributes.md) — every attribute and its
  default
- [reference/events.md](./reference/events.md) — the payloads used above
- [relations.md](./relations.md) — what has to be on the page
- [glossary.md](./glossary.md) — the terms used here
