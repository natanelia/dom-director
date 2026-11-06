import * as React from 'react';
import {createTargetRegistry,type Tour} from '@dom-director/core';
import {useDirector,useDirectorState,useDirectorFrame,useDirectorTarget,DirectorControls,DirectorProvider,createReactBindings} from '@dom-director/react';
import * as core from '@dom-director/core';
import {createReactBindings as injected} from '@dom-director/react/bindings';
const script={schemaVersion:'0.1.0-draft.1',id:'react-types',title:'React types',locale:'en',entryScene:'one',modes:['watch'],capabilities:[],targets:{},scenes:[{id:'one',title:'One',summary:'Typed host.',durationMs:1000,cues:[]}]} as const satisfies Tour;
export function Example(){
  const registry=React.useMemo(()=>createTargetRegistry(),[]),options=React.useMemo(()=>({registry}),[registry]);
  const {director,viewportRef,sceneRef,overlayRef}=useDirector({script,options});
  const target=useDirectorTarget(registry,'app.button'),state=useDirectorState(director);
  useDirectorFrame(director,frame=>{const milliseconds:number=frame.timeMs;void milliseconds;});
  return <DirectorProvider director={director}><output>{state.status}</output><div ref={viewportRef}><div ref={sceneRef}><button ref={target}>Real control</button></div></div><div ref={overlayRef}/><DirectorControls director={director}/></DirectorProvider>;
}
createReactBindings(React,core);injected(React,core);
// @ts-expect-error the owner is not a string identifier
useDirectorState('director.1');
// @ts-expect-error scene refs must attach to actual elements, not numbers
useDirectorTarget(createTargetRegistry(),'app.button')(42);
