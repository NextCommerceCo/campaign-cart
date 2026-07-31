# State Reference Template

How to document one store so a reader knows its **schema, what it holds, what
they can do with it, what the data looks like, and what to watch out for**.
One `state-reference.md` per store (in the store's folder, or a `state/` docs
section). Covers the four reader questions for state (sdk-docs §3).

> Read (fields, selectors) vs. Write (operations, setters) must be visually
> separated — a reader has to know what mutates state and through which layer.

---

## Template

````md
# {StoreName} (`use{Name}Store`)

> Persist key: `{key}` · Persistence: `{sessionStorage | none | TTL Nm}`
> Last reviewed: {YYYY-MM-DD}

{One sentence — what this store holds, in product terms.}

## Schema

| Field | Type | Nullable | Kind | Meaning |
|-------|------|----------|------|---------|
| `items` | `CartItem[]` | no | persisted | Lines the shopper has added |
| `total` | `Decimal` | no | computed | Final amount incl. discounts + shipping |
| `shippingMethod` | `ShippingMethod` | yes | persisted | `null` = not chosen yet |
| `isCalculating` | `boolean` | no | transient | `true` while a totals API call is in flight |

- **Kind** = `persisted` (survives reload via the persist key) / `computed`
  (derived, overwritten on recalc) / `transient` (runtime only).
- Describe nullability in product terms, not "optional".

## Operations — what you can do

**Blessed API (call these):** `sdk.cart.*` / `cartOperations` — the async
business logic.

| Operation | Effect |
|-----------|--------|
| `addItem(item)` | Adds/increments a line, then recalculates totals |
| `swapCart(items)` | Replaces the whole cart atomically |
| `applyCoupon(code)` | Adds a voucher and recalculates; returns `{success, message}` |

**Sync setters (state container):** `setLastCurrency`, `setItemProperties`,
`reset` — write state directly, no API call.

**Selectors / reads:** `hasItem(id)`, `getItem(id)`, `getItemQuantity(id)`,
`getCoupons()`.

> The store still exposes the async methods as `@deprecated` delegators for
> backward compatibility — document `sdk.cart.*` as the path; mention the store
> methods only as legacy.

## What the data looks like

```json
{
  "items": [
    { "packageId": 2, "quantity": 1, "price": 29.99, "title": "Starter Pack" }
  ],
  "totalQuantity": 1,
  "subtotal": "29.99",
  "total": "29.99",
  "shippingMethod": null,
  "isEmpty": false
}
```

## Cautions

- **`persist` key `{key}` is permanent** — renaming it wipes live carts (sessions
  reset silently). Add a field; never rename the key.
- {Store-specific trap, e.g. campaign field is `.data` not `.campaign`.}
- Async/business logic lives in `operations/` (thin-state) — don't add it to the
  store. See sdk-structure `references/state-authoring.md`.
- None beyond the standard behavior contracts, if that's the truth.
````

---

## Filling it in — checklist

- [ ] Every field has a **business meaning**, not just its type.
- [ ] Each field marked persisted / computed / transient.
- [ ] Operations split into **blessed API / sync setters / selectors**, each with an effect.
- [ ] A realistic **example JSON** snapshot.
- [ ] Cautions name the **trap + symptom + fix** (persist key, `.data`, TTL, thin-state).
- [ ] Blessed path (`sdk.cart.*`) documented first; store delegators noted as legacy.
- [ ] Cross-links to the operations' TypeDoc pages and to sdk-structure — no restating.

## The stores to cover

`useCartStore` (+ `operations/`), `useCampaignStore` (field is **`.data`**),
`useCheckoutStore`, `useOrderStore` (15-min TTL), `useConfigStore`,
`useAttributionStore`, `useParameterStore`. Persist keys and details:
sdk-structure `references/state-authoring.md` (authoring) — this file is the
**reader-facing** counterpart.
