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
  must subscribe to), `display` (deriving what to show without touching the DOM). Prefix
  the role when one file per domain is clearer than one big file —
  `conditional-display.order-properties.ts`, `order-display.line-properties.ts`. Do not
  invent a sixth name for a job one of these already describes; two features naming the
  same job differently is what makes a layout unlearnable.
- Note `state` means *derived state*, not a Zustand store, when it sits inside a feature
  folder (`bundle-selector.state.ts` builds a view model). Stores live in `src/state/`.
- Folders are kebab-case too (`features/cart/add-to-cart/`).
- `index.ts` stays `index.ts` (barrel — exports only).
- **Kebab governs the file name only.** Identifiers inside keep normal JS casing: classes/types PascalCase (`AddToCartEnhancer`, `CartState`), functions/vars camelCase.

Why kebab (not PascalCase/camelCase): it is case-safe on case-insensitive filesystems (macOS/Windows), so an import can't break on a wrong capital, and it stays uniform with the dotted role suffixes. Existing PascalCase enhancer files and camelCase store files are legacy — they move to this scheme during migration (see the `sdk-structure` skill).

## Strict Mode Rules
The project uses TypeScript strict mode. Follow these:
- No non-null assertions (`!`) — use optional chaining (`?.`) or explicit null checks
- Prefer nullish coalescing (`??`) over `||` for default values
- Prefer optional chaining (`?.`) over manual null checks
- No `any` unless truly unavoidable; prefer `unknown` with type guards (`src/utils/typeGuards.ts`)
- No unused variables — prefix intentionally unused params with `_`

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
