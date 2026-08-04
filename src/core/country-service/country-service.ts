/**
 * Country Service
 * Handles fetching country and state data from the CDN API with caching
 */

import { Logger } from '@/core/logger';
import type { AddressConfig } from '@/types/global';
import * as postalCodeMethods from '@/core/country-service/country-service.postal-code';
import * as filteringMethods from '@/core/country-service/country-service.filtering';

export interface CountryConfig {
  stateLabel: string;
  stateRequired: boolean;
  postcodeLabel: string;
  postcodeRegex: string | null;
  postcodeMinLength: number;
  postcodeMaxLength: number;
  postcodeExample: string | null;
  postcodeFormat: string | null;
  currencyCode: string;
  currencySymbol: string;
}

export interface Country {
  code: string;
  name: string;
  phonecode: string;
  currencyCode: string;
  currencySymbol: string;
}

export interface State {
  code: string;
  name: string;
}

export interface LocationData {
  detectedCountryCode: string;
  detectedCountryConfig: CountryConfig;
  detectedStates: State[];
  countries: Country[];
  detectedIp?: string;
}

export interface CountryStatesData {
  countryConfig: CountryConfig;
  states: State[];
}

export class CountryService {
  private static instance: CountryService;
  private cachePrefix = 'next_country_';
  private cacheExpiry = 3600000; // 1 hour in milliseconds
  private baseUrl = 'https://cdn-countries.muddy-wind-c7ca.workers.dev';
  private logger: Logger;
  private config: AddressConfig = {};
  private campaignShippingCountries: string[] | null = null;

  private constructor() {
    this.logger = new Logger('CountryService');
  }

  public static getInstance(): CountryService {
    if (!CountryService.instance) {
      CountryService.instance = new CountryService();
    }
    return CountryService.instance;
  }

  /**
   * Set address configuration
   */
  public setConfig(config: AddressConfig): void {
    this.config = { ...config };
    this.logger.debug('Address configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): AddressConfig {
    return { ...this.config };
  }

  /**
   * Set campaign shipping countries from the campaign API
   *
   * IMPORTANT: This takes PRIORITY over all addressConfig country settings.
   * This ensures the country dropdown only shows countries that the campaign actually ships to.
   *
   * Priority order for country filtering:
   * 1. Campaign shipping countries (this method) - Highest priority ⭐
   * 2. config.countries (custom list with names)
   * 3. config.showCountries (legacy, deprecated) - Lowest priority
   *
   * @param countries Array of shipping countries from campaign API
   */
  public setCampaignShippingCountries(
    countries: Array<{ code: string; label: string }> | null
  ): void {
    this.campaignShippingCountries = countries
      ? countries.map(c => c.code)
      : null;
    this.logger.debug(
      'Campaign shipping countries updated:',
      this.campaignShippingCountries
    );
  }

  /**
   * Get campaign shipping countries
   */
  public getCampaignShippingCountries(): string[] | null {
    return this.campaignShippingCountries;
  }

  /**
   * Get location data with user's detected country and list of all countries
   */
  public async getLocationData(): Promise<LocationData> {
    // Use localStorage for location data as countries list doesn't change often
    const cached = this.getFromCache('location_data', true);

    if (cached) {
      return await this.applyCountryFiltering(cached);
    }

    try {
      const response = await fetch(`${this.baseUrl}/location`);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch location data: ${response.statusText}`
        );
      }

      const data = await response.json();
      // Store in localStorage for longer persistence
      this.setCache('location_data', data, true);

      this.logger.debug('Location data fetched', {
        detectedCountry: data.detectedCountryCode,
        countriesCount: data.countries?.length,
      });

      return await this.applyCountryFiltering(data);
    } catch (error) {
      this.logger.error('Failed to fetch location data:', error);
      return await this.applyCountryFiltering(this.getFallbackLocationData());
    }
  }

  /**
   * Get states for a specific country
   */
  public async getCountryStates(
    countryCode: string
  ): Promise<CountryStatesData> {
    const cacheKey = `states_${countryCode}`;
    // Use localStorage for country states as they don't change often
    const cached = this.getFromCache(cacheKey, true);

    if (cached) {
      return {
        ...cached,
        states: this.applyStateFiltering(cached.states || []),
      };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/countries/${countryCode}/states`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch states for ${countryCode}: ${response.statusText}`
        );
      }

      const data = await response.json();
      // Store in localStorage for longer persistence
      this.setCache(cacheKey, data, true);

      this.logger.debug(`States data fetched for ${countryCode}`, {
        statesCount: data.states?.length,
        stateLabel: data.countryConfig?.stateLabel,
      });

      return {
        ...data,
        states: this.applyStateFiltering(data.states || []),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch states for ${countryCode}:`, error);
      // Return empty states with default config
      return {
        countryConfig: this.getDefaultCountryConfig(countryCode),
        states: [],
      };
    }
  }

  /**
   * Get country configuration by country code
   */
  public async getCountryConfig(countryCode: string): Promise<CountryConfig> {
    // First try to get from location data if it's the detected country
    const locationData = await this.getLocationData();
    if (locationData.detectedCountryCode === countryCode) {
      return locationData.detectedCountryConfig;
    }

    // Otherwise fetch states data which includes country config
    const statesData = await this.getCountryStates(countryCode);
    return statesData.countryConfig;
  }

  /**
   * Validate postal code based on country configuration
   */
  public validatePostalCode(
    postalCode: string,
    _countryCode: string,
    countryConfig: CountryConfig
  ): boolean {
    return postalCodeMethods.validatePostalCode(
      this.logger,
      postalCode,
      _countryCode,
      countryConfig
    );
  }

  /**
   * Format postal code based on country configuration
   * Applies formatting pattern from CDN (e.g., "XXX XXX" for Canadian postal codes)
   */
  public formatPostalCode(
    postalCode: string,
    countryConfig: CountryConfig
  ): string {
    return postalCodeMethods.formatPostalCode(postalCode, countryConfig);
  }

  /**
   * Clear all cached data
   */
  public clearCache(): void {
    try {
      // Remove all cache entries with our prefix from both storages
      const keysToRemove: string[] = [];

      // Clear from sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(this.cachePrefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));

      // Clear from localStorage (mainly states data)
      const localKeysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.cachePrefix)) {
          localKeysToRemove.push(key);
        }
      }
      localKeysToRemove.forEach(key => localStorage.removeItem(key));

      this.logger.debug(
        `Country service cache cleared (${keysToRemove.length} session + ${localKeysToRemove.length} local entries)`
      );
    } catch (error) {
      this.logger.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Clear cache for a specific country
   */
  public clearCountryCache(countryCode: string): void {
    try {
      const cacheKey = this.cachePrefix + `states_${countryCode}`;
      // Clear from localStorage since states are stored there
      localStorage.removeItem(cacheKey);
      // Also clear from sessionStorage in case there's any legacy data
      sessionStorage.removeItem(cacheKey);
      this.logger.debug(`Cache cleared for country: ${countryCode}`);
    } catch (error) {
      this.logger.warn(
        `Failed to clear cache for country ${countryCode}:`,
        error
      );
    }
  }

  private getFromCache(key: string, useLocalStorage: boolean = false): any {
    try {
      const cacheKey = this.cachePrefix + key;
      const storage = useLocalStorage ? localStorage : sessionStorage;
      const cached = storage.getItem(cacheKey);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();

      if (now - timestamp > this.cacheExpiry) {
        storage.removeItem(cacheKey);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.warn('Failed to read from cache:', error);
      return null;
    }
  }

  private setCache(
    key: string,
    data: any,
    useLocalStorage: boolean = false
  ): void {
    try {
      const cacheKey = this.cachePrefix + key;
      const cacheData = {
        data,
        timestamp: Date.now(),
      };
      const storage = useLocalStorage ? localStorage : sessionStorage;
      storage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      this.logger.warn('Failed to write to cache:', error);
      // Continue without caching if storage is unavailable
    }
  }

  private getDefaultCountryConfig(countryCode: string): CountryConfig {
    return postalCodeMethods.getDefaultCountryConfig(countryCode);
  }

  private getFallbackLocationData(): LocationData {
    // Minimal fallback data for when API is unavailable
    return {
      detectedCountryCode: 'US',
      detectedCountryConfig: this.getDefaultCountryConfig('US'),
      detectedStates: [],
      countries: [
        {
          code: 'US',
          name: 'United States',
          phonecode: '+1',
          currencyCode: 'USD',
          currencySymbol: '$',
        },
        {
          code: 'CA',
          name: 'Canada',
          phonecode: '+1',
          currencyCode: 'CAD',
          currencySymbol: '$',
        },
        {
          code: 'GB',
          name: 'United Kingdom',
          phonecode: '+44',
          currencyCode: 'GBP',
          currencySymbol: '£',
        },
        {
          code: 'AU',
          name: 'Australia',
          phonecode: '+61',
          currencyCode: 'AUD',
          currencySymbol: '$',
        },
        {
          code: 'DE',
          name: 'Germany',
          phonecode: '+49',
          currencyCode: 'EUR',
          currencySymbol: '€',
        },
      ],
    };
  }

  /**
   * Apply country filtering based on configuration and campaign settings.
   * Rules and priority order are documented on `applyCountryFiltering` in
   * `country-service.filtering.ts`.
   */
  private async applyCountryFiltering(
    data: LocationData
  ): Promise<LocationData> {
    return filteringMethods.applyCountryFiltering(
      {
        campaignShippingCountries: this.campaignShippingCountries,
        config: this.config,
        logger: this.logger,
      },
      data
    );
  }

  private applyStateFiltering(states: State[]): State[] {
    return filteringMethods.applyStateFiltering(this.config, states);
  }
}
