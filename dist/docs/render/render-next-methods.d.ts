import { CartOperationDoc, NextMethodDoc, NextMethodGroup, WindowAudience, WindowGlobalDoc } from '../content/next-methods';
export interface RenderedMember {
    name: string;
    kind: 'method' | 'getter' | 'property';
    isStatic: boolean;
    signature: string;
    line: number;
}
export interface RenderedCallable {
    name: string;
    signature: string;
}
export interface RenderedGlobal {
    name: string;
    keys: string[];
    sites: string[];
}
export interface JavaScriptApiInput {
    groups: NextMethodGroup[];
    methods: NextMethodDoc[];
    members: RenderedMember[];
    cartOperations: CartOperationDoc[];
    cartSignatures: RenderedCallable[];
}
export declare function renderJavaScriptApi(input: JavaScriptApiInput): string;
export interface WindowSurfaceInput {
    groups: Array<{
        audience: WindowAudience;
        title: string;
        intro: string;
    }>;
    globals: WindowGlobalDoc[];
    installs: RenderedGlobal[];
    reads: Array<{
        name: string;
        sites: string[];
    }>;
}
export declare function renderWindowSurface(input: WindowSurfaceInput): string;
//# sourceMappingURL=render-next-methods.d.ts.map