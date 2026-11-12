
/**
 * Explicit, single-take listening without a project/playhead or ownership of the
 * host's AudioContext. Each play replaces the previous audition, never the take.
 */
export function createTakeAuditioner({bank,onState,timeoutMs=15000}={}){
  check(bank&&typeof bank.context==='function'&&typeof bank.load==='function','Provide a host-owned media bank.');
  check(Number.isInteger(timeoutMs)&&timeoutMs>=1&&timeoutMs<=60000,'Audition startup timeout must be 1–60000 milliseconds.');
  let current=null,disposed=false,state={state:'idle',assetId:null};
  const inspect=()=>Object.freeze({...state});
  const notify=()=>{onState?.(inspect());};
  function release(token){
    if(!token)return;
    clearTimeout(token.timer);token.timer=null;token.off?.();token.off=null;
    // Clear onended before stopping; even a queued completion cannot affect a newer take.
    if(token.source){token.source.onended=null;try{token.source.stop();}catch{}try{token.source.disconnect();}catch{}token.source=null;}
    if(token.gain){try{token.gain.disconnect();}catch{}token.gain=null;}
    token.controller.abort();
  }
  function stop(){
    if(disposed)return;
    const token=current;current=null;release(token);
    state={state:'idle',assetId:null};notify();
  }
  function wait(promise,signal){
    if(signal.aborted)return Promise.reject(signal.reason);
    return new Promise((resolve,reject)=>{
      const cancel=()=>{signal.removeEventListener('abort',cancel);reject(signal.reason);};
      signal.addEventListener('abort',cancel,{once:true});
      Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',cancel);resolve(value);},error=>{signal.removeEventListener('abort',cancel);reject(error);});
    });
  }
  async function play(asset,options={}){
    if(disposed)return {status:'cancelled'};
    stop();
    // A host state callback may dispose this listener while handling stop().
    if(disposed)return {status:'cancelled'};
    const token={controller:new AbortController(),source:null,gain:null,timer:null,off:null};
    current=token;
    try{
      const {sourceInMs=0,durationMs,gain=1,fadeInMs=0,fadeOutMs=0,signal}=options;
      check(asset&&typeof asset.id==='string'&&asset.id.length>0&&Number.isFinite(asset.durationMs)&&asset.durationMs>0&&asset.durationMs<=180000,'Choose a valid bounded voice take.');
      check(Number.isInteger(sourceInMs)&&sourceInMs>=0&&sourceInMs<180000,'Source start must be a nonnegative whole millisecond.');
      check(durationMs===undefined||(Number.isInteger(durationMs)&&durationMs>0&&durationMs<=180000),'Audition length must be 1–180000 milliseconds.');
      check(Number.isFinite(gain)&&gain>=0&&gain<=2,'Audition volume must be 0–2.');
      check(Number.isInteger(fadeInMs)&&Number.isInteger(fadeOutMs)&&fadeInMs>=0&&fadeOutMs>=0,'Fades must use nonnegative whole milliseconds.');
      check(signal===undefined||(typeof signal?.aborted==='boolean'&&typeof signal.addEventListener==='function'&&typeof signal.removeEventListener==='function'),'Provide an AbortSignal.');
      if(signal?.aborted){stop();return {status:'cancelled'};}
      const input={...asset},internal=token.controller.signal;
      if(signal){const cancel=()=>{if(current===token)stop();};signal.addEventListener('abort',cancel,{once:true});token.off=()=>signal.removeEventListener('abort',cancel);}
      token.timer=setTimeout(()=>token.controller.abort(Error('Voice audition could not start in time. Try listening again.')),timeoutMs);
      state={state:'loading',assetId:input.id};notify();
      if(current!==token||disposed)return {status:'cancelled'};
      // Resume immediately from the explicit click, before awaiting media preparation.
      const context=bank.context();
      await wait(context.resume(),internal);abort(internal);
      check(context.state==='running','Audio could not start. Choose Listen again to allow sound.');
      const buffer=await wait(bank.load(input,{signal:internal}),internal);abort(internal);
      if(current!==token||disposed)return {status:'cancelled'};
      check(context.state==='running','Audio was interrupted. Choose Listen again.');
      check(buffer&&Number.isFinite(buffer.duration)&&buffer.duration>0&&buffer.duration<=180.002,'The decoded take has an invalid duration.');
      const available=buffer.duration*1000-sourceInMs,length=durationMs??available;
      check(available>0&&length>0&&length<=available+2,'The audition exceeds the decoded take. Adjust the source trim.');
      check(fadeInMs+fadeOutMs<=length,'Fades must fit inside the audition.');
      const actual=Math.min(length,available)/1000,at=context.currentTime;
      const source=context.createBufferSource();token.source=source;source.buffer=buffer;
      const volume=context.createGain();token.gain=volume;source.connect(volume);volume.connect(context.destination);
      volume.gain.setValueAtTime(fadeInMs?0:gain,at);
      const fadeIn=Math.min(fadeInMs/1000,actual),fadeOut=Math.min(fadeOutMs/1000,actual-fadeIn);
      if(fadeIn)volume.gain.linearRampToValueAtTime(gain,at+fadeIn);
      if(fadeOut){volume.gain.setValueAtTime(gain,at+actual-fadeOut);volume.gain.linearRampToValueAtTime(0,at+actual);}
      source.onended=()=>{if(current!==token||disposed)return;current=null;release(token);state={state:'ended',assetId:input.id};notify();};
      source.start(at,sourceInMs/1000,actual);
      clearTimeout(token.timer);token.timer=null;
      state={state:'playing',assetId:input.id};notify();
      return current===token&&!disposed?{status:'playing'}:{status:'cancelled'};
    }catch(error){
      if(current!==token||disposed)return {status:'cancelled'};
      current=null;release(token);const message=error instanceof Error?error.message:'Voice audition failed. Try a different take.';
      state={state:'error',assetId:typeof asset?.id==='string'?asset.id:null,error:message};notify();
      return {status:'error',error:message};
    }
  }
  return {play,stop,inspect,destroy(){if(disposed)return;const token=current;current=null;disposed=true;release(token);state={state:'destroyed',assetId:null};notify();}};
}
