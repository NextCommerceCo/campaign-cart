---
title: 'Recipes/Variant picker'
group: 'Recipes'
category: 'Recipes'
order: 4
---

# Variant picker

One card per offer, each with a color choice: a dropdown on the first, a row of buttons on the
second.

```html
<div data-next-selector="main">
  <div data-next-option="one" data-next-items="1" data-next-selected>
    1 pair · <span data-next-query="price"></span>
    <select data-next-field="variants.color"></select>
  </div>
  <div data-next-option="two" data-next-items="2">
    2 pairs · <span data-next-query="price"></span> each
    <div data-next-field="variants.color"></div>
  </div>
</div>
```

`variants.<code>` names a variant attribute of the option's package (`color`, `size`). The SDK
fills a `select` with one `<option>` per value, and any other element with one button per value.
A choice moves the option to the package of the same product with that value and picks the
option. A value no package has is disabled. It works on an option of one package; a slot or a
cart line takes the same field.

| Style                                   | When                                                |
| --------------------------------------- | --------------------------------------------------- |
| `[data-next-variant='color']`           | the element that holds the buttons for `color`      |
| `[data-next-value='light-blue']`        | the button for Light Blue: the value as a slug      |
| `[data-next-value][data-next-selected]` | the chosen value                                    |
| `[data-next-value][data-next-disabled]` | no package has this value; the button is `disabled` |

For your own markup, repeat the values with `data-next-each="variants.color"` and a
`selectVariant` button in each row; see [data-next-field](../attribute-reference/inputs/data-next-field.md#variant-pickers).

**Events**: `cart.removed` and `cart.added` as the line moves to the other package;
`selector.selected` when the choice also picks the option.

**See also**: [data-next-field](../attribute-reference/inputs/data-next-field.md) for pickers,
[Selector and option](../attribute-reference/objects/selector.md) for slots.
