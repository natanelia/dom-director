import test from 'node:test';
import assert from 'node:assert/strict';
import {createTargetRegistry,createGuidance} from '../src/index.js';
test('virtual targets accept flat host geometry and expose resolved rect geometry',()=>{
  const registry=createTargetRegistry({'chart.point':{label:'Point',bounds:()=>({space:'scene',x:10,y:20,width:30,height:40})}});
  const value=registry.resolve('chart.point');
  assert.equal(value.virtual,true);assert.equal(value.space,'scene');
  assert.deepEqual(value.rect,{x:10,y:20,width:30,height:40});
  assert.equal(registry.descriptor('chart.point').label,'Point');
  const invalid=createTargetRegistry({'bad':{label:'Bad',bounds:()=>({space:'scene',rect:value.rect})}});
  assert.throws(()=>invalid.resolve('bad'),error=>error.diagnostic.code==='INVALID_GEOMETRY');
});
test('persistent action registration accepts either idempotency or reconciliation',()=>{
  const base={impact:'persistent',validate:()=>true,execute:()=>({completed:true})};
  for(const policy of [{idempotent:true},{reconcile:()=> 'unknown'}])createGuidance({actions:{save:{...base,...policy}}}).destroy();
  assert.throws(()=>createGuidance({actions:{save:base}}),error=>error.diagnostic.code==='ACTION_REGISTRATION');
});
