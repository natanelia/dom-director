# Visual editor redesign: make the walkthrough, not the configuration

**Status:** Draft for product/design review. Not approved for implementation.  
**Date:** 6 November 2026.  
**Baseline:** `cf8ce1b0f90c1d47743e18419d43835cfdff1872` (after PRs #20 and #21).  
**Trigger:** Natan's feedback: “The visual editor is extremely confusing. Start with a design doc first.”

This proposal changes the authoring experience, not the runtime's safety guarantees. This PR changes documentation only. Do not treat an accepted documentation merge as permission to implement or deploy the redesign; obtain explicit agreement on the workflow and layouts first.

## 1. The decision in one minute

The existing page is an agent integration test bench with an editing form attached. A creator needs a different product: **a small directing workspace where the actual application is the canvas.**

The proposed primary loop is:

**Choose what to show → write what to say → preview the walkthrough.**

The interface has a large live preview, a short sequence of scene cards, and the settings for the selected scene. One **Preview tour** action checks and plays the current draft. Edits update the draft directly, with undo; there is no Apply → Validate → Check approval → Load → Agent play ceremony for a local, visual-only tour.

Keep the agent lab, raw protocol messages, permission-failure demonstrations, and integration diagnostics separate. They remain useful developer tools; they must not be the entrance to visual authoring. Keep the current warm-paper/olive visual identity, but replace the long landing-page/form layout with a workspace.

Start with an editable three-scene Orbit example, already paused on its first shot. The new author immediately sees what a scene does and can change one caption before learning anything else. Blank creation and import are secondary choices, not prerequisites.

**Not in the first redesign:** a multi-track timeline, interaction recorder, arbitrary-site URL importer, generated voice, live AI service, remote collaboration, publishing, or cloud/browser autosave. Existing runtime capabilities remain intact; their existence does not require controls for all of them on the first screen.

## 2. What is confusing today

This audit uses the source at the baseline revision and the supplied desktop/mobile audit screenshots. It is an inspection, not a fresh live-browser session or a user study. The observations below are verifiable interface facts; the explanation of why they confuse is a design hypothesis supported by the user's feedback.

| Observed interface | Why it gets in the creator's way | Proposed response |
|---|---|---|
| The page leads with “Give an agent a catalog” and “Discover targets.” | It introduces the integration model before the author's job. | Open in a ready-to-edit example; discover approved choices behind the scenes. |
| The scene editor, canonical JSON, approval checkbox, command log, and synthetic security tests share a page. | Three audiences compete: author, agent developer, and permission tester. | Separate Studio from Agent lab. Keep Code behind an explicit developer entry. |
| “Validate + preview” shows a static plan; actual playback requires later controls. | “Preview” does not mean seeing the walkthrough. | Reserve Preview for visible playback. Validation is an automatic prerequisite. |
| There are agent Play/Stop buttons and a separate runtime transport. | It is unclear which controls operate the experience being edited. | One player and one visible transport for the active authoring task. |
| Draft field values, JSON, loaded runtime state, and approval state can differ. | The author has to manage implementation state manually. | One editable draft; immutable preview snapshots; visible errors instead of stale playback. |
| Basic fields expose milliseconds, maximum zoom, and pointer simulation immediately. | Too many decisions precede the first useful scene. | Default to focus, caption, and duration in seconds. Put motion tuning in More options. |
| The editor is a tall form; on mobile, the workspace follows the entire first column. | The author loses sight of what the changes affect. | Show the preview first; keep the selected scene's controls close to it. |
| The sample's prominent private-input and denied-action controls demonstrate security. | The content explains the SDK's defenses rather than helping someone tell a useful story. | Use Orbit's route-review story for authoring; retain the security fixture in Agent lab. |

Evidence: [current page][source-page], [agent orchestration][source-agent], [storyboard controls][source-editor], and [existing authoring documentation](visual-storyboard.md).

The lesson is not “add better tooltips.” The hierarchy and workflow need to change. Passing compiler, browser, and accessibility checks does not establish that a person understands the interface.

## 3. Who this is for, and what success means

**Primary author:** a developer, product designer, support specialist, or technical writer who wants to explain an application. Their job is to choose the important details, explain them, and control the pacing. They should not need to know the script schema or agent protocol.

**Integrator:** the developer who exposes a controlled application surface, approved targets, and host permissions. Setup belongs in SDK documentation and integration tools, not in every author's scene-editing flow.

**Agent developer:** someone testing discovery, validation, and command authorization. Keep Agent lab for this audience. “Agent-friendly” means structured, inspectable authoring contracts, not making people use the interface as if they were agents.

The first version must let an author edit the sample, create a new scene, change its focus, reorder scenes, preview, correct a mistake, and download a usable tour. It must make two boundaries obvious: preview does not click application controls, and the draft lives only in this tab until downloaded.

Proposed usability targets—not measured results—are a first sample preview within 15 seconds, a useful caption edit within 30 seconds, and a three-scene tour within three minutes without documentation. Section 15 defines how to test these rather than assuming them.

## 4. The mental model and scope

Use four concepts in the normal interface:

| Concept | Meaning to the author |
|---|---|
| Tour | The whole explanation, with a title and an ordered sequence. |
| Scene | One point in the explanation: focus, caption, duration. |
| Focus | The application element or region the viewer should look at. |
| Preview | Watch the current draft as a viewer would. |

Keep “cue,” “capability,” “revision,” “target registry,” “canonical,” and “load” out of the ordinary workflow. Those concepts remain in code and developer details.

The initial scope is linear **Watch** tours with text captions. Do not offer a Watch/Try/Guide selector that implies the editor supports interactive gates or branches. A quiet “Visual tour · no application actions” label explains the boundary. The runtime continues to support its existing advanced scripts elsewhere.

A scene's duration includes its camera transition. For example, a four-second scene with a 0.8-second move finishes at four seconds, not 4.8. The scene list shows the duration; the preview shows both tour position and current scene so the two are never confused.

### The default editable example

Use a separate, purpose-written storyboard on the existing Orbit fixture:

| Scene | Approved binding | Caption | Proposed default |
|---|---|---|---|
| The workspace | `orbit.overview` | “Start with the route assessment workspace.” | 4 seconds |
| Find the signal | `orbit.metrics` | “One checkpoint still needs a review.” | 4 seconds |
| Review the route | `orbit.review` | “The review panel explains what to check next.” | 4 seconds |

These bindings already exist in [the Orbit consumer][source-orbit]. Reusing them in Studio still needs an explicit host integration; this document does not claim that integration exists.

Do not import the original narrated, interactive Orbit tour and strip out its audio or gate to make it editable. Keep that tour unchanged. Label the new example “Editable sample · captions only.” No claim that a prepared sample was generated by AI.

## 5. Product structure

The product has three distinct destinations, with clear links between them:

**Demo:** experience the cinematic walkthrough and its real interactivity. Preserve the current flagship as the viewer-facing showcase.

**Studio:** create and edit a tour. The normal view contains the canvas, scenes, selected-scene settings, Preview, and Download. The word “Studio” is a working label, not a promise of a professional video-editing suite.

**Agent lab:** inspect catalogs, commands, failures, and host permissions. The existing `agent.html` can continue to serve this role. Remove its role as the recommended creator entry point only when the replacement is approved and tested.

Proposed Studio location: `studio.html`. This is an information-architecture proposal, not a new route in this PR. Any later public-route addition must explicitly update the deployment allowlist and exact-artifact verification. Do not silently widen publication to the source tree.

Within Studio, a **More** menu holds New tour, Open tour file, Code, and Agent lab. Preview and Download are not buried in that menu. No login, integration setup wizard, or provider key is required to edit the sample. Using a person's own application requires a documented, host-controlled integration—not pasting an arbitrary URL.

## 6. Desktop layout

The canvas is the center of attention. A compact scene strip sits below it; the selected scene's inspector sits beside it. Do not also add a second scene list, a multi-track timeline, or permanent JSON panel.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ DOM Director / Studio   Route review ✎     Undo Redo   Preview tour  Download │
│ Editable sample · Captions only        In this tab — download to keep   More│
├─────────────────────────────────────────────────────┬────────────────────────┤
│ SCENE 2 OF 3 · Find the signal                       │ SCENE                  │
│                                                     │ Find the signal        │
│                                                     │                        │
│           THE ACTUAL ORBIT APPLICATION               │ Focus                  │
│           framed on the selected target             │ Route metrics [Change] │
│                                                     │                        │
│           [outline marks the chosen focus]          │ Caption                │
│                                                     │ One checkpoint still   │
│                                                     │ needs a review.        │
│                                                     │                        │
│   “One checkpoint still needs a review.”             │ Duration    − 4.0 s +  │
│                                                     │                        │
│                                [Play this scene]    │ More options ▸         │
├─────────────────────────────────────────────────────┤                        │
│  1 The workspace  │  2 Find the signal  │ 3 Review    │                        │
│       4.0 s       │      4.0 s          │   4.0 s     │                        │
│                   selected             [+ Add scene]│                        │
└─────────────────────────────────────────────────────┴────────────────────────┘
```

The title in the header is the tour title; the inspector title belongs to a scene. Never repeat a global Tour title field inside every scene form.

Scene cards show order, authored title, duration, selection, and any problem. Use simple target illustrations or host-approved metadata, not automatic screenshots of application content. Cards have a context menu for Duplicate, Move earlier/later, and Delete. Drag-to-reorder is an enhancement, not the only method.

At approximately 1440 × 900, the canvas, caption, scene strip, primary preview control, and essential inspector fit together without scrolling through a landing-page introduction. Start with an inspector around 300 CSS pixels and a flexible canvas; exact dimensions require layout review. At smaller widths, change the arrangement rather than squeezing the canvas into a thumbnail.

The preview and captions remain outside the camera's transformed control surface where required. Selection outlines, text-entry focus, and player controls must not scale along with the application.

## 7. The first-use and everyday flows

### A. First visit: modify something that already works

Open the editable sample paused at scene one. Display one short hint: “Select a scene, change the caption, then Preview tour.” Do not put a mandatory walkthrough on top of the walkthrough editor.

The author selects scene two, edits the caption, and presses Preview tour. The product checks the draft and starts from the beginning. Back to editor returns to the previously selected scene, preserving the edit. Download produces the edited canonical tour file.

There is no Discover, Apply, Validate, Review checkbox, Load, or second Play step in this supported local flow. This simplification must be backed by the restricted host policy in section 11, not by bypassing it.

### B. Add a scene: start with the thing to explain

Add scene enters focus-picking mode. It does not immediately insert an empty invalid scene. The preview returns to the host's overview framing, approved regions become selectable, and a searchable list offers the same choices.

```text
┌───────────────────────────────────────────────────────────────────┐
│ Choose what to show                                      Cancel   │
├────────────────────────────────────────────┬──────────────────────┤
│                                            │ Search focus choices │
│       Orbit in overview framing            │ [                  ] │
│                                            │ Workspace            │
│       [Route metrics]   [Route map]         │ Route metrics        │
│                                            │ Route map            │
│                    [Review panel]          │ Review panel         │
│                                            │                      │
│ Pick an outlined region. App buttons       │ Arrow/Tab navigation │
│ do not run while choosing a focus.         │ and Enter supported  │
└────────────────────────────────────────────┴──────────────────────┘
```

A click/tap or keyboard selection chooses the focus, adds the scene after the selected scene, and opens its caption field. Use the approved target label as the initial scene title, a four-second duration, and an automatic fit. The author writes the caption. A pending new scene may exist in the draft, but Preview explains any missing caption rather than silently omitting it. Cancel leaves the original sequence unchanged and restores the previous authoring framing.

Focus picking must not dispatch the application's click handlers or move keyboard focus into a destructive control. Use a host-owned interaction shield and semantic target metadata; a general DOM click recorder is not a substitute. Where direct picking is unsupported, provide the explicit list, not unreliable guessed coordinates. Nested/overlapping eligible targets resolve through named choices rather than a hidden nearest-element guess.

### C. Adjust a scene

Selecting a card shows the selected scene's final composition without playing its entrance motion. Editing a caption updates the paused caption immediately; it does not restart the camera or steal text focus. Changing focus updates the composition when confirmed. Play this scene is a secondary action that runs only this scene, then stops.

Duration is in seconds, initially four, with a number field and step controls. **More options** contains camera-move duration, zoom limit, and whether to show the simulated pointer. Good defaults work without opening it. The compiler's current limits still apply; do not expose controls for unsupported easing or audio features.

### D. Preview the whole story

Preview tour flushes field input, checks the current draft, resolves targets, and prepares an immutable preview snapshot. If valid and permitted, it plays from scene one. The editor chrome gives way to one viewer-like transport: Pause/Resume, Restart, position, and Back to editor. Do not leave another active Play/Stop toolbar on screen.

The preview clearly says “Preview · no app actions.” Picking, editing, and normal app interactions are unavailable while this visual preview plays. Finishing holds the last frame with Replay and Back to editor; it does not approve a checkpoint or reset application state. An edit/undo request first stops preview and returns to editing. Previewing never silently continues using the draft that existed before the edit.

### E. Download and reopen

Download writes a valid canonical `.tour.json` file. It is not Publish and does not create a hosted share link or video. It includes authored text and approved target references, but not live form values, credentials, review grants, or command history. Authored text can itself contain sensitive information; do not claim all downloads are inherently free of personal data.

Open tour file validates size, format, lossless editor compatibility, and target compatibility before replacing the current draft. Confirm replacement when a draft already exists. On failure, preserve the existing draft and source file. On success, make replacement a single undoable edit within the history budget. A successful file import never starts playback.

## 8. Editing without a state-management puzzle

There is one **working draft**, not an Apply buffer plus a separately managed playback script. Validation runs as edits become complete; the normal author does not operate it manually. Draft changes are in memory, not persisted automatically.

Intermediate values such as a half-entered number stay visible in the relevant field. They must not be coerced to zero, discard the user's text, or cause a silent rollback. Block Preview and Download with a specific repair message while the draft is invalid. Never preview or export a previous valid script while implying it contains the current edits.

Group a text-edit session into a sensible undo step; structural operations each get their own step. Inside a text field, preserve native text undo behavior. Outside text entry, tour undo/redo operates on scene edits. Keep stable scene/cue identities through reorder. Delete selects the next available scene and offers Undo; deleting the last scene leads to an intentional empty state with Add scene, not a broken editor.

The existing compiler requires at least one scene. Therefore an empty editor draft is a UI-only state and cannot compile, preview, or download until a scene is added. Likewise, unset fields remain in the draft layer, never as invalid canonical output. This requires deliberate editor-state work; the existing mount function cannot simply be restyled.

Retain bounded in-memory history. Do not hide an exhausted undo limit or claim unlimited recovery. Proposed continuation of the current budget: at most 30 snapshots and 2 MiB, with a small explanation when the oldest recovery point is evicted. Opening Code uses an explicit transaction: edit a copy, validate, then Replace draft or Cancel. Unsupported advanced scripts are never flattened into the visual subset.

Status text says **“In this tab — download to keep.”** Do not show “Saved” or an autosave checkmark. After initiating a download, say “Download started — check your downloads.” Do not claim the browser saved the file when that cannot be confirmed. Later edits can show “Changes since last export,” which tracks the exported revision, not proof of durable storage. A navigation warning is best-effort protection, not a persistence guarantee, especially on mobile.

## 9. States, errors, and words that make sense

| Situation | Visible behavior and recovery |
|---|---|
| Sample ready | Scene one selected; Preview tour is the clear primary action. |
| Empty tour | Canvas remains visible; “Add a scene to start your tour.” |
| Focus picking | Clearly labeled mode, eligible outlines/list, and Cancel; app actions blocked. |
| Invalid duration | Inline “Enter a duration from 0.25 to 60 seconds.” Keep the typed value. |
| Move longer than scene | “Camera move must fit inside this scene. Shorten it or increase the scene duration.” |
| Missing target | Mark the exact scene; “Route metrics isn't available. Choose another focus.” Do not auto-replace it. |
| Preview preparation | Brief “Preparing preview…” status and Cancel; editor cannot accidentally start two runs. |
| Edit interrupts preview | Pause first; return to the selected scene; preserve the new draft. |
| Unsupported import | “This tour includes interactive steps or audio this editor cannot edit yet. Your current draft is unchanged.” Details identify the actual unsupported feature, not a guessed one. |
| Host rejects preview | “This application doesn't allow this preview.” Keep the draft; show recovery/documentation and optional technical details. |
| Detectable export/download error | Keep the draft and provide Retry; never mark it saved. When completion cannot be observed, say so rather than reporting success. |

Errors stay near the thing to fix. If Preview finds problems, show a compact summary with links to affected scenes and focus the first relevant error on the user's request. Keep diagnostic codes in expandable Details. An unavailable control needs an accessible explanation; a grey button by itself is insufficient.

Terminology changes: “Approved target catalog” becomes “Focus choices”; “Maximum zoom” becomes “Zoom limit” in More options; “Canonical script JSON” becomes Code; “Draft from catalog” becomes Use sample in the beginner path. Removing protocol language must not change the underlying permissions.

## 10. Small screens and accessibility

Do not stack the whole desktop inspector above the live application. On a phone, put the preview first, then the current scene and a compact editor. A Scenes button opens the sequence; selecting a scene closes it and restores the relevant focus. Caption, focus, and duration remain reachable without traversing diagnostics or JSON.

```text
┌───────────────────────────────────┐
│ Route review          Preview tour│
│ In this tab — download to keep   ⋯ │
├───────────────────────────────────┤
│                                   │
│        LIVE SCENE PREVIEW         │
│                                   │
│ “One checkpoint needs a review.”  │
├───────────────────────────────────┤
│ ‹  Scene 2 of 3  ›       Scenes   │
│ Find the signal                   │
│ Focus: Route metrics      Change │
│ Caption                           │
│ [One checkpoint needs a review.] │
│ Duration                − 4.0s + │
│ More options ▸                    │
│ + Add scene                       │
└───────────────────────────────────┘
```

Proposed responsive behavior: wide screens use canvas + inspector; medium widths use canvas with a collapsible inspector; narrow widths use the single-column layout above. Validate widths around 1440, 1024, 768, 390, and 320 CSS pixels rather than treating one phone screenshot as mobile acceptance.

When the on-screen keyboard opens, keep the active field and its error visible. Allow normal scrolling; do not shrink the entire editor into a tiny fixed-height viewport or put a sticky transport over the input. Studio controls are never transformed by the scene camera. Use readable labels and a 44 CSS-pixel touch-target design goal, without describing that chosen goal as a universal WCAG requirement.

Every focus choice, reorder, duplicate, delete, and preview operation works by keyboard. Move earlier/later also provides a single-pointer alternative to dragging; keyboard support alone is not the complete dragging alternative described by W3C [A1]. Restore focus after deleting/reordering a card, closing a picker, or leaving preview. Author-created sticky controls must not hide focused fields [A2].

Respect reduced motion in both editing and playback: show the chosen composition without animated travel, keep captions, and suppress the simulated cursor as appropriate. Do not animate on every field change. Announce meaningful events such as “Scene moved to position two” and validation failures, not every timeline tick; W3C's status-message guidance supports non-disruptive announcements [A3].

Use native labeled controls and a simple ordered scene list rather than a custom grid with unnecessary keyboard conventions. Automated audits complement—but do not replace—screen-reader, keyboard, zoom, and physical-device review. Existing manual acceptance in issue #19 remains open.

## 11. Simplify consent without weakening safety

The current permission machinery solves a real problem; its internal steps should not become every author's workflow. The distinction is **visual preview of a known restricted draft** versus **application effects or untrusted capability requests**.

For the built-in sample and human-authored supported scenes, the host explicitly permits only the bounded visual operations needed for local preview. Preview tour is the user's intent to run those operations. Automatic compilation, target resolution, and permission checks still happen. The allowed capability set does not expand because the author added a scene.

Imported or future agent-proposed content is reviewed as a proposed change before entering the draft. The supported visual editor refuses action/gate/branch/audio structures it cannot preserve; it does not “sanitize” them by deleting features. A future richer editor needs its own interaction and permission design. There is no “Approve everything” option.

Any actual application effect remains host-owned, separately authorized, and never triggered by picking a target, scrubbing, previewing, or displaying a simulated cursor. Do not make Agent lab's broad authorization callback the Studio policy. Source identity, draft revision, approved target set, and relevant host revision must be checked again immediately before preview. Cancel stale preparation if an edit or target change occurs while it is pending.

The editing viewport and visual-only preview need a tested interaction shield so pointer/keyboard input cannot accidentally trigger the real app. Preserve and restore any host-owned interaction state on exit. Do not claim safe picking merely because one bubbling click handler calls `preventDefault`.

No network provider, recording, telemetry, or persistence is introduced by this design. Agent friendliness stays in the reusable data contracts. A future AI proposal should be a readable scene-level diff with Accept changes/Discard, not a second competing control panel or a fake prompt box.

## 12. What to reuse and what needs design-led work

Reuse the canonical compiler, storyboard compiler, stable IDs, target registration, camera/player, caption rendering, and structured diagnostics. Keep the public package contracts and the existing advanced JSON path intact.

The current `mountStoryboard` renderer assumes a tall form, explicit Apply, a raw textarea, and host callbacks. It is evidence of useful underlying behavior, not the layout architecture to preserve. Keep its API usable during migration or introduce a clearly versioned replacement; do not silently break existing integrations because the demo changes.

New work, after design approval, includes the workspace shell, unified draft state, focus picker, one preview controller, responsive scene navigation, import/error mapping, and a controlled Orbit authoring integration. The same draft must drive both the inspector and preview; the Studio must not become a second independent walkthrough engine.

The editable example should reuse a host fixture boundary, not reparent the flagship page or transform the Studio itself. Separate camera ownership for the application stage and the editor. Keep application state distinct from presentation state: returning to editing restores the authoring view, not arbitrary business-state rollback.

## 13. Alternatives considered

**Keep the page and hide logs in accordions.** Small change, but it keeps the agent-first language, long form, competing playback, and manual load/review state. Insufficient for the feedback.

**Make a step-by-step wizard.** Helpful for the first scene, but slow for repeated caption edits, comparison, reorder, and pacing. Use an inline first-use hint and a focused target picker instead of a permanent wizard.

**Build a full video-editor timeline.** Powerful for synchronized tracks, but introduces keyframes, lanes, waveform alignment, and time-scale decisions before the basic authoring loop works. Defer it; the scene strip is an ordered sequence, not a disguised timeline.

**Make AI chat the primary interface.** May draft content eventually, but adds uncertainty and provider requirements. It does not solve inspection or editing. A future assistant should propose changes inside the same scene model.

**Selected direction:** canvas-first scene editing, direct draft updates, one preview path, and developer tools kept separate. Test this as a design before implementing it.

## 14. Features to grow into, not expose prematurely

| Later need | Natural place in this design | Required separate decision |
|---|---|---|
| Prepared narration and detailed captions | Selected-scene Audio/Caption controls; optional timing view | Audio/text mismatch handling, authorized assets, alignment, and lossless import. |
| Try/Guide interactions | Explicit interactive scene type | Real action consent, conditions, completion, seek boundaries, and user takeover. |
| Branching | A separate path view when branches exist | How choices, preview paths, and return points are explained. |
| Agent proposals | Change-review panel beside the affected scenes | Provenance, readable diffs, exact-version acceptance, and permissions. |
| Video export | A distinct export action | Capture boundaries, narration, codecs, and honest playback/export differences. |
| Durable drafts/collaboration | Explicit storage/share capability | Retention, privacy, ownership, conflict resolution, and opt-in. |

Do not add disabled tabs for all of these to the initial UI. Preserving an extension point is not a reason to present an unfinished feature.

## 15. Design review and usability gates

**Gate 1 — agree on the product.** Review this document's primary loop, separation from Agent lab, editable-sample starting point, direct-edit semantics, and desktop/mobile layouts. Resolve disagreement here. No implementation starts merely because the document exists.

**Gate 2 — test the interaction design.** Produce an annotated, low-fidelity prototype of ready, picking, editing, previewing, missing-target, and mobile-keyboard states. It must show how the author returns to editing and keeps their work. Review those screens before choosing visual polish or shipping code.

**Gate 3 — observe first-time use.** Recruit five representative people who did not build this editor, spanning engineering, product/design, and support/documentation. Ask them to change a sample caption, add a scene focused on a different region, reorder it, preview the whole tour, repair a missing target, and download their work. Do not explain the controls first. Record confusion and assistance as failures of the proposed path, not user errors.

Acceptance targets: at least four of five complete the core edit/add/reorder/preview/download task within three minutes without procedural help; at least four of five correctly explain what Preview runs and whether the draft survives a reload. Target a sample preview within 15 seconds and first caption edit within 30 seconds. Zero unintended application actions or silent content loss are acceptable. These small-sample targets are product gates, not statistical proof of broad usability.

Run a separate keyboard-only pass and the physical-device/assistive-technology checks tracked in issue #19. Verify both keyboard and click/tap reorder alternatives. Do not substitute automated green checks for these observations. No production analytics or recording is enabled to gather this evidence by default.

### Implementation slices only after the design gates

1. Workspace and editable sample: no feature expansion; live canvas and current-scene editing first.
2. Unified draft, validation, and single preview lifecycle, including invalid-input and stale-work tests.
3. Focus picking, scene operations, undo, and safe import/download.
4. Responsive/accessibility refinement, usability fixes, and exact deployed-artifact acceptance.

Each slice needs a reviewable PR and tests for the actual user journey, not just whether a button exists. Keep the existing editor reachable until the replacement passes acceptance. New public entry points and migration copy must be explicit in the deployment PR. Do not mark future slices implemented in the milestone ledger now.

## 16. Decisions awaiting review

The recommended defaults are: separate Studio and Agent lab; start in an editable sample; use a canvas plus scene strip and compact inspector; edit directly with undo; offer one-click restricted visual preview; and keep persistence out until explicitly designed.

The main unresolved questions are whether the scene strip or a left scene rail is easier for the intended authors, whether the editable sample is more helpful than an initial blank-tour choice, and whether mobile editing needs a dedicated full-screen caption sheet. The prototype should compare these specific alternatives—not reopen the entire product or add more features to compensate.

Approval means agreement on the creator's workflow and the next design prototype. It does not certify the runtime, waive issue #19, authorize npm publication, or claim the redesign is already usable.

## References and evidence

Current behavior is anchored to the baseline revision, not an assumption about later deployments. The supplied audit screenshots show the current long form and mobile ordering; they are not new device tests. Linked design chapters contain historical proposals, so implemented declarations and source take precedence when they disagree.

- [Current agent page][source-page], [agent state and permission orchestration][source-agent], [current storyboard renderer][source-editor], and [registered Orbit targets][source-orbit].
- [Storyboard contract](storyboard-authoring.md), [implemented visual editor](visual-storyboard.md), [release candidate](release-candidate.md), and [manual acceptance issue](https://github.com/natanelia/dom-director/issues/19).
- [Original creative direction](22-flagship-demo.md) and [authoring/distribution design](14-authoring-and-distribution.md). Reuse the product intent, not outdated implementation-status statements in those chapters.
- **[A1]** [W3C: Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements): non-dragging pointer alternatives; keyboard support is a separate requirement.
- **[A2]** [W3C: Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum): keep focused controls visible under author-created overlays.
- **[A3]** [W3C: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): announce meaningful status changes without unnecessary focus changes or chatter.

External accessibility references were checked on 6 November 2026. They support specific interaction requirements, not a conformance claim. Layouts, labels, timings, usability targets, and proposed product boundaries in this document are design decisions or hypotheses, not externally established facts.

[source-page]: https://github.com/natanelia/dom-director/blob/cf8ce1b0f90c1d47743e18419d43835cfdff1872/site/agent.html
[source-agent]: https://github.com/natanelia/dom-director/blob/cf8ce1b0f90c1d47743e18419d43835cfdff1872/site/agent.mjs
[source-editor]: https://github.com/natanelia/dom-director/blob/cf8ce1b0f90c1d47743e18419d43835cfdff1872/packages/core/src/storyboard-editor.js
[source-orbit]: https://github.com/natanelia/dom-director/blob/cf8ce1b0f90c1d47743e18419d43835cfdff1872/site/app.mjs
