export interface DeclaredShape {
    fields: Map<string, string | undefined>;
    extends: string[];
    open: boolean;
    where: string;
}
export declare function readDeclaredShapes(files: Array<[string, string]>): Map<string, DeclaredShape>;
export declare function declaresPath(shapes: Map<string, DeclaredShape>, shapeName: string, path: string): boolean;
//# sourceMappingURL=type-shape.d.ts.map