# DOM Director

Cinematic walkthroughs of a living interface. Pan and zoom real DOM, synchronize prepared narration and captions, simulate a pointer, and hand control back to the user without turning the application into a recording.

**Implementation candidate: `0.1.0-rc.0`.** The framework-neutral core and optional React adapter are implemented and tested from source and packed tarballs. Both packages remain private: these names are not a claim of npm availability. The [release-candidate report](docs/release-candidate.md) separates automated evidence, supported integration boundaries, and outstanding manual acceptance work.

[Live experience](https://natanelia.github.io/dom-director/) · [Agent playground](https://natanelia.github.io/dom-director/agent.html) · [Visual authoring](docs/visual-storyboard.md) · [Core API](packages/core/README.md) · [React](packages/react/README.md) · [Design index](docs/README.md)

## Try the source checkout

Node 22 and Python 3.13 are the reference development environment. The core has no runtime dependencies. Building the embedded repository-owned schemas does not fetch assets or remote schemas.

```sh
git clone https://github.com/natanelia/dom-director.git
cd dom-director
python3 tools/build_runtime.py
python3 -m http.server 8080
```

Open `http://localhost:8080/examples/browser/` for the small SDK example. The shared three-mode scenario lives under `examples/`; the richer public-site sources live under `site/`. To build the public experience, install FFmpeg, run `python3 tools/build_site.py`, then serve `site-dist/`. The builder refuses to overwrite an existing output directory. See [deployment](DEPLOYMENT.md) and [local package installation](PUBLISHING.md).

## A camera without a new application

Supply an intentional, initially untransformed scene inside a clipped viewport, with an independent overlay. The library does not reparent existing application DOM.

```html
<div id="viewport" style="position:relative;height:500px;overflow:hidden">
  <div id="scene" style="width:1100px;height:500px">
    <!-- Existing application components remain mounted here. -->
    <button id="save">Save</button>
  </div>
</div>
<div id="overlay" style="position:fixed;inset:0;pointer-events:none"></div>
<div id="controls"></div>
```

```js
import {createCamera} from './packages/core/src/index.js';

const camera = createCamera({
  viewport: document.querySelector('#viewport'),
  scene: document.querySelector('#scene'),
  overlay: document.querySelector('#overlay'),
});

await camera.focus(() => document.querySelector('#save'), {
  durationMs: 700,
  paddingPx: 24,
  maxScale: 3,
});
await camera.reset();
camera.destroy();
```

For a complete walkthrough, use `createDirector`, a canonical script, and host-owned semantic targets. Commands return structured results; check `ok` before continuing. `mountControls` is optional and belongs outside the transformed scene.

```js
import {createDirector, mountControls} from './packages/core/src/index.js';

const director = createDirector({
  surface: {viewport, scene, overlay},
  targets: {'app.save': () => document.querySelector('#save')},
});
const loaded = director.load(script);
if (!loaded.ok) throw new Error(loaded.diagnostics[0].message);
const controls = mountControls(director, document.querySelector('#controls'));
// Explicit user action calls director.play(); load never autoplays.
// Cleanup: controls.destroy(); director.destroy();
```

The [canonical script schema](schemas/tour.schema.json), [typed contracts](packages/core/src/index.d.ts), [minimal browser example](examples/browser/index.html), and [Orbit script](site/orbit.tour.json) are executable integration references. Chapter 18 records the earlier design proposal, not a substitute for the implemented declarations.

## What is implemented

The core provides transform-only camera motion, easing, semantic target registration, data-only compilation, scene branching, play/pause/seek/rate controls, annotations, highlights and simulated cursor gestures. Prepared narration has explicit audio/text clock authority, bounded startup and stall handling, captions, a transcript, and WebVTT export.

Watch, Try and Guide share a script. Hosts own conditions, actions, authorization, isolated fixtures, and unknown-outcome reconciliation. Visual seeking never invokes application actions. Checkpoints restore a verified **same-run visual position**, not arbitrary business state.

The in-process JSON agent bridge supports discovery, validation, preview, inspection and playback commands with explicit grants, revisions, bounded storage and cancellation. Repair helpers propose narrow reviewed patches; they never choose a destructive lookalike or apply a patch automatically. The agent playground uses a deterministic draft helper, not a live model service.

The optional [storyboard builder](docs/storyboard-authoring.md) creates canonical linear Watch tours with stable IDs. The [visual editor](docs/visual-storyboard.md) adds approved-target selection, captions, timing, zoom, scene ordering, bounded undo/redo and JSON export. Editing invalidates agent review; advanced scripts are preserved instead of being converted lossily. Both authoring subpaths are separate from the main runtime entry.

React bindings cover owned lifecycle, semantic state subscriptions, imperative frame callbacks, callback-ref targets, portals and server rendering. The core does not depend on React.

## Integration boundaries

Use a controlled surface, not an arbitrary-page zoom promise. Fixed/sticky descendants, existing transforms and unsupported coordinate chains require explicit handling or overlay-only fallback. Browser zoom is not CSS camera zoom. Native dialogs need a compatible top-layer overlay; cross-origin frames, native map cameras and 3D scenes are not silently supported.

Reduced motion, keyboard controls, captions and exit are part of the implementation. Automated audits are not screen-reader, WCAG or physical-device certification. No network transport, analytics, recording or persistence is installed by default; opted-in host narration can load the source the host authorizes.

## Evidence and development

See [compatibility and acceptance](docs/release-candidate.md), [performance evidence](docs/evidence/performance.json), [security](SECURITY.md), [contribution commands](CONTRIBUTING.md), [agent working agreement](AGENTS.md), and [license inventory](THIRD_PARTY_NOTICES.md).

The 22-chapter design atlas and its 48 use cases remain useful product direction. They do not imply that every proposed requirement or optional extension is shipped. Video export, interaction recording, an advanced branching/timeline studio, remote MCP transport, live TTS, collaboration and geographic/3D adapters remain separate projects.
