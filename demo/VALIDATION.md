# Demo validation evidence

Date: 5 November 2026. Scope: the standalone Orbit concept fixture, not the proposed reusable SDK.

## Environment and commands

Local Linux environment; Node v22.16.0; Python 3.13; Chromium 144.0.7559.96 (Debian build); Python Playwright version pinned in `requirements-browser.txt`. Browser tests render the bundled HTML using `page.set_content`, not a hosted deployment. Desktop 1440 × 1100 and mobile-sized 390 × 844 viewports were exercised; this is **not** a real iPhone/Safari test.

```sh
python3 demo/build.py
node --check demo/src/model.js
node --check demo/src/app.js
node --test demo/tests/model.test.cjs
BROWSER_EXECUTABLE=/usr/bin/chromium python3 demo/tests/browser_test.py
python3 tools/check_design.py
python3 -m unittest discover -s tests -v
```

## Results

- 10 pure-model tests pass: easing endpoints/monotonicity, framing, invalid geometry, overview, chapter boundaries, seek barriers, deterministic/reduced-motion sampling, camera continuity, cue timing and time formatting.
- 14 Chromium fixture tests pass: initial document/no external requests, play/pause/media clock, invariant scene layout dimensions, deterministic seeking without approval, Try gate and real button handoff, Guide holds, user takeover, reduced motion/CC/transcript, mobile framing/action, dialog keyboard return, speed/easing inspection, checkbox precondition, rejected-audio fallback and stale-play cancellation.
- JavaScript syntax checks pass.
- The original design checker and 79 design tests were rerun after adding the demo workstream. These are separate from the 24 new demo tests.
- Screenshots were inspected for the desktop page, zoomed checkpoint, mobile page, and mobile checkpoint. A large uncovered edge in the first camera framing was corrected with scene-boundary clamping. Mobile checkpoint framing was changed to focus on the actual button. Persistent `will-change` was removed after inspecting enlarged text.

The tests measure unchanged scene/target layout dimensions across a camera move; they do not establish a universal “no layout work” browser-performance claim. The audio/visual implementation shares a media clock, but no end-to-end perceptual/audio-output skew measurement is included.

## Limitations and failed attempts

Local-file and localhost navigation were blocked by the managed browser environment. Testing therefore used in-memory HTML with the same inline code and embedded media. No browser policies were modified. File-URL navigation, a static HTTP deployment, server response headers, CSP integration and GitHub Pages were not verified.

The first rejection-fallback test failed because its Playwright `evaluate` expression returned a function, causing the harness to call it immediately. Wrapping the prototype override in a block fixed the test setup; the fallback and stale-promise tests subsequently passed. This was a test-harness problem, not evidence of a deployment failure.

No Safari/Firefox/mobile-device matrix, screen-reader audit, contrast certification, performance benchmark, leak soak, native browser zoom trace, arbitrary-host integration or independent review is claimed. Background-page and resize handlers exist, but the full lifecycle contract remains library implementation work. The prototype uses a demo-local cue format and has no general script compiler, policy system, remote agent bridge, production persistent actions, or video export.

The synthetic eSpeak voice is a placeholder. No production narration quality is claimed. No telemetry, storage, accounts or external app data are used.

## Repository import

The original demo was delivered locally before a repository existed. The owner has since created the private `natanelia/dom-director` repository, and the source is being imported there. The 79 design tests, 10 model tests, and 14 Chromium browser tests were rerun locally and passed before this import. GitHub Actions results must be read from the actual workflow run; the local results above are not a claim that CI passed. No public page or npm package is deployed.
