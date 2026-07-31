import { BaseEnhancer } from '../../../core/base/base-enhancer';
export declare class TimerEnhancer extends BaseEnhancer {
    private duration;
    private persistenceId;
    private format;
    private interval?;
    private startTime;
    initialize(): Promise<void>;
    update(): void;
    private loadStartTime;
    private startTimer;
    private updateDisplay;
    private formatTime;
    private handleTimerExpired;
    destroy(): void;
}
//# sourceMappingURL=timer.enhancer.d.ts.map