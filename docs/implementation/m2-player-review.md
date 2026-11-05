# M2b review follow-up

The external review bot identified that the scene itself was incorrectly tested
against the viewport clipping box. The traversal now excludes the intentional
scene/viewport boundary. The new 320-pixel viewport regression fails before the
fix and passes afterward. The dynamic movement test now includes the actual Play
result, session state and diagnostic events without reducing its scale threshold.

Self-review additionally caches completed-visit camera endpoints so targets from a
previous route can unmount before the next scene. Unsupported replacement script
modes are rejected before destroying the current run. Three added browser cases
bring this milestone slice to 31. Historical endpoint caching is run-local and
cleared on stop/load/destroy; it does not capture or restore application state.

The local combined worktree also contains the separate narration slice: its 43
pure and 41 Chromium memory-transport browser cases pass. Only the M2b files are
included in this PR; the normal HTTP CI results must pass on the final head before
merge. An automated review is not a human approval or accessibility certification.

## Scheduling follow-up

The WebKit run reported playing at scene time zero at a single 320 ms observation,
without a diagnostic. This is not enough evidence to attribute the failure to
clock math. The moving-target regression now requires two separate increments of
at least 150 ms inside bounded deadlines while the target keeps moving; it still
checks camera magnification and cancellation cleanup. A permanently stalled or
one-frame-only player fails.

Independently, scheduling previously cancelled and requeued an existing animation
frame for every command/event. The frame loop now coalesces requests, cancels only
on suspension/destruction, and ignores stale callbacks by generation. Three pure
regressions cover 1,000 repeated requests, stale callbacks, and in-frame stops.
