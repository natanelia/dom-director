# 08 · Narration, closed captions, sound, and cursor

## Narration sources

The preferred synchronized path is a prepared audio asset with a transcript and authored cue timings. Optional adapters can synthesize speech at authoring time and return audio plus alignment metadata. Browser speech synthesis is a useful preview/fallback but should not promise precise word boundaries, universal voice availability, or deterministic seeking. Keep provider keys and billing outside the browser runtime.

The first audio path uses one narration segment per scene, starting at scene time zero. Media filenames/URLs are resolved through a host asset policy; no arbitrary remote downloads from agent-generated scripts. Asset metadata includes language, content hash when available, duration, media type, attribution, and whether the host has made it available offline.

## Timing anchors

Authors can time a visual cue using a numeric scene offset or `{ narrationCue: 'save-explanation', edge: 'start', offsetMs: -200 }`. The compiler resolves this against the selected locale's prepared timings. Unknown cues or negative resolved times fail validation. Changing narration rebuilds dependent timings and marks the script plan stale.

An anchor identifies an authored semantic phrase, not a substring search through live speech. Translations may have different durations, order, and sentence boundaries. Each language variant carries its own timings and, where necessary, a scene adaptation. Never assume a longer translation fits by speeding it up without review.

## Drift management

Sample media position to drive the visual reducer. Measure audiovisual skew using instrumented test fixtures rather than comparing only wall clocks. Proposed acceptance target: visual cues remain within 100 ms of authored narration boundaries at the 95th percentile in the defined lab scenario; this is not a current result or a guarantee under suspension/load.

At resume or media seek, snap the presentation clock to the authoritative media position while optionally smoothing purely visual correction. Do not “fix drift” by silently cutting narration or repeatedly changing playback rate. Pause all dependent tracks while required media buffers. Text-only continuation is an explicit user option that establishes a new clock mapping.

Autoplay is not guaranteed. The initial Play control should initiate media from a genuine user interaction, handle a rejected play promise, and provide a retry or silent mode. A simulated cursor cannot supply the required user activation. [S4](21-sources.md).

## Closed captions and transcript

Closed captions are selectable on/off and language-selectable, while the transcript is a separately accessible complete text representation. Captions include relevant non-speech sounds and speaker identification, not only spoken words. The draft format stores plain text cues; a WebVTT sidecar is an interoperability output. WebVTT provides time-aligned cues and regions, but a DOM renderer still needs accessible placement and styling. [S5–S6](21-sources.md).

Support font size, text/background contrast, safe-area placement, and user caption preferences. Captions live outside the zoomed scene so they do not grow or move with the camera. Caption text uses safe text nodes; embedded HTML or WebVTT cue markup must go through a narrowly specified parser, not innerHTML. Render at most the active cue set; avoid announcing every word through a live region.

The transcript offers scene links and “show this step” actions. A transcript link that crosses a state barrier opens an explanation or asks for a fixture reset rather than replaying effects. Caption download and transcript export are textual and should work without video export.

## Sound

Narration and any optional effects have separate volume controls, plus mute. Do not rely on sound as the only signal. Background music and automatic ducking are P2 because mixing, licensing, output latency, and sensory load add complexity. Respect the user's rate and pitch preferences where the browser/media stack supports them; otherwise expose the limitation.

## Cursor simulation

The visual cursor is an overlay with `pointer-events: none`, marked as demonstrative. It can move to a semantic target, trace a path, show a click ring, display a drag gesture, or label a keypress. It is **not** the operating-system pointer, not trusted browser input, and not an app action. Do not hide the real pointer by default.

A `cursor` cue with `gesture: 'click'` animates a click ring only. An actual app change uses a separate named action cue or a user gate. The two can be synchronized, but a policy failure prevents the action and must not visually imply success. Scripted dispatch cannot manufacture trusted user interaction. [S7](21-sources.md).

Cursor paths are scene- or target-relative, then projected into overlay coordinates. Keeping a cursor in raw page pixels while the camera moves makes it drift away from the element. Use deterministic interpolation and configurable speed; stochastic “human-like” movement is unnecessary and can obscure instruction. Touch-centric scenes can use a touch indicator instead of a mouse arrow.

## Typing and drag demonstrations

Visual text-entry simulation can display keystrokes in an overlay or update a synthetic fixture through a host action. It never logs a user's password, captures real secret fields, or silently replaces live input values. Drag demonstrations separate the path illustration from the host's domain operation. Browser drag-and-drop, pointer capture, IME, contenteditable, and custom editors need explicit adapters; synthetic pointer events are not a universal implementation.

## Media preparation failure matrix

Missing audio → offer transcript-first playback. Invalid timing → reject synchronized compilation, allow a separately labeled untimed preview. Unavailable voice → choose a host-approved fallback after user acknowledgment. Unsupported codec → select another authorized representation or silent mode. Permission denied → keep the app usable. Caption file missing → narrated release fails accessibility review unless equivalent cues are present in the script.

## Nice defaults

Gentle camera motion; visible progress; captions offered prominently; concise annotations; clearly simulated pointer; a short settle before important narration; no simultaneous competing motion and reading-heavy tooltip; consistent narration terms matching the app's labels; replay-this-explanation separate from repeat-the-action.
