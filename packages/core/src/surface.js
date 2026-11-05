import {DirectorError, requireValue} from './errors.js';
import {IDENTITY, rect, pose, fit, interpolate} from './geometry.js';
import {StyleJournal} from './journal.js';
const owners = new WeakMap();
const parentOf = node => node.parentElement || node.getRootNode()?.host || null;
const topLayer = el => { try { return !!el.closest(':modal, :popover-open'); } catch { return !!el.closest('dialog[open]'); } };
function checkChain(element, stop, win, target = false) {
  for (let node=element; node && node!==stop; node=parentOf(node)) {
    const css=win.getComputedStyle(node), matrix=new win.DOMMatrix(css.transform==='none'?undefined:css.transform);
    requireValue(matrix.is2D && Math.abs(matrix.b)<1e-8 && Math.abs(matrix.c)<1e-8 && matrix.a>0 && matrix.d>0 &&
      Math.abs(matrix.a-matrix.d)<1e-8 && (target || Math.abs(matrix.a-1)<1e-8) &&
      css.perspective==='none' && (!css.rotate || css.rotate==='none') && (!css.scale || css.scale==='none') &&
      (!css.translate || css.translate==='none') && (!css.zoom || Number(css.zoom)===1),
      'UNSUPPORTED_TRANSFORM', 'Use overlay-only mode for unsupported transform or CSS zoom chains.');
  }
}
/** Explicit host wrapper only. No DOM reparenting, framework remounts or network access. */
export function createSurface({viewport, scene, overlay, kind='managed-dom', allowPositioned=false, insets={}}) {
  requireValue(viewport?.nodeType===1 && scene?.nodeType===1 && overlay?.nodeType===1,
    'INVALID_SURFACE', 'Viewport, scene and independent overlay elements are required.');
  const doc=scene.ownerDocument, win=doc.defaultView;
  requireValue(win && viewport.ownerDocument===doc && overlay.ownerDocument===doc && viewport.contains(scene) &&
    !scene.contains(overlay) && !overlay.contains(scene), 'INVALID_SURFACE', 'Use a scene inside its viewport and a separate overlay.');
  requireValue(['managed-dom','overlay-only'].includes(kind), 'INVALID_SURFACE', 'Unknown surface strategy.');
  requireValue(!owners.has(scene), 'SURFACE_BUSY', 'Another controller owns this scene.');
  let strategy=kind, destroyed=false, camera={...IDENTITY}, revision=0, cameraRevision=0;
  const warnings=[], journal=new StyleJournal(), listeners=new Set(), cleanup=[];
  if (strategy==='managed-dom') {
    try {
      requireValue(win.getComputedStyle(scene).transform==='none', 'EXISTING_TRANSFORM', 'Use a dedicated untransformed scene wrapper.');
      checkChain(scene,null,win);
      const walker=doc.createTreeWalker(scene,win.NodeFilter.SHOW_ELEMENT); let node, count=0;
      while ((node=walker.nextNode()) && ++count<=10000) {
        if (['fixed','sticky'].includes(win.getComputedStyle(node).position) && !allowPositioned)
          throw new DirectorError('POSITIONED_DESCENDANT', 'Fixed/sticky children require explicit host opt-in or overlay-only mode.');
      }
      requireValue(count<=10000,'PREFLIGHT_LIMIT','Surface preflight exceeded 10,000 elements.');
    } catch (error) { if (!(error instanceof DirectorError)) throw error; strategy='overlay-only';warnings.push(error.diagnostic); }
  }
  owners.set(scene, true);
  const live=()=>requireValue(!destroyed,'DESTROYED','The surface has been destroyed.');
  const invalidate=()=>{ if (!destroyed) {revision++;for(const listener of [...listeners]) listener(revision);} };
  function on(target,name,fn,options) {target.addEventListener(name,fn,options);cleanup.push(()=>target.removeEventListener(name,fn,options));}
  const resize=new win.ResizeObserver(invalidate);resize.observe(viewport);resize.observe(scene);cleanup.push(()=>resize.disconnect());
  let signature=scene.style.cssText;
  const mutation=new win.MutationObserver(records=>{
    if (records.some(record=>record.target!==scene || record.attributeName!=='style' || scene.style.cssText!==signature)) invalidate();
  });
  mutation.observe(scene,{childList:true,subtree:true,attributes:true});cleanup.push(()=>mutation.disconnect());
  on(doc,'scroll',invalidate,true);on(win,'resize',invalidate);
  if(win.visualViewport){on(win.visualViewport,'resize',invalidate);on(win.visualViewport,'scroll',invalidate);}
  function snapshot(targets=[]) {
    live();requireValue(scene.isConnected&&viewport.isConnected&&overlay.isConnected,'SURFACE_REMOVED','Surface nodes must remain connected.');
    if(strategy==='managed-dom') checkChain(parentOf(scene),null,win);
    const sr=scene.getBoundingClientRect(), vr=viewport.getBoundingClientRect(), scale=camera.scale;
    const origin={x:sr.left-camera.x,y:sr.top-camera.y};
    // DOMMatrix is local to the surface's document, including same-origin frames.
    const matrix=new win.DOMMatrix([scale,0,0,scale,sr.left,sr.top]), inverse=matrix.inverse();
    requireValue([inverse.a,inverse.d,inverse.e,inverse.f].every(Number.isFinite),'UNSUPPORTED_TRANSFORM','Camera transform is not invertible.');
    const box={x:vr.left+viewport.clientLeft-origin.x+(insets.left||0),
      y:vr.top+viewport.clientTop-origin.y+(insets.top||0),
      width:viewport.clientWidth-(insets.left||0)-(insets.right||0),
      height:viewport.clientHeight-(insets.top||0)-(insets.bottom||0)};
    rect(box);
    const bounds=targets.map(target=>{
      requireValue(target?.nodeType===1&&target.ownerDocument===doc&&target.isConnected,'TARGET_MISSING','A target is unavailable.');
      const client=rect(target.getBoundingClientRect()), member=scene.contains(target)&&!topLayer(target)&&strategy==='managed-dom';
      if(member)checkChain(target,scene,win,true);
      const point=member?inverse.transformPoint({x:client.x,y:client.y}):client;
      return {element:target,space:member?'scene':'client',revision,cameraRevision,
        rect:member?{x:point.x,y:point.y,width:client.width/scale,height:client.height/scale}:client};
    });
    return {origin,box,bounds,revision,cameraRevision};
  }
  function apply(value) {
    live();value=pose(value);
    if(strategy!=='managed-dom') return;
    journal.write(scene,'transform-origin','0px 0px');
    journal.write(scene,'transform',`translate(${value.x}px, ${value.y}px) scale(${value.scale})`);
    signature=scene.style.cssText;camera=value;cameraRevision++;
  }
  return {viewport,scene,overlay,kind:strategy,warnings:Object.freeze(warnings),
    get pose(){return {...camera};},get revision(){return revision;},snapshot,apply,invalidate,
    subscribe(listener){live();listeners.add(listener);return()=>listeners.delete(listener);},
    destroy(){if(destroyed)return;destroyed=true;for(const fn of cleanup)fn();listeners.clear();journal.restore();owners.delete(scene);}
  };
}
/** An interruptible camera; the player uses surface.apply with its own single timeline. */
export function createCamera(options) {
  const surface=createSurface(options), win=surface.scene.ownerDocument.defaultView;
  const scheduler=options.scheduler||{now:()=>win.performance.now(),request:fn=>win.requestAnimationFrame(fn),cancel:id=>win.cancelAnimationFrame(id)};
  const preference=win.matchMedia('(prefers-reduced-motion: reduce)');
  let active=null, frame=null, destroyed=false, dirty=true;
  const unsubscribe=surface.subscribe(()=>{dirty=true;});
  function cancel(reason='interrupted') {
    if(frame!==null)scheduler.cancel(frame);frame=null;
    if(active){const old=active;active=null;old.signal?.removeEventListener('abort',old.abort);old.resolve({status:reason,pose:surface.pose});}
  }
  function endPose(target, framing) {
    if(!target || preference.matches || surface.kind==='overlay-only')return {...IDENTITY};
    const element=typeof target==='function'?target():target;
    requireValue(!Array.isArray(element),'TARGET_AMBIGUOUS','A camera target must resolve to one element.');
    const measurement=surface.snapshot([element]);
    if(measurement.bounds[0].space!=='scene')return {...IDENTITY};
    const result=fit(measurement.bounds[0].rect,measurement.box,framing);
    requireValue(!result.clipped,'FRAMING_CLIPPED','The target cannot fit inside the selected scale bounds.');
    return result.pose;
  }
  function tick(now) {
    if(!active)return;
    const run=active;
    try {
      if(dirty){
        const to=endPose(run.target,run.framing);
        run.duration=Math.max(0,run.duration-(now-run.start));
        run.from=surface.pose;run.start=now;run.to=to;dirty=false;
      }
      const progress=run.duration===0?1:Math.min(1,(now-run.start)/run.duration);
      surface.apply(interpolate(run.from,run.to,progress,run.easing));
      if(progress>=1){cancel('completed');return;}
      frame=scheduler.request(tick);
    }catch(error){cancel('interrupted');options.onDiagnostic?.(error.diagnostic);}
  }
  function move(target, {durationMs=700,easing='gentle',signal,...framing}={}) {
    requireValue(!destroyed,'DESTROYED','The camera has been destroyed.');
    requireValue(Number.isFinite(durationMs)&&durationMs>=0&&durationMs<=60000,'INVALID_TIME','Invalid camera duration.');
    interpolate(IDENTITY,IDENTITY,0,easing); // Validate even for reduced-motion/no-op transitions.
    const to=endPose(target,framing); // Validate before interrupting the current motion.
    cancel();
    if(signal?.aborted)return Promise.resolve({status:'interrupted',pose:surface.pose});
    return new Promise(resolve=>{
      const abort=()=>cancel();
      active={target,framing,to,from:surface.pose,start:scheduler.now(),duration:preference.matches?0:durationMs,easing,signal,abort,resolve};
      signal?.addEventListener('abort',abort,{once:true});dirty=false;
      if(active.duration===0){surface.apply(to);cancel('completed');}else frame=scheduler.request(tick);
    });
  }
  const motion=()=>{if(preference.matches){cancel();surface.apply(IDENTITY);}};
  preference.addEventListener('change',motion);
  return {surface,focus:(target,options)=>move(target,options),reset:options=>move(null,options),cancel,
    destroy(){if(destroyed)return;destroyed=true;cancel('destroyed');unsubscribe();preference.removeEventListener('change',motion);surface.destroy();}}
}
