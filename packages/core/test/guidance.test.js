import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuidance} from '../src/guidance.js';
const flush = () => new Promise(resolve => setImmediate(resolve));
const code = expected => error => error?.diagnostic?.code === expected;
const context = (mode='guide') => ({runId:'run.1',visitId:'visit.1',sceneId:'a',mode,
  script:{id:'tour',modes:['watch','try','guide'],capabilities:['action:save','condition:ready','fixture:reset'],scenes:[]}});
const actionCue = {id:'save-cue',kind:'action',actionRef:'save',args:{value:'synthetic'},timeoutMs:1000};
const gateCue = {id:'ready-cue',kind:'gate',conditionRef:'ready',timeoutMs:1000,instruction:'Wait for server acknowledgment.'};
function harness(options={}) {
  let now=0,serial=0,visible=true,listener=null;const timers=new Map();
  const h=createGuidance({now:()=>now,setTimer:(fn,ms)=>{timers.set(++serial,{fn,at:now+ms});return serial;},clearTimer:id=>timers.delete(id),
    activity:{isActive:()=>visible,subscribe:fn=>{listener=fn;return()=>{listener=null;};}},...options});
  return {h,timers,advance(ms){now+=ms;for(const [id,timer]of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}},visible(value){visible=value;listener?.();}};
}
function condition(initial=false,options={}) {
  let state=initial,revision=0;const listeners=new Set();let cleanups=0;
  return {adapter:{evidence:'server',read:()=>({satisfied:state,revision}),subscribe:fn=>{listeners.add(fn);return()=>{listeners.delete(fn);cleanups++;};},...options},
    set(value){state=value;revision++;for(const fn of [...listeners])fn();},listeners,cleanups:()=>cleanups};
}
function action(overrides={}) { return {impact:'persistent',idempotent:true,validate:args=>typeof args.value==='string',execute:()=>({completed:true}),...overrides}; }

test('script declarations cannot authorize a host action', async()=>{
  let calls=0;const {h}=harness({actions:{save:action({execute:()=>{calls++;return {completed:true};}})}});
  await assert.rejects(h.enter(actionCue,context()),code('CAPABILITY_DENIED'));assert.equal(calls,0);h.destroy();
});
test('an approved action executes once with bound parameters and a stable idempotency key',async()=>{
  const requests=[],executions=[];const {h}=harness({authorize:req=>{requests.push(req);return true;},actions:{save:action({execute:(args,req)=>{executions.push(req);assert.equal(Object.isFrozen(args),true);return {completed:true};}})}});
  await h.enter(actionCue,context());await h.enter(actionCue,context());assert.equal(executions.length,1);assert.ok(executions[0].idempotencyKey);
  assert.ok(requests.length>=3);assert.equal(requests[0].script.id,'tour');
  await assert.rejects(h.enter({...actionCue,args:{value:'changed'}},context()),code('ACTION_BINDING_CHANGED'));assert.equal(executions.length,1);h.destroy();
});
test('persistent actions cannot be smuggled through watch or try mode',async()=>{
  const {h}=harness({authorize:()=>true,actions:{save:action()}});
  for(const mode of ['watch','try'])await assert.rejects(h.enter(actionCue,context(mode)),code('ACTION_MODE_DENIED'));h.destroy();
});
test('validation and undeclared capabilities fail before dispatch',async()=>{
  let calls=0;const {h}=harness({authorize:()=>true,actions:{save:action({execute:()=>calls++})}});
  await assert.rejects(h.enter({...actionCue,args:{value:3}},context()),code('ACTION_ARGUMENTS'));
  const c=context();c.script.capabilities=[];await assert.rejects(h.enter(actionCue,c),code('CAPABILITY_UNDECLARED'));assert.equal(calls,0);h.destroy();
});
test('recheck permission after asynchronous preconditions',async()=>{
  let granted=true,resolve,calls=0;const {h}=harness({authorize:()=>granted,actions:{save:action({check:()=>new Promise(r=>resolve=r),execute:()=>calls++})}});
  const result=h.enter(actionCue,context());await flush();granted=false;resolve(true);await assert.rejects(result,code('CAPABILITY_DENIED'));
  assert.equal(calls,0);assert.equal(h.inspect()[0].state,'not-started');h.destroy();
});
test('timeout after dispatch is unknown, blocks retry, and requires reconciliation',async()=>{
  let calls=0,resolve;const {h,advance}=harness({authorize:()=>true,actions:{save:action({execute:()=>{calls++;return new Promise(r=>resolve=r);},reconcile:()=> 'succeeded'})}});
  const result=h.enter(actionCue,context());await flush();advance(1001);await assert.rejects(result,code('TIMEOUT'));
  assert.equal(h.inspect()[0].state,'unknown');await assert.rejects(h.enter(actionCue,context()),code('ACTION_OUTCOME_UNKNOWN'));
  resolve({completed:true});await flush();assert.equal(h.inspect()[0].state,'unknown');
  await h.reconcile(h.inspect()[0].key);await h.enter(actionCue,context());assert.equal(calls,1);h.destroy();
});
test('abort before approval never invokes an action',async()=>{
  const parent=new AbortController();let approve,calls=0;const {h}=harness({authorize:()=>new Promise(r=>approve=r),actions:{save:action({execute:()=>calls++})}});
  const result=h.enter(actionCue,context(),parent.signal);await flush();parent.abort();await assert.rejects(result,code('CANCELLED'));
  approve(true);await flush();assert.equal(calls,0);h.destroy();
});
test('cancellation after dispatch remains unknown and the ledger is value-redacted',async()=>{
  let resolve;const parent=new AbortController();const {h}=harness({authorize:()=>true,actions:{save:action({execute:()=>new Promise(r=>resolve=r)})}});
  const result=h.enter(actionCue,context(),parent.signal);await flush();parent.abort();await assert.rejects(result,code('CANCELLED'));resolve({completed:true});await flush();
  assert.equal(h.inspect()[0].state,'unknown');assert.ok(!JSON.stringify(h.inspect()).includes('synthetic'));h.destroy();
});
test('level condition observes an already-completed host outcome and cleans up once',async()=>{
  const c=condition(true);const {h,timers}=harness({authorize:()=>true,conditions:{ready:c.adapter}});
  assert.deepEqual(await h.enter(gateCue,context()),{completed:true,evidence:'server'});assert.equal(c.listeners.size,0);assert.equal(c.cleanups(),1);assert.equal(timers.size,0);h.destroy();
});
test('edge condition waits for a newer revision even when old state is true',async()=>{
  const c=condition(true,{trigger:'edge'});const {h}=harness({authorize:()=>true,conditions:{ready:c.adapter}});
  let done=false;const result=h.enter(gateCue,context()).then(v=>{done=true;return v;});await flush();assert.equal(done,false);
  c.set(true);await result;assert.equal(done,true);assert.equal(c.cleanups(),1);h.destroy();
});
test('a state change during subscription setup cannot be lost',async()=>{
  let value=false,cleanups=0;const {h}=harness({authorize:()=>true,conditions:{ready:{evidence:'domain',read:()=>value,subscribe:fn=>{value=true;fn();return()=>cleanups++;}}}});
  await h.enter(gateCue,context());assert.equal(cleanups,1);h.destroy();
});
test('synchronous condition callbacks cannot hide malformed subscription cleanup',async()=>{
  const {h}=harness({authorize:()=>true,conditions:{ready:{evidence:'ui',read:()=>true,subscribe:fn=>{fn();return null;}}}});
  await assert.rejects(h.enter(gateCue,context()),code('CONDITION_INVALID'));h.destroy();
});
test('gate timeout consumes foreground time, not time spent in a hidden page',async()=>{
  const c=condition();const {h,advance,visible}=harness({authorize:()=>true,conditions:{ready:c.adapter}});
  const result=h.enter(gateCue,context());await flush();advance(400);visible(false);advance(9000);await flush();assert.equal(c.listeners.size,1);
  visible(true);advance(599);await flush();assert.equal(c.listeners.size,1);advance(2);await assert.rejects(result,code('TIMEOUT'));assert.equal(c.listeners.size,0);h.destroy();
});
test('authorization timeout cannot be mistaken for an authored skip-scene outcome',async()=>{
  const c=condition();const {h,advance}=harness({authorize:()=>new Promise(()=>{}),conditions:{ready:c.adapter}});
  const result=h.enter({...gateCue,onTimeout:'skip-scene'},context());await flush();advance(1001);await assert.rejects(result,code('TIMEOUT'));assert.equal(c.listeners.size,0);h.destroy();
});
test('only an observed condition deadline can produce declared skip-scene',async()=>{
  const c=condition();const {h,advance}=harness({authorize:()=>true,conditions:{ready:c.adapter}});
  const result=h.enter({...gateCue,onTimeout:'skip-scene'},context());await flush();advance(1001);assert.deepEqual(await result,{skipScene:true});h.destroy();
});
test('revoke cancels an active condition and blocks future permission attempts',async()=>{
  const c=condition();const {h}=harness({authorize:()=>true,conditions:{ready:c.adapter}});
  const result=h.enter(gateCue,context());await flush();h.revoke();await assert.rejects(result,code('CAPABILITY_REVOKED'));assert.equal(c.listeners.size,0);
  await assert.rejects(h.enter(gateCue,context()),code('CAPABILITY_REVOKED'));h.destroy();
});
test('Try needs an isolated fixture and reset requires exact host authorization',async()=>{
  let calls=0;const {h}=harness({fixture:{isolated:true,reset:()=>{calls++;return {completed:true};}}});h.preflight(context('try').script,'try');
  await assert.rejects(h.reset(context('try')),code('CAPABILITY_DENIED'));assert.equal(calls,0);h.destroy();
  const other=harness().h;assert.throws(()=>other.preflight(context('try').script,'try'),code('FIXTURE_REQUIRED'));other.destroy();
});
test('ambiguous fixture reset blocks a second reset',async()=>{
  let calls=0;const {h,advance}=harness({authorize:()=>true,fixture:{isolated:true,timeoutMs:1000,reset:()=>{calls++;return new Promise(()=>{});}}});
  const result=h.reset(context('try'));await flush();advance(1001);await assert.rejects(result,code('TIMEOUT'));
  await assert.rejects(h.reset(context('try')),code('FIXTURE_REQUIRED'));assert.equal(calls,1);h.destroy();
});
test('effect ledger capacity never evicts evidence needed for safe deduplication',async()=>{
  let calls=0;const {h}=harness({maxLedger:1,authorize:()=>true,actions:{save:action({execute:()=>{calls++;return {completed:true};}})}});
  await h.enter(actionCue,context());await assert.rejects(h.enter({...actionCue,id:'another'},context()),code('ACTION_LEDGER_FULL'));await h.enter(actionCue,context());assert.equal(calls,1);h.destroy();
});
test('mode preparation is an explicit separately authorized operation',async()=>{
  const requests=[];const {h}=harness({authorize:req=>{requests.push(req);return req.capability==='mode:guide';}});
  await h.prepareMode(context());await assert.rejects(h.prepareMode(context('watch')),code('CAPABILITY_DENIED'));assert.equal(requests[0].capability,'mode:guide');h.destroy();
});
test('large action bindings cannot exceed the retained-text budget',async()=>{
  const {h}=harness({maxLedgerBytes:1024,authorize:()=>true,actions:{save:action()}});
  await assert.rejects(h.enter({...actionCue,args:{value:'x'.repeat(2000)}},context()),code('ACTION_LEDGER_FULL'));
  assert.equal(h.inspect().length,0);h.destroy();
});
