# Studio: the video-style editing workspace

Implementation candidate from design #22, model/media work #23–#25, and workspace #26. Check the current PR, deployment and public-verification runs before treating a particular revision as published. Studio packages remain private and unpublished to npm.

The new creator entry is `studio.html`, separate from the original agent playground. The author edits a real, controlled Orbit DOM surface with one playhead and camera, cursor, voiceover and closed-caption tracks. No application actions run during visual playback. This is an implemented slice of the approved design, not completion of every proposed capability.

## Use the workspace

Open the sample, select a timeline clip or use CC / Voice / Cursor / Camera, and edit its inspector. Text previews immediately; leaving a field commits a valid edit. Invalid input remains visible and blocks preview/export rather than silently playing an older version. Escape discards an uncommitted field edit. Undo/redo operate on committed project changes; native text-field shortcuts remain native.

Preview tour starts from the beginning. The transport supports play/pause, stop, restart, seeking, a selected-clip loop, sound and captions. Camera zoom changes the authored composition; Canvas view only magnifies the editor; Timeline zoom changes time-axis scale. Motion off respects reduced-motion viewing. The app remains inert while editing and previewing, so a simulated click never becomes a real app action.

The timeline supports selecting, moving, trimming, splitting, duplicating and deleting clips, snapping, explicit ripple movement, track visibility and locks. Exact timing inputs and the Clip list provide alternatives to dragging. Scenes can be added from approved focus choices, reordered, [duplicated with all their tracks and independent timing links](scene-duplication.md), and deleted. Illegal overlap, missing targets and locked-track changes fail explicitly.

## Four editing tracks

**CC.** Edit text, timing, font family, weight, size, color, outline, background, width, padding, alignment and position. Apply themes to a caption, its language track or project default. Overrides remain explicit. Import a plain VTT/SRT file as a reviewed language track. Optional word highlighting has editable word boundaries; evenly distributed words are an approximate authoring starting point, not speech alignment. Changing a caption with word timing asks before clearing those timings and does not rewrite voice audio.

**Voice.** Edit narration text separately from the actual take. Import audio, select an available take, load a measured waveform, set source trim, volume and fades. Microphone recording is requested only after Record take, only where browser recording APIs are available. Otherwise import remains available. Cancellation releases late-arriving streams and cannot close an unrelated newer dialog. No recording is uploaded automatically.

The [A/B voice comparison](voice-audition.md) lets you listen to the current clip and proposed take before replacing anything. Opening it is silent; explicit Listen buttons play sound even when tour preview is muted. Switching, closing or editing stops the audition without changing the draft or playhead.

Replacing a take has a review step. Keep scene timing accepts the full take only when it fits. Fit scene to voice previews visual retiming and later scene movement before committing; audio is never time-stretched. Project timing uses whole milliseconds; decoded audio metadata is quantized to the nearest millisecond while original bytes and decoded samples are unchanged.

**Voice identity / delivery style.** The integration accepts an explicit host-owned provider via `connectVoiceProvider`. Only the provider's declared voices and styles are offered. Generate requires confirmation before sending authored narration. Responses retain their initiating revision and provider; stale results cannot replace newer edits. The public Studio has **no connected voice-generation service**. It does not claim that volume or fades change a speaker's delivery, nor does it offer a fake AI generator. Tests use a declared synthetic provider, not a production voice service.

**Cursor.** Select arrow, hand or dot, size, fill, outline, halo and trail. Edit keyframe targets, offsets, curve and easing; drag canvas handles or enter exact values. Add visual click, double-click and hold markers. Appearance changes preserve the authored path. These are presentation gestures, not browser-trusted input.

**Camera.** Select approved focus targets and edit position, zoom, keyframe time and easing. Add a key at the playhead, remove a key, or adjust a canvas handle. Camera/cursor source windows survive clip splitting without restarting the original easing. Timeline sampling never repeats application effects.

## Keep the project

Save project downloads a `.director` file containing the rich project and local audio chunks with checksums. Open validates the document and audio before explicitly replacing the current draft. Save before refreshing: there is no cloud or browser autosave. Original prepared sample takes are host references, so reopening needs a host that supplies those approved samples; the file is not a standalone website.

VTT/SRT export carries caption text and timing, not Studio appearance, camera motion or audio. The rich project is not the older core `Tour` JSON and must not be flattened through the small storyboard importer. The core API and older agent lab remain usable.

## Current limits

The [local video renderer](video-export.md) exports supported Orbit projects to MP4/WebM. This build does not provide browser-only video rendering, interactive project publishing, branch/wait authoring, a full audio-mixer workspace with buses/effects, automatic speech alignment, a built-in paid voice provider, arbitrary-site capture, cloud storage or collaboration. The public fixture has a fixed 960 × 540 Orbit surface and approved target names. Adopting applications need their own deliberate host integration.

Physical-device microphone codecs, download behavior, on-screen keyboards, assistive technology and real-user usability remain manual acceptance work under issue #19. Linux browser-engine tests do not certify physical Safari/iOS/Android or screen readers. The Studio audit retains both automated violations and incomplete findings; user-chosen caption themes can still require contrast review.

## Verification

`node --test packages/studio/test/*.test.js` checks the model, timing, media, provider and bundle contracts. `tools/check_studio.py` installs actual tarballs and compiles typed consumers. `studio-tests/publication_test.py` proves that future internal Studio modules cannot enter the public artifact without explicit allowlisting.

`studio-tests/browser_test.py` and `review_test.py` run creator workflows in Chromium, Firefox and WebKit against staged artifacts and then the verified public revision. Permission denial/cancellation tests use explicitly synthetic recording boundaries; a separate test checks the unsupported-recording fallback without asking for a microphone. Duration-retiming assertions remain exact across engines.

`studio-tests/accessibility.py` audits the actual Studio's CC, voice, cursor, camera, word-timing, invalid-input, mobile and export-dialog states using pinned axe-core. It is a separate audit from the older demo and agent playground. Inspect its retained report, screenshots and current CI conclusion; this document does not turn a test definition into a passing result.

## Voice mix export

Export → Voice WAV renders the whole tour or the selected scene to a 48 kHz,
16-bit mono/stereo WAV. It uses enabled voice tracks, their timeline placement,
source trims, gain and fades. Gaps remain silent; simultaneous voice tracks are
mixed. Preview's Sound off switch does not mute this export. Disabled tracks and
zero-gain clips are excluded. An enabled, audible clip without a take blocks export
rather than silently dropping narration. Missing or undecodable audio also blocks it.

The operation uses local OfflineAudioContext rendering, not screen or microphone
capture. Prepared sample takes may load from the approved host; no audio is sent
to a provider. Rendering does not play through the speakers. The ready dialog reports
clipping; samples above full scale are clamped when converted to PCM16. Lower gain
and render again to avoid distortion. There is no automatic normalization or mastering.

Render and download are separate explicit actions. Cancellation, closing the progress
dialog, or a stale project revision prevents download. The browser's offline render
itself has no close API; cancellation disconnects owned nodes and discards its late
result. WAV encoding yields between blocks so cancellation remains responsive.

Exports are limited to five minutes and 64 MiB of output to bound memory. Use a
scene/range for longer projects. Source decode and browser resampling can vary across
engines; this is not a bit-identical cross-browser or physical-device certification.
Saving the editable `.director` project remains separate. A WAV contains no captions,
camera animation, cursor, project metadata or interactivity, and is not video export.

The reusable `@dom-director/studio/audio-export` entry exposes `planVoiceMix` (pure,
no loading) and `renderVoiceMix` (host-provided media bank, optional bounded range,
44.1/48 kHz, mono/stereo, AbortSignal and stage progress). It imports in Node without
creating browser globals; actual rendering needs OfflineAudioContext or an explicit
host factory. The public fixture offers only the tested 48 kHz preset.

Evidence: `packages/studio/test/audio-export.test.js` covers planning, WAV structure,
fades, overlapping tracks, clipping, failure and cancellation. `studio-tests/audio_export_test.py`
checks actual browser-rendered sample values, decoded WAV downloads and creator flows,
and is included in the existing staged and public three-engine review runner.
Test definitions alone are not passing results; inspect the associated CI run.

Platform reference: [Web Audio API 1.0 — OfflineAudioContext](https://www.w3.org/TR/webaudio-1.0/#OfflineAudioContext)
(accessed 8 November 2026). Rendering and encoding do not trigger application actions.
