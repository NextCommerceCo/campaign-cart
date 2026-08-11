/**
 * The debug overlay's mini-cart: a floating cart summary that mirrors the
 * live cart store, independent of which panel is active. Extracted verbatim
 * from `debug-overlay.ts` (see docs/code-findings.md #137) — logic unchanged,
 * only `this.shadowRoot` became an explicit `ctx: MiniCartHost` parameter and
 * calls between these functions are now direct calls instead of `this.foo()`.
 */
import { useCartStore } from '@/state/cart';
import { scopedKey } from '@/core/storage';
import { formatCurrency } from '@/core/currency-formatter';
import type {
  CartLevelDiscount,
  CartStoreState,
  MiniCartItem,
  MiniCartHost,
} from './debug-overlay.types';

export function closeMiniCart(ctx: MiniCartHost): void {
  if (!ctx.shadowRoot) return;
  const miniCart = ctx.shadowRoot.querySelector(
    '#debug-mini-cart-display'
  ) as HTMLDivElement;
  if (miniCart) {
    miniCart.classList.remove('show');
    localStorage.setItem(scopedKey('debug-mini-cart-visible'), 'false');

    // Update button state
    const cartButton = ctx.shadowRoot.querySelector(
      '[data-action="toggle-mini-cart"]'
    );
    if (cartButton) {
      cartButton.classList.remove('active');
      cartButton.setAttribute('title', 'Toggle Mini Cart');
    }
  }
}

export function toggleMiniCart(ctx: MiniCartHost, forceShow?: boolean): void {
  if (!ctx.shadowRoot) return;

  let miniCart = ctx.shadowRoot.querySelector(
    '#debug-mini-cart-display'
  ) as HTMLDivElement;

  if (!miniCart) {
    // Create mini cart if it doesn't exist
    miniCart = document.createElement('div');
    miniCart.id = 'debug-mini-cart-display';
    miniCart.className = 'debug-mini-cart-display';
    ctx.shadowRoot.appendChild(miniCart);

    // Subscribe to cart changes for real-time updates
    useCartStore.subscribe(() => {
      const cart = ctx.shadowRoot?.querySelector('#debug-mini-cart-display');
      if (cart && cart.classList.contains('show')) {
        updateMiniCart(ctx);
      }
    });

    // When creating for the first time via button click (not auto-restore), show it
    if (forceShow !== false) {
      miniCart.classList.add('show');
      updateMiniCart(ctx);
    }
  } else {
    // Toggle visibility
    miniCart.classList.toggle('show');

    // Update content if showing
    if (miniCart.classList.contains('show')) {
      updateMiniCart(ctx);
    }
  }

  // Save state to localStorage
  localStorage.setItem(
    scopedKey('debug-mini-cart-visible'),
    miniCart.classList.contains('show').toString()
  );

  // Update cart button state - use shadowRoot!
  const cartButton = ctx.shadowRoot?.querySelector(
    '[data-action="toggle-mini-cart"]'
  );
  if (cartButton && miniCart) {
    if (miniCart.classList.contains('show')) {
      cartButton.classList.add('active');
      cartButton.setAttribute('title', 'Hide Mini Cart');
    } else {
      cartButton.classList.remove('active');
      cartButton.setAttribute('title', 'Toggle Mini Cart');
    }
  }
}

export function updateMiniCart(ctx: MiniCartHost): void {
  if (!ctx.shadowRoot) return;
  const miniCart = ctx.shadowRoot.querySelector(
    '#debug-mini-cart-display'
  ) as HTMLDivElement;
  if (!miniCart || !miniCart.classList.contains('show')) return;

  const cartState = useCartStore.getState();

  if (!cartState.items || cartState.items.length === 0) {
    miniCart.innerHTML = renderMiniCartEmpty();
    return;
  }

  const { itemsHtml, subtotalBeforeDiscounts } = renderMiniCartItems(
    cartState.items
  );

  // Build totals breakdown - use calculated subtotal before discounts
  const totalDiscount = cartState.totalDiscount.toNumber();
  const shipping = cartState.shippingMethod?.price.toNumber() ?? 0;
  const shippingDiscount =
    cartState.shippingMethod?.discountAmount.toNumber() ?? 0;
  // If there's a shipping discount, the API returns net shipping, so we need to show original shipping
  const displayShipping =
    shippingDiscount > 0 ? shipping + shippingDiscount : shipping;
  const shippingLabel =
    displayShipping === 0 ? 'FREE' : formatCurrency(displayShipping);
  const total = cartState.total.toNumber();

  const { hasCartLevelDiscounts, cartLevelDiscountList } =
    collectCartLevelDiscounts(cartState, totalDiscount);

  // Build cart-level discount popup (similar to item discount popup)
  const cartDiscountPopup = renderCartDiscountPopup(
    hasCartLevelDiscounts,
    cartLevelDiscountList
  );

  // Build shipping row with savings (inline format)
  const shippingRow = renderShippingRow(
    shipping,
    displayShipping,
    shippingLabel,
    shippingDiscount
  );

  miniCart.innerHTML = `
    <div class="debug-mini-cart-header">
      <span>🛒 Debug Cart</span>
      <button class="mini-cart-close" data-action="close-mini-cart">×</button>
    </div>
    <div class="debug-mini-cart-items">${itemsHtml}</div>
    <div class="debug-mini-cart-totals${hasCartLevelDiscounts ? ' has-cart-discounts' : ''}">
      ${cartDiscountPopup}
      <div class="mini-cart-total-row">
        <span>Subtotal:</span>
        <span>${formatCurrency(subtotalBeforeDiscounts)}</span>
      </div>
      ${shippingRow}
      <div class="mini-cart-total-row mini-cart-final-total">
        <span>Total:</span>
        <span class="mini-cart-total">${formatCurrency(total)}</span>
      </div>
    </div>
    <div class="debug-mini-cart-footer">
      <div class="mini-cart-stat">
        <span>Items:</span>
        <span>${cartState.totalQuantity}</span>
      </div>
    </div>
    <div class="debug-mini-cart-resize-handle" title="Drag to resize"></div>
  `;

  bindResizeHandle(miniCart);
}

/** The mini-cart body when the cart has no lines. */
export function renderMiniCartEmpty(): string {
  return `
      <div class="debug-mini-cart-header">
        <span>🛒 Debug Cart</span>
        <button class="mini-cart-close" data-action="close-mini-cart">×</button>
      </div>
      <div class="debug-mini-cart-empty">Cart empty</div>
    `;
}

/** Every cart line, plus the subtotal accumulated from their line totals. */
export function renderMiniCartItems(items: MiniCartItem[]): {
  itemsHtml: string;
  subtotalBeforeDiscounts: number;
} {
  let itemsHtml = '';
  let subtotalBeforeDiscounts = 0;

  items.forEach(item => {
    const { html, lineTotal } = renderMiniCartItem(item);
    itemsHtml += html;
    // Add CURRENT (discounted) price to running subtotal for clarity
    subtotalBeforeDiscounts += lineTotal;
  });

  return { itemsHtml, subtotalBeforeDiscounts };
}

/** One cart line: its pricing maths, its hover card, and its markup. */
export function renderMiniCartItem(item: MiniCartItem): {
  html: string;
  lineTotal: number;
} {
  // Check for upsell flag
  const isUpsell = item.is_upsell;
  const upsellBadge = isUpsell
    ? '<span class="mini-cart-upsell-badge">UPSELL</span>'
    : '';

  // Calculate pricing
  const packagePriceExcl = item.original_package_price
    ? parseFloat(item.original_package_price)
    : 0;
  const packagePriceIncl = item.package_price
    ? parseFloat(item.package_price)
    : item.price;

  // Check if item has a discount applied (comparing package prices)
  const itemHasDiscount =
    packagePriceExcl > 0 && packagePriceIncl < packagePriceExcl;

  // For display: use the DISCOUNTED price (incl) as the current price
  const currentUnitPrice = packagePriceIncl;
  const originalUnitPrice =
    packagePriceExcl > 0 ? packagePriceExcl : packagePriceIncl;

  // Line totals
  const currentLineTotal = currentUnitPrice * item.quantity;
  const originalLineTotal = originalUnitPrice * item.quantity;

  // Build savings text (show total savings on this line)
  const itemLineSavings = itemHasDiscount
    ? originalLineTotal - currentLineTotal
    : 0;
  const savingsPercent = itemHasDiscount
    ? Math.round(
        ((originalUnitPrice - currentUnitPrice) / originalUnitPrice) * 100
      )
    : 0;

  const discountDetailsCard = renderItemDiscountCard(
    item,
    itemHasDiscount,
    savingsPercent
  );

  const html = `
      <div class="debug-mini-cart-item${itemHasDiscount ? ' has-discount' : ''}">
        ${discountDetailsCard}
        <div class="mini-cart-item-header">
          <div class="mini-cart-item-title-row">
            <div class="mini-cart-item-title">${item.title || 'Unknown'}</div>
            <div class="mini-cart-line-total">${formatCurrency(currentLineTotal)}</div>
          </div>
          <div class="mini-cart-item-meta">
            <span class="mini-cart-item-id">ID: ${item.packageId}</span>
            ${upsellBadge}
          </div>
        </div>
        ${
          itemHasDiscount
            ? `
          <div class="mini-cart-item-price-breakdown">
            <div class="mini-cart-price-row">
              <span class="mini-cart-price-label">Was</span>
              <span class="mini-cart-original-price">${formatCurrency(originalUnitPrice)} each</span>
            </div>
            <div class="mini-cart-price-row mini-cart-sale-row">
              <span class="mini-cart-price-label">Now</span>
              <span class="mini-cart-unit-price">${formatCurrency(currentUnitPrice)} each × ${item.quantity}</span>
            </div>
            <div class="mini-cart-price-row mini-cart-savings-row">
              <span class="mini-cart-price-label">You save</span>
              <span class="mini-cart-savings-amount">${formatCurrency(itemLineSavings)} (${savingsPercent}% off)</span>
            </div>
          </div>
        `
            : `
          <div class="mini-cart-item-price-breakdown">
            <div class="mini-cart-price-row">
              <span class="mini-cart-unit-price">${formatCurrency(currentUnitPrice)} each × ${item.quantity}</span>
            </div>
          </div>
        `
        }
      </div>
    `;

  return { html, lineTotal: currentLineTotal };
}

/** The hover card listing a line's discounts and properties. */
export function renderItemDiscountCard(
  item: MiniCartItem,
  itemHasDiscount: boolean,
  savingsPercent: number
): string {
  // Build discount details hover card
  let discountDetailsCard = '';

  const hasProperties =
    item.properties && Object.keys(item.properties).length > 0;
  const propertiesHtml = hasProperties
    ? `<ul class="discount-card-list">
          ${Object.entries(item.properties!)
            .map(
              ([k, v]) => `
          <li class="prop-card-item">
            <span class="discount-card-bullet">•</span>
            <span class="prop-card-body">
              <span class="prop-card-key">${escapeHtml(k)}</span>
              <span class="prop-card-value">${escapeHtml(v)}</span>
            </span>
          </li>`
            )
            .join('')}
        </ul>`
    : '';

  // Only show hover card if we have discount info, discount pricing, or properties
  if (
    itemHasDiscount ||
    (item.discounts && item.discounts.length > 0) ||
    hasProperties
  ) {
    let discountItemsHtml = '';

    if (item.discounts && item.discounts.length > 0) {
      discountItemsHtml = item.discounts
        .map(
          d => `
          <li class="discount-card-item">
            <span class="discount-card-bullet">•</span>
            <span style="display: flex; justify-content: space-between; width: 100%;">
              <span class="discount-card-text">${d.description}</span>
              <span class="discount-card-text" style="text-align: right;">${formatCurrency(parseFloat(d.amount))}</span>
            </span>
          </li>
        `
        )
        .join('');
    } else if (itemHasDiscount) {
      // Show a generic message if we detect discount but no details
      discountItemsHtml = `
          <li class="discount-card-item">
            <span class="discount-card-bullet">•</span>
            <span class="discount-card-text">Price discount applied (${savingsPercent}% off)</span>
          </li>
        `;
    }

    const discountSection = discountItemsHtml
      ? `
        <div class="discount-card-header">
          <span class="discount-card-icon">🎯</span>
          <span class="discount-card-title">Applied Discounts</span>
        </div>
        <ul class="discount-card-list">${discountItemsHtml}</ul>
      `
      : '';

    const propertiesSection = propertiesHtml
      ? `
        <div class="discount-card-header${discountSection ? ' discount-card-header--separator' : ''}">
          <span class="discount-card-icon">🏷️</span>
          <span class="discount-card-title">Properties</span>
        </div>
        ${propertiesHtml}
      `
      : '';

    discountDetailsCard = `
        <div class="mini-cart-discount-details-card">
          ${discountSection}
          ${propertiesSection}
        </div>
      `;
  }

  return discountDetailsCard;
}

/** Cart-wide offers and vouchers, minus anything already shown on a line. */
export function collectCartLevelDiscounts(
  cartState: CartStoreState,
  totalDiscount: number
): {
  hasCartLevelDiscounts: boolean;
  cartLevelDiscountList: CartLevelDiscount[];
} {
  // Build detailed discount breakdown for cart-level offers and vouchers
  let hasCartLevelDiscounts = false;
  let cartLevelDiscountList: Array<{
    type: 'offer' | 'voucher';
    label: string;
    amount: number;
  }> = [];

  if (cartState.offerDiscounts || cartState.voucherDiscounts) {
    const offerDiscounts = cartState.offerDiscounts ?? [];
    const voucherDiscounts = cartState.voucherDiscounts ?? [];

    // Collect offer discounts. Cart-wide offers that apply to multiple
    // items or the cart total should appear here.
    if (offerDiscounts.length > 0) {
      hasCartLevelDiscounts = true;
      offerDiscounts.forEach(discount => {
        const label =
          discount.name ||
          discount.description ||
          (discount.offer_id ? `Offer #${discount.offer_id}` : 'Offer');
        const amount = parseFloat(discount.amount);
        cartLevelDiscountList.push({ type: 'offer', label, amount });
      });
    }

    // Collect voucher discounts (these are always cart-level)
    if (voucherDiscounts.length > 0) {
      hasCartLevelDiscounts = true;
      voucherDiscounts.forEach(discount => {
        const amount = parseFloat(discount.amount);
        const label = discount.name || discount.description || 'Voucher';
        cartLevelDiscountList.push({ type: 'voucher', label, amount });
      });
    }
  } else if (totalDiscount > 0) {
    // Fallback: show single discount row if no details available
    hasCartLevelDiscounts = true;
    cartLevelDiscountList.push({
      type: 'offer',
      label: 'Discount',
      amount: totalDiscount,
    });
  }

  return { hasCartLevelDiscounts, cartLevelDiscountList };
}

/** The hover card over the totals block, listing cart-level discounts. */
export function renderCartDiscountPopup(
  hasCartLevelDiscounts: boolean,
  cartLevelDiscountList: CartLevelDiscount[]
): string {
  let cartDiscountPopup = '';
  if (hasCartLevelDiscounts) {
    const discountItemsHtml = cartLevelDiscountList
      .map(
        discount => `
      <li class="discount-card-item">
        <span class="discount-card-bullet">•</span>
        <span style="display: flex; justify-content: space-between; width: 100%; gap: 8px;">
          <span class="discount-card-text">
            <span class="mini-cart-discount-type">${discount.type.toUpperCase()}</span> ${discount.label}
          </span>
          <span class="discount-card-text" style="text-align: right;">-${formatCurrency(discount.amount)}</span>
        </span>
      </li>
    `
      )
      .join('');

    cartDiscountPopup = `
      <div class="mini-cart-cart-discount-popup">
        <div class="mini-cart-discount-details-card">
          <div class="discount-card-header">
            <span class="discount-card-icon">🎁</span>
            <span class="discount-card-title">Discounts</span>
          </div>
          <ul class="discount-card-list">${discountItemsHtml}</ul>
        </div>
      </div>
    `;
  }

  return cartDiscountPopup;
}

/** The shipping total row, with the pre-discount price struck through. */
export function renderShippingRow(
  shipping: number,
  displayShipping: number,
  shippingLabel: string,
  shippingDiscount: number
): string {
  let shippingRow = '';
  if (shippingDiscount > 0) {
    // Show shipping with original price strikethrough and discounted price
    shippingRow = `
      <div class="mini-cart-total-row mini-cart-shipping-row has-discount">
        <span>Shipping:</span>
        <span class="mini-cart-shipping-prices">
          <span class="mini-cart-original-price">${formatCurrency(displayShipping)}</span>
          <span class="mini-cart-shipping">${formatCurrency(shipping)}</span>
        </span>
      </div>
    `;
  } else {
    // Regular shipping row
    shippingRow = `
      <div class="mini-cart-total-row">
        <span>Shipping:</span>
        <span class="mini-cart-shipping">${shippingLabel}</span>
      </div>
    `;
  }

  return shippingRow;
}

export function bindResizeHandle(miniCart: HTMLElement): void {
  const handle = miniCart.querySelector(
    '.debug-mini-cart-resize-handle'
  ) as HTMLElement | null;
  const items = miniCart.querySelector(
    '.debug-mini-cart-items'
  ) as HTMLElement | null;
  if (!handle || !items) return;

  const savedHeight = localStorage.getItem(scopedKey('debug-mini-cart-height'));
  if (savedHeight) {
    items.style.maxHeight = `${savedHeight}px`;
    items.style.height = `${savedHeight}px`;
  }

  const firstItem = items.querySelector(
    '.debug-mini-cart-item'
  ) as HTMLElement | null;
  const minHeight = firstItem
    ? firstItem.offsetHeight +
      parseInt(getComputedStyle(items).paddingTop) +
      parseInt(getComputedStyle(items).paddingBottom)
    : 40;

  let startY = 0;
  let startHeight = 0;

  const clamp = (h: number) => Math.max(minHeight, Math.min(600, h));

  const onMouseMove = (e: MouseEvent) => {
    const newHeight = clamp(startHeight + (e.clientY - startY));
    items.style.maxHeight = `${newHeight}px`;
    items.style.height = `${newHeight}px`;
  };

  const onMouseUp = (e: MouseEvent) => {
    const newHeight = clamp(startHeight + (e.clientY - startY));
    localStorage.setItem(
      scopedKey('debug-mini-cart-height'),
      String(newHeight)
    );
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    handle.classList.remove('dragging');
  };

  handle.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    startY = e.clientY;
    startHeight = items.offsetHeight;
    handle.classList.add('dragging');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
