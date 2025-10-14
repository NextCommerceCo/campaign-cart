# Selection Attributes

Display data based on currently selected package in a selector. Updates when selection changes.

## Basic Selection Properties

```html
<span data-next-display="selection.{selectorId}.name">Selected package name</span>
<span data-next-display="selection.{selectorId}.packageId">Selected package ID</span>
<span data-next-display="selection.{selectorId}.quantity">Selected quantity</span>
<span data-next-display="selection.{selectorId}.hasSelection">Whether something is selected</span>
```

## Selection Pricing

```html
<span data-next-display="selection.{selectorId}.price">Unit price of selection</span>
<span data-next-display="selection.{selectorId}.total">Total price of selection</span>
<span data-next-display="selection.{selectorId}.compareTotal">Compare/retail total</span>
<span data-next-display="selection.{selectorId}.unitPrice">Price per unit</span>
```

## Selection Calculated Fields

```html
<span data-next-display="selection.{selectorId}.savingsAmount">Total savings</span>
<span data-next-display="selection.{selectorId}.savingsPercentage">Savings percentage</span>
<span data-next-display="selection.{selectorId}.hasSavings">Has savings boolean</span>
<span data-next-display="selection.{selectorId}.isBundle">Is multi-pack</span>
<span data-next-display="selection.{selectorId}.totalUnits">Total units selected</span>
```

## Mathematical Expressions

```html
<span data-next-display="selection.{selectorId}.total*0.1">10% of total</span>
<span data-next-display="selection.{selectorId}.price+5">Price plus $5</span>
<span data-next-display="selection.{selectorId}.total-10">Total minus $10</span>
<span data-next-display="selection.{selectorId}.total/2">Half of total</span>
```

## Complete Example

```html
<!-- Selector -->
<div data-next-cart-selector data-next-selector-id="main-product">
  <div data-next-selector-card data-next-package-id="1">
    1 Pack - $99
  </div>
  <div data-next-selector-card data-next-package-id="2">
    3 Pack - $249
  </div>
  <div data-next-selector-card data-next-package-id="3">
    5 Pack - $399
  </div>
</div>

<!-- Selection Display -->
<div class="selection-info">
  <h4>Your Selection</h4>
  
  <!-- Show when nothing selected -->
  <p data-next-hide="selection.main-product.hasSelection">
    Please select a package
  </p>
  
  <!-- Show when selected -->
  <div data-next-show="selection.main-product.hasSelection">
    <p>Selected: <span data-next-display="selection.main-product.name">-</span></p>
    <p>Quantity: <span data-next-display="selection.main-product.totalUnits">0</span> units</p>
    <p>Price: <span data-next-display="selection.main-product.total">$0</span></p>
    
    <div data-next-show="selection.main-product.hasSavings">
      <p>You save: <span data-next-display="selection.main-product.savingsAmount">$0</span>
         (<span data-next-display="selection.main-product.savingsPercentage">0%</span>)
      </p>
    </div>
  </div>
  
  <!-- Add to cart button -->
  <button data-next-action="add-to-cart" 
          data-next-selector-id="main-product"
          data-next-hide="!selection.main-product.hasSelection">
    Add to Cart
  </button>
</div>
```

## Dynamic Pricing Display

```html
<!-- Show different messages based on selection -->
<div data-next-cart-selector data-next-selector-id="warranty">
  <!-- Options here -->
</div>

<div class="pricing-message">
  <p data-next-show="selection.warranty.total < 20">
    Basic protection for under $20
  </p>
  <p data-next-show="selection.warranty.total >= 20 && selection.warranty.total < 50">
    Premium protection
  </p>
  <p data-next-show="selection.warranty.total >= 50">
    Ultimate protection package
  </p>
</div>
```

## Multiple Selectors

```html
<!-- Product selector -->
<div data-next-cart-selector data-next-selector-id="product">
  <!-- Product options -->
</div>

<!-- Accessory selector -->
<div data-next-cart-selector data-next-selector-id="accessory">
  <!-- Accessory options -->
</div>

<!-- Combined total -->
<div class="order-summary">
  <p>Product: <span data-next-display="selection.product.total">$0</span></p>
  <p>Accessory: <span data-next-display="selection.accessory.total">$0</span></p>
  <hr>
  <p>Total: $<span data-next-display="selection.product.total.raw + selection.accessory.total.raw">0</span></p>
</div>
```

## Quantity Controls

Add quantity increase/decrease controls to selector cards to allow users to adjust quantities.

### Basic Quantity Controls

```html
<div data-next-selector-card
     data-next-package-id="2"
     data-next-quantity="1"
     data-next-min-quantity="1"
     data-next-max-quantity="10">

  <!-- Package content -->
  <h3 data-next-display="package.name">Product Name</h3>
  <p data-next-display="package.finalPriceTotal">$19.99</p>

  <!-- Quantity controls -->
  <div class="quantity-controls">
    <button data-next-quantity-decrease type="button">−</button>
    <span data-next-quantity-display>1</span>
    <button data-next-quantity-increase type="button">+</button>
  </div>

  <!-- Show total based on selector quantity -->
  <p class="total-price">
    Total: <span data-next-display="selection.{selectorId}.total">$19.99</span>
  </p>
</div>
```

### Quantity Control Attributes

- `data-next-quantity-increase` - Button to increase quantity
- `data-next-quantity-decrease` - Button to decrease quantity (disabled at minimum)
- `data-next-quantity-display` - Element to display current quantity
- `data-next-min-quantity` - Minimum allowed quantity (default: 1)
- `data-next-max-quantity` - Maximum allowed quantity (default: 999)

### Complete Example with Quantity Controls

```html
<div data-next-cart-selector
     data-next-selector-id="limos-card"
     data-next-selection-mode="swap">

  <div data-next-selector-card
       data-next-package-id="2"
       data-next-quantity="1"
       data-next-min-quantity="1"
       data-next-max-quantity="10"
       data-next-selected="true">

    <div class="package-content">
      <img data-next-display="package.image" alt="" />
      <h3 data-next-display="package.name">Premium Package</h3>

      <!-- Show unit price -->
      <p class="unit-price">
        <span data-next-display="package.finalPrice">$19.99</span> each
      </p>

      <!-- Quantity controls -->
      <div class="quantity-controls">
        <button data-next-quantity-decrease class="qty-btn">−</button>
        <span data-next-quantity-display class="qty-value">1</span>
        <button data-next-quantity-increase class="qty-btn">+</button>
      </div>

      <!-- Show total price (unit price × quantity) -->
      <p class="total-price">
        Total: <span data-next-display="selection.limos-card.total">$19.99</span>
      </p>

      <!-- Show savings based on total -->
      <p class="savings" data-next-show="selection.limos-card.hasSavings">
        You Save: <span data-next-display="selection.limos-card.savingsAmount">$0</span>
      </p>
    </div>
  </div>
</div>
```

### Behavior Notes

1. **Auto-disable**: Decrease button automatically gets `disabled` attribute and `next-disabled` class when at minimum quantity
2. **Auto-disable**: Increase button automatically gets `disabled` attribute and `next-disabled` class when at maximum quantity
3. **Cart Sync**: In `swap` mode, quantity changes automatically update the cart
4. **Display Updates**: All `selection.{selectorId}.total` elements update when quantity changes
5. **Event Prevention**: Quantity button clicks don't trigger card selection

## Best Practices

1. **Unique IDs**: Use descriptive selector IDs
2. **Show Feedback**: Display selection details
3. **Conditional UI**: Hide/show based on selection
4. **Price Updates**: Show real-time pricing
5. **Validation**: Ensure selection before actions
6. **Quantity Limits**: Set appropriate min/max quantities for your use case