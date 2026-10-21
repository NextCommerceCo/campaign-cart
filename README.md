# NEXT Campaign SDK

One headless **Engine** owns all campaign state (Action → State → Event). DOM bindings,
analytics and debug tools subscribe to its events. Design:
[docs/architecture/design.md](docs/architecture/design.md).

```html
<script type="module" src=".../loader.js" data-campaign="pk_live_…" data-funnel="my-funnel"></script>
```

**Status:** landing and cart features are built (display, show/hide, bundle selector,
order bumps, add to cart, cart summary, coupon, quantity, `?forcePackageId`), plus
analytics and attribution. Checkout, upsell and receipt are not built yet, so this is not a drop-in replacement for
the 0.4.x SDK on those pages. See the status column in
[design.md §4](docs/architecture/design.md#4-html-api).

| Command | |
|---|---|
| `npm test` | unit tests (the Engine suite runs in plain Node) |
| `npm run typecheck` | TypeScript |
| `npm run build` | build `dist/` (CI only, not committed) and fail if a file is over its gzip budget |
