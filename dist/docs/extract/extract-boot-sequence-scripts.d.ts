import { default as ts } from 'typescript';
export interface Scope {
    sf: ts.SourceFile;
    name: string;
    fallbackSymbol?: string;
    allowFrom?: Set<string>;
}
export declare function nestedScripts(scope: Scope): Scope[];
//# sourceMappingURL=extract-boot-sequence-scripts.d.ts.map