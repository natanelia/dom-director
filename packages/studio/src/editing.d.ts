import type {Project,CaptionStyle,CursorStyle,CameraKey,CursorKey,AudioAsset} from './index.js';
export function setAppearance(project:Project,clipId:string,patch:CaptionStyle|CursorStyle,options?:{scope?:'clip'|'track'|'project';reset?:boolean}):Project;
export function applyCaptionPreset(project:Project,clipId:string,name:'clean'|'contrast'|'minimal',scope?:'clip'|'track'|'project'):Project;
export function updateKeyframe(project:Project,clipId:string,keyId:string,patch:Partial<Omit<CameraKey,'id'>>|Partial<Omit<CursorKey,'id'>>):Project;
export function addKeyframe(project:Project,clipId:string,clipTimeMs:number,patch?:Partial<Omit<CameraKey,'id'|'atMs'>>|Partial<Omit<CursorKey,'id'|'atMs'>>):Project;
export function deleteKeyframe(project:Project,clipId:string,keyId:string):Project;
export function addGesture(project:Project,clipId:string,clipTimeMs:number,kind?:'click'|'double-click'|'hold'):Project;
export function addScene(project:Project,options?:{afterId?:string;target?:string;title?:string;durationMs?:number}):{value:Project;sceneId:string};
export function deleteScene(project:Project,sceneId:string):Project;
export function addCaption(project:Project,sceneId:string,startMs?:number):{value:Project;clipId:string};
export function proposeCaptionImport(project:Project,text:string,options?:{language?:string;name?:string}):{value:Project;trackId:string;cueCount:number;splitCount:number;warnings:string[]};
export function proposeVoiceReplacement(project:Project,clipId:string,asset:AudioAsset,options?:{fitScene?:boolean}):{value:Project;changes:unknown[];deltaMs:number};

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
