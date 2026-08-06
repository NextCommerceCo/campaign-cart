import { CallbackType, CallbackData, EventMap } from '../../types/global';
import { EventBus } from '../events';
import { Logger } from '../logger';
export interface NextCommerceEventsContext {
    eventBus: EventBus;
    callbacks: Map<CallbackType, Set<Function>>;
    logger: Logger;
}
export declare function on<K extends keyof EventMap>(ctx: NextCommerceEventsContext, event: K, handler: (data: EventMap[K]) => void): void;
export declare function off<K extends keyof EventMap>(ctx: NextCommerceEventsContext, event: K, handler: Function): void;
export declare function registerCallback(ctx: NextCommerceEventsContext, type: CallbackType, callback: (data: CallbackData) => void): void;
export declare function unregisterCallback(ctx: NextCommerceEventsContext, type: CallbackType, callback: Function): void;
export declare function triggerCallback(ctx: NextCommerceEventsContext, type: CallbackType, data: CallbackData): void;
//# sourceMappingURL=next-commerce.events.d.ts.map