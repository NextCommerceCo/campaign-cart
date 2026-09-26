import { I18nTarget } from '../../../utils/i18n-spec';
export type Originals = Map<string, string | null>;
export declare function canHoldText(element: Element): boolean;
export declare function readOriginals(element: Element, targets: readonly I18nTarget[]): Originals;
export declare function applyTranslations(element: Element, targets: readonly I18nTarget[], originals: Originals, translate: (key: string) => string | undefined): void;
//# sourceMappingURL=i18n.renderer.d.ts.map