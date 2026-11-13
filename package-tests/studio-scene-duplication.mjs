import assert from 'node:assert/strict';
import {createSample,createProjectStore} from '@dom-director/studio';
import {duplicateScene,deleteScene} from '@dom-director/studio/editing';
assert.equal(typeof document,'undefined');
const p=createSample(),r=duplicateScene(p,'overview'),store=createProjectStore(p);
assert.equal(r.value.scenes[1].id,r.sceneId);assert.deepEqual(r.value.assets,p.assets);
assert.deepEqual(deleteScene(r.value,r.sceneId),p);
store.commit(r.value,'Duplicate scene',0);assert.deepEqual(store.undo().project,p);
console.log('Installed scene duplication consumer passed');
