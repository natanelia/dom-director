# DOM Director core — implementation candidate

Framework-neutral native ES modules with TypeScript declarations and no runtime dependencies. This candidate is private, not published to npm. See the [root quick start](../../README.md), [package preparation](../../PUBLISHING.md) and [release evidence](../../docs/release-candidate.md).

From a source checkout, run `python3 tools/build_runtime.py` at the root to embed the canonical schemas. The camera-only `src/surface.js` entry does not require that build. Packed artifacts contain generated schemas and declarations; the public package entry is `@dom-director/core`, with a camera-only `@dom-director/core/surface` subpath.

## Camera and surface

```js
import {createCamera} from './packages/core/src/index.js';
const camera = createCamera({
  viewport: document.querySelector('#viewport'),
  scene: document.querySelector('#scene'),
  overlay: document.querySelector('#overlay'),
  insets: {bottom: 80},
});
await camera.focus(() => document.querySelector('[data-tour="save"]'), {
  durationMs: 700, paddingPx: 24, maxScale: 3,
});
await camera.reset();
camera.destroy();
```

The host supplies an intentional, initially untransformed wrapper inside a clipped viewport and an independent overlay. Only positive uniform 2D scale and translation are supported. Unsupported ancestors and fixed/sticky descendants select overlay-only mode; `allowPositioned:true` explicitly accepts changed containing-block semantics. No application DOM is silently reparented. Rotation, skew, perspective, CSS zoom and individual transform properties are not approximated.

Camera motion resolves with `completed`, `interrupted` or `destroyed`; malformed input throws `DirectorError`. An AbortSignal cancels a shot without undoing host actions. Reduced motion restores the non-moving overview. Camera focus does not steal keyboard focus.

## Data-only scripts and playback

`compile(jsonTextOrPlainObject)` returns a frozen plan or bounded diagnostics. It validates the canonical schema, resolves narration anchors, checks graph reachability and visual-track conflicts, and never resolves targets or fetches assets. `preview` exposes planned scenes and requested capabilities without copying action arguments.

JSON transport rejects duplicate/reserved keys, invalid Unicode, excessive size/depth, non-finite values and executable data. Host object inputs must be ordinary plain data, not accessors, class instances or proxies. Treat JSON text as the untrusted transport boundary and host resolver functions as separately trusted code.

```js
import {createDirector, mountControls} from './packages/core/src/index.js';
const director = createDirector({
  surface: {viewport, scene, overlay},
  targets: {'app.save': () => document.querySelector('#save')},
});
const result = director.load(script);
if (!result.ok) console.warn(result.diagnostics);
const controls = mountControls(director, controlsContainer);
// Explicit controls call play(), pause(), seek({sceneId,timeMs}), setRate(),
// choose(), next(), stop(), setReducedMotion() or focusTarget().
// Cleanup: controls.destroy(); director.destroy();
```

Commands return `{ok,value,revision}` or `{ok:false,diagnostics,revision}`; malformed construction options throw. Load prepares but never autoplays. `inspect()` reports scene-local time, visited path, waiting reasons and revision. `describe()` exposes authored scene/transcript metadata, not action arguments. `on()` observes semantic transitions; `onFrame()` is the opt-in imperative frame channel. `waitForCompletion(runId,{signal})` is bound to a specific run.

Use [declarations](src/index.d.ts), the [canonical schema](../../schemas/tour.schema.json), the [minimal browser consumer](../../examples/browser/index.html) and [Orbit host](../../site/app.mjs) as the implemented contract. Older design proposals are not additional callable APIs.

## Targets and geometry

Register stable semantic IDs through `createTargetRegistry`. A DOM resolver returns one element or null. A virtual `bounds()` adapter returns a **flat** `{x,y,width,height,space:'scene'|'client'}`. Set `dynamic:true` for targets that move without observable DOM changes, or explicitly call `registry.invalidate()` for cheaper host-driven invalidation.

Secret targets cannot resolve. Private targets require an explicit `privateTargets` grant when constructing the registry. Missing, ambiguous, hidden and clipped targets fail explicitly. Reveal a clipped scroll target through a host-approved operation and retry. Native dialog/popover content requires an overlay in a compatible top-layer container; context or a large z-index cannot override that browser rule.

The geometry cache measures before writes, distinguishes invalidation from changed coordinates, and suppresses subpixel DOMRect round-trip noise. The noise comparison retains accepted numeric geometry, so repeated small true movements accumulate rather than disappearing indefinitely.

## Narration, captions and controls

Provide `narration:{resolveAsset, ...}` to opt into prepared media. The resolver is host-owned; script URI declarations alone do not authorize network access. Silent playback uses presentation time. Opted-in audio has guarded timestamp, startup, stall and early-end handling. `onFailure:'pause'` is explicit recovery; `'text'` continues captioned playback. Playback never completes solely because an untrusted end event fired.

Use `setNarrationEnabled`, `setVolume`, `setCaptions`, `exportCaptions` and the optional native controls. Captions and transcript remain available without sound. Pointer gestures only draw an explanation; they never dispatch trusted input or consent.

## Guided tasks and checkpoints

`createGuidance` owns registered conditions, actions, fixture reset and a default-deny authorization callback. Conditions can observe level state or new revisions with explicit evidence. Actions validate arguments, recheck authorization and retain bounded effect evidence. Persistent actions require Guide mode plus idempotency or reconciliation. Unknown outcomes cannot silently retry.

Try mode requires an isolated resettable fixture. `setMode` and `resetFixture` are cancellable host preparations. Gates expose hints, retry and more-time controls. Visual seek cannot execute or cross an unresolved effect dependency.

`createCheckpointStore(director,{versions,verify,authorize})` stores bounded, in-memory **same-run visual positions**. Capture/restore pause playback; restore verifies current script/host/fixture versions, path and effect evidence. It never restores business data, resets permissions or persists across reloads. Defaults do not grant checkpoint operations.

## Agent integration

`createAgentBridge` accepts serialized canonical command envelopes, explicit command/target grants, a client ID and default-deny authorization. Its ten command types cover discovery, static validation/preview, inspection, load and playback control. It enforces revisions, request identity, bounded storage/concurrency and cancellation. The host's effect policy remains independent of agent permissions.

`proposeTargetRepair` produces a hashed narrow JSON Patch proposal requiring host review; it does not apply it, scrape selectors or grant capabilities. The [agent playground](../../site/agent.mjs) demonstrates the actual bridge using a deterministic draft helper. No model provider, remote transport, authentication service or persistence is installed.

## Verification

Build schemas, then run `node --test packages/core/test/*.test.js`. The browser workflow runs actual HTTP fixtures in Chromium, Firefox and WebKit. Clean tarball/TypeScript consumers, site end-to-end tests, repeated-resource cleanup and measured performance are separate checks. See the release report for exact evidence and manual acceptance still required.
