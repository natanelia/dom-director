import test from 'node:test';
import assert from 'node:assert/strict';
import {timingRows, LINKED_STUDIO_VERSION} from '../src/timing.js';

// Internal resolver fixtures isolate lookup work from the public data validator.
function fixture(words, count = 300) {
  return {studioVersion: LINKED_STUDIO_VERSION, tracks: [
    {kind:'captions', clips:[{id:'cc', sceneId:'scene', startMs:0, words}]},
    {kind:'camera', clips:[{id:'motion', sceneId:'scene', startMs:0, offsetMs:0,
      keys:Array.from({length:count}, (_,i)=>({id:'key'+i, timing:{captionId:'cc',wordId:'word399',boundary:'start',offsetMs:i}}))}]},
  ]};
}
test('resolver indexes each referenced word once rather than scanning per key', () => {
  let reads = 0;
  const words = Array.from({length:400}, (_,i)=>({get id(){reads++;return 'word'+i;},startMs:i,endMs:i+1}));
  const rows = timingRows(fixture(words));
  assert.equal(rows.length,300);assert.equal(reads,400);
  assert.ok(rows.every(row=>row.wordIndex===399 && row.baseMs===399));
});
test('word index is rebuilt for every resolution pass, preserving edits', () => {
  const words = [{id:'word399',startMs:10,endMs:20}], project = fixture(words,1);
  assert.equal(timingRows(project)[0].wordIndex,0);
  words.unshift({id:'earlier',startMs:0,endMs:5});
  assert.equal(timingRows(project)[0].wordIndex,1);
  words[1].id='removed';assert.throws(()=>timingRows(project),/linked word is missing/);
});
test('internal first-match semantics and missing-word diagnostics are preserved', () => {
  assert.equal(timingRows(fixture([{id:'word399',startMs:1},{id:'word399',startMs:2}],1))[0].baseMs,1);
  assert.throws(()=>timingRows(fixture([],1)),/linked word is missing/);
  assert.throws(()=>timingRows(fixture(undefined,1)),/linked word is missing/);
});
test('unreferenced captions are not indexed', () => {
  const project=fixture([{id:'word399',startMs:1,endMs:2}],1);
  project.tracks[0].clips.push({id:'unused',sceneId:'scene',startMs:0,words:[{get id(){throw Error('Unreferenced words scanned');}}]});
  assert.equal(timingRows(project).length,1);
});
