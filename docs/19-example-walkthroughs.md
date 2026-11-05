# 19 · Worked journeys

The JSON files in [examples](../examples/README.md) are validated script fixtures, not runnable application demos. Host target/action/condition implementations and the runtime are not present yet.

## A. A simple overview

[Minimal tour](../examples/minimal.tour.json) frames a dashboard region, explains it, points to a control, and returns to the overview. No effects or narration assets are needed. An agent should be able to produce this from a target catalog, validate it, and preview all requested visual behavior without any execution permission.

Success means correct target resolution, useful framing, working pause/reset, and complete teardown. It does not mean the user learned the product or completed a task.

## B. Narrated explanation with captions

[Narrated settings](../examples/narrated-settings.tour.json) uses authored narration cue timings as anchors for camera/cursor/highlight cues. The fixture intentionally includes **text and timing only**, not a voice recording. Without an approved audio asset the future runtime treats it as text-only timed playback; adding an asset later must validate duration/timing and autoplay behavior.

The [WebVTT sidecar](../examples/media/settings.en.vtt) is generated from the same caption cues. Changing narration should regenerate both the sidecar and dependent cue offsets. The captions remain outside the zoomed application and are also available in the transcript.

## C. Guide a user through validation

[Guided task](../examples/guided-task.tour.json) highlights an inspector and waits for a host condition indicating a valid selection. After the user fixes the input, a second scene explains the resulting summary. The gate is based on domain validity, not a click count. It times out into a paused explanation rather than asserting success.

This is useful for complex editors, forms, and settings screens. It demonstrates why presentation duration and actual completion time must be separate.

## D. Let the learner choose a path

[Branching tour](../examples/branching.tour.json) offers a basic and an advanced explanation. The graph is acyclic; choice labels are accessible; the progress UI shows the selected path rather than pretending every possible branch has one duration. Backward navigation changes explanation, not business state.

A future role-based variant could filter choices using host-approved capabilities. It must not expose private features by placing them in a public script.

## E. Demonstrate a safe fixture action

[Safe fixture](../examples/safe-fixture.tour.json) contains a named action that sets a synthetic preview value, followed by a success condition. The requested action and condition appear in the script's capability list. Their actual implementation, impact classification, and grants belong to the host.

The example is not evidence that a given action is safe: the host must supply an isolated fixture. Scrubbing past the action does not run it. A reset/replay command would need separate fixture support. Production use should prefer user-driven guide mode unless a narrowly defined action is explicitly authorized.

## F. Explain a spatial issue

[Semantic map targets](../examples/semantic-map.tour.json) refers to an approved map feature and an inspector panel through stable IDs. The current draft uses the page camera to frame the projected target; a native map-camera choreography is a deferred adapter, not encoded as an invented core operation.

A host can materialize the relevant feature and project its bounds. If it cannot, the director should offer a text/overlay explanation or a documented unavailable-target state. The scene must never pretend a canvas feature exists as an ordinary selector.

## G. Agent previews a real task

The agent discovers approved target IDs, creates a script, validates it, and calls static preview. The preview lists the requested actions and highlights proposed target locations only after the host allows measurement. The user reviews the exact action parameters in host-owned UI. Execution is separately granted, and the trace reports verified outcomes rather than fabricated success.

This workflow turns an agent's plan into something visible without equating visual polish with correctness. It is a strong product direction after the basic runtime works.

## H. Bug explanation and reproduction

A user marks a problem while an opt-in recorder stores only approved semantic events. An author adds narration and highlights. If the host provides a sanitized state seed and fixture, the walkthrough becomes a replayable reproduction. Otherwise it remains an annotated account of what was observed. The exported artifact must say which it is.

The same script can inform a regression test, but an automated test should assert domain state and action counts independently of the narration. A successful cinematic playback is not proof that the bug is fixed.
