import test from 'node:test';
import assert from 'node:assert/strict';
import {createSample, editProject} from '../src/index.js';
import {planVoiceMix, renderVoiceMix} from '../src/audio-export.js';
const small = () => editProject(createSample(), p => {
  p.scenes = [p.scenes[0]];p.scenes[0].durationMs = 1000;
  for (const t of p.tracks) {t.clips = t.clips.filter(c => c.sceneId === 'overview');for (const c of t.clips) {c.startMs = 0;c.durationMs = 1000;}}
  p.tracks[3].clips = [p.tracks[3].clips[0]];
});
function fixture({sample = .25, render, load} = {}) {
  const starts = [], gains = [], sources = [], loads = [], contexts = [];
  let disconnected = 0;
  const factory = (channels, frames, rate) => {
    const result = {length: frames, numberOfChannels: channels, sampleRate: rate,
      getChannelData: i => new Float32Array(frames).fill(typeof sample === 'function' ? sample(i) : sample)};
    const ctx = {destination: {}, createBufferSource() {const source = {connect() {}, start(...args) {starts.push(args);}, stop() {}, disconnect() {disconnected++;}};sources.push(source);return source;},
      createGain() {return {connect() {}, disconnect() {disconnected++;}, gain: {setValueAtTime(...args) {gains.push(['set', ...args]);}, linearRampToValueAtTime(...args) {gains.push(['ramp', ...args]);}}};},
      startRendering: () => render ? render(result) : Promise.resolve(result)};
    contexts.push(ctx);return ctx;
  };
  const bank = {load: async (asset, options) => {loads.push(asset.id);return load ? load(asset, options) : {duration: 20, numberOfChannels: 1};}};
  return {bank, factory, starts, gains, sources, loads, contexts, disconnected: () => disconnected};
}
const wavText = (view, start, length) => String.fromCharCode(...new Uint8Array(view.buffer, start, length));
test('plan preserves the project and counts all enabled tracks without decoding', () => {
  const p = small(), before = JSON.stringify(p), plan = planVoiceMix(p);
  assert.equal(plan.durationMs, 1000);assert.equal(plan.frames, 48000);assert.equal(plan.bytes, 192044);
  assert.equal(plan.clips.length, 1);assert.ok(Object.isFrozen(plan.clips));assert.equal(JSON.stringify(p), before);
});
test('crop keeps source offsets, scene offsets and only intersecting takes', () => {
  const plan = planVoiceMix(createSample(), {range: {startMs: 7000, endMs: 8000}});
  assert.equal(plan.assets.length, 1);assert.equal(plan.clips[0].assetId, 'audio.signal');
  assert.equal(plan.clips[0].skipMs, 20);assert.equal(plan.clips[0].atMs, 0);assert.equal(plan.clips[0].lengthMs, 1000);
});
test('disabled tracks and zero gain are excluded; enabled draft-only voices fail', () => {
  const p = editProject(small(), p => {p.tracks[2].clips[0].assetId = null;});
  assert.throws(() => planVoiceMix(p), /no audio take/);
  for (const p of [editProject(small(), p => {p.tracks[2].enabled = false;}), editProject(small(), p => {p.tracks[2].clips[0].gain = 0;})]) assert.throws(() => planVoiceMix(p), /No audible/);
});
test('invalid project/ranges/output formats fail before media access', async () => {
  const h = fixture();
  for (const options of [{range: {startMs: -1, endMs: 500}}, {range: {startMs: 0, endMs: 1001}}, {range: {startMs: 0, endMs: 0}}, {sampleRate: 8000}, {channels: 8}]) await assert.rejects(renderVoiceMix(small(), h.bank, {...options, contextFactory: h.factory}));
  const long = editProject(createSample(), p => {for (const s of p.scenes) s.durationMs = 180000;});
  await assert.rejects(renderVoiceMix(long, h.bank, {contextFactory: h.factory}), /five minutes/);
  assert.equal(h.loads.length, 0);assert.equal(h.contexts.length, 0);
});
test('WAV is interleaved signed PCM16 with correct format and duration', async () => {
  const h = fixture({sample: i => i === 0 ? -.5 : .25});
  const result = await renderVoiceMix(small(), h.bank, {contextFactory: h.factory});
  const v = new DataView(result.wav);
  assert.equal(wavText(v, 0, 4), 'RIFF');assert.equal(wavText(v, 8, 4), 'WAVE');assert.equal(wavText(v, 36, 4), 'data');
  assert.equal(v.getUint32(4, true), result.wav.byteLength - 8);assert.equal(v.getUint16(20, true), 1);
  assert.equal(v.getUint16(22, true), 2);assert.equal(v.getUint32(24, true), 48000);assert.equal(v.getUint16(34, true), 16);
  assert.equal(v.getInt16(44, true), -16384);assert.equal(v.getInt16(46, true), 8192);
  assert.equal(result.clippedSamples, 0);assert.equal(result.peak, .5);assert.equal(h.disconnected(), 2);
});
test('clipping is counted and clamped, never silently normalized', async () => {
  const h = fixture({sample: 2});
  const r = await renderVoiceMix(small(), h.bank, {channels: 1, sampleRate: 44100, contextFactory: h.factory});
  assert.equal(r.clippedSamples, 44100);assert.equal(r.peak, 2);assert.equal(new DataView(r.wav).getInt16(44, true), 32767);
});
test('cropped fades start at the authored gain and finish at the cropped boundary', async () => {
  const p = editProject(small(), p => {Object.assign(p.tracks[2].clips[0], {sourceInMs: 300, gain: .5, fadeInMs: 200, fadeOutMs: 200});});
  const h = fixture();await renderVoiceMix(p, h.bank, {range: {startMs: 100, endMs: 900}, contextFactory: h.factory});
  assert.deepEqual(h.starts, [[0, .4, .8]]);
  assert.deepEqual(h.gains, [['set', .25, 0], ['ramp', .5, .1], ['ramp', .5, .7], ['ramp', .25, .8]]);
});
test('overlapping voice tracks are all scheduled; repeated takes decode once', async () => {
  const p = editProject(small(), p => {const track = structuredClone(p.tracks[2]);track.id = 'voice-second';track.clips[0].id = 'voice-second-clip';p.tracks.push(track);});
  const h = fixture();await renderVoiceMix(p, h.bank, {contextFactory: h.factory});
  assert.equal(h.starts.length, 2);assert.equal(h.loads.length, 1);assert.equal(h.disconnected(), 4);
});
test('decoded bounds and invalid output samples fail without an export', async () => {
  const short = fixture({load: () => ({duration: .1, numberOfChannels: 1})});
  await assert.rejects(renderVoiceMix(small(), short.bank, {contextFactory: short.factory}), /decoded source/);assert.equal(short.contexts.length, 0);
  const nan = fixture({sample: NaN});await assert.rejects(renderVoiceMix(small(), nan.bank, {contextFactory: nan.factory}), /invalid sample/);assert.equal(nan.disconnected(), 2);
});
test('pre-aborted export never loads audio', async () => {
  const h = fixture(), c = new AbortController();c.abort();
  await assert.rejects(renderVoiceMix(small(), h.bank, {signal: c.signal, contextFactory: h.factory}), {name: 'AbortError'});assert.equal(h.loads.length, 0);
});
test('cancellation while loading settles promptly and ignores a late decode', async () => {
  let resolve;const h = fixture({load: () => new Promise(r => {resolve = r;})}), c = new AbortController();
  const pending = renderVoiceMix(small(), h.bank, {signal: c.signal, contextFactory: h.factory});await Promise.resolve();c.abort();
  await assert.rejects(pending, {name: 'AbortError'});resolve({duration: 20, numberOfChannels: 1});
  await Promise.resolve();assert.equal(h.contexts.length, 0);
});
test('cancelling an offline render disconnects owned nodes and discards late output', async () => {
  let resolve, entered;const ready = new Promise(r => {entered = r;});
  const h = fixture({render: output => {entered();return new Promise(r => {resolve = () => r(output);});}}), c = new AbortController();
  const pending = renderVoiceMix(small(), h.bank, {signal: c.signal, contextFactory: h.factory});await ready;c.abort();
  await assert.rejects(pending, {name: 'AbortError'});assert.equal(h.disconnected(), 2);resolve();
});
test('encoding is cancellable and progress never claims a file was saved', async () => {
  const c = new AbortController(), h = fixture(), progress = [];
  await assert.rejects(renderVoiceMix(small(), h.bank, {signal: c.signal, contextFactory: h.factory, onProgress: p => {progress.push(p);if (p.stage === 'encoding' && p.completed > 0) c.abort();}}), {name: 'AbortError'});
  assert.ok(progress.some(p => p.stage === 'rendering'));assert.equal(h.disconnected(), 2);
});

test('a synchronously cancelling loader cannot leak an unhandled rejection', async () => {
  const c = new AbortController(), h = fixture({load: () => {c.abort();return Promise.reject(new Error('Late decode failure'));}});
  await assert.rejects(renderVoiceMix(small(), h.bank, {signal: c.signal, contextFactory: h.factory}), {name: 'AbortError'});
  await new Promise(resolve => setTimeout(resolve, 0));assert.equal(h.contexts.length, 0);
});
