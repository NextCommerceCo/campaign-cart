/**
 * Gate for `core/attribute-scanner` — re-exports only, no logic.
 *
 * Exists so `@/core/attribute-scanner` keeps resolving now that the family lives in a folder
 * rather than as loose files in `core/`. Import the folder, not the inner file.
 */
export * from './attribute-scanner';
