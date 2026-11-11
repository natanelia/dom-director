import {DirectorError} from '@dom-director/core';
import {cloneData, freezeData, canonical} from '@dom-director/core/data';
import {LINKED_STUDIO_VERSION,checkTimingLinks,synchronizeTimingLinks} from './timing.js';
export {LINKED_STUDIO_VERSION} from './timing.js';

export const STUDIO_VERSION = '0.1.0-draft.1';
export const KINDS = Object.freeze(['camera', 'cursor', 'voice', 'captions']);
export const CAPTION_THEME = Object.freeze({font:'sans',size:30,weight:600,color:'#ffffff',background:'#17251d',opacity:.9,outline:0,x:50,y:87,width:80,align:'center',padding:12,radius:10});
export const CURSOR_THEME = Object.freeze({shape:'arrow',size:28,color:'#f5d080',stroke:'#17251d',halo:18,opacity:1,trail:false});
export const PRESETS = Object.freeze({
  clean: CAPTION_THEME,
  contrast: {...CAPTION_THEME,size:34,weight:700,background:'#000000',opacity:1},
  minimal: {...CAPTION_THEME,size:26,background:'#ffffff',color:'#17251d',opacity:.95,y:90,radius:4},
});
const idPattern=/^[A-Za-z][A-Za-z0-9._-]{0,79}$/u;
const fail=(message,path='')=>{throw new DirectorError('STUDIO_INVALID',message,'compile',path);};
const num=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
const integer=(v,a,b)=>Number.isInteger(v)&&num(v,a,b);
const text=(v,max)=>typeof v==='string'&&v.length<=max;
const id=v=>typeof v==='string'&&idPattern.test(v);
function need(ok,message,path=''){if(!ok)fail(message,path);}
function keys(object,required,optional=[],path=''){
  need(object&&typeof object==='object'&&!Array.isArray(object),'Expected an object.',path);
  need(required.every(k=>Object.hasOwn(object,k))&&Object.keys(object).every(k=>required.includes(k)||optional.includes(k)),'Missing or unsupported field.',path);
}
function style(value,kind,path){
  const defaults=kind==='captions'?CAPTION_THEME:CURSOR_THEME;
  keys(value,[],Object.keys(defaults),path);
  for(const [k,v] of Object.entries(value)){
    let valid=false;
    if(['color','background','stroke'].includes(k))valid=typeof v==='string'&&/^#[a-f\d]{6}$/iu.test(v);
    else if(k==='font')valid=['sans','serif','mono'].includes(v);
    else if(k==='shape')valid=['arrow','hand','dot'].includes(v);
    else if(k==='align')valid=['left','center','right'].includes(v);
    else if(k==='trail')valid=typeof v==='boolean';
    else if(k==='size')valid=num(v,12,96);
    else if(k==='weight')valid=[400,500,600,700,800].includes(v);
    else if(['x','y','width'].includes(k))valid=num(v,k==='width'?20:0,100);
    else if(k==='opacity')valid=num(v,0,1);
    else if(['outline','padding','radius','halo'].includes(k))valid=num(v,0,40);
    need(valid,'Invalid '+kind+' appearance value.',path+'/'+k);
  }
}
export function validateProject(input){
  try{
    const p=cloneData(input);
    keys(p,['studioVersion','id','title','canvas','scenes','tracks','assets','captionTheme','cursorTheme','captionTrack']);
    need([STUDIO_VERSION,LINKED_STUDIO_VERSION].includes(p.studioVersion),'Unsupported Studio project version.');
    const linked=p.studioVersion===LINKED_STUDIO_VERSION;
    need(id(p.id)&&text(p.title,200)&&p.title.trim(),'Give the project a valid identity and title.');
    keys(p.canvas,['width','height']);need(integer(p.canvas.width,320,3840)&&integer(p.canvas.height,240,2160),'Invalid presentation dimensions.');
    need(Array.isArray(p.scenes)&&p.scenes.length>0&&p.scenes.length<=60,'Use 1–60 scenes.');
    need(Array.isArray(p.tracks)&&p.tracks.length>0&&p.tracks.length<=16,'Use 1–16 tracks.');
    need(Array.isArray(p.assets)&&p.assets.length<=64,'Too many audio assets.');
    style(p.captionTheme,'captions','/captionTheme');style(p.cursorTheme,'cursor','/cursorTheme');
    const ids=new Set(),scenes=new Map(),assets=new Map();let count=0;
    function unique(value,path){need(id(value)&&!ids.has(value),'Identifiers must be valid and unique.',path);ids.add(value);}
    p.scenes.forEach((s,i)=>{keys(s,['id','title','durationMs']);unique(s.id,'/scenes/'+i+'/id');need(text(s.title,160)&&s.title.trim(),'Scene title is required.');need(integer(s.durationMs,250,180000),'Scene duration must be 0.25–180 seconds.');scenes.set(s.id,s);});
    need(p.scenes.reduce((n,s)=>n+s.durationMs,0)<=1800000,'Project limit is 30 minutes.');
    p.assets.forEach((a,i)=>{keys(a,['id','name','mime','durationMs','source'],['sample','sha256']);unique(a.id,'/assets/'+i+'/id');need(text(a.name,200)&&/^audio\/(mpeg|mp3|wav|x-wav|webm|ogg|mp4)$/u.test(a.mime),'Unsupported audio metadata.');need(num(a.durationMs,1,180000),'Audio duration must be at most 180 seconds.');need(['sample','local'].includes(a.source),'Remote media URLs are not permitted.');if(a.source==='sample')need(id(a.sample),'Sample requires a host-approved reference.');if(a.sha256!==undefined)need(/^[a-f0-9]{64}$/u.test(a.sha256),'Invalid audio digest.');assets.set(a.id,a);});
    p.tracks.forEach((track,ti)=>{
      const path='/tracks/'+ti;keys(track,['id','kind','name','enabled','locked','clips'],['language','style'],path);unique(track.id,path+'/id');
      need(KINDS.includes(track.kind)&&text(track.name,120),'Unsupported track.');need(typeof track.enabled==='boolean'&&typeof track.locked==='boolean','Track switches must be boolean.');
      need(Array.isArray(track.clips)&&track.clips.length<=500,'Too many clips.');
      if(track.language!==undefined)need(track.kind==='captions'&&/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/u.test(track.language),'Invalid caption language.');
      if(track.style!==undefined){need(['captions','cursor'].includes(track.kind),'This track has no visual theme.');style(track.style,track.kind,path+'/style');}
      track.clips.forEach((c,ci)=>{
        count++;const cp=path+'/clips/'+ci;
        const fields={camera:['offsetMs','keys'],cursor:['offsetMs','keys','gestures'],voice:['assetId','sourceInMs','script','gain','fadeInMs','fadeOutMs'],captions:['text']}[track.kind];
        keys(c,['id','sceneId','startMs','durationMs',...fields],track.kind==='captions'?['style','words']:track.kind==='cursor'?['style']:[],cp);unique(c.id,cp+'/id');
        need(scenes.has(c.sceneId),'Clip scene is missing.',cp);need(integer(c.startMs,0,180000)&&integer(c.durationMs,1,180000)&&c.startMs+c.durationMs<=scenes.get(c.sceneId).durationMs,'Clip must fit within its scene.',cp);
        if(track.kind==='captions'){
          need(text(c.text,4000)&&c.text.trim(),'Caption cannot be empty.',cp+'/text');if(c.style!==undefined)style(c.style,'captions',cp+'/style');
          if(c.words!==undefined){need(Array.isArray(c.words)&&c.words.length<=400,'Too many word timings.');let end=0;for(const w of c.words){keys(w,['text','startMs','endMs'],linked?['id']:[]);if(w.id!==undefined)unique(w.id,cp+'/words/id');need(text(w.text,120)&&w.text.trim()&&integer(w.startMs,end,c.durationMs)&&integer(w.endMs,w.startMs+1,c.durationMs),'Word timings must be ordered and fit the caption.');end=w.endMs;}need(c.words.map(w=>w.text).join(' ').replace(/\s+/gu,' ').trim()===c.text.replace(/\s+/gu,' ').trim(),'Word timings do not match the caption text.');}
        }else if(track.kind==='voice'){
          need((c.assetId===null||assets.has(c.assetId))&&text(c.script,8000),'Voice source or script is invalid.',cp);
          need(integer(c.sourceInMs,0,180000)&&num(c.gain,0,2)&&integer(c.fadeInMs,0,c.durationMs)&&integer(c.fadeOutMs,0,c.durationMs)&&c.fadeInMs+c.fadeOutMs<=c.durationMs,'Invalid source trim, gain or fade.',cp);
          if(c.assetId)need(c.sourceInMs+c.durationMs<=assets.get(c.assetId).durationMs+1,'Voice clip exceeds its source. Trim it or choose a longer take.',cp);
        }else{
          need(integer(c.offsetMs,0,180000)&&c.offsetMs+c.durationMs<=360000,'Invalid motion source window.',cp);
          need(Array.isArray(c.keys)&&c.keys.length>0&&c.keys.length<=100,'Motion needs 1–100 keyframes.',cp);let last=-1;
          c.keys.forEach((k,ki)=>{keys(k,['id','atMs','target','x','y','easing',...(track.kind==='camera'?['zoom']:['curve'])],linked?['timing']:[]);unique(k.id,cp+'/keys/'+ki+'/id');need(integer(k.atMs,0,360000)&&k.atMs>last,'Keyframe times must increase.');last=k.atMs;need(id(k.target)&&num(k.x,-3840,3840)&&num(k.y,-2160,2160)&&['gentle','direct','overview','instant'].includes(k.easing),'Invalid keyframe target or position.');if(track.kind==='camera')need(num(k.zoom,.1,8),'Camera zoom must be 0.1–8.');else need(num(k.curve,-1000,1000),'Cursor curve is out of range.');});
          if(track.kind==='cursor'){if(c.style!==undefined)style(c.style,'cursor',cp+'/style');need(Array.isArray(c.gestures)&&c.gestures.length<=100,'Too many gestures.');for(const g of c.gestures){keys(g,['id','atMs','kind']);unique(g.id,cp+'/gestures/id');need(integer(g.atMs,0,360000)&&['click','double-click','hold'].includes(g.kind),'Invalid visual gesture.');}}
        }
      });
      for(const s of p.scenes){const clips=track.clips.filter(c=>c.sceneId===s.id).sort((a,b)=>a.startMs-b.startMs);for(let i=1;i<clips.length;i++)need(clips[i].startMs>=clips[i-1].startMs+clips[i-1].durationMs,'Clips on the same track overlap. Move or trim one.',path);}
    });
    need(count<=1500,'Project has too many clips.');need(p.tracks.some(t=>t.id===p.captionTrack&&t.kind==='captions'),'Choose a caption language track.');
    // Camera and cursor each have a single transform/pointer owner, even across lanes.
    for(const kind of ['camera','cursor'])need(p.tracks.filter(t=>t.kind===kind).length===1,'Use exactly one '+kind+' track.');
    checkTimingLinks(p);
    return {ok:true,value:freezeData(p)};
  }catch(error){return {ok:false,diagnostics:[error.diagnostic||{code:'STUDIO_INVALID',message:'Invalid project data.',phase:'compile',path:''}]};}
}
export function requireProject(input){const r=validateProject(input);if(!r.ok)fail(r.diagnostics[0].message,r.diagnostics[0].path);return r.value;}
export function sceneTimeline(p){let startMs=0;return p.scenes.map(s=>{const result={...s,startMs,endMs:startMs+s.durationMs};startMs=result.endMs;return result;});}
export const duration=p=>p.scenes.reduce((sum,s)=>sum+s.durationMs,0);
export function locate(p,timeMs){const all=sceneTimeline(p),t=Math.max(0,Math.min(duration(p),timeMs));const scene=all.find(s=>t<s.endMs)||all.at(-1);return {scene,timeMs:t-scene.startMs,projectTimeMs:t};}
export function findClip(p,id){for(const track of p.tracks){const clip=track.clips.find(c=>c.id===id);if(clip)return {track,clip};}fail('The selected clip no longer exists.');}
export function freshId(p,prefix='item'){const used=new Set();JSON.stringify(p,(k,v)=>{if(k==='id')used.add(v);return v;});let n=1;while(used.has(prefix+'-'+n))n++;return prefix+'-'+n;}
function locks(before,after){
  const oldTimes=new Map(sceneTimeline(before).map(s=>[s.id,s.startMs]));const nextTimes=new Map(sceneTimeline(after).map(s=>[s.id,s.startMs]));
  for(const t of before.tracks.filter(t=>t.locked)){
    const n=after.tracks.find(n=>n.id===t.id);need(n&&canonical(t.clips)===canonical(n.clips)&&canonical(t.style||{})===canonical(n.style||{}),'Track “'+t.name+'” is locked.');
    for(const c of t.clips)need(oldTimes.get(c.sceneId)===nextTimes.get(c.sceneId),'Moving the scene would move locked track “'+t.name+'”.');
    if(t.kind==='captions')need(canonical(before.captionTheme)===canonical(after.captionTheme),'Caption track is locked.');
    if(t.kind==='cursor')need(canonical(before.cursorTheme)===canonical(after.cursorTheme),'Cursor track is locked.');
  }
}
export function editProject(p,mutate){const next=cloneData(p);mutate(next);synchronizeTimingLinks(p,next);const result=requireProject(next);locks(p,result);return result;}
export function updateClip(p,id,patch){return editProject(p,n=>Object.assign(findClip(n,id).clip,cloneData(patch)));}
export function moveClip(p,id,startMs,{ripple=false}={}){
  return editProject(p,n=>{const {track,clip}=findClip(n,id),delta=startMs-clip.startMs,oldEnd=clip.startMs+clip.durationMs;
    if(ripple)for(const c of track.clips)if(c.sceneId===clip.sceneId&&c.id!==id&&c.startMs>=oldEnd)c.startMs+=delta;
    clip.startMs=startMs;});
}
export function trimClip(p,id,startMs,endMs){return editProject(p,n=>{
  const {track,clip:c}=findClip(n,id),delta=startMs-c.startMs;need(endMs>startMs,'Clip end must follow its start.');
  if(track.kind==='camera'||track.kind==='cursor')c.offsetMs+=delta;
  if(track.kind==='voice'){c.sourceInMs+=delta;c.fadeInMs=Math.min(c.fadeInMs,endMs-startMs);c.fadeOutMs=Math.min(c.fadeOutMs,endMs-startMs-c.fadeInMs);}
  if(c.words)fail('Remove or adjust word timing before trimming this caption.');c.startMs=startMs;c.durationMs=endMs-startMs;
});}
export function splitClip(p,id,localMs){return editProject(p,n=>{
  const {track,clip:c}=findClip(n,id),cut=localMs-c.startMs;need(cut>0&&cut<c.durationMs,'Place the playhead inside the clip.');
  const right=cloneData(c);right.id=freshId(n,'clip');right.startMs=localMs;right.durationMs=c.durationMs-cut;c.durationMs=cut;
  if(track.kind==='camera'||track.kind==='cursor'){right.offsetMs+=cut;right.keys.forEach((k,i)=>k.id=right.id+'.key'+i);right.gestures?.forEach((g,i)=>g.id=right.id+'.gesture'+i);}
  if(track.kind==='voice'){right.sourceInMs+=cut;c.fadeInMs=Math.min(c.fadeInMs,cut);c.fadeOutMs=0;right.fadeInMs=0;right.fadeOutMs=Math.min(right.fadeOutMs,right.durationMs);}
  if(c.words){const all=c.words;need(!all.some(w=>w.startMs<cut&&w.endMs>cut),'Split at a word boundary.');c.words=all.filter(w=>w.endMs<=cut);right.words=all.filter(w=>w.startMs>=cut).map(w=>({...w,startMs:w.startMs-cut,endMs:w.endMs-cut}));need(c.words.length&&right.words.length,'Split between words.');c.text=c.words.map(w=>w.text).join(' ');right.text=right.words.map(w=>w.text).join(' ');}
  track.clips.push(right);
  if(track.kind==='captions'&&right.words)for(const t of n.tracks)for(const motion of t.clips)for(const key of motion.keys||[])
    if(key.timing?.captionId===c.id&&right.words.some(w=>w.id===key.timing.wordId))key.timing.captionId=right.id;
});}
export function deleteClip(p,id){return editProject(p,n=>{const {track}=findClip(n,id);track.clips=track.clips.filter(c=>c.id!==id);});}
export function duplicateClip(p,id){return editProject(p,n=>{const {track,clip:c}=findClip(n,id),copy=cloneData(c);copy.id=freshId(n,'clip');copy.startMs+=copy.durationMs;copy.keys?.forEach((k,i)=>k.id=copy.id+'.key'+i);copy.gestures?.forEach((g,i)=>g.id=copy.id+'.gesture'+i);track.clips.push(copy);
  for(const w of copy.words||[])if(w.id)w.id=freshId(n,'word');
  for(const key of copy.keys||[])if(key.timing)key.timing.offsetMs+=c.durationMs;
});}
export function reorderScene(p,id,delta){return editProject(p,n=>{const i=n.scenes.findIndex(s=>s.id===id),j=i+delta;need(i>=0&&j>=0&&j<n.scenes.length,'Scene cannot move further.');[n.scenes[i],n.scenes[j]]=[n.scenes[j],n.scenes[i]];});}
export function proposeRetime(p,sceneId,newDurationMs){
  const s=p.scenes.find(s=>s.id===sceneId);need(s,'Scene is missing.');const ratio=newDurationMs/s.durationMs,changes=[];
  const value=editProject(p,n=>{n.scenes.find(s=>s.id===sceneId).durationMs=newDurationMs;
    for(const track of n.tracks)for(const c of track.clips)if(c.sceneId===sceneId){
      const old={startMs:c.startMs,durationMs:c.durationMs};c.startMs=Math.round(c.startMs*ratio);
      if(track.kind!=='voice'){
        c.durationMs=Math.max(1,Math.round((old.startMs+old.durationMs)*ratio)-c.startMs);
        if(c.keys){c.offsetMs=Math.round(c.offsetMs*ratio);c.keys.forEach(k=>{if(!k.timing)k.atMs=Math.round(k.atMs*ratio);});c.gestures?.forEach(g=>g.atMs=Math.round(g.atMs*ratio));}
        c.words?.forEach(w=>{w.startMs=Math.round(w.startMs*ratio);w.endMs=Math.round(w.endMs*ratio);});
      }
      changes.push({id:c.id,track:track.name,before:old,after:{startMs:c.startMs,durationMs:c.durationMs}});
    }
  });return {value,changes,deltaMs:newDurationMs-s.durationMs};
}
export function createProjectStore(input,{limit=60,byteLimit=4*1024*1024}={}){
  need(Number.isInteger(limit)&&limit>=2&&limit<=500&&Number.isInteger(byteLimit)&&byteLimit>=1024&&byteLimit<=32*1024*1024,'Invalid history limits.');
  let project=requireProject(input),revision=0,entries=[{value:project,label:'Opened project'}],position=0,expired=0;
  const size=e=>new TextEncoder().encode(JSON.stringify(e.value)).length;
  function snapshot(){return {project,revision,canUndo:position>0,canRedo:position<entries.length-1,expired,label:entries[position].label};}
  return {snapshot,
    commit(next,label='Edit',expectedRevision=revision){need(expectedRevision===revision,'Project changed. Review the edit again.');next=requireProject(next);locks(project,next);if(canonical(next)===canonical(project))return snapshot();entries=entries.slice(0,position+1);entries.push({value:next,label});while(entries.length>1&&(entries.length>limit||entries.reduce((s,e)=>s+size(e),0)>byteLimit)){entries.shift();expired++;}position=entries.length-1;project=next;revision++;return snapshot();},
    replace(next){project=requireProject(next);entries=[{value:project,label:'Opened project'}];position=0;revision++;return snapshot();},
    undo(){if(position>0){project=entries[--position].value;revision++;}return snapshot();},
    redo(){if(position<entries.length-1){project=entries[++position].value;revision++;}return snapshot();},
  };
}
