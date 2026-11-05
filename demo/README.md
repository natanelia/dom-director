# The flagship concept demo

**Not a video. A living story.** A 45-second, real-DOM cinematic experience with a live synthetic mission-control application.

Open [index.html](index.html) in a browser, or serve this directory with a static server:

```sh
python3 -m http.server 8080 --directory demo
```

From the repository root, that command serves the demo at `http://localhost:8080`. The HTML is self-contained: no build, remote fonts, libraries, accounts or external services are required to view it. Browser/embedding policies can still restrict local-file scripts or media; a normal static host is the intended publication path. A static host has **not** been deployed in this deliverable.

## What to try

Press **Roll the demo**, use **Take the wheel**, or select **Try it** to stop at a real checkpoint. Approving it changes the actual fixture state. Scrubbing backward does not repeat or undo the approval. **Guide me** waits at each chapter. Captions, transcript, narration mute, playback rate, easing selection, reduced motion and the live cue inspector are functional.

Narration is an embedded, locally generated eSpeak placeholder, muted by default. It is not a final production voice or a cloud TTS integration. All route geometry and metrics are fictional. The visible cursor is a labeled visual simulation, not trusted input.

## Scope

This is a fixture-specific prototype, not the reusable SDK. The cue sheet uses `dom-director-demo-cues/1`, not `schemas/tour.schema.json`. Do not use this demo to claim completed library milestones, universal wrapping of arbitrary apps, production action safety, agent integration, video export, browser certification or accessibility certification.

The reusable release must replace the local presentation code with the actual packages and canonical script contract. See [creative direction and rollout](../docs/22-flagship-demo.md) and [validation evidence](VALIDATION.md).

## Files

- `src/index.html`: semantic page and synthetic app markup.
- `src/style.css`: responsive visual design; no external fonts.
- `src/model.js`: pure camera/timeline sampling and guide seek limit.
- `src/app.js`: fixture controls, media authority, real local interaction, inspection.
- `assets/cues.json`: the actual six-shot timeline.
- `assets/narration.mp3`: placeholder narration, embedded during the build.
- `build.py`: deterministic self-contained HTML bundler.
- `generate_audio.py`: optional narration regeneration; requires eSpeak and FFmpeg.
- `tests/`: pure-model and browser fixture tests.

## Rebuild and test

```sh
python3 demo/build.py
node --test demo/tests/model.test.cjs
# Optional browser test dependency, separate from the design checker:
python3 -m pip install -r demo/requirements-browser.txt
python3 -m playwright install chromium
python3 demo/tests/browser_test.py
# Or use an existing browser:
BROWSER_EXECUTABLE=/usr/bin/chromium python3 demo/tests/browser_test.py
```

The browser tests render the complete document in memory. The evidence does not imply that local-file navigation or a public deployment was tested. Media autoplay rejection and delayed play completion are explicitly exercised.

No publication, repository mutation, analytics or persistent storage happens when the demo runs. Exporting JSON requires the visitor to click Export. There is no remote agent transport.
