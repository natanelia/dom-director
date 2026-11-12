import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from '../src/compiler.js';
import {Session} from '../src/session.js';
import {TimelineClock} from '../src/clock.js';
export function script(){return {schemaVersion:'0.1.0-draft.1',id:'test-tour',title:'Test tour',locale:'en',entryScene:'a',modes:['watch','try','guide'],capabilities:[],targets:{},scenes:[{id:'a',title:'A',summary:'First scene',durationMs:1000,cues:[],next:'b'},{id:'b',title:'B',summary:'Second scene',durationMs:1000,cues:[]}]};}
function setup(data=script(),options={}){const result=compile(data);assert.equal(result.ok,true,JSON.stringify(result.diagnostics));let now=0;const events=[],frames=[];const session=new Session(result.plan,{now:()=>now,onEvent:e=>events.push(e),onFrame:f=>frames.push(f),...options});return {session,events,frames,advance:ms=>{now+=ms;session.tick();}};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('monotonic anchored time, pause/resume, explicit seek, rate and natural completion',()=>{
  const {session:s,advance}=setup();s.play();advance(200);assert.equal(s.time,200);s.pause();advance(500);assert.equal(s.time,200);
  s.setRate(2);s.play();advance(100);assert.equal(s.time,400);s.seek({timeMs:100});assert.equal(s.status,'paused');s.play();advance(450);assert.equal(s.scene.id,'b');assert.equal(s.time,0);
  advance(500);assert.equal(s.status,'completed');s.destroy();assert.equal(s.status,'destroyed');assert.throws(()=>s.play());
});
test('clock rejects backwards and nonfinite readings without poisoning destruction',()=>{
  let now=0;const c=new TimelineClock(()=>now);c.start();now=10;assert.equal(c.read(),10);now=5;assert.throws(()=>c.read());c.destroy();
  assert.throws(()=>new TimelineClock(()=>NaN));
});
test('seek never executes an action and cannot bypass unresolved host state',async()=>{
  const data=script();data.capabilities=['action:save'];data.scenes[0].cues=[{id:'save',kind:'action',at:300,actionRef:'save',args:{},timeoutMs:1000}];let calls=0;
  const {session:s}=setup(data,{barriers:{enter(){calls++;return {completed:true};}}});
  assert.throws(()=>s.seek({sceneId:'b',timeMs:0}));assert.equal(calls,0);assert.throws(()=>s.seek({timeMs:500}));
  s.seek({timeMs:300});assert.equal(calls,0);s.play();await flush();assert.equal(calls,1);
  s.seek({sceneId:'b',timeMs:500});s.seek({sceneId:'a',timeMs:0});s.play();s.stop();s.play();await flush();assert.equal(calls,1);
});
test('late conditions do not remove a user pause; stop rejects stale async completion',async()=>{
  const data=script();data.capabilities=['condition:ready'];data.scenes[0].cues=[{id:'wait',kind:'gate',at:200,conditionRef:'ready',timeoutMs:1000,instruction:'Wait for readiness'}];
  let resolve;const {session:s,advance}=setup(data,{barriers:{enter(){return new Promise(r=>{resolve=r;});}}});
  s.play();advance(250);await flush();assert.equal(s.time,200);assert.equal(s.status,'waiting');s.pause();resolve({completed:true});await flush();assert.equal(s.status,'paused');
  s.stop();s.seek({timeMs:0});s.play();advance(300);assert.equal(s.status,'playing');
  const other=setup(data,{barriers:{enter(){return new Promise(r=>{resolve=r;});}}});other.session.play();other.advance(250);await flush();other.session.stop();resolve({completed:true});await flush();assert.equal(other.session.status,'ready');assert.equal(other.session.time,0);
});
test('immediate stop cancels even a queued host invocation',async()=>{
  const data=script();data.capabilities=['action:save'];data.scenes[0].cues=[{id:'save',kind:'action',at:0,actionRef:'save',args:{},timeoutMs:1000}];let calls=0;
  const {session:s}=setup(data,{barriers:{enter(){calls++;return {completed:true};}}});s.play();s.stop();await flush();assert.equal(calls,0);
});
test('branches require a choice; guide mode stops at boundaries',()=>{
  const data=script();delete data.scenes[0].next;data.scenes[0].choices=[{id:'open-b',label:'Open B',next:'b'}];const {session:s,advance}=setup(data);
  assert.throws(()=>s.seek({sceneId:'b',timeMs:0}));s.play();advance(1000);assert.equal(s.status,'waiting');assert.equal(s.inspect().choices.length,1);s.choose('open-b');assert.equal(s.scene.id,'b');assert.equal(s.status,'playing');
  const guided=setup(script(),{mode:'guide'});guided.session.play();guided.advance(1000);assert.equal(guided.session.status,'waiting');guided.session.next();assert.equal(guided.session.scene.id,'b');
});
test('observer-triggered stop during scene completion prevents advancement',()=>{
  let s;const data=script(),plan=compile(data).plan;let now=0;
  s=new Session(plan,{now:()=>now,onEvent:event=>{if(event.type==='scene-completed')s.stop();}});s.play();now=1000;s.tick();assert.equal(s.scene.id,'a');assert.equal(s.time,0);assert.equal(s.status,'ready');
});
test('bad rate never causes an application effect or changes playback rate',async()=>{
  const {session:s}=setup();s.play();assert.throws(()=>s.setRate(NaN));assert.equal(s.clock.rate,1);
});
test('missing host adapter waits with a diagnostic instead of passing a gate',()=>{
  const data=script();data.capabilities=['condition:ready'];data.scenes[0].cues=[{id:'wait',kind:'gate',at:0,conditionRef:'ready',timeoutMs:1000,instruction:'Ready?'}];
  const {session:s,events}=setup(data);s.play();assert.equal(s.status,'waiting');assert.ok(events.some(e=>e.detail.diagnostic?.code==='CAPABILITY_UNAVAILABLE'));s.destroy();
});
