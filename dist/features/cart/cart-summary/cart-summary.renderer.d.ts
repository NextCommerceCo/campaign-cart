import { CartState } from '../../../types/global';
import { CartSummary } from '../../../types/api';
import { SummaryFlags, TemplateVars } from './cart-summary.types';
export { renderListContainers, renderLines, buildLineElement, renderDiscountList, clearListItems, renderDiscountItem, renderSummaryLine, } from './cart-summary.line-renderer';
export declare function buildFlags(state: CartState): SummaryFlags;
export declare function buildVars(state: CartState, flags: SummaryFlags, itemCount: number, currency: string): TemplateVars;
export declare function buildDefaultTemplate(vars: TemplateVars, flags: SummaryFlags): string;
export declare function updateStateClasses(element: HTMLElement, flags: SummaryFlags): void;
export declare function renderDefault(element: HTMLElement, vars: TemplateVars, flags: SummaryFlags): void;
export declare function renderCustom(element: HTMLElement, template: string, vars: TemplateVars, summary: CartSummary | undefined, warn?: (msg: string) => void): void;
//# sourceMappingURL=cart-summary.renderer.d.ts.map