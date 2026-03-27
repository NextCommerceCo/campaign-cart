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
