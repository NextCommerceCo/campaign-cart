export interface BootSource {
    path: string;
    name: string;
}
export interface BootThrow {
    message: string;
    where: string;
}
export interface BootStep {
    index: number;
    name: string;
    receiver: string;
    awaited: boolean;
    guardedBy?: string;
    where: string;
    errorsEscape?: boolean;
    catchesOwnErrors?: boolean;
    throws: BootThrow[];
}
export interface BootSignal {
    kind: 'attribute' | 'class';
    target: string;
    name: string;
    value?: string;
    phase: 'boot-start' | 'display-ready' | 'boot-complete' | 'boot-failed';
    where: string;
}
export interface BootEvent {
    name: string;
    target: 'window' | 'document' | 'event-bus';
    detail: string[];
    where: string;
    sites: number;
}
export interface RetryPolicy {
    maxRetries: number;
    delays: number[];
    delayExpression: string;
    recursive: boolean;
    rethrows: boolean;
    where: string;
}
export interface BootSequence {
    steps: BootStep[];
    signals: BootSignal[];
    events: BootEvent[];
    retry: RetryPolicy;
    reentryGuarded: boolean;
    methods: string[];
}
//# sourceMappingURL=extract-boot-sequence-types.d.ts.map