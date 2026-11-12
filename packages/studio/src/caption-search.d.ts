import type {Project, DeepReadonly} from './index.js';
import type {TimingLinkDescription} from './timing-links.js';
export interface CaptionSearchOptions {
  query: string;
  matchCase?: boolean;
  /** Omitted means the active language track; null means all caption tracks, including hidden ones. */
  trackId?: string | null;
}
export interface CaptionMatch {
  readonly clipId: string;
  readonly trackId: string;
  readonly trackName: string;
  readonly sceneId: string;
  readonly sceneTitle: string;
  readonly projectTimeMs: number;
  readonly text: string;
  readonly locked: boolean;
  readonly enabled: boolean;
  readonly wordCount: number;
  /** Half-open UTF-16 offsets in text, for String.slice. */
  readonly ranges: ReadonlyArray<{readonly start: number; readonly end: number}>;
}
export interface CaptionSearchResult {
  readonly matches: number;
  readonly captions: ReadonlyArray<CaptionMatch>;
}
export interface CaptionReplacementOptions extends CaptionSearchOptions {
  replacement: string;
  /** Omitted selects all matching captions. Supplied IDs must be unique and match the same query/scope. */
  clipIds?: ReadonlyArray<string>;
}
export interface CaptionTextChange {
  readonly clipId: string;
  readonly trackId: string;
  readonly trackName: string;
  readonly sceneId: string;
  readonly sceneTitle: string;
  readonly projectTimeMs: number;
  readonly before: string;
  readonly after: string;
  readonly replacements: number;
  readonly clearedWordTimings: number;
}
export interface CaptionReplacement {
  readonly value: Project;
  readonly changes: ReadonlyArray<CaptionTextChange>;
  readonly detachedLinks: ReadonlyArray<DeepReadonly<TimingLinkDescription>>;
  readonly replacements: number;
}
/** Pure bounded search; throws on invalid options or more than 5000 matches. No DOM or media access. */
export function findCaptionMatches(input: unknown, options: CaptionSearchOptions): CaptionSearchResult;
/** Returns a frozen proposal; the host must review and commit it with a revision lease. */
export function proposeCaptionReplacement(input: unknown, options: CaptionReplacementOptions): CaptionReplacement;
