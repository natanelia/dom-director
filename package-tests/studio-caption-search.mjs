import assert from 'node:assert/strict';
import {createSample,createProjectStore,findClip} from '@dom-director/studio';
import {distributeCaptionWords} from '@dom-director/studio/editing';
import {linkKeyframeToCaptionWord} from '@dom-director/studio/timing-links';
import {findCaptionMatches,proposeCaptionReplacement} from '@dom-director/studio/caption-search';
assert.equal(typeof document,'undefined');
const project=linkKeyframeToCaptionWord(distributeCaptionWords(createSample(),'cc.overview.0'),
  'camera.overview','camera.to.overview',{captionId:'cc.overview.0',wordIndex:1,offsetMs:200});
const store=createProjectStore(project),snapshot=store.snapshot();
const found=findCaptionMatches(snapshot.project,{query:'product'});
assert.equal(found.captions.length,1);
const result=proposeCaptionReplacement(snapshot.project,{query:'product',replacement:'walkthrough',clipIds:[found.captions[0].clipId]});
assert.equal(result.detachedLinks.length,1);
assert.equal(findClip(result.value,'camera.overview').clip.keys[1].atMs,findClip(project,'camera.overview').clip.keys[1].atMs);
store.commit(result.value,'Reviewed replacement',snapshot.revision);
assert.deepEqual(store.undo().project,project);
assert.equal(findClip(project,'cc.overview.0').clip.text,'This looks like a product video.');
console.log('Installed caption search, reviewed replacement and undo passed');
