---
title: "Features/Display/Product Display/Errors"
group: "Features"
category: "Product Display"
---

# Errors

## `ProductDisplayEnhancer: data-next-display attribute is required`

| | |
|---|---|
| Type | Fatal |
| Cause | The element was matched as a display but has no `data-next-display` attribute (thrown by the base display layer during init). |

**Fix:** Add the attribute with a path.

```html
<span data-next-display="package.price">$0.00</span>
```

---

## `No package context found - package ID required` (warning, not thrown)

| | |
|---|---|
| Type | Recoverable |
| Cause | The path omits a package id and no ancestor `data-next-package-id` (or selector card) supplies one. |

**Fix:** Give the path an id (`package.123.price`) or wrap the element in an ancestor with `data-next-package-id="123"`. The element renders nothing until resolved.

---

## `Package {id} not found in campaign data` (warning, not thrown)

| | |
|---|---|
| Type | Recoverable |
| Cause | The resolved package id isn't present in the loaded campaign. |

**Fix:** Confirm the id is a real campaign package (compare with the `Available package IDs` debug log). The element shows its placeholder until a matching package loads.

---

## `Unknown campaign property: {property}` (warning, not thrown)

| | |
|---|---|
| Type | Recoverable |
| Cause | A `campaign.*` path names something other than `name`, `currency`, or `language`. |

**Fix:** Use one of the supported campaign properties, or a `package.*` path for package data.
