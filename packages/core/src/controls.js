import {requireValue} from './errors.js';
const setText=(element,value)=>{if(element.textContent!==value)element.textContent=value;};
const time=ms=>{const seconds=Math.floor((ms||0)/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};
/** Optional native controls and a stable transcript, outside the transformed scene. */
export function mountControls(director,container){
  requireValue(container?.nodeType===1&&container.ownerDocument===director.surface.scene.ownerDocument&&
    !director.surface.scene.contains(container),'CONTROLS_SURFACE','Controls must be outside the camera scene.');
  const doc=container.ownerDocument,root=doc.createElement('section'),cleanups=[];
  root.dataset.directorControls='';root.setAttribute('aria-label','Walkthrough player');root.tabIndex=0;
  root.style.cssText='display:grid;gap:10px;padding:12px;background:Canvas;color:CanvasText;font:16px/1.5 system-ui;pointer-events:auto';
  const toolbar=doc.createElement('div');toolbar.style.cssText='display:flex;gap:8px;flex-wrap:wrap;align-items:center';
  const status=doc.createElement('div');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
  const caption=doc.createElement('div');caption.dataset.directorCaption='';caption.style.whiteSpace='pre-wrap';
  const progressLabel=doc.createElement('label');progressLabel.textContent='Scene position ';
  const progress=doc.createElement('input');progress.type='range';progress.min='0';progress.step='1';progress.setAttribute('aria-label','Scene position');progress.style.width='min(100%, 480px)';progressLabel.append(progress);
  const position=doc.createElement('output');position.setAttribute('aria-live','off');
  const choices=doc.createElement('div');choices.setAttribute('role','group');choices.setAttribute('aria-label','Choose the next scene');
  const details=doc.createElement('details'),summary=doc.createElement('summary'),transcript=doc.createElement('div');summary.textContent='Read transcript';details.append(summary,transcript);
  const hintText=doc.createElement('p');hintText.dataset.directorHint='';hintText.hidden=true;
  root.append(toolbar,status,hintText,caption,progressLabel,position,choices,details);container.append(root);
  const buttons={};let destroyed=false,description=null,choiceSignature='',lastStatus='',lastText='';
  function on(el,name,callback){el.addEventListener(name,callback);cleanups.push(()=>el.removeEventListener(name,callback));}
  function report(result){if(result&&typeof result.then==='function'){result.then(report,()=>{if(!destroyed)status.textContent='The host operation failed.';});return;}if(destroyed)return;if(result?.ok===false){status.textContent=result.diagnostics[0]?.message||'This command is unavailable.';lastStatus='';}else update();}
  function button(id,label,callback){const button=doc.createElement('button');button.type='button';button.textContent=label;button.dataset.command=id;toolbar.append(button);on(button,'click',()=>report(callback()));buttons[id]=button;return button;}
  button('play','Play',()=>['playing','buffering','waiting'].includes(director.inspect().status)?director.pause():director.play());
  button('stop','Stop',()=>director.stop());
  button('next','Next scene',()=>director.next());
  const rateLabel=doc.createElement('label');rateLabel.textContent='Speed ';
  const rate=doc.createElement('select');rate.setAttribute('aria-label','Playback speed');
  for(const value of [.5,.75,1,1.25,1.5,2]){const option=doc.createElement('option');option.value=String(value);option.textContent=value+'×';rate.append(option);}rate.value='1';rateLabel.append(rate);toolbar.append(rateLabel);
  const modeLabel=doc.createElement('label');modeLabel.textContent='Mode ';
  const modeSelect=doc.createElement('select');modeSelect.setAttribute('aria-label','Walkthrough mode');modeLabel.append(modeSelect);toolbar.append(modeLabel);
  on(modeSelect,'change',()=>report(director.setMode(modeSelect.value)));
  button('extend','More time',()=>director.extendWait());
  button('retry','Retry step',()=>director.retryBarrier());
  button('reset','Reset practice',()=>director.resetFixture());
  button('hint','Show hint',()=>{const hint=director.inspect().waitingFor?.hints?.[0];if(hint){hintText.textContent=hint;hintText.hidden=false;}return null;});
  button('sound','Enable narration',()=>director.setNarrationEnabled(!director.inspect().narration?.enabled));
  button('captions','Captions on',()=>director.setCaptions(!director.inspect().captionsEnabled));
  button('motion','Reduce motion',()=>director.setReducedMotion(!director.inspect().reducedMotion));
  on(rate,'change',()=>report(director.setRate(Number(rate.value))));
  on(progress,'input',()=>report(director.seek({sceneId:director.inspect().sceneId,timeMs:Number(progress.value)})));
  on(root,'keydown',event=>{
    if(event.target!==root||event.isComposing||event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.code==='Space'){event.preventDefault();buttons.play.click();}
    else if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
      event.preventDefault();const state=director.inspect();report(director.seek({timeMs:Math.max(0,Math.min(state.durationMs,state.timeMs+(event.key==='ArrowRight'?5000:-5000)))}));
    }
  });
  function rebuild(info){
    description=info;transcript.replaceChildren();
    modeSelect.replaceChildren();
    if(!info)return;
    for(const mode of info.modes){const option=doc.createElement('option');option.value=mode;option.textContent=mode[0].toUpperCase()+mode.slice(1);modeSelect.append(option);}
    root.lang=info.locale;
    for(const scene of info.scenes){
      const section=doc.createElement('section'),heading=doc.createElement('h3'),paragraph=doc.createElement('p'),jump=doc.createElement('button');
      heading.textContent=scene.title;paragraph.textContent=scene.transcript||scene.summary;jump.type='button';jump.textContent='Go to '+scene.title;
      jump.addEventListener('click',()=>report(director.seek({sceneId:scene.id,timeMs:0})));
      section.append(heading,paragraph,jump);transcript.append(section);
    }
  }
  function update(){
    if(destroyed)return;const state=director.inspect(),info=director.describe();if(info!==description)rebuild(info);
    const available=!!state.sceneId&&state.status!=='destroyed';
    buttons.play.disabled=!available||!!state.pendingOperation;buttons.stop.disabled=!available;progress.disabled=!available||!!state.pendingOperation;rate.disabled=!available||!!state.pendingOperation;
    modeSelect.disabled=!available||!!state.pendingOperation;modeSelect.value=state.mode||'watch';
    buttons.extend.hidden=state.waitingFor?.kind!=='gate';buttons.extend.disabled=!!state.pendingOperation;
    buttons.retry.hidden=!state.waitingFor?.error;buttons.retry.disabled=!!state.pendingOperation;
    buttons.reset.hidden=state.mode!=='try';buttons.reset.disabled=!available||!!state.pendingOperation;
    buttons.hint.hidden=!state.waitingFor?.hints?.length;if(!state.waitingFor)hintText.hidden=true;
    setText(buttons.play,['playing','buffering','waiting'].includes(state.status)?'Pause':'Play');
    buttons.play.setAttribute('aria-label',['playing','buffering','waiting'].includes(state.status)?'Pause walkthrough':'Play walkthrough');
    buttons.sound.hidden=!state.narration;buttons.sound.disabled=!available||!state.narration?.available;setText(buttons.sound,state.narration?.enabled?'Continue without sound':'Enable narration');buttons.sound.setAttribute('aria-pressed',String(!!state.narration?.enabled));
    buttons.captions.setAttribute('aria-pressed',String(state.captionsEnabled!==false));setText(buttons.captions,state.captionsEnabled===false?'Captions off':'Captions on');caption.hidden=state.captionsEnabled===false;
    buttons.next.hidden=!state.reasons?.includes('step');buttons.next.disabled=!available;
    setText(buttons.motion,state.reducedMotion?'Motion reduced':'Reduce motion');buttons.motion.setAttribute('aria-pressed',String(!!state.reducedMotion));
    progress.max=String(state.durationMs||0);progress.value=String(state.timeMs||0);progress.setAttribute('aria-valuetext',`${time(state.timeMs)} of ${time(state.durationMs)} in this scene`);
    position.value=`${time(state.timeMs)} / ${time(state.durationMs)} · current scene`;
    rate.value=String(state.rate||1);
    const scene=info?.scenes.find(scene=>scene.id===state.sceneId),message=state.pendingOperation?'Preparing '+state.pendingOperation+'…':state.waitingFor?.error?`Step paused (${state.waitingFor.error}). ${state.waitingFor.instruction}`:state.waitingFor?.instruction||`${scene?.title||'Walkthrough'}: ${state.narration?.error?'Narration unavailable. Continue without sound or retry.':state.status}${state.incomplete?' · some steps were skipped':''}`;
    if(message!==lastStatus){status.textContent=message;lastStatus=message;}
    const text=state.caption||scene?.summary||'';if(text!==lastText){caption.textContent=text;lastText=text;}
    const signature=JSON.stringify(state.choices||[]);if(signature!==choiceSignature){
      choices.replaceChildren();choiceSignature=signature;
      for(const choice of state.choices||[]){const option=doc.createElement('button');option.type='button';option.textContent=choice.label;option.addEventListener('click',()=>report(director.choose(choice.id)));choices.append(option);}
    }
  }
  const subscriptions=[director.on(update),director.onFrame(update)];update();
  return {element:root,refresh:update,destroy(){if(destroyed)return;destroyed=true;subscriptions.forEach(off=>off());cleanups.forEach(off=>off());root.remove();}};
}
