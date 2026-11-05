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

The presentation session is currently an internal model: its barriers cannot
execute host work without an explicit host adapter. Its DOM facade is the next
implementation slice. Declaration of a capability is not authorization.
