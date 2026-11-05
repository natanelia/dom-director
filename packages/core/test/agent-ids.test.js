import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentBridge,proposeTargetRepair} from '../src/agent.js';
const director={sessionId:'director.ids',registry:{catalog:()=>[]},inspect:()=>({revision:0}),load(){},play(){},pause(){},seek(){},stop(){}};
test('host client IDs and target grants require actual strings',()=>{
  for(const clientId of [undefined,null,23,{},'']) assert.throws(()=>createAgentBridge(director,{clientId}),/Invalid bounded/);
  assert.throws(()=>createAgentBridge(director,{clientId:'other',targetIds:[undefined]}),/Invalid bounded/);
});
test('repair cannot treat missing IDs as the string undefined',async()=>{
  const script={schemaVersion:'0.1.0-draft.1',id:'ids',title:'IDs',locale:'en',entryScene:'one',modes:['watch'],capabilities:[],targets:{button:{ref:'app.button'}},scenes:[{id:'one',title:'One',summary:'One',durationMs:1000,cues:[]}]};
  const result=await proposeTargetRepair(script,{alias:'button',reason:'Missing replacement'},[{}]);
  assert.equal(result.diagnostics[0].code,'REPAIR_INVALID');
});
