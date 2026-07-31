---
title: "Features/UI/Scroll Hint/Get Started"
group: "Features"
category: "Scroll Hint"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `scroll-hint` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```

## Turn it on

Put `data-next-component` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-component="scroll-hint"]`.

These attributes are required:

| Attribute | Type | What it does |
|---|---|---|
| `data-next-component` | `string` | Must be `"scroll-hint"`. |

Everything else is optional — see [attributes.md](./reference/attributes.md).

### A hint that hides once the list is scrolled

```html
<div class="cart-items">
  <div data-next-component="scroll-hint" data-next-scroll-target="#list">
    Scroll for more items
  </div>
  <div id="list">
    <div class="row">Row 1</div>
    <div class="row">Row 2</div>
    <div class="row">Row 3</div>
    <div class="row">Row 4</div>
    <div class="row">Row 5</div>
    <div class="row">Row 6</div>
  </div>
</div>
```

This is the markup `e2e/fixtures/scroll-hint.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, the console shows `ScrollHintEnhancer initialized` under `ScrollHintEnhancer`. No line means the feature never activated — check the activating attribute is spelled exactly as above.
- It emits `scroll-hint:updated`. Listen for one to confirm it is running:
  ```js
  window.nextReady.push(() => {
    next.on('scroll-hint:updated', payload => console.log(payload));
  });
  ```
- It sets `cart-items__scroll-hint--active`: on the hint while it should be visible: the target is at the top and has more content below. Style the hint as hidden by default and reveal it with this class. Watch that class in the element inspector — it is the quickest check that state is tracking.

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [reference/events.md](./reference/events.md) — payloads you can hook
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
