# Events

`CartItemListEnhancer` does not emit any events.

Cart changes that trigger a re-render originate from `QuantityControlEnhancer` and `RemoveItemEnhancer` (which write to the cart store). To react to those changes, subscribe to `cartStore` directly:

```ts
import { useCartStore } from '@/stores/cartStore';

useCartStore.subscribe(state => {
  console.log('Cart updated', state.items);
});
```
