import { B as BaseEnhancer } from "./index-WbFNZle8.js";
import { u as useCartStore, a as useCheckoutStore } from "./analytics-BuAKAb38.js";
import { u as useCampaignStore, A as calculateBundlePrice, B as buildCartTotals } from "./utils-CQa_9vcu.js";
class BundleSelectorEnhancer extends BaseEnhancer {
  constructor() {
    super(...arguments);
    this.mode = "swap";
    this.template = "";
    this.slotTemplate = "";
    this.variantOptionTemplate = "";
    this.cards = [];
    this.selectedCard = null;
    this.clickHandlers = /* @__PURE__ */ new Map();
    this.selectHandlers = /* @__PURE__ */ new Map();
    this.mutationObserver = null;
    this.boundVariantOptionClick = null;
    this.boundCurrencyChangeHandler = null;
    this.isApplying = false;
    this.includeShipping = false;
    this.previewLines = /* @__PURE__ */ new Map();
    this.currencyChangeTimeout = null;
  }
  async initialize() {
    this.validateElement();
    this.mode = this.getAttribute("data-next-selection-mode") ?? "swap";
    this.includeShipping = this.getAttribute("data-next-include-shipping") === "true";
    const templateId = this.getAttribute("data-next-bundle-template-id");
    if (templateId) {
      this.template = document.getElementById(templateId)?.innerHTML.trim() ?? "";
    } else {
      this.template = this.getAttribute("data-next-bundle-template") ?? "";
    }
    const slotTemplateId = this.getAttribute("data-next-bundle-slot-template-id");
    if (slotTemplateId) {
      this.slotTemplate = document.getElementById(slotTemplateId)?.innerHTML.trim() ?? "";
    } else {
      this.slotTemplate = this.getAttribute("data-next-bundle-slot-template") ?? "";
    }
    const variantOptionTemplateId = this.getAttribute("data-next-variant-option-template-id");
    if (variantOptionTemplateId) {
      this.variantOptionTemplate = document.getElementById(variantOptionTemplateId)?.innerHTML.trim() ?? "";
    }
    const bundlesAttr = this.getAttribute("data-next-bundles");
    if (bundlesAttr && this.template) {
      try {
        const parsed = JSON.parse(bundlesAttr);
        if (!Array.isArray(parsed)) {
          this.logger.warn("data-next-bundles must be a JSON array, ignoring auto-render");
        } else {
          this.element.innerHTML = "";
          for (const def of parsed) {
            const el = this.renderBundleTemplate(def);
            if (el) this.element.appendChild(el);
          }
        }
      } catch {
        this.logger.warn("Invalid JSON in data-next-bundles, ignoring auto-render", bundlesAttr);
      }
    }
    if (this.slotTemplate) {
      const handler = this.handleVariantOptionClick.bind(this);
      this.boundVariantOptionClick = handler;
      this.element.addEventListener("click", handler);
    }
    this.scanCards();
    this.setupMutationObserver();
    this.subscribe(useCartStore, this.syncWithCart.bind(this));
    this.syncWithCart(useCartStore.getState());
    let prevCheckoutVouchers = useCheckoutStore.getState().vouchers;
    this.subscribe(useCheckoutStore, (state) => {
      const next = state.vouchers;
      if (next.length !== prevCheckoutVouchers.length || next.some((v, i) => v !== prevCheckoutVouchers[i])) {
        prevCheckoutVouchers = next;
        for (const card of this.cards) {
          void this.fetchAndUpdateBundlePrice(card);
        }
      }
    });
    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null) clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const card of this.cards) {
          void this.fetchAndUpdateBundlePrice(card);
        }
      }, 150);
    };
    document.addEventListener("next:currency-changed", this.boundCurrencyChangeHandler);
    for (const card of this.cards) {
      void this.fetchAndUpdateBundlePrice(card);
    }
    this.logger.debug("BundleSelectorEnhancer initialized", {
      mode: this.mode,
      cardCount: this.cards.length
    });
  }
  // ─── Bundle card template rendering ──────────────────────────────────────────
  renderBundleTemplate(bundle) {
    const vars = {};
    for (const [key, value] of Object.entries(bundle)) {
      if (key !== "items") {
        vars[`bundle.${key}`] = value != null ? String(value) : "";
      }
    }
    const html = this.template.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? "");
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html.trim();
    const firstChild = wrapper.firstElementChild;
    const cardEl = wrapper.querySelector("[data-next-bundle-card]") ?? (firstChild instanceof HTMLElement ? firstChild : null);
    if (!cardEl) {
      this.logger.warn("Bundle template produced no root element for bundle", bundle.id);
      return null;
    }
    cardEl.setAttribute("data-next-bundle-card", "");
    cardEl.setAttribute("data-next-bundle-id", bundle.id);
    cardEl.setAttribute("data-next-bundle-items", JSON.stringify(bundle.items));
    if (bundle.vouchers?.length) {
      cardEl.setAttribute("data-next-bundle-vouchers", JSON.stringify(bundle.vouchers));
    }
    return cardEl;
  }
  // ─── Card registration ────────────────────────────────────────────────────────
  scanCards() {
    this.element.querySelectorAll("[data-next-bundle-card]").forEach((el) => {
      if (!this.cards.find((c) => c.element === el)) this.registerCard(el);
    });
  }
  registerCard(el) {
    const bundleId = el.getAttribute("data-next-bundle-id");
    if (!bundleId) {
      this.logger.warn("Bundle card is missing data-next-bundle-id", el);
      return;
    }
    const itemsAttr = el.getAttribute("data-next-bundle-items");
    if (!itemsAttr) {
      this.logger.warn(`Bundle card "${bundleId}" is missing data-next-bundle-items`, el);
      return;
    }
    let items;
    try {
      items = JSON.parse(itemsAttr);
    } catch {
      this.logger.warn(`Invalid JSON in data-next-bundle-items for bundle "${bundleId}"`, el);
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      this.logger.warn(`Bundle "${bundleId}" has no items`, el);
      return;
    }
    const isPreSelected = el.getAttribute("data-next-selected") === "true";
    const vouchers = this.parseVouchers(el.getAttribute("data-next-bundle-vouchers"));
    const slots = [];
    let slotIdx = 0;
    for (const item of items) {
      if (item.configurable && item.quantity > 1) {
        for (let u = 0; u < item.quantity; u++) {
          slots.push({
            slotIndex: slotIdx++,
            unitIndex: u,
            originalPackageId: item.packageId,
            activePackageId: item.packageId,
            quantity: 1,
            noSlot: item.noSlot
          });
        }
      } else {
        slots.push({
          slotIndex: slotIdx++,
          unitIndex: 0,
          originalPackageId: item.packageId,
          activePackageId: item.packageId,
          quantity: item.quantity,
          noSlot: item.noSlot
        });
      }
    }
    const card = { element: el, bundleId, items, slots, isPreSelected, vouchers };
    this.cards.push(card);
    el.classList.add("next-bundle-card");
    if (this.slotTemplate) {
      this.renderSlotsForCard(card);
    }
    const handler = (e) => {
      const target = e.target;
      if (target.closest("select, [data-next-variant-option]")) return;
      void this.handleCardClick(e, card);
    };
    this.clickHandlers.set(el, handler);
    el.addEventListener("click", handler);
    this.logger.debug(`Registered bundle card "${bundleId}"`, { itemCount: items.length });
  }
  setupMutationObserver() {
    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "childList") continue;
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.hasAttribute("data-next-bundle-card")) {
            if (!this.cards.find((c) => c.element === node)) this.registerCard(node);
          }
          node.querySelectorAll("[data-next-bundle-card]").forEach((el) => {
            if (!this.cards.find((c) => c.element === el)) this.registerCard(el);
          });
        });
      }
    });
    this.mutationObserver.observe(this.element, { childList: true, subtree: true });
  }
  // ─── Slot rendering ───────────────────────────────────────────────────────────
  renderSlotsForCard(card) {
    const placeholder = card.element.querySelector("[data-next-bundle-slots]");
    if (!placeholder) return;
    placeholder.querySelectorAll("select").forEach((s) => {
      const h = this.selectHandlers.get(s);
      if (h) {
        s.removeEventListener("change", h);
        this.selectHandlers.delete(s);
      }
    });
    const allPackages = useCampaignStore.getState().packages || [];
    placeholder.innerHTML = "";
    const cartState = useCartStore.getState();
    const effectiveItems = this.getEffectiveItems(card);
    const isInCart = effectiveItems.every((bi) => {
      const ci = cartState.items.find((i) => i.packageId === bi.packageId);
      return ci != null && ci.quantity >= bi.quantity;
    });
    for (const slot of card.slots) {
      if (slot.noSlot) continue;
      const pkg = allPackages.find((p) => p.ref_id === slot.activePackageId);
      if (!pkg) continue;
      const slotEl = this.createSlotElement(card.bundleId, slot, pkg, isInCart);
      const variantPlaceholder = slotEl.querySelector("[data-next-variant-selectors]");
      if (variantPlaceholder && (pkg.product_variant_attribute_values?.length ?? 0) > 0) {
        this.renderVariantSelectors(variantPlaceholder, card.bundleId, slot.slotIndex, pkg, allPackages);
      }
      placeholder.appendChild(slotEl);
    }
  }
  createSlotElement(bundleId, slot, pkg, isInCart = false) {
    const summaryLine = isInCart ? useCartStore.getState().summary?.lines.find((l) => l.package_id === slot.activePackageId) : this.previewLines.get(bundleId)?.find((l) => l.package_id === slot.activePackageId);
    const hasDiscount = summaryLine ? parseFloat(summaryLine.total_discount) > 0 : false;
    const hasSavings = summaryLine?.price_retail_total != null ? parseFloat(summaryLine.price_retail_total) > parseFloat(summaryLine.package_price) : pkg.price_retail != null && pkg.price_retail !== pkg.price;
    const vars = {
      // Slot position
      "slot.index": String(slot.slotIndex + 1),
      "slot.unitIndex": String(slot.unitIndex),
      "slot.unitNumber": String(slot.unitIndex + 1),
      // Package identity
      "item.packageId": String(slot.activePackageId),
      "item.name": pkg.name || "",
      "item.image": pkg.image || "",
      "item.quantity": String(slot.quantity),
      "item.variantName": pkg.product_variant_name || "",
      "item.productName": pkg.product_name || "",
      "item.sku": pkg.product_sku || "",
      "item.qty": String(pkg.qty ?? 1),
      // Campaign prices (formatted strings, before any offer discounts)
      "item.price": pkg.price || "",
      "item.priceTotal": pkg.price_total || "",
      "item.priceRetail": pkg.price_retail || "",
      "item.priceRetailTotal": pkg.price_retail_total || "",
      "item.priceRecurring": pkg.price_recurring || "",
      "item.isRecurring": pkg.is_recurring ? "true" : "false",
      // API summary prices (reflect applied offer/coupon discounts)
      "item.unitPrice": summaryLine?.unit_price ?? pkg.price ?? "",
      "item.originalUnitPrice": summaryLine?.original_unit_price ?? pkg.price ?? "",
      "item.packagePrice": summaryLine?.package_price ?? pkg.price_total ?? "",
      "item.originalPackagePrice": summaryLine?.original_package_price ?? pkg.price_total ?? "",
      "item.subtotal": summaryLine?.subtotal ?? "",
      "item.totalDiscount": summaryLine?.total_discount ?? "0",
      "item.total": summaryLine?.total ?? pkg.price_total ?? "",
      // Conditional helpers
      "item.hasDiscount": hasDiscount ? "show" : "hide",
      "item.hasSavings": hasSavings ? "show" : "hide"
    };
    const wrapper = document.createElement("div");
    wrapper.className = "next-bundle-slot";
    wrapper.dataset.nextBundleId = bundleId;
    wrapper.dataset.nextSlotIndex = String(slot.slotIndex);
    wrapper.innerHTML = this.slotTemplate.replace(/\{([^}]+)\}/g, (_, key) => vars[key] ?? "");
    return wrapper;
  }
  // ─── Variant selector rendering ───────────────────────────────────────────────
  renderVariantSelectors(container, bundleId, slotIndex, currentPkg, allPackages) {
    const productId = currentPkg.product_id;
    if (!productId) return;
    const productPkgs = allPackages.filter((p) => p.product_id === productId);
    const currentAttrs = currentPkg.product_variant_attribute_values || [];
    if (currentAttrs.length === 0) return;
    const attrDefs = /* @__PURE__ */ new Map();
    for (const pkg of productPkgs) {
      for (const attr of pkg.product_variant_attribute_values || []) {
        if (!attrDefs.has(attr.code)) attrDefs.set(attr.code, attr.name);
      }
    }
    const selected = {};
    for (const attr of currentAttrs) selected[attr.code] = attr.value;
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
        this.renderCustomOptions(container, bundleId, slotIndex, code, name, values, selected[code] ?? "", productPkgs, selected);
      } else {
        const field = document.createElement("div");
        field.className = "next-slot-variant-field";
        const label = document.createElement("label");
        label.className = "next-slot-variant-label";
        label.textContent = `${name}:`;
        const select = document.createElement("select");
        select.className = "next-slot-variant-select";
        select.dataset.variantCode = code;
        for (const value of values) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value;
          if (value === selected[code]) option.selected = true;
          if (!this.isVariantValueAvailable(value, code, productPkgs, selected)) {
            option.disabled = true;
          }
          select.appendChild(option);
        }
        const handler = () => void this.handleSelectVariantChange(select, bundleId, slotIndex);
        this.selectHandlers.set(select, handler);
        select.addEventListener("change", handler);
        field.appendChild(label);
        field.appendChild(select);
        container.appendChild(field);
      }
    }
  }
  isVariantValueAvailable(value, code, productPkgs, allSelectedAttrs) {
    return productPkgs.some((pkg) => {
      if (pkg.product_purchase_availability === "unavailable") return false;
      const attrs = pkg.product_variant_attribute_values || [];
      if (!attrs.some((a) => a.code === code && a.value === value)) return false;
      return Object.entries(allSelectedAttrs).filter(([c]) => c !== code).every(([c, v]) => attrs.some((a) => a.code === c && a.value === v));
    });
  }
  renderCustomOptions(container, bundleId, slotIndex, code, name, values, selectedValue, productPkgs, allSelectedAttrs) {
    const group = document.createElement("div");
    group.className = "next-slot-variant-group";
    group.dataset.variantCode = code;
    group.dataset.variantName = name;
    group.dataset.nextBundleId = bundleId;
    group.dataset.nextSlotIndex = String(slotIndex);
    for (const value of values) {
      const isSelected = value === selectedValue;
      const isAvailable = this.isVariantValueAvailable(value, code, productPkgs, allSelectedAttrs);
      const vars = {
        "attr.code": code,
        "attr.name": name,
        "option.value": value,
        "option.selected": String(isSelected),
        "option.available": String(isAvailable)
      };
      const html = this.variantOptionTemplate.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? "");
      const temp = document.createElement("div");
      temp.innerHTML = html.trim();
      const first = temp.firstElementChild;
      const el = first instanceof HTMLElement ? first : null;
      if (!el) continue;
      el.dataset.nextVariantOption = code;
      el.dataset.nextVariantValue = value;
      if (isSelected) {
        el.setAttribute("data-selected", "true");
        el.classList.add("next-variant-selected");
      }
      if (!isAvailable) {
        el.dataset.nextUnavailable = "true";
        el.classList.add("next-variant-unavailable");
      }
      group.appendChild(el);
    }
    container.appendChild(group);
  }
  // ─── Variant change handlers ──────────────────────────────────────────────────
  /** Delegated click handler for custom variant option elements. */
  handleVariantOptionClick(e) {
    const target = e.target;
    const optionEl = target.closest("[data-next-variant-option]");
    if (!optionEl) return;
    if (optionEl.dataset.nextUnavailable === "true") return;
    const code = optionEl.dataset.nextVariantOption;
    const value = optionEl.dataset.nextVariantValue;
    if (!code || !value) return;
    const group = optionEl.closest("[data-variant-code]");
    if (!group) return;
    const bundleId = group.dataset.nextBundleId;
    const slotIndex = Number(group.dataset.nextSlotIndex);
    if (!bundleId) return;
    const card = this.cards.find((c) => c.bundleId === bundleId);
    if (!card) return;
    group.querySelectorAll("[data-next-variant-option]").forEach((el) => {
      el.removeAttribute("data-selected");
      el.classList.remove("next-variant-selected");
    });
    optionEl.setAttribute("data-selected", "true");
    optionEl.classList.add("next-variant-selected");
    const slotEl = card.element.querySelector(`[data-next-slot-index="${slotIndex}"]`);
    if (!slotEl) return;
    const selectedAttrs = {};
    slotEl.querySelectorAll("[data-variant-code]").forEach((g) => {
      const attrCode = g.dataset.variantCode;
      if (!attrCode) return;
      const sel = g.querySelector('[data-next-variant-option][data-selected="true"]');
      if (sel?.dataset.nextVariantValue) selectedAttrs[attrCode] = sel.dataset.nextVariantValue;
    });
    void this.applyVariantChange(card, slotIndex, selectedAttrs);
  }
  async handleSelectVariantChange(select, bundleId, slotIndex) {
    const card = this.cards.find((c) => c.bundleId === bundleId);
    if (!card) return;
    const slotEl = card.element.querySelector(`[data-next-slot-index="${slotIndex}"]`);
    if (!slotEl) return;
    const selectedAttrs = {};
    slotEl.querySelectorAll("select[data-variant-code]").forEach((s) => {
      if (s.dataset.variantCode) selectedAttrs[s.dataset.variantCode] = s.value;
    });
    await this.applyVariantChange(card, slotIndex, selectedAttrs);
  }
  async applyVariantChange(card, slotIndex, selectedAttrs) {
    if (this.isApplying) return;
    const slot = card.slots[slotIndex];
    if (!slot) return;
    const allPackages = useCampaignStore.getState().packages || [];
    const currentPkg = allPackages.find((p) => p.ref_id === slot.activePackageId);
    if (!currentPkg?.product_id) return;
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
    if (slot.activePackageId === matched.ref_id) return;
    slot.activePackageId = matched.ref_id;
    this.renderSlotsForCard(card);
    if (this.mode === "swap" && this.selectedCard === card) {
      await this.applyEffectiveChange(card);
    }
    void this.fetchAndUpdateBundlePrice(card);
    this.logger.debug(
      `Variant changed on bundle "${card.bundleId}" slot ${slotIndex}`,
      { packageId: matched.ref_id }
    );
  }
  // ─── Selection & cart update ──────────────────────────────────────────────────
  async handleCardClick(e, card) {
    e.preventDefault();
    if (this.selectedCard === card) return;
    const previous = this.selectedCard;
    this.selectCard(card);
    this.emit("bundle:selected", { bundleId: card.bundleId, items: this.getEffectiveItems(card) });
    if (card.vouchers.length || previous?.vouchers.length) {
      await this.applyVoucherSwap(previous, card);
    }
    if (this.mode === "swap") {
      await this.applyBundle(previous, card);
    }
  }
  selectCard(card) {
    this.cards.forEach((c) => {
      c.element.classList.remove("next-selected");
      c.element.setAttribute("data-next-selected", "false");
    });
    card.element.classList.add("next-selected");
    card.element.setAttribute("data-next-selected", "true");
    this.selectedCard = card;
    this.element.setAttribute("data-selected-bundle", card.bundleId);
    this.emit("bundle:selection-changed", { bundleId: card.bundleId, items: this.getEffectiveItems(card) });
  }
  /**
   * Returns the currently active cart items for a bundle card, accounting for
   * any variant selections the user has made in the slot rows.
   */
  getEffectiveItems(card) {
    const qtyCounts = /* @__PURE__ */ new Map();
    for (const slot of card.slots) {
      qtyCounts.set(
        slot.activePackageId,
        (qtyCounts.get(slot.activePackageId) ?? 0) + slot.quantity
      );
    }
    return Array.from(qtyCounts.entries()).map(([packageId, quantity]) => ({ packageId, quantity }));
  }
  /**
   * Apply a bundle to the cart.
   *
   * - Swapping from a previous bundle: strips previous bundle's packages and
   *   replaces them with the new bundle, leaving unrelated items untouched.
   * - First selection (no previous): replaces the entire cart with the bundle's items.
   *
   * Uses getEffectiveItems() so variant selections are respected.
   */
  async applyBundle(previous, selected) {
    const cartStore = useCartStore.getState();
    const newItems = this.getEffectiveItems(selected).map((i) => ({ ...i, bundleId: selected.bundleId }));
    try {
      if (previous) {
        const retained = cartStore.items.filter((ci) => ci.bundleId !== previous.bundleId).map((ci) => ({ packageId: ci.packageId, quantity: ci.quantity, isUpsell: ci.is_upsell, bundleId: ci.bundleId }));
        await cartStore.swapCart([...retained, ...newItems]);
      } else {
        await cartStore.swapCart(newItems);
      }
      this.logger.debug(`Applied bundle "${selected.bundleId}"`, newItems);
    } catch (error) {
      if (previous) {
        this.selectCard(previous);
      } else {
        selected.element.classList.remove("next-selected");
        selected.element.setAttribute("data-next-selected", "false");
        this.selectedCard = null;
        this.element.removeAttribute("data-selected-bundle");
      }
      this.handleError(error, "applyBundle");
    }
  }
  /**
   * Called when the user changes a variant on the currently selected bundle.
   * Swaps the previous effective items out and the new ones in.
   */
  async applyEffectiveChange(card) {
    if (this.isApplying) return;
    this.isApplying = true;
    try {
      const cartStore = useCartStore.getState();
      const retained = cartStore.items.filter((ci) => ci.bundleId !== card.bundleId).map((ci) => ({ packageId: ci.packageId, quantity: ci.quantity, isUpsell: ci.is_upsell, bundleId: ci.bundleId }));
      const newItems = this.getEffectiveItems(card).map((i) => ({ ...i, bundleId: card.bundleId }));
      await cartStore.swapCart([...retained, ...newItems]);
      this.logger.debug(`Variant change synced for bundle "${card.bundleId}"`, newItems);
    } catch (error) {
      this.handleError(error, "applyEffectiveChange");
    } finally {
      this.isApplying = false;
    }
  }
  // ─── Backend price calculation ────────────────────────────────────────────────
  async fetchAndUpdateBundlePrice(card) {
    const items = this.getEffectiveItems(card);
    const currency = useCampaignStore.getState().data?.currency ?? null;
    card.element.classList.add("next-loading");
    card.element.setAttribute("data-next-loading", "true");
    try {
      const checkoutVouchers = useCheckoutStore.getState().vouchers;
      const merged = [.../* @__PURE__ */ new Set([...checkoutVouchers, ...card.vouchers])];
      const vouchers = merged.length ? merged : void 0;
      const { totals, summary } = await calculateBundlePrice(items, { currency, exclude_shipping: !this.includeShipping, vouchers });
      const currentItems = this.getEffectiveItems(card);
      if (currentItems.length !== items.length || currentItems.some((ci, i) => ci.packageId !== items[i].packageId || ci.quantity !== items[i].quantity)) {
        return;
      }
      this.previewLines.set(card.bundleId, summary.lines);
      if (this.slotTemplate) this.renderSlotsForCard(card);
      const campaignPackages = useCampaignStore.getState().packages;
      const retailCompareTotal = items.reduce((sum, item) => {
        const pkg = campaignPackages.find((p) => p.ref_id === item.packageId);
        if (!pkg?.price_retail) return sum;
        return sum + parseFloat(pkg.price_retail) * item.quantity;
      }, 0);
      const effectiveTotals = retailCompareTotal > 0 ? buildCartTotals(summary, { exclude_shipping: !this.includeShipping, compareTotal: retailCompareTotal }) : totals;
      card.element.querySelectorAll("[data-next-bundle-price]").forEach((el) => {
        const field = el.getAttribute("data-next-bundle-price") || "total";
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
          case "totalExclShipping":
            el.textContent = effectiveTotals.totalExclShipping.formatted;
            break;
          default:
            el.textContent = effectiveTotals.total.formatted;
            break;
        }
      });
    } catch (error) {
      this.logger.warn(`Failed to fetch bundle price for "${card.bundleId}"`, error);
    } finally {
      card.element.classList.remove("next-loading");
      card.element.setAttribute("data-next-loading", "false");
    }
  }
  // ─── Voucher helpers ──────────────────────────────────────────────────────────
  parseVouchers(attr) {
    if (!attr) return [];
    const trimmed = attr.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
      } catch {
        this.logger.warn("Invalid JSON in data-next-bundle-vouchers", attr);
        return [];
      }
    }
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
  async applyVoucherSwap(previous, next) {
    const { useCheckoutStore: useCheckoutStore2 } = await import("./analytics-BuAKAb38.js").then((n) => n.e);
    const checkoutStore = useCheckoutStore2.getState();
    const toRemove = previous?.vouchers ?? [];
    const toApply = next.vouchers;
    for (const code of toRemove) {
      if (!toApply.includes(code)) checkoutStore.removeVoucher(code);
    }
    for (const code of toApply) {
      const current = useCheckoutStore2.getState().vouchers;
      if (!current.includes(code)) checkoutStore.addVoucher(code);
    }
  }
  // ─── Cart sync ────────────────────────────────────────────────────────────────
  syncWithCart(cartState) {
    for (const card of this.cards) {
      const effectiveItems = this.getEffectiveItems(card);
      const allItemsInCart = effectiveItems.every((bi) => {
        const ci = cartState.items.find((i) => i.packageId === bi.packageId);
        return ci != null && ci.quantity >= bi.quantity;
      });
      card.element.classList.toggle("next-in-cart", allItemsInCart);
      card.element.setAttribute("data-next-in-cart", String(allItemsInCart));
      if (this.slotTemplate && !this.isApplying) {
        this.renderSlotsForCard(card);
      }
    }
    if (!this.selectedCard) {
      const preSelected = this.cards.find((c) => c.isPreSelected);
      if (preSelected) {
        this.selectCard(preSelected);
        const initVouchers = preSelected.vouchers.length ? this.applyVoucherSwap(null, preSelected) : Promise.resolve();
        if (this.mode === "swap") {
          void initVouchers.then(() => this.applyBundle(null, preSelected));
        }
      }
    }
  }
  // ─── BaseEnhancer ──────────────────────────────────────────────────────────────
  update() {
    this.syncWithCart(useCartStore.getState());
  }
  getSelectedCard() {
    return this.selectedCard;
  }
  cleanupEventListeners() {
    this.clickHandlers.forEach((h, el) => el.removeEventListener("click", h));
    this.clickHandlers.clear();
    this.selectHandlers.forEach((h, sel) => sel.removeEventListener("change", h));
    this.selectHandlers.clear();
    if (this.boundVariantOptionClick) {
      this.element.removeEventListener("click", this.boundVariantOptionClick);
      this.boundVariantOptionClick = null;
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
      (c) => c.element.classList.remove("next-bundle-card", "next-selected", "next-in-cart")
    );
    this.cards = [];
    super.destroy();
  }
}
export {
  BundleSelectorEnhancer
};
