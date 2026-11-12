import {createSample, LINKED_STUDIO_VERSION, type Project, type WordTimingLink} from '@dom-director/studio';
import {distributeCaptionWords, addKeyframe} from '@dom-director/studio/editing';
import {linkKeyframeToCaptionWord, describeTimingLinks, setTimingLinkOffset, detachTimingLink, detachCaptionTimingLinks} from '@dom-director/studio/timing-links';
const p = distributeCaptionWords(createSample(), 'cc.overview.0');
const linked:Project = linkKeyframeToCaptionWord(p, 'camera.overview', 'camera.to.overview', {captionId:'cc.overview.0', wordIndex:1, offsetMs:200});
const version:'0.1.0-draft.2' = LINKED_STUDIO_VERSION;
const relation:WordTimingLink = {captionId:'cc.overview.0', wordId:'word-1', boundary:'end', offsetMs:0};
const changed:Project = setTimingLinkOffset(linked, 'camera.overview', 'camera.to.overview', 300);
const rows = describeTimingLinks(changed);
const time:number = rows[0].projectTimeMs;
void version;void relation;void time;
detachTimingLink(changed, 'camera.overview', 'camera.to.overview');
detachCaptionTimingLinks(changed, 'cc.overview.0');
// @ts-expect-error offsets are milliseconds, not strings
setTimingLinkOffset(linked, 'camera.overview', 'camera.to.overview', '200');
// @ts-expect-error only actual word boundaries are supported
linkKeyframeToCaptionWord(p, 'camera.overview', 'camera.to.overview', {captionId:'cc.overview.0', wordIndex:0, boundary:'middle'});
// @ts-expect-error descriptions are immutable
rows[0].offsetMs = 100;
// @ts-expect-error new absolute keys cannot silently copy a timing relation
addKeyframe(linked, 'camera.overview', 2000, {timing:relation});
