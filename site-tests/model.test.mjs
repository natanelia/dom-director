import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compile} from '../packages/core/src/compiler.js';
import {timeline,timecode,withEasing,createEarthTour} from '../site/model.mjs';
import {EARTH_CHECKPOINTS,createEarthSample} from '../packages/studio/src/sample.js';
const script=JSON.parse(fs.readFileSync(new URL('../site/orbit.tour.json',import.meta.url),'utf8'));
test('flagship uses the canonical grammar with one safe condition and no scripted effects',()=>{
  const result=compile(script);assert.equal(result.ok,true,JSON.stringify(result.diagnostics));
  assert.deepEqual(script.modes,['watch','try','guide']);const cues=script.scenes.flatMap(s=>s.cues);
  assert.equal(cues.filter(c=>c.kind==='gate').length,1);assert.equal(cues.filter(c=>c.kind==='action').length,0);
});
test('every scene has prepared narration captions and matching timing',()=>{
  for(const scene of script.scenes){assert.ok(script.assets[scene.narration.audioAsset]);assert.equal(scene.narration.cues[0].endMs,scene.durationMs);assert.equal(scene.narration.cues[0].text,scene.summary);}
});
test('each Orbit camera pan explicitly starts a neutral cursor journey to its actual destination',()=>{
  for(const scene of script.scenes){
    const camera=scene.cues.find(cue=>cue.kind==='camera');
    if(!camera.durationMs)continue;
    const travel=scene.cues.find(cue=>cue.id==='cursor.travel.'+scene.id);
    const arrival=scene.cues.find(cue=>cue.id==='cursor.'+scene.id);
    assert.ok(travel,scene.id+' must not wait until the camera settles to move its cursor');
    assert.deepEqual(travel,{id:'cursor.travel.'+scene.id,kind:'cursor',at:camera.at,
      durationMs:arrival?arrival.at-camera.at:camera.durationMs,
      target:arrival?.target||camera.target,gesture:'point'});
    assert.ok(travel.durationMs>0);
  }
});
test('new pointer travel preserves the original cue and real checkpoint timings',()=>{
  const originals=script.scenes.flatMap(scene=>scene.cues.filter(cue=>cue.id==='cursor.'+scene.id));
  assert.deepEqual(originals,[
    {id:'cursor.signal',kind:'cursor',at:900,durationMs:7308,target:'metrics',gesture:'point'},
    {id:'cursor.story',kind:'cursor',at:900,durationMs:6509,target:'routes',gesture:'point'},
    {id:'cursor.handoff',kind:'cursor',at:900,durationMs:6882,target:'approve',gesture:'point'},
    {id:'cursor.possibility',kind:'cursor',at:900,durationMs:6791,target:'approve',gesture:'point'},
  ]);
  const gate=script.scenes.flatMap(scene=>scene.cues).find(cue=>cue.id==='approval');
  assert.equal(gate.kind,'gate');assert.equal(gate.at,1700);
  assert.equal(gate.conditionRef,'orbit.approved');assert.equal(gate.timeoutMs,30000);
  assert.equal(gate.onTimeout,'pause');
});
test('global UI positions translate to bounded scene-local positions',()=>{
  const track=timeline(script);for(const scene of track.scenes){assert.deepEqual(track.locate(scene.startMs+100),{sceneId:scene.id,timeMs:100});assert.equal(track.position({sceneId:scene.id,timeMs:100}),scene.startMs+100);}
  assert.deepEqual(track.locate(-100),{sceneId:'overview',timeMs:0});assert.equal(track.locate(1e9).timeMs,script.scenes.at(-1).durationMs);
});
test('camera personality changes canonical defaults without mutating the source',()=>{
  const before=JSON.stringify(script);for(const value of ['gentle','overview','direct','instant'])assert.equal(compile(withEasing(script,value)).ok,true);
  assert.equal(JSON.stringify(script),before);assert.throws(()=>withEasing(script,'eval'));
});
test('time display is presentation-only with explicit millisecond formatting',()=>{
  assert.equal(timecode(1250),'00:01');assert.equal(timecode(1250,true),'00:01.250');assert.equal(timecode(-1),'00:00');
});
test('Earth compiles six real-control conditions without scripted effects or mismatched audio',()=>{
  const tour=createEarthTour(EARTH_CHECKPOINTS),result=compile(tour);
  assert.equal(result.ok,true,JSON.stringify(result.diagnostics));
  assert.deepEqual(tour.modes,['watch','try','guide']);
  assert.deepEqual(tour.assets,{});
  const cues=tour.scenes.flatMap(scene=>scene.cues),gates=cues.filter(cue=>cue.kind==='gate');
  assert.equal(gates.length,6);assert.equal(cues.filter(cue=>cue.kind==='action').length,0);
  assert.equal(new Set(gates.map(cue=>cue.conditionRef)).size,6);
  assert.deepEqual(tour.capabilities,[...gates.map(cue=>'condition:'+cue.conditionRef),'fixture:reset']);
  assert.ok(tour.scenes.every(scene=>!Object.hasOwn(scene.narration,'audioAsset')));
});
test('Earth live tutorial and Studio teach the same controls with the same captions and boundaries',()=>{
  const tour=createEarthTour(EARTH_CHECKPOINTS),sample=createEarthSample();
  assert.deepEqual(tour.scenes.map(({id,title,durationMs})=>[id,title,durationMs]),sample.scenes.map(({id,title,durationMs})=>[id,title,durationMs]));
  for(const [index,scene] of tour.scenes.entries()){
    const step=EARTH_CHECKPOINTS[index],gate=scene.cues.find(cue=>cue.kind==='gate'),cursor=scene.cues.find(cue=>cue.kind==='cursor');
    assert.equal(tour.targets[cursor.target].ref,step.target);
    assert.equal(gate.instruction,step.instruction);assert.equal(gate.conditionRef,scene.id);
    assert.ok(gate.at>0&&gate.at<scene.durationMs);
    assert.equal(scene.narration.cues[0].text,scene.summary);
    assert.equal(scene.narration.cues[0].endMs,scene.durationMs);
    assert.equal(scene.summary,sample.tracks.find(track=>track.kind==='captions').clips[index].text);
  }
});
test('Earth timeline locations and camera preferences remain pure presentation data',()=>{
  const tour=createEarthTour(EARTH_CHECKPOINTS),before=JSON.stringify(tour),track=timeline(tour);
  assert.equal(track.total,42000);
  for(const scene of track.scenes){
    assert.deepEqual(track.locate(scene.startMs+1800),{sceneId:scene.id,timeMs:1800});
    assert.equal(track.position({sceneId:scene.id,timeMs:1800}),scene.startMs+1800);
  }
  for(const value of ['gentle','direct','overview','instant'])assert.equal(compile(withEasing(tour,value)).ok,true);
  assert.equal(JSON.stringify(tour),before);
});
test('Earth moves its cursor immediately while preserving all original arrival and gate timings',()=>{
  const tour=createEarthTour(EARTH_CHECKPOINTS);
  for(const [index,scene] of tour.scenes.entries()){
    const target=EARTH_CHECKPOINTS[index].target.split('.')[1];
    assert.deepEqual(scene.cues.find(cue=>cue.id==='cursor.travel.'+scene.id),
      {id:'cursor.travel.'+scene.id,kind:'cursor',at:0,durationMs:700,target,gesture:'point'});
    assert.deepEqual(scene.cues.find(cue=>cue.id==='cursor.'+scene.id),
      {id:'cursor.'+scene.id,kind:'cursor',at:700,durationMs:6300,target,gesture:'point'});
    const camera=scene.cues.find(cue=>cue.kind==='camera'),gate=scene.cues.find(cue=>cue.kind==='gate');
    assert.equal(camera.at,0);assert.equal(camera.durationMs,index?1000:0);assert.equal(camera.target,'overview');
    assert.equal(gate.at,1800);assert.equal(gate.timeoutMs,60000);assert.equal(gate.conditionRef,scene.id);
    assert.equal(scene.cues.find(cue=>cue.kind==='highlight').at,700);
  }
});
