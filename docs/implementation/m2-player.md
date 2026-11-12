# M2b — real-DOM visual player and controls

This slice connects the compiler/session to the M1 surface and implements B04/B05
and the non-media part of B07. The existing Orbit demo remains unchanged; a small
SDK consumer is in `examples/browser/index.html`.

## Runtime contract

`createDirector` exposes load/play/pause/seek/rate/choice/next/stop/destroy with
structured command results, inspectable session state, semantic events, opt-in
frame observations and a completion promise. Destruction is idempotent. Core imports
remain safe on the server after the canonical-schema build.

Targets are lazy host resolvers or explicitly named virtual bounds. Private targets
need an explicit local grant; secret targets are always excluded. The catalog contains
only approved labels/IDs, never DOM text or values. Geometry is read in batches after
invalidation, then transforms and overlays are written. Resize, scroll, relevant DOM
changes and explicit host invalidation refresh the cache. A target animated without
DOM changes must opt into `dynamic: true` or request invalidation; the engine does
not pretend ResizeObserver detects every position change.

Camera/cursor/highlight/annotation/caption samples are derived from presentation time.
Cursor gestures are decoration only. Annotations use textContent. Transforms do not
change application width/height; native hit testing remains intact. Replaced nodes
are resolved again. Nested scroll clipping is reported, not falsely solved with zoom.
A host-authorized reveal can make the target available before playback retries.

Native controls provide Play/Pause, Stop, scene-local seeking, speed, reduced motion,
branch choices, guide boundaries and a stable transcript. Controls cannot be mounted
inside the transformed scene. Time is labeled per scene, not as a precise percentage
of an unexplored branching path. The transcript remains readable on target failure.
No focus is moved by camera shots. Explicit focus requests restore only still-owned
focus on destroy. Scene input pauses the cinematic player; guide-specific host
policies are completed with the guidance slice.

## Self-review fixes

Continuous geometry invalidations initially restarted a correction every frame and
could freeze movement. Corrections now keep their bounded interpolation window while
accepting updated endpoints. A new regression invalidates every 16 ms and verifies
movement continues. Font-load invalidation, finite nonnegative insets, nested clipping,
secret-target denial, observer-error isolation and cancellation-safe completion were
also reviewed and tested.

## Evidence

Local Node 22.16.0: 36 pure tests pass, including 2,000 shuffled exact-time samples and
2,000 projection round trips. Local Chromium 144: 28 browser cases pass using the
explicit memory transport because local HTTP navigation is blocked by this environment.
CI tests the regular HTTP fixture on Chromium, Firefox and WebKit before merge.

Browser cases cover real play/pause/seek, native pointer/keyboard interaction, literal
markup in annotations, missing/ambiguous/private/secret targets, replacements, reduced
motion, hidden-page suspension, geometry caching, static transcripts, ownership and
30 player plus 100 surface create/destroy cycles. Cycle counts are cleanup tests, not
a claim of zero retained heap or GPU resources. Audio, policy-driven effects, agent
transport and React adapters are separate milestones.
