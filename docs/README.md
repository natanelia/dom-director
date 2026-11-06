# Design and implementation index

**Implementation candidate 0.1.0-rc.0 · 6 November 2026 · Canonical language 0.1.0-draft.1**

The reusable core, React bindings and SDK-backed consumer now exist. Start with the [current README](../README.md), [release-candidate evidence](release-candidate.md), [core declarations](../packages/core/src/index.d.ts) and [React integration](../packages/react/README.md) for implemented behavior.

The 22 design chapters below preserve the original vision and trade-offs. They distinguish decided architecture, proposed behavior, deferred extensions and unproven hypotheses. A design statement containing “must” is an acceptance requirement, not automatic proof of implementation. The [milestone ledger](16-roadmap.md) connects shipped slices to their PRs; the original requirements/backlog register remains broader than the candidate.

## Visual editor redesign — design review first

[Creator-first visual editor proposal](visual-editor-redesign.md) responds to the current editor's confusing workflow. It contains a source-backed UX audit, the proposed authoring loop, desktop/mobile wireframes, editing and preview semantics, safety boundaries, and usability gates. This is a **draft proposal, not implemented behavior**. Review the workflow and layouts before changing the editor; the [current visual editor contract](visual-storyboard.md) remains the implementation reference.

## Reading paths

**Product/design:** visual editor proposal → 01 → 02 → 09 → 11 → 16.  
**Runtime implementer:** current package declarations → 04 → 05 → 06 → 07 → 12 → 15.  
**Agent integration:** 10 → 05 → 12 → implemented `agent.js` and the agent consumer.  
**Reviewer:** release-candidate report → 03 → 17 → ADRs → open questions.

| Document | Scope |
|---|---|
| [01 Vision](01-vision.md) | Product promise, personas, modes and boundaries |
| [02 Use cases](02-use-cases.md) | Broad opportunities and feasibility tiers |
| [03 Requirements](03-requirements.md) | Stable requirement IDs and acceptance criteria |
| [04 Architecture](04-architecture.md) | Components, ownership and lifecycle |
| [05 Script format](05-script-format.md) | Canonical JSON, scenes and references |
| [06 Camera and geometry](06-camera-and-geometry.md) | Coordinates, fitting and browser boundaries |
| [07 Timeline and playback](07-timeline-and-playback.md) | Clocks, seeks, effects and interruption |
| [08 Media, captions, cursor](08-media-captions-and-cursor.md) | Narration and simulated gestures |
| [09 Guidance and interactivity](09-guidance-and-interactivity.md) | Watch/Try/Guide and user takeover |
| [10 Agent contract](10-agent-contract.md) | Discovery, commands, permissions and repairs |
| [11 Accessibility](11-accessibility.md) | Keyboard, motion, captions and assistive technology |
| [12 Security and privacy](12-security-and-privacy.md) | Trust model and redaction |
| [13 Integrations](13-integrations.md) | Frameworks and proposed domain adapters |
| [14 Authoring and distribution](14-authoring-and-distribution.md) | Proposed authoring/distribution workflows |
| [15 Testing and performance](15-testing-and-performance.md) | Browser and measurement methodology |
| [16 Roadmap](16-roadmap.md) | Implemented slices, evidence and remaining gates |
| [17 Risks and decisions](17-decisions-and-risks.md) | Risk register and architecture decisions |
| [18 Proposed API](18-reference-api.md) | Historical design proposal; use package declarations for the actual API |
| [19 Example journeys](19-example-walkthroughs.md) | Product scenarios |
| [20 Open questions](20-open-questions.md) | Unresolved experiments and choices |
| [21 Sources](21-sources.md) | Original primary references |
| [22 Flagship demo](22-flagship-demo.md) | Creative direction and acceptance story |

## Contracts and evidence

[Tour schema](../schemas/tour.schema.json), [agent schema](../schemas/agent-command.schema.json), [diagnostic schema](../schemas/diagnostic.schema.json), [requirements](requirements.json), [backlog](backlog.json), [examples](../examples/README.md), [current implementation status](implementation-status.json), [performance summary](evidence/performance.json), and [original design-validation report](validation-report.md).

P0/P1 in the historical register are prioritization labels, not completed-work claims. P2/research items are optional or exploratory. Passing design checks alone never marks a runtime requirement verified. The separate current-status file explicitly retains manual acceptance gaps.
