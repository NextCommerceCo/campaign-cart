/**
 * Prospect Cart Enhancer
 * Handles creation and management of prospect carts for non-logged-in users
 */

import { BaseEnhancer } from '@/core/base/base-enhancer';
import { useCartStore } from '@/state/cart';
import { getApiClient } from '@/client';
import { PROSPECT_CART_STORAGE_KEY } from '@/core/storage';
import type { IApiClient } from '@/api/client.types';
import { loadConfig } from './config';
import {
  findEmailField,
  findPhoneField,
  getFormattedPhoneNumber,
} from './field-discovery';
import { isValidEmail, isValidName, isValidPhone } from './validation';
import { setupTriggers } from './triggers';
import {
  createProspectCart,
  updateProspectCart,
  collectUtmData,
  getCurrency,
} from './cart-creation';
import type {
  ProspectCartConfig,
  ProspectCart,
  ProspectCartRef,
  HasTriggeredRef,
  TimeoutRef,
  TriggerContext,
  CartCreationContext,
} from './prospect-cart.types';

export type { ProspectCartConfig, ProspectCart };

export class ProspectCartEnhancer extends BaseEnhancer {
  private config: ProspectCartConfig = {
    autoCreate: true,
    triggerOn: 'emailEntry',
    emailField: 'email',
    phoneField: 'phone',
    includeUtmData: true,
    sessionTimeout: 30,
    minPhoneDigits: 7,
  };

  private apiClient!: IApiClient;
  private prospectCartRef: ProspectCartRef = { value: undefined };
  private emailField?: HTMLInputElement;
  private phoneField?: HTMLInputElement;
  private hasTriggeredRef: HasTriggeredRef = { value: false };
  /**
   * Aborts every listener `triggers.ts` registers (email/phone/name `blur`+`change`,
   * and in `formStart` mode a `focus`+`input` pair on every form field).
   * `cleanupEventListeners()` aborts it, so base `destroy()` drops them all in one
   * call — same pattern as `checkout-form.enhancer.ts`'s `domListenerAbort`. Before
   * this, the class had no `destroy()`/`cleanupEventListeners()` override at all, so
   * every one of those listeners outlived the enhancer (finding 139 in
   * `docs/code-findings.md`).
   */
  private domListenerAbort = new AbortController();

  public async initialize(): Promise<void> {
    this.validateElement();

    this.logger.info('Initializing ProspectCartEnhancer', {
      element: this.element.tagName,
      config: this.config,
    });

    // Initialize API client
    this.apiClient = getApiClient();

    // Load configuration
    this.config = loadConfig(this.element, this.config, this.logger);

    // Find email field
    this.emailField = findEmailField(
      { element: this.element, logger: this.logger },
      this.config.emailField
    );

    // Find phone field
    this.phoneField = findPhoneField(
      { element: this.element, logger: this.logger },
      this.config.phoneField
    );

    // Subscribe to cart changes
    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));

    // Setup triggers based on configuration
    setupTriggers(this.config, this.makeTriggerContext());

    // Check for existing prospect cart
    this.checkExistingProspectCart();

    this.logger.debug('ProspectCartEnhancer initialized', {
      emailFieldFound: !!this.emailField,
      triggerOn: this.config.triggerOn,
      autoCreate: this.config.autoCreate,
    });
  }

  public update(data?: any): void {
    if (data?.config) {
      this.config = { ...this.config, ...data.config };
      setupTriggers(this.config, this.makeTriggerContext());
    }
  }

  /**
   * Drops every listener `triggers.ts` registered on `domListenerAbort.signal`.
   * Base `destroy()` calls this after unsubscribing the cart-store subscription,
   * so no `destroy()` override is needed here — see `domListenerAbort`'s doc comment.
   */
  protected override cleanupEventListeners(): void {
    this.domListenerAbort.abort();
  }

  // ============================================================================
  // CONTEXT FACTORIES — the explicit dependency lists each sibling module needs
  // ============================================================================

  /** `triggers.ts` needs the fields to listen on, a place for the phone debounce
   *  handle, the shared `hasTriggered` flag (`formStart` sets it directly), and
   *  the two entry points it calls back into. */
  private makeTriggerContext(): TriggerContext {
    return {
      element: this.element,
      emailField: this.emailField,
      phoneField: this.phoneField,
      logger: this.logger,
      phoneBlurTimeoutRef: this.phoneBlurTimeoutRef,
      hasTriggeredRef: this.hasTriggeredRef,
      signal: this.domListenerAbort.signal,
      isValidPhone: phone => this.isValidPhone(phone),
      checkAndCreateCart: () => this.checkAndCreateCart(),
      createProspectCart: () => this.createProspectCart(),
    };
  }

  /** `cart-creation.ts` needs the API client, the fields it reads, the config
   *  driving session expiry, and a place to store the created cart. */
  private makeCartCreationContext(): CartCreationContext {
    return {
      apiClient: this.apiClient,
      element: this.element,
      emailField: this.emailField,
      config: this.config,
      logger: this.logger,
      prospectCartRef: this.prospectCartRef,
      emitProspectEvent: (type, data) => this.emitProspectEvent(type, data),
      getFormattedPhoneNumber: () => this.getFormattedPhoneNumber(),
      isValidEmail: email => this.isValidEmail(email),
      isValidPhone: phone => this.isValidPhone(phone),
    };
  }

  // ============================================================================
  // DELEGATING WRAPPERS — thin calls into the sibling modules above
  // ============================================================================

  private getFormattedPhoneNumber(): string {
    return getFormattedPhoneNumber({
      element: this.element,
      logger: this.logger,
    });
  }

  private isValidEmail(email: string): boolean {
    return isValidEmail(email);
  }

  private isValidPhone(phone: string): boolean {
    return isValidPhone(phone, {
      phoneField: this.phoneField,
      minPhoneDigits: this.config.minPhoneDigits,
      logger: this.logger,
    });
  }

  private isValidName(name: string): boolean {
    return isValidName(name);
  }

  private async createProspectCart(): Promise<void> {
    return createProspectCart(this.makeCartCreationContext());
  }

  private async updateProspectCart(): Promise<void> {
    return updateProspectCart(this.makeCartCreationContext());
  }

  private collectUtmData(): Record<string, string> {
    return collectUtmData({ logger: this.logger });
  }

  private getCurrency(): string {
    return getCurrency();
  }

  // ============================================================================
  // INITIALIZATION / RESTORE
  // ============================================================================

  private checkExistingProspectCart(): void {
    // Check for existing prospect cart in session storage
    const stored = sessionStorage.getItem(PROSPECT_CART_STORAGE_KEY);
    if (stored) {
      try {
        const prospectCart = JSON.parse(stored);

        // Check if cart is still valid (not expired)
        const expiresAt = new Date(prospectCart.expires_at);
        if (expiresAt > new Date()) {
          this.prospectCartRef.value = prospectCart;
          this.logger.debug(
            'Restored existing prospect cart:',
            prospectCart.id
          );
        } else {
          // Remove expired cart
          sessionStorage.removeItem(PROSPECT_CART_STORAGE_KEY);
        }
      } catch (error) {
        this.logger.warn('Failed to parse stored prospect cart:', error);
        sessionStorage.removeItem(PROSPECT_CART_STORAGE_KEY);
      }
    }
  }

  private handleCartUpdate(cartState: any): void {
    // Update prospect cart when cart changes
    if (this.prospectCartRef.value && !cartState.isEmpty) {
      // Debounce updates
      clearTimeout(this.updateTimeout);
      this.updateTimeout = window.setTimeout(() => {
        this.updateProspectCart();
      }, 1000);
    }
  }

  private updateTimeout: number = 0;

  private emitProspectEvent(type: string, data?: any): void {
    const event = new CustomEvent(`next:prospect-${type}`, {
      detail: data,
      bubbles: true,
    });

    this.element.dispatchEvent(event);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  public async createCartManually(): Promise<ProspectCart | null> {
    await this.createProspectCart();
    return this.prospectCartRef.value || null;
  }

  public getCurrentProspectCart(): ProspectCart | null {
    return this.prospectCartRef.value || null;
  }

  public async abandonCart(): Promise<void> {
    if (!this.prospectCartRef.value) return;

    this.emitProspectEvent('cart-abandoned', {
      prospectCart: this.prospectCartRef.value,
    });

    // Clear stored cart
    sessionStorage.removeItem(PROSPECT_CART_STORAGE_KEY);
    this.prospectCartRef.value = undefined;

    this.logger.info('Prospect cart marked as abandoned');
  }

  public async convertCart(): Promise<void> {
    if (!this.prospectCartRef.value) return;

    this.emitProspectEvent('cart-converted', {
      prospectCart: this.prospectCartRef.value,
    });

    // Clear stored cart as it's now converted to a real order
    sessionStorage.removeItem(PROSPECT_CART_STORAGE_KEY);
    this.prospectCartRef.value = undefined;

    this.logger.info('Prospect cart converted to order');
  }

  public updateEmail(email: string): void {
    if (this.emailField) {
      this.emailField.value = email;
    }

    // Only check cart creation if email is valid
    if (this.isValidEmail(email.trim())) {
      this.checkAndCreateCart();
    } else {
      this.logger.debug('updateEmail called with invalid email:', email);
    }
  }

  // ============================================================================
  // GATE — combines trigger state + field validation before creating the cart.
  // Kept here rather than lifted: it touches config, the phone debounce handle, the
  // hasTriggered flag, and createProspectCart — a context object for it would be
  // close to the whole class, the same call the checkout-form split made for
  // `initialize()`.
  // ============================================================================

  private phoneBlurTimeoutRef: TimeoutRef = { value: undefined };

  /**
   * Check if we have enough data to create prospect cart and create it immediately
   */
  public checkAndCreateCart(): void {
    // Check if prospect cart has already been created
    if (this.hasTriggeredRef.value) {
      return;
    }

    // Get current form values
    const email =
      (
        this.element.querySelector(
          '[data-next-checkout-field="email"], [os-checkout-field="email"], input[type="email"]'
        ) as HTMLInputElement
      )?.value?.trim() || '';
    const firstName =
      (
        this.element.querySelector(
          '[data-next-checkout-field="fname"], [os-checkout-field="fname"], input[name="first_name"]'
        ) as HTMLInputElement
      )?.value?.trim() || '';
    const lastName =
      (
        this.element.querySelector(
          '[data-next-checkout-field="lname"], [os-checkout-field="lname"], input[name="last_name"]'
        ) as HTMLInputElement
      )?.value?.trim() || '';
    const phone = this.phoneField?.value?.trim() || '';

    // Decide which contact fields are required based on the configured trigger
    const trigger = this.config.triggerOn;
    const requiresEmail =
      trigger === 'emailEntry' ||
      trigger === 'emailAndPhone' ||
      trigger === 'formStart' ||
      trigger === 'manual';
    const requiresPhone =
      trigger === 'phoneEntry' || trigger === 'emailAndPhone';

    const hasValidEmail = this.isValidEmail(email);
    const hasValidPhone = this.isValidPhone(phone);
    const hasValidFirstName = this.isValidName(firstName);
    const hasValidLastName = this.isValidName(lastName);

    // Gate rule per field:
    //  - if required: value must be valid
    //  - if optional: empty is fine, but a non-empty value must still be valid
    //    (blocks half-typed phone/email from slipping through formStart/manual)
    const emailBlocks = requiresEmail
      ? !hasValidEmail
      : email.length > 0 && !hasValidEmail;
    const phoneBlocks = requiresPhone
      ? !hasValidPhone
      : phone.length > 0 && !hasValidPhone;

    this.logger.debug('Field validation status for cart creation:', {
      trigger,
      email: { value: email, required: requiresEmail, valid: hasValidEmail },
      phone: { value: phone, required: requiresPhone, valid: hasValidPhone },
      firstName: { value: firstName, valid: hasValidFirstName },
      lastName: { value: lastName, valid: hasValidLastName },
    });

    if (emailBlocks || phoneBlocks || !hasValidFirstName || !hasValidLastName) {
      if (emailBlocks) {
        this.logger.debug(
          'Invalid or incomplete email, skipping cart creation:',
          email
        );
      } else if (phoneBlocks) {
        this.logger.debug(
          'Invalid or incomplete phone, skipping cart creation:',
          phone
        );
      } else if (!hasValidFirstName) {
        this.logger.debug(
          'Invalid or missing first name, waiting for valid name:',
          firstName
        );
      } else if (!hasValidLastName) {
        this.logger.debug(
          'Invalid or missing last name, waiting for valid name:',
          lastName
        );
      }

      return;
    }

    // All required fields are valid - create cart immediately
    // Clear any pending timeout
    if (this.phoneBlurTimeoutRef.value !== undefined) {
      clearTimeout(this.phoneBlurTimeoutRef.value);
    }

    this.logger.info(
      'All required fields valid, creating prospect cart immediately',
      {
        trigger,
        email,
        phone,
        firstName,
        lastName,
      }
    );

    this.createProspectCart();
    this.hasTriggeredRef.value = true;
  }
}
