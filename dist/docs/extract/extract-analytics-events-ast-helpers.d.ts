import { default as ts } from 'typescript';
export declare function parse(file: string): ts.SourceFile;
export declare function findVariableInitializer(sf: ts.SourceFile, name: string): ts.Expression | undefined;
export declare function unwrap(node: ts.Expression | undefined): ts.Expression | undefined;
export declare function propertyName(prop: ts.ObjectLiteralElementLike): string | undefined;
export declare function stringOf(node: ts.Node | undefined): string | undefined;
export declare function stringArray(node: ts.Expression | undefined): string[];
export declare function stringRecord(node: ts.Expression | undefined): Record<string, string>;
//# sourceMappingURL=extract-analytics-events-ast-helpers.d.ts.map