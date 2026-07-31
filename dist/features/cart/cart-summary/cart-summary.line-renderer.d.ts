import { CartSummary, SummaryLine } from '../../../types/api';
import { DiscountItem } from './cart-summary.types';
export declare function renderListContainers(element: HTMLElement, summary: CartSummary | undefined, warn?: (msg: string) => void): void;
export declare function renderLines(element: HTMLElement, summary: CartSummary | undefined, warn?: (msg: string) => void): void;
export declare function buildLineElement(template: string, line: SummaryLine, warn?: (msg: string) => void): Element | null;
export declare function renderDiscountList(element: HTMLElement, selector: string, items: DiscountItem[], warn?: (msg: string) => void): void;
export declare function clearListItems(container: HTMLElement): void;
export declare function renderDiscountItem(template: string, discount: DiscountItem): string;
export declare function renderSummaryLine(template: string, line: SummaryLine): string;
//# sourceMappingURL=cart-summary.line-renderer.d.ts.map