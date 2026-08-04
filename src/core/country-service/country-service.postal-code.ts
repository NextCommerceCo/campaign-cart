/**
 * `CountryService`'s postal-code validation, formatting and per-country
 * defaults — extracted verbatim from `country-service.ts`. Pure country
 * formatting rules; the service itself still owns fetching and caching.
 */

import type { Logger } from '@/core/logger';
import type { CountryConfig } from '@/core/country-service';

/**
 * Validate postal code based on country configuration
 */
export function validatePostalCode(
  logger: Logger,
  postalCode: string,
  _countryCode: string,
  countryConfig: CountryConfig
): boolean {
  if (!postalCode) return false;

  // Check length constraints
  if (
    postalCode.length < countryConfig.postcodeMinLength ||
    postalCode.length > countryConfig.postcodeMaxLength
  ) {
    return false;
  }

  // Check regex pattern if provided
  if (countryConfig.postcodeRegex) {
    try {
      const regex = new RegExp(countryConfig.postcodeRegex);
      return regex.test(postalCode);
    } catch (error) {
      logger.error('Invalid postal code regex:', error);
      return true; // Allow if regex is invalid
    }
  }

  return true;
}

/**
 * Format postal code based on country configuration
 * Applies formatting pattern from CDN (e.g., "XXX XXX" for Canadian postal codes)
 */
export function formatPostalCode(
  postalCode: string,
  countryConfig: CountryConfig
): string {
  if (!postalCode) {
    return postalCode;
  }

  // Check if postal code contains letters (alphanumeric postal codes should be uppercase)
  const hasLetters = /[a-zA-Z]/.test(postalCode);

  // If no format pattern from CDN, apply basic uppercase conversion for alphanumeric codes
  if (!countryConfig.postcodeFormat) {
    if (hasLetters) {
      return postalCode.toUpperCase();
    }
    return postalCode;
  }

  // Remove all spaces and special characters for processing
  const cleanCode = postalCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  if (!cleanCode) {
    return postalCode;
  }

  const format = countryConfig.postcodeFormat;
  let formatted = '';
  let charIndex = 0;

  // Process each character in the format pattern
  for (let i = 0; i < format.length && charIndex < cleanCode.length; i++) {
    const formatChar = format[i];

    if (
      formatChar === 'N' ||
      formatChar === 'X' ||
      formatChar === '#' ||
      formatChar === '9' ||
      formatChar === 'A'
    ) {
      // Format character placeholders - insert actual character from postal code
      // N = any alphanumeric, X = any char, # = digit, 9 = digit, A = letter
      formatted += cleanCode[charIndex];
      charIndex++;
    } else {
      // Literal character (space, dash, etc.) - insert as is
      formatted += formatChar;
    }
  }

  // If there are remaining characters after format is complete, append them
  if (charIndex < cleanCode.length) {
    formatted += cleanCode.substring(charIndex);
  }

  return formatted;
}

export function getDefaultCountryConfig(countryCode: string): CountryConfig {
  // Default configurations for common countries
  const configs: Record<string, CountryConfig> = {
    US: {
      stateLabel: 'State',
      stateRequired: true,
      postcodeLabel: 'ZIP Code',
      postcodeRegex: '^\\d{5}(-\\d{4})?$',
      postcodeMinLength: 5,
      postcodeMaxLength: 10,
      postcodeExample: '12345 or 12345-6789',
      postcodeFormat: null,
      currencyCode: 'USD',
      currencySymbol: '$',
    },
    CA: {
      stateLabel: 'Province',
      stateRequired: true,
      postcodeLabel: 'Postal Code',
      postcodeRegex: '^[A-Z]\\d[A-Z] ?\\d[A-Z]\\d$',
      postcodeMinLength: 6,
      postcodeMaxLength: 7,
      postcodeExample: 'K1A 0B1',
      postcodeFormat: null,
      currencyCode: 'CAD',
      currencySymbol: '$',
    },
    GB: {
      stateLabel: 'County',
      stateRequired: false,
      postcodeLabel: 'Postcode',
      postcodeRegex: '^[A-Z]{1,2}\\d{1,2}[A-Z]?\\s?\\d[A-Z]{2}$',
      postcodeMinLength: 5,
      postcodeMaxLength: 8,
      postcodeExample: 'SW1A 1AA',
      postcodeFormat: null,
      currencyCode: 'GBP',
      currencySymbol: '£',
    },
  };

  return (
    configs[countryCode] || {
      stateLabel: 'State/Province',
      stateRequired: false,
      postcodeLabel: 'Postal Code',
      postcodeRegex: null,
      postcodeMinLength: 2,
      postcodeMaxLength: 20,
      postcodeExample: null,
      postcodeFormat: null,
      currencyCode: 'USD',
      currencySymbol: '$',
    }
  );
}
