import test from 'node:test';
import assert from 'node:assert/strict';
import {createSample, editProject, findClip, createProjectStore, validateProject} from '../src/index.js';
import {distributeCaptionWords} from '../src/editing.js';
import {linkKeyframeToCaptionWord, describeTimingLinks} from '../src/timing-links.js';
import {findCaptionMatches, proposeCaptionReplacement} from '../src/caption-search.js';
const id = 'cc.overview.0';
const search = (p, query, rest = {}) => findCaptionMatches(p, {query, ...rest});
const replace = (p, query, replacement, rest = {}) => proposeCaptionReplacement(p, {query, replacement, ...rest});
const text = (p, value) => editProject(p, next => {findClip(next, id).clip.text = value;});
const linked = () => linkKeyframeToCaptionWord(distributeCaptionWords(createSample(), id),
  'camera.overview', 'camera.to.overview', {captionId: id, wordIndex: 1, offsetMs: 200});

test('literal matches are chronological, readonly, and confined to authored captions', () => {
  const p = createSample(), before = JSON.stringify(p), r = search(p, 'the');
  assert.ok(r.matches > 1); assert.ok(r.captions.length > 1);
  assert.ok(r.captions.every((row, i, rows) => !i || row.projectTimeMs >= rows[i - 1].projectTimeMs));
  assert.ok(Object.isFrozen(r.captions[0].ranges[0]));
  for (const row of r.captions) for (const span of row.ranges)
    assert.equal(row.text.slice(span.start, span.end).toLowerCase(), 'the');
  assert.equal(JSON.stringify(p), before); assert.equal(typeof document, 'undefined');
});
test('regex metacharacters and replacement dollar sequences are literal', () => {
  const p = text(createSample(), '[a.*] $& [a.*]');
  assert.equal(search(p, '[a.*]').matches, 2);
  const r = replace(p, '[a.*]', '$& $1 $$');
  assert.equal(findClip(r.value, id).clip.text, '$& $1 $$ $& $& $1 $$');
  assert.equal(r.replacements, 2); assert.equal(search(p, '.*').matches, 2);
});
test('case sensitivity and UTF-16 ranges preserve authored Unicode', () => {
  const p = text(createSample(), '😀 Café CAFÉ café');
  const insensitive = search(p, 'café'); assert.equal(insensitive.matches, 3);
  assert.equal(insensitive.captions[0].ranges[0].start, 3);
  assert.equal(search(p, 'Café', {matchCase: true}).matches, 1);
  assert.equal(findClip(replace(p, 'CAFÉ', '茶', {matchCase: true}).value, id).clip.text, '😀 Café 茶 café');
});
test('default language, explicit hidden track, and all-language scopes are distinct', () => {
  const p = editProject(createSample(), next => {next.tracks.push({id:'cc.fr',kind:'captions',language:'fr',name:'French',enabled:false,locked:false,
    clips:[{id:'fr.1',sceneId:'overview',startMs:0,durationMs:1000,text:'product'}]});});
  assert.equal(search(p, 'product').captions.length, 1);
  assert.equal(search(p, 'product', {trackId:null}).captions.length, 2);
  const hidden = search(p, 'product', {trackId:'cc.fr'}).captions[0]; assert.equal(hidden.enabled, false);
  assert.equal(replace(p, 'product', 'story', {trackId:'cc.fr'}).changes.length, 1);
  assert.equal(findClip(p, id).clip.text, findClip(replace(p,'product','story',{trackId:'cc.fr'}).value,id).clip.text);
});
test('selection edits only matching captions and does not accept missing or duplicate IDs', () => {
  const p = createSample(), r = replace(p, 'the', 'THE', {clipIds:['cc.story.1']});
  assert.deepEqual(r.changes.map(c => c.clipId), ['cc.story.1']);
  for (const clipIds of [['missing'], [id,id], [], ['voice.overview']])
    assert.throws(() => replace(p, 'product', 'story', {clipIds}), {code:'CAPTION_SELECTION_INVALID'});
});
test('proposal clears only changed caption timings and reports links without moving keys', () => {
  const p = linked(), before = JSON.stringify(p), r = replace(p, 'product', 'walkthrough');
  assert.equal(r.changes.length, 1); assert.equal(r.detachedLinks.length, 1);
  assert.equal(r.changes[0].clearedWordTimings, findClip(p,id).clip.words.length);
  assert.equal(findClip(r.value,id).clip.words, undefined);
  const oldKey = findClip(p,'camera.overview').clip.keys[1], nextKey = findClip(r.value,'camera.overview').clip.keys[1];
  const {timing,...visual} = oldKey; assert.deepEqual(JSON.parse(JSON.stringify(nextKey)),visual);
  assert.equal(describeTimingLinks(r.value).length,0); assert.equal(r.value.studioVersion,p.studioVersion);
  assert.equal(JSON.stringify(p),before); assert.ok(validateProject(r.value).ok);
});
test('other caption timings, style, audio, language and nonlinked motion are untouched', () => {
  let p = distributeCaptionWords(linked(), 'cc.overview.1');
  p = editProject(p, n => {findClip(n,id).clip.style = {size:42,color:'#00ff00'};});
  const r = replace(p, 'product', 'walkthrough');
  for (const track of p.tracks) for (const c of track.clips) {
    if ([id,'camera.overview'].includes(c.id)) continue;
    assert.deepEqual(findClip(r.value,c.id).clip,c);
  }
  assert.deepEqual(findClip(r.value,id).clip.style,findClip(p,id).clip.style);
  assert.equal(r.value.captionTrack,p.captionTrack); assert.deepEqual(r.value.assets,p.assets);
});
test('no-op replacements retain word timings and links, even on locked tracks', () => {
  const p = editProject(linked(), n => {n.tracks[0].locked=true;n.tracks[3].locked=true;});
  const r = replace(p, 'product', 'product');
  assert.equal(r.changes.length,0);assert.equal(r.detachedLinks.length,0);assert.deepEqual(r.value,p);
  assert.equal(replace(p,'not-here','x').replacements,0);
});
test('locked captions or dependent motion reject the complete proposal atomically', () => {
  for(const trackId of ['cc.en','camera']){
    const p=editProject(linked(),n=>{n.tracks.find(t=>t.id===trackId).locked=true;});
    const before=JSON.stringify(p);assert.throws(()=>replace(p,'This','A'),/locked/);
    // The specific linked caption is also blocked if other matches are writable.
    assert.throws(()=>replace(p,'product','demo'),/locked/);assert.equal(JSON.stringify(p),before);
  }
});
test('blank or oversized resulting captions fail without partial edits', () => {
  const p=text(createSample(),'only');
  assert.throws(()=>replace(p,'only',''),{code:'CAPTION_REPLACEMENT_INVALID'});
  assert.throws(()=>replace(text(p,'aa'),'a','x'.repeat(3000)),{code:'CAPTION_REPLACEMENT_INVALID'});
  assert.equal(findClip(replace(text(p,'only words'),'only ','').value,id).clip.text,'words');
});
test('invalid search options are rejected without executing getters', () => {
  const p=createSample();let read=false;const option={get query(){read=true;return 'the';}};
  assert.throws(()=>findCaptionMatches(p,option));assert.equal(read,false);
  for(const options of [{query:''},{query:'x'.repeat(257)},{query:1},{query:'x',matchCase:'true'},
    {query:'x',matchCase:null},{query:'x',trackId:'voice'},{query:'x',trackId:4},{query:'x',extra:true}])
    assert.throws(()=>findCaptionMatches(p,options));
});
test('search limit fails explicitly, rather than replacing an unseen truncated set', () => {
  const p=editProject(createSample(),n=>{n.tracks[3].clips[0].text='x'.repeat(4000);n.tracks[3].clips[1].text='x'.repeat(4000);});
  assert.throws(()=>search(p,'x'),{code:'CAPTION_SEARCH_LIMIT'});
  assert.throws(()=>replace(p,'x','y'),{code:'CAPTION_SEARCH_LIMIT'});
});
test('one reviewed commit supports exact undo/redo and stale revision refusal', () => {
  const p=linked(),store=createProjectStore(p),snapshot=store.snapshot(),proposal=replace(p,'product','walkthrough');
  store.commit(proposal.value,'Replace captions',snapshot.revision);
  assert.deepEqual(store.undo().project,p);assert.deepEqual(store.redo().project,proposal.value);
  assert.throws(()=>store.commit(proposal.value,'Stale',snapshot.revision),/changed/);
});
test('overlapping literal matches are nonoverlapping and output is bounded', () => {
  const p=text(createSample(),'aaa');assert.equal(search(p,'aa').matches,1);
  assert.equal(findClip(replace(p,'aa','b').value,id).clip.text,'ba');
  assert.throws(()=>replace(p,'a','x'.repeat(4001)));
});
