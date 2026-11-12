import test from 'node:test';
import assert from 'node:assert/strict';
import {createSample,editProject,findClip} from '../src/index.js';
import {duplicateClips} from '../src/selection.js';
test('duplicated unlinked words preserve optional absent IDs',()=>{
 const p=editProject(createSample(),q=>{
   const t=q.tracks.find(t=>t.kind==='captions');
   t.clips=t.clips.filter(c=>c.sceneId!=='overview'||c.id==='cc.overview.0');
   const c=findClip(q,'cc.overview.0').clip;c.durationMs=2000;c.text='Read this.';
   c.words=[{text:'Read',startMs:0,endMs:500},{text:'this.',startMs:500,endMs:1000}];
 });
 const result=duplicateClips(p,['cc.overview.0'],2500);
 const words=findClip(result.value,result.clipIds[0]).clip.words;
 assert.deepEqual(words,findClip(p,'cc.overview.0').clip.words);
 assert.ok(words.every(word=>!Object.hasOwn(word,'id')));
});
