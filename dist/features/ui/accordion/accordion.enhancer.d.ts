import { BaseEnhancer } from '../../../core/base/base-enhancer';
export declare class AccordionEnhancer extends BaseEnhancer {
    static selector: string;
    private accordions;
    private listenerAbort;
    initialize(): Promise<void>;
    enhance(): void;
    update(_data?: any): void;
    private parseConfig;
    private listen;
    private setupEventListeners;
    private toggleAccordion;
    private openAccordion;
    private closeAccordion;
    openAccordionById(id: string): void;
    closeAccordionById(id: string): void;
    toggleAccordionById(id: string): void;
    getAccordionState(id: string): boolean | null;
    getAllAccordions(): string[];
    protected cleanupEventListeners(): void;
    destroy(): void;
}
//# sourceMappingURL=accordion.enhancer.d.ts.map