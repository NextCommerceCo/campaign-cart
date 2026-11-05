---
title: 'data-next-display'
group: 'Attribute Reference/Values'
order: 201
---

# data-next-display

Writes a value into the element and keeps it current: a cart total, a package price, a URL
parameter, an order number. Money and percentages are formatted in the campaign's currency and
language.

```html
<div data-next-package-id="42">
  <h3 data-next-display="package.name"></h3>
  <span data-next-display="package.price"></span>
  <img data-next-display="package.image" alt="" />
</div>
Total <span data-next-display="cart.total"></span>
```

## How a value is written

| Value      | Written as                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------ |
| Money      | `$39.00`, in the campaign currency, with its narrow symbol                                 |
| Percentage | `25%`, rounded to a whole number                                                           |
| Number     | A whole number, formatted for the campaign's language                                      |
| Text       | As is                                                                                      |
| Image URL  | Sets `src` on an `<img>`; any other element gets the URL as text                           |
| Yes/no     | Shows or hides the element (as [data-next-show](data-next-show.md)) and keeps its children |

The element's text is replaced. A value that is not known yet (before the campaign or the cart's
prices arrive) is written as empty. An unknown path logs one warning and leaves the element alone.
[data-next-format](data-next-format.md) changes how a number is written.

## Paths

### `cart.*`

| Path                                                     | Is                                                       |
| -------------------------------------------------------- | -------------------------------------------------------- |
| `cart.total`, `cart.subtotal`, `cart.shipping`           | From the server's prices; empty until the cart is priced |
| `cart.discountAmount` (`totalDiscount`)                  | Coupon and offer discounts                               |
| `cart.discountPercentage` (`totalDiscountPercentage`)    | Discount as a share of the subtotal                      |
| `cart.compareTotal` (`originalPrice`)                    | The lines at their compare-at prices                     |
| `cart.savingsAmount` (`totalSavingsAmount`)              | Compare-at total minus what is paid                      |
| `cart.savingsPercentage` (`totalSavingsPercentage`)      | Savings as a share of the compare-at total               |
| `cart.quantity` (`totalQuantity`)                        | Units in the cart                                        |
| `cart.itemCount` (`count`)                               | Lines in the cart                                        |
| `cart.currency`                                          | The cart's currency code                                 |
| `cart.discountCode`                                      | The first coupon applied                                 |
| `cart.hasItems`, `cart.isEmpty`                          | Yes/no                                                   |
| `cart.hasSavings`, `cart.hasDiscounts`, `cart.hasCoupon` | Yes/no                                                   |
| `cart.hasFreeShipping` (`isFreeShipping`)                | Yes/no, once priced                                      |
| `cart.isCalculating`                                     | Yes while new prices are on the way                      |

A path with one part and no `cart.` (`total`) reads the cart, unless it sits inside a package or a
bundle card (below).

### `shipping.*`

The cart's shipping method: `shipping.name`, `shipping.code`, `shipping.cost` (`price`), and
`shipping.isFree`.

### `campaign.*`

`campaign.name`, `campaign.currency`, `campaign.language`.

### `param.*`

`param.<name>`: a URL parameter of this visit, even one the shopper arrived with on an earlier page
(see [URL parameters](../setup/url-parameters.md)).

### `package.*`

`package.<id>.<prop>`, or `package.<prop>` (and plain `<prop>`) inside an element with
`data-next-package-id`.

| Prop                                                      | Is                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| `name`, `image`                                           | The package                                                 |
| `price` (`unitPrice`)                                     | Price of one unit                                           |
| `total` (`priceTotal`, `price_total`)                     | Price of the package                                        |
| `compareTotal` (`priceRetailTotal`, `price_retail_total`) | Compare-at price of the package; its price when it has none |
| `savingsAmount` (`totalSavings`)                          | Compare-at minus price                                      |
| `savingsPercentage` (`totalSavingsPercentage`)            | Savings as a share of the compare-at price                  |
| `hasSavings` (`hasTotalSavings`), `isRecurring`           | Yes/no                                                      |
| `quantity` (`qty`)                                        | Units in the package                                        |

These are the campaign's prices. The server's price for a bundle (vouchers, coupons) is under
`bundle.*`.

### `bundle.*`

`bundle.<card id>.<prop>` for a card, or `bundle.<selector id>.<prop>` for that selector's picked
card. Inside a card, use [data-next-bundle-display](../bundles/data-next-bundle-display.md) or a
plain `<prop>`. Props: `name`, `image`, `price` (`total`), `originalPrice` (`compare`),
`discountAmount` (`savings`), `discountPercentage` (`savingsPercentage`), `hasDiscount`
(`hasSavings`), `unitPrice`, `originalUnitPrice`, `quantity`, `isSelected`.

### `toggle.*`

`toggle.<package id>.<prop>` for an order bump, with the same props as `bundle.*`; `isSelected` is
yes while the bump is in the cart. Inside the bump, `data-next-toggle-display="<prop>"` does the
same (see [data-next-toggle-card](../cart/data-next-toggle-card.md)).

### `order.*`

On upsell and receipt pages: the order placed at checkout. Listed in
[order.\* values](../orders/order-values.md).

## Set by the SDK

On an element showing a yes/no value: `next-visible` or `next-hidden`, and `style.display` `none`
while hidden.

## 0.4.x

0.4.x paths keep working: `price_total`, `priceRetailTotal`, `totalSavings`, `count` and the other
names in brackets above read the same value.
