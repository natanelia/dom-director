import test from 'node:test';
import assert from 'node:assert/strict';
import {createSample,editProject,findClip,updateClip} from '../src/index.js';
import {distributeCaptionWords} from '../src/editing.js';
const id='cc.overview.0';

test('unequal word lengths get ordered equal intervals spanning the current caption',()=>{
  const p=updateClip(createSample(),id,{text:'I explain extraordinarily long labels.'});
  const q=distributeCaptionWords(p,id),before=findClip(p,id).clip,after=findClip(q,id).clip;
  assert.deepEqual(after.words.map(w=>w.text),['I','explain','extraordinarily','long','labels.']);
  assert.equal(after.words[0].startMs,0);assert.equal(after.words.at(-1).endMs,before.durationMs);
  after.words.forEach((w,i)=>{assert.ok(w.endMs>w.startMs);if(i)assert.equal(w.startMs,after.words[i-1].endMs);});
  assert.equal(before.words,undefined);assert.equal(after.text,before.text);
  assert.deepEqual(q.tracks.find(t=>t.kind==='voice'),p.tracks.find(t=>t.kind==='voice'));
});
test('word distribution uses updated text and preserves Unicode whitespace in the authored caption',()=>{
  let p=distributeCaptionWords(createSample(),id);
  p=editProject(p,n=>{const c=findClip(n,id).clip;c.text='你好\n  世界\t再见';delete c.words;});
  const c=findClip(distributeCaptionWords(p,id),id).clip;
  assert.equal(c.text,'你好\n  世界\t再见');assert.deepEqual(c.words.map(w=>w.text),['你好','世界','再见']);
});
test('single-word and millisecond-sized word timings have exact bounds',()=>{
  for(const text of ['Word','A bb ccc']){
    const n=text.split(' ').length,p=updateClip(createSample(),id,{text,durationMs:n});
    assert.deepEqual(findClip(distributeCaptionWords(p,id),id).clip.words.map(w=>({...w})),
      text.split(' ').map((text,i)=>({text,startMs:i,endMs:i+1})));
  }
});
test('word distribution rejects locked, wrong-kind, excessive and too-short clips without mutation',()=>{
  const p=createSample(),before=JSON.stringify(p);
  assert.throws(()=>distributeCaptionWords(p,'voice.overview'),/caption/);
  assert.throws(()=>distributeCaptionWords(editProject(p,n=>{findClip(n,id).track.locked=true;}),id),/locked/);
  assert.throws(()=>distributeCaptionWords(updateClip(p,id,{text:'a b',durationMs:1}),id),/too many words/);
  assert.throws(()=>distributeCaptionWords(updateClip(p,id,{text:Array(401).fill('a').join(' ')}),id),/too many words/);
  assert.equal(JSON.stringify(p),before);
});
