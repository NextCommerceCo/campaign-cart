# Errors

## `Required attribute data-package-id not found on element`

| | |
|---|---|
| Type | Fatal |
| Cause | The element has `data-next-remove-item` but is missing `data-package-id`. |

**Fix:**

Add `data-package-id` with the package `ref_id` to the element.

```html
<button data-next-remove-item data-package-id="42">Remove</button>
```

---

## `Invalid package ID: "{value}"`

| | |
|---|---|
| Type | Fatal |
| Cause | `data-package-id` is present but its value cannot be parsed as an integer (e.g., an empty string or a template variable that was not replaced). |

**Fix:**

Ensure the value is a numeric string matching a valid package `ref_id`. Inside `CartItemListEnhancer` templates, use `{item.packageId}` — the scanner skips elements whose `data-package-id` still contains `{` and `}` to prevent this.

---

## `Error in handleClick: {message}`

| | |
|---|---|
| Type | Recoverable |
| Cause | `cartStore.removeItem()` threw — typically a network error or a server-side validation error. |

**Fix:**

Check the network tab for a failed API request. The `error:occurred` event is also emitted on the EventBus with the full error detail. The `processing` class is removed automatically in the `finally` block so the button returns to its previous state and the user can retry.
