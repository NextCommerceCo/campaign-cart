/**
 * Offer Variant Selector Enhancer
 * Manages per-unit variant selection within offer packages
 *
 * This enhancer handles the scenario where a package contains multiple units
 * and each unit needs its own variant selection (color, size, etc.)
 *
 * @example
 * <div data-next-offer-variant-selector
 *      data-next-package-id="123"
 *      data-next-units="2"
 *      data-next-require-all="true">
 *
 *   <!-- Unit 1 -->
 *   <div data-next-variant-unit="1" class="variant-unit">
 *     <div class="unit-label">#1</div>
 *
 *     <!-- Color selector for unit 1 -->
 *     <div data-next-variant-group="color" data-next-unit="1">
 *       <label>Select Color:</label>
 *       <select data-next-variant-selector>
 *         <option value="black">Black</option>
 *         <option value="white">White</option>
 *       </select>
 *     </div>
 *
 *     <!-- Size selector for unit 1 -->
 *     <div data-next-variant-group="size" data-next-unit="1">
 *       <label>Select Size:</label>
 *       <select data-next-variant-selector>
 *         <option value="small">Small</option>
 *         <option value="medium">Medium</option>
 *         <option value="large">Large</option>
 *       </select>
 *     </div>
 *   </div>
 *
 *   <!-- Unit 2 -->
 *   <div data-next-variant-unit="2" class="variant-unit">
 *     <div class="unit-label">#2</div>
 *     <!-- Similar structure -->
 *   </div>
 * </div>
 *
 * Attributes:
 * - data-next-offer-variant-selector: Main identifier
 * - data-next-package-id: Package ID this selector is for
 * - data-next-units: Number of units in the package
 * - data-next-require-all: Require all variants to be selected (default: true)
 * - data-next-sync-all: Sync all units to same selection (default: false)
 * - data-next-show-validation: Show validation messages (default: true)
 *
 * Unit Attributes:
 * - data-next-variant-unit: Unit number (1, 2, 3, etc.)
 *
 * Variant Group Attributes:
 * - data-next-variant-group: Attribute type (color, size, etc.)
 * - data-next-unit: Which unit this group is for
 * - data-next-variant-selector: The actual select/input element
 *
 * Events:
 * - variant:selected - When a variant is selected for a unit
 * - variant:validation-failed - When validation fails
 * - variant:all-selected - When all required variants are selected
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import type { CartState } from '@/types/global';

interface VariantSelection {
  unit: number;
  attribute: string;
  value: string;
  element: HTMLElement;
}

interface UnitConfig {
  unitNumber: number;
  element: HTMLElement;
  selections: Map<string, string>; // attribute -> value
  isComplete: boolean;
}

export class OfferVariantSelectorEnhancer extends BaseEnhancer {
  private packageId?: number;
  private unitCount: number = 1;
  private requireAll: boolean = true;
  private syncAll: boolean = false;
  private showValidation: boolean = true;

  private units: Map<number, UnitConfig> = new Map();
  private changeHandlers: Map<HTMLElement, (event: Event) => void> = new Map();
  private validationMessage?: HTMLElement;

  public async initialize(): Promise<void> {
    this.validateElement();

    // Get configuration
    const packageIdAttr = this.getAttribute('data-next-package-id');
    this.packageId = packageIdAttr ? parseInt(packageIdAttr, 10) : undefined;

    this.unitCount = parseInt(this.getAttribute('data-next-units') || '1', 10);
    this.requireAll = this.getAttribute('data-next-require-all') !== 'false';
    this.syncAll = this.getAttribute('data-next-sync-all') === 'true';
    this.showValidation = this.getAttribute('data-next-show-validation') !== 'false';

    // Initialize units
    this.initializeUnits();

    // Set up variant selectors
    this.initializeVariantSelectors();

    // Create validation message element if needed
    if (this.showValidation) {
      this.createValidationMessage();
    }

    // Subscribe to cart changes
    this.subscribe(useCartStore, this.handleCartChange.bind(this));

    // Initial validation
    this.validateSelections();

    // Expose methods
    (this.element as any)._getSelections = () => this.getAllSelections();
    (this.element as any)._isValid = () => this.isValid();
    (this.element as any)._getIncompleteUnits = () => this.getIncompleteUnits();

    this.logger.debug('OfferVariantSelectorEnhancer initialized:', {
      packageId: this.packageId,
      unitCount: this.unitCount,
      requireAll: this.requireAll,
      syncAll: this.syncAll
    });
  }

  private initializeUnits(): void {
    // Find all unit containers
    const unitElements = this.element.querySelectorAll('[data-next-variant-unit]');

    if (unitElements.length === 0) {
      // No explicit unit containers, create single unit
      this.units.set(1, {
        unitNumber: 1,
        element: this.element,
        selections: new Map(),
        isComplete: false
      });
      return;
    }

    unitElements.forEach((unitElement) => {
      if (!(unitElement instanceof HTMLElement)) return;

      const unitNumber = parseInt(unitElement.getAttribute('data-next-variant-unit') || '0', 10);

      if (unitNumber > 0) {
        this.units.set(unitNumber, {
          unitNumber,
          element: unitElement,
          selections: new Map(),
          isComplete: false
        });
      }
    });

    this.logger.debug(`Initialized ${this.units.size} variant units`);
  }

  private initializeVariantSelectors(): void {
    // Find all variant groups
    const variantGroups = this.element.querySelectorAll('[data-next-variant-group]');

    variantGroups.forEach((groupElement) => {
      if (!(groupElement instanceof HTMLElement)) return;

      const attribute = groupElement.getAttribute('data-next-variant-group');
      const unitNumber = parseInt(groupElement.getAttribute('data-next-unit') || '1', 10);

      if (!attribute) {
        this.logger.warn('Variant group missing attribute name', groupElement);
        return;
      }

      // Find the selector element within this group
      const selectorElement = groupElement.querySelector('[data-next-variant-selector]') as HTMLElement;

      if (!selectorElement) {
        this.logger.warn('No variant selector found in group', groupElement);
        return;
      }

      this.registerVariantSelector(selectorElement, attribute, unitNumber);
    });
  }

  private registerVariantSelector(
    element: HTMLElement,
    attribute: string,
    unitNumber: number
  ): void {
    const unit = this.units.get(unitNumber);

    if (!unit) {
      this.logger.warn(`Unit ${unitNumber} not found for variant selector`, element);
      return;
    }

    // Set up change handler
    const changeHandler = (event: Event) => {
      this.handleVariantChange(element, attribute, unitNumber, event);
    };

    this.changeHandlers.set(element, changeHandler);
    element.addEventListener('change', changeHandler);

    // Check for initial value
    const initialValue = this.getElementValue(element);
    if (initialValue) {
      unit.selections.set(attribute, initialValue);
      this.checkUnitCompletion(unitNumber);
    }

    this.logger.debug(`Registered variant selector:`, {
      unit: unitNumber,
      attribute,
      initialValue
    });
  }

  private handleVariantChange(
    element: HTMLElement,
    attribute: string,
    unitNumber: number,
    event: Event
  ): void {
    const value = this.getElementValue(element);
    const unit = this.units.get(unitNumber);

    if (!unit) return;

    // Update selection
    if (value) {
      unit.selections.set(attribute, value);
    } else {
      unit.selections.delete(attribute);
    }

    this.logger.debug('Variant changed:', {
      unit: unitNumber,
      attribute,
      value
    });

    // Emit event
    this.emit('variant:selected', {
      packageId: this.packageId,
      unit: unitNumber,
      attribute,
      value,
      selections: Object.fromEntries(unit.selections)
    });

    // If sync mode, update all other units
    if (this.syncAll) {
      this.syncVariantToAllUnits(attribute, value, unitNumber);
    }

    // Check completion
    this.checkUnitCompletion(unitNumber);
    this.validateSelections();
  }

  private syncVariantToAllUnits(attribute: string, value: string, excludeUnit: number): void {
    this.units.forEach((unit, unitNumber) => {
      if (unitNumber === excludeUnit) return;

      // Update the selection
      if (value) {
        unit.selections.set(attribute, value);
      } else {
        unit.selections.delete(attribute);
      }

      // Find and update the UI element
      const groupElement = unit.element.querySelector(
        `[data-next-variant-group="${attribute}"][data-next-unit="${unitNumber}"]`
      );

      if (groupElement) {
        const selectorElement = groupElement.querySelector('[data-next-variant-selector]') as HTMLElement;
        if (selectorElement) {
          this.setElementValue(selectorElement, value);
        }
      }

      this.checkUnitCompletion(unitNumber);
    });

    this.logger.debug('Synced variant to all units:', { attribute, value });
  }

  private getElementValue(element: HTMLElement): string {
    if (element instanceof HTMLSelectElement) {
      return element.value;
    } else if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        return element.checked ? element.value : '';
      }
      return element.value;
    }
    return element.getAttribute('data-value') || '';
  }

  private setElementValue(element: HTMLElement, value: string): void {
    if (element instanceof HTMLSelectElement) {
      element.value = value;
    } else if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        element.checked = element.value === value;
      } else {
        element.value = value;
      }
    } else {
      element.setAttribute('data-value', value);
    }

    // Trigger change event
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private checkUnitCompletion(unitNumber: number): void {
    const unit = this.units.get(unitNumber);
    if (!unit) return;

    // Find all required variant groups for this unit
    const variantGroups = unit.element.querySelectorAll('[data-next-variant-group]');
    const requiredAttributes = new Set<string>();

    variantGroups.forEach((group) => {
      if (group instanceof HTMLElement) {
        const attr = group.getAttribute('data-next-variant-group');
        if (attr) {
          requiredAttributes.add(attr);
        }
      }
    });

    // Check if all required attributes have values
    let isComplete = true;
    requiredAttributes.forEach((attr) => {
      if (!unit.selections.has(attr) || !unit.selections.get(attr)) {
        isComplete = false;
      }
    });

    const wasComplete = unit.isComplete;
    unit.isComplete = isComplete;

    // Update UI
    unit.element.classList.toggle('variant-unit-complete', isComplete);
    unit.element.classList.toggle('variant-unit-incomplete', !isComplete);
    unit.element.setAttribute('data-variant-complete', isComplete.toString());

    if (isComplete && !wasComplete) {
      this.logger.debug(`Unit ${unitNumber} variants complete`);
    }
  }

  private validateSelections(): void {
    if (!this.requireAll) return;

    const incompleteUnits = this.getIncompleteUnits();
    const isValid = incompleteUnits.length === 0;

    // Update element state
    this.element.classList.toggle('variant-selector-valid', isValid);
    this.element.classList.toggle('variant-selector-invalid', !isValid);
    this.element.setAttribute('data-variant-valid', isValid.toString());

    // Update validation message
    if (this.showValidation && this.validationMessage) {
      if (!isValid) {
        const unitText = incompleteUnits.length === 1 ? 'unit' : 'units';
        this.validationMessage.textContent = `Please select variants for ${incompleteUnits.length} ${unitText}`;
        this.validationMessage.style.display = 'block';
      } else {
        this.validationMessage.style.display = 'none';
      }
    }

    // Emit events
    if (isValid) {
      this.emit('variant:all-selected', {
        packageId: this.packageId,
        selections: this.getAllSelections()
      });
    } else {
      this.emit('variant:validation-failed', {
        packageId: this.packageId,
        incompleteUnits
      });
    }
  }

  private createValidationMessage(): void {
    this.validationMessage = document.createElement('div');
    this.validationMessage.className = 'variant-validation-message';
    this.validationMessage.style.display = 'none';
    this.element.appendChild(this.validationMessage);
  }

  private getIncompleteUnits(): number[] {
    const incomplete: number[] = [];

    this.units.forEach((unit) => {
      if (!unit.isComplete) {
        incomplete.push(unit.unitNumber);
      }
    });

    return incomplete;
  }

  private getAllSelections(): Record<number, Record<string, string>> {
    const selections: Record<number, Record<string, string>> = {};

    this.units.forEach((unit) => {
      selections[unit.unitNumber] = Object.fromEntries(unit.selections);
    });

    return selections;
  }

  private isValid(): boolean {
    if (!this.requireAll) return true;
    return this.getIncompleteUnits().length === 0;
  }

  private handleCartChange(cartState: CartState): void {
    // React to cart changes if needed
    // For example, reset selections when cart is cleared
    if (cartState.isEmpty) {
      this.logger.debug('Cart cleared, maintaining variant selections');
    }
  }

  public update(): void {
    this.validateSelections();
  }

  public getSelections(): Record<number, Record<string, string>> {
    return this.getAllSelections();
  }

  public getUnitSelections(unitNumber: number): Record<string, string> | undefined {
    const unit = this.units.get(unitNumber);
    return unit ? Object.fromEntries(unit.selections) : undefined;
  }

  public setUnitSelection(unitNumber: number, attribute: string, value: string): void {
    const unit = this.units.get(unitNumber);
    if (!unit) {
      this.logger.warn(`Cannot set selection for unit ${unitNumber}: unit not found`);
      return;
    }

    // Find the variant group and selector
    const groupElement = unit.element.querySelector(
      `[data-next-variant-group="${attribute}"][data-next-unit="${unitNumber}"]`
    );

    if (groupElement) {
      const selectorElement = groupElement.querySelector('[data-next-variant-selector]') as HTMLElement;
      if (selectorElement) {
        this.setElementValue(selectorElement, value);
      }
    }
  }

  public resetUnit(unitNumber: number): void {
    const unit = this.units.get(unitNumber);
    if (!unit) return;

    unit.selections.clear();
    unit.isComplete = false;

    // Reset all selectors for this unit
    const selectors = unit.element.querySelectorAll('[data-next-variant-selector]');
    selectors.forEach((selector) => {
      if (selector instanceof HTMLElement) {
        this.setElementValue(selector, '');
      }
    });

    this.validateSelections();
    this.logger.debug(`Reset unit ${unitNumber}`);
  }

  public resetAll(): void {
    this.units.forEach((_, unitNumber) => {
      this.resetUnit(unitNumber);
    });
  }

  protected override cleanupEventListeners(): void {
    this.changeHandlers.forEach((handler, element) => {
      element.removeEventListener('change', handler);
    });
    this.changeHandlers.clear();
  }

  public override destroy(): void {
    this.cleanupEventListeners();

    if (this.validationMessage && this.validationMessage.parentNode) {
      this.validationMessage.parentNode.removeChild(this.validationMessage);
    }

    this.units.forEach((unit) => {
      unit.element.classList.remove('variant-unit-complete', 'variant-unit-incomplete');
    });

    this.element.classList.remove('variant-selector-valid', 'variant-selector-invalid');

    super.destroy();
  }
}
