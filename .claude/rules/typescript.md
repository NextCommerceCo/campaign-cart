# TypeScript Conventions

## Path Aliases
Always use path aliases — never relative `../../` imports across module boundaries:
- `@/` → `src/`
- `@/types/` → `src/types/`
- `@/utils/` → `src/utils/`
- `@/state/` → `src/state/`
- `@/features/` → `src/features/`
- `@/api/` → `src/api/`
- `@/core/` → `src/core/`

That is the complete list, from `tsconfig.json` `paths` (mirrored in
`vite.config.ts`). There is no `@/stores/` or `@/enhancers/` alias — those folders
were renamed to `state/` and `features/`, and an import using the old alias does not
resolve.

Relative imports (`./foo`, `../bar`) are fine within the same directory or one level up inside a feature folder.

## File Naming

Files are **kebab-case with a dotted role suffix**: `<name>.<role>.ts`.

- Roles: `enhancer`, `handlers`, `renderer`, `types`, `state`, `slice`, `api` — e.g. `add-to-cart.enhancer.ts`, `cart.state.ts`, `coupon.slice.ts`.
- A feature that outgrows those four layers may add a role naming **what the file
  computes**, as long as it already exists somewhere in `src/features/`: `price` (money
  maths), `properties` (turning a `{object}.{property}` path into a value), `conditions`
  (evaluating a condition to a boolean), `dependencies` (deciding which stores a feature
  must subscribe to), `cards` (finding and registering the DOM cards a selector binds to),
  `styles` (a CSS string the feature injects). Prefix the role when one file per domain is
  clearer than one big file — `conditional-display.order-properties.ts`,
  `order-display.line-properties.ts`. Do not invent another name for a job one of these
  already describes; two features naming the same job differently is what makes a layout
  unlearnable.
- Two roles do **not** mean what they look like, and both have bitten a refactor:
  - `state` inside a feature folder is *derived state*, not a Zustand store
    (`bundle-selector.state.ts` builds a view model). Stores live in `src/state/`.
  - `display` in `features/cart/` is **a second, DOM-activated enhancer** —
    `package-selector.display.ts` exports `PackageSelectorDisplayEnhancer`, which
    `AttributeScanner` registers for `data-next-display="selector.…"`. It is *not* the
    "state → DOM" layer that the same suffix means in `features/display/`. Do not put a
    layer helper in one of those four files; a cart-state reconciler that writes to the
    cart belongs in `handlers`, and a read-only one in `renderer`. See finding 95 in
    [docs/code-findings.md](../../docs/code-findings.md) — those four enhancers are also
    invisible to `npm run docs:coverage` because it scans `*.enhancer.ts`.
- Folders are kebab-case too (`features/cart/add-to-cart/`).
- `index.ts` stays `index.ts` (barrel — exports only).
- **Kebab governs the file name only.** Identifiers inside keep normal JS casing: classes/types PascalCase (`AddToCartEnhancer`, `CartState`), functions/vars camelCase.

Why kebab (not PascalCase/camelCase): it is case-safe on case-insensitive filesystems (macOS/Windows), so an import can't break on a wrong capital, and it stays uniform with the dotted role suffixes. Existing PascalCase enhancer files and camelCase store files are legacy — they move to this scheme during migration (see the `sdk-structure` skill).

## Strict Mode Rules
The project uses TypeScript strict mode. Follow these:
- No non-null assertions (`!`) — use optional chaining (`?.`) or explicit null checks
- Prefer nullish coalescing (`??`) over `||` for default values
- Prefer optional chaining (`?.`) over manual null checks
- No `any` unless truly unavoidable; prefer `unknown` with a type guard. There is no shared
  guard module: `src/utils/typeGuards.ts` had 23 exports and zero callers and was deleted
  2026-08-02. Write the guard where it is used, or factor one into `src/utils/` if a second
  call site appears
- No unused variables — prefix intentionally unused params with `_`

## Dead-code gates
`tsconfig.json` sets `noUnusedLocals`/`noUnusedParameters` to `false`, so the compiler never
reports a dead import, local, or parameter on its own. Two ratcheted gates cover what that
leaves open — both frozen-baseline scripts, same shape as `type-check-tests.mjs`:
- `npm run check:unused` — unused locals/parameters/imports (`scripts/check-unused.mjs`),
  via `tsconfig.unused-check.json` with those two flags turned on for this run only.
- `npm run check:unused-exports` — unused *exports*: a named export nothing in
  `src/`/`e2e/`/`scripts/` imports (`scripts/check-unused-exports.mjs`). This is the gap the
  first gate cannot see — `noUnusedLocals` only inspects a binding inside its own file, never
  whether another file imports it. It is a hand-rolled TypeScript-AST scanner, not ts-prune or
  knip: both were evaluated and knip silently returned zero findings on this repo's full tree
  (see the script's header comment for the reproduction). `src/index.ts` and `src/styles.ts`
  (the two real build entries) are exempt by design, as is anything only reachable through a
  computed `import()` path — see the header comment before adding a third exemption.

Run `npm run check:unused-exports:update` (or `check:unused:update` for the sibling gate) to
re-freeze the baseline after a deliberate change to what is tolerated, with a `notes` entry
saying why.

## Type Definitions
- Global event types: `src/types/global.ts` → `EventMap`
- Campaign/package/product types: `src/types/campaign.ts`
- Cart types: `src/types/cart.ts`
- API request/response types: `src/types/api.ts`
- Add new shared types to these files; avoid inline `type` declarations for reused shapes

## Code Style
- 2-space indentation, semicolons, single quotes
- 80-character line width (Prettier enforced)
- Trailing commas (ES5 style)
- Arrow function parens: omit for single params (`x => x + 1`)
- Run `npm run format` after significant changes; `npm run type-check` before considering work done
