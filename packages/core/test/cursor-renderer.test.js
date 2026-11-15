import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderer} from '../src/renderer.js';
import {createTargetRegistry} from '../src/targets.js';

const cue=(id,target,atMs=0,durationMs=600,extra={})=>({id,target,kind:'cursor',gesture:'point',atMs,durationMs,endMs:atMs+durationMs,...extra});
const pan=(id,target,durationMs=1200)=>({id,target,kind:'camera',atMs:0,durationMs,endMs:durationMs,minScale:.1,maxScale:3,paddingPx:24});
function fixture(scenes={a:{durationMs:1200,cues:[cue('point.a','a')]},b:{durationMs:1200,cues:[cue('point.b','b',0,1200)]}},extraTargets={}){
  // Only the DOM boundary is mocked. Target validation, geometry caching and
  // the complete renderer execute together, including completed-visit caches.
  class Element{
    constructor(doc){this.ownerDocument=doc;this.children=[];this.style={};this.dataset={};this.parentElement=null;}
    append(node){node.parentElement=this;this.children.push(node);}
    setAttribute(){}
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);}
  }
  const doc={defaultView:{innerWidth:1200,innerHeight:900,ResizeObserver:class{observe(){}disconnect(){}},getComputedStyle:()=>({transform:'none',perspective:'none',filter:'none',contain:'none'})},createElement(){return new Element(doc);}};
  const points={a:{x:100,y:100},b:{x:600,y:400},...extraTargets},ids=Object.keys(points);
  const scene=new Element(doc),overlay=new Element(doc),state={...points,available:Object.fromEntries(ids.map(id=>[id,true])),reads:Object.fromEntries(ids.map(id=>[id,0]))};
  const surface={scene,overlay,kind:'managed',pose:{x:0,y:0,scale:1},revision:0,subscribe:()=>()=>{},apply(pose){this.pose=pose;},snapshot:()=>({origin:{x:0,y:0},box:{x:0,y:0,width:800,height:600},bounds:[]})};
  const registry=createTargetRegistry(Object.fromEntries(ids.map(id=>[id,{label:id,bounds(){state.reads[id]++;return {width:20,height:20,...state[id],space:'scene',visible:state.available[id]};}}])));
  const renderer=createRenderer(surface,registry),plan={script:{targets:Object.fromEntries(ids.map(id=>[id,{ref:id}])),defaults:{easing:'gentle'}},scenes};
  const pointers=()=>overlay.children[0].children.filter(node=>node.dataset.kind==='cursor');
  const point=()=>{const node=pointers()[0];if(!node)return null;const [,x,y]=node.style.transform.match(/translate\(([^p]+)px, ([^p]+)px\)/u);return {x:Number(x),y:Number(y)};};
  return {state,renderer,registry,point,pointers,surface,
    render(sceneId,timeMs,options={}){const ids=Object.keys(scenes),path=ids.slice(0,ids.indexOf(sceneId)+1).map(id=>({sceneId:id,visitId:'visit.'+id}));renderer.render(plan,{sceneId,visitId:'visit.'+sceneId,path,timeMs},options);return point();},
    retire(id){state.available[id]=false;registry.invalidate();},
    move(id,x){state[id].x=x;registry.invalidate();},
  };
}

test('a cursor-only target can retire before scene end and still supply the next scene source',()=>{
  const f=fixture();assert.deepEqual(f.render('a',500),{x:110,y:110});
  f.retire('a');const reads=f.state.reads.a;
  assert.deepEqual(f.render('a',900),{x:110,y:110});assert.deepEqual(f.render('a',1200),{x:110,y:110});
  assert.deepEqual(f.render('b',0),{x:110,y:110});
  assert.deepEqual(f.render('b',300),{x:360,y:260});
  assert.equal(f.state.reads.a,reads,'retired coordinates do not re-resolve a host element');
  f.renderer.destroy();
});

test('a fresh direct seek reconstructs the same source without prior rendered frames',()=>{
  const played=fixture(),fresh=fixture();played.render('a',500);played.render('a',1200);
  assert.deepEqual(fresh.render('b',300),played.render('b',300));
  assert.deepEqual(fresh.render('b',0),{x:110,y:110});
  played.renderer.destroy();fresh.renderer.destroy();
});

test('revisiting a scene invalidates its old endpoint and downstream carried cursor sources',()=>{
  const f=fixture({a:{durationMs:1200,cues:[cue('point.a','a')]},gap:{durationMs:1000,cues:[]},b:{durationMs:1200,cues:[cue('point.b','b',0,1200)]}});
  f.render('a',1200);f.render('gap',1000);assert.deepEqual(f.render('b',0),{x:110,y:110});
  f.move('a',200);assert.deepEqual(f.render('a',400),{x:210,y:110});
  assert.deepEqual(f.render('b',0),{x:210,y:110},'the cursorless middle scene cannot carry the stale source');
  f.renderer.destroy();
});

test('rewinding within a scene discards future destinations before reconstructing its endpoint',()=>{
  const f=fixture({a:{durationMs:1800,cues:[cue('first','a'),cue('last','b',600)]},b:{durationMs:1200,cues:[cue('next','a',0,1200)]}});
  f.render('a',1800);assert.deepEqual(f.render('b',0),{x:610,y:410});
  f.render('a',300);f.move('b',500);
  assert.deepEqual(f.render('b',0),{x:510,y:410});f.renderer.destroy();
});

test('reduced motion hides the pointer without destroying recorded destinations',()=>{
  const f=fixture();f.render('a',500);f.retire('a');f.render('a',1200,{reduced:true});
  assert.equal(f.render('b',0,{reduced:true}),null);
  assert.deepEqual(f.render('b',0),{x:110,y:110});
  f.renderer.clear();f.state.available.a=true;f.registry.invalidate();
  assert.deepEqual(f.render('a',0),{x:400,y:300},'a new run retains the center entrance');
  f.renderer.destroy();
});

test('active destinations retain visibility checks even after their endpoint was cached',()=>{
  const f=fixture();f.render('b',800);f.retire('b');
  assert.throws(()=>f.render('b',900),error=>error.diagnostic.code==='TARGET_HIDDEN');f.renderer.destroy();
});

const panningScenes=()=>({
  a:{durationMs:1200,cues:[cue('point.a','a',0,600,{gesture:'click'})]},
  b:{durationMs:3000,cues:[pan('pan.b','b'),cue('point.b','b',900,1800,{gesture:'click'})]},
});
function visible(point){
  assert.ok(point,'a cursor remains present');
  assert.ok(point.x>=8&&point.x<=752&&point.y>=8&&point.y<=552,JSON.stringify(point)+' is inside the viewport');
}
function near(actual,expected,message='camera projection agrees within floating-point precision',tolerance=1e-9){
  for(const axis of ['x','y'])assert.ok(Math.abs(actual[axis]-expected[axis])<tolerance,message+': '+axis);
}

test('an authored cursor gap without a travel cue keeps one pointer neutral',()=>{
  const f=fixture(panningScenes());f.render('a',500);
  const node=f.pointers()[0];assert.equal(node.dataset.gesture,'click');
  f.retire('a');const reads=f.state.reads.a;
  assert.deepEqual(f.render('a',1200),{x:110,y:110});assert.equal(node.dataset.gesture,'point');
  for(const time of [0,16,300,600,899,900,901,1200,1500]){
    visible(f.render('b',time,{animate:true}));
    assert.deepEqual(f.pointers(),[node],'scene and cue boundaries retain the same single node');
    assert.equal(node.dataset.gesture,time<900?'point':'click');
  }
  assert.deepEqual(f.render('b',900),{x:110,y:110});
  near(f.render('b',1200),{x:400,y:300},'a cursor beginning during the pan arrives when that pan ends');
  near(f.render('b',1500),{x:400,y:300},'the cursor reaches the visible destination');
  assert.equal(f.state.reads.a,reads,'carrying a cursor never re-resolves the retired target');
  f.renderer.destroy();
});

test('camera-only scenes retain the same neutral pointer until the following cursor cue',()=>{
  const f=fixture({
    a:{durationMs:1200,cues:[cue('point.a','a',0,600,{gesture:'touch'})]},
    gap:{durationMs:1200,cues:[pan('pan.gap','b')]},
    b:{durationMs:3000,cues:[pan('pan.back','a'),cue('point.next','a',900,1800)]},
  });
  f.render('a',500);const node=f.pointers()[0];assert.equal(node.textContent,'◎');
  f.render('a',1200);
  for(const time of [0,300,600,900,1200]){
    assert.deepEqual(f.render('gap',time),{x:110,y:110});assert.deepEqual(f.pointers(),[node]);
    assert.equal(node.dataset.gesture,'point');assert.equal(node.textContent,'↖');
  }
  for(const time of [0,300,899,900,1200,1500]){visible(f.render('b',time));assert.deepEqual(f.pointers(),[node]);}
  near(f.point(),{x:400,y:300});f.renderer.destroy();
});

test('fresh seeking into a moving camera matches the continuously sampled cursor position',()=>{
  const played=fixture(panningScenes());played.render('a',500);played.render('a',1200);
  for(const time of [0,16,300,600,899,900,901,1200,1500]){
    const expected=played.render('b',time),fresh=fixture(panningScenes());
    assert.deepEqual(fresh.render('b',time),expected,'direct seek at '+time+'ms');
    visible(expected);fresh.renderer.destroy();
  }
  played.renderer.destroy();
});

test('departing from a clamped outgoing point starts easing immediately instead of rushing from offscreen',()=>{
  const f=fixture({
    a:{durationMs:1200,cues:[pan('pan.away','b'),cue('point.a','a')]},
    b:{durationMs:3000,cues:[cue('point.b','b',900,1800)]},
  });
  assert.deepEqual(f.render('a',1200),{x:8,y:8});
  const node=f.pointers()[0];
  assert.deepEqual(f.render('b',899),{x:8,y:8});
  assert.deepEqual(f.render('b',900),{x:8,y:8});
  near(f.render('b',1050),{x:32.5,y:26.25});
  near(f.render('b',1200),{x:204,y:154});
  near(f.render('b',1500),{x:400,y:300});assert.deepEqual(f.pointers(),[node]);
  f.renderer.destroy();
});

test('seeking before the first cursor and clearing the run remove any carried pointer',()=>{
  const f=fixture({a:{durationMs:1200,cues:[cue('first','a',100,600)]}});
  assert.equal(f.render('a',0),null);f.render('a',500);assert.equal(f.pointers().length,1);
  assert.deepEqual(f.render('a',900),{x:110,y:110});
  assert.equal(f.render('a',99),null);assert.equal(f.pointers().length,0);
  f.render('a',900);f.renderer.clear();assert.equal(f.pointers().length,0);
  assert.equal(f.render('a',0),null);f.renderer.destroy();
});

test('revisiting camera geometry rebuilds departure anchors and downstream camera-only scenes',()=>{
  const f=fixture({
    a:{durationMs:1200,cues:[pan('pan.a','a',200),cue('point.a','a')]},
    gap:{durationMs:1000,cues:[]},
    b:{durationMs:1200,cues:[cue('point.b','b',0,1200)]},
  });
  near(f.render('a',1200),{x:400,y:300});f.render('gap',1000);
  near(f.render('b',0),{x:400,y:300});
  f.move('a',200);near(f.render('a',400),{x:400,y:300});
  near(f.render('b',0),{x:400,y:300},'the updated cursor must use the updated outgoing camera');
  f.renderer.destroy();
});

test('seeking back preserves completed authored camera geometry after its target retires',()=>{
  const f=fixture({
    a:{durationMs:1200,cues:[pan('pan.a','a',200),cue('point.a','a')]},
    gap:{durationMs:1200,cues:[pan('pan.b','b')]},
    c:{durationMs:1200,cues:[cue('point.c','a',0,1200)]},
  });
  f.render('a',1200);near(f.render('gap',1200),{x:400,y:300});
  f.retire('b');const reads=f.state.reads.b;
  near(f.render('a',400),{x:400,y:300});
  near(f.render('c',0),{x:400,y:300},'the carried source survives a completed camera-only scene');
  assert.equal(f.state.reads.b,reads,'the completed camera must not resolve its retired target again');
  f.renderer.destroy();
});

const travellingScenes=()=>({
  a:{durationMs:1200,cues:[cue('point.a','a')]},
  b:{durationMs:3000,cues:[pan('pan.b','b'),cue('travel.b','b',0,900),cue('click.b','b',900,1800,{gesture:'click'})]},
});

test('an explicit neutral prelude moves during the pan and reaches the gesture without a second departure',()=>{
  const f=fixture(travellingScenes());f.render('a',1200);const node=f.pointers()[0];
  const samples=[
    [0,{x:110,y:110}],[150,{x:119.149745,y:115.486454}],[300,{x:177.256451,y:150.150511}],
    [450,{x:288.720646,y:215.376018}],[899,{x:367.658122,y:276.295763}],
    [900,{x:367.938055,y:276.503447}],[901,{x:368.216931,y:276.710290}],[1200,{x:400,y:300}],
  ];
  for(const [time,expected]of samples){
    const actual=f.render('b',time);near(actual,expected,'authored pan trajectory at '+time+' ms',1e-6);visible(actual);
    assert.deepEqual(f.pointers(),[node]);assert.equal(node.dataset.gesture,time<900?'point':'click');
  }
  assert.ok(Math.hypot(f.render('b',300).x-110,f.point().y-110)>50,'visible travel occurs before the gesture cue');
  f.renderer.destroy();
});

test('fresh direct seeks reconstruct the same prelude travel at early and gesture-boundary frames',()=>{
  const played=fixture(travellingScenes());played.render('a',1200);
  for(const time of [0,150,300,450,600,899,900,901,1200]){
    const expected=played.render('b',time),fresh=fixture(travellingScenes());
    assert.deepEqual(fresh.render('b',time),expected,'direct seek at '+time+' ms');fresh.renderer.destroy();
  }
  played.renderer.destroy();
});

test('camera framing and cursor travel can target different controls',()=>{
  const f=fixture({
    a:{durationMs:1200,cues:[cue('point.a','a')]},
    handoff:{durationMs:3000,cues:[{...pan('pan.review','review'),maxScale:2},cue('travel.approve','approve',0,900),cue('touch.approve','approve',900,1800,{gesture:'touch'})]},
  },{review:{x:500,y:300,width:250,height:250},approve:{x:600,y:460,width:100,height:40}});
  f.render('a',1200);const start=f.render('handoff',0),early=f.render('handoff',300);
  assert.ok(Math.hypot(early.x-start.x,early.y-start.y)>20);assert.equal(f.pointers()[0].dataset.gesture,'point');
  const arrival=f.render('handoff',900),camera=f.surface.pose;
  near(arrival,{x:camera.x+650*camera.scale,y:camera.y+480*camera.scale},'the cursor reaches Approve, not the Review frame center');
  assert.equal(f.pointers()[0].dataset.gesture,'touch');
  near(f.render('handoff',1200),{x:450,y:410});f.renderer.destroy();
});

test('a stationary overview camera still paces travel to a different Earth-style control',()=>{
  const overview=duration=>({...pan('camera.overview','overview',duration),maxScale:1,paddingPx:0});
  const f=fixture({
    a:{durationMs:1200,cues:[overview(0),cue('point.a','a')]},
    b:{durationMs:3000,cues:[overview(1000),cue('travel.b','b',0,700),cue('point.b','b',700,2300)]},
  },{overview:{x:0,y:0,width:800,height:600}});
  f.render('a',1200);const camera={...f.surface.pose};
  near(f.render('b',175),{x:141.25,y:128.75});
  near(f.render('b',350),{x:360,y:260});
  near(f.render('b',700),{x:610,y:410});
  assert.deepEqual(f.surface.pose,camera,'cursor travel does not require a numerical camera pose change');f.renderer.destroy();
});

test('a gap without a travel cue never looks up a future target before its authored start',()=>{
  const f=fixture({
    a:{durationMs:1200,cues:[cue('point.a','a')]},
    b:{durationMs:3000,cues:[pan('camera.a','a'),cue('future.b','b',900,1800)]},
  });
  f.render('a',1200);f.retire('b');const reads=f.state.reads.b;
  for(const time of [0,300,899])visible(f.render('b',time));
  assert.equal(f.state.reads.b,reads,'no speculative future geometry read');
  assert.throws(()=>f.render('b',900),error=>error.diagnostic.code==='TARGET_HIDDEN');f.renderer.destroy();
});
