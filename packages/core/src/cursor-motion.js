import {clamp,easing} from './geometry.js';
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

/** The outgoing camera fixes the departure position before the next scene pans. */
export function cursorAnchor(endpoint,camera,box){
  if(!endpoint||endpoint.space==='client')return endpoint;
  const point=cursorPosition(held(endpoint),camera,{x:0,y:0},box);
  return {space:'viewport',rect:{...point,width:0,height:0}};
}
const held=endpoint=>({endpoint,cue:null,source:endpoint,target:endpoint,progress:1,destinations:[]});
const cursorBounds=(value,camera,origin)=>value.space==='viewport'?
  {...value.rect,x:origin.x+value.rect.x,y:origin.y+value.rect.y}:clientBounds(value,camera,origin);
const center=value=>({x:value.x+value.width/2,y:value.y+value.height/2});
function visiblePoint(point,origin,box){
  // Leave room for the pointer glyph and an 8 px margin inside the safe box.
  const left=origin.x+box.x+8,top=origin.y+box.y+8;
  return {x:clamp(point.x,left,Math.max(left,origin.x+box.x+box.width-48)),
    y:clamp(point.y,top,Math.max(top,origin.y+box.y+box.height-48))};
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
  if(!current)return reduced?{...held(initial),target:null}:held(initial);
  const active=time<current.endMs;
  const target=reduced?(bounds[current.target]?bound(bounds,current.target):retained?.get(current.id)):
    !active&&retained?.has(current.id)?retained.get(current.id):bound(bounds,current.target);
  const destinations=target?[[current.id,target]]:[],result={...held(target||initial),destinations};
  if(reduced)return {...result,target:null};
  if(!active)return result;
  const duration=travel(current),progress=duration?Math.min(1,(time-current.atMs)/duration):1;
  const source=progress>=1?target:current.fromTarget?bound(bounds,current.fromTarget):previous?(retained?.get(previous.id)||bound(bounds,previous.target)):initial;
  if(progress<1&&!current.fromTarget&&previous)destinations.push([previous.id,source]);
  return {...result,cue:current,source,target,progress:current.gesture==='drag'?progress:easing(progress,preset)};
}

export function cursorPosition(state,camera,origin,box){
  if(!state.target)return null;
  const target=cursorBounds(state.target,camera,origin);
  const source=state.source?cursorBounds(state.source,camera,origin):{x:origin.x+box.x+box.width/2,y:origin.y+box.y+box.height/2,width:0,height:0};
  let from=center(source),to=center(target);
  // Ordinary pointers stay visible while a pan moves their targets offscreen.
  // Keep explicit drag paths and client-space host targets at their exact coordinates.
  if(state.cue?.gesture!=='drag'&&state.target.space!=='client'&&state.source?.space!=='client'){
    // Bound endpoints before easing so a distant offscreen source cannot
    // consume the motion and leave all visible travel until the final frames.
    from=visiblePoint(from,origin,box);to=visiblePoint(to,origin,box);
  }
  return {x:from.x+(to.x-from.x)*state.progress,y:from.y+(to.y-from.y)*state.progress};
}
