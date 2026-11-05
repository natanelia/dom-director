import test from 'node:test';
import assert from 'node:assert/strict';
import {createCheckpointStore} from '../src/checkpoints.js';

function fixture(options = {}) {
  const listeners = new Set();
  let description = Object.freeze({id:'tour',locale:'en'});
  const state = {runId:'run.1',mode:'try',revision:0,status:'ready',sceneId:'a',visitId:'visit.1',timeMs:0,
    path:[{sceneId:'a',visitId:'visit.1'}],effects:[],waitingFor:null,pendingOperation:null};
  const emit = type => { state.revision++;for (const listener of [...listeners]) listener({type, ...state}); };
  const director = {sessionId:'session.1',inspect:()=>structuredClone(state),describe:()=>description,
    on(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    pause(){state.status='paused';emit('paused');return {ok:true};},
    seek(position){this.pause();Object.assign(state,position);emit('seeked');return {ok:true};},
    stop(){state.status='ready';state.timeMs=0;emit('stopped');},
    reload(){description=Object.freeze({...description});emit('prepared');}};
  const v = {script:'script-v1',host:'host-v1',fixture:'fixture-v1'};
  const store = createCheckpointStore(director,{versions:()=>v,verify:()=>true,authorize:()=>true,...options});
  return {store,director,state,v,emit,listeners};
}
const code = result => result.diagnostics?.[0].code;

test('captures and restores visual position, paused, with immutable metadata',async()=>{
  const f=fixture();f.state.timeMs=200;
  const saved=await f.store.capture();assert.equal(saved.ok,true);assert.equal(Object.isFrozen(saved.value),true);
  f.state.timeMs=900;
  const restored=await f.store.restore(saved.value.id);
  assert.equal(restored.ok,true);assert.equal(restored.value.timeMs,200);assert.equal(restored.value.status,'paused');
  assert.equal(f.listeners.size,0);f.store.destroy();
});
test('permission defaults to deny; no checkpoint is stored',async()=>{
  const f=fixture({authorize:undefined});const r=await f.store.capture();assert.equal(code(r),'CAPABILITY_DENIED');assert.equal(f.store.list().length,0);f.store.destroy();
});
test('checks permission again after host verification',async()=>{
  let count=0;const f=fixture({authorize:()=>++count===1});
  assert.equal(code(await f.store.capture()),'CAPABILITY_DENIED');assert.equal(count,2);f.store.destroy();
});
test('version mismatches fail before restore or verification',async()=>{
  for(const key of ['script','host','fixture']){
    const f=fixture();const r=await f.store.capture();f.v[key]='v2';f.state.timeMs=600;
    assert.equal(code(await f.store.restore(r.value.id)),'CHECKPOINT_INCOMPATIBLE');assert.equal(f.state.timeMs,600);f.store.destroy();
  }
});
test('versions are rechecked after async callbacks',async()=>{
  const f=fixture({verify:()=>{f.v.host='new';return true;}});
  assert.equal(code(await f.store.capture()),'CHECKPOINT_INCOMPATIBLE');f.store.destroy();
});
test('script replacement with same ID, a new run, or mode invalidates old records',async()=>{
  for(const change of [f=>f.director.reload(),f=>f.state.runId='run.2',f=>f.state.mode='guide']){
    const f=fixture();const r=await f.store.capture();change(f);
    assert.equal(code(await f.store.restore(r.value.id)),'CHECKPOINT_INCOMPATIBLE');f.store.destroy();
  }
});
test('restore cannot change branch or replay later effect evidence',async()=>{
  const f=fixture();const r=await f.store.capture();f.state.path[0].visitId='visit.2';
  assert.equal(code(await f.store.restore(r.value.id)),'CHECKPOINT_PATH');
  f.state.path[0].visitId='visit.1';f.state.effects=[{key:'effect',state:'succeeded'}];
  assert.equal(code(await f.store.restore(r.value.id)),'CHECKPOINT_EFFECTS_CHANGED');f.store.destroy();
});
test('pending gates, preparation and uncertain effects block capture',async()=>{
  for(const patch of [{waitingFor:{kind:'gate'}},{pendingOperation:'mode'},...['authorizing','pending','unknown'].map(state=>({effects:[{state}]}))]){
    const f=fixture();Object.assign(f.state,patch);assert.equal(code(await f.store.capture()),'CHECKPOINT_BUSY');f.store.destroy();
  }
});
test('bounded storage never silently evicts a checkpoint',async()=>{
  const f=fixture({maxCheckpoints:1});const r=await f.store.capture();
  assert.equal(code(await f.store.capture()),'CHECKPOINT_FULL');assert.equal(f.store.list()[0].id,r.value.id);
  assert.equal(f.store.remove(r.value.id),true);assert.equal((await f.store.capture()).ok,true);f.store.clear();assert.deepEqual(f.store.list(),[]);f.store.destroy();
});
test('host failure is redacted',async()=>{
  const f=fixture({verify:()=>{throw new Error('secret host data');}});const r=await f.store.capture();
  assert.equal(code(r),'HOST_FAILURE');assert.equal(JSON.stringify(r).includes('secret'),false);f.store.destroy();
});
test('read-only host verification can refuse a stale fixture',async()=>{
  const f=fixture({verify:()=>false});assert.equal(code(await f.store.capture()),'CHECKPOINT_INCOMPATIBLE');f.store.destroy();
});
test('Stop cancels unresolved verification and late completion does not store a record',async()=>{
  let resolve;const f=fixture({verify:()=>new Promise(r=>resolve=r)});
  const pending=f.store.capture();await new Promise(r=>setImmediate(r));f.director.stop();
  assert.equal(code(await pending),'CANCELLED');resolve(true);await new Promise(r=>setImmediate(r));
  assert.deepEqual(f.store.list(),[]);assert.equal(f.state.status,'ready');assert.equal(f.listeners.size,0);f.store.destroy();
});
test('abort before capture leaves playback untouched',async()=>{
  const f=fixture(),c=new AbortController();c.abort();assert.equal(code(await f.store.capture({signal:c.signal})),'CANCELLED');
  assert.equal(f.state.revision,0);assert.equal(f.listeners.size,0);f.store.destroy();
});
test('bounded deadline and destroy settle unresolved callbacks',async()=>{
  for(const destroy of [false,true]){
    const f=fixture({timeoutMs:20,verify:()=>new Promise(()=>{})});const pending=f.store.capture();
    if(destroy)f.store.destroy();const r=await pending;assert.equal(r.ok,false);assert.equal(f.listeners.size,0);f.store.destroy();
  }
});
test('only one owner and one operation; destroy releases ownership',async()=>{
  const f=fixture({verify:()=>new Promise(()=>{})});
  assert.throws(()=>createCheckpointStore(f.director,{versions:()=>f.v,verify:()=>true}),/already owns/);
  const pending=f.store.capture();assert.equal(code(await f.store.capture()),'CHECKPOINT_BUSY');f.store.destroy();await pending;
  const fresh=createCheckpointStore(f.director,{versions:()=>f.v,verify:()=>true});fresh.destroy();
});
test('reentrant Stop during the pause is not ignored',async()=>{
  const f=fixture();let once=true;const off=f.director.on(e=>{if(e.type==='paused'&&once){once=false;f.director.stop();}});
  assert.equal(code(await f.store.capture()),'CANCELLED');assert.equal(f.state.status,'ready');off();f.store.destroy();
});
test('invalid options and missing versions fail explicitly',async()=>{
  const f=fixture({versions:()=>({script:'x',host:'y'})});assert.equal(code(await f.store.capture()),'CHECKPOINT_VERSION');f.store.destroy();
});
test('retained text has a separate budget, even below the count limit',async()=>{
  const f=fixture({maxBytes:1});assert.equal(code(await f.store.capture()),'CHECKPOINT_FULL');assert.deepEqual(f.store.list(),[]);f.store.destroy();
});
