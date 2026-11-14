import {editProject,findClip,freshId,sceneTimeline,requireProject,proposeRetime,PRESETS} from './project.js';
import {parseSubtitles} from './subtitles.js';
import {canonical,freezeData} from '@dom-director/core/data';
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
  demand(!Object.hasOwn(patch,'id')&&!Object.hasOwn(patch,'atMs')&&!Object.hasOwn(patch,'timing'),'Use the playhead to set the new keyframe time.');
  return editProject(project,next=>{
    const {track,clip}=findClip(next,clipId);demand(['camera','cursor'].includes(track.kind),'Select a motion clip.');
    demand(clipTimeMs>=0&&clipTimeMs<=clip.durationMs,'Place the playhead inside the selected clip.');
    const atMs=clip.offsetMs+clipTimeMs;demand(!clip.keys.some(k=>k.atMs===atMs),'A keyframe already exists at this time.');
    const previous=clip.keys.filter(k=>k.atMs<=atMs).at(-1)||clip.keys[0];
    const {timing,...absolute}=previous;
    clip.keys.push({...absolute,...copy(patch),id:freshId(next,'key'),atMs});clip.keys.sort((a,b)=>a.atMs-b.atMs);
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
/** Copy a whole scene, retaining media references and rebinding only copied identities. */
export function duplicateScene(input,sourceId){
  const project=requireProject(input),source=project.scenes.find(scene=>scene.id===sourceId);
  demand(source,'Choose an existing scene to duplicate.');
  const used=new Set(),mapped=new Map();let serial=0,sceneId;
  JSON.stringify(project,(key,value)=>{if(key==='id')used.add(value);return value;});
  function allocate(original,kind){
    let value;do{value=kind+'-copy-'+(++serial);}while(used.has(value));
    used.add(value);mapped.set(original,value);return value;
  }
  // The existing title budget uses UTF-16 units; never cut an authored surrogate pair.
  let title='';for(const char of source.title){if(title.length+char.length>153)break;title+=char;}
  const value=editProject(project,next=>{
    sceneId=allocate(source.id,'scene');
    const index=next.scenes.findIndex(scene=>scene.id===source.id),copies=[];
    next.scenes.splice(index+1,0,{...source,id:sceneId,title:title.trimEnd()+' (copy)'});
    for(const track of next.tracks){
      for(const clip of track.clips.filter(clip=>clip.sceneId===source.id)){
        const duplicate=copy(clip);duplicate.id=allocate(clip.id,'clip');duplicate.sceneId=sceneId;
        for(const key of duplicate.keys||[])key.id=allocate(key.id,'key');
        for(const gesture of duplicate.gestures||[])gesture.id=allocate(gesture.id,'gesture');
        for(const word of duplicate.words||[])if(word.id!==undefined)word.id=allocate(word.id,'word');
        track.clips.push(duplicate);copies.push(duplicate);
      }
    }
    // Allocate every caption/word first: track order and inactive languages are irrelevant.
    for(const clip of copies)for(const key of clip.keys||[])if(key.timing){
      const captionId=mapped.get(key.timing.captionId),wordId=mapped.get(key.timing.wordId);
      demand(captionId&&wordId,'A copied timing link is missing its caption or word.');
      key.timing={...key.timing,captionId,wordId};
    }
    // editProject validates all limits and locked content/absolute positions atomically.
  });
  return {value,sceneId};
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

/** Describe the actual validated replacement, never a separately calculated retime. */
export function describeVoiceReplacementImpact(input,proposed,clipId,{limit=20,offsets={}}={}){
  const kinds=['captions','camera','cursor','voice'];
  demand(Number.isInteger(limit)&&limit>=1&&limit<=100,'Impact pages must contain 1–100 items.');
  demand(offsets&&typeof offsets==='object'&&!Array.isArray(offsets)&&Object.keys(offsets).every(kind=>kinds.includes(kind))&&
    Object.values(offsets).every(offset=>Number.isSafeInteger(offset)&&offset>=0),'Impact offsets must use known tracks and non-negative whole numbers.');
  const before=requireProject(input),after=requireProject(proposed),original=findClip(before,clipId),replacement=findClip(after,clipId);
  demand(original.track.kind==='voice'&&replacement.track.kind==='voice','Select the same voice clip in both projects.');
  const same=(a,b)=>canonical(a)===canonical(b);
  const omit=(value,fields)=>Object.fromEntries(Object.entries(value).filter(([key])=>!fields.includes(key)));
  const compatible=(condition)=>demand(condition,'Review the same project with only voice replacement timing and source changes.');
  compatible(same(omit(before,['scenes','tracks','assets']),omit(after,['scenes','tracks','assets'])));
  compatible(before.scenes.length===after.scenes.length&&before.tracks.length===after.tracks.length);
  const sceneId=original.clip.sceneId,oldScenes=sceneTimeline(before),newScenes=sceneTimeline(after);
  for(const [index,scene] of oldScenes.entries()){
    const next=newScenes[index];
    compatible(scene.id===next.id&&scene.title===next.title&&(scene.id===sceneId||scene.durationMs===next.durationMs));
  }
  const oldSceneMap=new Map(oldScenes.map(scene=>[scene.id,scene])),newSceneMap=new Map(newScenes.map(scene=>[scene.id,scene]));
  const oldAssets=new Map(before.assets.map(asset=>[asset.id,asset])),newAssets=new Map(after.assets.map(asset=>[asset.id,asset]));
  compatible(before.assets.every(asset=>same(asset,newAssets.get(asset.id)))&&
    after.assets.every(asset=>oldAssets.has(asset.id)||asset.id===replacement.clip.assetId));
  const pages=new Map(kinds.map(kind=>[kind,{kind,total:0,items:[],offset:offsets[kind]??0,limit,hasMore:false}]));
  const oldClips=new Map(),newClips=new Map();
  for(const track of before.tracks)for(const clip of track.clips)oldClips.set(clip.id,{track,clip});
  for(const track of after.tracks)for(const clip of track.clips)newClips.set(clip.id,{track,clip});
  const wordIndexes=new WeakMap();
  function linkInfo(project,clips,timing){
    if(!timing)return undefined;
    const source=clips.get(timing.captionId);
    if(!wordIndexes.has(source.clip))wordIndexes.set(source.clip,new Map(source.clip.words.map(word=>[word.id,word])));
    const word=wordIndexes.get(source.clip).get(timing.wordId);
    return {...timing,wordText:word.text,captionText:source.clip.text,
      ...(source.track.language?{language:source.track.language}:{}),hidden:!source.track.enabled||source.track.id!==project.captionTrack};
  }
  function bounds(project,sceneMap,assets,track,clip){
    const startMs=sceneMap.get(clip.sceneId).startMs+clip.startMs,result={startMs,endMs:startMs+clip.durationMs};
    if(track.kind==='camera'||track.kind==='cursor')Object.assign(result,{sourceStartMs:clip.offsetMs,sourceEndMs:clip.offsetMs+clip.durationMs});
    if(track.kind==='voice')Object.assign(result,{sourceStartMs:clip.sourceInMs,sourceEndMs:clip.sourceInMs+clip.durationMs,
      assetId:clip.assetId,assetName:assets.get(clip.assetId)?.name??null,fadeInMs:clip.fadeInMs,fadeOutMs:clip.fadeOutMs});
    return result;
  }
  function point(project,clips,sceneMap,clip,key,inclusiveEnd){
    const startMs=sceneMap.get(clip.sceneId).startMs+clip.startMs+key.atMs-clip.offsetMs;
    const link=linkInfo(project,clips,key.timing);
    return {startMs,endMs:startMs,sourceStartMs:key.atMs,sourceEndMs:key.atMs,
      visible:key.atMs>=clip.offsetMs&&(inclusiveEnd?key.atMs<=clip.offsetMs+clip.durationMs:key.atMs<clip.offsetMs+clip.durationMs),...(link?{link}:{})};
  }
  function emit(track,clip,type,label,oldValue,newValue,extra={}){
    if(same(oldValue,newValue)&&!(type==='clip'&&clip.id===clipId))return;
    const page=pages.get(track.kind),index=page.total++;
    // Count every change, retaining at most one requested page per track kind.
    if(index<page.offset||index>=page.offset+limit)return;
    page.items.push({id:JSON.stringify([type,clip.id,extra.entityId??extra.wordIndex??clip.id]),type,
      sceneId:clip.sceneId,sceneTitle:oldSceneMap.get(clip.sceneId).title,trackId:track.id,trackName:track.name,
      clipId:clip.id,label,enabled:track.enabled,
      ...(track.kind==='captions'?{active:track.id===before.captionTrack,...(track.language?{language:track.language}:{})}:{}),
      ...extra,...(newValue.link?{link:newValue.link}:{}),before:oldValue,after:newValue});
  }
  // Validate the comparison scope before emitting: captions, identity, styles, media
  // catalog entries and link relationships must not be silently replaced by a review.
  const trackPairs=[];
  for(const [index,track] of before.tracks.entries()){
    const next=after.tracks[index];
    compatible(same(omit(track,['clips']),omit(next,['clips']))&&track.clips.length===next.clips.length);
    const nextClips=new Map(next.clips.map(clip=>[clip.id,clip]));
    for(const clip of track.clips){
      const other=nextClips.get(clip.id);compatible(other&&other.sceneId===clip.sceneId);
      if(clip.sceneId!==sceneId){compatible(same(clip,other));continue;}
      if(track.kind==='voice'){
        compatible(same(omit(clip,clip.id===clipId?['startMs','durationMs','assetId','sourceInMs','fadeInMs','fadeOutMs']:['startMs']),
          omit(other,clip.id===clipId?['startMs','durationMs','assetId','sourceInMs','fadeInMs','fadeOutMs']:['startMs'])));
      }else{
        compatible(same(omit(clip,['startMs','durationMs','offsetMs','keys','gestures','words']),omit(other,['startMs','durationMs','offsetMs','keys','gestures','words'])));
        for(const [field,times] of [['words',['startMs','endMs']],['keys',['atMs']],['gestures',['atMs']]]){
          const oldItems=clip[field]??[],newItems=other[field]??[];compatible(oldItems.length===newItems.length);
          const byId=new Map(newItems.map((item,i)=>[item.id??i,item]));
          for(const [i,item] of oldItems.entries()){
            const changed=byId.get(item.id??i);compatible(changed&&same(omit(item,times),omit(changed,times)));
          }
        }
      }
    }
    trackPairs.push({track,nextClips});
  }
  for(const scene of oldScenes)for(const {track,nextClips} of trackPairs){
    const clips=track.clips.filter(clip=>clip.sceneId===scene.id).sort((a,b)=>a.startMs-b.startMs||(a.id<b.id?-1:a.id>b.id?1:0));
    for(const clip of clips){
      const other=nextClips.get(clip.id),oldBounds=bounds(before,oldSceneMap,oldAssets,track,clip),newBounds=bounds(after,newSceneMap,newAssets,track,other);
      emit(track,clip,'clip',track.kind==='captions'?clip.text:track.kind==='voice'?(newBounds.assetName??'Voice clip'):track.name,oldBounds,newBounds,{entityId:clip.id});
      for(const [wordIndex,word] of (clip.words??[]).entries()){
        const changed=word.id?other.words.find(item=>item.id===word.id):other.words[wordIndex];
        emit(track,clip,'word',word.text,{startMs:oldBounds.startMs+word.startMs,endMs:oldBounds.startMs+word.endMs},
          {startMs:newBounds.startMs+changed.startMs,endMs:newBounds.startMs+changed.endMs},{wordIndex,...(word.id?{entityId:word.id}:{})});
      }
      for(const field of ['keys','gestures']){
        const newItems=new Map((other[field]??[]).map(item=>[item.id,item]));
        for(const item of clip[field]??[])emit(track,clip,field==='keys'?'keyframe':'gesture',item.target??item.kind,
          point(before,oldClips,oldSceneMap,clip,item,field==='keys'),point(after,newClips,newSceneMap,other,newItems.get(item.id),field==='keys'),{entityId:item.id});
      }
    }
  }
  const groups=[...pages.values()];for(const page of groups)page.hasMore=page.offset+page.items.length<page.total;
  const scene=oldSceneMap.get(sceneId),next=newSceneMap.get(sceneId),summary=value=>({startMs:value.startMs,endMs:value.endMs,durationMs:value.durationMs});
  return freezeData({clipId,scene:{id:sceneId,title:scene.title,before:summary(scene),after:summary(next),deltaMs:next.durationMs-scene.durationMs},
    shiftedSceneCount:oldScenes.filter((scene,index)=>scene.id!==sceneId&&scene.startMs!==newScenes[index].startMs).length,
    total:groups.reduce((sum,page)=>sum+page.total,0),groups});
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
      // Only the active, visible caption language contributes word magnets.
      if(otherTrack.kind==='captions'&&otherTrack.id===project.captionTrack)
        for(const [index,word] of (other.words||[]).entries()){
          add(absolute+word.startMs,'word','Word '+(index+1)+' start',4,other.id+'.word.'+index+'.start');
          add(absolute+word.endMs,'word','Word '+(index+1)+' end',4,other.id+'.word.'+index+'.end');
        }
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

/** Word anchors are authored timing, not speech recognition or persistent links. */
export function captionWordAnchors(input,sceneId){
  const project=requireProject(input),scene=sceneTimeline(project).find(s=>s.id===sceneId);
  demand(scene,'Choose an existing scene.');
  const track=project.tracks.find(t=>t.id===project.captionTrack);
  if(!track.enabled)return Object.freeze([]);
  const anchors=[];
  for(const clip of track.clips.filter(c=>c.sceneId===sceneId)){
    for(const [wordIndex,word] of (clip.words||[]).entries())for(const boundary of ['start','end']){
      const captionTimeMs=word[boundary==='start'?'startMs':'endMs'],sceneTimeMs=clip.startMs+captionTimeMs;
      anchors.push(Object.freeze({captionId:clip.id,wordIndex,text:word.text,boundary,captionTimeMs,sceneTimeMs,projectTimeMs:scene.startMs+sceneTimeMs}));
    }
  }
  return Object.freeze(anchors.sort((a,b)=>a.sceneTimeMs-b.sceneTimeMs||(a.captionId<b.captionId?-1:a.captionId>b.captionId?1:0)||a.wordIndex-b.wordIndex||(a.boundary==='start'?-1:1)));
}

/** Stamp one boundary in absolute project time. Never shift neighbouring words or audio. */
export function stampCaptionWord(input,captionId,wordIndex,boundary,projectTimeMs){
  const project=requireProject(input),{track,clip}=findClip(project,captionId);
  demand(track.kind==='captions'&&Number.isInteger(wordIndex)&&wordIndex>=0&&clip.words?.[wordIndex],'Choose a caption with an existing timed word.');
  demand(boundary==='start'||boundary==='end','Choose the start or end of a word.');
  demand(Number.isInteger(projectTimeMs),'Word timing must use whole milliseconds.');
  const scene=sceneTimeline(project).find(s=>s.id===clip.sceneId),local=projectTimeMs-scene.startMs-clip.startMs;
  demand(local>=0&&local<=clip.durationMs,'Move the playhead inside this caption.');
  const word=clip.words[wordIndex],start=boundary==='start'?local:word.startMs,end=boundary==='end'?local:word.endMs;
  demand(start<end,'A word must end after it starts.');
  demand(start>=(clip.words[wordIndex-1]?.endMs??0)&&end<=(clip.words[wordIndex+1]?.startMs??clip.durationMs),'Keep this boundary between its neighbouring words. Other words were not moved.');
  return editProject(project,next=>{findClip(next,captionId).clip.words[wordIndex][boundary==='start'?'startMs':'endMs']=local;});
}

/** One explicit alignment transaction. Future caption edits do not silently move this key. */
export function alignKeyframeToCaptionWord(input,clipId,keyId,{captionId,wordIndex,boundary='start'}={}){
  const project=requireProject(input),{track,clip}=findClip(project,clipId);
  demand(['camera','cursor'].includes(track.kind),'Choose a camera or cursor keyframe.');
  demand(Number.isInteger(wordIndex)&&wordIndex>=0&&(boundary==='start'||boundary==='end'),'Choose an existing word boundary.');
  const anchor=captionWordAnchors(project,clip.sceneId).find(a=>a.captionId===captionId&&a.wordIndex===wordIndex&&a.boundary===boundary);
  demand(anchor,'Choose a timed word in this scene’s visible caption language.');
  demand(!clip.keys.find(k=>k.id===keyId)?.timing,'Detach this persistent word link before using one-time alignment.');
  return moveTimelineKeyframe(project,clipId,keyId,anchor.sceneTimeMs-clip.startMs);
}
