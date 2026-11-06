# SDK-powered public-site candidate

This reuses Orbit's existing visual design and prepared synthetic narration, but replaces the fixture-local player with the reusable core. `orbit.tour.json` is the canonical data-only script. `app.mjs` binds host UI and isolated state; it does not implement a second clock, camera sampler, cursor renderer or effect engine.

Run `python3 tools/build_runtime.py` and `python3 tools/build_site.py`, then serve `site-dist/`. The builder stages only explicit application modules, core source modules plus embedded schemas, authored tour data, clipped prepared audio, license and the archived self-contained prototype. It refuses an existing destination and checks template markers/imports. Nothing deploys until the separate Pages workflow integration is merged.

The original prototype remains unchanged under `demo/` and is included at `/prototype/`. Sound is opt-in and resolves only known same-origin assets. FFmpeg cuts scene-local segments from the existing narration; all speech remains a clearly labeled synthetic placeholder. No live model, external fonts, telemetry, capture or persistent storage is configured.

The responsive baseline keeps the actual approval task reachable without camera motion. Captions, playback controls, timeout extension, hints, retry, exit and versioned visual checkpoints are outside the transformed application. Watch never approves automatically. Try and Guide use separate in-memory fixture states; Stop/seek cannot undo or repeat approval. Practice reset is an explicit Try-only operation.

## Agent playground

`agent.html` is a real consumer of the in-process JSON bridge, not an animated mock terminal. It discovers approved public target metadata, drafts a three-scene example deterministically from that catalog, validates/previews, and requires review of the exact script before loading. The drafter is explicitly not a live AI model. External agents can copy the bounded context and return JSON through the same interface.

A missing target fails without selecting a substitute. A script edit invalidates review. The private synthetic inputs never enter discovery or inspection. Approving a script never grants its requested application actions: the host's action policy deliberately denies the adversarial sample. Pause/stop and native host controls remain separate from agent mutations. Request logs are bounded and contain no action arguments or input values.

## Evidence

Five pure model cases and three template tests accompany fourteen browser end-to-end cases for the staged public site. The browser suite runs in Chromium/Firefox/WebKit and covers all Play entry points, sustained timing, real camera interpolation, pause, safe Try/Guide behavior, media failure, mobile/reduced motion, canonical export, and catalog-to-script agent authoring with denied effects/missing targets. CI results must be checked before deployment. Physical-device and screen-reader conformance are not implied.
