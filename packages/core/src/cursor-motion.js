import {easing} from './geometry.js';
import {requireValue} from './errors.js';
import {clientBounds} from './visual.js';

function pair(scene,time){
  let previous=null,current=null;
  for(const cue of scene.cues){
    if(cue.atMs>time)break;
    if(cue.kind==='cursor'){previous=current;current=cue;}
  }
  return {previous,current};
}
const travel=cue=>cue.gesture==='drag'?cue.durationMs:Math.min(600,cue.durationMs/2);
const moving=(cue,time)=>time<cue.endMs&&time-cue.atMs<travel(cue);
function bound(bounds,target){
  const value=bounds[target];
  requireValue(value,'TARGET_MISSING','Cursor target geometry is unavailable.');
  // Completed visits retain coordinates, never a host DOM element or resolver.
  return {space:value.space,rect:{...value.rect}};
}

/** Only resolve the current destination and a source still needed for travel. */
export function cursorTargets(scene,time,retained){
  const {previous,current}=pair(scene,time);if(!current)return [];
  const targets=time<current.endMs||!retained?.has(current.id)?[current.target]:[];
  if(moving(current,time)){
    const source=current.fromTarget||(!retained?.has(previous?.id)&&previous?.target);
    if(source)targets.push(source);
  }
  return targets;
}

/** Sample authored motion at presentation time; retained endpoints survive retired targets. */
export function sampleCursor(scene,time,bounds,{initial=null,preset='gentle',retained,reduced=false}={}){
  const {previous,current}=pair(scene,time);
  if(!current)return {endpoint:initial,cue:null,destinations:[]};
  const active=time<current.endMs;
  const target=reduced?(bounds[current.target]?bound(bounds,current.target):retained?.get(current.id)):
    !active&&retained?.has(current.id)?retained.get(current.id):bound(bounds,current.target);
  const destinations=target?[[current.id,target]]:[],result={endpoint:target||initial,cue:null,destinations};
  if(!active||reduced)return result;
  const duration=travel(current),progress=duration?Math.min(1,(time-current.atMs)/duration):1;
  const source=progress>=1?target:current.fromTarget?bound(bounds,current.fromTarget):previous?(retained?.get(previous.id)||bound(bounds,previous.target)):initial;
  if(progress<1&&!current.fromTarget&&previous)destinations.push([previous.id,source]);
  return {...result,cue:current,source,target,progress:current.gesture==='drag'?progress:easing(progress,preset)};
}

export function cursorPosition(state,camera,origin,box){
  if(!state.cue)return null;
  const target=clientBounds(state.target,camera,origin);
  const source=state.source?clientBounds(state.source,camera,origin):{x:origin.x+box.x+box.width/2,y:origin.y+box.y+box.height/2,width:0,height:0};
  const from={x:source.x+source.width/2,y:source.y+source.height/2};
  return {x:from.x+(target.x+target.width/2-from.x)*state.progress,y:from.y+(target.y+target.height/2-from.y)*state.progress};
}
