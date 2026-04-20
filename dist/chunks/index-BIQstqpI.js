import { B as BaseEnhancer } from "./BaseEnhancer-Dn6lC4xc.js";
import { a as useCartStore, u as useCampaignStore, c as configStore } from "./analytics-hnrlm383.js";
import { f as formatCurrency, e as formatPercentage, r as renderDiscountContainers, g as renderFlatDiscountContainers, h as replaceVarsPreservingTemplates } from "./utils-COqAt8L9.js";
import { A as AttributeParser } from "./index-D5pqlxv9.js";
import { B as BaseDisplayEnhancer } from "./DisplayEnhancerCore-DaPyEFa3.js";
function computeFrequency$1(interval, count) {
  if (!interval) return "";
  const n = count ?? 1;
  if (interval === "day") return n === 1 ? "Daily" : `Every ${n} days`;
  if (interval === "month") return n === 1 ? "Monthly" : `Every ${n} months`;
  return "";
}
const KNOWN_NAMESPACES = /* @__PURE__ */ new Set(["item", "line", "discount"]);
function num(value) {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}
function nullableNum(value) {
  if (value == null) return null;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}
function buildItemContext(line) {
  const unitPrice = num(line.unit_price);
  const originalUnitPrice = num(line.original_unit_price);
  const discountAmount = num(line.total_discount);
  const discountPercentage = originalUnitPrice > 0 && originalUnitPrice > unitPrice ? Math.round((originalUnitPrice - unitPrice) / originalUnitPrice * 100) : 0;
  return {
    packageId: line.package_id,
    name: line.name ?? "",
    image: line.image ?? "",
    quantity: line.quantity,
    productName: line.product_name ?? "",
    variantName: line.product_variant_name ?? "",
    sku: line.product_sku ?? "",
    isRecurring: line.is_recurring === true,
    interval: line.interval ?? null,
    intervalCount: line.interval_count ?? null,
    recurringPrice: nullableNum(line.price_recurring),
    originalRecurringPrice: nullableNum(line.original_recurring_price),
    price: num(line.total),
    originalPrice: num(line.subtotal),
    unitPrice,
    originalUnitPrice,
    discountAmount,
    discountPercentage,
    hasDiscount: discountAmount > 0,
    currency: line.currency ?? "",
    frequency: computeFrequency$1(line.interval, line.interval_count)
  };
}
function buildDiscountContext(d) {
  const amountFormatted = d.amount ?? "";
  const stripped = amountFormatted.replace(/[^0-9.\-]/g, "");
  const amount = stripped ? parseFloat(stripped) : 0;
  return {
    name: d.name ?? "",
    amount: Number.isFinite(amount) ? amount : 0,
    amountFormatted,
    description: d.description ?? ""
  };
}
function evaluateLocalCondition(parsed, ctx) {
  if (!parsed || typeof parsed !== "object") {
    return { handled: false };
  }
  const node = parsed;
  switch (node.type) {
    case "logical": {
      const op = node.operator;
      const subs = Array.isArray(node.conditions) ? node.conditions : [];
      let acc = op === "&&";
      for (const sub of subs) {
        const r = evaluateLocalCondition(sub, ctx);
        if (!r.handled) return { handled: false };
        if (op === "&&") {
          acc = acc && r.visible;
          if (!acc) break;
        } else {
          acc = acc || r.visible;
          if (acc) break;
        }
      }
      return { handled: true, visible: acc };
    }
    case "not": {
      const r = evaluateLocalCondition(node.condition, ctx);
      if (!r.handled) return { handled: false };
      return { handled: true, visible: !r.visible };
    }
    case "comparison": {
      const left = node.left;
      if (!isLocallyResolvable(left.object, ctx)) {
        return { handled: false };
      }
      const leftVal = resolveContextValue(left.object, left.property, ctx);
      const rightVal = node.right;
      return {
        handled: true,
        visible: compare(leftVal, node.operator, rightVal)
      };
    }
    case "property": {
      const object = node.object;
      const property = node.property;
      if (!isLocallyResolvable(object, ctx)) {
        return { handled: false };
      }
      const value = resolveContextValue(object, property, ctx);
      return { handled: true, visible: Boolean(value) };
    }
    case "function":
    default:
      return { handled: false };
  }
}
function isLocallyResolvable(object, ctx) {
  if (!KNOWN_NAMESPACES.has(object)) return false;
  if (object === "item" && !ctx.item) return false;
  if (object === "line" && !ctx.line) return false;
  if (object === "discount" && !ctx.discount) return false;
  return true;
}
function resolveContextValue(object, property, ctx) {
  const root = ctx[object];
  if (!root || typeof root !== "object") return void 0;
  return root[property];
}
function compare(left, operator, right) {
  switch (operator) {
    case ">":
      return Number(left) > Number(right);
    case ">=":
      return Number(left) >= Number(right);
    case "<":
      return Number(left) < Number(right);
    case "<=":
      return Number(left) <= Number(right);
    case "==":
    case "===":
      return looseEqual(left, right);
    case "!=":
    case "!==":
      return !looseEqual(left, right);
    default:
      return false;
  }
}
function looseEqual(left, right) {
  if (typeof left === "number" || typeof right === "number") {
    return Number(left) === Number(right);
  }
  if (typeof left === "boolean" || typeof right === "boolean") {
    const lb = typeof left === "string" ? left === "true" : Boolean(left);
    const rb = typeof right === "string" ? right === "true" : Boolean(right);
    return lb === rb;
  }
  return String(left ?? "") === String(right ?? "");
}
const CONDITION_SELECTOR = "[data-next-show], [data-next-hide]";
function applyLocalConditions(rootEl, ctx, warn) {
  for (const el of Array.from(rootEl.querySelectorAll(CONDITION_SELECTOR))) {
    processConditionElement(el, ctx, warn);
  }
  const matchesSelf = typeof rootEl.matches === "function" && rootEl.matches(CONDITION_SELECTOR);
  if (!matchesSelf) return true;
  const showExpr = rootEl.getAttribute("data-next-show");
  const hideExpr = rootEl.getAttribute("data-next-hide");
  const expr = showExpr ?? hideExpr;
  if (expr == null || expr.trim() === "") {
    if (showExpr != null) rootEl.removeAttribute("data-next-show");
    if (hideExpr != null) rootEl.removeAttribute("data-next-hide");
    return true;
  }
  const result = safeEvaluate(expr, ctx, warn);
  if (result == null) return true;
  if (!result.handled) return true;
  const visible = showExpr != null ? result.visible : !result.visible;
  rootEl.removeAttribute("data-next-show");
  rootEl.removeAttribute("data-next-hide");
  return visible;
}
function processConditionElement(el, ctx, warn) {
  const showExpr = el.getAttribute("data-next-show");
  const hideExpr = el.getAttribute("data-next-hide");
  const expr = showExpr ?? hideExpr;
  if (expr == null || expr.trim() === "") {
    if (showExpr != null) el.removeAttribute("data-next-show");
    if (hideExpr != null) el.removeAttribute("data-next-hide");
    return;
  }
  const result = safeEvaluate(expr, ctx, warn);
  if (result == null) return;
  if (!result.handled) return;
  const visible = showExpr != null ? result.visible : !result.visible;
  el.removeAttribute("data-next-show");
  el.removeAttribute("data-next-hide");
  if (!visible) {
    el.parentNode?.removeChild(el);
  }
}
function safeEvaluate(expr, ctx, warn) {
  try {
    const parsed = AttributeParser.parseCondition(expr);
    return evaluateLocalCondition(parsed, ctx);
  } catch (err) {
    warn?.(`Failed to evaluate condition "${expr}": ${err.message}`);
    return null;
  }
}
function buildFlags(state) {
  return {
    isEmpty: state.isEmpty,
    hasDiscounts: state.hasDiscounts,
    isFreeShipping: state.shippingMethod?.price.isZero() ?? true,
    hasShippingDiscount: state.shippingMethod?.hasDiscounts ?? false,
    isCalculating: state.isCalculating
  };
}
function buildVars(state, flags, itemCount, currency) {
  const fmt = (n) => formatCurrency(n, currency);
  const pct = (n) => formatPercentage(n);
  const totalQuantity = state.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  return {
    // totals
    subtotal: fmt(state.subtotal.toNumber()),
    total: fmt(state.total.toNumber()),
    // shipping
    shippingName: state.shippingMethod?.name ?? "",
    shippingCode: state.shippingMethod?.code ?? "",
    shipping: flags.isFreeShipping ? "Free" : fmt(state.shippingMethod?.price.toNumber() ?? 0),
    shippingOriginal: flags.hasShippingDiscount ? fmt(state.shippingMethod?.originalPrice.toNumber() ?? 0) : "",
    shippingDiscountAmount: fmt(
      state.shippingMethod?.discountAmount.toNumber() ?? 0
    ),
    shippingDiscountPercentage: pct(
      state.shippingMethod?.discountPercentage.toNumber() ?? 0
    ),
    // discounts
    totalDiscount: fmt(state.totalDiscount.toNumber()),
    totalDiscountPercentage: pct(state.totalDiscountPercentage.toNumber()),
    discounts: fmt(state.totalDiscount.toNumber()),
    // currency
    currency,
    // cart utils
    isCalculating: String(flags.isCalculating),
    isEmpty: String(flags.isEmpty),
    itemCount: String(itemCount),
    totalQuantity: String(totalQuantity),
    isFreeShipping: String(flags.isFreeShipping),
    hasShippingDiscount: String(flags.hasShippingDiscount),
    hasDiscounts: String(flags.hasDiscounts)
  };
}
function buildDefaultTemplate(vars, flags) {
  const row = (label, value, cls = "") => `<div class="next-summary-row${cls ? ` ${cls}` : ""}"><span class="next-summary-label">${label}</span><span class="next-summary-value">${value}</span></div>`;
  return [
    row("Subtotal", vars.subtotal, "next-row-subtotal"),
    flags.hasDiscounts ? row("Discounts", `-${vars.discounts}`, "next-row-discounts") : "",
    row(
      "Shipping",
      flags.isFreeShipping ? "Free" : vars.shipping,
      "next-row-shipping"
    ),
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
  element.classList.toggle(
    "next-has-shipping-discount",
    flags.hasShippingDiscount
  );
  element.classList.toggle(
    "next-no-shipping-discount",
    !flags.hasShippingDiscount
  );
  element.classList.toggle("next-calculating", flags.isCalculating);
  element.classList.toggle("next-not-calculating", !flags.isCalculating);
}
function renderDefault(element, vars, flags) {
  element.innerHTML = buildDefaultTemplate(vars, flags);
}
function renderCustom(element, template, vars, summary, warn) {
  const html = template.replace(
    /\{([^}]+)\}/g,
    (match, key) => key in vars ? vars[key] : match
  );
  element.innerHTML = html;
  renderListContainers(element, summary, warn);
}
function htmlToElement(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  return wrapper.firstElementChild;
}
function renderListContainers(element, summary, warn) {
  renderLines(element, summary, warn);
  renderDiscountList(
    element,
    "[data-summary-offer-discounts]",
    summary?.offer_discounts ?? [],
    warn
  );
  renderDiscountList(
    element,
    "[data-summary-voucher-discounts]",
    summary?.voucher_discounts ?? [],
    warn
  );
  renderDiscountContainers(element, {
    offerDiscounts: summary?.offer_discounts ?? [],
    voucherDiscounts: summary?.voucher_discounts ?? []
  });
}
function renderLines(element, summary, warn) {
  const container = element.querySelector("[data-summary-lines]");
  if (!container) return;
  const templateEl = container.querySelector(
    ":scope > template"
  );
  if (!templateEl) return;
  const itemTemplate = templateEl.innerHTML.trim();
  clearListItems(container);
  const lines = (summary?.lines ?? []).sort(
    (a, b) => a.package_id - b.package_id
  );
  const isEmpty = lines.length === 0;
  container.classList.toggle("next-summary-empty", isEmpty);
  container.classList.toggle("next-summary-has-items", !isEmpty);
  lines.forEach((line) => {
    const node = buildLineElement(itemTemplate, line, warn);
    if (node) container.appendChild(node);
  });
}
function buildLineElement(template, line, warn) {
  const itemCtx = buildItemContext(line);
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderSummaryLine(template, line);
  const el = wrapper.firstElementChild ?? wrapper;
  const visible = applyLocalConditions(
    el,
    { item: itemCtx, line: itemCtx },
    warn
  );
  if (!visible) return null;
  const discountContainer = el.querySelector(
    "[data-line-discounts]"
  );
  if (discountContainer) {
    const discountTemplateEl = discountContainer.querySelector(
      ":scope > template"
    );
    if (discountTemplateEl) {
      const discountTemplate = discountTemplateEl.innerHTML.trim();
      const isEmpty = line.discounts.length === 0;
      discountContainer.classList.toggle("next-summary-empty", isEmpty);
      discountContainer.classList.toggle("next-summary-has-items", !isEmpty);
      for (const d of line.discounts) {
        const node = htmlToElement(renderDiscountItem(discountTemplate, d));
        if (!node) continue;
        const discountVisible = applyLocalConditions(
          node,
          {
            item: itemCtx,
            line: itemCtx,
            discount: buildDiscountContext(d)
          },
          warn
        );
        if (!discountVisible) continue;
        discountContainer.appendChild(node);
      }
    }
  }
  renderFlatDiscountContainers(el, line.discounts);
  return el;
}
function renderDiscountList(element, selector, items, warn) {
  const container = element.querySelector(selector);
  if (!container) return;
  const templateEl = container.querySelector(
    ":scope > template"
  );
  if (!templateEl) return;
  const itemTemplate = templateEl.innerHTML.trim();
  clearListItems(container);
  const isEmpty = items.length === 0;
  container.classList.toggle("next-summary-empty", isEmpty);
  container.classList.toggle("next-summary-has-items", !isEmpty);
  for (const d of items) {
    const node = htmlToElement(renderDiscountItem(itemTemplate, d));
    if (!node) continue;
    const visible = applyLocalConditions(
      node,
      { discount: buildDiscountContext(d) },
      warn
    );
    if (!visible) continue;
    container.appendChild(node);
  }
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
function computeFrequency(interval, count) {
  if (!interval) return "";
  const n = count ?? 1;
  if (interval === "day") return n === 1 ? "Daily" : `Every ${n} days`;
  if (interval === "month") return n === 1 ? "Monthly" : `Every ${n} months`;
  return "";
}
function renderSummaryLine(template, line) {
  const hasDiscount = parseFloat(line.total_discount) > 0;
  const origUnit = parseFloat(line.original_unit_price);
  const unit = parseFloat(line.unit_price);
  const discountPctNum = origUnit > 0 && origUnit > unit ? Math.round((origUnit - unit) / origUnit * 100) : 0;
  const discountPct = formatPercentage(discountPctNum);
  const vars = {
    "item.packageId": String(line.package_id),
    "item.name": line.name ?? "",
    "item.image": line.image ?? "",
    "item.quantity": String(line.quantity),
    "item.variantName": line.product_variant_name ?? "",
    "item.productName": line.product_name ?? "",
    "item.sku": line.product_sku ?? "",
    "item.isRecurring": line.is_recurring ? "true" : "false",
    "item.interval": line.interval ?? "",
    "item.intervalCount": line.interval_count != null ? String(line.interval_count) : "",
    "item.frequency": computeFrequency(line.interval, line.interval_count),
    "item.recurringPrice": line.price_recurring != null ? formatCurrency(line.price_recurring, line.currency ?? void 0) : "",
    "item.originalRecurringPrice": line.original_recurring_price != null ? formatCurrency(
      line.original_recurring_price,
      line.currency ?? void 0
    ) : "",
    "item.price": formatCurrency(line.total, line.currency ?? void 0),
    "item.originalPrice": formatCurrency(
      line.subtotal,
      line.currency ?? void 0
    ),
    "item.unitPrice": formatCurrency(
      line.unit_price,
      line.currency ?? void 0
    ),
    "item.originalUnitPrice": formatCurrency(
      line.original_unit_price,
      line.currency ?? void 0
    ),
    "item.discountAmount": formatCurrency(
      line.total_discount,
      line.currency ?? void 0
    ),
    "item.discountPercentage": discountPct,
    "item.hasDiscount": hasDiscount ? "show" : "hide",
    "item.currency": line.currency ?? ""
  };
  for (const [key, value] of Object.entries(vars)) {
    if (key.startsWith("item.")) {
      vars[key.replace(/^item\./, "line.")] = value;
    }
  }
  return replaceVarsPreservingTemplates(template, vars);
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
    const calculatingChanged = state.isCalculating !== this.cartState?.isCalculating;
    if (totalsChanged || summaryChanged || countChanged || calculatingChanged) {
      this.cartState = state;
      this.summary = state.summary;
      this.itemCount = state.items.length;
      this.render();
    }
  }
  render() {
    if (!this.cartState) return;
    const campaign = useCampaignStore.getState().data;
    const config = configStore.getState();
    const currency = campaign?.currency ?? config?.selectedCurrency ?? config?.detectedCurrency ?? "USD";
    const flags = buildFlags(this.cartState);
    const vars = buildVars(this.cartState, flags, this.itemCount, currency);
    updateStateClasses(this.element, flags);
    if (this.customTemplate) {
      renderCustom(this.element, this.customTemplate, vars, this.summary, (msg) => this.logger.warn(msg));
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
const FORMAT_MAP = {
  // totals info
  subtotal: "currency",
  total: "currency",
  // shipping info
  shippingName: "text",
  shippingCode: "text",
  shipping: "currency",
  shippingOriginal: "currency",
  shippingDiscountAmount: "currency",
  shippingDiscountPercentage: "percentage",
  // discounts info
  totalDiscount: "currency",
  totalDiscountPercentage: "percentage",
  // currency info
  currency: "text",
  // cart utils
  isCalculating: "boolean",
  isEmpty: "boolean",
  itemCount: "number",
  totalQuantity: "number",
  isFreeShipping: "boolean",
  hasShippingDiscount: "boolean",
  hasDiscounts: "boolean"
};
class CartDisplayEnhancer extends BaseDisplayEnhancer {
  setupStoreSubscriptions() {
    this.subscribe(useCartStore, (state) => {
      this.toggleClass("next-cart-empty", state.isEmpty);
      this.toggleClass("next-cart-has-items", !state.isEmpty);
      void this.updateDisplay();
    });
  }
  getPropertyValue() {
    if (!this.property) return void 0;
    return this.resolveValue(useCartStore.getState(), this.property);
  }
  resolveValue(state, property) {
    const flags = buildFlags(state);
    switch (property) {
      case "isEmpty":
        return flags.isEmpty;
      case "hasDiscounts":
        return flags.hasDiscounts;
      case "isFreeShipping":
        return flags.isFreeShipping;
      case "hasShippingDiscount":
        return flags.hasShippingDiscount;
      case "isCalculating":
        return flags.isCalculating;
      case "subtotal":
        return state.subtotal.toNumber();
      case "total":
        return state.total.toNumber();
      case "totalDiscount":
        return state.totalDiscount.toNumber();
      case "totalDiscountPercentage":
        return state.totalDiscountPercentage.toNumber();
      case "shipping":
        return state.shippingMethod?.price.toNumber() ?? 0;
      case "shippingOriginal":
        return state.shippingMethod?.originalPrice.toNumber() ?? 0;
      case "shippingDiscountAmount":
        return state.shippingMethod?.discountAmount.toNumber() ?? 0;
      case "shippingDiscountPercentage":
        return state.shippingMethod?.discountPercentage.toNumber() ?? 0;
      case "shippingName":
        return state.shippingMethod?.name ?? "";
      case "shippingCode":
        return state.shippingMethod?.code ?? "";
      case "currency":
        return state.currency ?? "";
      case "itemCount":
        return state.items.length;
      case "totalQuantity":
        return state.items.reduce((sum, item) => sum + item.quantity, 0);
      default:
        this.logger.warn(`Unknown cart display property: "${property}"`);
        return void 0;
    }
  }
  getDefaultFormatType(property) {
    return FORMAT_MAP[property] ?? "auto";
  }
  getCartProperty(cartState, property) {
    return this.resolveValue(cartState, property);
  }
  refreshDisplay() {
    void this.updateDisplay();
  }
}
export {
  CartDisplayEnhancer,
  CartSummaryEnhancer
};
