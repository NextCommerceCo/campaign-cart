/**
 * `CountryService`'s country/state filtering rules — extracted verbatim from
 * `country-service.ts`. Takes the service's own address config, campaign
 * shipping-country list and logger as parameters rather than owning them.
 */

import type { Logger } from '@/core/logger';
import type { AddressConfig } from '@/types/global';
import type { LocationData, State } from '@/core/country-service';

export interface FilterCtx {
  campaignShippingCountries: string[] | null;
  config: AddressConfig;
  logger: Logger;
}

/**
 * Apply country filtering based on configuration and campaign settings
 *
 * COUNTRY FILTERING PRIORITY:
 * 1. Campaign API (available_shipping_countries) - Highest priority ⭐
 *    - Set via setCampaignShippingCountries() in SDKInitializer and CheckoutFormEnhancer
 *    - Ensures dropdown matches actual campaign shipping capabilities
 *    - Example: ["US", "CA", "GB", "AU", "BR"]
 *
 * 2. Custom countries list (config.countries)
 *    - Full control over country code and displayed name
 *    - Example: [{ code: "US", name: "United States" }]
 *
 * 3. showCountries filter (config.showCountries) - Deprecated, legacy fallback
 *    - Simple country code whitelist
 *    - Example: ["US", "CA", "GB"]
 *    - Only used if campaign API doesn't provide countries
 *
 * FALLBACK COUNTRY PRIORITY (when detected country not available):
 * 1. United States (US) - if available in filtered list
 * 2. First country in filtered list - if US not available
 * 3. config.defaultCountry - only if filtered list is empty (edge case)
 *
 * IMPORTANT NOTES:
 * - dontShowStates: Always applied to filter out unwanted states/provinces
 * - Currency: Preserved from user's detected location (not affected by country filtering)
 * - Example: Canadian user with US-only shipping will see USD prices but CAD currency symbol
 */
export async function applyCountryFiltering(
  ctx: FilterCtx,
  data: LocationData
): Promise<LocationData> {
  let filteredCountries = [...data.countries];

  // Priority 1: Campaign shipping countries (from API) - RECOMMENDED ⭐
  // This ensures we only show countries that the campaign actually ships to
  if (
    ctx.campaignShippingCountries &&
    ctx.campaignShippingCountries.length > 0
  ) {
    ctx.logger.info(
      '✅ Filtering countries based on campaign API (available_shipping_countries):',
      ctx.campaignShippingCountries
    );
    filteredCountries = filteredCountries.filter(country =>
      ctx.campaignShippingCountries!.includes(country.code)
    );
  }
  // Priority 2: Custom countries list from config
  else if (ctx.config.countries && ctx.config.countries.length > 0) {
    ctx.logger.info(
      'Using custom countries list from addressConfig.countries'
    );
    filteredCountries = ctx.config.countries.map(customCountry => ({
      code: customCountry.code,
      name: customCountry.name,
      phonecode: '',
      currencyCode: 'USD',
      currencySymbol: '$',
    }));
  }
  // Priority 3: showCountries filter from config (DEPRECATED - legacy fallback)
  else if (
    ctx.config.showCountries &&
    ctx.config.showCountries.length > 0
  ) {
    ctx.logger.warn(
      '⚠️ Using deprecated showCountries config. Please use campaign API instead.'
    );
    ctx.logger.info(
      'Filtering countries based on addressConfig.showCountries (legacy):',
      ctx.config.showCountries
    );
    filteredCountries = filteredCountries.filter(country =>
      ctx.config.showCountries!.includes(country.code)
    );
  }

  // IMPORTANT: Preserve the original detected country config for currency purposes
  // Even if the country is not in the allowed shipping list, we want to keep
  // the detected currency (e.g., show CAD for Canadian users even if only shipping to US)
  const originalDetectedCountryConfig = data.detectedCountryConfig;

  // Use detected country or fall back to default if detection failed
  let detectedCountryCode = data.detectedCountryCode;
  let detectedCountryConfig = data.detectedCountryConfig;

  // Check if detected country is in the allowed list
  const detectedCountryAllowed = filteredCountries.some(
    country => country.code === detectedCountryCode
  );

  // Fallback logic when detected country is not in the allowed shipping list
  if (!detectedCountryCode || !detectedCountryAllowed) {
    let fallbackCountryCode: string | undefined;

    // Fallback Priority 1: United States (US)
    const usExists = filteredCountries.some(country => country.code === 'US');
    if (usExists) {
      fallbackCountryCode = 'US';
      ctx.logger.info(
        `✅ Detected country (${detectedCountryCode}) not available for shipping. Using fallback: United States (US)`
      );
    }
    // Fallback Priority 2: First country in the available list
    else if (filteredCountries.length > 0) {
      fallbackCountryCode = filteredCountries[0].code;
      ctx.logger.info(
        `✅ Detected country (${detectedCountryCode}) not available and US not in list. Using first available country: ${fallbackCountryCode}`
      );
    }
    // Fallback Priority 3: defaultCountry from config (if set)
    else if (ctx.config.defaultCountry) {
      fallbackCountryCode = ctx.config.defaultCountry;
      ctx.logger.warn(
        `⚠️ No countries available in filtered list. Using config defaultCountry: ${ctx.config.defaultCountry}`
      );
    }

    if (fallbackCountryCode) {
      ctx.logger.info(
        `Preserving detected currency: ${originalDetectedCountryConfig.currencyCode} from detected location: ${data.detectedCountryCode}`
      );

      // Change country code for shipping dropdown default
      // But KEEP the original detected country config for currency
      detectedCountryCode = fallbackCountryCode;

      // KEEP the original detected currency config, don't replace it
      // This ensures Canadian users see CAD even if only US shipping is allowed
      detectedCountryConfig = originalDetectedCountryConfig;
    }
  } else if (detectedCountryCode && detectedCountryAllowed) {
    ctx.logger.info(
      `✅ Using detected country: ${detectedCountryCode} (available for shipping)`
    );
  }

  return {
    ...data,
    countries: filteredCountries,
    detectedCountryCode,
    detectedCountryConfig, // This will be the original detected config for currency
  };
}

export function applyStateFiltering(
  config: AddressConfig,
  states: State[]
): State[] {
  // Hardcoded US territories to exclude
  const US_TERRITORIES_TO_HIDE = [
    'AS',
    'UM-81',
    'GU',
    'UM-84',
    'UM-86',
    'UM-67',
    'UM-89',
    'UM-71',
    'UM-76',
    'MP',
    'UM-95',
    'PR',
    'UM',
    'VI',
    'UM-79',
  ];

  // Apply hardcoded filtering first
  let filteredStates = states.filter(
    state => !US_TERRITORIES_TO_HIDE.includes(state.code)
  );

  // Then apply config-based filtering if any
  if (config.dontShowStates && config.dontShowStates.length > 0) {
    filteredStates = filteredStates.filter(
      state => !config.dontShowStates!.includes(state.code)
    );
  }

  return filteredStates;
}
