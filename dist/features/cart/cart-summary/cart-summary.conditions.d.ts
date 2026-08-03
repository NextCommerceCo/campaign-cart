import { LocalContext } from './cart-summary.condition-context';
export { buildItemContext, buildDiscountContext, } from './cart-summary.condition-context';
export type { ItemContext, DiscountContext, LocalContext, } from './cart-summary.condition-context';
type EvalResult = {
    handled: true;
    visible: boolean;
} | {
    handled: false;
};
export declare function evaluateLocalCondition(parsed: unknown, ctx: LocalContext): EvalResult;
export declare function applyLocalConditions(rootEl: Element, ctx: LocalContext, warn?: (msg: string) => void): boolean;
//# sourceMappingURL=cart-summary.conditions.d.ts.map