/**
 * Country Service
 * Handles fetching country and state data from the CDN API with caching
 */

import type {
  CountryRules,
  FixedValues,
} from '@/core/country-service/country-service.next-address';
import type { PhoneRules } from '@/core/country-service/country-service.phone';
import { getSelectedLocale } from '@/core/currency-formatter';
import { EventBus } from '@/core/events';
import { Logger } from '@/core/logger';
import { useConfigStore } from '@/state/config';
import type { AddressConfig } from '@/types/global';
import * as postalCodeMethods from '@/core/country-service/country-service.postal-code';
import * as filteringMethods from '@/core/country-service/country-service.filtering';
import {
  fetchCountryStates,
  fetchLocationData,
  fetchTexts,
} from '@/core/country-service/country-service.next-address';
import { baseLang } from '@/core/country-service/country-service.translations';

export interface CountryConfig {
  stateLabel: string;
  stateRequired: boolean;
  postcodeLabel: string;
  postcodeRegex: string | null;
  postcodeMinLength: number;
  postcodeMaxLength: number;
  postcodeExample: string | null;
  /**
   * Pattern(s) the postcode is written in. A list is tried in order, which is how
   * a country whose postcodes run to more than one shape is described (GB
   * `AANN NAA` at 7 characters, `AAN NAA` at 6, `AN NAA` at 5).
   */
  postcodeFormat: string | string[] | null;
  /**
   * True when {@link postcodeRegex} is written against the postcode **compacted** —
   * uppercased, spaces and hyphens removed — rather than against the string as typed.
   *
   * next-address defines every pattern that way so one pattern accepts every spacing a
   * shopper might use (`SW1A 1AA`, `sw1a1aa`). Testing such a pattern against the raw
   * value rejects the spaced form and blocks the checkout, so the flag travels with the
   * pattern and `validatePostalCode` compacts before matching.
   */
  postcodeCompact?: boolean;
  /**
   * Whether the country asks for a postcode. `false` for one that has none (Hong Kong) and
   * for one whose single postcode is {@link fixed}; absent where it is not known, which is
   * read as required.
   */
  postcodeRequired?: boolean;
  /** Values every address in the country shares, sent without being asked for. */
  fixed?: FixedValues;
  /**
   * How the country's phone numbers are shown and checked: the address-rules service's
   * `spec.phone`. Absent for a country with no rules of its own, or from a deployment that
   * sends none; the phone field is then a plain input.
   */
  phone?: PhoneRules;
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
  /** The address-rules service's `error.*` templates, keyed by message id. */
  messages?: Record<string, string>;
  /** What each field is called inside those messages, keyed by the service's field name. */
  labels?: Record<string, string>;
  /** The language the service answered in: the one asked for if it has it, else `en`. */
  messagesLang?: string;
}

export interface CountryStatesData {
  countryConfig: CountryConfig;
  states: State[];
  /** The country's rules as the service answered them, for a caller that needs its labels. */
  rules?: CountryRules;
  messages?: Record<string, string>;
  labels?: Record<string, string>;
  messagesLang?: string;
}

/**
 * The language the address-rules service answers in: the debug picker's locale, then the
 * page's own when the caller has one (`data-next-address-lang`), then `nextConfig.locale`,
 * then English. Never the browser's, or a shipped page would relabel itself per visitor.
 */
export function addressLang(pageLang?: string): string {
  return (
    getSelectedLocale() ?? pageLang ?? useConfigStore.getState().locale ?? 'en'
  );
}

export class CountryService {
  private static instance: CountryService;
  private cachePrefix = 'next_country_';
  private cacheExpiry = 3600000; // 1 hour in milliseconds
  private messages: Record<string, string> = {};
  private messagesLang: string | undefined;
  /** The service's texts by language, for `data-next-i18n`; see {@link getTexts}. */
  private texts = new Map<string, Readonly<Record<string, string>>>();
  private textRequests = new Map<string, Promise<void>>();
  private messageLabels = new Map<string, Record<string, string>>();
  private lastMessageLabels: Record<string, string> = {};
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
   * The address-rules service's `error.*` templates from its last answer, such as
   * `error.emoji`. Empty until it has answered; a caller falls back to its own
   * wording.
   */
  public getMessages(): Readonly<Record<string, string>> {
    return this.messages;
  }

  /**
   * What each field is called inside {@link getMessages}' templates, in the same
   * language: `{ postcode: 'ZIP Code', line2: 'Address line 2', email: 'Email', … }`.
   * The country's own words when it has been fetched, else the last country's.
   */
  /** The language {@link getMessages} is in, once the service has said. */
  public getMessagesLang(): string | undefined {
    return this.messagesLang;
  }

  /**
   * The service's texts in `lang`, or `undefined` until they are loaded. Kept apart from
   * {@link getMessages}: those go with the field names of one country's rules, in one
   * language, and switching them alone would put a sentence in one language around a
   * name in another.
   */
  public getTexts(lang: string): Readonly<Record<string, string>> | undefined {
    return this.texts.get(baseLang(lang));
  }

  /**
   * Loads the service's texts in `lang`, once however many elements ask, and says so
   * with `address:messages-loaded`. An answer in another language is not kept: a page
   * with no texts in its language keeps its own.
   */
  public loadTexts(lang: string): Promise<void> {
    const base = baseLang(lang);
    if (this.texts.has(base)) return Promise.resolve();
    let request = this.textRequests.get(base);
    if (!request) {
      request = fetchTexts(lang).then(answer => {
        if (answer && baseLang(answer.lang) === base) {
          this.texts.set(base, answer.texts);
          EventBus.getInstance().emit('address:messages-loaded', {
            lang: base,
          });
        }
      });
      this.textRequests.set(base, request);
    }
    return request;
  }

  public getMessageLabels(country?: string): Readonly<Record<string, string>> {
    return (
      (country && this.messageLabels.get(country)) || this.lastMessageLabels
    );
  }

  private keepMessages(
    country: string,
    data: Pick<LocationData, 'messages' | 'labels' | 'messagesLang'>
  ): void {
    if (data.messages) this.messages = data.messages;
    if (data.messagesLang) this.messagesLang = data.messagesLang;
    if (data.messages && data.messagesLang) {
      this.texts.set(baseLang(data.messagesLang), data.messages);
      EventBus.getInstance().emit('address:messages-loaded', {
        lang: baseLang(data.messagesLang),
      });
    }
    if (data.labels) {
      this.messageLabels.set(country, data.labels);
      this.lastMessageLabels = data.labels;
    }
  }

  /**
   * Get location data with user's detected country and list of all countries
   */
  public async getLocationData(): Promise<LocationData> {
    // Use localStorage for location data as countries list doesn't change often
    const lang = addressLang();
    const cached = this.getFromCache('location_data', lang);

    if (cached) {
      this.keepMessages(cached.detectedCountryCode, cached);
      return await this.applyCountryFiltering(cached);
    }

    try {
      const data = await fetchLocationData(undefined, lang);
      this.keepMessages(data.detectedCountryCode, data);
      this.setCache('location_data', data, lang);

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
    const lang = addressLang();
    const cached = this.getFromCache(cacheKey, lang);

    if (cached) {
      this.keepMessages(countryCode, cached);
      return {
        ...cached,
        countryConfig: cached.countryConfig,
        states: this.applyStateFiltering(cached.states || []),
      };
    }

    try {
      const data = await fetchCountryStates(countryCode, undefined, lang);
      this.keepMessages(countryCode, data);
      this.setCache(cacheKey, data, lang);

      this.logger.debug(`States data fetched for ${countryCode}`, {
        statesCount: data.states?.length,
        stateLabel: data.countryConfig?.stateLabel,
      });

      return {
        ...data,
        countryConfig: data.countryConfig,
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

  /** Applies the country's `postcodeFormat` from the CDN (CA `ANA NAN`). */
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

  /**
   * localStorage, because a country list does not change between sessions. An entry in
   * another language is a miss; one written before entries carried a language was `en`.
   */
  private getFromCache(key: string, lang: string): any {
    try {
      const cacheKey = this.cachePrefix + key;
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const { data, timestamp, lang: cachedLang = 'en' } = JSON.parse(cached);
      const now = Date.now();

      if (now - timestamp > this.cacheExpiry) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      if (cachedLang !== lang) return null;

      return data;
    } catch (error) {
      this.logger.warn('Failed to read from cache:', error);
      return null;
    }
  }

  private setCache(key: string, data: any, lang: string): void {
    try {
      const cacheKey = this.cachePrefix + key;
      const cacheData = {
        data,
        timestamp: Date.now(),
        lang,
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
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
