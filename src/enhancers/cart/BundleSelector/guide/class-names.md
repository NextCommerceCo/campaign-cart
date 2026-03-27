# BundleSelectorEnhancer — Custom Class Names Guide

Every CSS class that `BundleSelectorEnhancer` applies to elements can be
overridden via `data-next-class-*` attributes on the enhancer's root element.
Defaults are the standard `next-*` names, so existing integrations require no
changes.

---

## Available overrides

| Attribute | Default class | Applied to |
|---|---|---|
| `data-next-class-bundle-card` | `next-bundle-card` | Each registered bundle card element |
| `data-next-class-selected` | `next-selected` | The currently selected bundle card |
| `data-next-class-in-cart` | `next-in-cart` | Cards whose items are all in the cart |
| `data-next-class-variant-selected` | `next-variant-selected` | The active custom variant option |
| `data-next-class-variant-unavailable` | `next-variant-unavailable` | Unavailable custom variant options |
| `data-next-class-bundle-slot` | `next-bundle-slot` | Each rendered slot wrapper div |
| `data-next-class-slot-variant-group` | `next-slot-variant-group` | The container wrapping a variant option group |

---

## Basic usage

```html
<div
  data-next-bundle-selector
  data-next-class-variant-unavailable="unavailable"
  data-next-class-variant-selected="selected"
>
  <div data-next-bundle-card data-next-bundle="starter" …>…</div>
  <div data-next-bundle-card data-next-bundle="premium" …>…</div>
</div>
```

With the above, unavailable variant options receive class `unavailable` instead
of `next-variant-unavailable`. All other classes remain at their defaults.

---

## Overriding all classes

```html
<div
  data-next-bundle-selector
  data-next-class-bundle-card="bundle"
  data-next-class-selected="active"
  data-next-class-in-cart="purchased"
  data-next-class-variant-selected="var-active"
  data-next-class-variant-unavailable="var-disabled"
  data-next-class-bundle-slot="slot"
  data-next-class-slot-variant-group="variant-group"
>…</div>
```

---

## How it works

`parseClassNames()` runs once at the start of `initialize()` and reads each
`data-next-class-*` attribute, falling back to the `next-*` default when the
attribute is absent:

```
initialize()
  → parseClassNames()         — reads data-next-class-* attrs, fills ClassNames
  → stored as this.classNames
  → passed into RenderContext and HandlerContext
  → renderer.ts / handlers.ts use ctx.classNames.* instead of literals
```

The resolved names are **fixed for the lifetime of the enhancer**. Changing the
attributes after initialization has no effect.

---

## CSS targeting

When using custom names you target them the same way as the defaults:

```css
/* default */
.next-variant-unavailable { opacity: 0.4; pointer-events: none; }

/* after data-next-class-variant-unavailable="unavailable" */
.unavailable { opacity: 0.4; pointer-events: none; }
```

Data attributes (`data-next-unavailable`, `data-next-selected`, `data-next-in-cart`)
are always written regardless of class name overrides and can be used as an
alternative CSS hook:

```css
[data-next-unavailable="true"] { opacity: 0.4; pointer-events: none; }
```

---

## Common mistakes

| Mistake | Problem | Fix |
|---|---|---|
| Setting `data-next-class-*` on a card element instead of the root | Attribute is never read — `parseClassNames()` reads from `this.element` (the selector root) | Move the attribute to the `data-next-bundle-selector` element |
| Changing the attribute after page load | Class names are parsed once at `initialize()` | Set the attribute before the SDK initialises, or destroy and re-initialise the enhancer |
| Expecting class removal on `destroy()` to use the new name | `destroy()` uses the resolved `classNames` object, so this works correctly — no action needed | — |

---

## Related files

| File | Role |
|---|---|
| `BundleSelectorEnhancer.ts` | `parseClassNames()`, `makeRenderContext()`, `makeHandlerContext()`, all usages of `this.classNames` |
| `BundleSelectorEnhancer.types.ts` | `ClassNames` interface; `classNames` field on `RenderContext` and `HandlerContext` |
| `BundleSelectorEnhancer.renderer.ts` | Uses `ctx.classNames` when applying slot, variant-selected, variant-unavailable, and variant-group classes |
| `BundleSelectorEnhancer.handlers.ts` | Uses `ctx.classNames` when toggling selected and variant-selected classes on interaction |
