const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../src/model.js');
const data=require('../assets/cues.json');
const scenes=data.scenes;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('all easing endpoints and monotonicity',()=>{
 for(const kind of ['cinematic','gentle','linear']){close(M.easing(0,kind),0);close(M.easing(1,kind),1);let previous=0;
  for(let i=0;i<=1000;i++){const p=M.easing(i/1000,kind);assert.ok(p>=previous);previous=p;}}
});
test('camera fit keeps target visible while respecting scene edges',()=>{
 const rect={x:880,y:145,width:211,height:333};
 for(const view of [{width:1160,height:620},{width:350,height:360}]){
  const projected=M.project(rect,M.fit(rect,view,1.85));
  assert.ok(projected.x>=0);assert.ok(projected.y>=0);
  assert.ok(projected.x+projected.width<=view.width+1e-8);
  assert.ok(projected.y+projected.height<=view.height+1e-8);
 }
});
test('fit rejects missing and zero-size targets',()=>{
 for(const rect of [null,{width:0,height:2},{width:2,height:0}])assert.throws(()=>M.fit(rect,{width:400,height:400}));
});
test('overview matches scene for desktop and reduces without motion',()=>{
 const p=M.overview({width:1120,height:600});assert.deepEqual(p,{x:0,y:0,scale:1});
 const mobile=M.overview({width:350,height:360},true);close(mobile.scale,350/1120);
});
test('scene lookup at boundaries',()=>{
 scenes.forEach((s,i)=>{assert.equal(M.sceneAt(scenes,s.startMs),i);if(i)assert.equal(M.sceneAt(scenes,s.startMs-1),i-1);});
 assert.equal(M.sceneAt(scenes,data.durationMs),scenes.length-1);
});
test('seeking never creates approval; gates clamp both Try and Guide',()=>{
 for(const mode of ['try','guide'])assert.equal(M.seekLimit(data.durationMs,scenes,mode,false),scenes[3].startMs+1700);
 assert.equal(M.seekLimit(data.durationMs,scenes,'watch',false),data.durationMs);
 assert.equal(M.seekLimit(data.durationMs,scenes,'try',true),data.durationMs);
});
test('visual sampling is deterministic and reduced motion stays still',()=>{
 const rects=Object.fromEntries(['routes','metrics','review','approve'].map((x,i)=>[x,{x:i*130,y:100,width:200,height:200}]));
 const view={width:1120,height:600};
 for(const s of scenes){const time=s.startMs+1000;
 assert.deepEqual(M.sample(scenes,time,rects,view,false,'cinematic'),M.sample(scenes,time,rects,view,false,'cinematic'));
 assert.deepEqual(M.sample(scenes,time,rects,view,true,'cinematic').pose,M.overview(view,true));}
});
test('sampling is continuous at chapter boundary',()=>{
 const rects=Object.fromEntries(['routes','metrics','review','approve'].map(x=>[x,{x:400,y:100,width:200,height:200}]));
 const view={width:1120,height:600};
 for(let i=1;i<scenes.length;i++){
  const a=M.sample(scenes,scenes[i].startMs-1,rects,view,false,'cinematic').pose;
  const b=M.sample(scenes,scenes[i].startMs,rects,view,false,'cinematic').pose;
  assert.deepEqual(a,b);
 }
});
test('cue data is contiguous within one millisecond rounding',()=>{
 assert.equal(scenes[0].startMs,0);
 for(let i=1;i<scenes.length;i++)assert.ok(Math.abs(scenes[i-1].startMs+scenes[i-1].durationMs-scenes[i].startMs)<=1);
 assert.ok(Math.abs(scenes.at(-1).startMs+scenes.at(-1).durationMs-data.durationMs)<=1);
});
test('time formatting',()=>{assert.equal(M.formatTime(65789),'01:05');assert.equal(M.formatTime(65789,true),'01:05.789');assert.equal(M.formatTime(-3),'00:00');});
