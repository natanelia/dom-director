import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {compile,preview} from '../src/compiler.js';
import {parseJSON,cloneData} from '../src/json.js';
const root=new URL('../../../examples/',import.meta.url);
const fixture=()=>JSON.parse(readFileSync(new URL('minimal.tour.json',root),'utf8'));
const invalid=(change,code)=>{const data=fixture();change(data);const result=compile(data);assert.equal(result.ok,false);if(code)assert.ok(result.diagnostics.some(d=>d.code===code),JSON.stringify(result.diagnostics));};
for(const file of readdirSync(root).filter(f=>f.endsWith('.tour.json'))){
  test('canonical example compiles: '+file,()=>{const result=compile(readFileSync(new URL(file,root),'utf8'));assert.equal(result.ok,true,JSON.stringify(result.diagnostics));assert.ok(Object.isFrozen(result.plan));});
}
test('reject unknown fields, wrong versions and malformed numbers',()=>{
  invalid(x=>{x.execute='alert(1)';},'SCHEMA_INVALID');invalid(x=>{x.schemaVersion='future';},'SCHEMA_INVALID');
  invalid(x=>{x.scenes[0].durationMs=-1;});invalid(x=>{x.scenes[0].durationMs=1.25;});invalid(x=>{x.scenes[0].durationMs=Infinity;});
});
test('reject graph mistakes and duplicate IDs',()=>{
  invalid(x=>{x.entryScene='absent';},'ENTRY_REFERENCE');invalid(x=>{x.scenes[1].next=x.entryScene;},'GRAPH_CYCLE');
  invalid(x=>{x.scenes[0].next='absent';},'SCENE_REFERENCE');invalid(x=>{delete x.scenes[0].next;},'UNREACHABLE_SCENE');
  invalid(x=>{x.scenes[1].id=x.entryScene;},'DUPLICATE_SCENE');invalid(x=>{x.scenes[1].cues[0].id=x.scenes[0].cues[0].id;},'DUPLICATE_CUE');
});
test('reject dangling targets, overlapping camera/cursor and out of bounds timing',()=>{
  invalid(x=>{x.scenes[0].cues[0].target='absent';},'TARGET_REFERENCE');
  invalid(x=>{x.scenes[0].cues.push({...x.scenes[0].cues[0],id:'another-camera',at:100});},'TRACK_CONFLICT');
  invalid(x=>{x.scenes[0].cues[0].durationMs=4000;},'CUE_RANGE');
  invalid(x=>{x.scenes[1].cues[1].gesture='drag';},'CURSOR_SOURCE');
  invalid(x=>{x.scenes[0].cues[0].minScale=4;},'SCALE_RANGE');
});
test('symbolic narration anchors resolve before playback',()=>{
  const data=fixture();data.scenes[0].narration={transcript:'Hello',cues:[{id:'hello',startMs:100,endMs:800,text:'Hello'}]};
  data.scenes[0].cues[0].at={narrationCue:'hello',edge:'end',offsetMs:100};
  const result=compile(data);assert.equal(result.ok,true);assert.equal(result.plan.scenes.overview.cues.find(c=>c.kind==='camera').atMs,900);
  data.scenes[0].cues[0].at.narrationCue='missing';assert.equal(compile(data).ok,false);
  data.scenes[0].cues[0].at.narrationCue='hello';data.scenes[0].narration.cues[0].endMs=4000;assert.equal(compile(data).ok,false);
});
test('actions require declared capabilities; preview contains no action parameters',()=>{
  const data=fixture();data.scenes[0].cues.push({id:'do-save',kind:'action',at:900,actionRef:'save',args:{password:'sensitive-value'},timeoutMs:1000});
  assert.equal(compile(data).ok,false);data.capabilities=['action:save'];assert.equal(compile(data).ok,true);
  assert.ok(!JSON.stringify(preview(data)).includes('sensitive-value'));assert.ok(!JSON.stringify(preview(data)).includes('password'));
});
test('JSON parser rejects duplicate/reserved keys, functions, accessors, cycles and limits',()=>{
  for(const value of ['{"a":1,"a":2}','{"__proto__":{}}','{"x":NaN}','{"x":1e999}','[1,]','{"x":"\\ud800"}','['.repeat(42)+'0'+']'.repeat(42),'0'.repeat(1024*1024+1)])assert.throws(()=>parseJSON(value));
  const cyclic={};cyclic.x=cyclic;let calls=0;
  for(const value of [cyclic,{x:()=>1},new Date(),Object.create({inherited:1}),{get x(){calls++;return 1;}},[1,,3]])assert.throws(()=>cloneData(value));
  assert.equal(calls,0);
  assert.equal(parseJSON('{"emoji":"😊","x":[true,null,-1.2e3]}').emoji,'😊');
});
test('compiled plans are immutable copies and diagnostics never echo invalid input values',()=>{
  const data=fixture(),result=compile(data);data.scenes[0].title='changed';assert.notEqual(result.plan.scenes.overview.title,'changed');
  assert.throws(()=>{result.plan.scenes.overview.title='mutation';});
  data.scenes[0].durationMs='private-account-number';assert.ok(!JSON.stringify(compile(data)).includes('private-account-number'));
});
test('unsafe remote/local asset references are rejected without fetching them',()=>{
  for(const uri of ['javascript:alert(1)','http://example.test/a','https://user:pass@example.test/a','../secret','./../secret','./%2e%2e/secret','./a?token=secret','\\\\example.test/a'])invalid(x=>{x.assets={a:{kind:'audio',uri}};},'ASSET_URI');
});
