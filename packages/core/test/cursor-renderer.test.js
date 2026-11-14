import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderer} from '../src/renderer.js';
import {createTargetRegistry} from '../src/targets.js';

const cue=(id,target,atMs=0,durationMs=600)=>({id,target,kind:'cursor',gesture:'point',atMs,durationMs,endMs:atMs+durationMs});
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
  const point=()=>{const node=overlay.children[0].children.find(node=>node.dataset.kind==='cursor');if(!node)return null;const [,x,y]=node.style.transform.match(/translate\(([^p]+)px, ([^p]+)px\)/u);return {x:Number(x),y:Number(y)};};
  return {state,renderer,registry,point,
    render(sceneId,timeMs,options={}){const ids=Object.keys(scenes),path=ids.slice(0,ids.indexOf(sceneId)+1).map(id=>({sceneId:id,visitId:'visit.'+id}));renderer.render(plan,{sceneId,visitId:'visit.'+sceneId,path,timeMs},options);return point();},
    retire(id){state.available[id]=false;registry.invalidate();},
    move(id,x){state[id].x=x;registry.invalidate();},
  };
}

test('a cursor-only target can retire before scene end and still supply the next scene source',()=>{
  const f=fixture();assert.deepEqual(f.render('a',500),{x:110,y:110});
  f.retire('a');const reads=f.state.reads.a;
  assert.equal(f.render('a',900),null);assert.equal(f.render('a',1200),null);
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
