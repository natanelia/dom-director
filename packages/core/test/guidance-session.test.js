import test from 'node:test';
import assert from 'node:assert/strict';
import {Session} from '../src/session.js';
import {compile} from '../src/compiler.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(barriers,onEvent=()=>{}){
  const script={schemaVersion:'0.1.0-draft.1',id:'gated',title:'Gated',locale:'en',entryScene:'a',modes:['watch','try','guide'],capabilities:['condition:ready','action:save'],targets:{},scenes:[{id:'a',title:'A',summary:'A',durationMs:1000,cues:[{id:'gate',kind:'gate',at:0,conditionRef:'ready',timeoutMs:1000,instruction:'Wait.',onTimeout:'skip-scene'}]}]};
  return new Session(compile(script).plan,{now:()=>0,barriers,onEvent});
}
test('skipping the last scene emits completion and preserves incomplete status',async()=>{
  const events=[];const s=fixture({enter:()=>({skipScene:true})},e=>events.push(e));s.play();await flush();
  assert.equal(s.status,'completed');assert.equal(s.inspect().incomplete,true);assert.ok(events.some(e=>e.type==='completed'));s.destroy();
});
test('mode changes re-observe condition state rather than reusing old success',async()=>{
  let calls=0;const s=fixture({enter:()=>{calls++;return {completed:true};}});s.play();await flush();assert.equal(calls,1);
  s.setMode('guide');assert.equal(s.mode,'guide');s.play();await flush();assert.equal(calls,2);s.destroy();
});
test('a failed barrier exposes a redacted diagnostic and allows explicit retry',async()=>{
  let attempts=0;const s=fixture({enter:()=>{if(!attempts++)throw new Error('do not expose host details');return {completed:true};}});
  s.play();await flush();assert.equal(s.inspect().waitingFor.error,'HOST_FAILURE');assert.equal(s.status,'paused');
  s.retryBarrier();await flush();assert.equal(s.inspect().waitingFor,null);assert.equal(attempts,2);s.destroy();
});
test('confirmed fixture reset starts a new run and clears prior condition receipts',async()=>{
  const s=fixture({enter:()=>({completed:true})});s.play();await flush();const old=s.runId;s.resetFixture();
  assert.notEqual(s.runId,old);assert.equal(s.resolved.size,0);assert.equal(s.status,'ready');s.destroy();
});
