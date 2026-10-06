/**
 * User Data Storage utility
 * Manages user data persistence using cookies and sessionStorage
 */

import { createLogger } from '@/core/logger';
import { scopedKey } from '@/core/storage';
import { checkoutFieldSelector } from '@/utils/checkout-field-names';
import { isE164 } from '@/core/i18n-rules/i18n-rules.phone';

const logger = createLogger('UserDataStorage');

interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
  visitorId?: string;
  sessionId?: string;
  [key: string]: any;
}

class UserDataStorage {
  private static instance: UserDataStorage;
  private userData: UserData = {};
  private cookieExpiryDays = 365; // 1 year

  private constructor() {
    this.loadUserData();
  }

  public static getInstance(): UserDataStorage {
    if (!UserDataStorage.instance) {
      UserDataStorage.instance = new UserDataStorage();
    }
    return UserDataStorage.instance;
  }

  /**
   * Set a cookie with user data
   */
  private setCookie(name: string, value: string, days: number): void {
    if (typeof document === 'undefined') return;

    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `expires=${date.toUTCString()}`;

    // Use SameSite=Lax for better compatibility
    document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax`;
  }

  /**
   * Get a cookie value
   */
  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;

    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');

    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.indexOf(nameEQ) === 0) {
        return decodeURIComponent(cookie.substring(nameEQ.length));
      }
    }
    return null;
  }

  /**
   * Delete a cookie
   */
  private deleteCookie(name: string): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  }

  /**
   * Load user data from cookies and storage
   */
  private loadUserData(): void {
    if (typeof window === 'undefined') return;

    try {
      // Load from cookie first (persistent)
      const cookieData = this.getCookie('next_user_data');
      if (cookieData) {
        try {
          this.userData = JSON.parse(cookieData);
          logger.debug('Loaded user data from cookie:', {
            hasEmail: !!this.userData.email,
            hasUserId: !!this.userData.userId,
          });
        } catch (error) {
          logger.warn('Failed to parse user data cookie:', error);
        }
      }

      // Override with sessionStorage data (more recent)
      const sessionData = sessionStorage.getItem(scopedKey('user_data'));
      if (sessionData) {
        try {
          const parsedSession = JSON.parse(sessionData);
          this.userData = { ...this.userData, ...parsedSession };
          logger.debug('Merged user data from sessionStorage');
        } catch (error) {
          logger.warn('Failed to parse sessionStorage user data:', error);
        }
      }

      // A cookie written before campaign-cart#108 can hold the national form, for a year.
      if (!isE164(this.userData.phone)) delete this.userData.phone;

      // Generate visitor ID if not exists
      if (!this.userData.visitorId) {
        let visitorId = localStorage.getItem(scopedKey('visitor_id'));
        if (!visitorId) {
          visitorId = this.generateId('visitor');
          localStorage.setItem(scopedKey('visitor_id'), visitorId);
        }
        this.userData.visitorId = visitorId;
      }

      // Generate session ID if not exists
      if (!this.userData.sessionId) {
        let sessionId = sessionStorage.getItem(scopedKey('session_id'));
        if (!sessionId) {
          sessionId = this.generateId('session');
          sessionStorage.setItem(scopedKey('session_id'), sessionId);
        }
        this.userData.sessionId = sessionId;
      }
    } catch (error) {
      logger.error('Failed to load user data:', error);
    }
  }

  /**
   * Save user data to cookie and storage
   */
  private saveUserData(): void {
    if (typeof window === 'undefined') return;

    try {
      const dataToSave = JSON.stringify(this.userData);

      // Save to cookie (persistent)
      this.setCookie('next_user_data', dataToSave, this.cookieExpiryDays);

      // Save to sessionStorage (for quick access)
      sessionStorage.setItem(scopedKey('user_data'), dataToSave);

      logger.debug('Saved user data to storage:', {
        hasEmail: !!this.userData.email,
        hasUserId: !!this.userData.userId,
      });
    } catch (error) {
      logger.error('Failed to save user data:', error);
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${randomStr}`;
  }

  /**
   * Update user data
   */
  public updateUserData(data: Partial<UserData>): void {
    const previousEmail = this.userData.email;

    // Merge new data
    this.userData = { ...this.userData, ...data };

    // Clean up undefined values
    Object.keys(this.userData).forEach(key => {
      if (
        this.userData[key] === undefined ||
        this.userData[key] === null ||
        this.userData[key] === ''
      ) {
        delete this.userData[key];
      }
    });
    // Every tag gets `customer_phone` from here, and only E.164 can be matched to a person.
    if (!isE164(this.userData.phone)) delete this.userData.phone;

    // Save to storage
    this.saveUserData();

    // Log significant changes
    if (data.email && data.email !== previousEmail) {
      logger.info('User email updated');
    }
  }

  /**
   * Get all user data
   */
  public getUserData(): UserData {
    return { ...this.userData };
  }

  /**
   * Get specific user data field
   */
  public getUserField(field: keyof UserData): any {
    return this.userData[field];
  }

  /**
   * Clear user data (logout)
   */
  public clearUserData(): void {
    // Keep visitor ID and session ID
    const { visitorId, sessionId } = this.userData;

    // Clear all data
    this.userData = {};
    if (visitorId !== undefined) {
      this.userData.visitorId = visitorId;
    }
    if (sessionId !== undefined) {
      this.userData.sessionId = sessionId;
    }

    // Clear storage
    this.deleteCookie('next_user_data');
    sessionStorage.removeItem(scopedKey('user_data'));

    logger.info('User data cleared');
  }

  /**
   * Check if user is identified (has email or userId)
   */
  public isIdentified(): boolean {
    return !!(this.userData.email || this.userData.userId);
  }

  /**
   * Update from checkout form fields
   */
  public updateFromFormFields(): void {
    if (typeof document === 'undefined') return;

    const updates: Partial<UserData> = {};

    // Check common checkout field selectors
    const fieldMappings = [
      {
        selector:
          '[name="email"], [data-next-checkout-field="email"], #email, [type="email"]',
        key: 'email',
      },
      {
        selector: `[name="phone"], ${checkoutFieldSelector('phone')}, #phone, [type="tel"]`,
        key: 'phone',
      },
      {
        selector:
          '[name="first_name"], [data-next-checkout-field="first_name"], [data-next-checkout-field="fname"], [name="firstName"], #first-name',
        key: 'firstName',
      },
      {
        selector:
          '[name="last_name"], [data-next-checkout-field="last_name"], [data-next-checkout-field="lname"], [name="lastName"], #last-name',
        key: 'lastName',
      },
    ];

    let hasUpdates = false;
    fieldMappings.forEach(({ selector, key }) => {
      const element = document.querySelector(selector) as HTMLInputElement;
      const value = element ? fieldValue(element, key) : '';
      if (value && value !== this.userData[key]) {
        updates[key] = value;
        hasUpdates = true;
      }
    });

    if (hasUpdates) {
      this.updateUserData(updates);
      logger.debug('Updated user data from form fields:', Object.keys(updates));
    }
  }
}

/**
 * What a field is worth to a tag: its value, except a phone the checkout's phone field
 * shows, which is the E.164 it vouches for (`data-next-phone-e164`). The box holds the
 * national form, `(415) 555-2671`, which `updateUserData` would drop.
 */
function fieldValue(element: HTMLInputElement, key: string): string {
  if (key === 'phone' && element.classList.contains('next-phone-input')) {
    return element.getAttribute('data-next-phone-e164') ?? '';
  }
  return element.value;
}

// Export singleton instance
export const userDataStorage = UserDataStorage.getInstance();

// Export type
export type { UserData };
