import {createEarthSample,EARTH_CHECKPOINTS,type EarthCheckpoint,type Project} from '@dom-director/studio';
const project:Project=createEarthSample();
const step:Readonly<EarthCheckpoint>=EARTH_CHECKPOINTS[0];
const target:string=step.target;
void project;void target;
// @ts-expect-error the published checkpoint list is immutable
EARTH_CHECKPOINTS.push(step);
// @ts-expect-error the shared authored checkpoint is immutable
EARTH_CHECKPOINTS[0].title='changed';
