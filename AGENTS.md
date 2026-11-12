# Agent working agreement

## Current truth

The reusable framework-neutral core is implemented under `packages/core/`; optional React bindings live under `packages/react/`. `site/` is the SDK-powered public consumer and agent playground. `demo/` is the preserved original fixture-specific prototype, not the canonical SDK format. Both packages remain private implementation candidates. Do not publish npm packages, add telemetry, introduce model providers or release credentials without explicit authorization. The owner has authorized the existing GitHub Pages demo; do not expand the publication allowlist silently.

Read [README](README.md), [release-candidate evidence](docs/release-candidate.md), the package README/declarations, and the relevant design chapter before editing. Check the actual remote branch head and open PRs before writing. Historical design prose can describe future work; implemented declarations, schemas and tests are the contract.

## Non-negotiable invariants

- Visual seeking never automatically repeats application effects.
- Scripts are bounded data. Host adapters own executable behavior and permissions.
- Simulated pointer gestures are not trusted input or consent.
- Keep reduced motion, keyboard access, captions and an always-available exit.
- Never silently reparent host DOM or promise arbitrary-page support.
- One owner per animated property and one presentation-time authority per segment.
- No network transport, recording, telemetry or persistence by default.
- Cancellation and epochs prevent stale async work from affecting a new run.
- Missing/ambiguous targets fail explicitly; never guess a destructive replacement.
- Unknown effect outcomes remain unknown until the host reconciles them.
- Checkpoints are same-run visual resume, not host-state rollback.

## Working practices

Use dedicated branches and reviewable PRs. Prefer atomic multi-file Git commits, non-forced updates and expected-head leases. Preserve unrelated user changes. Inspect failing checks rather than hiding them, weakening assertions or repeatedly rerunning an actual defect. Review the final diff and current check results before squash merge. Author-account review is not independent approval; never claim otherwise.

Keep pure model, DOM/media and effects separate. Measure comparable workloads for performance claims. Distinguish invalidation from actual geometric change; retain visibility and permission checks even when cached coordinates are unchanged. Avoid per-frame React rerenders and unnecessary runtime dependencies.

## Validation

```sh
python3 -m pip install -r requirements-dev.txt
python3 tools/check_design.py
python3 -m unittest discover -s tests -v
python3 tools/build_runtime.py
python3 tools/build_types.py
git diff --exit-code -- packages/core/src/script.generated.d.ts
node --test packages/core/test/*.test.js
node --test packages/react/test/*.test.js
node --test site-tests/model.test.mjs
python3 tools/check_packages.py
```

Browser prerequisites are pinned in `demo/requirements-browser.txt`; `tools/install_test_browser.sh` installs the selected CI browser and required test audio support. Run `python3 -m unittest discover -s runtime-tests -p '*_test.py' -v` in each supported test engine. React integration has its own workflow and real React consumers. Build the site into a new directory before its end-to-end tests. Preserve the original prototype with `python3 demo/build.py`, model tests and browser tests when touching `demo/src/`.

Performance evidence comes from `performance/run.py`, not assertions about GPU behavior. The 100-cycle check measures owned-resource cleanup, not every possible heap leak. Accessibility/security checks retain automated violations and incomplete findings; do not label them a manual assistive-technology review. Public verification must exercise playback and interaction, not merely return HTTP 200.

## Completion report

State what changed, which commands/checks actually ran, what passed or failed, actual PR/commit/deployment state, and remaining limitations. Never invent benchmark results, browser certification, approvals, package availability or background execution. Update docs, types, schemas, examples and tests together when their contract changes.
