import {createSurface} from './sdk/surface.js';
import {createEvaluator} from './studio-sdk/index.js';
const ns='http://www.w3.org/2000/svg';
const font={sans:'system-ui, sans-serif',serif:'Georgia, serif',mono:'ui-monospace, monospace'};
function svg(tag,attrs,parent){const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));parent.append(n);return n;}
export const TARGETS=[{id:'orbit.overview',label:'Workspace',element:'scene'},{id:'orbit.metrics',label:'Route metrics',element:'metrics'},{id:'orbit.map',label:'Route map',element:'route-map'},{id:'orbit.review',label:'Review panel',element:'review'},{id:'orbit.action',label:'Review button',element:'app-review'}];
/** Scene motion uses the existing surface owner. Controls/CC/cursor stay in independent layers. */
export function createCanvas({stage,scene,overlay,caption,cursor,handles,onInvalidate}){
  const surface=createSurface({viewport:stage,scene,overlay});
  if(surface.kind!=='managed-dom'){surface.destroy();throw new Error('This canvas cannot safely own the application transform.');}
  let dirty=true,measurement=null,project=null,evaluator=null,lastFrame=null,lastCaption='',disposed=false,viewZoom=1;
  const unsubscribe=surface.subscribe(()=>{dirty=true;onInvalidate?.();});
  function geometry(){
    if(dirty||!measurement){
      const elements=TARGETS.map(t=>document.getElementById(t.element)),snap=surface.snapshot(elements),bounds=Object.create(null);
      TARGETS.forEach((target,i)=>bounds[target.id]=snap.bounds[i].rect);
      measurement={bounds,box:{x:0,y:0,width:stage.clientWidth,height:stage.clientHeight}};dirty=false;
    }return measurement;
  }
  function render(input,timeMs,{reducedMotion=false,captions=true,zoom=1}={}){
    if(disposed)return null;if(project!==input){evaluator=createEvaluator(input);project=input;}
    // A responsive layout or hidden host panel can briefly have no drawing area.
    // Do not feed that transient viewport into strict geometry validation or retain
    // handles measured for an earlier layout. Missing real targets still fail below.
    if(stage.isConnected&&scene.isConnected&&overlay.isConnected&&(!stage.clientWidth||!stage.clientHeight)){
      dirty=true;measurement=null;lastFrame=null;caption.hidden=true;
      cursor.replaceChildren();handles.replaceChildren();stage.dataset.layout='pending';
      return null;
    }
    stage.dataset.layout='ready';
    viewZoom=zoom;const {bounds,box}=geometry(),frame=evaluator.sample(timeMs,bounds,box,{reducedMotion});lastFrame=frame;
    const cx=box.width/2,cy=box.height/2,display={x:cx+(frame.camera.x-cx)*zoom,y:cy+(frame.camera.y-cy)*zoom,scale:frame.camera.scale*zoom};
    surface.apply(display);
    const c=frame.caption;
    caption.hidden=!captions||!c;
    if(c&&captions){
      const s=c.style,unit=box.width/project.canvas.width,signature=JSON.stringify([c.clipId,c.text,c.words,c.wordIndex,s]);
      if(signature!==lastCaption){
        lastCaption=signature;
        if(c.words){caption.replaceChildren();c.words.forEach((w,i)=>{if(i)caption.append(document.createTextNode(' '));const n=document.createElement(i===c.wordIndex?'mark':'span');n.textContent=w.text;caption.append(n);});}
        else caption.textContent=c.text;
        Object.assign(caption.style,{fontFamily:font[s.font],fontWeight:String(s.weight),color:s.color,backgroundColor:s.background+Math.round(s.opacity*255).toString(16).padStart(2,'0'),textAlign:s.align,webkitTextStroke:s.outline?`${s.outline}px #17251d`:'0',paintOrder:'stroke fill'});
      }
      Object.assign(caption.style,{left:(cx+(box.width*s.x/100-cx)*zoom)+'px',top:(cy+(box.height*s.y/100-cy)*zoom)+'px',width:(box.width*s.width/100*zoom)+'px',fontSize:Math.max(12,s.size*unit)*zoom+'px',padding:s.padding*unit*zoom+'px',borderRadius:s.radius*unit*zoom+'px'});
    }
    cursor.replaceChildren();cursor.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
    if(frame.cursor){
      const c=frame.cursor,s=c.style,x=cx+(c.client.x-cx)*zoom,y=cy+(c.client.y-cy)*zoom,size=s.size*zoom;
      for(const [i,p] of c.trail.entries())svg('circle',{cx:cx+(p.x-cx)*zoom,cy:cy+(p.y-cy)*zoom,r:Math.max(2,size/10),fill:s.color,opacity:(.28-i*.07)*s.opacity},cursor);
      const group=svg('g',{transform:`translate(${x} ${y})`,opacity:s.opacity},cursor);
      if(s.halo)svg('circle',{r:s.halo*zoom,fill:s.color,opacity:.22},group);
      for(const g of c.gestures){const radius=(7+g.progress*28)*zoom;svg('circle',{r:radius,fill:'none',stroke:s.color,'stroke-width':2,opacity:1-g.progress},group);if(g.kind==='double-click')svg('circle',{r:radius*.6,fill:'none',stroke:s.stroke,'stroke-width':1,opacity:1-g.progress},group);}
      if(s.shape==='dot')svg('circle',{r:size/4,fill:s.color,stroke:s.stroke,'stroke-width':1.5},group);
      else {const path=s.shape==='hand'?'M6 25V12Q6 9 9 10L12 16V3Q12 0 15 2V12Q18 8 20 12Q23 10 25 14Q29 12 30 17L28 30H13Z':'M0 0L9 27L14 17L26 13Z';svg('path',{d:path,transform:`scale(${size/30})`,fill:s.color,stroke:s.stroke,'stroke-width':1.3,'stroke-linejoin':'round'},group);}
    }
    stage.dataset.scene=frame.sceneId;stage.dataset.time=String(Math.round(timeMs));
    return {frame,display,bounds,box};
  }
  function showHandles(clip,keyId,picking=false){
    handles.replaceChildren();if(!lastFrame)return;
    const {bounds,box}=geometry(),cam=surface.pose;handles.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
    const point=k=>{const r=bounds[k.target];return {x:cam.x+(r.x+r.width/2+k.x)*cam.scale,y:cam.y+(r.y+r.height/2+k.y)*cam.scale};};
    if(picking){for(const t of TARGETS){const b=bounds[t.id];svg('rect',{x:cam.x+b.x*cam.scale,y:cam.y+b.y*cam.scale,width:b.width*cam.scale,height:b.height*cam.scale,rx:4,fill:'none',stroke:'#456b3b','stroke-width':2,'stroke-dasharray':'5 4'},handles);}return;}
    if(!clip?.keys)return;
    const points=clip.keys.map(point);
    if(clip.gestures&&points.length>1){
      const parts=[`M${points[0].x} ${points[0].y}`];
      for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,k=clip.keys[i],curve=k.curve*cam.scale;parts.push(`Q${(a.x+b.x)/2-dy/len*curve} ${(a.y+b.y)/2+dx/len*curve} ${b.x} ${b.y}`);}
      svg('path',{d:parts.join(' '),fill:'none',stroke:'#ab7226','stroke-width':1.5,'stroke-dasharray':'4 4',opacity:.75},handles);
    }
    clip.keys.forEach((key,i)=>{const p=points[i];const n=svg('circle',{cx:p.x,cy:p.y,r:key.id===keyId?7:5,fill:key.id===keyId?'#f4ce7f':'#fffef6',stroke:'#375641','stroke-width':2,'data-key':key.id,'pointer-events':'all',style:'cursor:move'},handles);svg('title',{},n).textContent=`Keyframe ${i+1}; edit exact values in the inspector`;});
  }
  return {render,showHandles,get pose(){return surface.pose;},geometry,
    invalidate(){dirty=true;},hitTargets(x,y){const {bounds}=geometry(),cam=surface.pose,px=(x-cam.x)/cam.scale,py=(y-cam.y)/cam.scale;return TARGETS.filter(t=>{const b=bounds[t.id];return px>=b.x&&px<=b.x+b.width&&py>=b.y&&py<=b.y+b.height;});},
    destroy(){if(disposed)return;disposed=true;unsubscribe();surface.destroy();caption.replaceChildren();cursor.replaceChildren();handles.replaceChildren();},
  };
}
export function drawWaveform(svgNode,values){
  svgNode.replaceChildren();svgNode.setAttribute('viewBox','0 0 320 55');
  if(!values)return;
  const top=values.map((v,i)=>`${i*320/(values.length-1)},${27-Math.min(1,v)*24}`),bottom=[...values].reverse().map((v,i)=>`${320-i*320/(values.length-1)},${27+Math.min(1,v)*24}`);
  svg('polygon',{points:[...top,...bottom].join(' '),fill:'#4d8082'},svgNode);
}
