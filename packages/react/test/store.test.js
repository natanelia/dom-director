import test from 'node:test';
import assert from 'node:assert/strict';
import {createDirectorStore,EMPTY_DIRECTOR_STATE} from '../src/store.js';
function fixture() {
  const listeners=new Set(),state={revision:0,status:'ready',timeMs:0};let subscriptions=0;
  const director={inspect:()=>({...state}),on(fn){subscriptions++;listeners.add(fn);return()=>{subscriptions--;listeners.delete(fn);};}};
  return {store:createDirectorStore(director),state,listeners,get subscriptions(){return subscriptions;}};
}
test('server and missing-director snapshots are stable and empty',()=>{
  const store=createDirectorStore(null);assert.equal(store.getSnapshot(),EMPTY_DIRECTOR_STATE);
  assert.equal(store.getServerSnapshot(),store.getSnapshot());store.subscribe(()=>{})();
});
test('snapshots are referentially stable until a semantic revision changes',()=>{
  const f=fixture(),first=f.store.getSnapshot();assert.equal(Object.isFrozen(first),true);
  f.state.timeMs=100;assert.equal(f.store.getSnapshot(),first);
  f.state.revision++;assert.notEqual(f.store.getSnapshot(),first);assert.equal(f.store.getSnapshot().timeMs,100);
});
test('subscribers share one semantic listener and clean up idempotently',()=>{
  const f=fixture();let calls=0;const listener=()=>calls++;
  const a=f.store.subscribe(listener),b=f.store.subscribe(listener);assert.equal(f.subscriptions,1);
  f.state.revision++;for(const notify of f.listeners)notify();assert.equal(calls,2);
  a();a();assert.equal(f.subscriptions,1);b();assert.equal(f.subscriptions,0);
});
test('a change between render and subscribe is observed by the next read',()=>{
  const f=fixture();f.store.getSnapshot();f.state.revision=5;f.state.status='paused';
  const off=f.store.subscribe(()=>{});assert.equal(f.store.getSnapshot().status,'paused');off();
});
test('resubscription after cleanup sees the latest revision',()=>{
  const f=fixture();const off=f.store.subscribe(()=>{});off();f.state.revision=3;
  const next=f.store.subscribe(()=>{});assert.equal(f.subscriptions,1);assert.equal(f.store.getSnapshot().revision,3);next();
});
test('the settled run identity is visible even if preparation emitted before assignment',()=>{
  const f=fixture();f.store.getSnapshot();f.state.revision++;
  const during=f.store.getSnapshot();f.state.runId='run.new';
  assert.notEqual(f.store.getSnapshot(),during);assert.equal(f.store.getSnapshot().runId,'run.new');
});
test('destroyed owners do not receive new subscriptions',()=>{
  const f=fixture();f.state.status='destroyed';f.store.subscribe(()=>{})();assert.equal(f.subscriptions,0);
});
