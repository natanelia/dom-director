import {createDirector,compile,sampleVisual,createTargetRegistry} from '../packages/core/src/index.js';
const $=id=>document.getElementById(id),surface={viewport:$('viewport'),scene:$('scene'),overlay:$('overlay')};
const script={schemaVersion:'0.1.0-draft.1',id:'benchmark',title:'Synthetic camera workload',locale:'en',entryScene:'one',modes:['watch'],capabilities:[],targets:{target:{ref:'app.target'}},scenes:[{id:'one',title:'One',summary:'A static target in a synthetic application.',durationMs:10000,cues:[{id:'camera',kind:'camera',at:0,durationMs:1000,target:'target',paddingPx:24,minScale:.1,maxScale:2}]}]};
const plan=compile(script).plan;
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const sample=time=>sampleVisual(plan.scenes.one,time,{target:{space:'scene',rect:{x:550,y:220,width:140,height:80}}},{x:0,y:0,width:800,height:500}).camera;
function fixture(count){
  surface.scene.replaceChildren();const fragment=document.createDocumentFragment();
  for(let i=0;i<count;i++){
    const el=document.createElement('div');el.className='cell';el.style.left=(i*13%990)+'px';el.style.top=(i*7%590)+'px';
    if(i===0){el.id='target';el.className='';el.style.cssText='';el.textContent='Target';}
    fragment.append(el);
  }
  surface.scene.append(fragment);
}
function scheduler(){let now=0,serial=0;const queue=new Map();return {now:()=>now,request:fn=>{const id=++serial;queue.set(id,fn);return id;},cancel:id=>queue.delete(id),step(value){now=value;const tasks=[...queue.values()];queue.clear();for(const fn of tasks)fn(value);},pending:()=>queue.size};}
const quantile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];};
window.measureWorkload=async({count,updating,kind,runs=20,warmup=5,frames=30})=>{
  fixture(count);await nextFrame();await nextFrame();const data=[];
  for(let run=-warmup;run<runs;run++){
    surface.scene.style.transform='';surface.scene.style.transformOrigin='';
    const timing=scheduler();let director=null;const before=performance.now();
    if(kind==='sdk'){
      director=createDirector({surface,scheduler:timing,targets:{'app.target':()=>$('target')}});
      const loaded=director.load(script);if(!loaded.ok)throw Error(JSON.stringify(loaded));
      if(director.surface.kind!=='managed-dom')throw Error('Benchmark unexpectedly fell back to overlays');
    }else if(kind==='direct')surface.scene.style.transformOrigin='0 0';
    const setupMs=performance.now()-before;
    await nextFrame();await nextFrame();
    const startReads=director?.inspect().geometryReads||0;
    const cpu=[],intervals=[];let previous=performance.now();director?.play();
    for(let frame=0;frame<frames;frame++){
      await nextFrame();const begin=performance.now();intervals.push(begin-previous);previous=begin;
      if(updating&&frame%4===0)surface.scene.lastElementChild.textContent='Host update '+frame;
      if(kind==='sdk')timing.step((frame+1)*16);
      else if(kind==='direct'){
        const pose=sample((frame+1)*16);
        surface.scene.style.transform=`translate3d(${pose.x}px,${pose.y}px,0) scale(${pose.scale})`;
      }
      cpu.push(performance.now()-begin);
    }
    const reads=director?(director.inspect().geometryReads-startReads):0;
    if(director){
      if(director.inspect().status!=='playing')throw Error('Player stopped during measurement');
      const expected=sample(frames*16),actual=director.surface.pose;
      if(['x','y','scale'].some(key=>Math.abs(actual[key]-expected[key])>1e-4))throw Error('Measured camera differs from direct reference');
      if(reads>(updating?Math.ceil(frames/4)+3:3))throw Error('Geometry was unexpectedly reread each frame: '+reads);
    }
    director?.destroy();if(timing.pending())throw Error('Scheduled work survived destroy');
    surface.scene.style.transform='';surface.scene.style.transformOrigin='';
    if(run>=0)data.push({setupMs,cpu,intervals,geometryReads:reads});
  }
  const cpu=data.flatMap(r=>r.cpu),intervals=data.flatMap(r=>r.intervals);
  return {count,updating,kind,runs,warmup,frames,summary:{cpuP50Ms:quantile(cpu,.5),cpuP95Ms:quantile(cpu,.95),cpuMaxMs:Math.max(...cpu),frameIntervalP95Ms:quantile(intervals,.95),setupP95Ms:quantile(data.map(r=>r.setupMs),.95),maxGeometryReads:Math.max(...data.map(r=>r.geometryReads))},runsData:data};
};
window.checkCleanup=async(cycles=100)=>{
  fixture(100);await nextFrame();const scene=surface.scene,original=[scene.style.cssText,surface.viewport.style.cssText,surface.overlay.style.cssText],target=$('target');
  const resize=window.ResizeObserver,mutation=window.MutationObserver,matchMedia=window.matchMedia;
  let activeResize=0,activeMutation=0;
  window.ResizeObserver=class extends resize{constructor(fn){super(fn);this.active=false;}observe(...args){if(!this.active){this.active=true;activeResize++;}return super.observe(...args);}disconnect(){if(this.active){this.active=false;activeResize--;}return super.disconnect();}};
  window.MutationObserver=class extends mutation{constructor(fn){super(fn);this.active=false;}observe(...args){if(!this.active){this.active=true;activeMutation++;}return super.observe(...args);}disconnect(){if(this.active){this.active=false;activeMutation--;}return super.disconnect();}};
  const restore=[],seen=new WeakSet();let listeners=0;
  function track(target){
    if(!target||seen.has(target))return;seen.add(target);
    const add=target.addEventListener,remove=target.removeEventListener,entries=[];
    target.addEventListener=function(type,fn,options){const capture=typeof options==='boolean'?options:!!options?.capture;if(!entries.some(e=>e.type===type&&e.fn===fn&&e.capture===capture)){entries.push({type,fn,capture});listeners++;}return add.call(this,type,fn,options);};
    target.removeEventListener=function(type,fn,options){const capture=typeof options==='boolean'?options:!!options?.capture;const index=entries.findIndex(e=>e.type===type&&e.fn===fn&&e.capture===capture);if(index>=0){entries.splice(index,1);listeners--;}return remove.call(this,type,fn,options);};
    restore.push(()=>{target.addEventListener=add;target.removeEventListener=remove;});
  }
  [window,document,surface.viewport,scene,document.fonts,window.visualViewport].forEach(track);
  window.matchMedia=function(query){const result=matchMedia.call(window,query);track(result);return result;};
  const results=[];
  try{
    for(let cycle=0;cycle<cycles;cycle++){
      const timing=scheduler(),registry=createTargetRegistry({'app.target':()=>$('target')}),d=createDirector({surface,scheduler:timing,registry});
      if(!d.load(script).ok)throw Error('Cleanup fixture failed to prepare');d.play();timing.step(200);d.seek({sceneId:'one',timeMs:500});d.destroy();d.destroy();
      await Promise.resolve();
      const styles=[scene.style.cssText,surface.viewport.style.cssText,surface.overlay.style.cssText];
      const result={cycle,activeResize,activeMutation,listeners,frames:timing.pending(),overlays:surface.overlay.childElementCount,stylesRestored:styles.every((s,i)=>s===original[i]),domUnchanged:scene.children.length===100&&$('target')===target};results.push(result);
      if(activeResize||activeMutation||listeners||result.frames||result.overlays||!result.stylesRestored||!result.domUnchanged)throw Error(JSON.stringify(result));
    }
  }finally{window.ResizeObserver=resize;window.MutationObserver=mutation;window.matchMedia=matchMedia;restore.forEach(fn=>fn());}
  return {cycles,passed:true,last:results.at(-1)};
};
window.performanceReady=true;
