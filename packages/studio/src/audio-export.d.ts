import type {AudioAsset, DeepReadonly, VoiceClip} from './index.js';
import type {MediaBank} from './media.js';
export interface VoiceMixOptions {
  range?: {startMs: number; endMs: number} | null;
  sampleRate?: 44100 | 48000;
  channels?: 1 | 2;
}
export interface VoiceMixPlan {
  readonly startMs: number; readonly endMs: number; readonly durationMs: number;
  readonly sampleRate: 44100 | 48000; readonly channels: 1 | 2;
  readonly frames: number; readonly bytes: number;
  readonly clips: ReadonlyArray<DeepReadonly<VoiceClip> & {readonly skipMs: number; readonly atMs: number; readonly lengthMs: number}>;
  readonly assets: ReadonlyArray<DeepReadonly<AudioAsset>>;
}
export interface VoiceMixProgress {stage: 'loading' | 'rendering' | 'encoding'; completed: number; total: number;}
export interface VoiceMixResult {
  wav: ArrayBuffer; mime: 'audio/wav'; sampleRate: 44100 | 48000; channels: 1 | 2;
  durationMs: number; frames: number; peak: number; clippedSamples: number; clipCount: number;
}
/** Pure planning. At most five minutes; no asset loading or project mutations. */
export function planVoiceMix(input: unknown, options?: VoiceMixOptions): VoiceMixPlan;
/** PCM16 WAV. Cancellation discards unabortable offline browser rendering. */
export function renderVoiceMix(input: unknown, bank: Pick<MediaBank, 'load'>, options?: VoiceMixOptions & {
  signal?: AbortSignal; onProgress?: (progress: VoiceMixProgress) => void;
  contextFactory?: (channels: number, frames: number, sampleRate: number) => OfflineAudioContext;
}): Promise<VoiceMixResult>;
