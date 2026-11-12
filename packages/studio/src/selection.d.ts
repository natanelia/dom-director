import type {Project} from './index.js';

export interface SelectionBounds {
  readonly startMs:number;
  readonly endMs:number;
  readonly durationMs:number;
  readonly clipIds:ReadonlyArray<string>;
}
/** Project-time bounding range, including any gaps. Empty, duplicate and stale IDs are rejected. */
export function selectionBounds(project:Project,clipIds:ReadonlyArray<string>):SelectionBounds;
/** Caption/motion dependency closure in project order; does not edit or grant permission. */
export function includeLinkedClips(project:Project,clipIds:ReadonlyArray<string>):ReadonlyArray<string>;
/** Atomic non-ripple move within each clip's current scene. Incomplete word-link groups are refused. */
export function moveClips(project:Project,clipIds:ReadonlyArray<string>,deltaMs:number):Project;
/** New clip/key/gesture IDs and fresh IDs for copied words that already have one; internal timing links are rebound to the copied captions. */
export function duplicateClips(project:Project,clipIds:ReadonlyArray<string>,deltaMs:number):{readonly value:Project;readonly clipIds:ReadonlyArray<string>};
/** Removes all selected clips or none; unselected dependent keys are never silently detached. */
export function deleteClips(project:Project,clipIds:ReadonlyArray<string>):Project;
/** Copies effective caption/cursor styling into explicit clip overrides; other content, timing and links are preserved.
 * All destinations must match the source kind; any locked destination rejects the whole edit. The source is read-only. */
export function matchClipAppearance(project:Project,sourceId:string,clipIds:ReadonlyArray<string>):Project;
export interface VoiceMixPatch {readonly gain?:number;readonly fadeInMs?:number;readonly fadeOutMs?:number;}
/** Atomic voice-only edit. Supply at least one mix field; omitted fields keep each clip's own value.
 * Gain is linear (0–2); fades are whole milliseconds and together must fit each clip.
 * Locked tracks reject the entire edit. Audio, trims, scripts, timing and track switches are unchanged. */
export function setVoiceMix(project:Project,clipIds:ReadonlyArray<string>,changes:VoiceMixPatch):Project;
export interface SelectionSnapOptions {pixelsPerSecond:number;tolerancePx?:number;gridMs?:number;playheadMs?:number;}
/** Snap any selected edge to unselected clips/keys/words, scene boundaries or the playhead. Validate movement separately. */
export function createSelectionSnapper(project:Project,clipIds:ReadonlyArray<string>,options:SelectionSnapOptions):{
  snap(deltaMs:number,options?:{bypass?:boolean}):{deltaMs:number;guide:import('./editing.js').TimelineSnapGuide|null};
};
