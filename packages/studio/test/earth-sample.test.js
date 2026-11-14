import test from 'node:test';
import assert from 'node:assert/strict';
import {createEarthSample, createSample, createEvaluator, validateProject, sceneTimeline, exportSubtitles, parseSubtitles} from '../src/index.js';

const bounds={
  'earth.overview':{x:0,y:0,width:960,height:540},
  'earth.globe':{x:24,y:58,width:610,height:430},
  'earth.metric':{x:668,y:76,width:264,height:64},
  'earth.year':{x:668,y:156,width:264,height:54},
  'earth.region':{x:668,y:226,width:264,height:54},
  'earth.connections':{x:668,y:296,width:264,height:44},
  'earth.lighting':{x:668,y:356,width:264,height:44},
};

test('Earth is an independent caption-first six-checkpoint project that round-trips',()=>{
  const project=createEarthSample();
  assert.equal(project.id,'earth-studio');
  assert.equal(project.scenes.length,6);
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
  const expected=['earth.globe','earth.metric','earth.year','earth.region','earth.connections','earth.lighting'];
  for(const [index,scene] of project.scenes.entries()){
    const clip=cursor.clips.find(clip=>clip.sceneId===scene.id);
    assert.equal(clip.keys.at(-1).target,expected[index]);
    assert.deepEqual(clip.gestures,[],'The instructional pointer does not pretend to activate the app');
    const caption=project.tracks.find(track=>track.kind==='captions').clips.find(clip=>clip.sceneId===scene.id);
    assert.ok(caption.text.length>40);
    assert.equal(caption.durationMs,scene.durationMs);
    assert.equal(project.tracks.find(track=>track.kind==='voice').clips.find(clip=>clip.sceneId===scene.id).script,caption.text);
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

test('Earth scrubbing is deterministic, reduced motion retains instructions, and missing controls fail',()=>{
  const evaluator=createEvaluator(createEarthSample()),times=[0,1000,8000,18000,30000,41999];
  const frames=times.map(at=>evaluator.sample(at,bounds));
  times.toReversed().forEach(at=>evaluator.sample(at,bounds));
  assert.deepEqual(times.map(at=>evaluator.sample(at,bounds)),frames);
  const reduced=evaluator.sample(18000,bounds,undefined,{reducedMotion:true});
  assert.equal(reduced.cursor,null);
  assert.ok(reduced.caption.text.includes('year'));
  const missing={...bounds};delete missing['earth.region'];
  assert.throws(()=>evaluator.sample(23000,missing),/unavailable/);
});

test('Earth captions export all six instructions with the shared scene timing',()=>{
  const project=createEarthSample(),scenes=sceneTimeline(project);
  for(const format of ['vtt','srt']){
    const captions=parseSubtitles(exportSubtitles(project,{format}).text);
    assert.equal(captions.length,6);
    assert.deepEqual(captions.map(caption=>caption.startMs),scenes.map(scene=>scene.startMs));
    assert.equal(captions.at(-1).endMs,42000);
  }
});
