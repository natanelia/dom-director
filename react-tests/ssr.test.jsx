import * as React from 'react';
import {renderToString} from 'react-dom/server';
import {createReactBindings} from '@dom-director/react';
import {HydrationApp} from './hydration-app.jsx';
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const markup=renderToString(<React.StrictMode><HydrationApp/></React.StrictMode>);
writeFileSync(resolve('react-tests/dist/hydration.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><title>Hydration fixture</title><div id="root">${markup}</div><script src="./hydrate.js"></script></html>`);
test('normal React entry imports and renders without browser globals',()=>{
  assert.equal(typeof window,'undefined');assert.equal(typeof document,'undefined');
  assert.match(markup,/unmounted/);assert.match(markup,/Server rendered application/);
});
test('server markup is stable across repeated renders',()=>{
  assert.equal(renderToString(<React.StrictMode><HydrationApp/></React.StrictMode>),markup);
});
test('server render never constructs the browser director',()=>{
  let calls=0;const {useDirector,useDirectorState,DirectorControls}=createReactBindings(React,{createDirector(){calls++;throw Error('must not run');}});
  function App(){const {director}=useDirector();const state=useDirectorState(director);return <><span>{state.status}</span><DirectorControls director={director}/></>;}
  assert.match(renderToString(<App/>),/unmounted/);assert.equal(calls,0);
});
