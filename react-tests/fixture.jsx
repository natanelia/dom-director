import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import * as core from '@dom-director/core';
import {createReactBindings} from '@dom-director/react';
const metrics=window.metrics={created:0,destroyed:0,live:0,maxLive:0,subscriptions:0,frames:0,renders:0};
const wrapped={...core,createDirector(options){
  const d=core.createDirector(options);metrics.created++;metrics.live++;metrics.maxLive=Math.max(metrics.maxLive,metrics.live);
  const subscriptions=new Set();
  for(const key of ['on','onFrame']){
    const original=d[key];d[key]=fn=>{const off=original(fn),token={};subscriptions.add(token);metrics.subscriptions++;
      return()=>{if(subscriptions.delete(token)){metrics.subscriptions--;off();}};};
  }
  const destroy=d.destroy;let closed=false;
  d.destroy=()=>{if(closed)return;closed=true;destroy();metrics.destroyed++;metrics.live--;metrics.subscriptions-=subscriptions.size;subscriptions.clear();};
  return d;
}};
const {useDirector,useDirectorState,useDirectorFrame,useDirectorTarget,DirectorControls,DirectorProvider,useDirectorContext}=createReactBindings(React,wrapped);
const makeScript=variant=>({schemaVersion:'0.1.0-draft.1',id:'react-'+variant,title:'React lifecycle',locale:'en',entryScene:'one',modes:['watch'],capabilities:[],
 targets:{button:{ref:'app.button'},portal:{ref:'app.portal'}},scenes:[{id:'one',title:'React surface',summary:'An owned camera with real controls.',durationMs:10000,
 cues:[{id:'shot',kind:'camera',at:0,durationMs:1000,target:variant==='portal'?'portal':'button'}]}]});
function Status({director}){
  metrics.renders++;const state=useDirectorState(director);useDirectorFrame(director,()=>metrics.frames++);
  return <output id="status" data-status={state.status} data-session={director?.sessionId||''}>{state.status}</output>;
}
function PortalButton({targetRef}){
  const director=useDirectorContext();
  return <button id="portal-button" ref={targetRef} data-session={director?.sessionId||''} onClick={()=>window.portalClicks=(window.portalClicks||0)+1}>Portal target</button>;
}
function App(){
  const [variant,setVariant]=React.useState('button'),[count,setCount]=React.useState(0),[target,setTarget]=React.useState(true);
  const registry=React.useMemo(()=>core.createTargetRegistry(),[]);
  const options=React.useMemo(()=>({registry}),[registry]);
  const script=React.useMemo(()=>makeScript(variant),[variant]);
  const {director,error,viewportRef,sceneRef,overlayRef}=useDirector({script,options});
  const targetRef=useDirectorTarget(registry,'app.button',{label:'Application button'});
  const portalRef=useDirectorTarget(registry,'app.portal',{label:'Portal button'});
  React.useEffect(()=>{window.director=director;window.registry=registry;return()=>{if(window.director===director)window.director=null;};},[director,registry]);
  return <DirectorProvider director={director}>
    <p><Status director={director}/> <span id="count">{count}</span></p>
    <button id="rerender" onClick={()=>setCount(c=>c+1)}>Rerender host</button>
    <button id="replace-script" onClick={()=>setVariant(v=>v==='button'?'other':'button')}>Replace script</button>
    <button id="portal-tour" onClick={()=>setVariant('portal')}>Explain portal</button>
    <button id="toggle-target" onClick={()=>setTarget(v=>!v)}>Toggle target</button>
    <div id="viewport" ref={viewportRef}><div id="scene" ref={sceneRef}>{target&&<button id="target" ref={targetRef} onClick={()=>setCount(c=>c+1)}>Actual application button</button>}</div></div>
    <div id="overlay" ref={overlayRef}/>
    <DirectorControls director={director} id="react-controls"/>
    <output id="react-error">{error?.code||''}</output>
    {createPortal(<PortalButton targetRef={portalRef}/>,document.querySelector('#portal-root'))}
  </DirectorProvider>;
}
let root=null;
window.mountFixture=()=>{if(root)return;root=createRoot(document.querySelector('#root'));root.render(<React.StrictMode><App/></React.StrictMode>);};
window.unmountFixture=()=>{root?.unmount();root=null;};
window.mountFixture();
