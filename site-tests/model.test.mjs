import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compile} from '../packages/core/src/compiler.js';
import {sampleVisual} from '../packages/core/src/visual.js';
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
test('Earth compiles eight approved demo actions including zoom and preserves all real-control conditions',()=>{
  const tour=createEarthTour(EARTH_CHECKPOINTS),result=compile(tour);
  assert.equal(result.ok,true,JSON.stringify(result.diagnostics));
  assert.deepEqual(tour.modes,['watch','try','guide']);
  assert.deepEqual(tour.assets,{});
  const cues=tour.scenes.flatMap(scene=>scene.cues),gates=cues.filter(cue=>cue.kind==='gate'),actions=cues.filter(cue=>cue.kind==='action');
  assert.equal(gates.length,8);assert.equal(actions.length,8);
  assert.equal(new Set(gates.map(cue=>cue.conditionRef)).size,8);
  assert.deepEqual(tour.scenes.slice(1,3).map(scene=>scene.id),['earth.zoom-in','earth.zoom-out']);
  assert.deepEqual(tour.capabilities,[...gates.flatMap(cue=>['action:'+cue.conditionRef,'condition:'+cue.conditionRef]),'fixture:reset']);
  for(const scene of tour.scenes){
    const action=scene.cues.find(cue=>cue.kind==='action'),gate=scene.cues.find(cue=>cue.kind==='gate');
    assert.equal(action.actionRef,gate.conditionRef);assert.deepEqual(action.args,{});
    assert.equal(action.at,gate.at);assert.ok(scene.cues.indexOf(action)<scene.cues.indexOf(gate));
    assert.equal(action.timeoutMs,5000);
  }
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
    const action=scene.cues.find(cue=>cue.kind==='action'),gesture=sample.tracks.find(track=>track.kind==='cursor').clips[index].gestures[0];
    assert.equal(action.at,gesture.atMs);assert.equal(gesture.kind,'click');
    assert.ok(cursor.at+cursor.durationMs<=action.at,'The public pointer lands before the demonstration.');
  }
});
test('Earth timeline locations and camera preferences remain pure presentation data',()=>{
  const tour=createEarthTour(EARTH_CHECKPOINTS),before=JSON.stringify(tour),track=timeline(tour);
  assert.equal(track.total,56000);
  for(const scene of track.scenes){
    assert.deepEqual(track.locate(scene.startMs+1800),{sceneId:scene.id,timeMs:1800});
    assert.equal(track.position({sceneId:scene.id,timeMs:1800}),scene.startMs+1800);
  }
  for(const value of ['gentle','direct','overview','instant'])assert.equal(compile(withEasing(tour,value)).ok,true);
  assert.equal(JSON.stringify(tour),before);
});
test('Earth moves its cursor with the camera and keeps the real control visible through each click and gate',()=>{
  const tour=createEarthTour(EARTH_CHECKPOINTS);
  for(const [index,scene] of tour.scenes.entries()){
    const target=EARTH_CHECKPOINTS[index].target.split('.')[1];
    assert.deepEqual(scene.cues.find(cue=>cue.id==='cursor.travel.'+scene.id),
      {id:'cursor.travel.'+scene.id,kind:'cursor',at:0,durationMs:700,target,gesture:'point'});
    assert.deepEqual(scene.cues.find(cue=>cue.id==='cursor.'+scene.id),
      {id:'cursor.'+scene.id,kind:'cursor',at:700,durationMs:1900,target,gesture:'point'});
    const camera=scene.cues.find(cue=>cue.kind==='camera'),gate=scene.cues.find(cue=>cue.kind==='gate');
    assert.equal(camera.at,0);assert.ok(camera.durationMs>=1400);
    assert.equal(gate.at,1800);assert.equal(gate.timeoutMs,60000);assert.equal(gate.conditionRef,scene.id);
    assert.equal(scene.cues.find(cue=>cue.kind==='highlight').at,700);
    const reveal=scene.cues.find(cue=>cue.id==='cursor.result.'+scene.id);
    assert.equal(reveal.at,2600);assert.equal(reveal.target,'planet');
    assert.equal(reveal.at+reveal.durationMs,scene.durationMs);
  }
});

test('Earth authored geometry actually zooms in, travels to the result, and pulls back',()=>{
  const result=compile(createEarthTour(EARTH_CHECKPOINTS));assert.equal(result.ok,true);
  const bounds=Object.fromEntries(Object.entries({
    overview:{x:0,y:0,width:960,height:540},globe:{x:18,y:69,width:650,height:425},globeFrame:{x:18,y:69,width:650,height:425},
    planet:{x:105.6,y:91.8,width:518.4,height:334.8},detail:{x:403.2,y:102.6,width:489.6,height:313.2},
    zoomIn:{x:566,y:320,width:79,height:36},zoomOut:{x:566,y:380,width:79,height:36},
    metric:{x:702,y:118,width:226,height:64},year:{x:702,y:197,width:226,height:54},
    region:{x:702,y:266,width:226,height:54},connections:{x:702,y:335,width:226,height:24},lighting:{x:702,y:374,width:226,height:24},
  }).map(([id,rect])=>[id,{rect,space:'scene'}]));
  const safe={x:0,y:0,width:960,height:540},frames=new Map();
  let initial={x:0,y:0,scale:1};
  for(const step of EARTH_CHECKPOINTS){
    const scene=result.plan.scenes[step.id],sample=time=>sampleVisual(scene,time,bounds,safe,{initial}).camera;
    const start=sample(0),mid=sample(700),control=sample(1800),reveal=sample(4800),end=sample(7000);
    assert.deepEqual(start,initial,'Scenes must inherit the preceding shot instead of snapping.');
    assert.ok(Object.values(mid).every(Number.isFinite));
    if(step.control!=='zoomOut')assert.ok(Math.hypot(mid.x-start.x,mid.y-start.y)>2,'The initial camera pan must have moved while the cursor is travelling.');
    if(['metric','year','region','connections','night'].includes(step.control)){
      assert.ok(control.scale>1.4,'Controls should be a real close-up.');
      assert.ok(Math.abs(reveal.x-control.x)>200,'Show the globe result after demonstrating the control.');
    }
    frames.set(step.control,{start,control,reveal,end});initial=end;
  }
  assert.ok(frames.get('orbit').control.scale>1.4);
  assert.ok(frames.get('orbit').end.scale<1.05);
  assert.ok(frames.get('zoomIn').end.scale>frames.get('zoomIn').start.scale*1.4);
  assert.deepEqual(frames.get('zoomOut').start,frames.get('zoomIn').end);
  assert.ok(frames.get('zoomOut').end.scale<frames.get('zoomOut').start.scale*.75);
  assert.ok(frames.get('night').end.scale<1.05,'Finish on the entire live application.');
  const reduced=sampleVisual(result.plan.scenes['earth.metric'],1800,bounds,safe,{reduced:true});
  assert.deepEqual(reduced.camera,{x:0,y:0,scale:1});
  assert.ok(reduced.overlays.every(cue=>cue.kind!=='cursor'));
});

test('portrait Earth shots fill the aperture and keep zoom and practice controls reachable',()=>{
  const result=compile(createEarthTour(EARTH_CHECKPOINTS));assert.equal(result.ok,true);
  const width=350,height=900,safe={x:0,y:0,width,height};
  const bounds=Object.fromEntries(Object.entries({
    overview:{x:0,y:0,width,height},globe:{x:12,y:66,width:326,height:355},
    planet:{x:width*.28,y:height*.13,width:width*.44,height:height*.27},
    globeFrame:{x:width*.48,y:height*.13,width:width*.44,height:height*.27},
    detail:{x:24,y:24,width:width-48,height:height-48},
    zoomIn:{x:247,y:203,width:76,height:40},zoomOut:{x:247,y:267,width:76,height:40},
    metric:{x:27,y:475,width:296,height:80},year:{x:27,y:585,width:142,height:80},
    region:{x:181,y:585,width:142,height:80},connections:{x:27,y:675,width:142,height:40},lighting:{x:181,y:675,width:142,height:40},
  }).map(([id,rect])=>[id,{rect,space:'scene'}]));
  const covers=(pose,label)=>{
    assert.ok(pose.x<=.001&&pose.y<=.001,label+' must not expose empty space above or left of the scene.');
    assert.ok(pose.x+width*pose.scale>=width-.001&&pose.y+height*pose.scale>=height-.001,label+' must not expose empty space below or right of the scene.');
  };
  let initial={x:0,y:0,scale:1};
  for(const step of EARTH_CHECKPOINTS){
    const scene=result.plan.scenes[step.id],sample=time=>sampleVisual(scene,time,bounds,safe,{initial}).camera;
    for(const shot of step.shots)covers(sample(shot.atMs+shot.durationMs),step.id+' '+shot.target);
    const control=sample(1800),target=bounds[step.target.split('.')[1]].rect;
    if(step.control==='orbit')assert.ok(control.scale>1.8,'The portrait globe shot must visibly zoom in.');
    if(['zoomIn','zoomOut'].includes(step.control)){
      assert.ok(control.scale>1.8);
      assert.ok(control.x+target.x*control.scale>=0&&control.y+target.y*control.scale>=0);
      assert.ok(control.x+(target.x+target.width)*control.scale<=width&&control.y+(target.y+target.height)*control.scale<=height,'The complete actual zoom button must fit inside the shot.');
    }else if(step.control!=='orbit'){
      assert.deepEqual(control,{x:0,y:0,scale:1},'Practice controls retain their native overview instead of centering a lower card into blank space.');
    }
    initial=sample(7000);
  }
});
