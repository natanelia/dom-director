import type {Diagnostic,Rect,Pose,Easing} from '@dom-director/core';
export const STUDIO_VERSION:'0.1.0-draft.1';
export const LINKED_STUDIO_VERSION:'0.1.0-draft.2';
export interface WordTimingLink {captionId:string;wordId:string;boundary:'start'|'end';offsetMs:number;}
export type TrackKind='camera'|'cursor'|'voice'|'captions';
export const KINDS:ReadonlyArray<TrackKind>;
export interface CaptionStyle {font?:'sans'|'serif'|'mono';size?:number;weight?:400|500|600|700|800;color?:string;background?:string;opacity?:number;outline?:number;x?:number;y?:number;width?:number;align?:'left'|'center'|'right';padding?:number;radius?:number;}
export interface CursorStyle {shape?:'arrow'|'hand'|'dot';size?:number;color?:string;stroke?:string;halo?:number;opacity?:number;trail?:boolean;}
export const CAPTION_THEME:Readonly<Required<CaptionStyle>>;
export const CURSOR_THEME:Readonly<Required<CursorStyle>>;
export const PRESETS:Readonly<Record<'clean'|'contrast'|'minimal',Readonly<Required<CaptionStyle>>>>;
export interface Scene {id:string;title:string;durationMs:number;}
export interface AudioAsset {id:string;name:string;mime:string;durationMs:number;source:'sample'|'local';sample?:string;sha256?:string;}
export interface ClipBase {id:string;sceneId:string;startMs:number;durationMs:number;}
export interface KeyBase {id:string;atMs:number;target:string;x:number;y:number;easing:Easing;timing?:WordTimingLink;}
export interface CameraKey extends KeyBase {zoom:number;}
export interface CursorKey extends KeyBase {curve:number;}
export interface Gesture {id:string;atMs:number;kind:'click'|'double-click'|'hold';}
export interface CameraClip extends ClipBase {offsetMs:number;keys:CameraKey[];}
export interface CursorClip extends ClipBase {offsetMs:number;keys:CursorKey[];gestures:Gesture[];style?:CursorStyle;}
export interface CaptionClip extends ClipBase {text:string;style?:CaptionStyle;words?:Array<{id?:string;text:string;startMs:number;endMs:number}>;}
export interface VoiceClip extends ClipBase {assetId:string|null;sourceInMs:number;script:string;gain:number;fadeInMs:number;fadeOutMs:number;}
export type Clip=CameraClip|CursorClip|CaptionClip|VoiceClip;
export interface TrackBase {id:string;name:string;enabled:boolean;locked:boolean;}
export type Track=(TrackBase&{kind:'camera';clips:CameraClip[]})|(TrackBase&{kind:'cursor';clips:CursorClip[];style?:CursorStyle})|(TrackBase&{kind:'voice';clips:VoiceClip[]})|(TrackBase&{kind:'captions';language?:string;style?:CaptionStyle;clips:CaptionClip[]});
export interface StudioProject {studioVersion:typeof STUDIO_VERSION|typeof LINKED_STUDIO_VERSION;id:string;title:string;canvas:{width:number;height:number};scenes:Scene[];tracks:Track[];assets:AudioAsset[];captionTheme:CaptionStyle;cursorTheme:CursorStyle;captionTrack:string;}
export type DeepReadonly<T>=T extends (...args:never[])=>unknown?T:T extends object?{readonly [P in keyof T]:DeepReadonly<T[P]>}:T;
export type Project=DeepReadonly<StudioProject>;
export type Validation={ok:true;value:Project}|{ok:false;diagnostics:ReadonlyArray<Diagnostic>};
export function validateProject(input:unknown):Validation;
export function requireProject(input:unknown):Project;
export function createSample():Project;
export function sceneTimeline(project:Project):Array<DeepReadonly<Scene>&{startMs:number;endMs:number}>;
export function duration(project:Project):number;
export function locate(project:Project,timeMs:number):{scene:DeepReadonly<Scene>&{startMs:number;endMs:number};timeMs:number;projectTimeMs:number};
export function findClip(project:Project,id:string):{track:DeepReadonly<Track>;clip:DeepReadonly<Clip>};
export function freshId(project:Project,prefix?:string):string;
export function editProject(project:Project,mutate:(draft:StudioProject)=>void):Project;
export function updateClip(project:Project,id:string,patch:Partial<Clip>):Project;
export function moveClip(project:Project,id:string,startMs:number,options?:{ripple?:boolean}):Project;
export function trimClip(project:Project,id:string,startMs:number,endMs:number):Project;
export function splitClip(project:Project,id:string,localMs:number):Project;
export function deleteClip(project:Project,id:string):Project;
export function duplicateClip(project:Project,id:string):Project;
export function reorderScene(project:Project,id:string,delta:number):Project;
export function proposeRetime(project:Project,sceneId:string,newDurationMs:number):{value:Project;changes:Array<{id:string;track:string;before:{startMs:number;durationMs:number};after:{startMs:number;durationMs:number}}>;deltaMs:number};
export interface StoreSnapshot {project:Project;revision:number;canUndo:boolean;canRedo:boolean;expired:number;label:string;}
export function createProjectStore(input:unknown,options?:{limit?:number;byteLimit?:number}):{snapshot():StoreSnapshot;commit(next:unknown,label?:string,expectedRevision?:number):StoreSnapshot;replace(next:unknown):StoreSnapshot;undo():StoreSnapshot;redo():StoreSnapshot;};
export interface PresentationFrame {sceneId:string;sceneTimeMs:number;timeMs:number;camera:Pose;cursor:null|{clipId:string;x:number;y:number;client:{x:number;y:number};style:Required<CursorStyle>;trail:Array<{x:number;y:number}>;gestures:Array<Gesture&{progress:number}>};caption:null|{clipId:string;text:string;style:Required<CaptionStyle>;words:CaptionClip['words']|null;wordIndex:number};voice:Array<{clipId:string;assetId:string|null;sourceTimeMs:number}>;}
export function createEvaluator(input:unknown):{project:Project;targets:string[];durationMs:number;sample(timeMs:number,bounds:Record<string,Rect>,box?:Rect,options?:{reducedMotion?:boolean;captionTrack?:string}):PresentationFrame;};
export function exportSubtitles(project:Project,options?:{trackId?:string;format?:'vtt'|'srt'}):{text:string;warnings:string[]};
export function parseSubtitles(text:string):Array<{startMs:number;endMs:number;text:string}>;
