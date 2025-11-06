import { B as BaseEnhancer } from "./index-Dq-bZHvw.js";
import { a as useCartStore, u as useCampaignStore } from "./analytics-DY8BflmD.js";
import { i as ElementDataExtractor } from "./utils-CzY7UvvD.js";
class PackageSelectorEnhancer extends BaseEnhancer {
  constructor() {
    super(...arguments);
    this.items = [];
    this.selectedItem = null;
    this.clickHandlers = /* @__PURE__ */ new Map();
    this.quantityHandlers = /* @__PURE__ */ new Map();
    this.mutationObserver = null;
  }
  async initialize() {
    this.validateElement();
    this.selectorId = this.getRequiredAttribute("data-next-selector-id") || this.getRequiredAttribute("data-next-id") || `selector-${Date.now()}`;
    this.mode = this.getAttribute("data-next-selection-mode") || "swap";
    this.initializeSelectorCards();
    this.setupMutationObserver();
    this.subscribe(useCartStore, this.syncWithCart.bind(this));
    this.syncWithCart(useCartStore.getState());
    this.element._getSelectedItem = () => this.selectedItem;
    this.element._getSelectedPackageId = () => this.selectedItem?.packageId;
    this.logger.debug(`Initialized package selector:`, {
      selectorId: this.selectorId,
      mode: this.mode,
      itemCount: this.items.length,
      element: this.element,
      initialSelectedPackage: this.selectedItem?.packageId
    });
    this.logger.info(`Selector "${this.selectorId}" initialized with ${this.items.length} items in ${this.mode} mode`);
  }
  initializeSelectorCards() {
    const cardElements = this.element.querySelectorAll("[data-next-selector-card]");
    cardElements.forEach((cardElement) => {
      if (cardElement instanceof HTMLElement) {
        this.registerCard(cardElement);
      }
    });
    if (this.items.length === 0) {
      this.logger.warn("No selector cards found in selector", this.element);
    }
  }
  registerCard(cardElement) {
    const packageIdAttr = cardElement.getAttribute("data-next-package-id");
    if (!packageIdAttr) {
      this.logger.warn("Card missing package ID attribute", cardElement);
      return;
    }
    let packageId = parseInt(packageIdAttr, 10);
    const applyProfileHere = cardElement.getAttribute("data-next-apply-profile") === "true";
    if (applyProfileHere) {
      const { useProfileStore } = require("@/stores/profileStore");
      const profileStore = useProfileStore.getState();
      const mappedId = profileStore.getMappedPackageId(packageId);
      if (mappedId !== packageId) {
        this.logger.debug(`Selector card pre-mapped package ${packageId} -> ${mappedId}`);
        packageId = mappedId;
      }
    }
    const quantity = parseInt(cardElement.getAttribute("data-next-quantity") || "1", 10);
    const isPreSelected = cardElement.getAttribute("data-next-selected") === "true";
    const shippingId = cardElement.getAttribute("data-next-shipping-id");
    const existingItemIndex = this.items.findIndex((item2) => item2.element === cardElement);
    if (existingItemIndex !== -1) {
      const existingItem = this.items[existingItemIndex];
      if (existingItem) {
        existingItem.packageId = packageId;
        existingItem.quantity = quantity;
        existingItem.isPreSelected = isPreSelected;
        existingItem.shippingId = shippingId || void 0;
        this.updateItemPackageData(existingItem);
      }
      this.logger.debug(`Updated existing selector card:`, {
        packageId,
        quantity,
        isPreSelected,
        shippingId
      });
      return;
    }
    let packageData;
    try {
      const campaignState = useCampaignStore.getState();
      packageData = campaignState.getPackage(packageId) || void 0;
    } catch (error) {
      this.logger.debug("Package data not yet available for:", packageId);
    }
    const extractedPrice = packageData?.price ? parseFloat(packageData.price) : ElementDataExtractor.extractPrice(cardElement);
    const extractedName = packageData?.name || ElementDataExtractor.extractName(cardElement) || `Package ${packageId}`;
    const item = {
      element: cardElement,
      packageId,
      quantity,
      price: extractedPrice,
      name: extractedName,
      isPreSelected,
      shippingId: shippingId || void 0
    };
    this.items.push(item);
    const clickHandler = (event) => this.handleCardClick(event, item);
    this.clickHandlers.set(cardElement, clickHandler);
    cardElement.addEventListener("click", clickHandler);
    cardElement.classList.add("next-selector-card");
    this.setupQuantityControls(item);
    this.logger.debug(`Registered selector card:`, {
      packageId,
      quantity,
      isPreSelected,
      shippingId
    });
  }
  setupQuantityControls(item) {
    const cardElement = item.element;
    const increaseBtn = cardElement.querySelector("[data-next-quantity-increase]");
    const decreaseBtn = cardElement.querySelector("[data-next-quantity-decrease]");
    const displayElement = cardElement.querySelector("[data-next-quantity-display]");
    if (!increaseBtn && !decreaseBtn) {
      return;
    }
    const minQuantity = parseInt(cardElement.getAttribute("data-next-min-quantity") || "1", 10);
    const maxQuantity = parseInt(cardElement.getAttribute("data-next-max-quantity") || "999", 10);
    const updateDisplay = () => {
      if (displayElement) {
        displayElement.textContent = item.quantity.toString();
      }
      cardElement.setAttribute("data-next-quantity", item.quantity.toString());
      if (decreaseBtn) {
        decreaseBtn.toggleAttribute("disabled", item.quantity <= minQuantity);
        decreaseBtn.classList.toggle("next-disabled", item.quantity <= minQuantity);
      }
      if (increaseBtn) {
        increaseBtn.toggleAttribute("disabled", item.quantity >= maxQuantity);
        increaseBtn.classList.toggle("next-disabled", item.quantity >= maxQuantity);
      }
    };
    if (increaseBtn) {
      const increaseHandler = (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (item.quantity < maxQuantity) {
          item.quantity++;
          updateDisplay();
          this.handleQuantityChange(item);
        }
      };
      this.quantityHandlers.set(increaseBtn, increaseHandler);
      increaseBtn.addEventListener("click", increaseHandler);
    }
    if (decreaseBtn) {
      const decreaseHandler = (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (item.quantity > minQuantity) {
          item.quantity--;
          updateDisplay();
          this.handleQuantityChange(item);
        }
      };
      this.quantityHandlers.set(decreaseBtn, decreaseHandler);
      decreaseBtn.addEventListener("click", decreaseHandler);
    }
    updateDisplay();
    this.logger.debug(`Set up quantity controls for package ${item.packageId}:`, {
      minQuantity,
      maxQuantity,
      currentQuantity: item.quantity
    });
  }
  async handleQuantityChange(item) {
    try {
      this.logger.debug(`Quantity changed for package ${item.packageId}:`, item.quantity);
      this.emit("selector:quantity-changed", {
        selectorId: this.selectorId,
        packageId: item.packageId,
        quantity: item.quantity
      });
      if (this.selectedItem === item && this.mode === "swap") {
        const cartStore = useCartStore.getState();
        if (cartStore.hasItem(item.packageId)) {
          await cartStore.updateQuantity(item.packageId, item.quantity);
          this.logger.debug(`Updated cart quantity for package ${item.packageId} to ${item.quantity}`);
        } else {
          await cartStore.addItem({
            packageId: item.packageId,
            quantity: item.quantity,
            isUpsell: false
          });
          this.logger.debug(`Added package ${item.packageId} to cart with quantity ${item.quantity}`);
        }
      }
    } catch (error) {
      this.handleError(error, "handleQuantityChange");
    }
  }
  setupMutationObserver() {
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.target instanceof HTMLElement) {
          const target = mutation.target;
          if (target.hasAttribute("data-next-selector-card") && mutation.attributeName === "data-next-package-id") {
            this.handlePackageIdChange(target);
          }
        }
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (node.hasAttribute("data-next-selector-card")) {
                this.registerCard(node);
              }
              const cards = node.querySelectorAll("[data-next-selector-card]");
              cards.forEach((card) => {
                if (card instanceof HTMLElement) {
                  this.registerCard(card);
                }
              });
            }
          });
          mutation.removedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              this.handleCardRemoval(node);
            }
          });
        }
      });
    });
    this.mutationObserver.observe(this.element, {
      attributes: true,
      attributeFilter: ["data-next-package-id", "data-next-quantity", "data-next-selected", "data-next-shipping-id"],
      childList: true,
      subtree: true
    });
  }
  handlePackageIdChange(cardElement) {
    const item = this.items.find((i) => i.element === cardElement);
    if (!item) {
      this.registerCard(cardElement);
      return;
    }
    const newPackageIdAttr = cardElement.getAttribute("data-next-package-id");
    if (!newPackageIdAttr) {
      this.logger.warn("Card package ID removed", cardElement);
      return;
    }
    const newPackageId = parseInt(newPackageIdAttr, 10);
    const oldPackageId = item.packageId;
    if (newPackageId !== oldPackageId) {
      item.packageId = newPackageId;
      item.quantity = parseInt(cardElement.getAttribute("data-next-quantity") || "1", 10);
      item.shippingId = cardElement.getAttribute("data-next-shipping-id") || void 0;
      this.updateItemPackageData(item);
      if (this.selectedItem === item && this.mode === "swap") {
        this.updateCart({ ...item, packageId: oldPackageId }, item).catch((error) => {
          this.logger.error("Failed to update cart after package ID change:", error);
        });
      }
      this.syncWithCart(useCartStore.getState());
      this.logger.debug("Package ID changed on selector card:", {
        oldPackageId,
        newPackageId,
        isSelected: this.selectedItem === item
      });
    }
  }
  updateItemPackageData(item) {
    try {
      const campaignState = useCampaignStore.getState();
      const packageData = campaignState.getPackage(item.packageId);
      if (packageData) {
        item.price = packageData.price ? parseFloat(packageData.price) : item.price;
        item.name = packageData.name || item.name;
      } else {
        item.price = ElementDataExtractor.extractPrice(item.element);
        item.name = ElementDataExtractor.extractName(item.element) || `Package ${item.packageId}`;
      }
    } catch (error) {
      this.logger.debug("Failed to update package data:", error);
    }
  }
  handleCardRemoval(element) {
    const cardsToRemove = [];
    if (element.hasAttribute("data-next-selector-card")) {
      cardsToRemove.push(element);
    }
    const childCards = element.querySelectorAll("[data-next-selector-card]");
    childCards.forEach((card) => {
      if (card instanceof HTMLElement) {
        cardsToRemove.push(card);
      }
    });
    cardsToRemove.forEach((cardElement) => {
      const itemIndex = this.items.findIndex((item) => item.element === cardElement);
      if (itemIndex !== -1) {
        const removedItem = this.items[itemIndex];
        const handler = this.clickHandlers.get(cardElement);
        if (handler) {
          cardElement.removeEventListener("click", handler);
          this.clickHandlers.delete(cardElement);
        }
        const increaseBtn = cardElement.querySelector("[data-next-quantity-increase]");
        const decreaseBtn = cardElement.querySelector("[data-next-quantity-decrease]");
        [increaseBtn, decreaseBtn].forEach((btn) => {
          if (btn) {
            const qtyHandler = this.quantityHandlers.get(btn);
            if (qtyHandler) {
              btn.removeEventListener("click", qtyHandler);
              this.quantityHandlers.delete(btn);
            }
          }
        });
        this.items.splice(itemIndex, 1);
        if (this.selectedItem === removedItem) {
          this.selectedItem = null;
          this.element.removeAttribute("data-selected-package");
        }
        this.logger.debug("Removed selector card:", {
          packageId: removedItem?.packageId
        });
      }
    });
  }
  async handleCardClick(event, item) {
    event.preventDefault();
    try {
      if (this.selectedItem === item) {
        return;
      }
      const previousItem = this.selectedItem;
      this.selectItem(item);
      this.eventBus.emit("selector:item-selected", {
        selectorId: this.selectorId,
        packageId: item.packageId,
        previousPackageId: previousItem?.packageId || void 0,
        mode: this.mode,
        pendingAction: this.mode === "select" ? true : void 0
      });
      this.element.setAttribute("data-selected-package", item.packageId.toString());
      this.element._selectedItem = item;
      if (this.mode === "swap") {
        await this.updateCart(previousItem, item);
        if (item.shippingId) {
          await this.setShippingMethod(item.shippingId);
        }
      }
    } catch (error) {
      this.handleError(error, "handleCardClick");
    }
  }
  selectItem(item) {
    this.items.forEach((i) => {
      i.element.classList.remove("next-selected");
      i.element.setAttribute("data-next-selected", "false");
    });
    item.element.classList.add("next-selected");
    item.element.setAttribute("data-next-selected", "true");
    this.selectedItem = item;
    this.element.setAttribute("data-selected-package", item.packageId.toString());
    this.logger.debug(`Selected item in selector ${this.selectorId}:`, {
      packageId: item.packageId,
      name: item.name,
      quantity: item.quantity
    });
    this.emit("selector:selection-changed", {
      selectorId: this.selectorId,
      packageId: item.packageId,
      item
    });
  }
  async updateCart(previousItem, selectedItem) {
    const cartStore = useCartStore.getState();
    if (this.mode === "swap") {
      const existingCartItem = cartStore.items.find((cartItem) => {
        return this.items.some(
          (selectorItem) => cartItem.packageId === selectorItem.packageId || cartItem.originalPackageId === selectorItem.packageId
        );
      });
      if (existingCartItem) {
        if (existingCartItem.packageId !== selectedItem.packageId) {
          this.logger.debug(`Swapping cart item from selector: ${existingCartItem.packageId} -> ${selectedItem.packageId}`);
          await cartStore.swapPackage(existingCartItem.packageId, {
            packageId: selectedItem.packageId,
            quantity: selectedItem.quantity,
            isUpsell: false
          });
        }
      } else if (!cartStore.hasItem(selectedItem.packageId)) {
        this.logger.debug(`Adding new item from selector: ${selectedItem.packageId}`);
        await cartStore.addItem({
          packageId: selectedItem.packageId,
          quantity: selectedItem.quantity,
          isUpsell: false
        });
      }
    } else {
      if (previousItem && previousItem.packageId !== selectedItem.packageId) {
        await cartStore.swapPackage(previousItem.packageId, {
          packageId: selectedItem.packageId,
          quantity: selectedItem.quantity,
          isUpsell: false
        });
      } else if (!cartStore.hasItem(selectedItem.packageId)) {
        await cartStore.addItem({
          packageId: selectedItem.packageId,
          quantity: selectedItem.quantity,
          isUpsell: false
        });
      }
    }
  }
  async setShippingMethod(shippingId) {
    try {
      const shippingIdNum = parseInt(shippingId, 10);
      if (isNaN(shippingIdNum)) {
        this.logger.error("Invalid shipping ID:", shippingId);
        return;
      }
      const cartStore = useCartStore.getState();
      await cartStore.setShippingMethod(shippingIdNum);
      this.logger.debug(`Shipping method ${shippingIdNum} set via selector`);
    } catch (error) {
      this.logger.error("Failed to set shipping method:", error);
    }
  }
  syncWithCart(cartState) {
    try {
      this.items.forEach((item) => {
        const cartItem = cartState.items.find(
          (cartItem2) => cartItem2.originalPackageId === item.packageId || cartItem2.packageId === item.packageId
        );
        const isInCart = !!cartItem;
        item.element.classList.toggle("next-in-cart", isInCart);
        item.element.setAttribute("data-next-in-cart", isInCart.toString());
        if (cartItem && item.quantity !== cartItem.quantity) {
          item.quantity = cartItem.quantity;
          const displayElement = item.element.querySelector("[data-next-quantity-display]");
          if (displayElement) {
            displayElement.textContent = item.quantity.toString();
          }
          item.element.setAttribute("data-next-quantity", item.quantity.toString());
          const minQuantity = parseInt(item.element.getAttribute("data-next-min-quantity") || "1", 10);
          const maxQuantity = parseInt(item.element.getAttribute("data-next-max-quantity") || "999", 10);
          const decreaseBtn = item.element.querySelector("[data-next-quantity-decrease]");
          const increaseBtn = item.element.querySelector("[data-next-quantity-increase]");
          if (decreaseBtn) {
            decreaseBtn.toggleAttribute("disabled", item.quantity <= minQuantity);
            decreaseBtn.classList.toggle("next-disabled", item.quantity <= minQuantity);
          }
          if (increaseBtn) {
            increaseBtn.toggleAttribute("disabled", item.quantity >= maxQuantity);
            increaseBtn.classList.toggle("next-disabled", item.quantity >= maxQuantity);
          }
          this.logger.debug(`Synced quantity from cart for package ${item.packageId}: ${item.quantity}`);
        }
      });
      const cartItemsInSelector = this.items.filter(
        (item) => cartState.items.some(
          (cartItem) => cartItem.originalPackageId === item.packageId || cartItem.packageId === item.packageId
        )
      );
      if (cartItemsInSelector.length > 0 && this.mode === "swap") {
        const itemToSelect = cartItemsInSelector[0];
        if (itemToSelect && this.selectedItem !== itemToSelect) {
          this.selectItem(itemToSelect);
        }
      } else if (!this.selectedItem) {
        const preSelectedItems = this.items.filter((item) => item.isPreSelected);
        if (preSelectedItems.length > 1) {
          this.logger.warn(`Multiple pre-selected items found in selector ${this.selectorId}. Only one should be pre-selected.`);
          preSelectedItems.slice(1).forEach((item) => {
            item.element.classList.remove("next-selected");
            item.element.setAttribute("data-next-selected", "false");
            item.isPreSelected = false;
          });
        }
        const preSelected = preSelectedItems[0];
        if (preSelected) {
          this.selectItem(preSelected);
          if (this.mode !== "select" && cartState.isEmpty) {
            this.updateCart(null, preSelected).then(() => {
              if (preSelected.shippingId) {
                this.setShippingMethod(preSelected.shippingId);
              }
            }).catch((error) => {
              this.logger.error("Failed to add pre-selected item:", error);
            });
          }
        } else if (this.mode === "select" && this.items.length > 0) {
          const firstItem = this.items[0];
          if (firstItem) {
            this.selectItem(firstItem);
            this.logger.debug("Select mode: Auto-selected first item since no pre-selected item found");
          }
        }
      }
    } catch (error) {
      this.handleError(error, "syncWithCart");
    }
  }
  update() {
    this.syncWithCart(useCartStore.getState());
  }
  getSelectedItem() {
    return this.selectedItem;
  }
  getSelectorConfig() {
    return {
      id: this.selectorId,
      mode: this.mode,
      itemCount: this.items.length
    };
  }
  cleanupEventListeners() {
    this.clickHandlers.forEach((handler, element) => {
      element.removeEventListener("click", handler);
    });
    this.clickHandlers.clear();
    this.quantityHandlers.forEach((handler, element) => {
      element.removeEventListener("click", handler);
    });
    this.quantityHandlers.clear();
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }
  destroy() {
    this.cleanupEventListeners();
    this.items.forEach((item) => {
      item.element.classList.remove(
        "next-selector-card",
        "next-selected",
        "next-in-cart"
      );
    });
    super.destroy();
  }
}
export {
  PackageSelectorEnhancer
};
