# Errors

## `Required attribute data-next-quantity not found on element`

| | |
|---|---|
| Type | Fatal |
| Cause | The element matched the `[data-next-quantity]` selector but the attribute value is missing or empty. This should not happen under normal conditions since the selector requires the attribute. |

**Fix:** Ensure the element has a non-empty `data-next-quantity` attribute.

```html
<!-- wrong -->
<button data-next-quantity data-package-id="42">+</button>

<!-- correct -->
<button data-next-quantity="increase" data-package-id="42">+</button>
```

---

## `Invalid value for data-next-quantity: "{value}". Must be 'increase', 'decrease', or 'set'.`

| | |
|---|---|
| Type | Fatal |
| Cause | `data-next-quantity` is present but contains an unrecognised value. The enhancer will not initialise. |

**Fix:** Use one of the three valid values: `increase`, `decrease`, or `set`.

---

## `Required attribute data-package-id not found on element`

| | |
|---|---|
| Type | Fatal |
| Cause | `data-package-id` is missing or empty. The enhancer cannot identify which cart item to target. |

**Fix:** Add `data-package-id` with the numeric package `ref_id`.

```html
<button data-next-quantity="increase" data-package-id="42">+</button>
```

When used inside a `CartItemListEnhancer` template, use the `{item.packageId}` token — it is replaced at render time.

---

## `Invalid package ID: "{value}"`

| | |
|---|---|
| Type | Fatal |
| Cause | `data-package-id` is present but its value cannot be parsed as an integer (e.g., it still contains the template variable `{item.packageId}` because the element was not rendered by `CartItemListEnhancer`). |

**Fix:** Ensure `data-package-id` contains a plain integer. If the element is inside a `CartItemListEnhancer` template but the attribute was not replaced, check that `CartItemListEnhancer` is initialised and the template token is spelled correctly.

---

## `Error in handleClick: {message}` / `Error in handleQuantityChange: {message}`

| | |
|---|---|
| Type | Recoverable |
| Cause | The cart API call (`updateQuantity` or `removeItem`) returned an error. The `processing` class is removed and, for `set` mode, the input value is reset to the current cart quantity. |

**Fix:** Check the network tab for the failing API request. Common causes: session expired, package no longer available, server error. No code change required unless the API contract has changed.
