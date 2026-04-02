import { B as BaseEnhancer } from "./BaseEnhancer-OPe2ofes.js";
import { u as useOrderStore } from "./debug-DqxJx4_y.js";
import { u as useCampaignStore, c as configStore } from "./analytics-D4CaGccD.js";
import { ApiClient } from "./api-DlmXqspz.js";
import { L as LoadingOverlay } from "./LoadingOverlay-DOjYiQnB.js";
import { G as GeneralModal } from "./GeneralModal-Cuk4sJCc.js";
import { p as preserveQueryParams } from "./utils-CMIpev9P.js";
function renderQuantityDisplay(element, selectorId, quantityMap, fallbackQty) {
  if (selectorId && quantityMap.has(selectorId)) {
    const qty = quantityMap.get(selectorId);
    document.querySelectorAll(
      `[data-next-upsell-quantity="display"][data-next-quantity-selector-id="${selectorId}"]`
    ).forEach((el) => {
      if (el instanceof HTMLElement) el.textContent = qty.toString();
    });
    const local = element.querySelector(
      '[data-next-upsell-quantity="display"]:not([data-next-quantity-selector-id])'
    );
    if (local instanceof HTMLElement) local.textContent = qty.toString();
  } else {
    const display = element.querySelector('[data-next-upsell-quantity="display"]');
    if (display) display.textContent = fallbackQty.toString();
  }
}
function renderQuantityToggles(element, qty) {
  element.querySelectorAll("[data-next-upsell-quantity-toggle]").forEach((toggle) => {
    if (!(toggle instanceof HTMLElement)) return;
    const toggleQty = parseInt(
      toggle.getAttribute("data-next-upsell-quantity-toggle") ?? "1",
      10
    );
    toggle.classList.toggle("next-selected", toggleQty === qty);
  });
}
function syncOptionSelectionAcrossContainers(selectorId, selectedPackageId) {
  document.querySelectorAll(`[data-next-selector-id="${selectorId}"]`).forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.querySelectorAll("[data-next-upsell-option]").forEach((option) => {
      if (!(option instanceof HTMLElement)) return;
      const pkgId = parseInt(option.getAttribute("data-next-package-id") ?? "0", 10);
      const isSelected = pkgId === selectedPackageId;
      option.classList.toggle("next-selected", isSelected);
      option.setAttribute("data-next-selected", isSelected.toString());
    });
    const select = el.querySelector("select");
    if (select) select.value = selectedPackageId.toString();
  });
}
function syncQuantityAcrossContainers(selectorId, packageId, quantityMap, fallbackQty) {
  if (selectorId) {
    const qty = quantityMap.get(selectorId);
    if (!qty) return;
    document.querySelectorAll(`[data-next-selector-id="${selectorId}"] [data-next-upsell-option]`).forEach((option) => {
      if (option instanceof HTMLElement)
        option.setAttribute("data-next-quantity", qty.toString());
    });
    document.querySelectorAll(`[data-next-upsell-select="${selectorId}"]`).forEach((select) => {
      if (!(select instanceof HTMLSelectElement)) return;
      select.querySelectorAll("option[data-next-package-id]").forEach((opt) => {
        if (opt instanceof HTMLOptionElement)
          opt.setAttribute("data-next-quantity", qty.toString());
      });
    });
  } else if (packageId !== void 0) {
    document.querySelectorAll(
      `[data-next-upsell][data-next-package-id="${packageId}"]:not([data-next-selector-id])`
    ).forEach((container) => {
      if (!(container instanceof HTMLElement)) return;
      const display = container.querySelector('[data-next-upsell-quantity="display"]');
      if (display instanceof HTMLElement) display.textContent = fallbackQty.toString();
    });
  }
}
function renderProcessingState(element, buttons, processing) {
  element.classList.toggle("next-processing", processing);
  buttons.forEach((btn) => {
    if (btn instanceof HTMLButtonElement) btn.disabled = processing;
    btn.classList.toggle("next-disabled", processing);
  });
}
function showUpsellOffer(element) {
  element.classList.remove("next-hidden", "next-error");
  element.classList.add("next-available");
}
function hideUpsellOffer(element) {
  element.classList.add("next-hidden");
  element.classList.remove("next-available");
}
function renderSuccess(element) {
  element.classList.add("next-success");
  setTimeout(() => element.classList.remove("next-success"), 3e3);
}
function renderError(element, message, logger) {
  element.classList.add("next-error");
  element.classList.remove("next-processing");
  logger.error("Upsell error:", message);
  setTimeout(() => element.classList.remove("next-error"), 5e3);
}
let pageViewTracked = false;
let trackedPagePath = null;
function getCurrency() {
  const campaign = useCampaignStore.getState();
  if (campaign?.currency) return campaign.currency;
  const config = configStore.getState();
  return config?.selectedCurrency ?? config?.detectedCurrency ?? "USD";
}
function checkIfUpsellAlreadyAccepted(packageId) {
  const store = useOrderStore.getState();
  return store.completedUpsells.includes(packageId.toString()) || store.upsellJourney.some(
    (e) => e.packageId === packageId.toString() && e.action === "accepted"
  );
}
async function showDuplicateUpsellDialog(logger) {
  const result = await GeneralModal.showDuplicateUpsell();
  logger.info(
    result ? "User confirmed to add duplicate upsell" : "User declined to add duplicate upsell"
  );
  return result;
}
function navigateToUrl(url, refId, logger) {
  if (!url) {
    logger.warn("No URL provided for navigation");
    return;
  }
  try {
    const targetUrl = new URL(url, window.location.origin);
    const orderRefId = refId ?? useOrderStore.getState().order?.ref_id;
    if (orderRefId && !targetUrl.searchParams.has("ref_id")) {
      targetUrl.searchParams.append("ref_id", orderRefId);
    }
    const finalUrl = preserveQueryParams(targetUrl.href);
    logger.info(`Navigating to ${finalUrl}`);
    window.location.href = finalUrl;
  } catch (error) {
    logger.error("Invalid URL for navigation:", url, error);
    window.location.href = preserveQueryParams(url);
  }
}
function trackUpsellPageView(logger, emit) {
  const meta = document.querySelector('meta[name="next-page-type"]');
  if (!meta || meta.getAttribute("content") !== "upsell") return;
  const pagePath = window.location.pathname;
  if (pageViewTracked && trackedPagePath === pagePath) return;
  pageViewTracked = true;
  trackedPagePath = pagePath;
  const orderStore = useOrderStore.getState();
  if (orderStore.order) {
    orderStore.markUpsellPageViewed(pagePath);
    logger.debug("Tracked upsell page view:", pagePath);
    emit("upsell:viewed", { pagePath, orderId: orderStore.order.ref_id });
  }
}
async function addUpsellToOrder(nextUrl, ctx) {
  const orderStore = useOrderStore.getState();
  ctx.logger.debug("Order state check:", {
    hasOrder: !!orderStore.order,
    supportsUpsells: orderStore.order?.supports_post_purchase_upsells,
    isProcessingUpsell: orderStore.isProcessingUpsell,
    canAddUpsells: orderStore.canAddUpsells()
  });
  if (!orderStore.canAddUpsells()) {
    ctx.logger.warn("Order does not support upsells or is currently processing");
    if (orderStore.isProcessingUpsell && orderStore.order?.supports_post_purchase_upsells) {
      ctx.logger.warn("Processing flag stuck, resetting...");
      orderStore.setProcessingUpsell(false);
    }
    if (!orderStore.canAddUpsells()) {
      renderError(ctx.element, "Unable to add upsell at this time", ctx.logger);
      if (nextUrl) setTimeout(() => navigateToUrl(nextUrl, void 0, ctx.logger), 1e3);
      return;
    }
  }
  const packageToAdd = ctx.isSelector ? ctx.selectedPackageId ?? ctx.packageId : ctx.packageId;
  if (packageToAdd && checkIfUpsellAlreadyAccepted(packageToAdd)) {
    const proceed = await showDuplicateUpsellDialog(ctx.logger);
    if (!proceed) {
      if (nextUrl) navigateToUrl(nextUrl, void 0, ctx.logger);
      return;
    }
  }
  ctx.logger.debug("Package selection:", {
    isSelector: ctx.isSelector,
    packageId: ctx.packageId,
    selectedPackageId: ctx.selectedPackageId,
    packageToAdd
  });
  if (!packageToAdd && !ctx.bundleItems?.length) {
    ctx.logger.warn("No package selected for upsell");
    renderError(ctx.element, "Please select an option first", ctx.logger);
    return;
  }
  try {
    ctx.isProcessingRef.value = true;
    renderProcessingState(ctx.element, ctx.actionButtons, true);
    ctx.loadingOverlay.show();
    ctx.emit("upsell:adding", { packageId: packageToAdd ?? 0 });
    let quantityToUse = ctx.quantity;
    if (ctx.selectorId && ctx.quantityBySelectorId.has(ctx.selectorId)) {
      quantityToUse = ctx.quantityBySelectorId.get(ctx.selectorId);
    } else if (ctx.currentQuantitySelectorId && ctx.quantityBySelectorId.has(ctx.currentQuantitySelectorId)) {
      quantityToUse = ctx.quantityBySelectorId.get(ctx.currentQuantitySelectorId);
    }
    const upsellData = ctx.bundleItems?.length ? {
      lines: ctx.bundleItems.map((i) => ({ package_id: i.packageId, quantity: i.quantity })),
      currency: getCurrency(),
      ...ctx.bundleVouchers?.length ? { vouchers: ctx.bundleVouchers } : {}
    } : {
      lines: [{ package_id: packageToAdd, quantity: quantityToUse }],
      currency: getCurrency()
    };
    ctx.logger.info("Adding upsell to order:", upsellData);
    const updatedOrder = await orderStore.addUpsell(upsellData, ctx.apiClient);
    if (!updatedOrder) throw new Error("Failed to add upsell - no updated order returned");
    ctx.logger.info("Upsell added successfully");
    renderSuccess(ctx.element);
    let upsellValue = 0;
    const prevLineIds = orderStore.order?.lines?.map((l) => l.id) ?? [];
    const addedLine = updatedOrder.lines?.find(
      (l) => l.is_upsell && !prevLineIds.includes(l.id)
    );
    if (addedLine?.price_incl_tax) upsellValue = parseFloat(addedLine.price_incl_tax);
    const resolvedPackageId = packageToAdd ?? ctx.bundleItems?.[0]?.packageId;
    const pkgData = resolvedPackageId != null ? useCampaignStore.getState().getPackage(resolvedPackageId) : void 0;
    if (pkgData && !upsellValue && pkgData.price) {
      upsellValue = parseFloat(pkgData.price) * ctx.quantity;
    }
    ctx.emit("upsell:added", {
      packageId: packageToAdd ?? 0,
      quantity: quantityToUse,
      order: updatedOrder,
      value: upsellValue,
      willRedirect: !!nextUrl
    });
    if (nextUrl) {
      setTimeout(() => navigateToUrl(nextUrl, updatedOrder.ref_id, ctx.logger), 100);
    } else {
      ctx.loadingOverlay.hide();
    }
  } catch (error) {
    ctx.logger.error("Failed to add upsell:", error);
    renderError(
      ctx.element,
      error instanceof Error ? error.message : "Failed to add upsell",
      ctx.logger
    );
    ctx.emit("upsell:error", {
      packageId: ctx.packageId ?? 0,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    ctx.loadingOverlay.hide(true);
    if (nextUrl) {
      ctx.logger.info("Navigating to next page despite API error");
      setTimeout(() => navigateToUrl(nextUrl, void 0, ctx.logger), 1e3);
    }
  } finally {
    ctx.isProcessingRef.value = false;
    renderProcessingState(ctx.element, ctx.actionButtons, false);
  }
}
function skipUpsell(nextUrl, ctx) {
  ctx.logger.info("Upsell skipped by user");
  ctx.element.classList.add("next-skipped");
  ctx.actionButtons.forEach((btn) => {
    if (btn instanceof HTMLButtonElement) btn.disabled = true;
    btn.classList.add("next-disabled");
  });
  if (ctx.packageId !== void 0) {
    useOrderStore.getState().markUpsellSkipped(ctx.packageId.toString(), ctx.currentPagePath);
  }
  const eventData = {};
  if (ctx.packageId !== void 0) eventData.packageId = ctx.packageId;
  const refId = useOrderStore.getState().order?.ref_id;
  if (refId !== void 0) eventData.orderId = refId;
  ctx.emit("upsell:skipped", eventData);
  if (nextUrl) navigateToUrl(nextUrl, void 0, ctx.logger);
}
async function handleActionClick(event, ctx) {
  event.preventDefault();
  if (ctx.isProcessingRef.value) {
    ctx.logger.debug("Upsell action blocked - already processing");
    return;
  }
  const button = event.currentTarget;
  const action = button.getAttribute("data-next-upsell-action") ?? "";
  let nextUrl = button.getAttribute("data-next-url") ?? button.getAttribute("data-next-next-url") ?? button.getAttribute("data-os-next-url") ?? void 0;
  if (!nextUrl) {
    const metaName = action === "add" || action === "accept" ? "next-upsell-accept-url" : action === "skip" || action === "decline" ? "next-upsell-decline-url" : null;
    if (metaName) {
      nextUrl = document.querySelector(`meta[name="${metaName}"]`)?.getAttribute("content") ?? void 0;
      if (nextUrl) ctx.logger.debug("Using fallback URL from meta tag:", nextUrl);
    }
  }
  ctx.logger.debug("Upsell action clicked:", { action, nextUrl });
  switch (action) {
    case "add":
    case "accept":
      await addUpsellToOrder(nextUrl, ctx);
      break;
    case "skip":
    case "decline":
      skipUpsell(nextUrl, ctx);
      break;
    default:
      ctx.logger.warn(`Unknown upsell action: ${action}`);
  }
}
class UpsellEnhancer extends BaseEnhancer {
  constructor(element) {
    super(element);
    this.quantity = 1;
    this.actionButtons = [];
    this.isProcessingRef = { value: false };
    this.isSelector = false;
    this.options = /* @__PURE__ */ new Map();
    this.quantityBySelectorId = /* @__PURE__ */ new Map();
    this.loadingOverlay = new LoadingOverlay();
  }
  async initialize() {
    this.validateElement();
    this.setupPageShowHandler();
    setTimeout(
      () => trackUpsellPageView(this.logger, (e, d) => this.emit(e, d)),
      100
    );
    this.selectorId = this.getAttribute("data-next-selector-id") ?? void 0;
    const childBundleSelector = this.element.querySelector("[data-next-bundle-selector]");
    this.bundleSelectorId = childBundleSelector?.getAttribute("data-next-selector-id") ?? this.getAttribute("data-next-bundle-selector-id") ?? void 0;
    const childPackageSelector = this.element.querySelector("[data-next-package-selector]");
    this.packageSelectorId = childPackageSelector?.getAttribute("data-next-selector-id") ?? this.getAttribute("data-next-package-selector-id") ?? void 0;
    this.isSelector = !!this.selectorId || !!this.packageSelectorId || !!this.bundleSelectorId;
    if (this.isSelector) {
      this.initializeSelectorMode();
    } else {
      const packageIdAttr = this.getAttribute("data-next-package-id");
      if (!packageIdAttr) {
        throw new Error(
          "UpsellEnhancer requires data-next-package-id (or selector mode with data-next-selector-id)"
        );
      }
      this.packageId = parseInt(packageIdAttr, 10);
      if (isNaN(this.packageId)) throw new Error("Invalid package ID provided");
      const orderStore = useOrderStore.getState();
      if (orderStore.order) orderStore.markUpsellViewed(this.packageId.toString());
    }
    const quantityAttr = this.getAttribute("data-next-quantity");
    if (quantityAttr) this.quantity = parseInt(quantityAttr, 10) || 1;
    const config = configStore.getState();
    this.apiClient = new ApiClient(config.apiKey);
    this.scanUpsellElements();
    this.setupEventHandlers();
    this.subscribe(useOrderStore, (state) => this.handleOrderUpdate(state));
    this.on("upsell:quantity-changed", (data) => this.onQuantityChanged(data));
    this.on("upsell:option-selected", (data) => this.onOptionSelected(data));
    this.updateUpsellDisplay();
    this.logger.debug("UpsellEnhancer initialized", {
      mode: this.isSelector ? "selector" : "direct",
      packageId: this.packageId,
      selectorId: this.selectorId,
      quantity: this.quantity,
      actionButtons: this.actionButtons.length,
      options: this.options.size
    });
    this.emit("upsell:initialized", { packageId: this.packageId ?? 0, element: this.element });
  }
  setupPageShowHandler() {
    this.pageShowHandler = (event) => {
      if (event.persisted) {
        this.loadingOverlay.hide(true);
        this.isProcessingRef.value = false;
        renderProcessingState(this.element, this.actionButtons, false);
      }
    };
    window.addEventListener("pageshow", this.pageShowHandler);
  }
  initializeSelectorMode() {
    if (this.selectorId && !this.quantityBySelectorId.has(this.selectorId)) {
      this.quantityBySelectorId.set(this.selectorId, this.quantity);
    }
    this.element.querySelectorAll("[data-next-upsell-option]").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const pkgId = parseInt(el.getAttribute("data-next-package-id") ?? "", 10);
      if (isNaN(pkgId)) return;
      this.options.set(pkgId, el);
      el.addEventListener("click", () => this.selectOption(pkgId));
      if (el.getAttribute("data-next-selected") === "true") this.selectOption(pkgId);
    });
    const selectEl = this.element.tagName === "SELECT" ? this.element : this.element.querySelector(
      `[data-next-upsell-select="${this.selectorId}"]`
    );
    if (selectEl) {
      selectEl.addEventListener("change", () => {
        if (selectEl.value) {
          const pkgId = parseInt(selectEl.value, 10);
          if (!isNaN(pkgId)) this.selectOption(pkgId);
        } else {
          this.selectedPackageId = void 0;
          this.packageId = void 0;
        }
      });
      if (selectEl.value) {
        const pkgId = parseInt(selectEl.value, 10);
        if (!isNaN(pkgId)) this.selectOption(pkgId);
      }
    }
  }
  scanUpsellElements() {
    this.element.querySelectorAll("[data-next-upsell-action]").forEach((el) => {
      if (el instanceof HTMLElement) this.actionButtons.push(el);
    });
    const incBtn = this.element.querySelector('[data-next-upsell-quantity="increase"]');
    const decBtn = this.element.querySelector('[data-next-upsell-quantity="decrease"]');
    const qtySelectorId = incBtn?.getAttribute("data-next-quantity-selector-id") ?? decBtn?.getAttribute("data-next-quantity-selector-id") ?? this.selectorId;
    incBtn?.addEventListener("click", () => this.adjustQuantity(1, qtySelectorId));
    decBtn?.addEventListener("click", () => this.adjustQuantity(-1, qtySelectorId));
    this.element.querySelectorAll("[data-next-upsell-quantity-toggle]").forEach((toggle) => {
      if (!(toggle instanceof HTMLElement)) return;
      const qty = parseInt(toggle.getAttribute("data-next-upsell-quantity-toggle") ?? "1", 10);
      toggle.addEventListener("click", () => {
        this.quantity = qty;
        renderQuantityDisplay(this.element, this.selectorId, this.quantityBySelectorId, qty);
        renderQuantityToggles(this.element, qty);
        this.emit("upsell:quantity-changed", {
          selectorId: this.selectorId,
          quantity: qty,
          packageId: this.packageId
        });
      });
      if (qty === this.quantity) toggle.classList.add("next-selected");
    });
  }
  adjustQuantity(delta, qtySelectorId) {
    if (qtySelectorId) {
      const next = Math.min(10, Math.max(1, (this.quantityBySelectorId.get(qtySelectorId) ?? 1) + delta));
      this.quantityBySelectorId.set(qtySelectorId, next);
      this.currentQuantitySelectorId = qtySelectorId;
      this.emit("upsell:quantity-changed", { selectorId: qtySelectorId, quantity: next, packageId: this.packageId });
    } else {
      this.quantity = Math.min(10, Math.max(1, this.quantity + delta));
      this.emit("upsell:quantity-changed", { quantity: this.quantity, packageId: this.packageId });
    }
    renderQuantityDisplay(this.element, qtySelectorId ?? this.selectorId, this.quantityBySelectorId, this.quantity);
    syncQuantityAcrossContainers(qtySelectorId, this.packageId, this.quantityBySelectorId, this.quantity);
  }
  selectOption(packageId) {
    this.options.forEach((el, id) => {
      el.classList.toggle("next-selected", id === packageId);
      el.setAttribute("data-next-selected", (id === packageId).toString());
    });
    this.selectedPackageId = packageId;
    this.packageId = packageId;
    let actualSelectorId = this.selectorId;
    const selectedEl = this.options.get(packageId);
    if (selectedEl) {
      const parent = selectedEl.closest("[data-next-selector-id]");
      actualSelectorId = parent?.getAttribute("data-next-selector-id") ?? this.selectorId;
    }
    const sid = actualSelectorId ?? "";
    this.emit("upsell-selector:item-selected", { selectorId: sid, packageId });
    this.emit("upsell:option-selected", { selectorId: sid, packageId });
    if (actualSelectorId) syncOptionSelectionAcrossContainers(actualSelectorId, packageId);
    this.element["_selectedPackageId"] = packageId;
    this.logger.debug("Upsell option selected:", { packageId, selectorId: actualSelectorId });
  }
  setupEventHandlers() {
    this.clickHandler = (event) => void handleActionClick(event, this.makeHandlerContext());
    this.actionButtons.forEach((btn) => btn.addEventListener("click", this.clickHandler));
    this.keydownHandler = (event) => {
      if (event.key === "Enter" && this.isProcessingRef.value) {
        event.preventDefault();
        event.stopPropagation();
        this.logger.debug("Enter key blocked - upsell is processing");
      }
    };
    this.element.addEventListener("keydown", this.keydownHandler, true);
  }
  onQuantityChanged(data) {
    const shouldSync = !!this.selectorId && data.selectorId === this.selectorId || !this.selectorId && !data.selectorId && this.packageId !== void 0 && data.packageId === this.packageId;
    if (!shouldSync) return;
    if (this.selectorId) {
      this.quantityBySelectorId.set(this.selectorId, data.quantity);
      this.currentQuantitySelectorId = this.selectorId;
    } else {
      this.quantity = data.quantity;
    }
    renderQuantityDisplay(
      this.element,
      this.currentQuantitySelectorId ?? this.selectorId,
      this.quantityBySelectorId,
      this.quantity
    );
  }
  onOptionSelected(data) {
    let shouldUpdate = this.selectorId === data.selectorId;
    if (!shouldUpdate) {
      this.element.querySelectorAll("[data-next-selector-id]").forEach((sel) => {
        if (sel.getAttribute("data-next-selector-id") === data.selectorId) shouldUpdate = true;
      });
    }
    if (!shouldUpdate) return;
    this.selectedPackageId = data.packageId;
    this.packageId = data.packageId;
    this.options.forEach((el, id) => {
      el.classList.toggle("next-selected", id === data.packageId);
      el.setAttribute("data-next-selected", (id === data.packageId).toString());
    });
  }
  handleOrderUpdate(orderState) {
    this.updateUpsellDisplay();
    renderProcessingState(this.element, this.actionButtons, orderState.isProcessingUpsell);
    if (orderState.upsellError) {
      renderError(this.element, orderState.upsellError, this.logger);
    }
  }
  updateUpsellDisplay() {
    if (useOrderStore.getState().canAddUpsells()) {
      showUpsellOffer(this.element);
    } else {
      hideUpsellOffer(this.element);
    }
  }
  /**
   * Resolve the selected package from a linked PackageSelectorEnhancer element
   * (data-next-package-selector-id="<id>"). Called at click time so it always
   * reflects the current selection.
   */
  resolveExternalSelection() {
    if (!this.packageSelectorId) return void 0;
    const el = document.querySelector(
      `[data-next-package-selector][data-next-selector-id="${this.packageSelectorId}"]`
    );
    if (!el) return void 0;
    const fn = el["_getSelectedPackageId"];
    return typeof fn === "function" ? fn() : void 0;
  }
  resolveExternalBundleItems() {
    if (!this.bundleSelectorId) return null;
    const el = document.querySelector(
      `[data-next-bundle-selector][data-next-selector-id="${this.bundleSelectorId}"]`
    );
    if (!el) return null;
    const fn = el["_getSelectedBundleItems"];
    return typeof fn === "function" ? fn() : null;
  }
  resolveExternalBundleVouchers() {
    if (!this.bundleSelectorId) return [];
    const el = document.querySelector(
      `[data-next-bundle-selector][data-next-selector-id="${this.bundleSelectorId}"]`
    );
    if (!el) return [];
    const fn = el["_getSelectedBundleVouchers"];
    return typeof fn === "function" ? fn() : [];
  }
  makeHandlerContext() {
    const externalId = this.resolveExternalSelection();
    const externalBundleItems = this.resolveExternalBundleItems();
    return {
      isProcessingRef: this.isProcessingRef,
      element: this.element,
      packageId: externalId ?? this.packageId,
      isSelector: this.isSelector,
      selectedPackageId: externalId ?? this.selectedPackageId,
      selectorId: this.selectorId,
      quantity: this.quantity,
      quantityBySelectorId: this.quantityBySelectorId,
      currentQuantitySelectorId: this.currentQuantitySelectorId,
      bundleItems: externalBundleItems,
      bundleVouchers: this.resolveExternalBundleVouchers(),
      actionButtons: this.actionButtons,
      loadingOverlay: this.loadingOverlay,
      apiClient: this.apiClient,
      currentPagePath: this.currentPagePath,
      logger: this.logger,
      emit: (event, detail) => this.emit(event, detail)
    };
  }
  update() {
    this.scanUpsellElements();
    this.updateUpsellDisplay();
  }
  cleanupEventListeners() {
    if (this.clickHandler) {
      this.actionButtons.forEach((btn) => btn.removeEventListener("click", this.clickHandler));
    }
    if (this.keydownHandler) {
      this.element.removeEventListener("keydown", this.keydownHandler, true);
    }
  }
  destroy() {
    if (this.pageShowHandler) window.removeEventListener("pageshow", this.pageShowHandler);
    this.actionButtons = [];
    super.destroy();
  }
}
export {
  UpsellEnhancer
};
