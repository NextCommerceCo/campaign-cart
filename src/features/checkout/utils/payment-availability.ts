/**
 * Payment Availability Checker
 * Utilities to detect if specific payment methods are available on the current device/browser
 */

import { createLogger } from '@/core/logger';

const logger = createLogger('PaymentAvailability');

/**
 * Check if Apple Pay should be shown
 * Apple Pay should be hidden only on Android devices
 * On desktop it shows a QR code, on iOS it uses native Apple Pay
 */
export function isApplePayAvailable(): boolean {
  try {
    // Check if this is an Android device - if so, hide Apple Pay
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isAndroid) {
      logger.debug('Android device detected - hiding Apple Pay');
      return false;
    }

    // Show Apple Pay on all other devices (iOS, Desktop, etc)
    // Desktop will show QR code, iOS will use native Apple Pay
    logger.debug('Apple Pay available (non-Android device)');
    return true;
  } catch (error) {
    logger.warn('Error checking Apple Pay availability:', error);
    return true; // Default to showing it if we can't detect
  }
}

/**
 * Check if Google Pay should be shown
 * Google Pay should be shown on all devices/browsers
 * The backend/payment processor will handle actual availability
 */
export function isGooglePayAvailable(): boolean {
  // Google Pay is available everywhere - let the payment processor handle compatibility
  return true;
}

/**
 * Check if PayPal is available
 * PayPal generally works on all browsers and devices
 */
export function isPayPalAvailable(): boolean {
  // PayPal is always available as it uses redirect flow
  return true;
}

export function getPaymentCapabilities(): {
  applePay: boolean;
  googlePay: boolean;
  paypal: boolean;
  userAgent: string;
  platform: string;
} {
  return {
    applePay: isApplePayAvailable(),
    googlePay: isGooglePayAvailable(),
    paypal: isPayPalAvailable(),
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'unknown',
  };
}
