import { B as BaseEnhancer } from "./index-BzlW3G0-.js";
import { u as useCampaignStore, a as useCartStore, b as useCheckoutStore, c as configStore } from "./analytics-C593VfhV.js";
import { T as TemplateRenderer, f as formatCurrency, h as calculateBundlePrice, p as preserveQueryParams } from "./utils-CJHo6zrd.js";
import { u as useOrderStore } from "./debug-DXDufq0V.js";
import { ApiClient } from "./api-CVG2Bu2L.js";
function renderToggleTemplate(template, def, logger) {
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
  const html = TemplateRenderer.render(template, { data: { toggle: toggleData } });
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  const firstChild = wrapper.firstElementChild;
  const cardEl = wrapper.querySelector("[data-next-toggle-card]") ?? (firstChild instanceof HTMLElement ? firstChild : null);
  if (!cardEl) {
    logger.warn("Toggle template produced no root element for packageId", def.packageId);
    return null;
  }
  cardEl.setAttribute("data-next-toggle-card", "");
  cardEl.setAttribute("data-next-package-id", String(def.packageId));
  if (def.selected) {
    cardEl.setAttribute("data-next-selected", "true");
  }
  return cardEl;
}
function renderToggleImage(card) {
  const slots = card.element.querySelectorAll("[data-next-toggle-image]");
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
function renderTogglePrice(card, line) {
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
      case "savingsPercentage":
        el.textContent = savings > 0 && comparePrice ? `${Math.round(savings / parseFloat(comparePrice) * 100)}%` : "";
        break;
      case "subtotal":
        el.textContent = line?.subtotal ?? pkg?.price_total ?? "";
        break;
      default:
        el.textContent = scale(basePrice);
        break;
    }
  });
}
async function fetchAndUpdateTogglePrice(card, includeShipping, logger, upsell) {
  const priceSlots = card.element.querySelectorAll("[data-next-toggle-price]");
  if (priceSlots.length === 0) return;
  const currency = useCampaignStore.getState().currency ?? null;
  let itemsToCalc;
  let vouchers;
  if (upsell) {
    itemsToCalc = [{ packageId: card.packageId, quantity: card.quantity || 1 }];
  } else {
    const cartState = useCartStore.getState();
    if (cartState.items.some((i) => i.packageId === card.packageId)) {
      if (cartState.summary) {
        const line = cartState.summary.lines.find((l) => l.package_id === card.packageId) ?? null;
        renderTogglePrice(card, line);
      }
      return;
    }
    const cartItems = cartState.items.map((i) => ({ packageId: i.packageId, quantity: i.quantity }));
    itemsToCalc = [...cartItems, { packageId: card.packageId, quantity: 1 }];
    const checkoutVouchers = useCheckoutStore.getState().vouchers;
    vouchers = checkoutVouchers.length ? checkoutVouchers : void 0;
  }
  card.element.classList.add("next-loading");
  card.element.setAttribute("data-next-loading", "true");
  try {
    const { summary } = await calculateBundlePrice(
      itemsToCalc,
      { currency, vouchers, upsell }
    );
    if (!summary) return;
    const line = summary.lines.find((l) => l.package_id === card.packageId) ?? null;
    renderTogglePrice(card, line);
  } catch (error) {
    logger.warn(`Failed to fetch toggle price for packageId ${card.packageId}`, error);
    renderTogglePrice(card, null);
  } finally {
    card.element.classList.remove("next-loading");
    card.element.setAttribute("data-next-loading", "false");
  }
}
const autoAddedPackages = /* @__PURE__ */ new Set();
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => autoAddedPackages.clear());
}
async function handleCardClick(e, card, ctx) {
  e.preventDefault();
  if (ctx.isUpsellContext) {
    await handleUpsellCardClick(card, ctx);
    return;
  }
  const cartState = useCartStore.getState();
  const isInCart = cartState.items.some((i) => i.packageId === card.packageId);
  if (card.isSyncMode) updateSyncedQuantity(card, cartState);
  card.element.classList.add("next-loading");
  card.element.setAttribute("data-next-loading", "true");
  try {
    if (isInCart) {
      await useCartStore.getState().removeItem(card.packageId);
      ctx.emit("toggle:toggled", { packageId: card.packageId, added: false });
    } else {
      await addToCart(card);
      ctx.emit("toggle:toggled", { packageId: card.packageId, added: true });
    }
  } catch (error) {
    ctx.logger.error("handleCardClick failed", error);
  } finally {
    card.element.classList.remove("next-loading");
    card.element.setAttribute("data-next-loading", "false");
  }
}
async function handleUpsellCardClick(card, ctx) {
  if (ctx.isProcessingRef.value) return;
  const orderStore = useOrderStore.getState();
  const nextUrl = resolveNextUrl(card, ctx.containerElement);
  if (!orderStore.canAddUpsells()) {
    ctx.logger.warn("Order does not support upsells at this time");
    if (nextUrl) navigatePreservingParams(nextUrl, ctx.logger);
    return;
  }
  ctx.isProcessingRef.value = true;
  card.element.classList.add("next-loading");
  card.element.setAttribute("data-next-loading", "true");
  try {
    const campaign = useCampaignStore.getState().data;
    const currency = campaign?.currency ?? configStore.getState().selectedCurrency ?? "USD";
    const apiClient = new ApiClient(configStore.getState().apiKey);
    const upsellData = {
      lines: [{ package_id: card.packageId, quantity: card.quantity || 1 }],
      currency
    };
    ctx.logger.info("Adding upsell to order from toggle:", upsellData);
    const updatedOrder = await orderStore.addUpsell(upsellData, apiClient);
    if (!updatedOrder) throw new Error("No updated order returned");
    ctx.emit("upsell:added", { packageId: card.packageId, quantity: card.quantity || 1, order: updatedOrder });
    ctx.emit("toggle:toggled", { packageId: card.packageId, added: true });
    if (nextUrl) {
      setTimeout(() => navigatePreservingParams(nextUrl, ctx.logger), 100);
    }
  } catch (error) {
    ctx.logger.error("handleUpsellCardClick failed:", error);
  } finally {
    ctx.isProcessingRef.value = false;
    card.element.classList.remove("next-loading");
    card.element.setAttribute("data-next-loading", "false");
  }
}
function resolveNextUrl(card, containerElement) {
  return card.element.getAttribute("data-next-url") ?? card.stateContainer.getAttribute("data-next-url") ?? containerElement.getAttribute("data-next-url") ?? document.querySelector('meta[name="next-upsell-accept-url"]')?.getAttribute("content") ?? void 0;
}
function navigatePreservingParams(url, logger) {
  try {
    const target = new URL(url, window.location.origin);
    const orderRefId = useOrderStore.getState().order?.ref_id;
    if (orderRefId && !target.searchParams.has("ref_id")) {
      target.searchParams.append("ref_id", orderRefId);
    }
    window.location.href = preserveQueryParams(target.href);
  } catch {
    logger.error("Invalid navigation URL:", url);
    window.location.href = preserveQueryParams(url);
  }
}
async function addToCart(card) {
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
function updateSyncedQuantity(card, cartState) {
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
async function handleSyncUpdate(card, cartState, logger) {
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
    this.isUpsellContext = false;
    this.isProcessingRef = { value: false };
  }
  async initialize() {
    this.validateElement();
    this.isUpsellContext = this.element.hasAttribute("data-next-upsell-context");
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
            const el = renderToggleTemplate(this.template, def, this.logger);
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
      renderToggleImage(card);
    }
    if (!this.isUpsellContext) {
      this.subscribe(useCartStore, this.syncWithCart.bind(this));
      this.syncWithCart(useCartStore.getState());
      let prevVouchers = useCheckoutStore.getState().vouchers;
      this.subscribe(useCheckoutStore, (state) => {
        const next = state.vouchers;
        if (next.length !== prevVouchers.length || next.some((v, i) => v !== prevVouchers[i])) {
          prevVouchers = next;
          for (const card of this.cards) {
            void fetchAndUpdateTogglePrice(card, this.includeShipping, this.logger);
          }
        }
      });
    }
    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null) clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const card of this.cards) {
          void fetchAndUpdateTogglePrice(card, this.includeShipping, this.logger, this.isUpsellContext);
        }
      }, 150);
    };
    document.addEventListener("next:currency-changed", this.boundCurrencyChangeHandler);
    for (const card of this.cards) {
      void fetchAndUpdateTogglePrice(card, this.includeShipping, this.logger, this.isUpsellContext);
    }
    this.logger.debug("PackageToggleEnhancer initialized", {
      cardCount: this.cards.length,
      isUpsellContext: this.isUpsellContext
    });
  }
  // ─── Context factory ───────────────────────────────────────────────────────
  makeHandlerContext() {
    return {
      logger: this.logger,
      emit: (e, d) => this.emit(e, d),
      autoAddInProgress: this.autoAddInProgress,
      isUpsellContext: this.isUpsellContext,
      isProcessingRef: this.isProcessingRef,
      containerElement: this.element
    };
  }
  // ─── Card registration ────────────────────────────────────────────────────
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
    const card = {
      element: el,
      packageId,
      isPreSelected,
      quantity,
      isSyncMode,
      syncPackageIds,
      isUpsell,
      stateContainer,
      addText: el.getAttribute("data-add-text"),
      removeText: el.getAttribute("data-remove-text")
    };
    this.cards.push(card);
    el.classList.add("next-toggle-card");
    const ctx = this.makeHandlerContext();
    const handler = (e) => void handleCardClick(e, card, ctx);
    this.clickHandlers.set(el, handler);
    el.addEventListener("click", handler);
    this.logger.debug(`Registered toggle card for packageId ${packageId}`, {
      isSyncMode,
      syncPackageIds,
      isUpsell,
      quantity
    });
  }
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
  // ─── Mutation observer ────────────────────────────────────────────────────
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
  // ─── Cart sync ────────────────────────────────────────────────────────────
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
          renderTogglePrice(card, line);
        }
      }
      if (card.isSyncMode) {
        void handleSyncUpdate(card, cartState);
      }
      if (card.isPreSelected && !inCart && !this.autoAddInProgress.has(card.packageId) && !autoAddedPackages.has(card.packageId)) {
        card.isPreSelected = false;
        autoAddedPackages.add(card.packageId);
        this.autoAddInProgress.add(card.packageId);
        if (card.isSyncMode) updateSyncedQuantity(card, cartState);
        void addToCart(card).finally(() => {
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
          void fetchAndUpdateTogglePrice(card, this.includeShipping, this.logger);
        }
      }
    }, 150);
  }
  // ─── BaseEnhancer ─────────────────────────────────────────────────────────
  update() {
    if (!this.isUpsellContext) this.syncWithCart(useCartStore.getState());
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
