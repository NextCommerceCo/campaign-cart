import { ExitIntentPopupContext, ExitIntentPopupElements } from './simple-exit-intent.types';
export declare function createTemplatePopup(ctx: ExitIntentPopupContext): ExitIntentPopupElements;
export declare function processTemplateActions(templateElement: HTMLElement, ctx: ExitIntentPopupContext): void;
export declare function createImagePopup(ctx: ExitIntentPopupContext): ExitIntentPopupElements;
export declare function hidePopupElements(elements: {
    popupElement: HTMLElement | null;
    overlayElement: HTMLElement | null;
}, live: {
    getPopupElement: () => HTMLElement | null;
    getOverlayElement: () => HTMLElement | null;
}, onCleared: {
    popup: () => void;
    overlay: () => void;
}): void;
//# sourceMappingURL=simple-exit-intent.renderer.d.ts.map