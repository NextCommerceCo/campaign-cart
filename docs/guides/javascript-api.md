# `window.next`

Available after the `ready` event (`next.on('ready', fn)` also fires for late listeners).

| Member                                                    | Does                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `next.version`                                            | SDK version                                                                                                  |
| `next.getState()`                                         | The whole state: `campaign`, `cart`, `selectors`, `visit`, `checkout`, `order`                               |
| `next.on(event, fn)`                                      | Listen to an [event](events.md); returns an unsubscribe function                                             |
| `next.bind(root)`                                         | Bind attributes inside markup added after the page loaded                                                    |
| `next.log.level`                                          | What reaches the console: `debug`, `info`, `warn` (default), `error`, `silent`; `?debug=1` starts at `debug` |
| `next.log.entries()`                                      | The last 200 SDK log entries `{ level, message, data?, at }`, whatever the level                             |
| `next.log.stream(fn, { replay? })`                        | Call `fn` with every new entry (and the earlier ones with `replay`); returns an unsubscribe function         |
| `next.actions.addItem(packageId, qty?)`                   | Add a package                                                                                                |
| `next.actions.removeItem(packageId)`                      | Remove a package                                                                                             |
| `next.actions.setQuantity(packageId, qty)`                | Change a package's quantity                                                                                  |
| `next.actions.setGroup(id, { lines, vouchers? } \| null)` | Replace (or remove) a named group of lines                                                                   |
| `next.actions.clear()`                                    | Empty the cart                                                                                               |
| `next.actions.applyCoupon(code)` / `removeCoupon(code)`   | Coupons; `applyCoupon` resolves `false` when the server gives no discount                                    |
| `next.actions.setShipping(id)`                            | Shipping method                                                                                              |

Kept for 0.4.x page scripts, each marked `@deprecated` with its replacement:
`addItem({ packageId, quantity })`, `clearCart()`, `swapCart(items)`, `applyCoupon(code)`,
`getPackage(id)`, `getCampaignData()`, `getCartData()` (0.4.x shape), `exitIntent(options)`,
`getShippingMethods()`, `setShippingMethod(id)`, `getSelectedShippingMethod()`, the
`window.nextReady` queue, and the `next:ready` / `next:initialized` window events.

The other 0.4.x members are gone; no live page calls them. [parity-0.4.md](../architecture/parity-0.4.md)
lists each one with what to use instead.

## Debugging with `?debug=1`

`?debug=1` on the page URL sends every SDK log line to the console and adds a round **N**
button in the bottom-left corner. It shows the number of issues on the page; click it for a
menu with the cart, campaign, SDK version, API, funnel and storage scope, and a link into each
panel tab. The panel follows the system light or dark theme; **Position** moves it to the right.

| Tab      | Shows                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issues   | Elements whose `data-next-*` setup does not resolve (unknown path, unreadable condition, a package missing from the campaign), then logged warnings and errors. The button counts these                                                                                                                                                                                                                                                                                 |
| State    | `next.getState()` as a tree, `cart` open; open branches stay open as the state changes                                                                                                                                                                                                                                                                                                                                                                                  |
| Elements | Every element with a `data-next-*` attribute and what it resolves to now: a display's text, the value behind a show / hide and whether it shows, a package's name and price                                                                                                                                                                                                                                                                                             |
| Events   | The GA4 funnel on this page (a duplicate purchase turns red; click a step to see only it) and whether every event reached `NextDataLayer` and `dataLayer`. Below, oldest first, one card per thing the shopper did ("Picked bundle-2x") with the GA4 events it sent: what changed, the amount, and ⚠ when a field GA4 requires is missing or a push did not arrive. Click a row for its items and raw data; **Show SDK events** adds the engine events behind each card |
| Logs     | Every log line, including each API call: `api POST /api/v1/carts/calculate/ → 200 in 140 ms`                                                                                                                                                                                                                                                                                                                                                                            |

Hovering an element card outlines it on the page; clicking scrolls to it. **Pick an element**
(in the menu, or the arrow in the panel), then a click on the page, shows that element and its
SDK parents; the click does not reach the page, and Esc cancels. The filter narrows elements,
events and logs. **Reset saved data** clears this funnel's saved cart, form and order.

From the console, `nextDebug.explain(el)` gives the same for one element; with an element
selected in DevTools, `nextDebug.explain($0)`.
