import {createSample,type Project} from '@dom-director/studio';
import {findCaptionMatches,proposeCaptionReplacement,type CaptionSearchResult,type CaptionReplacement} from '@dom-director/studio/caption-search';
const project=createSample();
const found:CaptionSearchResult=findCaptionMatches(project,{query:'product',trackId:null,matchCase:false});
const ids=found.captions.map(c=>c.clipId) as readonly string[];
const proposal:CaptionReplacement=proposeCaptionReplacement(project,{query:'product',replacement:'walkthrough',clipIds:ids});
const next:Project=proposal.value;void next;
const count:number=proposal.changes[0].clearedWordTimings;void count;
const boundary:'start'|'end'=proposal.detachedLinks[0].boundary;void boundary;
// @ts-expect-error search ranges are immutable snapshots
found.captions[0].ranges[0].start=3;
// @ts-expect-error the replacement proposal must be committed, not mutated
proposal.value.title='Changed';
// @ts-expect-error exact case option is a boolean
findCaptionMatches(project,{query:'x',matchCase:'yes'});
// @ts-expect-error track scope is an ID or explicit null
findCaptionMatches(project,{query:'x',trackId:42});
// @ts-expect-error replacement text is required
proposeCaptionReplacement(project,{query:'x'});
// @ts-expect-error clip IDs are strings
proposeCaptionReplacement(project,{query:'x',replacement:'y',clipIds:[1]});
