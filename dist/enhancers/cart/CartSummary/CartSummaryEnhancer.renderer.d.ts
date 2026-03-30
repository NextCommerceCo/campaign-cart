import { CartState } from '../../../types/global';
import { CartSummary, SummaryLine } from '../../../types/api';
import { DiscountItem, SummaryFlags, TemplateVars } from './CartSummaryEnhancer.types';
export declare function buildFlags(state: CartState): SummaryFlags;
export declare function buildVars(state: CartState, flags: SummaryFlags, itemCount: number): TemplateVars;
export declare function buildDefaultTemplate(vars: TemplateVars, flags: SummaryFlags): string;
export declare function updateStateClasses(element: HTMLElement, flags: SummaryFlags): void;
export declare function renderDefault(element: HTMLElement, vars: TemplateVars, flags: SummaryFlags): void;
export declare function renderCustom(element: HTMLElement, template: string, vars: TemplateVars, summary: CartSummary | undefined): void;
export declare function renderListContainers(element: HTMLElement, summary: CartSummary | undefined): void;
export declare function renderLines(element: HTMLElement, summary: CartSummary | undefined): void;
export declare function buildLineElement(template: string, line: SummaryLine): Element;
export declare function renderDiscountList(element: HTMLElement, selector: string, items: DiscountItem[]): void;
export declare function clearListItems(container: HTMLElement): void;
export declare function renderDiscountItem(template: string, discount: DiscountItem): string;
export declare function renderSummaryLine(template: string, line: SummaryLine): string;
//# sourceMappingURL=CartSummaryEnhancer.renderer.d.ts.map