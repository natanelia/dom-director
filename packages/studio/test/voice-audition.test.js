import test from 'node:test';
import assert from 'node:assert/strict';
import {createTakeAuditioner} from '../src/media.js';
const asset=(id='take')=>({id,name:id,mime:'audio/wav',source:'local',durationMs:2000,sha256:'a'.repeat(64)});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({resume,load,startError=false,onState,timeoutMs}={}){
  const sources=[],gains=[],states=[],loads=[];let contexts=0;
  const context={state:'running',currentTime:12,destination:{},resume:resume||(()=>Promise.resolve()),
    createBufferSource(){const source={connected:false,stopped:false,onended:null,start(...args){this.args=args;if(startError)throw Error('Source rejected.');},connect(){this.connected=true;},stop(){this.stopped=true;},disconnect(){this.connected=false;}};sources.push(source);return source;},
    createGain(){const events=[],gain={connected:false,events,gain:{setValueAtTime(...args){events.push(['set',...args]);},linearRampToValueAtTime(...args){events.push(['ramp',...args]);}},connect(){this.connected=true;},disconnect(){this.connected=false;}};gains.push(gain);return gain;},
    close(){assert.fail('Audition must not close the shared context.');},suspend(){assert.fail('Audition must not suspend the shared context.');}};
  const bank={context(){contexts++;return context;},load(a,{signal}){loads.push({asset:a,signal});return load?load(a,signal):Promise.resolve({duration:2});}};
  const listener=createTakeAuditioner({bank,onState:s=>{states.push(s);onState?.(s);},...(timeoutMs?{timeoutMs}:{})});
  return {listener,context,sources,gains,states,loads,get contexts(){return contexts;}};
}
const clean=f=>{assert.ok(f.sources.every(s=>!s.connected&&s.onended===null));assert.ok(f.gains.every(g=>!g.connected));};
test('creation is silent and disposal never owns the shared context',()=>{
  const f=fixture();assert.equal(f.contexts,0);assert.equal(f.listener.inspect().state,'idle');f.listener.stop();f.listener.destroy();assert.equal(f.contexts,0);assert.equal(f.listener.inspect().state,'destroyed');
});
test('explicit play schedules the current source trim, gain and fades without changing input',async()=>{
  const f=fixture(),take=asset(),before=JSON.stringify(take);
  assert.deepEqual(await f.listener.play(take,{sourceInMs:200,durationMs:1000,gain:.7,fadeInMs:100,fadeOutMs:200}),{status:'playing'});
  assert.deepEqual(f.sources[0].args,[12,.2,1]);assert.deepEqual(f.gains[0].events,[['set',0,12],['ramp',.7,12.1],['set',.7,12.8],['ramp',0,13]]);
  assert.equal(JSON.stringify(take),before);f.listener.destroy();clean(f);
});
test('full-take audition uses decoded duration rather than approximate catalog metadata',async()=>{
  const f=fixture();await f.listener.play({...asset(),durationMs:2150});assert.deepEqual(f.sources[0].args,[12,0,2]);f.listener.destroy();
});
test('ending releases nodes and replay uses a new one-shot source',async()=>{
  const f=fixture();await f.listener.play(asset());f.sources[0].onended();assert.equal(f.listener.inspect().state,'ended');clean(f);
  await f.listener.play(asset());assert.equal(f.sources.length,2);f.listener.destroy();clean(f);
});
test('A/B switching disconnects the first source before starting the second',async()=>{
  const f=fixture();await f.listener.play(asset('a'));const oldEnd=f.sources[0].onended;
  await f.listener.play(asset('b'));assert.equal(f.sources[0].stopped,true);assert.equal(f.sources[0].connected,false);
  oldEnd();assert.equal(f.listener.inspect().assetId,'b');assert.equal(f.listener.inspect().state,'playing');f.listener.destroy();clean(f);
});
test('stopping a blocked resume settles promptly and late permission cannot start audio',async()=>{
  const gate=deferred(),f=fixture({resume:()=>gate.promise});const pending=f.listener.play(asset());f.listener.stop();
  assert.deepEqual(await pending,{status:'cancelled'});gate.resolve();await tick();assert.equal(f.sources.length,0);assert.equal(f.loads.length,0);f.listener.destroy();
});
test('switching during decode cancels old work, including its late failure',async()=>{
  const gate=deferred(),f=fixture({load:a=>a.id==='a'?gate.promise:Promise.resolve({duration:2})});
  const first=f.listener.play(asset('a'));await tick();await f.listener.play(asset('b'));assert.deepEqual(await first,{status:'cancelled'});
  gate.reject(Error('Old decoder failed.'));await tick();assert.equal(f.sources.length,1);assert.equal(f.listener.inspect().assetId,'b');assert.equal(f.loads[0].signal.aborted,true);f.listener.destroy();
});
test('a pre-aborted signal neither loads nor starts the take',async()=>{
  const f=fixture(),c=new AbortController();c.abort();assert.equal((await f.listener.play(asset(),{signal:c.signal})).status,'cancelled');assert.equal(f.contexts,0);f.listener.destroy();
});
test('external cancellation stops playing and detaches its signal listener',async()=>{
  const f=fixture(),c=new AbortController();let owned=0;const add=c.signal.addEventListener.bind(c.signal),remove=c.signal.removeEventListener.bind(c.signal);
  c.signal.addEventListener=(...args)=>{owned++;return add(...args);};c.signal.removeEventListener=(...args)=>{owned--;return remove(...args);};
  await f.listener.play(asset(),{signal:c.signal});assert.equal(owned,1);c.abort();assert.equal(owned,0);assert.equal(f.listener.inspect().state,'idle');clean(f);f.listener.destroy();
});
test('successful completion also detaches the external signal',async()=>{
  const f=fixture(),c=new AbortController();await f.listener.play(asset('a'),{signal:c.signal});f.sources[0].onended();await f.listener.play(asset('b'));c.abort();assert.equal(f.listener.inspect().assetId,'b');f.listener.destroy();
});
test('startup timeout reports a recoverable error and never starts a late take',async()=>{
  const gate=deferred(),f=fixture({load:()=>gate.promise,timeoutMs:5});const result=await f.listener.play(asset());assert.equal(result.status,'error');assert.match(result.error,/in time/);assert.equal(f.listener.inspect().state,'error');
  gate.resolve({duration:2});await tick();assert.equal(f.sources.length,0);f.listener.destroy();
});
test('blocked audio and decoder errors do not leave nodes or escape as rejected promises',async()=>{
  for(const options of [{resume:()=>Promise.reject(Error('Permission denied.'))},{load:()=>Promise.reject(Error('Bad audio.'))},{startError:true}]){
    const f=fixture(options);assert.equal((await f.listener.play(asset())).status,'error');assert.equal(f.listener.inspect().state,'error');clean(f);f.listener.destroy();
  }
});
test('interrupted context after decode fails instead of claiming audible playback',async()=>{
  const gate=deferred(),f=fixture({load:()=>gate.promise});const pending=f.listener.play(asset());await tick();f.context.state='suspended';gate.resolve({duration:2});assert.equal((await pending).status,'error');assert.equal(f.sources.length,0);f.listener.destroy();
});
test('invalid ranges and fades cannot silently truncate the requested clip',async()=>{
  for(const options of [{sourceInMs:-1},{sourceInMs:.5},{durationMs:0},{durationMs:NaN},{sourceInMs:1000,durationMs:1003},{gain:Infinity},{gain:2.1},{fadeInMs:2001},{fadeOutMs:-1},{fadeInMs:1000,fadeOutMs:1001}]){
    const f=fixture();assert.equal((await f.listener.play(asset(),options)).status,'error');assert.equal(f.sources.length,0);f.listener.destroy();
  }
});
test('rounding tolerance is bounded to two milliseconds and uses only available samples',async()=>{
  const f=fixture({load:()=>Promise.resolve({duration:1.9996})});await f.listener.play(asset(),{durationMs:2000});assert.equal(f.sources[0].args[2],1.9996);f.listener.destroy();
});
test('asset and options snapshots cannot be retargeted while decode is pending',async()=>{
  const gate=deferred(),f=fixture({load:()=>gate.promise}),take=asset('original'),options={gain:.4,durationMs:1200};
  const pending=f.listener.play(take,options);take.id='different';options.gain=2;await tick();gate.resolve({duration:2});await pending;
  assert.equal(f.loads[0].asset.id,'original');assert.equal(f.listener.inspect().assetId,'original');assert.deepEqual(f.gains[0].events,[['set',.4,12]]);f.listener.destroy();
});
test('destroy cancels pending work and rejects future playback without touching the bank',async()=>{
  const gate=deferred(),f=fixture({load:()=>gate.promise});const pending=f.listener.play(asset());await tick();f.listener.destroy();assert.deepEqual(await pending,{status:'cancelled'});
  gate.resolve({duration:2});await tick();const calls=f.contexts;assert.deepEqual(await f.listener.play(asset()),{status:'cancelled'});assert.equal(f.contexts,calls);clean(f);
});
test('host cancellation during loading-state notification prevents preparation',async()=>{
  let f;f=fixture({onState:s=>{if(s.state==='loading')f.listener.stop();}});assert.deepEqual(await f.listener.play(asset()),{status:'cancelled'});assert.equal(f.contexts,0);f.listener.destroy();
});
test('100 auditions release every owned source and gain on replacement and shutdown',async()=>{
  const f=fixture();for(let i=0;i<100;i++)await f.listener.play(asset('a'+i));assert.equal(f.sources.filter(s=>s.connected).length,1);f.listener.destroy();clean(f);assert.equal(f.sources.length,100);
});

test('rounding tolerance never reverses fade events at a shared boundary',async()=>{
  const f=fixture({load:()=>Promise.resolve({duration:1.9996})});await f.listener.play(asset(),{durationMs:2000,fadeInMs:1000,fadeOutMs:1000});
  const times=f.gains[0].events.map(e=>e[2]);assert.ok(times.every((t,i)=>i===0||t>=times[i-1]));f.listener.destroy();
});
