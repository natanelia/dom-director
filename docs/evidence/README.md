# Candidate evidence summaries

[Performance and 100-cycle resource cleanup](performance.json) records the exact measured integration commit, raw-artifact digest, environment, workload method and rounded summary. It is not a speedup or universal FPS claim.

[Automated accessibility, keyboard and CSP review](accessibility.json) records six states with zero reported violations at the tested commit. It also preserves the number of incomplete contrast findings instead of treating them as passed. Screenshots and full findings are in the linked CI artifact; artifact retention is finite.

Reproduce fresh measurements from `performance/run.py` and the `Accessibility and security review` workflow. Results apply to their named commits and fixtures. [Issue 19](https://github.com/natanelia/dom-director/issues/19) tracks hands-on device and assistive-technology acceptance. See the [release report](../release-candidate.md) for scope and supported integration boundaries.
