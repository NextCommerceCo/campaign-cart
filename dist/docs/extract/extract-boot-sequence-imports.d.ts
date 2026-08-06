import { default as ts } from 'typescript';
import { BootSource } from './extract-boot-sequence-types';
export interface ImportedStep {
    name: string;
    fn: ts.FunctionDeclaration;
    sf: ts.SourceFile;
    fileName: string;
}
export declare function resolveImportedCall(callee: ts.LeftHandSideExpression, sf: ts.SourceFile, source: BootSource): ImportedStep | undefined;
//# sourceMappingURL=extract-boot-sequence-imports.d.ts.map