/** Presentation helpers only; timing, camera and effects belong to the SDK. */
export function timecode(ms, precise=false) {
  const n=Math.max(0,Math.floor(ms));
  return String(Math.floor(n/60000)).padStart(2,'0')+':'+String(Math.floor(n/1000)%60).padStart(2,'0')+(precise?'.'+String(n%1000).padStart(3,'0'):'');
}
export function timeline(script) {
  let start=0;
  const scenes=script.scenes.map(scene=>{const value={...scene,startMs:start};start+=scene.durationMs;return value;});
  return {scenes,total:start,position(state){return (scenes.find(s=>s.id===state.sceneId)?.startMs||0)+(state.timeMs||0);},
    locate(ms){const value=Math.max(0,Math.min(start,ms));const scene=[...scenes].reverse().find(s=>s.startMs<=value)||scenes[0];return {sceneId:scene.id,timeMs:Math.min(scene.durationMs,value-scene.startMs)};}};
}
export function withEasing(script,value) {
  if(!['gentle','direct','overview','instant'].includes(value))throw new Error('Unknown camera easing.');
  return {...script,defaults:{...script.defaults,easing:value}};
}

/** Canonical caption-first tutorial data; application behavior stays in the host. */
export function createEarthTour(steps){
const targets=Object.fromEntries(['overview','globe','globeFrame','planet','detail','zoomIn','zoomOut','metric','year','region','connections','lighting'].map(key=>[key,{ref:'earth.'+key}]));
return {
  schemaVersion:'0.1.0-draft.1',id:'earth-statistics',title:'Earth · a world you can change',locale:'en',
  entryScene:steps[0].id,modes:['watch','try','guide'],
  capabilities:steps.flatMap(step=>['action:'+step.id,'condition:'+step.id]).concat('fixture:reset'),
  defaults:{easing:'gentle',motion:'respect-user',captions:'on'},targets,assets:{},
  scenes:steps.map((step,index)=>({
    id:step.id,title:step.title,summary:step.text,durationMs:step.durationMs,
    narration:{transcript:step.text,cues:[{id:'speech.'+step.id,startMs:0,endMs:step.durationMs,text:step.text}]},
    cues:[
      ...step.shots.map((shot,shotIndex)=>({id:'camera.'+step.id+(shotIndex?'.'+shotIndex:''),kind:'camera',at:shot.atMs,durationMs:shot.durationMs,target:shot.target.split('.')[1],minScale:0.1,maxScale:2.2,paddingPx:shot.target==='earth.overview'?0:24})),
      {id:'cursor.travel.'+step.id,kind:'cursor',at:0,durationMs:700,target:step.target.split('.')[1],gesture:'point'},
      {id:'focus.'+step.id,kind:'highlight',at:700,durationMs:1900,target:step.target.split('.')[1],style:'outline'},
      {id:'cursor.'+step.id,kind:'cursor',at:700,durationMs:1900,target:step.target.split('.')[1],gesture:'point'},
      {id:'demo.'+step.id,kind:'action',at:1800,actionRef:step.id,args:{},timeoutMs:5000},
      {id:'try.'+step.id,kind:'gate',at:1800,conditionRef:step.id,timeoutMs:60000,onTimeout:'pause',instruction:step.instruction},
      {id:'cursor.result.'+step.id,kind:'cursor',at:2600,durationMs:step.durationMs-2600,target:'planet',gesture:'point'},
    ],...(index<steps.length-1?{next:steps[index+1].id}:{}),
  })),
};

}
