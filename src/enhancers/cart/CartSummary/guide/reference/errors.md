# Errors

CartSummaryEnhancer does not throw errors during normal operation. If `cartStore` has not yet populated `cartState` (cart not yet initialized), the enhancer renders nothing and waits silently for the next store update.

The only errors that can surface come from `BaseEnhancer.validateElement()`, which fires during `initialize()` if the bound DOM element is in an unexpected state. These are infrastructure-level errors, not specific to this enhancer.

If the summary renders blank and stays blank after the cart initializes, verify:

1. The SDK is initialized before the enhancer is registered — `SDKInitializer` must have run.
2. The cart contains at least one item — `cartStore.subtotal`, `total`, and `summary` are only populated after a cart API response.
3. Network requests to the cart API are succeeding — check the browser DevTools network tab.
