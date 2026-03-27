# Relations

## Dependencies

- `orderStore` — required. The enhancer reads `canAddUpsells()`, `completedUpsells`, and `upsellJourney` from the order store. Without a loaded order the button stays permanently disabled.
- `configStore` — required for API client initialization and currency fallback.
- `ApiClient` — required to call the add-upsell endpoint.
- `LoadingOverlay` — required UI component; shown during the API call.
- `GeneralModal` — required UI component; shown when a duplicate upsell is detected.

## Conflicts

- `AddToCartEnhancer` — do not use on the same button or for the same package on a post-purchase page. `AddToCartEnhancer` writes to the cart store; `AcceptUpsellEnhancer` writes to the order API. The two stores are independent and writing to both for the same item will produce duplicate records.
- `CartToggleEnhancer` — same conflict as above. Do not use a toggle to manage upsell items.

## Common combinations

- `PackageSelectorEnhancer` (with `data-next-upsell-context`) + this — standard pattern for upsell pages with variant choice. The selector handles the visual state; this enhancer reads the selection and submits it.
- `UpsellEnhancer` + this — `UpsellEnhancer` renders the offer card and tracks the view; this enhancer handles the accept button. Used together on every post-purchase upsell page.
- `DeclineUpsellEnhancer` + this — paired on the same upsell page. The accept button submits and navigates forward; the decline button skips and navigates forward.
