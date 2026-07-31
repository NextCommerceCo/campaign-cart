import { Logger } from '../../../core/logger';
import { TooltipConfig } from './tooltip.types';
export declare function getTooltipContent(element: HTMLElement): string;
export interface CreateTooltipCallbacks {
    onTooltipMouseEnter: () => void;
    onTooltipMouseLeave: () => void;
}
export interface CreatedTooltip {
    tooltip: HTMLElement;
    arrow: HTMLElement;
}
export declare function createTooltip(content: string, config: TooltipConfig, callbacks: CreateTooltipCallbacks): CreatedTooltip;
export declare function updateTooltipContent(tooltip: HTMLElement | null, content: string): void;
export interface MountTooltipParams {
    tooltip: HTMLElement;
    element: HTMLElement;
    logger: Logger;
}
export declare function mountTooltip({ tooltip, element, logger, }: MountTooltipParams): void;
export declare function revealTooltip(tooltip: HTMLElement | null): void;
export declare function dismissTooltip(tooltip: HTMLElement, onDismissed: () => void): number;
export declare function removeTooltipNow(tooltip: HTMLElement): void;
export interface PositionTooltipParams {
    tooltip: HTMLElement | null;
    arrow: HTMLElement | null;
    element: HTMLElement;
    config: TooltipConfig;
    logger: Logger;
    onError: (error: unknown, context: string) => void;
}
export declare function positionTooltip({ tooltip, arrow, element, config, logger, onError, }: PositionTooltipParams): Promise<void>;
//# sourceMappingURL=tooltip.renderer.d.ts.map