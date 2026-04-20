export interface QuantityControlsOptions {
    hostEls: HTMLElement[];
    getQty: () => number;
    setQty: (value: number) => void;
    min: number;
    max: number;
    onChange: () => void;
    handlers: Map<HTMLElement, (e: Event) => void>;
}
export declare function setupQuantityControls(opts: QuantityControlsOptions): () => void;
//# sourceMappingURL=quantityControls.d.ts.map