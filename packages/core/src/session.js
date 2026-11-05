import {DirectorError,requireValue,diagnostic} from './errors.js';
import {TimelineClock} from './clock.js';
let serial=0;
/** Presentation state machine. Seeking never calls the host barrier handler. */
export class Session {
  constructor(plan,{now=()=>performance.now(),clock,mode='watch',barriers,onEvent=()=>{},onFrame=()=>{}}={}){
    requireValue(plan.script.modes.includes(mode),'MODE_UNAVAILABLE','This script does not offer the requested mode.');
    this.plan=plan;this.clock=clock||new TimelineClock(now);this.mode=mode;this.barriers=barriers;
    this.onEvent=onEvent;this.onFrame=onFrame;this.runId='run.'+(++serial);this.revision=0;this.sequence=0;
    this.path=[{sceneId:plan.entryScene,visitId:'visit.1'}];this.cursor=0;this.time=0;
    this.reasons=new Set(['user']);this.resolved=new Set();this.pending=null;this.epoch=0;this.controlEpoch=0;this.destroyed=false;this.ready=true;
    this.clock.setScene(this.scene);this.emit('prepared');
  }
  get scene(){return this.plan.scenes[this.path[this.cursor].sceneId];}
  get running(){return !this.destroyed&&this.reasons.size===0;}
  get status(){return this.destroyed?'destroyed':this.reasons.has('error')?'error':this.reasons.has('complete')?'completed':
    this.reasons.has('user')?(this.ready?'ready':'paused'):this.reasons.size?'waiting':this.clock.buffering?'buffering':'playing';}
  live(){requireValue(!this.destroyed,'DESTROYED','The session has been destroyed.');}
  inspect(){return Object.freeze({runId:this.runId,revision:this.revision,status:this.status,mode:this.mode,
    sceneId:this.scene.id,visitId:this.path[this.cursor].visitId,timeMs:this.time,durationMs:this.scene.durationMs,rate:this.clock.rate,
    path:this.path.slice(0,this.cursor+1).map(v=>({...v})),waitingFor:this.pending?{cueId:this.pending.cue.id,kind:this.pending.cue.kind}:null,
    choices:this.reasons.has('choice')?(this.scene.choices||[]).map(c=>({...c})):[],reasons:[...this.reasons],nominalDurationMs:this.path.slice(0,this.cursor+1).reduce((n,v)=>n+this.plan.scenes[v.sceneId].durationMs,0)});}
  emit(type,detail={}){this.revision++;try{this.onEvent(Object.freeze({type,sequence:++this.sequence,...this.inspect(),detail}));}catch{/* Host observers cannot break cleanup or playback. */}}
  frame(){if(!this.destroyed)this.onFrame(this.inspect());}
  key(cue,visit=this.path[this.cursor]){return visit.visitId+'/'+cue.id;}
  firstBarrier(scene,time,visit){return scene.cues.find(c=>(c.kind==='action'||c.kind==='gate')&&c.atMs<=time&&!this.resolved.has(this.key(c,visit)));}
  cancelPending(){this.epoch++;if(this.pending){this.pending.controller.abort();this.pending=null;}this.reasons.delete('barrier');}
  play(){
    this.live();this.controlEpoch++;this.ready=false;
    if(this.reasons.has('complete')){this.seek({sceneId:this.plan.entryScene,timeMs:0});this.reasons.delete('complete');}
    this.reasons.delete('user');this.reasons.delete('hidden');
    if(this.reasons.has('step')){this.reasons.delete('step');this.enter(this.scene.next);}
    if(this.running){this.clock.setTime(this.time);this.clock.start();this.emit('playback-started');this.tick();}
    else this.emit('playback-blocked');return this.inspect();
  }
  pause(reason='user'){
    this.live();this.controlEpoch++;if(this.running){const sampled=Math.min(this.clock.read(),this.scene.durationMs),barrier=this.firstBarrier(this.scene,sampled,this.path[this.cursor]);this.time=barrier?Math.min(sampled,barrier.atMs):sampled;}
    this.clock.pause();this.clock.setTime(this.time);this.reasons.add(reason);this.ready=false;this.emit('paused');this.frame();return this.inspect();
  }
  tick(){
    this.live();if(!this.running)return;
    const controlEpoch=this.controlEpoch;
    const next=Math.min(this.clock.read(),this.scene.durationMs),cue=this.firstBarrier(this.scene,next,this.path[this.cursor]);
    if(cue){this.time=cue.atMs;this.clock.pause();this.clock.setTime(this.time);this.enterBarrier(cue);this.frame();return;}
    this.time=next;this.frame();
    if(this.time>=this.scene.durationMs&&this.running&&controlEpoch===this.controlEpoch){
      this.clock.pause();this.emit('scene-completed');
      if(this.destroyed||!this.running||controlEpoch!==this.controlEpoch)return;
      if(this.scene.choices){this.reasons.add('choice');this.emit('choice-required');}
      else if(this.scene.next){if(this.mode==='guide'){this.reasons.add('step');this.emit('step-required');}else{this.enter(this.scene.next);if(this.running)this.clock.start();}}
      else{this.reasons.add('complete');this.emit('completed');}
    }
  }
  enter(id){
    requireValue(Object.hasOwn(this.plan.scenes,id),'SCENE_REFERENCE','Scene is not defined.');
    this.cancelPending();
    if(this.path[this.cursor+1]?.sceneId!==id){this.path=this.path.slice(0,this.cursor+1);this.path.push({sceneId:id,visitId:'visit.'+(++serial)});}
    this.cursor++;this.time=0;this.clock.setScene(this.scene);
    this.emit('scene-entered');this.frame();
  }
  enterBarrier(cue){
    this.reasons.add('barrier');const controller=new AbortController(),epoch=++this.epoch;
    this.pending={cue,controller};this.emit('gate-entered',{cueId:cue.id,kind:cue.kind});
    if(!this.barriers){this.emit('diagnostic',{diagnostic:new DirectorError('CAPABILITY_UNAVAILABLE','A host barrier adapter is required.').diagnostic});return;}
    const context={runId:this.runId,sceneId:this.scene.id,visitId:this.path[this.cursor].visitId,mode:this.mode,script:this.plan.script,revision:this.revision};
    Promise.resolve().then(()=>{requireValue(!controller.signal.aborted&&epoch===this.epoch,'CANCELLED','Operation was cancelled.');return this.barriers.enter(cue,context,controller.signal);}).then(result=>{
      if(this.destroyed||epoch!==this.epoch||controller.signal.aborted)return;
      requireValue(result?.completed===true||result?.skipScene===true,'BARRIER_UNRESOLVED','Host did not establish successful completion.');
      this.resolved.add(this.key(cue));this.pending=null;this.reasons.delete('barrier');
      const control=this.controlEpoch;
      this.emit(cue.kind==='gate'?'condition-satisfied':'action-completed',{cueId:cue.id});
      if(this.destroyed||control!==this.controlEpoch)return;
      if(result.skipScene){requireValue(cue.kind==='gate'&&cue.onTimeout==='skip-scene','INVALID_SKIP','This cue cannot skip a scene.');if(this.scene.next)this.enter(this.scene.next);else this.reasons.add('complete');}
      if(this.running){this.clock.setTime(this.time);this.clock.start();}this.frame();
    }).catch(error=>{
      if(this.destroyed||epoch!==this.epoch||controller.signal.aborted)return;
      this.reasons.add('user');this.emit('diagnostic',{diagnostic:diagnostic(error)});this.frame();
    });
  }
  seek({sceneId=this.scene.id,timeMs=0}){
    this.live();this.pause();
    requireValue(Object.hasOwn(this.plan.scenes,sceneId)&&Number.isFinite(timeMs)&&timeMs>=0&&timeMs<=this.plan.scenes[sceneId].durationMs,'INVALID_SEEK','Invalid scene or scene time.');
    let index=this.path.findIndex(v=>v.sceneId===sceneId),path=this.path.map(v=>({...v}));
    if(index<0){
      let last=path.length-1;
      while(path[last].sceneId!==sceneId){
        const scene=this.plan.scenes[path[last].sceneId];
        requireValue(!this.firstBarrier(scene,scene.durationMs,path[last]),'SEEK_BARRIER','A host-state dependency blocks this seek.');
        requireValue(scene.next,'BRANCH_REQUIRED','Choose the branch before seeking into it.');
        path.push({sceneId:scene.next,visitId:'visit.'+(++serial)});last++;
      }index=last;
    }
    for(let i=0;i<index;i++)requireValue(!this.firstBarrier(this.plan.scenes[path[i].sceneId],this.plan.scenes[path[i].sceneId].durationMs,path[i]),'SEEK_BARRIER','A host-state dependency blocks this seek.');
    const blocker=this.firstBarrier(this.plan.scenes[sceneId],timeMs,path[index]);
    requireValue(!blocker||blocker.atMs===timeMs,'SEEK_BARRIER','Seeking cannot execute or bypass a host-state dependency.');
    this.cancelPending();this.reasons=new Set(['user']);this.path=path;this.cursor=index;this.time=timeMs;
    this.clock.setScene(this.scene);this.clock.setTime(timeMs);this.emit('seeked');this.frame();return this.inspect();
  }
  choose(id){
    this.live();this.controlEpoch++;requireValue(this.reasons.has('choice'),'CHOICE_UNAVAILABLE','No branch choice is pending.');
    const choice=this.scene.choices.find(c=>c.id===id);requireValue(choice,'CHOICE_UNAVAILABLE','Choice is not defined.');
    this.reasons.delete('choice');this.enter(choice.next);if(this.running)this.clock.start();this.emit('choice-selected');return this.inspect();
  }
  next(){this.live();this.controlEpoch++;requireValue(this.reasons.has('step'),'STEP_UNAVAILABLE','No scene boundary is waiting.');this.reasons.delete('step');this.enter(this.scene.next);if(this.running)this.clock.start();return this.inspect();}
  setRate(rate){this.live();requireValue(Number.isFinite(rate)&&rate>=.25&&rate<=4,'INVALID_RATE','Playback rate must be between 0.25 and 4.');this.controlEpoch++;if(this.running)this.tick();this.clock.setRate(rate);this.clock.setTime(this.time);this.emit('rate-changed');}
  extendWait(){this.live();this.controlEpoch++;requireValue(this.pending?.cue.kind==='gate','GATE_UNAVAILABLE','Only a condition wait can be extended.');const cue=this.pending.cue;this.cancelPending();this.enterBarrier(cue);}
  stop(){this.live();this.controlEpoch++;this.clock.pause();this.cancelPending();this.reasons=new Set(['user']);this.cursor=0;this.time=0;this.ready=true;this.clock.setScene(this.scene);this.emit('stopped');this.frame();return this.inspect();}
  fail(error){if(this.destroyed||this.reasons.has('error'))return;this.controlEpoch++;this.cancelPending();try{this.clock.pause();}catch{this.clock.destroy();}this.reasons.add('error');this.emit('diagnostic',{diagnostic:diagnostic(error)});}
  destroy(){if(this.destroyed)return;this.controlEpoch++;this.cancelPending();this.clock.destroy();this.destroyed=true;this.emit('destroyed');}
}
