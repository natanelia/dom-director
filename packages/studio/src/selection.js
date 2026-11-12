import {editProject,requireProject,sceneTimeline,CAPTION_THEME,CURSOR_THEME} from './project.js';
import {cloneData} from '@dom-director/core/data';
const copy=value=>cloneData(value);
const demand=(ok,message)=>{if(!ok)throw new Error(message);};

/** Validate a bounded selection once and retain project order, not click order. */
function selectedRows(input,clipIds){
  const project=requireProject(input);
  demand(Array.isArray(clipIds),'Select 1–1500 existing clips.');
  clipIds=cloneData(clipIds);
  demand(Array.isArray(clipIds)&&clipIds.length>0&&clipIds.length<=1500&&clipIds.every(id=>typeof id==='string'),
    'Select 1–1500 existing clips.');
  const ids=new Set(clipIds);demand(ids.size===clipIds.length,'Clip selection contains duplicate identities.');
  const offsets=new Map(sceneTimeline(project).map(scene=>[scene.id,scene.startMs]));
  const rows=[];
  for(const track of project.tracks)for(const clip of track.clips)if(ids.has(clip.id))
    rows.push({track,clip,startMs:offsets.get(clip.sceneId)+clip.startMs});
  demand(rows.length===ids.size,'A selected clip no longer exists. Refresh the selection.');
  return {project,ids,rows};
}
/** The bounding project-time range includes gaps; it does not imply contiguous clips. */
export function selectionBounds(input,clipIds){
  const {rows}=selectedRows(input,clipIds);
  const startMs=Math.min(...rows.map(row=>row.startMs));
  const endMs=Math.max(...rows.map(row=>row.startMs+row.clip.durationMs));
  return Object.freeze({startMs,endMs,durationMs:endMs-startMs,clipIds:Object.freeze(rows.map(row=>row.clip.id))});
}
/** Explicitly include all caption/motion timing dependencies without changing the project. */
export function includeLinkedClips(input,clipIds){
  const {project,ids}=selectedRows(input,clipIds),graph=new Map();
  function connect(a,b){if(!graph.has(a))graph.set(a,new Set());graph.get(a).add(b);}
  for(const track of project.tracks)for(const clip of track.clips)for(const key of clip.keys||[])if(key.timing){
    connect(clip.id,key.timing.captionId);connect(key.timing.captionId,clip.id);
  }
  const queue=[...ids];
  for(let i=0;i<queue.length;i++)for(const id of graph.get(queue[i])||[])if(!ids.has(id)){ids.add(id);queue.push(id);}
  return Object.freeze(project.tracks.flatMap(track=>track.clips).filter(clip=>ids.has(clip.id)).map(clip=>clip.id));
}
function checkSelectionLinks(project,ids,operation){
  for(const track of project.tracks)for(const clip of track.clips)for(const key of clip.keys||[])if(key.timing){
    const motion=ids.has(clip.id),caption=ids.has(key.timing.captionId);
    const incomplete=operation==='move'?motion!==caption:operation==='duplicate'?motion&&!caption:caption&&!motion;
    demand(!incomplete,'Include linked caption and motion clips in the selection, or detach their timing links before this edit.');
  }
}
function selectionDelta(deltaMs){demand(Number.isInteger(deltaMs)&&Math.abs(deltaMs)<=1800000,'Use a whole-millisecond selection offset within 30 minutes.');}
/** One atomic non-ripple move. A clip never changes its owning scene or source window. */
export function moveClips(input,clipIds,deltaMs){
  const {project,ids}=selectedRows(input,clipIds);selectionDelta(deltaMs);
  checkSelectionLinks(project,ids,'move');
  return editProject(project,next=>{
    for(const track of next.tracks)for(const clip of track.clips)if(ids.has(clip.id))clip.startMs+=deltaMs;
  });
}
/** Duplicate a group with new identities; copied word links point to copied words. */
export function duplicateClips(input,clipIds,deltaMs){
  const {project,ids,rows}=selectedRows(input,clipIds);selectionDelta(deltaMs);
  checkSelectionLinks(project,ids,'duplicate');
  const used=new Set(),mapping=new Map();
  for(const track of project.tracks){used.add(track.id);for(const clip of track.clips){used.add(clip.id);
    for(const item of [...(clip.keys||[]),...(clip.gestures||[]),...(clip.words||[])])if(item.id)used.add(item.id);
  }}
  used.add(project.id);for(const item of [...project.scenes,...project.assets])used.add(item.id);
  let serial=0;
  function allocate(id,prefix){let next;do{next=prefix+'-'+(++serial);}while(used.has(next));used.add(next);mapping.set(id,next);return next;}
  const copies=rows.map(({track,clip})=>{
    const next=copy(clip);next.id=allocate(clip.id,'clip');next.startMs+=deltaMs;
    for(const [field,prefix] of [['keys','key'],['gestures','gesture'],['words','word']])for(const item of next[field]||[])
      if(item.id)item.id=allocate(item.id,prefix);
    return {trackId:track.id,clip:next};
  });
  for(const {clip} of copies)for(const key of clip.keys||[])if(key.timing){
    key.timing.captionId=mapping.get(key.timing.captionId);key.timing.wordId=mapping.get(key.timing.wordId);
  }
  const value=editProject(project,next=>{
    for(const {trackId,clip} of copies)next.tracks.find(track=>track.id===trackId).clips.push(clip);
  });
  return Object.freeze({value,clipIds:Object.freeze(copies.map(row=>row.clip.id))});
}
/** Reject orphaned word links rather than silently detaching unselected motion. */
export function deleteClips(input,clipIds){
  const {project,ids}=selectedRows(input,clipIds);checkSelectionLinks(project,ids,'delete');
  return editProject(project,next=>{
    for(const track of next.tracks)track.clips=track.clips.filter(clip=>!ids.has(clip.id));
  });
}

/** Copy resolved caption/cursor appearance only; timing, text and motion remain untouched. */
export function matchClipAppearance(input,sourceId,clipIds){
  const {project,rows}=selectedRows(input,clipIds);
  const source=selectedRows(project,[sourceId]).rows[0],kind=source.track.kind;
  demand(kind==='captions'||kind==='cursor','Choose a caption or cursor as the appearance source.');
  demand(rows.every(row=>row.track.kind===kind),'Select only captions or only cursor clips to match appearance.');
  const targets=rows.filter(row=>row.clip.id!==sourceId);
  demand(targets.every(row=>!row.track.locked),'A destination track is locked. Unlock it or remove its clips from the selection.');
  const theme=kind==='captions'?CAPTION_THEME:CURSOR_THEME;
  const appearance={...theme,...project[kind==='captions'?'captionTheme':'cursorTheme'],...source.track.style,...source.clip.style};
  const destinations=new Set(targets.map(row=>row.clip.id));
  return editProject(project,next=>{
    for(const track of next.tracks)for(const clip of track.clips)if(destinations.has(clip.id))clip.style=copy(appearance);
  });
}

/** Set only explicitly supplied voice mix fields. Invalid or locked groups change nothing. */
export function setVoiceMix(input,clipIds,changes){
  const {project,ids,rows}=selectedRows(input,clipIds);
  const patch=cloneData(changes),fields=['gain','fadeInMs','fadeOutMs'];
  demand(patch&&typeof patch==='object'&&!Array.isArray(patch)&&Object.keys(patch).length>0&&
    Object.keys(patch).every(key=>fields.includes(key)),
    'Choose volume, fade in or fade out. Other voice properties cannot be changed by a mix edit.');
  demand(rows.every(row=>row.track.kind==='voice'),'Select only voice clips to adjust their mix.');
  demand(rows.every(row=>!row.track.locked),'A selected voice track is locked. Unlock it or remove its clips from the selection.');
  if(Object.hasOwn(patch,'gain'))demand(typeof patch.gain==='number'&&Number.isFinite(patch.gain)&&patch.gain>=0&&patch.gain<=2,
    'Voice volume must be between 0% and 200%.');
  for(const field of ['fadeInMs','fadeOutMs'])if(Object.hasOwn(patch,field))
    demand(Number.isInteger(patch[field])&&patch[field]>=0&&patch[field]<=180000,
      'Voice fades must use whole milliseconds between 0 and 180 seconds.');
  if(!rows.every(({clip})=>(patch.fadeInMs??clip.fadeInMs)+(patch.fadeOutMs??clip.fadeOutMs)<=clip.durationMs))
    throw Object.assign(new Error('Fade in and fade out together must fit every selected clip. Shorten a fade or select longer clips.'),
      {code:'VOICE_MIX_FADE_RANGE'});
  return editProject(project,next=>{
    for(const track of next.tracks)for(const clip of track.clips)if(ids.has(clip.id))Object.assign(clip,patch);
  });
}

/** Snapshot magnets once; selected clips and their keys are not stationary references. */
export function createSelectionSnapper(input,clipIds,{pixelsPerSecond,tolerancePx=8,gridMs=100,playheadMs}={}){
  const {project,ids,rows}=selectedRows(input,clipIds),scenes=sceneTimeline(project);
  demand(Number.isFinite(pixelsPerSecond)&&pixelsPerSecond>0&&pixelsPerSecond<=10000,'Timeline scale must be finite and positive.');
  demand(Number.isFinite(tolerancePx)&&tolerancePx>=0&&tolerancePx<=32,'Snap distance must be 0–32 CSS pixels.');
  demand(Number.isInteger(gridMs)&&gridMs>0&&gridMs<=10000,'Snap grid must use whole milliseconds.');
  demand(playheadMs===undefined||(Number.isFinite(playheadMs)&&playheadMs>=0&&playheadMs<=scenes.at(-1).endMs),'Playhead is outside the project.');
  const offsets=new Map(scenes.map(scene=>[scene.id,scene.startMs])),points=[],edges=[];
  for(const {clip,startMs} of rows)edges.push({timeMs:startMs,edge:'start'},{timeMs:startMs+clip.durationMs,edge:'end'});
  const add=(timeMs,kind,label,priority,identity)=>points.push({timeMs,kind,label,priority,identity});
  if(playheadMs!==undefined)add(Math.round(playheadMs),'playhead','Playhead',0,'playhead');
  for(const scene of scenes){add(scene.startMs,'scene','Scene start',1,scene.id+'.start');add(scene.endMs,'scene','Scene end',1,scene.id+'.end');}
  for(const track of project.tracks){if(!track.enabled)continue;
    for(const clip of track.clips){if(ids.has(clip.id))continue;const start=offsets.get(clip.sceneId)+clip.startMs;
      add(start,'clip',track.name+' start',2,clip.id+'.start');add(start+clip.durationMs,'clip',track.name+' end',2,clip.id+'.end');
      for(const key of clip.keys||[])if(key.atMs>=clip.offsetMs&&key.atMs<=clip.offsetMs+clip.durationMs)
        add(start+key.atMs-clip.offsetMs,'keyframe',track.name+' keyframe',3,key.id);
      if(track.kind==='captions'&&track.id===project.captionTrack)for(const [i,word] of (clip.words||[]).entries()){
        add(start+word.startMs,'word','Word '+(i+1)+' start',4,clip.id+'.word.'+i+'.start');
        add(start+word.endMs,'word','Word '+(i+1)+' end',4,clip.id+'.word.'+i+'.end');
      }
    }
  }
  const compare=(a,b)=>a.timeMs-b.timeMs||a.priority-b.priority||(a.identity<b.identity?-1:a.identity>b.identity?1:0);
  points.sort(compare);const toleranceMs=tolerancePx/pixelsPerSecond*1000;
  function lowerBound(timeMs){let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid].timeMs<timeMs)lo=mid+1;else hi=mid;}return lo;}
  return Object.freeze({snap(deltaMs,{bypass=false}={}){
    demand(Number.isFinite(deltaMs),'Timeline movement must be finite.');demand(typeof bypass==='boolean','Snap bypass must be a boolean.');
    if(bypass)return {deltaMs:Math.round(deltaMs)||0,guide:null};
    let best=null;
    for(const [order,edge] of edges.entries()){
      const desired=edge.timeMs+deltaMs;
      for(let i=lowerBound(desired-toleranceMs);i<points.length&&points[i].timeMs<=desired+toleranceMs;i++){
        const point=points[i],distance=Math.abs(point.timeMs-desired);
        if(!best||distance<best.distance-1e-7||(Math.abs(distance-best.distance)<1e-7&&
          (point.priority<best.point.priority||(point.priority===best.point.priority&&
          (compare(point,best.point)<0||(compare(point,best.point)===0&&order<best.order))))))best={point,distance,edge,order};
      }
    }
    return best?{deltaMs:best.point.timeMs-best.edge.timeMs,guide:Object.freeze({timeMs:best.point.timeMs,kind:best.point.kind,label:best.point.label,edge:best.edge.edge})}:
      {deltaMs:Math.round(deltaMs/gridMs)*gridMs||0,guide:null};
  }});
}
