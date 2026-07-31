import { StateManifest } from './state-manifest';
export type FieldTypes = Record<string, {
    type: string;
    nullable: boolean;
}>;
export declare function renderStateReference(manifest: StateManifest, types: FieldTypes): string;
//# sourceMappingURL=render-state-reference.d.ts.map