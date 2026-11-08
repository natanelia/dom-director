import {requireProject, sceneTimeline, duration} from './project.js';

const check = (ok, message) => {if (!ok) throw new Error(message);};
const abort = signal => {if (signal?.aborted) throw new DOMException('Voice export cancelled.', 'AbortError');};
const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));

/** Plan without decoding, fetching, playing, or modifying the project. */
export function planVoiceMix(input, {range = null, sampleRate = 48000, channels = 2} = {}) {
  const project = requireProject(input);
  check([44100, 48000].includes(sampleRate) && [1, 2].includes(channels), 'Choose 44.1/48 kHz and mono/stereo audio.');
  const startMs = range?.startMs ?? 0, endMs = range?.endMs ?? duration(project);
  check(Number.isInteger(startMs) && Number.isInteger(endMs) && startMs >= 0 && endMs > startMs && endMs <= duration(project), 'Export range must fit the project.');
  check(endMs - startMs <= 300000, 'Voice export is limited to five minutes. Choose a scene or a shorter range.');
  const frames = Math.round((endMs - startMs) * sampleRate / 1000);
  const bytes = 44 + frames * channels * 2;
  check(bytes <= 64 * 1024 * 1024, 'Voice export exceeds the 64 MiB output limit.');
  const offsets = new Map(sceneTimeline(project).map(scene => [scene.id, scene.startMs]));
  const clips = [];
  for (const track of project.tracks.filter(track => track.kind === 'voice' && track.enabled)) {
    for (const clip of track.clips) {
      const start = offsets.get(clip.sceneId) + clip.startMs, end = start + clip.durationMs;
      if (end <= startMs || start >= endMs || clip.gain === 0) continue;
      check(clip.assetId !== null, 'An enabled voice clip has no audio take. Add a take or mute its track before export.');
      const skipMs = Math.max(0, startMs - start);
      clips.push(Object.freeze({...clip, skipMs, atMs: Math.max(0, start - startMs), lengthMs: Math.min(end, endMs) - Math.max(start, startMs)}));
    }
  }
  check(clips.length > 0, 'No audible voice takes in this range. Enable a voice track or choose another range.');
  const ids = new Set(clips.map(clip => clip.assetId));
  return Object.freeze({startMs, endMs, durationMs: endMs - startMs, sampleRate, channels, frames, bytes,
    clips: Object.freeze(clips), assets: Object.freeze(project.assets.filter(asset => ids.has(asset.id)))});
}

// Cancellation discards an in-flight browser render; OfflineAudioContext has no close().
// Promise handlers stay attached, so a late completion or failure cannot escape unhandled.
function cancellable(work, signal) {
  abort(signal);
  return new Promise((resolve, reject) => {
    const detach = () => signal?.removeEventListener('abort', cancelled);
    const cancelled = () => {detach();reject(new DOMException('Voice export cancelled.', 'AbortError'));};
    signal?.addEventListener('abort', cancelled, {once: true});
    Promise.resolve().then(() => {abort(signal);return work();}).then(
      value => {detach();resolve(value);},
      error => {detach();reject(error);},
    );
  });
}

/** Render only approved decoded voice takes. No microphone, provider or live playback. */
export async function renderVoiceMix(input, bank, options = {}) {
  const {signal, onProgress, contextFactory = (channels, frames, rate) => {check(typeof OfflineAudioContext === 'function', 'Offline audio rendering is unavailable in this browser. Save the project and export in a supported browser.');return new OfflineAudioContext(channels, frames, rate);}} = options;
  const plan = planVoiceMix(input, options), nodes = [];
  abort(signal);
  check(bank && typeof bank.load === 'function', 'Provide the host media bank.');
  const buffers = new Map();
  const progress = (stage, completed, total) => {abort(signal);onProgress?.({stage, completed, total});abort(signal);};
  try {
    for (const asset of plan.assets) {
      progress('loading', buffers.size, plan.assets.length);
      const buffer = await cancellable(() => bank.load(asset, {signal}), signal);
      abort(signal);
      check(buffer && Number.isFinite(buffer.duration) && buffer.duration > 0 && buffer.duration <= 180 &&
        Number.isInteger(buffer.numberOfChannels) && buffer.numberOfChannels >= 1 && buffer.numberOfChannels <= 2,
      'Decoded voice audio is invalid or exceeds the source limit.');
      buffers.set(asset.id, buffer);
    }
    for (const clip of plan.clips) check(clip.sourceInMs + clip.skipMs + clip.lengthMs <= buffers.get(clip.assetId).duration * 1000 + 2,
      'A voice clip exceeds its decoded source. Trim it or choose another take.');
    progress('rendering', 0, 1);
    const context = contextFactory(plan.channels, plan.frames, plan.sampleRate);
    for (const clip of plan.clips) {
      const source = context.createBufferSource(), gain = context.createGain();
      nodes.push({source, gain});
      source.buffer = buffers.get(clip.assetId);source.connect(gain);gain.connect(context.destination);
      const at = clip.atMs / 1000, skip = clip.skipMs, end = skip + clip.lengthMs;
      const level = ms => clip.gain * Math.max(0, Math.min(1, clip.fadeInMs ? ms / clip.fadeInMs : 1,
        clip.fadeOutMs ? (clip.durationMs - ms) / clip.fadeOutMs : 1));
      gain.gain.setValueAtTime(level(skip), at);
      // Clip fades are anchored to the original clip, even for a cropped export range.
      const points = new Set([clip.fadeInMs, clip.durationMs - clip.fadeOutMs, end]);
      for (const point of [...points].sort((a, b) => a - b)) {
        if (point > skip && point <= end) gain.gain.linearRampToValueAtTime(level(point), at + (point - skip) / 1000);
      }
      source.start(at, (clip.sourceInMs + skip) / 1000, clip.lengthMs / 1000);
    }
    const rendered = await cancellable(() => context.startRendering(), signal);
    abort(signal);
    check(rendered.length === plan.frames && rendered.numberOfChannels === plan.channels && rendered.sampleRate === plan.sampleRate, 'Unexpected rendered audio format.');
    const wav = new ArrayBuffer(plan.bytes), view = new DataView(wav);
    const ascii = (offset, text) => {for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));};
    ascii(0, 'RIFF');view.setUint32(4, plan.bytes - 8, true);ascii(8, 'WAVE');ascii(12, 'fmt ');
    view.setUint32(16, 16, true);view.setUint16(20, 1, true);view.setUint16(22, plan.channels, true);
    view.setUint32(24, plan.sampleRate, true);view.setUint32(28, plan.sampleRate * plan.channels * 2, true);
    view.setUint16(32, plan.channels * 2, true);view.setUint16(34, 16, true);ascii(36, 'data');view.setUint32(40, plan.bytes - 44, true);
    const data = Array.from({length: plan.channels}, (_, i) => rendered.getChannelData(i));
    let peak = 0, clippedSamples = 0;
    for (let start = 0; start < plan.frames; start += 32768) {
      progress('encoding', start, plan.frames);
      await yieldTask();abort(signal);
      for (let frame = start; frame < Math.min(start + 32768, plan.frames); frame++) {
        for (let channel = 0; channel < plan.channels; channel++) {
          const sample = data[channel][frame];
          check(Number.isFinite(sample), 'Rendered audio contains an invalid sample.');
          peak = Math.max(peak, Math.abs(sample));if (Math.abs(sample) > 1) clippedSamples++;
          const value = Math.max(-1, Math.min(1, sample));
          view.setInt16(44 + (frame * plan.channels + channel) * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
        }
      }
    }
    progress('encoding', plan.frames, plan.frames);
    return {wav, mime: 'audio/wav', sampleRate: plan.sampleRate, channels: plan.channels,
      durationMs: plan.durationMs, frames: plan.frames, peak, clippedSamples, clipCount: plan.clips.length};
  } finally {
    for (const {source, gain} of nodes) {
      try {source.stop();} catch {}try {source.disconnect();} catch {}try {gain.disconnect();} catch {}
    }
  }
}
