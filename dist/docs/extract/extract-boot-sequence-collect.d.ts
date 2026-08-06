import { default as ts } from 'typescript';
import { Scope } from './extract-boot-sequence-scripts';
import { BootEvent, BootSignal, BootSource, BootStep, RetryPolicy } from './extract-boot-sequence-types';
export declare function collectSteps(tryBlock: ts.Block, sf: ts.SourceFile, source: BootSource, methods: Map<string, ts.MethodDeclaration>): BootStep[];
export declare function collectSignals(initialize: ts.MethodDeclaration, tryStatement: ts.TryStatement, sf: ts.SourceFile, source: BootSource): BootSignal[];
export declare function collectClassSignals(source: BootSource): BootSignal[];
export declare function collectEvents(scopes: Scope[]): BootEvent[];
export declare function readRetryPolicy(cls: ts.ClassDeclaration, tryStatement: ts.TryStatement, sf: ts.SourceFile, source: BootSource): RetryPolicy;
//# sourceMappingURL=extract-boot-sequence-collect.d.ts.map