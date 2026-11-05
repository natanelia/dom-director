# Agent working agreement

## Current truth

This is a design-first library repository with a separate fixture-specific concept demo under `demo/`. The reusable player is not implemented. Do not treat the demo-local runtime or its cue format as the proposed public SDK/schema. Only claim implemented behavior supported by its tests; no benchmark, browser compatibility level, or accessibility certification is implied. The root package remains private until an explicit release decision. Do not publish packages, deploy a site, enable telemetry, or add release credentials without authorization.

## Read before changing

Start with README, docs/README, docs/04-architecture, docs/05-script-format, docs/07-timeline-and-playback, docs/12-security-and-privacy, and the ADR relevant to the task. Use docs/requirements.json and docs/backlog.json to scope work. Check the actual repository state and current branch before making assumptions from these instructions.

## Non-negotiable invariants

- Visual seeking never automatically repeats application effects.
- Scripts are data; host adapters own executable behavior and permissions.
- Simulated cursor gestures are not trusted browser input or consent.
- Respect reduced motion, keyboard access, captions, and an always-available exit.
- Do not silently reparent existing application DOM or claim arbitrary-page support.
- One owner per animated property and one presentation-time authority per segment.
- No network, recording, analytics, or persistence by default.
- Cancellation plus epoch checks prevent stale async work from mutating a newer run.
- A missing/ambiguous target fails explicitly; never choose a destructive lookalike.

## Working practices

Use a dedicated branch and small reviewable commits. Fetch/recheck the remote branch tip before writes; prefer atomic multi-file commits and non-forced updates. Never overwrite unrelated user changes. For performance work, collect comparable before/after evidence and test correctness. Keep pure model logic separate from DOM/media/effects. Avoid per-frame framework rerenders and unnecessary dependency additions.

Use independent reviews for geometry, timing/effects, accessibility, and security when additional agents/tools are available. Do not claim such reviews occurred when they did not. Record unresolved questions and failed experiments rather than hiding them.

## Design changes

Update prose, schema, examples, tests, requirements, and ADRs together when semantics change. Use stable IDs, explicit units, bounded values, and structured diagnostics. Mark future extensions as deferred; do not accept schema fields just to make an example look supported.

## Validation

```sh
python3 -m pip install -r requirements-dev.txt
python3 tools/check_design.py
python3 -m unittest discover -s tests -v
```

`npm test` and `npm run validate` are optional aliases requiring the same Python environment. The current checks validate design artifacts only. When runtime code is added, add actual typechecking, browser, accessibility, and performance tests; do not relabel the current checks as runtime evidence.

## Completion report

State what changed, which commands actually ran, what passed/failed, whether a PR/commit was actually published, and what remains unimplemented. Never invent CI results, remote URLs, independent reviews, performance numbers, or package availability.

## Flagship demo work

Read `docs/22-flagship-demo.md` and `demo/README.md`. Edit `demo/src/`, then run `python3 demo/build.py`; `demo/index.html` is generated and must remain current. Run the pure tests with `node --test demo/tests/model.test.cjs`, and browser checks with `python3 demo/tests/browser_test.py` after installing `demo/requirements-browser.txt` and a compatible browser. Record the exact environment. Never label prerecorded synthetic narration as live AI or the demo's data format as the canonical SDK contract.
