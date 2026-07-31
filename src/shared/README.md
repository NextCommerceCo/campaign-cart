# shared/

Non-feature-specific building blocks used across more than one feature. If code
is used by a single feature, it belongs in that feature's folder instead — the
moment a second feature needs it, it moves here.

Not part of the public API surface (`src/index.ts`); free to move/rename.

## Layout

| Path | Export | What it is |
|------|--------|------------|
| `components/loading-overlay.ts` | `LoadingOverlay` | Overlay shown during async actions (add-to-cart, checkout submit) |
| `modals/general-modal.ts` | `GeneralModal` | Generic modal shell reused by features that need a dialog |
| `utils/template-renderer.ts` | `TemplateRenderer` | Renders `data-next-*` templates to DOM |
| `utils/discount-renderer.ts` | `discountRenderer` | Formats/renders discount lines |
| `utils/slot-conditionals.ts` | `slotConditionals` | Evaluates conditional template slots |

## Rules

- Files are kebab-case; exported classes/functions keep their JS casing.
- `shared/` may import `core/`, `state/`, `types/`, `utils/` — never `features/`.
- Keep this table in sync when adding or moving files here.
