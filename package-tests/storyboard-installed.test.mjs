import test from 'node:test';
import assert from 'node:assert/strict';
import {compileStoryboard,readStoryboard} from '@dom-director/core/storyboard';
import {compile} from '@dom-director/core';
test('packed storyboard subpath works in Node without DOM globals',()=>{
  assert.equal(typeof document,'undefined');
  const result=compileStoryboard({version:1,id:'packed',title:'Packed',locale:'en',scenes:[{id:'one',title:'One',target:'app.one',description:'A text-only scene.',durationMs:1000,transitionMs:200,maxScale:2,cursor:false}]});
  assert.equal(result.ok,true);assert.equal(compile(result.value).ok,true);
  assert.equal(readStoryboard(result.value).value.scenes[0].id,'one');
});
