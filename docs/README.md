# Design index

**Draft 0.1.0-draft.1 · 5 November 2026 · Reusable runtime not implemented; fixture demo available**

These documents distinguish **decided for the proposed architecture**, **proposed behavior**, **deferred extensions**, and **unproven hypotheses**. “Must” specifies a future acceptance requirement; it does not assert that code exists. The machine-readable schema validates a bounded draft language, not every future feature described in the vision.

## Reading paths

**Product / design:** 01 → 02 → 09 → 11 → 16.  
**Runtime implementer:** 04 → 05 → 06 → 07 → 12 → 15 → 18.  
**Agent integration:** 10 → 05 → 12 → 14 → examples.  
**Reviewer:** 03 → 17 → ADRs → 20 → validation report.

| Document | What it resolves |
|---|---|
| [01 Vision](01-vision.md) | Product promise, personas, scope, modes, boundaries |
| [02 Use cases](02-use-cases.md) | Broad opportunities, concrete journeys, feasibility tiers |
| [03 Requirements](03-requirements.md) | Stable requirement IDs and acceptance evidence |
| [04 Architecture](04-architecture.md) | Components, ownership, data flow, lifecycle |
| [05 Script format](05-script-format.md) | Canonical JSON, scenes, cues, references, branching |
| [06 Camera and geometry](06-camera-and-geometry.md) | Coordinates, fitting, motion, surfaces, hard browser cases |
| [07 Timeline and playback](07-timeline-and-playback.md) | Clocks, seeks, gates, effects, interruption, persistence |
| [08 Media, captions, cursor](08-media-captions-and-cursor.md) | Narration, synchronization, language, simulated gestures |
| [09 Guidance and interactivity](09-guidance-and-interactivity.md) | Watch / try / guide, tasks, focus, input, user takeover |
| [10 Agent contract](10-agent-contract.md) | Discovery, commands, permissions, repairs, diagnostics |
| [11 Accessibility](11-accessibility.md) | Keyboard, reduced motion, CC, transcript, assistive technology |
| [12 Security and privacy](12-security-and-privacy.md) | Trust model, permissions, isolation, export, redaction |
| [13 Integrations](13-integrations.md) | SPA frameworks, maps, canvas, frames, shadow DOM, routing |
| [14 Authoring and distribution](14-authoring-and-distribution.md) | Builder, recorder, editor, packaging, updates, export |
| [15 Testing and performance](15-testing-and-performance.md) | Browser matrix, adversarial tests, reproducible measurements |
| [16 Roadmap](16-roadmap.md) | Bounded releases, dependencies, acceptance gates |
| [17 Risks and decisions](17-decisions-and-risks.md) | Risk register and architectural decisions |
| [18 Proposed API](18-reference-api.md) | Public SDK surface and adapter contracts |
| [19 Example journeys](19-example-walkthroughs.md) | End-to-end behavior across application categories |
| [20 Open questions](20-open-questions.md) | Experiments, failure criteria, unresolved choices |
| [21 Sources](21-sources.md) | Primary references and the claims they support |
| [22 Flagship demo](22-flagship-demo.md) | Creative direction, storyboard, proof moments, responsive shots, demo-first rollout |

## Machine-readable artifacts

[Tour schema](../schemas/tour.schema.json), [agent command schema](../schemas/agent-command.schema.json), [diagnostic schema](../schemas/diagnostic.schema.json), [requirements](requirements.json), [backlog](backlog.json), and [examples](../examples/README.md).

## Scope legend

**P0:** establish through spikes or implement in the first usable vertical slice.  
**P1:** needed for a credible reusable release, after the core works.  
**P2:** optional ecosystem/advanced capabilities.  
**Research:** no promised release or automatic generalization.

All requirement implementation statuses start as `proposed`. Passing design checks does not change them to implemented or verified. See [validation report](validation-report.md).
