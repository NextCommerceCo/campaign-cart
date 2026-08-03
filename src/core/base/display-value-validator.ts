import { Logger } from '@/core/logger';

/**
 * Coerces a resolved display value into the shape its format needs, substituting a
 * safe fallback when it cannot.
 *
 * Every method is total: it always returns a usable value rather than throwing, because
 * one bad field must not blank the element (that is what `DisplayErrorBoundary`, beside
 * this file, handles for real failures). The warning is therefore the *only* signal that
 * a value was replaced — see `core/guide/reference/logs.md` for what each one means.
 *
 * Logs through {@link Logger} rather than `console.warn` directly, matching
 * `display-error-boundary.ts` beside it. Two consequences, both wanted: the lines carry
 * the `[DisplayValueValidator]` prefix so they can be traced, and they respect the SDK's
 * log level instead of printing on every customer page that happens to hold one
 * imperfect value.
 */
export class DisplayValueValidator {
  private static logger = new Logger('DisplayValueValidator');

  static validatePercentage(value: any): number {
    const num = Number(value);
    if (isNaN(num)) {
      this.logger.warn(`Invalid percentage value: ${value}`);
      return 0;
    }
    // Percentages should be 0-100 (or sometimes 0-1)
    if (num > 1 && num <= 100) return num;
    if (num >= 0 && num <= 1) return num * 100;
    if (num > 100) {
      this.logger.warn(`Percentage exceeds 100: ${num}`);
      return 100;
    }
    return Math.max(0, num);
  }
  
  static validateCurrency(value: any): number {
    // If already a string with currency symbol, extract the number
    if (typeof value === 'string') {
      // Remove currency symbols and commas
      const cleanValue = value.replace(/[$,]/g, '').trim();
      const num = Number(cleanValue);
      if (!isNaN(num)) {
        return Math.round(num * 100) / 100;
      }
    }
    
    const num = Number(value);
    if (isNaN(num)) {
      this.logger.warn(`Invalid currency value: ${value}`);
      return 0;
    }
    return Math.round(num * 100) / 100; // Ensure 2 decimal places
  }
  
  static validateNumber(value: any): number {
    const num = Number(value);
    if (isNaN(num)) {
      this.logger.warn(`Invalid number value: ${value}`);
      return 0;
    }
    return num;
  }
  
  static validateBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      return lower === 'true' || lower === '1' || lower === 'yes';
    }
    return !!value;
  }
  
  static validateDate(value: any): Date | null {
    if (!value) return null;
    
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        this.logger.warn(`Invalid date value: ${value}`);
        return null;
      }
      return date;
    } catch {
      this.logger.warn(`Invalid date value: ${value}`);
      return null;
    }
  }
  
  static validateString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }
}