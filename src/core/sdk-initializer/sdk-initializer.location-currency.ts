/**
 * `SDKInitializer`'s location and currency detection — extracted verbatim
 * from `sdk-initializer.ts`. Unlike its siblings (`sdk-initializer.url-params.ts`,
 * `sdk-initializer.storage-reset.ts`, `sdk-initializer.debug-utils.ts`), this
 * function *is* a boot step in its own right — `initialize()` calls it
 * directly, third, right after `loadConfiguration` and before
 * `initializeAttribution` — so moving it here does not change the boot
 * sequence `boot-sequence.md` publishes.
 *
 * Only one dependency: `logger`, passed through a `{ logger }` context exactly
 * like `sdk-initializer.url-params.ts`.
 */

import type { Logger } from '@/core/logger';
import { scopedKey } from '@/core/storage';
import { useConfigStore } from '@/state/config';
import { CountryService, Country, LocationData } from '@/core/country-service';

/**
 * Detects the visitor's country and picks the display currency, before
 * campaign prices are fetched so they arrive in the right currency.
 */
export async function initializeLocationAndCurrency(ctx: {
  logger: Logger;
}): Promise<void> {
  try {
    const configStore = useConfigStore.getState();

    // Only initialize if currencyBehavior is explicitly set to 'auto'
    if (
      !configStore.currencyBehavior ||
      configStore.currencyBehavior !== 'auto'
    ) {
      ctx.logger.info(
        'Skipping location/currency detection (currencyBehavior is not set to auto)'
      );
      // Even when auto-detection is disabled, restore a previously chosen
      // currency from session so subsequent page loads (post-checkout,
      // upsells, etc.) keep the same currency the user paid in.
      const urlParams = new URLSearchParams(window.location.search);
      const urlCurrency = urlParams.get('currency');
      const savedCurrency = sessionStorage.getItem(
        scopedKey('next_selected_currency')
      );
      const restored =
        (urlCurrency && urlCurrency.toUpperCase()) || savedCurrency || '';
      if (restored) {
        if (urlCurrency) {
          sessionStorage.setItem(scopedKey('next_selected_currency'), restored);
        }
        configStore.updateConfig({ selectedCurrency: restored });
      }
      return;
    }

    ctx.logger.info('Initializing location and currency detection...');

    // Initialize country service early
    const countryService = CountryService.getInstance();

    // Check for country override in URL or session
    const urlParams = new URLSearchParams(window.location.search);
    const countryOverride = urlParams.get('country');
    const savedCountry = sessionStorage.getItem(
      scopedKey('next_selected_country')
    );

    // Priority: URL param > saved preference > auto-detection
    const forcedCountry = countryOverride || savedCountry;

    let locationData: LocationData | null = null;

    if (forcedCountry) {
      // Use forced country instead of detection
      ctx.logger.info(
        `Using forced country: ${forcedCountry} (source: ${countryOverride ? 'URL' : 'session'})`
      );

      try {
        const response = await fetch(
          `https://cdn-countries.muddy-wind-c7ca.workers.dev/countries/${forcedCountry.toUpperCase()}/states`
        );

        if (response.ok) {
          const data = await response.json();

          // Format response to match location detection structure
          locationData = {
            detectedCountryCode: forcedCountry.toUpperCase(),
            detectedCountryConfig: data.countryConfig || {
              currencyCode: 'USD',
              currencySymbol: '$',
              stateLabel: 'State / Province',
              stateRequired: true,
              postcodeLabel: 'Postcode / ZIP',
              postcodeMinLength: 2,
              postcodeMaxLength: 20,
            },
            detectedStates: data.states || [],
            countries: [] as Country[],
          };

          // Save to session if from URL
          if (countryOverride) {
            sessionStorage.setItem(
              scopedKey('next_selected_country'),
              countryOverride.toUpperCase()
            );
          }

          ctx.logger.info('Country config loaded:', {
            country: locationData?.detectedCountryCode,
            currency: locationData?.detectedCountryConfig.currencyCode,
          });
        } else {
          ctx.logger.warn(
            `Failed to fetch country config for ${forcedCountry}, falling back to detection`
          );
        }
      } catch (error) {
        ctx.logger.error('Error fetching country config:', error);
      }
    }

    // If no forced country or fetch failed, use normal detection
    if (!locationData) {
      // Apply address config if available
      if (configStore.addressConfig) {
        countryService.setConfig(configStore.addressConfig);
      }

      // Fetch location data with timeout to prevent blocking
      const locationDataPromise = countryService.getLocationData();
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Location detection timeout')), 3000)
      );

      try {
        locationData = await Promise.race([
          locationDataPromise,
          timeoutPromise,
        ]);
      } catch (error) {
        ctx.logger.warn(
          'Location detection failed or timed out, using defaults:',
          error
        );
        // Use fallback data
        locationData = {
          detectedCountryCode: 'US',
          detectedCountryConfig: {
            stateLabel: 'State',
            stateRequired: true,
            postcodeLabel: 'ZIP Code',
            postcodeRegex: '^\\d{5}(-\\d{4})?$',
            postcodeMinLength: 5,
            postcodeMaxLength: 10,
            postcodeExample: '12345',
            postcodeFormat: null,
            currencyCode: 'USD',
            currencySymbol: '$',
          },
          detectedStates: [],
          countries: [] as Country[],
        };
      }
    } else if (locationData && !locationData.countries?.length) {
      // If we have forced country data but no countries list, fetch just the countries
      try {
        const countriesData = await countryService.getLocationData();
        locationData.countries = countriesData.countries || [];
      } catch (error) {
        ctx.logger.warn('Failed to fetch countries list:', error);
      }
    }

    if (locationData) {
      ctx.logger.info('User location detected:', {
        country: locationData.detectedCountryCode,
        currency: locationData.detectedCountryConfig.currencyCode,
        currencySymbol: locationData.detectedCountryConfig.currencySymbol,
        ip: locationData.detectedIp,
      });

      // Store in config for global access
      configStore.updateConfig({
        detectedCountry: locationData.detectedCountryCode,
        detectedCurrency: locationData.detectedCountryConfig.currencyCode,
        detectedIp: locationData.detectedIp || '', // Store user IP address
        locationData: locationData, // Cache the entire response
      });

      // Determine selected currency with proper priority:
      // 1. URL parameter (highest priority - immediate override)
      // 2. Previously saved user selection (from session)
      // 3. Detected currency from location (default)

      const urlParams = new URLSearchParams(window.location.search);
      const urlCurrency = urlParams.get('currency');
      const savedCurrency = sessionStorage.getItem(
        scopedKey('next_selected_currency')
      );
      const detectedCurrency = locationData.detectedCountryConfig.currencyCode;

      let selectedCurrency: string;

      if (urlCurrency) {
        // URL parameter has highest priority
        selectedCurrency = urlCurrency.toUpperCase();
        ctx.logger.info('Currency override from URL:', selectedCurrency);
        // Save to session for persistence
        sessionStorage.setItem(
          scopedKey('next_selected_currency'),
          selectedCurrency
        );
      } else if (savedCurrency) {
        // Use previously saved selection
        selectedCurrency = savedCurrency;
        ctx.logger.info('Using saved currency preference:', selectedCurrency);
      } else {
        // Use detected currency as default
        selectedCurrency = detectedCurrency;
        ctx.logger.info('Using detected currency:', selectedCurrency);
      }

      // Lock the currency in for the session so later page loads
      // (success page, upsells) cannot drift to a different currency if
      // geo-detection returns a different result or is skipped.
      if (selectedCurrency) {
        sessionStorage.setItem(
          scopedKey('next_selected_currency'),
          selectedCurrency
        );
      }

      configStore.updateConfig({
        selectedCurrency,
      });

      ctx.logger.debug('Location and currency initialized:', {
        detectedCountry: configStore.detectedCountry,
        detectedCurrency: configStore.detectedCurrency,
        selectedCurrency: configStore.selectedCurrency,
      });
    }
  } catch (error) {
    ctx.logger.warn(
      'Failed to initialize location/currency, using defaults:',
      error
    );

    // Check for saved currency even in fallback case
    const savedCurrency = sessionStorage.getItem(
      scopedKey('next_selected_currency')
    );
    const urlParams = new URLSearchParams(window.location.search);
    const urlCurrency = urlParams.get('currency');

    // Determine fallback currency with priority
    let fallbackCurrency = 'USD';
    if (urlCurrency) {
      fallbackCurrency = urlCurrency.toUpperCase();
      sessionStorage.setItem(
        scopedKey('next_selected_currency'),
        fallbackCurrency
      );
    } else if (savedCurrency) {
      fallbackCurrency = savedCurrency;
    }

    const configStore = useConfigStore.getState();
    configStore.updateConfig({
      detectedCountry: 'US',
      detectedCurrency: 'USD',
      selectedCurrency: fallbackCurrency,
    });
  }
}
