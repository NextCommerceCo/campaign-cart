/**
 * Cart Item Slots Enhancer
 * Expands cart items into individual configurable unit slots.
 * Each unit in the cart gets its own slot card. If the product has variants,
 * a selector per variant attribute (Color, Size, etc.) is injected automatically.
 * Changing a variant on any slot updates the cart in place.
 *
 * Container attributes:
 *   data-next-cart-slots                    — marks the container
 *   data-next-slot-template-id              — ID of an element whose innerHTML is the slot template
 *   data-next-slot-template                 — inline template string (alternative)
 *   data-next-empty-template                — HTML shown when cart is empty
 *   data-next-slot-filter                   — JSON filter to include only matching slots
 *                                             Supported keys:
 *                                               productId  — only slots whose package.product_id equals this value
 *                                               packageIds — array of package ref_ids to include
 *   data-next-variant-option-template-id    — ID of an element whose innerHTML is the custom variant
 *                                             option template. When set, custom elements replace the
 *                                             default <select> dropdowns. See "Custom variant options"
 *                                             below. Omit to keep the default <select> behavior.
 *
 * Template variables (slot template):
 *   {slot.index}       — 1-based slot number (#1, #2, #3 …)
 *   {item.packageId}   — current package ref_id for this slot
 *   {item.name}        — package name
 *   {item.image}       — package image URL
 *   {item.price}       — package price string (e.g. "$19.99")
 *   {item.unitPrice}   — same as price (per-unit when package qty = 1)
 *   {item.savingAmount} — formatted savings amount (e.g. "$5.00"), empty if no discount
 *   {item.percentOff}  — integer percent off (e.g. "25"), empty if no discount
 *   {item.variantName} — variant display name (e.g. "Black / Small")
 *   {item.productName} — product name
 *
 * Variant selector injection:
 *   Place an empty element with data-next-variant-selectors inside the slot template.
 *   The enhancer will populate it with one block per variant attribute dimension.
 *   Default mode renders a <select> per dimension.
 *   Custom mode (see below) renders your template for each option instead.
 *
 * Custom variant options (data-next-variant-option-template-id):
 *   Define a template whose inner HTML represents a single variant option (e.g. a button or
 *   swatch card). The enhancer renders one copy per option value, injects the variables below,
 *   and sets data-next-variant-option / data-next-variant-value / data-selected on the
 *   outermost element automatically. A click on any option element triggers a cart sync.
 *
 *   Template variables (option template):
 *     {attr.code}       — attribute code   (e.g. "color")
 *     {attr.name}       — attribute label  (e.g. "Color")
 *     {option.value}    — option value     (e.g. "Red")
 *     {option.selected} — "true" / "false" (whether this option is currently chosen)
 *
 *   CSS class added to the selected option element: next-variant-selected
 *   data-selected="true" is also set on the selected option element.
 *
 *   All options for one attribute are wrapped in:
 *     <div class="next-slot-variant-group" data-variant-code="{attr.code}">…</div>
 *
 * Example (default <select>):
 *   <template id="slot-tpl">
 *     <div class="slot-card">
 *       <span class="slot-num">#{slot.index}</span>
 *       <img src="{item.image}" alt="{item.name}" />
 *       <p class="slot-price">{item.price}</p>
 *       <div data-next-variant-selectors></div>
 *     </div>
 *   </template>
 *   <div data-next-cart-slots data-next-slot-template-id="slot-tpl"></div>
 *
 * Example (custom option buttons):
 *   <template id="variant-option-tpl">
 *     <button class="swatch" data-selected="{option.selected}">
 *       {option.value}
 *     </button>
 *   </template>
 *
 *   <template id="slot-tpl">
 *     <div class="slot-card">
 *       <img src="{item.image}" alt="{item.name}" />
 *       <div data-next-variant-selectors></div>
 *     </div>
 *   </template>
 *
 *   <div data-next-cart-slots
 *        data-next-slot-template-id="slot-tpl"
 *        data-next-variant-option-template-id="variant-option-tpl">
 *   </div>
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { formatCurrency } from '@/utils/currencyFormatter';
import type { CartState, CartItem } from '@/types/global';
import type { Package } from '@/types/campaign';

interface Slot {
  packageId: number;
  /** Snapshot of the cart item's price fields for this slot. */
  cartItem: CartItem;
}

interface SlotFilter {
  productId?: number;
  packageIds?: number[];
}

export class CartItemSlotsEnhancer extends BaseEnhancer {
  private template: string = '';
  private emptyTemplate: string = '<div class="cart-empty">Your cart is empty</div>';
  /** Custom HTML template for a single variant option. Empty string = use <select>. */
  private variantOptionTemplate: string = '';
  /** One entry per unit in the cart (qty=3 → 3 slots). */
  private slots: Slot[] = [];
  /** Prevent re-render loops when we trigger a cart update ourselves. */
  private isUpdating: boolean = false;
  private selectHandlers = new Map<HTMLSelectElement, EventListener>();
  private slotFilter: SlotFilter = {};
  /** Bound reference to the delegated click handler for custom variant options. */
  private boundVariantOptionClick: ((e: Event) => void) | null = null;

  public async initialize(): Promise<void> {
    this.validateElement();

    const templateId = this.getAttribute('data-next-slot-template-id');
    if (templateId) {
      this.template = document.getElementById(templateId)?.innerHTML.trim() || '';
    } else {
      this.template =
        this.getAttribute('data-next-slot-template') || this.element.innerHTML.trim();
    }

    this.emptyTemplate =
      this.getAttribute('data-next-empty-template') || this.emptyTemplate;

    const variantOptionTemplateId = this.getAttribute('data-next-variant-option-template-id');
    if (variantOptionTemplateId) {
      this.variantOptionTemplate =
        document.getElementById(variantOptionTemplateId)?.innerHTML.trim() || '';
    }

    const filterAttr = this.getAttribute('data-next-slot-filter');
    if (filterAttr) {
      try {
        this.slotFilter = JSON.parse(filterAttr);
      } catch {
        this.logger.warn('Invalid data-next-slot-filter JSON, ignoring', filterAttr);
      }
    }

    if (this.variantOptionTemplate) {
      const handler = this.handleVariantOptionClick.bind(this);
      this.boundVariantOptionClick = handler;
      this.element.addEventListener('click', handler);
    }

    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));
    this.handleCartUpdate(useCartStore.getState());

    this.logger.debug('CartItemSlotsEnhancer initialized');
  }

  public update(): void {}

  // ─── Cart state → slot state ────────────────────────────────────────────────

  private handleCartUpdate(cartState: CartState): void {
    if (this.isUpdating) return;

    if (cartState.isEmpty || cartState.items.length === 0) {
      this.slots = [];
      this.cleanupSelectHandlers();
      this.element.innerHTML = this.emptyTemplate;
      return;
    }

    // Expand items: packageId with qty 3 → three slot entries
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

  private matchesFilter(packageId: number, allPackages: Package[]): boolean {
    const { productId, packageIds } = this.slotFilter;
    if (packageIds && packageIds.length > 0 && !packageIds.includes(packageId)) return false;
    if (productId !== undefined) {
      const pkg = allPackages.find(p => p.ref_id === packageId);
      if (!pkg || pkg.product_id !== productId) return false;
    }
    return true;
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  private renderSlots(): void {
    this.cleanupSelectHandlers();

    const allPackages = useCampaignStore.getState().packages || [];
    this.element.innerHTML = '';

    this.slots.forEach((slot, index) => {
      const pkg = allPackages.find(p => p.ref_id === slot.packageId);
      if (!pkg) return;

      const wrapper = this.createSlotElement(slot, index, pkg);

      // Inject variant selectors into the placeholder if present
      const placeholder = wrapper.querySelector<HTMLElement>('[data-next-variant-selectors]');
      if (placeholder) {
        this.renderVariantSelectors(placeholder, index, pkg, allPackages);
      }

      this.element.appendChild(wrapper);
    });
  }

  private createSlotElement(slot: Slot, index: number, pkg: Package): HTMLElement {
    const ci = slot.cartItem;
    // Prefer cart item prices (reflect offers/discounts) over campaign package prices
    const unitPrice =
      ci.unit_price_incl_discount ||
      ci.price_per_unit ||
      pkg.price ||
      '';
    const unitPriceBeforeDiscount =
      ci.price_per_unit || pkg.price || '';
    const retailPrice = ci.price_retail || pkg.price_retail || '';

    const numPrice = parseFloat(unitPrice);
    const numBeforeDiscount = parseFloat(unitPriceBeforeDiscount);
    const savingAmount =
      !isNaN(numPrice) && !isNaN(numBeforeDiscount) && numBeforeDiscount > numPrice
        ? formatCurrency(numBeforeDiscount - numPrice)
        : '';
    const percentOff =
      !isNaN(numPrice) && !isNaN(numBeforeDiscount) && numBeforeDiscount > 0
        ? String(Math.round(((numBeforeDiscount - numPrice) / numBeforeDiscount) * 100))
        : '';

    const vars: Record<string, string> = {
      'slot.index': String(index + 1),
      'item.packageId': String(slot.packageId),
      'item.name': pkg.name || '',
      'item.image': pkg.image || ci.image || '',
      // Cart-accurate prices
      'item.price': unitPrice,
      'item.unitPrice': unitPrice,
      'item.unitPriceBeforeDiscount': unitPriceBeforeDiscount,
      'item.retailPrice': retailPrice,
      'item.packagePrice': ci.package_price_incl_discount || ci.price_total || pkg.price_total || '',
      'item.packagePriceBeforeDiscount': ci.price_total || pkg.price_total || '',
      // Savings
      'item.savingAmount': savingAmount,
      'item.percentOff': percentOff,
      // Variant / product info
      'item.variantName': pkg.product_variant_name || '',
      'item.productName': pkg.product_name || '',
    };

    const wrapper = document.createElement('div');
    wrapper.className = 'next-slot-item';
    wrapper.dataset.nextSlotIndex = String(index);
    wrapper.innerHTML = this.template.replace(/\{([^}]+)\}/g, (_, key) => vars[key] ?? '');
    return wrapper;
  }

  // ─── Variant selectors ──────────────────────────────────────────────────────

  private renderVariantSelectors(
    container: HTMLElement,
    slotIndex: number,
    currentPkg: Package,
    allPackages: Package[]
  ): void {
    const productId = currentPkg.product_id;
    if (!productId) return;

    const productPkgs = allPackages.filter(p => p.product_id === productId);
    const currentAttrs = currentPkg.product_variant_attribute_values || [];
    if (currentAttrs.length === 0) return; // Product has no variants

    // Collect ordered attribute definitions (code → display name)
    const attrDefs = new Map<string, string>();
    for (const pkg of productPkgs) {
      for (const attr of pkg.product_variant_attribute_values || []) {
        if (!attrDefs.has(attr.code)) {
          attrDefs.set(attr.code, attr.name);
        }
      }
    }

    // Current selection from this slot's package
    const selected: Record<string, string> = {};
    for (const attr of currentAttrs) {
      selected[attr.code] = attr.value;
    }

    container.innerHTML = '';

    for (const [code, name] of attrDefs) {
      // Unique values across all product packages for this attribute
      const values = [
        ...new Set(
          productPkgs.flatMap(p =>
            (p.product_variant_attribute_values || [])
              .filter(a => a.code === code)
              .map(a => a.value)
          )
        ),
      ];

      if (this.variantOptionTemplate) {
        this.renderCustomOptions(container, slotIndex, code, name, values, selected[code] ?? '');
      } else {
        const field = document.createElement('div');
        field.className = 'next-slot-variant-field';

        const label = document.createElement('label');
        label.className = 'next-slot-variant-label';
        label.textContent = `Select ${name}:`;

        const select = document.createElement('select');
        select.className = 'next-slot-variant-select';
        select.dataset.variantCode = code;
        select.dataset.slotIndex = String(slotIndex);

        for (const value of values) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          if (value === selected[code]) option.selected = true;
          select.appendChild(option);
        }

        const handler: EventListener = () =>
          this.handleVariantChange(slotIndex, productPkgs);
        this.selectHandlers.set(select, handler);
        select.addEventListener('change', handler);

        field.appendChild(label);
        field.appendChild(select);
        container.appendChild(field);
      }
    }
  }

  private renderCustomOptions(
    container: HTMLElement,
    slotIndex: number,
    code: string,
    name: string,
    values: string[],
    selectedValue: string
  ): void {
    const group = document.createElement('div');
    group.className = 'next-slot-variant-group';
    group.dataset.variantCode = code;
    group.dataset.variantName = name;

    for (const value of values) {
      const isSelected = value === selectedValue;
      const vars: Record<string, string> = {
        'attr.code': code,
        'attr.name': name,
        'option.value': value,
        'option.selected': String(isSelected),
      };
      const html = this.variantOptionTemplate.replace(
        /\{([^}]+)\}/g,
        (_, k) => vars[k] ?? ''
      );
      const temp = document.createElement('div');
      temp.innerHTML = html.trim();
      const el = temp.firstElementChild as HTMLElement | null;
      if (!el) continue;

      el.dataset.nextVariantOption = code;
      el.dataset.nextVariantValue = value;
      el.dataset.nextSlotIndex = String(slotIndex);
      if (isSelected) {
        el.setAttribute('data-selected', 'true');
        el.classList.add('next-variant-selected');
      }

      group.appendChild(el);
    }

    container.appendChild(group);
  }

  // ─── Variant change → cart update ──────────────────────────────────────────

  /** Delegated click handler for custom variant option elements. */
  private handleVariantOptionClick(e: Event): void {
    const target = e.target as HTMLElement;
    const optionEl = target.closest<HTMLElement>('[data-next-variant-option]');
    if (!optionEl) return;

    const code = optionEl.dataset.nextVariantOption;
    const value = optionEl.dataset.nextVariantValue;
    const slotIndex = Number(optionEl.dataset.nextSlotIndex);
    if (!code || !value) return;

    // Update selected state within this attribute group
    const group = optionEl.closest<HTMLElement>('[data-variant-code]');
    if (group) {
      group.querySelectorAll<HTMLElement>('[data-next-variant-option]').forEach(el => {
        el.removeAttribute('data-selected');
        el.classList.remove('next-variant-selected');
      });
      optionEl.setAttribute('data-selected', 'true');
      optionEl.classList.add('next-variant-selected');
    }

    // Read all currently selected values across attribute groups for this slot
    const slotEl = this.element.querySelector<HTMLElement>(
      `[data-next-slot-index="${slotIndex}"]`
    );
    if (!slotEl) return;

    const selectedAttrs: Record<string, string> = {};
    slotEl.querySelectorAll<HTMLElement>('[data-variant-code]').forEach(g => {
      const attrCode = g.dataset.variantCode!;
      const sel = g.querySelector<HTMLElement>('[data-next-variant-option][data-selected="true"]');
      if (sel?.dataset.nextVariantValue) {
        selectedAttrs[attrCode] = sel.dataset.nextVariantValue;
      }
    });

    const allPackages = useCampaignStore.getState().packages || [];
    const currentPkg = allPackages.find(p => p.ref_id === this.slots[slotIndex]?.packageId);
    if (!currentPkg) return;
    const productPkgs = allPackages.filter(p => p.product_id === currentPkg.product_id);

    // Find the matching package and sync cart
    const matched = productPkgs.find(pkg => {
      const attrs = pkg.product_variant_attribute_values || [];
      return Object.entries(selectedAttrs).every(([c, v]) =>
        attrs.some(a => a.code === c && a.value === v)
      );
    });

    if (!matched) {
      this.logger.warn('No package found for variant combination', selectedAttrs);
      return;
    }

    const slot = this.slots[slotIndex];
    if (!slot || slot.packageId === matched.ref_id) return;
    slot.packageId = matched.ref_id;

    void this.syncCart();
  }

  private async handleVariantChange(
    slotIndex: number,
    productPkgs: Package[]
  ): Promise<void> {
    // Read all selects in this slot to get the current combination
    const slotEl = this.element.querySelector<HTMLElement>(
      `[data-next-slot-index="${slotIndex}"]`
    );
    if (!slotEl) return;

    const selectedAttrs: Record<string, string> = {};
    slotEl
      .querySelectorAll<HTMLSelectElement>('select[data-variant-code]')
      .forEach(sel => {
        if (sel.dataset.variantCode) {
          selectedAttrs[sel.dataset.variantCode] = sel.value;
        }
      });

    // Also read via dataset (consistent with how we set it)
    slotEl
      .querySelectorAll<HTMLSelectElement>('select.next-slot-variant-select')
      .forEach(sel => {
        if (sel.dataset.variantCode) {
          selectedAttrs[sel.dataset.variantCode] = sel.value;
        }
      });

    // Find the package matching all selected attribute values
    const matched = productPkgs.find(pkg => {
      const attrs = pkg.product_variant_attribute_values || [];
      return Object.entries(selectedAttrs).every(([code, value]) =>
        attrs.some(a => a.code === code && a.value === value)
      );
    });

    if (!matched) {
      this.logger.warn('No package found for variant combination', selectedAttrs);
      return;
    }

    // Update local slot state
    const slot = this.slots[slotIndex];
    if (!slot || slot.packageId === matched.ref_id) return;
    slot.packageId = matched.ref_id;

    // Sync cart: group slots → { packageId, quantity }[]
    await this.syncCart();
  }

  private async syncCart(): Promise<void> {
    this.isUpdating = true;
    try {
      const qtyCounts = new Map<number, number>();
      for (const slot of this.slots) {
        qtyCounts.set(slot.packageId, (qtyCounts.get(slot.packageId) ?? 0) + 1);
      }

      const items = Array.from(qtyCounts.entries()).map(([packageId, quantity]) => ({
        packageId,
        quantity,
      }));

      await useCartStore.getState().swapCart(items);
      this.logger.debug('Cart synced from slot variant change', items);
    } catch (error) {
      this.handleError(error, 'syncCart');
    } finally {
      this.isUpdating = false;
    }
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────────

  private cleanupSelectHandlers(): void {
    this.selectHandlers.forEach((handler, select) =>
      select.removeEventListener('change', handler)
    );
    this.selectHandlers.clear();
  }

  protected override cleanupEventListeners(): void {
    this.cleanupSelectHandlers();
    if (this.boundVariantOptionClick) {
      this.element.removeEventListener('click', this.boundVariantOptionClick);
    }
  }

  public override destroy(): void {
    this.cleanupSelectHandlers();
    if (this.boundVariantOptionClick) {
      this.element.removeEventListener('click', this.boundVariantOptionClick);
      this.boundVariantOptionClick = null;
    }
    super.destroy();
  }
}
