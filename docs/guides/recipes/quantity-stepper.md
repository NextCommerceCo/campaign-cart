---
title: 'Recipes/Quantity stepper'
group: 'Recipes'
category: 'Recipes'
order: 5
---

# Quantity stepper

− and + buttons around how many the shopper takes of the picked option, with its total. The −
button turns off at 1 and the + at 5.

```html
<div data-next-selector="main">
  <button data-next-option="one" data-next-items="1" data-next-max-quantity="5" data-next-selected>
    Earbuds · <span data-next-query="price"></span> each
  </button>
  <button data-next-option="case" data-next-items="3" data-next-max-quantity="5">
    Case · <span data-next-query="price"></span> each
  </button>
</div>

<div data-next-for="selector.main">
  <button data-next-action="setQuantity" data-next-quantity="-1">−</button>
  <span data-next-query="quantity"></span>
  <button data-next-action="setQuantity" data-next-quantity="+1">+</button>
  Total <span data-next-query="total"></span>
</div>
```

`setQuantity` reads the selector from `data-next-for`, so it always steps the picked option.
`"+1"` and `"-1"` move the count and a plain number (`"3"`) sets it. The limits are the option's
`data-next-min-quantity` and `data-next-max-quantity` (1 and 999 when left out), and a button that
would step past one is disabled. `quantity` counts packages: with `data-next-items="1x2"` each
step moves it by 2.

| Style                                    | When                      |
| ---------------------------------------- | ------------------------- |
| `[data-next-action][data-next-disabled]` | a step would pass a limit |
| `[data-next-action][data-next-loading]`  | the step is being applied |

**Events**: `selector.updated` with the new quantity, then `cart.added` / `cart.removed`.

**See also**: [Actions](../attribute-reference/actions/action-list.md) for `setQuantity`,
[Selector and option](../attribute-reference/objects/selector.md) for the option attributes.
