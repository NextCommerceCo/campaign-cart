# Base Enhancers

Foundation classes used by every enhancer in the project.

## Files

| File | Class | Purpose |
|---|---|---|
| `BaseEnhancer.ts` | `BaseEnhancer` | Abstract base — lifecycle, DOM helpers, EventBus, store subscriptions |
| `BaseCartEnhancer.ts` | `BaseCartEnhancer` | Extends `BaseEnhancer` — adds cart store subscription helpers |
| `BaseActionEnhancer.ts` | `BaseActionEnhancer` | Extends `BaseEnhancer` — adds `executeAction` with loading/disable state |
| `DOMObserver.ts` | `DOMObserver` | MutationObserver wrapper for `data-next-*` attribute changes |
| `AttributeParser.ts` | `AttributeParser` | Static utility — parses attributes, display paths, conditions, and determines enhancer types |

---

## BaseEnhancer

Abstract base for all enhancers. Constructor takes `HTMLElement`.

### Lifecycle (must implement)
```ts
initialize(): Promise<void> | void   // called once on mount
update(data?: any): Promise<void> | void  // called to refresh state
destroy(): void  // cleans subscriptions + event listeners (call super.destroy())
```

Override `cleanupEventListeners()` to remove any element event listeners added in `initialize()`.

### Store subscriptions
```ts
this.subscribe(store, listener)  // auto-cleaned on destroy()
```

### EventBus
```ts
this.emit('cart:item-added', { ... })
this.on('selector:item-selected', handler)
```

### DOM helpers
```ts
this.getAttribute(name) / setAttribute / removeAttribute / hasAttribute
this.addClass / removeClass / hasClass / toggleClass
this.updateTextContent(text) / updateInnerHTML(html)
```

### Error handling
```ts
this.handleError(error, 'contextName')  // logs + emits error:occurred
```

---

## BaseCartEnhancer

Extends `BaseEnhancer`. Call `setupCartSubscription()` in `initialize()`.

```ts
protected abstract handleCartUpdate(state: CartState): void

this.setupCartSubscription()     // subscribes to cart store
this.isCartEmpty()
this.getCartItems()              // CartItem[]
this.getCartItem(packageId)      // CartItem | undefined
this.hasPackageInCart(packageId) // boolean
this.getTotalQuantity()
this.getCartTotals()
```

---

## BaseActionEnhancer

Extends `BaseEnhancer`. Wraps async actions with loading state and concurrency guard.

```ts
await this.executeAction(
  async () => { /* do work */ },
  { showLoading: true, disableOnProcess: true }
)
```

Options:
- `showLoading` — adds `loading`/`next-loading` class + `aria-busy` during execution
- `disableOnProcess` — sets `disabled` attribute during execution

Emits `action:success` or `action:failed` automatically.

Other helpers:
```ts
this.isProcessing           // guard flag — executeAction returns early if true
this.setLoadingState(bool)  // manual loading toggle
this.debounceAction(fn, ms)
this.throttleAction(fn, ms)
```

---

## DOMObserver

`MutationObserver` wrapper. Watches for `data-next-*` attribute changes and new elements.

```ts
const observer = new DOMObserver()
observer.addHandler((event) => { /* event.type: 'added'|'removed'|'attributeChanged' */ })
observer.start()  // observe document.body
observer.stop()
observer.pause() / resume()
```

Default attribute filter: `data-next-display`, `data-next-toggle`, `data-next-timer`, `data-next-show`, `data-next-hide`, `data-next-checkout`, `data-next-validate`, `data-next-express-checkout`.

Throttles notifications at ~60fps (16ms batching).

---

## AttributeParser

Static utility class. All methods are static.

### Determine enhancer types for an element
```ts
AttributeParser.getEnhancerTypes(element)
// returns string[] e.g. ['display', 'conditional', 'selector']
```

### Parse a display path
```ts
AttributeParser.parseDisplayPath('cart.total')
// → { object: 'cart', property: 'total' }

AttributeParser.parseDisplayPath('package.2.price')
// → { object: 'package', property: '2.price' }
```

### Parse a value
```ts
AttributeParser.parseValue('true')   // → true (boolean)
AttributeParser.parseValue('42')     // → 42 (number)
AttributeParser.parseValue('{"a":1}')// → { a: 1 } (object)
AttributeParser.parseValue('hello')  // → 'hello' (string)
```

### Parse a condition expression
```ts
AttributeParser.parseCondition('cart.hasItems')
AttributeParser.parseCondition('cart.total > 50')
AttributeParser.parseCondition('cart.hasItem(123)')
AttributeParser.parseCondition('!cart.isEmpty')
AttributeParser.parseCondition('cart.hasItems && order.status == complete')
AttributeParser.parseCondition('param.src == facebook || param.src == google')
```
Returns a structured AST used by `ConditionalDisplayEnhancer`.
