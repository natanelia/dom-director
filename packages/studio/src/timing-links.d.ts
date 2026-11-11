import type {Project} from './index.js';
export interface WordLinkOptions {captionId:string;wordIndex:number;boundary?:'start'|'end';offsetMs?:number;}
export interface TimingLinkDescription {
  readonly clipId:string;readonly keyId:string;readonly kind:'camera'|'cursor';readonly sceneId:string;
  readonly captionId:string;readonly captionTrackId:string;readonly wordId:string;readonly wordIndex:number;readonly text:string;
  readonly boundary:'start'|'end';readonly offsetMs:number;readonly sourceTimeMs:number;readonly clipTimeMs:number;readonly projectTimeMs:number;readonly visible:boolean;
}
/** Opt in to draft.2. Uses authored words from the active, visible caption language. */
export function linkKeyframeToCaptionWord(project:Project,clipId:string,keyId:string,options:WordLinkOptions):Project;
/** Offsets are whole milliseconds, not speech-rate scaling. Existing locks still apply. */
export function setTimingLinkOffset(project:Project,clipId:string,keyId:string,offsetMs:number):Project;
export function detachTimingLink(project:Project,clipId:string,keyId:string):Project;
/** Preserves absolute timing; does not remove caption word identities or downgrade the format. */
export function detachCaptionTimingLinks(project:Project,captionId:string):Project;
export function describeTimingLinks(project:Project):ReadonlyArray<TimingLinkDescription>;
