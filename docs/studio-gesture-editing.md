# Studio pointer editing

This complements [the workspace guide](studio-workspace.md). Inspect the current PR and deployment checks before treating a particular revision as published.

Drag the body of a timeline clip to move it; drag its left or right edge to trim. While dragging, the proposed boundary and its scene-local times are shown on the clip. A trim changes the preview width rather than sliding the entire clip. Ripple movement previews affected later clips in the same track and scene. Camera, voice, cursor and caption tracks are not implicitly grouped.

The project is unchanged until a valid release. A successful gesture is one undoable edit. Escape, losing pointer capture, pointer cancellation, window blur or leaving the page discards a timeline drag. Escape also discards a canvas keyframe drag. Releasing on an invalid time does not apply an earlier valid point: the original geometry is restored and the draft remains unchanged. Revision checks reject stale gestures. Locked tracks are not draggable.

A click or small pointer wobble on a keyframe handle selects it without editing coordinates or adding an undo entry. Actual canvas movement needs at least four CSS pixels; the movement delta is rounded in scene coordinates, preserving any fractional offset in the original key. Release coordinates are sampled explicitly.

Validation uses the existing model rules: clips must fit their scene, overlaps are rejected, voice source windows remain bounded, and word-timed captions must have their word timing adjusted or removed before trimming. Invalid positions show an error instead of being silently clamped. Snapping still uses the existing 100 ms grid; this change does not introduce boundary-magnet snapping or cross-scene dragging.

Precise timing and keyframe fields remain alternatives to dragging. Motion/source data, prepared narration, caption text, host permissions and export formats are unchanged. Pointer feedback is temporary presentation state and is not saved into a project.

Nine added pointer cases cover both trim edges, unchanged revision during preview, one-step undo, Escape recovery, invalid release after a valid preview, ripple feedback, capture loss, cancelled cursor keyframes, locked tracks and fractional-coordinate selection. `studio-tests/gesture_test.py` retains the earlier review journeys; `studio-tests/keyframe_test.py` contains the fractional-coordinate case. `studio-tests/review_test.py` runs both along with the five canvas-layout cases, for 22 review cases in addition to the separate 20 baseline journeys. They run in the existing staged and verified-public Studio workflows. No physical-device or screen-reader certification is implied.
