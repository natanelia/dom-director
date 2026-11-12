import type {Project,AudioAsset,DeepReadonly} from './index.js';
export function digest(bytes:ArrayBuffer|ArrayBufferView):Promise<string>;
export interface MediaBank {
 context():AudioContext;
 ingest(id:string,name:string,mime:string,bytes:ArrayBuffer,options?:{signal?:AbortSignal}):Promise<AudioAsset>;
 load(asset:DeepReadonly<AudioAsset>,options?:{signal?:AbortSignal}):Promise<AudioBuffer>;
 get(id:string):AudioBuffer|undefined;
 waveform(id:string):number[]|null;
 bytes(id:string):ArrayBuffer|null;
 remove(id:string):void;clear():void;destroy():Promise<void>;
}
export function createMediaBank(options?:{resolveSample?:(id:string)=>string;contextFactory?:()=>AudioContext}):MediaBank;
export function saveProjectBundle(input:unknown,bank:Pick<MediaBank,'bytes'>):Promise<string>;
export function readProjectBundle(text:string):Promise<{project:Project;media:Array<{asset:DeepReadonly<AudioAsset>;bytes:ArrayBuffer}>}>;
export interface TransportState {state:'paused'|'preparing'|'playing'|'error';timeMs:number;audible:boolean;error?:string;}
export interface Transport {
 load(input:unknown):void;play():Promise<void>;pause():number;seek(timeMs:number):void;setSound(enabled:boolean):void;
 setLoop(range:{startMs:number;endMs:number}|null):void;inspect():TransportState;destroy():void;
}
export function createTransport(options:{bank:MediaBank;onFrame?:(timeMs:number)=>void;onState?:(state:TransportState)=>void;now?:()=>number;request?:(callback:()=>void)=>number;cancel?:(id:number)=>void}):Transport;
export interface VoiceRequest {text:string;voiceId:string;style:string;clipId:string;revision:number;}
export interface VoiceProvider {
 capabilities:{name:string;voices:Array<{id:string;label?:string;styles:string[]}>};
 generate(request:{text:string;voiceId:string;style:string;signal?:AbortSignal}):Promise<{bytes:ArrayBuffer;mime:string}>;
}
/** Uncommitted take with original revision. Hosts must review before inserting it. */
export function generateVoiceTake(provider:VoiceProvider|null,request:VoiceRequest,options?:{signal?:AbortSignal}):Promise<{bytes:ArrayBuffer;mime:string;origin:VoiceRequest&{provider:string}}>;

export interface TakeAuditionState {
 readonly state:'idle'|'loading'|'playing'|'ended'|'error'|'destroyed';
 readonly assetId:string|null;
 readonly error?:string;
}
export interface TakeAuditionOptions {
 sourceInMs?:number;durationMs?:number;gain?:number;fadeInMs?:number;fadeOutMs?:number;signal?:AbortSignal;
}
export type TakeAuditionResult = {status:'playing'|'cancelled'}|{status:'error';error:string};
export interface TakeAuditioner {
 /** Explicit audible listening. Omitted duration uses the full remaining decoded source. */
 play(asset:DeepReadonly<AudioAsset>,options?:TakeAuditionOptions):Promise<TakeAuditionResult>;
 stop():void;inspect():TakeAuditionState;destroy():void;
}
/** Single-take listening only; the host owns the shared context and project. Never closes the bank. */
export function createTakeAuditioner(options:{bank:Pick<MediaBank,'context'|'load'>;onState?:(state:TakeAuditionState)=>void;timeoutMs?:number}):TakeAuditioner;
