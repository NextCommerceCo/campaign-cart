/**
 * Wiring the DOM listeners that decide when enough of the form has been filled
 * in to record a prospect — one function per `ProspectCartConfig.triggerOn` mode.
 */

import { isValidEmail, isValidName } from './validation';
import type { ProspectCartConfig } from './prospect-cart.types';
import type { TriggerContext } from './prospect-cart.types';

export function setupTriggers(
  config: ProspectCartConfig,
  context: TriggerContext
): void {
  if (!config.autoCreate) return;

  switch (config.triggerOn) {
    case 'formStart':
      setupFormStartTrigger(context);
      break;
    case 'emailEntry':
      setupEmailEntryTrigger(context);
      break;
    case 'phoneEntry':
      setupPhoneEntryTrigger(context);
      break;
    case 'emailAndPhone':
      setupEmailEntryTrigger(context);
      setupPhoneEntryTrigger(context);
      break;
    case 'manual':
      // No automatic triggers, only manual creation
      break;
  }
}

export function setupFormStartTrigger(context: TriggerContext): void {
  // Trigger when user starts filling any form field
  const formFields = context.element.querySelectorAll(
    'input, select, textarea'
  );

  formFields.forEach(field => {
    const handler = () => {
      if (!context.hasTriggeredRef.value) {
        context.createProspectCart();
        context.hasTriggeredRef.value = true;
      }
    };

    field.addEventListener('focus', handler, { once: true });
    field.addEventListener('input', handler, { once: true });
  });
}

export function setupEmailEntryTrigger(context: TriggerContext): void {
  if (!context.emailField) {
    context.logger.warn(
      'Cannot setup email entry trigger - email field not found'
    );
    return;
  }

  context.logger.debug(
    'Setting up email entry trigger on field:',
    context.emailField
  );

  // Find first name and last name fields
  const firstNameField = context.element.querySelector(
    '[data-next-checkout-field="fname"], [os-checkout-field="fname"], input[name="first_name"]'
  ) as HTMLInputElement;
  const lastNameField = context.element.querySelector(
    '[data-next-checkout-field="lname"], [os-checkout-field="lname"], input[name="last_name"]'
  ) as HTMLInputElement;

  let blurTimeout: number | undefined;
  let lastEmailValue = '';

  // Handler for checking if we should create cart
  const checkForCartCreation = () => {
    // Clear any existing timeout
    if (blurTimeout) {
      clearTimeout(blurTimeout);
    }

    blurTimeout = window.setTimeout(() => {
      context.logger.debug(
        'Checking if all required fields are valid for cart creation'
      );
      context.checkAndCreateCart();
    }, 300); // 300ms delay to catch rapid blur events
  };

  // Set up email field listeners
  context.emailField.addEventListener('blur', () => {
    const currentEmail = context.emailField!.value.trim();

    // Only process if email has changed and appears complete
    if (currentEmail !== lastEmailValue && currentEmail.length > 0) {
      lastEmailValue = currentEmail;

      context.logger.debug('Email blur event processed, value:', currentEmail);

      // Only check if email looks complete (has @ and a domain with TLD)
      if (
        currentEmail.includes('@') &&
        currentEmail.split('@')[1]?.includes('.')
      ) {
        checkForCartCreation();
      } else {
        context.logger.debug(
          'Email appears incomplete, skipping cart creation:',
          currentEmail
        );
      }
    }
  });

  // Also listen for change event on email (more reliable for autofill)
  context.emailField.addEventListener('change', () => {
    const currentEmail = context.emailField!.value.trim();
    if (isValidEmail(currentEmail)) {
      context.logger.debug(
        'Valid email detected on change event:',
        currentEmail
      );
      checkForCartCreation();
    }
  });

  // Set up first name field listeners
  if (firstNameField) {
    firstNameField.addEventListener('blur', () => {
      const firstName = firstNameField.value.trim();
      if (firstName.length >= 2) {
        context.logger.debug('First name blur event, checking cart creation');
        checkForCartCreation();
      }
    });

    firstNameField.addEventListener('change', () => {
      const firstName = firstNameField.value.trim();
      if (isValidName(firstName)) {
        context.logger.debug(
          'Valid first name detected on change event:',
          firstName
        );
        checkForCartCreation();
      }
    });
  }

  // Set up last name field listeners
  if (lastNameField) {
    lastNameField.addEventListener('blur', () => {
      const lastName = lastNameField.value.trim();
      if (lastName.length >= 2) {
        context.logger.debug('Last name blur event, checking cart creation');
        checkForCartCreation();
      }
    });

    lastNameField.addEventListener('change', () => {
      const lastName = lastNameField.value.trim();
      if (isValidName(lastName)) {
        context.logger.debug(
          'Valid last name detected on change event:',
          lastName
        );
        checkForCartCreation();
      }
    });
  }
}

export function setupPhoneEntryTrigger(context: TriggerContext): void {
  if (!context.phoneField) {
    context.logger.warn(
      'Cannot setup phone entry trigger - phone field not found'
    );
    return;
  }

  context.logger.debug(
    'Setting up phone entry trigger on field:',
    context.phoneField
  );

  let lastPhoneValue = '';

  const scheduleCheck = () => {
    if (context.phoneBlurTimeoutRef.value !== undefined) {
      clearTimeout(context.phoneBlurTimeoutRef.value);
    }
    context.phoneBlurTimeoutRef.value = window.setTimeout(() => {
      context.logger.debug(
        'Checking if required fields are valid for cart creation (phone trigger)'
      );
      context.checkAndCreateCart();
    }, 300);
  };

  context.phoneField.addEventListener('blur', () => {
    const currentPhone = context.phoneField!.value.trim();
    if (currentPhone !== lastPhoneValue && currentPhone.length > 0) {
      lastPhoneValue = currentPhone;
      if (context.isValidPhone(currentPhone)) {
        context.logger.debug(
          'Phone blur event processed, value:',
          currentPhone
        );
        scheduleCheck();
      } else {
        context.logger.debug(
          'Phone appears incomplete, skipping cart creation:',
          currentPhone
        );
      }
    }
  });

  context.phoneField.addEventListener('change', () => {
    const currentPhone = context.phoneField!.value.trim();
    if (context.isValidPhone(currentPhone)) {
      context.logger.debug(
        'Valid phone detected on change event:',
        currentPhone
      );
      scheduleCheck();
    }
  });
}
