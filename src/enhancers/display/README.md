# Display Enhancers

Reactive data display. Elements with `data-next-display="<object>.<property>"` are automatically updated when their data source changes. Also handles conditional show/hide and countdown timers.

## Files

| File | Class | Attribute / Trigger |
|---|---|---|
| `DisplayEnhancerCore.ts` | `BaseDisplayEnhancer` | Internal base (not a data attribute) |
| `CartDisplayEnhancer.ts` | `CartDisplayEnhancer` | `data-next-display="cart.*"` |
| `ProductDisplayEnhancer.ts` | `ProductDisplayEnhancer` | `data-next-display="package.*"` |
| `SelectionDisplayEnhancer.ts` | `SelectionDisplayEnhancer` | `data-next-display="selection.<id>.*"` |
| `OrderDisplayEnhancer.ts` | `OrderDisplayEnhancer` | `data-next-display="order.*"` |
| `ShippingDisplayEnhancer.ts` | `ShippingDisplayEnhancer` | `data-next-display="shipping.*"` |
| `ConditionalDisplayEnhancer.ts` | `ConditionalDisplayEnhancer` | `data-next-show` / `data-next-hide` |
| `TimerEnhancer.ts` | `TimerEnhancer` | `data-next-timer` |
| `QuantityTextEnhancer.ts` | `QuantityTextEnhancer` | `data-next-quantity-text` |

---

## Display Path Convention

`data-next-display="<object>.<property>"`

The object prefix determines which enhancer handles the element:

| Prefix | Enhancer | Data source |
|---|---|---|
| `cart.` | `CartDisplayEnhancer` | `cartStore` |
| `package.` | `ProductDisplayEnhancer` | `campaignStore` (package by context) |
| `selection.<id>.` | `SelectionDisplayEnhancer` | Selected item in a `PackageSelectorEnhancer` |
| `order.` | `OrderDisplayEnhancer` | `orderStore` |
| `shipping.` | `ShippingDisplayEnhancer` | `cartStore` shipping data |

Append `.raw` to any numeric property to get an unformatted number instead of formatted currency/percentage.

### Format types (`data-next-format`)
`currency` (default for prices), `percentage`, `number`, `date`, `text`, `boolean`, `raw`

---

## CartDisplayEnhancer

Displays cart totals and state. Subscribes to `cartStore`.

```html
<span data-next-display="cart.total"></span>
<span data-next-display="cart.itemCount"></span>
<span data-next-display="cart.savings"></span>
```

### Available properties

| Property | Description |
|---|---|
| `total` | Cart total (formatted) |
| `subtotal` | Subtotal before shipping/tax |
| `shipping` | Shipping cost |
| `tax` | Tax amount |
| `discounts` | Total discounts |
| `savings` | Savings vs retail |
| `savingsPercentage` | Savings as percentage |
| `compareTotal` | Original retail total |
| `itemCount` | Number of line items |
| `totalQuantity` | Total units across all items |
| `hasItems` | Boolean — cart is not empty |
| `isEmpty` | Boolean — cart is empty |
| `currency` / `currencyCode` | Currency code (e.g. `USD`) |
| `currencySymbol` | Currency symbol (e.g. `$`) |

**Special:** `data-include-discounts` attribute on element — for `subtotal`, subtracts applied coupon discounts.

**CSS classes managed:** `next-cart-empty`, `next-cart-has-items`

---

## ProductDisplayEnhancer

Displays package/product data. Requires a package context.

```html
<!-- Explicit package ID in path -->
<span data-next-display="package.10.price"></span>

<!-- Package context from ancestor -->
<div data-next-package-id="10">
  <span data-next-display="package.name"></span>
  <span data-next-display="package.price"></span>
</div>
```

### Package context resolution order
1. Explicit ID in path: `package.10.name`
2. Ancestor with `data-next-package-id="10"`
3. `PackageContextResolver` DOM walk

### Available properties

**Basic info:**
`name`, `image`, `qty`, `is_recurring`

**Pricing:**
| Property | Description |
|---|---|
| `price` | Package sale price |
| `price_total` | Package sale total (price × qty) |
| `price_retail` | Package retail/compare price |
| `price_retail_total` | Package retail total |
| `price_recurring` | Recurring charge price |
| `price_recurring_total` | Recurring charge total |
| `unitPrice` | Per-unit price |
| `unitRetailPrice` | Per-unit retail price |
| `unitSavings` | Per-unit savings |
| `unitSavingsPercentage` | Per-unit savings % |
| `savingsAmount` | Total savings vs retail |
| `savingsPercentage` | Savings % |
| `hasSavings` | Boolean |
| `discountedPrice` | Price after coupon (unit) |
| `discountedPriceTotal` | Price after coupon (total) |
| `discountAmount` | Coupon discount amount |
| `hasDiscount` | Boolean — coupon active |
| `finalPrice` | discountedPrice (alias) |
| `finalPriceTotal` | discountedPriceTotal (alias) |
| `totalSavingsAmount` | Retail savings + coupons |
| `totalSavingsPercentage` | Combined savings % |
| `hasTotalSavings` | Boolean |

**Boolean flags:** `isBundle`, `isRecurring`, `hasRetailPrice`

**Campaign data:** `campaign.name`, `campaign.currency`, `campaign.language`

### Profile mapping
When a profile is active, `packageId` is automatically mapped to the profile's equivalent package. Savings percentages are calculated relative to the original package's retail price.

### Quantity multiplication
`data-next-multiply-quantity` attribute + `data-next-quantity-selector-id` — multiplies numeric price values by the current upsell quantity (for per-unit pricing on upsell pages).

---

## SelectionDisplayEnhancer

Displays data for the currently selected package in a `PackageSelectorEnhancer`. Updates in real-time as selection changes.

```html
<!-- Selector ID embedded in path (preferred) -->
<span data-next-display="selection.main-selector.price"></span>
<span data-next-display="selection.main-selector.savingsAmount"></span>

<!-- Via attribute -->
<span data-next-display="selection.price" data-next-selector-id="main-selector"></span>
```

### Available properties

| Property | Description |
|---|---|
| `hasSelection` | Boolean — an item is selected |
| `packageId` | Selected package ID |
| `quantity` | Selected cart quantity |
| `name` | Package name |
| `price` | Package price |
| `total` / `price_total` | Price × quantity |
| `compareTotal` / `price_retail_total` | Retail total |
| `savings` / `savingsAmount` | Savings amount |
| `savingsPercentage` | Savings % |
| `hasSavings` | Boolean |
| `unitPrice` / `pricePerUnit` | Per-unit price |
| `totalUnits` | Units in package (qty field) |
| `isBundle` / `isMultiPack` | Boolean — multi-unit package |
| `discountedPrice` / `finalPrice` | Price after coupon |
| `appliedDiscountAmount` | Coupon discount amount |
| `hasDiscount` | Boolean |
| `discountPercentage` | Coupon % |

**Math expressions:** `"total*0.1"`, `"price+5"` — computes inline calculations.

Element hides itself when there is no selection (except for `hasSelection` property).

---

## OrderDisplayEnhancer

Displays order data. Auto-loads order from URL `?ref_id=` parameter if not already in `orderStore`.

```html
<span data-next-display="order.refId"></span>
<span data-next-display="order.total"></span>
<span data-next-display="order.user.name"></span>
<a data-next-display="order.statusUrl">Track Order</a>
```

### Available properties

**Order info:** `refId`, `status`, `total`, `subtotal`, `shipping`, `tax`, `discounts`, `currency`, `paymentMethod`

**Customer:** `user.name`, `user.email`, `user.firstName`, `user.lastName`, `user.phone`

**Addresses:** `shippingAddress.line1`, `shippingAddress.city`, `shippingAddress.state`, `shippingAddress.zip`, `shippingAddress.country`, `shippingAddress.full` (and same for `billingAddress.*`)

**Line items:** `items.count`, `items.totalQuantity`, `items.upsellCount`, `items.mainProduct`, `items[0].title`, `items[0].price`, `items[0].quantity`

**Attribution:** `attribution.utm_source`, `attribution.utm_medium`, `attribution.utm_campaign`, `attribution.gclid`, `attribution.funnel`, `attribution.affiliate`

**Computed:** `savingsAmount`, `savingsPercentage`, `hasSavings`, `hasItems`, `hasShipping`, `hasTax`, `hasUpsells`, `hasDiscounts`

**CSS classes managed:** `next-loading`, `next-loaded`, `next-error`

---

## ConditionalDisplayEnhancer

Shows or hides elements based on conditions evaluated against store state.

```html
<!-- Show when cart has items -->
<div data-next-show="cart.hasItems">Proceed to Checkout</div>

<!-- Hide when cart is empty -->
<div data-next-hide="cart.isEmpty">Cart Summary</div>

<!-- Comparison -->
<div data-next-show="cart.total > 100">Free Shipping!</div>

<!-- Function call -->
<div data-next-show="cart.hasItem(123)">You have the basic package</div>

<!-- Profile-based -->
<div data-next-show-if-profile="wholesale">Wholesale Price</div>
<div data-next-hide-if-profile="wholesale">Retail Price</div>

<!-- Compound -->
<div data-next-show="cart.hasItems && cart.total >= 50">Qualify for Discount</div>
```

### Condition syntax
| Pattern | Example |
|---|---|
| Property access | `cart.hasItems` |
| Comparison | `cart.total > 50`, `order.status == complete` |
| Function call | `cart.hasItem(123)` |
| Negation | `!cart.isEmpty` |
| Logical AND | `cart.hasItems && cart.total > 100` |
| Logical OR | `cart.isEmpty \|\| param.preview == true` |
| URL params | `param.utm_source == facebook` |

### Context objects
`cart`, `package`, `order`, `shipping`, `profile`, `param`/`params` (URL search params)

`data-next-selector-id` — for `package.*` conditions, listens to that selector's selection changes.

---

## TimerEnhancer

Countdown timer with `localStorage` persistence across page refreshes.

```html
<div data-next-timer data-duration="600" data-persistence-id="offer-timer" data-format="mm:ss">
  <span data-next-timer-display></span>
</div>

<!-- Shown after timer expires -->
<div data-next-timer-expired data-persistence-id="offer-timer" style="display:none">
  Offer expired!
</div>
```

### Attributes
| Attribute | Description |
|---|---|
| `data-duration` | Seconds to count down (required) |
| `data-persistence-id` | localStorage key (default `"default-timer"`) |
| `data-format` | `hh:mm:ss`, `mm:ss` (default), or `ss` |

On expiry: hides the timer element, shows `[data-next-timer-expired][data-persistence-id="..."]` elements, emits `timer:expired`.

---

## QuantityTextEnhancer

Displays the total cart quantity (number of items) as text content of the element.

```html
<span data-next-quantity-text></span>
<!-- renders: "3" -->
```
