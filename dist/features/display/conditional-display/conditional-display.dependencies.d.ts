import { Logger } from '../../../core/logger';
export interface ConditionDependencies {
    dependsOnCart: boolean;
    dependsOnPackage: boolean;
    dependsOnSelection: boolean;
    dependsOnOrder: boolean;
    dependsOnShipping: boolean;
    dependsOnParams: boolean;
}
export declare function analyzeDependencies(condition: any, logger: Logger): ConditionDependencies;
export declare function conditionDependsOnCart(condition: any): boolean;
export declare function conditionDependsOnPackage(condition: any): boolean;
export declare function conditionDependsOnSelection(condition: any): boolean;
export declare function conditionDependsOnOrder(condition: any): boolean;
export declare function conditionDependsOnShipping(condition: any): boolean;
export declare function conditionDependsOnParams(condition: any, logger: Logger): boolean;
//# sourceMappingURL=conditional-display.dependencies.d.ts.map