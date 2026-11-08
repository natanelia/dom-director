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
/** Even spacing is a manual starting point, not speech alignment. */
export function distributeCaptionWords(project,clipId){
  return editProject(project,next=>{
    const {track,clip}=findClip(next,clipId);
    demand(track.kind==='captions','Select a caption clip.');
    const words=clip.text.trim().split(/\s+/u),wordCount=words.length;
    demand(wordCount<=400&&wordCount<=clip.durationMs,'This caption has too many words for individual timing.');
    clip.words=words.map((text,index)=>({
      text,startMs:Math.floor(index*clip.durationMs/wordCount),
      endMs:Math.floor((index+1)*clip.durationMs/wordCount),
    }));
  });
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
export function addScene(project,{afterId=project.scenes.at(-1).id,target,title='New scene',durationMs=4000}={}){
  let sceneId;
  const value=editProject(project,next=>{
    const index=next.scenes.findIndex(s=>s.id===afterId);demand(index>=0,'The preceding scene is missing.');
    target??=next.tracks.find(t=>t.kind==='camera')?.clips.find(c=>c.sceneId===afterId)?.keys[0]?.target;
    demand(typeof target==='string','Supply a host-approved target for the new scene.');
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

/**
 * Snapshot magnetic anchors once per gesture. All guide positions are project
 * milliseconds; the returned delta stays relative to the edited clip/key.
 * Snapping is geometry, not permission: validate the proposed edit before use.
 */
export function createTimelineSnapper(input,{
  clipId,keyId,operation='move',pixelsPerSecond,tolerancePx=8,
  gridMs=100,playheadMs,ripple=false,
}={}){
  const project=requireProject(input),{track,clip}=findClip(project,clipId);
  demand(['move','trim-start','trim-end','keyframe'].includes(operation),'Choose a supported timeline operation.');
  demand(Number.isFinite(pixelsPerSecond)&&pixelsPerSecond>0&&pixelsPerSecond<=10000,'Timeline scale must be finite and positive.');
  demand(Number.isFinite(tolerancePx)&&tolerancePx>=0&&tolerancePx<=32,'Snap distance must be 0–32 CSS pixels.');
  demand(Number.isInteger(gridMs)&&gridMs>0&&gridMs<=10000,'Snap grid must use whole milliseconds.');
  demand(typeof ripple==='boolean','Ripple must be a boolean.');
  const scenes=sceneTimeline(project),scene=scenes.find(s=>s.id===clip.sceneId);
  demand(playheadMs===undefined||(Number.isFinite(playheadMs)&&playheadMs>=0&&playheadMs<=scenes.at(-1).endMs),'Playhead is outside the project.');
  const start=scene.startMs+clip.startMs,end=start+clip.durationMs;
  let edges;
  if(operation==='keyframe'){
    demand(['camera','cursor'].includes(track.kind),'Select a camera or cursor keyframe.');
    const key=clip.keys.find(k=>k.id===keyId);
    demand(key&&key.atMs>=clip.offsetMs&&key.atMs<=clip.offsetMs+clip.durationMs,'Select a keyframe inside the visible clip.');
    edges=[{timeMs:start+key.atMs-clip.offsetMs,edge:'keyframe'}];
  }else edges=operation==='move'?[{timeMs:start,edge:'start'},{timeMs:end,edge:'end'}]:
    [{timeMs:operation==='trim-start'?start:end,edge:operation==='trim-start'?'start':'end'}];
  const points=[];
  const add=(timeMs,kind,label,priority,identity)=>{
    if(timeMs>=scene.startMs&&timeMs<=scene.endMs)points.push({timeMs,kind,label,priority,identity});
  };
  add(scene.startMs,'scene','Scene start',1,'scene.start');
  add(scene.endMs,'scene','Scene end',1,'scene.end');
  if(playheadMs!==undefined)add(Math.round(playheadMs),'playhead','Playhead',0,'playhead');
  if(operation==='keyframe'){
    add(start,'clip','Selected clip start',2,'own.start');
    add(end,'clip','Selected clip end',2,'own.end');
  }
  for(const otherTrack of project.tracks){
    // Invisible tracks are not magnets; locked visible tracks remain references.
    if(!otherTrack.enabled)continue;
    for(const other of otherTrack.clips){
      if(other.sceneId!==clip.sceneId||other.id===clip.id)continue;
      // Ripple followers move with this gesture and cannot be stationary anchors.
      if(operation==='move'&&ripple&&otherTrack.id===track.id&&other.startMs>=clip.startMs+clip.durationMs)continue;
      const absolute=scene.startMs+other.startMs;
      add(absolute,'clip',otherTrack.name+' start',2,other.id+'.start');
      add(absolute+other.durationMs,'clip',otherTrack.name+' end',2,other.id+'.end');
      for(const key of other.keys||[])if(key.atMs>=other.offsetMs&&key.atMs<=other.offsetMs+other.durationMs)
        add(absolute+key.atMs-other.offsetMs,'keyframe',otherTrack.name+' keyframe',3,key.id);
    }
  }
  const compare=(a,b)=>a.timeMs-b.timeMs||a.priority-b.priority||(a.identity<b.identity?-1:a.identity>b.identity?1:0);
  points.sort(compare);
  const toleranceMs=tolerancePx/pixelsPerSecond*1000;
  function lowerBound(timeMs){let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid].timeMs<timeMs)lo=mid+1;else hi=mid;}return lo;}
  return Object.freeze({
    snap(deltaMs,{bypass=false}={}){
      demand(Number.isFinite(deltaMs),'Timeline movement must be finite.');
      demand(typeof bypass==='boolean','Snap bypass must be a boolean.');
      if(bypass)return {deltaMs:Math.round(deltaMs)||0,guide:null};
      let best=null;
      for(const [edgeOrder,edge] of edges.entries()){
        const desired=edge.timeMs+deltaMs;
        for(let i=lowerBound(desired-toleranceMs);i<points.length&&points[i].timeMs<=desired+toleranceMs;i++){
          const point=points[i],distance=Math.abs(point.timeMs-desired);
          if(!best||distance<best.distance-1e-7||(Math.abs(distance-best.distance)<1e-7&&
            (point.priority<best.point.priority||(point.priority===best.point.priority&&
              (compare(point,best.point)<0||(compare(point,best.point)===0&&edgeOrder<best.edgeOrder))))))
            best={point,distance,edge,edgeOrder};
        }
      }
      if(!best)return {deltaMs:Math.round(deltaMs/gridMs)*gridMs||0,guide:null};
      return {deltaMs:best.point.timeMs-best.edge.timeMs,guide:Object.freeze({
        timeMs:best.point.timeMs,kind:best.point.kind,label:best.point.label,edge:best.edge.edge,
      })};
    },
  });
}

/** Move one visible key in clip-local time, preserving path/style and off-window source keys. */
export function moveTimelineKeyframe(project,clipId,keyId,clipTimeMs){
  const {track,clip}=findClip(project,clipId);
  demand(['camera','cursor'].includes(track.kind),'Select a camera or cursor keyframe.');
  const key=clip.keys.find(k=>k.id===keyId);
  demand(key&&key.atMs>=clip.offsetMs&&key.atMs<=clip.offsetMs+clip.durationMs,'Select a keyframe inside the visible clip.');
  demand(Number.isInteger(clipTimeMs)&&clipTimeMs>=0&&clipTimeMs<=clip.durationMs,'Keep the keyframe inside its clip.');
  return updateKeyframe(project,clipId,keyId,{atMs:clip.offsetMs+clipTimeMs});
}
