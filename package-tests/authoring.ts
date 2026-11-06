import {createDirector,createAgentBridge,createCheckpointStore,createGuidance,createTargetRegistry,compile,fit,createCamera,proposeTargetRepair,mountControls,SCHEMA_VERSION,type Tour,type AgentCommand,type TourCue,type HostAction} from '@dom-director/core';
import {createSurface} from '@dom-director/core/surface';
const tour={schemaVersion:SCHEMA_VERSION,id:'example',title:'Example',locale:'en',entryScene:'one',modes:['watch'],capabilities:[],targets:{save:{ref:'app.save'}},scenes:[{id:'one',title:'Save',summary:'Review before saving.',durationMs:2000,cues:[{kind:'camera',id:'focus',at:0,durationMs:500,target:'save'}]}]} as const satisfies Tour;
const registry=createTargetRegistry({'app.save':()=>document.querySelector('button')});
const viewport=document.createElement('div'),scene=document.createElement('div'),overlay=document.createElement('div');
const guidance=createGuidance({authorize:(request,signal)=>!signal.aborted&&request.mode==='guide',actions:{save:{impact:'persistent',idempotent:true,reconcile:async()=> 'succeeded' as const,validate:args=>typeof args.id==='string',execute:async(args,context)=>{context.signal.throwIfAborted();return {completed:true};}}},conditions:{ready:{evidence:'domain',read:()=>true,subscribe:()=>()=>{}}}});
const director=createDirector({surface:{viewport,scene,overlay},registry,guidance});
const loaded=director.load(tour);if(!loaded.ok) console.log(loaded.diagnostics[0].code);
const command={protocolVersion:SCHEMA_VERSION,sessionId:director.sessionId,requestId:'first',command:'play',params:{},expectedRevision:0} satisfies AgentCommand;
const bridge=createAgentBridge(director,{clientId:'local-agent',targetIds:['app.save'],authorize:()=>true,capabilities:guidance.catalog()});
void bridge.handle(JSON.stringify(command));
const checkpoints=createCheckpointStore(director,{versions:()=>({script:'1',host:'1',fixture:'1'}),verify:proof=>proof.versions.host==='1'});
void checkpoints.capture();void proposeTargetRepair(tour,{alias:'save',replacement:'app.save2',reason:'Reviewed host change'},[{id:'app.save2'}]);
compile(JSON.stringify(tour));fit({x:0,y:0,width:10,height:10},{x:0,y:0,width:100,height:100});
createCamera({viewport,scene,overlay}).reset();createSurface({viewport,scene,overlay}).destroy();
const virtual=createTargetRegistry({'chart.point':{label:'Chart point',bounds:()=>({x:10,y:20,width:30,height:40,space:'scene'})}});
const resolved=virtual.resolve('chart.point');if(resolved.virtual){const width:number=resolved.rect.width;void width;}
virtual.subscribe(revision=>{const n:number=revision;void n;});virtual.descriptor('chart.point');
const controls=mountControls(director,document.createElement('div'));controls.refresh();controls.element.focus();
const idempotent:HostAction={impact:'persistent',idempotent:true,validate:()=>true,execute:()=>({completed:true})};
const reconciled:HostAction={impact:'persistent',reconcile:()=> 'unknown',validate:()=>true,execute:()=>({completed:true})};
void idempotent;void reconciled;
// @ts-expect-error host geometry is flat, not wrapped in rect
createTargetRegistry({'bad':{label:'Bad',bounds:()=>({space:'scene',rect:{x:0,y:0,width:10,height:10}})}});
// @ts-expect-error ambiguous arrays cannot resolve one target
createTargetRegistry({'bad':()=>[document.createElement('button')]});
// @ts-expect-error descriptors need an authored label
createTargetRegistry({'bad':{resolve:()=>document.createElement('button')}});
// @ts-expect-error persistent actions need idempotency or reconciliation
const unsafe:HostAction={impact:'persistent',validate:()=>true,execute:()=>({completed:true})};
// @ts-expect-error methods and callbacks are not portable cue data
const executable:TourCue={kind:'callback',id:'bad',at:0,run:()=>{}};
// @ts-expect-error unknown protocol command cannot be dispatched
const unknownCommand:AgentCommand={protocolVersion:SCHEMA_VERSION,requestId:'bad',sessionId:'d',command:'evaluate',params:{}};
// @ts-expect-error camera requires target or reset
const missingTarget:TourCue={kind:'camera',id:'bad',at:0,durationMs:100};
// @ts-expect-error script input to the bridge must be serialized JSON
bridge.handle({command:'play'});
// @ts-expect-error permission grants must resolve explicit boolean
createAgentBridge(director,{clientId:'bad',authorize:()=> 'yes'});
// @ts-expect-error unsupported mode
void director.setMode('automatic');
