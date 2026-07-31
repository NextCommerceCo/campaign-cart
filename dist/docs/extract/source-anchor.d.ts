import { default as ts } from 'typescript';
export declare const MODULE_SCOPE = "<module>";
export interface Enclosing {
    name: string;
    params: string[];
}
export declare function functionName(node: ts.Node, sf: ts.SourceFile): string | undefined;
export declare function enclosingFunction(node: ts.Node, sf: ts.SourceFile): Enclosing;
export declare function anchorOf(sf: ts.SourceFile, node: ts.Node, file: string): string;
export declare function anchor(file: string, symbol: string): string;
export declare function fileOf(value: string): string;
//# sourceMappingURL=source-anchor.d.ts.map