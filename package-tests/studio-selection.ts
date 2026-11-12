import {createSample, type Project} from '@dom-director/studio';
import {selectionBounds,includeLinkedClips,moveClips,duplicateClips,deleteClips,matchClipAppearance,setVoiceMix,type SelectionBounds} from '@dom-director/studio/selection';
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

const styled:Project=matchClipAppearance(project,'cc.overview.0',['cc.signal.0'] as const);void styled;
// @ts-expect-error source is a single stable identity
matchClipAppearance(project,['cc.overview.0'],['cc.signal.0']);
// @ts-expect-error destination selection is a readonly list
matchClipAppearance(project,'cc.overview.0','cc.signal.0');

const mixed:Project=setVoiceMix(project,['voice.overview','voice.signal'] as const,{gain:.7,fadeInMs:100});void mixed;
// @ts-expect-error only mix fields may be set
setVoiceMix(project,['voice.overview'],{sourceInMs:200});
// @ts-expect-error gains are linear numbers, not percentages in text
setVoiceMix(project,['voice.overview'],{gain:'70%'});
// @ts-expect-error voice selection is a readonly list, not one string
setVoiceMix(project,'voice.overview',{fadeOutMs:200});
