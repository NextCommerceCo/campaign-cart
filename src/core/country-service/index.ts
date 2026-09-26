/**
 * Gate for `core/country-service` — re-exports only, no logic.
 *
 * Exists so `@/core/country-service` keeps resolving now that the family lives in a folder
 * rather than as loose files in `core/`. Import the folder, not the inner file.
 */
export * from './country-service';
export * from './country-service.phone';
export { flagUrl, readCountryRules } from './country-service.next-address';
export { asksForPostcode } from './country-service.postal-code';
export {
  baseLang,
  pageTranslations,
  sourceIn,
  translatedText,
  type MessageSource,
} from './country-service.translations';
export type {
  CountryRules,
  FixedValues,
  RulesField,
} from './country-service.next-address';
