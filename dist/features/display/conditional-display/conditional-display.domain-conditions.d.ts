import { ConditionalDisplayContext } from './conditional-display.types';
export declare function evaluatePackageCondition(ctx: ConditionalDisplayContext): boolean;
export declare function evaluatePackageLogicalCondition(ctx: ConditionalDisplayContext, condition: any): boolean;
export declare function evaluatePackageConditionRecursive(ctx: ConditionalDisplayContext, condition: any): boolean;
export declare function evaluatePackageProperty(ctx: ConditionalDisplayContext, condition: any): boolean;
export declare function evaluatePackageComparison(ctx: ConditionalDisplayContext, condition: any): boolean;
export declare function evaluateOrderCondition(ctx: ConditionalDisplayContext, orderState: any): boolean;
export declare function evaluateOrderLogicalCondition(ctx: ConditionalDisplayContext, orderState: any, condition: any): boolean;
export declare function evaluateOrderConditionRecursive(ctx: ConditionalDisplayContext, orderState: any, condition: any): boolean;
export declare function evaluateOrderProperty(orderState: any, condition: any): boolean;
export declare function evaluateOrderComparison(orderState: any, condition: any): boolean;
//# sourceMappingURL=conditional-display.domain-conditions.d.ts.map