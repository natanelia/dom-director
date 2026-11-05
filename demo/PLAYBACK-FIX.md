# Playback clock repair — 5 November 2026

## Report and reproduction

Report: pressing Play immediately skips to the end. The original browser suite passed locally in Chromium, so the precise device-specific trigger has not been established. No physical iPhone reproduction is claimed.

The deployed source nevertheless had two directly reproducible failure paths: `tick()` accepted media timestamps without checking elapsed real time, and the audio `ended` handler unconditionally assigned the full tour duration. Injecting either an early media-end event or a 45.367-second timestamp immediately after Play reproduced the jump to 45.36 seconds within 400 milliseconds. A stale end event during muted playback reproduced the same failure. All three regression cases fail against the original bundle and pass after this repair.

## Repair

Silent playback now uses `performance.now()` and never starts a muted audio decoder as a clock. Enabling narration transfers time authority from the current presentation position to guarded audio samples. Pausing, resuming, changing rate, and switching sound reanchor that position.

Media readings must be finite, nonnegative and plausible for elapsed time and playback rate. A small rounding tolerance cannot rewind the presentation; per-sample and cumulative bounds prevent a single leap or repeated fast-forward. Explicit user seeks start a new clock rather than pretending to be natural playback.

An early audio end continues from the last validated visual position with captions. It cannot complete the tour or bypass a guide/practice gate. Late events after pause are ignored. Rejected or unresolved audio starts fall back to captions; epochs prevent an old play promise from restoring audio after cancellation. Only the presentation timeline completes the tour.

## Evidence

Local environment: Node 22.16.0, Python 3.13, system Chromium 144.0.7559.96, Playwright 1.57.0. All 14 pure-model tests and 27 browser tests pass locally. The three selected regression cases fail against the original bundle with `45360.0 not less than 2000`.

Local HTTP navigation is blocked by the managed browser policy. Local tests therefore used the explicitly selected `DEMO_TRANSPORT=memory` mode; browser policies were not changed. The normal test path serves the complete document over HTTP at `/dom-director/`. CI is configured to run that path in Chromium and WebKit; results must be checked on the PR/run before claiming success.

Commands:

```sh
python3 demo/build.py
node --check demo/src/model.js
node --check demo/src/app.js
node --test demo/tests/model.test.cjs
BROWSER_EXECUTABLE=/usr/bin/chromium DEMO_TRANSPORT=memory python3 demo/tests/browser_test.py
# In an environment supporting loopback navigation:
python3 -m playwright install --with-deps chromium webkit
python3 demo/tests/browser_test.py
BROWSER_ENGINE=webkit python3 demo/tests/browser_test.py
```

The browser cases cover all four Play entry points, bounded real-time progression, animated camera transitions, sound handoffs, early/stale end events, invalid/jumping media clocks, pending/rejected play promises, pause/resume/rate changes, replay, mobile touch input, Try gates, and the previous interactions. Mobile-sized browser tests and Linux WebKit are not substitutes for testing Safari on a physical iPhone. No SDK milestone or general browser certification is claimed.
