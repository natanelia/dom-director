import type {Tour, TourScene, TourCue, TourAsset, Diagnostic, AgentCommand, JsonValue} from './script.generated.js';
export type {Tour, TourScene, TourCue, TourAsset, TourTarget, TourTime, Diagnostic, AgentCommand, JsonValue} from './script.generated.js';
export type Mode = 'watch' | 'try' | 'guide';
export type Easing = 'gentle' | 'direct' | 'overview' | 'instant';
export type Status = 'idle' | 'ready' | 'playing' | 'buffering' | 'paused' | 'waiting' | 'completed' | 'error' | 'destroyed';
export type Cleanup = () => void;
export type MaybePromise<T> = T | Promise<T>;
export type Result<T = unknown> = {readonly ok:true;readonly value:T;readonly revision?:number} | {readonly ok:false;readonly diagnostics:ReadonlyArray<Diagnostic>;readonly revision?:number};
export class DirectorError extends Error {constructor(code:string,message:string,phase?:string,path?:string);readonly diagnostic:Diagnostic;}
export interface Rect {x:number;y:number;width:number;height:number;}
export interface Pose {x:number;y:number;scale:number;}
export interface Framing {paddingPx?:number;minScale?:number;maxScale?:number;}
export const IDENTITY: Readonly<Pose>;
export function rect(value:Rect):Rect;
export function pose(value:Pose):Pose;
export function union(bounds:ReadonlyArray<Rect>):Rect;
export function fit(bounds:Rect,safe:Rect,options?:Framing):{pose:Pose;clipped:boolean};
export function project(bounds:Rect,camera:Pose,origin?:{x:number;y:number}):Rect;
export function interpolate(from:Pose,to:Pose,progress:number,preset?:Easing):Pose;
export function easing(progress:number,preset?:Easing):number;
export interface Scheduler {now():number;request(callback:(time:number)=>void):number;cancel(id:number):void;}
export interface SurfaceOptions {viewport:HTMLElement;scene:HTMLElement;overlay:HTMLElement;kind?:'managed-dom'|'overlay-only';allowPositioned?:boolean;insets?:{top?:number;right?:number;bottom?:number;left?:number};}
export interface TargetBounds {space:'scene'|'client';rect:Rect;visible?:boolean;revision?:number;}
export interface Surface {readonly viewport:HTMLElement;readonly scene:HTMLElement;readonly overlay:HTMLElement;readonly kind:'managed-dom'|'overlay-only';readonly warnings:ReadonlyArray<Diagnostic>;readonly pose:Pose;readonly revision:number;
  snapshot(targets?:ReadonlyArray<Element>):{origin:{x:number;y:number};box:Rect;bounds:ReadonlyArray<TargetBounds & {element:Element;cameraRevision:number}>;revision:number;cameraRevision:number};
  apply(pose:Pose):void;invalidate():void;subscribe(listener:(revision:number)=>void):Cleanup;destroy():void;}
export function createSurface(options:SurfaceOptions):Surface;
export interface CameraMotion extends Framing {durationMs?:number;easing?:Easing;signal?:AbortSignal;}
export interface CameraResult {status:string;pose:Pose;diagnostic?:Diagnostic;}
export interface Camera {surface:Surface;focus(target:Element|(()=>Element|null),options?:CameraMotion):Promise<CameraResult>;reset(options?:CameraMotion):Promise<CameraResult>;cancel(reason?:string):void;destroy():void;}
export function createCamera(options:SurfaceOptions & {scheduler?:Scheduler;onDiagnostic?:(diagnostic:Diagnostic)=>void}):Camera;
export interface TargetDescriptor {label?:string;sensitivity?:'public'|'private'|'secret';dynamic?:boolean;resolve?:()=>Element|null|ReadonlyArray<Element>;bounds?:()=>TargetBounds;}
export type TargetRegistration = TargetDescriptor | (()=>Element|null|ReadonlyArray<Element>);
export interface TargetMetadata {readonly id:string;readonly label:string;readonly kind:'dom'|'virtual';}
export interface TargetRegistry {readonly revision:number;register(id:string,registration:TargetRegistration):Cleanup;has(id:string):boolean;catalog():ReadonlyArray<TargetMetadata>;invalidate():void;subscribe(listener:()=>void):Cleanup;resolve(id:string):{element?:Element;bounds?:TargetBounds;dynamic:boolean};}
export function createTargetRegistry(targets?:Record<string,TargetRegistration>,options?:{privateTargets?:ReadonlyArray<string>}):TargetRegistry;
export const SCHEMA_VERSION:'0.1.0-draft.1';
export type CompiledCue = TourCue & {readonly atMs:number;readonly endMs:number;readonly order:number};
export type CompiledScene = Omit<TourScene,'cues'> & {readonly cues:ReadonlyArray<CompiledCue>};
export interface CompiledPlan {readonly script:Tour;readonly entryScene:string;readonly scenes:Readonly<Record<string,CompiledScene>>;readonly graph:Readonly<Record<string,ReadonlyArray<string>>>;}
export function compile(input:unknown):{readonly ok:true;readonly plan:CompiledPlan}|{readonly ok:false;readonly diagnostics:ReadonlyArray<Diagnostic>};
export function preview(input:unknown):{readonly ok:true;readonly preview:Readonly<Record<string,unknown>>}|{readonly ok:false;readonly diagnostics:ReadonlyArray<Diagnostic>};
export function sampleVisual(scene:CompiledScene,timeMs:number,bounds:Readonly<Record<string,TargetBounds>>,safe:Rect,options?:{initial?:Pose;reduced?:boolean;defaults?:Tour['defaults']}):{camera:Pose;overlays:ReadonlyArray<CompiledCue>;caption:string};
export interface EffectEvidence {readonly key:string;readonly actionRef:string;readonly state:'authorizing'|'pending'|'succeeded'|'not-started'|'unknown';}
export interface WaitingFor {readonly cueId:string;readonly kind:'action'|'gate';readonly instruction:string;readonly hints:ReadonlyArray<string>;readonly error:string|null;}
export interface NarrationState {readonly enabled:boolean;readonly authority:'audio'|'text';readonly buffering:boolean;readonly error:string|null;readonly volume:number;readonly maxSkewMs:number;readonly available:boolean;readonly samples:number;readonly p95SkewMs:number|null;readonly [key:string]:unknown;}
export interface SessionState {readonly revision:number;readonly status:Exclude<Status,'idle'>;readonly runId:string;readonly mode:Mode;readonly sceneId:string;readonly visitId:string;readonly timeMs:number;readonly durationMs:number;readonly rate:number;
  readonly path:ReadonlyArray<{sceneId:string;visitId:string}>;readonly waitingFor:WaitingFor|null;readonly incomplete:boolean;readonly choices:ReadonlyArray<{id:string;label:string;next:string}>;readonly reasons:ReadonlyArray<string>;readonly nominalDurationMs:number;}
export interface DirectorState extends Omit<Partial<SessionState>,'status'|'revision'> {readonly sessionId:string;readonly revision:number;readonly status:Status;readonly caption:string;readonly captionsEnabled:boolean;readonly narration:NarrationState|null;readonly pendingOperation:string|null;readonly effects:ReadonlyArray<EffectEvidence>;readonly reducedMotion:boolean;readonly geometryReads:number;}
export interface FrameState extends SessionState {readonly caption:string;}
export interface DirectorEvent extends Omit<Partial<SessionState>,'status'|'revision'> {readonly sessionId:string;readonly revision:number;readonly type:string;readonly status:Status;readonly sequence?:number;readonly detail?:Readonly<Record<string,unknown>>;}
export interface TourDescription {readonly id:string;readonly title:string;readonly locale:string;readonly modes:ReadonlyArray<Mode>;readonly scenes:ReadonlyArray<{id:string;title:string;summary:string;durationMs:number;transcript:string;captions:ReadonlyArray<CaptionCue>}>;}
export interface CaptionCue {readonly id?:string;readonly startMs:number;readonly endMs:number;readonly order?:number;readonly text:string;}
export interface Clock {rate:number;buffering?:boolean;setScene(scene:CompiledScene):void;setTime(timeMs:number):void;setRate(rate:number):void;start():void;pause():void;read():number;destroy():void;}
export interface NarrationOptions {enabled?:boolean;onFailure?:'pause'|'text';timeoutMs?:number;stallMs?:number;resolveAsset(id:string,asset:TourAsset|undefined):string;createAudio?:()=>HTMLAudioElement;}
export interface BarrierContext {readonly runId:string;readonly sceneId:string;readonly visitId:string;readonly mode:Mode;readonly script:Tour;readonly revision?:number;}
export type BarrierOutcome = {completed:true;evidence?:string}|{skipScene:true};
export interface BarrierAdapter {enter(cue:CompiledCue,context:BarrierContext,signal:AbortSignal):MaybePromise<BarrierOutcome>;hints?(ref:string):ReadonlyArray<string>;}
export interface DirectorOptions {surface:SurfaceOptions;targets?:Record<string,TargetRegistration>;registry?:TargetRegistry;mode?:Mode;scheduler?:Scheduler;barriers?:BarrierAdapter;clock?:Clock;narration?:NarrationOptions;guidance?:Guidance;}
export interface Director {readonly sessionId:string;readonly registry:TargetRegistry;readonly surface:Surface;
  load(input:unknown):Result<SessionState>;play():Result<SessionState>;pause():Result<SessionState>;stop():Result<SessionState>;seek(position:{sceneId?:string;timeMs?:number}):Result<SessionState>;
  setRate(rate:number):Result<SessionState>;choose(id:string):Result<SessionState>;next():Result<SessionState>;extendWait():Result<SessionState>;retryBarrier():Result<SessionState>;
  setMode(mode:Mode):Promise<Result<DirectorState>>;resetFixture():Promise<Result<DirectorState>>;setNarrationEnabled(enabled:boolean):Result<DirectorState>;setVolume(volume:number):Result<DirectorState>;
  setCaptions(enabled:boolean):Result<DirectorState>;setReducedMotion(reduced:boolean):Result<DirectorState>;focusTarget(id:string):Result<DirectorState>;exportCaptions(sceneId?:string):Result<string>;
  describe():TourDescription|null;inspect():DirectorState;on(listener:(event:DirectorEvent)=>void):Cleanup;onFrame(listener:(frame:FrameState)=>void):Cleanup;
  waitForCompletion(runId:string,options?:{signal?:AbortSignal}):Promise<{runId:string;status:'completed'|'failed'|'cancelled'}>;destroy():void;}
export function createDirector(options:DirectorOptions):Director;
export function mountControls(director:Director,container:HTMLElement):{destroy():void};
export class NarrationClock implements Clock {constructor(options:Omit<NarrationOptions,'createAudio'|'resolveAsset'> & {now?:()=>number;createAudio:()=>HTMLAudioElement;resolveAsset:(id:string)=>string;onChange?:(type:string,state:NarrationState)=>void;setTimer?:(callback:()=>void,ms:number)=>unknown;clearTimer?:(id:unknown)=>void});
  rate:number;buffering:boolean;setScene(scene:CompiledScene):void;setTime(timeMs:number):void;setRate(rate:number):void;start():void;pause():void;read():number;destroy():void;
  setEnabled(enabled:boolean):void;setVolume(volume:number):void;observePresentation(timeMs:number):void;inspect():NarrationState;}
export function captionsToVTT(cues:ReadonlyArray<CaptionCue>):string;
export interface CapabilityRequest extends BarrierContext {readonly capability:string;readonly cueId:string;readonly args:Readonly<Record<string,JsonValue>>;}
export interface ActionContext extends CapabilityRequest {readonly idempotencyKey:string;readonly signal:AbortSignal;}
export interface HostActionBase {label?:string;discoverable?:boolean;modes?:ReadonlyArray<Mode>;requiresFixture?:boolean;
  validate(args:Readonly<Record<string,JsonValue>>):boolean;check?:(request:CapabilityRequest,signal:AbortSignal)=>MaybePromise<boolean>;
  execute(args:Readonly<Record<string,JsonValue>>,context:ActionContext):MaybePromise<{completed:true}>;}
export type ReconcileAction = (context:{idempotencyKey:string;signal:AbortSignal})=>MaybePromise<'succeeded'|'not-started'|'unknown'>;
export type HostAction = HostActionBase & ({impact:'persistent';idempotent:true;reconcile:ReconcileAction}|{impact:'read'|'ephemeral';idempotent?:boolean;reconcile?:ReconcileAction});
export interface HostCondition {label?:string;discoverable?:boolean;evidence:'acknowledgment'|'ui'|'domain'|'server';trigger?:'level'|'edge';hints?:ReadonlyArray<string>;
  read(context:BarrierContext):boolean|{satisfied:boolean;revision?:number};subscribe(listener:()=>void,context:BarrierContext):Cleanup;}
export interface CapabilityCatalog {readonly actions:ReadonlyArray<{id:string;label:string;impact:'read'|'ephemeral'|'persistent'}>;readonly conditions:ReadonlyArray<{id:string;label:string;evidence:'acknowledgment'|'ui'|'domain'|'server';trigger?:'level'|'edge'}>;}
export interface GuidanceOptions {actions?:Record<string,HostAction>;conditions?:Record<string,HostCondition>;authorize?:(request:CapabilityRequest,signal:AbortSignal)=>MaybePromise<boolean>;
  fixture?:{isolated:true;timeoutMs?:number;reset(context:{signal:AbortSignal}):MaybePromise<{completed:true}>};maxLedger?:number;maxLedgerBytes?:number;now?:()=>number;
  activity?:{isActive():boolean;subscribe(listener:()=>void):Cleanup};setTimer?:(callback:()=>void,ms:number)=>unknown;clearTimer?:(id:unknown)=>void;}
export interface Guidance extends BarrierAdapter {readonly isolated:boolean;preflight(script:Tour,mode:Mode):void;prepareMode(context:BarrierContext,signal?:AbortSignal):Promise<{completed:true}>;
  reset(context:BarrierContext,signal?:AbortSignal):Promise<{completed:true}>;reconcile(key:string,signal?:AbortSignal):Promise<'succeeded'|'not-started'|'unknown'>;
  inspect():ReadonlyArray<EffectEvidence>;catalog():CapabilityCatalog;hints(ref:string):ReadonlyArray<string>;revoke():void;destroy():void;}
export function createGuidance(options?:GuidanceOptions):Guidance;
export interface CheckpointVersions {readonly script:string;readonly host:string;readonly fixture:string;}
export interface Checkpoint {readonly id:string;readonly scriptId:string;readonly locale:string;readonly sessionId:string;readonly runId:string;readonly sceneId:string;readonly visitId:string;readonly timeMs:number;readonly mode:Mode;readonly versions:CheckpointVersions;}
export type CheckpointProof = Pick<Checkpoint,'sceneId'|'timeMs'|'mode'|'versions'>;
export interface CheckpointRequest {readonly capability:'checkpoint:capture'|'checkpoint:restore';readonly checkpointId:string|null;readonly sessionId:string;readonly runId:string;readonly scriptId:string;readonly versions:CheckpointVersions;}
export interface CheckpointOptions {versions():CheckpointVersions;verify(proof:CheckpointProof,signal:AbortSignal):MaybePromise<boolean>;authorize?:(request:CheckpointRequest,signal:AbortSignal)=>MaybePromise<boolean>;maxCheckpoints?:number;maxBytes?:number;timeoutMs?:number;}
export interface CheckpointStore {capture(options?:{signal?:AbortSignal}):Promise<Result<Checkpoint>>;restore(id:string,options?:{signal?:AbortSignal}):Promise<Result<DirectorState>>;list():ReadonlyArray<Checkpoint>;remove(id:string):boolean;clear():void;destroy():void;}
export function createCheckpointStore(director:Director,options:CheckpointOptions):CheckpointStore;
export const AGENT_PROTOCOL_VERSION:'0.1.0-draft.1';
export const AGENT_COMMANDS:ReadonlyArray<AgentCommand['command']>;
export type AgentAuthorization = AgentCommand & {readonly clientId:string;readonly phase:'execute'|'cached-result';readonly requestHash:string};
export interface AgentOptions {clientId:string;authorize?:(request:AgentAuthorization,signal:AbortSignal)=>MaybePromise<boolean>;commands?:ReadonlyArray<AgentCommand['command']>;targetIds?:ReadonlyArray<string>;capabilities?:CapabilityCatalog;
  maxRequests?:number;maxPending?:number;maxRetainedBytes?:number;timeoutMs?:number;}
export type AgentReply = Result<unknown> & {readonly requestId:string|null;readonly sessionId:string;readonly revision:number;readonly cached?:boolean};
export interface AgentBridge {readonly clientId:string;readonly sessionId:string;handle(json:string,options?:{signal?:AbortSignal}):Promise<AgentReply>;inspect():{clientId:string;sessionId:string;revoked:boolean;pending:number;retainedRequests:number;retainedBytes:number};revoke():void;destroy():void;}
export function createAgentBridge(director:Director,options:AgentOptions):AgentBridge;
export interface TargetRepair {readonly scriptId:string;readonly baseHash:string;readonly requiresHostReview:true;readonly reason:string;readonly affectedCues:ReadonlyArray<{sceneId:string;cueId:string}>;readonly patch:ReadonlyArray<{op:'test'|'replace';path:string;value:string}>;}
export function proposeTargetRepair(input:unknown,options:{alias:string;replacement:string;reason:string},approvedCatalog:ReadonlyArray<{id:string;sensitivity?:'public'|'private'|'secret'}>):Promise<Result<TargetRepair>>;
