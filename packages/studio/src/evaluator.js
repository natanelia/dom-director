import {fit, interpolate, easing} from '@dom-director/core';
import {requireProject, locate, CAPTION_THEME, CURSOR_THEME, duration} from './project.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function keyPair(keys,time){
  if(time<=keys[0].atMs)return [keys[0],keys[0],1];
  for(let i=1;i<keys.length;i++)if(time<keys[i].atMs)return [keys[i-1],keys[i],(time-keys[i-1].atMs)/(keys[i].atMs-keys[i-1].atMs)];
  return [keys.at(-1),keys.at(-1),1];
}
function point(key,bounds){const r=Object.hasOwn(bounds,key.target)?bounds[key.target]:null;if(!r)throw new Error('Target “'+key.target+'” is unavailable.');return {x:r.x+r.width/2+key.x,y:r.y+r.height/2+key.y};}
function cursorPoint(keys,time,bounds){
  const [a,b,t]=keyPair(keys,time),from=point(a,bounds),to=point(b,bounds),u=easing(t,b.easing);
  const dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy)||1,control={x:(from.x+to.x)/2-dy/len*b.curve,y:(from.y+to.y)/2+dx/len*b.curve};
  return {x:(1-u)**2*from.x+2*(1-u)*u*control.x+u*u*to.x,y:(1-u)**2*from.y+2*(1-u)*u*control.y+u*u*to.y};
}
function pose(key,bounds,box){const r=Object.hasOwn(bounds,key.target)?bounds[key.target]:null;if(!r)throw new Error('Target “'+key.target+'” is unavailable.');const f=fit(r,box,{paddingPx:Math.min(24,box.width*.025),minScale:.01,maxScale:8}).pose;const scale=f.scale*key.zoom;return {x:box.x+box.width/2-(r.x+r.width/2+key.x)*scale,y:box.y+box.height/2-(r.y+r.height/2+key.y)*scale,scale};}
export function createEvaluator(input){
  const p=requireProject(input),total=duration(p);
  const targets=[...new Set(p.tracks.flatMap(t=>t.clips.flatMap(c=>c.keys?.map(k=>k.target)||[])))];
  function sample(timeMs,bounds,box={x:0,y:0,width:p.canvas.width,height:p.canvas.height},{reducedMotion=false,captionTrack=p.captionTrack}={}){
    if(!Number.isFinite(timeMs))throw new Error('Playhead time must be finite.');
    const at=locate(p,clamp(timeMs,0,total)),t=Math.min(at.timeMs,at.scene.durationMs-.0001);
    const result={sceneId:at.scene.id,sceneTimeMs:at.timeMs,timeMs:at.projectTimeMs,camera:fit({x:0,y:0,width:p.canvas.width,height:p.canvas.height},box,{paddingPx:0,minScale:.01,maxScale:8}).pose,cursor:null,caption:null,voice:[]};
    for(const track of p.tracks){
      if(!track.enabled)continue;
      const clips=track.clips.filter(c=>c.sceneId===at.scene.id).sort((a,b)=>a.startMs-b.startMs);
      const active=clips.find(c=>t>=c.startMs&&t<c.startMs+c.durationMs);
      if(track.kind==='camera'){
        const c=active||clips.filter(c=>c.startMs<=t).at(-1);if(!c)continue;
        const source=c.offsetMs+clamp(t-c.startMs,0,c.durationMs);
        const [a,b,u]=keyPair(c.keys,source);
        result.camera=reducedMotion?pose(c.keys.at(-1),bounds,box):interpolate(pose(a,bounds,box),pose(b,bounds,box),u,b.easing);
      }else if(track.kind==='cursor'&&active&&!reducedMotion){
        const c=active,source=c.offsetMs+t-c.startMs,s={...CURSOR_THEME,...p.cursorTheme,...track.style,...c.style};
        result.cursor={clipId:c.id,...cursorPoint(c.keys,source,bounds),style:s,trail:s.trail?[80,160,240].map(delta=>cursorPoint(c.keys,Math.max(c.offsetMs,source-delta),bounds)):[],gestures:c.gestures.filter(g=>g.atMs>=c.offsetMs&&g.atMs<c.offsetMs+c.durationMs&&source>=g.atMs&&source-g.atMs<700).map(g=>({...g,progress:(source-g.atMs)/700}))};
      }else if(track.kind==='captions'&&track.id===captionTrack&&active){
        result.caption={clipId:active.id,text:active.text,style:{...CAPTION_THEME,...p.captionTheme,...track.style,...active.style},words:active.words||null,wordIndex:active.words?.findIndex(w=>t-active.startMs>=w.startMs&&t-active.startMs<w.endMs)??-1};
      }else if(track.kind==='voice'&&active)result.voice.push({clipId:active.id,assetId:active.assetId,sourceTimeMs:active.sourceInMs+t-active.startMs});
    }
    if(result.cursor){const k=result.camera;result.cursor.client={x:k.x+result.cursor.x*k.scale,y:k.y+result.cursor.y*k.scale};result.cursor.trail=result.cursor.trail.map(p=>({x:k.x+p.x*k.scale,y:k.y+p.y*k.scale}));}
    return result;
  }
  return Object.freeze({project:p,targets,durationMs:total,sample});
}
