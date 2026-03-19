import { B as BaseEnhancer } from "./index-WbFNZle8.js";
import { u as useCartStore } from "./analytics-BuAKAb38.js";
import { f as formatCurrency } from "./utils-CQa_9vcu.js";
function buildDefaultTemplate(vars, flags) {
  const row = (label, value, cls = "") => `<div class="next-summary-row${cls ? ` ${cls}` : ""}"><span class="next-summary-label">${label}</span><span class="next-summary-value">${value}</span></div>`;
  return [
    row("Subtotal", vars.subtotal, "next-row-subtotal"),
    flags.hasDiscounts ? row("Discounts", `-${vars.discounts}`, "next-row-discounts") : "",
    row("Shipping", flags.isFreeShipping ? "Free" : vars.shipping, "next-row-shipping"),
    flags.hasTax ? row("Tax", vars.tax, "next-row-tax") : "",
    row("Total", vars.total, "next-row-total")
  ].join("");
}
function buildFlags(totals) {
  return {
    isEmpty: totals.isEmpty,
    hasDiscounts: totals.discounts.value > 0,
    isFreeShipping: totals.shipping.value === 0,
    hasShippingDiscount: totals.shippingDiscount.value > 0,
    hasTax: totals.tax.value > 0,
    hasSavings: totals.hasTotalSavings
    // retail savings OR applied discounts
  };
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
    this.totals = state.totals;
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
    const totalsChanged = state.totals !== this.totals;
    const summaryChanged = state.summary !== this.summary;
    const countChanged = state.items.length !== this.itemCount;
    if (totalsChanged || summaryChanged || countChanged) {
      this.totals = state.totals;
      this.summary = state.summary;
      this.itemCount = state.items.length;
      this.render();
    }
  }
  render() {
    if (!this.totals) return;
    const flags = buildFlags(this.totals);
    const vars = this.buildVars(this.totals, flags);
    this.updateStateClasses(flags);
    if (this.customTemplate) {
      this.renderCustom(vars);
    } else {
      this.renderDefault(vars, flags);
    }
  }
  renderDefault(vars, flags) {
    this.element.innerHTML = buildDefaultTemplate(vars, flags);
  }
  renderCustom(vars) {
    const html = this.customTemplate.replace(
      /\{([^}]+)\}/g,
      (match, key) => key in vars ? vars[key] : match
    );
    this.element.innerHTML = html;
    this.renderListContainers();
  }
  /** Find [data-summary-list] containers in rendered output and populate them. */
  renderListContainers() {
    const containers = this.element.querySelectorAll("[data-summary-list]");
    containers.forEach((container) => {
      const key = container.getAttribute("data-summary-list");
      if (key !== "offer_discounts" && key !== "voucher_discounts" && key !== "lines") return;
      const templateEl = container.querySelector(":scope > template");
      if (!templateEl) return;
      const itemTemplate = templateEl.innerHTML.trim();
      Array.from(container.childNodes).forEach((node) => {
        if (node.tagName?.toLowerCase() !== "template") {
          node.parentNode?.removeChild(node);
        }
      });
      if (key === "lines") {
        const lines = (this.summary?.lines ?? []).sort((a, b) => a.package_id - b.package_id);
        const isEmpty = lines.length === 0;
        this.toggleElementClass("next-summary-empty", isEmpty, container);
        this.toggleElementClass("next-summary-has-items", !isEmpty, container);
        container.insertAdjacentHTML(
          "beforeend",
          lines.map((l) => this.renderSummaryLine(itemTemplate, l)).join("")
        );
      } else {
        const items = this.summary?.[key] ?? [];
        const isEmpty = items.length === 0;
        this.toggleElementClass("next-summary-empty", isEmpty, container);
        this.toggleElementClass("next-summary-has-items", !isEmpty, container);
        container.insertAdjacentHTML(
          "beforeend",
          items.map((d) => this.renderDiscountItem(itemTemplate, d)).join("")
        );
      }
    });
  }
  renderDiscountItem(template, discount) {
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
  renderSummaryLine(template, line) {
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
      // Campaign prices (formatted strings from campaign data)
      "line.price": line.price ?? "",
      "line.priceTotal": line.price_total ?? "",
      "line.priceRetail": line.price_retail ?? "",
      "line.priceRetailTotal": line.price_retail_total ?? "",
      "line.priceRecurring": line.price_recurring ?? "",
      "line.priceRecurringTotal": line.price_recurring_total ?? "",
      "line.isRecurring": line.is_recurring ? "true" : "false",
      // API summary prices (reflect applied offer/coupon discounts)
      "line.unitPrice": line.unit_price,
      "line.originalUnitPrice": line.original_unit_price,
      "line.packagePrice": line.package_price,
      "line.originalPackagePrice": line.original_package_price,
      "line.subtotal": line.subtotal,
      "line.totalDiscount": line.total_discount,
      "line.total": line.total,
      // Conditional helpers
      "line.hasDiscount": hasDiscount ? "show" : "hide",
      "line.hasSavings": hasSavings ? "show" : "hide"
    };
    return template.replace(/\{([^}]+)\}/g, (_, key) => vars[key] ?? "");
  }
  // ─── State CSS classes ─────────────────────────────────────────────────────
  updateStateClasses(flags) {
    this.toggleClass("next-cart-empty", flags.isEmpty);
    this.toggleClass("next-cart-has-items", !flags.isEmpty);
    this.toggleClass("next-has-discounts", flags.hasDiscounts);
    this.toggleClass("next-no-discounts", !flags.hasDiscounts);
    this.toggleClass("next-has-shipping", !flags.isFreeShipping);
    this.toggleClass("next-free-shipping", flags.isFreeShipping);
    this.toggleClass("next-has-shipping-discount", flags.hasShippingDiscount);
    this.toggleClass("next-no-shipping-discount", !flags.hasShippingDiscount);
    this.toggleClass("next-has-tax", flags.hasTax);
    this.toggleClass("next-no-tax", !flags.hasTax);
    this.toggleClass("next-has-savings", flags.hasSavings);
    this.toggleClass("next-no-savings", !flags.hasSavings);
  }
  toggleElementClass(cls, on, el = this.element) {
    el.classList.toggle(cls, on);
  }
  // ─── Template vars ─────────────────────────────────────────────────────────
  buildVars(totals, flags) {
    return {
      subtotal: totals.subtotal.formatted,
      total: totals.total.formatted,
      shipping: flags.isFreeShipping ? "Free" : totals.shipping.formatted,
      shippingOriginal: flags.hasShippingDiscount ? formatCurrency(totals.shipping.value + totals.shippingDiscount.value) : "",
      tax: totals.tax.formatted,
      discounts: totals.discounts.formatted,
      savings: totals.totalSavings.formatted,
      // retail + offer/coupon savings
      compareTotal: totals.compareTotal.formatted,
      itemCount: String(this.itemCount)
    };
  }
  // ─── Template resolution ───────────────────────────────────────────────────
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
