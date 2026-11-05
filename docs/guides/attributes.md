---
title: 'Attributes'
group: 'Attribute Reference'
order: 0
---

# Attributes

Every attribute a page writes has one role, and each role has its twin in JavaScript. Values come
from one object model: the objects `next.query()` returns and events carry, with the same
snake_case field names.

| Role                                      | Attributes                                                                               | In JavaScript                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------ |
| [Objects](#objects): things with state    | `data-next-selector`, `data-next-option`, `data-next-checkout`, `data-next-promotion`    | `next.query('selector.main')`  |
| [Display](#display): values into the page | `data-next-query`, `data-next-show`, `data-next-hide`, `data-next-each`, `data-next-for` | `next.query()`, `next.watch()` |
| [Actions](#actions): buttons and forms    | `data-next-action`                                                                       | `next.actions.<name>()`        |
| [Inputs](#inputs)                         | `data-next-field`                                                                        | `checkout.*` paths             |
| [Widgets](#widgets): UI the SDK draws     | `data-next-address`, `data-next-payment`, `data-next-express`                            | —                              |

Every other attribute is a parameter of one of these, named after a field of the model:
`data-next-shipping-id="3"` is `shipping_id: 3`, on an option and on an `addItem` button alike.

```html
<span data-next-query="cart.total"></span>
```

```js
next.query('cart.total'); // 39
next.on('cart.calculated', (cart) => cart.total); // the same Cart
```

Pages built with the earlier attributes keep working: see [Legacy attributes](attribute-reference/legacy/legacy-attributes.md).

## Setup

| Page                                                          | For                                                                   |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| [Loader script](attribute-reference/setup/loader-script.md)   | `data-campaign`, `data-funnel`: loading the SDK                       |
| [URL parameters](attribute-reference/setup/url-parameters.md) | `forcePackageId`, `forceBundleId`, `reset`, `debug`, kept parameters  |
| [Page state](attribute-reference/setup/page-state.md)         | What the SDK sets for CSS: `data-next-ready`, `data-next-selected`, … |

## Objects

| Page                                                           | For                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| [Cart](attribute-reference/objects/cart.md)                    | The cart and its lines                                               |
| [Selector and option](attribute-reference/objects/selector.md) | `data-next-selector`, `data-next-option`: picks, order bumps, offers |
| [Package](attribute-reference/objects/package.md)              | `package.<id>`: a package at the campaign's price                    |
| [Checkout](attribute-reference/objects/checkout.md)            | `data-next-checkout` and what the shopper entered                    |
| [Order and upsell](attribute-reference/objects/order.md)       | The order on pages opened with `?ref_id`                             |
| [Promotion](attribute-reference/objects/promotion.md)          | `data-next-promotion`: tracked banners                               |
| [Campaign and params](attribute-reference/objects/campaign.md) | `campaign.*`, `param.<name>`                                         |

## Display

| Page                                                                             | For                                                   |
| -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [data-next-query](attribute-reference/display/data-next-query.md)                | Writes a value; `data-next-format`, `data-next-empty` |
| [data-next-show / data-next-hide](attribute-reference/display/data-next-show.md) | Shows or hides on a condition                         |
| [data-next-each](attribute-reference/display/data-next-each.md)                  | One copy of a template per item of a list             |
| [data-next-for](attribute-reference/display/data-next-for.md)                    | The object children read short paths from             |

## Actions

| Page                                                                | For                                               |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| [data-next-action](attribute-reference/actions/data-next-action.md) | Runs an action on click or submit; `data-next-go` |
| [Action list](attribute-reference/actions/action-list.md)           | Every action, its arguments and its events        |

## Inputs

| Page                                                             | For                                                        |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| [data-next-field](attribute-reference/inputs/data-next-field.md) | Checkout fields, payment, variant pickers, line properties |

## Widgets

| Page                                                                  | For                                     |
| --------------------------------------------------------------------- | --------------------------------------- |
| [data-next-address](attribute-reference/widgets/data-next-address.md) | An address for the selected country     |
| [data-next-payment](attribute-reference/widgets/data-next-payment.md) | The payment methods the campaign offers |
| [data-next-express](attribute-reference/widgets/data-next-express.md) | Express buttons                         |
