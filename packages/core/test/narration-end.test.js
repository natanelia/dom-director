import test from 'node:test';
import assert from 'node:assert/strict';
import {NarrationClock} from '../src/narration.js';
class Audio extends EventTarget {
  currentTime=0;readyState=4;seeking=false;ended=false;paused=true;duration=1;
  play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}load(){}removeAttribute(){}
}
function fixture(options={}){
  let now=0;const audio=new Audio();
  const clock=new NarrationClock({now:()=>now,enabled:true,resolveAsset:()=> 'https://example.test/voice.wav',createAudio:()=>audio,...options});
  clock.setScene({id:'intro',durationMs:5000,narration:{audioAsset:'voice'}});
  return {clock,audio,advance:ms=>now+=ms};
}
test('a verified natural media end hands off continuously without finishing the scene',async()=>{
  const f=fixture();f.clock.start();await Promise.resolve();
  f.advance(900);f.audio.currentTime=.9;assert.equal(f.clock.read(),900);
  f.advance(100);f.audio.currentTime=1;f.audio.ended=true;f.audio.dispatchEvent(new Event('ended'));
  assert.equal(f.clock.authority,'text');assert.equal(f.clock.error,null);assert.equal(f.clock.read(),900);
  f.advance(200);assert.equal(f.clock.read(),1100);assert.equal(f.clock.running,true);f.clock.destroy();
});
test('repeated waiting notifications cannot extend a stalled decoder forever',async()=>{
  const f=fixture({stallMs:200});f.clock.start();await Promise.resolve();
  f.audio.dispatchEvent(new Event('waiting'));f.advance(150);f.audio.dispatchEvent(new Event('waiting'));
  f.advance(51);f.clock.read();assert.equal(f.clock.error,'MEDIA_STALLED');f.clock.destroy();
});
