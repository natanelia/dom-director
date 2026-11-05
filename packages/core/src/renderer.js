import {IDENTITY,interpolate} from './geometry.js';
import {requireValue} from './errors.js';
import {createGeometryCache} from './targets.js';
import {sampleVisual,neededTargets,clientBounds} from './visual.js';
/** One owned overlay subtree; all text is textContent, never executable markup. */
export function createRenderer(surface,registry){
  const doc=surface.scene.ownerDocument,win=doc.defaultView,root=doc.createElement('div'),nodes=new Map();
  for(let ancestor=surface.overlay;ancestor;ancestor=ancestor.parentElement){
    const css=win.getComputedStyle(ancestor);
    requireValue(css.transform==='none'&&css.perspective==='none'&&css.filter==='none'&&
      !/(paint|layout|strict|content)/u.test(css.contain), 'OVERLAY_UNSUPPORTED','Overlay ancestors must not create a transformed fixed-position containing block.');
  }
  root.dataset.directorOverlay='';root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483000';surface.overlay.append(root);
  const cache=createGeometryCache(surface,registry);let lastRevision='',lastPose=IDENTITY,correction=null,lastVisit='';
  function nodeFor(cue){
    let node=nodes.get(cue.id);if(node)return node;
    node=doc.createElement('div');node.dataset.cue=cue.id;node.dataset.kind=cue.kind;
    node.style.cssText='position:absolute;box-sizing:border-box;pointer-events:none';
    if(cue.kind==='annotation'){
      node.textContent=cue.text;node.style.cssText+=';padding:12px;border:1px solid currentColor;border-radius:8px;background:Canvas;color:CanvasText;font:16px/1.4 system-ui;max-width:320px;max-height:40vh;overflow:auto;pointer-events:auto';
    }else if(cue.kind==='cursor'){
      node.textContent=cue.gesture==='touch'?'◎':'↖';node.setAttribute('aria-hidden','true');node.style.cssText+=';font:32px system-ui;color:var(--director-accent,#245942);text-shadow:0 0 2px white';
      node.dataset.gesture=cue.gesture;node.title='Simulated pointer: does not click the application';
    }else{
      node.setAttribute('aria-hidden','true');node.style.cssText+=';border:3px solid var(--director-accent,#245942);border-radius:5px';
      if(cue.style==='spotlight')node.style.boxShadow='0 0 0 100vmax rgb(0 0 0 / .35)';
      if(cue.style==='underline'){node.style.border='0';node.style.borderBottom='3px solid var(--director-accent,#245942)';}
    }
    root.append(node);nodes.set(cue.id,node);return node;
  }
  return {get geometryReads(){return cache.reads;},invalidate(){cache.invalidate();},
    render(plan,snapshot,{reduced=false,animate=false}={}){
      const refs=[];
      for(const visit of snapshot.path){const scene=plan.scenes[visit.sceneId],time=visit.visitId===snapshot.visitId?snapshot.timeMs:scene.durationMs;refs.push(...neededTargets(scene,time));}
      const ids=refs.map(alias=>plan.script.targets[alias].ref),measurement=cache.measure(ids),bounds=Object.create(null);
      for(const alias of refs)bounds[alias]=measurement.bounds[plan.script.targets[alias].ref];
      let initial=IDENTITY,result;
      for(const visit of snapshot.path){const scene=plan.scenes[visit.sceneId],time=visit.visitId===snapshot.visitId?snapshot.timeMs:scene.durationMs;
        result=sampleVisual(scene,time,bounds,measurement.box,{initial,reduced:reduced||surface.kind==='overlay-only',defaults:plan.script.defaults});initial=result.camera;}
      const revision=String(measurement.geometryRevision);
      if(animate&&!reduced&&!correction&&lastRevision&&revision!==lastRevision&&snapshot.visitId===lastVisit)
        correction={from:lastPose,start:snapshot.timeMs};
      if(!animate||reduced||snapshot.visitId!==lastVisit)correction=null;
      if(correction){const progress=Math.min(1,(snapshot.timeMs-correction.start)/200);result.camera=interpolate(correction.from,result.camera,Math.max(0,progress));if(progress>=1)correction=null;}
      lastRevision=revision;lastVisit=snapshot.visitId;lastPose=result.camera;
      // All geometry reads finished before any transform/overlay writes.
      surface.apply(result.camera);
      const visible=new Set();
      for(const cue of result.overlays){
        visible.add(cue.id);const node=nodeFor(cue),target=clientBounds(bounds[cue.target],result.camera,measurement.origin);
        let x=target.x,y=target.y;
        if(cue.kind==='cursor'){
          const source=cue.fromTarget?clientBounds(bounds[cue.fromTarget],result.camera,measurement.origin):{x:measurement.origin.x+measurement.box.x+measurement.box.width/2,y:measurement.origin.y+measurement.box.y+measurement.box.height/2,width:0,height:0};
          const travel=cue.gesture==='drag'?cue.durationMs:Math.min(600,cue.durationMs/2);
          const progress=travel?Math.min(1,(snapshot.timeMs-cue.atMs)/travel):1;
          x=source.x+source.width/2+(target.x+target.width/2-source.x-source.width/2)*progress;
          y=source.y+source.height/2+(target.y+target.height/2-source.y-source.height/2)*progress;
        }else if(cue.kind==='annotation'){
          const placement=cue.placement||'auto';
          x=placement==='left'?target.x-324:placement==='right'?target.x+target.width+8:target.x;
          y=placement==='top'?target.y-100:placement==='left'||placement==='right'?target.y:target.y+target.height+8;
          x=Math.max(8,Math.min(x,win.innerWidth-328));y=Math.max(8,Math.min(y,win.innerHeight-160));
        }else{node.style.width=target.width+'px';node.style.height=target.height+'px';}
        node.style.transform=`translate(${x}px, ${y}px)`;
      }
      for(const [id,node]of nodes)if(!visible.has(id)){node.remove();nodes.delete(id);}
      return result;
    },clear(){for(const node of nodes.values())node.remove();nodes.clear();correction=null;lastRevision='';lastVisit='';},
    destroy(){cache.destroy();root.remove();nodes.clear();}
  };
}
