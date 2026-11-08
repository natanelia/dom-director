import test from 'node:test';
import assert from 'node:assert/strict';
import {VIDEO_DEFAULTS,videoCommand} from '../../../site/studio-video.mjs';
const options = change => ({...VIDEO_DEFAULTS,...change});

test('local video settings import without DOM and generate the actual CLI flags',()=>{
  assert.equal(typeof document,'undefined');
  assert.equal(videoCommand(options()).command,'python3 tools/render_video.py --project walkthrough.director --output walkthrough.mp4 --width 1280 --fps 30');
  assert.equal(videoCommand(options()).frames,null);
  assert.ok(Object.isFrozen(VIDEO_DEFAULTS));
});
test('all supported containers resolutions and frame rates are available',()=>{
  for(const format of ['mp4','webm'])for(const width of [960,1280,1920])for(const fps of [24,30,60]){
    const result=videoCommand(options({format,width,fps}));
    assert.ok(result.command.includes(`walkthrough.${format} --width ${width} --fps ${fps}`));
  }
});
test('explicit seconds convert to exact integer milliseconds with ceiling frame counts',()=>{
  const result=videoCommand(options({range:'range',start:'6.980',end:'7.081'}));
  assert.ok(result.command.endsWith('--start-ms 6980 --end-ms 7081'));
  assert.equal(result.frames,4);
  assert.equal(videoCommand(options({range:'range',start:'0',end:'0.001',fps:60})).frames,1);
});
test('silence captions and reduced motion are independent explicit output options',()=>{
  const result=videoCommand(options({audio:false,captions:false,reduced:true}));
  assert.ok(result.command.endsWith('--silent --no-captions --reduced-motion'));
  assert.ok(!videoCommand(options()).command.includes('--silent'));
});
test('range limits are strict and invalid values are never silently rounded',()=>{
  for(const [start,end] of [['-1','2'],['2','2'],['2','1'],['0','120.001'],['','3'],['0','Infinity'],['0','0.0001'],['1e3','1001'],['9007199254740992','9007199254740993']]){
    assert.throws(()=>videoCommand(options({range:'range',start,end})),start+' / '+end);
  }
  assert.equal(videoCommand(options({range:'range',start:'10.001',end:'130.001'})).frames,3600);
});
test('hidden manual range values cannot affect whole-project output',()=>{
  assert.equal(videoCommand(options({start:'bad',end:'bad'})).command,videoCommand(options()).command);
});
test('shell syntax and type coercions never enter generated arguments',()=>{
  for(const bad of [{format:'mp4; rm -rf .'}, {width:'1280'}, {fps:'30 && echo x'}, {range:'$(x)'},{audio:'false'},{captions:1},{reduced:null}])assert.throws(()=>videoCommand(options(bad)));
  assert.throws(()=>videoCommand(options({range:'range',start:'$(x)',end:'2'})));
  assert.throws(()=>videoCommand(options({range:'range',start:0,end:'2'})));
});
test('command construction never mutates caller options',()=>{
  const input=Object.freeze(options({format:'webm',range:'range',start:'0',end:'1'}));
  const before=JSON.stringify(input);videoCommand(input);assert.equal(JSON.stringify(input),before);
});
