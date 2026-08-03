import type { Package } from '@/types/campaign';
import type { RenderContext } from './bundle-selector.types';

// ─── Variant selectors ────────────────────────────────────────────────────────

export function renderVariantSelectors(
  container: HTMLElement,
  bundleId: string,
  slotIndex: number,
  currentPkg: Package,
  allPackages: Package[],
  ctx: RenderContext
): void {
  const productId = currentPkg.product_id;
  if (!productId) return;

  const productPkgs = allPackages.filter(p => p.product_id === productId);
  const currentAttrs = currentPkg.product_variant_attribute_values || [];
  if (currentAttrs.length === 0) return;

  const attrDefs = new Map<string, string>();
  for (const pkg of productPkgs) {
    for (const attr of pkg.product_variant_attribute_values || []) {
      if (!attrDefs.has(attr.code)) attrDefs.set(attr.code, attr.name);
    }
  }

  const selected: Record<string, string> = {};
  for (const attr of currentAttrs) selected[attr.code] = attr.value;

  const outerSwap = container.getAttribute('next-render-swap') === 'outerHTML';
  const noLabel = container.hasAttribute('next-render-no-label');
  const target = outerSwap ? document.createElement('div') : container;
  if (!outerSwap) container.innerHTML = '';

  for (const [code, name] of attrDefs) {
    const values = [
      ...new Set(
        productPkgs.flatMap(p =>
          (p.product_variant_attribute_values || [])
            .filter(a => a.code === code)
            .map(a => a.value)
        )
      ),
    ];

    if (ctx.variantSelectorTemplate) {
      renderSelectorTemplate(
        target,
        bundleId,
        slotIndex,
        code,
        name,
        values,
        selected[code] ?? '',
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
        selected[code] ?? '',
        productPkgs,
        selected,
        ctx
      );
    } else {
      const field = document.createElement('div');
      field.className = 'next-slot-variant-field';
      field.dataset.nextVariantCode = code;
      field.dataset.nextVariantName = name;
      field.dataset.nextBundleId = bundleId;
      field.dataset.nextSlotIndex = String(slotIndex);

      const label = document.createElement('label');
      label.className = 'next-slot-variant-label';
      label.textContent = `Select ${name}:`;

      const select = document.createElement('select');
      select.className = 'next-slot-variant-select';
      select.dataset.nextVariantCode = code;

      for (const value of values) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        if (value === selected[code]) option.selected = true;
        if (!isVariantValueAvailable(value, code, productPkgs, selected)) {
          option.disabled = true;
        }
        select.appendChild(option);
      }

      const handler: EventListener = () => {
        void ctx.onSelectChange(select, bundleId, slotIndex);
      };
      ctx.selectHandlers.set(select, handler);
      select.addEventListener('change', handler);

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

function renderOptionItems(
  target: HTMLElement,
  code: string,
  name: string,
  values: string[],
  selectedValue: string,
  productPkgs: Package[],
  allSelectedAttrs: Record<string, string>,
  ctx: RenderContext
): void {
  for (const value of values) {
    const isSelected = value === selectedValue;
    const isAvailable = isVariantValueAvailable(
      value,
      code,
      productPkgs,
      allSelectedAttrs
    );
    const vars: Record<string, string> = {
      'attr.code': code,
      'attr.name': name,
      'option.value': value,
      'option.selected': String(isSelected),
      'option.available': String(isAvailable),
    };
    const html = ctx.variantOptionTemplate.replace(
      /\{([^}]+)\}/g,
      (_, k) => vars[k] ?? ''
    );
    const temp = document.createElement('div');
    temp.innerHTML = html.trim();
    const first = temp.firstElementChild;
    const el = first instanceof HTMLElement ? first : null;
    if (!el) continue;

    el.dataset.nextVariantOption = code;
    el.dataset.nextVariantValue = value;
    if (isSelected) {
      el.setAttribute('data-selected', 'true');
      el.classList.add(ctx.classNames.variantSelected);
    }
    if (!isAvailable) {
      el.dataset.nextUnavailable = 'true';
      el.classList.add(ctx.classNames.variantUnavailable);
      if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
        el.disabled = true;
      } else {
        el.setAttribute('aria-disabled', 'true');
      }
    }

    target.appendChild(el);
  }
}

function renderCustomOptions(
  container: HTMLElement,
  bundleId: string,
  slotIndex: number,
  code: string,
  name: string,
  values: string[],
  selectedValue: string,
  productPkgs: Package[],
  allSelectedAttrs: Record<string, string>,
  ctx: RenderContext
): void {
  const group = document.createElement('div');
  group.className = ctx.classNames.slotVariantGroup;
  group.dataset.nextVariantCode = code;
  group.dataset.nextVariantName = name;
  group.dataset.nextBundleId = bundleId;
  group.dataset.nextSlotIndex = String(slotIndex);

  renderOptionItems(
    group,
    code,
    name,
    values,
    selectedValue,
    productPkgs,
    allSelectedAttrs,
    ctx
  );

  container.appendChild(group);
}

function renderSelectorTemplate(
  container: HTMLElement,
  bundleId: string,
  slotIndex: number,
  code: string,
  name: string,
  values: string[],
  selectedValue: string,
  productPkgs: Package[],
  allSelectedAttrs: Record<string, string>,
  ctx: RenderContext
): void {
  const vars: Record<string, string> = {
    'attr.code': code,
    'attr.name': name,
    'attr.selectedValue': selectedValue,
  };
  const html = ctx.variantSelectorTemplate.replace(
    /\{([^}]+)\}/g,
    (_, k) => vars[k] ?? ''
  );
  const temp = document.createElement('div');
  temp.innerHTML = html.trim();
  const root = temp.firstElementChild;
  const el = root instanceof HTMLElement ? root : null;
  if (!el) {
    ctx.logger.warn(
      'Variant selector template produced no root element for attribute',
      code
    );
    return;
  }

  el.dataset.nextVariantCode = code;
  el.dataset.nextBundleId = bundleId;
  el.dataset.nextSlotIndex = String(slotIndex);

  const optionsPlaceholder = el.querySelector<HTMLElement>(
    '[data-next-variant-options]'
  );
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
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        if (value === selectedValue) option.selected = true;
        if (
          !isVariantValueAvailable(value, code, productPkgs, allSelectedAttrs)
        ) {
          option.disabled = true;
        }
        optionsPlaceholder.appendChild(option);
      }
      const selectEl =
        optionsPlaceholder instanceof HTMLSelectElement
          ? optionsPlaceholder
          : el.querySelector<HTMLSelectElement>('select');
      if (selectEl) {
        selectEl.dataset.nextVariantCode = code;
        const handler: EventListener = () =>
          void ctx.onSelectChange(selectEl, bundleId, slotIndex);
        ctx.selectHandlers.set(selectEl, handler);
        selectEl.addEventListener('change', handler);
      }
    }
  }

  container.appendChild(el);
}

export function isVariantValueAvailable(
  value: string,
  code: string,
  productPkgs: Package[],
  allSelectedAttrs: Record<string, string>
): boolean {
  return productPkgs.some(pkg => {
    if (pkg.product_purchase_availability === 'unavailable') return false;
    const attrs = pkg.product_variant_attribute_values || [];
    if (!attrs.some(a => a.code === code && a.value === value)) return false;
    return Object.entries(allSelectedAttrs)
      .filter(([c]) => c !== code)
      .every(([c, v]) => attrs.some(a => a.code === c && a.value === v));
  });
}
