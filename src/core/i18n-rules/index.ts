/**
 * Gate for `core/i18n-rules` — re-exports only, no logic.
 *
 * Exists so `@/core/i18n-rules` keeps resolving now that the family lives in a folder
 * rather than as loose files in `core/`. Import the folder, not the inner file.
 */
export * from './i18n-rules';
export * from './i18n-rules.phone';
export { flagUrl, readCountryRules } from './i18n-rules.api';
export { asksForPostcode } from './i18n-rules.postal-code';
export {
  baseLang,
  interpolate,
  pageTranslations,
  sourceIn,
  textsWithin,
  translatedText,
  type MessageSource,
  type TextSource,
} from './i18n-rules.translations';
export type {
  CountryRules,
  FixedValues,
  PostcodeResult,
  RulesField,
} from './i18n-rules.api';
