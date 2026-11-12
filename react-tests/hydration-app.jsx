import * as React from 'react';
import {useDirector,useDirectorState,DirectorControls} from '@dom-director/react';
const script={schemaVersion:'0.1.0-draft.1',id:'hydration',title:'Hydration',locale:'en',entryScene:'one',modes:['watch'],capabilities:[],targets:{},scenes:[{id:'one',title:'One',summary:'Same first render on server and client.',durationMs:2000,cues:[]}]};
export function HydrationApp(){
  const {director,viewportRef,sceneRef,overlayRef}=useDirector({script});
  const state=useDirectorState(director);
  return <main><output id="hydration-status">{state.status}</output>
    <div ref={viewportRef} style={{position:'relative',width:600,height:300,overflow:'hidden'}}><div ref={sceneRef} style={{width:800,height:400}}>Server rendered application</div></div>
    <div ref={overlayRef} style={{position:'fixed',inset:0,pointerEvents:'none'}}/><DirectorControls director={director}/></main>;
}
