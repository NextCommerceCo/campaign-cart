import { EventMap } from '../../types/global';
export type FieldKind = 'persisted' | 'computed' | 'transient';
export interface StateField {
    name: string;
    kind: FieldKind;
    description: string;
    notes?: string;
}
export interface StateOperation {
    name: string;
    effect: string;
    deprecated?: string;
}
export interface StatePersistence {
    mechanism: 'zustand-persist' | 'manual' | 'none';
    key?: string;
    expiry?: string;
    newFieldRule: string;
}
export interface StateManifest {
    id: string;
    storeHook: string;
    stateInterface: string;
    interfaceFile: string;
    storeFile?: string;
    summary: string;
    persistence: StatePersistence;
    fields: StateField[];
    operations?: StateOperation[];
    setters?: StateOperation[];
    selectors?: StateOperation[];
    emits?: (keyof EventMap)[];
    example?: string;
    cautions?: string[];
}
export declare function defineStore(manifest: StateManifest): StateManifest;
//# sourceMappingURL=state-manifest.d.ts.map