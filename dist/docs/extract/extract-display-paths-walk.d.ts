import { default as ts } from 'typescript';
export declare const RESOLVER = "getPropertyValue";
export declare const SEEDS: string[];
export interface Callable {
    node: ts.FunctionLikeDeclaration;
    sf: ts.SourceFile;
    file: string;
    symbol: string;
    ownMethod: boolean;
}
export interface WalkContext {
    namespace: string;
    index: Map<string, Callable>;
    visited: Set<string>;
    names: string[];
    dataFallback?: string;
}
export declare function walkResolver(ctx: WalkContext, entry: Callable, carriers: Set<string>, prefix: string): void;
//# sourceMappingURL=extract-display-paths-walk.d.ts.map