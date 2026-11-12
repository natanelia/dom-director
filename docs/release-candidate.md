# Release-candidate evidence and integration boundaries

Updated 6 November 2026. Package candidate `0.1.0-rc.0`; tour/agent grammar `0.1.0-draft.1`. This is an engineering implementation candidate, not a published npm release or a claim of universal production suitability.

## Implementation ledger

| Slice | Evidence |
|---|---|
| Controlled DOM camera, coordinate conversion, interruption and fallback | [PR 4](https://github.com/natanelia/dom-director/pull/4), `runtime-tests/surface_test.py` |
| Data-only compiler, deterministic scenes, visual tracks and player | [PR 5](https://github.com/natanelia/dom-director/pull/5), [PR 6](https://github.com/natanelia/dom-director/pull/6), core tests and browser player cases |
| Prepared narration, captions, guarded clocks and media recovery | [PR 7](https://github.com/natanelia/dom-director/pull/7), narration unit/browser cases |
| Conditions, host permissions, bounded effect ledger and isolated practice | [PR 8](https://github.com/natanelia/dom-director/pull/8), guidance adversarial tests |
| Version-verified same-run visual checkpoints | [PR 9](https://github.com/natanelia/dom-director/pull/9), checkpoint unit/browser cases |
| One canonical Watch/Try/Guide scenario | [PR 10](https://github.com/natanelia/dom-director/pull/10), shared scenario acceptance |
| Bounded JSON bridge and reviewed repair proposals | [PR 11](https://github.com/natanelia/dom-director/pull/11), agent adversarial/consumer cases |
| React lifecycle, semantic subscriptions, refs, portals and SSR | [PR 12](https://github.com/natanelia/dom-director/pull/12), real React consumers |
| SDK-powered Orbit and agent playground | [PR 13](https://github.com/natanelia/dom-director/pull/13), 17 site cases per engine at its reviewed head |
| Types and clean tarball consumers | [PR 14](https://github.com/natanelia/dom-director/pull/14), package-contract workflow |
| Geometry repair, matched performance and 100-cycle cleanup | [PR 15](https://github.com/natanelia/dom-director/pull/15), raw measurement workflow |
| Exact public artifact and live browser verification | [PR 16](https://github.com/natanelia/dom-director/pull/16), pre/post-deployment acceptance |
| Automated accessibility, keyboard and security-policy review | [PR 17](https://github.com/natanelia/dom-director/pull/17), retained audit findings/screenshots |

A PR link is an inspectable implementation/evidence trail, not a substitute for its current merge/check status. The original 112-item requirements register is a design backlog, not a blanket implementation certificate. In particular, optional transports, domain-specific cameras, persistent host-state restoration and broad device certification are not implied by the core slices.

## Tested matrix

Core runtime and SDK site checks run on Playwright-pinned Chromium, Firefox and WebKit on Ubuntu 24.04. These are real browser engines and HTTP-served consumers, not only pure model tests. WebKit on Linux is not physical iPhone Safari. Mobile-size/reduced-motion tests are layout and interaction evidence, not touch-device certification.

React 18.3.1 is tested in Chromium. React 19.3.1 is tested in Chromium, Firefox and WebKit. Cases cover Strict Mode lifecycle re-entry, stable host rerenders, frame isolation, script replacement, portals, ref cleanup, repeated mounting and hydration. Server import/rendering does not construct browser surfaces. The declared peer range is not proof of tests on every intermediate React version.

The source examples require modern browser DOMMatrix, observers, native modules and AbortController. Use a secure context for the agent bridge's cryptographic hashing. There is no legacy-browser polyfill bundle or cross-origin frame transport.

## Performance and cleanup

The [machine-readable summary](evidence/performance.json) records the successful [measurement run](https://github.com/natanelia/dom-director/actions/runs/42137370418), tested integration SHA, environment and raw-artifact digest. Five warmups precede twenty measured runs of thirty frames for each matched workload.

| Workload | Direct CSS p95 CPU | SDK p95 CPU | SDK setup p95 |
|---|---:|---:|---:|
| 1,000 static elements | 0.1 ms | 0.2 ms | 2.5 ms |
| 10,000 static elements | 0.1 ms | 0.2 ms | 16.7 ms |
| 1,000 updating elements | 0.1 ms | 0.3 ms | 2.3 ms |

These measurements are synchronous host-update/transform/player callback work in synthetic headless Chromium 143.0.7499.4. They exclude paint, raster and deferred observer work. They are neither a speedup claim over direct CSS nor a universal frame-rate promise. The provisional 3 ms p95 callback budget passed. The correctness check first exposed and led to repair of camera lag on unrelated mutations and Firefox subpixel measurement feedback.

The 100-cycle test ends with zero tracked owned observers, listeners, callbacks and overlays, restored styles and preserved host DOM identity. That demonstrates resource ownership in the fixture; it does not prove the absence of every possible heap leak in a third-party application.

## Accessibility and security review

The automated review covers six synthetic SDK page states with pinned axe-core, keyboard task completion, Escape and modal focus restoration. It retains both violations and incomplete/manual-review findings without silently excluding rules. Check the current review artifact for the exact result; automated scans are not WCAG or screen-reader certification.

The security-policy fixture runs same-origin modules without eval, inline-script or connection grants. Inline styles remain allowed because the library applies transforms and overlays. This is CSP integration evidence, not a claim that GitHub Pages serves those headers. Hosts that require style nonces or a different CSP must evaluate their own policy.

Security/adversarial tests cover data-only parsing, size/depth limits, duplicate/reserved keys, missing/secret targets, capability denial, revision races, cancelled asynchronous work, unknown effect outcomes, and bounded request/effect/checkpoint storage. There is no arbitrary method evaluator, remote agent service or automatic action grant. Host adapters are trusted integration code and must honor their documented cancellation/idempotency obligations.

## Manual acceptance still required

Before claiming a generally supported production release, record hands-on Safari/iOS and Android behavior, browser zoom and mobile visual-viewport behavior on the chosen devices, VoiceOver/NVDA reading and focus behavior, contrast/visibility findings that automated tools mark incomplete, and the target host's portals, modals, scrolling and canvas behavior. Perform an independent security/accessibility review where required by the adopting organization.

No such physical-device, screen-reader or independent human certification is claimed here. The work can be installed and evaluated as an RC while those gates remain explicit. npm publication requires a separate authorized release decision.

## Deferred capabilities

Visual recorder/studio, video export, collaborative presentation transport, remote MCP/WebMCP, live model/TTS providers, persistent cross-session checkpoints, native geographic/3D camera adapters and general arbitrary-page injection are not in this candidate. Existing virtual target bounds can describe host-provided geometry; they do not implement those domain-specific camera systems.
