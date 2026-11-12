# M4a — guided tasks, permissions and isolated practice

The reusable player now consumes a host-owned `createGuidance` adapter. Scripts name conditions and actions; declaring a capability does not grant it.

```js
const guidance = createGuidance({
  authorize: async (request, signal) => policy.allows(request, signal),
  conditions: {
    'save.confirmed': {
      evidence: 'server',
      trigger: 'level',
      read: () => ({satisfied: store.saveConfirmed, revision: store.revision}),
      subscribe: notify => store.subscribe(notify), // Must return cleanup.
      hints: ['Check that the server acknowledged your save.'],
    },
  },
  actions: {
    'preview.set': {
      impact: 'ephemeral', requiresFixture: true,
      validate: args => typeof args.value === 'string',
      execute: async (args, {signal, idempotencyKey}) => {
        await fixture.setPreview(args.value, {signal, idempotencyKey});
        return {completed: true};
      },
    },
  },
  fixture: {isolated: true, reset: async ({signal}) => {
    await fixture.reset({signal});return {completed: true};
  }},
});
const director = createDirector({surface, targets, guidance});
```

Host requests bind the exact immutable script, mode, run, scene visit, cue and validated arguments. Permission is checked again after asynchronous preconditions and immediately before dispatch. Persistent actions require Guide mode and a backend-idempotency or reconciliation contract. The library does not promise globally exactly-once network effects.

`condition:…`, `action:…` and `fixture:reset` must be declared where used. Conditions register their evidence level: acknowledgment, UI, domain or server. Level conditions accept current true state; edge conditions require a newer monotonic revision. Subscription setup is race-safe, including synchronous callbacks. Condition deadlines count foreground time; authorization and effect deadlines remain bounded in wall time. Only the authored timeout policy can skip a scene, and skipped work remains visibly incomplete.

`director.setMode(mode)` prepares host policy asynchronously, commits only if still current, and stays paused. `director.resetFixture()` is explicit, Try-only, isolated and host-confirmed. Both return promises of structured Results. Stop, user takeover, reload and destruction cancel preparation. A reset that may have reached the fixture but was not confirmed cannot be blindly retried; the host must establish a fresh isolated fixture. Reset never claims to undo production effects.

An effect ledger binds run/visit/cue to a host idempotency key. It distinguishes authorizing, pending, succeeded, not-started and unknown. Cancellation or timeout after dispatch is unknown even if a late callback reports success. `guidance.reconcile(key)` uses the registered host status query; only explicit succeeded/not-started outcomes unblock retries. The ledger retains at most 1,000 entries and a 4 MiB retained-text budget by default; it fails closed rather than evicting deduplication evidence. Inspect output excludes action arguments and application values.

Native controls expose modes, More time, Retry, authored hints and Reset practice. Pause and Escape remain effective during a gate. Hiding the page while waiting cannot cause a later condition event to auto-resume playback. Input during a pending action pauses the story, without pretending to roll the action back. Visual seeking never invokes a host operation and cannot cross unresolved state dependencies.

## Evidence

This slice adds 21 host-adapter tests, four session regressions and 13 browser integration cases. The browser cases cover real input versus confirmed outcome, hints, user pause, seeking barriers, mode denial, cancellation/re-entry, reset, deadlines, subscription cleanup, unknown action outcomes and reconciliation. Local Chromium used the explicit memory transport because local HTTP navigation is blocked. CI must pass the real HTTP suite in Chromium, Firefox and WebKit before merge.

Review found and repaired two lifecycle edges: hidden-page pause reasons were missing while a gate was already waiting, and asynchronous mode preparation had to acquire its cancellation token before emitting a pause event. The final-scene skip path now emits completion without losing its incomplete flag. Checkpoints and the shared Watch/Try/Guide example are the next M4 slice.

## M3 evidence correction

M3's initial Firefox failure affected both MP3 and uncompressed PCM. A user-owned PulseAudio null sink on the headless runner fixed the strict actual-media tests. It was not established to be a codec-only problem. PR #7 was squash-merged after 55 pure tests and 41 HTTP browser cases per engine passed, plus design/demo checks. No autoplay restrictions or playback assertions were relaxed.
