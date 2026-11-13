import {createSample,type Project} from '@dom-director/studio';
import {duplicateScene} from '@dom-director/studio/editing';
const result=duplicateScene(createSample(),'overview');
const project:Project=result.value,sceneId:string=result.sceneId;void project;void sceneId;
// @ts-expect-error a scene ID is required
void duplicateScene(createSample());
// @ts-expect-error a scene ID is a string, not an array
void duplicateScene(createSample(),['overview']);
// @ts-expect-error returned project snapshots are immutable
result.value.scenes.push(result.value.scenes[0]);
