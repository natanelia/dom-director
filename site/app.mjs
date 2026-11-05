import {createDirector,createGuidance,createCheckpointStore} from './sdk/index.js';
import {ORBIT_TOUR} from './tour.generated.js';
import {timecode,timeline,withEasing} from './model.mjs';

const $=id=>document.getElementById(id),stage=$('stage'),story=timeline(ORBIT_TOUR);
const models=Object.fromEntries(['watch','try','guide'].map(mode=>[mode,{approved:false,reviewed:true,revision:0}]));
const observers=new Set(),cleanups=[],hostAudio=new Audio();
let script=ORBIT_TOUR,started=false,busy=false,disposed=false,toastTimer=0,saved=null,lastCaption='',lastCode='',lastIndex=-1,lastUi=-Infinity,lastSignature='';
const guidance=createGuidance({
  authorize:req=>req.capability.startsWith('mode:')||req.capability==='condition:orbit.approved'||(req.capability==='fixture:reset'&&req.mode==='try'),
  conditions:{'orbit.approved':{label:'The isolated route is approved',evidence:'domain',trigger:'level',
    hints:['The cursor is only a visual guide. Check the review box and use the actual approval button.'],
    read:context=>context.mode==='watch'||models[context.mode].approved,
    subscribe:callback=>{observers.add(callback);return()=>observers.delete(callback);}}},
  fixture:{isolated:true,reset:async({signal})=>{if(signal.aborted)return {completed:false};models.try={approved:false,reviewed:true,revision:models.try.revision+1};notify();return {completed:true};}},
});
const director=createDirector({surface:{viewport:stage,scene:$('scene'),overlay:$('sdk-overlay')},guidance,
  targets:{'orbit.overview':()=>$('scene'),'orbit.metrics':()=>$('metrics-target'),'orbit.routes':()=>$('map-target'),
    'orbit.review':()=>$('review-target'),'orbit.approve':()=>$('approve-route')},
  narration:{enabled:false,onFailure:'text',createAudio:()=>hostAudio,resolveAsset:(id,asset)=>{
    if(!Object.hasOwn(ORBIT_TOUR.assets,id)||asset.uri!==ORBIT_TOUR.assets[id].uri)throw new Error('Unapproved audio');
    const url=new URL(asset.uri,location.href);if(url.origin!==location.origin)throw new Error('Unapproved origin');return url.href;
  }},
});
const checkpoints=createCheckpointStore(director,{versions:()=>({script:'orbit-v1-'+script.defaults.easing,host:'orbit-host-v1',fixture:String(model().revision)}),
  authorize:()=>true,verify:snapshot=>snapshot.versions.fixture===String(model().revision)});
function on(element,type,listener,options){element.addEventListener(type,listener,options);cleanups.push(()=>element.removeEventListener(type,listener,options));}
function notify(){for(const callback of [...observers])callback();}
function model(){return models[director.inspect().mode||'watch'];}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},4200);}
function result(value){if(value?.ok===false){toast(value.diagnostics[0].message);return false;}return true;}
function renderFixture(){
  const m=model();$('review-check').checked=m.reviewed;
  $('approve-route').disabled=!m.reviewed||m.approved;$('approve-route').classList.toggle('approved',m.approved);
  $('approve-route').textContent=m.approved?'Checkpoint approved ✓':'Approve checkpoint ↗';
  $('cleared-stat').replaceChildren(document.createTextNode(m.approved?'25':'24'),Object.assign(document.createElement('small'),{textContent:m.approved?'all clear ✓':'of 25 total'}));
  $('cleared-bar').style.width=m.approved?'100%':'96%';$('flag-count').textContent=m.approved?'00':'01';
}
function render(state=director.inspect()){
  if(disposed)return;
  const now=performance.now(),signature=JSON.stringify([state.revision,state.sceneId,state.status,state.reducedMotion,started,busy]);
  if(signature===lastSignature&&now-lastUi<80)return;lastSignature=signature;lastUi=now;
  const scene=script.scenes.find(s=>s.id===state.sceneId)||script.scenes[0],index=script.scenes.indexOf(scene),position=story.position(state);
  stage.dataset.runtime='sdk';stage.dataset.scene=scene.id;stage.dataset.status=state.status;stage.dataset.mode=state.mode;
  stage.dataset.state=state.waitingFor?'waiting':['playing','buffering'].includes(state.status)?'playing':'paused';
  stage.dataset.clock=state.narration?.authority||'text';stage.dataset.reducedMotion=String(state.reducedMotion);
  $('stage-intro').hidden=started;
  const running=['playing','buffering'].includes(state.status),waiting=state.waitingFor,step=state.reasons?.includes('step');
  $('play-icon').textContent=running?'Ⅱ':'▶';$('play').setAttribute('aria-label',running?'Pause walkthrough':'Play walkthrough');
  $('play').disabled=busy;
  $('next-step').hidden=!step;$('next-step').disabled=busy;
  $('retry-step').hidden=!waiting?.error;$('extend-step').hidden=!waiting;$('hint-step').hidden=!waiting;
  $('reset-fixture').disabled=state.mode!=='try'||busy;$('reset-fixture').title='Explicit reset is available only in isolated Try mode.';
  $('sound').textContent=state.narration?.enabled?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(!!state.narration?.enabled));
  $('sound').setAttribute('aria-label',state.narration?.enabled?'Disable synthetic narration':'Enable synthetic narration');
  $('captions').setAttribute('aria-pressed',String(state.captionsEnabled));
  $('motion-toggle').textContent=state.reducedMotion?'Motion off':'Motion on';$('motion-toggle').setAttribute('aria-pressed',String(state.reducedMotion));
  $('rate').textContent=state.rate+'×';$('rate').setAttribute('aria-label','Playback speed: '+state.rate+' times');
  $('current-time').textContent=timecode(position);$('seek').value=String(position/1000);
  $('seek').style.background=`linear-gradient(to right,#c5df9a ${position/story.total*100}%,#44533e ${position/story.total*100}%)`;
  $('code-clock').textContent=timecode(position,true);
  if(index!==lastIndex){lastIndex=index;$('shot-number').textContent=`SCENE ${String(index+1).padStart(2,'0')} / 06`;$('shot-title').textContent=scene.title;
    document.querySelectorAll('.chapter-button').forEach((button,i)=>{button.classList.toggle('active',i===index);if(i===index)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});}
  const caption=waiting?.instruction||state.caption||scene.summary;
  $('caption').hidden=!state.captionsEnabled||!started;
  if(caption!==lastCaption){lastCaption=caption;$('caption-text').textContent=caption;$('caption-label').textContent=waiting?'YOUR TURN':'DIRECTOR';}
  const label=waiting?.error?'Paused · '+waiting.error:waiting?'Waiting for you · approve checkpoint':step?'Your pace · continue when ready':state.status==='completed'?'That’s a wrap. Your app is still live.':running?(state.narration?.authority==='audio'?'Playing · narration-synced timeline':'Playing · captioned timeline'):started?'Paused · your app is still alive':'Ready when you are';
  if($('player-state').textContent!==label)$('player-state').textContent=label;
  const code=JSON.stringify({sceneId:scene.id,camera:scene.cues.find(c=>c.kind==='camera'),easing:script.defaults.easing,mode:state.mode,clock:state.narration?.authority||'text'},null,2);
  if(code!==lastCode){lastCode=code;$('live-code').textContent=code;}
  const hints={watch:'Watch the story. No checkpoint is automatically approved.',try:'Practice in an isolated sandbox. Real input completes the task.',guide:'Continue at scene boundaries. Complete the task at your own pace.'};
  $('mode-hint').textContent=hints[state.mode];
  document.querySelectorAll('[data-mode]').forEach(button=>{const selected=button.dataset.mode===state.mode;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));button.disabled=busy;});
  $('save-position').disabled=busy||!!waiting||!!state.pendingOperation;$('restore-position').disabled=busy||!saved||!!waiting||!!state.pendingOperation;
}
function refresh(){if(disposed)return;renderFixture();render();}
function play(){started=true;result(director.play());render();}
function pause(){result(director.pause());render();}
function seek(ms,resume=false){started=true;const ok=result(director.seek(story.locate(ms)));render();if(ok&&resume)play();return ok;}
function scrollToDemo(){ $('experience').scrollIntoView({behavior:director.inspect().reducedMotion?'auto':'smooth',block:'start'}); }
function begin(){seek(0);scrollToDemo();play();}
async function transaction(work,message){if(busy||disposed)return;busy=true;render();try{const response=await work();if(result(response)&&message)toast(message);}catch{toast('This operation could not complete. Exit remains available.');}finally{busy=false;refresh();}}
async function mode(value){await transaction(()=>director.setMode(value));started=true;refresh();}
on($('play'),'click',()=>['playing','buffering'].includes(director.inspect().status)?pause():play());
for(const id of ['hero-play','footer-play'])on($(id),'click',begin);
on($('stage-play'),'click',play);on($('restart'),'click',()=>seek(0));
on($('exit-tour'),'click',()=>{result(director.stop());started=false;refresh();});
on($('seek'),'input',event=>seek(Number(event.target.value)*1000));
on($('takeover'),'click',()=>{seek(story.scenes[3].startMs+1600);toast('Your turn. The actual checkpoint remains interactive.');});
on($('try-action'),'click',async()=>{await mode('try');scrollToDemo();seek(story.scenes[3].startMs+1600,true);});
on($('chapter-audio'),'click',()=>{scrollToDemo();seek(story.scenes[2].startMs,true);});
on($('approve-route'),'click',()=>{const m=model();if(!m.reviewed||m.approved)return;m.approved=true;m.revision++;notify();refresh();toast('A real button. Checkpoint approved in this mode’s isolated workspace.');});
on($('review-check'),'change',()=>{model().reviewed=$('review-check').checked;model().revision++;notify();renderFixture();});
on($('reset-fixture'),'click',()=>transaction(()=>director.resetFixture(),'Practice reset. Other modes and real data are untouched.'));
on($('route-toggle'),'click',()=>{const active=$('route-toggle').getAttribute('aria-pressed')==='true';$('route-toggle').setAttribute('aria-pressed',String(!active));$('alternate-route').setAttribute('opacity',active?'0':'1');});
on($('sound'),'click',()=>{result(director.setNarrationEnabled(!director.inspect().narration.enabled));render();});
on($('captions'),'click',()=>{result(director.setCaptions(!director.inspect().captionsEnabled));render();});
on($('motion-toggle'),'click',()=>{result(director.setReducedMotion(!director.inspect().reducedMotion));render();});
on($('rate'),'click',()=>{const choices=[1,1.25,1.5,.75],rate=director.inspect().rate;result(director.setRate(choices[(choices.indexOf(rate)+1)%choices.length]));render();});
on($('easing'),'change',event=>{
  const old=director.inspect();director.pause();script=withEasing(ORBIT_TOUR,event.target.value);
  if(result(director.load(script))){director.setRate(old.rate);director.setCaptions(old.captionsEnabled);director.setNarrationEnabled(old.narration.enabled);
    if(result(director.seek({sceneId:old.sceneId,timeMs:old.timeMs}))&&old.status==='playing')play();}
  saved=null;checkpoints.clear();$('script-json').textContent=JSON.stringify(script,null,2);refresh();
});
document.querySelectorAll('[data-mode]').forEach(button=>on(button,'click',()=>mode(button.dataset.mode)));
on($('next-step'),'click',()=>{result(director.next());render();});
on($('retry-step'),'click',()=>{result(director.retryBarrier());render();});
on($('extend-step'),'click',()=>{result(director.extendWait());toast('More reading time requested.');render();});
on($('hint-step'),'click',()=>toast(director.inspect().waitingFor?.hints?.[0]||'Use the real approval button after reviewing the route.'));
on($('save-position'),'click',()=>transaction(async()=>{checkpoints.clear();saved=null;const response=await checkpoints.capture();if(response.ok)saved=response.value;return response;},'Position saved. Playback stays paused.'));
on($('restore-position'),'click',()=>transaction(()=>checkpoints.restore(saved.id),'Position restored without replaying actions. Press Play to continue.'));
document.querySelectorAll('[data-focus]').forEach(button=>on(button,'click',()=>{const scene=story.scenes.find(s=>s.cues.some(c=>c.kind==='camera'&&c.target===button.dataset.focus));if(scene)seek(scene.startMs+Math.min(1500,scene.durationMs));}));
document.querySelectorAll('[data-notice]').forEach(button=>on(button,'click',()=>toast(button.dataset.notice)));
for(const [index,scene] of story.scenes.entries()){
  const button=document.createElement('button');button.className='chapter-button';button.dataset.scene=scene.id;
  const n=document.createElement('span');n.className='chapter-no';n.textContent=`0${index+1} / ${timecode(scene.startMs)}`;
  const label=document.createElement('strong');label.textContent=scene.title;button.append(n,label);on(button,'click',()=>seek(scene.startMs,true));$('chapter-strip').append(button);
  const row=document.createElement('button'),time=document.createElement('time'),text=document.createElement('span');time.textContent=timecode(scene.startMs);text.textContent=scene.summary;row.append(time,text);on(row,'click',()=>seek(scene.startMs));$('transcript').append(row);
  if(index){const tick=document.createElement('i');tick.style.left=scene.startMs/story.total*100+'%';$('chapter-ticks').append(tick);}
}
on($('transcript-toggle'),'click',()=>{const show=$('transcript').hidden;$('transcript').hidden=!show;$('transcript-toggle').setAttribute('aria-expanded',String(show));$('transcript-toggle').textContent=show?'Hide transcript −':'Read transcript ＋';});
function openDialog(id){pause();$(id).showModal();}
on($('script-open'),'click',()=>openDialog('script-dialog'));
for(const id of ['about-open','about-open-footer'])on($(id),'click',()=>openDialog('about-dialog'));
document.querySelectorAll('[data-close]').forEach(button=>on(button,'click',()=>button.closest('dialog').close()));
on($('copy-cue'),'click',async()=>{try{await navigator.clipboard.writeText($('live-code').textContent);toast('Current cue copied.');}catch{openDialog('script-dialog');toast('Use Export to keep the canonical script.');}});
on($('download-script'),'click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(script,null,2)+'\n'],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='orbit.tour.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
on(document,'keydown',event=>{
  if(document.querySelector('dialog[open]'))return;
  if(event.code==='Space'&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.target.closest('input,textarea,select,button,a,[contenteditable=true]')){
    const box=$('theater').getBoundingClientRect();if(box.bottom<0||box.top>innerHeight)return;event.preventDefault();['playing','buffering'].includes(director.inspect().status)?pause():play();
  }
});
cleanups.push(director.on(event=>{if(event.type==='diagnostic')toast(event.detail?.diagnostic?.message||'Playback needs attention.');if(event.type==='gate-entered'||event.type==='step-required')$('announcements').textContent=event.waitingFor?.instruction||'Scene complete. Continue when ready.';queueMicrotask(refresh);}),director.onFrame(()=>render()));
$('seek').max=String(story.total/1000);document.querySelectorAll('[data-duration]').forEach(el=>el.textContent=timecode(story.total));
for(let i=0;i<38;i++){const bar=document.createElement('i');bar.style.height=7+(Math.sin(i*1.7)*.5+.5)*32+(i%4)*2+'px';$('decorative-waveform').append(bar);}
$('script-json').textContent=JSON.stringify(script,null,2);
const loaded=director.load(script);if(!result(loaded))$('announcements').textContent='The walkthrough could not load. The application remains available.';
refresh();
on(window,'pagehide',()=>{if(disposed)return;disposed=true;clearTimeout(toastTimer);cleanups.splice(0).forEach(off=>off());checkpoints.destroy();director.destroy();guidance.destroy();observers.clear();});
