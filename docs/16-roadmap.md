# 16 · Roadmap and implementation slices

The order is dependency-driven, not a calendar promise. Broad use-case coverage should come from reusable primitives; do not implement 48 separate products.

## M0 — Design foundation (this repository)

Deliver documents, draft schemas, positive/negative examples, requirement IDs, backlog dependencies, ADRs, contribution guidance, and executable design checks. **Runtime remains unimplemented.** Closing this milestone means the design artifacts are reviewable, not that all design questions are settled.

## M1 — Prove the browser surface

Build one synthetic plain-DOM page with a managed wrapper and an independent overlay. Implement focus/reset with correct coordinate conversion and interruption. Test fixed child, scroll, portal, top layer, real input hit testing, resize, actual browser zoom, and destroy. Record traces. Compare direct platform primitives and any candidate dependency backend.

Exit: one usable managed-scene path and one honest overlay-only fallback. If generic wrapping breaks host behavior, narrow the supported integration contract rather than adding undocumented DOM surgery. No media, agent bridge, or studio is needed to prove this.

## M2 — Deterministic visual player

Implement compiler, target registry, geometry cache, state machine, injected clock, visual reducer, camera/annotation/highlight/cursor cues, play/pause/seek, acyclic scene choices, and restoration journal. Use the draft examples as conformance fixtures. Add pure tests and browser tests before introducing real effects.

Exit: exact-time visual sampling; user interruption does not snap; missing targets fail explicitly; repeated load/destroy does not leak; reduced-motion and transcript-first behavior work.

## M3 — Media and accessible controls

Prepared audio, cue anchors, captions/transcript, rate/mute/CC controls, autoplay rejection, buffer handling, and explicit audio/text-only clock handoff. Add keyboard and screen-reader review. Avoid provider-specific TTS as a core dependency.

Exit: instrumented narration-sync report, reliable pause/seek/resume, safe control placement, and a non-moving equivalent walkthrough.

## M4 — Guided tasks and safe practice

Named conditions, gates, timeouts, user takeover, fixture reset, named actions, permission checks, effect ledger, idempotency/reconciliation contract, and seek barriers. Add state-machine/property tests and adversarial cancellation tests.

Exit: a single scenario supports watch, try, and guide without pretending visual playback can undo or repeat persistent actions safely. Denied actions remain denied even when a script changes.

## M5 — Agent and framework integration

Capability/target discovery, structured diagnostics, validation/preview/inspect/control tools, revision checks, reviewed repair patches, and a small React adapter. Start with an in-process bridge. Add remote/MCP/browser transport only after its threat model and version are specified.

Exit: an agent can produce and validate a useful tour from a catalog, handle a missing target safely, and stop when policy denies an action. The React demo survives lifecycle re-entry and portal cases.

## M6 — Reusable release candidate

Publish measured browser support, performance traces, package-consumer tests, documentation, security/a11y review notes, migration/version policy, fixture demo, and license inventory. Package names are checked and reserved only as part of actual publication. No release credentials or publishing workflow is included in this design scaffold.

## Optional extensions after evidence

Visual studio and recorder; geographic/3D/editor adapters; reusable content registry; offline bundles; collaborative presentations; semantic change review; Playwright-based fixture capture; video export; WebMCP/MCP transports; bounded adaptive branches; live narration generation. Each needs a bounded RFC and acceptance evidence, not a silent expansion of the core.

## First implementation pull requests

**PR-A: surface spike.** The managed wrapper, focus/reset math, interruption, and explicit fallback; browser evidence and no runtime claims beyond that fixture.

**PR-B: deterministic player.** Validated data format, pure reducer, visual cues, controls, stop/seek, and leak tests.

**PR-C: narration and CC.** One prepared audio segment, cue anchors, captions/transcript, autoplay/error handling, and measured skew.

**PR-D: guided interaction.** User-driven gate plus safe fixture action, permission checks, effect deduplication, and seek barrier tests.

Keep each PR reviewable. Design changes that affect the language, trust model, or lifecycle update the schema/ADRs/examples/tests in the same PR.

## Machine-readable backlog

[backlog.json](backlog.json) lists work packages, dependencies, requirement IDs, outputs, and acceptance criteria. [requirements.json](requirements.json) is the coverage source of truth. Every requirement starts as proposed; status changes require code and evidence links. Optional ideas remain separate from release-blocking requirements.

## Flagship demo is a parallel product workstream

Build the experience early, not as marketing polish deferred to M6. The [flagship demo plan](22-flagship-demo.md) maps D0–D5 onto M0–M6. A [standalone concept](../demo/index.html) now proves the intended feel with fixture-specific code. It does **not** close any library implementation milestone.

M1–M2 replace its camera/player with the real packages and canonical script. M3 supplies production-grade media and accessible controls; M4 supplies safe guided tasks; M5 adds a genuine agent-generated scenario; M6 validates and deploys the public site only with authorization. Preserve this recognizable story as an end-to-end acceptance fixture throughout.
