import { EventMap } from '../../types/global';
export type FeatureStatus = 'core' | 'optional' | 'deprecated';
export type FeatureCategory = 'cart' | 'checkout' | 'display' | 'order' | 'ui' | 'behavior';
export interface AttributeValue {
    value: string;
    description: string;
}
export interface AttributeDoc {
    name: string;
    group?: string;
    type: string;
    required?: boolean;
    default?: string;
    description?: string;
    values?: AttributeValue[] | string;
    notes?: string;
}
export interface WrittenDoc {
    name: string;
    description: string;
    values?: string;
    notes?: string;
}
export interface ErrorDoc {
    message: string;
    kind: 'recoverable' | 'fatal';
    cause: string;
    fix: string;
    fromApi?: boolean;
}
export interface FeatureConflict {
    feature: string;
    mode?: string;
    because: string;
}
export interface FeatureLink {
    feature: string;
    mode?: string;
    because: string;
    caution?: string;
}
export interface ExternalDependency {
    name: string;
    because: string;
}
export type ReferenceOwner = 'generated' | 'hand-written';
export interface FeatureManifest {
    id: string;
    category: FeatureCategory;
    status: FeatureStatus;
    reference?: ReferenceOwner;
    pages?: {
        logs?: ReferenceOwner;
        errors?: ReferenceOwner;
        relations?: ReferenceOwner;
        getStarted?: ReferenceOwner;
    };
    summary: string;
    activates?: string;
    alsoActivates?: string[];
    activatedByApi?: string;
    logPrefix: string;
    extraSource?: string[];
    displayNamespace?: string;
    displayFallback?: DisplayFallback[];
    displayUnanswered?: UnansweredPath[];
    displayPaths?: DisplayPathsDoc;
    additionalDisplayNamespaces?: AdditionalDisplayNamespace[];
    attributes: AttributeDoc[];
    readsElsewhere?: WrittenDoc[];
    sets?: WrittenDoc[];
    classes?: WrittenDoc[];
    tokens?: WrittenDoc[];
    emits: (keyof EventMap)[];
    errors?: ErrorDoc[];
    apiExample?: string;
    dependsOn?: FeatureLink[];
    pairsWith?: FeatureLink[];
    requires?: ExternalDependency[];
    conflicts?: FeatureConflict[];
    sections?: FeatureSection[];
}
export interface FeatureSection {
    title: string;
    body: string;
}
export interface DisplayPathDoc {
    name: string;
    group?: string;
    description: string;
}
export interface DisplayFallback {
    mappedPrefix?: string;
    shape: string;
}
export interface UnansweredPath {
    name: string;
    instead: string;
}
export interface DisplayPathsDoc {
    prefix: string;
    intro?: string;
    example?: string;
    paths: DisplayPathDoc[];
    footer?: string;
    cautions?: string[];
}
export interface AdditionalDisplayNamespace {
    namespace: string;
    displayFallback?: DisplayFallback[];
    displayUnanswered?: UnansweredPath[];
    displayPaths?: DisplayPathsDoc;
}
export declare function defineFeature(manifest: FeatureManifest): FeatureManifest;
//# sourceMappingURL=feature-manifest.d.ts.map