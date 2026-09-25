import { BaseEnhancer } from '@/core/base/base-enhancer';
import {
  addressLang,
  CountryService,
  translatedText,
} from '@/core/country-service';
import { parseI18n, type I18nTarget } from '@/utils/i18n-spec';

import {
  applyTranslations,
  canHoldText,
  readOriginals,
  type Originals,
} from './i18n.renderer';

/**
 * `data-next-i18n`: an element's text and attributes, translated by key into the page's
 * language, from the page's `translations` and then the address-rules service's texts.
 */
export class I18nEnhancer extends BaseEnhancer {
  private targets: I18nTarget[] = [];
  private originals: Originals = new Map();

  public async initialize(): Promise<void> {
    this.validateElement();
    const { targets, refused } = parseI18n(
      this.getAttribute('data-next-i18n') ?? ''
    );
    for (const attribute of refused) {
      this.logger.warn(
        `data-next-i18n cannot translate [${attribute}]; it translates the text, [placeholder], [aria-label], [title] and [alt]`
      );
    }
    if (targets.some(t => t.attribute === null) && !canHoldText(this.element)) {
      this.logger.warn(
        'data-next-i18n leaves the text of an element with child elements alone; put the text in an element of its own'
      );
    }
    this.targets = targets;
    this.originals = readOriginals(this.element, targets);

    this.update();
    // Translated before the service's texts arrived, or before a language switch.
    this.on('address:messages-loaded', () => this.update());
    document.addEventListener('next:locale-changed', this.handleLocaleChange);
  }

  public override destroy(): void {
    super.destroy();
    document.removeEventListener(
      'next:locale-changed',
      this.handleLocaleChange
    );
  }

  private readonly handleLocaleChange = (): void => this.update();

  public update(): void {
    const lang = addressLang();
    const service = CountryService.getInstance();
    const texts = service.getTexts(lang);
    applyTranslations(this.element, this.targets, this.originals, key =>
      translatedText(key, lang, texts)
    );
    // A language chosen after boot has no texts yet; this repaints when they land.
    if (!texts) void service.loadTexts(lang);
  }
}
