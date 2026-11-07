import test from 'node:test';
import assert from 'node:assert/strict';
import {createSample} from '../src/index.js';
import {createTransport,createMediaBank} from '../src/media.js';

test('a loop starts inside its captured range, not a mutable caller object',async()=>{
  let now=0,callback=null;
  const transport=createTransport({bank:{},now:()=>now,request:fn=>{callback=fn;return 1;},cancel:()=>{callback=null;}});
  const tick=ms=>{now+=ms;const fn=callback;callback=null;fn?.();};
  transport.load(createSample());
  const range={startMs:1000,endMs:2000};transport.setLoop(range);range.startMs=9000;range.endMs=10000;
  await transport.play();tick(200);assert.equal(transport.inspect().timeMs,1200);
  transport.seek(4000);await transport.play();tick(100);assert.equal(transport.inspect().timeMs,1100);
  transport.destroy();
});

test('pending sample requests reserve their source identity before decoding',async()=>{
  const originalFetch=globalThis.fetch;let release,fetches=0;
  const data=new Uint8Array([82,73,70,70,1,2,3,4]).buffer;
  globalThis.fetch=async()=>{fetches++;await new Promise(r=>release=r);return new Response(data,{status:200});};
  const bank=createMediaBank({contextFactory:()=>({state:'running',decodeAudioData:async()=>({duration:1,length:8,numberOfChannels:1,getChannelData:()=>new Float32Array(8)}),close:async()=>{}}),resolveSample:id=>'https://example.invalid/'+id});
  const asset={id:'shared',source:'sample',sample:'voice.one',durationMs:1000,mime:'audio/wav',name:'One'};
  try {
    const pending=bank.load(asset);
    await assert.rejects(bank.load({...asset,sample:'voice.two'}),/identity changed/);
    assert.equal(fetches,1);release();await pending;
    await assert.rejects(bank.ingest('shared','Two','audio/wav',data),/identity already exists/i);
  } finally {globalThis.fetch=originalFetch;await bank.destroy();}
});
