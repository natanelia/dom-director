import type {Result, Tour} from './index.js';
export const STORYBOARD_VERSION: 1;
export interface StoryboardScene {
  readonly id: string;
  readonly title: string;
  readonly target: string;
  readonly description: string;
  readonly durationMs: number;
  readonly transitionMs: number;
  readonly maxScale: number;
  readonly cursor: boolean;
}
export interface Storyboard {
  readonly version: 1;
  readonly id: string;
  readonly title: string;
  readonly locale: string;
  readonly scenes: ReadonlyArray<StoryboardScene>;
}
/** Pure, bounded linear Watch tour generation; no host discovery, audio generation or grants. */
export function compileStoryboard(input: unknown): Result<Tour>;
/** Refuses any input whose canonical fields would change during round-trip. */
export function readStoryboard(input: unknown): Result<Storyboard>;
