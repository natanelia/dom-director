import {createSample, type Project} from '@dom-director/studio';
import {selectionBounds,includeLinkedClips,moveClips,duplicateClips,deleteClips,type SelectionBounds} from '@dom-director/studio/selection';
const project=createSample(),ids=['camera.overview','cursor.overview'] as const;
const bounds:SelectionBounds=selectionBounds(project,ids);
const expanded:ReadonlyArray<string>=includeLinkedClips(project,ids);
const moved:Project=moveClips(project,expanded,0);
const copied=duplicateClips(project,ids,0); // Type checking only; runtime collisions remain errors.
const removed:Project=deleteClips(project,ids);
void bounds;void moved;void removed;void copied.value;
// @ts-expect-error selection offsets are milliseconds, not CSS positions
moveClips(project,ids,'200');
// @ts-expect-error selection is a list of stable identities
selectionBounds(project,'camera.overview');
// @ts-expect-error returned identities are readonly
copied.clipIds.push('other');
// @ts-expect-error no hidden ripple or authorization options
moveClips(project,ids,10,{ripple:true});
