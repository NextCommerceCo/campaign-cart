export interface FixtureExample {
    title: string;
    html: string;
    fixture: string;
    spec?: string;
}
export declare function extractFixtureExample(fixture: string, repoRoot: string): FixtureExample | undefined;
//# sourceMappingURL=extract-fixture-example.d.ts.map