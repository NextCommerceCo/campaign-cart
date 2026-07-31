import { EventMap } from '../../types/global';
export type CoreReferencePage = 'boot-sequence' | 'storage-keys' | 'meta-tags' | 'url-parameters' | 'logs' | 'errors' | 'analytics-events' | 'analytics-providers' | 'javascript-api' | 'window-surface';
export type AuthorSurface = 'configured' | 'called' | 'subscribed' | 'observed' | 'debug-only';
export interface CoreSubsystem {
    id: string;
    title: string;
    summary: string;
    sources: string[];
    howAuthorsReachIt: AuthorSurface[];
    reference?: CoreReferencePage[];
    emits?: (keyof EventMap)[];
    cautions?: string[];
    contributorOnly?: string;
}
export declare function defineCoreSubsystem(subsystem: CoreSubsystem): CoreSubsystem;
//# sourceMappingURL=core-manifest.d.ts.map