import {createSample} from '@dom-director/studio';
import {createMediaBank,createTakeAuditioner,type TakeAuditionResult,type TakeAuditionState} from '@dom-director/studio/media';
const bank=createMediaBank();
const audition=createTakeAuditioner({bank,timeoutMs:1000,onState:state=>{const s:TakeAuditionState=state;void s;}});
const result:Promise<TakeAuditionResult>=audition.play(createSample().assets[0],{sourceInMs:50,durationMs:300,gain:.8,fadeInMs:50,fadeOutMs:100,signal:new AbortController().signal});
void result;audition.stop();audition.destroy();
// @ts-expect-error source trim is numeric milliseconds, not a timecode
void audition.play(createSample().assets[0],{sourceInMs:'00:01'});
// @ts-expect-error asset references, not arbitrary audio URLs
void audition.play('https://example.invalid/audio');
const state=audition.inspect();
// @ts-expect-error snapshots cannot be mutated
state.state='playing';
