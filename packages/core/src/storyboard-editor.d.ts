import type {Tour, TargetMetadata} from './index.js';
export interface StoryboardEditorOptions {
  root: HTMLElement;
  editor: HTMLTextAreaElement;
  getTargets(): ReadonlyArray<TargetMetadata>;
  /** Synchronously replace the host's canonical JSON and invalidate any playback review. */
  write(script: Tour): void;
  /** Pause playback and invalidate review as soon as uncommitted fields change. */
  onDirty(): void;
}
export interface StoryboardEditor {
  readonly pending: boolean;
  importCurrent(): boolean;
  invalidate(): void;
  destroy(): void;
}
/** Mount native, text-only storyboard controls in an empty root outside the raw JSON textarea. */
export function mountStoryboard(options: StoryboardEditorOptions): StoryboardEditor;
