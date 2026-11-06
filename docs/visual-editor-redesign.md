# DOM Director Studio: a full video-style editor for the live DOM

**Status:** Revision 2 · Draft for product/design review · Not approved for implementation.  
**Updated:** 7 November 2026.  
**Implementation baseline:** `cf8ce1b0f90c1d47743e18419d43835cfdff1872`, after PRs #20–#21.  
**Design PR:** #22. Documentation only; no runtime, site, provider, storage, or deployment changes.

## 1. Product decision and scope correction

Natan's direction is explicit: **“It should be full fledged video like editor with ability to change cc, voice over style, cursor and zooms.”**

The previous proposal overcorrected for confusion by reducing the product to a scene strip and a caption form. This revision supersedes that scope. A multitrack timeline, editable closed captions, voiceover production and styling, cursor choreography, and camera keyframes are **core capabilities**, not speculative extensions to defer indefinitely.

**Product promise: edit a walkthrough like a video; keep the application alive.** The canvas is a controlled, real application surface, not a mandatory recording. The creator directs what viewers see, hear, read, and follow along a common timeline. Live playback can still stop for a genuine user task. A rendered video is a separate output, not the definition of the project.

“Easy to use” means a familiar workspace, sensible presets, direct manipulation, clear selection, and one preview path. It does not mean removing professional control. Basic and precise editing use the same document and timeline; there is no separate beginner format that loses work when advanced features are needed.

This remains a design-first change. The product direction is clarified, but the layouts, interaction contracts, runtime extensions, and delivery slices below are proposals. Keep PR #22 in draft. Do not implement, merge automatically, connect a paid service, record audio, or publish a new site route merely because the design now includes those capabilities.

## 2. What needs fixing in the current experience

The baseline [agent page][source-page] combines a visual form, canonical JSON, permission demonstrations, discovery buttons, command logs, and two playback control paths. Its [editor][source-editor] requires Apply before separate validation, review, loading, and playback. These are source observations, not a new usability study.

The issue is not the existence of advanced controls. It is that implementation machinery is presented as the creative workflow. “Validate + preview” describes a static plan rather than visible playback; the application falls below a long form on mobile; narration, captions, cursor, and camera cannot be composed together on a visible time axis.

Retain the reusable runtime and safety boundaries. Replace the creator's experience with Studio. Keep a separate **Agent lab** for protocol inspection and permission tests. Preserve the flagship **Demo** as the viewer-facing showcase. The existing [storyboard contract](visual-storyboard.md) remains a compatibility reference, not the ceiling for the new editor.

## 3. Who uses Studio and what they make

Primary creators include developers, product designers, support specialists, trainers, and technical writers. They need both a fast narrated product tour and precise control over timing, composition, and emphasis. Integrators supply approved targets, application fixtures, and permission policies. Agents propose edits through the same structured document rather than driving a second authoring interface.

A representative outcome is a 30-second product explanation: introduce a workspace, zoom into a metric as the narrator names it, move a branded cursor to a button, show well-timed captions, and return to an overview. Another outcome pauses at that button for a real user task, then continues. Neither requires a screen recording or a live AI service just to begin editing.

**Core product scope:** real-DOM canvas; scenes and multitrack editing; caption text/timing/style; voiceover import, recording, and capability-aware generation; camera and cursor animation; reusable styles; linked synchronization; undo; project save/reopen; interactive preview; explicit export choices.

**Not implied by “full-fledged”:** an unrestricted editor for arbitrary third-party websites, a general visual-effects compositor, real-time cloud collaboration, automatic voice cloning, automatic production actions, or a bundled paid AI subscription. Those are separate integrations or products. A full walkthrough editor is not required to replicate every feature of a general-purpose film editor.

## 4. Workspace: canvas, timeline, and contextual inspector

The large application canvas and multitrack timeline are always the central workspace on desktop. The left panel contains project scenes, assets, and presets. The right inspector changes with the selected item. The bottom timeline shows actual time, not a row of vaguely timed cards. Panels resize or collapse without changing the project.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ DOM Director / Studio   Route review ✎     Undo Redo   Save project   Preview tour   Export ▾ │
│ Edited in this tab · not saved to a file                        Device: Desktop   More ▾    │
├────────────────┬──────────────────────────────────────────────────────┬───────────────────────┤
│ PROJECT        │                                                      │ CAPTIONS              │
│ Scenes         │              THE REAL APPLICATION                    │ Text                  │
│ Assets         │              at the current playhead                 │ [Review this route.]  │
│ Presets        │                                                      │ Start  6.40 s         │
│                │         target / path / keyframe handles             │ End    8.10 s         │
│ 01 Overview    │         only for the selected tool                    │                       │
│ 02 Reports     │                                                      │ Style: Clean ▾        │
│ 03 Review      │          “Review this route.”                         │ Font / size / color   │
│ + Scene        │                                                      │ Position / background │
├────────────────┴──────────────────────────────────────────────────────┤ Scope: This caption ▾ │
│ ⏮  ▶  ⏭    00:06.40 / 00:30.00   Loop selection   Canvas view: Fit    │ Reset to track style  │
├───────────────────────────────────────────────────────────────────────┴───────────────────────┤
│ Timeline   Select  Split   Snap ✓   Ripple off   −──────+ Zoom   Fit all                     │
│                  0 s       5 s       │10 s        15 s        20 s        25 s                │
│ Scenes        [ Overview ][ Reports │          ][ Review                      ]             │
│ Camera        [◆ overview──◆ zoom in│──hold─────◆ zoom out                     ]             │
│ Cursor        [ move──dwell──click  │           ][ curved move────point         ]             │
│ Voiceover     [ ~~~~ Take 1 ~~~~~~~~│~~~~~~~~~~~ ][ ~~~~ Take 2 ~~~~~~~~~~~~~~~~ ]             │
│ CC · English  [Welcome…][Reports…]  │[Review this route…][Confirm…]                           │
│ Callouts                 [Report badge]                  [Helpful note]                     │
│ + Track                           PLAYHEAD                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

This is an interaction wireframe, not a finished visual mockup. Keep the warm-paper/olive identity and readable typography, with strong selection contrast and restrained track colors. Do not put a marketing hero, protocol log, or permanent JSON editor above the workspace. Track labels and icons must communicate meaning without color alone.

**Selection is the organizing rule:** click a caption to edit captions, an audio clip to edit voice, a cursor clip to edit movement, or a camera clip/keyframe to edit framing. The inspector shows one relevant toolset, not every feature at once. A scene selection exposes scene settings; project settings never masquerade as per-scene fields.

**One transport, two clear preview scopes:** Play starts at the playhead; Preview tour starts the selected path from the beginning in a viewer-focused layout. Escape returns to editing and restores selection. Loop selection supports polishing a short movement or spoken phrase. There is no separate Agent Play path in Studio.

## 5. First-use experience without sacrificing power

Open an editable, purpose-built sample with three scenes, visible Camera/Cursor/Voiceover/CC tracks, and prepared, licensed narration. All four requested controls should be discoverable immediately. This new sample must be authored for Studio; do not strip the flagship tour's existing audio or interaction gate to force it through the old storyboard compiler.

The opening hint is one sentence: **“Select something in the preview or timeline to edit it.”** The first action can be Play, editing a caption, moving a zoom keyframe, or selecting a voice take. No setup wizard, schema knowledge, or provider credential is needed for the prepared sample.

A new project offers a connected sample application or an already configured host integration. It never promises to import an arbitrary website by URL. New scenes can start from an overview, a chosen approved target, or a duplicated scene. Blank creation and import are explicit alternatives to the sample.

Presets are starting points, not substitutes for controls: “Product demo” can set caption appearance, a gentle camera move, and a cursor style together. Applying a preset shows its scope and which overrides it will replace. Undo restores the previous project in one transaction. A preset never activates recording, calls a voice provider, or grants application actions.

## 6. Timeline and editing semantics

### Tracks and ownership

| Track | What the creator edits | Conflict rule |
|---|---|---|
| Scenes | Order, duration, transitions, named sections | One active scene on a chosen linear path; linked clips move with it. |
| Camera | Focus targets, zoom/pan keyframes, easing, holds | One owner of the scene camera transform at a time. |
| Cursor | Appearance, path, movement, dwell, gesture markers | One active visual cursor path by default; gestures do not execute app actions. |
| Voiceover | Takes, waveform, source trims, voice/style, fades and gain | Multiple audio lanes may mix explicitly; no accidental overlapping duplicate take. |
| CC | Text, cue boundaries, line breaks, language, appearance | One selected caption language; overlapping cues need explicit supported composition. |
| Callouts | Titles, labels, highlights, arrows and their timing | Defined layer order; overlays do not steal input from Studio controls. |
| Music / sound | Imported audio, click sounds, gain, fades, ducking | Optional lanes on the same clock; no sound without an authored source. |
| Interactions | Wait conditions, user choices, approved host steps | Visible markers/branches, never ordinary scrub-triggered animation clips. |

Unused optional lanes start collapsed. The Camera, Cursor, Voiceover, and CC lanes remain apparent in the default sample. Track eye/mute/solo/lock controls have distinct meanings: visibility/audio output, auditioning, and edit protection. The project exporter shows the final enabled output; temporary audition solo does not silently remove other tracks from exports.

### Editing operations

Support clip selection and multiselection, drag to move, edge trim, split at playhead, duplicate, delete, gap removal, snapping, timeline zoom, and precise start/end fields. A selected range can loop. Provide keyboard and click-based alternatives for dragging, including Move to time, Set start/end, and Move earlier/later.

**Ripple editing is explicit and off initially.** Without ripple, trimming changes the selected clip and leaves a gap or reports an overlap. With ripple, the UI previews which later items will move. Locked tracks or incompatible anchors block the transaction with a repair choice; they are not silently left behind. Moving a scene moves its owned clips together. An intentionally project-absolute music clip stays absolute and is visibly marked.

**Splits are nondestructive.** Audio pieces share the original asset with different source ranges. Camera and cursor curves are evaluated at the cut, preserving their boundary pose and tangent. Caption splitting preserves text and identifiers appropriately and offers a word-boundary choice. Events exactly at the split belong to one side, not both; a visual click or effect must not be duplicated accidentally. Every structural edit has one undo entry.

**Two time concepts are visible:** project time on the active path and local time within the selected scene/clip. Store authored timings with stable IDs, not array positions. Use seconds by default; timecode/frame stepping is a precision display tied to the chosen export rate, not a second clock. Evaluate indexed frame boundaries rather than accumulating rounded frame durations.

**No silent lossy edits.** Extending a clip beyond its scene offers Extend scene or Keep within scene. Shortening a scene across existing captions or audio shows the affected items. Protected content is not quietly truncated to make a drag succeed. Temporary incomplete numeric input remains visible and blocks invalid operations rather than reverting to an earlier value.

## 7. Closed captions: content, timing, and presentation

Closed captions are a first-class editable track, not a single caption textbox attached to a whole scene.

**Content and timing:** edit text on the canvas, in a caption list, or in the inspector. Split/merge phrases, change line breaks, correct words, assign speaker labels, adjust cue start/end, shift a selected range, and align against the voice waveform. Optional word-level highlighting requires word timing; approximations must be labeled, and unsupported timing must not be presented as precise alignment.

**Appearance:** font family, size, weight, text color, outline, shadow, background color/opacity, padding, corner radius, width, alignment, screen position, and safe margins. Ship a few useful presets—Clean, High contrast, Minimal lower third, Word highlight—with a visible preview. Allow direct repositioning on the canvas and exact numeric controls. Presets must not hide access to individual settings.

**Style scope:** project caption theme → language/track override → selected cue override. Show the active scope next to the control. “Apply to all captions” is an explicit action; Reset removes only the selected override. Copy/paste style does not overwrite text or timing. Responsive settings are based on the presentation viewport, not the author's editor zoom.

**Caption text is separate from the voice script.** Correcting punctuation or a transcription mistake must not regenerate the voiceover. Editing spoken words marks the relevant audio and alignment as stale, and offers Regenerate voice and Update captions as distinct operations. Manual caption corrections are protected unless the author explicitly replaces them. Regeneration must show the proposed text/timing diff.

**Import/export:** support WebVTT and SRT timing/text through validated importers, plus the lossless native project format. WebVTT is a timed-text interchange format [P1]; do not promise that every Studio animation or style survives external subtitle export. SRT export includes text/timing, not the full visual theme. Report unsupported formatting before export. Live playback offers toggleable CC; video export offers a subtitle sidecar and an explicit burn-in option. Burned-in text alone is not toggleable closed captions.

Captions include speaker identification and meaningful non-speech audio where needed, not just dialogue [A1]. Contrast, line length, reading pace, safe-area collisions, and missing cues receive useful warnings. Language-specific limits are configurable; a single character-count rule must not be advertised as universal accessibility compliance. Viewer readability preferences can override decorative author styling in live playback.

## 8. Voiceover: a real production workflow

### Sources and takes

Provide three explicit sources: **Import audio**, **Record voice**, and **Generate voice**. Prepared sample takes work without recording or provider access. Recorded/imported audio can be trimmed, split, moved, duplicated by reference, faded, and mixed without overwriting the original. Show waveforms and source duration. Keep alternative takes for comparison, with one active take per narration clip.

Recording starts only after an explicit Record action and browser permission, with a visible indicator and Stop. Offer playback and discard before adding the take. Do not capture microphone input on opening Studio. Imported media is validated with resource bounds; project files contain no authentication secrets.

### What “voiceover style” means

The voice inspector distinguishes four things instead of conflating them:

| Control group | Examples | Meaning |
|---|---|---|
| Voice identity | Available voice, language, supported accent | Who/which licensed synthetic voice is speaking. |
| Delivery style | Neutral, warm, calm, energetic, instructional, conversational | How the phrase is delivered; provider-dependent. |
| Speech direction | Pace, emphasis, pronunciation, pauses, supported pitch/expression | Instructions used when producing a new take. |
| Clip mix | Volume, fade in/out, optional supported processing | How an existing take sounds in the mix. |

Offer style presets plus available detailed controls, a pronunciation dictionary, and a short audition of the selected passage before whole-track generation. A “calm” preset is not just lower playback speed. Changing playback rate is not equivalent to re-performing the speech. An uploaded recording can always receive supported mix edits; changing its speaker/emotion requires an explicitly selected transformation service or a new take, not a fake style slider.

The generation adapter declares supported voices, languages, delivery controls, timing output, and limits. Do not expose unsupported style settings as functional controls. Provider-specific directions remain scoped to that adapter. Different providers need not interpret an expressive setting identically. No named provider, paid plan, or voice license is selected by this document.

### Generate, compare, replace

The author edits a script, selects voice/style, auditions a phrase, and chooses Generate for a clip or selection. The UI displays the external service and data being sent, and any available cost estimate before a paid operation. Generation is never triggered by every keystroke or by applying a visual preset. Credentials stay in a host-owned service, not in public JavaScript, scripts, exports, or the repository.

The old take remains playable until the new take is ready. A result is attached to its originating draft revision, source script, voice settings, and asset ID. If those changed while generation was running, the result appears as an alternative take; it must not overwrite the current narration. Retry/cancel and partial failure preserve all existing work. Cancellation of a provider request does not imply a guarantee that its billing stopped.

Changing from a four-second take to a six-second take opens a timing decision: **Fit scene to voice**, **Keep scene length and edit the take/script**, or **Keep as an alternative**. Show linked captions, cursor beats, camera moves, later clips, and locked tracks affected by each choice. Do not silently stretch the audio, move subsequent scenes, or drop words. Apply the accepted replacement and retiming as one undoable transaction.

### Mixing and alignment

Provide per-clip volume/fades, track mute/solo, and optional background-music ducking. Support multiple narration clips with clear scene boundaries and silence gaps. Waveform generation and decoding need bounded asset budgets. A later high-quality time-stretch option must declare its processing limits; ordinary playback-rate changes are not a guarantee of pitch-preserving editing.

The product target includes caption generation/alignment from a voice take, but the chosen local or hosted alignment service remains a separately reviewed integration. Without it, authors can time captions manually; an estimated alignment is labeled estimated. No fake auto-caption completion. Browser speech preview, if offered, is labeled an audition and is not a durable exportable take unless actual audio is captured through an authorized, supported path.

## 9. Cursor: appearance and choreography

The simulated cursor is an editable visual track. Choose an arrow, hand, dot, or other supplied pointer shape; adjust size, fill, stroke, shadow, opacity, and an optional halo/trail. Provide style presets and per-clip overrides with a clear Reset. A click ring, pulse, or click sound is independently selectable and timed; sound belongs in the audio mix rather than an untimed event handler.

**Movement:** choose start/end targets directly on the canvas or from approved target choices, add path points, and edit curve handles. Support straight and curved movement, easing, travel duration, dwell before/after, and a held position. Exact fields provide alternatives to path dragging. A “Natural” preset is an editable speed curve, not random movement that changes on every preview.

**Gestures:** point, click visualization, double-click visualization, press/hold, and drag visualization have explicit positions and times. A drag visualization is a path plus held-button state; it does not move real app data. Cursor visibility can be keyed or trimmed. Copying a cursor style never copies application authority.

**Coordinates:** default to target-relative positions and offsets in scene space so the cursor stays aligned through camera movement. Fixed viewport-space motion is an explicit advanced choice. Camera transforms are applied once. A missing target marks the clip broken; the system does not pick a similarly named button automatically.

**The real authoring pointer stays distinct.** In Edit mode it selects and adjusts things; in viewer preview it does not become the simulated cursor. Picking and scrubbing must never dispatch actual application clicks. Actions that genuinely modify the app live in the separate interaction model with host permission and user intent.

## 10. Camera and zoom: precise composition over real DOM

Camera clips contain editable keyframes for focus, zoom, pan/offset, and framing. Support overview, target fit, target-group fit, manual framing, zoom in, zoom out, pan, and hold. Defaults should produce a useful shot, but every generated keyframe remains inspectable and adjustable.

The creator moves the playhead, presses **Add camera keyframe**, then changes the composition using target selection, drag/pan, zoom controls, or exact values. Selecting a diamond reveals its time, target, scale, offsets, and interpolation. Moving its time changes when the motion happens; moving its handles changes how it feels. Include Linear, Ease in, Ease out, Ease in-out, and a custom easing editor. Overshoot/spring behavior needs bounded, reproducible evaluation, not an unseekable physics simulation.

A keyframe may follow a semantic target or hold a sampled composition. **Follow target** updates for declared layout changes; **Hold composition** preserves the shot until the next keyframe. Both require explicit behavior for missing/hidden targets. Show clipping or empty-space warnings rather than silently changing authored framing. Captions and playback controls stay outside the transformed application surface.

There are **three different zoom controls**, named distinctly:

- **Camera zoom:** changes what viewers see in the walkthrough.
- **Canvas view:** magnifies the editing workspace for precise selection; never changes exported composition.
- **Timeline zoom:** changes seconds per pixel for editing timing; never changes duration or playback speed.

These controls must not share an unlabeled slider. Canvas view defaults to Fit. Camera values are visible only with Camera selected or in its inline toolbar. Timeline zoom stays in the timeline header.

Desktop/phone composition variants use named viewport profiles and inherit common timing. Changing a device preview does not silently overwrite the base camera keyframes. Authors can add a profile override and see an override badge. The application may re-layout for a different device viewport; transform-only camera motion within one profile is distinct from that layout change.

Respect the viewer's reduced-motion preference in live playback. The editor can audition motion with a clearly indicated temporary choice, but exported live content must retain the intended reduced-motion alternative. DOM, map, and 3D camera ownership must remain separate; native map/3D adapters are not implied by a DOM zoom handle.

## 11. Synchronization: independent tracks, deliberate links

Use one presentation-time authority for the chosen playback path. The canvas, cursor, captions, and audio scheduler sample that authority, with explicit buffering, pause, seek, and rate behavior. The existing single-narration mechanism is a foundation, not proof that multitrack mixing or arbitrary keyframes already work. Web Audio describes an audio graph and scheduling model [P2]; implementation must validate actual cross-browser synchronization rather than claiming perfect timing from the standard alone.

**Anchors can be time-based or meaning-based.** A camera keyframe can stay at scene time 2.4 seconds, or attach to a narration word/phrase marker plus an offset. Cursor arrival can attach to the same marker. Linked items show a chain badge and a description such as “At ‘Review’ + 0.2 seconds.” Dragging an anchored item offers Adjust offset or Detach; it does not silently change its timing model.

Example: a narrator says “Review this route.” The zoom settles as “Review” begins, a cursor arrives 0.2 seconds later, and the corresponding caption appears with the phrase. Changing to a slower voice take can recompute those links after an author-reviewed timing diff. Manually pinned events stay pinned. If the anchor word is removed or alignment confidence is insufficient, show a broken link and offer a new anchor or absolute time. Do not invent word timing.

**Editing rules:** caption styling never retimes narration; caption text correction does not regenerate audio; camera easing never changes scene duration; cursor appearance never changes its path; replacing voice audio can affect duration only through an explicit accepted edit. Preview and export must use the same resolved timing plan. Live background/tab interruptions pause or recover visibly; wall time does not fast-forward through the scene on return.

## 12. Interaction, branching, and the meaning of scrubbing

A video-style editor must not erase what makes a live walkthrough different. An interaction marker can wait for a real user event or host condition. A branch has named outgoing paths, each previewable independently. The main timeline edits one selected path; a separate Path view shows choices and connections when needed, not a permanently competing second timeline.

A wait is displayed as **4.0 seconds of presentation + wait for user**, not a made-up fixed duration. While waiting, relevant narration and presentation progression pause according to the authored policy. Resume behavior and intro/outro audio around the wait must be explicit. A total duration containing waits is an estimate or excludes wait time, not a promise.

Scrubbing evaluates presentation state only. It never submits a form, repeats a save, approves a checkpoint, regenerates voice, or changes server data. Previewing a path with effects uses a declared isolated fixture and explicit outcome simulation. Unknown production state is not reconstructed by moving a playhead. When a fixture checkpoint is required, show it and explain why preview cannot continue without it.

For rendered video export, the author chooses a path and fixture outcomes, including how waits are represented. The renderer cannot claim to capture every interactive branch in a single linear video. The existing effect ledger, permission checks, and seek boundaries must remain authoritative.

## 13. Core workflows and feedback

**Change CC:** select a cue on the timeline, edit its text, choose a caption preset, change position, and preview the selected range. The inspector says This caption / Track / Project. The voice take remains unchanged. Invalid timing highlights the cue and offers a precise repair.

**Change voiceover style:** select a voice clip, choose a supported delivery preset, audition, generate or import a new take, compare it with the old one, inspect any timing changes, and replace it. No provider configured means Import/Record/prepared takes remain available; Generate explains the integration needed rather than appearing to work.

**Choreograph cursor and zoom:** set the playhead, select a target, add a camera keyframe, adjust framing, then place cursor movement and click visualization on its own lane. Link both to a word marker or time. Loop the range, adjust easing, and play the whole tour. The actual app button remains untouched.

**Save and continue:** Save project produces a reopenable native project with edit history metadata as designed, original asset references or explicitly bundled media, styles, keyframes, and captions. The exact undo history retention policy is separate from preserving editable content. Reopen checks versions and missing assets before replacing the current project. Importing JSON alone must not imply that audio files are embedded.

Errors identify both the item and recovery: “Voice take changed: review 3 linked timings,” “Camera target ‘Route metrics’ is missing,” “Caption end precedes start,” or “Track is locked; this ripple edit would move it.” Technical diagnostic codes remain in Details. Problems panel entries focus the corresponding clip without deleting the draft or starting playback.

## 14. Draft, preview, assets, and persistence

Maintain one editable project and immutable playback snapshots. Editing stops an active preview before changing its snapshot. Compilation, target resolution, and asset preparation happen automatically behind Play/Preview. If the current draft is invalid, show its errors; do not quietly play the last valid version while implying it contains current edits.

Use transaction-based undo across clips, keyframes, text, styles, and accepted retiming. Preserve native text undo inside text fields. Structural edits and slider drags each form meaningful undo entries. Asset binaries are not copied into every history snapshot. Bound history by operations and metadata bytes; expose when older recovery points expire. Save project preserves the project even when undo history is intentionally not persisted.

**Full product target:** explicit local save/reopen with a versioned project manifest and optional bundled assets. Browser-local recovery is opt-in, with a clear storage location, retention policy, delete control, and storage-failure handling. Cloud storage/collaboration is separate. Until durable persistence exists, the UI must say Edited in this tab / Download to keep, never Saved. A download initiation is not proof the user kept the file.

Store original audio separately from derived waveforms and alignment data. Takes have immutable asset identity/content hash, source ranges, generation provenance where relevant, and user-supplied rights information. Never export API keys, session cookies, real form values, or host permission grants. Authored text/audio may contain sensitive content; make the destination and included assets inspectable rather than asserting that exports are inherently private-data-free.

## 15. Project format, SDK integration, and agent authoring

The current compact storyboard format cannot losslessly represent this design. Do not force keyframes, multiple voice clips, caption styling, and branches into the old fields or hide them in undocumented metadata.

Propose a separately versioned **Studio project document** containing scenes/path graph; tracks/clips; camera and cursor keyframes; voice scripts/takes; caption languages/cues; themes/overrides; asset manifest; synchronization anchors; output profiles; and integration requirements. IDs are stable across reorder. Keep editor panel layout/selection separate from presentation semantics. Executable callbacks remain host-owned, not serialized.

Compile a Studio project to an explicitly versioned runtime plan. A capability matrix tells the author which features an installed player supports. Current runtime/schema versions must either receive deliberate extensions with migration tests or refuse unsupported content with a precise report. Never flatten rich projects through `readStoryboard` and call that a successful round-trip. Preserve old package entry points during a documented migration.

Keep Studio/editor dependencies separate from the small playback package. Reuse core targets, geometry, diagnostics, and safe execution contracts. Add a shared, deterministic presentation evaluator for camera/cursor/caption tracks so preview, seeking, and capture do not become unrelated engines. The media scheduler and project compiler need explicit tests; a form renderer is not the architecture for a production timeline.

Agents use bounded commands such as update caption, apply voice preset, insert camera keyframe, move clip, and propose timing repair. Commands carry stable item IDs and expected project revisions. A proposed patch produces a readable scene/track diff and is accepted or rejected as one transaction. Speech generation, asset upload, recording, export, and actual app effects have separate permissions. Agent friendliness is a reusable contract, not protocol logs on the creator's main screen.

## 16. Preview safety and authoring tools

Normal editing and visual preview operate in an explicitly host-approved surface. Target picking selects named eligible elements without activating their handlers. Use a tested authoring interaction shield with pointer and keyboard behavior; one bubbling `preventDefault` listener is not a sufficient contract. Top-layer dialogs, portals, cross-origin frames, and unrelated transformed ancestors require explicit support or refusal.

Visual previews of a supported human-authored project do not require repeated review-checkbox/load ceremonies. They still compile, resolve approved targets, check host policy, and bind the exact project/host revision. Imported or agent-generated proposals receive an appropriate content/permission review before acceptance. Any actual business action remains separately authorized; a cursor animation never supplies consent.

Audio assets and external provider operations have an explicit destination and permission boundary. Imported content is data, not executable instructions. A late async generation or prepare result cannot attach to a newer project without review. No telemetry, microphone use, DOM recording, service connection, or storage is enabled merely by opening the sample.

## 17. Responsive editing and accessibility

Desktop is the precision workspace. On tablets, panels collapse into drawers while the canvas and timeline remain visible. On phones, keep a compact preview above the active track; choosing CC, Voice, Cursor, or Camera opens a focused sheet. Do not make mobile authors scroll through all inspector sections before seeing the result.

```text
┌─────────────────────────────────────┐
│ Route review             Play   ⋯   │
├─────────────────────────────────────┤
│           LIVE PREVIEW              │
│        “Review this route.”         │
├─────────────────────────────────────┤
│ 00:06.40   ◀  ▶  ▶|   Canvas: Fit   │
│ [CC] [Voice] [Cursor] [Camera]       │
│     5 s       │       10 s          │
│ [Caption A] [ Selected caption ]    │
├─────────────────────────────────────┤
│ Caption text [Review this route.]   │
│ Start 6.4 s       End 8.1 s         │
│ Style: Clean ▾   Scope: This cue ▾  │
│ Appearance / Position              │
└─────────────────────────────────────┘
```

Core text/style/timing controls remain available without precision dragging. Track navigation must not imply that hidden lanes were removed from the project. The on-screen keyboard may reduce the preview temporarily, but must not obscure the active field or trap page scrolling. Test 320, 390, 768, 1024, and 1440 CSS-pixel widths, browser zoom, and device visual-viewport changes. These are design test conditions, not support claims.

Provide numeric and click/tap alternatives to dragging and separate keyboard support [A2]. Use a labeled linear clip list as an accessible alternative to a dense timeline, including track, start, duration, and selection. Keep focus predictable after split/delete/reorder and when closing sheets. Space/JKL/split shortcuts operate only outside text input and editable controls. Expose shortcut help and remapping/disable options where conflicts arise.

CC remains available in reduced motion; cursor trails and camera travel have an alternative presentation. Avoid announcing every playhead tick. Announce selection, completed edits, errors, generation completion, and meaningful transport changes. Reader overrides for caption size/contrast must not be blocked by decorative presets. Automated checks do not replace physical-device, screen-reader, or usability review.

## 18. Outputs and what each preserves

| Output | Purpose | Explicit boundary |
|---|---|---|
| Native Studio project | Continue editing with tracks, styles, takes, and anchors | Includes a manifest and chosen assets/references; not a hosted share link. |
| Live walkthrough bundle | Play through a compatible host/runtime | Requires declared targets and permissions; interactive paths remain interactive. |
| Caption files | Supply text/timing to other tools | VTT/SRT portability differs; report styling/animation losses. |
| Rendered video | Share a fixed presentation without the host app | One viewport/path; media/cursor/camera/CC rendered together, no live interactivity. |

Video export is in the target product, with a separately validated rendering pipeline—not an assumption that changing a file extension can capture DOM. Select resolution, aspect ratio, frame rate, range/path, caption burn-in/sidecar, and audio mix. Output format choices appear only when a tested encoder path supports them. Do not promise MP4/WebM support uniformly before verification.

The capture contract requires a controlled fixture, ready fonts/assets, chosen application state, stable timing, and rights to included media. Export progress must support cancellation and error recovery without changing the project. External resource fetches, uploads, and capture services require explicit authorization. Warn about unavailable font/asset/host dependencies before starting. Do not distribute unlicensed fonts or assets merely because they appeared in a preview.

Studio is proposed as a separate creator destination, with Agent lab retained for developers. Any new route such as `studio.html`, downloadable sample, or bundle must be explicitly added to the publication allowlist and exact-artifact verification in a later approved PR. This documentation does not deploy it.

## 19. Worked editing example and design-review screens

**Example sequence:** open the sample; select its second caption and change the words; apply a high-contrast caption style to the English track; select its voice clip and audition a calm delivery; replace the take after reviewing the timing diff; pin a zoom to the word “review”; curve the cursor path toward the same target; add a visual click pulse; loop the phrase; save the project; preview the whole path; export a caption file or chosen output.

That flow should feel like editing one project, not coordinating separate forms. At every step the creator can see the relevant item on the canvas and timeline and undo the edit.

Before implementation, review annotated screens for: populated workspace, selected CC/style scope, selected voice/take comparison, regeneration timing conflict, cursor path editing, camera keyframe editing, missing target, interactive wait/path selection, export review, and mobile caption editing with the keyboard open. These are required design artifacts, not implemented screenshots supplied by this document.

Compare alternatives where they materially affect usability: horizontal vs compact scene navigation, inspector tabs vs grouped sections, caption transcript panel placement, and how to reveal linked-track timing changes. Do not reopen the already clarified question of whether to include a real timeline or voice/cursor/camera controls. Those are requirements.

## 20. Acceptance and staged implementation

Stages divide delivery; they do not redefine a partial storyboard form as the finished editor.

| Stage | Deliverable | Completion evidence |
|---|---|---|
| D1 · Design | Workspace, track model, four inspectors, synchronization conflicts, responsive flows | Reviewed annotated prototype and first-time-author observations. |
| E1 · Editing foundation | Studio project, multitrack timeline, selection, common transport, undo, linked edits, local save/reopen | Round-trip tests; trim/split/ripple/lock invariants; no silent content loss. |
| E2 · Camera and cursor | Direct manipulation, editable keyframes/paths, gestures, presets, separate zoom controls | Deterministic scrubbing and target tracking; no app actions from visual gestures. |
| E3 · Captions | Cue and word timing, text/style editing, inheritance, languages, VTT/SRT | Preserved manual corrections; export-loss reports; accessible controls. |
| E4 · Voice and sync | Import/record, waveform/takes/mix, provider-capability style UI, reviewed generation, alignment/anchors | Real supported-provider evidence or explicit unavailable status; stale-result and retiming tests. |
| E5 · Viewer paths and outputs | Interactive waits/branches, live bundle, validated video rendering | Explicit path/fixture selection; presentation parity; host effects never replayed by seeking. |
| E6 · Polish and acceptance | Usability fixes, performance, mobile/keyboard/screen-reader checks, docs and migration | Observed workflows, supported-device evidence, exact deployed-artifact verification. |

The full editor is not complete until captions, voiceover styling, cursor choreography, and zoom/keyframe editing work together in a supported end-to-end path. Prepared audio alone is not proof of voice generation; text-only scenes alone are not proof of the full editor. Provider selection and paid execution remain approval gates, not reasons to silently remove voice styling from the product scope.

### Test scenarios that define success

1. Edit a caption's words, timing, style, and position without changing the voice take; track-wide styling preserves local text.
2. Replace narration with a longer styled take; review the affected camera/cursor/CC timings; protect manual captions and locked tracks; undo restores the entire previous state.
3. Draw and retime a cursor path and click pulse without firing the actual app button; real and simulated pointers remain distinguishable.
4. Add/move camera keyframes, distinguish camera/canvas/timeline zoom, scrub to any time, and observe the same composition on repeat.
5. Split a linked range without duplicating boundary events; ripple a scene only after viewing consequences; conflicting locks fail with recovery.
6. Edit or change projects while generation/preparation is pending; the late result cannot replace the new draft. Failed work does not remove the previous take.
7. Save/reopen a rich project without dropping styles, keyframes, assets, anchors, or supported branches. Unsupported-version imports preserve the original file and current project.
8. Preview a wait or branch in a fixture and export a chosen linear path; scrubbing never repeats effects or invents business state.
9. Complete the key edits by keyboard and click/tap alternatives; test caption editing on a phone without hiding the preview behind a long form.
10. Compare live preview and a rendered export at chosen sample times, including audio/CC synchronization and reduced-motion behavior where applicable.

Usability proposal: observe five representative first-time creators without explaining the controls. Ask them to change CC style/timing, change a narration take, adjust cursor/zoom timing, and preview/save. Target at least four of five completing each core task with no procedural help and correctly distinguishing camera zoom from canvas/timeline zoom. Record actual timings and confusion; do not claim these targets have been met. Run separate detailed-device and assistive-technology acceptance, including [issue #19](https://github.com/natanelia/dom-director/issues/19).

Set measured performance budgets after the prototype establishes expected project/asset sizes. Include long timelines, decoded-audio memory, waveform generation, repeated editing, interrupted playback, and resource cleanup. Do not reuse the old static-camera CPU benchmark as evidence for the new studio. No default user telemetry or recording is introduced to collect usability evidence.

## 21. Open decisions, not missing core scope

The settled direction is a full video-style authoring workspace with the live DOM as canvas and CC, voiceover, cursor, and camera as editable tracks. A sample and presets lower the entry cost without hiding the power.

Design review still needs to settle the exact inspector organization, default ripple/link affordances, first supported voice/alignment adapter, initial video renderer and formats, project asset-bundling limits, and opt-in recovery policy. These choices must be explicit before implementation, but none justifies calling a reduced caption form the finished product.

This document does not claim new functionality has shipped. The current source-backed capabilities, runtime limitations, package availability, and manual release gates remain those in the [release-candidate report](release-candidate.md) and implementation ledger until implementation PRs establish otherwise.

## References and evidence

Repository facts are pinned to the baseline commit. Layouts, presets, workflow rules, proposed formats, and acceptance targets are design decisions, not measured results or claims about another product.

- [Current agent page][source-page], [agent orchestration][source-agent], [storyboard renderer][source-editor], and [Orbit runtime integration][source-orbit].
- [Current storyboard authoring](storyboard-authoring.md), [current editor contract](visual-storyboard.md), [original media/caption/cursor direction](08-media-captions-and-cursor.md), and [runtime timeline design](07-timeline-and-playback.md).
- **[P1]** [W3C WebVTT](https://www.w3.org/TR/webvtt1/): timed-text interchange; this does not establish portability of every custom Studio appearance.
- **[P2]** [W3C Web Audio API](https://www.w3.org/TR/webaudio/): audio graph and timing primitives; not evidence that this project's proposed scheduler is implemented or synchronized.
- **[A1]** [W3C Understanding Captions (Prerecorded)](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html): speaker/non-speech information and synchronized captions; not a conformance certification.
- **[A2]** [W3C Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html): non-dragging pointer alternatives are needed separately from keyboard access.

External references were checked on 7 November 2026. The linked WebVTT and Web Audio documents include draft specification material; platform/browser support must be tested for each adopted feature. No voice provider capabilities, pricing, codec coverage, real-device support, or production usability are asserted by those references.

[source-page]: https://github.com/natanelia/dom-director/blob/cf8ce1b0f90c1d47743e18419d43835cfdff1872/site/agent.html
[source-agent]: https://github.com/natanelia/dom-director/blob/cf8ce1b0f90c1d47743e18419d43835cfdff1872/site/agent.mjs
[source-editor]: https://github.com/natanelia/dom-director/blob/cf8ce1b0f90c1d47743e18419d43835cfdff1872/packages/core/src/storyboard-editor.js
[source-orbit]: https://github.com/natanelia/dom-director/blob/cf8ce1b0f90c1d47743e18419d43835cfdff1872/site/app.mjs
