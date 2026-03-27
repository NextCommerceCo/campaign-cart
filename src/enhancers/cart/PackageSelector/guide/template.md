# PackageSelectorEnhancer — Auto-render / Template Mode

When `data-next-packages` (JSON array) and a template are both present, the enhancer
renders cards from the JSON data instead of using static HTML. This avoids repeating
card markup for each package.

---

## How it works

1. `data-next-packages` holds a JSON array of package objects.
2. The enhancer renders one card per object using the provided template.
3. Each rendered card gets `data-next-selector-card` and `data-next-package-id` set automatically.
4. Campaign store data (name, image, prices) is merged in for any keys not provided in the JSON.

---

## JSON object keys

| Key | Description |
|---|---|
| `packageId` | Package `ref_id` — **required** |
| `name` | Package name (falls back to campaign store) |
| `image` | Package image URL (falls back to campaign store) |
| `price` | Per-unit price from the campaign (falls back to campaign store) |
| `priceRetail` | Retail / compare price (falls back to campaign store) |
| `priceTotal` | Campaign price × quantity (falls back to campaign store) |
| `selected` | `true` to pre-select this card |
| *(any key)* | Available in the template as `{package.<key>}` |

---

## Providing the template

### Via `<template>` tag (recommended)

```html
<div data-next-package-selector
     data-next-selector-id="main"
     data-next-packages='[
       {"packageId": 10, "name": "1 Bottle", "badge": "Most Popular", "selected": true},
       {"packageId": 11, "name": "3 Bottles", "badge": "Best Value"}
     ]'
     data-next-package-template-id="pkg-tpl">
</div>

<template id="pkg-tpl">
  <div data-next-selector-card>
    <span class="badge">{package.badge}</span>
    <strong>{package.name}</strong>
    <span data-next-package-price></span>
    <del data-next-package-price="compare"></del>
  </div>
</template>
```

### Via inline attribute

```html
<div data-next-package-selector
     data-next-selector-id="main"
     data-next-packages='[{"packageId": 10, "selected": true}, {"packageId": 11}]'
     data-next-package-template='<div data-next-selector-card>
       <strong>{package.name}</strong>
       <span data-next-package-price></span>
     </div>'>
</div>
```

Prefer `data-next-package-template-id` for anything beyond a few lines — inline HTML in an
attribute is hard to maintain.

---

## Template tokens

Tokens use `{package.<key>}` syntax. Any key from the JSON object is available:

```html
<template id="pkg-tpl">
  <div data-next-selector-card>
    <!-- built-in keys -->
    <img src="{package.image}" alt="{package.name}">
    <strong>{package.name}</strong>

    <!-- custom keys from your JSON -->
    <span class="badge">{package.badge}</span>
    <p>{package.description}</p>

    <!-- price slots — filled by the enhancer after render -->
    <span data-next-package-price></span>
    <del data-next-package-price="compare"></del>
    <span data-next-package-price="savings"></span>
  </div>
</template>
```

---

## Common mistakes

| Mistake | Problem | Fix |
|---|---|---|
| Missing `packageId` in JSON object | Card renders but cannot be selected or priced | Always include `"packageId"` |
| Putting `data-next-package-id` in the template | Attribute is overwritten with the correct value anyway; harmless but redundant | Omit it — the enhancer sets it |
| Using `data-next-selected="true"` in the template | Applies to every card | Use `"selected": true` in the JSON object instead |
