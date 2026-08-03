---
title: "Features/Display/Display Core/Errors"
group: "Features"
category: "Display Core"
---

# Errors

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every error `display-core` can raise, at the exact message, so a console line can be matched to a cause.

**Recoverable** means the visitor can get past it by retrying or correcting what they entered — no code change needed. **Fatal** means it happens every time until the markup, code, or config changes.

## `{name}: data-next-display attribute is required`

| | |
|---|---|
| Type | Fatal |
| Cause | A display enhancer was attached to an element with an empty or missing `data-next-display`. `{name}` is the enhancer class that reported it. |

**Fix:** Give the element a path — `data-next-display="cart.total"`. An empty value is the common case, left behind when a binding is removed but the attribute is not.
