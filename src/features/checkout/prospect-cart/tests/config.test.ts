import { describe, it, expect, vi } from 'vitest';
import { loadConfig } from '../config';
import type { ProspectCartConfig } from '../prospect-cart.types';
import type { Logger } from '@/core/logger';

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function buildElement(attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('form');
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

const defaultConfig: ProspectCartConfig = {
  autoCreate: true,
  triggerOn: 'emailEntry',
  emailField: 'email',
  phoneField: 'phone',
  includeUtmData: true,
  sessionTimeout: 30,
  minPhoneDigits: 7,
};

describe('loadConfig', () => {
  it('returns the default config unchanged when no attributes are present', () => {
    const logger = createMockLogger();
    const config = loadConfig(
      buildElement(),
      defaultConfig,
      logger as unknown as Logger
    );
    expect(config).toEqual(defaultConfig);
  });

  it('merges data-prospect-config JSON over the defaults', () => {
    const logger = createMockLogger();
    const el = buildElement({
      'data-prospect-config': JSON.stringify({
        triggerOn: 'manual',
        sessionTimeout: 60,
      }),
    });
    const config = loadConfig(el, defaultConfig, logger as unknown as Logger);
    expect(config.triggerOn).toBe('manual');
    expect(config.sessionTimeout).toBe(60);
    expect(config.autoCreate).toBe(true);
  });

  it('warns and ignores malformed JSON without throwing', () => {
    const logger = createMockLogger();
    const el = buildElement({ 'data-prospect-config': '{not-json' });
    const config = loadConfig(el, defaultConfig, logger as unknown as Logger);
    expect(config).toEqual(defaultConfig);
    expect(logger.warn).toHaveBeenCalledWith(
      'Invalid prospect config JSON:',
      expect.any(Error)
    );
  });

  it('data-auto-create="false" disables autoCreate; any other value keeps it true', () => {
    const logger = createMockLogger();
    expect(
      loadConfig(
        buildElement({ 'data-auto-create': 'false' }),
        defaultConfig,
        logger as unknown as Logger
      ).autoCreate
    ).toBe(false);
    expect(
      loadConfig(
        buildElement({ 'data-auto-create': 'nope' }),
        defaultConfig,
        logger as unknown as Logger
      ).autoCreate
    ).toBe(true);
  });

  it('accepts a known data-trigger-on value and ignores an unknown one', () => {
    const logger = createMockLogger();
    expect(
      loadConfig(
        buildElement({ 'data-trigger-on': 'phoneEntry' }),
        defaultConfig,
        logger as unknown as Logger
      ).triggerOn
    ).toBe('phoneEntry');
    expect(
      loadConfig(
        buildElement({ 'data-trigger-on': 'bogus' }),
        defaultConfig,
        logger as unknown as Logger
      ).triggerOn
    ).toBe('emailEntry');
  });

  it('overrides emailField and phoneField from their attributes', () => {
    const logger = createMockLogger();
    const config = loadConfig(
      buildElement({
        'data-email-field': 'contact_email',
        'data-phone-field': 'contact_phone',
      }),
      defaultConfig,
      logger as unknown as Logger
    );
    expect(config.emailField).toBe('contact_email');
    expect(config.phoneField).toBe('contact_phone');
  });

  it('parses a valid data-min-phone-digits and warns + keeps default on an invalid one', () => {
    const logger = createMockLogger();
    expect(
      loadConfig(
        buildElement({ 'data-min-phone-digits': '10' }),
        defaultConfig,
        logger as unknown as Logger
      ).minPhoneDigits
    ).toBe(10);

    const badLogger = createMockLogger();
    const config = loadConfig(
      buildElement({ 'data-min-phone-digits': '-3' }),
      defaultConfig,
      badLogger as unknown as Logger
    );
    expect(config.minPhoneDigits).toBe(7);
    expect(badLogger.warn).toHaveBeenCalledWith(
      'Invalid data-min-phone-digits value, using default:',
      '-3'
    );
  });

  it('individual attributes override matching keys from data-prospect-config JSON', () => {
    const logger = createMockLogger();
    const el = buildElement({
      'data-prospect-config': JSON.stringify({ triggerOn: 'manual' }),
      'data-trigger-on': 'phoneEntry',
    });
    const config = loadConfig(el, defaultConfig, logger as unknown as Logger);
    expect(config.triggerOn).toBe('phoneEntry');
  });
});
