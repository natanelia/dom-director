# 21 · Primary sources and factual boundaries

Reviewed while preparing this draft on **5 November 2026**. Specifications and official documentation may change; pin relevant versions/commits when implementation begins. These sources support browser/protocol facts, not the correctness or performance of the proposed DOM Director design. No claim of a unique market gap or exhaustive library survey is made.

## S1 — CSS transform rendering model

[CSS Transforms Module Level 1, W3C](https://www.w3.org/TR/css-transforms-1/), especially the transform rendering model. Supports the distinctions among visual transforms, normal flow, overflow, stacking contexts, containing blocks, and transformed client rectangles.

## S2 — CSS transforms implementation guidance

[transform, MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/transform) and [Using CSS transforms, MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Transforms/Using). Supports transformability and practical accessibility/positioning cautions. Neither source guarantees compositor-only behavior for a whole application.

## S3 — Web Animations timing

[Web Animations, W3C](https://www.w3.org/TR/web-animations-1/) and [Animation.currentTime, MDN](https://developer.mozilla.org/en-US/docs/Web/API/Animation/currentTime). Supports timing-model/current-time concepts; the director's single-clock design and reducer are original proposed architecture.

## S4 — Media playback and autoplay

[HTML Standard: media elements, WHATWG](https://html.spec.whatwg.org/multipage/media.html). Supports media readiness/playback behavior and the fact that autoplay depends on user-agent/system policy. A script cannot assume its Play request succeeds.

## S5 — Caption interchange

[WebVTT, W3C](https://www.w3.org/TR/webvtt1/). Supports time-aligned cues and text-track concepts. DOM Director's custom overlay and plain-text cue policy are design choices, not requirements imposed by WebVTT.

## S6 — Accessibility

[WCAG 2.2, W3C](https://www.w3.org/TR/WCAG22/) and [Understanding Captions (Prerecorded), W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded). Supports caption and accessibility requirements. Animation from Interactions is AAA; the project separately chooses a reduced-motion/static-path product requirement. No conformance has been assessed for the unimplemented runtime.

## S7 — Synthetic versus trusted events

[DOM Standard, WHATWG](https://dom.spec.whatwg.org/), `Event.isTrusted` and event dispatch. Supports the distinction between scripted events and user-agent dispatch. The visual cursor is not actual trusted user input.

## S8 — Frame and origin boundaries

[HTML Standard: web messaging](https://html.spec.whatwg.org/multipage/web-messaging.html) and [HTML Standard: browsers/origins](https://html.spec.whatwg.org/multipage/browsers.html), WHATWG. Supports origin isolation and messaging validation requirements; a cooperative bridge does not bypass permissions.

## S9 — Display capture

[Screen Capture, W3C](https://www.w3.org/TR/screen-capture/). Supports the permissioned nature of display capture. It does not supply a universal silent DOM-to-video exporter.

## S10 — Panzoom reference

[Panzoom official documentation](https://timmywil.com/panzoom/) and [repository](https://github.com/timmywil/panzoom). Demonstrates transform-based pan/zoom primitives. No specific latest version or compatibility claim is used as a design assumption.

## S11 — Guided-tour reference

[Driver.js official documentation](https://driverjs.com/) and [interactive tours](https://driverjs.com/docs/interactive-tours). Demonstrates guided overlays and interactive progression. This does not establish complete cinematic timing or safe-effect semantics for this project.

## S12 — Agent transport/security references

[Model Context Protocol security policy](https://github.com/modelcontextprotocol/modelcontextprotocol/security/policy) and [WebMCP tool security, Chrome for Developers](https://developer.chrome.com/docs/ai/webmcp/secure-tools). These inform optional transport/security research. DOM Director does not claim to implement either protocol or support every browser; a transport-specific RFC must state the version and environment it actually supports.

## S13 — Browser automation and clocks

[Playwright Clock](https://playwright.dev/docs/clock), [Page API](https://playwright.dev/docs/api/class-page), and [Trace Viewer](https://playwright.dev/docs/trace-viewer). Supports future testing/capture planning. Clock control and screenshot capture alone do not prove deterministic audiovisual rendering.

## S14 — Schema format

[JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12). Defines the schema dialect used by the draft contracts. Schema validation does not replace semantic reference/graph/timing checks or host authorization.

## S15 — Development validator

[python-jsonschema documentation](https://python-jsonschema.readthedocs.io/). The repository uses an explicitly pinned installed development validator for design checks, not as a browser runtime dependency. Tests and the validation report identify the environment used; no claim that it is the latest release is needed.

## Reference discipline

Source-backed browser constraints are distinguished from proposed API behavior, illustrative use cases, and benchmark targets throughout the design. Avoid copying third-party implementation code or assets into the project without license review. All runtime support and performance claims require new implementation evidence.
