# Studio startup verification

Public verification of revision `0bd2461fd11001ca07a8fffc9c51125b7f991a37`
(run `43239682537`) caught one Chromium timeout before the first Studio test body.
Exact artifact hashes, the flagship and eight storyboard cases passed; nineteen
subsequent Studio baseline cases also passed. Firefox and WebKit passed their
complete public checks. The original failing setup did not preserve enough
startup evidence to identify the cause. This is **not** proof of a CDN problem,
a camera bug, or a repaired runtime defect.

`studio-tests/startup.py` now requires an existing Studio root and an explicit
`data-ready="true"`. A declared initialization error fails immediately. A missing
root is not ready merely because JavaScript `undefined` differs from `'false'`.
Navigation remains bounded by the existing eight-second test deadline. There is
no automatic reload, test retry, increased timeout, or waived playback assertion.

Before rethrowing a startup failure, the helper writes a bounded JSON report and
tries to capture the synthetic viewport. Reports identify document/module/style
paths, response statuses, failed/pending requests, page-error classes and the
fixture's ready/status state. URLs omit query strings and external addresses;
headers, request/response bodies, cookies, arbitrary DOM dumps and environment
variables are not collected. The report is also printed in CI logs. Failed
captures never replace the original failure. Page cleanup is registered before
navigation, so unittest closes pages even when `setUp` fails. Probe listeners are
always removed.

The public verification workflow retains only `studio-results/` diagnostics for
seven days, including failed startup evidence. This changes test artifacts, not
the GitHub Pages publication allowlist or runtime permissions. Reports and
screenshots are for the synthetic Orbit fixture, not arbitrary customer apps.

`startup_test.py` checks the helper without a browser. `startup_browser_test.py`
injects failed dependency requests, evaluation errors, a missing root and an
explicit startup error into the staged fixture, plus a real cold-start case.
These controlled negative tests run in all three CI engines; their shorter
injected-failure deadline does not change the ordinary eight-second deadline.
The existing public editing suite continues to use actual, unmodified live
responses. Do not describe a successful retry as a proven root-cause fix.
