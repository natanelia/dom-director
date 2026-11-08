import {createSample,createProjectStore,createEvaluator,editProject,findClip,freshId,duration,sceneTimeline,locate,updateClip,moveClip,trimClip,splitClip,deleteClip,duplicateClip,reorderScene,proposeRetime,exportSubtitles,CAPTION_THEME,CURSOR_THEME} from './studio-sdk/index.js';
import {createMediaBank,createTransport,saveProjectBundle,readProjectBundle,generateVoiceTake} from './studio-sdk/media.js';
import {setAppearance,applyCaptionPreset,distributeCaptionWords,addKeyframe,updateKeyframe,deleteKeyframe,addGesture,addScene,deleteScene,addCaption,proposeCaptionImport,proposeVoiceReplacement} from './studio-sdk/editing.js';
import {createCanvas,TARGETS,drawWaveform} from './studio-view.mjs';

const $=id=>document.getElementById(id),copy=value=>JSON.parse(JSON.stringify(value)),seconds=ms=>(ms/1000).toFixed(2);
const clock=ms=>{const n=Math.max(0,ms);return String(Math.floor(n/60000)).padStart(2,'0')+':'+(n/1000%60).toFixed(2).padStart(5,'0');};
const names={camera:'Camera',cursor:'Cursor',voice:'Voiceover',captions:'Closed captions'};
const approved=new Set(TARGETS.map(t=>t.id)),samples=new Set(['voice.overview','voice.signal','voice.story']);
const cleanups=[],urls=new Map(),dirtyFields=new Set(),inspectorSections=new Map();
let store=createProjectStore(createSample()),selected={sceneId:'overview',kind:'captions',clipId:'cc.overview.0',keyId:null};
let time=0,scope='clip',viewZoom=1,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,cc=true,sound=false,loop=false;
let disposed=false,busy=false,drag=null,recording=null,operation=null,transport,view,ready=false,paintRequest=null,lastExport=-1,dialogCleanup=null,fieldCommit=false;
// Optional host adapter. No service is contacted or configured by this public fixture.
let voiceProvider=null;
const project=()=>store.snapshot().project;
const revision=()=>store.snapshot().revision;
const scene=()=>project().scenes.find(s=>s.id===selected.sceneId)||project().scenes[0];
const selectedClip=()=>{try{return findClip(project(),selected.clipId);}catch{return null;}};
function on(node,type,callback,options){node.addEventListener(type,callback,options);cleanups.push(()=>node.removeEventListener(type,callback,options));}
function node(tag,text,parent){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(parent)parent.append(n);return n;}
function button(text,parent,callback,id){const n=node('button',text,parent);n.type='button';if(id)n.id=id;n.addEventListener('click',callback);return n;}
function message(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function hostCheck(p){
  if(p.canvas.width!==960||p.canvas.height!==540)throw Error('This sample host uses a 960 × 540 application. Open this project in its matching host.');
  for(const target of createEvaluator(p).targets)if(!approved.has(target))throw Error('This host does not expose the focus “'+target+'”. Your current project is unchanged.');
  for(const a of p.assets)if(a.source==='sample'&&!samples.has(a.sample))throw Error('This project needs a prepared voice that this host does not provide.');
}
function makeBank(){return createMediaBank({resolveSample:id=>{if(!samples.has(id))throw Error('Unapproved prepared voice.');return new URL('./assets/'+id+'.mp3',location.href).href;}});}
let bank=makeBank();
function makeTransport(){return createTransport({bank,onFrame:at=>{time=at;draw();},onState:s=>{
  if(disposed)return;const previous=$('studio').dataset.playback,running=s.state==='playing'||s.state==='preparing';$('studio').classList.toggle('previewing',running);$('studio').dataset.playback=s.state;
  $('play').textContent=running?'Ⅱ':'▶';$('play').setAttribute('aria-label',running?'Pause preview':'Play preview');$('play').disabled=s.state==='preparing';
  if(s.error)message(s.error,true);
  else if(s.state==='preparing')message(s.audible?'Preparing selected voice takes…':'Preparing preview…');
  else if(s.state==='playing')message(s.audible?'Playing with voiceover.':'Playing silently.');
  else if(s.state==='paused'&&(previous==='playing'||previous==='preparing'))message('Preview paused.');
}});}
function stop(){if(transport)time=transport.pause();if(ready)draw();}
function flush(){
  const active=document.activeElement;if(dirtyFields.has(active))active.dispatchEvent(new Event('change',{bubbles:true}));
  if(dirtyFields.size){message('Finish or correct the highlighted field before continuing.',true);[...dirtyFields][0]?.focus();return false;}
  return true;
}
function ensure(){return !disposed&&!busy&&!recording&&flush();}
function seek(at){stop();time=Math.max(0,Math.min(duration(project()),Math.round(at)));transport.seek(time);draw();}
function normalizeSelection(){
  if(!project().scenes.some(s=>s.id===selected.sceneId))selected.sceneId=project().scenes[0].id;
  let found=selectedClip();
  if(!found||found.clip.sceneId!==selected.sceneId||found.track.kind!==selected.kind||(found.track.kind==='captions'&&found.track.id!==project().captionTrack)){const tracks=project().tracks.filter(t=>t.kind===selected.kind&&(t.kind!=='captions'||t.id===project().captionTrack));found=tracks.map(track=>({track,clip:track.clips.find(c=>c.sceneId===selected.sceneId)})).find(x=>x.clip);selected.clipId=found?.clip.id||null;}
  if(!found?.clip.keys?.some(k=>k.id===selected.keyId))selected.keyId=found?.clip.keys?.[0]?.id||null;
}
function refresh(){normalizeSelection();renderScenes();renderTimeline();if(!fieldCommit)renderInspector();$('project-title').value=project().title;const s=store.snapshot();$('undo').disabled=!s.canUndo;$('redo').disabled=!s.canRedo;$('revision').textContent='Revision '+s.revision+(lastExport===s.revision?' · exported':' · in this tab');$('seek').max=String(duration(project())/1000);draw();}
function commit(next,label='Edit project',expected=revision()){
  hostCheck(next);stop();const at=time;store.commit(next,label,expected);loop=false;$('loop').setAttribute('aria-pressed','false');transport.load(project());transport.setSound(sound);transport.seek(Math.min(at,duration(project())));dirtyFields.clear();refresh();message(label+' · undo available. Save project to keep your work.');
}
function act(work){if(!ensure())return;try{work();}catch(error){message(error.message,true);}}
function selectClip(id,{jump=true}={}){if(!ensure())return;const found=findClip(project(),id);stop();if(found.track.kind==='captions'&&project().captionTrack!==found.track.id)commit(editProject(project(),p=>{p.captionTrack=found.track.id;}),'Choose caption language');selected={sceneId:found.clip.sceneId,kind:found.track.kind,clipId:id,keyId:found.clip.keys?.[0]?.id||null};scope='clip';if(jump)seek(sceneTimeline(project()).find(s=>s.id===selected.sceneId).startMs+found.clip.startMs);refresh();}
function selectScene(id){if(!ensure())return;selected.sceneId=id;selected.clipId=null;stop();seek(sceneTimeline(project()).find(s=>s.id===id).startMs);refresh();}
function draw(override=project()){
  if(!ready||disposed)return;
  try{if(!view.render(override,time,{reducedMotion:reduced,captions:cc,zoom:viewZoom})){transport.pause();return;}let found;try{found=findClip(override,selected.clipId);}catch{}view.showHandles(transport.inspect().state==='playing'?null:found?.clip,selected.keyId);}
  catch(error){transport.pause();message(error.message,true);}
  $('timecode').textContent=clock(time)+' / '+clock(duration(project()));$('seek').value=String(time/1000);$('playhead').style.left=(135+time/1000*Number($('timeline-zoom').value))+'px';
  const at=locate(project(),time),index=project().scenes.findIndex(s=>s.id===at.scene.id);$('scene-name').textContent=String(index+1).padStart(2,'0')+' / '+at.scene.title;
  $('motion').textContent=reduced?'Motion off':'Motion on';$('motion').setAttribute('aria-pressed',String(reduced));$('captions').setAttribute('aria-pressed',String(cc));
}
function renderScenes(){
  const list=$('scene-list');list.replaceChildren();$('scene-count').textContent=project().scenes.length+' scenes';
  project().scenes.forEach((s,i)=>{const li=node('li',undefined,list),b=button('',li,()=>selectScene(s.id));b.className='scene-card';b.dataset.scene=s.id;b.setAttribute('aria-label',s.title+', '+seconds(s.durationMs)+' seconds');if(s.id===selected.sceneId)b.setAttribute('aria-current','step');node('div',undefined,b).className='scene-art';const title=node('div',undefined,b);title.className='scene-title';node('b',String(i+1).padStart(2,'0'),title);node('span',s.title,title);node('small',seconds(s.durationMs)+'s',b).className='scene-duration';});
}
function renderTimeline(){
  const scale=Number($('timeline-zoom').value),total=duration(project()),ruler=$('ruler'),lanes=$('lanes'),offsets=new Map(sceneTimeline(project()).map(s=>[s.id,s.startMs]));
  $('timeline-content').style.width=Math.max($('timeline-scroll').clientWidth,135+total/1000*scale+30)+'px';$('timeline-content').style.backgroundSize=scale+'px 100%';ruler.replaceChildren();lanes.replaceChildren();
  const interval=scale<30?5:scale<65?2:1;for(let s=0;s<=total/1000;s+=interval){const tick=node('span',s.toFixed(0)+'s',ruler);tick.style.left=s*scale+'px';}
  function lane(label,kind){const row=node('div',undefined,lanes);row.className='lane';row.dataset.kind=kind;const head=node('div',undefined,row);head.className='lane-label';node('i',undefined,head).className='swatch';node('strong',label,head);const body=node('div',undefined,row);body.className='lane-body';return {row,head,body};}
  const scenes=lane('Scenes','scenes');scenes.row.classList.add('scene-lane');for(const s of project().scenes){const b=button(s.title,scenes.body,()=>selectScene(s.id));b.className='clip';b.style.left=offsets.get(s.id)/1000*scale+'px';b.style.width=s.durationMs/1000*scale+'px';}
  for(const track of project().tracks){
    const l=lane(track.name,track.kind);l.row.classList.toggle('off',!track.enabled);
    const enabled=button(track.enabled?'●':'○',l.head,()=>act(()=>commit(editProject(project(),p=>{p.tracks.find(t=>t.id===track.id).enabled=!track.enabled;}),'Toggle '+track.name)));enabled.setAttribute('aria-label',(track.enabled?'Hide ':'Show ')+track.name);enabled.setAttribute('aria-pressed',String(track.enabled));
    const lock=button(track.locked?'▣':'□',l.head,()=>act(()=>commit(editProject(project(),p=>{p.tracks.find(t=>t.id===track.id).locked=!track.locked;}),'Toggle track lock')));lock.setAttribute('aria-label',(track.locked?'Unlock ':'Lock ')+track.name);lock.setAttribute('aria-pressed',String(track.locked));
    for(const clip of track.clips){
      const b=button('',l.body,()=>{if(drag?.moved)return;selectClip(clip.id);});b.className='clip';b.dataset.clip=clip.id;b.dataset.track=track.id;b.setAttribute('aria-pressed',String(clip.id===selected.clipId));b.classList.toggle('selected',clip.id===selected.clipId);b.setAttribute('aria-label',names[track.kind]+': '+(clip.text||clip.script||project().scenes.find(s=>s.id===clip.sceneId).title)+', '+seconds(clip.durationMs)+' seconds');b.style.left=(offsets.get(clip.sceneId)+clip.startMs)/1000*scale+'px';b.style.width=Math.max(4,clip.durationMs/1000*scale)+'px';
      if(track.kind==='voice'&&bank.waveform(clip.assetId)){const wave=document.createElementNS('http://www.w3.org/2000/svg','svg');wave.classList.add('wave-line');b.append(wave);drawWaveform(wave,bank.waveform(clip.assetId));}
      node('span',clip.text||clip.script||names[track.kind],b).className='clip-label';
      for(const k of clip.keys||[])if(k.atMs>=clip.offsetMs&&k.atMs<=clip.offsetMs+clip.durationMs){const d=node('i',undefined,b);d.className='diamond';d.style.left=((k.atMs-clip.offsetMs)/1000*scale)+'px';}
      for(const side of ['start','end']){const h=node('span',undefined,b);h.className='trim '+side;h.dataset.trim=side;h.setAttribute('aria-hidden','true');}
    }
  }
}
function group(title,{collapsed=false}={}){
  const p=$('inspector'),g=node(collapsed?'details':'section',undefined,p);g.className='inspector-group';
  if(collapsed){g.dataset.section=title;g.open=inspectorSections.get(title)??false;}
  node(collapsed?'summary':'h3',title,g);return g;
}
function field(parent,id,label,value,change,{type='text',min,max,step,options,maxLength,preview}={}){
  const wrap=node('label',label,parent);wrap.className='field'+(type==='checkbox'?' checkbox':'');const input=node(options?'select':type==='textarea'?'textarea':'input',undefined,wrap);input.id=id;
  if(options){for(const option of options){const [v,text]=Array.isArray(option)?option:[option,option];const n=node('option',text,input);n.value=v;}}
  else if(type!=='textarea')input.type=type;
  if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;if(step!==undefined)input.step=step;if(maxLength)input.maxLength=maxLength;
  if(type==='checkbox')input.checked=!!value;else input.value=value??'';
  let savedValue=type==='checkbox'?input.checked:input.value;
  const error=node('span','',wrap);error.id=id+'-error';error.className='error';input.setAttribute('aria-describedby',error.id);
  input.addEventListener('input',()=>{stop();dirtyFields.add(input);if(preview)try{preview(input.value);}catch{}});
  input.addEventListener('change',()=>{
    if(disposed)return;stop();
    try{
      if([...dirtyFields].some(n=>n!==input))throw Error('Correct or discard the other highlighted field first.');
      if(!input.checkValidity())throw Error(input.validationMessage||'Check this value.');
      const v=type==='checkbox'?input.checked:type==='number'?input.valueAsNumber:input.value;
      if(type==='number'&&!Number.isFinite(v))throw Error('Enter a number.');
      dirtyFields.delete(input);fieldCommit=true;try{change(v);}finally{fieldCommit=false;}savedValue=type==='checkbox'?input.checked:input.value;input.removeAttribute('aria-invalid');error.textContent='';
    }catch(e){dirtyFields.add(input);input.setAttribute('aria-invalid','true');error.textContent=e.message;message(e.message,true);}
  });
  input.addEventListener('keydown',event=>{if(event.key!=='Escape'||!dirtyFields.has(input))return;event.stopPropagation();if(type==='checkbox')input.checked=savedValue;else input.value=savedValue;dirtyFields.delete(input);input.removeAttribute('aria-invalid');error.textContent='';draw();message('Uncommitted field edit discarded.');});
  return input;
}
function timing(parent,clip){
  const row=node('div',undefined,parent);row.className='row';
  field(row,'clip-start','Start in scene (s)',seconds(clip.startMs),v=>commit(moveClip(project(),clip.id,Math.round(v*1000),{ripple:$('ripple').checked}),'Move clip'),{type:'number',min:0,step:.01});
  field(row,'clip-end','End in scene (s)',seconds(clip.startMs+clip.durationMs),v=>commit(trimClip(project(),clip.id,findClip(project(),clip.id).clip.startMs,Math.round(v*1000)),'Trim clip'),{type:'number',min:0,step:.01});
}
function renderInspector(){
  const p=$('inspector'),scroll=p.scrollTop;
  // Capture native disclosure state synchronously, before replacing any DOM.
  // Queued toggle events from detached nodes must not overwrite the new controls.
  for(const detail of p.querySelectorAll(':scope > details[data-section]'))inspectorSections.set(detail.dataset.section,detail.open);
  p.replaceChildren();normalizeSelection();const found=selectedClip();
  document.querySelectorAll('[data-kind]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.kind===selected.kind));});
  node('span',names[selected.kind],p).className='eyebrow';node('h2',selected.kind==='captions'?'Make every word clear.':selected.kind==='voice'?'Give the story a voice.':selected.kind==='cursor'?'Lead the eye.':'Frame the moment.',p);
  node('div',scene().title,p).className='context';
  if(!found){node('p','No '+names[selected.kind].toLowerCase()+' clip in this scene.',p).className='empty';if(selected.kind==='captions')button('Add caption',p,()=>act(()=>{const r=addCaption(project(),selected.sceneId);selected.clipId=r.clipId;commit(r.value,'Add caption');}),'add-caption');if(selected.kind==='voice')button('Add voiceover',p,()=>act(()=>{const id=freshId(project(),'voice');const q=editProject(project(),d=>{const t=d.tracks.find(t=>t.kind==='voice');t.clips.push({id,sceneId:selected.sceneId,startMs:0,durationMs:scene().durationMs,assetId:null,sourceInMs:0,script:'',gain:1,fadeInMs:0,fadeOutMs:0});});selected.clipId=id;commit(q,'Add voiceover');}),'add-voice');return;}
  const {track,clip}=found;if(track.locked)node('p','This track is locked. Unlock it on the timeline to edit.',p).className='warning';
  if(track.kind==='captions')captionInspector(p,track,clip);else if(track.kind==='voice')voiceInspector(p,track,clip);else motionInspector(p,track,clip);
  const details=group('Scene and clip timing',{collapsed:true});timing(details,clip);
  field(details,'scene-title','Scene title',scene().title,v=>commit(editProject(project(),d=>{d.scenes.find(s=>s.id===selected.sceneId).title=v;}),'Rename scene'),{maxLength:160});
  field(details,'scene-duration','Scene duration (s)',seconds(scene().durationMs),v=>{const nextMs=Math.round(v*1000);if(nextMs===scene().durationMs)return;const origin=revision(),proposal=proposeRetime(project(),scene().id,nextMs);modal('Resize this scene?',body=>node('p',proposal.changes.length+' clip timings change; later scenes move by '+seconds(proposal.deltaMs)+' seconds. Voice is never stretched. Locked tracks block retiming.',body),[['Cancel',()=>{closeDialog();renderInspector();}],['Apply timing',()=>{try{commit(proposal.value,'Resize scene',origin);closeDialog();}catch(e){message(e.message,true);}},true]]);dialogCleanup=()=>renderInspector();},{type:'number',min:.25,max:180,step:.01});
  p.scrollTop=Math.min(scroll,p.scrollHeight);
}
function captionInspector(p,track,clip){
  field(p,'caption-text','Caption text',clip.text,v=>{const next=editProject(project(),d=>{const c=findClip(d,clip.id).clip;c.text=v;if(c.words)delete c.words;});if(clip.words){const origin=revision();modal('Update caption text?',body=>node('p','Changing this text clears its existing word timings. The voice recording is unchanged. Undo restores both text and word timing.',body),[['Cancel',()=>{closeDialog();renderInspector();}],['Update caption',()=>{commit(next,'Edit caption and clear word timing',origin);closeDialog();},true]]);dialogCleanup=()=>renderInspector();}else commit(next,'Edit caption');},{type:'textarea',maxLength:4000,preview:v=>{if(v.trim()&&!clip.words)draw(updateClip(project(),clip.id,{text:v}));}});
  if(clip.words)node('p','This caption has word timing. Editing its text requires replacing or clearing the word timings.',p).className='note';
  const row=node('div',undefined,p);row.className='row';
  field(row,'caption-language','Caption track',project().captionTrack,v=>{selected.clipId=null;commit(editProject(project(),d=>{d.captionTrack=v;}),'Choose caption language');renderInspector();},{options:project().tracks.filter(t=>t.kind==='captions').map(t=>[t.id,t.name])});
  field(row,'appearance-scope','Apply style to',scope,v=>{scope=v;renderInspector();},{options:[['clip','This caption'],['track','This language'],['project','Project default']]});
  const a=node('div',undefined,p);a.className='actions';for(const name of ['clean','contrast','minimal'])button(name[0].toUpperCase()+name.slice(1),a,()=>act(()=>commit(applyCaptionPreset(project(),clip.id,name,scope),'Apply '+name+' captions')),'preset-'+name);
  const s={...CAPTION_THEME,...project().captionTheme,...track.style,...clip.style},style=(key,v)=>commit(setAppearance(project(),clip.id,{[key]:v},{scope}),'Change caption '+key);
  field(p,'caption-font','Font',s.font,v=>style('font',v),{options:[['sans','Modern sans'],['serif','Editorial serif'],['mono','Monospace']]});
  const r=node('div',undefined,p);r.className='row';field(r,'caption-size','Text size',s.size,v=>style('size',v),{type:'number',min:12,max:96,step:1});field(r,'caption-weight','Weight',s.weight,v=>style('weight',Number(v)),{options:[400,500,600,700,800].map(v=>[String(v),String(v)])});
  const colors=node('div',undefined,p);colors.className='row';field(colors,'caption-color','Text color',s.color,v=>style('color',v),{type:'color'});field(colors,'caption-background','Background',s.background,v=>style('background',v),{type:'color'});
  const advanced=group('Position and appearance',{collapsed:true});for(const [key,label,min,max,step] of [['x','Horizontal position (%)',0,100,1],['y','Vertical position (%)',0,100,1],['width','Caption width (%)',20,100,1],['opacity','Background opacity',0,1,.05],['outline','Text outline',0,8,.5],['padding','Padding',0,40,1],['radius','Corner radius',0,40,1]])field(advanced,'caption-'+key,label,s[key],v=>style(key,v),{type:'number',min,max,step});
  field(advanced,'caption-align','Alignment',s.align,v=>style('align',v),{options:['left','center','right']});button('Reset this style scope',advanced,()=>act(()=>commit(setAppearance(project(),clip.id,{}, {scope,reset:true}),'Reset caption style')));
  const words=group('Word highlighting',{collapsed:true});
  node('p','Word timing is optional. Even spacing is an editing starting point, not automatic speech alignment.',words).className='note';
  if(!clip.words)button('Distribute words evenly',words,()=>act(()=>commit(distributeCaptionWords(project(),clip.id),'Add approximate word timing')),'add-word-timing');
  else {button('Use plain caption',words,()=>act(()=>commit(editProject(project(),d=>{delete findClip(d,clip.id).clip.words;}),'Remove word highlighting')));for(const [i,w] of clip.words.entries()){const r=node('div',undefined,words);r.className='row';for(const [prop,label] of [['startMs','Start'],['endMs','End']])field(r,'word-'+i+'-'+prop,w.text+' · '+label+' (s)',seconds(w[prop]),v=>commit(editProject(project(),d=>{findClip(d,clip.id).clip.words[i][prop]=Math.round(v*1000);}),'Edit word timing'),{type:'number',min:0,step:.01});}}
  const actions=node('div',undefined,p);actions.className='actions';button('Add caption',actions,()=>act(()=>{const r=addCaption(project(),selected.sceneId,locate(project(),time).timeMs);selected.clipId=r.clipId;commit(r.value,'Add caption');}),'add-caption');button('Import VTT / SRT',actions,()=>{if(ensure())$('subtitle-file').click();},'import-subtitles');
}
function motionInspector(p,track,clip){
  const camera=track.kind==='camera';
  if(!camera){const s={...CURSOR_THEME,...project().cursorTheme,...track.style,...clip.style};const style=(key,v)=>commit(setAppearance(project(),clip.id,{[key]:v}),'Change cursor '+key);
    field(p,'cursor-shape','Cursor shape',s.shape,v=>style('shape',v),{options:[['arrow','Arrow'],['hand','Hand'],['dot','Dot']]});
    const r=node('div',undefined,p);r.className='row';field(r,'cursor-size','Size',s.size,v=>style('size',v),{type:'number',min:12,max:96,step:1});field(r,'cursor-halo','Halo radius',s.halo,v=>style('halo',v),{type:'number',min:0,max:40,step:1});
    const c=node('div',undefined,p);c.className='row';field(c,'cursor-color','Fill',s.color,v=>style('color',v),{type:'color'});field(c,'cursor-stroke','Outline',s.stroke,v=>style('stroke',v),{type:'color'});field(p,'cursor-trail','Motion trail',s.trail,v=>style('trail',v),{type:'checkbox'});
  }
  node('h3',camera?'Camera keyframes':'Cursor path',p);const list=node('div',undefined,p);list.className='key-list';
  for(const [i,key] of clip.keys.entries()){const b=button('◆ '+seconds(key.atMs-clip.offsetMs)+'s',list,()=>act(()=>{selected.keyId=key.id;seek(sceneTimeline(project()).find(s=>s.id===clip.sceneId).startMs+clip.startMs+Math.max(0,Math.min(clip.durationMs,key.atMs-clip.offsetMs)));renderInspector();draw();}));b.dataset.key=key.id;b.setAttribute('aria-pressed',String(selected.keyId===key.id));b.setAttribute('aria-label','Keyframe '+(i+1)+' at '+seconds(key.atMs-clip.offsetMs)+' seconds');}
  const key=clip.keys.find(k=>k.id===selected.keyId)||clip.keys[0];selected.keyId=key.id;
  const change=(patch)=>commit(updateKeyframe(project(),clip.id,key.id,patch),'Edit '+track.kind+' keyframe');
  field(p,'key-time','Keyframe in clip (s)',seconds(key.atMs-clip.offsetMs),v=>change({atMs:Math.round(v*1000)+clip.offsetMs}),{type:'number',step:.01});
  field(p,'key-target','Focus target',key.target,v=>change({target:v}),{options:TARGETS.map(t=>[t.id,t.label])});
  if(camera)field(p,'camera-zoom','Camera zoom',key.zoom,v=>change({zoom:v}),{type:'number',min:.1,max:8,step:.05});
  const xy=node('div',undefined,p);xy.className='row';for(const prop of ['x','y'])field(xy,'key-'+prop,prop.toUpperCase()+' offset (scene px)',key[prop],v=>change({[prop]:v}),{type:'number',min:prop==='x'?-3840:-2160,max:prop==='x'?3840:2160,step:1});
  if(!camera)field(p,'cursor-curve','Path curve',key.curve,v=>change({curve:v}),{type:'number',min:-1000,max:1000,step:5});
  field(p,'key-easing','Ease into keyframe',key.easing,v=>change({easing:v}),{options:[['gentle','Smooth'],['direct','Direct'],['overview','Soft landing'],['instant','Cut']]});
  const actions=node('div',undefined,p);actions.className='actions';
  button('＋ Key at playhead',actions,()=>act(()=>{const key=findClip(project(),clip.id).clip.keys.find(k=>k.id===selected.keyId);if(!key)throw Error('Select a current keyframe.');const at=locate(project(),time);if(at.scene.id!==clip.sceneId)throw Error('Move the playhead into this clip.');const pos=Math.round(at.timeMs-clip.startMs),{bounds,box}=view.geometry(),f=createEvaluator(project()).sample(time,bounds,box),r=bounds[key.target];let patch={target:key.target};
    if(camera){const center={x:(box.width/2-f.camera.x)/f.camera.scale,y:(box.height/2-f.camera.y)/f.camera.scale};const base=createEvaluator(editProject(project(),d=>{const c=findClip(d,clip.id).clip;c.keys=[{...key,atMs:0,x:0,y:0,zoom:1}];})).sample(time,bounds,box).camera.scale;patch={...patch,x:center.x-r.x-r.width/2,y:center.y-r.y-r.height/2,zoom:f.camera.scale/base};}
    else if(f.cursor)patch={...patch,x:f.cursor.x-r.x-r.width/2,y:f.cursor.y-r.y-r.height/2,curve:0};
    const next=addKeyframe(project(),clip.id,pos,patch);selected.keyId=findClip(next,clip.id).clip.keys.find(k=>k.atMs===pos+clip.offsetMs).id;commit(next,'Add keyframe');}),'add-key');
  button('Delete key',actions,()=>act(()=>commit(deleteKeyframe(project(),clip.id,key.id),'Delete keyframe')),'delete-key');
  node('p','Drag a keyframe handle on the canvas, or use exact offsets above. Camera zoom changes the shot; Canvas view only magnifies the editor.',p).className='note';
  if(!camera){const g=group('Visual gestures');for(const gesture of clip.gestures){const line=node('div',undefined,g);line.className='actions';node('span',gesture.kind+' · '+seconds(gesture.atMs-clip.offsetMs)+'s',line);button('Remove',line,()=>act(()=>commit(editProject(project(),d=>{findClip(d,clip.id).clip.gestures=findClip(d,clip.id).clip.gestures.filter(x=>x.id!==gesture.id);}),'Remove visual gesture')));}
    const a=node('div',undefined,g);a.className='actions';for(const kind of ['click','double-click','hold'])button('＋ '+kind,a,()=>act(()=>commit(addGesture(project(),clip.id,Math.round(locate(project(),time).timeMs-clip.startMs),kind),'Add visual '+kind)));node('p','These effects never click the real application.',g).className='note';
  }
}
function voiceInspector(p,track,clip){
  field(p,'voice-script','Narration script',clip.script,v=>commit(updateClip(project(),clip.id,{script:v}),'Edit narration script'),{type:'textarea',maxLength:8000});
  node('p','Text changes do not alter an existing recording. Import, record, or generate a replacement take to change the spoken words.',p).className='note';
  const current=project().assets.find(a=>a.id===clip.assetId);node('p',current?.name||'No voice take selected',p).className='voice-badge';
  const wave=document.createElementNS('http://www.w3.org/2000/svg','svg');wave.classList.add('waveform');wave.setAttribute('aria-label','Measured waveform of selected voice');p.append(wave);drawWaveform(wave,bank.waveform(clip.assetId));
  const actions=node('div',undefined,p);actions.className='actions';button('Import take',actions,()=>{if(ensure())$('audio-file').click();},'import-audio');button('Record take',actions,()=>void startRecording(clip.id),'record-audio');
  if(current)button('Load waveform',actions,()=>void runAsync(async signal=>{await bank.load(current,{signal});renderTimeline();renderInspector();message('Waveform measured from decoded audio.');}),'load-waveform');
  const mix=group('Mix and source');field(mix,'voice-gain','Volume',clip.gain,v=>commit(updateClip(project(),clip.id,{gain:v}),'Change voice volume'),{type:'number',min:0,max:2,step:.05});
  const r=node('div',undefined,mix);r.className='row';for(const [k,label] of [['fadeInMs','Fade in (s)'],['fadeOutMs','Fade out (s)']])field(r,'voice-'+k,label,seconds(clip[k]),v=>commit(updateClip(project(),clip.id,{[k]:Math.round(v*1000)}),'Change voice fade'),{type:'number',min:0,step:.01});
  field(mix,'voice-source','Source in (s)',seconds(clip.sourceInMs),v=>commit(updateClip(project(),clip.id,{sourceInMs:Math.round(v*1000)}),'Change source trim'),{type:'number',min:0,step:.01});
  if(project().assets.length>1){const takes=group('Available takes',{collapsed:true});for(const a of project().assets)button(a.name,takes,()=>act(()=>offerTake(clip.id,a,revision()))).className='clip-list-item';}
  const generate=group('Voice and delivery style');
  if(!voiceProvider){node('p','No voice-generation service is connected. Import or record a take above. Voice identity and delivery styles become available when the host connects a compatible service.',generate).className='note';}
  else {const voice=voiceProvider.capabilities.voices[0],draft={voiceId:voice.id,style:voice.styles[0]};
    const styleSelect=field(generate,'voice-style','Delivery style',draft.style,v=>{draft.style=v;},{options:voice.styles});
    field(generate,'voice-identity','Voice',draft.voiceId,v=>{draft.voiceId=v;const styles=voiceProvider.capabilities.voices.find(x=>x.id===v).styles;styleSelect.replaceChildren();for(const s of styles){const o=node('option',s,styleSelect);o.value=s;}draft.style=styles[0];styleSelect.value=styles[0];},{options:voiceProvider.capabilities.voices.map(v=>[v.id,v.label||v.id])});
    button('Generate a new take',generate,()=>{
      if(!ensure())return;
      const origin=revision(),provider=voiceProvider;
      const request={...draft,text:findClip(project(),clip.id).clip.script,clipId:clip.id,revision:origin};
      modal('Generate voiceover?',body=>node('p','Send only this authored narration to '+provider.capabilities.name+'? Your host service may charge for generation. Nothing else from the application is included.',body),[
        ['Cancel',closeDialog],['Generate',()=>{closeDialog();void runAsync(async signal=>{
          if(revision()!==origin||voiceProvider!==provider)throw Error('The project or voice service changed. Review generation again.');
          const take=await generateVoiceTake(provider,request,{signal});
          const asset=await bank.ingest(freshId(project(),'audio'),request.voiceId+' · '+request.style,take.mime.split(';')[0],take.bytes,{signal});
          if(revision()!==origin||voiceProvider!==provider){bank.remove(asset.id);throw Error('The project or voice service changed during generation. The late take was not applied.');}
          offerTake(clip.id,asset,origin);
        });}]
      ]);
    },'generate-voice');
  }
}
function closeDialog(){if(dialogCleanup){const fn=dialogCleanup;dialogCleanup=null;fn();}if($('dialog').open)$('dialog').close();}
function modal(title,render,actions){closeDialog();$('dialog-title').textContent=title;$('dialog-body').replaceChildren();$('dialog-actions').replaceChildren();render($('dialog-body'));for(const [label,action,primary] of actions){const b=button(label,$('dialog-actions'),action);if(primary)b.className='primary';}$('dialog').showModal();}
function offerTake(clipId,asset,origin){
  const release=()=>{if(!project().assets.some(a=>a.id===asset.id))bank.remove(asset.id);};
  if(revision()!==origin){message('The project changed. This take has not replaced anything.',true);return;}
  modal('Use this voice take?',body=>{node('p',asset.name+' · '+seconds(asset.durationMs)+' seconds',body);node('p','Keep scene timing uses the entire take only if it fits. Fit scene to voice proposes new visual timing without changing caption text or stretching the audio.',body);},[
    ['Cancel',closeDialog],['Keep scene timing',()=>replace(false)],['Fit scene to voice',()=>replace(true),true]
  ]);dialogCleanup=release;
  function replace(fit){try{const proposal=proposeVoiceReplacement(project(),clipId,asset,{fitScene:fit});if(revision()!==origin)throw Error('This proposal is stale. Select the take again.');
    if(fit){dialogCleanup=null;modal('Review timing changes',body=>{node('p','Scene length changes by '+seconds(proposal.deltaMs)+' seconds. Later scenes move with it. Voice audio is not stretched; authored caption text stays intact.',body);node('p',proposal.changes.length+' visual clips are retimed. Locked tracks cannot be changed.',body);},[['Cancel',closeDialog],['Use take and retime',()=>{try{commit(proposal.value,'Replace voice and retime scene',origin);closeDialog();}catch(e){message(e.message,true);}},true]]);dialogCleanup=release;}
    else {commit(proposal.value,'Replace voice take',origin);closeDialog();}
  }catch(e){node('p',e.message,$('dialog-body')).className='error';}}
}
async function runAsync(work){if(!ensure())return;busy=true;stop();const controller=new AbortController();operation=controller;try{await work(controller.signal);}catch(error){if(!disposed)message(error.name==='AbortError'?'Operation cancelled.':error.message,true);}finally{if(operation===controller)operation=null;busy=false;}}
function download(content,name,type){const blob=content instanceof Blob?content:new Blob([content],{type}),url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();const timer=setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},3000);urls.set(url,timer);}
async function importAudio(file){const item=selectedClip();if(!item||item.track.kind!=='voice'){message('Select a voiceover clip first.',true);return;}
  const origin=revision(),clipId=item.clip.id;
  await runAsync(async signal=>{if(file.size>8*1024*1024)throw Error('Choose an audio file smaller than 8 MiB.');const mime=(file.type||(/\.wav$/i.test(file.name)?'audio/wav':/\.mp3$/i.test(file.name)?'audio/mpeg':'')).split(';')[0];const asset=await bank.ingest(freshId(project(),'audio'),file.name,mime,await file.arrayBuffer(),{signal});if(revision()!==origin){bank.remove(asset.id);throw Error('The project changed while the take was loading. Nothing was replaced.');}offerTake(clipId,asset,origin);});
}
async function startRecording(clipId){
  if(!ensure())return;if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){message('Recording is unavailable here. Import an audio file instead.',true);return;}
  const origin=revision(),token={cancelled:false,stream:null,recorder:null,timer:null,chunks:[],size:0};recording=token;stop();
  function release(){token.cancelled=true;clearTimeout(token.timer);if(token.recorder?.state==='recording')token.recorder.stop();token.stream?.getTracks().forEach(t=>t.stop());if(recording===token)recording=null;}
  modal('Record a voice take',body=>node('p','Microphone permission is requested only for this recording. Nothing is uploaded. Cancel closes any stream even if permission arrives late.',body),[['Cancel',()=>{release();closeDialog();}]]);dialogCleanup=release;
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});token.stream=stream;if(token.cancelled||disposed){stream.getTracks().forEach(t=>t.stop());return;}
    const type=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));const recorder=new MediaRecorder(stream,type?{mimeType:type}:undefined);token.recorder=recorder;
    recorder.addEventListener('dataavailable',event=>{if(token.cancelled||disposed)return;if(event.data.size){token.size+=event.data.size;if(token.size>8*1024*1024){release();message('Recording reached the 8 MiB limit. No take was applied.',true);closeDialog();return;}token.chunks.push(event.data);}});
    recorder.addEventListener('error',()=>{if(token.cancelled||disposed)return;release();closeDialog();message('Recording failed. Import an audio file instead.',true);});
    recorder.addEventListener('stop',()=>{clearTimeout(token.timer);stream.getTracks().forEach(t=>t.stop());if(recording===token)recording=null;if(token.cancelled||disposed)return;dialogCleanup=null;closeDialog();const blob=new Blob(token.chunks,{type:recorder.mimeType});if(revision()!==origin){message('The project changed. Recording was not applied.',true);return;}void importAudio(new File([blob],'Recorded take',{type:recorder.mimeType.split(';')[0]}));});
    $('dialog-body').replaceChildren();node('p','● Recording locally… Maximum 3 minutes.', $('dialog-body')).className='recording';$('dialog-actions').replaceChildren();button('Discard',$('dialog-actions'),()=>{release();closeDialog();});button('Stop and review',$('dialog-actions'),()=>{if(recorder.state==='recording')recorder.stop();});recorder.start(500);token.timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},180000);
  }catch(error){if(token.cancelled||disposed||recording!==token){release();return;}release();closeDialog();message(error.name==='NotAllowedError'?'Microphone permission was not granted. You can import a take instead.':'Recording could not start. Import a take instead.',true);}
}
async function openProject(file){await runAsync(async signal=>{
  if(file.size>36*1024*1024)throw Error('Project files must be smaller than 36 MiB.');const origin=revision(),bundle=await readProjectBundle(await file.text());hostCheck(bundle.project);signal.throwIfAborted();
  modal('Open this project?',body=>{node('p',bundle.project.title+' · '+bundle.project.scenes.length+' scenes',body);node('p','This replaces the current draft and its undo history. Save your current project first. Local audio is validated before replacement.',body);},[['Cancel',closeDialog],['Open project',()=>{closeDialog();void runAsync(async signal=>{const staging=makeBank();try{for(const m of bundle.media){const actual=await staging.ingest(m.asset.id,m.asset.name,m.asset.mime,m.bytes,{signal});if(Math.abs(actual.durationMs-m.asset.durationMs)>20)throw Error('Audio duration differs from the saved take.');}signal.throwIfAborted();if(revision()!==origin)throw Error('Your draft changed while opening the project. It was not replaced.');stop();transport.destroy();const old=bank;bank=staging;store.replace(bundle.project);selected={sceneId:bundle.project.scenes[0].id,kind:'captions',clipId:null,keyId:null};sound=false;loop=false;time=0;lastExport=revision();transport=makeTransport();transport.load(project());dirtyFields.clear();refresh();$('sound').textContent='Sound off';$('sound').setAttribute('aria-pressed','false');await old.destroy();message('Project reopened. Audio and all style tracks retained.');}catch(e){await staging.destroy();throw e;}});},true]]);
});}
function exportDialog(){if(!ensure())return;modal('Keep or share your work',body=>{node('p','Save project keeps all tracks, styles and local audio in a .director file. Subtitle files keep text and timing, not the visual theme.',body);node('p','Rendered video and interactive publishing are not available in this Studio build.',body).className='note';},[['Close',closeDialog],['VTT',()=>exportCC('vtt')],['SRT',()=>exportCC('srt')],['Save project',()=>{closeDialog();void save();},true]]);}
function exportCC(format){try{const result=exportSubtitles(project(),{format});download(result.text,'walkthrough.'+format,'text/plain');message('Subtitle download started. Caption appearance is not included.');closeDialog();}catch(e){message(e.message,true);}}
async function save(){await runAsync(async()=>{const snapshot=store.snapshot(),text=await saveProjectBundle(snapshot.project,bank);download(text,'walkthrough.director','application/x-dom-director');lastExport=snapshot.revision;$('revision').textContent='Revision '+revision()+(revision()===lastExport?' · exported':' · changes since export');message('Project download started. Check your downloads; this tab does not autosave.');});}
function play(fromStart=false){if(!ensure())return;if(fromStart)seek(0);if(transport.inspect().state==='playing')stop();else void transport.play();}
function selectKind(kind){if(!ensure())return;stop();selected.kind=kind;selected.clipId=null;selected.keyId=null;normalizeSelection();const c=selectedClip();if(c)seek(sceneTimeline(project()).find(s=>s.id===c.clip.sceneId).startMs+c.clip.startMs);refresh();}
function changeSelection(work){act(()=>{work();refresh();});}
function setup(){
  view=createCanvas({stage:$('stage'),scene:$('scene'),overlay:$('stage-overlays'),caption:$('caption-overlay'),cursor:$('cursor-layer'),handles:$('edit-handles'),onInvalidate:()=>{if(!ready||disposed||paintRequest!==null)return;paintRequest=requestAnimationFrame(()=>{paintRequest=null;draw();});}});
  transport=makeTransport();transport.load(project());ready=true;refresh();$('studio').dataset.ready='true';
  for(const b of document.querySelectorAll('.inspector-tabs button'))on(b,'click',()=>selectKind(b.dataset.kind));
  on($('project-title'),'input',()=>{stop();dirtyFields.add($('project-title'));});on($('project-title'),'change',()=>{try{dirtyFields.delete($('project-title'));commit(editProject(project(),p=>{p.title=$('project-title').value;}),'Rename project');}catch(e){dirtyFields.add($('project-title'));message(e.message,true);}});
  on($('play'),'click',()=>play());on($('preview-tour'),'click',()=>play(true));on($('stop'),'click',()=>{stop();message('Preview stopped. Your application and draft were not reset.');});on($('restart'),'click',()=>act(()=>seek(0)));
  on($('seek'),'input',()=>{if(flush())seek(Number($('seek').value)*1000);});
  on($('sound'),'click',()=>act(()=>{sound=!sound;transport.setSound(sound);$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));message(sound?'Sound enabled. Play prepares the selected takes.':'Silent preview.');}));
  on($('captions'),'click',()=>{cc=!cc;draw();});on($('motion'),'click',()=>{reduced=!reduced;draw();});on($('canvas-zoom'),'change',()=>{viewZoom=Number($('canvas-zoom').value);draw();});
  on($('loop'),'click',()=>act(()=>{const c=selectedClip()?.clip;if(!c)throw Error('Select a clip to loop.');loop=!loop;const start=sceneTimeline(project()).find(s=>s.id===c.sceneId).startMs+c.startMs;transport.setLoop(loop?{startMs:start,endMs:start+c.durationMs}:null);$('loop').setAttribute('aria-pressed',String(loop));}));
  for(const command of ['undo','redo'])on($(command),'click',()=>act(()=>{stop();const at=time;store[command]();transport.load(project());transport.setSound(sound);loop=false;$('loop').setAttribute('aria-pressed','false');transport.seek(Math.min(at,duration(project())));refresh();message(command==='undo'?'Edit undone.':'Edit restored.');}));
  on($('add-scene'),'click',()=>act(()=>modal('Choose the new scene’s focus',body=>{for(const target of TARGETS)button(target.label,body,()=>{try{const r=addScene(project(),{afterId:selected.sceneId,target:target.id,title:target.label});selected.sceneId=r.sceneId;selected.clipId=null;commit(r.value,'Add scene');seek(sceneTimeline(project()).find(s=>s.id===r.sceneId).startMs);closeDialog();}catch(e){message(e.message,true);}}).className='clip-list-item';},[['Cancel',closeDialog]])));
  for(const [id,delta] of [['scene-up',-1],['scene-down',1]])on($(id),'click',()=>act(()=>commit(reorderScene(project(),selected.sceneId,delta),'Reorder scene')));
  on($('scene-delete'),'click',()=>act(()=>commit(deleteScene(project(),selected.sceneId),'Delete scene')));
  on($('split'),'click',()=>act(()=>{const c=selectedClip()?.clip;if(!c)throw Error('Select a clip first.');const at=locate(project(),time);if(at.scene.id!==c.sceneId)throw Error('Place the playhead inside the clip.');commit(splitClip(project(),c.id,Math.round(at.timeMs)),'Split clip');}));
  on($('duplicate'),'click',()=>act(()=>commit(duplicateClip(project(),selected.clipId),'Duplicate clip')));on($('delete-clip'),'click',()=>act(()=>commit(deleteClip(project(),selected.clipId),'Delete clip')));
  on($('timeline-zoom'),'input',()=>{renderTimeline();draw();});on($('fit-timeline'),'click',()=>{$('timeline-zoom').value=String(Math.max(20,Math.min(180,Math.floor(($('timeline-scroll').clientWidth-165)/(duration(project())/1000)))));renderTimeline();draw();});
  on($('ruler'),'pointerdown',e=>{if(ensure())seek((e.clientX-$('ruler').getBoundingClientRect().left)/Number($('timeline-zoom').value)*1000);});
  on($('clip-list'),'click',()=>act(()=>modal('All clips',body=>{for(const t of project().tracks){node('h3',t.name,body);for(const c of t.clips)button(sceneTimeline(project()).find(s=>s.id===c.sceneId).title+' · '+seconds(c.startMs)+'–'+seconds(c.startMs+c.durationMs)+'s',body,()=>{closeDialog();selectClip(c.id);}).className='clip-list-item';}},[['Close',closeDialog]])));
  on($('open-project'),'click',()=>{if(ensure())$('project-file').click();});on($('project-file'),'change',()=>{const f=$('project-file').files[0];$('project-file').value='';if(f)void openProject(f);});on($('save-project'),'click',()=>void save());on($('export-open'),'click',exportDialog);
  on($('audio-file'),'change',()=>{const f=$('audio-file').files[0];$('audio-file').value='';if(f)void importAudio(f);});
  on($('subtitle-file'),'change',()=>{const file=$('subtitle-file').files[0];$('subtitle-file').value='';if(!file)return;void runAsync(async()=>{if(file.size>1024*1024)throw Error('Subtitle files must be smaller than 1 MiB.');const origin=revision(),proposal=proposeCaptionImport(project(),await file.text(),{language:'und',name:file.name.slice(0,150)});modal('Import caption track?',body=>node('p',proposal.cueCount+' captions will be added as a new language track. '+proposal.warnings.join(' '),body),[['Cancel',closeDialog],['Import track',()=>{try{selected.clipId=null;commit(proposal.value,'Import captions',origin);closeDialog();}catch(e){message(e.message,true);}},true]]);});});
  on($('dialog'),'cancel',()=>{dialogCleanup?.();dialogCleanup=null;});
  on($('shortcuts'),'click',()=>modal('Editing shortcuts',body=>node('p','Space: play or pause. S: split selected clip. Delete: remove selected clip. Ctrl/Cmd+Z: undo. Ctrl/Cmd+Shift+Z: redo. Escape: stop playback or close a dialog. Shortcuts do not override text editing. Every operation also has a labeled button.',body),[['Close',closeDialog]]));
  on(document,'keydown',e=>{
    if(e.defaultPrevented||e.isComposing)return;
    if(e.key==='Escape'){stop();if(recording)closeDialog();return;}
    const target=e.target instanceof Element?e.target:null;
    if(target?.closest('input,textarea,select,[contenteditable]:not([contenteditable=false])')||$('dialog').open)return;
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'redo':'undo').click();return;}
    if(e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
    if(e.code==='Space'){if(target?.closest('button,a,summary,[role=button]'))return;e.preventDefault();play();}
    else if(e.key.toLowerCase()==='s')$('split').click();else if(e.key==='Delete')$('delete-clip').click();
  });
  installDrags();
  const preference=matchMedia('(prefers-reduced-motion: reduce)');on(preference,'change',event=>{reduced=event.matches;draw();});
  on(document,'visibilitychange',()=>{if(document.hidden){stop();if(recording)closeDialog();}});
  on(window,'pagehide',e=>{stop();operation?.abort();if(recording)closeDialog();if(e.persisted)return;disposed=true;cleanups.splice(0).forEach(off=>off());if(paintRequest!==null)cancelAnimationFrame(paintRequest);for(const [url,timer] of urls){clearTimeout(timer);URL.revokeObjectURL(url);}urls.clear();transport.destroy();view.destroy();void bank.destroy();});
}
function installDrags(){
  let cancelGesture=null,clickTimer=null;
  const finishClick=token=>{
    clearTimeout(clickTimer);
    clickTimer=setTimeout(()=>{if(drag===token)drag=null;clickTimer=null;},0);
  };
  on(document,'keydown',event=>{
    if(event.key==='Escape'&&cancelGesture){event.preventDefault();event.stopImmediatePropagation();cancelGesture();}
  },{capture:true});
  on(window,'blur',()=>cancelGesture?.());
  on(document,'visibilitychange',()=>{if(document.hidden)cancelGesture?.();});
  on(window,'pagehide',()=>{cancelGesture?.();clearTimeout(clickTimer);clickTimer=null;drag=null;});
  on($('lanes'),'pointerdown',event=>{
    const clicked=event.target.closest('button[data-clip]');
    if(!clicked||event.button!==0||event.isPrimary===false)return;
    const id=clicked.dataset.clip,edge=event.target.closest('[data-trim]')?.dataset.trim;
    cancelGesture?.();
    if(!ensure())return;
    // Flushing a focused field can rebuild the timeline. Capture the current node.
    const b=[...$('lanes').querySelectorAll('button[data-clip]')].find(n=>n.dataset.clip===id);
    if(!b)return;
    const {track,clip}=findClip(project(),id);
    if(track.locked){message('Unlock this track before dragging.',true);return;}
    stop();
    const origin=revision(),original=project(),scale=Number($('timeline-zoom').value),start=event.clientX;
    const pointer=event.pointerId,snap=$('snap').checked,ripple=$('ripple').checked,controller=new AbortController();
    const token={moved:false},offsets=new Map(sceneTimeline(original).map(s=>[s.id,s.startMs]));
    const nodes=[...$('lanes').querySelectorAll('button[data-clip]')].filter(n=>n.dataset.track===track.id);
    const prior=nodes.map(n=>({node:n,style:n.getAttribute('style'),label:n.querySelector('.clip-label')?.textContent}));
    let candidate=null,delta=0,frame=null,lastX=start,finished=false,invalid=false;
    drag=token;
    const restore=()=>{for(const item of prior){if(item.style===null)item.node.removeAttribute('style');else item.node.setAttribute('style',item.style);delete item.node.dataset.dragState;const label=item.node.querySelector('.clip-label');if(label)label.textContent=item.label;}};
    const cleanup=()=>{
      finished=true;controller.abort();if(frame!==null)cancelAnimationFrame(frame);frame=null;
      if(cancelGesture===cancel)cancelGesture=null;
      if(b.hasPointerCapture(pointer))b.releasePointerCapture(pointer);
      restore();finishClick(token);
    };
    const cancel=(reason='Drag cancelled. No timing was changed.')=>{if(finished)return;cleanup();message(reason);};
    const sample=x=>{
      if(finished)return;
      if(revision()!==origin||!b.isConnected){cancel('The timeline changed. Drag cancelled.');return;}
      const pixels=x-start;
      if(Math.abs(pixels)<4&&!token.moved)return;
      token.moved=true;
      delta=snap?Math.round(pixels/scale*10)*100:Math.round(pixels/scale*1000);
      try{
        candidate=edge?trimClip(original,id,clip.startMs+(edge==='start'?delta:0),clip.startMs+clip.durationMs+(edge==='end'?delta:0)):
          moveClip(original,id,clip.startMs+delta,{ripple});
        restore();
        const proposed=candidate.tracks.find(t=>t.id===track.id);
        for(const n of nodes){const c=proposed.clips.find(c=>c.id===n.dataset.clip);if(!c)continue;n.style.left=(offsets.get(c.sceneId)+c.startMs)/1000*scale+'px';n.style.width=Math.max(4,c.durationMs/1000*scale)+'px';}
        const c=findClip(candidate,id).clip,label=b.querySelector('.clip-label');
        if(label)label.textContent=seconds(c.startMs)+'–'+seconds(c.startMs+c.durationMs)+'s';
        b.dataset.dragState='valid';
        if(invalid)message('Timing is valid. Release to apply; Escape cancels.');
        invalid=false;
      }catch(error){
        candidate=null;restore();b.dataset.dragState='invalid';b.style.outline='2px solid #92361e';
        if(!invalid)message(error.message+' Release leaves the timing unchanged.',true);
        invalid=true;
      }
    };
    const move=e=>{if(e.pointerId!==pointer)return;lastX=e.clientX;if(frame===null)frame=requestAnimationFrame(()=>{frame=null;sample(lastX);});};
    const end=e=>{
      if(e.pointerId!==pointer||finished)return;
      if(frame!==null)cancelAnimationFrame(frame);frame=null;sample(e.clientX);if(finished)return;
      const next=candidate,moved=token.moved;cleanup();
      if(!moved)return;
      if(!next){message('Invalid timing. The clip was not changed.',true);return;}
      if(delta===0){message('No timing change.');return;}
      try{selected={sceneId:clip.sceneId,kind:track.kind,clipId:id,keyId:null};commit(next,edge?'Trim clip':'Move clip',origin);}catch(error){message(error.message,true);}
    };
    cancelGesture=cancel;
    b.addEventListener('pointermove',move,{signal:controller.signal});
    b.addEventListener('pointerup',end,{signal:controller.signal});
    b.addEventListener('pointercancel',e=>{if(e.pointerId===pointer)cancel();},{signal:controller.signal});
    b.addEventListener('lostpointercapture',e=>{if(e.pointerId===pointer)cancel();},{signal:controller.signal});
    b.setPointerCapture(pointer);
    message((edge?'Trim '+edge:'Move clip')+' · release to apply, Escape to cancel.');
  });
  on($('edit-handles'),'pointerdown',e=>{
    const target=e.target.closest('[data-key]');
    if(!target||e.button!==0||e.isPrimary===false)return;
    cancelGesture?.();if(!ensure())return;
    const found=selectedClip(),key=found?.clip.keys.find(k=>k.id===target.dataset.key);if(!key)return;
    e.preventDefault();stop();selected.keyId=key.id;
    const origin=revision(),original=project(),start={x:e.clientX,y:e.clientY},scale=view.pose.scale,pointer=e.pointerId,controller=new AbortController();
    let patch=null,finished=false,moved=false;
    const cleanup=()=>{finished=true;controller.abort();if(cancelGesture===cancel)cancelGesture=null;};
    const cancel=()=>{if(finished)return;cleanup();draw();message('Keyframe drag cancelled. No path was changed.');};
    cancelGesture=cancel;
    const move=event=>{
      if(event.pointerId!==pointer||finished)return;
      if(revision()!==origin){cancel();return;}
      const dx=event.clientX-start.x,dy=event.clientY-start.y;
      if(!moved&&Math.hypot(dx,dy)<4)return;
      moved=true;
      const next={x:key.x+Math.round(dx/scale),y:key.y+Math.round(dy/scale)};
      try{draw(updateKeyframe(original,found.clip.id,key.id,next));patch=next;}catch{patch=null;draw();}
    };
    window.addEventListener('pointermove',move,{signal:controller.signal});
    window.addEventListener('pointerup',event=>{
      if(event.pointerId!==pointer||finished)return;
      // Sample the release point too, rather than committing the last move event.
      move(event);if(finished)return;cleanup();
      if(patch&&moved&&(patch.x!==key.x||patch.y!==key.y))try{commit(updateKeyframe(original,found.clip.id,key.id,patch),'Move keyframe',origin);}catch(err){message(err.message,true);draw();}
      else{renderInspector();draw();}
    },{signal:controller.signal});
    window.addEventListener('pointercancel',event=>{if(event.pointerId===pointer)cancel();},{signal:controller.signal});
  });
}
try{setup();}catch(error){message('Studio could not start: '+error.message,true);$('studio').dataset.ready='error';}

/** Host-owned, opt-in provider adapter. Importing this page never connects a service. */
export function connectVoiceProvider(provider){
  if(provider!==null&&(!provider||typeof provider.generate!=='function'||typeof provider.capabilities?.name!=='string'||!Array.isArray(provider.capabilities.voices)||!provider.capabilities.voices.length||provider.capabilities.voices.length>100||provider.capabilities.voices.some(v=>typeof v.id!=='string'||!Array.isArray(v.styles)||!v.styles.length||v.styles.some(s=>typeof s!=='string'))))throw Error('Provide a voice adapter with explicit voices and delivery styles.');
  if(recording)throw Error('Finish recording before changing the voice service.');
  operation?.abort();voiceProvider=provider;if(ready&&!disposed&&selected.kind==='voice')renderInspector();
}
