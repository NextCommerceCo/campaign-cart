import { default as ts } from 'typescript';
import { BootThrow } from './extract-boot-sequence-types';
export type StepFunction = ts.MethodDeclaration | ts.FunctionDeclaration;
export declare function errorsEscape(method: StepFunction): boolean;
export declare function catchesOwnErrors(method: StepFunction): boolean;
export declare function throwsIn(method: StepFunction, sf: ts.SourceFile, name: string): BootThrow[];
//# sourceMappingURL=extract-boot-sequence-step-analysis.d.ts.map