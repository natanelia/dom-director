# One story, three modes

Build the schemas with `python3 tools/build_runtime.py`, serve the repository root, and open `examples/browser/shared-scenario.html`. This imports the reusable SDK; it is not the fixture-local Orbit prototype under `demo/`.

One exported `sharedScenario` uses the canonical script format in all three modes. Watch explains the checkpoint without approving it. Try waits for the actual checkbox/button in an isolated practice model. Guide also holds at scene boundaries. The host owns separate mode state, permission checks and condition observation. The simulated pointer never clicks. No production submissions, persistence or external network actions occur.

Native controls expose captions, transcript, reduced motion, seeking, exit, retry, hints and practice reset. Mobile layout keeps the task reachable without requiring camera motion. Save/restore uses same-run, version-checked visual checkpoints. Changing fixture state invalidates a saved position; restoring never undoes or repeats an approval.

Uncheck the observation permission to exercise a denied gate, then grant it and explicitly retry. Scrubbing beyond an unresolved dependency is rejected. Stop does not reset approved work. Reset practice is a separate, authorized operation that affects only Try state.

Validation includes two canonical-script tests and seven browser consumer tests in the normal runtime suite: all modes, real input, isolation/reset, permission denial, checkpoint invalidation, mobile/reduced motion and seek barriers. Syntax and draft-schema checks passed locally; cross-browser execution is verified by the PR's Chromium/Firefox/WebKit CI checks. No physical-device or accessibility certification is claimed.

This consumer does not replace the flagship demo yet. Agent integration, React bindings, package checks and release evidence remain later milestones. Host-state restoration across sessions is not implemented by visual checkpoints.
