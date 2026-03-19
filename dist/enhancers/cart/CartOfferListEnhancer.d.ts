import { BaseEnhancer } from '../base/BaseEnhancer';
export declare class CartOfferListEnhancer extends BaseEnhancer {
    private template?;
    private replaceCart;
    private filterCriteria;
    private cards;
    private selectedCard;
    private clickHandlers;
    initialize(): Promise<void>;
    private render;
    private applyFilter;
    private renderTemplate;
    private scanCards;
    private registerCard;
    private handleCardClick;
    private selectCard;
    private applyOffer;
    update(): void;
    protected cleanupEventListeners(): void;
    destroy(): void;
}
//# sourceMappingURL=CartOfferListEnhancer.d.ts.map