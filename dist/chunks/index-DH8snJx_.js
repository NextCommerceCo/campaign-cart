import { B as BaseEnhancer } from "./BaseEnhancer-BihRvFrW.js";
import { u as useCampaignStore, a as useCartStore, b as useCheckoutStore, c as configStore } from "./analytics-BHJjHc1E.js";
import { D as Decimal } from "./vendor-BvX3PoQU.js";
import { T as TemplateRenderer, g as renderFlatDiscountContainers, f as formatCurrency, e as formatPercentage, i as calculateBundlePrice, p as preserveQueryParams } from "./utils-R5pRn2AT.js";
import { u as useOrderStore } from "./debug-DA8wFB-u.js";
import { ApiClient } from "./api-BKmaU79g.js";
import { B as BaseDisplayEnhancer } from "./DisplayEnhancerCore-Clknd-vI.js";
function makeTogglePackageState(pkg) {
  return {
    packageId: pkg.ref_id,
    name: pkg.name || "",
    image: pkg.image || "",
    quantity: pkg.qty,
    productId: pkg.product_id ?? null,
    variantId: pkg.product_variant_id ?? null,
    variantName: pkg.product_variant_name || "",
    productName: pkg.product_name || "",
    sku: pkg.product_sku ?? null,
    isRecurring: pkg.is_recurring,
    interval: pkg.interval ?? null,
    intervalCount: pkg.interval_count ?? null
  };
}
function buildFrequency(pkg) {
  if (!pkg.is_recurring) return "One time";
  if (pkg.interval_count != null && pkg.interval_count > 1) {
    return `Every ${pkg.interval_count} ${pkg.interval}s`;
  }
  return `Per ${pkg.interval}`;
}
function makeTogglePriceSummary(pkg) {
  return {
    price: parseFloat(pkg.price_total || "0"),
    unitPrice: parseFloat(pkg.price || "0"),
    originalPrice: null,
    originalUnitPrice: null,
    discountAmount: 0,
    discountPercentage: 0,
    hasDiscount: false,
    currency: useCampaignStore.getState().currency ?? "",
    isRecurring: pkg.is_recurring,
    recurringPrice: pkg.price_recurring_total != null ? parseFloat(pkg.price_recurring_total) : null,
    interval: pkg.interval ?? null,
    intervalCount: pkg.interval_count ?? null,
    frequency: buildFrequency(pkg)
  };
}
function buildToggleVars(def, pkgState) {
  const vars = {};
  for (const [key, value] of Object.entries(def)) {
    vars[key] = value != null ? String(value) : "";
  }
  vars["packageId"] ?? (vars["packageId"] = String(pkgState.packageId));
  vars["name"] ?? (vars["name"] = pkgState.name);
  vars["image"] ?? (vars["image"] = pkgState.image);
  vars["quantity"] ?? (vars["quantity"] = String(pkgState.quantity));
  vars["productId"] ?? (vars["productId"] = pkgState.productId != null ? String(pkgState.productId) : "");
  vars["variantId"] ?? (vars["variantId"] = pkgState.variantId != null ? String(pkgState.variantId) : "");
  vars["variantName"] ?? (vars["variantName"] = pkgState.variantName);
  vars["productName"] ?? (vars["productName"] = pkgState.productName);
  vars["sku"] ?? (vars["sku"] = pkgState.sku ?? "");
  vars["isRecurring"] ?? (vars["isRecurring"] = String(pkgState.isRecurring));
  vars["interval"] ?? (vars["interval"] = pkgState.interval ?? "");
  vars["intervalCount"] ?? (vars["intervalCount"] = pkgState.intervalCount != null ? String(pkgState.intervalCount) : "");
  vars["frequency"] ?? (vars["frequency"] = pkgState.isRecurring ? pkgState.intervalCount != null && pkgState.intervalCount > 1 ? `Every ${pkgState.intervalCount} ${pkgState.interval}s` : `Per ${pkgState.interval}` : "One time");
  return vars;
}
function renderToggleTemplate(template, def, logger) {
  const allPackages = useCampaignStore.getState().data?.packages ?? [];
  const pkg = allPackages.find((p) => p.ref_id === def.packageId);
  if (!pkg) {
    logger.warn("No campaign package found for packageId", def.packageId);
    return null;
  }
  const toggleData = buildToggleVars(def, makeTogglePackageState(pkg));
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
function applyToggleField(el, field, data) {
  const { togglePrice: tp, isSelected, name } = data;
  const currency = tp.currency || void 0;
  switch (field) {
    case "price":
      el.textContent = formatCurrency(tp.price, currency);
      break;
    case "originalPrice":
      el.textContent = tp.originalPrice != null ? formatCurrency(tp.originalPrice, currency) : "";
      break;
    case "unitPrice":
      el.textContent = formatCurrency(tp.unitPrice, currency);
      break;
    case "originalUnitPrice":
      el.textContent = tp.originalUnitPrice != null ? formatCurrency(tp.originalUnitPrice, currency) : "";
      break;
    case "discountAmount":
      el.textContent = tp.hasDiscount ? formatCurrency(tp.discountAmount, currency) : "";
      break;
    case "discountPercentage":
      el.textContent = formatPercentage(tp.discountPercentage);
      break;
    case "hasDiscount":
      el.style.display = tp.hasDiscount ? "" : "none";
      break;
    case "isSelected":
      el.style.display = isSelected ? "" : "none";
      break;
    case "isRecurring":
      el.style.display = tp.isRecurring ? "" : "none";
      break;
    case "recurringPrice":
      el.textContent = tp.recurringPrice != null ? formatCurrency(tp.recurringPrice, currency) : "";
      break;
    case "interval":
      el.textContent = tp.interval ?? "";
      break;
    case "intervalCount":
      el.textContent = tp.intervalCount != null ? String(tp.intervalCount) : "";
      break;
    case "frequency":
      el.textContent = tp.frequency;
      break;
    case "name":
      el.textContent = name;
      break;
    case "currency":
      el.textContent = tp.currency;
      break;
  }
}
function updateCardDisplayElements(card) {
  const tp = card.togglePrice;
  if (!tp) return;
  const isSelected = card.isSelected;
  const fieldData = {
    togglePrice: tp,
    isSelected,
    name: card.name
  };
  card.element.querySelectorAll("[data-next-toggle-display]").forEach((el) => {
    const field = el.getAttribute("data-next-toggle-display") || "price";
    applyToggleField(el, field, fieldData);
  });
  card.element.querySelectorAll("[data-next-toggle-price]").forEach((el) => {
    const field = el.getAttribute("data-next-toggle-price") || "price";
    applyToggleField(el, field, fieldData);
  });
  renderFlatDiscountContainers(card.element, card.discounts);
  card.element.dispatchEvent(
    new CustomEvent("toggle:price-updated", {
      bubbles: true,
      detail: { packageId: card.packageId }
    })
  );
}
function renderTogglePrice(card, line) {
  const allPackages = useCampaignStore.getState().data?.packages ?? [];
  const pkg = allPackages.find((p) => p.ref_id === card.packageId);
  const price = new Decimal(line.total);
  const unitPrice = new Decimal(line.package_price);
  const originalPrice = new Decimal(line.subtotal);
  const originalUnitPrice = new Decimal(line.original_package_price);
  const discountAmount = new Decimal(line.total_discount);
  const recurringPrice = line.price_recurring_total != null ? new Decimal(line.price_recurring_total) : null;
  const hasDiscount = discountAmount.gt(0);
  const discountPercentage = hasDiscount && originalPrice.gt(0) ? discountAmount.div(originalPrice).times(100) : new Decimal(0);
  const currency = useCampaignStore.getState().currency ?? "";
  const isRecurring = pkg?.is_recurring ?? false;
  const interval = pkg?.interval ?? null;
  const intervalCount = pkg?.interval_count ?? null;
  const frequency = isRecurring ? intervalCount != null && intervalCount > 1 ? `Every ${intervalCount} ${interval}s` : `Per ${interval}` : "One time";
  card.togglePrice = {
    price: price.toNumber(),
    unitPrice: unitPrice.toNumber(),
    originalPrice: originalPrice.toNumber(),
    originalUnitPrice: originalUnitPrice.toNumber(),
    discountAmount: hasDiscount ? discountAmount.toNumber() : 0,
    discountPercentage: discountPercentage.toNumber(),
    hasDiscount,
    currency,
    isRecurring,
    recurringPrice: recurringPrice?.toNumber() ?? null,
    interval,
    intervalCount,
    frequency
  };
  card.discounts = line.discounts ?? [];
  updateCardDisplayElements(card);
}
async function fetchAndUpdateTogglePrice(card, includeShipping, logger, upsell) {
  const currency = useCampaignStore.getState().currency ?? null;
  let itemsToCalc;
  let vouchers;
  if (upsell) {
    itemsToCalc = [{ packageId: card.packageId, quantity: card.quantity || 1 }];
  } else {
    const cartState = useCartStore.getState();
    if (cartState.items.some((i) => i.packageId === card.packageId)) {
      if (cartState.summary) {
        const line = cartState.summary.lines.find((l) => l.package_id === card.packageId);
        if (line) renderTogglePrice(card, line);
      }
      return;
    }
    const cartItems = cartState.items.map((i) => ({ packageId: i.packageId, quantity: i.quantity }));
    itemsToCalc = [...cartItems, { packageId: card.packageId, quantity: card.quantity || 1 }];
    const checkoutVouchers = useCheckoutStore.getState().vouchers;
    vouchers = checkoutVouchers.length ? checkoutVouchers : void 0;
  }
  card.element.classList.add("next-loading");
  card.element.setAttribute("data-next-loading", "true");
  try {
    const { summary } = await calculateBundlePrice(
      itemsToCalc,
      { currency, exclude_shipping: !includeShipping, vouchers, upsell }
    );
    if (!summary) return;
    const line = summary.lines.find((l) => l.package_id === card.packageId);
    if (line) renderTogglePrice(card, line);
  } catch (error) {
    logger.warn(`Failed to fetch toggle price for packageId ${card.packageId}`, error);
    updateCardDisplayElements(card);
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
  const allPackages = useCampaignStore.getState().packages;
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
const _PackageToggleEnhancer = class _PackageToggleEnhancer extends BaseEnhancer {
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
  /**
   * Returns display state for a toggle card by packageId, for use by
   * PackageToggleDisplayEnhancer via toggle.{packageId}.{property} paths.
   */
  static getToggleState(packageId) {
    for (const inst of _PackageToggleEnhancer._instances) {
      const card = inst.cards.find((c) => c.packageId === packageId);
      if (card) {
        return {
          name: card.name,
          isSelected: card.isSelected,
          togglePrice: card.togglePrice
        };
      }
    }
    return null;
  }
  async initialize() {
    _PackageToggleEnhancer._instances.add(this);
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
    const pkg = (useCampaignStore.getState().data?.packages ?? []).find(
      (p) => p.ref_id === packageId
    );
    const card = {
      element: el,
      packageId,
      name: pkg?.name ?? "",
      isPreSelected,
      isSelected: false,
      quantity,
      isSyncMode,
      syncPackageIds,
      isUpsell,
      stateContainer,
      addText: el.getAttribute("data-add-text"),
      removeText: el.getAttribute("data-remove-text"),
      togglePrice: pkg ? makeTogglePriceSummary(pkg) : null,
      discounts: []
    };
    this.cards.push(card);
    el.classList.add("next-toggle-card");
    updateCardDisplayElements(card);
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
      card.isSelected = inCart;
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
          const line = cartState.summary.lines.find((l) => l.package_id === card.packageId);
          if (line) renderTogglePrice(card, line);
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
    _PackageToggleEnhancer._instances.delete(this);
    super.destroy();
    this.cleanupEventListeners();
    this.cards.forEach((c) => {
      c.element.classList.remove(
        "next-toggle-card",
        "next-in-cart",
        "next-not-in-cart",
        "next-selected",
        "next-active",
        "next-loading"
      );
      if (c.stateContainer !== c.element) {
        c.stateContainer.classList.remove("next-in-cart", "next-not-in-cart", "next-active", "os--active");
        c.stateContainer.removeAttribute("data-in-cart");
        c.stateContainer.removeAttribute("data-next-active");
      }
    });
    this.cards = [];
  }
};
_PackageToggleEnhancer._instances = /* @__PURE__ */ new Set();
let PackageToggleEnhancer = _PackageToggleEnhancer;
const FORMAT_MAP = {
  isSelected: "boolean",
  hasDiscount: "boolean",
  isRecurring: "boolean",
  name: "text",
  price: "currency",
  unitPrice: "currency",
  originalPrice: "currency",
  originalUnitPrice: "currency",
  discountAmount: "currency",
  discountPercentage: "percentage",
  recurringPrice: "currency",
  currency: "text",
  interval: "text",
  intervalCount: "auto",
  frequency: "text"
};
class PackageToggleDisplayEnhancer extends BaseDisplayEnhancer {
  constructor() {
    super(...arguments);
    this.selectionHandler = null;
    this.priceHandler = null;
  }
  parseDisplayAttributes() {
    super.parseDisplayAttributes();
    const parts = this.displayPath.split(".");
    if (parts.length >= 3 && parts[0] === "toggle") {
      const id = parseInt(parts[1], 10);
      this.packageId = isNaN(id) ? void 0 : id;
      this.property = parts.slice(2).join(".");
    }
  }
  setupStoreSubscriptions() {
    this.selectionHandler = () => void this.updateDisplay();
    document.addEventListener("toggle:selection-changed", this.selectionHandler);
    this.priceHandler = (e) => {
      const { packageId } = e.detail;
      if (packageId === this.packageId) void this.updateDisplay();
    };
    document.addEventListener("toggle:price-updated", this.priceHandler);
  }
  getPropertyValue() {
    if (this.packageId === void 0 || !this.property) return void 0;
    const state = PackageToggleEnhancer.getToggleState(this.packageId);
    if (!state) return void 0;
    switch (this.property) {
      case "isSelected":
        return state.isSelected;
      case "name":
        return state.name;
      case "price":
        return state.togglePrice?.price;
      case "unitPrice":
        return state.togglePrice?.unitPrice;
      case "originalPrice":
        return state.togglePrice?.originalPrice ?? void 0;
      case "originalUnitPrice":
        return state.togglePrice?.originalUnitPrice ?? void 0;
      case "discountAmount":
        return state.togglePrice?.discountAmount;
      case "discountPercentage":
        return state.togglePrice?.discountPercentage;
      case "hasDiscount":
        return state.togglePrice?.hasDiscount ?? false;
      case "isRecurring":
        return state.togglePrice?.isRecurring ?? false;
      case "recurringPrice":
        return state.togglePrice?.recurringPrice ?? void 0;
      case "interval":
        return state.togglePrice?.interval ?? void 0;
      case "intervalCount":
        return state.togglePrice?.intervalCount ?? void 0;
      case "frequency":
        return state.togglePrice?.frequency;
      case "currency":
        return state.togglePrice?.currency;
      default:
        this.logger.warn(`Unknown toggle display property: "${this.property}"`);
        return void 0;
    }
  }
  getDefaultFormatType(property) {
    return FORMAT_MAP[property] ?? "auto";
  }
  destroy() {
    super.destroy();
    if (this.selectionHandler) {
      document.removeEventListener("toggle:selection-changed", this.selectionHandler);
      this.selectionHandler = null;
    }
    if (this.priceHandler) {
      document.removeEventListener("toggle:price-updated", this.priceHandler);
      this.priceHandler = null;
    }
  }
}
export {
  PackageToggleDisplayEnhancer,
  PackageToggleEnhancer
};
