# Validation report

**Updated: 5 November 2026. Scope: design artifacts, offline validation tooling, and a separate fixture demo.**

## Results

**PASS: 79 design-tool unit tests, 10 demo-model tests, and 14 Chromium fixture tests.** These suites passed locally before import and in the [GitHub import-validation run](https://github.com/natanelia/dom-director/actions/runs/41954752262). The design checker and bundled-demo freshness check passed too. The 103 tests are distinct test methods, not an inflated sum of data-driven subcases.

The import also verified SHA-256 hashes of the validator and test source, canonical content hashes of all schemas and JSON examples, and the exact original 112-requirement manifest. JSON was reformatted without changing its contents.

Repository design checks cover three JSON Schemas, six example tours, two agent-command examples, one diagnostic example, the narration caption sidecar, local Markdown file paths, 112 requirement records, and 19 backlog items including the flagship-demo workstream. Requirements have exactly one primary backlog mapping and the dependency graph is acyclic. All reusable-runtime requirements remain `proposed`; planned acceptance-test identifiers are not implemented runtime tests.

The separate demo's test setup and limitations are recorded in [demo/VALIDATION.md](../demo/VALIDATION.md). A fixture-specific player does not establish that the proposed reusable SDK exists.

## Commands

```sh
python3 tools/check_design.py
python3 -m unittest discover -s tests -v
python3 demo/build.py
node --check demo/src/model.js
node --check demo/src/app.js
node --test demo/tests/model.test.cjs
python3 demo/tests/browser_test.py
```

The local environment uses Python 3.13, the pinned `jsonschema`/`referencing` development dependencies, Node 22, and system Chromium through Playwright. Local browser execution supplied `BROWSER_EXECUTABLE=/usr/bin/chromium`. GitHub used Ubuntu 24.04, Python 3.13, and the Chromium installed by pinned Playwright 1.57.0. The workflow logs provide the actual runner details.

Browser tests render the complete document in memory; they do not establish that a hosted site or a real mobile device was tested.

## What the design tests establish

Positive fixtures conform to the draft structural and offline semantic contracts. Negative cases exercise unknown fields/cue kinds, duplicate identifiers, broken target/scene/narration references, graph cycles and reachability, conflicting camera/cursor intervals, narration ordering and timing, declared capabilities, branch ambiguity, malformed or resource-limited JSON, unsafe asset references, and command-envelope restrictions. Error messages avoid copying invalid values. Fixture-caption consistency and local-asset presence checks are covered.

Publishing-helper tests cover shell syntax and rejection of missing, malformed, extra, or unsupported arguments before external calls. They do not exercise authenticated repository creation or a successful push. The create-only helper is not used to update this existing repository.

## Limits

The reusable player, camera SDK, narration SDK, agent transport, React adapter, recorder, and authoring studio remain unimplemented. The Orbit demo has its own narrower implementation and cue format. Its working camera and media controls are not evidence of arbitrary-app compatibility, production action safety, or completion of M1–M6.

There is no reusable-runtime browser matrix, animation benchmark, measured audiovisual-output skew report, screen-reader certification, production security certification, or real application integration result. Revision fields and capability declarations are checked structurally; actual host authorization, stale-session rejection, and general effect isolation still require the runtime.

The local link checker verifies file paths, not heading anchors or external website availability. Remote assets are never downloaded by the design validator. No independent multi-person review is claimed.

## GitHub and publication status

The owner created the private `natanelia/dom-director` repository. The source import used normal non-forced commits. The initial [demo bootstrap](https://github.com/natanelia/dom-director/actions/runs/41952512249) generated the bundled HTML and narration and passed the 24 demo tests. The subsequent import-validation run linked above passed all 103 tests.

Both temporary import workflows have been removed. The remaining read-only validation workflow reruns the suites on pushes and pull requests. Check the latest [Actions runs](https://github.com/natanelia/dom-director/actions) for the result associated with any later commit; an earlier green run does not certify later changes.

No public demo site, npm package, release, or change to repository visibility is part of this import.
