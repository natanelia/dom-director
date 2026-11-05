import {diagnostic} from './errors.js';
import {cloneData,freezeData} from './json.js';
import {schemaErrors} from './schema.js';
import {schemas} from './schema.generated.js';
export const SCHEMA_VERSION='0.1.0-draft.1';
export function safeAssetURI(uri){
  if(typeof uri!=='string'||/[\u0000-\u0020\u007f\\]/u.test(uri))return false;
  if(uri.startsWith('./'))return !/[?#%]/u.test(uri)&&!uri.split('/').includes('..');
  try{const url=new URL(uri);return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password;}catch{return false;}
}
export function compile(input){
  let script;try{script=cloneData(input);}catch(error){return {ok:false,diagnostics:[diagnostic(error,'parse')]};}
  const errors=schemaErrors(script,schemas.tour,schemas);
  if(errors.length)return {ok:false,diagnostics:errors};
  const add=(code,path,message)=>{if(errors.length<100)errors.push({code,path,message,phase:'compile',severity:'error',recoveries:['edit-script']});};
  const sceneIds=new Set(),cueIds=new Set(),graph=Object.create(null),scenes=Object.create(null),targets=script.targets,assets=script.assets||{};
  const capabilities=new Set(script.capabilities);
  if(script.scenes.reduce((n,s)=>n+s.cues.length,0)>10000)add('CUE_LIMIT','/scenes','Aggregate cue limit exceeded.');
  for(const [id,asset]of Object.entries(assets))if(!safeAssetURI(asset.uri))add('ASSET_URI','/assets/'+id+'/uri','Asset URI is outside the content policy.');
  script.scenes.forEach((scene,si)=>{
    const base='/scenes/'+si;
    if(sceneIds.has(scene.id))add('DUPLICATE_SCENE',base,'Scene IDs must be unique.');sceneIds.add(scene.id);
    graph[scene.id]=scene.next?[scene.next]:(scene.choices||[]).map(c=>c.next);
    if(new Set((scene.choices||[]).map(c=>c.id)).size!==(scene.choices||[]).length)add('DUPLICATE_CHOICE',base+'/choices','Choice IDs must be unique.');
    const anchors=Object.create(null);let previous=-1;
    for(const [ni,cue]of (scene.narration?.cues||[]).entries()){
      const path=base+'/narration/cues/'+ni;
      if(Object.hasOwn(anchors,cue.id))add('DUPLICATE_NARRATION_CUE',path,'Narration IDs must be unique within a scene.');anchors[cue.id]=cue;
      if(!(cue.startMs<cue.endMs&&cue.endMs<=scene.durationMs))add('NARRATION_RANGE',path,'Caption interval must be positive and inside the scene.');
      if(cue.startMs<previous)add('NARRATION_ORDER',path,'Caption starts must be sorted.');previous=cue.startMs;
    }
    if(scene.narration?.audioAsset&&assets[scene.narration.audioAsset]?.kind!=='audio')add('AUDIO_REFERENCE',base+'/narration/audioAsset','Narration requires a declared audio asset.');
    const cues=scene.cues.map((cue,order)=>{
      const path=base+'/cues/'+order;
      if(cueIds.has(cue.id))add('DUPLICATE_CUE',path,'Cue IDs must be globally unique.');cueIds.add(cue.id);
      for(const field of ['target','fromTarget'])if(cue[field]&&!Object.hasOwn(targets,cue[field]))add('TARGET_REFERENCE',path+'/'+field,'Target alias is not declared.');
      if(cue.kind==='cursor'&&((cue.gesture==='drag')!==Object.hasOwn(cue,'fromTarget')))add('CURSOR_SOURCE',path,'Only drag gestures require a source.');
      let atMs=cue.at;
      if(typeof atMs==='object'){
        const anchor=anchors[atMs.narrationCue];
        if(!anchor){add('NARRATION_REFERENCE',path+'/at','Narration anchor is not defined.');atMs=0;}
        else atMs=anchor[atMs.edge==='start'?'startMs':'endMs']+(atMs.offsetMs||0);
      }
      const endMs=atMs+(cue.durationMs||0);
      if(atMs<0||endMs>scene.durationMs)add('CUE_RANGE',path,'Resolved interval is outside the scene.');
      if(cue.kind==='camera'&&(cue.minScale??.5)>(cue.maxScale??script.defaults?.maxScale??3))add('SCALE_RANGE',path,'Minimum scale exceeds maximum scale.');
      const capability=cue.kind==='action'?'action:'+cue.actionRef:cue.kind==='gate'?'condition:'+cue.conditionRef:null;
      if(capability&&!capabilities.has(capability))add('CAPABILITY_UNDECLARED',path,'Requested operation must be declared.');
      if(cue.kind==='gate'&&cue.onTimeout==='skip-scene'&&scene.choices)add('AMBIGUOUS_SKIP',path,'Timeout cannot choose an unresolved branch.');
      return {...cue,atMs,endMs,order};
    }).sort((a,b)=>a.atMs-b.atMs||a.order-b.order);
    for(const kind of ['camera','cursor']){
      let previous;for(const cue of cues.filter(c=>c.kind===kind)){
        if(previous&&(cue.atMs<previous.endMs||cue.atMs===previous.atMs))add('TRACK_CONFLICT',base+'/cues/'+cue.order,'Two cues compete for one visual track.');previous=cue;
      }
    }
    scenes[scene.id]={...scene,cues};
  });
  let invalidReference=false;
  for(const destinations of Object.values(graph))for(const id of destinations)if(!Object.hasOwn(graph,id)){add('SCENE_REFERENCE','/scenes','Graph destination is not defined.');invalidReference=true;}
  if(!Object.hasOwn(graph,script.entryScene))add('ENTRY_REFERENCE','/entryScene','Entry scene is not defined.');
  if(!invalidReference){
    const degree=Object.fromEntries(Object.keys(graph).map(id=>[id,0]));
    for(const destinations of Object.values(graph))for(const id of destinations)degree[id]++;
    const queue=Object.keys(degree).filter(id=>degree[id]===0);let count=0;
    while(queue.length){const id=queue.pop();count++;for(const next of graph[id])if(--degree[next]===0)queue.push(next);}
    if(count!==sceneIds.size)add('GRAPH_CYCLE','/scenes','Scene graph must be acyclic.');
    const seen=new Set(),pending=[script.entryScene];
    while(pending.length){const id=pending.pop();if(!seen.has(id)&&Object.hasOwn(graph,id)){seen.add(id);pending.push(...graph[id]);}}
    if(seen.size!==sceneIds.size)add('UNREACHABLE_SCENE','/scenes','Some scenes are unreachable.');
  }
  if(errors.length)return {ok:false,diagnostics:errors};
  return {ok:true,plan:freezeData({script,scenes,graph,entryScene:script.entryScene}),diagnostics:[]};
}
export function preview(input){
  const result=compile(input);if(!result.ok)return result;
  const {plan}=result;
  return {ok:true,preview:freezeData({id:plan.script.id,locale:plan.script.locale,entryScene:plan.entryScene,
    scenes:plan.script.scenes.map(s=>({id:s.id,title:s.title,summary:s.summary,durationMs:s.durationMs})),
    requestedEffects:Object.values(plan.scenes).flatMap(s=>s.cues.filter(c=>c.kind==='action'||c.kind==='gate').map(c=>({sceneId:s.id,cueId:c.id,kind:c.kind,atMs:c.atMs,ref:c.actionRef||c.conditionRef}))),
    capabilities:[...plan.script.capabilities]}),diagnostics:[]};
}
