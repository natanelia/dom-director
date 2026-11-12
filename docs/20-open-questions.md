# 20 · Research questions and decision gates

## Must resolve before core implementation stabilizes

**Q01: Can managed surfaces be integrated without breaking ordinary app behavior?** Test fixed/sticky descendants, portals, top layer, nested scroll, input hit testing, and root dimensions. Failure narrows cinematic support to cooperating surfaces; overlay-only remains available.

**Q02: Which animation backend best preserves time/ownership semantics?** Compare sampled transforms, a synchronized Web Animations backend, and any candidate library under identical fixtures. Measure cancellation, seek, interruption, CPU, and raster work. Choose by evidence, not package popularity or an assumed GPU speedup.

**Q03: What coordinate geometries are truly supported?** Begin with uniform scale/translation. Add nested rotation/skew only with correct quad conversion and tests. Perspective/3D support is not implied by using DOMMatrix.

**Q04: How should native and DOM cameras hand off?** Prototype a synthetic map that exposes projected semantic targets. Require one owner per property and explicit duration/settle signals. If it cannot support deterministic seeking, expose a barrier rather than faking it.

**Q05: What constitutes a successful condition?** Define host revisions and edge/level semantics before building guide mode. Verify subscription races and async server results. A click is not a universal success signal.

**Q06: What happens when an action commits but its response is lost?** Require host reconciliation for retryable persistent actions. Without it, mark outcome unknown and block replay. This cannot be solved only by the timeline engine.

**Q07: What degree of narration precision is achievable across supported browsers?** Measure prepared media, buffer events, rate changes, output delay, and seek. Start with phrase-level anchors, not a word-perfect promise. TTS previews need distinct timing guarantees.

**Q08: How should control and focus work during user exploration?** Test pause-on-input, explicit target focus, keyboard shortcuts, assistive tech, and resume revalidation. User edits must not be overwritten by a camera reset.

## Resolve before a reusable release

**Q09: How large should the public API be?** Validate the simple integration with two distinct hosts. Keep advanced adapters separate from everyday use. Do not expose internals merely because an editor might need them later.

**Q10: How strict is script compatibility?** Decide migration tooling and version policy with actual schema evolution. Unknown operation kinds fail closed; forward compatibility cannot mean silently ignoring safety-relevant data.

**Q11: What is the minimal useful agent transport?** Start in-process. A remote bridge, MCP adapter, and browser-native agent interface have different trust/protocol concerns. Record supported versions and independent security tests when implemented.

**Q12: Which performance budgets are realistic?** Measure the M1/M2 fixture on desktop and representative mobile. Public claims require raw evidence and a stable benchmark harness.

**Q13: How should designers author and localize timing?** Test the declarative JSON/builder before building a studio. A readable phrase-anchor workflow may solve much of the pain with far less code.

**Q14: Which package/repository name should ship?** `dom-director` is a working name. Check actual package availability, collision risk, and project identity before publication; no reservation or trademark clearance is claimed.

## Deferred research

Collaborative co-navigation without remote control; adaptive narration after live questions; automatically generated domain targets; precise multi-surface path planning; cross-app storyline handoffs; offline capture/render pipelines; synchronized multi-language live delivery; privacy-preserving authoring from production traces; demonstrably useful bounded loops; 3D scene cinematography.

Each experiment needs a user need, minimal prototype, measurable acceptance evidence, security/a11y review, and a reason it belongs in an optional adapter or the core. Being imaginable is not enough to make it a release requirement.
