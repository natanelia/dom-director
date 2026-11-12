# Studio: precise timeline editing

Camera and cursor keys now have their own diamond controls below their clips. Select a diamond to inspect its existing key and seek to its timing. Drag horizontally to retime it; drag the canvas handle instead to change its path. Clip-local timing fields remain available. **Key to playhead** aligns the selected visible key with the current playhead and rejects positions outside that clip.

A key click or a small pointer wobble only selects. Dragging previews without creating history; a valid release commits one undoable change. Escape, pointer cancellation/capture loss, window blur, hiding the page, leaving the page or resizing cancels the gesture. A final invalid release restores the original draft instead of applying the last valid preview. Track locks and source-window bounds remain enforced.

## Magnetic snapping

With Snap enabled, clip starts/ends, trim boundaries and motion keys align with nearby visible timing references. References include the scene edges, playhead, enabled-track clip edges and visible camera/cursor keys from other clips. A labelled vertical guide identifies the exact time. The proximity threshold is eight CSS pixels at the current timeline zoom, not a fixed number of milliseconds. Exact equal-distance ties prefer the playhead, then scene edges, clip edges and other keys.

Moving a whole clip checks both ends. Trimming checks only the edge being dragged. Ripple followers in the same track/scene move together, so they are not used as stationary snap references. Hidden tracks are excluded; locked visible tracks can still be references. Snapping never makes an overlapping, out-of-scene or otherwise invalid edit valid: the existing model constraints still decide whether a release can commit.

Away from magnetic references, the existing 100-millisecond relative-delta grid remains. Hold Alt during the drag or switch Snap off to bypass both magnets and the grid for millisecond precision. Timeline horizontal scrolling participates in the gesture's movement. Snap guides are temporary UI, never saved project data.

## Keyboard and source windows

Focus a timeline diamond and press Left/Right to nudge ten milliseconds, or Shift+Left/Right for 100 milliseconds. Delete removes that key, not its clip. Undo restores it. Buttons and inspector fields provide non-dragging alternatives; native text-field keyboard behavior is unchanged.

A split or trimmed motion clip can retain keys outside its visible source window to preserve interpolation. Those keys remain stored, but they are not presented as draggable timeline keys or snap references. Retiming a visible key uses clip-local milliseconds plus its source offset; it does not move its sibling clip, change the clip duration, rewrite a cursor path, or touch captions/voice. The project format is unchanged.

## Reusable API

`@dom-director/studio/editing` exports `createTimelineSnapper(project, options)` and `moveTimelineKeyframe(project, clipId, keyId, clipTimeMs)`. Build one snapper from the immutable project at gesture start; `snap(deltaMs, {bypass})` returns a relative delta and an optional absolute project-time guide. Then validate the proposed move/trim/key edit, and commit using the expected project revision. The helper reads no DOM and grants no permissions. It does not perform the commit or resolve overlapping keys automatically.

Tests live in `packages/studio/test/timeline.test.js`, the installed-package TypeScript consumer and `studio-tests/timeline_test.py`. The new browser journeys are included in `studio-tests/review_test.py` alongside the existing 42 baseline/review journeys, so staged and verified-public checks exercise the same behavior in all three browser engines. Test definitions are not a claim about a particular run: inspect the current PR and deployment results.

This does not implement clip grouping, automatic speech alignment, word-anchored timing, multitrack mixing, video rendering or a voice service. Physical devices and assistive technology still need the manual acceptance recorded in issue #19.
