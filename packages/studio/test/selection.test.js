import test from 'node:test';
import assert from 'node:assert/strict';
import {createSample,editProject,findClip,createProjectStore,createEvaluator,validateProject} from '../src/index.js';
import {selectionBounds,includeLinkedClips,moveClips,duplicateClips,deleteClips,createSelectionSnapper} from '../src/selection.js';
import {linkKeyframeToCaptionWord,describeTimingLinks} from '../src/timing-links.js';
const ids=['camera.overview','cursor.overview','voice.overview','cc.overview.0'];
const clone=value=>JSON.parse(JSON.stringify(value));
const compact=()=>editProject(createSample(),p=>{
 for(const t of p.tracks){t.clips=t.clips.filter(c=>c.sceneId!=='overview'||ids.includes(c.id));
  for(const c of t.clips)if(c.sceneId==='overview'){c.startMs=500;c.durationMs=2000;
   if(c.keys)c.keys.forEach((k,i)=>k.atMs=i*1200);
   if(c.gestures)c.gestures[0].atMs=1400;
  }
 }
});
const linked=()=>{
 let p=editProject(compact(),p=>{const c=findClip(p,'cc.overview.0').clip;c.text='Review route.';c.words=[{text:'Review',startMs:200,endMs:600},{text:'route.',startMs:800,endMs:1400}];});
 p=linkKeyframeToCaptionWord(p,'camera.overview','camera.to.overview',{captionId:'cc.overview.0',wordIndex:1});
 return linkKeyframeToCaptionWord(p,'cursor.overview','cursor.to.overview',{captionId:'cc.overview.0',wordIndex:1,offsetMs:200});
};

test('bounds use project time, retain gaps and ignore selection click order',()=>{
 const p=compact(),r=selectionBounds(p,['voice.signal','cc.overview.0']);
 assert.equal(r.startMs,500);assert.equal(r.endMs,15188);assert.equal(r.durationMs,14688);
 assert.deepEqual(r.clipIds,['voice.signal','cc.overview.0']);assert.ok(Object.isFrozen(r.clipIds));
});
test('selection validation rejects empty, duplicated, missing, oversized and malformed identities',()=>{
 for(const value of [[],['missing'],['cc.overview.0','cc.overview.0'],[1],Array(1501).fill('cc.overview.0'),null,'cc.overview.0'])
  assert.throws(()=>selectionBounds(compact(),value));
});
test('group movement preserves all relative positions, source windows, audio and unselected clips',()=>{
 const p=compact(),before=clone(p),q=moveClips(p,ids,333);
 for(const id of ids){const a=findClip(p,id).clip,b=findClip(q,id).clip;assert.deepEqual(clone({...b,startMs:a.startMs}),clone(a));assert.equal(b.startMs,a.startMs+333);}
 assert.deepEqual(q.assets,p.assets);assert.deepEqual(findClip(q,'camera.signal').clip,findClip(p,'camera.signal').clip);
 assert.deepEqual(clone(p),before);assert.ok(Object.isFrozen(q));
});
test('zero offset is a no-op in the revision-checked undo store',()=>{
 const p=compact(),s=createProjectStore(p);s.commit(moveClips(p,ids,0),'No-op',0);assert.equal(s.snapshot().revision,0);
});
test('bounds, collisions, wrong deltas and locks reject the entire move',()=>{
 const p=compact(),before=clone(p);
 for(const delta of [-501,5000,NaN,Infinity,.1,'20'])assert.throws(()=>moveClips(p,ids,delta));
 const blocked=editProject(p,q=>q.tracks[1].locked=true);assert.throws(()=>moveClips(blocked,ids,100),/locked/);
 const crowded=editProject(p,q=>q.tracks[3].clips.push({id:'cc.blocker',sceneId:'overview',startMs:3000,durationMs:1000,text:'Stay here.'}));
 assert.throws(()=>moveClips(crowded,ids,1000),/overlap/);assert.deepEqual(clone(p),before);
});
test('one transaction creates one undo step and refuses stale application',()=>{
 const p=compact(),s=createProjectStore(p),q=moveClips(p,ids,250);
 s.commit(q,'Move 4 clips',0);assert.equal(s.snapshot().revision,1);assert.deepEqual(s.undo().project,p);assert.deepEqual(s.redo().project,q);
 assert.throws(()=>s.commit(p,'Stale',0),/changed/);assert.deepEqual(s.snapshot().project,q);
});
test('linked motion and captions travel together without rewriting key source times or delays',()=>{
 const p=linked(),q=moveClips(p,ids,250);
 for(const id of ['camera.overview','cursor.overview'])assert.deepEqual(findClip(p,id).clip.keys,findClip(q,id).clip.keys);
 assert.deepEqual(describeTimingLinks(q).map(r=>r.projectTimeMs),describeTimingLinks(p).map(r=>r.projectTimeMs+250));
});
test('incomplete moving groups fail, and explicit dependency inclusion computes transitive closure',()=>{
 const p=linked();assert.throws(()=>moveClips(p,['cc.overview.0','voice.overview'],100),/Include linked/);
 assert.throws(()=>moveClips(p,['camera.overview'],100),/Include linked/);
 assert.deepEqual(includeLinkedClips(p,['camera.overview']),['camera.overview','cursor.overview','cc.overview.0']);
 assert.equal(moveClips(p,includeLinkedClips(p,['camera.overview']),100).tracks[0].clips[0].startMs,600);
 assert.equal(includeLinkedClips(p,['voice.overview']).length,1);
});
test('multi-scene movement keeps each original scene; any unavailable space blocks everything',()=>{
 const p=editProject(compact(),p=>{const c=findClip(p,'voice.signal').clip;c.startMs=400;c.durationMs=1000;});
 const q=moveClips(p,['voice.signal','cc.overview.0'],100);
 assert.equal(findClip(q,'voice.signal').clip.startMs,500);assert.equal(findClip(q,'cc.overview.0').clip.startMs,600);
 assert.throws(()=>moveClips(p,['voice.signal','cc.overview.0'],-450));
});
test('group duplication preserves source content and creates globally unique identities',()=>{
 const p=compact(),before=clone(p),r=duplicateClips(p,ids,2500);assert.equal(r.clipIds.length,4);assert.ok(validateProject(r.value).ok);
 for(let i=0;i<ids.length;i++){
  const a=findClip(p,ids[i]).clip,b=findClip(r.value,r.clipIds[i]).clip;
  assert.equal(b.startMs,a.startMs+2500);assert.equal(b.durationMs,a.durationMs);assert.equal(b.sourceInMs,a.sourceInMs);
  assert.equal(b.offsetMs,a.offsetMs);assert.notEqual(b.id,a.id);
 }
 assert.deepEqual(r.value.assets,p.assets);assert.deepEqual(clone(p),before);
});
test('duplicated word links target the duplicated caption and words, never the originals',()=>{
 const p=linked(),r=duplicateClips(p,ids,2500),copyCaption=r.clipIds[3];
 const original=describeTimingLinks(p),links=describeTimingLinks(r.value).filter(l=>r.clipIds.includes(l.clipId));
 assert.equal(links.length,2);assert.ok(links.every(l=>l.captionId===copyCaption));
 assert.ok(links.every(l=>!original.some(o=>o.wordId===l.wordId)));
 assert.deepEqual(links.map(l=>l.projectTimeMs),original.map(l=>l.projectTimeMs+2500));
});
test('duplicate caller order does not change deterministic identity assignment',()=>{
 const p=linked();assert.deepEqual(duplicateClips(p,ids,2500),duplicateClips(p,[...ids].reverse(),2500));
});
test('duplicate refuses external caption links, collisions, full scenes and locked lanes',()=>{
 assert.throws(()=>duplicateClips(linked(),['camera.overview'],2500),/Include linked/);
 assert.throws(()=>duplicateClips(compact(),ids,0),/overlap/);
 assert.throws(()=>duplicateClips(compact(),ids,5000));
 const p=editProject(compact(),q=>q.tracks[2].locked=true);assert.throws(()=>duplicateClips(p,ids,2500),/locked/);
});
test('deleting a complete group preserves all other content and supports one-step undo',()=>{
 const p=linked(),q=deleteClips(p,ids);assert.equal(describeTimingLinks(q).length,0);
 assert.deepEqual(q.assets,p.assets);assert.deepEqual(q.scenes,p.scenes);assert.equal(q.tracks.reduce((n,t)=>n+t.clips.length,0),p.tracks.reduce((n,t)=>n+t.clips.length,0)-4);
 const s=createProjectStore(p);s.commit(q,'Delete group');assert.deepEqual(s.undo().project,p);
});
test('delete refuses orphaning an unselected motion link; deleting motion alone is safe',()=>{
 const p=linked();assert.throws(()=>deleteClips(p,['cc.overview.0']),/Include linked/);
 assert.equal(describeTimingLinks(deleteClips(p,['camera.overview'])).length,1);
});
test('locked deletion fails atomically and group operations never reinterpret styling or voice text',()=>{
 const p=editProject(linked(),q=>q.tracks[0].locked=true);assert.throws(()=>deleteClips(p,ids),/locked/);
 const q=duplicateClips(linked(),['voice.overview'],2500).value;
 assert.deepEqual(q.captionTheme,p.captionTheme);assert.equal(findClip(q,'voice.overview').clip.script,findClip(p,'voice.overview').clip.script);
});
test('selection accessors and sparse arrays are rejected without reading accessor values',()=>{
 let read=0;const ids=[];Object.defineProperty(ids,'0',{get(){read++;return 'camera.overview';},enumerable:true});ids.length=1;
 assert.throws(()=>selectionBounds(compact(),ids));assert.equal(read,0);
 assert.throws(()=>moveClips(compact(),new Array(2),0));
});
test('group magnets ignore their own selected clips and keys and retain exact bypass',()=>{
 const p=compact(),snap=createSelectionSnapper(p,ids,{pixelsPerSecond:100});
 assert.deepEqual(snap.snap(38),{deltaMs:0,guide:null});
 assert.deepEqual(snap.snap(38,{bypass:true}),{deltaMs:38,guide:null});
 const atPlayhead=createSelectionSnapper(p,ids,{pixelsPerSecond:100,playheadMs:1267}).snap(740);
 assert.equal(atPlayhead.deltaMs,767);assert.equal(atPlayhead.guide.kind,'playhead');
 assert.equal(atPlayhead.guide.timeMs,1267);
});
test('a selected trailing edge snaps to an unselected visible clip as one group delta',()=>{
 const p=editProject(compact(),q=>q.tracks[3].clips.push({id:'cc.anchor',sceneId:'overview',startMs:3000,durationMs:500,text:'Anchor.'}));
 const r=createSelectionSnapper(p,ids,{pixelsPerSecond:100}).snap(460);
 assert.equal(r.deltaMs,500);assert.equal(r.guide.edge,'end');assert.equal(r.guide.timeMs,3000);
 const off=editProject(p,q=>q.tracks[3].enabled=false);
 assert.equal(createSelectionSnapper(off,ids,{pixelsPerSecond:100}).snap(460).guide,null);
});
test('group snapping validates options and never commits an out-of-bounds candidate',()=>{
 for(const options of [{pixelsPerSecond:0},{pixelsPerSecond:Infinity},{pixelsPerSecond:100,tolerancePx:99},{pixelsPerSecond:100,gridMs:.1},{pixelsPerSecond:100,playheadMs:-1}])
  assert.throws(()=>createSelectionSnapper(compact(),ids,options));
 const snap=createSelectionSnapper(compact(),ids,{pixelsPerSecond:100});
 assert.throws(()=>snap.snap(NaN));assert.throws(()=>snap.snap(1,{bypass:'yes'}));
 const result=snap.snap(-550,{bypass:true});assert.throws(()=>moveClips(compact(),ids,result.deltaMs));
});
