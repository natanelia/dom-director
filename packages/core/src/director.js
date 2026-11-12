import {compile} from './compiler.js';
import {createSurface} from './surface.js';
import {createTargetRegistry} from './targets.js';
import {createRenderer} from './renderer.js';
import {Session} from './session.js';
import {DirectorError,requireValue,diagnostic} from './errors.js';
import {freezeData} from './json.js';
import {IDENTITY} from './geometry.js';
import {createFrameLoop} from './frame-loop.js';
import {NarrationClock,captionsToVTT} from './narration.js';
let serial=0;
class PlanError extends DirectorError {constructor(diagnostics){super('COMPILE_FAILED','Script validation failed.','compile');this.diagnostics=diagnostics;}}
/** Browser host facade. Expected command failures return structured Results. */
export function createDirector({surface:surfaceOptions,targets={},registry:createRegistry,mode='watch',scheduler,barriers,clock,narration,guidance}={}){
  requireValue(!guidance||(!barriers&&typeof guidance.enter==='function'&&typeof guidance.preflight==='function'),'GUIDANCE_OPTIONS','Use guidance or a custom barrier adapter, not both.');
  requireValue(!narration||(!clock&&typeof narration.resolveAsset==='function'),'MEDIA_OPTIONS','Provide a narration resolver or a custom clock, not both.');
  const surface=createSurface(surfaceOptions),doc=surface.scene.ownerDocument,win=doc.defaultView;
  let renderer,registry;
  try{registry=createRegistry||createTargetRegistry(targets);renderer=createRenderer(surface,registry);}catch(error){surface.destroy();throw error;}
  const timing=scheduler||{now:()=>win.performance.now(),request:fn=>win.requestAnimationFrame(fn),cancel:id=>win.cancelAnimationFrame(id)};
  const preferences=win.matchMedia('(prefers-reduced-motion: reduce)'),listeners=new Set(),frames=new Set(),cleanups=[];
  let session=null,plan=null,info=null,destroyed=false,reduced=preferences.matches,revision=0,lastVisual=null,focusRecord=null,captions=true,mediaClock=null,operation=null;
  const sessionId='director.'+(++serial);
  function safeNotify(set,event){for(const listener of [...set]){try{listener(event);}catch{/* Application subscribers are isolated. */}}}
  const loop=createFrameLoop(timing,()=>!destroyed&&session?.running,()=>session.tick(),error=>session.fail(error));
  function schedule(){loop.sync();}
  function render(state){if(!plan||destroyed)return;try{lastVisual=renderer.render(plan,state,{reduced,animate:session?.running});mediaClock?.observePresentation(state.timeMs);safeNotify(frames,{...state,caption:captions?lastVisual.caption:''});}catch(error){session?.fail(error);schedule();}}
  function event(value){revision++;safeNotify(listeners,{...value,sessionId,revision});schedule();}
  function live(){requireValue(!destroyed,'DESTROYED','The director has been destroyed.');}
  function loaded(){live();requireValue(session,'NOT_LOADED','Load a script before controlling playback.');}
  function command(fn){try{live();const value=fn();return {ok:true,value,revision};}catch(error){return {ok:false,diagnostics:error instanceof PlanError?error.diagnostics:[diagnostic(error)],revision};}}
  function available(){loaded();requireValue(!operation,'BUSY','A host preparation is in progress.');}
  function cancelOperation(){if(operation){const old=operation;operation=null;old.controller.abort();if(session&&!destroyed)session.emit('preparation-cancelled',{operation:old.kind});}}
  function context(nextMode=session.mode){return {runId:session.runId,sceneId:session.scene.id,visitId:session.path[session.cursor].visitId,mode:nextMode,script:plan.script};}
  async function transaction(kind,prepare,commit){
    let token;
    try{
      available();token={kind,controller:new AbortController(),session};operation=token;session.pause();
      requireValue(operation===token&&!token.controller.signal.aborted,'CANCELLED','Preparation was cancelled.');
      session.emit('preparation-started',{operation:kind});
      requireValue(operation===token&&!token.controller.signal.aborted,'CANCELLED','Preparation was cancelled.');
      await prepare(token.controller.signal);
      requireValue(!destroyed&&session===token.session&&operation===token&&!token.controller.signal.aborted,'CANCELLED','Preparation was cancelled.');
      operation=null;const value=commit();schedule();return {ok:true,value,revision};
    }catch(error){return {ok:false,diagnostics:[diagnostic(error)],revision};}
    finally{if(operation===token){operation=null;if(!destroyed&&session===token.session)session.emit('preparation-finished',{operation:kind});}}
  }
  function on(target,type,listener,options){target.addEventListener(type,listener,options);cleanups.push(()=>target.removeEventListener(type,listener,options));}
  function takeover(){cancelOperation();if(session?.running||session?.pending?.cue.kind==='action'){session.pause();schedule();}}
  on(surface.scene,'pointerdown',takeover);on(surface.scene,'focusin',takeover);on(surface.viewport,'wheel',takeover,{passive:true});
  on(doc,'visibilitychange',()=>{if(doc.hidden&&session){cancelOperation();session.pause('hidden');schedule();}});
  on(doc,'keydown',event=>{if(event.key==='Escape'&&session){cancelOperation();if(session.running||session.pending){session.pause();schedule();}}});
  const motion=event=>{reduced=event.matches;if(session)render(session.inspect());};preferences.addEventListener('change',motion);cleanups.push(()=>preferences.removeEventListener('change',motion));
  const off=surface.subscribe(()=>{if(session&&!session.running)render(session.inspect());});cleanups.push(off,registry.subscribe(()=>{if(session&&!session.running)render(session.inspect());}));
  const api={sessionId,registry,surface,
    load(input){return command(()=>{
      const result=compile(input);if(!result.ok){throw new PlanError(result.diagnostics);}
      requireValue(result.plan.script.modes.includes(mode),'MODE_UNAVAILABLE','This script does not offer the selected mode.');
      for(const target of Object.values(result.plan.script.targets))requireValue(registry.has(target.ref),'TARGET_UNREGISTERED','The script names an unregistered host target.');
      if(guidance)guidance.preflight(result.plan.script,mode);
      else requireValue(mode!=='try','FIXTURE_REQUIRED','Try mode requires an isolated guidance fixture.');
      cancelOperation();session?.destroy();renderer.clear();plan=result.plan;
      info=freezeData({id:plan.script.id,title:plan.script.title,locale:plan.script.locale,modes:[...plan.script.modes],scenes:plan.script.scenes.map(scene=>({id:scene.id,title:scene.title,summary:scene.summary,durationMs:scene.durationMs,transcript:scene.narration?.transcript||scene.summary,captions:scene.narration?.cues||[]}))});
      mediaClock=narration?new NarrationClock({...narration,now:timing.now,
        createAudio:narration.createAudio||(()=>new win.Audio()),
        resolveAsset:id=>narration.resolveAsset(id,plan.script.assets?.[id]),
        onChange:(type,media)=>{if(session&&!destroyed){session.emit(type,{media});render(session.inspect());}}}):null;
      session=new Session(plan,{now:timing.now,mode,barriers:guidance||barriers,clock:mediaClock||clock,onEvent:event,onFrame:render});
      render(session.inspect());requireValue(session.status!=='error','PREPARE_FAILED','The initial visual state could not be prepared.');return session.inspect();
    });},
    play(){return command(()=>{available();requireValue(!doc.hidden,'PAGE_HIDDEN','Playback requires a visible page.');renderer.invalidate();renderer.render(plan,session.inspect(),{reduced});session.reasons.delete('error');const result=session.play();schedule();return result;});},
    pause(){return command(()=>{loaded();cancelOperation();const value=session.pause();schedule();return value;});},
    seek(position){return command(()=>{available();const value=session.seek(position);schedule();return value;});},
    setRate(rate){return command(()=>{available();session.setRate(rate);return session.inspect();});},
    choose(id){return command(()=>{available();const value=session.choose(id);schedule();return value;});},
    next(){return command(()=>{available();const value=session.next();schedule();return value;});},
    extendWait(){return command(()=>{available();session.extendWait();return session.inspect();});},
    stop(){return command(()=>{loaded();cancelOperation();const value=session.stop();renderer.clear();surface.apply(IDENTITY);schedule();return value;});},
    retryBarrier(){return command(()=>{available();const value=session.retryBarrier();schedule();return value;});},
    setMode(nextMode){return transaction('mode',async signal=>{
      requireValue(plan.script.modes.includes(nextMode),'MODE_UNAVAILABLE','This mode is not offered.');
      if(guidance)await guidance.prepareMode(context(nextMode),signal);
      else requireValue(nextMode!=='try'&&!plan.script.scenes.some(scene=>scene.cues.some(cue=>['action','gate'].includes(cue.kind))),
        'GUIDANCE_REQUIRED','Host preparation is required for this mode.');
    },()=>{const current=session;current.setMode(nextMode);if(session===current)mode=nextMode;return api.inspect();});},
    resetFixture(){return transaction('fixture-reset',async signal=>{
      requireValue(guidance&&session.mode==='try','FIXTURE_REQUIRED','Reset requires a guided, isolated practice fixture.');
      session.cancelPending();await guidance.reset(context(),signal);
    },()=>{session.resetFixture();return api.inspect();});},
    setNarrationEnabled(value){return command(()=>{available();requireValue(mediaClock,'MEDIA_UNAVAILABLE','No narration adapter is configured.');mediaClock.setEnabled(value);schedule();return api.inspect();});},
    setVolume(value){return command(()=>{loaded();requireValue(mediaClock,'MEDIA_UNAVAILABLE','No narration adapter is configured.');mediaClock.setVolume(value);return api.inspect();});},
    setCaptions(value){return command(()=>{requireValue(typeof value==='boolean','INVALID_OPTION','Caption preference must be boolean.');captions=value;if(session){session.emit('captions-changed');render(session.inspect());}return api.inspect();});},
    exportCaptions(sceneId){return command(()=>{loaded();const scene=plan.scenes[sceneId||session.scene.id];requireValue(scene,'SCENE_REFERENCE','Scene is not defined.');return captionsToVTT(scene.narration?.cues||[]);});},
    describe(){return info;},
    inspect(){return {sessionId,revision,status:destroyed?'destroyed':session?.status||'idle',...(session?.inspect()||{}),revision,caption:captions?(lastVisual?.caption||''):'',captionsEnabled:captions,narration:mediaClock?.inspect()||null,pendingOperation:operation?.kind||null,effects:guidance?.inspect()||[],reducedMotion:reduced,geometryReads:renderer.geometryReads};},
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
    destroy(){if(destroyed)return;cancelOperation();session?.destroy();destroyed=true;loop.destroy();cleanups.forEach(fn=>fn());renderer.destroy();surface.destroy();listeners.clear();frames.clear();if(focusRecord&&doc.activeElement===focusRecord.target&&focusRecord.previous?.isConnected)focusRecord.previous.focus({preventScroll:true});}
  };
  return api;
}
