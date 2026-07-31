---
title: "Features/Cart/Cart Summary/Events"
group: "Features"
category: "Cart Summary"
---

# Events

CartSummaryEnhancer emits no events. It is a read-only display component that reflects cart state without producing output on the EventBus.

To react to cart total changes from outside this enhancer, subscribe to `cartStore` directly:

```ts
import { useCartStore } from '@/state/cart';

useCartStore.subscribe(state => {
  console.log('Total changed:', state.total.toNumber());
});
```
