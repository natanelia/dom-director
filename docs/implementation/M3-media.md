# M3 — prepared narration and caption controls

The reusable core now supports prepared, scene-local narration. The Orbit concept demo is unchanged in this slice.

```js
const director = createDirector({
  surface: {viewport, scene, overlay},
  targets,
  narration: {
    // Authorize IDs against assets owned by the host. Do not blindly fetch script URLs.
    resolveAsset: (id, metadata) => approvedAudioURLs[id],
    enabled: false,
    onFailure: 'pause', // Or explicitly opt into 'text' recovery.
  },
});
director.load(script);
mountControls(director, controlsContainer);
// Host controls can also use setNarrationEnabled, setVolume, setCaptions,
// and exportCaptions(sceneId). Narration changes are semantic director events.
```

The canonical script's `scene.narration.audioAsset` selects an authored asset; its transcript and timed plain-text caption cues remain available without sound. Numeric and narration-cue anchors are resolved by the existing compiler. Language variants are separate validated scripts with their own cue timings.

No audio element or source request is created during silent playback. The host resolver is called only after narration is enabled and playback starts. A genuine Play handler calls the media play method synchronously. The clock validates finite, nonnegative, monotonic and elapsed-time-plausible samples. Media buffering freezes presentation time; early endings, invalid samples, rejected play, startup timeout and stalled media cannot complete the scene. By default the player holds and offers caption-only continuation; a host may explicitly opt into automatic text recovery. Stop, seek, scene changes, reload and destruction invalidate stale play promises and detach old media handlers.

Captions remain outside the transformed scene. Their toggle does not remove the transcript. WebVTT export escapes literal markup and strips injected cue delimiters/newlines from caption text. Volume is exposed through the host API, while the minimal native controls expose sound, CC, speed, reduced motion and recovery.

## Evidence and review

Fourteen new pure tests cover clock authority, buffer handoffs, invalid timestamps, early/stale end events, rejected and unresolved starts, cancellation, rate/seek, stalled decoders, source grants, cleanup, bounded diagnostics, and WebVTT text escaping. Nine new browser cases cover actual player/controls integration and real prepared MP3 playback. Local Chromium 144 with Playwright 1.57 passed all nine; local loopback navigation is blocked, so the explicit memory transport was used. Normal CI runs the HTTP fixture in Chromium, Firefox and WebKit.

The real-audio fixture records media-clock versus DOM-sample skew, with a 100 ms p95 acceptance bound. The local observation had 19 samples, p95 0 ms, max 0 ms. This measures JavaScript sampling within event-loop turns, NOT physical speaker/display latency. It is not an audible synchronization guarantee, screen-reader certification, or physical iPhone result.

Browser integration found and fixed unbound native timer invocation, which the injected-timer unit fixture could not catch. Asset URLs, DOM text and media objects are excluded from diagnostics. No package publication, telemetry, TTS provider, recording or remote agent transport is introduced.
