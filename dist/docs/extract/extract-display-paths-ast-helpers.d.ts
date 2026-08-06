import { default as ts } from 'typescript';
export declare function classesIn(sf: ts.SourceFile): ts.ClassDeclaration[];
export declare function methodNamed(cls: ts.ClassDeclaration, name: string, sf: ts.SourceFile): ts.MethodDeclaration | undefined;
export declare function descendants(node: ts.Node): ts.Node[];
export declare function keysOf(obj: ts.ObjectLiteralExpression, sf: ts.SourceFile): string[];
//# sourceMappingURL=extract-display-paths-ast-helpers.d.ts.map