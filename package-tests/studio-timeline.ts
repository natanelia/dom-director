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
