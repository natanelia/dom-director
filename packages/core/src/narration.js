import {TimelineClock} from './clock.js';
import {requireValue} from './errors.js';

/** A scene-local clock. Assets are resolved only by an explicit host grant. */
export class NarrationClock {
  constructor({now,resolveAsset,createAudio,onChange=()=>{},enabled=false,onFailure='pause',
    timeoutMs=2500,stallMs=10000,setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}={}) {
    requireValue(typeof resolveAsset==='function'&&typeof createAudio==='function','MEDIA_OPTIONS','Narration needs a host resolver and media factory.');
    requireValue(['pause','text'].includes(onFailure)&&typeof enabled==='boolean'&&Number.isFinite(timeoutMs)&&timeoutMs>0&&Number.isFinite(stallMs)&&stallMs>0,'MEDIA_OPTIONS','Invalid narration recovery options.');
    Object.assign(this,{resolveAsset,createAudio,onChange,enabled,onFailure,timeoutMs,stallMs,setTimer,clearTimer});
    this.text=new TimelineClock(now);this.now=()=>this.text.readWall();this.rate=1;this.running=false;
    this.media=null;this.scene=null;this.cleanups=[];this.epoch=0;this.timer=null;this.dead=false;
    this.authority='text';this.buffering=false;this.error=null;this.last=0;this.volume=1;
    this.samples=[];this.maxSkewMs=0;this.anchor(0);
  }
  notify(type){try{this.onChange(type,this.inspect());}catch{/* Observers do not own the clock. */}}
  anchor(time){this.last=time;this.origin=time;this.wall=this.now();this.progressWall=this.wall;}
  clearTimeout(){if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;}
  detach(){
    this.epoch++;this.clearTimeout();this.cleanups.splice(0).forEach(off=>off());
    const media=this.media;this.media=null;
    if(media){try{media.pause();media.removeAttribute('src');media.load();}catch{/* Release is best effort. */}}
  }
  setScene(scene){
    this.pause();this.detach();this.scene=scene;this.error=null;this.authority='text';this.buffering=false;
    this.text.setScene(scene);this.anchor(0);this.samples=[];this.maxSkewMs=0;
  }
  ensureMedia(){
    if(this.media)return;
    const source=this.resolveAsset(this.scene.narration.audioAsset);
    requireValue(typeof source==='string'&&source.length>0&&!/[\u0000-\u001f\\]/u.test(source)&&
      (/^(https?:|blob:)/u.test(source)||/^data:audio\/[a-zA-Z0-9.+-]+;base64,/u.test(source)||source.startsWith('./')),
      'MEDIA_DENIED','The host did not authorize an audio source.');
    const media=this.createAudio();
    requireValue(media&&typeof media.play==='function'&&typeof media.pause==='function'&&typeof media.addEventListener==='function','MEDIA_OPTIONS','The media factory must return an audio element.');
    this.media=media;
    const listen=(type,fn)=>{media.addEventListener(type,fn);this.cleanups.push(()=>media.removeEventListener(type,fn));};
    const active=()=>!this.dead&&this.running&&this.authority==='audio'&&this.media===media&&!this.error;
    listen('waiting',()=>{if(active()){this.buffering=true;this.progressWall=this.now();this.notify('narration-buffering');}});
    listen('playing',()=>{if(active()){this.buffering=false;this.origin=this.last;this.wall=this.now();this.progressWall=this.wall;this.notify('narration-playing');}});
    listen('ended',()=>{if(active()&&media.ended)this.fault('MEDIA_ENDED');});
    listen('error',()=>{if(active())this.fault('MEDIA_ERROR');});
    media.preload='metadata';media.volume=this.volume;media.src=source;
  }
  start(){
    requireValue(!this.dead,'DESTROYED','The narration clock has been destroyed.');
    if(this.running)return;
    this.running=true;this.anchor(this.last);
    if(!this.enabled||!this.scene?.narration?.audioAsset||this.error){
      if(this.error&&this.onFailure==='pause'&&this.enabled){this.buffering=true;return;}
      this.authority='text';this.text.setTime(this.last);this.text.start();return;
    }
    this.authority='audio';this.buffering=true;this.text.pause();
    const epoch=++this.epoch;
    try{
      this.ensureMedia();const media=this.media;
      media.currentTime=this.last/1000;media.playbackRate=this.rate;media.volume=this.volume;
      this.timer=this.setTimer(()=>{if(this.running&&epoch===this.epoch)this.fault('MEDIA_START_TIMEOUT');},this.timeoutMs);
      // Call play synchronously in the caller's input handler, not after an await.
      Promise.resolve(media.play()).then(()=>{
        if(this.dead||epoch!==this.epoch){if(this.media!==media||!this.running||this.authority!=='audio')media.pause();return;}
        this.clearTimeout();this.buffering=media.readyState<3;this.progressWall=this.now();this.notify('narration-playing');
      },()=>{if(!this.dead&&epoch===this.epoch)this.fault('MEDIA_PLAY_REJECTED');});
    }catch{if(epoch===this.epoch)this.fault('MEDIA_UNAVAILABLE');}
  }
  fault(code){
    this.epoch++;this.clearTimeout();this.error=code;
    try{this.media?.pause();}catch{/* Keep presentation position even on decoder failure. */}
    this.buffering=this.onFailure==='pause';
    if(this.onFailure==='text'){
      this.authority='text';this.text.setTime(this.last);if(this.running)this.text.start();
    }
    this.notify('narration-error');
  }
  read(){
    if(!this.running)return this.last;
    if(this.authority==='text'){this.last=this.text.read();return this.last;}
    const now=this.now();
    if(this.error)return this.last;
    if(this.buffering||this.media.seeking){if(now-this.progressWall>this.stallMs)this.fault('MEDIA_STALLED');return this.last;}
    const value=this.media.currentTime*1000;
    if(!Number.isFinite(value)||value<0||value<this.last-100||value>this.origin+(now-this.wall)*this.rate+200){this.fault('MEDIA_CLOCK_INVALID');return this.last;}
    if(value>this.last){this.last=value;this.progressWall=now;}
    else if(now-this.progressWall>this.stallMs)this.fault('MEDIA_STALLED');
    return this.last;
  }
  pause(){
    if(this.running)this.read();this.running=false;this.epoch++;this.clearTimeout();
    this.text.pause();this.text.setTime(this.last);try{this.media?.pause();}catch{}this.buffering=false;
  }
  setTime(time){
    requireValue(Number.isFinite(time)&&time>=0,'INVALID_TIME','Time must be finite and nonnegative.');
    const resume=this.running;this.pause();this.anchor(time);this.text.setTime(time);
    if(resume)this.start();
  }
  setRate(rate){
    requireValue(Number.isFinite(rate)&&rate>=.25&&rate<=4,'INVALID_RATE','Playback rate must be between 0.25 and 4.');
    const resume=this.running;this.pause();this.rate=rate;this.text.setRate(rate);if(resume)this.start();
  }
  setEnabled(value){
    requireValue(typeof value==='boolean','MEDIA_OPTIONS','Narration preference must be boolean.');
    const resume=this.running;this.pause();this.enabled=value;this.error=null;
    this.authority='text';if(resume)this.start();this.notify('narration-preference-changed');
  }
  setVolume(value){requireValue(Number.isFinite(value)&&value>=0&&value<=1,'MEDIA_OPTIONS','Volume must be between 0 and 1.');this.volume=value;if(this.media)this.media.volume=value;this.notify('narration-volume-changed');}
  observePresentation(time){
    if(this.authority!=='audio'||!this.running||this.buffering||this.error)return;
    const skew=Math.abs(this.media.currentTime*1000-time);
    if(Number.isFinite(skew)){this.samples.push(skew);if(this.samples.length>512)this.samples.shift();this.maxSkewMs=Math.max(this.maxSkewMs,skew);}
  }
  inspect(){const sorted=[...this.samples].sort((a,b)=>a-b);return {enabled:this.enabled,available:!!this.scene?.narration?.audioAsset,authority:this.authority,buffering:this.buffering,error:this.error,volume:this.volume,samples:sorted.length,p95SkewMs:sorted.length?sorted[Math.ceil(sorted.length*.95)-1]:null,maxSkewMs:this.maxSkewMs};}
  destroy(){if(this.dead)return;this.pause();this.dead=true;this.detach();this.text.destroy();}
}

/** Plain-text WebVTT output; no HTML or arbitrary cue markup is interpreted. */
export function captionsToVTT(cues){
  const stamp=value=>{requireValue(Number.isFinite(value)&&value>=0,'CAPTION_TIME','Caption time must be finite and nonnegative.');const n=Math.round(value);return `${String(Math.floor(n/3600000)).padStart(2,'0')}:${String(Math.floor(n/60000)%60).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')}.${String(n%1000).padStart(3,'0')}`;};
  const text=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/\r\n?|\n/gu,' ');
  return 'WEBVTT\n\n'+cues.map((cue,index)=>{requireValue(typeof cue.text==='string'&&cue.endMs>cue.startMs,'CAPTION_INVALID','Invalid caption cue.');return `${index+1}\n${stamp(cue.startMs)} --> ${stamp(cue.endMs)}\n${text(cue.text)}\n`;}).join('\n');
}
