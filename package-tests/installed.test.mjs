import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '@dom-director/core';
import * as surface from '@dom-director/core/surface';
import * as bindings from '@dom-director/react';
import * as React from 'react';
import {renderToString} from 'react-dom/server';
const tour={schemaVersion:'0.1.0-draft.1',id:'installed',title:'Installed package',locale:'en',entryScene:'one',modes:['watch'],capabilities:[],targets:{},scenes:[{id:'one',title:'One',summary:'A clean consumer.',durationMs:1000,cues:[]}]};
test('packed core contains its runtime schemas and all public exports',()=>{
  assert.equal(core.compile(tour).ok,true);assert.equal(core.preview(tour).ok,true);
  for(const name of ['createDirector','createTargetRegistry','createGuidance','createCheckpointStore','createAgentBridge','proposeTargetRepair','mountControls','createCamera','NarrationClock'])assert.equal(typeof core[name],'function',name);
  assert.equal(surface.createSurface,core.createSurface);assert.equal(typeof globalThis.document,'undefined');
});
test('packed React entry renders on the server without constructing a surface',()=>{
  function App(){const {director}=bindings.useDirector({script:tour});const state=bindings.useDirectorState(director);return React.createElement('span',null,state.status);}
  assert.equal(renderToString(React.createElement(App)),'<span>unmounted</span>');
});
test('private implementation paths are not accidental exports',async()=>{
  await assert.rejects(import('@dom-director/core/src/session.js'),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
});
test('agent protocol works from an installed tarball, with no DOM or network',async()=>{
  const owner={sessionId:'installed.1',registry:{catalog:()=>[]},inspect:()=>({revision:0,status:'idle'}),load(){},play(){},pause(){},seek(){},stop(){}};
  const bridge=core.createAgentBridge(owner,{clientId:'installed-client',authorize:()=>true});
  const response=await bridge.handle(JSON.stringify({protocolVersion:core.AGENT_PROTOCOL_VERSION,requestId:'inspect.1',sessionId:owner.sessionId,command:'inspect',params:{}}));
  assert.equal(response.ok,true);assert.equal(response.value.status,'idle');bridge.destroy();
});
