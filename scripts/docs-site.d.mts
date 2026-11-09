export const MAX_FILES: number;
export const HEADERS: string;
export function renderRobots(baseUrl: string | null): string;
export function render404(versions: { version: string; tag: string; path: string; current: boolean }[]): string;
export function countFiles(dir: string): number;
