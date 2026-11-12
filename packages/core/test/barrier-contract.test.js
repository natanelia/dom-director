import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from '../src/compiler.js';
import {Session} from '../src/session.js';
const script=()=>({schemaVersion:'0.1.0-draft.1',id:'test-tour',title:'Test tour',locale:'en',entryScene:'a',modes:['watch'],capabilities:[],targets:{},scenes:[{id:'a',title:'A',summary:'A',durationMs:1000,cues:[],next:'b'},{id:'b',title:'B',summary:'B',durationMs:1000,cues:[]}]});
const setup=(data,options)=>{const result=compile(data);assert.equal(result.ok,true,JSON.stringify(result.diagnostics));const events=[];return {session:new Session(result.plan,{now:()=>0,onEvent:e=>events.push(e),...options}),events};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('invalid skip cannot mark an action complete or permit a blocked seek',async()=>{
  const data=script();data.capabilities=['action:save'];data.scenes[0].cues=[{id:'save',kind:'action',at:0,actionRef:'save',args:{},timeoutMs:1000}];
  const {session:s,events}=setup(data,{barriers:{enter:()=>({skipScene:true})}});s.play();await flush();
  assert.equal(s.status,'paused');assert.equal(s.resolved.size,0);assert.throws(()=>s.seek({sceneId:'b',timeMs:1}));assert.ok(!events.some(e=>e.type==='action-completed'));
});
test('declared timeout skips remain visibly incomplete, never condition success',async()=>{
  const data=script();data.capabilities=['condition:ready'];data.scenes[0].cues=[{id:'wait',kind:'gate',at:0,conditionRef:'ready',timeoutMs:1000,onTimeout:'skip-scene',instruction:'Ready?'}];
  const {session:s,events}=setup(data,{barriers:{enter:()=>({skipScene:true})}});s.play();await flush();
  assert.equal(s.scene.id,'b');assert.equal(s.inspect().incomplete,true);assert.ok(events.some(e=>e.type==='condition-skipped'));assert.ok(!events.some(e=>e.type==='condition-satisfied'));
});
