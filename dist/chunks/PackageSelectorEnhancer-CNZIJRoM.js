import { B as BaseEnhancer } from "./index-V5i0XpbT.js";
import { u as useCartStore, a as useCheckoutStore } from "./analytics-DZhE6oeR.js";
import { u as useCampaignStore, j as calculateBundlePrice, k as buildCartTotals } from "./utils-B70_3MK6.js";
class PackageSelectorEnhancer extends BaseEnhancer {
  constructor() {
    super(...arguments);
    this.selectorId = "";
    this.mode = "swap";
    this.template = "";
    this.items = [];
    this.selectedItem = null;
    this.clickHandlers = /* @__PURE__ */ new Map();
    this.quantityHandlers = /* @__PURE__ */ new Map();
    this.mutationObserver = null;
    this.boundCurrencyChangeHandler = null;
    this.currencyChangeTimeout = null;
    this.includeShipping = false;
  }
  async initialize() {
    this.validateElement();
    this.selectorId = this.getAttribute("data-next-selector-id") ?? this.getAttribute("data-next-id") ?? `selector-${Date.now()}`;
    this.mode = this.getAttribute("data-next-selection-mode") ?? "swap";
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
            const el = this.renderPackageTemplate(def);
            if (el) this.element.appendChild(el);
          }
        }
      } catch {
        this.logger.warn("Invalid JSON in data-next-packages, ignoring auto-render", packagesAttr);
      }
    }
    this.scanCards();
    this.setupMutationObserver();
    this.element._getSelectedItem = () => this.selectedItem;
    this.element._getSelectedPackageId = () => this.selectedItem?.packageId;
    this.subscribe(useCartStore, this.syncWithCart.bind(this));
    this.syncWithCart(useCartStore.getState());
    let prevVouchers = useCheckoutStore.getState().vouchers;
    this.subscribe(useCheckoutStore, (state) => {
      const next = state.vouchers;
      if (next.length !== prevVouchers.length || next.some((v, i) => v !== prevVouchers[i])) {
        prevVouchers = next;
        for (const item of this.items) {
          void this.fetchAndUpdatePrice(item);
        }
      }
    });
    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null) clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const item of this.items) {
          void this.fetchAndUpdatePrice(item);
        }
      }, 150);
    };
    document.addEventListener("next:currency-changed", this.boundCurrencyChangeHandler);
    for (const item of this.items) {
      void this.fetchAndUpdatePrice(item);
    }
    this.logger.debug("PackageSelectorEnhancer initialized", {
      selectorId: this.selectorId,
      mode: this.mode,
      itemCount: this.items.length
    });
  }
  // ─── Template rendering ───────────────────────────────────────────────────────
  renderPackageTemplate(def) {
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
    const html = this.template.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? "");
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html.trim();
    const firstChild = wrapper.firstElementChild;
    const cardEl = wrapper.querySelector("[data-next-selector-card]") ?? (firstChild instanceof HTMLElement ? firstChild : null);
    if (!cardEl) {
      this.logger.warn("Package template produced no root element for packageId", def.packageId);
      return null;
    }
    cardEl.setAttribute("data-next-selector-card", "");
    cardEl.setAttribute("data-next-package-id", String(def.packageId));
    if (def.selected) {
      cardEl.setAttribute("data-next-selected", "true");
    }
    return cardEl;
  }
  // ─── Card registration ────────────────────────────────────────────────────────
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
    const handler = (e) => void this.handleCardClick(e, item);
    this.clickHandlers.set(el, handler);
    el.addEventListener("click", handler);
    this.setupQuantityControls(item);
    this.logger.debug(`Registered selector card for package ${packageId}`);
  }
  updateItemPackageData(item) {
    const pkg = useCampaignStore.getState().getPackage(item.packageId);
    if (pkg) {
      item.price = pkg.price ? parseFloat(pkg.price) : item.price;
      item.name = pkg.name ?? item.name;
    }
  }
  // ─── Quantity controls ────────────────────────────────────────────────────────
  setupQuantityControls(item) {
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
          void this.handleQuantityChange(item);
        }
      };
      this.quantityHandlers.set(increaseBtn, h);
      increaseBtn.addEventListener("click", h);
    }
    if (decreaseBtn) {
      const h = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (item.quantity > min) {
          item.quantity--;
          updateDisplay();
          void this.handleQuantityChange(item);
        }
      };
      this.quantityHandlers.set(decreaseBtn, h);
      decreaseBtn.addEventListener("click", h);
    }
    updateDisplay();
  }
  async handleQuantityChange(item) {
    this.emit("selector:quantity-changed", {
      selectorId: this.selectorId,
      packageId: item.packageId,
      quantity: item.quantity
    });
    if (this.selectedItem === item && this.mode === "swap") {
      const cartStore = useCartStore.getState();
      if (cartStore.hasItem(item.packageId)) {
        await cartStore.updateQuantity(item.packageId, item.quantity);
      } else {
        await cartStore.addItem({ packageId: item.packageId, quantity: item.quantity, isUpsell: false });
      }
    }
  }
  // ─── Mutation observer ────────────────────────────────────────────────────────
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
    if (this.selectedItem === item && this.mode === "swap") {
      void this.updateCart({ ...item, packageId: oldId }, item);
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
      if (this.selectedItem === removed) {
        this.selectedItem = null;
        this.element.removeAttribute("data-selected-package");
      }
    }
  }
  // ─── Selection & cart update ──────────────────────────────────────────────────
  async handleCardClick(e, item) {
    e.preventDefault();
    if (this.selectedItem === item) return;
    const previous = this.selectedItem;
    this.selectItem(item);
    this.emit("selector:item-selected", {
      selectorId: this.selectorId,
      packageId: item.packageId,
      previousPackageId: previous?.packageId,
      mode: this.mode,
      pendingAction: this.mode === "select" ? true : void 0
    });
    if (this.mode === "swap") {
      await this.updateCart(previous, item);
      if (item.shippingId) await this.setShippingMethod(item.shippingId);
    }
  }
  selectItem(item) {
    for (const i of this.items) {
      i.element.classList.remove("next-selected");
      i.element.setAttribute("data-next-selected", "false");
    }
    item.element.classList.add("next-selected");
    item.element.setAttribute("data-next-selected", "true");
    this.selectedItem = item;
    this.element.setAttribute("data-selected-package", String(item.packageId));
    this.emit("selector:selection-changed", {
      selectorId: this.selectorId,
      packageId: item.packageId,
      quantity: item.quantity,
      item
    });
  }
  async updateCart(_previous, selected) {
    const cartStore = useCartStore.getState();
    const existingCartItem = cartStore.items.find(
      (ci) => this.items.some(
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
  async setShippingMethod(shippingId) {
    const id = parseInt(shippingId, 10);
    if (isNaN(id)) {
      this.logger.warn("Invalid shipping ID:", shippingId);
      return;
    }
    await useCartStore.getState().setShippingMethod(id);
  }
  // ─── Backend price calculation ────────────────────────────────────────────────
  async fetchAndUpdatePrice(item) {
    const currency = useCampaignStore.getState().data?.currency ?? null;
    const checkoutVouchers = useCheckoutStore.getState().vouchers;
    const vouchers = checkoutVouchers.length ? checkoutVouchers : void 0;
    const priceSlots = item.element.querySelectorAll("[data-next-package-price]");
    if (priceSlots.length === 0) return;
    item.element.classList.add("next-loading");
    item.element.setAttribute("data-next-loading", "true");
    try {
      const { totals, summary } = await calculateBundlePrice(
        [{ packageId: item.packageId, quantity: item.quantity }],
        { currency, exclude_shipping: !this.includeShipping, vouchers }
      );
      const campaignPackages = useCampaignStore.getState().packages;
      const pkg = campaignPackages.find((p) => p.ref_id === item.packageId);
      const retailCompareTotal = pkg?.price_retail ? parseFloat(pkg.price_retail) * item.quantity : 0;
      const effectiveTotals = retailCompareTotal > 0 ? buildCartTotals(summary, { exclude_shipping: !this.includeShipping, compareTotal: retailCompareTotal }) : totals;
      priceSlots.forEach((el) => {
        const field = el.getAttribute("data-next-package-price") || "total";
        switch (field) {
          case "subtotal":
            el.textContent = effectiveTotals.subtotal.formatted;
            break;
          case "compare":
            el.textContent = effectiveTotals.compareTotal.formatted;
            break;
          case "savings":
            el.textContent = effectiveTotals.totalSavings.formatted;
            break;
          case "savingsPercentage":
            el.textContent = effectiveTotals.totalSavingsPercentage.formatted;
            break;
          default:
            el.textContent = effectiveTotals.total.formatted;
            break;
        }
      });
    } catch (error) {
      this.logger.warn(`Failed to fetch price for package ${item.packageId}`, error);
    } finally {
      item.element.classList.remove("next-loading");
      item.element.setAttribute("data-next-loading", "false");
    }
  }
  // ─── Cart sync ────────────────────────────────────────────────────────────────
  syncWithCart(cartState) {
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
      if (inCartItem && this.selectedItem !== inCartItem) {
        this.selectItem(inCartItem);
        return;
      }
    }
    if (!this.selectedItem) {
      const preSelected = this.items.find((i) => i.isPreSelected) ?? this.items[0];
      if (preSelected) {
        this.selectItem(preSelected);
        if (this.mode === "swap" && cartState.isEmpty) {
          void this.updateCart(null, preSelected).then(() => {
            if (preSelected.shippingId) void this.setShippingMethod(preSelected.shippingId);
          });
        }
      }
    }
  }
  // ─── BaseEnhancer ──────────────────────────────────────────────────────────────
  update() {
    this.syncWithCart(useCartStore.getState());
  }
  getSelectedItem() {
    return this.selectedItem;
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
export {
  PackageSelectorEnhancer
};
