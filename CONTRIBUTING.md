# Contributing

Start with [AGENTS.md](AGENTS.md) and the [release-candidate report](docs/release-candidate.md). Keep PRs focused, preserve the controlled-surface and host-permission contracts, and record evidence rather than claiming broad compatibility.

## Fast checks

Use Node 22 and Python 3.13 as the reference environment. The core itself has no runtime dependencies.

```sh
python3 -m pip install -r requirements-dev.txt
python3 tools/check_design.py
python3 -m unittest discover -s tests -v
python3 tools/build_runtime.py
python3 tools/build_types.py
node --test packages/core/test/*.test.js
node --test packages/react/test/*.test.js
node --test site-tests/model.test.mjs
python3 tools/check_packages.py
```

The package check uses temporary clean consumers and test-only registry dependencies, with install scripts disabled. It tests packed archive contents, entry points, server rendering and positive/negative TypeScript cases. It does not publish packages.

## Browser and site checks

```sh
BROWSER_ENGINE=chromium bash tools/install_test_browser.sh
python3 -m unittest discover -s runtime-tests -p '*_test.py' -v
```

Repeat with `BROWSER_ENGINE=firefox` and `BROWSER_ENGINE=webkit` for the full runtime matrix. React's workflow tests exact React 18/19 consumers and hydration rather than mocked hooks.

FFmpeg is required only for building the public site's prepared narration. Build into a new directory; do not overwrite a user-owned directory to make a test pass.

```sh
python3 tools/build_site.py
python3 site-tests/build_test.py
python3 site-tests/browser_test.py
```

The deployment workflow additionally verifies exact staged bytes at a project subpath. The original prototype remains separate: edit `demo/src/`, rebuild `demo/index.html`, and run its model/browser checks when that source changes.

## Review

Test new behavior at the narrowest useful level and through a real consumer. Fault-inject late promises, missing targets, denied permissions and invalid media clocks. Changes to script semantics must update schema, generated declarations, examples and validation together. Record measured environments and failed experiments. Do not weaken a benchmark's correctness check to improve its timings.

Review screenshots for overflow and usable controls. Automated accessibility findings require a fix or a documented, reviewed scope decision—not silent rule exclusion. Manual screen-reader and physical-device results must be performed and recorded separately.

A PR author may record self-review, but this is not independent approval. Merge only after inspecting current changes and the relevant checks; prefer squash merge for one coherent change. Registry publication remains a separate maintainer decision.
