import { CartState } from '../../../types/global';
import { ConditionalDisplayContext } from './conditional-display.types';
export declare function evaluateCondition(ctx: ConditionalDisplayContext, cartState: CartState): boolean;
export declare function evaluateLogicalCondition(ctx: ConditionalDisplayContext, cartState: CartState, condition: any): boolean;
export declare function evaluateConditionRecursive(ctx: ConditionalDisplayContext, cartState: CartState, condition: any): boolean;
export declare function evaluateProperty(ctx: ConditionalDisplayContext, cartState: CartState, condition: any): boolean;
export declare function evaluateFunction(ctx: ConditionalDisplayContext, cartState: CartState, condition: any): boolean;
export declare function normalizeCouponCode(value: unknown): string;
export declare function evaluateComparison(ctx: ConditionalDisplayContext, cartState: CartState, condition: any): boolean;
//# sourceMappingURL=conditional-display.conditions.d.ts.map