import test from 'node:test';
import assert from 'node:assert/strict';
import {createEarthSample, createSample, createEvaluator, validateProject, sceneTimeline, exportSubtitles, parseSubtitles} from '../src/index.js';

const bounds={
  'earth.overview':{x:0,y:0,width:960,height:540},
  'earth.globe':{x:24,y:58,width:610,height:430},
  'earth.planet':{x:105.6,y:91.8,width:518.4,height:334.8},
  'earth.detail':{x:403.2,y:102.6,width:489.6,height:313.2},
  'earth.zoomIn':{x:566,y:320,width:79,height:36},
  'earth.zoomOut':{x:566,y:380,width:79,height:36},
  'earth.metric':{x:668,y:76,width:264,height:64},
  'earth.year':{x:668,y:156,width:264,height:54},
  'earth.region':{x:668,y:226,width:264,height:54},
  'earth.connections':{x:668,y:296,width:264,height:44},
  'earth.lighting':{x:668,y:356,width:264,height:44},
};

test('Earth is an independent caption-first eight-checkpoint project that round-trips',()=>{
  const project=createEarthSample();
  assert.equal(project.id,'earth-studio');
  assert.equal(project.scenes.length,8);
  assert.deepEqual(validateProject(JSON.stringify(project)).value,project);
  assert.ok(Object.isFrozen(project.tracks[0].clips[0].keys));
  assert.deepEqual(project.assets,[]);
  const voice=project.tracks.find(track=>track.kind==='voice');
  assert.ok(voice.clips.every(clip=>clip.assetId===null));
  assert.deepEqual(project.tracks.map(track=>track.kind),['camera','cursor','voice','captions']);
  assert.equal(createSample().id,'orbit-studio');
  assert.equal(createSample().scenes.length,3);
});

test('each Earth checkpoint points to the actual control its caption teaches',()=>{
  const project=createEarthSample(),cursor=project.tracks.find(track=>track.kind==='cursor');
  const expected=['earth.globe','earth.zoomIn','earth.zoomOut','earth.metric','earth.year','earth.region','earth.connections','earth.lighting'];
  for(const [index,scene] of project.scenes.entries()){
    const clip=cursor.clips.find(clip=>clip.sceneId===scene.id);
    assert.equal(clip.keys.find(key=>key.atMs===700).target,expected[index]);
    assert.equal(clip.keys.at(-1).target,'earth.planet','The pointer follows the camera back to the result.');
    const caption=project.tracks.find(track=>track.kind==='captions').clips.find(clip=>clip.sceneId===scene.id);
    assert.ok(caption.text.length>40);
    assert.equal(caption.durationMs,scene.durationMs);
    assert.equal(project.tracks.find(track=>track.kind==='voice').clips.find(clip=>clip.sceneId===scene.id).script,caption.text);
  }
});

test('all eight Earth clicks start after landing and follow exact presentation time',()=>{
  const project=createEarthSample(),evaluator=createEvaluator(project),cursor=project.tracks.find(track=>track.kind==='cursor');
  assert.equal(cursor.clips.flatMap(clip=>clip.gestures).length,8);
  for(const scene of sceneTimeline(project)){
    const clip=cursor.clips.find(clip=>clip.sceneId===scene.id),gesture=clip.gestures[0];
    assert.deepEqual(clip.gestures.map(value=>({...value})),[{id:'click.'+scene.id,atMs:1800,kind:'click'}]);
    const landing=clip.keys.find(key=>key.atMs===700),hold=clip.keys.find(key=>key.atMs===2600);
    assert.ok(landing.atMs<gesture.atMs&&hold.atMs>=gesture.atMs+700,'The pointer lands and holds for the full click feedback.');
    assert.equal(landing.target,hold.target);
    const sample=at=>evaluator.sample(scene.startMs+at,bounds).cursor;
    assert.deepEqual(sample(1799).gestures,[]);
    const start=sample(1800),target=bounds[landing.target];
    assert.deepEqual({x:start.x,y:start.y},{x:target.x+target.width/2,y:target.y+target.height/2});
    assert.deepEqual(start.gestures,[{...gesture,progress:0}]);
    const middle=sample(2150);
    assert.deepEqual(middle.gestures,[{...gesture,progress:.5}]);
    assert.deepEqual(sample(2500).gestures,[]);
    assert.deepEqual(sample(2150),middle,'Seeking back reconstructs the same click phase');
    assert.equal(evaluator.sample(scene.startMs+2150,bounds,undefined,{reducedMotion:true}).cursor,null);
  }
});

test('Earth camera and cursor remain continuous at every scene boundary',()=>{
  const project=createEarthSample(),evaluator=createEvaluator(project);
  for(const scene of sceneTimeline(project).slice(1)){
    const before=evaluator.sample(scene.startMs-.001,bounds);
    const after=evaluator.sample(scene.startMs,bounds);
    assert.deepEqual(after.camera,before.camera);
    assert.ok(Math.hypot(after.cursor.client.x-before.cursor.client.x,after.cursor.client.y-before.cursor.client.y)<.001);
  }
});

test('Earth camera has visible close-ups, result pans and a continuous zoom-in / zoom-out pair',()=>{
  const project=createEarthSample(),evaluator=createEvaluator(project),scenes=sceneTimeline(project);
  const sample=(index,time)=>evaluator.sample(scenes[index].startMs+time,bounds);
  assert.ok(sample(0,1800).camera.scale>1.4);
  assert.ok(sample(0,6800).camera.scale<1.05);
  assert.ok(sample(1,5000).camera.scale>sample(1,0).camera.scale*1.4);
  assert.deepEqual(sample(2,0).camera,sample(1,6999).camera);
  assert.ok(sample(2,5600).camera.scale<sample(2,0).camera.scale*.75);
  for(const index of [3,4,5,6,7]){
    const control=sample(index,1800),result=sample(index,4800);
    assert.ok(control.camera.scale>1.4);
    assert.ok(Math.abs(result.camera.x-control.camera.x)>200);
    assert.ok(Math.hypot(sample(index,700).cursor.client.x-sample(index,0).cursor.client.x,sample(index,700).cursor.client.y-sample(index,0).cursor.client.y)>10);
  }
  assert.ok(sample(7,6999).camera.scale<1.05);
});

test('Earth scrubbing is deterministic, reduced motion retains instructions, and missing controls fail',()=>{
  const evaluator=createEvaluator(createEarthSample()),times=[0,1000,8000,18000,30000,55999];
  const frames=times.map(at=>evaluator.sample(at,bounds));
  times.toReversed().forEach(at=>evaluator.sample(at,bounds));
  assert.deepEqual(times.map(at=>evaluator.sample(at,bounds)),frames);
  const reduced=evaluator.sample(32000,bounds,undefined,{reducedMotion:true});
  assert.equal(reduced.cursor,null);
  assert.ok(reduced.caption.text.includes('year'));
  const missing={...bounds};delete missing['earth.region'];
  assert.throws(()=>evaluator.sample(37000,missing),/unavailable/);
});

test('Earth captions export all eight instructions with the shared scene timing',()=>{
  const project=createEarthSample(),scenes=sceneTimeline(project);
  for(const format of ['vtt','srt']){
    const captions=parseSubtitles(exportSubtitles(project,{format}).text);
    assert.equal(captions.length,8);
    assert.deepEqual(captions.map(caption=>caption.startMs),scenes.map(scene=>scene.startMs));
    assert.equal(captions.at(-1).endMs,56000);
  }
});
