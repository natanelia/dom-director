import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameLoop} from '../src/frame-loop.js';
function fixture() {
  let serial=0, active=true, ticks=0;
  const queued=new Map(), cancelled=[], errors=[];
  const scheduler={request(fn){queued.set(++serial,fn);return serial;},cancel(id){cancelled.push(id);queued.delete(id);}};
  const loop=createFrameLoop(scheduler,()=>active,()=>ticks++,error=>errors.push(error));
  return {loop,queued,cancelled,errors,get ticks(){return ticks;},stop(){active=false;loop.sync();},start(){active=true;loop.sync();},fire(){const [id,fn]=queued.entries().next().value;queued.delete(id);fn();}};
}
test('repeated scheduling retains the first frame instead of starving it',()=>{
  const f=fixture();f.loop.sync();const first=[...f.queued.keys()][0];
  for(let i=0;i<1000;i++)f.loop.sync();
  assert.deepEqual([...f.queued.keys()],[first]);assert.equal(f.cancelled.length,0);
  f.fire();assert.equal(f.ticks,1);assert.equal(f.queued.size,1);f.loop.destroy();assert.equal(f.queued.size,0);
});
test('cancelled callbacks cannot tick or overwrite the new pending frame',()=>{
  const f=fixture();f.loop.sync();const stale=[...f.queued.values()][0];f.stop();f.start();
  const pending=[...f.queued.keys()];stale();assert.equal(f.ticks,0);assert.deepEqual([...f.queued.keys()],pending);
  f.fire();assert.equal(f.ticks,1);f.loop.destroy();f.loop.sync();assert.equal(f.queued.size,0);
});
test('a stop or destruction during a frame cannot schedule another frame',()=>{
  let loop,callback,requests=0,active=true;
  const scheduler={request(fn){callback=fn;return ++requests;},cancel(){}};
  loop=createFrameLoop(scheduler,()=>active,()=>{active=false;loop.sync();},()=>{});
  loop.sync();callback();assert.equal(requests,1);loop.destroy();
});
