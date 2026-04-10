import { B as BaseActionEnhancer } from "./BaseActionEnhancer-CQ17b2DH.js";
import { u as useOrderStore } from "./debug-DA8wFB-u.js";
import { u as useCampaignStore, c as configStore } from "./analytics-BHJjHc1E.js";
import { ApiClient } from "./api-BKmaU79g.js";
import { L as LoadingOverlay } from "./LoadingOverlay-DOjYiQnB.js";
import { G as GeneralModal } from "./GeneralModal-Cuk4sJCc.js";
import { p as preserveQueryParams } from "./utils-R5pRn2AT.js";
function resolvePackageId(ctx) {
  if (ctx.selectorId && ctx.selectedItemRef.value) {
    return ctx.selectedItemRef.value.packageId;
  }
  return ctx.packageId;
}
function resolveQuantity(ctx) {
  if (ctx.selectorId && ctx.selectedItemRef.value?.quantity) {
    return ctx.selectedItemRef.value.quantity;
  }
  return ctx.quantity;
}
function getCurrency() {
  const campaign = useCampaignStore.getState().data;
  if (campaign?.currency) return campaign.currency;
  const config = configStore.getState();
  return config?.selectedCurrency ?? config?.detectedCurrency ?? "USD";
}
function isAlreadyAccepted(packageId) {
  const { completedUpsells, upsellJourney } = useOrderStore.getState();
  if (completedUpsells.includes(packageId.toString())) return true;
  return upsellJourney.some(
    (e) => e.packageId === packageId.toString() && e.action === "accepted"
  );
}
function resolveRedirectUrl(nextUrl, metaName, logger) {
  if (nextUrl) return nextUrl;
  const metaUrl = document.querySelector(`meta[name="${metaName}"]`)?.getAttribute("content") ?? void 0;
  if (metaUrl) logger.debug(`Using fallback URL from <meta name="${metaName}">:`, metaUrl);
  return metaUrl;
}
async function confirmDuplicate(logger) {
  const proceed = await GeneralModal.showDuplicateUpsell();
  logger.info(
    proceed ? "User confirmed to add duplicate upsell" : "User declined to add duplicate upsell"
  );
  return proceed;
}
async function acceptBundleUpsell(ctx) {
  const items = ctx.bundleItemsRef.value;
  if (!items || items.length === 0) {
    ctx.logger.warn("No bundle items selected for upsell");
    return;
  }
  const orderStore = useOrderStore.getState();
  if (!orderStore.order) {
    ctx.logger.error("No order loaded");
    return;
  }
  ctx.loadingOverlay.show();
  try {
    const previousLineIds = orderStore.order.lines?.map((line) => line.id) ?? [];
    const upsellData = {
      lines: items.map((i) => ({ package_id: i.packageId, quantity: i.quantity })),
      currency: getCurrency()
    };
    const updatedOrder = await orderStore.addUpsell(upsellData, ctx.apiClient);
    if (!updatedOrder) throw new Error("Failed to add bundle upsell — no order returned");
    const addedLines = updatedOrder.lines?.filter(
      (line) => line.is_upsell && !previousLineIds.includes(line.id)
    ) ?? [];
    const totalValue = addedLines.reduce(
      (sum, line) => sum + (line.price_incl_tax ? parseFloat(line.price_incl_tax) : 0),
      0
    );
    for (const item of items) {
      ctx.emit("upsell:accepted", {
        packageId: item.packageId,
        quantity: item.quantity,
        orderId: useOrderStore.getState().refId,
        value: totalValue
      });
    }
    const acceptUrl = resolveRedirectUrl(
      ctx.nextUrl,
      "next-upsell-accept-url",
      ctx.logger
    );
    if (acceptUrl) {
      window.location.href = preserveQueryParams(acceptUrl);
    } else {
      ctx.loadingOverlay.hide();
    }
  } catch (error) {
    ctx.logger.error("Failed to accept bundle upsell:", error);
    ctx.loadingOverlay.hide(true);
    throw error;
  }
}
async function acceptUpsell(ctx) {
  if (ctx.bundleSelectorId) {
    await acceptBundleUpsell(ctx);
    return;
  }
  const packageIdToAdd = resolvePackageId(ctx);
  const quantityToAdd = resolveQuantity(ctx);
  if (!packageIdToAdd) {
    ctx.logger.warn("No package ID available for accept-upsell action");
    return;
  }
  const orderStore = useOrderStore.getState();
  if (!orderStore.order) {
    ctx.logger.error("No order loaded");
    return;
  }
  if (isAlreadyAccepted(packageIdToAdd)) {
    const proceed = await confirmDuplicate(ctx.logger);
    if (!proceed) {
      const declineUrl = resolveRedirectUrl(
        ctx.nextUrl,
        "next-upsell-decline-url",
        ctx.logger
      );
      if (declineUrl) window.location.href = preserveQueryParams(declineUrl);
      return;
    }
  }
  ctx.loadingOverlay.show();
  try {
    const previousLineIds = orderStore.order.lines?.map((line) => line.id) ?? [];
    const upsellData = {
      lines: [{ package_id: packageIdToAdd, quantity: quantityToAdd }],
      currency: getCurrency()
    };
    const updatedOrder = await orderStore.addUpsell(upsellData, ctx.apiClient);
    if (!updatedOrder) throw new Error("Failed to add upsell — no order returned");
    const addedLine = updatedOrder.lines?.find(
      (line) => line.is_upsell && !previousLineIds.includes(line.id)
    );
    const upsellValue = addedLine?.price_incl_tax ? parseFloat(addedLine.price_incl_tax) : 0;
    ctx.emit("upsell:accepted", {
      packageId: packageIdToAdd,
      quantity: quantityToAdd,
      orderId: useOrderStore.getState().refId,
      value: upsellValue
    });
    const acceptUrl = resolveRedirectUrl(
      ctx.nextUrl,
      "next-upsell-accept-url",
      ctx.logger
    );
    if (acceptUrl) {
      window.location.href = preserveQueryParams(acceptUrl);
    } else {
      ctx.loadingOverlay.hide();
    }
  } catch (error) {
    ctx.logger.error("Failed to accept upsell:", error);
    ctx.loadingOverlay.hide(true);
    throw error;
  }
}
class AcceptUpsellEnhancer extends BaseActionEnhancer {
  constructor() {
    super(...arguments);
    this.quantity = 1;
    this.bundleItemsRef = { value: null };
    this.loadingOverlay = new LoadingOverlay();
    this.selectedItemRef = { value: null };
    this.boundHandleClick = (e) => void this.handleClick(e);
    this.boundHandlePageShow = (e) => this.handlePageShow(e);
    this.boundHandleSelectorChange = (e) => this.handleSelectorChange(e);
    this.boundHandleBundleSelectionChange = () => this.handleBundleSelectionChange();
  }
  async initialize() {
    this.validateElement();
    window.addEventListener("pageshow", this.boundHandlePageShow);
    const packageIdAttr = this.getAttribute("data-next-package-id");
    if (packageIdAttr) this.packageId = parseInt(packageIdAttr, 10);
    const quantityAttr = this.getAttribute("data-next-quantity");
    this.quantity = quantityAttr ? parseInt(quantityAttr, 10) : 1;
    const selectorIdAttr = this.getAttribute("data-next-selector-id");
    if (selectorIdAttr) this.selectorId = selectorIdAttr;
    const bundleSelectorIdAttr = this.getAttribute("data-next-upsell-action-for");
    if (bundleSelectorIdAttr) this.bundleSelectorId = bundleSelectorIdAttr;
    const nextUrlAttr = this.getAttribute("data-next-url");
    if (nextUrlAttr) this.nextUrl = nextUrlAttr;
    this.apiClient = new ApiClient(configStore.getState().apiKey);
    this.element.addEventListener("click", this.boundHandleClick);
    if (this.selectorId) this.setupSelectorListener();
    if (this.bundleSelectorId) this.setupBundleSelectorListener();
    this.subscribe(useOrderStore, () => this.updateButtonState());
    this.updateButtonState();
    this.logger.debug("Initialized", {
      packageId: this.packageId,
      selectorId: this.selectorId,
      bundleSelectorId: this.bundleSelectorId,
      quantity: this.quantity
    });
  }
  setupSelectorListener() {
    setTimeout(() => {
      const el = this.findSelectorElement();
      if (!el) {
        this.logger.warn(`Selector "${this.selectorId}" not found`);
        return;
      }
      this.selectedItemRef.value = this.readSelectedItem(el);
      this.updateButtonState();
    }, 100);
    this.eventBus.on(
      "upsell-selector:item-selected",
      this.boundHandleSelectorChange
    );
    this.eventBus.on("selector:item-selected", this.boundHandleSelectorChange);
    this.eventBus.on(
      "selector:selection-changed",
      this.boundHandleSelectorChange
    );
  }
  setupBundleSelectorListener() {
    setTimeout(() => {
      const el = this.findBundleSelectorElement();
      if (!el) {
        this.logger.warn(`Bundle selector "${this.bundleSelectorId}" not found`);
        return;
      }
      this.readBundleItems(el);
      this.updateButtonState();
    }, 100);
    this.eventBus.on("bundle:selected", this.boundHandleBundleSelectionChange);
    this.eventBus.on("bundle:selection-changed", this.boundHandleBundleSelectionChange);
  }
  findBundleSelectorElement() {
    return document.querySelector(
      `[data-next-bundle-selector][data-next-selector-id="${this.bundleSelectorId}"]`
    );
  }
  readBundleItems(el) {
    const getItems = el["_getSelectedBundleItems"];
    if (typeof getItems === "function") {
      this.bundleItemsRef.value = getItems();
    }
  }
  handleBundleSelectionChange() {
    const el = this.findBundleSelectorElement();
    if (el) this.readBundleItems(el);
    this.updateButtonState();
  }
  findSelectorElement() {
    return document.querySelector(
      `[data-next-upsell-selector][data-next-selector-id="${this.selectorId}"],[data-next-upsell-select="${this.selectorId}"],[data-next-upsell][data-next-selector-id="${this.selectorId}"]`
    );
  }
  readSelectedItem(el) {
    const getPackageId = el._getSelectedPackageId;
    const packageId = typeof getPackageId === "function" ? getPackageId() : el._selectedPackageId;
    if (!packageId) return null;
    return {
      packageId,
      quantity: 1,
      element: null,
      price: void 0,
      name: void 0,
      isPreSelected: false,
      shippingId: void 0
    };
  }
  handleSelectorChange(event) {
    if (event.selectorId !== this.selectorId) return;
    const el = this.findSelectorElement();
    if (el) {
      this.selectedItemRef.value = this.readSelectedItem(el);
    } else if (event.packageId) {
      this.selectedItemRef.value = {
        packageId: event.packageId,
        quantity: event.quantity ?? 1,
        element: null,
        price: void 0,
        name: void 0,
        isPreSelected: false,
        shippingId: void 0
      };
    } else {
      this.selectedItemRef.value = null;
    }
    this.updateButtonState();
  }
  handlePageShow(event) {
    if (event.persisted) {
      this.loadingOverlay.hide(true);
      this.setEnabled(true);
    }
  }
  updateButtonState() {
    const { canAddUpsells } = useOrderStore.getState();
    const hasPackage = !!(this.packageId ?? this.selectedItemRef.value ?? (this.bundleItemsRef.value?.length ? this.bundleItemsRef.value : null));
    this.setEnabled(canAddUpsells() && hasPackage);
  }
  setEnabled(enabled) {
    if (enabled) {
      this.element.removeAttribute("disabled");
      this.removeClass("next-disabled");
    } else {
      this.element.setAttribute("disabled", "true");
      this.addClass("next-disabled");
    }
  }
  makeContext() {
    return {
      packageId: this.packageId,
      selectorId: this.selectorId,
      selectedItemRef: this.selectedItemRef,
      quantity: this.quantity,
      bundleSelectorId: this.bundleSelectorId,
      bundleItemsRef: this.bundleItemsRef,
      nextUrl: this.nextUrl,
      apiClient: this.apiClient,
      loadingOverlay: this.loadingOverlay,
      logger: this.logger,
      emit: (event, detail) => this.emit(event, detail)
    };
  }
  async handleClick(event) {
    event.preventDefault();
    await this.executeAction(() => acceptUpsell(this.makeContext()), {
      showLoading: false,
      disableOnProcess: true
    });
  }
  /**
   * Trigger upsell acceptance programmatically (e.g. from window.next.addUpsell).
   */
  async triggerAcceptUpsell() {
    await this.executeAction(() => acceptUpsell(this.makeContext()), {
      showLoading: false,
      disableOnProcess: true
    });
  }
  update(_data) {
  }
  destroy() {
    this.element.removeEventListener("click", this.boundHandleClick);
    window.removeEventListener("pageshow", this.boundHandlePageShow);
    if (this.selectorId) {
      this.eventBus.off(
        "upsell-selector:item-selected",
        this.boundHandleSelectorChange
      );
      this.eventBus.off("selector:item-selected", this.boundHandleSelectorChange);
      this.eventBus.off(
        "selector:selection-changed",
        this.boundHandleSelectorChange
      );
    }
    if (this.bundleSelectorId) {
      this.eventBus.off("bundle:selected", this.boundHandleBundleSelectionChange);
      this.eventBus.off("bundle:selection-changed", this.boundHandleBundleSelectionChange);
    }
    super.destroy();
  }
}
export {
  AcceptUpsellEnhancer
};
