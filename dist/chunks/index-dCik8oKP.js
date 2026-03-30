import { B as BaseEnhancer } from "./index-BzlW3G0-.js";
import { u as useCampaignStore, a as useCartStore, b as useCheckoutStore } from "./analytics-C593VfhV.js";
import { h as calculateBundlePrice, f as formatCurrency } from "./utils-CJHo6zrd.js";
function renderBundleTemplate(template, bundle, logger) {
  const vars = {};
  for (const [key, value] of Object.entries(bundle)) {
    if (key !== "items") {
      vars[`bundle.${key}`] = value != null ? String(value) : "";
    }
  }
  const html = template.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? "");
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  const firstChild = wrapper.firstElementChild;
  const cardEl = wrapper.querySelector("[data-next-bundle-card]") ?? (firstChild instanceof HTMLElement ? firstChild : null);
  if (!cardEl) {
    logger.warn("Bundle template produced no root element for bundle", bundle.id);
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
function renderSlotsForCard(card, ctx, targetEl) {
  const placeholder = targetEl ?? card.element.querySelector("[data-next-bundle-slots]");
  if (!placeholder) return;
  placeholder.querySelectorAll("select").forEach((s) => {
    const h = ctx.selectHandlers.get(s);
    if (h) {
      s.removeEventListener("change", h);
      ctx.selectHandlers.delete(s);
    }
  });
  const allPackages = useCampaignStore.getState().packages ?? [];
  placeholder.innerHTML = "";
  for (const slot of card.slots) {
    if (slot.noSlot) continue;
    const pkg = allPackages.find((p) => p.ref_id === slot.activePackageId);
    if (!pkg) continue;
    const slotEl = createSlotElement(card.bundleId, slot, pkg, ctx);
    const variantPlaceholder = slotEl.querySelector("[data-next-variant-selectors]");
    if (variantPlaceholder && (pkg.product_variant_attribute_values?.length ?? 0) > 0) {
      renderVariantSelectors(
        variantPlaceholder,
        card.bundleId,
        slot.slotIndex,
        pkg,
        allPackages,
        ctx
      );
    }
    placeholder.appendChild(slotEl);
  }
}
function createSlotElement(bundleId, slot, pkg, ctx) {
  const isInCart = (() => {
    const cartState = useCartStore.getState();
    const ci = cartState.items.find((i) => i.packageId === slot.activePackageId);
    return ci != null && ci.quantity >= slot.quantity;
  })();
  const summaryLine = isInCart ? useCartStore.getState().summary?.lines.find((l) => l.package_id === slot.activePackageId) : ctx.previewLines.get(bundleId)?.find((l) => l.package_id === slot.activePackageId);
  const hasDiscount = summaryLine ? parseFloat(summaryLine.total_discount) > 0 : false;
  const hasSavings = summaryLine?.price_retail_total != null ? parseFloat(summaryLine.price_retail_total) > parseFloat(summaryLine.package_price) : pkg.price_retail != null && pkg.price_retail !== pkg.price;
  const vars = {
    "slot.index": String(slot.slotIndex + 1),
    "slot.unitIndex": String(slot.unitIndex),
    "slot.unitNumber": String(slot.unitIndex + 1),
    "item.packageId": String(slot.activePackageId),
    "item.name": pkg.name || "",
    "item.image": pkg.image || "",
    "item.quantity": String(slot.quantity),
    "item.variantName": pkg.product_variant_name || "",
    "item.productName": pkg.product_name || "",
    "item.sku": pkg.product_sku || "",
    "item.qty": String(pkg.qty ?? 1),
    "item.price": pkg.price || "",
    "item.priceTotal": pkg.price_total || "",
    "item.priceRetail": pkg.price_retail || "",
    "item.priceRetailTotal": pkg.price_retail_total || "",
    "item.priceRecurring": pkg.price_recurring || "",
    "item.isRecurring": pkg.is_recurring ? "true" : "false",
    "item.unitPrice": summaryLine?.unit_price ?? pkg.price ?? "",
    "item.originalUnitPrice": summaryLine?.original_unit_price ?? pkg.price ?? "",
    "item.packagePrice": summaryLine?.package_price ?? pkg.price_total ?? "",
    "item.originalPackagePrice": summaryLine?.original_package_price ?? pkg.price_total ?? "",
    "item.subtotal": summaryLine?.subtotal ?? "",
    "item.totalDiscount": summaryLine?.total_discount ?? "0",
    "item.total": summaryLine?.total ?? pkg.price_total ?? "",
    "item.hasDiscount": hasDiscount ? "show" : "hide",
    "item.hasSavings": hasSavings ? "show" : "hide"
  };
  const wrapper = document.createElement("div");
  wrapper.className = ctx.classNames.bundleSlot;
  wrapper.dataset.nextBundleId = bundleId;
  wrapper.dataset.nextSlotIndex = String(slot.slotIndex);
  wrapper.innerHTML = ctx.slotTemplate.replace(/\{([^}]+)\}/g, (_, key) => vars[key] ?? "");
  return wrapper;
}
function renderVariantSelectors(container, bundleId, slotIndex, currentPkg, allPackages, ctx) {
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
    if (ctx.variantSelectorTemplate) {
      renderSelectorTemplate(
        container,
        bundleId,
        slotIndex,
        code,
        name,
        values,
        selected[code] ?? "",
        productPkgs,
        selected,
        ctx
      );
    } else if (ctx.variantOptionTemplate) {
      renderCustomOptions(
        container,
        bundleId,
        slotIndex,
        code,
        name,
        values,
        selected[code] ?? "",
        productPkgs,
        selected,
        ctx
      );
    } else {
      const field = document.createElement("div");
      field.className = "next-slot-variant-field";
      const label = document.createElement("label");
      label.className = "next-slot-variant-label";
      label.textContent = `${name}:`;
      const select = document.createElement("select");
      select.className = "next-slot-variant-select";
      select.dataset.nextVariantCode = code;
      for (const value of values) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        if (value === selected[code]) option.selected = true;
        if (!isVariantValueAvailable(value, code, productPkgs, selected)) {
          option.disabled = true;
        }
        select.appendChild(option);
      }
      const handler = () => void ctx.onSelectChange(select, bundleId, slotIndex);
      ctx.selectHandlers.set(select, handler);
      select.addEventListener("change", handler);
      field.appendChild(label);
      field.appendChild(select);
      container.appendChild(field);
    }
  }
}
function renderOptionItems(target, code, name, values, selectedValue, productPkgs, allSelectedAttrs, ctx) {
  for (const value of values) {
    const isSelected = value === selectedValue;
    const isAvailable = isVariantValueAvailable(value, code, productPkgs, allSelectedAttrs);
    const vars = {
      "attr.code": code,
      "attr.name": name,
      "option.value": value,
      "option.selected": String(isSelected),
      "option.available": String(isAvailable)
    };
    const html = ctx.variantOptionTemplate.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? "");
    const temp = document.createElement("div");
    temp.innerHTML = html.trim();
    const first = temp.firstElementChild;
    const el = first instanceof HTMLElement ? first : null;
    if (!el) continue;
    el.dataset.nextVariantOption = code;
    el.dataset.nextVariantValue = value;
    if (isSelected) {
      el.setAttribute("data-selected", "true");
      el.classList.add(ctx.classNames.variantSelected);
    }
    if (!isAvailable) {
      el.dataset.nextUnavailable = "true";
      el.classList.add(ctx.classNames.variantUnavailable);
      if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
        el.disabled = true;
      } else {
        el.setAttribute("aria-disabled", "true");
      }
    }
    target.appendChild(el);
  }
}
function renderCustomOptions(container, bundleId, slotIndex, code, name, values, selectedValue, productPkgs, allSelectedAttrs, ctx) {
  const group = document.createElement("div");
  group.className = ctx.classNames.slotVariantGroup;
  group.dataset.nextVariantCode = code;
  group.dataset.nextVariantName = name;
  group.dataset.nextBundleId = bundleId;
  group.dataset.nextSlotIndex = String(slotIndex);
  renderOptionItems(group, code, name, values, selectedValue, productPkgs, allSelectedAttrs, ctx);
  container.appendChild(group);
}
function renderSelectorTemplate(container, bundleId, slotIndex, code, name, values, selectedValue, productPkgs, allSelectedAttrs, ctx) {
  const vars = {
    "attr.code": code,
    "attr.name": name,
    "attr.selectedValue": selectedValue
  };
  const html = ctx.variantSelectorTemplate.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? "");
  const temp = document.createElement("div");
  temp.innerHTML = html.trim();
  const root = temp.firstElementChild;
  const el = root instanceof HTMLElement ? root : null;
  if (!el) {
    ctx.logger.warn("Variant selector template produced no root element for attribute", code);
    return;
  }
  el.dataset.nextVariantCode = code;
  el.dataset.nextBundleId = bundleId;
  el.dataset.nextSlotIndex = String(slotIndex);
  const optionsPlaceholder = el.querySelector("[data-next-variant-options]");
  if (optionsPlaceholder) {
    if (ctx.variantOptionTemplate) {
      renderOptionItems(
        optionsPlaceholder,
        code,
        name,
        values,
        selectedValue,
        productPkgs,
        allSelectedAttrs,
        ctx
      );
    } else {
      for (const value of values) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        if (value === selectedValue) option.selected = true;
        if (!isVariantValueAvailable(value, code, productPkgs, allSelectedAttrs)) {
          option.disabled = true;
        }
        optionsPlaceholder.appendChild(option);
      }
    }
  }
  container.appendChild(el);
}
function isVariantValueAvailable(value, code, productPkgs, allSelectedAttrs) {
  return productPkgs.some((pkg) => {
    if (pkg.product_purchase_availability === "unavailable") return false;
    const attrs = pkg.product_variant_attribute_values || [];
    if (!attrs.some((a) => a.code === code && a.value === value)) return false;
    return Object.entries(allSelectedAttrs).filter(([c]) => c !== code).every(([c, v]) => attrs.some((a) => a.code === c && a.value === v));
  });
}
async function handleCardClick(e, card, previousCard, ctx) {
  e.preventDefault();
  if (previousCard === card) return;
  ctx.selectCard(card);
  ctx.emit("bundle:selected", { bundleId: card.bundleId, items: ctx.getEffectiveItems(card) });
  if (card.vouchers.length || previousCard?.vouchers.length) {
    await applyVoucherSwap(previousCard, card);
  }
  if (ctx.mode === "swap") {
    await applyBundle(previousCard, card, ctx);
  }
}
async function applyBundle(previous, selected, ctx) {
  if (ctx.isApplyingRef.value) return;
  ctx.isApplyingRef.value = true;
  const cartStore = useCartStore.getState();
  const newItems = ctx.getEffectiveItems(selected).map((i) => ({
    ...i,
    bundleId: selected.bundleId
  }));
  try {
    if (previous) {
      const retained = cartStore.items.filter((ci) => ci.bundleId !== previous.bundleId).map((ci) => ({
        packageId: ci.packageId,
        quantity: ci.quantity,
        isUpsell: ci.is_upsell,
        bundleId: ci.bundleId
      }));
      await cartStore.swapCart([...retained, ...newItems]);
    } else {
      await cartStore.swapCart(newItems);
    }
    ctx.logger.debug(`Applied bundle "${selected.bundleId}"`, newItems);
  } catch (error) {
    if (previous) {
      ctx.selectCard(previous);
    } else {
      selected.element.classList.remove(ctx.classNames.selected);
      selected.element.setAttribute("data-next-selected", "false");
    }
    const msg = error instanceof Error ? error.message : String(error);
    ctx.logger.error("Error in applyBundle:", msg);
  } finally {
    ctx.isApplyingRef.value = false;
  }
}
async function applyEffectiveChange(card, ctx) {
  if (ctx.isApplyingRef.value) return;
  ctx.isApplyingRef.value = true;
  try {
    const cartStore = useCartStore.getState();
    const retained = cartStore.items.filter((ci) => ci.bundleId !== card.bundleId).map((ci) => ({
      packageId: ci.packageId,
      quantity: ci.quantity,
      isUpsell: ci.is_upsell,
      bundleId: ci.bundleId
    }));
    const newItems = ctx.getEffectiveItems(card).map((i) => ({
      ...i,
      bundleId: card.bundleId
    }));
    await cartStore.swapCart([...retained, ...newItems]);
    ctx.logger.debug(`Variant change synced for bundle "${card.bundleId}"`, newItems);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.logger.error("Error in applyEffectiveChange:", msg);
  } finally {
    ctx.isApplyingRef.value = false;
  }
}
async function applyVoucherSwap(previous, next) {
  const checkoutStore = useCheckoutStore.getState();
  const toRemove = previous?.vouchers ?? [];
  const toApply = next.vouchers;
  for (const code of toRemove) {
    if (!toApply.includes(code)) checkoutStore.removeVoucher(code);
  }
  for (const code of toApply) {
    const current = useCheckoutStore.getState().vouchers;
    if (!current.includes(code)) checkoutStore.addVoucher(code);
  }
  useCartStore.getState().calculateTotals();
}
async function applyVariantChange(card, slotIndex, selectedAttrs, ctx) {
  if (ctx.isApplyingRef.value) return;
  const slot = card.slots[slotIndex];
  if (!slot) return;
  const allPackages = useCampaignStore.getState().packages ?? [];
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
    ctx.logger.warn("No package found for variant combination", selectedAttrs);
    return;
  }
  if (slot.activePackageId === matched.ref_id) return;
  slot.activePackageId = matched.ref_id;
  if (ctx.mode === "swap") {
    await applyEffectiveChange(card, ctx);
  }
  ctx.renderSlotsForCard(card);
  void ctx.fetchAndUpdateBundlePrice(card);
  ctx.logger.debug(
    `Variant changed on bundle "${card.bundleId}" slot ${slotIndex}`,
    { packageId: matched.ref_id }
  );
}
function handleVariantOptionClick(e, cards, ctx) {
  const target = e.target;
  const optionEl = target.closest("[data-next-variant-option]");
  if (!optionEl) return;
  if (optionEl.dataset.nextUnavailable === "true") return;
  const code = optionEl.dataset.nextVariantOption;
  const value = optionEl.dataset.nextVariantValue;
  if (!code || !value) return;
  const group = optionEl.closest("[data-next-variant-code]");
  if (!group) return;
  const bundleId = group.dataset.nextBundleId;
  const slotIndex = Number(group.dataset.nextSlotIndex);
  if (!bundleId) return;
  const card = cards.find((c) => c.bundleId === bundleId);
  if (!card) return;
  group.querySelectorAll("[data-next-variant-option]").forEach((el) => {
    el.removeAttribute("data-selected");
    el.classList.remove(ctx.classNames.variantSelected);
  });
  optionEl.setAttribute("data-selected", "true");
  optionEl.classList.add(ctx.classNames.variantSelected);
  const slotEl = card.element.querySelector(`[data-next-slot-index="${slotIndex}"]`) ?? ctx.externalSlotsEl?.querySelector(
    `[data-next-bundle-id="${bundleId}"][data-next-slot-index="${slotIndex}"]:not([data-next-variant-code])`
  ) ?? null;
  if (!slotEl) return;
  const selectedAttrs = {};
  slotEl.querySelectorAll("[data-next-variant-code]").forEach((g) => {
    const attrCode = g.dataset.nextVariantCode;
    if (!attrCode) return;
    const sel = g.querySelector('[data-next-variant-option][data-selected="true"]');
    if (sel?.dataset.nextVariantValue) selectedAttrs[attrCode] = sel.dataset.nextVariantValue;
  });
  void applyVariantChange(card, slotIndex, selectedAttrs, ctx);
}
async function handleSelectVariantChange(_select, bundleId, slotIndex, cards, ctx) {
  const card = cards.find((c) => c.bundleId === bundleId);
  if (!card) return;
  const slotEl = card.element.querySelector(`[data-next-slot-index="${slotIndex}"]`) ?? ctx.externalSlotsEl?.querySelector(
    `[data-next-bundle-id="${bundleId}"][data-next-slot-index="${slotIndex}"]:not([data-next-variant-code])`
  ) ?? null;
  if (!slotEl) return;
  const selectedAttrs = {};
  slotEl.querySelectorAll("select[data-next-variant-code]").forEach((s) => {
    if (s.dataset.nextVariantCode) selectedAttrs[s.dataset.nextVariantCode] = s.value;
  });
  await applyVariantChange(card, slotIndex, selectedAttrs, ctx);
}
async function fetchAndUpdateBundlePrice(card, ctx) {
  const items = ctx.getEffectiveItems(card);
  const currency = useCampaignStore.getState().currency ?? null;
  card.element.classList.add("next-loading");
  card.element.setAttribute("data-next-loading", "true");
  try {
    const checkoutVouchers = useCheckoutStore.getState().vouchers;
    const allBundleVouchers = new Set(ctx.cards.flatMap((c) => c.vouchers));
    const userCoupons = checkoutVouchers.filter((v) => !allBundleVouchers.has(v));
    const merged = [.../* @__PURE__ */ new Set([...userCoupons, ...card.vouchers])];
    const vouchers = merged.length ? merged : void 0;
    const result = await calculateBundlePrice(items, {
      currency,
      vouchers
    });
    const currentItems = ctx.getEffectiveItems(card);
    if (currentItems.length !== items.length || currentItems.some(
      (ci, i) => ci.packageId !== items[i].packageId || ci.quantity !== items[i].quantity
    )) {
      return;
    }
    if (result.summary) ctx.previewLines.set(card.bundleId, result.summary.lines);
    if (ctx.slotTemplate) ctx.renderSlotsForCard(card);
    updateBundlePriceElements(card.element, result);
  } catch (error) {
    ctx.logger.warn(`Failed to fetch bundle price for "${card.bundleId}"`, error);
  } finally {
    card.element.classList.remove("next-loading");
    card.element.setAttribute("data-next-loading", "false");
  }
}
function updateBundlePriceElements(cardEl, calculated) {
  cardEl.querySelectorAll("[data-next-bundle-price]").forEach((el) => {
    const field = el.getAttribute("data-next-bundle-price") ?? "total";
    switch (field) {
      case "compare":
        el.textContent = formatCurrency(calculated.subtotal.toNumber());
        break;
      case "savings":
        el.textContent = formatCurrency(calculated.totalDiscount.toNumber());
        break;
      case "savingsPercentage":
        el.textContent = formatCurrency(calculated.totalDiscountPercentage.toNumber());
        break;
      default:
        el.textContent = formatCurrency(calculated.total.toNumber());
        break;
    }
  });
}
class BundleSelectorEnhancer extends BaseEnhancer {
  constructor() {
    super(...arguments);
    this.mode = "swap";
    this.template = "";
    this.slotTemplate = "";
    this.variantOptionTemplate = "";
    this.variantSelectorTemplate = "";
    this.cards = [];
    this.selectedCard = null;
    this.clickHandlers = /* @__PURE__ */ new Map();
    this.selectHandlers = /* @__PURE__ */ new Map();
    this.mutationObserver = null;
    this.boundVariantOptionClick = null;
    this.boundCurrencyChangeHandler = null;
    this.isApplyingRef = { value: false };
    this.includeShipping = false;
    this.externalSlotsEl = null;
    this.previewLines = /* @__PURE__ */ new Map();
    this.currencyChangeTimeout = null;
    this.voucherChangeTimeout = null;
  }
  async initialize() {
    this.validateElement();
    this.classNames = this.parseClassNames();
    this.mode = this.getAttribute("data-next-selection-mode") ?? "swap";
    this.includeShipping = this.getAttribute("data-next-include-shipping") === "true";
    const selectorId = this.getAttribute("data-next-selector-id");
    if (selectorId) {
      this.externalSlotsEl = document.querySelector(
        `[data-next-bundle-slots-for="${selectorId}"]`
      );
    }
    const templateId = this.getAttribute("data-next-bundle-template-id");
    this.template = templateId ? document.getElementById(templateId)?.innerHTML.trim() ?? "" : this.getAttribute("data-next-bundle-template") ?? "";
    const slotTemplateId = this.getAttribute("data-next-bundle-slot-template-id");
    this.slotTemplate = slotTemplateId ? document.getElementById(slotTemplateId)?.innerHTML.trim() ?? "" : this.getAttribute("data-next-bundle-slot-template") ?? "";
    const variantOptionTemplateId = this.getAttribute("data-next-variant-option-template-id");
    if (variantOptionTemplateId) {
      this.variantOptionTemplate = document.getElementById(variantOptionTemplateId)?.innerHTML.trim() ?? "";
    }
    const variantSelectorTemplateId = this.getAttribute(
      "data-next-variant-selector-template-id"
    );
    if (variantSelectorTemplateId) {
      this.variantSelectorTemplate = document.getElementById(variantSelectorTemplateId)?.innerHTML.trim() ?? "";
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
            const el = renderBundleTemplate(this.template, def, this.logger);
            if (el) this.element.appendChild(el);
          }
        }
      } catch {
        this.logger.warn("Invalid JSON in data-next-bundles, ignoring auto-render", bundlesAttr);
      }
    }
    if (this.slotTemplate) {
      const handler = (e) => handleVariantOptionClick(e, this.cards, this.makeHandlerContext());
      this.boundVariantOptionClick = handler;
      this.element.addEventListener("click", handler);
      if (this.externalSlotsEl) {
        this.externalSlotsEl.addEventListener("click", handler);
      }
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
        if (this.voucherChangeTimeout !== null) clearTimeout(this.voucherChangeTimeout);
        this.voucherChangeTimeout = setTimeout(() => {
          this.voucherChangeTimeout = null;
          for (const card of this.cards) {
            void fetchAndUpdateBundlePrice(card, this.makePriceContext());
          }
        }, 150);
      }
    });
    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null) clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const card of this.cards) {
          void fetchAndUpdateBundlePrice(card, this.makePriceContext());
        }
      }, 150);
    };
    document.addEventListener("next:currency-changed", this.boundCurrencyChangeHandler);
    for (const card of this.cards) {
      void fetchAndUpdateBundlePrice(card, this.makePriceContext());
    }
    this.logger.debug("BundleSelectorEnhancer initialized", {
      mode: this.mode,
      cardCount: this.cards.length
    });
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
    el.classList.add(this.classNames.bundleCard);
    if (this.slotTemplate) {
      renderSlotsForCard(card, this.makeRenderContext());
    }
    const handler = (e) => {
      const target = e.target;
      if (target.closest("select, [data-next-variant-option]")) return;
      void handleCardClick(e, card, this.selectedCard, this.makeHandlerContext());
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
  // ─── Selection state ──────────────────────────────────────────────────────────
  selectCard(card) {
    this.cards.forEach((c) => {
      c.element.classList.remove(this.classNames.selected);
      c.element.setAttribute("data-next-selected", "false");
    });
    card.element.classList.add(this.classNames.selected);
    card.element.setAttribute("data-next-selected", "true");
    this.selectedCard = card;
    this.element.setAttribute("data-selected-bundle", card.bundleId);
    this.emit("bundle:selection-changed", {
      bundleId: card.bundleId,
      items: this.getEffectiveItems(card)
    });
    this.renderExternalSlots(card);
  }
  renderExternalSlots(card) {
    if (!this.externalSlotsEl || !this.slotTemplate) return;
    renderSlotsForCard(card, this.makeRenderContext(), this.externalSlotsEl);
  }
  getSelectedCard() {
    return this.selectedCard;
  }
  // ─── Cart sync ────────────────────────────────────────────────────────────────
  syncWithCart(cartState) {
    for (const card of this.cards) {
      const effectiveItems = this.getEffectiveItems(card);
      const allItemsInCart = effectiveItems.every((bi) => {
        const ci = cartState.items.find((i) => i.packageId === bi.packageId);
        return ci != null && ci.quantity >= bi.quantity;
      });
      card.element.classList.toggle(this.classNames.inCart, allItemsInCart);
      card.element.setAttribute("data-next-in-cart", String(allItemsInCart));
      if (this.slotTemplate && !this.isApplyingRef.value && !this.externalSlotsEl) {
        renderSlotsForCard(card, this.makeRenderContext());
      }
    }
    if (this.externalSlotsEl && this.selectedCard && !this.isApplyingRef.value) {
      this.renderExternalSlots(this.selectedCard);
    }
    if (!this.selectedCard) {
      const preSelected = this.cards.find((c) => c.isPreSelected);
      if (preSelected) {
        this.selectCard(preSelected);
        const initVouchers = preSelected.vouchers.length ? applyVoucherSwap(null, preSelected) : Promise.resolve();
        if (this.mode === "swap") {
          void initVouchers.then(() => applyBundle(null, preSelected, this.makeHandlerContext()));
        }
      }
    }
  }
  update() {
    this.syncWithCart(useCartStore.getState());
  }
  // ─── Context factories ────────────────────────────────────────────────────────
  makeRenderContext() {
    return {
      slotTemplate: this.slotTemplate,
      variantOptionTemplate: this.variantOptionTemplate,
      variantSelectorTemplate: this.variantSelectorTemplate,
      selectHandlers: this.selectHandlers,
      previewLines: this.previewLines,
      logger: this.logger,
      classNames: this.classNames,
      onSelectChange: (select, bundleId, slotIndex) => handleSelectVariantChange(select, bundleId, slotIndex, this.cards, this.makeHandlerContext())
    };
  }
  makeHandlerContext() {
    return {
      mode: this.mode,
      logger: this.logger,
      classNames: this.classNames,
      isApplyingRef: this.isApplyingRef,
      externalSlotsEl: this.externalSlotsEl,
      selectCard: (card) => this.selectCard(card),
      getEffectiveItems: (card) => this.getEffectiveItems(card),
      fetchAndUpdateBundlePrice: (card) => fetchAndUpdateBundlePrice(card, this.makePriceContext()),
      renderSlotsForCard: (card) => {
        renderSlotsForCard(card, this.makeRenderContext());
        if (this.externalSlotsEl) {
          renderSlotsForCard(card, this.makeRenderContext(), this.externalSlotsEl);
        }
      },
      emit: (event, detail) => this.emit(event, detail)
    };
  }
  makePriceContext() {
    return {
      includeShipping: this.includeShipping,
      previewLines: this.previewLines,
      cards: this.cards,
      logger: this.logger,
      slotTemplate: this.slotTemplate,
      renderSlotsForCard: (card) => renderSlotsForCard(card, this.makeRenderContext()),
      getEffectiveItems: (card) => this.getEffectiveItems(card)
    };
  }
  // ─── Small helpers ────────────────────────────────────────────────────────────
  parseClassNames() {
    const get = (key, fallback) => this.getAttribute(`data-next-class-${key}`) ?? fallback;
    return {
      bundleCard: get("bundle-card", "next-bundle-card"),
      selected: get("selected", "next-selected"),
      inCart: get("in-cart", "next-in-cart"),
      variantSelected: get("variant-selected", "next-variant-selected"),
      variantUnavailable: get("variant-unavailable", "next-variant-unavailable"),
      bundleSlot: get("bundle-slot", "next-bundle-slot"),
      slotVariantGroup: get("slot-variant-group", "next-slot-variant-group")
    };
  }
  getEffectiveItems(card) {
    const qtyCounts = /* @__PURE__ */ new Map();
    for (const slot of card.slots) {
      qtyCounts.set(
        slot.activePackageId,
        (qtyCounts.get(slot.activePackageId) ?? 0) + slot.quantity
      );
    }
    return Array.from(qtyCounts.entries()).map(([packageId, quantity]) => ({
      packageId,
      quantity
    }));
  }
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
  // ─── Cleanup ──────────────────────────────────────────────────────────────────
  cleanupEventListeners() {
    this.clickHandlers.forEach((h, el) => el.removeEventListener("click", h));
    this.clickHandlers.clear();
    this.selectHandlers.forEach((h, sel) => sel.removeEventListener("change", h));
    this.selectHandlers.clear();
    if (this.boundVariantOptionClick) {
      this.element.removeEventListener("click", this.boundVariantOptionClick);
      this.externalSlotsEl?.removeEventListener("click", this.boundVariantOptionClick);
      this.boundVariantOptionClick = null;
    }
    if (this.voucherChangeTimeout !== null) {
      clearTimeout(this.voucherChangeTimeout);
      this.voucherChangeTimeout = null;
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
    super.destroy();
    this.cards.forEach(
      (c) => c.element.classList.remove(
        this.classNames.bundleCard,
        this.classNames.selected,
        this.classNames.inCart
      )
    );
    this.cards = [];
  }
}
export {
  BundleSelectorEnhancer
};
