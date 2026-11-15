import {createDirector,createGuidance,createCheckpointStore} from './sdk/index.js';
import {EARTH_CHECKPOINTS} from './studio-sdk/sample.js';
import {createEarthApp} from './earth.mjs';
import {timecode,timeline,createEarthTour} from './model.mjs';

const $=id=>document.getElementById(id);
const steps=EARTH_CHECKPOINTS;
const demonstrations={orbit:{rotation:-65,tilt:16},zoomIn:{zoom:1.65},zoomOut:{zoom:.8},metric:{metric:'energy'},year:{year:2025},region:{region:'asia'},connections:{connections:true},night:{night:true}};
const clickDurationMs=700;
const globeTransitionMs=2200;
export const EARTH_TOUR=createEarthTour(steps);

document.body.classList.add('earth-demo');
$('scene').classList.add('earth-live');
$('stage').setAttribute('aria-label','Interactive Earth statistics application');
document.querySelector('.section-title').textContent='From the big picture to the smallest detail.';
document.querySelector('.hero-description').textContent='Fly closer. Pull back. Change the world. A cinematic tour of a real, living interface—with you in control.';
for(const node of $('hero-play').childNodes)if(node.nodeType===3&&node.textContent.includes('Roll the demo'))node.textContent=' Play the Earth film ';
$('stage-play').setAttribute('aria-label','Start the Earth walkthrough');
$('takeover').textContent='Explore freely ↗';
$('sound').hidden=true;
$('easing').hidden=true;document.querySelector('.easing-label').hidden=true;
document.querySelector('.desk-copy>p').textContent='Every checkpoint names a real control. Inspect the script, or open Studio to edit the story.';
$('stage-intro').hidden=true;
document.querySelector('.proof-card p').textContent='Zoom into the planet. Pull back to the whole world. Change a layer, move through time, and take control whenever you like.';
document.querySelector('.mini-code b').textContent='"earth.globe"';
const orbitLink=document.createElement('a');
orbitLink.href='./?example=orbit';orbitLink.textContent='Original Orbit example ↗';
document.querySelector('.sdk-tools').append(orbitLink);
const coach=document.createElement('div');coach.className='earth-coach';
coach.innerHTML='<div><span id="earth-progress" role="status"></span><strong id="earth-step-title"></strong><p id="earth-instruction"></p></div><button id="earth-reset" type="button">Replay demo</button>';
$('stage').after(coach);
$('about-dialog').querySelectorAll('p')[1].textContent='A real 3D globe, visible zoom controls, editable data layers, a year slider, regional focus, connections and day/night lighting. Eight captioned checkpoints use the reusable DOM Director core. The statistics and simplified geography are illustrative demo data.';
$('script-dialog').querySelector('p').textContent='These eight scenes use the canonical SDK schema. Close-ups, wider reveals, captions and the simulated cursor follow one presentation clock. The local app explicitly grants each demonstrated control change.';
const about=$('about-dialog').querySelectorAll('p');
about[3].textContent='Use Space to play or pause and Escape to pause and explore. The globe supports arrow keys and plus/minus for zoom. Motion off disables animated globe transitions. Captions and a transcript are available; this Earth story has no recorded narration.';
about[4].textContent='The globe and its data are bundled locally. No external images, fonts, analytics, account connection, recording or persistent storage. Nothing is sent when you use a control.';

let director,script=EARTH_TOUR,story=timeline(script),started=false,disposed=false,busy=false,saved=null,toastTimer=0,lastUi=-Infinity,globeTransition=null;
const cleanups=[],observers=new Set();
let models;
function on(element,type,listener,options){element.addEventListener(type,listener,options);cleanups.push(()=>element.removeEventListener(type,listener,options));}
function notify(){for(const callback of [...observers])callback();}
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},4200);}
function result(response){if(response?.ok===false){const issue=response.diagnostics[0];toast(issue?.code==='SEEK_BARRIER'?'Play this checkpoint before skipping ahead, or choose Explore freely.':issue?.message||'The walkthrough needs attention.');return false;}return true;}
function modeName(){return director?.inspect().mode||'watch';}
function model(){return models[modeName()];}
const earth=createEarthApp({root:$('scene'),interactive:true,onChange:(state,event)=>{
  if(!models||disposed)return;
  // Actual input takes over from Watch; Try's real-input gate can still resume.
  globeTransition=null;
  if(director&&modeName()==='watch')result(director.pause());
  const current=model(),previous=current.state;current.state={...state};current.revision++;
  const control=event.control==='globe'?'orbit':event.control==='lighting'?'night':event.control;
  const satisfied={
    orbit:control==='orbit'&&(state.rotation!==previous.rotation||state.tilt!==previous.tilt),
    zoomIn:state.zoom>previous.zoom,
    zoomOut:state.zoom<previous.zoom,
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
// Taking hold of a control pauses Watch before a value changes. A native menu
// or an already-selected button must not keep moving underneath the visitor.
function beginManualInput(event){
  if(!director||modeName()!=='watch'||!event.isTrusted)return;
  if(event.type==='pointerdown'&&event.button!==0)return;
  if(event.type==='keydown'&&!['Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','+','=','-'].includes(event.key))return;
  if(!event.target.closest?.('button,input,select,canvas'))return;
  clearGlobeTransition();pause();
}
on($('scene'),'pointerdown',beginManualInput,true);
on($('scene'),'keydown',beginManualInput,true);
const fresh=revision=>({state:{...initial},completed:new Set(),revision});
models=Object.fromEntries(['watch','try','guide'].map(mode=>[mode,fresh(0)]));
const conditions=Object.fromEntries(steps.map(step=>[step.id,{
  label:step.title,evidence:'domain',trigger:'level',hints:[step.instruction],
  read:context=>context.mode==='watch'||models[context.mode].completed.has(step.id),
  subscribe:callback=>{observers.add(callback);return()=>observers.delete(callback);},
}]));
const actions=Object.fromEntries(steps.map(step=>[step.id,{
  label:'Demonstrate '+step.title,impact:'ephemeral',modes:['watch','try','guide'],
  validate:args=>!!args&&typeof args==='object'&&!Array.isArray(args)&&Object.keys(args).length===0,
  execute:(_args,context)=>{
    if(context.signal.aborted)return {completed:false};
    // Only Watch applies its approved local demonstration; practice remains real input.
    if(context.mode==='watch'){
      const current=models.watch,from=earth.getState();
      earth.setState(demonstrations[step.control],{animate:false});
      current.state=earth.getState();current.revision++;current.completed.add(step.id);
      // The host commits once. Only its rendered transition follows the Director's
      // clock, so pause and playback speed also govern the planet's movement.
      globeTransition={sceneId:step.id,from,to:current.state};
      notify();
    }
    return {completed:true};
  },
}]));
const guidance=createGuidance({
  authorize:request=>['mode:watch','mode:try','mode:guide'].includes(request.capability)||
    (request.capability.startsWith('condition:')&&Object.hasOwn(conditions,request.capability.slice(10)))||
    (request.capability.startsWith('action:')&&Object.hasOwn(actions,request.capability.slice(7)))||
    (request.capability==='fixture:reset'&&request.mode==='try'),
  actions,conditions,
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
  versions:()=>({script:'earth-v3-'+script.defaults.easing,host:'earth-v3',fixture:modeName()+':'+model().revision}),
  authorize:()=>true,verify:snapshot=>snapshot.versions.fixture===modeName()+':'+model().revision,
});

function render(force=false){
  if(disposed)return;
  const state=director.inspect(),step=steps.find(step=>step.id===state.sceneId)||steps[0],index=steps.indexOf(step),position=story.position(state);
  // Visual click feedback follows presentation time, before the text UI throttle.
  const action=script.scenes.find(scene=>scene.id===step.id).cues.find(cue=>cue.kind==='action');
  const clickProgress=(state.timeMs-action.at)/clickDurationMs;
  earth.setReducedMotion(state.reducedMotion);
  if(globeTransition){
    const progress=Math.max(0,Math.min(1,(state.timeMs-action.at)/globeTransitionMs));
    if(!started||state.mode!=='watch'||state.sceneId!==globeTransition.sceneId||state.reducedMotion||progress===1){clearGlobeTransition();}
    else earth.setPresentationFrame({...globeTransition,progress:progress*progress*(3-2*progress)});
  }
  earth.setClickFeedback(started&&state.mode==='watch'&&!state.reducedMotion&&clickProgress>=0&&clickProgress<1?{target:step.target,progress:clickProgress}:null);
  // System motion changes can arrive on the only frame of a paused player.
  // Refresh that preference immediately instead of waiting for another tick.
  const now=performance.now();if(!force&&now-lastUi<80&&$('stage').dataset.reducedMotion===String(state.reducedMotion))return;lastUi=now;
  const waiting=state.waitingFor?.kind==='gate'?state.waitingFor:null;
  const running=isPlaying(state),next=state.reasons?.includes('step');
  Object.assign($('stage').dataset,{runtime:'sdk',scene:step.id,status:state.status,mode:state.mode,state:waiting?'waiting':running?'playing':'paused',clock:'text',reducedMotion:String(state.reducedMotion),ready:'true'});
  $('shot-number').textContent='CHECKPOINT '+String(index+1).padStart(2,'0')+' / '+String(steps.length).padStart(2,'0');
  $('shot-title').textContent=step.title;$('earth-step-title').textContent=step.title;
  $('earth-instruction').textContent=state.status==='completed'?(state.mode==='watch'?'All eight controls demonstrated. Explore freely, or choose Try it for a hands-on walkthrough.':model().completed.size===steps.length?'You have explored all eight controls. Keep experimenting with the live globe.':'Walkthrough complete. Try the controls to explore the globe yourself.'):state.mode==='watch'?step.text:step.instruction;
  $('earth-progress').textContent=model().completed.size+' / '+steps.length+' controls '+(state.mode==='watch'?'demonstrated':'explored');
  $('earth-reset').textContent=state.mode==='watch'?'Replay demo':'Reset practice';
  $('earth-reset').disabled=state.mode==='guide'||busy;
  $('earth-reset').title=state.mode==='watch'?'Start a fresh automatic Earth demonstration.':state.mode==='try'?'Reset this practice globe and its completed checkpoints.':'Switch to Try it to reset the isolated practice.';
  $('play-icon').textContent=running?'Ⅱ':'▶';$('play').setAttribute('aria-label',running?'Pause walkthrough':'Play walkthrough');$('play').disabled=busy;
  $('current-time').textContent=timecode(position);$('seek').value=String(position/1000);
  $('code-clock').textContent=timecode(position,true);
  $('next-step').hidden=!next;$('next-step').disabled=busy;
  $('retry-step').hidden=!state.waitingFor?.error;$('extend-step').hidden=!waiting;$('hint-step').hidden=!waiting;
  $('captions').setAttribute('aria-pressed',String(state.captionsEnabled));
  $('motion-toggle').textContent=state.reducedMotion?'Motion off':'Motion on';$('motion-toggle').setAttribute('aria-pressed',String(state.reducedMotion));
  $('caption').hidden=!state.captionsEnabled||!started;
  $('caption-label').textContent=waiting?'YOUR TURN':'DIRECTOR';
  $('caption-text').textContent=waiting?.instruction||state.caption||step.text;
  $('rate').textContent=state.rate+'×';
  $('player-state').textContent=state.waitingFor?.error?'Paused · '+state.waitingFor.error:waiting?'Your turn · try the highlighted control':next?'Continue when you are ready':state.status==='completed'?'Tour complete. Your world is still live.':running?'Playing · cinematic Earth tour':started?'Paused · explore the globe':'Ready · eight controls, one living planet';
  $('mode-hint').textContent={watch:'Automatic camera moves, real globe changes. Play the film, or take over at any time.',try:'Each checkpoint waits for you. Every completed interaction changes the globe.',guide:'Learn at your own pace. Try the control, then continue to the next checkpoint.'}[state.mode];
  $('save-position').disabled=busy||!!state.waitingFor||!!state.pendingOperation;
  $('restore-position').disabled=busy||!saved||!!state.waitingFor||!!state.pendingOperation;
  document.querySelectorAll('button[data-mode]').forEach(button=>{const active=button.dataset.mode===state.mode;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));button.disabled=busy;});
  document.querySelectorAll('.chapter-button').forEach(button=>{const active=button.dataset.scene===step.id;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');button.dataset.complete=String(model().completed.has(button.dataset.scene));});
  for(const [key,element] of Object.entries(earth.targets))element.classList.toggle('earth-tutorial-target',key===step.target&&started);
  $('live-code').textContent=JSON.stringify({sceneId:step.id,target:step.target,condition:step.id,mode:state.mode,completed:model().completed.has(step.id)},null,2);
}
function isPlaying(state=director.inspect()){return ['playing','buffering'].includes(state.status)||(state.waitingFor?.kind==='action'&&!state.waitingFor.error);}
function clearGlobeTransition(){globeTransition=null;earth.setPresentationFrame(null);}
function play(){if(busy||disposed)return;if(modeName()==='watch'&&director.inspect().status==='completed'){replayWatch(true);return;}started=true;result(director.play());render(true);}
function pause(){result(director.pause());render(true);}
function seek(ms,resume=false){clearGlobeTransition();started=true;const ok=result(director.seek(story.locate(ms)));render(true);if(ok&&resume)play();return ok;}
function replayWatch(resume=false){
  if(busy||disposed)return false;
  const rate=director.inspect().rate;clearGlobeTransition();result(director.pause());
  models.watch=fresh(models.watch.revision+1);earth.setState(models.watch.state,{animate:false});earth.setClickFeedback(null);
  saved=null;checkpoints.clear();
  if(!result(director.load(script)))return false;
  result(director.setRate(rate));started=true;render(true);if(resume)play();return true;
}
async function transaction(work,notice){
  if(busy||disposed)return;busy=true;render(true);
  try{if(result(await work())&&notice)toast(notice);}
  catch(error){toast(error.message||'The operation could not complete. Exit remains available.');}
  finally{busy=false;render(true);}
}
async function chooseMode(mode){
  if(modeName()===mode)return;
  const rate=director.inspect().rate;
  await transaction(async()=>{
    const response=await director.setMode(mode);
    if(!response.ok)return response;
    clearGlobeTransition();earth.setState(model().state,{animate:false});earth.setClickFeedback(null);saved=null;checkpoints.clear();
    // A fresh run prevents a Try no-op action from suppressing Watch's demonstration.
    const loaded=director.load(script);if(loaded.ok)result(director.setRate(rate));return loaded;
  });
  started=true;render(true);
}
function begin(){if(modeName()==='watch'?!replayWatch():!seek(0))return;$('experience').scrollIntoView({behavior:director.inspect().reducedMotion?'auto':'smooth',block:'start'});play();}
on($('play'),'click',()=>isPlaying()?pause():play());
for(const id of ['hero-play','footer-play','stage-play'])on($(id),'click',begin);
on($('restart'),'click',()=>modeName()==='watch'?replayWatch():seek(0));
on($('exit-tour'),'click',()=>{clearGlobeTransition();result(director.stop());started=false;render(true);});
on($('takeover'),'click',()=>{clearGlobeTransition();pause();$('scene').querySelector('canvas').focus({preventScroll:true});toast('Explore freely. Play continues from this checkpoint.');});
on($('seek'),'input',event=>seek(Number(event.target.value)*1000));
document.querySelectorAll('button[data-mode]').forEach(button=>on(button,'click',()=>chooseMode(button.dataset.mode)));
on($('try-action'),'click',async()=>{await chooseMode('try');begin();});
on($('chapter-audio'),'click',()=>{begin();});
on($('earth-reset'),'click',()=>{if(modeName()==='watch'){replayWatch(true);return;}void transaction(async()=>{
  const response=await director.resetFixture();
  if(response.ok){saved=null;checkpoints.clear();result(director.seek({sceneId:steps[0].id,timeMs:0}));}
  return response;
},'Practice reset. Start again whenever you are ready.');});
on($('next-step'),'click',()=>{result(director.next());render(true);});
on($('retry-step'),'click',()=>{result(director.retryBarrier());render(true);});
on($('extend-step'),'click',()=>{result(director.extendWait());render(true);});
on($('hint-step'),'click',()=>toast(director.inspect().waitingFor?.instruction||steps.find(step=>step.id===director.inspect().sceneId)?.instruction));
on($('captions'),'click',()=>{result(director.setCaptions(!director.inspect().captionsEnabled));render(true);});
on($('motion-toggle'),'click',()=>{result(director.setReducedMotion(!director.inspect().reducedMotion));render(true);});
on($('rate'),'click',()=>{const rates=[1,1.25,1.5,.75];result(director.setRate(rates[(rates.indexOf(director.inspect().rate)+1)%rates.length]));render(true);});
on($('save-position'),'click',()=>transaction(async()=>{saved=null;checkpoints.clear();const response=await checkpoints.capture();if(response.ok)saved=response.value;return response;},'Position saved. Globe controls remain independent of the playhead.'));
on($('restore-position'),'click',()=>transaction(()=>{clearGlobeTransition();return checkpoints.restore(saved.id);},'Position restored. No globe interaction was replayed.'));
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
  if(event.key==='Escape'){clearGlobeTransition();pause();$('scene').querySelector('canvas').focus({preventScroll:true});}
  if(event.code==='Space'&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.target.closest('input,textarea,select,button,a,canvas,[contenteditable=true]')){const box=$('theater').getBoundingClientRect();if(box.bottom<0||box.top>innerHeight)return;event.preventDefault();isPlaying()?pause():play();}
});
cleanups.push(director.on(event=>{if(event.type==='diagnostic')toast(event.detail?.diagnostic?.message||'Playback needs attention.');queueMicrotask(()=>render(true));}),director.onFrame(()=>render()));
$('seek').max=String(story.total/1000);document.querySelectorAll('[data-duration]').forEach(element=>element.textContent=timecode(story.total));
$('script-json').textContent=JSON.stringify(script,null,2);
for(let i=0;i<24;i++){const bar=document.createElement('i');bar.style.height=(8+(i*17%29))+'px';$('decorative-waveform').append(bar);}
if(!result(director.load(script)))throw new Error('The Earth walkthrough could not load.');
render(true);
on(window,'pageshow',event=>{if(event.persisted&&!disposed)render(true);});
on(window,'pagehide',event=>{
  if(disposed)return;pause();clearTimeout(toastTimer);
  if(event.persisted)return;
  disposed=true;cleanups.splice(0).forEach(off=>off());checkpoints.destroy();director.destroy();guidance.destroy();earth.destroy();observers.clear();
});
