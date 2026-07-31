import {
  eventSchemas,
  validateEventSchema,
  getEventSchema,
  EventSchema,
  FieldDefinition,
} from '../schemas';
import { createLogger } from '@/core/logger';
import { reconcileValue } from './reconcileValue';

const logger = createLogger('EventValidator');

/** Events that complete a transaction — require transaction_id and value. */
const PURCHASE_EVENTS = ['dl_purchase', 'dl_upsell_purchase'];

/** Events where an empty items array is normal (cart/list snapshots). */
const ITEMS_OPTIONAL_EVENTS = [
  'dl_user_data',
  'dl_view_cart',
  'dl_view_item_list',
  'dl_view_search_results',
];

/** Strings that mean a value never resolved. */
const UNRESOLVED_TOKENS = ['', 'undefined', 'null', 'nan'];

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  return NaN;
}

/** Like {@link toNumber} but treats missing as 0 (optional tax/shipping). */
function toNumberOrZero(value: unknown): number {
  if (value == null || value === '') return 0;
  const n = toNumber(value);
  return Number.isFinite(n) ? n : 0;
}

/** True when an id is absent or a placeholder like "undefined"/"null"/"". */
function isUnresolvedId(value: unknown): boolean {
  return (
    value == null ||
    UNRESOLVED_TOKENS.includes(String(value).trim().toLowerCase())
  );
}

/** True when a name looks unresolved, e.g. "Package undefined" / "Package 0". */
function looksUnresolvedName(value: unknown): boolean {
  if (value == null) return true;
  const name = String(value).trim();
  return /undefined|\bnull\b/i.test(name) || /^package\s+0$/i.test(name);
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class EventValidator {
  private debug: boolean;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * Validates an event against its schema
   */
  public validateEvent(eventData: any): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Check if event has a name
    if (!eventData || typeof eventData !== 'object') {
      result.valid = false;
      result.errors.push('Event data must be an object');
      return result;
    }

    if (!eventData.event) {
      result.valid = false;
      result.errors.push('Event must have an "event" field');
      return result;
    }

    // Validate against the schema when one exists. A missing schema is only a
    // warning — we still run the semantic checks below, so schema-less events
    // (e.g. dl_upsell_purchase, dl_cart_updated) are not left unvalidated.
    const schema = getEventSchema(eventData.event);
    if (schema) {
      const schemaValidation = validateEventSchema(eventData, schema);
      result.valid = schemaValidation.valid;
      result.errors.push(...schemaValidation.errors);
    } else {
      result.warnings.push(`No schema defined for event: ${eventData.event}`);
    }

    // Semantic validation — runs for every dl_* event, schema or not.
    this.performAdditionalValidation(eventData, result);

    // Log validation results in debug mode
    if (this.debug && !result.valid) {
      logger.error(`Validation failed for ${eventData.event}:`, result.errors);
    }

    return result;
  }

  /**
   * Performs additional validation beyond schema validation
   */
  private performAdditionalValidation(
    eventData: any,
    result: ValidationResult
  ): void {
    const eventName = String(eventData.event);
    const isPurchase = PURCHASE_EVENTS.includes(eventName);
    const ecommerce = eventData.ecommerce;

    // Validate ecommerce data
    if (ecommerce) {
      const currency = ecommerce.currency;
      // Currency: presence + ISO-4217 format
      if (isUnresolvedId(currency)) {
        result.warnings.push('ecommerce.currency is missing');
      } else if (!this.isValidCurrency(currency)) {
        result.warnings.push(`Invalid currency format: ${currency}`);
      }

      // Value sanity
      if (ecommerce.value !== undefined && toNumber(ecommerce.value) < 0) {
        result.warnings.push('Ecommerce value should not be negative');
      }

      const items: any[] = Array.isArray(ecommerce.items)
        ? ecommerce.items
        : [];
      const impressions: any[] = Array.isArray(ecommerce.impressions)
        ? ecommerce.impressions
        : [];

      // Empty items where the event is expected to carry them
      if (
        items.length === 0 &&
        impressions.length === 0 &&
        !ITEMS_OPTIONAL_EVENTS.includes(eventName)
      ) {
        result.warnings.push(
          `${eventName} has no items in the ecommerce payload`
        );
      }

      items.forEach((item, index) =>
        this.validateProduct(
          item,
          `ecommerce.items[${index}]`,
          result,
          currency
        )
      );
      impressions.forEach((impression, index) =>
        this.validateProduct(
          impression,
          `ecommerce.impressions[${index}]`,
          result,
          currency
        )
      );

      // Revenue reconciliation: Σ(price × quantity) === value
      this.validateRevenueReconciliation(ecommerce, items, result);
    }

    // Validate user properties
    if (eventData.user_properties) {
      this.validateUserProperties(eventData.user_properties, result);
    }

    // Transaction events require an id and a value
    if (isPurchase) {
      if (isUnresolvedId(ecommerce?.transaction_id)) {
        result.errors.push(`${eventName} must have ecommerce.transaction_id`);
        result.valid = false;
      }
      if (ecommerce?.value === undefined || ecommerce?.value === null) {
        result.errors.push(`${eventName} must have ecommerce.value`);
        result.valid = false;
      }
    }

    // Event-specific validation
    switch (eventName) {
      case 'dl_upsell_purchase':
        this.validateUpsellMetadata(eventData.upsell_metadata, result);
        break;

      case 'dl_view_search_results':
        if (!eventData.search_term) {
          result.errors.push(
            'dl_view_search_results event must have search_term'
          );
          result.valid = false;
        }
        break;

      case 'dl_viewed_upsell':
      case 'dl_accepted_upsell':
      case 'dl_skipped_upsell':
        this.validateUpsellEvent(eventData, result);
        break;
    }
  }

  /**
   * Σ(items[].price × quantity) must equal ecommerce.value (GA4: value excludes
   * tax and shipping). {@link reconcileValue} owns the rule so it stays identical
   * to the debug validator and diagnoses a value that wrongly includes them.
   */
  private validateRevenueReconciliation(
    ecommerce: any,
    items: any[],
    result: ValidationResult
  ): void {
    if (items.length === 0) return;
    const value = toNumber(ecommerce.value);
    if (!Number.isFinite(value)) return;

    let itemsTotal = 0;
    for (const item of items) {
      const price = toNumber(item?.price);
      const quantity = toNumber(item?.quantity);
      // Not computable — bail rather than reconcile against a bad total. Sign /
      // min-quantity problems are flagged per-item in validateProduct.
      if (!Number.isFinite(price) || !Number.isFinite(quantity)) return;
      if (price < 0 || quantity < 1) return;
      itemsTotal += price * quantity;
    }

    const { reconciles, diagnosis } = reconcileValue(
      itemsTotal,
      value,
      toNumberOrZero(ecommerce.tax),
      toNumberOrZero(ecommerce.shipping)
    );
    if (!reconciles) {
      result.warnings.push(
        `ecommerce.value ${value.toFixed(2)} does not reconcile with items total ` +
          `${itemsTotal.toFixed(2)} — value must equal Σ(price × quantity)` +
          (diagnosis ? `; ${diagnosis}` : '')
      );
    }
  }

  /**
   * Validates the `upsell_metadata` block on dl_upsell_purchase for an
   * unresolved package (issues #51 / #54). The block is optional, but when
   * present its package id/name must be real.
   */
  private validateUpsellMetadata(meta: any, result: ValidationResult): void {
    if (!meta || typeof meta !== 'object') return;
    if (isUnresolvedId(meta.package_id) || String(meta.package_id) === '0') {
      result.errors.push(
        `upsell_metadata.package_id is unresolved ("${meta.package_id}")`
      );
      result.valid = false;
    }
    if (looksUnresolvedName(meta.package_name)) {
      result.errors.push(
        `upsell_metadata.package_name is unresolved ("${meta.package_name}")`
      );
      result.valid = false;
    }
  }

  /**
   * Validates a product object
   */
  private validateProduct(
    product: any,
    path: string,
    result: ValidationResult,
    ecommerceCurrency?: string
  ): void {
    if (!product || typeof product !== 'object') {
      result.errors.push(`${path} must be an object`);
      result.valid = false;
      return;
    }

    // Required identifiers — catch placeholders ("undefined", "Package 0", …),
    // not just absence, since those are truthy and slip past a presence check.
    if (isUnresolvedId(product.item_id)) {
      result.errors.push(
        `${path}.item_id is missing or unresolved ("${product.item_id}")`
      );
      result.valid = false;
    }
    if (looksUnresolvedName(product.item_name)) {
      result.errors.push(
        `${path}.item_name is missing or unresolved ("${product.item_name}")`
      );
      result.valid = false;
    }

    // Validate numeric fields — must be finite numbers (rejects NaN/Infinity).
    const numericFields = ['price', 'quantity', 'discount', 'index'];
    for (const field of numericFields) {
      if (product[field] !== undefined) {
        if (
          typeof product[field] !== 'number' ||
          !Number.isFinite(product[field])
        ) {
          result.errors.push(`${path}.${field} must be a finite number`);
          result.valid = false;
        } else if (field !== 'discount' && product[field] < 0) {
          result.warnings.push(`${path}.${field} should not be negative`);
        }
      }
    }

    // Quantity must be a whole number ≥ 1.
    if (
      typeof product.quantity === 'number' &&
      Number.isFinite(product.quantity)
    ) {
      if (!Number.isInteger(product.quantity)) {
        result.warnings.push(`${path}.quantity should be an integer`);
      }
      if (product.quantity < 1) {
        result.errors.push(`${path}.quantity must be at least 1`);
        result.valid = false;
      }
    }

    // Per-item currency should match the event currency.
    if (
      product.currency &&
      ecommerceCurrency &&
      product.currency !== ecommerceCurrency
    ) {
      result.warnings.push(
        `${path}.currency (${product.currency}) differs from ecommerce.currency (${ecommerceCurrency})`
      );
    }
  }

  /**
   * Validates user properties
   */
  private validateUserProperties(
    userProperties: any,
    result: ValidationResult
  ): void {
    if (typeof userProperties !== 'object') {
      result.errors.push('user_properties must be an object');
      result.valid = false;
      return;
    }

    // Validate email format
    if (
      userProperties.customer_email &&
      !this.isValidEmail(userProperties.customer_email)
    ) {
      result.warnings.push('customer_email is not a valid email address');
    }

    // Validate numeric fields
    if (userProperties.customer_order_count !== undefined) {
      if (
        typeof userProperties.customer_order_count !== 'number' ||
        !Number.isInteger(userProperties.customer_order_count)
      ) {
        result.warnings.push('customer_order_count should be an integer');
      }
    }

    if (userProperties.customer_total_spent !== undefined) {
      if (typeof userProperties.customer_total_spent !== 'number') {
        result.warnings.push('customer_total_spent should be a number');
      }
    }

    // Validate country and province codes
    if (
      userProperties.customer_address_country_code &&
      userProperties.customer_address_country_code.length !== 2
    ) {
      result.warnings.push(
        'customer_address_country_code should be a 2-letter ISO code'
      );
    }

    if (
      userProperties.customer_address_province_code &&
      userProperties.customer_address_province_code.length > 3
    ) {
      result.warnings.push('customer_address_province_code seems too long');
    }
  }

  /**
   * Checks if a currency code is valid (3-letter ISO code)
   */
  private isValidCurrency(currency: string): boolean {
    return /^[A-Z]{3}$/.test(currency);
  }

  /**
   * Basic email validation
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Validates upsell events
   */
  private validateUpsellEvent(eventData: any, result: ValidationResult): void {
    // Validate order_id
    if (!eventData.order_id) {
      result.errors.push(`${eventData.event} must have order_id`);
      result.valid = false;
    }

    // Validate upsell object
    if (!eventData.upsell || typeof eventData.upsell !== 'object') {
      result.errors.push(`${eventData.event} must have upsell object`);
      result.valid = false;
      return;
    }

    // Validate required fields in upsell object
    if (!eventData.upsell.package_id) {
      result.errors.push(`${eventData.event}.upsell.package_id is required`);
      result.valid = false;
    }

    // For accepted upsell, value is required
    if (
      eventData.event === 'dl_accepted_upsell' &&
      eventData.upsell.value === undefined
    ) {
      result.errors.push('dl_accepted_upsell.upsell.value is required');
      result.valid = false;
    }

    // Validate numeric fields
    if (
      eventData.upsell.price !== undefined &&
      typeof eventData.upsell.price !== 'number'
    ) {
      result.errors.push(`${eventData.event}.upsell.price must be a number`);
      result.valid = false;
    }

    if (
      eventData.upsell.quantity !== undefined &&
      typeof eventData.upsell.quantity !== 'number'
    ) {
      result.errors.push(`${eventData.event}.upsell.quantity must be a number`);
      result.valid = false;
    }

    if (
      eventData.upsell.value !== undefined &&
      typeof eventData.upsell.value !== 'number'
    ) {
      result.errors.push(`${eventData.event}.upsell.value must be a number`);
      result.valid = false;
    }
  }

  /**
   * Get all available event schemas
   */
  public getAvailableSchemas(): string[] {
    return Object.keys(eventSchemas);
  }

  /**
   * Get schema details for a specific event
   */
  public getSchemaDetails(eventName: string): EventSchema | undefined {
    return getEventSchema(eventName);
  }

  /**
   * Generate a sample event based on schema
   */
  public generateSampleEvent(eventName: string): any {
    const schema = getEventSchema(eventName);
    if (!schema) {
      return null;
    }

    const sample: any = {
      event: eventName,
      event_id: 'sample_' + Date.now(),
      timestamp: Date.now(),
    };

    // Generate sample data based on schema
    this.generateSampleFromSchema(schema.fields, sample);

    return sample;
  }

  /**
   * Helper to generate sample data from schema
   */
  private generateSampleFromSchema(
    fields: Record<string, FieldDefinition>,
    target: any
  ): void {
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      if (fieldName === 'event') continue; // Skip event field as it's already set

      if (fieldDef.required || Math.random() > 0.5) {
        // Include required fields and randomly include optional ones
        switch (fieldDef.type) {
          case 'string':
            target[fieldName] = fieldDef.enum
              ? fieldDef.enum[0]
              : `sample_${fieldName}`;
            break;
          case 'number':
            target[fieldName] =
              fieldName.includes('price') || fieldName.includes('value')
                ? 99.99
                : 1;
            break;
          case 'boolean':
            target[fieldName] = true;
            break;
          case 'object':
            target[fieldName] = {};
            if (fieldDef.properties) {
              this.generateSampleFromSchema(
                fieldDef.properties,
                target[fieldName]
              );
            }
            break;
          case 'array':
            target[fieldName] = [];
            if (
              fieldDef.items &&
              fieldDef.items.type === 'object' &&
              fieldDef.items.properties
            ) {
              const item: any = {};
              this.generateSampleFromSchema(fieldDef.items.properties, item);
              target[fieldName].push(item);
            }
            break;
        }
      }
    }
  }
}

// Export a singleton instance for convenience
export const eventValidator = new EventValidator();
