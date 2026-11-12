import test from 'node:test';
import assert from 'node:assert/strict';
import {createSample,editProject,findClip,splitClip,createProjectStore} from '../src/index.js';
import {setVoiceMix} from '../src/selection.js';
import {planVoiceMix} from '../src/audio-export.js';
import {distributeCaptionWords} from '../src/editing.js';
import {linkKeyframeToCaptionWord,describeTimingLinks} from '../src/timing-links.js';
import {saveProjectBundle,readProjectBundle} from '../src/media.js';
const ids=['voice.overview','voice.signal'];
const plain=value=>JSON.parse(JSON.stringify(value));
const clip=(p,id)=>findClip(p,id).clip;
function withoutMix(value){const {gain,fadeInMs,fadeOutMs,...rest}=value;return rest;}

// This is an edit of gain envelopes, never a request to render, play or regenerate audio.
test('batch mix changes exactly the requested voice fields and leaves input immutable',()=>{
  const p=createSample(),before=plain(p);
  const q=setVoiceMix(p,ids,{gain:.65,fadeInMs:125,fadeOutMs:333});
  for(const id of ids){const c=clip(q,id);assert.equal(c.gain,.65);assert.equal(c.fadeInMs,125);assert.equal(c.fadeOutMs,333);
    assert.deepEqual(withoutMix(c),withoutMix(clip(p,id)));assert.ok(Object.isFrozen(c));}
  for(const kind of ['camera','cursor','captions'])assert.deepEqual(q.tracks.filter(t=>t.kind===kind),p.tracks.filter(t=>t.kind===kind));
  assert.deepEqual(clip(q,'voice.story'),clip(p,'voice.story'));assert.deepEqual(q.assets,p.assets);assert.deepEqual(q.scenes,p.scenes);
  assert.deepEqual(plain(p),before);
});

test('omitted fields retain individual values; zero explicitly mutes or removes a fade',()=>{
  const p=editProject(createSample(),q=>{Object.assign(findClip(q,ids[0]).clip,{gain:.2,fadeInMs:200,fadeOutMs:300});
    Object.assign(findClip(q,ids[1]).clip,{gain:1.2,fadeInMs:20,fadeOutMs:30});});
  const a=setVoiceMix(p,ids,{gain:0});
  for(const id of ids){assert.equal(clip(a,id).gain,0);assert.equal(clip(a,id).fadeInMs,clip(p,id).fadeInMs);assert.equal(clip(a,id).fadeOutMs,clip(p,id).fadeOutMs);}
  const b=setVoiceMix(p,ids,{fadeInMs:0,fadeOutMs:0});
  for(const id of ids){assert.equal(clip(b,id).gain,clip(p,id).gain);assert.equal(clip(b,id).fadeInMs,0);assert.equal(clip(b,id).fadeOutMs,0);}
});

test('split source windows and manual narration scripts survive a batch mix',()=>{
  const p=splitClip(editProject(createSample(),q=>{findClip(q,ids[0]).clip.script='A manually corrected narration.';}),ids[0],2000);
  const selected=p.tracks.find(t=>t.kind==='voice').clips.filter(c=>c.sceneId==='overview').map(c=>c.id);
  const q=setVoiceMix(p,selected,{gain:2,fadeInMs:250,fadeOutMs:250});
  for(const id of selected)assert.deepEqual(withoutMix(clip(q,id)),withoutMix(clip(p,id)));
});

test('mix edits do not change caption word identities or motion timing links',()=>{
  let p=distributeCaptionWords(createSample(),'cc.overview.0');
  p=linkKeyframeToCaptionWord(p,'camera.overview','camera.to.overview',{captionId:'cc.overview.0',wordIndex:1});
  const q=setVoiceMix(p,ids,{gain:.8});
  assert.deepEqual(describeTimingLinks(q),describeTimingLinks(p));assert.deepEqual(q.tracks[3],p.tracks[3]);
  assert.equal(q.studioVersion,p.studioVersion);
});

test('fade sums are checked per destination including retained fades before any edit',()=>{
  const p=editProject(createSample(),q=>{const c=findClip(q,ids[1]).clip;Object.assign(c,{durationMs:500,fadeInMs:100,fadeOutMs:100});});
  const before=plain(p);
  for(const patch of [{fadeInMs:401},{fadeOutMs:401},{gain:.3,fadeInMs:300,fadeOutMs:201}])
    assert.throws(()=>setVoiceMix(p,ids,patch),error=>error.code==='VOICE_MIX_FADE_RANGE'&&/fit every selected clip/.test(error.message));
  const q=setVoiceMix(p,ids,{fadeInMs:300,fadeOutMs:200});assert.equal(clip(q,ids[1]).fadeInMs+clip(q,ids[1]).fadeOutMs,500);
  assert.deepEqual(plain(p),before);
});

test('mixed or locked groups fail atomically, including locked clips on a second voice track',()=>{
  const p=editProject(createSample(),q=>{const copy=plain(q.tracks.find(t=>t.kind==='voice'));copy.id='other.voice';copy.name='Other voice';
    copy.locked=true;copy.clips=copy.clips.slice(0,1);copy.clips[0].id='other.take';q.tracks.push(copy);});
  const before=plain(p);
  assert.throws(()=>setVoiceMix(p,[ids[0],'other.take'],{gain:.5}),error=>/locked/.test(error.message)&&error.code!=='VOICE_MIX_FADE_RANGE');
  for(const id of ['camera.overview','cc.overview.0','cursor.overview'])assert.throws(()=>setVoiceMix(p,[ids[0],id],{gain:.5}),/only voice/);
  assert.deepEqual(plain(p),before);
});

test('muted tracks remain muted and mix edits do not add a missing take',()=>{
  const p=editProject(createSample(),q=>{q.tracks[2].enabled=false;findClip(q,ids[0]).clip.assetId=null;});
  const q=setVoiceMix(p,ids,{gain:1.5});assert.equal(q.tracks[2].enabled,false);assert.equal(clip(q,ids[0]).assetId,null);
  assert.deepEqual(q.assets,p.assets);assert.throws(()=>planVoiceMix(q),/No audible/);
});

test('unsupported patches, nonfinite gains, fractional fades and malformed selections are refused',()=>{
  const p=createSample();
  for(const changes of [null,[],{},'gain',1,{gain:'0.5'},{gain:NaN},{gain:Infinity},{gain:-.01},{gain:2.01},
    {fadeInMs:-1},{fadeOutMs:1.1},{fadeInMs:180001},{gain:.5,script:'Do not write me'},{sourceInMs:12}])
    assert.throws(()=>setVoiceMix(p,ids,changes));
  for(const selection of [[],[ids[0],ids[0]],['missing'],[1],ids[0],Array(1501).fill(ids[0])])
    assert.throws(()=>setVoiceMix(p,selection,{gain:1}));
});

test('accessors and callbacks in untrusted mix data are rejected without executing them',()=>{
  let reads=0;const changes={};Object.defineProperty(changes,'gain',{enumerable:true,get(){reads++;return .5;}});
  assert.throws(()=>setVoiceMix(createSample(),ids,changes));assert.equal(reads,0);
  assert.throws(()=>setVoiceMix(createSample(),ids,{gain:()=>.5}));
});

test('the entire batch is one revision-checked undo; an identical repeat is a no-op',()=>{
  const p=createSample(),store=createProjectStore(p),q=setVoiceMix(p,ids,{gain:.75,fadeInMs:150});
  store.commit(q,'Batch voice mix',0);assert.equal(store.snapshot().revision,1);
  store.commit(setVoiceMix(q,ids,{gain:.75,fadeInMs:150}),'Repeat',1);assert.equal(store.snapshot().revision,1);
  assert.deepEqual(store.undo().project,p);assert.deepEqual(store.redo().project,q);
  assert.throws(()=>store.commit(p,'Old mix',0),/changed/);
});

test('WAV planning consumes the new envelopes; project round-trip preserves them',async()=>{
  const p=setVoiceMix(createSample(),ids,{gain:.5,fadeInMs:101,fadeOutMs:203}),plan=planVoiceMix(p);
  for(const id of ids){const c=plan.clips.find(c=>c.id===id);assert.equal(c.gain,.5);assert.equal(c.fadeInMs,101);assert.equal(c.fadeOutMs,203);}
  const text=await saveProjectBundle(p,{bytes(){throw Error('Sample bytes must remain host-owned');}});
  assert.deepEqual((await readProjectBundle(text)).project,p);
});
