import { AttributionState } from '../../state/attribution.state';
export declare class AttributionCollector {
    collect(): Promise<AttributionState>;
    private collectMetadata;
    private limitSubaffiliateLength;
    private getStoredValue;
    private getCookie;
    private getDeviceType;
    private getFunnelName;
    private handleEverflowClickId;
    private collectTrackingTags;
    private getFacebookPixelId;
    private getFirstVisitTimestamp;
}
//# sourceMappingURL=attribution-collector.d.ts.map