# DOM Director core — implementation candidate

Framework-neutral ES modules. No runtime dependencies, network requests, automatic
DOM reparenting, or publication credentials. Package publication is deliberately
disabled; the name is a local candidate, not a claim of registry availability.

From a source checkout, run `python3 tools/build_runtime.py` once from the repository
root to embed the canonical schemas. The camera-only `src/surface.js` entry does
not require this build. Packed runtime artifacts include the generated schemas.

```js
import {createCamera} from './packages/core/src/index.js';
const camera = createCamera({
  viewport: document.querySelector('#viewport'),
  scene: document.querySelector('#scene'),
  overlay: document.querySelector('#overlay'),
  insets: {bottom: 80}, // reserve captions in viewport CSS pixels
});
await camera.focus(() => document.querySelector('[data-tour="save"]'), {
  durationMs: 700, paddingPx: 24, maxScale: 3,
});
await camera.reset();
camera.destroy(); // idempotent; preserves later host edits
```

The host supplies an intentional, initially untransformed wrapper inside a clipped
viewport. Its scene has a stable layout size; the independent overlay must not be
inside the scene. Only translation and uniform positive 2D scale are supported.
Unsupported ancestors and fixed/sticky descendants select overlay-only mode;
`allowPositioned: true` acknowledges changed containing-block semantics explicitly.
Portal and top-layer targets remain client-space targets, not scene members.
Perspective, rotation, skew, CSS zoom, and individual transform properties are not
silently approximated. User browser zoom is distinct from CSS zoom.

`focus` resolves with `completed`, `interrupted`, or `destroyed`; malformed inputs
throw `DirectorError` with a value-redacted diagnostic. Missing/disconnected targets
fail explicitly. The optional `onDiagnostic` receives errors encountered after an
animation starts. An `AbortSignal` cancels a shot without undoing host actions.
Reduced motion resets to the non-moving overview. Focus never steals keyboard focus.

Run pure tests: `node --test packages/core/test/*.test.js`.
Run actual HTTP fixtures: `python3 runtime-tests/surface_test.py` after installing
the repository's Playwright test dependencies and the selected browser.

## Data-only compilation

`compile(jsonTextOrPlainObject)` returns a frozen plan or bounded diagnostics.
It uses the canonical draft schema, resolves narration anchors, validates graph
reachability and track conflicts, and never resolves a target or fetches an asset.
`preview` lists the planned scenes and capabilities without copying action arguments.
JSON text with duplicate keys, reserved keys, invalid Unicode, excessive nesting,
non-finite values, or excessive size is rejected. Host object input must be ordinary
plain data, not accessors, class instances, or proxies. Treat JSON text as the
untrusted transport boundary; host resolver functions are separately trusted code.

## Declarative playback

```js
import {createDirector, mountControls} from './packages/core/src/index.js';
const director = createDirector({
  surface: {viewport, scene, overlay},
  targets: {
    'dashboard.overview': () => document.querySelector('#overview'),
    'dashboard.filters': {label: 'Filters', resolve: () => document.querySelector('#filters')},
  },
});
const result = director.load(script); // A canonical tour, not the prototype demo cue format.
if (!result.ok) console.warn(result.diagnostics);
const controls = mountControls(director, controlsContainer);
// Alternatively wire host controls to director.play(), pause(), seek({sceneId,timeMs}),
// setRate(), choose(), next(), stop(), setReducedMotion(), and focusTarget().
// Observe semantic transitions with on(); opt into frame samples with onFrame().
// Cleanup: controls.destroy(); director.destroy();
```

`inspect()` returns scene-local time, visited path, waiting reasons and command
revision. `describe()` returns the authored transcript/scene descriptions, not action
arguments. `waitForCompletion(runId, {signal})` resolves for that run only. Commands
return `{ok, value, revision}` or `{ok: false, diagnostics, revision}`. A malformed
surface is a construction error. No action executor is enabled by default.

Target `bounds()` adapters return `{x,y,width,height,space:'scene'|'client'}`.
`dynamic: true` opts into fresh measurements for targets moving without DOM changes.
`registry.invalidate()` is the cheaper explicit host notification. Secret targets
cannot be resolved. Private targets require `createTargetRegistry(entries,
{privateTargets:['approved.id']})`, supplied as the director's `registry`.

A clipped target returns `TARGET_CLIPPED`: reveal it through a host-approved operation,
then retry. For modal/top-layer content, the host must place the overlay in a compatible
top-layer container; a normal document overlay cannot paint above a native dialog.

The minimal real consumer is `examples/browser/index.html`. Build the schemas, serve
the repository root, then open that path. The richer Orbit prototype is not yet
using the SDK; its current playback fix is preserved until the integration milestone.
