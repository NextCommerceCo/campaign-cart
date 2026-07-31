---
title: "Features/Display/Product Display/Logs"
group: "Features"
category: "Product Display"
---

# Logs

> This enhancer logs under the prefix: `[ProductDisplayEnhancer]`.

## Healthy output

```
[ProductDisplayEnhancer] ProductDisplayEnhancer initialized with package 123, path: package.price, format: currency, multiplyByQuantity: false
[ProductDisplayEnhancer] Package 123 loaded with price: 29.99 USD
```

---

## Debug

### `ProductDisplayEnhancer initialized with package {id}, path: {path}, format: {format}, multiplyByQuantity: {bool}`

**When:** Initialization completes.

**Meaning:** Expected. Confirms the resolved package id, display path, and format.

### `Package {id} loaded with price: {price} {currency}`

**When:** Package data is found in the campaign store.

**Meaning:** Expected — the value source is ready.

### `Currency changed, reloading package data`

**When:** A `next:currency-changed` event fires.

**Meaning:** Expected — the display is refreshing for the new currency.

### `Available package IDs in campaign state: {ids}`

**When:** A package lookup failed; lists what ids exist.

**Meaning:** Diagnostic aid for a "not found" warning — check your id against this list.

---

## Warn

### `No package context found - package ID required`

**When:** The path omits an id and no ancestor `data-next-package-id` (or selector card) was found.

**Meaning:** The element cannot resolve which package to show and renders nothing. **Action:** Add an id to the path or an ancestor context.

### `Package {id} not found in campaign data`

**When:** The resolved id doesn't match any package in the loaded campaign.

**Meaning:** Wrong id, or the campaign hasn't loaded that package. **Action:** Verify the id against the "Available package IDs" debug line.

### `Unknown campaign property: {property}`

**When:** A `campaign.*` path names a property other than `name` / `currency` / `language`.

**Meaning:** Unsupported campaign field; renders empty. **Action:** Use a supported campaign property.
