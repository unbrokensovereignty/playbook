// Types for tools/frame.mjs, which tests/unit/banners.test.ts uses.
import type { Sharp } from 'sharp';

export interface Frame { top: number; bottom: number; left: number; right: number; width: number; height: number }
export function frameOf(file: string | Buffer): Promise<Frame>;
export function withoutFrame(file: string | Buffer): Promise<Sharp>;
