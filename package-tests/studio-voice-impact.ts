import {createSample} from '@dom-director/studio';
import {describeVoiceReplacementImpact,type VoiceReplacementImpact,type VoiceImpactRow} from '@dom-director/studio/editing';
const project=createSample();
const impact:VoiceReplacementImpact=describeVoiceReplacementImpact(project,project,'voice.overview',{limit:20,offsets:{captions:20,voice:0}});
const row:VoiceImpactRow=impact.groups[0].items[0],time:number=row.before.startMs,visible:boolean|undefined=row.after.visible;
const linkedWord:string|undefined=row.link?.wordText,source:string|null|undefined=row.after.assetId;void time;void visible;void linkedWord;void source;
// @ts-expect-error source ranges use numeric milliseconds
const wrongTime:string=row.after.sourceStartMs;
// @ts-expect-error reports and nested links are immutable
if(row.before.link)row.before.link.offsetMs=123;
// @ts-expect-error summary timing is immutable
impact.scene.after.durationMs=10;
// @ts-expect-error page items are immutable
impact.groups[0].items.push(row);
// @ts-expect-error captions is the track kind, not CC
describeVoiceReplacementImpact(project,project,'voice.overview',{offsets:{CC:0}});
// @ts-expect-error page offsets are numbers
describeVoiceReplacementImpact(project,project,'voice.overview',{offsets:{captions:'20'}});
// @ts-expect-error a voice clip identity is required
describeVoiceReplacementImpact(project,project);
