import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from '../src/compiler.js';
import {sharedScenario} from '../../../examples/browser/shared-scenario.mjs';

test('one canonical scenario compiles for all three advertised modes',()=>{
  const result=compile(sharedScenario);
  assert.equal(result.ok,true,JSON.stringify(result.diagnostics));
  assert.deepEqual(sharedScenario.modes,['watch','try','guide']);
  assert.ok(sharedScenario.capabilities.includes('fixture:reset'));
});
test('shared scenario contains a real gate and no scripted approval action',()=>{
  const cues=sharedScenario.scenes.flatMap(scene=>scene.cues);
  assert.equal(cues.filter(cue=>cue.kind==='gate').length,1);
  assert.equal(cues.filter(cue=>cue.kind==='action').length,0);
  assert.equal(cues.find(cue=>cue.kind==='gate').onTimeout,'pause');
});
