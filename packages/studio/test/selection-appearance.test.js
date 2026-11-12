import test from 'node:test';
import assert from 'node:assert/strict';
import {createSample,editProject,findClip,createProjectStore,CAPTION_THEME,CURSOR_THEME} from '../src/index.js';
import {matchClipAppearance} from '../src/selection.js';
import {distributeCaptionWords} from '../src/editing.js';
import {linkKeyframeToCaptionWord,describeTimingLinks} from '../src/timing-links.js';
const clone=value=>JSON.parse(JSON.stringify(value));
const sansStyle=clip=>{const {style,...rest}=clip;return rest;};
const captionSource='cc.overview.0',captionTarget='cc.signal.0';

test('caption matching resolves defaults, project, track and clip in precedence order',()=>{
  const p=editProject(createSample(),q=>{q.captionTheme={font:'serif',size:35,background:'#ffffff'};
    q.tracks[3].style={size:40,color:'#112233'};
    findClip(q,captionSource).clip.style={size:44,align:'left'};
    findClip(q,captionTarget).clip.style={size:60,padding:2};
  });
  const before=clone(p),q=matchClipAppearance(p,captionSource,[captionSource,captionTarget]);
  const expected={...CAPTION_THEME,...p.captionTheme,...p.tracks[3].style,...findClip(p,captionSource).clip.style};
  assert.deepEqual(clone(findClip(q,captionTarget).clip.style),expected);
  assert.deepEqual(findClip(q,captionSource).clip,findClip(p,captionSource).clip);
  assert.deepEqual(sansStyle(findClip(q,captionTarget).clip),sansStyle(findClip(p,captionTarget).clip));
  assert.deepEqual(q.assets,p.assets);assert.deepEqual(q.scenes,p.scenes);
  assert.deepEqual(q.captionTheme,p.captionTheme);assert.deepEqual(q.tracks[3].style,p.tracks[3].style);
  assert.deepEqual(findClip(q,'cc.story.0').clip,findClip(p,'cc.story.0').clip);
  assert.deepEqual(clone(p),before);assert.ok(Object.isFrozen(findClip(q,captionTarget).clip.style));
});

test('cursor matching preserves keyframes, source windows, gestures, timing and other tracks',()=>{
  const p=editProject(createSample(),q=>{q.cursorTheme={size:38,trail:true};q.tracks[1].style={halo:30};
    findClip(q,'cursor.overview').clip.style={shape:'dot',color:'#123456'};
    const c=findClip(q,'cursor.signal').clip;c.offsetMs=500;c.durationMs-=500;c.style={shape:'hand',size:50};
  });
  const q=matchClipAppearance(p,'cursor.overview',['cursor.signal','cursor.story']);
  const expected={...CURSOR_THEME,...p.cursorTheme,...p.tracks[1].style,...findClip(p,'cursor.overview').clip.style};
  for(const id of ['cursor.signal','cursor.story']){
    assert.deepEqual(clone(findClip(q,id).clip.style),expected);
    assert.deepEqual(sansStyle(findClip(q,id).clip),sansStyle(findClip(p,id).clip));
  }
  for(const i of [0,2,3])assert.deepEqual(q.tracks[i],p.tracks[i]);
});

test('caption word identities and linked camera/cursor timing are unchanged',()=>{
  let p=distributeCaptionWords(createSample(),captionSource);
  p=linkKeyframeToCaptionWord(p,'camera.overview','camera.to.overview',{captionId:captionSource,wordIndex:1});
  p=linkKeyframeToCaptionWord(p,'cursor.overview','cursor.to.overview',{captionId:captionSource,wordIndex:1,offsetMs:50});
  const q=matchClipAppearance(p,captionTarget,[captionSource]);
  assert.deepEqual(findClip(q,captionSource).clip.words,findClip(p,captionSource).clip.words);
  assert.deepEqual(describeTimingLinks(q),describeTimingLinks(p));
  for(const i of [0,1,2])assert.deepEqual(q.tracks[i],p.tracks[i]);
  assert.equal(q.studioVersion,p.studioVersion);
});

test('explicit cross-language matching reads a locked source but never changes it',()=>{
  const p=editProject(createSample(),q=>{q.tracks[3].locked=true;q.tracks[3].style={size:41};
    q.tracks.push({id:'cc.id',kind:'captions',name:'Indonesian',language:'id',enabled:false,locked:false,
      style:{font:'mono',size:25},clips:[{id:'cc.id.0',sceneId:'overview',startMs:0,durationMs:1000,text:'Teks tetap sama.'}]});
  });
  const q=matchClipAppearance(p,captionSource,[captionSource,'cc.id.0']);
  assert.deepEqual(q.tracks[3],p.tracks[3]);assert.equal(q.tracks[4].enabled,false);
  assert.equal(findClip(q,'cc.id.0').clip.style.size,41);
  assert.equal(findClip(q,'cc.id.0').clip.style.font,'sans');
  assert.equal(findClip(q,'cc.id.0').clip.text,'Teks tetap sama.');
  assert.equal(q.captionTrack,p.captionTrack);
});

test('mixed kinds, missing identities, malformed selections and locked targets fail atomically',()=>{
  const p=createSample(),before=clone(p);
  for(const source of ['camera.overview','voice.overview','missing',null])assert.throws(()=>matchClipAppearance(p,source,[captionTarget]));
  for(const ids of [[],[captionTarget,captionTarget],['missing'],[captionTarget,'cursor.signal'],[captionTarget,'voice.signal'],[4],Array(1501).fill(captionTarget)])
    assert.throws(()=>matchClipAppearance(p,captionSource,ids));
  const locked=editProject(p,q=>q.tracks[3].locked=true);
  assert.throws(()=>matchClipAppearance(locked,captionSource,[captionSource,captionTarget]),/locked/);
  assert.deepEqual(clone(p),before);
});

test('matching is one revision-checked undo and repeated matching is a no-op',()=>{
  const p=createSample(),store=createProjectStore(p);
  const matched=matchClipAppearance(p,captionSource,[captionTarget,'cc.story.0']);
  store.commit(matched,'Match appearance',0);assert.equal(store.snapshot().revision,1);
  store.commit(matchClipAppearance(matched,captionSource,[captionTarget,'cc.story.0']),'Match again',1);
  assert.equal(store.snapshot().revision,1);
  assert.deepEqual(store.undo().project,p);assert.deepEqual(store.redo().project,matched);
  assert.throws(()=>store.commit(p,'Stale',0),/changed/);
  const self=createProjectStore(p);self.commit(matchClipAppearance(p,captionSource,[captionSource]),'Self',0);
  assert.equal(self.snapshot().revision,0);assert.equal(self.snapshot().canUndo,false);
});

test('matched look is an explicit snapshot, not a new dependency on the source or theme',()=>{
  const p=createSample(),matched=matchClipAppearance(p,captionSource,[captionTarget]);
  const next=editProject(matched,q=>{q.captionTheme.size=52;findClip(q,captionSource).clip.style={color:'#555555'};});
  assert.deepEqual(findClip(next,captionTarget).clip.style,findClip(matched,captionTarget).clip.style);
});

test('untrusted project and selection accessors are rejected without execution',()=>{
  let reads=0;const p=clone(createSample()),ids=[];
  Object.defineProperty(p,'captionTheme',{get(){reads++;return {};},enumerable:true});
  Object.defineProperty(ids,0,{get(){reads++;return captionTarget;},enumerable:true});
  assert.throws(()=>matchClipAppearance(p,captionSource,[captionTarget]));
  assert.throws(()=>matchClipAppearance(createSample(),captionSource,ids));
  assert.equal(reads,0);
});
