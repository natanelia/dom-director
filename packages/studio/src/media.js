import {parseJSON} from '@dom-director/core/data';
import {requireProject,sceneTimeline} from './project.js';
const MAX_ASSET=8*1024*1024,MAX_TOTAL=24*1024*1024,MAX_BUNDLE=36*1024*1024;
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const abort=signal=>{if(signal?.aborted)throw new DOMException('Operation cancelled.','AbortError');};
export async function digest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function createMediaBank({resolveSample,contextFactory=()=>new AudioContext()}={}){
  const raw=new Map(),decoded=new Map(),peaks=new Map(),signatures=new Map(),versions=new Map(),pending=new Set();let context=null,disposed=false,generation=0,reserved=0;
  const version=id=>generation+':'+(versions.get(id)||0);
  const signature=a=>JSON.stringify([a.source,a.sample||null,a.sha256||null]);
  const ctx=()=>{check(!disposed,'Media bank was closed.');return context||(context=contextFactory());};
  async function decode(id,bytes,signal,expected=version(id)){
    abort(signal);check(bytes.byteLength>0&&bytes.byteLength<=MAX_ASSET,'Audio file must be at most 8 MiB.');
    const audio=await ctx().decodeAudioData(bytes.slice(0));abort(signal);check(!disposed&&expected===version(id),'Media preparation was superseded.');
    check(audio.duration>0&&audio.duration<=180&&audio.numberOfChannels<=2,'Use mono/stereo audio no longer than 180 seconds.');
    const used=[...decoded.entries()].filter(([key])=>key!==id).reduce((n,[,a])=>n+a.length*a.numberOfChannels*4,0);
    check(used+audio.length*audio.numberOfChannels*4<=128*1024*1024,'Decoded audio memory limit reached. Open a smaller project.');
    const samples=audio.getChannelData(0),values=[];for(let i=0;i<160;i++){const start=Math.floor(i*samples.length/160),end=Math.floor((i+1)*samples.length/160);let max=0;for(let j=start;j<end;j++)max=Math.max(max,Math.abs(samples[j]));values.push(max);}
    decoded.set(id,audio);peaks.set(id,values);return audio;
  }
  async function ingest(id,name,mime,bytes,{signal}={}){
    check(!disposed,'Media bank was closed.');check(bytes instanceof ArrayBuffer&&bytes.byteLength>0&&bytes.byteLength<=MAX_ASSET,'Audio file must be at most 8 MiB.');
    check(/^audio\/(mpeg|mp3|wav|x-wav|webm|ogg|mp4)$/u.test(mime),'Use MP3, WAV, Ogg, MP4 audio or WebM audio.');
    check([...raw.values()].reduce((n,b)=>n+b.byteLength,0)+reserved+bytes.byteLength<=MAX_TOTAL,'Local audio budget is 24 MiB.');
    check(!raw.has(id)&&!decoded.has(id)&&!pending.has(id),'Asset identity already exists.');
    bytes=bytes.slice(0);pending.add(id);reserved+=bytes.byteLength;const expected=version(id);
    try{const hash=await digest(bytes);abort(signal);const audio=await decode(id,bytes,signal,expected);abort(signal);
      const asset={id,name:name.slice(0,200),mime,durationMs:Math.floor(audio.duration*1000),source:'local',sha256:hash};
      raw.set(id,bytes.slice(0));signatures.set(id,signature(asset));return asset;
    }catch(error){decoded.delete(id);peaks.delete(id);throw error;}finally{pending.delete(id);reserved-=bytes.byteLength;}
  }
  async function load(asset,{signal}={}){
    abort(signal);check(!disposed,'Media bank was closed.');const expected=version(asset.id),sig=signature(asset);
    if(signatures.has(asset.id))check(signatures.get(asset.id)===sig,'Audio identity changed; reopen the project with the correct media.');
    if(decoded.has(asset.id))return decoded.get(asset.id);
    if(raw.has(asset.id))return decode(asset.id,raw.get(asset.id),signal);
    check(asset.source==='sample'&&typeof resolveSample==='function','Audio is missing. Reopen a bundle that includes its media.');
    const source=resolveSample(asset.sample);check(typeof source==='string','Sample audio was not approved by the host.');
    const response=await fetch(source,{signal,credentials:'omit',redirect:'error'});check(response.ok,'Prepared audio could not be loaded.');
    check(Number(response.headers.get('content-length')||0)<=MAX_ASSET,'Prepared audio is too large.');
    const reader=response.body.getReader(),parts=[];let size=0;
    try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;check(size<=MAX_ASSET,'Prepared audio is too large.');parts.push(value);}}finally{await reader.cancel();}
    const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
    const audio=await decode(asset.id,bytes.buffer,signal,expected);signatures.set(asset.id,sig);return audio;
  }
  return {context:ctx,ingest,load,get:id=>decoded.get(id),waveform:id=>peaks.get(id)||null,bytes:id=>raw.get(id)?.slice(0)||null,
    remove(id){versions.set(id,(versions.get(id)||0)+1);raw.delete(id);decoded.delete(id);peaks.delete(id);signatures.delete(id);},
    clear(){generation++;raw.clear();decoded.clear();peaks.clear();signatures.clear();},
    async destroy(){disposed=true;generation++;raw.clear();decoded.clear();peaks.clear();signatures.clear();if(context&&context.state!=='closed')await context.close();},
  };
}
function b64(bytes){let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out);}
export async function saveProjectBundle(input,bank){
  const project=requireProject(input),files=[],records=[];
  for(const asset of project.assets.filter(a=>a.source==='local')){
    const bytes=bank.bytes(asset.id);check(bytes,'Local audio “'+asset.name+'” is missing.');const hash=await digest(bytes);check(hash===asset.sha256,'Audio digest changed.');
    const data=new Uint8Array(bytes),parts=[];for(let start=0;start<data.length;start+=196608)parts.push(b64(data.subarray(start,start+196608)));
    files.push({id:asset.id,sha256:hash,byteLength:data.length,chunks:parts.length});parts.forEach((data,index)=>records.push(JSON.stringify({id:asset.id,index,data})));
  }
  const lines=[JSON.stringify({format:'dom-director-studio/1',project,files}),...records];
  for(const line of lines)parseJSON(line);
  const text=lines.join('\n')+'\n';check(new TextEncoder().encode(text).length<=MAX_BUNDLE,'Project bundle exceeds 36 MiB.');return text;
}
export async function readProjectBundle(text){
  check(typeof text==='string'&&text.length<=MAX_BUNDLE&&new TextEncoder().encode(text).length<=MAX_BUNDLE,'Project file exceeds 36 MiB.');
  const lines=text.trim().split('\n');check(lines.length<=256,'Project bundle contains too many chunks.');
  const h=parseJSON(lines.shift());check(h&&Object.keys(h).sort().join(',')==='files,format,project'&&h.format==='dom-director-studio/1'&&Array.isArray(h.files),'Unsupported project bundle.');
  const project=requireProject(h.project),files=new Map(),used=new Set();let total=0;
  for(const f of h.files){check(f&&Object.keys(f).sort().join(',')==='byteLength,chunks,id,sha256'&&typeof f.id==='string'&&!files.has(f.id),'Invalid asset manifest.');const asset=project.assets.find(a=>a.id===f.id&&a.source==='local');check(asset&&asset.sha256===f.sha256&&Number.isInteger(f.byteLength)&&f.byteLength>0&&f.byteLength<=MAX_ASSET&&Number.isInteger(f.chunks)&&f.chunks===Math.ceil(f.byteLength/196608),'Invalid audio manifest.');total+=f.byteLength;check(total<=MAX_TOTAL,'Local audio budget exceeded.');files.set(f.id,{...f,bytes:new Uint8Array(f.byteLength),asset});}
  check(files.size===project.assets.filter(a=>a.source==='local').length,'Bundle is missing local media.');
  for(const line of lines){const r=parseJSON(line);check(r&&Object.keys(r).sort().join(',')==='data,id,index','Invalid media chunk.');const f=files.get(r.id),key=r.id+':'+r.index;check(f&&Number.isInteger(r.index)&&r.index>=0&&r.index<f.chunks&&!used.has(key)&&typeof r.data==='string'&&r.data.length<=262144&&/^[A-Za-z0-9+/]*={0,2}$/u.test(r.data),'Invalid or duplicate media chunk.');used.add(key);const value=atob(r.data),offset=r.index*196608;check(value.length===Math.min(196608,f.byteLength-offset),'Incomplete media chunk.');for(let i=0;i<value.length;i++)f.bytes[offset+i]=value.charCodeAt(i);}
  check(used.size==[...files.values()].reduce((n,f)=>n+f.chunks,0),'Missing media chunks.');
  for(const f of files.values())check(await digest(f.bytes)===f.sha256,'Audio checksum does not match.');
  return {project,media:[...files.values()].map(f=>({asset:f.asset,bytes:f.bytes.buffer}))};
}
/** One Web Audio master clock when audible, one monotonic clock when silent. */
export function createTransport({bank,onFrame,onState,now=()=>performance.now(),request=fn=>requestAnimationFrame(fn),cancel=id=>cancelAnimationFrame(id)}){
  let project=null,time=0,state='paused',audible=false,epoch=0,frame=null,base=0,anchor=0,audio=false,nodes=[],controller=null,loop=null,disposed=false;
  const current=()=>state==='playing'?Math.max(base,base+(audio?bank.context().currentTime*1000:now())-anchor):time;
  function notify(){onState?.({state,timeMs:time,audible});}
  function stopNodes(){for(const {source,gain} of nodes){try{source.stop();}catch{}source.disconnect();gain.disconnect();}nodes=[];}
  function pause(){time=current();epoch++;controller?.abort();controller=null;if(frame!==null)cancel(frame);frame=null;stopNodes();state='paused';notify();return time;}
  function render(t){time=t;onFrame?.(t);}
  async function play(){
    if(disposed||state==='playing'||state==='preparing'||!project)return;
    const token=++epoch;controller=new AbortController();state='preparing';notify();
    try{
      const signal=controller.signal,voice=project.tracks.filter(t=>t.kind==='voice'&&t.enabled).flatMap(t=>t.clips.filter(c=>c.assetId));
      audio=audible&&voice.length>0;
      if(audio){const ctx=bank.context();await ctx.resume();check(ctx.state==='running','Audio could not start. Enable sound from a user gesture.');for(const id of new Set(voice.map(c=>c.assetId))){await bank.load(project.assets.find(a=>a.id===id),{signal});abort(signal);}}
      if(token!==epoch||disposed)return;
      if(audio)for(const c of voice)check(c.sourceInMs+c.durationMs<=bank.get(c.assetId).duration*1000+2,'A voice clip exceeds the decoded source. Trim it or replace the take.');
      const total=project.scenes.reduce((n,s)=>n+s.durationMs,0);if(time>=total)time=loop?.startMs||0;
      base=time;anchor=audio?bank.context().currentTime*1000+30:now();
      if(audio){const ctx=bank.context(),offsets=new Map(sceneTimeline(project).map(s=>[s.id,s.startMs]));
        for(const c of voice){const start=offsets.get(c.sceneId)+c.startMs,end=start+c.durationMs;if(end<=time)continue;
          const skip=Math.max(0,time-start),at=anchor/1000+Math.max(0,start-time)/1000,remaining=(c.durationMs-skip)/1000;
          const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=bank.get(c.assetId);source.connect(gain);gain.connect(ctx.destination);
          const level=ms=>c.gain*Math.min(1,c.fadeInMs?ms/c.fadeInMs:1,c.fadeOutMs?(c.durationMs-ms)/c.fadeOutMs:1);
          gain.gain.setValueAtTime(Math.max(0,level(skip)),at);
          if(c.fadeInMs>skip)gain.gain.linearRampToValueAtTime(c.gain,at+(c.fadeInMs-skip)/1000);
          if(c.fadeOutMs){const fade=Math.max(skip,c.durationMs-c.fadeOutMs);gain.gain.setValueAtTime(Math.max(0,level(fade)),at+(fade-skip)/1000);gain.gain.linearRampToValueAtTime(0,at+remaining);}
          source.start(at,(c.sourceInMs+skip)/1000,remaining);nodes.push({source,gain});
        }
      }
      state='playing';notify();
      const tick=()=>{if(state!=='playing'||token!==epoch)return;const end=loop?.endMs||total,t=Math.max(base,current());if(t>=end){pause();render(end);if(loop){time=loop.startMs;void play();}return;}render(t);frame=request(tick);};
      frame=request(tick);
    }catch(error){if(token!==epoch||disposed)return;pause();if(error.name!=='AbortError')onState?.({state:'error',timeMs:time,audible,error:error.message});}
  }
  return {play,pause,
    load(input){pause();project=requireProject(input);time=0;loop=null;render(0);},
    seek(ms){check(Number.isFinite(ms),'Playhead must be finite.');pause();const end=project?.scenes.reduce((n,s)=>n+s.durationMs,0)||0;render(Math.max(0,Math.min(end,ms)));},
    setSound(enabled){pause();audible=!!enabled;notify();},
    setLoop(range){const end=project?.scenes.reduce((n,s)=>n+s.durationMs,0)||0;check(range===null||(Number.isFinite(range.startMs)&&Number.isFinite(range.endMs)&&range.startMs>=0&&range.endMs>range.startMs&&range.endMs<=end),'Loop must fit within the project.');pause();loop=range;},
    inspect(){return {state,timeMs:Math.max(0,current()),audible};},
    destroy(){pause();disposed=true;project=null;},
  };
}
/** A host-supplied generator produces an uncommitted take; this never mutates a project. */
export async function generateVoiceTake(provider,request,{signal}={}){
  check(provider&&typeof provider.generate==='function','No voice-generation service is connected. Import or record a take instead.');
  const capabilities=provider.capabilities;check(capabilities&&typeof capabilities.name==='string'&&Array.isArray(capabilities.voices),'Invalid voice provider.');
  const voice=capabilities.voices.find(v=>v.id===request.voiceId);check(voice&&Array.isArray(voice.styles)&&voice.styles.includes(request.style),'The chosen voice does not support this delivery style.');
  check(typeof request.text==='string'&&request.text.trim()&&request.text.length<=8000&&Number.isInteger(request.revision)&&typeof request.clipId==='string','Invalid voice request.');abort(signal);
  const origin={revision:request.revision,clipId:request.clipId,text:request.text,voiceId:request.voiceId,style:request.style,provider:capabilities.name};
  const result=await provider.generate({text:origin.text,voiceId:origin.voiceId,style:origin.style,signal});abort(signal);
  check(result?.bytes instanceof ArrayBuffer&&result.bytes.byteLength<=MAX_ASSET&&typeof result.mime==='string','Invalid generated audio.');
  return {...result,origin};
}
