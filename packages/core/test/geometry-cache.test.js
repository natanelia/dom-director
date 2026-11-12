import test from 'node:test';
import assert from 'node:assert/strict';
import {createTargetRegistry,createGeometryCache} from '../src/targets.js';
function fixture(){
  const state={x:20,origin:0,scale:1,visible:true};
  const surface={scene:{ownerDocument:{defaultView:{ResizeObserver:class {observe(){}disconnect(){}}}}},
    get pose(){return {x:0,y:0,scale:state.scale};},revision:0,subscribe:()=>()=>{},
    snapshot:()=>({origin:{x:state.origin,y:0},box:{x:-state.origin,y:0,width:800,height:600},bounds:[],revision:0})};
  const registry=createTargetRegistry({point:{label:'Point',dynamic:true,bounds:()=>({x:state.x,y:10,width:30,height:40,space:'scene',visible:state.visible})}});
  return {state,registry,cache:createGeometryCache(surface,registry)};
}
test('measurement noise cannot change camera geometry or its revision',()=>{
  const {state,cache}=fixture(),first=cache.measure(['point']);
  for(const noise of [-.014,.012,-.025,.021]){
    state.x=20+noise;state.origin=noise/2;
    const next=cache.measure(['point']);
    assert.equal(next.geometryRevision,first.geometryRevision);
    assert.deepEqual(next.bounds.point.rect,first.bounds.point.rect);
    assert.deepEqual(next.box,first.box);assert.deepEqual(next.origin,first.origin);
  }
  cache.destroy();
});
test('small real movements accumulate against the accepted geometry',()=>{
  const {state,cache}=fixture(),first=cache.measure(['point']);
  state.x+=.02;assert.equal(cache.measure(['point']).geometryRevision,first.geometryRevision);
  state.x+=.02;assert.equal(cache.measure(['point']).geometryRevision,first.geometryRevision);
  state.x+=.02;const moved=cache.measure(['point']);assert.equal(moved.geometryRevision,first.geometryRevision+1);assert.equal(moved.bounds.point.rect.x,state.x);
  cache.destroy();
});
test('scene noise tolerance accounts for inverse camera scale',()=>{
  const {state,cache}=fixture();state.scale=.1;const first=cache.measure(['point']);
  state.x+=.2;assert.equal(cache.measure(['point']).geometryRevision,first.geometryRevision);
  state.x+=.4;assert.equal(cache.measure(['point']).geometryRevision,first.geometryRevision+1);
  cache.destroy();
});
test('dynamic target visibility is checked even when numeric geometry is unchanged',()=>{
  const {state,cache}=fixture();cache.measure(['point']);state.visible=false;
  assert.throws(()=>cache.measure(['point']),e=>e.diagnostic.code==='TARGET_HIDDEN');cache.destroy();
});
