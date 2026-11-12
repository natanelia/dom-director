# 07 · Time, playback, gates, seeking, and effects

## Two domains, not a pile of timers

**Presentation time** determines camera, captions, cursor, and annotations. **Execution state** tracks application effects, conditions, branch choices, and approvals. A script can render presentation time 2,000 ms without repeating an action that happened there. That separation is the central invariant.

Each scene has a nominal duration. Gates can add an unknown wall-clock wait. A branching walkthrough has a visited path, not one predetermined total duration. The player labels an estimate as an estimate and does not show a falsely precise “80% complete” across unexplored branches.

## Clock model

Without audio, use a monotonic clock anchor:

```
sceneTime = anchorSceneTime + (now - anchorMonotonicTime) * rate
```

On pause/rate change, first sample and commit the old position, then replace the anchors. Do not accumulate frame deltas indefinitely. With prepared audio, media position is the presentation authority for its segment:

```
sceneTime = segmentStartMs + audio.currentTime * 1000
```

When audio reaches its segment end, transfer authority to the monotonic clock with a continuity-preserving anchor. Narration begins at scene time zero in the draft schema; later segmented-audio support must preserve this mapping explicitly. Browser media clocks and scheduling have finite precision, so this is not a sample-accurate studio mixer. [S3–S4](21-sources.md).

Animations either sample the coordinator's time or are synchronized to it under a proven backend contract. Starting unrelated CSS transitions, requestAnimationFrame loops, and media playback simultaneously does not establish synchronization.

## State machine

| State | Meaning | Allowed exits |
|---|---|---|
| idle | No loaded script | load, destroy |
| preparing | Validating and preparing approved resources | ready, error, cancel |
| ready | Ready but no playback started | play, seek, destroy |
| playing | Presentation time advances | pause, waiting, buffering, seeking, completed, error |
| paused | User pause; presentation time frozen | play, seek, stop, destroy |
| waiting | Gate or authorized action blocks advancement | resolved, timeout, pause, stop |
| buffering | Required media cannot advance | playing, paused, text-only, error, stop |
| seeking | Reconstructing presentation state | paused, playing, blocked, error |
| completed | Selected path finished | replay, seek, destroy |
| error | Recoverable or terminal diagnostic | declared recovery, stop, destroy |
| destroyed | Resources released | none |

`blocked` is a command result/reason, not an additional persistent state: for example, a seek returns `SEEK_REQUIRES_CHECKPOINT` and leaves the session paused. Stop returns the loaded session to ready after cleanup; destroy releases it entirely.

## Timeline ordering

Resolve numeric and symbolic cue anchors before execution. A visual cue interval is half-open `[start, end)`; the reducer holds defined end states where the cue's semantics say so. At a shared timestamp, process previously completed work, then gate/action barriers, then sample visual state. An unresolved barrier prevents later same-timestamp effects from running. A source-order tie-breaker is deterministic but cannot resolve conflicting camera ownership; the compiler rejects those conflicts.

All cues and scenes have stable IDs. On each scene entry generate a visit ID. Effects are keyed by run, scene, visit, and cue; command requests also carry independent request IDs. Retrying an RPC request does not create a new scene visit.

## Pause, visibility, and cancellation

Pause freezes visual time and pauses narration. A pending read-only condition may continue observing, but its completion cannot resume playback when the user has paused. Track suspension reasons separately; remove the gate reason without removing the user's pause reason.

Default hidden-tab behavior pauses the presentation and audio. Returning to the tab does not fast-forward through steps or execute accumulated actions. Mobile suspension may lose media resources; reprepare and resume only after a visible status and, when required, another user gesture.

Stop aborts pending operations and increments the execution epoch. Late callbacks cannot mutate a later run. An external action may already have committed; show “outcome unknown” and query the host's status endpoint rather than assuming cancellation undid it.

## Gates

A gate subscribes to a named host condition or waits for an explicit continuation/choice. A condition is not arbitrary script JavaScript. Host definitions state whether the check is level-triggered (“panel is open”) or edge-triggered (“a new result was saved after this visit”). On entering a gate, subscribe before checking current state to avoid races; combine the two with a host revision where available.

A gate freezes presentation at its `atMs`. Audio and captions freeze too. A gate timeout uses elapsed foreground wait time unless a condition declares an unavoidable external deadline; it does not use frozen presentation time. Time limits are adjustable/extendable where appropriate. A timeout takes the script's declared pause/skip-scene/fallback policy and never marks an action successful.

## Seek semantics

`seek({sceneId, timeMs})` seeks presentation by default and performs no host effects. Seeking within a visual-only segment recomputes state directly. Seeking to an unvisited scene or past a state-changing barrier either requires a compatible host checkpoint, limits the seek to a reachable point, or returns a typed block. It must not silently invent the needed app state.

Backward seeking does not undo business actions. “Replay visuals,” “reset fixture and replay,” and “repeat real task” are separate commands with separate policies. In guide mode, Previous normally shows an explanation, not a reverse transaction.

Pause during seek cancels the target autoplay intent. Seeking during audio playback pauses it, verifies the segment and seekable range, sets the media position, waits for readiness, samples visual state, and resumes only if the user is still playing. A stale completion cannot resume an older seek.

## Effects and exactly-once claims

The engine provides run-local deduplication, not universal exactly-once execution. Network retries, crashes, navigation, and multiple tabs can escape local memory. A host action that can affect persistent data must provide an idempotency key or explicit non-retryable contract and preferably a status-query operation.

Actions declare `read`, `ephemeral`, or `persistent` impact in the host registry. The effective classification is host-owned; script hints cannot lower it. Persistent actions require current authorization and, where policy requires it, a real-user confirmation tied to the exact parameters. Unknown completion blocks replay until reconciled.

## Checkpoints and resume

A checkpoint contains script version/hash, scene/path position, compatible host fixture/state version, presentation pose, locale, user accessibility preferences, and redacted effect references. It contains neither credentials nor a universal DOM snapshot. Host state is optional and separately permissioned.

Resume checks all versions and preconditions. An incompatible host state offers restart, continue as read-only explanation, or manual recovery. Local persistence is opt-in and per-origin; no account-wide tracking by default. Production data should usually be referenced by opaque host IDs, not copied into a tour.

## Branches and loops

P0 supports acyclic scene graphs with explicit `next` or user-choice destinations. Unknown destinations, unreachable scenes, and cycles are errors. Later bounded loops require a declared iteration limit and a separate ADR. An AI-generated branch must pass the same validation and policy checks as a handwritten one. No unbounded “retry until the user complies” loops.
