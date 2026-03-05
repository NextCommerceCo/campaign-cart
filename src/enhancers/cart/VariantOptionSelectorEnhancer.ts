/**
 * Variant Option Selector Enhancer
 * Simplifies building variant selection UIs for frontend developers
 *
 * This enhancer automatically extracts variant options (Size, Color, etc.) from
 * packages and manages the selection state, making it easy to build dropdown
 * selectors, button groups, and other variant selection UIs.
 *
 * @example Basic Size Selector
 * <div data-next-variant-selector
 *      data-next-attribute-code="size"
 *      data-next-base-package-id="100">
 *
 *   <!-- Options auto-generated or manual -->
 *   <button data-next-variant-option
 *           data-next-variant-value="Small">
 *     Small
 *   </button>
 *   <button data-next-variant-option
 *           data-next-variant-value="Medium">
 *     Medium
 *   </button>
 *   <button data-next-variant-option
 *           data-next-variant-value="Large">
 *     Large
 *   </button>
 * </div>
 *
 * @example Dropdown Selector
 * <select data-next-variant-selector
 *         data-next-attribute-code="color"
 *         data-next-base-package-id="100">
 *   <option data-next-variant-option data-next-variant-value="Red">Red</option>
 *   <option data-next-variant-option data-next-variant-value="Blue">Blue</option>
 *   <option data-next-variant-option data-next-variant-value="Green">Green</option>
 * </select>
 *
 * @example Auto-populate Mode (Predefined Template)
 * <div data-next-variant-selector
 *      data-next-attribute-code="size"
 *      data-next-base-package-id="100"
 *      data-next-auto-populate="true"
 *      data-next-template="button">
 *   <!-- Options will be auto-generated from campaign data -->
 * </div>
 *
 * @example Custom Template Mode
 * <div data-next-variant-selector
 *      data-next-attribute-code="size"
 *      data-next-base-package-id="100"
 *      data-next-auto-populate="true">
 *   <template>
 *     <button class="custom-button" type="button">
 *       <span class="size-label">Size:</span>
 *       <span class="size-value" data-slot="value"></span>
 *       <span class="size-price" data-slot="price"></span>
 *     </button>
 *   </template>
 * </div>
 *
 * Attributes:
 * - data-next-variant-selector: Main identifier for the enhancer
 * - data-next-attribute-code: Variant attribute code (e.g., "size", "color")
 * - data-next-base-package-id: Base package ID to find variants for
 * - data-next-auto-populate: Auto-generate options from campaign data (default: false)
 * - data-next-template: Template type for auto-populate ("button", "option", "card"). Ignored if <template> element present
 * - data-next-auto-select: Auto-select first option on load (default: false)
 * - data-next-swap-mode: Enable swap mode - changes cart when variant selected (default: false)
 * - data-next-template-slot-value: Selector for value slots in custom template (default: "[data-slot='value']")
 * - data-next-template-slot-price: Selector for price slots in custom template (default: "[data-slot='price']")
 *
 * Option Attributes:
 * - data-next-variant-option: Identifies a selectable variant option
 * - data-next-variant-value: The variant attribute value (e.g., "Small", "Red")
 * - data-next-package-id: Optional explicit package ID for this variant
 * - data-next-selected: Pre-selected state
 *
 * Events:
 * - variant:option-selected - When variant option is selected
 * - variant:package-changed - When the selected package changes
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import type { Package, VariantAttribute } from '@/types/campaign';
import type { CartState } from '@/types/global';

interface VariantOption {
  element: HTMLElement;
  value: string;
  packageId?: number;
  package?: Package;
  isSelected: boolean;
  isAvailable: boolean;
  attributes?: VariantAttribute[];
}

interface VariantGroup {
  attributeCode: string;
  attributeName: string;
  options: Map<string, VariantOption>;
}

export class VariantOptionSelectorEnhancer extends BaseEnhancer {
  private attributeCode!: string;
  private basePackageId?: number;
  private autoPopulate: boolean = false;
  private autoSelect: boolean = false;
  private swapMode: boolean = false;
  private template: 'button' | 'option' | 'card' = 'button';
  private customTemplate: HTMLTemplateElement | null = null;
  private templateSlotValueSelector: string = "[data-slot='value']";
  private templateSlotPriceSelector: string = "[data-slot='price']";

  private variantGroup: VariantGroup | null = null;
  private selectedOption: VariantOption | null = null;
  private availablePackages: Package[] = [];

  private clickHandlers = new Map<HTMLElement, (event: Event) => void>();
  private changeHandlers = new Map<HTMLElement, (event: Event) => void>();
  private mutationObserver: MutationObserver | null = null;

  public async initialize(): Promise<void> {
    this.validateElement();

    // Get configuration
    this.attributeCode = this.getRequiredAttribute('data-next-attribute-code');
    const basePackageIdAttr = this.getAttribute('data-next-base-package-id');
    this.basePackageId = basePackageIdAttr ? parseInt(basePackageIdAttr, 10) : undefined;

    this.autoPopulate = this.getAttribute('data-next-auto-populate') === 'true';
    this.autoSelect = this.getAttribute('data-next-auto-select') === 'true';
    this.swapMode = this.getAttribute('data-next-swap-mode') === 'true';
    
    // Check for custom template first
    this.customTemplate = this.element.querySelector('template');
    
    // Set template slot selectors
    const valueSlotSelector = this.getAttribute('data-next-template-slot-value');
    const priceSlotSelector = this.getAttribute('data-next-template-slot-price');
    if (valueSlotSelector) this.templateSlotValueSelector = valueSlotSelector;
    if (priceSlotSelector) this.templateSlotPriceSelector = priceSlotSelector;
    
    // Only use predefined template if no custom template exists
    if (!this.customTemplate) {
      this.template = (this.getAttribute('data-next-template') || 'button') as 'button' | 'option' | 'card';
    }

    // Load available packages and variant data
    await this.loadVariantData();

    console.log('VariantOptionSelectorEnhancer - variant group loaded:', this.variantGroup);

    // Auto-populate options if requested
    if (this.autoPopulate && this.variantGroup) {
      this.populateOptions();
    }

    // Initialize existing option elements
    this.initializeOptions();

    // Set up mutation observer
    this.setupMutationObserver();

    // Subscribe to cart changes if in swap mode
    if (this.swapMode) {
      this.subscribe(useCartStore, this.syncWithCart.bind(this));
      this.syncWithCart(useCartStore.getState());
    }

    // Auto-select first option if configured
    if (this.autoSelect && !this.selectedOption && this.variantGroup) {
      this.selectFirstAvailableOption();
    }

    // Expose methods
    (this.element as any)._getSelectedOption = () => this.selectedOption;
    (this.element as any)._getSelectedPackageId = () => this.selectedOption?.packageId;
    (this.element as any)._getSelectedValue = () => this.selectedOption?.value;

    this.logger.debug('VariantOptionSelectorEnhancer initialized:', {
      attributeCode: this.attributeCode,
      basePackageId: this.basePackageId,
      optionCount: this.variantGroup?.options.size || 0,
      autoPopulate: this.autoPopulate,
      customTemplate: !!this.customTemplate,
      template: this.template,
      swapMode: this.swapMode
    });
  }

  private async loadVariantData(): Promise<void> {
    try {
      const campaignStore = useCampaignStore.getState();
      const campaign = campaignStore;

      if (!campaign?.packages) {
        this.logger.warn('No campaign packages available');
        return;
      }

      // Find base package if specified
      let basePackage: Package | undefined;
      if (this.basePackageId) {
        basePackage = campaign.packages.find(pkg => pkg.ref_id === this.basePackageId);
        if (!basePackage) {
          this.logger.warn(`Base package ${this.basePackageId} not found`);
        }
      }

      // Find all packages that share the same product but different variant attributes
      this.availablePackages = this.findRelatedVariantPackages(campaign.packages, basePackage);

      // Extract variant options
      this.variantGroup = this.extractVariantOptions(this.availablePackages);

      this.logger.debug('Loaded variant data:', {
        attributeCode: this.attributeCode,
        basePackage: basePackage?.name,
        relatedPackages: this.availablePackages.length,
        options: this.variantGroup?.options.size
      });

    } catch (error) {
      this.logger.error('Failed to load variant data:', error);
    }
  }

  private findRelatedVariantPackages(allPackages: Package[], basePackage?: Package): Package[] {
    if (!basePackage) {
      // No base package - return packages that have the attribute code
      return allPackages.filter(pkg =>
        pkg.product?.variant?.attributes?.some(attr => attr.code === this.attributeCode)
      );
    }

    const baseProductId = basePackage.product_id;
    if (!baseProductId) {
      this.logger.warn('Base package has no product_id');
      return [basePackage];
    }

    // Find all packages with the same product_id but different variant values
    return allPackages.filter(pkg =>
      pkg.product_id === baseProductId &&
      pkg.product?.variant?.attributes?.some(attr => attr.code === this.attributeCode)
    );
  }

  private extractVariantOptions(packages: Package[]): VariantGroup | null {
    const optionsMap = new Map<string, VariantOption>();
    let attributeName = this.attributeCode;

    packages.forEach(pkg => {
      const attribute = pkg.product?.variant?.attributes?.find(
        attr => attr.code === this.attributeCode
      );

      if (attribute) {
        attributeName = attribute.name; // Use the full name from the first match

        if (!optionsMap.has(attribute.value)) {
          optionsMap.set(attribute.value, {
            element: null as any, // Will be set when option is registered
            value: attribute.value,
            packageId: pkg.ref_id,
            package: pkg,
            isSelected: false,
            isAvailable: this.isPackageAvailable(pkg),
            attributes: pkg.product?.variant?.attributes
          });
        }
      }
    });

    if (optionsMap.size === 0) {
      this.logger.warn(`No variant options found for attribute "${this.attributeCode}"`);
      return null;
    }

    return {
      attributeCode: this.attributeCode,
      attributeName,
      options: optionsMap
    };
  }

  private isPackageAvailable(pkg: Package): boolean {
    // Check inventory and purchase availability
    const inventoryAvailable = pkg.product?.inventory_availability !== 'out_of_stock';
    const purchaseAvailable = pkg.product?.purchase_availability === 'available';
    return inventoryAvailable && purchaseAvailable;
  }

  private populateOptions(): void {
    if (!this.variantGroup) return;

    const fragment = document.createDocumentFragment();

    this.variantGroup.options.forEach((option, value) => {
      const optionElement = this.createOptionElement(option);
      fragment.appendChild(optionElement);
    });

    // Clear existing content and append new options
    this.element.innerHTML = '';
    this.element.appendChild(fragment);

    // Register all newly created options to set up event handlers
    this.variantGroup.options.forEach((option) => {
      if (option.element) {
        this.registerOption(option.element);
      }
    });

    this.logger.debug(`Auto-populated ${this.variantGroup.options.size} options`);
  }

  private createOptionElement(option: VariantOption): HTMLElement {
    // If custom template exists, use it
    if (this.customTemplate) {
      return this.createFromTemplate(option);
    }

    // Otherwise create from predefined template
    let element: HTMLElement;

    switch (this.template) {
      case 'option':
        element = document.createElement('option');
        element.textContent = option.value;
        element.value = option.value;
        break;

      case 'card':
        element = document.createElement('div');
        element.className = 'next-variant-card';
        element.innerHTML = `
          <div class="variant-value">${option.value}</div>
          ${option.package ? `
            <div class="variant-price" data-next-display-price="${option.package.ref_id}"></div>
          ` : ''}
        `;
        break;

      case 'button':
      default:
        element = document.createElement('button');
        element.type = 'button';
        element.className = 'next-variant-button';
        element.textContent = option.value;
        break;
    }

    element.setAttribute('data-next-variant-option', '');
    element.setAttribute('data-next-variant-value', option.value);

    if (option.packageId) {
      element.setAttribute('data-next-package-id', option.packageId.toString());
    }

    if (!option.isAvailable) {
      element.setAttribute('disabled', 'true');
      element.classList.add('next-unavailable');
    }

    // Update the option object with the new element reference
    option.element = element;

    return element;
  }

  private createFromTemplate(option: VariantOption): HTMLElement {
    if (!this.customTemplate) {
      throw new Error('Custom template not found');
    }

    // Clone the template content
    const clone = this.customTemplate.content.cloneNode(true) as DocumentFragment;
    const element = clone.firstElementChild?.cloneNode(true) as HTMLElement;

    if (!element) {
      throw new Error('Template has no child element');
    }

    // Replace value slots
    const valueSlots = element.querySelectorAll(this.templateSlotValueSelector);
    valueSlots.forEach(slot => {
      if (slot instanceof HTMLElement) {
        slot.textContent = option.value;
        slot.setAttribute('data-slot-value', option.value);
      }
    });

    // Replace price slots if package exists
    if (option.package) {
      const priceSlots = element.querySelectorAll(this.templateSlotPriceSelector);
      priceSlots.forEach(slot => {
        if (slot instanceof HTMLElement) {
          slot.setAttribute('data-next-display-price', option.package!.ref_id.toString());
        }
      });
    }

    // Add standard attributes
    element.setAttribute('data-next-variant-option', '');
    element.setAttribute('data-next-variant-value', option.value);

    if (option.packageId) {
      element.setAttribute('data-next-package-id', option.packageId.toString());
    }

    if (!option.isAvailable) {
      element.setAttribute('disabled', 'true');
      element.classList.add('next-unavailable');
    }

    // Update the option object with the new element reference
    option.element = element;

    return element;
  }

  private initializeOptions(): void {
    const isSelect = this.element.tagName === 'SELECT';

    if (isSelect) {
      this.initializeSelectOptions();
    } else {
      this.initializeButtonOptions();
    }
  }

  private initializeSelectOptions(): void {
    const selectElement = this.element as HTMLSelectElement;

    const changeHandler = (event: Event) => this.handleSelectChange(event);
    this.changeHandlers.set(selectElement, changeHandler);
    selectElement.addEventListener('change', changeHandler);

    // Process existing options
    const options = selectElement.querySelectorAll('[data-next-variant-option]');
    options.forEach((optionEl) => {
      if (optionEl instanceof HTMLOptionElement) {
        this.registerOption(optionEl);
      }
    });

    this.logger.debug(`Initialized select with ${options.length} options`);
  }

  private initializeButtonOptions(): void {
    const optionElements = this.element.querySelectorAll('[data-next-variant-option]');

    optionElements.forEach((optionEl) => {
      if (optionEl instanceof HTMLElement) {
        this.registerOption(optionEl);
      }
    });

    this.logger.debug(`Initialized ${optionElements.length} button options`);
  }

  private registerOption(element: HTMLElement): void {
    const value = element.getAttribute('data-next-variant-value');
    if (!value) {
      this.logger.warn('Option missing variant value', element);
      return;
    }

    const packageIdAttr = element.getAttribute('data-next-package-id');
    const packageId = packageIdAttr ? parseInt(packageIdAttr, 10) : undefined;
    const isPreSelected = element.getAttribute('data-next-selected') === 'true';

    // Find matching option from variant group or create new
    let option = this.variantGroup?.options.get(value);

    if (!option) {
      // Option not in variant group - create standalone option
      option = {
        element,
        value,
        packageId,
        isSelected: isPreSelected,
        isAvailable: !element.hasAttribute('disabled')
      };

      if (!this.variantGroup) {
        this.variantGroup = {
          attributeCode: this.attributeCode,
          attributeName: this.attributeCode,
          options: new Map()
        };
      }
      this.variantGroup.options.set(value, option);
    } else {
      // Update existing option with element reference
      option.element = element;
      option.isSelected = isPreSelected;

      // Override package ID if explicitly set
      if (packageId) {
        option.packageId = packageId;
      }
    }

    // Set up click handler for buttons
    if (element.tagName !== 'OPTION') {
      const clickHandler = (event: Event) => this.handleOptionClick(event, option!);
      this.clickHandlers.set(element, clickHandler);
      element.addEventListener('click', clickHandler);
    }

    // Add styling classes
    element.classList.add('next-variant-option');
    if (!option.isAvailable) {
      element.classList.add('next-unavailable');
    }

    // Handle pre-selection
    if (isPreSelected && !this.selectedOption) {
      this.selectOption(option);
    }

    this.logger.debug(`Registered variant option:`, {
      value,
      packageId: option.packageId,
      isAvailable: option.isAvailable
    });
  }

  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (node.hasAttribute('data-next-variant-option')) {
                this.registerOption(node);
              }

              const options = node.querySelectorAll('[data-next-variant-option]');
              options.forEach((opt) => {
                if (opt instanceof HTMLElement) {
                  this.registerOption(opt);
                }
              });
            }
          });

          mutation.removedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              this.handleOptionRemoval(node);
            }
          });
        }
      });
    });

    this.mutationObserver.observe(this.element, {
      childList: true,
      subtree: true
    });
  }

  private handleOptionRemoval(element: HTMLElement): void {
    const handler = this.clickHandlers.get(element);
    if (handler) {
      element.removeEventListener('click', handler);
      this.clickHandlers.delete(element);
    }

    // Find and remove from variant group
    if (this.variantGroup) {
      for (const [value, option] of this.variantGroup.options) {
        if (option.element === element) {
          this.variantGroup.options.delete(value);
          if (this.selectedOption === option) {
            this.selectedOption = null;
          }
          break;
        }
      }
    }
  }

  private handleSelectChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const selectedOptionEl = selectElement.selectedOptions[0];

    if (selectedOptionEl instanceof HTMLOptionElement) {
      const value = selectedOptionEl.getAttribute('data-next-variant-value');
      if (value && this.variantGroup) {
        const option = this.variantGroup.options.get(value);
        if (option) {
          this.handleOptionSelection(option);
        }
      }
    }
  }

  private async handleOptionClick(event: Event, option: VariantOption): Promise<void> {
    event.preventDefault();

    if (!option.isAvailable) {
      this.logger.debug('Clicked unavailable option:', option.value);
      return;
    }

    await this.handleOptionSelection(option);
  }

  private async handleOptionSelection(option: VariantOption): Promise<void> {
    try {
      // If already selected, do nothing
      if (this.selectedOption === option) {
        return;
      }

      const previousOption = this.selectedOption;
      const previousPackageId = previousOption?.packageId;

      // Select the option
      this.selectOption(option);

      // Emit events
      this.eventBus.emit('variant:option-selected', {
        attributeCode: this.attributeCode,
        value: option.value,
        packageId: option.packageId,
        previousValue: previousOption?.value,
        previousPackageId
      });

      if (option.packageId && option.packageId !== previousPackageId) {
        this.emit('variant:package-changed', {
          attributeCode: this.attributeCode,
          packageId: option.packageId,
          previousPackageId,
          package: option.package
        });
      }

      // Handle cart update if in swap mode
      if (this.swapMode && option.packageId) {
        await this.updateCart(previousPackageId, option.packageId);
      }

    } catch (error) {
      this.handleError(error, 'handleOptionSelection');
    }
  }

  private selectOption(option: VariantOption): void {
    if (!this.variantGroup) return;

    // Clear previous selection
    this.variantGroup.options.forEach(opt => {
      if (opt.element) {
        opt.element.classList.remove('next-selected');
        opt.element.setAttribute('data-next-selected', 'false');
        opt.isSelected = false;

        // Handle select options
        if (opt.element instanceof HTMLOptionElement) {
          opt.element.selected = false;
        }
      }
    });

    // Select new option
    option.isSelected = true;
    if (option.element) {
      option.element.classList.add('next-selected');
      option.element.setAttribute('data-next-selected', 'true');

      // Handle select options
      if (option.element instanceof HTMLOptionElement) {
        option.element.selected = true;
      }
    }

    this.selectedOption = option;

    // Store on container element
    this.element.setAttribute('data-selected-variant', option.value);
    if (option.packageId) {
      this.element.setAttribute('data-selected-package', option.packageId.toString());
    }

    this.logger.debug('Selected variant option:', {
      value: option.value,
      packageId: option.packageId,
      package: option.package?.name
    });
  }

  private selectFirstAvailableOption(): void {
    if (!this.variantGroup) return;

    for (const option of this.variantGroup.options.values()) {
      if (option.isAvailable) {
        this.selectOption(option);
        this.logger.debug('Auto-selected first available option:', option.value);
        return;
      }
    }
  }

  private async updateCart(previousPackageId: number | undefined, newPackageId: number): Promise<void> {
    const cartStore = useCartStore.getState();

    try {
      if (previousPackageId && previousPackageId !== newPackageId) {
        // Swap package in cart
        await cartStore.swapPackage(previousPackageId, {
          packageId: newPackageId,
          quantity: 1,
          isUpsell: false
        });
        this.logger.debug(`Swapped package: ${previousPackageId} -> ${newPackageId}`);
      } else if (!cartStore.hasItem(newPackageId)) {
        // Add new package to cart
        await cartStore.addItem({
          packageId: newPackageId,
          quantity: 1,
          isUpsell: false
        });
        this.logger.debug(`Added package to cart: ${newPackageId}`);
      }
    } catch (error) {
      this.logger.error('Failed to update cart:', error);
    }
  }

  private syncWithCart(cartState: CartState): void {
    if (!this.variantGroup) return;

    try {
      // Find which variant option matches cart contents
      const cartPackageIds = cartState.items.map(item => item.packageId);

      for (const option of this.variantGroup.options.values()) {
        if (option.packageId && cartPackageIds.includes(option.packageId)) {
          if (this.selectedOption !== option) {
            this.selectOption(option);
          }
          return;
        }
      }
    } catch (error) {
      this.handleError(error, 'syncWithCart');
    }
  }

  public update(): void {
    if (this.swapMode) {
      this.syncWithCart(useCartStore.getState());
    }
  }

  public getSelectedOption(): VariantOption | null {
    return this.selectedOption;
  }

  public getOptions(): VariantOption[] {
    return this.variantGroup ? Array.from(this.variantGroup.options.values()) : [];
  }

  public getAvailableOptions(): VariantOption[] {
    return this.getOptions().filter(opt => opt.isAvailable);
  }

  protected override cleanupEventListeners(): void {
    this.clickHandlers.forEach((handler, element) => {
      element.removeEventListener('click', handler);
    });
    this.clickHandlers.clear();

    this.changeHandlers.forEach((handler, element) => {
      element.removeEventListener('change', handler);
    });
    this.changeHandlers.clear();

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }

  public override destroy(): void {
    this.cleanupEventListeners();

    // Remove classes
    this.variantGroup?.options.forEach(option => {
      if (option.element) {
        option.element.classList.remove(
          'next-variant-option',
          'next-selected',
          'next-unavailable'
        );
      }
    });

    super.destroy();
  }
}
