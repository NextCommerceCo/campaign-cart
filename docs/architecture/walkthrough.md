# One click, through the code

A shopper clicks `<button data-next-action="add-to-cart" data-next-package-id="2">` on a landing
page. This follows that click from the HTML to the API and back to the page, so the folders in
[structure.md](structure.md) have a path through them. Run `bun dev`, open a page with `?debug=1`
and watch the panel's state and events while you read.

## Before the click: the page boots

1. `src/loader.ts:30` reads the script tag, starts the campaign request and imports `boot`.
2. `src/boot.ts:148` creates the one `Engine` (`src/engine/engine.ts`). It restores the tab's
   saved cart and builds each domain's actions: `engine.cart`, `engine.selectors`,
   `engine.toggles`, `engine.visit`.
3. `src/boot.ts:203` binds the page: `bindAll` (`src/bindings/index.ts:17`) finds every
   `data-next-*` element once, and each binding returns a `render` function.
   `src/bindings/index.ts:42` subscribes them all: they run after every state change.
4. `src/boot.ts:315` starts the Engine. Once the campaign is in, `sdk.ready` fires and boot loads
   the lazy chunks the page needs (checkout, order, analytics) with `import()`.

## The click

5. `src/bindings/add-to-cart.ts:18` handles the click and calls one Engine action,
   `engine.cart.addItem(packageId, quantity)`. Bindings never call the network or change state
   themselves.
6. `addItem` (`src/engine/cart/cart.ts:251`) builds the new `items` group and goes through
   `setGroup` → `commit` → `apply` (`cart.ts:134`). Every cart change takes this path.
7. `apply` writes the cart slice with `ctx.update('cart', patch)`. `update`
   (`src/engine/engine.ts:257`) saves the slice to sessionStorage and schedules one render for
   this tick (`queueMicrotask`), however many updates happen in it.
8. `apply` then emits the domain events: `cart.updated` (`cart.ts:153`), then `cart.added` with
   the change (`cart.ts:158`). Events go through the bus (`src/engine/events/bus.ts:71`); their
   payload types are in `src/engine/events/carts.ts`.

## Pricing

9. `apply` ends with `recalculate()` (`cart.ts:112`): one price request per tick. `calculate`
   (`cart.ts:80`) asks the API (`src/engine/runtime/api.ts`, `POST /carts/calculate/`). A newer change
   makes an older request stale (`latestWins` in `src/engine/runtime/flow.ts`), so a slow answer never
   overwrites a newer one.
10. The answer is written to `cart.summary` and `cart.calculated` fires (`cart.ts:99`).

## Who hears it

- **The page**: the render scheduled in step 7 runs every binding again. A
  `data-next-display="cart.total"` element reads the value through `resolve`
  (`src/engine/display/values.ts`) and shows the new total.
- **Page scripts**: `next.on('cart.added', fn)` gets the event with its envelope (`src/boot.ts`).
- **Analytics**: `src/analytics/carts.ts` turns `cart.calculated` into `product_added_to_cart`
  (one per line) and `cart_updated`, typed by `TrackingMap` (`src/engine/events/analytics.ts`).
- **0.4.x pages**: `src/compat/legacy/events.ts` (the lazy legacy chunk) turns `cart.added` into
  `cart:item-added`; `next.on` takes 0.4.x names through `src/compat/legacy/registry.ts`.
- **Debug**: the panel (`src/debug/`) lists the event and the state change.

## What to read next

- A checkout page: `src/checkout/index.ts` binds the form, `src/checkout/state/checkout.ts`
  holds its actions, `place-order.ts` places the order.
- Every event and its payload: the Event Reference, generated from `src/engine/events/`.
- Every tracking event: the Analytics Reference, generated from `TrackingMap`.
