import {IDENTITY,interpolate} from './geometry.js';
import {requireValue} from './errors.js';
import {createGeometryCache} from './targets.js';
import {sampleVisual,neededTargets,clientBounds} from './visual.js';
import {cursorTargets,sampleCursor,cursorPosition,cursorAnchor} from './cursor-motion.js';
/** One owned overlay subtree; all text is textContent, never executable markup. */
export function createRenderer(surface,registry){
  const doc=surface.scene.ownerDocument,win=doc.defaultView,root=doc.createElement('div'),nodes=new Map();
  for(let ancestor=surface.overlay;ancestor;ancestor=ancestor.parentElement){
    const css=win.getComputedStyle(ancestor);
    requireValue(css.transform==='none'&&css.perspective==='none'&&css.filter==='none'&&
      !/(paint|layout|strict|content)/u.test(css.contain), 'OVERLAY_UNSUPPORTED','Overlay ancestors must not create a transformed fixed-position containing block.');
  }
  root.dataset.directorOverlay='';root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483000';surface.overlay.append(root);
  const pointer=Symbol('cursor'),endpoints=new Map(),cursorEndings=new Map(),cursorHistory=new Map(),cache=createGeometryCache(surface,registry);let lastRevision='',lastPose=IDENTITY,correction=null,lastVisit='',lastTime=0;
  function nodeFor(cue,key=cue.id){
    let node=nodes.get(key);if(node)return node;
    node=doc.createElement('div');node.dataset.cue=cue.id;node.dataset.kind=cue.kind;
    node.style.cssText='position:absolute;box-sizing:border-box;pointer-events:none';
    if(cue.kind==='annotation'){
      node.textContent=cue.text;node.style.cssText+=';padding:12px;border:1px solid currentColor;border-radius:8px;background:Canvas;color:CanvasText;font:16px/1.4 system-ui;max-width:320px;max-height:40vh;overflow:auto;pointer-events:auto';
    }else if(cue.kind==='cursor'){
      node.textContent=cue.gesture==='touch'?'◎':'↖';node.setAttribute('aria-hidden','true');node.style.cssText+=';font:32px/1 system-ui;color:var(--director-accent,#245942);text-shadow:0 0 2px white';
      node.dataset.gesture=cue.gesture;node.title='Simulated pointer: does not click the application';
    }else{
      node.setAttribute('aria-hidden','true');node.style.cssText+=';border:3px solid var(--director-accent,#245942);border-radius:5px';
      if(cue.style==='spotlight')node.style.boxShadow='0 0 0 100vmax rgb(0 0 0 / .35)';
      if(cue.style==='underline'){node.style.border='0';node.style.borderBottom='3px solid var(--director-accent,#245942)';}
    }
    root.append(node);nodes.set(key,node);return node;
  }
  return {get geometryReads(){return cache.reads;},invalidate(){cache.invalidate();},
    render(plan,snapshot,{reduced=false,animate=false}={}){
      const refs=[],cursorEnabled=!reduced&&surface.kind!=='overlay-only';
      const visits=new Set(snapshot.path.map(visit=>visit.visitId));
      for(const id of cursorHistory.keys())if(!visits.has(id))cursorHistory.delete(id);
      for(const id of cursorEndings.keys())if(!visits.has(id))cursorEndings.delete(id);
      // A revisited scene can establish new geometry. Later cursor sources must
      // use that visit's camera as well as its refreshed cursor destination.
      if(snapshot.timeMs<plan.scenes[snapshot.sceneId].durationMs){endpoints.delete(snapshot.visitId);cursorEndings.delete(snapshot.visitId);}
      if(snapshot.visitId!==lastVisit||snapshot.timeMs<lastTime){
        const retained=cursorHistory.get(snapshot.visitId);
        if(retained)for(const cue of plan.scenes[snapshot.sceneId].cues)if(cue.kind==='cursor'&&cue.atMs>snapshot.timeMs)retained.delete(cue.id);
      }
      for(const visit of snapshot.path){
        const current=visit.visitId===snapshot.visitId,scene=plan.scenes[visit.sceneId],time=current?snapshot.timeMs:scene.durationMs;
        if(current||!endpoints.has(visit.visitId))refs.push(...neededTargets(scene,time));
        if(cursorEnabled&&(current||!cursorEndings.has(visit.visitId)))refs.push(...cursorTargets(scene,time,cursorHistory.get(visit.visitId)));
      }
      const ids=refs.map(alias=>plan.script.targets[alias].ref),measurement=cache.measure(ids),bounds=Object.create(null);
      for(const alias of refs)bounds[alias]=measurement.bounds[plan.script.targets[alias].ref];
      let initial=IDENTITY,initialCursor=null,result,cursor;
      for(const visit of snapshot.path){
        const scene=plan.scenes[visit.sceneId],current=visit.visitId===snapshot.visitId,time=current?snapshot.timeMs:scene.durationMs;
        const departure=cursorAnchor(initialCursor,initial,measurement.box);
        // Completed visits do not require targets from a previous route to remain mounted.
        if(!current&&endpoints.has(visit.visitId))initial=endpoints.get(visit.visitId);
        else{
          result=sampleVisual(scene,time,bounds,measurement.box,{initial,reduced:reduced||surface.kind==='overlay-only',defaults:plan.script.defaults});initial=result.camera;
          // An authored ending survives retired targets. A scene without a
          // camera cue must inherit afresh after an earlier scene is revisited.
          if(!current&&scene.cues.some(cue=>cue.kind==='camera'))endpoints.set(visit.visitId,{...initial});
        }
        if(!current&&cursorEndings.has(visit.visitId)){initialCursor=cursorEndings.get(visit.visitId);continue;}
        let retained=cursorHistory.get(visit.visitId);if(!retained){retained=new Map();cursorHistory.set(visit.visitId,retained);}
        cursor=sampleCursor(scene,time,bounds,{initial:departure,preset:plan.script.defaults?.easing||'gentle',retained,reduced:!cursorEnabled});initialCursor=cursor.endpoint;
        for(const [id,point]of cursor.destinations)retained.set(id,point);
        if(!current&&cursorEnabled)cursorEndings.set(visit.visitId,initialCursor);
      }
      const revision=String(measurement.geometryRevision);
      if(animate&&!reduced&&!correction&&lastRevision&&revision!==lastRevision&&snapshot.visitId===lastVisit)
        correction={from:lastPose,start:snapshot.timeMs};
      if(!animate||reduced||snapshot.visitId!==lastVisit)correction=null;
      if(correction){const progress=Math.min(1,(snapshot.timeMs-correction.start)/200);result.camera=interpolate(correction.from,result.camera,Math.max(0,progress));if(progress>=1)correction=null;}
      lastRevision=revision;lastVisit=snapshot.visitId;lastTime=snapshot.timeMs;lastPose=result.camera;
      // All geometry reads finished before any transform/overlay writes.
      surface.apply(result.camera);
      if(snapshot.timeMs>=plan.scenes[snapshot.sceneId].durationMs){
        if(plan.scenes[snapshot.sceneId].cues.some(cue=>cue.kind==='camera'))endpoints.set(snapshot.visitId,{...result.camera});
        if(cursorEnabled)cursorEndings.set(snapshot.visitId,initialCursor);
      }
      const visible=new Set();
      for(const cue of result.overlays){
        if(cue.kind==='cursor')continue;
        visible.add(cue.id);const node=nodeFor(cue),target=clientBounds(bounds[cue.target],result.camera,measurement.origin);
        let x=target.x,y=target.y;
        if(cue.kind==='annotation'){
          const placement=cue.placement||'auto';
          x=placement==='left'?target.x-324:placement==='right'?target.x+target.width+8:target.x;
          y=placement==='top'?target.y-100:placement==='left'||placement==='right'?target.y:target.y+target.height+8;
          x=Math.max(8,Math.min(x,win.innerWidth-328));y=Math.max(8,Math.min(y,win.innerHeight-160));
        }else{node.style.width=target.width+'px';node.style.height=target.height+'px';}
        node.style.transform=`translate(${x}px, ${y}px)`;
      }
      const position=cursorEnabled?cursorPosition(cursor,result.camera,measurement.origin,measurement.box):null;
      if(position){
        // A single neutral pointer survives gaps; gestures keep their authored intervals.
        const cue=cursor.cue||{id:'',kind:'cursor',gesture:'point'},node=nodeFor(cue,pointer);
        node.dataset.cue=cue.id;node.dataset.gesture=cue.gesture;
        node.textContent=cue.gesture==='touch'?'◎':'↖';
        node.style.transform=`translate(${position.x}px, ${position.y}px)`;visible.add(pointer);
      }
      for(const [id,node]of nodes)if(!visible.has(id)){node.remove();nodes.delete(id);}
      return result;
    },clear(){for(const node of nodes.values())node.remove();nodes.clear();endpoints.clear();cursorEndings.clear();cursorHistory.clear();correction=null;lastRevision='';lastVisit='';lastTime=0;},
    destroy(){cache.destroy();root.remove();nodes.clear();endpoints.clear();cursorEndings.clear();cursorHistory.clear();}
  };
}
