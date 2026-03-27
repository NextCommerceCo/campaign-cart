# Events

CartSummaryEnhancer emits no events. It is a read-only display component that reflects cart state without producing output on the EventBus.

To react to cart total changes from outside this enhancer, subscribe to `cartStore` directly:

```ts
import { useCartStore } from '@/stores/cartStore';

useCartStore.subscribe(state => {
  console.log('Total changed:', state.totals.total.formatted);
});
```
