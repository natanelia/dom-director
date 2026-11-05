import {IDENTITY,fit,interpolate,project,clamp} from './geometry.js';
import {requireValue} from './errors.js';
export function neededTargets(scene,time){
  const ids=[];for(const cue of scene.cues)if(cue.atMs<=time&&(cue.kind==='camera'||time<cue.endMs))for(const field of ['target','fromTarget'])if(cue[field])ids.push(cue[field]);return ids;
}
/** Pure, exact-time visual reconstruction. Cursor gestures never dispatch input. */
export function sampleVisual(scene,time,bounds,safe,{initial=IDENTITY,reduced=false,defaults={}}={}){
  requireValue(Number.isFinite(time)&&time>=0,'INVALID_TIME','Visual sample time must be finite and nonnegative.');
  let camera=initial;const overlays=[];
  for(const cue of scene.cues){
    if(cue.atMs>time)break;
    const target=cue.target?bounds[cue.target]:null;
    if(cue.kind==='camera'){
      if(cue.target)requireValue(target,'TARGET_MISSING','Camera target geometry is unavailable.');
      const result=cue.reset||target?.space==='client'?{pose:IDENTITY,clipped:false}:fit(target.rect,safe,{paddingPx:cue.paddingPx??(cue.fit==='context'?48:24),minScale:cue.minScale??.5,maxScale:cue.maxScale??defaults.maxScale??3});
      requireValue(!result.clipped,'FRAMING_CLIPPED','Camera bounds prevent the target from fitting.');
      camera=interpolate(camera,result.pose,cue.durationMs?clamp((time-cue.atMs)/cue.durationMs,0,1):1,cue.easing||defaults.easing||'gentle');
    }else if(['annotation','highlight','cursor'].includes(cue.kind)&&time<cue.endMs){requireValue(target,'TARGET_MISSING','Visual target geometry is unavailable.');overlays.push(cue);}
  }
  if(reduced)camera=IDENTITY;
  const caption=(scene.narration?.cues||[]).filter(c=>c.startMs<=time&&time<c.endMs).map(c=>c.text).join('\n');
  return {camera,overlays:reduced?overlays.filter(c=>c.kind!=='cursor'):overlays,caption};
}
export const clientBounds=(bound,camera,origin)=>bound.space==='client'?bound.rect:project(bound.rect,camera,origin);
