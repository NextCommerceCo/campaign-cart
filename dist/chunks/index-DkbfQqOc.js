import { B as BaseEnhancer } from "./BaseEnhancer-C1FrGGAQ.js";
import { u as useCampaignStore, b as useCheckoutStore, a as useCartStore } from "./analytics-Ci0jTs8y.js";
import { e as formatPercentage, f as formatCurrency, g as calculateBundlePrice } from "./utils-DTwlwnMm.js";
import { D as Decimal } from "./vendor-BvX3PoQU.js";
import { B as BaseDisplayEnhancer } from "./DisplayEnhancerCore-DK3KyyHm.js";
function buildSlotVars(slot, pkgState) {
  return {
    "slot.index": String(slot.slotIndex + 1),
    "slot.unitIndex": String(slot.unitIndex),
    "slot.unitNumber": String(slot.unitIndex + 1),
    "item.packageId": String(slot.activePackageId),
    "item.name": pkgState.name,
    "item.image": pkgState.image,
    "item.quantity": String(slot.quantity),
    "item.variantName": pkgState.variantName,
    "item.productName": pkgState.productName,
    "item.sku": pkgState.sku ?? "",
    "item.isRecurring": pkgState.isRecurring ? "true" : "false",
    "item.interval": pkgState.interval ?? "",
    "item.intervalCount": pkgState.intervalCount != null ? String(pkgState.intervalCount) : "",
    "item.frequency": pkgState.isRecurring ? pkgState.intervalCount != null && pkgState.intervalCount > 1 ? `Every ${pkgState.intervalCount} ${pkgState.interval}s` : `Per ${pkgState.interval}` : "One time",
    "item.recurringPrice": formatCurrency(pkgState.recurringPrice.toNumber(), pkgState.currency),
    "item.originalRecurringPrice": formatCurrency(pkgState.originalRecurringPrice.toNumber(), pkgState.currency),
    "item.price": formatCurrency(pkgState.unitPrice.times(slot.quantity).toNumber(), pkgState.currency),
    "item.originalPrice": formatCurrency(pkgState.originalUnitPrice.times(slot.quantity).toNumber(), pkgState.currency),
    "item.unitPrice": formatCurrency(pkgState.unitPrice.toNumber(), pkgState.currency),
    "item.originalUnitPrice": formatCurrency(pkgState.originalUnitPrice.toNumber(), pkgState.currency),
    "item.discountAmount": formatCurrency(
      pkgState.originalUnitPrice.minus(pkgState.unitPrice).times(slot.quantity).toNumber(),
      pkgState.currency
    ),
    "item.discountPercentage": formatPercentage(pkgState.discountPercentage.toNumber()),
    "item.hasDiscount": pkgState.hasDiscount ? "show" : "hide",
    "item.currency": pkgState.currency
  };
}
function varsEqual(a, b) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}
function renderBundleTemplate(template, bundle, logger) {
  const visibleItems = bundle.items.filter((item) => !item.noSlot);
  const itemCount = visibleItems.length;
  const totalQuantity = visibleItems.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  const vars = {
    "bundle.itemCount": String(itemCount),
    "bundle.totalQuantity": String(totalQuantity)
  };
  for (const [key, value] of Object.entries(bundle)) {
    if (key !== "items" && key !== "selected") {
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
  if (bundle.selected) {
    cardEl.setAttribute("data-next-selected", "true");
  }
  if (bundle.vouchers?.length) {
    cardEl.setAttribute("data-next-bundle-vouchers", JSON.stringify(bundle.vouchers));
  }
  if (bundle.shippingId) {
    cardEl.setAttribute("data-next-shipping-id", bundle.shippingId);
  }
  return cardEl;
}
function applyBundleField(el, field, data) {
  const { bundlePrice, isSelected, name } = data;
  const currency = bundlePrice.currency || void 0;
  switch (field) {
    case "price":
    case "total":
      el.textContent = formatCurrency(bundlePrice.price.toNumber(), currency);
      break;
    case "compare":
    case "originalPrice":
      el.textContent = formatCurrency(bundlePrice.originalPrice.toNumber(), currency);
      break;
    case "savings":
    case "discountAmount":
      el.textContent = formatCurrency(bundlePrice.discountAmount.toNumber(), currency);
      break;
    case "unitPrice":
      el.textContent = formatCurrency(bundlePrice.unitPrice.toNumber(), currency);
      break;
    case "originalUnitPrice":
      el.textContent = formatCurrency(bundlePrice.originalUnitPrice.toNumber(), currency);
      break;
    case "savingsPercentage":
    case "discountPercentage":
      el.textContent = formatPercentage(bundlePrice.discountPercentage.toNumber());
      break;
    case "isSelected":
      el.style.display = isSelected ? "" : "none";
      break;
    case "hasDiscount":
    case "hasSavings":
      el.style.display = bundlePrice.hasDiscount ? "" : "none";
      break;
    case "name":
      el.textContent = name;
      break;
    case "currency":
      el.textContent = bundlePrice.currency;
      break;
  }
}
function updateCardDisplayElements(card, bundlePrice) {
  const isSelected = card.element.getAttribute("data-next-selected") === "true";
  const fieldData = {
    bundlePrice,
    isSelected,
    name: card.name
  };
  card.element.querySelectorAll("[data-next-bundle-display]").forEach((el) => {
    const field = el.getAttribute("data-next-bundle-display") ?? "price";
    applyBundleField(el, field, fieldData);
  });
  card.element.querySelectorAll("[data-next-bundle-price]").forEach((el) => {
    const field = el.getAttribute("data-next-bundle-price") ?? "total";
    applyBundleField(el, field, fieldData);
  });
  card.element.dispatchEvent(
    new CustomEvent("bundle:price-updated", {
      bubbles: true,
      detail: { selectorId: card.element.getAttribute("data-next-bundle-id") ?? "" }
    })
  );
}
function renderSlotsForCard(card, ctx, targetEl) {
  const placeholder = targetEl ?? card.element.querySelector("[data-next-bundle-slots]");
  if (!placeholder) return;
  const activeIndices = /* @__PURE__ */ new Set();
  for (const slot of card.slots) {
    if (slot.noSlot) continue;
    const pkgState = card.packageStates.get(slot.activePackageId);
    if (!pkgState) continue;
    activeIndices.add(slot.slotIndex);
    const existing = placeholder.querySelector(
      `[data-next-slot-index="${slot.slotIndex}"]`
    );
    const newVars = buildSlotVars(slot, pkgState);
    const cachedVars = !targetEl ? card.slotVarsCache.get(slot.slotIndex) : void 0;
    if (existing && cachedVars && varsEqual(cachedVars, newVars)) continue;
    const newSlotEl = createSlotElement(card.bundleId, slot, newVars, ctx);
    const variantPlaceholder = newSlotEl.querySelector("[data-next-variant-selectors]");
    if (variantPlaceholder) {
      const allPackages = useCampaignStore.getState().packages ?? [];
      const pkg = allPackages.find((p) => p.ref_id === slot.activePackageId);
      if (pkg && (pkg.product_variant_attribute_values?.length ?? 0) > 0) {
        renderVariantSelectors(
          variantPlaceholder,
          card.bundleId,
          slot.slotIndex,
          pkg,
          allPackages,
          ctx
        );
      }
    }
    if (existing) {
      existing.querySelectorAll("select").forEach((s) => {
        const h = ctx.selectHandlers.get(s);
        if (h) {
          s.removeEventListener("change", h);
          ctx.selectHandlers.delete(s);
        }
      });
      placeholder.replaceChild(newSlotEl, existing);
    } else {
      placeholder.appendChild(newSlotEl);
    }
    if (!targetEl) card.slotVarsCache.set(slot.slotIndex, newVars);
  }
  placeholder.querySelectorAll("[data-next-slot-index]").forEach((el) => {
    const idx = Number(el.dataset.nextSlotIndex);
    if (!activeIndices.has(idx)) el.remove();
  });
  ctx.logger.debug("Rendered slots for bundle", card.bundleId, { activeCount: activeIndices.size });
}
function createSlotElement(bundleId, slot, vars, ctx) {
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
  const outerSwap = container.getAttribute("next-render-swap") === "outerHTML";
  const noLabel = container.hasAttribute("next-render-no-label");
  const target = outerSwap ? document.createElement("div") : container;
  if (!outerSwap) container.innerHTML = "";
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
        target,
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
        target,
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
      field.dataset.nextVariantCode = code;
      field.dataset.nextVariantName = name;
      field.dataset.nextBundleId = bundleId;
      field.dataset.nextSlotIndex = String(slotIndex);
      const label = document.createElement("label");
      label.className = "next-slot-variant-label";
      label.textContent = `Select ${name}:`;
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
      const handler = () => {
        void ctx.onSelectChange(select, bundleId, slotIndex);
      };
      ctx.selectHandlers.set(select, handler);
      select.addEventListener("change", handler);
      if (!noLabel) field.appendChild(label);
      field.appendChild(select);
      target.appendChild(field);
    }
  }
  if (outerSwap) {
    const parent = container.parentElement;
    if (parent) {
      while (target.firstChild) {
        parent.insertBefore(target.firstChild, container);
      }
      parent.removeChild(container);
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
      const selectEl = optionsPlaceholder instanceof HTMLSelectElement ? optionsPlaceholder : el.querySelector("select");
      if (selectEl) {
        selectEl.dataset.nextVariantCode = code;
        const handler = () => void ctx.onSelectChange(selectEl, bundleId, slotIndex);
        ctx.selectHandlers.set(selectEl, handler);
        selectEl.addEventListener("change", handler);
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
function makePackageState(pkg) {
  return {
    packageId: pkg.ref_id,
    name: pkg.name || "",
    image: pkg.image || "",
    productName: pkg.product_name || "",
    variantName: pkg.product_variant_name || "",
    sku: pkg.product_sku ?? null,
    isRecurring: pkg.is_recurring,
    interval: pkg.interval ?? null,
    intervalCount: pkg.interval_count ?? null,
    recurringPrice: new Decimal(pkg.price_recurring_total || 0),
    originalRecurringPrice: new Decimal(pkg.price_recurring_total || 0),
    unitPrice: new Decimal(pkg.price_total || 0),
    originalUnitPrice: new Decimal(pkg.price_total || 0),
    discountAmount: new Decimal(0),
    discountPercentage: new Decimal(0),
    originalPrice: new Decimal(pkg.price_total || 0),
    price: new Decimal(pkg.price_total || 0),
    hasDiscount: false,
    currency: useCampaignStore.getState().currency ?? ""
  };
}
function getEffectiveItems(card) {
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
function parseVouchers(attr, logger) {
  if (!attr) return [];
  const trimmed = attr.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
    } catch {
      logger.warn("Invalid JSON in data-next-bundle-vouchers", attr);
      return [];
    }
  }
  return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}
async function handleCardClick(e, card, previousCard, ctx) {
  e.preventDefault();
  if (previousCard === card) return;
  if (ctx.isApplyingRef.value) return;
  if (ctx.isUpsellContext) {
    ctx.selectCard(card);
    ctx.emit("bundle:selected", { selectorId: ctx.selectorId ?? "", items: getEffectiveItems(card) });
    return;
  }
  ctx.selectCard(card);
  ctx.emit("bundle:selected", { selectorId: ctx.selectorId ?? "", items: getEffectiveItems(card) });
  if (card.vouchers.length || previousCard?.vouchers.length) {
    await applyVoucherSwap(previousCard, card);
  }
  if (ctx.mode === "swap") {
    const success = await applyBundle(previousCard, card, ctx);
    if (success && card.shippingId) await setShippingMethod(card.shippingId, ctx);
  }
}
async function applyBundle(previous, selected, ctx) {
  if (ctx.isApplyingRef.value) return false;
  ctx.isApplyingRef.value = true;
  const { selectorId } = ctx;
  const cartStore = useCartStore.getState();
  const newItems = getEffectiveItems(selected).map((i) => ({
    ...i,
    selectorId
  }));
  try {
    const retained = cartStore.items.filter((ci) => ci.selectorId !== selectorId).map((ci) => ({
      packageId: ci.packageId,
      quantity: ci.quantity,
      isUpsell: ci.is_upsell,
      selectorId: ci.selectorId
    }));
    await cartStore.swapCart([...retained, ...newItems]);
    ctx.logger.debug(`Applied bundle "${selected.bundleId}" (selector "${selectorId}")`, newItems);
    return true;
  } catch (error) {
    if (previous) {
      ctx.selectCard(previous);
      await applyVoucherSwap(selected, previous);
    } else {
      selected.element.classList.remove(ctx.classNames.selected);
      selected.element.setAttribute("data-next-selected", "false");
      await applyVoucherSwap(selected, { vouchers: [] });
    }
    const msg = error instanceof Error ? error.message : String(error);
    ctx.logger.error("Error in applyBundle:", msg);
    return false;
  } finally {
    ctx.isApplyingRef.value = false;
  }
}
async function applyEffectiveChange(card, ctx) {
  if (ctx.isApplyingRef.value) return;
  ctx.isApplyingRef.value = true;
  const { selectorId } = ctx;
  const slotSnapshot = card.slots.map((s) => s.activePackageId);
  try {
    const cartStore = useCartStore.getState();
    const retained = cartStore.items.filter((ci) => ci.selectorId !== selectorId).map((ci) => ({
      packageId: ci.packageId,
      quantity: ci.quantity,
      isUpsell: ci.is_upsell,
      selectorId: ci.selectorId
    }));
    const newItems = getEffectiveItems(card).map((i) => ({
      ...i,
      selectorId
    }));
    await cartStore.swapCart([...retained, ...newItems]);
    ctx.logger.debug(`Variant change synced for bundle "${card.bundleId}" (selector "${selectorId}")`, newItems);
  } catch (error) {
    card.slots.forEach((s, i) => {
      s.activePackageId = slotSnapshot[i];
    });
    ctx.emit("bundle:selection-changed", {
      selectorId: selectorId ?? "",
      items: getEffectiveItems(card)
    });
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
function onVoucherApplied(newVouchers, prevVouchers, cards, allBundleVouchers, fetchPrice) {
  const prevUserCoupons = prevVouchers.filter((v) => !allBundleVouchers.has(v));
  const nextUserCoupons = newVouchers.filter((v) => !allBundleVouchers.has(v));
  const prevSet = new Set(prevUserCoupons);
  const nextSet = new Set(nextUserCoupons);
  const changed = prevSet.size !== nextSet.size || nextUserCoupons.some((v) => !prevSet.has(v));
  if (!changed) return;
  for (const card of cards) {
    void fetchPrice(card);
  }
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
  slot.variantSelected = true;
  if (slot.activePackageId === matched.ref_id) {
    ctx.emit("bundle:selection-changed", {
      selectorId: ctx.selectorId ?? "",
      items: getEffectiveItems(card)
    });
    return;
  }
  slot.activePackageId = matched.ref_id;
  if (!card.packageStates.has(matched.ref_id)) {
    card.packageStates.set(matched.ref_id, makePackageState(matched));
  }
  if (ctx.mode === "swap") {
    await applyEffectiveChange(card, ctx);
  }
  ctx.emit("bundle:selection-changed", {
    selectorId: ctx.selectorId ?? "",
    items: getEffectiveItems(card)
  });
  void ctx.fetchAndUpdateBundlePrice(card);
  ctx.logger.debug(
    `Variant changed on bundle "${card.bundleId}" slot ${slotIndex}`,
    { packageId: matched.ref_id }
  );
}
async function handleVariantOptionClick(e, cards, ctx) {
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
  const previousCard = ctx.getSelectedCard();
  if (previousCard !== card) {
    ctx.selectCard(card);
    ctx.emit("bundle:selected", { selectorId: ctx.selectorId ?? "", items: getEffectiveItems(card) });
    if (card.vouchers.length || previousCard?.vouchers.length) {
      await applyVoucherSwap(previousCard, card);
    }
  }
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
  const changedCode = _select.dataset.nextVariantCode;
  if (changedCode) selectedAttrs[changedCode] = _select.value;
  await applyVariantChange(card, slotIndex, selectedAttrs, ctx);
}
async function setShippingMethod(shippingId, ctx) {
  const id = parseInt(shippingId, 10);
  if (isNaN(id)) {
    ctx.logger.warn("Invalid shipping ID:", shippingId);
    return;
  }
  try {
    await useCartStore.getState().setShippingMethod(id);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.logger.error("Failed to set shipping method:", msg);
  }
}
async function fetchAndUpdateBundlePrice(card, ctx) {
  const items = getEffectiveItems(card);
  const currency = useCampaignStore.getState().currency ?? null;
  card.element.classList.add("next-loading");
  card.element.setAttribute("data-next-loading", "true");
  try {
    const checkoutVouchers = useCheckoutStore.getState().vouchers;
    const userCoupons = checkoutVouchers.filter((v) => !ctx.allBundleVouchers.has(v));
    const merged = [.../* @__PURE__ */ new Set([...userCoupons, ...card.vouchers])];
    const vouchers = merged.length ? merged : void 0;
    const result = await calculateBundlePrice(items, {
      currency,
      vouchers,
      upsell: ctx.isUpsellContext
    });
    const currentItems = getEffectiveItems(card);
    if (currentItems.length !== items.length || currentItems.some(
      (ci, i) => ci.packageId !== items[i].packageId || ci.quantity !== items[i].quantity
    )) {
      return;
    }
    if (result.summary) {
      for (const line of result.summary.lines) {
        const state = card.packageStates.get(line.package_id);
        if (state) {
          const discountAmount2 = new Decimal(line.total_discount);
          const originalPrice2 = new Decimal(line.subtotal);
          const discountPercentage2 = originalPrice2.gt(0) ? discountAmount2.div(originalPrice2).times(100) : new Decimal(0);
          const hasDiscount = discountAmount2.gt(0);
          card.packageStates.set(line.package_id, {
            ...state,
            recurringPrice: new Decimal(line.price_recurring_total || 0),
            originalRecurringPrice: new Decimal(line.price_recurring_total || 0),
            unitPrice: new Decimal(line.package_price),
            originalUnitPrice: new Decimal(line.original_package_price),
            discountAmount: discountAmount2,
            discountPercentage: discountPercentage2,
            originalPrice: originalPrice2,
            price: new Decimal(line.total),
            hasDiscount,
            currency: result.currency ?? state.currency
          });
        }
      }
    }
    const totalQuantity = card.slots.filter((s) => !s.noSlot).reduce((sum, s) => sum + s.quantity, 0);
    const price = new Decimal(result.total);
    const originalPrice = new Decimal(result.subtotal);
    const discountAmount = new Decimal(result.totalDiscount);
    const discountPercentage = new Decimal(result.totalDiscountPercentage);
    card.bundlePrice = {
      price,
      originalPrice,
      discountAmount,
      discountPercentage,
      unitPrice: totalQuantity > 0 ? price.div(totalQuantity) : price,
      originalUnitPrice: totalQuantity > 0 ? originalPrice.div(totalQuantity) : originalPrice,
      quantity: totalQuantity,
      hasDiscount: discountAmount.gt(0),
      currency: result.currency ?? currency ?? ""
    };
  } catch (error) {
    ctx.logger.warn(`Failed to fetch bundle price for "${card.bundleId}"`, error);
  } finally {
    card.element.classList.remove("next-loading");
    card.element.setAttribute("data-next-loading", "false");
  }
}
const _BundleSelectorEnhancer = class _BundleSelectorEnhancer extends BaseEnhancer {
  constructor() {
    super(...arguments);
    this.mode = "swap";
    this.isUpsellContext = false;
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
    this.selectorId = null;
    this.externalSlotsEl = null;
    this.currencyChangeTimeout = null;
    this.voucherChangeTimeout = null;
  }
  async initialize() {
    this.validateElement();
    _BundleSelectorEnhancer._instances.add(this);
    this.classNames = this.parseClassNames();
    this.isUpsellContext = this.element.hasAttribute("data-next-upsell-context");
    this.mode = this.isUpsellContext ? "select" : this.getAttribute("data-next-selection-mode") ?? "swap";
    this.includeShipping = this.getAttribute("data-next-include-shipping") === "true";
    const selectorId = this.getAttribute("data-next-selector-id");
    this.selectorId = selectorId;
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
      const handler = (e) => void handleVariantOptionClick(e, this.cards, this.makeHandlerContext());
      this.boundVariantOptionClick = handler;
      this.element.addEventListener("click", handler);
      if (this.externalSlotsEl) {
        this.externalSlotsEl.addEventListener("click", handler);
      }
    }
    this.scanCards();
    this.setupMutationObserver();
    this.element["_getSelectedBundleItems"] = () => {
      if (!this.selectedCard) return null;
      const needsVariant = this.selectedCard.slots.some(
        (s) => s.configurable && !s.variantSelected
      );
      return needsVariant ? null : getEffectiveItems(this.selectedCard);
    };
    this.element["_getSelectedBundleVouchers"] = () => this.selectedCard?.vouchers ?? [];
    if (this.isUpsellContext) {
      this.initializeBundleSelection();
    } else {
      this.subscribe(useCartStore, this.syncWithCart.bind(this));
      this.syncWithCart(useCartStore.getState());
      let prevCheckoutVouchers = useCheckoutStore.getState().vouchers;
      this.subscribe(useCheckoutStore, (state) => {
        const next = state.vouchers;
        const prev = prevCheckoutVouchers;
        const changed = next.length !== prev.length || next.some((v, i) => v !== prev[i]);
        if (!changed) return;
        prevCheckoutVouchers = next;
        if (this.voucherChangeTimeout !== null) clearTimeout(this.voucherChangeTimeout);
        this.voucherChangeTimeout = setTimeout(() => {
          this.voucherChangeTimeout = null;
          const allBundleVouchers = this.getAllKnownBundleVouchers();
          onVoucherApplied(
            next,
            prev,
            this.cards,
            allBundleVouchers,
            (card) => this.calculateAndRenderPrice(card)
          );
        }, 150);
      });
    }
    this.boundCurrencyChangeHandler = () => {
      if (this.currencyChangeTimeout !== null) clearTimeout(this.currencyChangeTimeout);
      this.currencyChangeTimeout = setTimeout(() => {
        this.currencyChangeTimeout = null;
        for (const card of this.cards) {
          void this.calculateAndRenderPrice(card);
        }
      }, 150);
    };
    document.addEventListener("next:currency-changed", this.boundCurrencyChangeHandler);
    for (const card of this.cards) {
      void this.calculateAndRenderPrice(card);
    }
    this.logger.debug("BundleSelectorEnhancer initialized", {
      mode: this.mode,
      cardCount: this.cards.length,
      isUpsellContext: this.isUpsellContext
    });
  }
  // ─── Price fetch + slot re-render ─────────────────────────────────────────────
  /**
   * Phases 3+4+5: fetch prices (CalculatePrices), write state (UpdateBundleState),
   * then update all variable parts of the DOM (RelenderVariable).
   * Entry point for onVariantChanged and onVoucherApplied — skips RenderBundleCard
   * and RenderBundleCardItems.
   */
  async calculateAndRenderPrice(card) {
    await fetchAndUpdateBundlePrice(card, this.makePriceContext());
    this.relenderVariables(card);
  }
  /**
   * Phase 5 — RelenderVariable: updates all DOM that depends on calculated prices.
   * Covers slot {item.xxx} variables, [data-next-bundle-display] elements,
   * and the bundle:price-updated event for BundleDisplayEnhancer.
   */
  relenderVariables(card) {
    if (this.slotTemplate) {
      renderSlotsForCard(card, this.makeRenderContext());
      if (this.externalSlotsEl && card === this.selectedCard) {
        renderSlotsForCard(card, this.makeRenderContext(), this.externalSlotsEl);
      }
    }
    if (card.bundlePrice) {
      updateCardDisplayElements(card, card.bundlePrice);
      if (this.selectorId && card === this.selectedCard) {
        document.dispatchEvent(
          new CustomEvent("bundle:price-updated", {
            detail: { selectorId: this.selectorId }
          })
        );
      }
    }
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
    const name = el.getAttribute("data-next-bundle-name") ?? "";
    const isPreSelected = el.getAttribute("data-next-selected") === "true";
    const vouchers = parseVouchers(el.getAttribute("data-next-bundle-vouchers"), this.logger);
    const shippingId = el.getAttribute("data-next-shipping-id") ?? void 0;
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
            noSlot: item.noSlot,
            configurable: true,
            variantSelected: false
          });
        }
      } else {
        slots.push({
          slotIndex: slotIdx++,
          unitIndex: 0,
          originalPackageId: item.packageId,
          activePackageId: item.packageId,
          quantity: item.quantity,
          noSlot: item.noSlot,
          configurable: !!item.configurable,
          variantSelected: false
        });
      }
    }
    const allPackages = useCampaignStore.getState().packages ?? [];
    const packageStates = /* @__PURE__ */ new Map();
    for (const slot of slots) {
      if (!packageStates.has(slot.activePackageId)) {
        const pkg = allPackages.find((p) => p.ref_id === slot.activePackageId);
        if (pkg) packageStates.set(slot.activePackageId, makePackageState(pkg));
      }
    }
    for (const slot of slots) {
      if (slot.configurable && !slot.variantSelected) {
        const pkg = allPackages.find((p) => p.ref_id === slot.activePackageId);
        if ((pkg?.product_variant_attribute_values?.length ?? 0) > 0) {
          slot.variantSelected = true;
        }
      }
    }
    const card = {
      element: el,
      bundleId,
      name,
      items,
      slots,
      isPreSelected,
      vouchers,
      shippingId,
      packageStates,
      bundlePrice: null,
      slotVarsCache: /* @__PURE__ */ new Map()
    };
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
      selectorId: this.selectorId ?? "",
      items: getEffectiveItems(card)
    });
    this.renderExternalSlots(card);
    if (this.selectorId) {
      document.dispatchEvent(
        new CustomEvent("bundle:price-updated", {
          detail: { selectorId: this.selectorId }
        })
      );
    }
  }
  renderExternalSlots(card) {
    if (!this.externalSlotsEl || !this.slotTemplate) return;
    renderSlotsForCard(card, this.makeRenderContext(), this.externalSlotsEl);
  }
  getSelectedCard() {
    return this.selectedCard;
  }
  /**
   * Returns display state for a bundle card by id, for use by BundleDisplayEnhancer.
   * If `selectorId` matches a selector's `data-next-selector-id`, returns the currently
   * selected card's state — enabling `bundle.{selectorId}.property` to always reflect
   * the active selection.
   */
  static getBundleState(selectorId) {
    for (const inst of _BundleSelectorEnhancer._instances) {
      const card = inst.cards.find((c) => c.bundleId === selectorId);
      if (card) {
        return {
          name: card.name,
          isSelected: inst.selectedCard?.bundleId === selectorId,
          bundlePrice: card.bundlePrice
        };
      }
    }
    for (const inst of _BundleSelectorEnhancer._instances) {
      if (inst.selectorId === selectorId && inst.selectedCard) {
        return {
          name: inst.selectedCard.name,
          isSelected: true,
          bundlePrice: inst.selectedCard.bundlePrice
        };
      }
    }
    return null;
  }
  // ─── Upsell context selection ─────────────────────────────────────────────────
  /**
   * Pre-selects the default card without writing to the cart.
   * Used when isUpsellContext is true to give the user a visual starting selection.
   */
  initializeBundleSelection() {
    const preSelected = this.cards.find((c) => c.isPreSelected);
    const cardToSelect = preSelected ?? this.cards[0] ?? null;
    if (!preSelected && cardToSelect) {
      this.logger.warn(
        'No card has data-next-selected="true" — auto-selecting first card. Add data-next-selected="true" to the default card to suppress this warning.'
      );
    }
    if (cardToSelect) this.selectCard(cardToSelect);
  }
  // ─── Cart sync ────────────────────────────────────────────────────────────────
  syncWithCart(cartState) {
    for (const card of this.cards) {
      const effectiveItems = getEffectiveItems(card);
      const allItemsInCart = effectiveItems.every((bi) => {
        const ci = cartState.items.find(
          (i) => i.packageId === bi.packageId && i.selectorId === this.selectorId
        );
        return ci != null && ci.quantity >= bi.quantity;
      });
      card.element.classList.toggle(this.classNames.inCart, allItemsInCart);
      card.element.setAttribute("data-next-in-cart", String(allItemsInCart));
    }
    if (!this.selectedCard) {
      const preSelected = this.cards.find((c) => c.isPreSelected);
      const cardToSelect = preSelected ?? this.cards[0] ?? null;
      if (!preSelected && cardToSelect) {
        this.logger.warn(
          'No card has data-next-selected="true" — auto-selecting first card. Add data-next-selected="true" to the default card to suppress this warning.'
        );
      }
      if (cardToSelect) {
        this.selectCard(cardToSelect);
        const initVouchers = cardToSelect.vouchers.length ? applyVoucherSwap(null, cardToSelect) : Promise.resolve();
        if (this.mode === "swap") {
          void initVouchers.then(async () => {
            const success = await applyBundle(null, cardToSelect, this.makeHandlerContext());
            if (success && cardToSelect.shippingId) {
              await setShippingMethod(cardToSelect.shippingId, { logger: this.logger });
            }
          });
        }
      }
    }
  }
  update() {
    if (!this.isUpsellContext) this.syncWithCart(useCartStore.getState());
  }
  // ─── Context factories ────────────────────────────────────────────────────────
  makeRenderContext() {
    return {
      slotTemplate: this.slotTemplate,
      variantOptionTemplate: this.variantOptionTemplate,
      variantSelectorTemplate: this.variantSelectorTemplate,
      selectHandlers: this.selectHandlers,
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
      containerElement: this.element,
      isUpsellContext: this.isUpsellContext,
      selectorId: this.selectorId,
      selectCard: (card) => this.selectCard(card),
      getSelectedCard: () => this.selectedCard,
      fetchAndUpdateBundlePrice: (card) => this.calculateAndRenderPrice(card),
      emit: (event, detail) => this.emit(event, detail)
    };
  }
  makePriceContext() {
    return {
      includeShipping: this.includeShipping,
      allBundleVouchers: this.getAllKnownBundleVouchers(),
      isUpsellContext: this.isUpsellContext,
      logger: this.logger
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
  /** Vouchers defined across this instance's bundle cards. */
  getBundleVouchers() {
    return this.cards.flatMap((c) => c.vouchers);
  }
  /** Vouchers defined across ALL live BundleSelectorEnhancer instances. */
  getAllKnownBundleVouchers() {
    return new Set(
      [..._BundleSelectorEnhancer._instances].flatMap((inst) => inst.getBundleVouchers())
    );
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
    _BundleSelectorEnhancer._instances.delete(this);
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
};
_BundleSelectorEnhancer._instances = /* @__PURE__ */ new Set();
let BundleSelectorEnhancer = _BundleSelectorEnhancer;
const FORMAT_MAP = {
  isSelected: "boolean",
  hasDiscount: "boolean",
  name: "text",
  price: "currency",
  compare: "currency",
  originalPrice: "currency",
  savings: "currency",
  discountAmount: "currency",
  savingsPercentage: "percentage",
  discountPercentage: "percentage",
  hasSavings: "boolean",
  unitPrice: "currency",
  originalUnitPrice: "currency",
  currency: "text"
};
class BundleDisplayEnhancer extends BaseDisplayEnhancer {
  constructor() {
    super(...arguments);
    this.selectionHandler = null;
    this.priceHandler = null;
  }
  parseDisplayAttributes() {
    super.parseDisplayAttributes();
    const parts = this.displayPath.split(".");
    if (parts.length >= 3 && parts[0] === "bundle") {
      this.selectorId = parts[1];
      this.property = parts.slice(2).join(".");
    }
  }
  setupStoreSubscriptions() {
    this.selectionHandler = () => void this.updateDisplay();
    document.addEventListener("bundle:selection-changed", this.selectionHandler);
    this.priceHandler = (e) => {
      const { selectorId } = e.detail;
      if (selectorId === this.selectorId) void this.updateDisplay();
    };
    document.addEventListener("bundle:price-updated", this.priceHandler);
  }
  getPropertyValue() {
    if (!this.selectorId || !this.property) return void 0;
    const state = BundleSelectorEnhancer.getBundleState(this.selectorId);
    if (!state) return void 0;
    switch (this.property) {
      case "isSelected":
        return state.isSelected;
      case "name":
        return state.name;
      case "price":
        return state.bundlePrice?.price;
      case "originalPrice":
        return state.bundlePrice?.originalPrice;
      case "discountAmount":
        return state.bundlePrice?.discountAmount;
      case "discountPercentage":
        return state.bundlePrice?.discountPercentage;
      case "hasDiscount":
        return state.bundlePrice?.hasDiscount ?? false;
      case "unitPrice":
        return state.bundlePrice?.unitPrice;
      case "originalUnitPrice":
        return state.bundlePrice?.originalUnitPrice;
      case "currency":
        return state.bundlePrice?.currency;
      default:
        this.logger.warn(`Unknown bundle display property: "${this.property}"`);
        return void 0;
    }
  }
  getDefaultFormatType(property) {
    return FORMAT_MAP[property] ?? "auto";
  }
  destroy() {
    super.destroy();
    if (this.selectionHandler) {
      document.removeEventListener("bundle:selection-changed", this.selectionHandler);
      this.selectionHandler = null;
    }
    if (this.priceHandler) {
      document.removeEventListener("bundle:price-updated", this.priceHandler);
      this.priceHandler = null;
    }
  }
}
export {
  BundleDisplayEnhancer,
  BundleSelectorEnhancer
};
