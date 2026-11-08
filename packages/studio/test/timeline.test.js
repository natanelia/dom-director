import test from 'node:test';
import assert from 'node:assert/strict';
import {createSample,editProject,findClip,trimClip,splitClip,createProjectStore} from '../src/index.js';
import {createTimelineSnapper,moveTimelineKeyframe} from '../src/editing.js';
const clone=p=>JSON.parse(JSON.stringify(p));
const snapper=(p,options={})=>createTimelineSnapper(p,{clipId:'camera.overview',keyId:'camera.to.overview',operation:'keyframe',pixelsPerSecond:100,...options});

test('keyframes magnetically align with exact caption boundaries, not a rounded grid',()=>{
  const p=createSample(),before=clone(p),s=snapper(p),result=s.snap(2440);
  assert.equal(result.deltaMs,2490);assert.equal(result.guide.timeMs,3490);
  assert.equal(result.guide.kind,'clip');assert.equal(result.guide.edge,'keyframe');
  assert.deepEqual(clone(p),before);assert.ok(Object.isFrozen(s));
});
test('snap distance uses CSS pixels consistently at different time zoom levels',()=>{
  for(const pixelsPerSecond of [20,42,180]){
    const s=snapper(createSample(),{pixelsPerSecond});
    assert.equal(s.snap(2490+7/pixelsPerSecond*1000).guide.timeMs,3490);
  }
  const s=snapper(createSample(),{pixelsPerSecond:180});
  assert.equal(s.snap(2490+9/180*1000).guide,null);
});
test('exact playhead wins an equal-distance guide; a nearer clip still wins',()=>{
  const s=snapper(createSample(),{playheadMs:3490});
  assert.equal(s.snap(2470).guide.kind,'playhead');
  assert.equal(snapper(createSample(),{playheadMs:3520}).snap(2490).guide.kind,'clip');
});
test('movement tests both clip edges while trims only consider the chosen edge',()=>{
  const p=trimClip(createSample(),'cc.overview.0',0,2000);
  const s=snapper(p,{clipId:'cc.overview.0',keyId:undefined,operation:'move'});
  const r=s.snap(1440);assert.equal(r.deltaMs,1490);assert.equal(r.guide.edge,'end');
  assert.equal(snapper(p,{clipId:'cc.overview.0',operation:'trim-end'}).snap(1440).deltaMs,1490);
  assert.equal(snapper(p,{clipId:'cc.overview.0',operation:'trim-start'}).snap(1440).guide,null);
});
test('bypass skips magnets and the 100ms relative grid, preserving millisecond precision',()=>{
  const s=snapper(createSample());
  assert.deepEqual(s.snap(2443.4,{bypass:true}),{deltaMs:2443,guide:null});
  assert.deepEqual(s.snap(711),{deltaMs:700,guide:null});
  assert.deepEqual(s.snap(-0.1,{bypass:true}),{deltaMs:0,guide:null});
});
test('off-window source keys and hidden tracks do not become magnets',()=>{
  let p=trimClip(createSample(),'cursor.overview',3000,6980);
  // The cursor key at source 2500 is outside the visible clip.
  assert.equal(snapper(p).snap(1510).guide,null);
  p=editProject(p,d=>{d.tracks.find(t=>t.kind==='captions').enabled=false;});
  assert.equal(snapper(p).snap(2470).guide,null);
});
test('visible locked tracks remain useful magnetic references',()=>{
  const p=editProject(createSample(),d=>{d.tracks.find(t=>t.kind==='captions').locked=true;});
  assert.equal(snapper(p).snap(2470).guide.timeMs,3490);
});
test('ripple followers are excluded from stationary anchors',()=>{
  const p=editProject(createSample(),d=>{
    d.scenes=d.scenes.slice(0,1);for(const t of d.tracks){t.clips=[];t.enabled=t.kind==='captions';}
    d.tracks.find(t=>t.kind==='captions').clips=[{id:'first',sceneId:'overview',startMs:0,durationMs:1000,text:'First'},
      {id:'second',sceneId:'overview',startMs:2000,durationMs:1000,text:'Second'}];
  });
  const options={clipId:'first',operation:'move',ripple:true};
  assert.equal(snapper(p,options).snap(950).guide,null);
  assert.equal(snapper(p,{...options,ripple:false}).snap(950).guide.timeMs,2000);
});
test('later scenes convert between project time and clip-local source time',()=>{
  const s=snapper(createSample(),{clipId:'camera.signal',keyId:'camera.to.signal',playheadMs:10001});
  const r=s.snap(1400);assert.equal(r.guide.timeMs,10001);assert.equal(r.deltaMs,1421);
  const p=moveTimelineKeyframe(createSample(),'camera.signal','camera.to.signal',3021);
  assert.equal(findClip(p,'camera.signal').clip.keys[1].atMs,3021);
});
test('one key time edit preserves appearance, coordinates, voice, captions and stable identities',()=>{
  const p=createSample(),q=moveTimelineKeyframe(p,'camera.overview','camera.to.overview',3490),before=clone(p);
  before.tracks[0].clips[0].keys[1].atMs=3490;assert.deepEqual(clone(q),before);
  const store=createProjectStore(p);store.commit(q,'Move key');assert.equal(store.snapshot().revision,1);
  store.undo();assert.deepEqual(store.snapshot().project,p);store.redo();assert.deepEqual(store.snapshot().project,q);
});
test('trimmed and split clips retain their source window and off-window keys',()=>{
  const p=splitClip(createSample(),'cursor.overview',2000),right=p.tracks[1].clips.at(-1);
  const key=right.keys.find(k=>k.atMs===2500),q=moveTimelineKeyframe(p,right.id,key.id,1200),edited=findClip(q,right.id).clip;
  assert.equal(edited.offsetMs,2000);assert.equal(edited.keys.find(k=>k.id===key.id).atMs,3200);
  assert.deepEqual(edited.keys[0],right.keys[0]);assert.deepEqual(edited.gestures,right.gestures);
  assert.deepEqual(findClip(q,'cursor.overview').clip,findClip(p,'cursor.overview').clip);
});
test('reject out-of-clip, fractional, duplicate, locked and hidden-source edits without mutation',()=>{
  const p=createSample(),before=clone(p);
  for(const at of [-1,6981,.5,NaN,Infinity,0])assert.throws(()=>moveTimelineKeyframe(p,'camera.overview','camera.to.overview',at));
  assert.throws(()=>moveTimelineKeyframe(p,'cc.overview.0','camera.to.overview',100));
  const locked=editProject(p,d=>{d.tracks[0].locked=true;});
  assert.throws(()=>moveTimelineKeyframe(locked,'camera.overview','camera.to.overview',1400));
  const cut=trimClip(p,'camera.overview',2000,6980);
  assert.throws(()=>moveTimelineKeyframe(cut,'camera.overview','camera.to.overview',200));
  assert.deepEqual(clone(p),before);
});
test('snapper rejects invalid options and unbounded pointer values',()=>{
  for(const options of [{pixelsPerSecond:0},{pixelsPerSecond:Infinity},{tolerancePx:33},{gridMs:.5},
    {operation:'wrong'},{playheadMs:-1},{playheadMs:Infinity},{keyId:'missing'},{ripple:'yes'}])
    assert.throws(()=>snapper(createSample(),options));
  const s=snapper(createSample());for(const delta of [NaN,Infinity,'10'])assert.throws(()=>s.snap(delta));
  assert.throws(()=>s.snap(0,{bypass:1}));
});
test('dense input tie-breaking is deterministic and generated deltas remain pure',()=>{
  const p=createSample(),before=JSON.stringify(p),s=snapper(p);
  let seed=7;for(let i=0;i<250;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const delta=seed%9000-2000;
    const a=s.snap(delta),b=snapper(p).snap(delta);assert.deepEqual(a,b);assert.ok(Number.isInteger(a.deltaMs));
    if(a.guide)assert.ok(Math.abs(a.deltaMs-delta)*.1<=8+1e-7);
  }
  assert.equal(JSON.stringify(p),before);
});
