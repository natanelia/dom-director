import {compile} from './compiler.js';
import {createSurface} from './surface.js';
import {createTargetRegistry} from './targets.js';
import {createRenderer} from './renderer.js';
import {Session} from './session.js';
import {DirectorError,requireValue,diagnostic} from './errors.js';
import {freezeData} from './json.js';
import {IDENTITY} from './geometry.js';
let serial=0;
class PlanError extends DirectorError {constructor(diagnostics){super('COMPILE_FAILED','Script validation failed.','compile');this.diagnostics=diagnostics;}}
/** Browser host facade. Expected command failures return structured Results. */
export function createDirector({surface:surfaceOptions,targets={},registry:createRegistry,mode='watch',scheduler,barriers,clock}={}){
  const surface=createSurface(surfaceOptions),doc=surface.scene.ownerDocument,win=doc.defaultView;
  let renderer,registry;
  try{registry=createRegistry||createTargetRegistry(targets);renderer=createRenderer(surface,registry);}catch(error){surface.destroy();throw error;}
  const timing=scheduler||{now:()=>win.performance.now(),request:fn=>win.requestAnimationFrame(fn),cancel:id=>win.cancelAnimationFrame(id)};
  const preferences=win.matchMedia('(prefers-reduced-motion: reduce)'),listeners=new Set(),frames=new Set(),cleanups=[];
  let session=null,plan=null,info=null,frameId=null,destroyed=false,reduced=preferences.matches,revision=0,lastVisual=null,focusRecord=null;
  const sessionId='director.'+(++serial);
  function safeNotify(set,event){for(const listener of [...set]){try{listener(event);}catch{/* Application subscribers are isolated. */}}}
  function schedule(){if(frameId!==null)timing.cancel(frameId);frameId=null;if(!destroyed&&session?.running)frameId=timing.request(()=>{frameId=null;try{session.tick();}catch(error){session.fail(error);}schedule();});}
  function render(state){if(!plan||destroyed)return;try{lastVisual=renderer.render(plan,state,{reduced,animate:session?.running});safeNotify(frames,{...state,caption:lastVisual.caption});}catch(error){session?.fail(error);schedule();}}
  function event(value){revision++;safeNotify(listeners,{...value,sessionId,revision});schedule();}
  function live(){requireValue(!destroyed,'DESTROYED','The director has been destroyed.');}
  function loaded(){live();requireValue(session,'NOT_LOADED','Load a script before controlling playback.');}
  function command(fn){try{live();const value=fn();return {ok:true,value,revision};}catch(error){return {ok:false,diagnostics:error instanceof PlanError?error.diagnostics:[diagnostic(error)],revision};}}
  function on(target,type,listener,options){target.addEventListener(type,listener,options);cleanups.push(()=>target.removeEventListener(type,listener,options));}
  function takeover(){if(session?.running){session.pause();schedule();}}
  on(surface.scene,'pointerdown',takeover);on(surface.scene,'focusin',takeover);on(surface.viewport,'wheel',takeover,{passive:true});
  on(doc,'visibilitychange',()=>{if(doc.hidden&&session?.running){session.pause('hidden');schedule();}});
  on(doc,'keydown',event=>{if(event.key==='Escape'&&session?.running){session.pause();schedule();}});
  const motion=event=>{reduced=event.matches;if(session)render(session.inspect());};preferences.addEventListener('change',motion);cleanups.push(()=>preferences.removeEventListener('change',motion));
  const off=surface.subscribe(()=>{if(session&&!session.running)render(session.inspect());});cleanups.push(off,registry.subscribe(()=>{if(session&&!session.running)render(session.inspect());}));
  const api={sessionId,registry,surface,
    load(input){return command(()=>{
      const result=compile(input);if(!result.ok){throw new PlanError(result.diagnostics);}
      for(const target of Object.values(result.plan.script.targets))requireValue(registry.has(target.ref),'TARGET_UNREGISTERED','The script names an unregistered host target.');
      session?.destroy();renderer.clear();plan=result.plan;
      info=freezeData({id:plan.script.id,title:plan.script.title,locale:plan.script.locale,modes:[...plan.script.modes],scenes:plan.script.scenes.map(scene=>({id:scene.id,title:scene.title,summary:scene.summary,durationMs:scene.durationMs,transcript:scene.narration?.transcript||scene.summary,captions:scene.narration?.cues||[]}))});
      session=new Session(plan,{now:timing.now,mode,barriers,clock,onEvent:event,onFrame:render});
      render(session.inspect());requireValue(session.status!=='error','PREPARE_FAILED','The initial visual state could not be prepared.');return session.inspect();
    });},
    play(){return command(()=>{loaded();requireValue(!doc.hidden,'PAGE_HIDDEN','Playback requires a visible page.');renderer.invalidate();renderer.render(plan,session.inspect(),{reduced});session.reasons.delete('error');const result=session.play();schedule();return result;});},
    pause(){return command(()=>{loaded();const value=session.pause();schedule();return value;});},
    seek(position){return command(()=>{loaded();const value=session.seek(position);schedule();return value;});},
    setRate(rate){return command(()=>{loaded();session.setRate(rate);return session.inspect();});},
    choose(id){return command(()=>{loaded();const value=session.choose(id);schedule();return value;});},
    next(){return command(()=>{loaded();const value=session.next();schedule();return value;});},
    extendWait(){return command(()=>{loaded();session.extendWait();return session.inspect();});},
    stop(){return command(()=>{loaded();const value=session.stop();renderer.clear();surface.apply(IDENTITY);schedule();return value;});},
    describe(){return info;},
    inspect(){return {sessionId,revision,status:destroyed?'destroyed':session?.status||'idle',...(session?.inspect()||{}),revision,caption:lastVisual?.caption||'',reducedMotion:reduced,geometryReads:renderer.geometryReads};},
    on(listener){live();listeners.add(listener);return()=>listeners.delete(listener);},
    onFrame(listener){live();frames.add(listener);return()=>frames.delete(listener);},
    waitForCompletion(runId,{signal}={}){
      loaded();requireValue(runId===session.runId,'RUN_UNKNOWN','The requested run is not current.');
      if(session.status==='completed'||session.status==='error')return Promise.resolve({runId,status:session.status==='completed'?'completed':'failed'});
      if(signal?.aborted)return Promise.resolve({runId,status:'cancelled'});
      return new Promise(resolve=>{
        const finish=status=>{listeners.delete(listener);signal?.removeEventListener('abort',abort);resolve({runId,status});};
        const abort=()=>finish('cancelled');
        const listener=event=>{if(event.runId!==runId)return;if(event.type==='completed')finish('completed');else if(['stopped','destroyed'].includes(event.type))finish('cancelled');else if(event.status==='error')finish('failed');};
        listeners.add(listener);signal?.addEventListener('abort',abort,{once:true});
      });
    },
    setReducedMotion(value){return command(()=>{requireValue(typeof value==='boolean','INVALID_OPTION','Motion preference must be boolean.');reduced=preferences.matches||value;if(session){session.emit('motion-preference-changed');render(session.inspect());}else event({type:'motion-preference-changed',status:'idle'});return api.inspect();});},
    focusTarget(id){return command(()=>{loaded();session.pause();const target=registry.resolve(id).element;requireValue(target&&typeof target.focus==='function','FOCUS_UNAVAILABLE','Target cannot receive focus.');focusRecord={previous:doc.activeElement,target};target.focus({preventScroll:true});return api.inspect();});},
    destroy(){if(destroyed)return;session?.destroy();destroyed=true;if(frameId!==null)timing.cancel(frameId);frameId=null;cleanups.forEach(fn=>fn());renderer.destroy();surface.destroy();listeners.clear();frames.clear();if(focusRecord&&doc.activeElement===focusRecord.target&&focusRecord.previous?.isConnected)focusRecord.previous.focus({preventScroll:true});}
  };
  return api;
}
