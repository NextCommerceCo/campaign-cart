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
