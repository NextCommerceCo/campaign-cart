/**
 * Gate for `core/country-service` — re-exports only, no logic.
 *
 * Exists so `@/core/country-service` keeps resolving now that the family lives in a folder
 * rather than as loose files in `core/`. Import the folder, not the inner file.
 */
export * from './country-service';
