import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentBridge,proposeTargetRepair,AGENT_PROTOCOL_VERSION} from '../src/agent.js';

const tour=()=>({schemaVersion:'0.1.0-draft.1',id:'agent-tour',title:'Agent tour',locale:'en',entryScene:'one',modes:['watch'],capabilities:[],targets:{button:{ref:'app.button'}},scenes:[
  {id:'one',title:'One',summary:'A real control',durationMs:1000,cues:[{id:'camera',kind:'camera',at:0,durationMs:500,target:'button'}]}]});
function fixture(options={}){
  const calls=[],state={revision:0,status:'ready',runId:'run.1',sceneId:'one',mode:'watch',timeMs:0,durationMs:1000,
    caption:'secret caption',effects:[{key:'secret operation',args:{token:'secret token'}}],waitingFor:null};
  const director={sessionId:'director.1',registry:{revision:1,catalog:()=>[{id:'app.button',label:'Button',kind:'dom'},{id:'app.ungranted',label:'Other',kind:'dom'}]},
    inspect:()=>({...state}),load(script){calls.push(['load',script]);state.revision++;return {ok:true};},
    play(){calls.push(['play']);state.status='playing';state.revision++;return {ok:true};},
    pause(){calls.push(['pause']);state.status='paused';state.revision++;return {ok:true};},
    seek(params){calls.push(['seek']);Object.assign(state,params);state.revision++;return {ok:true};},
    stop(){calls.push(['stop']);state.status='ready';state.revision++;return {ok:true};}};
  const bridge=createAgentBridge(director,{clientId:'client.1',targetIds:['app.button'],authorize:()=>true,...options});
  let serial=0;
  const envelope=(command,params={},extra={})=>({protocolVersion:AGENT_PROTOCOL_VERSION,requestId:'req.'+(++serial),sessionId:director.sessionId,
    ...(['load','play','seek'].includes(command)?{expectedRevision:state.revision}:{}),command,params,...extra});
  return {bridge,director,state,calls,envelope,send:(command,params={},extra={})=>bridge.handle(JSON.stringify(envelope(command,params,extra)))};
}
const code=result=>result.diagnostics?.[0].code;
const tick=()=>new Promise(r=>setImmediate(r));

test('default policy denies even inspection',async()=>{
  const f=fixture({authorize:undefined});assert.equal(code(await f.send('inspect')),'CAPABILITY_DENIED');assert.equal(f.calls.length,0);f.bridge.destroy();
});
test('discovery only exposes granted public metadata, never DOM values',async()=>{
  const f=fixture();const r=await f.send('discoverTargets',{query:'button',limit:1});
  assert.equal(r.ok,true);assert.equal(r.value.targets.length,1);assert.equal(r.value.targets[0].id,'app.button');
  assert.equal(JSON.stringify(r).includes('secret'),false);assert.equal(f.calls.length,0);f.bridge.destroy();
});
test('inspection is a fixed redacted summary',async()=>{
  const f=fixture();const r=await f.send('inspect');assert.equal(r.ok,true);assert.equal(r.value.sceneId,'one');
  assert.equal(JSON.stringify(r).includes('secret'),false);assert.equal('caption' in r.value,false);f.bridge.destroy();
});
test('capability metadata is descriptive, not a grant',async()=>{
  const f=fixture({commands:['getCapabilities','inspect']});const r=await f.send('getCapabilities');
  assert.deepEqual(r.value.offeredCommands,['getCapabilities','inspect']);assert.equal(r.value.authorizationRequired,true);
  assert.equal(code(await f.send('play')),'COMMAND_DENIED');f.bridge.destroy();
});
test('validation and preview are pure and never load/play',async()=>{
  const f=fixture();const valid=await f.send('validate',{script:tour()});const p=await f.send('preview',{script:tour()});
  assert.equal(valid.ok,true);assert.equal(valid.value.binding,'unchecked');assert.equal(p.value.static,true);assert.deepEqual(f.calls,[]);f.bridge.destroy();
});
test('semantic compilation failures remain structured',async()=>{
  const f=fixture(),script=tour();script.scenes[0].cues[0].target='unknown';
  const r=await f.send('validate',{script});assert.equal(code(r),'TARGET_REFERENCE');assert.deepEqual(f.calls,[]);f.bridge.destroy();
});
test('mutating commands require and recheck revision',async()=>{
  const f=fixture();assert.equal((await f.send('load',{script:tour()})).ok,true);
  assert.equal(code(await f.send('play',{}, {expectedRevision:0})),'REVISION_CONFLICT');assert.equal(f.calls.length,1);
  assert.equal((await f.send('play')).ok,true);f.bridge.destroy();
});
test('stale pause and stop remain safe commands, but still need a grant',async()=>{
  const f=fixture();assert.equal((await f.send('pause',{}, {expectedRevision:999})).ok,true);assert.equal((await f.send('stop',{}, {expectedRevision:999})).ok,true);
  assert.deepEqual(f.calls.map(c=>c[0]),['pause','stop']);f.bridge.destroy();
});
test('load cannot guess an ungranted target',async()=>{
  const f=fixture(),script=tour();script.targets.button.ref='app.ungranted';
  assert.equal(code(await f.send('load',{script})),'TARGET_DENIED');assert.equal(f.calls.length,0);f.bridge.destroy();
});
test('duplicate request executes once and returns the original result',async()=>{
  const f=fixture(),req=f.envelope('play');const a=await f.bridge.handle(JSON.stringify(req));const b=await f.bridge.handle(JSON.stringify(req));
  assert.equal(a.ok,true);assert.equal(b.cached,true);assert.equal(a.revision,b.revision);assert.equal(f.calls.length,1);f.bridge.destroy();
});
test('request ID reuse with different payload is rejected',async()=>{
  const f=fixture(),req=f.envelope('play');await f.bridge.handle(JSON.stringify(req));
  assert.equal(code(await f.bridge.handle(JSON.stringify({...req,command:'stop'}))),'REQUEST_ID_REUSED');assert.equal(f.calls.length,1);f.bridge.destroy();
});
test('canonical key order does not cause false ID reuse',async()=>{
  const f=fixture(),req=f.envelope('play');await f.bridge.handle(JSON.stringify(req));
  const reordered=Object.fromEntries(Object.entries(req).reverse());assert.equal((await f.bridge.handle(JSON.stringify(reordered))).cached,true);assert.equal(f.calls.length,1);f.bridge.destroy();
});
test('concurrent duplicate request shares one execution',async()=>{
  let release;const f=fixture({authorize:req=>req.phase==='cached-result'?true:new Promise(r=>release=r)}),req=JSON.stringify(f.envelope('play'));
  const first=f.bridge.handle(req);while(!release)await tick();const second=f.bridge.handle(req);release(true);
  const [a,b]=await Promise.all([first,second]);assert.equal(a.ok,true);assert.equal(b.ok,true);assert.equal(f.calls.length,1);f.bridge.destroy();
});
test('cached responses require current authorization too',async()=>{
  let allowed=true;const f=fixture({authorize:()=>allowed}),req=JSON.stringify(f.envelope('play'));
  assert.equal((await f.bridge.handle(req)).ok,true);allowed=false;
  assert.equal(code(await f.bridge.handle(req)),'CAPABILITY_DENIED');assert.equal(f.calls.length,1);f.bridge.destroy();
});
test('a user command during async authorization prevents stale play',async()=>{
  let release;const f=fixture({authorize:()=>new Promise(r=>release=r)});const pending=f.send('play');
  while(!release)await tick();f.director.pause();release(true);
  assert.equal(code(await pending),'REVISION_CONFLICT');assert.deepEqual(f.calls.map(c=>c[0]),['pause']);f.bridge.destroy();
});
test('revoke cancels authorization and late approval cannot execute',async()=>{
  let release;const f=fixture({authorize:()=>new Promise(r=>release=r)});const pending=f.send('play');
  while(!release)await tick();f.bridge.revoke();assert.equal(code(await pending),'AGENT_REVOKED');release(true);await tick();
  assert.deepEqual(f.calls,[]);assert.equal(code(await f.send('inspect')),'AGENT_REVOKED');f.bridge.destroy();
});
test('timeouts settle without executing and retain a deduplicated failure',async()=>{
  const f=fixture({timeoutMs:20,authorize:()=>new Promise(()=>{})});const r=await f.send('play');
  assert.equal(code(r),'AGENT_TIMEOUT');assert.equal(f.calls.length,0);assert.equal(f.bridge.inspect().pending,0);f.bridge.destroy();
});
test('explicit cancellation is not consent and has no late effect',async()=>{
  const f=fixture(),controller=new AbortController();controller.abort();
  assert.equal(code(await f.bridge.handle(JSON.stringify(f.envelope('play')),{signal:controller.signal})),'CANCELLED');assert.equal(f.calls.length,0);f.bridge.destroy();
});
test('a full ledger does not evict earlier deduplication evidence',async()=>{
  const f=fixture({maxRequests:1}),req=JSON.stringify(f.envelope('play'));
  assert.equal((await f.bridge.handle(req)).ok,true);assert.equal(code(await f.send('inspect')),'AGENT_LEDGER_FULL');
  assert.equal((await f.bridge.handle(req)).cached,true);assert.equal(f.calls.length,1);f.director.stop();assert.equal(f.state.status,'ready');f.bridge.destroy();
});
test('pause remains available while a normal authorization slot is occupied',async()=>{
  let release;const f=fixture({maxPending:1,authorize:req=>req.command==='play'?new Promise(r=>release=r):true});
  const pending=f.send('play');while(!release)await tick();assert.equal(code(await f.send('inspect')),'AGENT_BUSY');
  assert.equal((await f.send('stop')).ok,true);release(true);assert.equal(code(await pending),'REVISION_CONFLICT');f.bridge.destroy();
});
test('malformed, duplicate-key, reserved-key and oversized JSON are rejected',async()=>{
  const f=fixture();const req=JSON.stringify(f.envelope('inspect'));
  for(const text of ['{',req.replace('"params":{}','"params":{},"params":{}'),req.replace('"params":{}','"params":{"__proto__":{}}'),' '.repeat(1024*1024+1)]){
    assert.equal((await f.bridge.handle(text)).ok,false);
  }
  assert.equal(f.calls.length,0);f.bridge.destroy();
});
test('wrong sessions, arbitrary methods and unsafe revisions are rejected',async()=>{
  const f=fixture();assert.equal(code(await f.send('inspect',{}, {sessionId:'director.other'})),'SESSION_MISMATCH');
  assert.equal((await f.send('constructor')).ok,false);assert.equal(code(await f.send('play',{}, {expectedRevision:1e20})),'REVISION_INVALID');f.bridge.destroy();
});
test('invalid request IDs cannot inflate an error response',async()=>{
  const f=fixture(),r=await f.bridge.handle(JSON.stringify(f.envelope('inspect',{}, {requestId:{large:'x'.repeat(90000)}})));
  assert.equal(r.ok,false);assert.equal(r.requestId,null);assert.ok(JSON.stringify(r).length<1000);f.bridge.destroy();
});
test('host errors are redacted rather than echoed to an agent',async()=>{
  const f=fixture({authorize:()=>{throw Error('secret credential');}});const r=await f.send('play');
  assert.equal(code(r),'HOST_FAILURE');assert.equal(JSON.stringify(r).includes('secret'),false);f.bridge.destroy();
});
test('one client owner and idempotent detached cleanup',()=>{
  const f=fixture();assert.throws(()=>createAgentBridge(f.director,{clientId:'client.1'}),/already/);
  const destroy=f.bridge.destroy;destroy();const b=createAgentBridge(f.director,{clientId:'client.1'});destroy();
  assert.throws(()=>createAgentBridge(f.director,{clientId:'client.1'}),/already/);b.destroy();
});
test('repair is a hashed data-only proposal and cannot change the original',async()=>{
  const input=tour(),original=JSON.stringify(input);
  const r=await proposeTargetRepair(input,{alias:'button',replacement:'app.replacement',reason:'Host moved the save control.'},[{id:'app.replacement'}]);
  assert.equal(r.ok,true);assert.equal(r.value.requiresHostReview,true);assert.match(r.value.baseHash,/^[a-f0-9]{64}$/);
  assert.deepEqual(r.value.affectedCues,[{sceneId:'one',cueId:'camera'}]);assert.equal(r.value.patch[0].op,'test');assert.equal(r.value.patch[1].value,'app.replacement');
  assert.equal(JSON.stringify(input),original);
});
test('repair refuses unknown, ambiguous and unchanged targets',async()=>{
  for(const catalog of [[],[{id:'app.new'},{id:'app.new'}]]){
    assert.equal(code(await proposeTargetRepair(tour(),{alias:'button',replacement:'app.new',reason:'Move'},catalog)),'TARGET_DENIED');
  }
  assert.equal(code(await proposeTargetRepair(tour(),{alias:'button',replacement:'app.button',reason:'Same'},[{id:'app.button'}])),'REPAIR_UNCHANGED');
});
test('repair rejects missing options and explicitly sensitive candidates',async()=>{
  assert.equal(code(await proposeTargetRepair(tour())),'REPAIR_INVALID');
  assert.equal(code(await proposeTargetRepair(tour(),{alias:'button',replacement:'app.secret',reason:'Move'},[{id:'app.secret',sensitivity:'secret'}])),'TARGET_DENIED');
});
