# 01 · Vision, product boundaries, and success

## Product thesis

DOM Director is an **explanation and practice layer for software**. It composes attention, time, narration, and optional host-authorized actions. Its medium is the live application, so a viewer can move from passive viewing to meaningful interaction without switching to a separate mockup.

It is not simply pan-and-zoom, a tooltip tour, a session recorder, or a browser agent. Those are neighboring capabilities. The proposed value is a portable script with coordinated playback, understandable failure modes, accessible alternatives, and explicit boundaries between showing something and doing it.

## Three primary experiences

**Watch:** a paced presentation. Visual cues can run over read-only live data. Demonstrated state changes require a sandbox or separately authorized host actions. A decorative click never means a real click.

**Try:** learner-controlled practice in a host-provided resettable fixture. The engine can verify outcomes and offer hints. It cannot infer that an arbitrary production app is a sandbox. Missing fixture support disables this mode.

**Guide:** step-by-step help in the actual app. The learner performs real actions; progression checks meaningful outcomes. Cinematic motion is optional and usually less pronounced than in watch mode.

Authoring/inspection and export are tools around these experiences, not additional permission levels. Switching modes changes presentation policy, never silently broadens capabilities.

## Users

Developers need a small integration boundary and predictable cleanup. Designers and educators need expressive, reusable storytelling without hand-writing timings. Learners need control over pacing, sound, captions, motion, and whether they act. Agents need structured capabilities and errors rather than screenshot guessing. Security reviewers need a clear answer to “what can this script read, change, and send?”

## Product principles with consequences

**Meaning before coordinates.** Scripts refer to `settings.save`, not screen pixels. A host can expose DOM, SVG, chart, map, or editor targets through the same target descriptor.

**Progressive complexity.** The simplest narrative is a short list of scenes. Advanced authors add parallel cues, branches, adapters, timing anchors, and action policies without replacing the core representation.

**Determinism where possible; explicit uncertainty elsewhere.** Rendering a visual state at a specified scene time is deterministic given measured geometry and assets. A live application's data and side effects are not. The format separates those concerns.

**A person can always take over.** Pause, stop, escape, captions, and motion controls remain outside the transformed scene. No mandatory onboarding traps, hidden scroll locks, or fake consent controls.

**Agents assist, hosts authorize.** A model may propose a walkthrough. It may not manufacture permissions, make page text into instructions, or decide that an effect is harmless.

## Intended core

A TypeScript, framework-neutral engine with a declarative JSON format, a transform-based camera, target registry, visual tracks, deterministic scene reducer, media synchronization, captions/transcript, guide gates, events, and explicit host adapters. Add lightweight accessible controls and a React adapter after a plain-DOM fixture works. Optional dependencies must not become required just to focus an element.

## Deliberate non-goals

No universal injection into arbitrary websites in the first release. No security sandbox merely because content is in a DOM wrapper. No promise that changing a CSS transform prevents all layout, paint, rasterization, or GPU work. No built-in unrestricted `eval`, arbitrary browser command execution, credential collection, remote session recording, or cloud-model dependency. No claim that a DOM replay captures server state. No automatic replay of destructive actions when seeking backward or forward.

The core will not own application routing, state, undo history, network mocking, or graphics rendering. It consumes narrowly defined adapters from the host. Multi-page navigation and video rendering are separate extensions.

## Success measures — proposed, not achieved

Integration: a reference dashboard can adopt the surface and target registry without remounting its application during playback. A new author can produce a valid three-scene tour without learning the internal scheduler. An agent can explain every rejected command using a machine-readable error and a safe next action.

Correctness: canceling during any asynchronous step releases all engine-owned effects and does not start a later action. Seeking across an action does not execute it. A missing target never silently focuses the wrong control. A user can exit in every non-destroyed state.

Accessibility: the same task can be understood and completed using keyboard-only controls, captions/transcript, and a non-moving guide. These are release acceptance activities, not an automatic conformance claim.

Performance: report engine contribution separately from application work; use the reproducible test plan in [15](15-testing-and-performance.md). Set budgets after the surface spike, not from an attractive demo on one machine.

## Initial demonstration

Use a synthetic map-editor-like dashboard: overview → filter issues → inspect a map object → try changing a non-persistent label → review the result. It stresses DOM, canvas-like semantic anchors, a side panel, captions, dynamic data, and a real input. It must contain no proprietary product code, internal map data, account information, or production endpoints.
