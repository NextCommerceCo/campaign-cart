import { B as BaseEnhancer } from "./BaseEnhancer-BXW8INTB.js";
import { u as useCampaignStore, b as useCheckoutStore, a as useCartStore } from "./analytics-Cx675Azl.js";
import { D as Decimal } from "./vendor-BvX3PoQU.js";
import { e as calculateBundlePrice, f as formatCurrency, h as formatPercentage } from "./utils-CQuX7v7-.js";
import { B as BaseDisplayEnhancer } from "./DisplayEnhancerCore-wLwjcZRi.js";
function renderPackageTemplate(template, def, logger) {
  const allPackages = useCampaignStore.getState().packages ?? [];
  const pkg = allPackages.find((p) => p.ref_id === def.packageId);
  const vars = {};
  for (const [key, value] of Object.entries(def)) {
    vars[`package.${key}`] = value != null ? String(value) : "";
  }
  if (pkg) {
    vars["package.packageId"] ?? (vars["package.packageId"] = String(pkg.ref_id));
    vars["package.name"] ?? (vars["package.name"] = pkg.name ?? "");
    vars["package.image"] ?? (vars["package.image"] = pkg.image ?? "");
    vars["package.price"] ?? (vars["package.price"] = pkg.price ?? "");
    vars["package.priceRetail"] ?? (vars["package.priceRetail"] = pkg.price_retail ?? "");
    vars["package.priceTotal"] ?? (vars["package.priceTotal"] = pkg.price_total ?? "");
  }
  const html = template.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? "");
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  const firstChild = wrapper.firstElementChild;
  const cardEl = wrapper.querySelector("[data-next-selector-card]") ?? (firstChild instanceof HTMLElement ? firstChild : null);
  if (!cardEl) {
    logger.warn("Package template produced no root element for packageId", def.packageId);
    return null;
  }
  cardEl.setAttribute("data-next-selector-card", "");
  cardEl.setAttribute("data-next-package-id", String(def.packageId));
  if (def.selected) {
    cardEl.setAttribute("data-next-selected", "true");
  }
  return cardEl;
}
async function fetchAndUpdatePrice(item, includeShipping, logger, upsell) {
  const currency = useCampaignStore.getState().currency ?? null;
  const checkoutVouchers = useCheckoutStore.getState().vouchers;
  const vouchers = !upsell && checkoutVouchers.length ? checkoutVouchers : void 0;
  const priceSlots = item.element.querySelectorAll("[data-next-package-price]");
  item.element.classList.add("next-loading");
  item.element.setAttribute("data-next-loading", "true");
  try {
    const { subtotal, total } = await calculateBundlePrice(
      [{ packageId: item.packageId, quantity: item.quantity }],
      { currency, vouchers, upsell }
    );
    const campaignPackages = useCampaignStore.getState().packages;
    const pkg = campaignPackages.find((p) => p.ref_id === item.packageId);
    const compareD = pkg?.price_retail ? new Decimal(pkg.price_retail).times(item.quantity) : null;
    priceSlots.forEach((el) => {
      const field = el.getAttribute("data-next-package-price") ?? "total";
      switch (field) {
        case "subtotal":
          el.textContent = formatCurrency(subtotal.toNumber());
          break;
        case "compare":
          el.textContent = compareD ? formatCurrency(compareD.toNumber()) : "";
          break;
        case "savings":
          el.textContent = compareD ? formatCurrency(compareD.minus(subtotal).toNumber()) : "";
          break;
        case "savingsPercentage":
          el.textContent = compareD?.gt(0) ? formatPercentage(compareD.minus(subtotal).div(compareD).times(100).toNumber()) : "";
          break;
        default:
          el.textContent = formatCurrency(total.toNumber());
      }
    });
    const savingsAmt = compareD ? compareD.minus(subtotal).toNumber() : 0;
    const savingsPct = compareD?.gt(0) ? compareD.minus(subtotal).div(compareD).times(100).toNumber() : 0;
    item.element.setAttribute("data-package-price-total", total.toNumber().toString());
    item.element.setAttribute("data-package-price-compare", compareD?.toNumber().toString() ?? "");
    item.element.setAttribute("data-package-price-savings", savingsAmt.toString());
    item.element.setAttribute("data-package-price-savings-pct", savingsPct.toString());
    const selectorId = item.element.closest("[data-next-selector-id]")?.getAttribute("data-next-selector-id") ?? "";
    item.element.dispatchEvent(
      new CustomEvent("selector:price-updated", {
        bubbles: true,
        detail: { selectorId, packageId: item.packageId }
      })
    );
  } catch (error) {
    logger.warn(`Failed to fetch price for package ${item.packageId}`, error);
  } finally {
    item.element.classList.remove("next-loading");
    item.element.setAttribute("data-next-loading", "false");
  }
}
function selectItem(item, ctx) {
  for (const i of ctx.items) {
    i.element.classList.remove("next-selected");
    i.element.setAttribute("data-next-selected", "false");
  }
  item.element.classList.add("next-selected");
  item.element.setAttribute("data-next-selected", "true");
  ctx.selectedItemRef.value = item;
  ctx.element.setAttribute("data-selected-package", String(item.packageId));
  ctx.emit("selector:selection-changed", {
    selectorId: ctx.selectorId,
    packageId: item.packageId,
    quantity: item.quantity,
    item
  });
}
async function handleCardClick(e, item, ctx) {
  e.preventDefault();
  if (ctx.selectedItemRef.value === item) return;
  const previous = ctx.selectedItemRef.value;
  selectItem(item, ctx);
  ctx.emit("selector:item-selected", {
    selectorId: ctx.selectorId,
    packageId: item.packageId,
    previousPackageId: previous?.packageId,
    mode: ctx.mode,
    pendingAction: ctx.mode === "select" ? true : void 0
  });
  if (ctx.mode === "swap") {
    await updateCart(previous, item, ctx.items);
    if (item.shippingId) await setShippingMethod(item.shippingId, ctx);
  }
}
async function updateCart(previous, selected, items) {
  const cartStore = useCartStore.getState();
  const existingCartItem = cartStore.items.find(
    (ci) => items.some(
      (si) => ci.packageId === si.packageId || ci.originalPackageId === si.packageId
    )
  );
  if (existingCartItem) {
    if (existingCartItem.packageId !== selected.packageId) {
      await cartStore.swapPackage(existingCartItem.packageId, {
        packageId: selected.packageId,
        quantity: selected.quantity,
        isUpsell: false
      });
    }
  } else if (!cartStore.hasItem(selected.packageId)) {
    await cartStore.addItem({
      packageId: selected.packageId,
      quantity: selected.quantity,
      isUpsell: false
    });
  }
}
async function setShippingMethod(shippingId, ctx) {
  const id = parseInt(shippingId, 10);
  if (isNaN(id)) {
    ctx.logger.warn("Invalid shipping ID:", shippingId);
    return;
  }
  await useCartStore.getState().setShippingMethod(id);
}
async function handleQuantityChange(item, ctx) {
  ctx.emit("selector:quantity-changed", {
    selectorId: ctx.selectorId,
    packageId: item.packageId,
    quantity: item.quantity
  });
  if (ctx.selectedItemRef.value === item && ctx.mode === "swap") {
    const cartStore = useCartStore.getState();
    if (cartStore.hasItem(item.packageId)) {
      await cartStore.updateQuantity(item.packageId, item.quantity);
    } else {
      await cartStore.addItem({
        packageId: item.packageId,
        quantity: item.quantity,
        isUpsell: false
      });
    }
  }
}
function setupQuantityControls(item, ctx, quantityHandlers) {
  const el = item.element;
  const increaseBtn = el.querySelector("[data-next-quantity-increase]");
  const decreaseBtn = el.querySelector("[data-next-quantity-decrease]");
  const displayEl = el.querySelector("[data-next-quantity-display]");
  if (!increaseBtn && !decreaseBtn) return;
  const min = parseInt(el.getAttribute("data-next-min-quantity") ?? "1", 10);
  const max = parseInt(el.getAttribute("data-next-max-quantity") ?? "999", 10);
  const updateDisplay = () => {
    if (displayEl) displayEl.textContent = String(item.quantity);
    el.setAttribute("data-next-quantity", String(item.quantity));
    if (decreaseBtn) {
      const atMin = item.quantity <= min;
      decreaseBtn.toggleAttribute("disabled", atMin);
      decreaseBtn.classList.toggle("next-disabled", atMin);
    }
    if (increaseBtn) {
      const atMax = item.quantity >= max;
      increaseBtn.toggleAttribute("disabled", atMax);
      increaseBtn.classList.toggle("next-disabled", atMax);
    }
  };
  if (increaseBtn) {
    const h = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (item.quantity < max) {
        item.quantity++;
        updateDisplay();
        void handleQuantityChange(item, ctx);
      }
    };
    quantityHandlers.set(increaseBtn, h);
    increaseBtn.addEventListener("click", h);
  }
  if (decreaseBtn) {
    const h = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (item.quantity > min) {
        item.quantity--;
        updateDisplay();
        void handleQuantityChange(item, ctx);
      }
    };
    quantityHandlers.set(decreaseBtn, h);
    decreaseBtn.addEventListener("click", h);
  }
  updateDisplay();
}
class PackageSelectorEnhancer extends BaseEnhancer {
  constructor() {
    super(...arguments);
    this.selectorId = "";
    this.mode = "swap";
    this.template = "";
    this.items = [];
    this.selectedItemRef = { value: null };
    this.clickHandlers = /* @__PURE__ */ new Map();
    this.quantityHandlers = /* @__PURE__ */ new Map();
    this.mutationObserver = null;
    this.boundCurrencyChangeHandler = null;
    this.currencyChangeTimeout = null;
    this.includeShipping = false;
    this.isUpsellContext = false;
  }
  async initialize() {
    this.validateElement();
    this.selectorId = this.getAttribute("data-next-selector-id") ?? this.getAttribute("data-next-id") ?? `selector-${Date.now()}`;
    this.isUpsellContext = this.element.hasAttribute("data-next-upsell-context");
    this.mode = this.isUpsellContext ? "select" : this.getAttribute("data-next-selection-mode") ?? "swap";
    this.includeShipping = this.getAttribute("data-next-include-shipping") === "true";
    const templateId = this.getAttribute("data-next-package-template-id");
    if (templateId) {
      this.template = document.getElementById(templateId)?.innerHTML.trim() ?? "";
    } else {
      this.template = this.getAttribute("data-next-package-template") ?? "";
    }
    const packagesAttr = this.getAttribute("data-next-packages");
    if (packagesAttr && this.template) {
      try {
        const parsed = JSON.parse(packagesAttr);
        if (!Array.isArray(parsed)) {
          this.logger.warn("data-next-packages must be a JSON array, ignoring auto-render");
        } else {
          this.element.innerHTML = "";
          for (const def of parsed) {
            const el = renderPackageTemplate(this.template, def, this.logger);
            if (el) this.element.appendChild(el);
          }
        }
      } catch {
        this.logger.warn("Invalid JSON in data-next-packages, ignoring auto-render", packagesAttr);
      }
    }
    this.scanCards();
    this.setupMutationObserver();
    this.element._getSelectedItem = () => this.selectedItemRef.value;
    this.element._getSelectedPackageId = () => this.selectedItemRef.value?.packageId;
    if (this.isUpsellContext) {
      this.initializeSelection();
    } else {
      this.subscribe(useCartStore, this.syncWithCart.bind(this));
      this.syncWithCart(useCartStore.getState());
      let prevVouchers = useCheckoutStore.getState().vouchers;
      this.subscribe(useCheckoutStore, (state) => {
        const next = state.vouchers;
        if (next.length !== prevVouchers.length || next.some((v, i) => v !== prevVouchers[i])) {
          prevVouchers = next;
          for (const item of this.items) {
            void fetchAndUpdatePrice(item, this.includeShipping, this.logger);
          }
        }
      });
    }
    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null) clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const item of this.items) {
          void fetchAndUpdatePrice(item, this.includeShipping, this.logger, this.isUpsellContext);
        }
      }, 150);
    };
    document.addEventListener("next:currency-changed", this.boundCurrencyChangeHandler);
    for (const item of this.items) {
      void fetchAndUpdatePrice(item, this.includeShipping, this.logger, this.isUpsellContext);
    }
    this.logger.debug("PackageSelectorEnhancer initialized", {
      selectorId: this.selectorId,
      mode: this.mode,
      isUpsellContext: this.isUpsellContext,
      itemCount: this.items.length
    });
  }
  // ─── Upsell context: pre-select default item without touching cart ────────
  initializeSelection() {
    if (this.selectedItemRef.value) return;
    const ctx = this.makeHandlerContext();
    const preSelected = this.items.find((i) => i.isPreSelected) ?? this.items[0];
    if (preSelected) selectItem(preSelected, ctx);
  }
  // ─── Context factory ───────────────────────────────────────────────────────
  makeHandlerContext() {
    return {
      selectorId: this.selectorId,
      mode: this.mode,
      includeShipping: this.includeShipping,
      logger: this.logger,
      element: this.element,
      emit: (e, d) => this.emit(e, d),
      selectedItemRef: this.selectedItemRef,
      items: this.items
    };
  }
  // ─── Card registration ────────────────────────────────────────────────────
  scanCards() {
    this.element.querySelectorAll("[data-next-selector-card]").forEach((el) => {
      if (!this.items.find((i) => i.element === el)) this.registerCard(el);
    });
  }
  registerCard(el) {
    const packageIdAttr = el.getAttribute("data-next-package-id");
    if (!packageIdAttr) {
      this.logger.warn("Selector card is missing data-next-package-id", el);
      return;
    }
    const packageId = parseInt(packageIdAttr, 10);
    if (isNaN(packageId)) {
      this.logger.warn("Invalid data-next-package-id on selector card", packageIdAttr);
      return;
    }
    const existing = this.items.find((i) => i.element === el);
    if (existing) {
      existing.packageId = packageId;
      existing.quantity = parseInt(el.getAttribute("data-next-quantity") ?? "1", 10);
      existing.shippingId = el.getAttribute("data-next-shipping-id") ?? void 0;
      this.updateItemPackageData(existing);
      return;
    }
    const quantity = parseInt(el.getAttribute("data-next-quantity") ?? "1", 10);
    const isPreSelected = el.getAttribute("data-next-selected") === "true";
    const shippingId = el.getAttribute("data-next-shipping-id") ?? void 0;
    const pkg = useCampaignStore.getState().getPackage(packageId);
    const item = {
      element: el,
      packageId,
      quantity,
      price: pkg?.price ? parseFloat(pkg.price) : void 0,
      name: pkg?.name ?? `Package ${packageId}`,
      isPreSelected,
      shippingId
    };
    this.items.push(item);
    el.classList.add("next-selector-card");
    const ctx = this.makeHandlerContext();
    const handler = (e) => void handleCardClick(e, item, ctx);
    this.clickHandlers.set(el, handler);
    el.addEventListener("click", handler);
    setupQuantityControls(item, ctx, this.quantityHandlers);
    this.logger.debug(`Registered selector card for package ${packageId}`);
  }
  updateItemPackageData(item) {
    const pkg = useCampaignStore.getState().getPackage(item.packageId);
    if (pkg) {
      item.price = pkg.price ? parseFloat(pkg.price) : item.price;
      item.name = pkg.name ?? item.name;
    }
  }
  // ─── Mutation observer ────────────────────────────────────────────────────
  setupMutationObserver() {
    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.target instanceof HTMLElement) {
          const target = mutation.target;
          if (target.hasAttribute("data-next-selector-card") && mutation.attributeName === "data-next-package-id") {
            this.handlePackageIdChange(target);
          }
        }
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            if (node.hasAttribute("data-next-selector-card")) this.registerCard(node);
            node.querySelectorAll("[data-next-selector-card]").forEach((el) => {
              if (!this.items.find((i) => i.element === el)) this.registerCard(el);
            });
          });
          mutation.removedNodes.forEach((node) => {
            if (node instanceof HTMLElement) this.handleCardRemoval(node);
          });
        }
      }
    });
    this.mutationObserver.observe(this.element, {
      attributes: true,
      attributeFilter: ["data-next-package-id", "data-next-quantity", "data-next-selected"],
      childList: true,
      subtree: true
    });
  }
  handlePackageIdChange(el) {
    const item = this.items.find((i) => i.element === el);
    if (!item) {
      this.registerCard(el);
      return;
    }
    const newIdAttr = el.getAttribute("data-next-package-id");
    if (!newIdAttr) return;
    const newId = parseInt(newIdAttr, 10);
    const oldId = item.packageId;
    if (newId === oldId) return;
    item.packageId = newId;
    item.quantity = parseInt(el.getAttribute("data-next-quantity") ?? "1", 10);
    item.shippingId = el.getAttribute("data-next-shipping-id") ?? void 0;
    this.updateItemPackageData(item);
    if (this.selectedItemRef.value === item && this.mode === "swap") {
      void updateCart({}, item, this.items);
    }
    this.syncWithCart(useCartStore.getState());
  }
  handleCardRemoval(el) {
    const toRemove = [];
    if (el.hasAttribute("data-next-selector-card")) toRemove.push(el);
    el.querySelectorAll("[data-next-selector-card]").forEach((c) => toRemove.push(c));
    for (const cardEl of toRemove) {
      const idx = this.items.findIndex((i) => i.element === cardEl);
      if (idx === -1) continue;
      const removed = this.items[idx];
      const ch = this.clickHandlers.get(cardEl);
      if (ch) {
        cardEl.removeEventListener("click", ch);
        this.clickHandlers.delete(cardEl);
      }
      for (const btn of [
        cardEl.querySelector("[data-next-quantity-increase]"),
        cardEl.querySelector("[data-next-quantity-decrease]")
      ]) {
        if (!btn) continue;
        const h = this.quantityHandlers.get(btn);
        if (h) {
          btn.removeEventListener("click", h);
          this.quantityHandlers.delete(btn);
        }
      }
      this.items.splice(idx, 1);
      if (this.selectedItemRef.value === removed) {
        this.selectedItemRef.value = null;
        this.element.removeAttribute("data-selected-package");
      }
    }
  }
  // ─── Cart sync ────────────────────────────────────────────────────────────
  syncWithCart(cartState) {
    const ctx = this.makeHandlerContext();
    for (const item of this.items) {
      const inCart = cartState.items.some(
        (ci) => ci.packageId === item.packageId || ci.originalPackageId === item.packageId
      );
      item.element.classList.toggle("next-in-cart", inCart);
      item.element.setAttribute("data-next-in-cart", String(inCart));
      if (inCart) {
        const ci = cartState.items.find(
          (ci2) => ci2.packageId === item.packageId || ci2.originalPackageId === item.packageId
        );
        if (ci && item.quantity !== ci.quantity) {
          item.quantity = ci.quantity;
          const displayEl = item.element.querySelector("[data-next-quantity-display]");
          if (displayEl) displayEl.textContent = String(item.quantity);
          item.element.setAttribute("data-next-quantity", String(item.quantity));
        }
      }
    }
    if (this.mode === "swap") {
      const inCartItem = this.items.find(
        (item) => cartState.items.some(
          (ci) => ci.packageId === item.packageId || ci.originalPackageId === item.packageId
        )
      );
      if (inCartItem && this.selectedItemRef.value !== inCartItem) {
        selectItem(inCartItem, ctx);
        return;
      }
    }
    if (!this.selectedItemRef.value) {
      const preSelected = this.items.find((i) => i.isPreSelected) ?? this.items[0];
      if (preSelected) {
        selectItem(preSelected, ctx);
        if (this.mode === "swap" && cartState.isEmpty) {
          void updateCart(null, preSelected, this.items).then(() => {
            if (preSelected.shippingId) {
              void useCartStore.getState().setShippingMethod(
                parseInt(preSelected.shippingId, 10)
              );
            }
          });
        }
      }
    }
  }
  // ─── BaseEnhancer ─────────────────────────────────────────────────────────
  update() {
    if (!this.isUpsellContext) this.syncWithCart(useCartStore.getState());
  }
  getSelectedItem() {
    return this.selectedItemRef.value;
  }
  cleanupEventListeners() {
    this.clickHandlers.forEach((h, el) => el.removeEventListener("click", h));
    this.clickHandlers.clear();
    this.quantityHandlers.forEach((h, el) => el.removeEventListener("click", h));
    this.quantityHandlers.clear();
    if (this.currencyChangeTimeout !== null) {
      clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = null;
    }
    if (this.boundCurrencyChangeHandler) {
      document.removeEventListener("next:currency-changed", this.boundCurrencyChangeHandler);
      this.boundCurrencyChangeHandler = null;
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }
  destroy() {
    this.cleanupEventListeners();
    this.items.forEach(
      (i) => i.element.classList.remove("next-selector-card", "next-selected", "next-in-cart")
    );
    this.items = [];
    super.destroy();
  }
}
const FORMAT_MAP = {
  isSelected: "boolean",
  isInCart: "boolean",
  hasSavings: "boolean",
  price: "currency",
  compare: "currency",
  savings: "currency",
  savingsPercentage: "percentage"
};
class PackageSelectorDisplayEnhancer extends BaseDisplayEnhancer {
  constructor() {
    super(...arguments);
    this.cardEl = null;
    this.selectionHandler = null;
    this.priceHandler = null;
  }
  parseDisplayAttributes() {
    super.parseDisplayAttributes();
    const parts = this.displayPath.split(".");
    if (parts.length >= 4 && parts[0] === "selector") {
      this.selectorId = parts[1];
      const id = parseInt(parts[2], 10);
      this.packageId = isNaN(id) ? void 0 : id;
      this.property = parts.slice(3).join(".");
    }
  }
  setupStoreSubscriptions() {
    this.resolveCardEl();
    this.selectionHandler = (e) => {
      const { selectorId } = e.detail;
      if (selectorId === this.selectorId) void this.updateDisplay();
    };
    document.addEventListener("selector:item-selected", this.selectionHandler);
    this.priceHandler = (e) => {
      const { selectorId, packageId } = e.detail;
      if (selectorId === this.selectorId && packageId === this.packageId) {
        this.resolveCardEl();
        void this.updateDisplay();
      }
    };
    document.addEventListener("selector:price-updated", this.priceHandler);
  }
  resolveCardEl() {
    if (this.cardEl || !this.selectorId || !this.packageId) return;
    const selectorEl = document.querySelector(
      `[data-next-selector-id="${this.selectorId}"]`
    );
    this.cardEl = selectorEl?.querySelector(
      `[data-next-selector-card][data-next-package-id="${this.packageId}"]`
    ) ?? null;
  }
  getPropertyValue() {
    this.resolveCardEl();
    if (!this.cardEl || !this.property) return void 0;
    switch (this.property) {
      case "isSelected":
        return this.cardEl.getAttribute("data-next-selected") === "true";
      case "isInCart":
        return this.cardEl.getAttribute("data-next-in-cart") === "true";
      case "price":
        return parseFloat(this.cardEl.getAttribute("data-package-price-total") ?? "") || void 0;
      case "compare":
        return parseFloat(this.cardEl.getAttribute("data-package-price-compare") ?? "") || void 0;
      case "savings":
        return parseFloat(this.cardEl.getAttribute("data-package-price-savings") ?? "") || void 0;
      case "savingsPercentage":
        return parseFloat(this.cardEl.getAttribute("data-package-price-savings-pct") ?? "") || void 0;
      case "hasSavings":
        return (parseFloat(this.cardEl.getAttribute("data-package-price-savings") ?? "0") || 0) > 0;
      default:
        this.logger.warn(`Unknown selector display property: "${this.property}"`);
        return void 0;
    }
  }
  getDefaultFormatType(property) {
    return FORMAT_MAP[property] ?? "auto";
  }
  destroy() {
    super.destroy();
    if (this.selectionHandler) {
      document.removeEventListener("selector:item-selected", this.selectionHandler);
      this.selectionHandler = null;
    }
    if (this.priceHandler) {
      document.removeEventListener("selector:price-updated", this.priceHandler);
      this.priceHandler = null;
    }
  }
}
export {
  PackageSelectorDisplayEnhancer,
  PackageSelectorEnhancer
};
