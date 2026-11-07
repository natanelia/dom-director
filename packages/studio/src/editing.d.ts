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
