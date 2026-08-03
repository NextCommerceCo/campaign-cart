---
title: "Features/Checkout/Express Checkout Container/Errors"
group: "Features"
category: "Express Checkout Container"
---

# Errors

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every error `express-checkout-container` can raise, at the exact message, so a console line can be matched to a cause.

**Recoverable** means the visitor can get past it by retrying or correcting what they entered — no code change needed. **Fatal** means it happens every time until the markup, code, or config changes.

## `ExpressCheckoutContainerEnhancer can only be used on container elements`

| | |
|---|---|
| Type | Fatal |
| Cause | `data-next-express-checkout` is set to something other than `"container"` on the element that should hold the wallet buttons. |

**Fix:** The container takes `data-next-express-checkout="container"`; the individual buttons take a method name. Nesting is required — the container will not render buttons that are not inside it:

```html
<div data-next-express-checkout="container">
  <div data-next-express-checkout="buttons"></div>
</div>
```
