---
title: "Features/UI/Scroll Hint/Use Cases"
group: "Features"
category: "Scroll Hint"
---

# Use Cases

Where a conditional "scroll for more" cue is worth adding, and where a different
feature answers the same need better.

## A long cart inside a fixed-height order summary

> Effort: lightweight

**When:** The checkout order summary keeps its item list in a box of fixed height
so the payment form stays visible. With five or more items, everything past the
third row is out of sight and visitors do not realise the list scrolls.

**Why this enhancer:** The cue only appears when it is true — the list has to be
scrolled to the top *and* be taller than its visible area. A two-item cart never
shows it, and it disappears as soon as the visitor scrolls past
`data-next-scroll-threshold` (5px by default), so it does not sit there lying
about content that has already been seen.

```html
<div class="cart-items">
  <div data-next-cart-items class="cart-items__list"></div>

  <div data-next-component="scroll-hint"
       data-next-scroll-target="[data-next-cart-items]"
       class="cart-items__scroll-hint">
    Scroll for more items
  </div>
</div>
```

**Watch out for:** The cart item list replaces its own `innerHTML` on every cart
update. Point `data-next-scroll-target` at the scrolling container itself — the
element carrying `data-next-cart-items`, as above — never at a row inside it. The
symptom of targeting a rendered row is a hint that works until the first cart
change and then freezes, because the element it was watching no longer exists.

---

## An items list on the order confirmation or upsell page

> Effort: lightweight

**When:** A post-purchase page lists what was ordered in a scrolling panel, often
inside a modal, and the visitor needs to know the list continues.

**Why this enhancer:** With no `data-next-scroll-target`, the feature looks for a
scrollable list near the hint — a cart items list, an order items list, or an
element classed `scrollable-content` — first among the hint's siblings, then
inside an ancestor classed `order-summary`, `cart-items`, or `modal-content`. In
those layouts the cue needs no configuration at all.

**Watch out for:** That search is the whole of the fallback. A hint placed
outside those containers finds nothing, logs
`No scroll target found for scroll hint`, and never appears — with no error, so
the page looks fine and the cue is silently missing. If your list is anywhere
else, set `data-next-scroll-target` explicitly and treat that warning in the
console as the thing to fix.

---

## A progress indicator instead of a binary cue

> Effort: moderate

**When:** The design wants a scrollbar-like indicator or an "N more below" label
rather than an on/off hint.

**Why this enhancer:** Every recalculation emits `scroll-hint:updated` with the
geometry it measured, so you can drive your own indicator from the same numbers
without wiring scroll and resize listeners yourself.

```js
window.nextReady.push(() => {
  next.on('scroll-hint:updated', ({ scrollTop, scrollHeight, clientHeight }) => {
    const max = scrollHeight - clientHeight;
    const progress = max > 0 ? scrollTop / max : 1;
    document.querySelector('.cart-progress').style.width = `${progress * 100}%`;
  });
});
```

**Watch out for:** The event fires on scroll (throttled to about one frame),
on resize, and whenever the watched container's content changes — so the handler
runs often. Keep it to writing a style or a number; anything expensive there
shows up as scroll jank on a phone.

---

## When NOT to use this

### Telling the visitor how many items are in the cart

**Why not:** The hint is about overflow, not about contents. It cannot say
"3 items" and does not read the cart at all.

**Use instead:**
[`quantity-text`](../../../display/quantity-text/guide/overview.md) for a live
item count, or
[`cart-summary`](../../../cart/cart-summary/guide/overview.md) for the full
list with totals.

### Scrolling the list for the visitor

**Why not:** The feature is a cue. It toggles a class and keeps `aria-hidden` in
step; it never moves the scroll position, so making the hint clickable does
nothing on its own.

**Use instead:** Your own button calling `scrollBy` on the container. Keep the
hint for the "there is more" signal and let the button do the moving.

### A list that grows with the page instead of scrolling

**Why not:** The cue's condition is that the container's content is taller than
its visible area. A list with no fixed height never overflows, so the hint is
correct to stay hidden — and adding it suggests a bug where there is none.

**Use instead:** Nothing. Give the container a height and `overflow: auto` if you
want a scrolling list, or leave the page to scroll and drop the hint.

## Next steps

- [reference/attributes.md](./reference/attributes.md) — target, threshold, and
  the active class
- [reference/events.md](./reference/events.md) — the `scroll-hint:updated`
  payload used above
- [relations.md](./relations.md) — what it is normally paired with
- [glossary.md](./glossary.md) — the terms used here
