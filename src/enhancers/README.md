# Enhancers

Enhancers are DOM-bound classes that activate on elements with `data-next-*` attributes. Each enhancer is responsible for wiring one element (or a subtree) to SDK stores and APIs.

## Folders

| Folder | Purpose |
|---|---|
| [`base/`](base/README.md) | Abstract base classes shared by all enhancers |
| [`cart/`](cart/README.md) | Package selection, add-to-cart, quantity, remove, cart item list |
| [`display/`](display/README.md) | Reactive data display (cart totals, package prices, order data, conditional show/hide, timers) |
| [`checkout/`](checkout/README.md) | Checkout form handling, validation, payment, express checkout |
| [`order/`](order/README.md) | Post-purchase upsell and order item list (thank-you / upsell pages) |
| [`profile/`](profile/README.md) | Pricing profile switching |
| [`ui/`](ui/README.md) | General UI: accordion, tooltip, scroll hint |
| [`behavior/`](behavior/README.md) | Engagement behaviors: FOMO popup, exit intent |
| [`core/`](core/README.md) | SDK initialization and DOM attribute scanning |

## How Enhancers Work

1. `AttributeScanner` (core) scans the DOM on init using `AttributeParser.getEnhancerTypes(element)`.
2. For each element + type pair, it instantiates the matching enhancer class and calls `initialize()`.
3. The enhancer subscribes to Zustand stores and EventBus events.
4. On store updates, `update()` / internal handlers re-render or adjust the DOM.
5. On `destroy()`, all subscriptions and event listeners are cleaned up.

## Base Class Hierarchy

```
BaseEnhancer
├── BaseCartEnhancer     (adds cart store subscription helpers)
├── BaseActionEnhancer   (adds executeAction with loading state)
└── BaseDisplayEnhancer  (internal, adds display pipeline for data-next-display)
```

## Attribute → Enhancer Mapping (key ones)

| Attribute | Enhancer |
|---|---|
| `data-next-action="add-to-cart"` | `AddToCartEnhancer` |
| `data-next-action="accept-upsell"` | `AcceptUpsellEnhancer` |
| `data-next-toggle` | `CartToggleEnhancer` |
| `data-next-selector` / `data-next-cart-selector` | `PackageSelectorEnhancer` |
| `data-next-cart-items` | `CartItemListEnhancer` |
| `data-next-quantity="increase\|decrease\|set"` | `QuantityControlEnhancer` |
| `data-next-remove-item` | `RemoveItemEnhancer` |
| `data-next-coupon` | `CouponEnhancer` |
| `data-next-display="cart.*"` | `CartDisplayEnhancer` |
| `data-next-display="package.*"` | `ProductDisplayEnhancer` |
| `data-next-display="selection.*"` | `SelectionDisplayEnhancer` |
| `data-next-display="order.*"` | `OrderDisplayEnhancer` |
| `data-next-display="shipping.*"` | `ShippingDisplayEnhancer` |
| `data-next-show` / `data-next-hide` | `ConditionalDisplayEnhancer` |
| `data-next-timer` | `TimerEnhancer` |
| `data-next-quantity-text` | `QuantityTextEnhancer` |
| `data-next-checkout` (on `<form>`) | `CheckoutFormEnhancer` |
| `data-next-express-checkout="container"` | `ExpressCheckoutContainerEnhancer` |
| `data-next-order-items` | `OrderItemListEnhancer` |
| `data-next-upsell="offer"` | `UpsellEnhancer` |
| `data-next-profile` (button) | `ProfileSwitcherEnhancer` |
| `data-next-profile-selector` (select) | `ProfileSelectorEnhancer` |
| `data-next-accordion` | `AccordionEnhancer` |
| `data-next-tooltip` | `TooltipEnhancer` |
| `data-next-component="scroll-hint"` | `ScrollHintEnhancer` |
