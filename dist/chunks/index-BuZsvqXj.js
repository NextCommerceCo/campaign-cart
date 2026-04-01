import { B as BaseEnhancer } from "./index-ByfsDYQW.js";
import { T as TemplateRenderer } from "./utils-DGJWv0Vp.js";
import { D as DisplayFormatter } from "./DisplayEnhancerCore-7eLOpjOn.js";
import { a as useCartStore } from "./analytics-CyPVhTFQ.js";
function getDefaultItemTemplate() {
  return `
    <div class="cart-item" data-cart-item-id="{item.id}" data-package-id="{item.packageId}">
      <div class="cart-item-image">
        <img src="{item.image}" alt="{item.name}" onerror="this.style.display='none';">
        <span style="font-size: 1.5em;">📦</span>
      </div>
      <div class="cart-item-details">
        <h4 class="cart-item-name">{item.name}</h4>
        <div class="cart-item-variant" style="color: #666; font-size: 0.9em;">{item.variantAttributesFormatted}</div>
        <div class="cart-item-sku" style="color: #999; font-size: 0.85em;">SKU: {item.variantSku}</div>
        <div class="cart-item-pricing">
          <div class="original-price {item.showOriginalPrice}" style="text-decoration: line-through; color: #999;">{item.price} each</div>
          <div class="current-price">{item.finalPrice} each</div>
          <div class="discount-badge {item.showDiscount}" style="color: #e74c3c; font-weight: bold;">-{item.discountAmount} coupon discount</div>
          <div class="compare-price {item.showCompare}" style="text-decoration: line-through; color: #999;">{item.comparePrice}</div>
          <div class="savings {item.showSavings}" style="color: #0d7519; font-weight: bold;">Save {item.savingsAmount} ({item.savingsPct})</div>
          <div class="frequency">{item.frequency}</div>
          <div class="recurring-price {item.showRecurring}" style="color: #666;">Then {item.recurringPrice} recurring</div>
        </div>
      </div>
      <div class="quantity-controls">
        <button class="quantity-btn" data-next-quantity="decrease" data-package-id="{item.packageId}">-</button>
        <span class="quantity-display">{item.quantity}</span>
        <button class="quantity-btn" data-next-quantity="increase" data-package-id="{item.packageId}">+</button>
      </div>
      <div class="cart-item-total">
        <div class="line-total-original {item.showOriginalPrice}" style="text-decoration: line-through; color: #999; font-size: 0.9em;">{item.lineTotal}</div>
        <div class="line-total">{item.finalLineTotal}</div>
        <div class="line-compare {item.showCompare}" style="text-decoration: line-through; color: #999; font-size: 0.9em;">{item.lineCompare}</div>
      </div>
      <button class="remove-btn" data-next-remove-item data-package-id="{item.packageId}" data-confirm="true" data-confirm-message="Remove this item from your cart?">Remove</button>
    </div>
  `.trim();
}
function renderCartItem(item, template, titleMap) {
  try {
    const itemData = prepareCartItemData(item, titleMap);
    const formatters = {
      ...TemplateRenderer.createDefaultFormatters(),
      currency: (value) => DisplayFormatter.formatCurrency(value)
    };
    return TemplateRenderer.render(template, { data: { item: itemData }, formatters });
  } catch {
    return "";
  }
}
function groupIdenticalItems(items) {
  const grouped = /* @__PURE__ */ new Map();
  for (const item of items) {
    const existing = grouped.get(item.packageId);
    if (existing) {
      existing.quantity += item.quantity;
      if (!existing.groupedItemIds) {
        existing.groupedItemIds = [existing.id];
      }
      existing.groupedItemIds.push(item.id);
    } else {
      grouped.set(item.packageId, { ...item });
    }
  }
  return Array.from(grouped.values());
}
function prepareCartItemData(item, titleMap) {
  const p = (s) => parseFloat(s ?? "0") || 0;
  const packagePrice = item.price;
  const packageQty = item.qty ?? 1;
  const unitPrice = p(item.price_per_unit);
  const retailPrice = p(item.price_retail);
  const retailPriceTotal = p(item.price_retail) * item.quantity;
  const hasSavings = retailPriceTotal > 0 && retailPriceTotal > packagePrice || p(item.total_discount) > 0;
  const retailLineTotal = retailPriceTotal * item.quantity;
  const lineTotalRaw = p(item.total) || packagePrice * item.quantity;
  const discountAmountRaw = p(item.total_discount);
  const hasDiscount = discountAmountRaw > 0;
  const finalPriceRaw = p(item.package_price) || packagePrice;
  const finalLineTotalRaw = finalPriceRaw * item.quantity;
  const unitFinalPrice = p(item.unit_price) || unitPrice;
  const hasRecurring = item.is_recurring ?? false;
  const recurringPriceRaw = p(item.price_recurring);
  const recurringTotalRaw = p(item.price_recurring_total);
  const frequencyText = hasRecurring ? item.interval_count && item.interval_count > 1 ? `Every ${item.interval_count} ${item.interval}s` : `Per ${item.interval}` : "One time";
  const savingsRaw = hasSavings ? retailLineTotal - lineTotalRaw : 0;
  const savingsPct = hasSavings && retailLineTotal > 0 ? Math.round(savingsRaw / retailLineTotal * 100) : 0;
  const unitSavings = hasSavings ? retailPrice - unitPrice : 0;
  const packageSavings = hasSavings ? retailPriceTotal - packagePrice : 0;
  const globalTitleMap = window.nextConfig?.productTitleMap ?? {};
  const effectiveTitleMap = titleMap ?? globalTitleMap;
  let customTitle = effectiveTitleMap[item.packageId] ?? effectiveTitleMap[String(item.packageId)];
  if (!customTitle) {
    const titleTransform = window.nextConfig?.productTitleTransform;
    if (typeof titleTransform === "function") {
      try {
        customTitle = titleTransform(item.packageId, item.title);
      } catch {
      }
    }
  }
  const attrs = item.variantAttributes ?? [];
  return {
    // Identification
    id: item.id,
    packageId: item.packageId,
    title: customTitle ?? item.title,
    name: customTitle ?? item.title,
    quantity: item.quantity,
    // Product and variant
    productId: item.productId,
    productName: item.productName ?? "",
    variantId: item.variantId,
    variantName: item.variantName ?? "",
    variantAttributes: attrs,
    variantSku: item.variantSku ?? "",
    variantAttributesFormatted: formatVariantAttributes(attrs),
    variantAttributesList: formatVariantAttributesList(attrs),
    ...extractIndividualAttributes(attrs),
    // Pricing — raw numbers; formatted by the `currency` TemplateFormatter
    price: packagePrice,
    unitPrice,
    lineTotal: lineTotalRaw,
    lineCompare: hasSavings ? retailLineTotal : 0,
    comparePrice: hasSavings ? retailPriceTotal : 0,
    unitComparePrice: hasSavings ? retailPrice : 0,
    recurringPrice: hasRecurring ? recurringPriceRaw : 0,
    savingsAmount: savingsRaw,
    unitSavings,
    // Discount fields (from API)
    discountAmount: discountAmountRaw,
    discountedPrice: finalPriceRaw,
    discountedLineTotal: finalLineTotalRaw,
    hasDiscount,
    finalPrice: hasDiscount ? finalPriceRaw : packagePrice,
    finalLineTotal: hasDiscount ? finalLineTotalRaw : lineTotalRaw,
    unitFinalPrice,
    // Package-level pricing
    packagePrice: unitPrice,
    packagePriceTotal: packagePrice,
    packageRetailPrice: retailPrice,
    packageRetailTotal: retailPriceTotal,
    packageSavings,
    recurringTotal: hasRecurring ? recurringTotalRaw : 0,
    // Calculated / display
    savingsPct: savingsPct > 0 ? `${savingsPct}%` : "",
    packageSavingsPct: savingsPct > 0 ? `${savingsPct}%` : "",
    packageQty,
    frequency: frequencyText,
    isRecurring: hasRecurring ? "true" : "false",
    hasSavings: savingsRaw > 0 ? "true" : "false",
    hasPackageSavings: packageSavings > 0 ? "true" : "false",
    // Media
    image: item.image ?? "",
    sku: item.sku ?? item.variantSku ?? "",
    // Raw numeric values (unformatted) — suffix `.raw`
    "price.raw": packagePrice,
    "unitPrice.raw": unitPrice,
    "lineTotal.raw": lineTotalRaw,
    "lineCompare.raw": hasSavings ? retailLineTotal : 0,
    "comparePrice.raw": hasSavings ? retailPriceTotal : 0,
    "unitComparePrice.raw": hasSavings ? retailPrice : 0,
    "recurringPrice.raw": recurringPriceRaw,
    "savingsAmount.raw": savingsRaw,
    "unitSavings.raw": unitSavings,
    "packagePrice.raw": unitPrice,
    "packagePriceTotal.raw": packagePrice,
    "packageRetailPrice.raw": retailPrice,
    "packageRetailTotal.raw": retailPriceTotal,
    "packageSavings.raw": packageSavings,
    "recurringTotal.raw": recurringTotalRaw,
    "savingsPct.raw": savingsPct,
    "packageSavingsPct.raw": savingsPct,
    "discountAmount.raw": discountAmountRaw,
    "discountedPrice.raw": finalPriceRaw,
    "discountedLineTotal.raw": finalLineTotalRaw,
    "finalPrice.raw": hasDiscount ? finalPriceRaw : packagePrice,
    "finalLineTotal.raw": hasDiscount ? finalLineTotalRaw : lineTotalRaw,
    // Conditional display helpers — use as CSS class or data attribute
    showCompare: hasSavings ? "show" : "hide",
    showSavings: savingsRaw > 0 ? "show" : "hide",
    showUnitPrice: packageQty > 1 ? "show" : "hide",
    showUnitCompare: packageQty > 1 && hasSavings ? "show" : "hide",
    showUnitSavings: packageQty > 1 && unitSavings > 0 ? "show" : "hide",
    showRecurring: hasRecurring ? "show" : "hide",
    showPackageSavings: packageSavings > 0 ? "show" : "hide",
    showPackageTotal: packagePrice > 0 ? "show" : "hide",
    showRecurringTotal: hasRecurring && recurringTotalRaw > 0 ? "show" : "hide",
    showDiscount: hasDiscount ? "show" : "hide",
    showOriginalPrice: hasDiscount ? "show" : "hide"
  };
}
function formatVariantAttributes(attrs) {
  if (attrs.length === 0) return "";
  return attrs.map((a) => `${a.name}: ${a.value}`).join(", ");
}
function formatVariantAttributesList(attrs) {
  if (attrs.length === 0) return "";
  return attrs.map((a) => `<span class="variant-attr">${a.name}: ${a.value}</span>`).join(" ");
}
function extractIndividualAttributes(attrs) {
  const result = {};
  for (const attr of attrs) {
    const camelCode = attr.code.charAt(0).toUpperCase() + attr.code.slice(1).toLowerCase();
    result[`variant${camelCode}`] = attr.value;
    result[`variant.${attr.code.toLowerCase()}`] = attr.value;
    result[`variantAttr.${attr.code.toLowerCase()}`] = attr.value;
    result[`variant_${attr.code}`] = attr.value;
  }
  return result;
}
class CartItemListEnhancer extends BaseEnhancer {
  constructor() {
    super(...arguments);
    this.lastRenderedItems = "";
    this.groupItems = false;
  }
  async initialize() {
    this.validateElement();
    const templateId = this.getAttribute("data-item-template-id");
    const templateSelector = this.getAttribute("data-item-template-selector");
    if (templateId) {
      const templateEl = document.getElementById(templateId);
      this.template = templateEl?.innerHTML.trim() ?? "";
    } else if (templateSelector) {
      const templateEl = document.querySelector(templateSelector);
      this.template = templateEl?.innerHTML.trim() ?? "";
    } else {
      this.template = this.getAttribute("data-item-template") ?? this.element.innerHTML.trim();
    }
    if (!this.template || this.template.replace(/<!--[\s\S]*?-->/g, "").trim() === "") {
      this.template = getDefaultItemTemplate();
    }
    this.emptyTemplate = this.getAttribute("data-empty-template") ?? '<div class="cart-empty">Your cart is empty</div>';
    const titleMapAttr = this.getAttribute("data-title-map");
    if (titleMapAttr) {
      try {
        this.titleMap = JSON.parse(titleMapAttr);
      } catch (error) {
        this.logger.warn("Invalid title map JSON:", error);
      }
    }
    this.groupItems = this.hasAttribute("data-group-items");
    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));
    this.handleCartUpdate(useCartStore.getState());
    this.logger.debug("CartItemListEnhancer initialized");
  }
  update(data) {
    if (data) {
      void this.handleCartUpdate(data);
    }
  }
  // ─── Private ────────────────────────────────────────────────────────────────
  async handleCartUpdate(cartState) {
    try {
      if (cartState.isEmpty || cartState.items.length === 0) {
        this.renderEmptyCart();
      } else {
        await this.renderCartItems(cartState.items);
      }
    } catch (error) {
      this.handleError(error, "handleCartUpdate");
    }
  }
  renderEmptyCart() {
    this.element.innerHTML = this.emptyTemplate ?? "";
    this.addClass("cart-empty");
    this.removeClass("cart-has-items");
  }
  async renderCartItems(items) {
    this.removeClass("cart-empty");
    this.addClass("cart-has-items");
    const itemsToRender = this.groupItems ? groupIdenticalItems(items) : items;
    const template = this.template ?? getDefaultItemTemplate();
    const htmlParts = [];
    for (const item of itemsToRender) {
      const html = renderCartItem(item, template, this.titleMap);
      if (html) htmlParts.push(html);
    }
    const newHTML = htmlParts.join("");
    if (newHTML !== this.lastRenderedItems) {
      this.element.innerHTML = newHTML;
      this.lastRenderedItems = newHTML;
      await this.enhanceNewElements();
    } else {
      this.logger.debug("Cart items HTML unchanged, skipping DOM update");
    }
  }
  async enhanceNewElements() {
    const quantityButtons = this.element.querySelectorAll("[data-next-quantity]");
    const removeButtons = this.element.querySelectorAll("[data-next-remove-item]");
    if (quantityButtons.length > 0) {
      const { QuantityControlEnhancer } = await import("./index-DvD167BG.js");
      for (const button of Array.from(quantityButtons)) {
        if (button instanceof HTMLElement) {
          try {
            const enhancer = new QuantityControlEnhancer(button);
            await enhancer.initialize();
          } catch (error) {
            this.logger.error(
              "Failed to enhance quantity button:",
              error,
              button
            );
          }
        }
      }
    }
    if (removeButtons.length > 0) {
      const { RemoveItemEnhancer } = await import("./index-CSu3iN0v.js");
      for (const button of Array.from(removeButtons)) {
        if (button instanceof HTMLElement) {
          try {
            const enhancer = new RemoveItemEnhancer(button);
            await enhancer.initialize();
          } catch (error) {
            this.logger.error(
              "Failed to enhance remove button:",
              error,
              button
            );
          }
        }
      }
    }
    this.logger.debug(
      `Enhanced ${quantityButtons.length} quantity buttons and ${removeButtons.length} remove buttons`
    );
  }
  // ─── Public API ──────────────────────────────────────────────────────────────
  getItemCount() {
    return this.element.querySelectorAll("[data-cart-item-id]").length;
  }
  getItemElements() {
    return this.element.querySelectorAll("[data-cart-item-id]");
  }
  refreshItem(_packageId) {
    void this.handleCartUpdate(useCartStore.getState());
  }
}
export {
  CartItemListEnhancer
};
