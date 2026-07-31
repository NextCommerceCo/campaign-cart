---
title: "Features/Display/Conditional Display/Errors"
group: "Features"
category: "Conditional Display"
---

# Errors

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every error `conditional-display` can raise, at the exact message, so a console line can be matched to a cause.

**Recoverable** means the visitor can get past it by retrying or correcting what they entered — no code change needed. **Fatal** means it happens every time until the markup, code, or config changes.

## `Either data-next-show or data-next-hide is required`

| | |
|---|---|
| Type | Fatal |
| Cause | The element activated the feature but carries neither attribute with a condition — so there is nothing to evaluate. |

**Fix:** Give the element a condition, or remove the attribute that turned the feature on. The usual cause is a leftover `data-next-show` with an empty value after an edit:

```html
<!-- throws -->
<div data-next-show="">Free shipping</div>

<!-- works -->
<div data-next-show="cart.total > 50">Free shipping</div>
```

The element is left as authored, so content meant to be conditional is **visible** rather than hidden.
