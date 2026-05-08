# Glossary

## Constraints

The set of rules that limit what quantity values a user can enter or reach via buttons: minimum allowed quantity (`min`), maximum allowed quantity (`max`), and the amount each step changes the quantity (`step`). All three are configured via data attributes and default to `min=0`, `max=99`, `step=1`.

---

## Mode

One of three operating modes declared via `data-next-quantity`: `increase` (button that adds to quantity), `decrease` (button that subtracts from quantity), or `set` (input or select that accepts a direct quantity value). Mode determines which DOM event is listened to and which cart store action is taken.

---

## Package ID

The numeric `ref_id` of a campaign package. Used to look up the matching cart item in the cart store. Set via `data-package-id` on the element. When used inside a `CartItemListEnhancer` template, this value is injected automatically from the rendered item.

---

## Processing state

A transient state during which a cart API call is in flight. The enhancer adds the `processing` CSS class to the element for the duration of the call and removes it on success or error. Buttons do not fire additional clicks while in the processing state.

---

## Quantity

The number of a specific package present in the cart. `QuantityControlEnhancer` reads and writes this value via the cart store. A quantity of 0 means the package is not in the cart and triggers item removal rather than a quantity update.

---

## Template token

A placeholder string inside the element's `innerHTML` that is replaced with a live value on every cart update. Supported tokens: `{quantity}` (current quantity of the package) and `{step}` (the configured step value). Useful for labelling buttons like `Remove {step}`.
