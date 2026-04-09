import { B as BaseActionEnhancer } from "./BaseActionEnhancer-BtVnarBt.js";
import { p as preserveQueryParams } from "./utils-DTwlwnMm.js";
import { a as useCartStore } from "./analytics-Ci0jTs8y.js";
function handleSelectorChange(event, findSelectorElement, getSelectedItemFromElement, ctx) {
  if (event.selectorId !== ctx.selectorId) return;
  const el = findSelectorElement();
  if (el) {
    ctx.selectedItemRef.value = getSelectedItemFromElement(el);
  } else if (event.item) {
    ctx.selectedItemRef.value = event.item;
  } else if (event.packageId !== void 0) {
    ctx.selectedItemRef.value = {
      packageId: event.packageId,
      quantity: event.quantity ?? 1,
      element: null,
      price: void 0,
      name: void 0,
      isPreSelected: false,
      shippingId: void 0
    };
  } else {
    ctx.selectedItemRef.value = null;
  }
  ctx.updateButtonState();
}
async function addToCart(packageId, quantity, ctx) {
  const cartStore = useCartStore.getState();
  if (ctx.clearCart) {
    ctx.logger.debug("Clearing cart before adding item");
    await cartStore.clear();
  }
  await cartStore.addItem({ packageId, quantity, isUpsell: void 0 });
  ctx.emit("cart:item-added", {
    packageId,
    quantity,
    source: ctx.selectorId ? "selector" : "direct"
  });
  if (ctx.redirectUrl) {
    const finalUrl = preserveQueryParams(ctx.redirectUrl);
    ctx.logger.debug("Redirecting to:", finalUrl);
    window.location.href = finalUrl;
  }
}
class AddToCartEnhancer extends BaseActionEnhancer {
  constructor() {
    super(...arguments);
    this.quantity = 1;
    this.clearCart = false;
    this.selectedItemRef = { value: void 0 };
  }
  async initialize() {
    this.validateElement();
    const packageIdAttr = this.getAttribute("data-next-package-id");
    if (packageIdAttr) this.packageId = parseInt(packageIdAttr, 10);
    const quantityAttr = this.getAttribute("data-next-quantity");
    this.quantity = quantityAttr ? parseInt(quantityAttr, 10) : 1;
    const selectorIdAttr = this.getAttribute("data-next-selector-id");
    if (selectorIdAttr) this.selectorId = selectorIdAttr;
    const redirectUrlAttr = this.getAttribute("data-next-url");
    if (redirectUrlAttr) this.redirectUrl = redirectUrlAttr;
    const clearCartAttr = this.getAttribute("data-next-clear-cart");
    this.clearCart = clearCartAttr === "true";
    this.clickHandler = this.handleClick.bind(this);
    this.element.addEventListener("click", this.clickHandler);
    if (this.selectorId) this.setupSelectorListener();
    this.updateButtonState();
    this.logger.debug("AddToCartEnhancer initialized", {
      packageId: this.packageId,
      selectorId: this.selectorId,
      quantity: this.quantity,
      redirectUrl: this.redirectUrl,
      clearCart: this.clearCart
    });
  }
  setupSelectorListener() {
    const check = (retryCount = 0) => {
      const el = this.findSelectorElement();
      if (!el && retryCount < 5) {
        setTimeout(() => check(retryCount + 1), 50);
        return;
      }
      if (!el) {
        this.logger.warn(`Selector "${this.selectorId}" not found after retries`);
        return;
      }
      let item = this.getSelectedItemFromElement(el);
      if (item && !item.element) {
        const card = el.querySelector(
          `[data-next-selector-card][data-next-package-id="${item.packageId}"]`
        );
        if (card) item = { ...item, element: card };
      }
      if (!item && el.getAttribute("data-next-selection-mode") === "select") {
        const card = el.querySelector(
          '[data-next-selector-card][data-next-selected="true"]'
        );
        const idAttr = card?.getAttribute("data-next-package-id");
        const id = idAttr ? parseInt(idAttr, 10) : NaN;
        if (!isNaN(id)) {
          el.setAttribute("data-selected-package", String(id));
          item = {
            packageId: id,
            quantity: this.quantity,
            element: card ?? null,
            price: void 0,
            name: void 0,
            isPreSelected: false,
            shippingId: void 0
          };
        }
      }
      this.selectedItemRef.value = item;
      this.updateButtonState();
    };
    check();
    this.selectorChangeHandler = (event) => handleSelectorChange(
      event,
      () => this.findSelectorElement(),
      (el) => this.getSelectedItemFromElement(el),
      this.makeHandlerContext()
    );
    this.eventBus.on("selector:item-selected", this.selectorChangeHandler);
    this.eventBus.on("selector:selection-changed", this.selectorChangeHandler);
  }
  findSelectorElement() {
    return document.querySelector(
      `[data-next-cart-selector][data-next-selector-id="${this.selectorId}"],[data-next-package-selector][data-next-selector-id="${this.selectorId}"]`
    );
  }
  getSelectedItemFromElement(el) {
    const getter = el["_getSelectedItem"];
    if (typeof getter === "function") return getter();
    const direct = el["_selectedItem"];
    if (direct) return direct;
    const attr = el.getAttribute("data-selected-package");
    const id = attr ? parseInt(attr, 10) : NaN;
    if (!isNaN(id)) {
      return {
        packageId: id,
        quantity: 1,
        element: null,
        price: void 0,
        name: void 0,
        isPreSelected: false,
        shippingId: void 0
      };
    }
    return null;
  }
  updateButtonState() {
    if (this.selectorId) {
      const el = this.findSelectorElement();
      const isSelectMode = el?.getAttribute("data-next-selection-mode") === "select";
      const hasSelection = this.selectedItemRef.value != null || isSelectMode && !!el?.getAttribute("data-selected-package");
      this.setEnabled(hasSelection);
    } else if (this.packageId) {
      this.setEnabled(true);
    }
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
  async handleClick(event) {
    event.preventDefault();
    await this.executeAction(
      async () => {
        const { packageId, quantity } = this.resolveAddTarget();
        if (!packageId) {
          this.logger.warn("No package ID available for add-to-cart action");
          return;
        }
        await addToCart(packageId, quantity, this.makeHandlerContext());
        this.updateButtonState();
      },
      { showLoading: true, disableOnProcess: true }
    );
  }
  resolveAddTarget() {
    const item = this.selectedItemRef.value;
    if (this.selectorId && item) {
      return { packageId: item.packageId, quantity: item.quantity ?? this.quantity };
    }
    return { packageId: this.packageId, quantity: this.quantity };
  }
  makeHandlerContext() {
    return {
      selectorId: this.selectorId,
      quantity: this.quantity,
      clearCart: this.clearCart,
      redirectUrl: this.redirectUrl,
      logger: this.logger,
      selectedItemRef: this.selectedItemRef,
      updateButtonState: () => this.updateButtonState(),
      emit: (event, detail) => this.emit(event, detail)
    };
  }
  update(_data) {
  }
  destroy() {
    if (this.clickHandler) {
      this.element.removeEventListener("click", this.clickHandler);
    }
    if (this.selectorChangeHandler) {
      this.eventBus.off("selector:item-selected", this.selectorChangeHandler);
      this.eventBus.off("selector:selection-changed", this.selectorChangeHandler);
    }
    super.destroy();
  }
}
export {
  AddToCartEnhancer
};
