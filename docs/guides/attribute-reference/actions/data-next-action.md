---
title: 'data-next-action'
group: 'Attribute Reference/Actions'
order: 401
---

# data-next-action

Runs an action on click, or on submit for a `form`. The value is the action's name in
`next.actions` ([Action list](action-list.md)); the same call from a script does the same thing and
sends the same events.

```html
<button data-next-action="addItem" data-next-package-id="42" data-next-quantity="2">Add 2</button>

<button data-next-action="addItem" data-next-selector-id="main" data-next-go="checkout.html">Continue</button>

<form data-next-action="applyCoupon">
  <input data-next-field="code" />
  <button>Apply</button>
</form>
<p data-next-query="errors.code"></p>
```

## Arguments

An action takes one object of the model's field names. Each comes from, in order:

1. a `data-next-<name>` attribute on the element: `data-next-package-id` is `package_id`;
2. a `data-next-field="<name>"` input inside it (a form);
3. the object around it: a cart line's `package_id`, an option's `selector_id` and `option_id`,
   a coupon's `code`.

So `<button data-next-action="removeItem">` inside a `cart.lines` row removes that line.

| Attribute              | Means                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `data-next-go="<url>"` | Opens the page once the action succeeds, with the visit's parameters and the order's `ref_id` |

An action never throws: it resolves `{ ok, errors }`. A refused argument's message reads as
`errors.<name>` until that action succeeds.

A `data-next-action` value that names no action (0.4.x page scripts use some, such as
`select-variants`) is left alone.

## Set by the SDK

| On the element                   | When                                                            |
| -------------------------------- | --------------------------------------------------------------- |
| `data-next-loading`, `aria-busy` | While it runs; further clicks wait                              |
| `data-next-disabled`, `disabled` | It cannot run: a selector with no pick, a quantity at its limit |
| `data-next-invalid`              | Its last run was refused                                        |
