# state/

**Mutable reactive state** — Zustand stores shared across features (checkout
reads cart; upsell reads cart + campaign). This is the SDK's single source of
truth for runtime data.

## Stores

| Store | File | Purpose |
|-------|------|---------|
| `useCartStore` | `cart/` (+ `operations/`) | Cart items, totals, coupons, shipping. Async logic in `operations/`; `cart-calculator.ts` wraps the calculate API (used by `operations/` and cart features) |
| `useCampaignStore` | `campaign/` | Campaign/package data (10-min cache). Field is **`.data`**, not `.campaign` |
| `useOrderStore` | `order/` | Post-purchase order/upsell (15-min expiry) |
| `useCheckoutStore` | `checkout/` | Checkout form state & validation |
| `useConfigStore` | `config/` | SDK configuration |
| `useAttributionStore` | `attribution/` | UTM & referral tracking |
| `useParameterStore` | `parameter/` | URL parameters |

Every store is a `<domain>/` folder holding `<domain>.state.ts`, its
`<domain>.state-manifest.ts`, its `guide/`, and an `index.ts` barrel — so the
code and the docs that describe it sit together. Import a store through the
folder (`@/state/order`), never through its inner file.

The barrel and the inner `<domain>.state.ts` must resolve to **one** store
instance — two instances split state silently, and every unit test still passes
while the live page loses half its cart.
[`src/tests/contract/store-identity.test.ts`](../tests/contract/store-identity.test.ts)
asserts that, and reads each `persist` key back off the store so a rename fails
the test instead of a customer's session.

## Thin-state convention

A store is a **state container**: state fields + sync setters only. Async /
business logic lives **outside** the store — in the feature, or in an
`operations/` module (see `cart/operations/`, exposed as `sdk.cart.*`). Keep
`state/` thin and event-driven.

## Rules that bite

- **`persist` keys are permanent** — renaming one invalidates live customer
  sessions. Never change them during a move.
- **Same instance** — every import must resolve to one store instance; two
  instances split state silently.
- `state/` must not import `features/`. It may read `utils/` and `core/` infra.

Full authoring rules: the `sdk-structure` skill →
`references/state-authoring.md`. Docs for state internals live here + in the
skill, not in TypeDoc (which covers the public `index.ts` surface only).
