---
title: "Features/Checkout/Express Checkout Container/Logs"
group: "Features"
category: "Express Checkout Container"
---

# Logs

<!-- Generated from the logger calls in this feature's source. Do not edit by
     hand: change the log line in the code, then run `npm run docs:reference`. -->

Every message `express-checkout-container` can print, under the logger prefix `ExpressCheckoutContainerEnhancer`. Search a console line here to find what produced it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text either side of it.

## Warn

The feature carried on, but something in the markup or the data was not what it expected — usually a misspelled attribute or an id that matches nothing. Worth fixing even when the page looks fine.

| Message | Source | Extra context |
|---|---|---|
| `No buttons container found with data-next-express-checkout="buttons"` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.initialize` | — |
| `Unknown express payment method: {code}` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.updateExpressCheckoutButtons` | — |
| `Unknown payment method in methodOrder: {method}` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.updateExpressCheckoutButtons` | — |

## Info

Normal progress, useful for confirming the feature ran at all.

| Message | Source | Extra context |
|---|---|---|
| `Payment capabilities detected:` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.initialize` | yes |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `ExpressCheckoutContainerEnhancer initialized` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.initialize` | — |
| `PayPal not available on this device` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.updateExpressCheckoutButtons` | — |
| `Apple Pay not available on this device/browser` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.updateExpressCheckoutButtons` | — |
| `Google Pay not available on this device/browser` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.updateExpressCheckoutButtons` | — |
| `Link not available on this device/browser` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.updateExpressCheckoutButtons` | — |
| `Express checkout buttons updated from campaign data` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.updateExpressCheckoutButtons` | yes |
| `PayPal enabled in config but not available on device` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.updateExpressCheckoutButtons` | — |
| `Apple Pay enabled in config but not available on device/browser` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.updateExpressCheckoutButtons` | — |
| `Google Pay enabled in config but not available on device/browser` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.updateExpressCheckoutButtons` | — |
| `Link enabled in config but not available on device/browser` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.updateExpressCheckoutButtons` | — |
| `Express checkout buttons updated from config` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.updateExpressCheckoutButtons` | yes |
| `Express checkout container hidden - no methods enabled` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.hideContainer` | — |
| `Express checkout container shown` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.showContainer` | — |
| `PayPal express checkout button created` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.createPayPalButton` | — |
| `Apple Pay express checkout button created` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.createApplePayButton` | — |
| `Google Pay express checkout button created` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.createGooglePayButton` | — |
| `Link express checkout button created` | `express-checkout-container.enhancer.ts › ExpressCheckoutContainerEnhancer.createLinkButton` | — |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
