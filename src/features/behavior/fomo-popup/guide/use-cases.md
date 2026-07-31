---
title: "Features/Behavior/FOMO Popup/Use Cases"
group: "Features"
category: "FOMO Popup"
---

# Use Cases

Where rotating purchase notifications help a campaign page, and where they are the
wrong tool — including the case where using them at all is a legal question rather
than a design one.

## A newly launched page that looks deserted

> Effort: lightweight

**When:** A campaign has gone live with no reviews, no ratings, and low traffic.
Visitors land on a page that gives them no sign anybody else has bought, which is
the point in the funnel where they leave to search for the brand.

**Why this enhancer:** One call rotates notifications naming packages from the
campaign itself, so the products mentioned are the ones actually on sale. Nothing
has to be added to the markup.

```js
window.nextReady.push(() => {
  next.fomo({
    initialDelay: 8000,
    displayDuration: 5000,
    delayBetween: 15000,
  });
});
```

**Watch out for:** The default product list is built from the first five campaign
packages **that have an image**, and packages without one are dropped. If none
qualifies, every notification shows a grey placeholder box reading "Popular
Package". The fix is to pass `items` yourself with image URLs you control:

```js
window.nextReady.push(() => {
  next.fomo({
    items: [
      { text: '3-Bottle Bundle', image: 'https://cdn.example.com/pack3.jpg' },
      { text: 'Starter Kit', image: 'https://cdn.example.com/starter.jpg' },
    ],
  });
});
```

---

## Mostly-mobile traffic, where a notification covers the buy button

> Effort: lightweight

**When:** Analytics say four in five visitors are on a phone. The notification is
fixed to the bottom-left of the viewport and, on screens up to 768px, stretches to
nearly the full width — the same area as the sticky buy button on many campaign
layouts.

**Why this enhancer:** `maxMobileShows` caps how many notifications a phone
visitor sees at all. Once the cap is reached the rotation stops for the rest of
the page view rather than continuing to cover the button.

```js
window.nextReady.push(() => {
  next.fomo({ maxMobileShows: 2, initialDelay: 10000 });
});
```

**Watch out for:** The cap is measured against the viewport width at the moment
each notification is due, and reaching it stops the rotation permanently — a
visitor who rotates to landscape or moves to a wide window sees nothing more. The
symptom in QA is "the popup stopped working" after a resize. That is the intended
behaviour; if you need it running again, call
`next.fomo({ maxMobileShows: 2 })` a second time, which restarts the rotation
with a fresh count. `next.stopFomo()` ends it on
purpose.

---

## One campaign selling into several countries

> Effort: moderate

**When:** The same page serves the US, the UK, Canada, and Australia, and
American city names next to British prices read as fake to a British visitor.

**Why this enhancer:** `customers` maps a country code to the lines usable for
visitors from that country, and the feature picks the list matching the visitor
before pairing it with a product.

```js
window.nextReady.push(() => {
  next.fomo({
    customers: {
      US: ['Sarah from Denver, CO', 'Mike from Austin, TX'],
      GB: ['Emma from Manchester', 'Tom from Bristol'],
      CA: ['Ava from Toronto'],
      AU: ['Olivia from Brisbane'],
    },
  });
});
```

**Watch out for:** The country is guessed from the browser's timezone, and only a
few timezones are recognised: Australian ones map to `AU`, London and Dublin to
`GB`, Toronto and Vancouver to `CA`, and **everything else falls back to `US`** —
including a visitor in Paris or in Edinburgh. Any country with no list of its own
also falls back to the `US` list. The symptom is a European visitor seeing US
cities. Since `US` is both the fallback country and the fallback list, put the
lines you are willing to show anyone under that key.

---

## When NOT to use this

### Proving that real people are buying

**Why not:** Nothing here reads orders. Every notification is generated from the
options you pass, and the feature cannot check that any of it happened.
Presenting invented purchases as real is regulated in many markets — treat
enabling this as a decision to clear with whoever owns compliance, and prefer
wording you could defend.

**Use instead:** A review or order-feed product that reports real activity. The
SDK has no feature that reads live orders.

### Creating urgency around a deadline

**Why not:** A rotation of purchase notifications says "others are buying", not
"this ends soon", and it carries no time information.

**Use instead:** [`timer`](../../../display/timer/guide/overview.md) — a countdown
tied to a real end time.

### Holding on to a visitor who is leaving

**Why not:** Notifications appear on a fixed schedule regardless of what the
visitor is doing, so they will not be on screen at the moment someone reaches for
the tab bar.

**Use instead:**
[`simple-exit-intent`](../../../behavior/simple-exit-intent/guide/overview.md) — it
watches for the exit gesture and shows one offer.

## Next steps

- [get-started.md](./get-started.md) — the call, with every option
- [reference/events.md](./reference/events.md) — the `fomo:shown` payload
- [relations.md](./relations.md) — why it waits for campaign data
- [glossary.md](./glossary.md) — the terms used here
