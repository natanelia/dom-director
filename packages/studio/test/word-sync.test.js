import test from 'node:test';
import assert from 'node:assert/strict';
import {createSample,editProject,findClip,sceneTimeline,splitClip,createProjectStore} from '../src/index.js';
import {captionWordAnchors,stampCaptionWord,alignKeyframeToCaptionWord,createTimelineSnapper,distributeCaptionWords} from '../src/editing.js';
const caption='cc.signal.0',motion='camera.signal',key='camera.to.signal';
const fixture=()=>distributeCaptionWords(createSample(),caption);
const word=(p,i=1,boundary='start')=>captionWordAnchors(p,'signal').find(a=>a.captionId===caption&&a.wordIndex===i&&a.boundary===boundary);
const keyAt=p=>findClip(p,motion).clip.keys.find(k=>k.id===key).atMs;
const snapshot=p=>JSON.stringify(p);

test('anchors preserve caption, scene and project coordinate systems and immutable input',()=>{
 const p=fixture(),before=snapshot(p),anchors=captionWordAnchors(p,'signal');
 const c=findClip(p,caption).clip,s=sceneTimeline(p).find(s=>s.id==='signal');
 assert.equal(anchors.length,c.words.length*2);assert.ok(Object.isFrozen(anchors));assert.ok(anchors.every(Object.isFrozen));
 for(const a of anchors){assert.equal(a.sceneTimeMs,c.startMs+a.captionTimeMs);assert.equal(a.projectTimeMs,s.startMs+a.sceneTimeMs);}
 assert.equal(snapshot(p),before);assert.equal(captionWordAnchors(p,'overview').length,0);
 assert.throws(()=>captionWordAnchors(p,'unknown'));
});
test('stamp preserves exact millisecond precision, text, appearance and voice',()=>{
 const p=fixture(),a=word(p),before=snapshot(p),next=stampCaptionWord(p,caption,1,'start',a.projectTimeMs+1);
 assert.equal(findClip(next,caption).clip.words[1].startMs,a.captionTimeMs+1);
 assert.equal(findClip(next,caption).clip.text,findClip(p,caption).clip.text);
 assert.deepEqual(next.tracks.filter(t=>t.kind!=='captions'),p.tracks.filter(t=>t.kind!=='captions'));
 assert.equal(snapshot(p),before);
});
test('stamp supports end boundaries, including caption end, without moving adjacent words',()=>{
 const p=fixture(),a=word(p,1,'end'),next=stampCaptionWord(p,caption,1,'end',a.projectTimeMs-1);
 assert.equal(findClip(next,caption).clip.words[1].endMs,a.captionTimeMs-1);
 assert.deepEqual(findClip(next,caption).clip.words[2],findClip(p,caption).clip.words[2]);
 const count=findClip(p,caption).clip.words.length,last=word(p,count-1,'end');
 assert.deepEqual(stampCaptionWord(p,caption,count-1,'end',last.projectTimeMs),p);
});
test('invalid stamps fail atomically rather than collapsing or shifting other words',()=>{
 const p=fixture(),a=word(p),end=word(p,1,'end'),before=snapshot(p);
 for(const args of [[caption,1,'start',end.projectTimeMs],[caption,1,'start',a.projectTimeMs-1],[caption,1,'end',end.projectTimeMs+1],
 [caption,-1,'start',0],[caption,1.5,'start',0],[caption,999,'start',0],[caption,1,'middle',a.projectTimeMs],
 [caption,1,'start',NaN],[caption,1,'start',a.projectTimeMs+.5],[caption,1,'start',0],['voice.signal',1,'start',a.projectTimeMs]]){
  assert.throws(()=>stampCaptionWord(p,...args));assert.equal(snapshot(p),before);
 }
});
test('caption locks block stamps while locked visible captions remain reference anchors',()=>{
 const p=editProject(fixture(),n=>{n.tracks.find(t=>t.kind==='captions').locked=true;}),a=word(p);
 assert.throws(()=>stampCaptionWord(p,caption,1,'start',a.projectTimeMs+1),/locked/);
 assert.equal(keyAt(alignKeyframeToCaptionWord(p,motion,key,a)),a.sceneTimeMs);
});
test('align one camera or cursor key without changing composition, other keys or words',()=>{
 const p=fixture(),a=word(p,2,'end');
 for(const [clipId,keyId] of [[motion,key],['cursor.signal','cursor.to.signal']]){
  const next=alignKeyframeToCaptionWord(p,clipId,keyId,a),old=findClip(p,clipId).clip,changed=findClip(next,clipId).clip;
  assert.deepEqual({...changed.keys.find(k=>k.id===keyId)},{...old.keys.find(k=>k.id===keyId),atMs:a.sceneTimeMs});
  assert.deepEqual(changed.keys.filter(k=>k.id!==keyId),old.keys.filter(k=>k.id!==keyId));
  assert.deepEqual(next.tracks.filter(t=>t.kind==='voice'||t.kind==='captions'),p.tracks.filter(t=>t.kind==='voice'||t.kind==='captions'));
 }
});
test('alignment uses clip source windows after split and rejects off-window boundaries',()=>{
 let p=fixture();p=splitClip(p,motion,500);
 const right=p.tracks.find(t=>t.kind==='camera').clips.find(c=>c.sceneId==='signal'&&c.startMs===500),k=right.keys[1];
 const a=captionWordAnchors(p,'signal').find(a=>a.sceneTimeMs>500&&a.sceneTimeMs<right.startMs+right.durationMs);
 const next=alignKeyframeToCaptionWord(p,right.id,k.id,a);
 assert.equal(findClip(next,right.id).clip.keys.find(x=>x.id===k.id).atMs,right.offsetMs+a.sceneTimeMs-right.startMs);
 assert.throws(()=>alignKeyframeToCaptionWord(p,right.id,k.id,word(p,0)),/inside/);
});
test('alignment rejects collisions, wrong scene, hidden language and motion locks',()=>{
 const p=fixture(),a=word(p);assert.throws(()=>alignKeyframeToCaptionWord(p,motion,key,word(p,0)));
 assert.throws(()=>alignKeyframeToCaptionWord(p,'camera.overview','camera.to.overview',a));
 assert.throws(()=>alignKeyframeToCaptionWord(p,motion,key,{...a,wordIndex:-1}));
 assert.throws(()=>alignKeyframeToCaptionWord(p,motion,key,{...a,boundary:'middle'}));
 const hidden=editProject(p,n=>{n.tracks.find(t=>t.id===n.captionTrack).enabled=false;});assert.equal(captionWordAnchors(hidden,'signal').length,0);
 assert.throws(()=>alignKeyframeToCaptionWord(hidden,motion,key,a));
 const locked=editProject(p,n=>{n.tracks[0].locked=true;});assert.throws(()=>alignKeyframeToCaptionWord(locked,motion,key,a),/locked/);
});
test('alignment is one-time, reversible and stale application is rejected by the store',()=>{
 const p=fixture(),a=word(p),store=createProjectStore(p),next=alignKeyframeToCaptionWord(p,motion,key,a);
 store.commit(next,'Align to word',0);assert.equal(keyAt(store.snapshot().project),a.sceneTimeMs);
 store.undo();assert.deepEqual(store.snapshot().project,p);store.redo();assert.deepEqual(store.snapshot().project,next);
 assert.throws(()=>store.commit(next,'Stale',0),/changed/);
 const stamped=stampCaptionWord(next,caption,1,'start',a.projectTimeMs+1);assert.equal(keyAt(stamped),a.sceneTimeMs);
});
test('magnetic word anchors are exact and have explicit guides; Alt bypasses them',()=>{
 const p=fixture(),a=word(p),old=keyAt(p),snap=createTimelineSnapper(p,{clipId:motion,keyId:key,operation:'keyframe',pixelsPerSecond:1000,tolerancePx:8});
 const r=snap.snap(a.sceneTimeMs-old+3);assert.equal(r.deltaMs,a.sceneTimeMs-old);assert.equal(r.guide.kind,'word');assert.equal(r.guide.timeMs,a.projectTimeMs);
 assert.equal(snap.snap(a.sceneTimeMs-old+3,{bypass:true}).deltaMs,a.sceneTimeMs-old+3);
});
test('inactive languages and hidden caption tracks do not add word magnets',()=>{
 const original=fixture(),a=word(original),old=keyAt(original);
 const hidden=editProject(original,p=>{p.tracks.find(t=>t.id===p.captionTrack).enabled=false;});
 const opts={clipId:motion,keyId:key,operation:'keyframe',pixelsPerSecond:1000,tolerancePx:2};
 assert.notEqual(createTimelineSnapper(hidden,opts).snap(a.sceneTimeMs-old).guide?.kind,'word');
 const inactive=editProject(original,p=>{p.tracks.push({id:'cc.fr',kind:'captions',name:'French',language:'fr',enabled:true,locked:false,clips:[]});p.captionTrack='cc.fr';});
 assert.equal(captionWordAnchors(inactive,'signal').length,0);assert.notEqual(createTimelineSnapper(inactive,opts).snap(a.sceneTimeMs-old).guide?.kind,'word');
});
test('invalid project inputs are refused before deriving or applying anchors',()=>{
 for(const input of [null,'{}',{tracks:[]},'x'.repeat(1048577)]){
  assert.throws(()=>captionWordAnchors(input,'signal'));assert.throws(()=>stampCaptionWord(input,caption,1,'start',7000));assert.throws(()=>alignKeyframeToCaptionWord(input,motion,key,{captionId:caption,wordIndex:1}));
 }
});
