---
title: "Features/Cart/Coupon/Attributes"
group: "Features"
category: "Coupon"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Lets the visitor enter a discount code, shows the codes already applied, and lets them take one off again.

Turned on by `[data-next-coupon=""]`.

## `data-next-coupon`

| | |
|---|---|
| Type | `string` |
| Required | yes |
| Default | — |

Marks the coupon area. The feature activates on the container and finds the input, button, and display area inside it.

**Valid values:**

- `(empty)` — On the container element that wraps the whole coupon area.
- `input` — On the text input the visitor types the code into. Also activates the feature when used on its own.
- `apply` — On the apply button. Optional — the first `<button>` in the container is used when this is absent.
- `display` — On the element that lists applied codes. Searched inside the container, then in its parent, then document-wide.
- `messages` — On the element that shows success and error text. Searched document-wide.

> **Watch out:** When the input, button, and display cannot all be found the feature logs `Required coupon elements not found` and does nothing — check that the markup below is present.

## Read from other elements

These are not placed on the element this feature is bound to — look for them on inputs elsewhere in the page, or on a linked selector.

| Name | Values | Meaning |
|---|---|---|
| `data-template` | — | Marks the coupon card that serves as the row template. The feature hides it, clones it once per applied code, and strips this attribute from the clones — so the template itself never shows. **Watch out:** Do not set this on a card you want visible; a card carrying it is treated as the hidden template. |

## CSS classes

Toggled by the feature. Style these rather than tracking the same state yourself.

| Name | Values | Meaning |
|---|---|---|
| `next-disabled` | — | On the apply button while a code is being validated, so the visitor cannot submit twice. |
| `coupon-message` | — | On each message element the feature creates. Messages remove themselves after 5 seconds. |
| `coupon-message--success / --error / --info` | — | Variant class matching the message kind — a code accepted, a code rejected, or a code removed. |

## Expected markup

The feature locates its parts by looking inside the container, so the structure
matters more than the individual class names:

```html
<div data-next-coupon="">
  <input type="text" data-next-coupon="input" placeholder="Discount code">
  <button data-next-coupon="apply">Apply</button>

  <!-- Applied codes are rendered here, one clone of the template per code -->
  <div data-next-coupon="display">
    <div pb-checkout="coupon-card" data-template>
      <span pb-checkout="coupon-title"></span>
      <button pb-checkout="coupon-remove">Remove</button>
    </div>
  </div>
</div>

<!-- Can live anywhere in the page -->
<div data-next-coupon="messages"></div>
```

Inside a coupon card the feature fills `[pb-checkout="coupon-title"]` with the
code and wires `[pb-checkout="coupon-remove"]` to remove it. Pressing Enter in
the input applies the code, the same as clicking the button.
