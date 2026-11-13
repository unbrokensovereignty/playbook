// Types for tools/floor.mjs, which tests/unit/minimaps.test.ts uses.
export const FLOOR_SIZE: number;
/** The floor of one minimap, as base64 bits. */
export function floorOf(file: string): Promise<string>;
/** The text of src/core/kb/floor.gen.ts, read from assets/minimaps. */
export function floorFile(): Promise<string>;
