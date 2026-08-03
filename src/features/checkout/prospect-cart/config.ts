/**
 * Reading `ProspectCartConfig` overrides off the form element: the JSON blob in
 * `data-prospect-config`, then the individual `data-*` attributes on top of it.
 */

import type { Logger } from '@/core/logger';
import type { ProspectCartConfig } from './prospect-cart.types';

export function loadConfig(
  element: HTMLElement,
  defaultConfig: ProspectCartConfig,
  logger: Logger
): ProspectCartConfig {
  let config = { ...defaultConfig };

  // Load from data attributes
  const configAttr = element.getAttribute('data-prospect-config');
  if (configAttr) {
    try {
      const customConfig = JSON.parse(configAttr);
      config = { ...config, ...customConfig };
    } catch (error) {
      logger.warn('Invalid prospect config JSON:', error);
    }
  }

  // Override with specific attributes
  if (element.hasAttribute('data-auto-create')) {
    config.autoCreate = element.getAttribute('data-auto-create') !== 'false';
  }

  if (element.hasAttribute('data-trigger-on')) {
    const triggerOn = element.getAttribute('data-trigger-on');
    if (
      triggerOn &&
      (triggerOn === 'formStart' ||
        triggerOn === 'emailEntry' ||
        triggerOn === 'phoneEntry' ||
        triggerOn === 'emailAndPhone' ||
        triggerOn === 'manual')
    ) {
      config.triggerOn = triggerOn;
    }
  }

  if (element.hasAttribute('data-email-field')) {
    const emailField = element.getAttribute('data-email-field');
    if (emailField) {
      config.emailField = emailField;
    }
  }

  if (element.hasAttribute('data-phone-field')) {
    const phoneField = element.getAttribute('data-phone-field');
    if (phoneField) {
      config.phoneField = phoneField;
    }
  }

  if (element.hasAttribute('data-min-phone-digits')) {
    const raw = element.getAttribute('data-min-phone-digits');
    const parsed = raw !== null ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      config.minPhoneDigits = parsed;
    } else {
      logger.warn('Invalid data-min-phone-digits value, using default:', raw);
    }
  }

  return config;
}
