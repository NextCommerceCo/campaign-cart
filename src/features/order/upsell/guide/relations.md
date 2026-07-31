---
title: "Features/Order/Upsell/Relations"
group: "Features"
category: "Upsell"
---

# Relations

## Dependencies

- `useOrderStore` — required. Holds the completed order; the enhancer reads `canAddUpsells()`, calls `addUpsell()`, and records the upsell journey. Without a loaded order the offer stays hidden.
- `useConfigStore` — required for the API key used to build the `ApiClient` that submits the upsell.
- `useCampaignStore` — used to resolve package prices for the `upsell:added` event value and to pick the currency for the API call.
- `ApiClient` — used for the `addUpsell` request against the order.
- `<meta name="next-page-type" content="upsell">` — required for page-view tracking (`upsell:viewed`); the offer still works without it, but views are not recorded.

## Conflicts

- `AcceptUpsellEnhancer` (`data-next-action="accept-upsell"`) — a different, pre-purchase accept pattern. Do not put both on the same element; they target different stages (cart vs completed order) and would both try to own the click.

## Common combinations

- `ProductDisplayEnhancer` (`data-next-display="package.*"`) + this — renders the offered package's name, price, and image inside the upsell block.
- `PackageSelectorEnhancer` + this — supplies variant selection to a selector-mode upsell via `data-next-package-selector-id`.
- `BundleSelectorEnhancer` + this — supplies multi-item bundle selection (and vouchers) via `data-next-bundle-selector-id`.
- `OrderItemListEnhancer` (`data-next-order-items`) + this — shows the order's current lines on the same upsell/receipt page.
