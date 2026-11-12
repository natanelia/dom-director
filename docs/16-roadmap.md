# 16 · Milestones and implementation evidence

The original dependency order remains M0 → M1 → M2 → M3/M4 → M5 → M6. The core implementation has now progressed from a design scaffold to an engineering release candidate. This ledger replaces the obsolete statement that no reusable runtime exists.

## M0 — Design foundation

Delivered the 22-chapter design atlas, eight ADRs, 48 use cases, canonical draft schemas, examples, 112 requirement IDs and the dependency backlog. The design checker and its tests validate contracts, links and traceability. They do not certify browser behavior.

## M1 — Controlled browser surface

Implemented managed DOM focus/reset, coordinate conversion, cancellation, restoration and explicit overlay-only fallback in [PR 4](https://github.com/natanelia/dom-director/pull/4). The host supplies an intentional scene root; arbitrary application reparenting is not attempted. Browser fixtures cover layout, hit testing, scroll, portals, transforms, resize and cleanup. Physical browser/device zoom acceptance remains separately documented.

## M2 — Deterministic visual player

Implemented data-only compilation and the scene coordinator in [PR 5](https://github.com/natanelia/dom-director/pull/5), then the reusable renderer, semantic targets, geometry caching and native controls in [PR 6](https://github.com/natanelia/dom-director/pull/6). Pure sampling and visual seeking do not execute application effects. [PR 15](https://github.com/natanelia/dom-director/pull/15) repairs invalidation/subpixel feedback found by the later correctness benchmark.

## M3 — Narration, captions and controls

Implemented prepared audio, narration anchors, explicit audio/text clock handoff, startup/stall recovery, captions, transcript, rate/mute preferences and WebVTT output in [PR 7](https://github.com/natanelia/dom-director/pull/7). Media fault and cross-scene tests exercise actual consumers. Keyboard/reduced-motion and automated accessibility checks are evidence; hands-on assistive-technology review is not claimed complete.

## M4 — Guided tasks and safe practice

[PR 8](https://github.com/natanelia/dom-director/pull/8) implements conditions, timeouts, host permissions, isolated fixtures, effect evidence and reconciliation. [PR 9](https://github.com/natanelia/dom-director/pull/9) adds version-verified same-run visual checkpoints, explicitly not host-state rollback. [PR 10](https://github.com/natanelia/dom-director/pull/10) supplies one canonical Watch/Try/Guide scenario with real user approval. Unknown outcomes and denied actions do not become permitted through seeking or script changes.

## M5 — Agents and framework integration

[PR 11](https://github.com/natanelia/dom-director/pull/11) implements the in-process JSON bridge, target/capability discovery, validation/preview/inspection, revision checks, bounded request retention and reviewed repair proposals. [PR 12](https://github.com/natanelia/dom-director/pull/12) implements React lifecycle, semantic subscriptions, refs, portals and SSR. [PR 13](https://github.com/natanelia/dom-director/pull/13) migrates Orbit to the SDK and adds the real bridge consumer. Its deterministic authoring helper is not mislabeled as a live AI model.

## M6 — Reusable engineering candidate

The candidate work is divided into [typed tarballs and clean consumers (#14)](https://github.com/natanelia/dom-director/pull/14), [performance and repeated cleanup (#15)](https://github.com/natanelia/dom-director/pull/15), [staged/live deployment verification (#16)](https://github.com/natanelia/dom-director/pull/16), and [automated accessibility/security-policy review (#17)](https://github.com/natanelia/dom-director/pull/17). Documentation, migration policy and license inventory describe the resulting supported scope.

Completion of these engineering slices means an inspectable, tested candidate—not published npm packages, universal host compatibility or independent certification. The [release report](release-candidate.md) records the manual physical-device, assistive-technology and maintainer-publication gates. Do not silently waive them to label every original requirement complete.

## Optional extensions, not core release claims

Visual studio/recorder, geographic/3D/editor camera adapters, video export, collaboration, persistent cross-session checkpoints, content registry, remote MCP/WebMCP transports and live narration/model providers each need a bounded RFC and acceptance evidence. Virtual target bounds are a generic host integration primitive, not an implementation of all those products.

## Current sources of truth

[Implementation status](implementation-status.json) records scoped slice status. [Release evidence](release-candidate.md) links tests and limitations. The original [backlog](backlog.json) and [requirements](requirements.json) remain the broader product register. The [flagship design](22-flagship-demo.md) remains the creative reference, while `site/` is the actual SDK consumer and `demo/` preserves the original prototype.
