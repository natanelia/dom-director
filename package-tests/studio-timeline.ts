import {createSample,type Project} from '@dom-director/studio';
import {createTimelineSnapper,moveTimelineKeyframe,type TimelineSnapGuide} from '@dom-director/studio/editing';
const project:Project=createSample();
const magnetic=createTimelineSnapper(project,{clipId:'camera.overview',keyId:'camera.to.overview',operation:'keyframe',pixelsPerSecond:100,playheadMs:3490});
const result=magnetic.snap(2440),guide:TimelineSnapGuide|null=result.guide;
const delta:number=result.deltaMs;
if(guide){const time:number=guide.timeMs;void time;
  // @ts-expect-error guides are immutable
  guide.timeMs=0;
}
const next:Project=moveTimelineKeyframe(project,'camera.overview','camera.to.overview',3490);
createTimelineSnapper(next,{clipId:'cc.overview.0',operation:'trim-end',pixelsPerSecond:42}).snap(delta,{bypass:true});
// @ts-expect-error keyframe operations require a key identity
createTimelineSnapper(project,{clipId:'camera.overview',operation:'keyframe',pixelsPerSecond:100});
// @ts-expect-error snapping is not a cross-scene move operation
createTimelineSnapper(project,{clipId:'camera.overview',operation:'transfer',pixelsPerSecond:100});
// @ts-expect-error timing is numeric, not a formatted timecode
moveTimelineKeyframe(project,'camera.overview','camera.to.overview','00:03');
// @ts-expect-error bypass must be boolean
magnetic.snap(100,{bypass:'yes'});

import {captionWordAnchors,stampCaptionWord,alignKeyframeToCaptionWord,type CaptionWordAnchor} from '@dom-director/studio/editing';
const anchors:ReadonlyArray<CaptionWordAnchor>=captionWordAnchors(project,'overview');
const stamped:Project=stampCaptionWord(project,'cc.overview.0',0,'start',10);
const aligned:Project=alignKeyframeToCaptionWord(stamped,'camera.overview','camera.to.overview',{captionId:'cc.overview.0',wordIndex:1,boundary:'end'});
void aligned;
// @ts-expect-error returned anchor arrays are readonly
anchors.push(anchors[0]);
// @ts-expect-error returned anchors are immutable
anchors[0].projectTimeMs=0;
// @ts-expect-error a word boundary is start or end
stampCaptionWord(project,'cc.overview.0',0,'middle',10);
// @ts-expect-error project time is numeric milliseconds
stampCaptionWord(project,'cc.overview.0',0,'start','00:01');
// @ts-expect-error the word index is required
alignKeyframeToCaptionWord(project,'camera.overview','camera.to.overview',{captionId:'cc.overview.0'});
