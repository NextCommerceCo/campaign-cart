import { B as BaseEnhancer } from "./index-BVS9Wxlv.js";
import { a as useCartStore, b as useCheckoutStore, u as useCampaignStore } from "./analytics-nekWyYfO.js";
import { T as TemplateRenderer, h as calculateBundlePrice, f as formatCurrency } from "./utils-DlFSJDpc.js";
const autoAddedPackages = /* @__PURE__ */ new Set();
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => autoAddedPackages.clear());
}
class PackageToggleEnhancer extends BaseEnhancer {
  constructor() {
    super(...arguments);
    this.template = "";
    this.cards = [];
    this.clickHandlers = /* @__PURE__ */ new Map();
    this.mutationObserver = null;
    this.boundCurrencyChangeHandler = null;
    this.currencyChangeTimeout = null;
    this.priceSyncDebounce = null;
    this.includeShipping = false;
    this.autoAddInProgress = /* @__PURE__ */ new Set();
  }
  async initialize() {
    this.validateElement();
    this.includeShipping = this.getAttribute("data-next-include-shipping") === "true";
    const templateId = this.getAttribute("data-next-toggle-template-id");
    if (templateId) {
      this.template = document.getElementById(templateId)?.innerHTML.trim() ?? "";
    } else {
      this.template = this.getAttribute("data-next-toggle-template") ?? "";
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
            const el = this.renderToggleTemplate(def);
            if (el) this.element.appendChild(el);
          }
        }
      } catch {
        this.logger.warn("Invalid JSON in data-next-packages, ignoring auto-render", packagesAttr);
      }
    }
    this.scanCards();
    this.setupMutationObserver();
    for (const card of this.cards) {
      this.renderToggleImage(card);
    }
    this.subscribe(useCartStore, this.syncWithCart.bind(this));
    this.syncWithCart(useCartStore.getState());
    let prevVouchers = useCheckoutStore.getState().vouchers;
    this.subscribe(useCheckoutStore, (state) => {
      const next = state.vouchers;
      if (next.length !== prevVouchers.length || next.some((v, i) => v !== prevVouchers[i])) {
        prevVouchers = next;
        for (const card of this.cards) {
          void this.fetchAndUpdateTogglePrice(card);
        }
      }
    });
    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null) clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const card of this.cards) {
          void this.fetchAndUpdateTogglePrice(card);
        }
      }, 150);
    };
    document.addEventListener("next:currency-changed", this.boundCurrencyChangeHandler);
    for (const card of this.cards) {
      void this.fetchAndUpdateTogglePrice(card);
    }
    this.logger.debug("PackageToggleEnhancer initialized", { cardCount: this.cards.length });
  }
  // ─── Template rendering ───────────────────────────────────────────────────────
  renderToggleTemplate(def) {
    const allPackages = useCampaignStore.getState().data?.packages ?? [];
    const pkg = allPackages.find((p) => p.ref_id === def.packageId);
    const toggleData = {};
    for (const [key, value] of Object.entries(def)) {
      toggleData[key] = value != null ? String(value) : "";
    }
    if (pkg) {
      toggleData["packageId"] ?? (toggleData["packageId"] = String(pkg.ref_id));
      toggleData["name"] ?? (toggleData["name"] = pkg.name ?? "");
      toggleData["image"] ?? (toggleData["image"] = pkg.image ?? "");
      toggleData["price"] ?? (toggleData["price"] = pkg.price ?? "");
      toggleData["priceRetail"] ?? (toggleData["priceRetail"] = pkg.price_retail ?? "");
      toggleData["priceRetailTotal"] ?? (toggleData["priceRetailTotal"] = pkg.price_retail_total ?? "");
    }
    const html = TemplateRenderer.render(this.template, { data: { toggle: toggleData } });
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html.trim();
    const firstChild = wrapper.firstElementChild;
    const cardEl = wrapper.querySelector("[data-next-toggle-card]") ?? (firstChild instanceof HTMLElement ? firstChild : null);
    if (!cardEl) {
      this.logger.warn("Toggle template produced no root element for packageId", def.packageId);
      return null;
    }
    cardEl.setAttribute("data-next-toggle-card", "");
    cardEl.setAttribute("data-next-package-id", String(def.packageId));
    if (def.selected) {
      cardEl.setAttribute("data-next-selected", "true");
    }
    return cardEl;
  }
  renderToggleImage(card) {
    const slots = card.element.querySelectorAll(
      "[data-next-toggle-image]"
    );
    if (slots.length === 0) return;
    const pkg = (useCampaignStore.getState().data?.packages ?? []).find(
      (p) => p.ref_id === card.packageId
    );
    if (!pkg?.image) return;
    slots.forEach((el) => {
      el.src = pkg.image;
      if (!el.alt) el.alt = pkg.name ?? "";
    });
  }
  // ─── State container ──────────────────────────────────────────────────────────
  /**
   * Find the nearest ancestor that should receive state classes.
   * Used for toggle/bump/upsell wrapper elements.
   */
  findStateContainer(el) {
    let current = el;
    while (current && current !== document.body) {
      if (current.hasAttribute("data-next-toggle-container") || current.hasAttribute("data-next-bump") || current.hasAttribute("data-next-upsell-item") || current.classList.contains("upsell") || current.classList.contains("bump")) {
        return current;
      }
      if (current.hasAttribute("data-next-package-id") || current.hasAttribute("data-package-id")) {
        return current;
      }
      current = current.parentElement;
    }
    return el;
  }
  resolvePackageId(el, stateContainer) {
    const fromEl = el.getAttribute("data-next-package-id") ?? el.getAttribute("data-package-id");
    if (fromEl) {
      const id = parseInt(fromEl, 10);
      return isNaN(id) ? null : id;
    }
    if (stateContainer !== el) {
      const fromContainer = stateContainer.getAttribute("data-next-package-id") ?? stateContainer.getAttribute("data-package-id");
      if (fromContainer) {
        const id = parseInt(fromContainer, 10);
        return isNaN(id) ? null : id;
      }
    }
    return null;
  }
  // ─── Card registration ────────────────────────────────────────────────────────
  scanCards() {
    this.element.querySelectorAll("[data-next-toggle-card]").forEach((el) => {
      if (!this.cards.find((c) => c.element === el)) this.registerCard(el);
    });
    if (this.element.hasAttribute("data-next-package-toggle") && this.cards.length === 0 && (this.element.hasAttribute("data-next-package-id") || this.element.hasAttribute("data-package-id"))) {
      this.registerCard(this.element);
    }
  }
  registerCard(el) {
    const stateContainer = this.findStateContainer(el);
    const packageIdAttr = el.getAttribute("data-next-package-id");
    let packageId;
    if (packageIdAttr) {
      const parsed = parseInt(packageIdAttr, 10);
      if (isNaN(parsed)) {
        this.logger.warn("Invalid data-next-package-id on toggle card", packageIdAttr);
        return;
      }
      packageId = parsed;
    } else {
      const resolved = this.resolvePackageId(el, stateContainer);
      if (resolved === null) {
        this.logger.warn("Toggle card is missing data-next-package-id", el);
        return;
      }
      packageId = resolved;
    }
    const isPreSelected = el.getAttribute("data-next-selected") === "true" || stateContainer.getAttribute("data-next-selected") === "true";
    const packageSyncAttr = el.getAttribute("data-next-package-sync") ?? stateContainer.getAttribute("data-next-package-sync");
    let isSyncMode = false;
    let syncPackageIds = [];
    let quantity = 1;
    if (packageSyncAttr) {
      syncPackageIds = packageSyncAttr.split(",").map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id));
      if (syncPackageIds.length > 0) {
        isSyncMode = true;
        quantity = 0;
      }
    } else {
      const qtyAttr = el.getAttribute("data-next-quantity") ?? el.getAttribute("data-quantity") ?? stateContainer.getAttribute("data-next-quantity");
      quantity = qtyAttr ? parseInt(qtyAttr, 10) : 1;
    }
    const isUpsell = el.getAttribute("data-next-is-upsell") === "true" || stateContainer.hasAttribute("data-next-upsell") || stateContainer.hasAttribute("data-next-bump") || el.closest("[data-next-upsell-section]") !== null || el.closest("[data-next-bump-section]") !== null;
    const addText = el.getAttribute("data-add-text");
    const removeText = el.getAttribute("data-remove-text");
    const card = {
      element: el,
      packageId,
      isPreSelected,
      quantity,
      isSyncMode,
      syncPackageIds,
      isUpsell,
      stateContainer,
      addText,
      removeText
    };
    this.cards.push(card);
    el.classList.add("next-toggle-card");
    const handler = (e) => void this.handleCardClick(e, card);
    this.clickHandlers.set(el, handler);
    el.addEventListener("click", handler);
    this.logger.debug(`Registered toggle card for packageId ${packageId}`, {
      isSyncMode,
      syncPackageIds,
      isUpsell,
      quantity
    });
  }
  setupMutationObserver() {
    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "childList") continue;
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.hasAttribute("data-next-toggle-card")) {
            if (!this.cards.find((c) => c.element === node)) this.registerCard(node);
          }
          node.querySelectorAll("[data-next-toggle-card]").forEach((el) => {
            if (!this.cards.find((c) => c.element === el)) this.registerCard(el);
          });
        });
      }
    });
    this.mutationObserver.observe(this.element, { childList: true, subtree: true });
  }
  // ─── Click handler ────────────────────────────────────────────────────────────
  async handleCardClick(e, card) {
    e.preventDefault();
    const cartState = useCartStore.getState();
    const isInCart = cartState.items.some((i) => i.packageId === card.packageId);
    if (card.isSyncMode) this.updateSyncedQuantity(card, cartState);
    card.element.classList.add("next-loading");
    card.element.setAttribute("data-next-loading", "true");
    try {
      if (isInCart) {
        await useCartStore.getState().removeItem(card.packageId);
        this.emit("toggle:toggled", { packageId: card.packageId, added: false });
      } else {
        await this.addToCart(card);
        this.emit("toggle:toggled", { packageId: card.packageId, added: true });
      }
    } catch (error) {
      this.handleError(error, "handleCardClick");
    } finally {
      card.element.classList.remove("next-loading");
      card.element.setAttribute("data-next-loading", "false");
    }
  }
  async addToCart(card) {
    const allPackages = useCampaignStore.getState().data?.packages ?? [];
    const pkg = allPackages.find((p) => p.ref_id === card.packageId);
    await useCartStore.getState().addItem({
      packageId: card.packageId,
      quantity: card.quantity || 1,
      title: pkg?.name ?? `Package ${card.packageId}`,
      price: pkg ? parseFloat(pkg.price) : 0,
      isUpsell: card.isUpsell
    });
  }
  // ─── Cart sync ────────────────────────────────────────────────────────────────
  syncWithCart(cartState) {
    const selectedPackageIds = [];
    for (const card of this.cards) {
      const inCart = cartState.items.some((i) => i.packageId === card.packageId);
      card.element.classList.toggle("next-in-cart", inCart);
      card.element.classList.toggle("next-not-in-cart", !inCart);
      card.element.classList.toggle("next-selected", inCart);
      card.element.setAttribute("data-next-in-cart", String(inCart));
      card.stateContainer.setAttribute("data-in-cart", String(inCart));
      card.stateContainer.setAttribute("data-next-active", String(inCart));
      card.stateContainer.classList.toggle("next-in-cart", inCart);
      card.stateContainer.classList.toggle("next-not-in-cart", !inCart);
      card.stateContainer.classList.toggle("next-active", inCart);
      card.stateContainer.classList.toggle("os--active", inCart);
      if (card.addText && card.removeText) {
        const textSlot = card.element.querySelector("[data-next-button-text]");
        if (textSlot) {
          textSlot.textContent = inCart ? card.removeText : card.addText;
        } else if (card.element.childElementCount === 0) {
          card.element.textContent = inCart ? card.removeText : card.addText;
        }
      }
      if (inCart) {
        selectedPackageIds.push(card.packageId);
        if (cartState.summary) {
          const line = cartState.summary.lines.find((l) => l.package_id === card.packageId) ?? null;
          this.renderTogglePrice(card, line);
        }
      }
      if (card.isSyncMode) {
        void this.handleSyncUpdate(card, cartState);
      }
      if (card.isPreSelected && !inCart && !this.autoAddInProgress.has(card.packageId) && !autoAddedPackages.has(card.packageId)) {
        card.isPreSelected = false;
        autoAddedPackages.add(card.packageId);
        this.autoAddInProgress.add(card.packageId);
        if (card.isSyncMode) this.updateSyncedQuantity(card, cartState);
        void this.addToCart(card).finally(() => {
          this.autoAddInProgress.delete(card.packageId);
        });
      }
    }
    this.emit("toggle:selection-changed", { selected: selectedPackageIds });
    if (this.priceSyncDebounce !== null) clearTimeout(this.priceSyncDebounce);
    this.priceSyncDebounce = setTimeout(() => {
      this.priceSyncDebounce = null;
      const currentItems = useCartStore.getState().items;
      for (const card of this.cards) {
        if (!currentItems.some((i) => i.packageId === card.packageId)) {
          void this.fetchAndUpdateTogglePrice(card);
        }
      }
    }, 150);
  }
  // ─── Sync mode helpers ────────────────────────────────────────────────────────
  updateSyncedQuantity(card, cartState) {
    if (card.syncPackageIds.length === 0) return;
    let totalQuantity = 0;
    card.syncPackageIds.forEach((syncId) => {
      const syncedItem = cartState.items.find(
        (item) => item.packageId === syncId || item.originalPackageId === syncId
      );
      if (syncedItem) {
        const itemsPerPackage = syncedItem.qty ?? 1;
        totalQuantity += syncedItem.quantity * itemsPerPackage;
      }
    });
    card.quantity = totalQuantity;
  }
  async handleSyncUpdate(card, cartState) {
    if (!card.isSyncMode || card.syncPackageIds.length === 0) return;
    let totalSyncQuantity = 0;
    let anySyncedItemExists = false;
    card.syncPackageIds.forEach((syncId) => {
      const syncedItem = cartState.items.find(
        (item) => item.packageId === syncId || item.originalPackageId === syncId
      );
      if (syncedItem) {
        anySyncedItemExists = true;
        const itemsPerPackage = syncedItem.qty ?? 1;
        totalSyncQuantity += syncedItem.quantity * itemsPerPackage;
      }
    });
    const currentItem = cartState.items.find((item) => item.packageId === card.packageId);
    if (anySyncedItemExists && totalSyncQuantity > 0) {
      if (currentItem && currentItem.quantity !== totalSyncQuantity) {
        await useCartStore.getState().updateQuantity(card.packageId, totalSyncQuantity);
      }
    } else if (currentItem && !cartState.swapInProgress) {
      if (currentItem.is_upsell) {
        setTimeout(async () => {
          const updatedState = useCartStore.getState();
          const stillNoSyncedPackages = card.syncPackageIds.every(
            (syncId) => !updatedState.items.find(
              (item) => item.packageId === syncId || item.originalPackageId === syncId
            )
          );
          const itemStillExists = updatedState.items.find((i) => i.packageId === card.packageId);
          if (stillNoSyncedPackages && itemStillExists && !updatedState.swapInProgress) {
            await useCartStore.getState().removeItem(card.packageId);
          }
        }, 500);
      } else {
        await useCartStore.getState().removeItem(card.packageId);
      }
    }
  }
  // ─── Backend price calculation ────────────────────────────────────────────────
  async fetchAndUpdateTogglePrice(card) {
    const cartState = useCartStore.getState();
    if (cartState.items.some((i) => i.packageId === card.packageId)) {
      if (cartState.summary) {
        const line = cartState.summary.lines.find((l) => l.package_id === card.packageId) ?? null;
        this.renderTogglePrice(card, line);
      }
      return;
    }
    const priceSlots = card.element.querySelectorAll("[data-next-toggle-price]");
    if (priceSlots.length === 0) return;
    const cartItems = cartState.items.map((i) => ({ packageId: i.packageId, quantity: i.quantity }));
    const itemsToCalc = [...cartItems, { packageId: card.packageId, quantity: 1 }];
    const currency = useCampaignStore.getState().data?.currency ?? null;
    const checkoutVouchers = useCheckoutStore.getState().vouchers;
    const vouchers = checkoutVouchers.length ? checkoutVouchers : void 0;
    card.element.classList.add("next-loading");
    card.element.setAttribute("data-next-loading", "true");
    try {
      const { summary } = await calculateBundlePrice(
        itemsToCalc,
        { currency, exclude_shipping: !this.includeShipping, vouchers }
      );
      const line = summary.lines.find((l) => l.package_id === card.packageId) ?? null;
      this.renderTogglePrice(card, line);
    } catch (error) {
      this.logger.warn(`Failed to fetch toggle price for packageId ${card.packageId}`, error);
      this.renderTogglePrice(card, null);
    } finally {
      card.element.classList.remove("next-loading");
      card.element.setAttribute("data-next-loading", "false");
    }
  }
  renderTogglePrice(card, line) {
    const allPackages = useCampaignStore.getState().data?.packages ?? [];
    const pkg = allPackages.find((p) => p.ref_id === card.packageId);
    const qty = card.quantity || 1;
    const scale = (price) => {
      if (!price) return "";
      const num = parseFloat(price);
      return isNaN(num) ? "" : formatCurrency(num * qty);
    };
    card.element.querySelectorAll("[data-next-toggle-price]").forEach((el) => {
      const field = el.getAttribute("data-next-toggle-price") || "total";
      const comparePrice = line?.original_package_price ?? pkg?.price_total;
      const basePrice = line?.package_price ?? pkg?.price_total ?? "0";
      const savings = comparePrice && basePrice ? parseFloat(comparePrice) - parseFloat(basePrice) : 0;
      switch (field) {
        case "compare":
          el.textContent = scale(comparePrice);
          break;
        case "savings":
          el.textContent = savings > 0 ? formatCurrency(savings) : "";
          break;
        case "savingsPercentage": {
          el.textContent = savings > 0 && comparePrice ? `${Math.round(savings / parseFloat(comparePrice) * 100)}%` : "";
          break;
        }
        case "subtotal":
          el.textContent = line?.subtotal ?? pkg?.price_total ?? "";
          break;
        default:
          el.textContent = scale(basePrice);
          break;
      }
    });
  }
  // ─── BaseEnhancer ─────────────────────────────────────────────────────────────
  update() {
    this.syncWithCart(useCartStore.getState());
  }
  cleanupEventListeners() {
    this.clickHandlers.forEach((h, el) => el.removeEventListener("click", h));
    this.clickHandlers.clear();
    if (this.priceSyncDebounce !== null) {
      clearTimeout(this.priceSyncDebounce);
      this.priceSyncDebounce = null;
    }
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
    this.cards.forEach(
      (c) => c.element.classList.remove(
        "next-toggle-card",
        "next-in-cart",
        "next-not-in-cart",
        "next-selected",
        "next-active",
        "next-loading"
      )
    );
    this.cards = [];
    super.destroy();
  }
}
export {
  PackageToggleEnhancer
};
