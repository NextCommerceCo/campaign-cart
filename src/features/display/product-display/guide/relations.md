---
title: "Features/Display/Product Display/Relations"
group: "Features"
category: "Product Display"
---

# Relations

## Dependencies

- `useCampaignStore` — required. Supplies the `Package` data (on `.data.packages`) and the active currency the display renders.
- `useCartStore` — subscribed to so displays re-render when discounts/coupons change what a price should show.
- `PriceCalculator` (`@/features/display/price-calculator`) — computes the derived metrics (savings, unit prices, final prices).
- Package **context** — an ancestor `data-next-package-id` (or a selector card) when the display path omits the id. Provided by `PackageSelectorEnhancer` / `BundleSelectorEnhancer` cards, or plain markup.

## Conflicts

- None. Being read-only, multiple `ProductDisplayEnhancer` elements coexist freely, including many bound to the same package.

## Common combinations

- `PackageSelectorEnhancer` + this — a selector card carries `data-next-package-id`; displays inside it use shorthand paths and switch with the selection.
- `UpsellEnhancer` + this (`data-next-multiply-quantity`) — the shown price tracks the upsell's quantity control.
- `CartDisplayEnhancer` + this — package prices (this) alongside live cart totals (`cart.*`) on the same page.
