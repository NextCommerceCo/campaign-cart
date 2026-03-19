import { B as BaseEnhancer } from "./index-WbFNZle8.js";
import { u as useCartStore } from "./analytics-BuAKAb38.js";
import { u as useCampaignStore, f as formatCurrency } from "./utils-CQa_9vcu.js";
class CartItemSlotsEnhancer extends BaseEnhancer {
  constructor() {
    super(...arguments);
    this.template = "";
    this.emptyTemplate = '<div class="cart-empty">Your cart is empty</div>';
    this.variantOptionTemplate = "";
    this.slots = [];
    this.isUpdating = false;
    this.selectHandlers = /* @__PURE__ */ new Map();
    this.slotFilter = {};
    this.boundVariantOptionClick = null;
  }
  async initialize() {
    this.validateElement();
    const templateId = this.getAttribute("data-next-slot-template-id");
    if (templateId) {
      this.template = document.getElementById(templateId)?.innerHTML.trim() || "";
    } else {
      this.template = this.getAttribute("data-next-slot-template") || this.element.innerHTML.trim();
    }
    this.emptyTemplate = this.getAttribute("data-next-empty-template") || this.emptyTemplate;
    const variantOptionTemplateId = this.getAttribute("data-next-variant-option-template-id");
    if (variantOptionTemplateId) {
      this.variantOptionTemplate = document.getElementById(variantOptionTemplateId)?.innerHTML.trim() || "";
    }
    const filterAttr = this.getAttribute("data-next-slot-filter");
    if (filterAttr) {
      try {
        this.slotFilter = JSON.parse(filterAttr);
      } catch {
        this.logger.warn("Invalid data-next-slot-filter JSON, ignoring", filterAttr);
      }
    }
    if (this.variantOptionTemplate) {
      const handler = this.handleVariantOptionClick.bind(this);
      this.boundVariantOptionClick = handler;
      this.element.addEventListener("click", handler);
    }
    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));
    this.handleCartUpdate(useCartStore.getState());
    this.logger.debug("CartItemSlotsEnhancer initialized");
  }
  update() {
  }
  // ─── Cart state → slot state ────────────────────────────────────────────────
  handleCartUpdate(cartState) {
    if (this.isUpdating) return;
    if (cartState.isEmpty || cartState.items.length === 0) {
      this.slots = [];
      this.cleanupSelectHandlers();
      this.element.innerHTML = this.emptyTemplate;
      return;
    }
    const allPackages = useCampaignStore.getState().packages || [];
    this.slots = [];
    for (const item of cartState.items) {
      if (!this.matchesFilter(item.packageId, allPackages)) continue;
      for (let i = 0; i < item.quantity; i++) {
        this.slots.push({ packageId: item.packageId, cartItem: item });
      }
    }
    this.renderSlots();
  }
  matchesFilter(packageId, allPackages) {
    const { productId, packageIds } = this.slotFilter;
    if (packageIds && packageIds.length > 0 && !packageIds.includes(packageId)) return false;
    if (productId !== void 0) {
      const pkg = allPackages.find((p) => p.ref_id === packageId);
      if (!pkg || pkg.product_id !== productId) return false;
    }
    return true;
  }
  // ─── Rendering ─────────────────────────────────────────────────────────────
  renderSlots() {
    this.cleanupSelectHandlers();
    const allPackages = useCampaignStore.getState().packages || [];
    this.element.innerHTML = "";
    this.slots.forEach((slot, index) => {
      const pkg = allPackages.find((p) => p.ref_id === slot.packageId);
      if (!pkg) return;
      const wrapper = this.createSlotElement(slot, index, pkg);
      const placeholder = wrapper.querySelector("[data-next-variant-selectors]");
      if (placeholder) {
        this.renderVariantSelectors(placeholder, index, pkg, allPackages);
      }
      this.element.appendChild(wrapper);
    });
  }
  createSlotElement(slot, index, pkg) {
    const ci = slot.cartItem;
    const unitPrice = ci.unit_price || ci.price_per_unit || pkg.price || "";
    const unitPriceBeforeDiscount = ci.price_per_unit || pkg.price || "";
    const retailPrice = ci.price_retail || pkg.price_retail || "";
    const numPrice = parseFloat(unitPrice);
    const numBeforeDiscount = parseFloat(unitPriceBeforeDiscount);
    const savingAmount = !isNaN(numPrice) && !isNaN(numBeforeDiscount) && numBeforeDiscount > numPrice ? formatCurrency(numBeforeDiscount - numPrice) : "";
    const percentOff = !isNaN(numPrice) && !isNaN(numBeforeDiscount) && numBeforeDiscount > 0 ? String(Math.round((numBeforeDiscount - numPrice) / numBeforeDiscount * 100)) : "";
    const vars = {
      "slot.index": String(index + 1),
      "item.packageId": String(slot.packageId),
      "item.name": pkg.name || "",
      "item.image": pkg.image || ci.image || "",
      // Cart-accurate prices
      "item.price": unitPrice,
      "item.unitPrice": unitPrice,
      "item.unitPriceBeforeDiscount": unitPriceBeforeDiscount,
      "item.retailPrice": retailPrice,
      "item.packagePrice": ci.package_price || ci.price_total || pkg.price_total || "",
      "item.packagePriceBeforeDiscount": ci.price_total || pkg.price_total || "",
      // Savings
      "item.savingAmount": savingAmount,
      "item.percentOff": percentOff,
      // Variant / product info
      "item.variantName": pkg.product_variant_name || "",
      "item.productName": pkg.product_name || ""
    };
    const wrapper = document.createElement("div");
    wrapper.className = "next-slot-item";
    wrapper.dataset.nextSlotIndex = String(index);
    wrapper.innerHTML = this.template.replace(/\{([^}]+)\}/g, (_, key) => vars[key] ?? "");
    return wrapper;
  }
  // ─── Variant selectors ──────────────────────────────────────────────────────
  renderVariantSelectors(container, slotIndex, currentPkg, allPackages) {
    const productId = currentPkg.product_id;
    if (!productId) return;
    const productPkgs = allPackages.filter((p) => p.product_id === productId);
    const currentAttrs = currentPkg.product_variant_attribute_values || [];
    if (currentAttrs.length === 0) return;
    const attrDefs = /* @__PURE__ */ new Map();
    for (const pkg of productPkgs) {
      for (const attr of pkg.product_variant_attribute_values || []) {
        if (!attrDefs.has(attr.code)) {
          attrDefs.set(attr.code, attr.name);
        }
      }
    }
    const selected = {};
    for (const attr of currentAttrs) {
      selected[attr.code] = attr.value;
    }
    container.innerHTML = "";
    for (const [code, name] of attrDefs) {
      const values = [
        ...new Set(
          productPkgs.flatMap(
            (p) => (p.product_variant_attribute_values || []).filter((a) => a.code === code).map((a) => a.value)
          )
        )
      ];
      if (this.variantOptionTemplate) {
        this.renderCustomOptions(container, slotIndex, code, name, values, selected[code] ?? "");
      } else {
        const field = document.createElement("div");
        field.className = "next-slot-variant-field";
        const label = document.createElement("label");
        label.className = "next-slot-variant-label";
        label.textContent = `Select ${name}:`;
        const select = document.createElement("select");
        select.className = "next-slot-variant-select";
        select.dataset.variantCode = code;
        select.dataset.slotIndex = String(slotIndex);
        for (const value of values) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value;
          if (value === selected[code]) option.selected = true;
          select.appendChild(option);
        }
        const handler = () => this.handleVariantChange(slotIndex, productPkgs);
        this.selectHandlers.set(select, handler);
        select.addEventListener("change", handler);
        field.appendChild(label);
        field.appendChild(select);
        container.appendChild(field);
      }
    }
  }
  renderCustomOptions(container, slotIndex, code, name, values, selectedValue) {
    const group = document.createElement("div");
    group.className = "next-slot-variant-group";
    group.dataset.variantCode = code;
    group.dataset.variantName = name;
    for (const value of values) {
      const isSelected = value === selectedValue;
      const vars = {
        "attr.code": code,
        "attr.name": name,
        "option.value": value,
        "option.selected": String(isSelected)
      };
      const html = this.variantOptionTemplate.replace(
        /\{([^}]+)\}/g,
        (_, k) => vars[k] ?? ""
      );
      const temp = document.createElement("div");
      temp.innerHTML = html.trim();
      const el = temp.firstElementChild;
      if (!el) continue;
      el.dataset.nextVariantOption = code;
      el.dataset.nextVariantValue = value;
      el.dataset.nextSlotIndex = String(slotIndex);
      if (isSelected) {
        el.setAttribute("data-selected", "true");
        el.classList.add("next-variant-selected");
      }
      group.appendChild(el);
    }
    container.appendChild(group);
  }
  // ─── Variant change → cart update ──────────────────────────────────────────
  /** Delegated click handler for custom variant option elements. */
  handleVariantOptionClick(e) {
    const target = e.target;
    const optionEl = target.closest("[data-next-variant-option]");
    if (!optionEl) return;
    const code = optionEl.dataset.nextVariantOption;
    const value = optionEl.dataset.nextVariantValue;
    const slotIndex = Number(optionEl.dataset.nextSlotIndex);
    if (!code || !value) return;
    const group = optionEl.closest("[data-variant-code]");
    if (group) {
      group.querySelectorAll("[data-next-variant-option]").forEach((el) => {
        el.removeAttribute("data-selected");
        el.classList.remove("next-variant-selected");
      });
      optionEl.setAttribute("data-selected", "true");
      optionEl.classList.add("next-variant-selected");
    }
    const slotEl = this.element.querySelector(
      `[data-next-slot-index="${slotIndex}"]`
    );
    if (!slotEl) return;
    const selectedAttrs = {};
    slotEl.querySelectorAll("[data-variant-code]").forEach((g) => {
      const attrCode = g.dataset.variantCode;
      const sel = g.querySelector('[data-next-variant-option][data-selected="true"]');
      if (sel?.dataset.nextVariantValue) {
        selectedAttrs[attrCode] = sel.dataset.nextVariantValue;
      }
    });
    const allPackages = useCampaignStore.getState().packages || [];
    const currentPkg = allPackages.find((p) => p.ref_id === this.slots[slotIndex]?.packageId);
    if (!currentPkg) return;
    const productPkgs = allPackages.filter((p) => p.product_id === currentPkg.product_id);
    const matched = productPkgs.find((pkg) => {
      const attrs = pkg.product_variant_attribute_values || [];
      return Object.entries(selectedAttrs).every(
        ([c, v]) => attrs.some((a) => a.code === c && a.value === v)
      );
    });
    if (!matched) {
      this.logger.warn("No package found for variant combination", selectedAttrs);
      return;
    }
    const slot = this.slots[slotIndex];
    if (!slot || slot.packageId === matched.ref_id) return;
    slot.packageId = matched.ref_id;
    void this.syncCart();
  }
  async handleVariantChange(slotIndex, productPkgs) {
    const slotEl = this.element.querySelector(
      `[data-next-slot-index="${slotIndex}"]`
    );
    if (!slotEl) return;
    const selectedAttrs = {};
    slotEl.querySelectorAll("select[data-variant-code]").forEach((sel) => {
      if (sel.dataset.variantCode) {
        selectedAttrs[sel.dataset.variantCode] = sel.value;
      }
    });
    slotEl.querySelectorAll("select.next-slot-variant-select").forEach((sel) => {
      if (sel.dataset.variantCode) {
        selectedAttrs[sel.dataset.variantCode] = sel.value;
      }
    });
    const matched = productPkgs.find((pkg) => {
      const attrs = pkg.product_variant_attribute_values || [];
      return Object.entries(selectedAttrs).every(
        ([code, value]) => attrs.some((a) => a.code === code && a.value === value)
      );
    });
    if (!matched) {
      this.logger.warn("No package found for variant combination", selectedAttrs);
      return;
    }
    const slot = this.slots[slotIndex];
    if (!slot || slot.packageId === matched.ref_id) return;
    slot.packageId = matched.ref_id;
    await this.syncCart();
  }
  async syncCart() {
    this.isUpdating = true;
    try {
      const qtyCounts = /* @__PURE__ */ new Map();
      for (const slot of this.slots) {
        qtyCounts.set(slot.packageId, (qtyCounts.get(slot.packageId) ?? 0) + 1);
      }
      const items = Array.from(qtyCounts.entries()).map(([packageId, quantity]) => ({
        packageId,
        quantity
      }));
      await useCartStore.getState().swapCart(items);
      this.logger.debug("Cart synced from slot variant change", items);
    } catch (error) {
      this.handleError(error, "syncCart");
    } finally {
      this.isUpdating = false;
    }
  }
  // ─── Cleanup ────────────────────────────────────────────────────────────────
  cleanupSelectHandlers() {
    this.selectHandlers.forEach(
      (handler, select) => select.removeEventListener("change", handler)
    );
    this.selectHandlers.clear();
  }
  cleanupEventListeners() {
    this.cleanupSelectHandlers();
    if (this.boundVariantOptionClick) {
      this.element.removeEventListener("click", this.boundVariantOptionClick);
    }
  }
  destroy() {
    this.cleanupSelectHandlers();
    if (this.boundVariantOptionClick) {
      this.element.removeEventListener("click", this.boundVariantOptionClick);
      this.boundVariantOptionClick = null;
    }
    super.destroy();
  }
}
export {
  CartItemSlotsEnhancer
};
