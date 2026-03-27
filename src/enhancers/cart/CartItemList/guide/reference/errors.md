# Errors

## `Required attribute data-next-cart-items not found on element`

| | |
|---|---|
| Type | Fatal |
| Cause | `validateElement()` ran on an element that is missing the activation attribute. This should not occur in normal use because the `AttributeScanner` only instantiates the enhancer on elements that carry `data-next-cart-items`. |

**Fix:** Ensure the element has the `data-next-cart-items` attribute. If you are instantiating `CartItemListEnhancer` manually (not via the SDK), pass the correct element.

---

## `Invalid title map JSON:`

| | |
|---|---|
| Type | Recoverable |
| Cause | The `data-title-map` attribute value could not be parsed as JSON. |

**Fix:** Correct the JSON in the attribute. Use double-quoted keys and values, no trailing commas.

```html
<!-- wrong -->
<div data-next-cart-items data-title-map="{'42': 'Main Product'}">

<!-- correct -->
<div data-next-cart-items data-title-map='{"42": "Main Product"}'>
```

---

## `Failed to enhance quantity button:`

| | |
|---|---|
| Type | Recoverable |
| Cause | `QuantityControlEnhancer.initialize()` threw on a `[data-next-quantity]` element inside the rendered list. |

**Fix:** Check that:
- The button has `data-package-id` set to a valid package ID.
- The `data-next-quantity` value is `"increase"` or `"decrease"`.
- `QuantityControlEnhancer` is importable (no build errors in that module).

```html
<!-- correct -->
<button data-next-quantity="decrease" data-package-id="{item.packageId}">−</button>
<button data-next-quantity="increase" data-package-id="{item.packageId}">+</button>
```

---

## `Failed to enhance remove button:`

| | |
|---|---|
| Type | Recoverable |
| Cause | `RemoveItemEnhancer.initialize()` threw on a `[data-next-remove-item]` element inside the rendered list. |

**Fix:** Check that:
- The button has `data-package-id` set to a valid package ID.
- `RemoveItemEnhancer` is importable.

```html
<!-- correct -->
<button data-next-remove-item data-package-id="{item.packageId}">Remove</button>
```

---

## `Error in handleCartUpdate:`

| | |
|---|---|
| Type | Recoverable |
| Cause | An unexpected error occurred while processing a cart store update — typically a rendering error in `renderCartItem` or a DOM error during `innerHTML` assignment. |

**Fix:** Check the full error message logged alongside this one. Common causes:
- Template HTML that produces invalid DOM (e.g. unclosed tags).
- A `TemplateRenderer` token referencing a field that does not exist on the item data object.
