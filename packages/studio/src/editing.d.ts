import type {Project,CaptionStyle,CursorStyle,CameraKey,CursorKey,AudioAsset,TrackKind,WordTimingLink,DeepReadonly} from './index.js';
export function setAppearance(project:Project,clipId:string,patch:CaptionStyle|CursorStyle,options?:{scope?:'clip'|'track'|'project';reset?:boolean}):Project;
export function applyCaptionPreset(project:Project,clipId:string,name:'clean'|'contrast'|'minimal',scope?:'clip'|'track'|'project'):Project;
export function updateKeyframe(project:Project,clipId:string,keyId:string,patch:Partial<Omit<CameraKey,'id'>>|Partial<Omit<CursorKey,'id'>>):Project;
export function addKeyframe(project:Project,clipId:string,clipTimeMs:number,patch?:Partial<Omit<CameraKey,'id'|'atMs'|'timing'>>|Partial<Omit<CursorKey,'id'|'atMs'|'timing'>>):Project;
export function deleteKeyframe(project:Project,clipId:string,keyId:string):Project;
export function addGesture(project:Project,clipId:string,clipTimeMs:number,kind?:'click'|'double-click'|'hold'):Project;
export function addScene(project:Project,options?:{afterId?:string;target?:string;title?:string;durationMs?:number}):{value:Project;sceneId:string};
/** Duplicate every track's clips after the source scene, with independent IDs/word links and shared audio assets. Locks and project limits still apply. */
export function duplicateScene(project:Project,sceneId:string):{value:Project;sceneId:string};
export function deleteScene(project:Project,sceneId:string):Project;
export function addCaption(project:Project,sceneId:string,startMs?:number):{value:Project;clipId:string};
export function proposeCaptionImport(project:Project,text:string,options?:{language?:string;name?:string}):{value:Project;trackId:string;cueCount:number;splitCount:number;warnings:string[]};
export function proposeVoiceReplacement(project:Project,clipId:string,asset:AudioAsset,options?:{fitScene?:boolean}):{value:Project;changes:unknown[];deltaMs:number};

export interface VoiceImpactLink extends Readonly<WordTimingLink> {
  readonly wordText:string;
  readonly captionText:string;
  readonly language?:string;
  readonly hidden:boolean;
}
export interface VoiceImpactPosition {
  /** Absolute project milliseconds, including translated off-window source keys. Points have equal start/end. */
  readonly startMs:number;
  readonly endMs:number;
  /** Original media or motion-source coordinates, not project milliseconds. */
  readonly sourceStartMs?:number;
  readonly sourceEndMs?:number;
  readonly visible?:boolean;
  readonly assetId?:string|null;
  readonly assetName?:string|null;
  readonly fadeInMs?:number;
  readonly fadeOutMs?:number;
  readonly link?:VoiceImpactLink;
}
export interface VoiceImpactRow {
  readonly id:string;
  readonly type:'clip'|'word'|'keyframe'|'gesture';
  readonly sceneId:string;
  readonly sceneTitle:string;
  readonly trackId:string;
  readonly trackName:string;
  readonly clipId:string;
  readonly label:string;
  readonly enabled:boolean;
  readonly language?:string;
  readonly active?:boolean;
  readonly wordIndex?:number;
  readonly entityId?:string;
  /** The proposed relationship; before/after positions also carry their own link metadata. */
  readonly link?:VoiceImpactLink;
  readonly before:VoiceImpactPosition;
  readonly after:VoiceImpactPosition;
}
export interface VoiceImpactGroup {
  readonly kind:TrackKind;
  readonly total:number;
  readonly items:ReadonlyArray<VoiceImpactRow>;
  readonly offset:number;
  readonly limit:number;
  readonly hasMore:boolean;
}
export interface VoiceReplacementImpact {
  readonly clipId:string;
  readonly scene:DeepReadonly<{id:string;title:string;before:{startMs:number;endMs:number;durationMs:number};after:{startMs:number;endMs:number;durationMs:number};deltaMs:number}>;
  readonly shiftedSceneCount:number;
  readonly total:number;
  /** Deterministic CC, Camera, Cursor, Voice pages. All affected later scenes are counted. */
  readonly groups:ReadonlyArray<VoiceImpactGroup>;
}
/**
 * Pure comparison of the validated original and proposed voice replacement, without retiming or loading audio.
 * Stable project/content/track/clip/word/key identities and link relationships must match; unrelated edits are rejected.
 * Reports changed rows plus the chosen voice clip. Only requested pages are retained, without truncating totals.
 * Defaults to 20 items per kind; limit is 1–100 and offsets are non-negative safe integers.
 * The existing store's revision and lock checks remain required before accepting the proposed project.
 */
export function describeVoiceReplacementImpact(before:Project,after:Project,clipId:string,options?:{limit?:number;offsets?:Partial<Record<TrackKind,number>>}):VoiceReplacementImpact;

/** Evenly spaced manual timing; preserves the voice and obeys caption-track locks. */
export function distributeCaptionWords(project:Project,clipId:string):Project;

export interface TimelineSnapGuide {
  readonly timeMs:number;
  readonly kind:'scene'|'clip'|'keyframe'|'playhead'|'word';
  readonly label:string;
  readonly edge:'start'|'end'|'keyframe';
}
export type TimelineSnapOptions = {
  clipId:string;
  pixelsPerSecond:number;
  tolerancePx?:number;
  gridMs?:number;
  playheadMs?:number;
  ripple?:boolean;
} & ({operation:'keyframe';keyId:string}|{operation?:'move'|'trim-start'|'trim-end';keyId?:never});
export interface TimelineSnapper {
  /** Returns a relative millisecond delta; guides use absolute project time. Bypass disables both magnets and grid. */
  snap(deltaMs:number,options?:{bypass?:boolean}):{deltaMs:number;guide:TimelineSnapGuide|null};
}
/** Snapshot anchors once per gesture; validate the proposed edit separately. Does not mutate the project. */
export function createTimelineSnapper(project:Project,options:TimelineSnapOptions):TimelineSnapper;
/** Move a visible camera/cursor key using clip-local milliseconds. Source windows and other tracks are preserved. */
export function moveTimelineKeyframe(project:Project,clipId:string,keyId:string,clipTimeMs:number):Project;

export type WordBoundary = 'start'|'end';
export interface CaptionWordAnchor {
  readonly captionId:string;
  readonly wordIndex:number;
  readonly text:string;
  readonly boundary:WordBoundary;
  readonly captionTimeMs:number;
  readonly sceneTimeMs:number;
  readonly projectTimeMs:number;
}
/** Authored words in one scene of the active, visible caption track. No speech recognition. */
export function captionWordAnchors(project:Project,sceneId:string):ReadonlyArray<CaptionWordAnchor>;
/** Stamp exactly one word boundary from absolute project time; overlaps and locked-track changes are rejected. */
export function stampCaptionWord(project:Project,captionId:string,wordIndex:number,boundary:WordBoundary,projectTimeMs:number):Project;
/** A one-time timing edit, not a persistent link. Target path, easing and voice audio are unchanged. */
export function alignKeyframeToCaptionWord(project:Project,clipId:string,keyId:string,anchor:{captionId:string;wordIndex:number;boundary?:WordBoundary}):Project;
