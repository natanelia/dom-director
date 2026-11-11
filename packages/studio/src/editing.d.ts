import type {Project,CaptionStyle,CursorStyle,CameraKey,CursorKey,AudioAsset} from './index.js';
export function setAppearance(project:Project,clipId:string,patch:CaptionStyle|CursorStyle,options?:{scope?:'clip'|'track'|'project';reset?:boolean}):Project;
export function applyCaptionPreset(project:Project,clipId:string,name:'clean'|'contrast'|'minimal',scope?:'clip'|'track'|'project'):Project;
export function updateKeyframe(project:Project,clipId:string,keyId:string,patch:Partial<Omit<CameraKey,'id'>>|Partial<Omit<CursorKey,'id'>>):Project;
export function addKeyframe(project:Project,clipId:string,clipTimeMs:number,patch?:Partial<Omit<CameraKey,'id'|'atMs'|'timing'>>|Partial<Omit<CursorKey,'id'|'atMs'|'timing'>>):Project;
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
export function createTimelineSnapper(project:Project,options:TimelineSnapOptions):Readonly<{
  snap(deltaMs:number,options?:{bypass?:boolean}):{deltaMs:number;guide:TimelineSnapGuide|null};
}>;
/** Moves one visible key in clip-local time, not source/project time. */
export function moveTimelineKeyframe(project:Project,clipId:string,keyId:string,clipTimeMs:number):Project;

export type WordBoundary='start'|'end';
export interface CaptionWordAnchor {
  readonly captionId:string;
  readonly wordIndex:number;
  readonly text:string;
  readonly boundary:WordBoundary;
  readonly captionTimeMs:number;
  readonly sceneTimeMs:number;
  readonly projectTimeMs:number;
}
/** Returns only authored words from the active, enabled caption-language track. */
export function captionWordAnchors(project:Project,sceneId:string):ReadonlyArray<CaptionWordAnchor>;
/** Changes one authored boundary to an exact project playhead; does not align speech. */
export function stampCaptionWord(project:Project,captionId:string,wordIndex:number,boundary:WordBoundary,projectTimeMs:number):Project;
/** A one-time timing edit, not a persistent link. Target path, easing and voice audio are unchanged. */
export function alignKeyframeToCaptionWord(project:Project,clipId:string,keyId:string,anchor:{captionId:string;wordIndex:number;boundary?:WordBoundary}):Project;
