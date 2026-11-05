# Versioned, in-memory resume checkpoints

`createCheckpointStore(director, options)` saves a verified presentation position and returns structured results. It never copies the DOM, records host business data, executes actions, rolls back a fixture, or stores anything on disk. This deliberately conservative implementation is same-director and same-run only. It does not implement the optional cross-session host-state capture/restore adapter described in the design.

```js
import {createCheckpointStore} from './src/index.js';
const checkpoints = createCheckpointStore(director, {
  versions: () => ({script: 'tour-content-v1', host: 'app-v2', fixture: 'fixture-revision-3'}),
  authorize: (request, signal) => hostPolicy.allows(request.capability),
  verify: (checkpoint, signal) => hostState.matches(checkpoint.versions),
});
const saved = await checkpoints.capture();
// Later in this run and on the same selected path:
if (saved.ok) await checkpoints.restore(saved.value.id);
checkpoints.destroy();
```

Host callbacks are trusted, read-only code. They must honor cancellation, avoid exposing secrets in version IDs, and report explicit boolean permission/evidence. Script capability declarations cannot grant checkpoint permission. The default authorizer denies every request. Authorization is rechecked after host verification; all versions and effect evidence are rechecked before commit. Each operation has a bounded wall-time deadline (5 seconds by default, at most 30 seconds).

Capture pauses playback. Restore stays paused and preserves the user's current reduced-motion, captions and audio preferences. Loading a script again, changing mode, resetting to a new run, switching branches, changing any version, or changing the effect ledger invalidates the checkpoint. Existing seek barriers still apply. A failed verification does not attempt to invent compatible application state; the host can offer an explicit isolated reset or manual recovery instead.

Pending conditions, host preparation, and unknown/in-flight actions block capture and restore. Stop, other commands, reload and destroy cancel asynchronous verification. A late callback cannot store a checkpoint or restore playback. Exceptions from host callbacks become value-redacted diagnostics.

Storage defaults to 16 entries and a 1 MiB retained-text budget. Count and text budgets are separate; neither silently evicts records. `list()` returns frozen metadata only. `remove(id)` and `clear()` are explicit; `destroy()` is idempotent and cancels work. Destroy the store alongside its director. No persistence/import API or remote transport is included.

## Evidence

`packages/core/test/checkpoints.test.js` contains 18 pure tests for version checks, same-run scope, branch/effect safety, authorization revocation, cancellation, late completion, storage budgets and cleanup. These passed locally under Node 22.16.0. `runtime-tests/checkpoints_test.py` adds five real-director browser cases to the existing Chromium/Firefox/WebKit CI matrix. Check the PR checks for their actual results; no physical-device or accessibility certification is implied.

This slice addresses the bounded version-verification part of ACT-007 and preserves TIM-004/visual-only seeking. Host-state restoration and cross-session persistence remain deferred. The shared Watch/Try/Guide consumer is a separate M4 acceptance slice.
