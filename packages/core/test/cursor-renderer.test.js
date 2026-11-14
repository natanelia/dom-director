import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderer} from '../src/renderer.js';
import {createTargetRegistry} from '../src/targets.js';

const cue=(id,target,atMs=0,durationMs=600,extra={})=>({id,target,kind:'cursor',gesture:'point',atMs,durationMs,endMs:atMs+durationMs,...extra});
const pan=(id,target,durationMs=1200)=>({id,target,kind:'camera',atMs:0,durationMs,endMs:durationMs,minScale:.1,maxScale:3,paddingPx:24});
function fixture(scenes={a:{durationMs:1200,cues:[cue('point.a','a')]},b:{durationMs:1200,cues:[cue('point.b','b',0,1200)]}}){
  // Only the DOM boundary is mocked. Target validation, geometry caching and
  // the complete renderer execute together, including completed-visit caches.
  class Element{
    constructor(doc){this.ownerDocument=doc;this.children=[];this.style={};this.dataset={};this.parentElement=null;}
    append(node){node.parentElement=this;this.children.push(node);}
    setAttribute(){}
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);}
  }
  const doc={defaultView:{innerWidth:1200,innerHeight:900,ResizeObserver:class{observe(){}disconnect(){}},getComputedStyle:()=>({transform:'none',perspective:'none',filter:'none',contain:'none'})},createElement(){return new Element(doc);}};
  const scene=new Element(doc),overlay=new Element(doc),state={a:{x:100,y:100},b:{x:600,y:400},available:{a:true,b:true},reads:{a:0,b:0}};
  const surface={scene,overlay,kind:'managed',pose:{x:0,y:0,scale:1},revision:0,subscribe:()=>()=>{},apply(pose){this.pose=pose;},snapshot:()=>({origin:{x:0,y:0},box:{x:0,y:0,width:800,height:600},bounds:[]})};
  const registry=createTargetRegistry(Object.fromEntries(['a','b'].map(id=>[id,{label:id,bounds(){state.reads[id]++;return {...state[id],width:20,height:20,space:'scene',visible:state.available[id]};}}])));
  const renderer=createRenderer(surface,registry),plan={script:{targets:{a:{ref:'a'},b:{ref:'b'}},defaults:{easing:'gentle'}},scenes};
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
function near(actual,expected,message='camera projection agrees within floating-point precision'){
  for(const axis of ['x','y'])assert.ok(Math.abs(actual[axis]-expected[axis])<1e-9,message+': '+axis);
}

test('an Orbit-style pan with a delayed cursor cue keeps one visible pointer and a neutral gap',()=>{
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
  near(f.render('b',1200),{x:255,y:205});
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
