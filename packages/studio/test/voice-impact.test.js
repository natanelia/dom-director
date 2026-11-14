import test from 'node:test';
import assert from 'node:assert/strict';
import {createSample,editProject,findClip,sceneTimeline,splitClip,trimClip,createProjectStore} from '../src/index.js';
import {describeVoiceReplacementImpact,proposeVoiceReplacement,distributeCaptionWords} from '../src/editing.js';
import {linkKeyframeToCaptionWord} from '../src/timing-links.js';
import {saveProjectBundle,readProjectBundle,digest} from '../src/media.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const asset=durationMs=>({id:'new.take',name:'Replacement take',mime:'audio/wav',source:'sample',sample:'new.take',durationMs});
const fit=(project,length,clipId='voice.overview')=>proposeVoiceReplacement(project,clipId,asset(length),{fitScene:true}).value;
const rows=(impact,kind)=>impact.groups.find(group=>group.kind===kind).items;
const row=(impact,kind,id,type='clip')=>rows(impact,kind).find(item=>item.entityId===id&&item.type===type);
function linked(){
  let project=distributeCaptionWords(createSample(),'cc.overview.0');
  project=linkKeyframeToCaptionWord(project,'camera.overview','camera.to.overview',{captionId:'cc.overview.0',wordIndex:1,offsetMs:200});
  return linkKeyframeToCaptionWord(project,'cursor.overview','cursor.to.overview',{captionId:'cc.overview.0',wordIndex:1,offsetMs:300});
}

test('longer replacement describes original and final timing, including every shifted later scene',()=>{
  const before=createSample(),proposal=proposeVoiceReplacement(before,'voice.overview',asset(9000),{fitScene:true});
  assert.equal(proposal.changes.find(item=>item.id==='voice.overview').before.durationMs,1);
  const impact=describeVoiceReplacementImpact(before,proposal.value,'voice.overview');
  assert.deepEqual(impact.scene,{id:'overview',title:'The living workspace',before:{startMs:0,endMs:6980,durationMs:6980},after:{startMs:0,endMs:9000,durationMs:9000},deltaMs:2020});
  assert.equal(impact.shiftedSceneCount,2);assert.equal(impact.total,28);
  assert.deepEqual(impact.groups.map(group=>[group.kind,group.total]),[['captions',6],['camera',8],['cursor',11],['voice',3]]);
  const voice=row(impact,'voice','voice.overview');assert.equal(voice.before.endMs,6980);assert.equal(voice.after.endMs,9000);
  const later=row(impact,'camera','camera.to.signal','keyframe');assert.equal(later.before.startMs,8580);assert.equal(later.after.startMs,10600);
  assert.equal(later.before.sourceStartMs,1600);assert.equal(later.after.sourceStartMs,1600);
  assert.equal(row(impact,'voice','voice.story').after.startMs,17208);
});

test('shorter replacement reports the real previous trim and clamped fades instead of temporary clearing',()=>{
  const before=editProject(createSample(),next=>Object.assign(findClip(next,'voice.overview').clip,{sourceInMs:500,durationMs:6000,fadeInMs:2000,fadeOutMs:2500}));
  const impact=describeVoiceReplacementImpact(before,fit(before,1000),'voice.overview'),voice=row(impact,'voice','voice.overview');
  assert.deepEqual(voice.before,{startMs:0,endMs:6000,sourceStartMs:500,sourceEndMs:6500,assetId:'audio.overview',assetName:before.assets[0].name,fadeInMs:2000,fadeOutMs:2500});
  assert.deepEqual(voice.after,{startMs:0,endMs:1000,sourceStartMs:0,sourceEndMs:1000,assetId:'new.take',assetName:'Replacement take',fadeInMs:1000,fadeOutMs:0});
  assert.equal(impact.scene.deltaMs,-5980);assert.equal(row(impact,'captions','cc.overview.1').after.startMs,500);
});

test('same-duration take still identifies audio replacement while unchanged visuals have no impact rows',()=>{
  const before=createSample(),impact=describeVoiceReplacementImpact(before,fit(before,6980),'voice.overview');
  assert.equal(impact.scene.deltaMs,0);assert.equal(impact.shiftedSceneCount,0);assert.equal(impact.total,1);
  for(const kind of ['captions','camera','cursor'])assert.deepEqual(rows(impact,kind),[]);
  assert.equal(row(impact,'voice','voice.overview').after.assetId,'new.take');
});

test('keeping scene timing describes changed source trim without implying any visual retiming',()=>{
  const before=editProject(createSample(),next=>Object.assign(findClip(next,'voice.overview').clip,{sourceInMs:500,durationMs:5000}));
  const after=proposeVoiceReplacement(before,'voice.overview',asset(5000)).value,impact=describeVoiceReplacementImpact(before,after,'voice.overview');
  assert.equal(impact.total,1);assert.equal(impact.shiftedSceneCount,0);
  const voice=row(impact,'voice','voice.overview');assert.equal(voice.before.sourceStartMs,500);assert.equal(voice.after.sourceStartMs,0);
  assert.equal(voice.before.endMs,voice.after.endMs);assert.deepEqual(impact.scene.before,impact.scene.after);
});

test('linked keys follow exact authored boundaries with a fixed delay, including hidden caption languages',()=>{
  const before=editProject(linked(),next=>{
    next.tracks.find(track=>track.kind==='captions').enabled=false;
    next.tracks.push({id:'cc.fr',kind:'captions',name:'French',language:'fr',enabled:true,locked:false,clips:[]});next.captionTrack='cc.fr';
  });
  const after=fit(before,13960),impact=describeVoiceReplacementImpact(before,after,'voice.overview');
  const word=rows(impact,'captions').find(item=>item.type==='word'&&item.wordIndex===1);
  assert.equal(word.label,'looks');assert.equal(word.before.startMs,581);assert.equal(word.after.startMs,1162);
  assert.equal(word.enabled,false);assert.equal(word.active,false);assert.equal(word.language,'en');assert.ok(word.entityId);
  for(const [kind,delay] of [['camera',200],['cursor',300]]){
    const key=row(impact,kind,kind+'.to.overview','keyframe');
    assert.equal(key.before.startMs,581+delay);assert.equal(key.after.startMs,1162+delay);
    assert.equal(key.link.offsetMs,delay);assert.equal(key.link.wordText,'looks');assert.equal(key.link.hidden,true);
    assert.deepEqual(key.before.link,key.after.link);assert.equal(key.link.wordId,word.entityId);
  }
  assert.equal(findClip(after,'cc.overview.0').clip.words[1].id,findClip(before,'cc.overview.0').clip.words[1].id);
});

test('split-source and off-window linked keys are included with exact source and project coordinates',()=>{
  let before=splitClip(linked(),'camera.overview',2000);before=splitClip(before,'cursor.overview',2000);
  const after=fit(before,13960),impact=describeVoiceReplacementImpact(before,after,'voice.overview',{limit:100});
  for(const kind of ['camera','cursor']){
    const second=before.tracks.find(track=>track.kind===kind).clips.find(clip=>clip.sceneId==='overview'&&clip.startMs===2000);
    const key=second.keys.find(key=>key.timing),entry=row(impact,kind,key.id,'keyframe'),clip=row(impact,kind,second.id);
    assert.equal(entry.before.visible,false);assert.equal(entry.after.visible,false);
    assert.equal(entry.before.sourceStartMs,key.atMs);assert.equal(entry.before.startMs,key.atMs);
    const changed=findClip(after,second.id).clip.keys.find(item=>item.id===key.id);
    assert.equal(entry.after.sourceStartMs,changed.atMs);assert.equal(entry.after.startMs,changed.atMs);
    assert.equal(clip.before.sourceStartMs,2000);assert.equal(clip.after.sourceStartMs,4000);
  }
});

test('translated off-window keys can have negative project positions and gestures keep separate source coordinates',()=>{
  const before=editProject(createSample(),next=>{for(const kind of ['camera','cursor'])Object.assign(findClip(next,kind+'.overview').clip,{startMs:500,offsetMs:2500,durationMs:4000});});
  const impact=describeVoiceReplacementImpact(before,fit(before,13960),'voice.overview');
  const key=row(impact,'camera','camera.to.overview','keyframe');
  assert.equal(key.before.startMs,-1000);assert.equal(key.after.startMs,-2000);assert.equal(key.before.sourceStartMs,1000);assert.equal(key.after.sourceStartMs,2000);
  assert.equal(key.before.visible,false);assert.equal(key.after.visible,false);
  const gesture=row(impact,'cursor','click.overview','gesture');assert.equal(gesture.label,'click');
  assert.equal(gesture.before.startMs,1300);assert.equal(gesture.after.startMs,2600);assert.equal(gesture.after.sourceStartMs,6600);
});

test('gesture visibility excludes the source-window end while a key at that boundary remains visible',()=>{
  const before=editProject(trimClip(createSample(),'cursor.overview',0,3300),next=>{findClip(next,'cursor.overview').clip.keys[1].atMs=3300;});
  const impact=describeVoiceReplacementImpact(before,fit(before,9000),'voice.overview');
  const gesture=row(impact,'cursor','click.overview','gesture'),key=row(impact,'cursor','cursor.to.overview','keyframe');
  assert.equal(gesture.before.visible,false);assert.equal(gesture.after.visible,false);
  assert.equal(key.before.visible,true);assert.equal(key.after.visible,true);
  assert.equal(gesture.after.sourceStartMs,4255);assert.equal(key.after.sourceStartMs,4255);
});

test('retiming a middle scene preserves its project origin and excludes earlier scene rows',()=>{
  const before=createSample(),after=fit(before,16416,'voice.signal'),impact=describeVoiceReplacementImpact(before,after,'voice.signal');
  assert.equal(impact.scene.before.startMs,6980);assert.equal(impact.scene.after.startMs,6980);assert.equal(impact.shiftedSceneCount,1);
  assert.equal(impact.scene.deltaMs,8208);assert.equal(row(impact,'camera','camera.to.signal','keyframe').after.startMs,10180);
  assert.equal(impact.groups.flatMap(group=>group.items).some(item=>item.sceneId==='overview'),false);
  assert.equal(row(impact,'voice','voice.story').after.startMs,23396);
});

test('bounded pages retain complete counts and stable identities without skipping words across page boundaries',()=>{
  const before=editProject(createSample(),next=>{
    const caption=findClip(next,'cc.overview.0').clip;
    caption.words=Array.from({length:60},(_,i)=>({text:'word'+i,startMs:i*40,endMs:(i+1)*40}));caption.text=caption.words.map(word=>word.text).join(' ');
  }),after=fit(before,13960);
  const all=describeVoiceReplacementImpact(before,after,'voice.overview',{limit:100}),expected=rows(all,'captions'),collected=[];
  assert.equal(expected.length,66);assert.equal(describeVoiceReplacementImpact(before,after,'voice.overview').groups[0].items.length,20);
  for(let offset=0;offset<expected.length;offset+=7){
    const impact=describeVoiceReplacementImpact(before,after,'voice.overview',{limit:7,offsets:{captions:offset}}),page=impact.groups[0];
    assert.equal(page.offset,offset);assert.equal(page.total,66);assert.ok(page.items.length<=7);assert.equal(page.hasMore,offset+page.items.length<66);collected.push(...page.items);
  }
  assert.deepEqual(collected,expected);assert.equal(new Set(collected.map(item=>item.id)).size,collected.length);
  const end=describeVoiceReplacementImpact(before,after,'voice.overview',{offsets:{captions:9999}}).groups[0];assert.deepEqual(end.items,[]);assert.equal(end.total,66);assert.equal(end.hasMore,false);
});

test('descriptions are deterministic and deeply immutable without freezing or mutating caller input',()=>{
  const before=copy(linked()),after=copy(fit(before,9000)),oldText=JSON.stringify(before),newText=JSON.stringify(after);
  const impact=describeVoiceReplacementImpact(before,after,'voice.overview');
  assert.equal(JSON.stringify(before),oldText);assert.equal(JSON.stringify(after),newText);assert.equal(Object.isFrozen(before),false);assert.equal(Object.isFrozen(after.tracks),false);
  assert.deepEqual(describeVoiceReplacementImpact(before,after,'voice.overview'),impact);
  assert.throws(()=>impact.groups.push(impact.groups[0]),TypeError);assert.throws(()=>row(impact,'camera','camera.to.overview','keyframe').before.link.offsetMs=0,TypeError);
  after.tracks[3].clips[0].text='Changed elsewhere';assert.equal(rows(impact,'captions')[0].label,'This looks like a product video.');
});

test('invalid pages, projects and unrelated edits cannot produce a partial or misleading replacement review',()=>{
  const before=createSample(),after=fit(before,9000);
  for(const limit of [0,101,1.1,NaN,Infinity,'20'])assert.throws(()=>describeVoiceReplacementImpact(before,after,'voice.overview',{limit}),/pages/);
  for(const offsets of [{captions:-1},{voice:0.5},{camera:Infinity},{cursor:Number.MAX_SAFE_INTEGER+1},{music:0},[],null])assert.throws(()=>describeVoiceReplacementImpact(before,after,'voice.overview',{offsets}),/offsets/);
  assert.throws(()=>describeVoiceReplacementImpact({},after,'voice.overview'));
  assert.throws(()=>describeVoiceReplacementImpact(before,after,'cc.overview.0'),/voice clip/);
  for(const change of [next=>{next.id='different.project';},next=>{next.title='Unrelated';},next=>{next.scenes[1].title='New title';},
    next=>{next.tracks[3].clips[0].text='An unreviewed caption.';},next=>{next.tracks[0].clips[0].keys[1].zoom=2;},
    next=>{next.tracks[1].clips[0].gestures[0].id='different.gesture';},next=>{next.tracks[3].enabled=false;},
    next=>{next.assets[0].name='Rebound original';},next=>{next.assets.push({...asset(3000),id:'unrelated.asset'});}]){
    assert.throws(()=>describeVoiceReplacementImpact(before,editProject(after,change),'voice.overview'),/same project/);
  }
});

test('locked affected tracks and stale review commits fail atomically through the existing transaction authority',()=>{
  for(const kind of ['captions','camera','cursor','voice']){
    const before=editProject(linked(),next=>{next.tracks.find(track=>track.kind===kind).locked=true;});
    assert.throws(()=>fit(before,9000),/locked/);assert.equal(before.scenes[0].durationMs,6980);
  }
  const before=createSample(),store=createProjectStore(before),after=fit(before,9000);
  describeVoiceReplacementImpact(before,after,'voice.overview');assert.equal(store.snapshot().revision,0);assert.equal(store.snapshot().canUndo,false);
  store.commit(editProject(before,next=>{next.title='Newer edit';}),'Newer edit',0);const current=store.snapshot();
  assert.throws(()=>store.commit(after,'Accepted stale review',0),/changed/);assert.deepEqual(store.snapshot(),current);
});

test('accepted descriptor agrees with one-step Undo, Redo and a native bundle round trip',async()=>{
  const bytes=new Uint8Array([1,2,3,4]).buffer,newAsset={...asset(9000),source:'local',sha256:await digest(bytes)};delete newAsset.sample;
  const before=linked(),after=proposeVoiceReplacement(before,'voice.overview',newAsset,{fitScene:true}).value,impact=describeVoiceReplacementImpact(before,after,'voice.overview');
  const store=createProjectStore(before);store.commit(after,'Reviewed voice replacement',0);
  assert.deepEqual(describeVoiceReplacementImpact(before,store.snapshot().project,'voice.overview'),impact);
  assert.deepEqual(store.undo().project,before);assert.deepEqual(store.redo().project,after);
  const bundle=await saveProjectBundle(after,{bytes:id=>{assert.equal(id,'new.take');return bytes;}}),opened=await readProjectBundle(bundle);
  assert.deepEqual(opened.project,after);assert.deepEqual(describeVoiceReplacementImpact(before,opened.project,'voice.overview'),impact);
  assert.deepEqual(sceneTimeline(opened.project),sceneTimeline(after));
});
