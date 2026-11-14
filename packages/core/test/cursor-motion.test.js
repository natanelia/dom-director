import test from 'node:test';
import assert from 'node:assert/strict';
import {IDENTITY} from '../src/geometry.js';
import {cursorTargets,sampleCursor,cursorPosition,cursorAnchor} from '../src/cursor-motion.js';

const box={x:0,y:0,width:800,height:600},origin={x:30,y:50};
const bounds={a:{space:'scene',rect:{x:20,y:40,width:40,height:20}},b:{space:'scene',rect:{x:600,y:400,width:80,height:40}},c:{space:'client',rect:{x:200,y:100,width:20,height:30}}};
const cue=(id,target,atMs,durationMs=1200,extra={})=>({id,target,kind:'cursor',gesture:'point',atMs,durationMs,endMs:atMs+durationMs,...extra});
const scene={cues:[cue('first','a',0),cue('second','b',1200)]};
const position=(s,time,options={},camera=IDENTITY,data=bounds)=>cursorPosition(sampleCursor(s,time,data,options),camera,origin,box);

test('adjacent pointer cues depart from the previous destination without a center jump',()=>{
  const end=position(scene,1199),start=position(scene,1200),middle=position(scene,1500),finish=position(scene,1800);
  assert.deepEqual(start,end);assert.deepEqual(start,{x:70,y:100});
  assert.deepEqual(middle,{x:370,y:285});assert.deepEqual(finish,{x:670,y:470});
  assert.ok(position(scene,1210).x-start.x<.02,'departure eases in');
  assert.ok(finish.x-position(scene,1790).x<.02,'arrival eases out');
});

test('direct and shuffled seeks use authored cue times, never the last rendered position',()=>{
  const times=[0,150,600,1199,1200,1250,1500,1800,2399,2400];
  const expected=times.map(time=>position(scene,time));
  for(const time of times.toReversed())position(scene,time);
  assert.deepEqual(times.map(time=>position(scene,time)),expected);
  assert.deepEqual(position(scene,2400),position(scene,2399),'the neutral pointer survives the end of its cue');
  assert.equal(sampleCursor(scene,2400,bounds).cue,null,'the ended gesture does not carry into the gap');
});

test('only the needed predecessor is measured during travel and old sources can disappear after arrival',()=>{
  const three={cues:[...scene.cues,cue('third','c',2400)]};
  assert.deepEqual(cursorTargets(three,2399),['b']);
  assert.deepEqual(cursorTargets(three,2500),['c','b']);
  assert.deepEqual(cursorTargets(three,3000),['c']);
  assert.deepEqual(cursorTargets(three,4000),['c']);
  assert.deepEqual(position(three,3000,{},IDENTITY,{c:bounds.c}),{x:210,y:115});
  assert.throws(()=>position(three,2500,{},IDENTITY,{c:bounds.c}),error=>error.diagnostic.code==='TARGET_MISSING');
});

test('the completed endpoint carries across scenes even though its overlay has ended',()=>{
  const first={cues:[cue('first','a',0)]},second={cues:[cue('second','b',0)]};
  const terminal=sampleCursor(first,1200,bounds);assert.equal(terminal.cue,null);
  const data={b:bounds.b};
  assert.deepEqual(position(second,0,{initial:terminal.endpoint},IDENTITY,data),position(first,1199));
  assert.deepEqual(position(second,300,{initial:terminal.endpoint},IDENTITY,data),{x:370,y:285});
  const empty=sampleCursor({cues:[]},500,{}, {initial:terminal.endpoint});
  assert.deepEqual(empty.endpoint,terminal.endpoint);
  assert.deepEqual(cursorPosition(empty,IDENTITY,origin,box),position(first,1199));
});

test('gaps keep a neutral pointer while an initial scene without any pointer stays empty',()=>{
  const delayed={cues:[cue('later','b',900)]};
  assert.equal(position(delayed,899),null);
  assert.equal(cursorPosition(sampleCursor({cues:[]},0,{}),IDENTITY,origin,box),null);
  for(const time of [0,300,899]){
    const held=sampleCursor(delayed,time,{}, {initial:bounds.a});
    assert.equal(held.cue,null);assert.deepEqual(cursorPosition(held,IDENTITY,origin,box),{x:70,y:100});
  }
  assert.equal(position(delayed,300,{initial:bounds.a,reduced:true}),null);
});

test('the outgoing anchor retains the visible point and eases from it during the next pan',()=>{
  const offscreen={space:'scene',rect:{x:-5000,y:5000,width:20,height:20}};
  const anchor=cursorAnchor(offscreen,IDENTITY,box);
  assert.equal(anchor.space,'viewport');
  assert.equal(anchor.rect.x+anchor.rect.width/2,8);
  assert.equal(anchor.rect.y+anchor.rect.height/2,552);
  const delayed={cues:[cue('next','b',900)]},camera={x:-500,y:-300,scale:1};
  const options={initial:anchor};
  assert.deepEqual(position(delayed,899,options,camera),{x:38,y:602});
  assert.deepEqual(position(delayed,900,options,camera),{x:38,y:602});
  assert.deepEqual(position(delayed,1050,options,camera),{x:46.25,y:575},'the pointer starts easing immediately instead of sticking at an edge');
  assert.deepEqual(position(delayed,1200,options,camera),{x:104,y:386});
  assert.deepEqual(position(delayed,1500,options,camera),{x:170,y:170},'arrival matches the visible target');
  assert.equal(cursorAnchor(bounds.c,camera,box),bounds.c,'client coordinates remain host-owned');
});

test('ordinary endpoints are bounded before easing, avoiding offscreen stalls and sudden edge arrivals',()=>{
  const far={space:'scene',rect:{x:10000,y:2000,width:20,height:20}},data={...bounds,far};
  const target={cues:[cue('far','far',0)]};
  assert.deepEqual(position(target,0,{},IDENTITY,data),{x:430,y:350});
  assert.deepEqual(position(target,150,{},IDENTITY,data),{x:452,y:365.75});
  assert.deepEqual(position(target,300,{},IDENTITY,data),{x:606,y:476});
  assert.deepEqual(position(target,600,{},IDENTITY,data),{x:782,y:602});
});

test('viewport bounds do not rewrite an explicit drag or client-space target',()=>{
  const far={space:'scene',rect:{x:10000,y:2000,width:20,height:20}},data={...bounds,far,client:{...far,space:'client'}};
  const drag={cues:[cue('drag','far',0,1200,{gesture:'drag',fromTarget:'a'})]};
  assert.deepEqual(position(drag,600,{},IDENTITY,data),{x:5055,y:1080});
  const client={cues:[cue('client','client',0)]};
  assert.deepEqual(position(client,600,{},IDENTITY,data),{x:10010,y:2010});
});

test('sources project with the current camera while client-space sources stay fixed',()=>{
  const camera={x:-20,y:10,scale:2};
  assert.deepEqual(position(scene,1200,{},camera),{x:90,y:160});
  const third={cues:[cue('third','a',0)]};
  assert.deepEqual(position(third,0,{initial:bounds.c},camera),{x:210,y:115});
});

test('the first cue keeps its viewport-center entrance and defaults can request direct motion',()=>{
  assert.deepEqual(position(scene,0),{x:430,y:350});
  assert.deepEqual(position(scene,1500,{preset:'direct'}),{x:370,y:285});
  assert.equal(position(scene,1350,{preset:'direct'}).x,220);
});

test('explicit drag sources override preceding cursor targets and keep the whole authored duration',()=>{
  const drag={cues:[cue('first','a',0),cue('drag','b',1200,1200,{gesture:'drag',fromTarget:'c'})]};
  assert.deepEqual(cursorTargets(drag,1200),['b','c']);
  assert.deepEqual(position(drag,1200),{x:210,y:115});
  assert.deepEqual(position(drag,1800),{x:440,y:292.5});
  assert.throws(()=>position(drag,1200,{},IDENTITY,{a:bounds.a,b:bounds.b}),error=>error.diagnostic.code==='TARGET_MISSING');
});

test('retained endpoints contain only numeric geometry, without host element references',()=>{
  const element={},data={a:{...bounds.a,element,revision:5}};
  const state=sampleCursor({cues:[cue('first','a',0)]},1200,data);
  assert.deepEqual(state.endpoint,bounds.a);assert.notEqual(state.endpoint.rect,bounds.a.rect);
});
