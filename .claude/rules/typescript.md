# TypeScript Conventions

## Path Aliases
Always use path aliases — never relative `../../` imports across module boundaries:
- `@/` → `src/`
- `@/types/` → `src/types/`
- `@/utils/` → `src/utils/`
- `@/stores/` → `src/stores/`
- `@/enhancers/` → `src/enhancers/`
- `@/api/` → `src/api/`

Relative imports (`./foo`, `../bar`) are fine within the same directory or one level up inside a feature folder.

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
