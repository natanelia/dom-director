import {createDirector,createGuidance,createCheckpointStore} from './sdk/index.js';
import {EARTH_CHECKPOINTS} from './studio-sdk/sample.js';
import {createEarthApp} from './earth.mjs';
import {timecode,timeline,createEarthTour} from './model.mjs';

const $=id=>document.getElementById(id);
const steps=EARTH_CHECKPOINTS;
export const EARTH_TOUR=createEarthTour(steps);

document.body.classList.add('earth-demo');
$('scene').classList.add('earth-live');
$('stage').setAttribute('aria-label','Interactive Earth statistics application');
document.querySelector('.section-title').textContent='Meet Earth. Change your perspective.';
document.querySelector('.hero-description').textContent='Explore a living planet. Learn the controls. See every choice change the world.';
for(const node of $('hero-play').childNodes)if(node.nodeType===3&&node.textContent.includes('Roll the demo'))node.textContent=' Explore the Earth ';
$('stage-play').setAttribute('aria-label','Start the Earth walkthrough');
$('takeover').textContent='Explore freely ↗';
$('sound').hidden=true;
$('easing').hidden=true;document.querySelector('.easing-label').hidden=true;
document.querySelector('.desk-copy>p').textContent='Every checkpoint names a real control. Inspect the script, or open Studio to edit the story.';
$('stage-intro').hidden=true;
document.querySelector('.proof-card p').textContent='Switch a data layer. Move through time. Turn on the lights. Every control changes the real globe.';
document.querySelector('.mini-code b').textContent='"earth.globe"';
const orbitLink=document.createElement('a');
orbitLink.href='./?example=orbit';orbitLink.textContent='Original Orbit example ↗';
document.querySelector('.sdk-tools').append(orbitLink);
const coach=document.createElement('div');coach.className='earth-coach';
coach.innerHTML='<div><span id="earth-progress" role="status">0 / 6 controls explored</span><strong id="earth-step-title"></strong><p id="earth-instruction"></p></div><button id="earth-reset" type="button">Reset practice</button>';
$('stage').after(coach);
$('about-dialog').querySelectorAll('p')[1].textContent='A real 3D globe, editable data layers, a year slider, regional focus, connections and day/night lighting. Six captioned checkpoints use the reusable DOM Director core. The statistics and simplified geography are illustrative demo data.';
const about=$('about-dialog').querySelectorAll('p');
about[3].textContent='Use Space to play or pause and Escape to pause and explore. The globe supports arrow keys and plus/minus for zoom. Motion off disables animated globe transitions. Captions and a transcript are available; this Earth story has no recorded narration.';
about[4].textContent='The globe and its data are bundled locally. No external images, fonts, analytics, account connection, recording or persistent storage. Nothing is sent when you use a control.';

let director,script=EARTH_TOUR,story=timeline(script),started=false,disposed=false,busy=false,saved=null,toastTimer=0,lastUi=-Infinity;
const cleanups=[],observers=new Set();
let models;
function on(element,type,listener,options){element.addEventListener(type,listener,options);cleanups.push(()=>element.removeEventListener(type,listener,options));}
function notify(){for(const callback of [...observers])callback();}
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},4200);}
function result(response){if(response?.ok===false){toast(response.diagnostics[0]?.message||'The walkthrough needs attention.');return false;}return true;}
function modeName(){return director?.inspect().mode||'try';}
function model(){return models[modeName()];}
const earth=createEarthApp({root:$('scene'),interactive:true,onChange:(state,event)=>{
  if(!models||disposed)return;
  const current=model(),previous=current.state;current.state={...state};current.revision++;
  const control=event.control==='globe'?'orbit':event.control==='lighting'?'night':event.control;
  const satisfied={
    orbit:control==='orbit'&&(state.rotation!==previous.rotation||state.tilt!==previous.tilt),
    metric:state.metric==='energy',
    year:state.year>=2020,
    region:state.region==='asia',
    connections:state.connections,
    night:state.night,
  };
  for(const step of steps)if(step.control===control&&satisfied[control])current.completed.add(step.id);
  notify();render(true);
}});
const initial=earth.getState();
const fresh=revision=>({state:{...initial},completed:new Set(),revision});
models=Object.fromEntries(['watch','try','guide'].map(mode=>[mode,fresh(0)]));
const conditions=Object.fromEntries(steps.map(step=>[step.id,{
  label:step.title,evidence:'domain',trigger:'level',hints:[step.instruction],
  read:context=>context.mode==='watch'||models[context.mode].completed.has(step.id),
  subscribe:callback=>{observers.add(callback);return()=>observers.delete(callback);},
}]));
const guidance=createGuidance({
  authorize:request=>request.capability.startsWith('mode:')||Object.hasOwn(conditions,request.capability.replace(/^condition:/,''))||(request.capability==='fixture:reset'&&request.mode==='try'),
  conditions,
  fixture:{isolated:true,reset:async({signal})=>{
    if(signal.aborted)return {completed:false};
    models.try=fresh(models.try.revision+1);
    if(modeName()==='try')earth.setState(models.try.state,{animate:false});
    notify();return {completed:true};
  }},
});
director=createDirector({
  surface:{viewport:$('stage'),scene:$('scene'),overlay:$('sdk-overlay')},guidance,
  targets:Object.fromEntries(Object.entries(earth.targets).map(([key,element])=>[key,()=>element])),
});
const checkpoints=createCheckpointStore(director,{
  versions:()=>({script:'earth-v1-'+script.defaults.easing,host:'earth-v1',fixture:modeName()+':'+model().revision}),
  authorize:()=>true,verify:snapshot=>snapshot.versions.fixture===modeName()+':'+model().revision,
});

function render(force=false){
  if(disposed)return;
  const now=performance.now();if(!force&&now-lastUi<80)return;lastUi=now;
  const state=director.inspect(),step=steps.find(step=>step.id===state.sceneId)||steps[0],index=steps.indexOf(step),position=story.position(state);
  const waiting=state.waitingFor,running=['playing','buffering'].includes(state.status),next=state.reasons?.includes('step');
  Object.assign($('stage').dataset,{runtime:'sdk',scene:step.id,status:state.status,mode:state.mode,state:waiting?'waiting':running?'playing':'paused',clock:'text',reducedMotion:String(state.reducedMotion),ready:'true'});
  $('shot-number').textContent='CHECKPOINT '+String(index+1).padStart(2,'0')+' / 06';
  $('shot-title').textContent=step.title;$('earth-step-title').textContent=step.title;
  $('earth-instruction').textContent=state.status==='completed'?(model().completed.size===steps.length?'You have explored all six controls. Keep experimenting with the live globe.':'Walkthrough complete. Try the controls to explore the globe yourself.'):step.instruction;
  $('earth-progress').textContent=model().completed.size+' / 6 controls explored';
  $('earth-reset').disabled=state.mode!=='try'||busy;
  $('earth-reset').title=state.mode==='try'?'Reset this practice globe and its completed checkpoints.':'Switch to Try it to reset the isolated practice.';
  $('play-icon').textContent=running?'Ⅱ':'▶';$('play').setAttribute('aria-label',running?'Pause walkthrough':'Play walkthrough');$('play').disabled=busy;
  $('current-time').textContent=timecode(position);$('seek').value=String(position/1000);
  $('code-clock').textContent=timecode(position,true);
  $('next-step').hidden=!next;$('next-step').disabled=busy;
  $('retry-step').hidden=!waiting?.error;$('extend-step').hidden=!waiting;$('hint-step').hidden=!waiting;
  $('captions').setAttribute('aria-pressed',String(state.captionsEnabled));
  $('motion-toggle').textContent=state.reducedMotion?'Motion off':'Motion on';$('motion-toggle').setAttribute('aria-pressed',String(state.reducedMotion));
  earth.setReducedMotion(state.reducedMotion);
  $('caption').hidden=!state.captionsEnabled||!started;
  $('caption-label').textContent=waiting?'YOUR TURN':'DIRECTOR';
  $('caption-text').textContent=waiting?.instruction||state.caption||step.text;
  $('rate').textContent=state.rate+'×';
  $('player-state').textContent=waiting?.error?'Paused · '+waiting.error:waiting?'Your turn · try the highlighted control':next?'Continue when you are ready':state.status==='completed'?'Tour complete. Your world is still live.':running?'Playing · captioned walkthrough':started?'Paused · explore the globe':'Ready · six controls, one living planet';
  $('mode-hint').textContent={watch:'Watch the controls being introduced, then try any of them yourself.',try:'Each checkpoint waits for you. Every completed interaction changes the globe.',guide:'Learn at your own pace. Try the control, then continue to the next checkpoint.'}[state.mode];
  $('save-position').disabled=busy||!!waiting||!!state.pendingOperation;
  $('restore-position').disabled=busy||!saved||!!waiting||!!state.pendingOperation;
  document.querySelectorAll('[data-mode]').forEach(button=>{const active=button.dataset.mode===state.mode;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));button.disabled=busy;});
  document.querySelectorAll('.chapter-button').forEach(button=>{const active=button.dataset.scene===step.id;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');button.dataset.complete=String(model().completed.has(button.dataset.scene));});
  for(const [key,element] of Object.entries(earth.targets))element.classList.toggle('earth-tutorial-target',key===step.target&&started);
  $('live-code').textContent=JSON.stringify({sceneId:step.id,target:step.target,condition:step.id,mode:state.mode,completed:model().completed.has(step.id)},null,2);
}
function play(){started=true;result(director.play());render(true);}
function pause(){result(director.pause());render(true);}
function seek(ms,resume=false){started=true;const ok=result(director.seek(story.locate(ms)));render(true);if(ok&&resume)play();return ok;}
async function transaction(work,notice){
  if(busy||disposed)return;busy=true;render(true);
  try{if(result(await work())&&notice)toast(notice);}
  catch(error){toast(error.message||'The operation could not complete. Exit remains available.');}
  finally{busy=false;render(true);}
}
async function chooseMode(mode){
  await transaction(async()=>{
    const response=await director.setMode(mode);
    if(response.ok){earth.setState(model().state,{animate:false});saved=null;checkpoints.clear();}
    return response;
  });
  started=true;render(true);
}
function begin(){seek(0);$('experience').scrollIntoView({behavior:director.inspect().reducedMotion?'auto':'smooth',block:'start'});play();}
on($('play'),'click',()=>['playing','buffering'].includes(director.inspect().status)?pause():play());
for(const id of ['hero-play','footer-play','stage-play'])on($(id),'click',begin);
on($('restart'),'click',()=>seek(0));
on($('exit-tour'),'click',()=>{result(director.stop());started=false;render(true);});
on($('takeover'),'click',()=>{pause();$('scene').querySelector('canvas').focus({preventScroll:true});toast('Explore freely. Play continues from this checkpoint.');});
on($('seek'),'input',event=>seek(Number(event.target.value)*1000));
document.querySelectorAll('[data-mode]').forEach(button=>on(button,'click',()=>chooseMode(button.dataset.mode)));
on($('try-action'),'click',async()=>{await chooseMode('try');begin();});
on($('chapter-audio'),'click',()=>{begin();});
on($('earth-reset'),'click',()=>transaction(async()=>{
  const response=await director.resetFixture();
  if(response.ok){saved=null;checkpoints.clear();result(director.seek({sceneId:steps[0].id,timeMs:0}));}
  return response;
},'Practice reset. Start again whenever you are ready.'));
on($('next-step'),'click',()=>{result(director.next());render(true);});
on($('retry-step'),'click',()=>{result(director.retryBarrier());render(true);});
on($('extend-step'),'click',()=>{result(director.extendWait());render(true);});
on($('hint-step'),'click',()=>toast(director.inspect().waitingFor?.instruction||steps.find(step=>step.id===director.inspect().sceneId)?.instruction));
on($('captions'),'click',()=>{result(director.setCaptions(!director.inspect().captionsEnabled));render(true);});
on($('motion-toggle'),'click',()=>{result(director.setReducedMotion(!director.inspect().reducedMotion));render(true);});
on($('rate'),'click',()=>{const rates=[1,1.25,1.5,.75];result(director.setRate(rates[(rates.indexOf(director.inspect().rate)+1)%rates.length]));render(true);});
on($('save-position'),'click',()=>transaction(async()=>{saved=null;checkpoints.clear();const response=await checkpoints.capture();if(response.ok)saved=response.value;return response;},'Position saved. Globe controls remain independent of the playhead.'));
on($('restore-position'),'click',()=>transaction(()=>checkpoints.restore(saved.id),'Position restored. No globe interaction was replayed.'));
for(const [index,step] of steps.entries()){
  const scene=story.scenes[index],button=document.createElement('button');button.className='chapter-button';button.dataset.scene=step.id;
  const number=document.createElement('span');number.className='chapter-no';number.textContent='0'+(index+1)+' / '+timecode(scene.startMs);
  const title=document.createElement('strong');title.textContent=step.title;button.append(number,title);on(button,'click',()=>seek(scene.startMs,true));$('chapter-strip').append(button);
  const row=document.createElement('button'),stamp=document.createElement('time'),text=document.createElement('span');stamp.textContent=timecode(scene.startMs);text.textContent=step.text;row.append(stamp,text);on(row,'click',()=>seek(scene.startMs));$('transcript').append(row);
  if(index){const tick=document.createElement('i');tick.style.left=scene.startMs/story.total*100+'%';$('chapter-ticks').append(tick);}
}
on($('transcript-toggle'),'click',()=>{const show=$('transcript').hidden;$('transcript').hidden=!show;$('transcript-toggle').setAttribute('aria-expanded',String(show));});
function openDialog(id){pause();$(id).showModal();}
on($('script-open'),'click',()=>openDialog('script-dialog'));
for(const id of ['about-open','about-open-footer'])on($(id),'click',()=>openDialog('about-dialog'));
document.querySelectorAll('[data-close]').forEach(button=>on(button,'click',()=>button.closest('dialog').close()));
on($('copy-cue'),'click',async()=>{try{await navigator.clipboard.writeText($('live-code').textContent);toast('Current cue copied.');}catch{openDialog('script-dialog');}});
on($('download-script'),'click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(script,null,2)+'\n'],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='earth.tour.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
on(document,'keydown',event=>{
  if(document.querySelector('dialog[open]'))return;
  if(event.key==='Escape'){pause();$('scene').querySelector('canvas').focus({preventScroll:true});}
  if(event.code==='Space'&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.target.closest('input,textarea,select,button,a,canvas,[contenteditable=true]')){const box=$('theater').getBoundingClientRect();if(box.bottom<0||box.top>innerHeight)return;event.preventDefault();['playing','buffering'].includes(director.inspect().status)?pause():play();}
});
cleanups.push(director.on(event=>{if(event.type==='diagnostic')toast(event.detail?.diagnostic?.message||'Playback needs attention.');queueMicrotask(()=>render(true));}),director.onFrame(()=>render()));
$('seek').max=String(story.total/1000);document.querySelectorAll('[data-duration]').forEach(element=>element.textContent=timecode(story.total));
$('script-json').textContent=JSON.stringify(script,null,2);
for(let i=0;i<24;i++){const bar=document.createElement('i');bar.style.height=(8+(i*17%29))+'px';$('decorative-waveform').append(bar);}
if(!result(director.load(script)))throw new Error('The Earth walkthrough could not load.');
await director.setMode('try');render(true);
on(window,'pageshow',event=>{if(event.persisted&&!disposed)render(true);});
on(window,'pagehide',event=>{
  if(disposed)return;pause();clearTimeout(toastTimer);
  if(event.persisted)return;
  disposed=true;cleanups.splice(0).forEach(off=>off());checkpoints.destroy();director.destroy();guidance.destroy();earth.destroy();observers.clear();
});
