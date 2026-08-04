/**
 * Gate for `core/sdk-initializer` — re-exports only, no logic.
 *
 * Exists so `@/core/sdk-initializer` keeps resolving now that the family lives in a folder
 * rather than as loose files in `core/`. Import the folder, not the inner file.
 */
export * from './sdk-initializer';
