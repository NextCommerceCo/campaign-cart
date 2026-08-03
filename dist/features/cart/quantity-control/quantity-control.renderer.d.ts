import { QuantityAction, QuantityConstraints } from './quantity-control.types';
export declare function renderButtonState(element: HTMLElement, action: QuantityAction, currentQuantity: number, constraints: QuantityConstraints): void;
export declare function renderInputValue(element: HTMLInputElement | HTMLSelectElement, quantity: number): void;
export declare function renderCartClasses(element: HTMLElement, isInCart: boolean): void;
export declare function renderQuantityData(element: HTMLElement, quantity: number, isInCart: boolean): void;
export declare function renderButtonContent(element: HTMLElement, currentQuantity: number, step: number): void;
//# sourceMappingURL=quantity-control.renderer.d.ts.map