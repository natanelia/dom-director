import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compile} from '../packages/core/src/compiler.js';
import {timeline,timecode,withEasing} from '../site/model.mjs';
const script=JSON.parse(fs.readFileSync(new URL('../site/orbit.tour.json',import.meta.url),'utf8'));
test('flagship uses the canonical grammar with one safe condition and no scripted effects',()=>{
  const result=compile(script);assert.equal(result.ok,true,JSON.stringify(result.diagnostics));
  assert.deepEqual(script.modes,['watch','try','guide']);const cues=script.scenes.flatMap(s=>s.cues);
  assert.equal(cues.filter(c=>c.kind==='gate').length,1);assert.equal(cues.filter(c=>c.kind==='action').length,0);
});
test('every scene has prepared narration captions and matching timing',()=>{
  for(const scene of script.scenes){assert.ok(script.assets[scene.narration.audioAsset]);assert.equal(scene.narration.cues[0].endMs,scene.durationMs);assert.equal(scene.narration.cues[0].text,scene.summary);}
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
