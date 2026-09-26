import { BaseEnhancer } from '../../../core/base/base-enhancer';
export declare class I18nEnhancer extends BaseEnhancer {
    private targets;
    private originals;
    initialize(): Promise<void>;
    destroy(): void;
    private readonly handleLocaleChange;
    update(): void;
}
//# sourceMappingURL=i18n.enhancer.d.ts.map