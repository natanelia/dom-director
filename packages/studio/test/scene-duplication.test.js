import test from 'node:test';
import assert from 'node:assert/strict';
import {createSample,editProject,sceneTimeline,createEvaluator,createProjectStore,splitClip} from '../src/index.js';
import {duplicateScene,deleteScene,distributeCaptionWords,stampCaptionWord} from '../src/editing.js';
import {linkKeyframeToCaptionWord,describeTimingLinks} from '../src/timing-links.js';
import {saveProjectBundle,readProjectBundle,digest} from '../src/media.js';
const copy=value=>JSON.parse(JSON.stringify(value));
const clips=(p,sceneId)=>p.tracks.flatMap(t=>t.clips.filter(c=>c.sceneId===sceneId));
function ids(p){const result=[];JSON.stringify(p,(key,value)=>{if(key==='id')result.push(value);return value;});return result;}
function assertCopies(before,after,sourceId,sceneId){
  assert.equal(after.studioVersion,before.studioVersion);assert.deepEqual(after.assets,before.assets);
  assert.equal(after.captionTrack,before.captionTrack);assert.deepEqual(after.captionTheme,before.captionTheme);assert.deepEqual(after.cursorTheme,before.cursorTheme);
  assert.equal(new Set(ids(after)).size,ids(after).length);
  for(const [i,t] of before.tracks.entries()){
    const next=after.tracks[i],original=t.clips.filter(c=>c.sceneId===sourceId),created=next.clips.filter(c=>c.sceneId===sceneId);
    assert.deepEqual({...next,clips:[]},{...t,clips:[]});assert.deepEqual(next.clips.filter(c=>c.sceneId!==sceneId),t.clips);
    assert.equal(created.length,original.length);
    for(const [j,c] of original.entries()){
      const duplicate=copy(created[j]);assert.notEqual(duplicate.id,c.id);duplicate.id=c.id;duplicate.sceneId=c.sceneId;
      duplicate.keys?.forEach((key,k)=>{assert.notEqual(key.id,c.keys[k].id);key.id=c.keys[k].id;if(key.timing){assert.notEqual(key.timing.captionId,c.keys[k].timing.captionId);assert.notEqual(key.timing.wordId,c.keys[k].timing.wordId);key.timing.captionId=c.keys[k].timing.captionId;key.timing.wordId=c.keys[k].timing.wordId;}});
      duplicate.gestures?.forEach((g,k)=>{assert.notEqual(g.id,c.gestures[k].id);g.id=c.gestures[k].id;});
      duplicate.words?.forEach((w,k)=>{if(w.id!==undefined){assert.notEqual(w.id,c.words[k].id);w.id=c.words[k].id;}});
      assert.deepEqual(duplicate,copy(c));
    }
  }
}
function linked(){let p=distributeCaptionWords(createSample(),'cc.overview.0');p=linkKeyframeToCaptionWord(p,'camera.overview','camera.to.overview',{captionId:'cc.overview.0',wordIndex:1,offsetMs:200});return linkKeyframeToCaptionWord(p,'cursor.overview','cursor.to.overview',{captionId:'cc.overview.0',wordIndex:1,offsetMs:300});}
test('duplicates a complete scene directly after its source without mutating the frozen project',()=>{
  const p=createSample(),before=copy(p),r=duplicateScene(p,'overview');
  assert.deepEqual(copy(p),before);assert.equal(r.value.scenes[1].id,r.sceneId);assert.equal(r.value.scenes[1].title,'The living workspace (copy)');
  assert.equal(r.value.scenes[1].durationMs,p.scenes[0].durationMs);assertCopies(p,r.value,'overview',r.sceneId);
  assert.ok(Object.isFrozen(r.value.tracks[0].clips.at(-1).keys));assert.deepEqual(deleteScene(r.value,r.sceneId),p);
});
test('duplicates the last scene and does not change earlier scene positions',()=>{
  const p=createSample(),r=duplicateScene(p,'story');assert.equal(r.value.scenes.at(-1).id,r.sceneId);
  assert.deepEqual(sceneTimeline(r.value).slice(0,3),sceneTimeline(p));assertCopies(p,r.value,'story',r.sceneId);
});
test('legacy word timing remains legacy and does not gain invented word identifiers',()=>{
  const p=distributeCaptionWords(createSample(),'cc.overview.0'),r=duplicateScene(p,'overview');assertCopies(p,r.value,'overview',r.sceneId);
  const c=clips(r.value,r.sceneId).find(c=>c.words);assert.equal(c.words[0].id,undefined);assert.equal(r.value.studioVersion,'0.1.0-draft.1');
});
test('camera and cursor links follow copied words, while edits to the copy leave the original unchanged',()=>{
  const p=linked(),r=duplicateScene(p,'overview');assertCopies(p,r.value,'overview',r.sceneId);
  const c=clips(r.value,r.sceneId).find(c=>c.words),at=sceneTimeline(r.value).find(s=>s.id===r.sceneId).startMs;
  const q=stampCaptionWord(r.value,c.id,1,'start',at+c.startMs+c.words[1].startMs+1);
  assert.deepEqual(describeTimingLinks(q).filter(x=>x.sceneId==='overview'),describeTimingLinks(p));
  const original=describeTimingLinks(r.value).filter(x=>x.sceneId===r.sceneId),next=describeTimingLinks(q).filter(x=>x.sceneId===r.sceneId);
  assert.equal(next.length,2);next.forEach((link,i)=>assert.equal(link.sourceTimeMs,original[i].sourceTimeMs+1));
});
test('copies inactive language and extra voice lanes, including overrides, without changing enabled state',()=>{
  let p=editProject(createSample(),n=>{n.tracks.push({id:'cc.fr',kind:'captions',name:'French',enabled:false,locked:false,language:'fr',style:{size:35},clips:[{id:'fr.one',sceneId:'overview',startMs:0,durationMs:1000,text:'Bonjour.',style:{color:'#010203'}}]});n.tracks.push({id:'voice.alt',kind:'voice',name:'Alternative',enabled:false,locked:false,clips:[{...copy(n.tracks[2].clips[0]),id:'voice.extra',startMs:100,sourceInMs:200,durationMs:3000,gain:.4,fadeInMs:20,fadeOutMs:100}]});n.tracks[1].clips[0].style={shape:'hand',trail:true};});
  const r=duplicateScene(p,'overview');assertCopies(p,r.value,'overview',r.sceneId);
});
test('links resolve regardless of track order or whether their caption language is active',()=>{
  let p=linked();p=editProject(p,n=>{n.tracks.find(t=>t.kind==='captions').enabled=false;n.tracks.reverse();});
  const r=duplicateScene(p,'overview');assertCopies(p,r.value,'overview',r.sceneId);assert.equal(describeTimingLinks(r.value).length,4);
});
test('split source windows, path easing and visual gestures are copied rather than restarted',()=>{
  let p=splitClip(createSample(),'camera.overview',2200);p=splitClip(p,'cursor.overview',2200);p=splitClip(p,'voice.overview',2200);
  const r=duplicateScene(p,'overview');assertCopies(p,r.value,'overview',r.sceneId);
  const plan=createEvaluator(r.value),rects={'orbit.overview':{x:0,y:0,width:960,height:540},'orbit.metrics':{x:30,y:50,width:600,height:120},'orbit.map':{x:30,y:220,width:600,height:260}},safe={x:0,y:0,width:960,height:540};
  for(const at of [0,500,2199,2200,3300,6000]){const original=plan.sample(at,rects,safe),duplicate=plan.sample(at+p.scenes[0].durationMs,rects,safe);assert.deepEqual(duplicate.camera,original.camera);assert.ok(original.cursor);assert.deepEqual([duplicate.cursor.x,duplicate.cursor.y,duplicate.cursor.client,duplicate.cursor.style,duplicate.cursor.trail],[original.cursor.x,original.cursor.y,original.cursor.client,original.cursor.style,original.cursor.trail]);assert.deepEqual(duplicate.cursor.gestures.map(({id,...g})=>g),original.cursor.gestures.map(({id,...g})=>g));}
});
test('scene duplication reuses local media bytes and saving does not multiply the asset manifest',async()=>{
  const bytes=new Uint8Array([1,2,3,4]).buffer,hash=await digest(bytes);
  const p=editProject(createSample(),n=>{n.assets[0]={id:'audio.overview',name:'Local take',source:'local',mime:'audio/wav',durationMs:8000,sha256:hash};});
  const r=duplicateScene(p,'overview');let reads=0;
  const bundle=await saveProjectBundle(r.value,{bytes:id=>{assert.equal(id,'audio.overview');reads++;return bytes;}}),opened=await readProjectBundle(bundle);
  assert.equal(reads,1);assert.equal(opened.media.length,1);assert.deepEqual(opened.project,r.value);assertCopies(p,r.value,'overview',r.sceneId);
});
test('locked source lanes reject the entire operation, including hidden lanes',()=>{
  for(const i of [0,1,2,3]){const p=editProject(createSample(),n=>{n.tracks[i].locked=true;n.tracks[i].enabled=false;});const before=copy(p);assert.throws(()=>duplicateScene(p,'overview'),/locked/);assert.deepEqual(copy(p),before);}
});
test('inserting a copy cannot indirectly move a later locked clip',()=>{
  const p=editProject(createSample(),n=>{n.tracks[2].clips=n.tracks[2].clips.filter(c=>c.sceneId==='story');n.tracks[2].locked=true;});assert.throws(()=>duplicateScene(p,'overview'),/locked/);
});
test('an unaffected earlier locked lane does not block duplication of the last scene',()=>{
  const p=editProject(createSample(),n=>{n.tracks[2].clips=n.tracks[2].clips.filter(c=>c.sceneId==='overview');n.tracks[2].locked=true;});const r=duplicateScene(p,'story');assertCopies(p,r.value,'story',r.sceneId);
});
test('an intentional empty scene is copied without inventing clips',()=>{
  const p=editProject(createSample(),n=>{for(const t of n.tracks)t.clips=t.clips.filter(c=>c.sceneId!=='signal');});const r=duplicateScene(p,'signal');assert.equal(clips(r.value,r.sceneId).length,0);assertCopies(p,r.value,'signal',r.sceneId);
});
test('new identities do not collide with existing project, asset, clip or key identities',()=>{
  const p=editProject(createSample(),n=>{n.id='scene-copy-1';n.tracks[0].id='scene-copy-2';n.tracks[0].clips[0].keys[0].id='clip-copy-4';});let q=p;
  for(let i=0;i<15;i++){const r=duplicateScene(q,q.scenes.at(-1).id);assertCopies(q,r.value,q.scenes.at(-1).id,r.sceneId);q=r.value;}
});
test('maximum title length and Unicode stay valid without cutting a surrogate pair',()=>{
  for(const title of ['x'.repeat(160),'🎬'.repeat(80)]){const p=editProject(createSample(),n=>n.scenes[0].title=title),r=duplicateScene(p,'overview'),name=r.value.scenes[1].title;assert.ok(name.length<=160);assert.ok(name.endsWith(' (copy)'));assert.equal(name.isWellFormed(),true);}
});
test('unknown scenes, excessive scene count and excessive duration fail without a partial result',()=>{
  const p=createSample();for(const id of [null,{},'missing'])assert.throws(()=>duplicateScene(p,id),/existing scene/);
  const sixty=editProject(p,n=>{n.scenes=Array.from({length:60},(_,i)=>({id:'s'+i,title:'Scene',durationMs:1000}));for(const t of n.tracks)t.clips=[];});assert.throws(()=>duplicateScene(sixty,'s0'),/1–60/);
  const long=editProject(p,n=>{n.scenes=Array.from({length:10},(_,i)=>({id:'s'+i,title:'Scene',durationMs:180000}));for(const t of n.tracks)t.clips=[];});assert.throws(()=>duplicateScene(long,'s0'),/30 minutes/);
});
test('copy is one revision-checked undoable transaction and does not bypass clip limits',()=>{
  const p=linked(),store=createProjectStore(p),r=duplicateScene(p,'overview');store.commit(r.value,'Duplicate scene',0);assert.deepEqual(store.undo().project,p);assert.deepEqual(store.redo().project,r.value);assert.throws(()=>store.commit(r.value,'stale',0),/changed/);
  const many=editProject(createSample(),n=>{n.tracks[3].clips=Array.from({length:251},(_,i)=>({id:'cc.many'+i,sceneId:'overview',startMs:i*2,durationMs:1,text:'A'}));});assert.throws(()=>duplicateScene(many,'overview'),/Too many clips/);
});

test('bounded history reports when a duplicate cannot retain its predecessor',()=>{
  const p=createSample(),store=createProjectStore(p,{byteLimit:1024}),r=duplicateScene(p,'overview');
  const state=store.commit(r.value,'Duplicate scene',0);
  assert.equal(state.canUndo,false);assert.equal(state.expired,1);
  assert.deepEqual(store.undo().project,r.value);
});
