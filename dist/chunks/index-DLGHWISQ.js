import { B as BaseEnhancer } from "./index-BzlW3G0-.js";
import { f as formatCurrency } from "./utils-CJHo6zrd.js";
import { a as useCartStore } from "./analytics-C593VfhV.js";
function buildFlags(state) {
  return {
    isEmpty: state.isEmpty,
    hasDiscounts: state.hasDiscounts,
    isFreeShipping: state.shippingMethod?.price.isZero() ?? true,
    hasShippingDiscount: state.shippingMethod?.hasDiscounts ?? false
  };
}
function buildVars(state, flags, itemCount) {
  return {
    subtotal: formatCurrency(state.subtotal.toNumber()),
    total: formatCurrency(state.total.toNumber()),
    shipping: flags.isFreeShipping ? "Free" : formatCurrency(state.shippingMethod?.price.toNumber() ?? 0),
    shippingOriginal: flags.hasShippingDiscount ? formatCurrency(state.shippingMethod?.originalPrice.toNumber() ?? 0) : "",
    discounts: formatCurrency(state.totalDiscount.toNumber()),
    itemCount: String(itemCount)
  };
}
function buildDefaultTemplate(vars, flags) {
  const row = (label, value, cls = "") => `<div class="next-summary-row${cls ? ` ${cls}` : ""}"><span class="next-summary-label">${label}</span><span class="next-summary-value">${value}</span></div>`;
  return [
    row("Subtotal", vars.subtotal, "next-row-subtotal"),
    flags.hasDiscounts ? row("Discounts", `-${vars.discounts}`, "next-row-discounts") : "",
    row("Shipping", flags.isFreeShipping ? "Free" : vars.shipping, "next-row-shipping"),
    row("Total", vars.total, "next-row-total")
  ].join("");
}
function updateStateClasses(element, flags) {
  element.classList.toggle("next-cart-empty", flags.isEmpty);
  element.classList.toggle("next-cart-has-items", !flags.isEmpty);
  element.classList.toggle("next-has-discounts", flags.hasDiscounts);
  element.classList.toggle("next-no-discounts", !flags.hasDiscounts);
  element.classList.toggle("next-has-shipping", !flags.isFreeShipping);
  element.classList.toggle("next-free-shipping", flags.isFreeShipping);
  element.classList.toggle("next-has-shipping-discount", flags.hasShippingDiscount);
  element.classList.toggle("next-no-shipping-discount", !flags.hasShippingDiscount);
}
function renderDefault(element, vars, flags) {
  element.innerHTML = buildDefaultTemplate(vars, flags);
}
function renderCustom(element, template, vars, summary) {
  const html = template.replace(
    /\{([^}]+)\}/g,
    (match, key) => key in vars ? vars[key] : match
  );
  element.innerHTML = html;
  renderListContainers(element, summary);
}
function renderListContainers(element, summary) {
  renderLines(element, summary);
  renderDiscountList(element, "[data-summary-offer-discounts]", summary?.offer_discounts ?? []);
  renderDiscountList(element, "[data-summary-voucher-discounts]", summary?.voucher_discounts ?? []);
}
function renderLines(element, summary) {
  const container = element.querySelector("[data-summary-lines]");
  if (!container) return;
  const templateEl = container.querySelector(":scope > template");
  if (!templateEl) return;
  const itemTemplate = templateEl.innerHTML.trim();
  clearListItems(container);
  const lines = (summary?.lines ?? []).sort((a, b) => a.package_id - b.package_id);
  const isEmpty = lines.length === 0;
  container.classList.toggle("next-summary-empty", isEmpty);
  container.classList.toggle("next-summary-has-items", !isEmpty);
  lines.forEach((line) => container.appendChild(buildLineElement(itemTemplate, line)));
}
function buildLineElement(template, line) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderSummaryLine(template, line);
  const el = wrapper.firstElementChild ?? wrapper;
  const discountContainer = el.querySelector("[data-line-discounts]");
  if (discountContainer) {
    const discountTemplateEl = discountContainer.querySelector(":scope > template");
    if (discountTemplateEl) {
      const discountTemplate = discountTemplateEl.innerHTML.trim();
      const isEmpty = line.discounts.length === 0;
      discountContainer.classList.toggle("next-summary-empty", isEmpty);
      discountContainer.classList.toggle("next-summary-has-items", !isEmpty);
      discountContainer.insertAdjacentHTML(
        "beforeend",
        line.discounts.map((d) => renderDiscountItem(discountTemplate, d)).join("")
      );
    }
  }
  return el;
}
function renderDiscountList(element, selector, items) {
  const container = element.querySelector(selector);
  if (!container) return;
  const templateEl = container.querySelector(":scope > template");
  if (!templateEl) return;
  const itemTemplate = templateEl.innerHTML.trim();
  clearListItems(container);
  const isEmpty = items.length === 0;
  container.classList.toggle("next-summary-empty", isEmpty);
  container.classList.toggle("next-summary-has-items", !isEmpty);
  container.insertAdjacentHTML(
    "beforeend",
    items.map((d) => renderDiscountItem(itemTemplate, d)).join("")
  );
}
function clearListItems(container) {
  Array.from(container.childNodes).forEach((node) => {
    if (node.tagName?.toLowerCase() !== "template") {
      node.parentNode?.removeChild(node);
    }
  });
}
function renderDiscountItem(template, discount) {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    switch (key) {
      case "discount.name":
        return discount.name ?? "";
      case "discount.amount":
        return discount.amount ?? "";
      case "discount.description":
        return discount.description ?? "";
      default:
        return "";
    }
  });
}
function renderSummaryLine(template, line) {
  const hasDiscount = parseFloat(line.total_discount) > 0;
  const hasSavings = line.price_retail_total != null ? parseFloat(line.price_retail_total) > parseFloat(line.package_price) : hasDiscount;
  const vars = {
    "line.packageId": String(line.package_id),
    "line.quantity": String(line.quantity),
    "line.name": line.name ?? "",
    "line.image": line.image ?? "",
    "line.qty": line.qty != null ? String(line.qty) : "",
    "line.productName": line.product_name ?? "",
    "line.variantName": line.product_variant_name ?? "",
    "line.sku": line.product_sku ?? "",
    "line.price": line.price ?? "",
    "line.priceTotal": line.price_total ?? "",
    "line.priceRetail": line.price_retail ?? "",
    "line.priceRetailTotal": line.price_retail_total ?? "",
    "line.priceRecurring": line.price_recurring ?? "",
    "line.priceRecurringTotal": line.price_recurring_total ?? "",
    "line.isRecurring": line.is_recurring ? "true" : "false",
    "line.unitPrice": line.unit_price,
    "line.originalUnitPrice": line.original_unit_price,
    "line.packagePrice": line.package_price,
    "line.originalPackagePrice": line.original_package_price,
    "line.subtotal": line.subtotal,
    "line.totalDiscount": line.total_discount,
    "line.total": line.total,
    "line.hasDiscount": hasDiscount ? "show" : "hide",
    "line.hasSavings": hasSavings ? "show" : "hide"
  };
  return template.replace(/\{([^}]+)\}/g, (_, key) => vars[key] ?? "");
}
class CartSummaryEnhancer extends BaseEnhancer {
  constructor() {
    super(...arguments);
    this.itemCount = 0;
  }
  async initialize() {
    this.validateElement();
    this.customTemplate = this.resolveTemplate();
    const state = useCartStore.getState();
    this.cartState = state;
    this.summary = state.summary;
    this.itemCount = state.items.length;
    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));
    this.render();
    this.logger.debug("CartSummaryEnhancer initialized");
  }
  update() {
    this.render();
  }
  // ─── Private ───────────────────────────────────────────────────────────────
  handleCartUpdate(state) {
    const totalsChanged = state.subtotal !== this.cartState?.subtotal || state.total !== this.cartState?.total;
    const summaryChanged = state.summary !== this.summary;
    const countChanged = state.items.length !== this.itemCount;
    if (totalsChanged || summaryChanged || countChanged) {
      this.cartState = state;
      this.summary = state.summary;
      this.itemCount = state.items.length;
      this.render();
    }
  }
  render() {
    if (!this.cartState) return;
    const flags = buildFlags(this.cartState);
    const vars = buildVars(this.cartState, flags, this.itemCount);
    updateStateClasses(this.element, flags);
    if (this.customTemplate) {
      renderCustom(this.element, this.customTemplate, vars, this.summary);
    } else {
      renderDefault(this.element, vars, flags);
    }
  }
  /**
   * Looks for a <template> child element and returns its inner HTML.
   * Returns undefined if none found — the built-in default is used instead.
   */
  resolveTemplate() {
    const templateEl = this.element.querySelector(":scope > template");
    return templateEl?.innerHTML.trim() || void 0;
  }
}
export {
  CartSummaryEnhancer
};
