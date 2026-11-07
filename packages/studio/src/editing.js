import {editProject,findClip,freshId,sceneTimeline,requireProject,proposeRetime,PRESETS} from './project.js';
import {parseSubtitles} from './subtitles.js';
const copy=value=>JSON.parse(JSON.stringify(value));
const demand=(ok,message)=>{if(!ok)throw new Error(message);};

/** Scoped visual edits do not change text, paths, or timings. Existing locks still apply. */
export function setAppearance(project,clipId,patch,{scope='clip',reset=false}={}){
  demand(['clip','track','project'].includes(scope),'Choose a caption, track or project scope.');
  const {track}=findClip(project,clipId);
  demand(['cursor','captions'].includes(track.kind),'Select a caption or cursor clip.');
  return editProject(project,next=>{
    const current=findClip(next,clipId),theme=track.kind==='captions'?'captionTheme':'cursorTheme';
    if(scope==='project')next[theme]=reset?{}:{...next[theme],...copy(patch)};
    else {const owner=scope==='track'?current.track:current.clip;
      if(reset)delete owner.style;else owner.style={...owner.style,...copy(patch)};
    }
  });
}
export function applyCaptionPreset(project,clipId,name,scope='clip'){
  demand(Object.hasOwn(PRESETS,name),'Choose a supported caption preset.');
  demand(findClip(project,clipId).track.kind==='captions','Select a caption.');
  return setAppearance(project,clipId,PRESETS[name],{scope});
}
export function updateKeyframe(project,clipId,keyId,patch){
  demand(!Object.hasOwn(patch,'id'),'Keyframe identity cannot be replaced.');
  return editProject(project,next=>{
    const {track,clip}=findClip(next,clipId);demand(['camera','cursor'].includes(track.kind),'Select a motion clip.');
    const key=clip.keys.find(k=>k.id===keyId);demand(key,'The selected keyframe is missing.');
    Object.assign(key,copy(patch));clip.keys.sort((a,b)=>a.atMs-b.atMs);
  });
}
export function addKeyframe(project,clipId,clipTimeMs,patch={}){
  demand(Number.isInteger(clipTimeMs),'Keyframe time must be in whole milliseconds.');
  demand(!Object.hasOwn(patch,'id')&&!Object.hasOwn(patch,'atMs'),'Use the playhead to set the new keyframe time.');
  return editProject(project,next=>{
    const {track,clip}=findClip(next,clipId);demand(['camera','cursor'].includes(track.kind),'Select a motion clip.');
    demand(clipTimeMs>=0&&clipTimeMs<=clip.durationMs,'Place the playhead inside the selected clip.');
    const atMs=clip.offsetMs+clipTimeMs;demand(!clip.keys.some(k=>k.atMs===atMs),'A keyframe already exists at this time.');
    const previous=clip.keys.filter(k=>k.atMs<=atMs).at(-1)||clip.keys[0];
    clip.keys.push({...previous,...copy(patch),id:freshId(next,'key'),atMs});clip.keys.sort((a,b)=>a.atMs-b.atMs);
  });
}
export function deleteKeyframe(project,clipId,keyId){
  return editProject(project,next=>{const {clip}=findClip(next,clipId);demand(clip.keys?.some(k=>k.id===keyId),'The selected keyframe is missing.');demand(clip.keys.length>1,'Keep at least one keyframe.');clip.keys=clip.keys.filter(k=>k.id!==keyId);});
}
export function addGesture(project,clipId,clipTimeMs,kind='click'){
  return editProject(project,next=>{const {track,clip}=findClip(next,clipId);demand(track.kind==='cursor','Select a cursor clip.');demand(Number.isInteger(clipTimeMs)&&clipTimeMs>=0&&clipTimeMs<clip.durationMs,'Place the playhead inside the selected cursor clip.');clip.gestures.push({id:freshId(next,'gesture'),atMs:clip.offsetMs+clipTimeMs,kind});});
}
export function addScene(project,{afterId=project.scenes.at(-1).id,target='orbit.overview',title='New scene',durationMs=4000}={}){
  let sceneId;
  const value=editProject(project,next=>{
    const index=next.scenes.findIndex(s=>s.id===afterId);demand(index>=0,'The preceding scene is missing.');
    sceneId=freshId(next,'scene');next.scenes.splice(index+1,0,{id:sceneId,title,durationMs});
    for(const track of next.tracks){
      demand(!track.locked,'Unlock tracks before adding a scene.');
      const id=freshId(next,track.kind),base={id,sceneId,startMs:0,durationMs};
      if(track.kind==='camera')track.clips.push({...base,offsetMs:0,keys:[{id:id+'.key',atMs:0,target,x:0,y:0,zoom:1,easing:'gentle'}]});
      else if(track.kind==='cursor')track.clips.push({...base,offsetMs:0,keys:[{id:id+'.key',atMs:0,target,x:0,y:0,curve:0,easing:'gentle'}],gestures:[]});
      else if(track.kind==='captions'&&track.id===next.captionTrack)track.clips.push({...base,text:'Describe this moment.'});
    }
  });return {value,sceneId};
}
export function deleteScene(project,sceneId){
  demand(project.scenes.length>1,'Keep at least one scene.');
  return editProject(project,next=>{demand(next.scenes.some(s=>s.id===sceneId),'Scene is missing.');next.scenes=next.scenes.filter(s=>s.id!==sceneId);for(const t of next.tracks)t.clips=t.clips.filter(c=>c.sceneId!==sceneId);});
}
export function addCaption(project,sceneId,startMs=0){
  let clipId;
  const value=editProject(project,next=>{
    const scene=next.scenes.find(s=>s.id===sceneId),track=next.tracks.find(t=>t.id===next.captionTrack);demand(scene&&track,'Choose a scene and caption track.');
    const clips=track.clips.filter(c=>c.sceneId===sceneId).sort((a,b)=>a.startMs-b.startMs);
    let at=Math.max(0,Math.round(startMs));
    for(const c of clips)if(at>=c.startMs&&at<c.startMs+c.durationMs)at=c.startMs+c.durationMs;
    const end=Math.min(scene.durationMs,clips.find(c=>c.startMs>at)?.startMs??scene.durationMs,at+2500);
    demand(end-at>=100,'There is no space here. Shorten or move a caption first.');
    clipId=freshId(next,'cc');track.clips.push({id:clipId,sceneId,startMs:at,durationMs:end-at,text:'A new caption.'});
  });return {value,clipId};
}
/** An explicit proposal: input is checked before the caller replaces any caption track. */
export function proposeCaptionImport(project,text,{language='en',name='Imported captions'}={}){
  const cues=parseSubtitles(text),scenes=sceneTimeline(project),end=scenes.at(-1).endMs;
  demand(cues.every(c=>c.endMs<=end),'Subtitle timing extends past this project. Extend the scenes before importing.');
  let trackId,splitCount=0;
  const value=editProject(project,next=>{
    trackId=freshId(next,'cc');const track={id:trackId,kind:'captions',name,language,enabled:true,locked:false,clips:[]};next.tracks.push(track);
    for(const cue of cues){let pieces=0;for(const s of scenes){const start=Math.max(s.startMs,cue.startMs),end=Math.min(s.endMs,cue.endMs);if(end<=start)continue;
      track.clips.push({id:freshId(next,'caption'),sceneId:s.id,startMs:start-s.startMs,durationMs:end-start,text:cue.text});pieces++;
    }if(pieces>1)splitCount++;}next.captionTrack=trackId;
  });return {value,trackId,cueCount:cues.length,splitCount,warnings:splitCount?['Captions crossing scene boundaries are split with their full text retained in each piece.']:[]};
}
/** New takes never stretch audio or silently retime an existing scene. */
export function proposeVoiceReplacement(project,clipId,asset,{fitScene=false}={}){
  const {track,clip}=findClip(project,clipId);demand(track.kind==='voice','Select a voiceover clip.');
  const scene=project.scenes.find(s=>s.id===clip.sceneId),length=Math.floor(asset.durationMs);
  demand(length>=1,'The new take is empty.');
  let base=project,changes=[];
  if(fitScene){
    // Multiple voice clips make proportional changes ambiguous: ask the author to edit them explicitly.
    const voices=project.tracks.filter(t=>t.kind==='voice').flatMap(t=>t.clips).filter(c=>c.sceneId===clip.sceneId&&c.id!==clipId);
    demand(voices.length===0&&clip.startMs===0,'Fit scene requires one voice clip starting at the scene boundary.');
    // Detach this take before shortening, then restore it within one returned transaction.
    const cleared=editProject(project,next=>{const c=findClip(next,clipId).clip;c.assetId=null;c.durationMs=1;c.fadeInMs=0;c.fadeOutMs=0;});
    const proposal=proposeRetime(cleared,scene.id,length);base=proposal.value;changes=proposal.changes;
  }else demand(clip.startMs+length<=scene.durationMs,'This take is longer than the available scene. Choose Fit scene to voice or keep it as an alternative.');
  const value=editProject(base,next=>{
    const existing=next.assets.find(a=>a.id===asset.id);demand(!existing||JSON.stringify(existing)===JSON.stringify(asset),'An audio identity cannot be rebound.');
    if(!existing)next.assets.push(copy(asset));const c=findClip(next,clipId).clip;c.assetId=asset.id;c.sourceInMs=0;c.durationMs=length;c.fadeInMs=Math.min(clip.fadeInMs,length);c.fadeOutMs=Math.min(clip.fadeOutMs,length-c.fadeInMs);
  });return {value:requireProject(value),changes,deltaMs:fitScene?length-scene.durationMs:0};
}
