# features/

**What the SDK does** — one folder per domain. A *feature* is a DOM-bound
enhancer: it binds to a `data-next-*` attribute on the page, and `AttributeScanner`
(in `core/`) discovers matching elements and instantiates it. Features are not
free-standing services — they exist because some HTML asked for them.

> The `data-next-*` attribute + emitted-event surface is the **frozen public
> contract** (skill §0.1). Renaming/moving a feature is fine; changing its
> attributes or events is not, without approval.

## Categories

| Folder | Holds |
|--------|-------|
| `cart/` | Add-to-cart, package/bundle selectors, quantity, coupons, cart display, accept-upsell |
| `checkout/` | Checkout form, express checkout, address autocomplete, order building |
| `display/` | Reactive `data-next-display` bindings (product, selection, cart, order, conditional…) |
| `order/` | Post-purchase order views + upsells |
| `ui/` | Presentational widgets (accordion, tooltip, scroll-hint) |
| `behavior/` | Page-level behaviors (exit-intent) |

## Anatomy

A feature starts as one file and grows into a folder (~300 lines) split **by
layer**: `<name>.enhancer.ts` (orchestrator) + `.handlers.ts` / `.renderer.ts` /
`.types.ts`, plus colocated `tests/` and narrative `guide/` docs. See the
`sdk-structure` skill (§4) and `references/feature-authoring.md`.

## Dependency direction

Features may import `core/`, `state/`, `types/`, `utils/` — **never another
feature's internals**. Cross-feature signalling goes through the EventBus.

## Where the docs live

Reference docs (TypeDoc) cover the **public** API only (`src/index.ts`).
Feature internals are documented in each feature's **`guide/`** folder (see
`.claude/rules/guide.md`), not TypeDoc.
