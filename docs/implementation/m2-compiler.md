# M2a — canonical script compiler and presentation state

This slice implements B01 and the pure portion of B03. The next slice connects
these models to the managed surface. No application action executor is included.

## Implemented

The canonical repository schemas are embedded at build time by
`python3 tools/build_runtime.py`. Runtime validation does not load arbitrary schemas
or fetch external references. The generated module is not a second hand-maintained
language definition. The schema interpreter intentionally supports only the subset
used by these repository-owned schemas; it is not a general JSON Schema package.

Input is bounded to 1 MiB, 40 levels and 100,000 value nodes. JSON text is parsed
before duplicate keys are lost. Reserved keys, accessors, classes, invalid Unicode,
cycles and non-finite numbers are rejected. Use JSON text for untrusted transport;
JavaScript proxies are executable host objects and are not an isolation boundary.
Plans are copied and frozen. Diagnostics do not echo invalid values.

The compiler resolves narration anchors, validates target/asset/capability links,
checks acyclic reachable graphs, and rejects competing camera/cursor tracks. All
six existing canonical example tours compile unchanged. Preview is pure and omits
action arguments. Capability declarations never grant host permission.

The internal session uses an injected monotonic clock, deterministic barrier
ordering, explicit visited paths, branch choices, scene-local seeking, separate
pause/wait reasons, cancellation epochs and stable run/visit identifiers. Seeking
performs no effects. Future state-dependent seeks are blocked. Replaying the same
visited path retains resolved barriers rather than silently repeating effects.

## Review fixes and evidence

Self-review added a last-observed clock bound (not just an anchor bound), protected
against stop during a synchronous observer callback, and checks cancellation before
queued host work starts. A late condition cannot erase a user pause. Failed rate
validation cannot advance the session as a side effect.

Local Node 22.16.0: 30 tests pass in the geometry/compiler/session suites. Tests
cover all canonical tours, malformed input, graph/reference/track errors, immutable
plans, exact anchors, no-effect seeking, cancellation, branches, guide holds, rate
changes and completion. Actual CI results must be inspected before merge.

The browser facade, rendered tracks and static transcript controls are separate
slices. This document does not claim the entire M2 acceptance gate is closed.
