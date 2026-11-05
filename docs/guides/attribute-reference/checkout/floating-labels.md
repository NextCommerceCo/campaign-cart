---
title: 'Floating labels'
group: 'Attribute Reference/Checkout'
order: 512
---

# Floating labels

A `label.label-checkout` in the same `.form-group` as a checkout field floats above the field once
it has a value. The page's CSS draws the label in both positions.

```html
<div class="form-group">
  <label class="label-checkout" for="email">Email</label>
  <input
    id="email"
    data-next-checkout-field="email"
    type="email"
    data-label-behavior="placeholder"
    placeholder="Email"
  />
</div>
```

## Attributes

| Attribute                                        | Means                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `.form-group label.label-checkout`               | The label. Works with an `input` or `select` that has `data-next-checkout-field`                |
| `data-label-behavior="placeholder"` on the input | The label also floats while the field has focus, and the placeholder is cleared while it floats |

A `<select>` counts as having a value once something other than its first option is picked.

## Set by the SDK

| On                        | Set                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| The label                 | `has-value` while it floats; `is-focused` while focused, with `data-label-behavior="placeholder"` |
| The label                 | `transition: all 0.15s ease-in-out`, unless the page sets its own                                 |
| The field                 | `padding-top: 14px` while the label floats                                                        |
| The field's `.form-input` | `position: relative`                                                                              |
