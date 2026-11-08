// Local renderer only. This module is never included in the public Pages artifact.
import {createSample, duration} from './studio-sdk/index.js';
import {createMediaBank, readProjectBundle, digest} from './studio-sdk/media.js';
import {renderVoiceMix} from './studio-sdk/audio-export.js';
import {createCanvas, TARGETS} from './studio-view.mjs';

const $ = id => document.getElementById(id);
const targets = new Set(TARGETS.map(target => target.id));
const samples = new Set(['voice.overview', 'voice.signal', 'voice.story']);
let project, bank, canvas, mix, signature, options, closed = false;
function check(value, message) {if (!value) throw new Error(message);}
function base64(bytes) {
  let text = '';
  for (let at = 0; at < bytes.length; at += 8192) text += String.fromCharCode(...bytes.subarray(at, at + 8192));
  return btoa(text);
}
async function close() {
  if (closed) return;
  closed = true; mix = null; canvas?.destroy();
  await bank?.destroy();
}
async function prepare(config) {
  check(!project && !closed, 'A renderer can prepare only one project.');
  options = config;
  let media = [];
  if (config.sample) project = createSample();
  else {
    const response = await fetch('./project.director', {credentials: 'omit', redirect: 'error'});
    check(response.ok, 'The local project could not be read.');
    ({project, media} = await readProjectBundle(await response.text()));
  }
  check(project.canvas.width === 960 && project.canvas.height === 540, 'This renderer supports the controlled 960 × 540 Orbit host only.');
  for (const track of project.tracks) for (const clip of track.clips)
    for (const key of clip.keys || []) check(targets.has(key.target), 'The project needs a focus target this host does not provide.');
  for (const asset of project.assets) if (asset.source === 'sample')
    check(samples.has(asset.sample), 'The project needs a prepared voice this host does not provide.');
  check(Number.isInteger(config.startMs) && config.startMs >= 0, 'Invalid start time.');
  const endMs = config.endMs ?? duration(project);
  check(Number.isInteger(endMs) && config.startMs < endMs && endMs <= duration(project), 'Choose a nonempty range inside the project.');
  check(endMs - config.startMs <= 120000, 'Export at most two minutes at a time.');
  signature = JSON.stringify(project);
  const projectSha256 = await digest(new TextEncoder().encode(signature));
  bank = createMediaBank({resolveSample: id => {
    check(samples.has(id), 'Unapproved sample audio.');
    return new URL('./assets/' + id + '.mp3', location.href).href;
  }});
  if (config.audio) {
    for (const item of media) {
      const actual = await bank.ingest(item.asset.id, item.asset.name, item.asset.mime, item.bytes);
      check(Math.abs(actual.durationMs - item.asset.durationMs) <= 20, 'Local audio duration differs from its saved take.');
    }
    mix = await renderVoiceMix(project, bank, {range: {startMs: config.startMs, endMs}, sampleRate: 48000, channels: 2});
  }
  canvas = createCanvas({stage: $('stage'), scene: $('scene'), overlay: $('stage-overlays'),
    caption: $('caption-overlay'), cursor: $('cursor-layer'), handles: $('edit-handles')});
  await document.fonts.ready;
  check($('scene').inert && $('stage').clientWidth === 960 && $('stage').clientHeight === 540, 'The render-only host did not initialize at its fixed composition size.');
  const metadata = {projectSha256, startMs: config.startMs, endMs, projectDurationMs: duration(project),
    audio: mix ? {bytes: mix.wav.byteLength, sampleRate: mix.sampleRate, channels: mix.channels, peak: mix.peak,
      clippedSamples: mix.clippedSamples, clipCount: mix.clipCount} : null};
  await frame(config.startMs);
  return metadata;
}
async function frame(timeMs) {
  check(canvas && !closed && Number.isFinite(timeMs) && timeMs >= 0 && timeMs <= duration(project), 'Invalid render frame.');
  const result = canvas.render(project, timeMs, {reducedMotion: options.reducedMotion, captions: options.captions, zoom: 1});
  check(result, 'The application canvas has no drawable area.');
  // Flush a real paint without starting a playback clock or executing application effects.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  check(signature === JSON.stringify(project), 'Rendering changed the source project.');
  return {timeMs, sceneId: result.frame.sceneId, camera: result.frame.camera};
}
function audioChunk(offset, length) {
  check(mix && Number.isInteger(offset) && offset >= 0 && Number.isInteger(length) && length > 0 && length <= 262144, 'Invalid audio transfer.');
  return base64(new Uint8Array(mix.wav, offset, Math.min(length, mix.wav.byteLength - offset)));
}
// Explicitly linear, fixed fixture; no transport, recording, provider or app event dispatch.
window.directorVideo = Object.freeze({prepare, frame, audioChunk, close});
