---
title: "Core/Test Mode"
group: "Core"
category: "Core Subsystems"
---

# Test mode

> Category: `core`
> Last reviewed: 2026-07-31
> Owner: Campaign Cart SDK

Test mode is how a checkout gets walked end to end without anyone typing a real name, a
real address, or a real card: a hard-coded customer in Tempe, Arizona, a test card token,
and one keyboard sequence that fills the form and submits it. What it is not — and the
single most important sentence on this page — is a sandbox. The order it creates is posted
to the same order endpoint, with the same API key, as a shopper's order, and it lands in
the campaign as a record someone has to account for. Read this page before putting
`?test=true` or `?debugger=true` on any URL that points at a live campaign.

## Concept

Two things share the name "test mode", and keeping them apart explains almost every
surprise.

**A flag that hardly anything reads.** `?test=true` sets an in-memory flag on the test-mode
manager (`core/test-mode.ts › TestModeManager.checkUrlTestMode`). `?debugger=true` and
`window.nextConfig.debugger === true` set the same flag as a side effect
(`core/test-mode.ts › TestModeManager.checkUrlTestMode`) — which is
why opening the [debug overlay](./logging-and-debug.md) puts a page into test mode without
saying so. The flag gates two helpers that fill card fields
(`core/test-mode.ts › TestModeManager.fillTestCardData`,
`core/test-mode.ts › TestModeManager.showTestCardMenu`), and nothing in
the SDK calls either of them; they are reachable only by hand through
`window.nextDebug.testMode`, which exists only in debug mode. On its own, then, `?test=true`
changes nothing a visitor or a report would see.

**A keyboard sequence that places a real order.** The manager is a module-level singleton
(`core/test-mode.ts`), imported by the boot file (`core/sdk-initializer.ts`), and its
constructor calls the method that attaches a `keydown` listener to `document`
(`core/test-mode.ts › TestModeManager.initializeKonamiCode`). That happens at *import*, in
every build, on every page — a shopper's included. `handleKeyDown`
(`core/test-mode.ts › TestModeManager.handleKeyDown`) keeps a rolling
window of the last ten key codes and compares it against the Konami sequence
(↑↑↓↓←→←→BA). **It does not check whether test mode is on**, so no parameter is needed to
arm it and no parameter can disarm it.

```
  any keydown on document ──► rolling 10-key window ──► matches ↑↑↓↓←→←→BA ?
  test-mode.ts › TestModeManager.initializeKonamiCode (attached at import)      │ yes
                                                                  ▼
              popup + `?test=true` written into the address bar
              (test-mode.ts › TestModeManager.activateKonamiCode)
                                                                  │
                       DOM event `next:test-mode-activated` ───────┘
                                                                  │
        checkout-form.enhancer.ts › CheckoutFormEnhancer.initialize
        — present on any page with a checkout form
                                                                  ▼
        fills Test Order / Test Address 123 / Tempe AZ 85281, card_token 'test_card'
        (checkout-form.enhancer.ts › CheckoutFormEnhancer.handleKonamiActivation)
                                                                  │ ~1s later
                                                                  ▼
        apiClient.createOrder(...)  ── the REAL endpoint ──►  a real order record
        (checkout-form.enhancer.ts › CheckoutFormEnhancer.createTestOrder)
```

The order that comes back is treated exactly like a purchased one: the cart and checkout
stores are reset and the browser is sent to the success page with the new order's reference
(`checkout-form.enhancer.ts › CheckoutFormEnhancer.handleOrderRedirect`). A demo that ends in a Konami code therefore also empties the visitor's cart.

## Business logic

- **What arms the flag:** `?test=true`
  (`core/test-mode.ts › TestModeManager.checkUrlTestMode`), `?debugger=true` or
  `window.nextConfig.debugger === true`
  (`core/test-mode.ts › TestModeManager.checkUrlTestMode`), and the Konami sequence, which
  sets it and then writes `test=true` into the address bar with `history.replaceState`
  (`core/test-mode.ts › TestModeManager.activateKonamiCode`).
  `?debug=true`, `window.nextConfig.debug`, and the `next-debug` meta tag do **not** arm it —
  see the switch table in [logging and the debug overlay](./logging-and-debug.md).
- **What the flag itself does:** it lets `fillTestCardData()` and `showTestCardMenu()` run
  (`core/test-mode.ts › TestModeManager.fillTestCardData`,
  `core/test-mode.ts › TestModeManager.showTestCardMenu`). Both are dead in normal use, so the four test card numbers the manager
  carries never reach a form on their own. The real submission path does not use them — it
  sends the token string `test_card` instead.
- **The Konami path needs a checkout form, not test mode.** `CheckoutFormEnhancer`
  subscribes to `next:test-mode-activated` when it initialises
  (`checkout-form.enhancer.ts › CheckoutFormEnhancer.initialize`) and acts on it only for
  `detail.method === 'konami'`
  (`checkout-form.enhancer.ts › CheckoutFormEnhancer.handleKonamiActivation`). On a page
  with no enhanced checkout form the sequence shows its popup, adds `?test=true`, and
  stops there.
- **What gets posted:** shipping and billing address `Test Order, Test Address 123, Tempe AZ
  85281, US`, phone `+14807581224`, user `test@test.com` with `accepts_marketing: true`,
  `payment_detail: { payment_method: 'card_token', card_token: 'test_card' }`, and the cart's
  current lines (`checkout-form.enhancer.ts › CheckoutFormEnhancer.createTestOrder`). Billing is set same-as-shipping.
- **An empty cart does not stop it.** With no items, the request falls back to
  `package_id: 1, quantity: 1` (`checkout-form.enhancer.ts › CheckoutFormEnhancer.createTestOrder`), so the order succeeds and contains a package
  nobody selected.
- **The shipping method is guessed rather than asked for.** The handler picks the cart's
  method, else the campaign's first, else a hard-coded `Standard Shipping` at zero
  (`checkout-form.enhancer.ts › CheckoutFormEnhancer.handleKonamiActivation`) — and the
  request itself then sends `cartStore.shippingMethod?.id || 1`
  (`checkout-form.enhancer.ts › CheckoutFormEnhancer.createTestOrder`), so a test order on a
  page where no shipping was selected is shipped by method `1`, whatever that is on the
  campaign.
- **Attribution is overwritten with test markers**, which is the cleanest way to find these
  orders later: `utm_source: 'konami_code'`, `utm_medium: 'test'`,
  `utm_campaign: 'debug_test_order'`, `utm_content: 'test_mode'`, and
  `metadata.test_order: true` (`order-builder.ts › OrderBuilder.getTestAttribution`). This replaces the visitor's real attribution
  for that order, so a Konami order never carries the affiliate or click id it arrived with.
- **The API decides whether the order is a test order, not the SDK.** The response's
  `is_test` field is what marks it (`types/global.ts › OrderData`); the SDK only reads it. An
  order display renders `🧪 TEST ORDER` from it
  (`features/display/order-display/order-display.properties.ts › getDisplayValue`) and `data-next-show="order.is_test"`
  gates on it (`features/display/conditional-display/conditional-display.order-properties.ts › getOrderPropertyValue`) — worth putting on
  a receipt or upsell page you test against, so a test run is visible on screen.
- **`?test=true` follows the funnel once it is set.** Links the SDK builds carry the current
  URL's parameters plus everything the parameter store holds
  (`core/url-utils.ts › preserveQueryParams`), and the post-order redirect uses the same helper. So a
  Konami code on step one leaves every later page in test mode until a link is opened
  without it.
- **Neither `config.testMode` nor `checkout.testMode` is this switch.** The debug Config
  panel toggles `config.testMode` (`core/debug/panels/config-panel.ts › ConfigPanel.toggleTestMode`) and nothing reads
  it; `checkout.testMode` has a setter no code calls. Flipping either does not put the page
  into test mode, and neither marks an order.
- **The debug overlay's own test helper is the restrained one.** "Fill Test Data" in the
  Checkout State panel fills the same address, sets the payment method to credit card, and
  stops — no token, no submit (`core/debug/panels/checkout-panel.ts › CheckoutPanel.fillTestData`). Use it when
  what you want is a filled form rather than an order.

### Cautions

- **Test mode reaches the real order API.** **Trap:** `?test=true` and `?debugger=true` read
  as sandbox switches and are not; there is no test host, and the only thing distinguishing
  the request is a card token. **Symptom:** real orders on the live campaign, addressed to
  *Test Order, Test Address 123, Tempe AZ 85281* — and, on the shopper's side, a cart that
  was emptied and a redirect to a receipt page. **Fix:** run these on a staging campaign or
  a campaign whose orders you are willing to clean up; find what a session produced by
  filtering on `utm_campaign = debug_test_order` or the address above, and cancel or void
  those orders rather than assuming the API discarded them. Add
  `data-next-show="order.is_test"` to the pages you test so a test run is labelled on
  screen.
- **Opening the debug overlay arms it.** **Trap:** `?debugger=true` sets the test-mode flag
  silently (`core/test-mode.ts › TestModeManager.checkUrlTestMode`), so a debugging session on a live page starts with the
  test path live. **Symptom:** nothing at all — until someone in the room plays with the
  arrow keys on a checkout page. **Fix:** debug live pages with `?debug=true`, which turns on
  logging and nothing else; keep `?debugger=true` for staging, and if it must be used on a
  live page, stay off the checkout step and do not hand the keyboard over. Never leave either
  parameter on a published link or a redirect target.
- **The keyboard sequence is armed even with no parameter set.** **Trap:** the listener is
  attached at import and has no test-mode guard, so "we did not turn test mode on" is not
  protection. **Symptom:** a real order appears with the test address on a page nobody was
  testing. **Fix:** there is no page-level opt-out; short of a code change, the mitigation is
  to treat any checkout page as sensitive to that key sequence and to monitor for orders
  carrying the test attribution markers.

## Decisions

- **We chose the live order endpoint over a separate sandbox one,** because the API has no
  test host — the token is what marks an order as a test, and it is the gateway that decides.
  The cost is that every convenience on this page produces a real record, which is why the
  cautions above are the substance of the feature.
- **We chose one hard-coded US address over a configurable fixture,** so the path works on
  any page with no setup at all. The cost is that only a US/Arizona checkout can be exercised
  this way: another country's states, tax, or shipping rules cannot be reached through it.
- **We chose to tie the flag to `?debugger=true` so a debugging session has the test helpers
  without a second parameter,** which is convenient on staging and is exactly the hazard on a
  live page. If the two were separate, the overlay would be safe to open anywhere.
- **We chose a keyboard sequence over a visible button,** so nothing in the markup hints at
  it and a shopper cannot click it by accident. The cost is that it ships enabled and cannot
  be switched off from a page.
- **We chose to fall back to a default package when the cart is empty over refusing to
  submit,** so a checkout page can be exercised standalone. The cost is an order for a
  package nobody chose, which is one more reason these orders need cleaning up rather than
  ignoring.

## Limitations

- **Does not create a sandbox or a draft order.** Nothing local marks the order; the only
  test signal is what the API returns in `is_test`.
- **Does not fill a real payment form.** The card-filling helpers are unreachable in normal
  use, and the submission bypasses the payment fields entirely by sending a token, so it
  exercises neither the card inputs nor the payment gateway's own validation.
- **Does not test any payment method other than a card token.** There is no test path for
  PayPal or the alternative methods.
- **Does not work without an enhanced checkout form on the page.** Elsewhere the sequence
  only shows a popup and writes a parameter.
- **Cannot be disabled.** No attribute, meta tag, or config field switches the listener off,
  and it is attached before any page code can remove it.
- **Does not clean up after itself.** It leaves `?test=true` in the URL and in the parameter
  store, so the state travels to the next page in the funnel.
- **Does not announce itself on the event bus.** `next:test-mode-activated` is a DOM
  `CustomEvent` on `document` only, so `next.on(...)` cannot hear it — see
  [event bus](./event-bus.md) for the two channels.
