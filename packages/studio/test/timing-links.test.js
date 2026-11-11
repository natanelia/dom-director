import test from 'node:test';
import assert from 'node:assert/strict';
import {createSample,editProject,findClip,validateProject,updateClip,moveClip,trimClip,splitClip,duplicateClip,deleteClip,reorderScene,proposeRetime,createProjectStore,createEvaluator,STUDIO_VERSION,LINKED_STUDIO_VERSION} from '../src/index.js';
import {distributeCaptionWords,stampCaptionWord,updateKeyframe,moveTimelineKeyframe,addKeyframe,deleteScene,proposeVoiceReplacement,alignKeyframeToCaptionWord} from '../src/editing.js';
import {linkKeyframeToCaptionWord,detachTimingLink,detachCaptionTimingLinks,describeTimingLinks,setTimingLinkOffset} from '../src/timing-links.js';
import {saveProjectBundle,readProjectBundle} from '../src/media.js';
const captionId='cc.overview.0',clipId='camera.overview',keyId='camera.to.overview';
const clone=x=>JSON.parse(JSON.stringify(x));
const key=(p,c=clipId,k=keyId)=>findClip(p,c).clip.keys.find(x=>x.id===k);
const base=()=>updateClip(createSample(),captionId,{text:'Review this route.',words:[{text:'Review',startMs:200,endMs:700},{text:'this',startMs:800,endMs:1300},{text:'route.',startMs:1400,endMs:2000}]});
const linked=(p=base(),options={})=>linkKeyframeToCaptionWord(p,clipId,keyId,{captionId,wordIndex:1,offsetMs:200,...options});
const bounds={'orbit.overview':{x:0,y:0,width:960,height:540},'orbit.metrics':{x:70,y:60,width:350,height:130},'orbit.map':{x:70,y:240,width:500,height:260}};

test('legacy files remain unchanged and first persistent link explicitly opts into draft.2',()=>{
 const p=base(),before=clone(p),n=linked(p);
 assert.equal(p.studioVersion,STUDIO_VERSION);assert.equal(n.studioVersion,LINKED_STUDIO_VERSION);
 assert.deepEqual(clone(p),before);assert.ok(Object.isFrozen(key(n).timing));assert.equal(key(n).atMs,1000);
 assert.equal(key(n).timing.wordId,findClip(n,captionId).clip.words[1].id);
 assert.deepEqual(validateProject(JSON.stringify(p)).value,p);
 const legacy=clone(n);legacy.studioVersion=STUDIO_VERSION;assert.equal(validateProject(legacy).ok,false);
});
test('caption word edits atomically move camera and cursor while preserving voice and appearance',()=>{
 let p=linked();p=linkKeyframeToCaptionWord(p,'cursor.overview','cursor.to.overview',{captionId,wordIndex:1,offsetMs:400});
 const n=stampCaptionWord(p,captionId,1,'start',900);
 assert.equal(key(n).atMs,1100);assert.equal(key(n,'cursor.overview','cursor.to.overview').atMs,1300);
 assert.deepEqual(n.tracks[2],p.tracks[2]);assert.deepEqual(n.assets,p.assets);assert.deepEqual(n.cursorTheme,p.cursorTheme);
 assert.equal(describeTimingLinks(n).length,2);assert.ok(Object.isFrozen(describeTimingLinks(n)[0]));
});
test('caption movement, end boundary and negative delay use scene-local time exactly',()=>{
 const p=linked(base(),{boundary:'end',offsetMs:-100}),n=moveClip(deleteClip(p,'cc.overview.1'),captionId,100);
 assert.equal(key(p).atMs,1200);assert.equal(key(n).atMs,1300);assert.equal(key(n).timing.offsetMs,-100);
});
test('manual timeline and exact key edits adjust delay without detaching',()=>{
 const p=linked(),n=moveTimelineKeyframe(p,clipId,keyId,1111);
 assert.equal(key(n).atMs,1111);assert.equal(key(n).timing.offsetMs,311);
 assert.equal(key(stampCaptionWord(n,captionId,1,'start',900)).atMs,1211);
 const changed=updateKeyframe(n,clipId,keyId,{x:18,zoom:2});assert.equal(key(changed).timing.offsetMs,311);
});
test('explicit delay and detach preserve motion path and timing ownership',()=>{
 const p=linked(),n=setTimingLinkOffset(p,clipId,keyId,321);
 assert.equal(key(n).atMs,1121);const detached=detachTimingLink(n,clipId,keyId);
 assert.equal(key(detached).timing,undefined);assert.equal(key(detached).atMs,1121);
 assert.equal(key(stampCaptionWord(detached,captionId,1,'start',900)).atMs,1121);
 assert.equal(detached.studioVersion,LINKED_STUDIO_VERSION);
});
test('missing source words are never rebound to repeated text or array positions',()=>{
 const p=linked();assert.throws(()=>editProject(p,n=>{const c=findClip(n,captionId).clip;c.words.splice(1,1);c.text='Review route.';}),/linked word is missing/);
 assert.throws(()=>distributeCaptionWords(p,captionId),/linked word is missing/);
 assert.throws(()=>editProject(p,n=>{const c=findClip(n,captionId).clip;c.words[1]={text:'this',startMs:800,endMs:1300};}),/linked word is missing/);
});
test('text correction preserving a word identity does not change its link or voice',()=>{
 const p=linked(),n=editProject(p,d=>{const c=findClip(d,captionId).clip;c.words[1].text='the';c.text='Review the route.';});
 assert.equal(describeTimingLinks(n)[0].text,'the');assert.equal(key(n).atMs,1000);assert.deepEqual(n.tracks[2],p.tracks[2]);
});
test('caption split preserves word identity and explicitly moves references to the right piece',()=>{
 const p=linked(base(),{wordIndex:2}),n=splitClip(p,captionId,1350),link=describeTimingLinks(n)[0];
 assert.notEqual(link.captionId,captionId);assert.equal(link.wordId,key(p).timing.wordId);assert.equal(link.projectTimeMs,1600);
 assert.equal(key(n).atMs,key(p).atMs);assert.equal(link.wordIndex,0);
});
test('motion split retains linked source keys and preserves deterministic evaluation',()=>{
 const p=linked(),n=splitClip(p,clipId,600),a=createEvaluator(p),b=createEvaluator(n);
 assert.equal(describeTimingLinks(n).length,2);assert.equal(describeTimingLinks(n).filter(r=>r.visible).length,1);
 for(const t of [0,100,599,600,601,1000,2200])assert.deepEqual(a.sample(t,bounds).camera,b.sample(t,bounds).camera);
 const edited=stampCaptionWord(n,captionId,1,'start',900);
 assert.deepEqual(describeTimingLinks(edited).map(r=>r.sourceTimeMs),[1100,1100]);
});
test('trimmed motion retains off-window links without clamping interpolation',()=>{
 const p=linked(),n=trimClip(p,clipId,2000,6000);
 assert.equal(key(n).atMs,1000);assert.equal(describeTimingLinks(n)[0].visible,false);
 assert.equal(key(stampCaptionWord(n,captionId,1,'start',900)).atMs,1100);
});
test('duplicating captions gives copied words fresh identities, leaving links on the original',()=>{
 const p=deleteClip(linked(),'cc.overview.1'),n=duplicateClip(p,captionId),original=findClip(p,captionId).clip.words[1];
 const duplicate=n.tracks[3].clips.at(-1);assert.notEqual(duplicate.words[1].id,original.id);
 assert.equal(key(n).timing.captionId,captionId);assert.equal(key(n).atMs,1000);
});
test('duplicated motion preserves the original animation with an explicit delayed link',()=>{
 const p=trimClip(linked(),clipId,0,3000),n=duplicateClip(p,clipId),copy=n.tracks[0].clips.at(-1),linkedKey=copy.keys.find(k=>k.timing);
 assert.equal(linkedKey.atMs,1000);assert.equal(linkedKey.timing.offsetMs,3200);assert.equal(key(n).timing.offsetMs,200);
 assert.equal(describeTimingLinks(n).at(-1).projectTimeMs,4000);
});
test('adding a key copies visual properties, not another key’s timing relation',()=>{
 const n=addKeyframe(linked(),clipId,2000),added=findClip(n,clipId).clip.keys.find(k=>k.atMs===2000);
 assert.equal(added.timing,undefined);assert.equal(describeTimingLinks(n).length,1);
});
test('scene retiming keeps authored delays fixed and never stretches voice audio',()=>{
 const p=linked(),r=proposeRetime(p,'overview',9000),word=findClip(r.value,captionId).clip.words[1];
 assert.equal(key(r.value).atMs,word.startMs+200);assert.equal(key(r.value).timing.offsetMs,200);
 assert.equal(findClip(r.value,'voice.overview').clip.durationMs,findClip(p,'voice.overview').clip.durationMs);
 assert.equal(findClip(r.value,captionId).clip.words[1].id,key(p).timing.wordId);
});
test('voice replacement fits scene only through the existing proposal and preserves word links',()=>{
 const p=linked(),asset={id:'new.take',name:'Different pace',mime:'audio/wav',durationMs:9000,source:'local'};
 const r=proposeVoiceReplacement(p,'voice.overview',asset,{fitScene:true});
 assert.equal(key(r.value).atMs,findClip(r.value,captionId).clip.words[1].startMs+200);
 assert.equal(p.scenes[0].durationMs,6980);assert.equal(findClip(p,'voice.overview').clip.assetId,'audio.overview');
});
test('locked linked motion blocks indirect caption changes and keeps the old project intact',()=>{
 const p=editProject(linked(),n=>n.tracks[0].locked=true),before=clone(p);
 assert.throws(()=>stampCaptionWord(p,captionId,1,'start',900),/locked/);assert.deepEqual(clone(p),before);
 assert.throws(()=>detachCaptionTimingLinks(p,captionId),/locked/);
});
test('first word identity needs an unlocked caption, already identified locked words can be referenced',()=>{
 const locked=editProject(base(),p=>p.tracks[3].locked=true);assert.throws(()=>linked(locked),/Unlock the caption track/);
 const p=editProject(linked(),n=>n.tracks[3].locked=true);
 const n=linkKeyframeToCaptionWord(p,'cursor.overview','cursor.to.overview',{captionId,wordIndex:1,offsetMs:200});
 assert.equal(describeTimingLinks(n).length,2);
});
test('same-time collisions and negative source times reject the entire edit',()=>{
 const p=linked(),before=clone(p);
 assert.throws(()=>setTimingLinkOffset(p,clipId,keyId,-800),/times must increase/);
 assert.throws(()=>setTimingLinkOffset(p,clipId,keyId,-801),/outside its motion source/);
 assert.deepEqual(clone(p),before);
});
test('deleting a linked caption is refused; explicit detach keeps key time before removal',()=>{
 const p=linked();assert.throws(()=>deleteClip(p,captionId),/linked caption must exist/);
 const n=deleteClip(detachCaptionTimingLinks(p,captionId),captionId);assert.equal(key(n).atMs,1000);assert.equal(key(n).timing,undefined);
});
test('scene deletion removes both sides; reorder changes only global placement',()=>{
 const p=linked(),reordered=reorderScene(p,'overview',1);
 assert.equal(key(reordered).atMs,1000);assert.equal(describeTimingLinks(reordered)[0].projectTimeMs,9208);
 assert.equal(describeTimingLinks(deleteScene(p,'overview')).length,0);
});
test('switching or hiding the caption language never silently retargets an existing link',()=>{
 const p=linked(),n=editProject(p,d=>{d.tracks[3].enabled=false;d.tracks.push({id:'cc.other',kind:'captions',name:'Other',enabled:true,locked:false,language:'id',clips:[]});d.captionTrack='cc.other';});
 assert.equal(key(n).atMs,1000);assert.equal(describeTimingLinks(n)[0].captionTrackId,'cc.en');
 assert.throws(()=>linked(n),/visible caption language/);
});
test('malformed/dangling/forged imported links and duplicate word IDs fail closed',()=>{
 for(const mutate of [
 p=>{key(p).atMs+=1;},p=>{key(p).timing.offsetMs=NaN;},p=>{key(p).timing.wordId='missing';},
 p=>{key(p).timing.boundary='middle';},p=>{key(p).timing.run='code';},p=>{key(p).timing=null;},
 p=>{findClip(p,captionId).clip.words[0].id=findClip(p,captionId).clip.words[1].id;},
 p=>{key(p).timing.captionId='cc.signal.0';},
 ]){const p=clone(linked());mutate(p);assert.equal(validateProject(p).ok,false);}
});
test('bounded data rejection never executes supplied accessors',()=>{
 let reads=0;const p=clone(linked());Object.defineProperty(key(p).timing,'offsetMs',{enumerable:true,get(){reads++;return 0;}});
 assert.equal(validateProject(p).ok,false);assert.equal(reads,0);
});
test('undo/redo restores link identities and all dependent times as one revision',()=>{
 const p=base(),store=createProjectStore(p);store.commit(linked(p),'Link',0);const first=store.snapshot().project;
 store.commit(stampCaptionWord(first,captionId,1,'start',900),'Word edit',1);assert.equal(key(store.snapshot().project).atMs,1100);
 store.undo();assert.deepEqual(store.snapshot().project,first);store.undo();assert.deepEqual(store.snapshot().project,p);
 store.redo();assert.deepEqual(store.snapshot().project,first);assert.throws(()=>store.commit(first,'Stale',1),/Project changed/);
});
test('native save/reopen preserves links with no asset load or repair',async()=>{
 const p=linked(),bundle=await saveProjectBundle(p,{bytes(){throw Error('No local assets should load');}}),opened=await readProjectBundle(bundle);
 assert.deepEqual(opened.project,p);assert.equal(key(stampCaptionWord(opened.project,captionId,1,'start',900)).atMs,1100);
});
test('invalid authoring arguments and cross-scene links never partially migrate input',()=>{
 const p=base(),before=clone(p);
 for(const options of [{wordIndex:-1},{wordIndex:1.2},{wordIndex:9},{boundary:'bad'},{offsetMs:1.2},{offsetMs:180001},{offsetMs:-2000},{captionId:'cc.signal.0'}])assert.throws(()=>linked(p,options));
 assert.deepEqual(clone(p),before);assert.throws(()=>linkKeyframeToCaptionWord(p,'voice.overview',keyId,{captionId,wordIndex:1}));
});

test('one-time alignment never hides or rewrites an existing persistent link',()=>{
 const p=linked(),before=clone(p);
 assert.throws(()=>alignKeyframeToCaptionWord(p,clipId,keyId,{captionId,wordIndex:2}),/Detach this persistent/);
 assert.deepEqual(clone(p),before);
});
