import { default as ts } from 'typescript';
import { BootSource } from './extract-boot-sequence-types';
export declare function parse(source: BootSource): ts.SourceFile;
export declare function at(sf: ts.SourceFile, node: ts.Node, name: string, fallbackSymbol?: string): string;
export declare function enclosingMethod(node: ts.Node): string | undefined;
export declare function literal(node: ts.Node | undefined): string | undefined;
export declare function findClass(sf: ts.SourceFile, name: string): ts.ClassDeclaration;
export declare function methodsOf(cls: ts.ClassDeclaration): Map<string, ts.MethodDeclaration>;
export declare function staticValue(cls: ts.ClassDeclaration, name: string): string | undefined;
//# sourceMappingURL=extract-boot-sequence-ast-helpers.d.ts.map