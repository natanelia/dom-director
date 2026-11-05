# DOM Director core — implementation candidate

Framework-neutral ES modules. No runtime dependencies, network requests, automatic
DOM reparenting, or publication credentials. Package publication is deliberately
disabled; the name is a local candidate, not a claim of registry availability.

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
