export interface NextMethodGroup {
    id: string;
    title: string;
    intro: string;
}
export interface NextMethodDoc {
    name: string;
    group: string;
    summary: string;
    example: string;
    returns?: string;
    caution?: string;
}
export interface CartOperationDoc {
    name: string;
    effect: string;
}
export type WindowAudience = 'page' | 'analytics' | 'debug' | 'qa' | 'third-party';
export interface WindowGlobalDoc {
    name: string;
    covers?: string[];
    audience: WindowAudience;
    direction: 'install' | 'read';
    summary: string;
    example?: string;
    language?: string;
    caution?: string;
}
export declare const NEXT_METHOD_GROUPS: NextMethodGroup[];
export declare const NEXT_METHODS: NextMethodDoc[];
export declare const NEXT_CART_OPERATIONS: CartOperationDoc[];
export declare const WINDOW_GROUPS: Array<{
    audience: WindowAudience;
    title: string;
    intro: string;
}>;
export declare const WINDOW_GLOBALS: WindowGlobalDoc[];
//# sourceMappingURL=next-methods.d.ts.map