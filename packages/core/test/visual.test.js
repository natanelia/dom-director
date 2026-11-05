import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from '../src/compiler.js';
import {sampleVisual} from '../src/visual.js';
import {createTargetRegistry} from '../src/targets.js';
const data={schemaVersion:'0.1.0-draft.1',id:'visual',title:'Visual',locale:'en',entryScene:'a',modes:['watch'],capabilities:[],targets:{x:{ref:'x'}},scenes:[{id:'a',title:'A',summary:'A scene',durationMs:3000,cues:[
  {id:'cam',kind:'camera',at:0,durationMs:500,target:'x',maxScale:2},
  {id:'pointer',kind:'cursor',at:500,durationMs:500,target:'x',gesture:'point'},
  {id:'ring',kind:'highlight',at:500,durationMs:1000,target:'x'},
  {id:'reset',kind:'camera',at:2000,durationMs:500,reset:true}],narration:{transcript:'Example',cues:[{id:'words',startMs:100,endMs:1000,text:'Example'}]}}]};
const scene=compile(data).plan.scenes.a,bounds={x:{space:'scene',rect:{x:350,y:160,width:100,height:50}}},box={x:0,y:0,width:800,height:500};
test('exact-time samples have half-open overlays and held camera endpoints',()=>{
  assert.equal(sampleVisual(scene,499,bounds,box).overlays.length,0);
  assert.equal(sampleVisual(scene,500,bounds,box).overlays.length,2);
  assert.equal(sampleVisual(scene,1000,bounds,box).overlays.length,1);
  assert.equal(sampleVisual(scene,1500,bounds,box).overlays.length,0);
  assert.deepEqual(sampleVisual(scene,500,bounds,box).camera,sampleVisual(scene,1500,bounds,box).camera);
  assert.deepEqual(sampleVisual(scene,2500,bounds,box).camera,{x:0,y:0,scale:1});
});
test('2,000 shuffled samples equal their direct exact-time reconstruction',()=>{
  let seed=1234;for(let i=0;i<2000;i++){
    seed=(seed*1664525+1013904223)>>>0;const t=seed%3000;
    const a=sampleVisual(scene,t,bounds,box);sampleVisual(scene,2999-t,bounds,box);
    assert.deepEqual(sampleVisual(scene,t,bounds,box),a);
  }
});
test('reduced motion keeps captions/highlights but removes camera motion and cursor',()=>{
  const result=sampleVisual(scene,800,bounds,box,{reduced:true});assert.deepEqual(result.camera,{x:0,y:0,scale:1});assert.equal(result.caption,'Example');assert.deepEqual(result.overlays.map(c=>c.kind),['highlight']);
});
test('target registrations are lazy, revocable and secret targets cannot be granted',()=>{
  let calls=0;const registry=createTargetRegistry({x:{label:'X',sensitivity:'private',bounds(){calls++;return {x:1,y:2,width:3,height:4,space:'scene'};}}});
  assert.equal(calls,0);assert.deepEqual(registry.catalog(),[]);assert.throws(()=>registry.resolve('x'));assert.equal(calls,0);
  const other=createTargetRegistry({}, {privateTargets:['secret']});const remove=other.register('secret',{label:'Secret',sensitivity:'secret',bounds(){throw Error('must not call');}});
  assert.throws(()=>other.resolve('secret'),e=>e.diagnostic.code==='TARGET_DENIED');remove();remove();assert.equal(other.has('secret'),false);
});
