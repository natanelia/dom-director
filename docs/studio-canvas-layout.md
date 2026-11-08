# Studio canvas layout recovery

The Studio viewport can temporarily have no drawing area while its host is resized or hidden. A connected viewport with zero width or height now suspends drawing, clears stale caption/cursor/handle overlays, invalidates cached measurements and pauses the transport. Restoring a positive size recomputes the composition; playback resumes only on the author's next Play action. No project edit, undo entry, media change or application action is made.

This is not a blanket geometry-error suppression. Detached surface nodes, missing/hidden targets, unsupported transforms and invalid project data still fail through the existing validation path. The renderer does not substitute a different target or reuse stale target geometry.

## Evidence and limits

The retained mobile screenshot initially exposed an unexplained `Bounds must be finite and nonempty` status. A native-layout test then reproduced the same error deterministically by collapsing the viewport to zero height. The before-fix run is `42432661107` at `b0cd3109f0c7b2abeb122090bac68467178b9d00`; the zero-height regression fails in Chromium, Firefox and WebKit. Chromium diagnostic artifact `13598530839` has SHA-256 `3497866e68808ac5af7553910525ca33cc7091691560ac5ad6cf9a26a3aad78e`. Its trace records a connected stage with client height zero while the underlying application remains 960 × 540.

The exact transient sequence behind the older screenshot and an earlier isolated WebKit microphone-message timeout was not established. Do not claim that this reproduction proves the cause of every historical timeout. The microphone-denial journey remains asserted and unchanged in the baseline suite; an additional test records native click targets, verifies the denial survives responsive layout changes and confirms the draft is preserved.

Five canvas journeys cover initialization/mobile editing, resizing and scrolling, permission-denial status, zero-height pause/recovery, and explicit failure for a removed focus. The review suite includes these tests, so they run in existing staged publication acceptance and after exact-revision/hash verification on the authorized synthetic public Studio. The dedicated canvas matrix preserves bounded test-only native-geometry/status traces. No probes or tracing are included in the public artifact.

Inspect the current CI and deployment results before claiming a revision is live. Linux browser-engine checks do not certify physical devices, microphone codecs or screen readers.
