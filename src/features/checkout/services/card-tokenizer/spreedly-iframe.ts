/**
 * The hosted card fields drawn by Spreedly's iFrame script (`iframe-v1.min.js`), keyed by
 * the campaign's environment key. Everything that calls `window.Spreedly` lives here.
 */

import { createLogger } from '@/core/logger';
import type { CardInputConfig } from '@/types/global';

import { cardErrorField, cardErrorKey } from './card-texts';
import type {
  CardError,
  CardHolderData,
  CardTokenizer,
  CardTokenizerEvents,
  HostedCardField,
  HostedFieldsMount,
} from './card-tokenizer.types';

declare global {
  interface Window {
    Spreedly: any;
  }
}

const SCRIPT_URL = 'https://core.spreedly.com/iframe/iframe-v1.min.js';

const DEFAULT_FIELD_STYLE =
  'color: #212529; font-size: .925rem; font-weight: 400; width: 100%; height:100%; font-family: system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue","Noto Sans","Liberation Sans",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji";';

/** A Spreedly `errors` entry: `{ attribute: 'number', key: 'errors.invalid', message }`. */
interface SpreedlyError {
  attribute?: string;
  key?: string;
  message?: string;
  status?: number;
}

function toCardError(error: SpreedlyError): CardError {
  const field = cardErrorField(error.attribute);
  const textKey = cardErrorKey(field, error.key, error.key === 'errors.blank');
  if (error.message && error.message.trim() !== '') {
    return { ...(field && { field }), textKey, message: error.message };
  }
  const offline = error.key === 'errors.unexpected_error' || error.status === 0;
  return {
    ...(field && { field }),
    textKey: offline ? 'payment.errors.network' : textKey,
    message: offline
      ? 'Unable to process payment. Please check your internet connection and try again.'
      : 'An error occurred processing your payment. Please try again.',
  };
}

export class SpreedlyIframeTokenizer implements CardTokenizer {
  public readonly provider = 'spreedly';
  private readonly logger = createLogger('CreditCardService');
  private ready = false;

  constructor(
    private readonly environmentKey: string,
    private readonly config?: CardInputConfig
  ) {}

  public async mount(
    mount: HostedFieldsMount,
    events: CardTokenizerEvents
  ): Promise<void> {
    await this.loadScript();

    const initOptions: Record<string, unknown> = {
      numberEl: mount.numberId,
      cvvEl: mount.cvvId,
    };
    if (this.config?.nonce) initOptions['nonce'] = this.config.nonce;
    if (this.config?.timestamp)
      initOptions['timestamp'] = this.config.timestamp;
    if (this.config?.certificateToken) {
      initOptions['certificateToken'] = this.config.certificateToken;
    }
    if (this.config?.signature)
      initOptions['signature'] = this.config.signature;
    if (this.config?.fraud !== undefined) {
      initOptions['fraud'] = this.config.fraud;
    }

    window.Spreedly.init(this.environmentKey, initOptions);
    this.listen(mount, events);
  }

  public tokenize(card: CardHolderData): void {
    window.Spreedly.tokenizeCreditCard(card);
  }

  public focus(field: HostedCardField): void {
    if (this.ready) window.Spreedly.transferFocus(field);
  }

  public setPlaceholder(field: HostedCardField, text: string): void {
    if (this.ready) window.Spreedly.setPlaceholder(field, text);
  }

  public reset(): void {
    if (!this.ready) return;
    try {
      window.Spreedly.reload();
      this.logger.debug('Spreedly fields reloaded');
    } catch (error) {
      this.logger.warn('Failed to reload Spreedly fields:', error);
    }
  }

  /**
   * `window.Spreedly.on` registrations are page-lifetime and the script offers no way to
   * remove one, so this only stops the fields answering calls.
   */
  public destroy(): void {
    this.ready = false;
  }

  private async loadScript(): Promise<void> {
    if (typeof window.Spreedly !== 'undefined') {
      this.logger.debug('Spreedly already loaded');
      return;
    }

    this.logger.debug('Loading Spreedly script...');

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        this.logger.debug('Spreedly script loaded');
        resolve();
      };
      script.onerror = () => {
        this.logger.error('Failed to load Spreedly script');
        reject(new Error('Failed to load Spreedly script'));
      };
      document.head.appendChild(script);
    });
  }

  private listen(mount: HostedFieldsMount, events: CardTokenizerEvents): void {
    window.Spreedly.on('ready', () => {
      this.logger.info(
        '[Spreedly Event: ready] iFrame initialized and ready for configuration'
      );
      this.applyConfig(mount);
      this.ready = true;
      events.onReady();
    });

    window.Spreedly.on('errors', (errors: SpreedlyError[]) => {
      this.logger.error(
        '[Spreedly Event: errors] Tokenization failed:',
        errors.map(e => ({
          attribute: e.attribute,
          key: e.key,
          message: e.message,
        }))
      );
      events.onError(errors.map(toCardError));
    });

    window.Spreedly.on('paymentMethod', (token: string, pmData: any) => {
      this.logger.info(
        '[Spreedly Event: paymentMethod] Successfully tokenized!',
        {
          token,
          last4: pmData.last_four_digits,
          cardType: pmData.card_type,
          fingerprint: pmData.fingerprint,
        }
      );
      events.onToken(token, pmData);
    });

    // Fires only when `Spreedly.validate()` is called, not while the shopper types.
    window.Spreedly.on('validation', (inputProperties: any) => {
      this.logger.info('[Spreedly Event: validation] Validation requested:', {
        cardType: inputProperties.cardType,
        validNumber: inputProperties.validNumber,
        validCvv: inputProperties.validCvv,
        numberLength: inputProperties.numberLength,
        cvvLength: inputProperties.cvvLength,
        iin: inputProperties.iin,
      });
      if (inputProperties.validNumber !== undefined) {
        events.onFieldState({
          field: 'number',
          action: 'validation',
          valid: inputProperties.validNumber,
        });
      }
      if (inputProperties.validCvv !== undefined) {
        events.onFieldState({
          field: 'cvv',
          action: 'validation',
          valid: inputProperties.validCvv,
        });
      }
    });

    window.Spreedly.on(
      'fieldEvent',
      (name: string, type: string, _activeEl: unknown, props: any) => {
        if (name !== 'number' && name !== 'cvv') return;
        if (type === 'focus' || type === 'blur') {
          events.onFieldState({ field: name, action: type });
        } else if (type === 'input') {
          events.onFieldState({
            field: name,
            action: 'input',
            ...(props && {
              hasValue:
                (name === 'number' ? props.numberLength : props.cvvLength) > 0,
            }),
            ...(props &&
              (name === 'number' ? props.validNumber : props.validCvv) !==
                undefined && {
                valid: name === 'number' ? props.validNumber : props.validCvv,
              }),
          });
        }
      }
    );

    window.Spreedly.on('consoleError', (error: any) => {
      this.logger.error('[Spreedly Event: consoleError] Error from iFrame:', {
        message: error.msg,
        url: error.url,
        line: error.line,
        col: error.col,
      });
    });
  }

  private applyConfig(mount: HostedFieldsMount): void {
    try {
      const numberFieldType = this.config?.fieldType?.number || 'text';
      const cvvFieldType = this.config?.fieldType?.cvv || 'text';
      window.Spreedly.setFieldType('number', numberFieldType);
      window.Spreedly.setFieldType('cvv', cvvFieldType);

      const numberFormat = this.config?.numberFormat || 'prettyFormat';
      window.Spreedly.setNumberFormat(numberFormat);

      for (const field of ['number', 'cvv'] as const) {
        window.Spreedly.setLabel(field, mount.labels[field]);
        window.Spreedly.setTitle(field, mount.titles[field]);
        window.Spreedly.setPlaceholder(field, mount.placeholders[field]);
      }

      window.Spreedly.setStyle(
        'number',
        this.config?.styles?.number || DEFAULT_FIELD_STYLE
      );
      window.Spreedly.setStyle(
        'cvv',
        this.config?.styles?.cvv || DEFAULT_FIELD_STYLE
      );
      if (this.config?.styles?.placeholder) {
        window.Spreedly.setStyle('placeholder', this.config.styles.placeholder);
      }

      const numberRequired = this.config?.requiredAttributes?.number !== false;
      const cvvRequired = this.config?.requiredAttributes?.cvv !== false;
      if (numberRequired) window.Spreedly.setRequiredAttribute('number');
      if (cvvRequired) window.Spreedly.setRequiredAttribute('cvv');

      if (this.config?.enableAutoComplete === false) {
        window.Spreedly.toggleAutoComplete();
      }
      if (this.config?.allowBlankName) {
        window.Spreedly.setParam('allow_blank_name', true);
      }
      if (this.config?.allowExpiredDate) {
        window.Spreedly.setParam('allow_expired_date', true);
      }

      this.logger.debug('Spreedly configuration applied:', {
        fieldType: { number: numberFieldType, cvv: cvvFieldType },
        numberFormat,
        requiredAttributes: { number: numberRequired, cvv: cvvRequired },
        autoComplete: this.config?.enableAutoComplete,
        validationParams: {
          allowBlankName: this.config?.allowBlankName,
          allowExpiredDate: this.config?.allowExpiredDate,
        },
      });
    } catch (error) {
      this.logger.error('Error applying Spreedly configuration:', error);
    }
  }
}
