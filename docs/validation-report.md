# Validation report

**Updated: 5 November 2026. Scope: design artifacts, offline validation tooling, and a separate fixture demo.**

## Local results

**PASS: 79 design-tool unit tests, 10 demo-model tests, and 14 Chromium fixture tests.** These suites were rerun before importing the project into the private GitHub repository. The design checker also passed. The 103 tests are distinct test methods, not an inflated sum of data-driven subcases.

Repository design checks cover three JSON Schemas, six example tours, two agent-command examples, one diagnostic example, the narration caption sidecar, local Markdown file paths, 112 requirement records, and 19 backlog items including the flagship-demo workstream. Requirements have exactly one primary backlog mapping and the dependency graph is acyclic. All reusable-runtime requirements remain `proposed`; planned acceptance-test identifiers are not implemented runtime tests.

The separate demo's test setup and limitations are recorded in [demo/VALIDATION.md](../demo/VALIDATION.md). A fixture-specific player does not establish that the proposed reusable SDK exists.

## Commands run for the repository import

```sh
python3 tools/check_design.py
python3 -m unittest discover -s tests -q
node --test demo/tests/model.test.cjs
BROWSER_EXECUTABLE=/usr/bin/chromium python3 demo/tests/browser_test.py
```

The local environment uses Python 3.13, the pinned `jsonschema`/`referencing` development dependencies, Node 22, and system Chromium through Playwright. Browser tests render the complete document in memory; they do not establish that a hosted site or a real mobile device was tested.

## What the design tests establish

Positive fixtures conform to the draft structural and offline semantic contracts. Negative cases exercise unknown fields/cue kinds, duplicate identifiers, broken target/scene/narration references, graph cycles and reachability, conflicting camera/cursor intervals, narration ordering and timing, declared capabilities, branch ambiguity, malformed or resource-limited JSON, unsafe asset references, and command-envelope restrictions. Error messages avoid copying invalid values. Fixture-caption consistency and local-asset presence checks are covered.

Publishing-helper tests cover shell syntax and rejection of missing, malformed, extra, or unsupported arguments before external calls. They do not exercise authenticated repository creation or a successful push. The create-only helper is not used to update this existing repository.

## Limits

The reusable player, camera SDK, narration SDK, agent transport, React adapter, recorder, and authoring studio remain unimplemented. The Orbit demo has its own narrower implementation and cue format. Its working camera and media controls are not evidence of arbitrary-app compatibility, production action safety, or completion of M1–M6.

There is no reusable-runtime browser matrix, animation benchmark, measured audiovisual-output skew report, screen-reader certification, production security certification, or real application integration result. Revision fields and capability declarations are checked structurally; actual host authorization, stale-session rejection, and general effect isolation still require the runtime.

The local link checker verifies file paths, not heading anchors or external website availability. Remote assets are never downloaded by the design validator. No independent multi-person review is claimed.

## GitHub and publication status

The owner created the private `natanelia/dom-director` repository. The source import uses normal non-forced commits. GitHub successfully ran the initial demo bootstrap, generating its bundled HTML and narration and passing the 24 demo tests. The full design/CI results must be read from the actual [Actions runs](https://github.com/natanelia/dom-director/actions); local results are not a substitute for those results.

No public demo site, npm package, release, or change to repository visibility is part of this import. Temporary asset-import workflows are removed after their bounded work, leaving read-only validation CI.
