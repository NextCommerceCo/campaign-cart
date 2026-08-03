---
title: "Features/UI/Accordion/Get Started"
group: "Features"
category: "Accordion"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `accordion` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```

## Turn it on

Put `data-next-accordion` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-accordion]`.

These attributes are required:

| Attribute | Type | What it does |
|---|---|---|
| `data-next-accordion` | `string (id)` | Marks the accordion and names it. |

Everything else is optional — see [attributes.md](./reference/attributes.md).

### A collapsible FAQ row, closed on load

```html
<!-- Closed-by-default accordion. Defaults: open-text "Hide", close-text
     "Show", toggle-class "next-expanded". -->
<div data-next-accordion="faq1" data-initial-state="closed">
  <div data-next-accordion-trigger="faq1">
    <span data-next-accordion-text="faq1">Show</span>
  </div>
  <div data-next-accordion-panel="faq1">
    <p>Frequently asked answer body.</p>
  </div>
</div>
```

This is the markup `e2e/fixtures/accordion.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, look for `AccordionEnhancer` lines in the console. None at all means the feature never activated.
- It emits `accordion:toggled`, `accordion:opened`, `accordion:closed`. Listen for one to confirm it is running:
  ```js
  window.nextReady.push(() => {
    next.on('accordion:toggled', payload => console.log(payload));
  });
  ```

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [reference/events.md](./reference/events.md) — payloads you can hook
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
