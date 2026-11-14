import {createEarthSample,EARTH_CHECKPOINTS,validateProject,createEvaluator} from '@dom-director/studio';
import {saveProjectBundle,readProjectBundle} from '@dom-director/studio/media';
const project=createEarthSample();
if(!validateProject(project).ok||project.scenes.length!==6||EARTH_CHECKPOINTS.length!==6)throw Error('Installed Earth sample failed');
if(project.assets.length||project.tracks.find(track=>track.kind==='voice').clips.some(clip=>clip.assetId!==null))throw Error('Earth must not use unrelated narration');
const restored=await readProjectBundle(await saveProjectBundle(project,{bytes(){throw Error('Unexpected media access');}}));
if(JSON.stringify(restored.project)!==JSON.stringify(project))throw Error('Earth bundle round-trip failed');
if(createEvaluator(project).targets.some(target=>!target.startsWith('earth.')))throw Error('Earth target family changed');
