import test from 'node:test';
import assert from 'node:assert/strict';
import {createSample,createEvaluator,editProject,sceneTimeline,splitClip,trimClip} from '../src/index.js';

const bounds={
  'orbit.overview':{x:0,y:0,width:960,height:540},
  'orbit.metrics':{x:70,y:60,width:350,height:130},
  'orbit.map':{x:70,y:240,width:500,height:260},
};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const center=target=>({x:bounds[target].x+bounds[target].width/2,y:bounds[target].y+bounds[target].height/2});

test('the sample carries cursor and camera positions through every scene boundary',()=>{
  const project=createSample(),evaluator=createEvaluator(project);
  for(const scene of sceneTimeline(project).slice(1)){
    const before=evaluator.sample(scene.startMs-1,bounds),at=evaluator.sample(scene.startMs,bounds),after=evaluator.sample(scene.startMs+1,bounds);
    assert.equal(at.sceneId,scene.id);
    assert.deepEqual(at.camera,before.camera,'The camera must not displace the cursor at a scene boundary.');
    assert.deepEqual({x:at.cursor.x,y:at.cursor.y},{x:before.cursor.x,y:before.cursor.y});
    assert.deepEqual(at.cursor.client,before.cursor.client);
    assert.ok(distance(after.cursor.client,at.cursor.client)<.001,'Motion must begin at the previous checkpoint.');
  }
});

test('sample cursor transitions travel through intermediate positions and seek deterministically',()=>{
  const project=createSample(),evaluator=createEvaluator(project);
  for(const scene of sceneTimeline(project).slice(1)){
    const clip=project.tracks.find(track=>track.kind==='cursor').clips.find(c=>c.sceneId===scene.id);
    const start=evaluator.sample(scene.startMs,bounds),middle=evaluator.sample(scene.startMs+1200,bounds),end=evaluator.sample(scene.startMs+2500,bounds);
    assert.ok(distance(start.cursor,middle.cursor)>1);
    assert.ok(distance(middle.cursor,end.cursor)>1);
    assert.deepEqual({x:end.cursor.x,y:end.cursor.y},center(clip.keys.at(-1).target));
    evaluator.sample(0,bounds);
    evaluator.sample(evaluator.durationMs,bounds);
    assert.deepEqual(evaluator.sample(scene.startMs+1200,bounds),middle);
  }
});

test('splitting or trimming during cursor travel preserves the original path and easing',()=>{
  const project=createSample(),original=createEvaluator(project),scene=sceneTimeline(project)[1];
  for(const edited of [splitClip(project,'cursor.signal',1000),trimClip(project,'cursor.signal',700,scene.durationMs)]){
    const evaluator=createEvaluator(edited);
    for(const localTime of [700,999,1000,1001,1250,2000,2500]){
      const expected=original.sample(scene.startMs+localTime,bounds),actual=evaluator.sample(scene.startMs+localTime,bounds);
      assert.deepEqual(actual.cursor.client,expected.cursor.client);
      assert.deepEqual(actual.camera,expected.camera);
    }
  }
});

test('authored cursor starts, intentional cuts and reduced motion remain explicit',()=>{
  const project=editProject(createSample(),draft=>{
    const clip=draft.tracks.find(track=>track.kind==='cursor').clips[1];
    Object.assign(clip.keys[0],{target:'orbit.map',x:37,y:-19});
    clip.keys[1].easing='instant';
  });
  const evaluator=createEvaluator(project),scene=sceneTimeline(project)[1],start=evaluator.sample(scene.startMs,bounds);
  const source=center('orbit.map'),destination=center('orbit.metrics');
  assert.deepEqual({x:start.cursor.x,y:start.cursor.y},{x:source.x+37,y:source.y-19});
  const cut=evaluator.sample(scene.startMs+1,bounds);
  assert.deepEqual({x:cut.cursor.x,y:cut.cursor.y},destination);
  const reduced=evaluator.sample(scene.startMs+1200,bounds,undefined,{reducedMotion:true});
  assert.equal(reduced.cursor,null);
  assert.ok(reduced.caption);
});
