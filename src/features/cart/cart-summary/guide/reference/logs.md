---
title: "Features/Cart/Cart Summary/Logs"
group: "Features"
category: "Cart Summary"
---

# Logs

> This enhancer logs under the prefix: `CartSummaryEnhancer`

## Healthy output

When running correctly you should see:

```
[CartSummaryEnhancer] CartSummaryEnhancer initialized
```

After init, the enhancer re-renders silently on every cart change. No further logs appear during normal operation.

---

## Debug

### `CartSummaryEnhancer initialized`

**When:** The enhancer finishes `initialize()`.

**Meaning:** Expected behavior. The enhancer is subscribed to `cartStore` and has performed its first render (or is waiting for `totals` to be populated if the cart is not yet initialized).

---

## Warn

### `Unknown cart display property: "{property}"`

**When:** A `data-next-display="cart.…"` binding, or a `{token}` in a summary template, names a path the cart does not expose.

**Meaning:** The element keeps the placeholder text it was authored with. A summary row showing `{subtotal}` literally, or a stale hard-coded price, is this log.

**Action:** Check the path against [display-paths.md](./display-paths.md). Because the summary re-renders on every cart change, a misspelled token repeats this warning on each update — treat a repeating line as one bad token, not many.
